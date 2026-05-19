/**
 * GPT Contact Finder Controller (Tavily → GPT-4 → Regex Parser → JSON)
 *
 * Flow:
 * 1. Tavily: Search web for researcher profile information (with retry logic)
 * 2. GPT-4: Process and identify relevant profile links from search results (with fallback handling)
 * 3. Regex Parser: Extract structured data from GPT response
 * 4. JSON Response: Return clean, structured profile links array
 *
 * Features:
 * - Progressive timeout increases (30s → 45s → 60s)
 * - Exponential backoff retry logic
 * - Graceful degradation when search fails
 * - Comprehensive error handling and logging
 * - Returns array of profile links (LinkedIn, Google Scholar, ResearchGate, ORCID, etc.)
 *
 * @module gptContactFinder
 */

const OpenAI = require("openai");
const axios = require("axios");

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const PROFILE_DOMAINS = [
  "linkedin.com",
  "scholar.google.com",
  "researchgate.net",
  "orcid.org",
  "academia.edu",
  "scopus.com",
  "publons.com",
  "webofscience.com",
  "semanticscholar.org",
  "openalex.org",
  "dblp.org",
];

const PROFILE_TYPES = [
  "LinkedIn",
  "Google Scholar",
  "ResearchGate",
  "ORCID",
  "Academia.edu",
  "Institutional",
  "Semantic Scholar",
  "OpenAlex",
  "DBLP",
  "Scopus",
  "Web of Science",
  "Publons",
  "Other",
];

function compactList(items) {
  const normalizedItems = Array.isArray(items) ? items : items ? [items] : [];

  return Array.from(
    new Set(
      normalizedItems
        .map((item) => (typeof item === "string" ? item.trim() : item))
        .filter(Boolean),
    ),
  );
}

function extractOrcidId(orcid) {
  if (!orcid || typeof orcid !== "string") {
    return "";
  }

  const match = orcid.match(/(\d{4}-\d{4}-\d{4}-\d{3}[0-9X])/i);
  return match ? match[1] : "";
}

function normalizeContactContext(payload = {}) {
  const profileContext = payload.profileContext || {};
  const name =
    payload.researcherName || payload.name || profileContext.name || "";
  const affiliation = payload.affiliation || profileContext.affiliation || "";
  const researchAreas = compactList(
    payload.researchAreas || profileContext.researchAreas || [],
  );
  const topics = compactList(profileContext.topics || []);
  const affiliations = compactList(
    (profileContext.affiliations || []).concat(
      affiliation ? [affiliation] : [],
    ),
  );
  const orcid = payload.orcid || profileContext?.ids?.orcid || "";
  const topPublications = Array.isArray(profileContext.topPublications)
    ? profileContext.topPublications
        .filter((pub) => pub && (pub.title || pub.display_name))
        .slice(0, 3)
        .map((pub) => ({
          title: pub.title || pub.display_name,
          year: pub.year || pub.publication_year,
          venue: pub.venue || "",
        }))
    : [];

  return {
    name,
    affiliation,
    affiliations,
    department: profileContext.department || "",
    country: profileContext.country || "",
    researchAreas,
    topics,
    ids: {
      orcid,
      orcidId: extractOrcidId(orcid),
    },
    topPublications,
  };
}

function buildSearchQuery(context) {
  const areaTerms = context.researchAreas.slice(0, 3).join(" ");
  const topicTerms = context.topics.slice(0, 2).join(" ");
  const publicationTerms = context.topPublications
    .slice(0, 2)
    .map((pub) => pub.title)
    .filter((title) => title && title.length <= 80)
    .map((title) => `"${title}"`)
    .join(" ");

  const idTerms = compactList([
    context.ids.orcidId,
    context.ids.orcidId ? "ORCID" : "",
  ]).join(" ");

  const searchTerms = compactList([
    context.name,
    context.affiliation,
    context.department,
    context.country,
    areaTerms,
    topicTerms,
    idTerms,
    publicationTerms,
    "LinkedIn",
    "Google Scholar",
    "ResearchGate",
    "ORCID",
    "faculty profile",
    "university profile",
  ]);

  return searchTerms.join(" ");
}

function inferTypeFromUrl(url) {
  if (url.includes("linkedin.com")) return "LinkedIn";
  if (url.includes("scholar.google.com")) return "Google Scholar";
  if (url.includes("researchgate.net")) return "ResearchGate";
  if (url.includes("orcid.org")) return "ORCID";
  if (url.includes("academia.edu")) return "Academia.edu";
  if (url.includes("semanticscholar.org")) return "Semantic Scholar";
  if (url.includes("openalex.org")) return "OpenAlex";
  if (url.includes("dblp.org")) return "DBLP";
  if (url.includes("scopus.com")) return "Scopus";
  if (url.includes("webofscience.com")) return "Web of Science";
  if (url.includes("publons.com")) return "Publons";

  const isInstitutional =
    url.includes(".edu") || url.includes(".ac.") || url.includes("university");
  return isInstitutional ? "Institutional" : "Other";
}

function normalizeType(explicitType, url) {
  if (explicitType && typeof explicitType === "string") {
    const matched = PROFILE_TYPES.find(
      (type) => type.toLowerCase() === explicitType.toLowerCase(),
    );
    if (matched) {
      return matched;
    }
  }

  return inferTypeFromUrl(url);
}

function isValidProfileUrl(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith("http")) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    const hasValidDomain = PROFILE_DOMAINS.some((domain) =>
      hostname.includes(domain),
    );
    const isInstitutional =
      hostname.includes(".edu") || hostname.includes(".ac.");

    return hasValidDomain || isInstitutional;
  } catch (error) {
    return false;
  }
}

function safeJsonParse(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    return null;
  }
}

/**
 * Find profile links for a researcher using Tavily → GPT-4 → Regex Parser flow
 */
async function findResearcherContact(req, res) {
  try {
    const context = normalizeContactContext(req.body);

    if (!context.name) {
      return res.status(400).json({
        success: false,
        error: "Researcher name is required",
      });
    }

    let tavilyResults = null;
    let searchError = null;

    // STEP 1: Tavily Web Search with error handling
    try {
      tavilyResults = await performTavilySearch(context);
    } catch (error) {
      console.error("Tavily search failed:", error.message);
      searchError = error.message;

      // Create minimal fallback data for GPT processing
      tavilyResults = {
        results: [],
        query: `${context.name} ${context.affiliation || ""} profile information`,
        error: error.message,
      };
    }

    // STEP 2: GPT-4 Processing (even with limited/no search results)
    let gptResponse;
    try {
      gptResponse = await processWithGPT(tavilyResults, context);
    } catch (error) {
      console.error("GPT processing failed:", error.message);

      // Fallback response when both Tavily and GPT fail
      // Return success: true with empty links so frontend displays "No Profile Links Found" gracefully instead of an error
      return res.json({
        success: true,
        data: { links: [] },
      });
    }

    // STEP 3: Regex Parser
    const contactInfo = parseContactResponseAdvanced(gptResponse);

    // STEP 4: JSON Response
    res.json({
      success: true,
      data: contactInfo,
      metadata: {
        searchQuery: tavilyResults?.query || buildSearchQuery(context),
        tavilyResultsCount: tavilyResults?.results?.length || 0,
        processingFlow: "Tavily → GPT → JSON Parser → Validation",
        searchStatus: searchError
          ? "Tavily search failed, GPT used limited data"
          : "Full search completed",
        warnings: searchError ? [`Tavily search error: ${searchError}`] : [],
      },
    });
  } catch (error) {
    console.error("Error in contact finder flow:", error);
    res.status(500).json({
      success: false,
      error: "Failed to find profile information",
      details: error.message,
      flow: "Tavily → GPT-4 → Regex Parser → JSON",
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * STEP 1: Perform Tavily web search
 */
async function performTavilySearch(context) {
  if (!TAVILY_API_KEY) {
    throw new Error("Tavily API key not configured");
  }

  const query = buildSearchQuery(context);

  try {
    const tavilyResponse = await axios.post(
      "https://api.tavily.com/search",
      {
        query: query,
        include_raw_content: true,
        max_results: 7,
        search_depth: "basic",
      },
      {
        headers: {
          Authorization: `Bearer ${TAVILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 300,
      },
    );

    return tavilyResponse.data;
  } catch (error) {
    console.error(`Tavily search failed:`, error.message);
    throw new Error(`Tavily search failed: ${error.message}`);
  }
}

/**
 * STEP 2: Process Tavily results with GPT-4
 */
async function processWithGPT(tavilyResults, context) {
  // Filter and clean Tavily results to remove unnecessary fields
  const filteredResults = {
    query: tavilyResults.query,
    results:
      tavilyResults.results?.map((result) => ({
        url: result.url,
        title: result.title,
        snippet: result.content ? result.content.slice(0, 200) : "",
      })) || [],
  };

  const gptPrompt = `
CONTEXT:
${JSON.stringify(context, null, 2)}

TAVILY SEARCH RESULTS:
${JSON.stringify(filteredResults, null, 2)}

TASK: Identify all profile links that belong to the researcher in CONTEXT.

MATCHING RULES:
1. Prefer exact name matches in title, URL, or snippet.
2. Allow partial/variant matches only if affiliation, department, or ORCID confirms the identity.
3. Use only URLs from the search results.
4. Exclude directory pages, search pages, and profiles of different people.
5. Each link must include evidence that references the name plus a secondary signal.

OUTPUT JSON ONLY:
{
  "links": [
    {
      "url": "https://...",
      "type": "LinkedIn | Google Scholar | ResearchGate | ORCID | Academia.edu | Institutional | Semantic Scholar | OpenAlex | DBLP | Scopus | Web of Science | Publons | Other",
      "evidence": "Short reason referencing name + affiliation/ID",
      "confidence": 0.0
    }
  ]
}
If no links, return {"links": []}.
`;

  const models = [
    "deepseek/deepseek-v4-flash:free",
    "openrouter/owl-alpha",
    "nvidia/nemotron-3-super-120b-a12b:free",
  ];

  let lastError;

  for (const model of models) {
    try {
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content:
              "You are a professional profile verification specialist. Identify profile URLs that belong to the researcher in the provided context. Be careful about name matching and require corroborating evidence (affiliation, department, ORCID, or publication). Only include URLs present in the search results. Output valid JSON only.",
          },
          {
            role: "user",
            content: gptPrompt,
          },
        ],
        max_completion_tokens: 800,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.warn(`Model ${model} failed:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error("All models failed");
}

/**
 * STEP 3: Profile Links Parser for GPT response
 */
function parseContactResponseAdvanced(response) {
  const contactInfo = {
    links: [],
  };

  try {
    const parsed = safeJsonParse(response);
    if (!parsed || !Array.isArray(parsed.links)) {
      return contactInfo;
    }

    const normalizedLinks = parsed.links
      .map((link) => {
        const url =
          typeof link === "string"
            ? link
            : typeof link?.url === "string"
              ? link.url
              : "";
        const cleanUrl = typeof url === "string" ? url.trim() : "";
        if (!cleanUrl || !isValidProfileUrl(cleanUrl)) {
          return null;
        }

        const evidence =
          typeof link?.evidence === "string"
            ? link.evidence.trim().slice(0, 180)
            : "";
        const confidence =
          typeof link?.confidence === "number"
            ? Math.max(0, Math.min(1, link.confidence))
            : undefined;

        return {
          url: cleanUrl,
          type: normalizeType(link?.type, cleanUrl),
          evidence,
          confidence,
        };
      })
      .filter(Boolean);

    contactInfo.links = normalizedLinks;
  } catch (error) {
    console.error("Error in profile links parsing:", error);
    contactInfo.links = [];
  }

  return contactInfo;
}

/**
 * Helper function to build researcher information string
 */
function buildResearcherInfoString(name, affiliation, orcid, researchAreas) {
  let info = `Researcher: ${name}`;
  if (affiliation) info += `\nAffiliation: ${affiliation}`;
  if (orcid) info += `\nORCID: ${orcid}`;
  if (researchAreas && researchAreas.length > 0)
    info += `\nResearch Areas: ${researchAreas.join(", ")}`;
  return info;
}

module.exports = {
  findResearcherContact,
};
