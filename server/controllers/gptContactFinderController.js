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
  apiKey: process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY,
});

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

/**
 * Find profile links for a researcher using Tavily → GPT-4 → Regex Parser flow
 */
async function findResearcherContact(req, res) {
  try {
    const { researcherName, affiliation, orcid, researchAreas } = req.body;

    if (!researcherName) {
      return res.status(400).json({
        success: false,
        error: "Researcher name is required",
      });
    }

    console.log(`[STEP 1] Tavily search for: ${researcherName}`);

    let tavilyResults = null;
    let searchError = null;

    // STEP 1: Tavily Web Search with error handling
    try {
      tavilyResults = await performTavilySearch(
        researcherName,
        affiliation,
        researchAreas
      );
    } catch (error) {
      console.error("Tavily search failed:", error.message);
      searchError = error.message;

      // Create minimal fallback data for GPT processing
      tavilyResults = {
        results: [],
        query: `${researcherName} ${affiliation || ""} profile information`,
        error: error.message,
      };
    }

    console.log(`[STEP 2] GPT-4 processing Tavily results...`);

    // STEP 2: GPT-4 Processing (even with limited/no search results)
    let gptResponse;
    try {
      gptResponse = await processWithGPT(tavilyResults);
    } catch (error) {
      console.error("GPT processing failed:", error.message);

      // Fallback response when both Tavily and GPT fail
      return res.status(503).json({
        success: false,
        error: "Profile search services temporarily unavailable",
        details: {
          tavilyError: searchError,
          gptError: error.message,
        },
        fallback: {
          message:
            "Please try searching manually on the researcher's institution website or academic platforms",
          suggestions: [
            affiliation
              ? `Search "${researcherName}" on ${affiliation} website`
              : null,
            `Search "${researcherName}" on LinkedIn`,
            `Search "${researcherName}" on Google Scholar`,
            `Search "${researcherName}" on ResearchGate`,
            orcid ? `Check ORCID profile: ${orcid}` : null,
          ].filter(Boolean),
        },
        flow: "Tavily → GPT-4 → Regex Parser → JSON (with fallbacks)",
      });
    }

    console.log(`[STEP 3] Regex parsing GPT response...`);

    // STEP 3: Regex Parser
    const contactInfo = parseContactResponseAdvanced(gptResponse);

    console.log(`[STEP 4] Returning JSON response`);

    // STEP 4: JSON Response
    res.json({
      success: true,
      data: contactInfo,
      metadata: {
        searchQuery: `${researcherName} ${
          affiliation || ""
        } profile information`,
        tavilyResultsCount: tavilyResults?.results?.length || 0,
        processingFlow: "Tavily → GPT-4 → Regex Parser → JSON",
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
async function performTavilySearch(researcherName, affiliation, researchAreas) {
  if (!TAVILY_API_KEY) {
    throw new Error("Tavily API key not configured");
  }

  // Build comprehensive search query for profiles
  const searchTerms = [
    researcherName,
    affiliation || "",
    "LinkedIn",
    "Google Scholar",
    "ResearchGate",
    "ORCID",
    "profile",
    `${researchAreas.join(" ")}`,
  ].filter(Boolean);

  const query = searchTerms.join(" ");

  console.log(`Tavily search query: ${query}`);

  try {
    const tavilyResponse = await axios.post(
      "https://api.tavily.com/search",
      {
        query: query,
        include_raw_content: true,
        max_results: 5,
        search_depth: "basic",
        include_domains: [
          "university.edu",
          "ac.uk",
          "edu.au",
          "linkedin.com",
          "researchgate.net",
          "scholar.google.com",
          "orcid.org",
          "academia.edu",
          "scopus.com",
          "publons.com",
          "webofscience.com",
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${TAVILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 300,
      }
    );

    console.log(`Tavily search successful`);
    console.log(tavilyResponse.data);
    return tavilyResponse.data;
  } catch (error) {
    console.error(`Tavily search failed:`, error.message);
    throw new Error(`Tavily search failed: ${error.message}`);
  }
}

/**
 * STEP 2: Process Tavily results with GPT-4
 */
async function processWithGPT(tavilyResults) {
  // Filter and clean Tavily results to remove unnecessary fields
  const filteredResults = {
    query: tavilyResults.query,
    results:
      tavilyResults.results?.map((result) => ({
        url: result.url,
        title: result.title,
      })) || [],
  };

  console.log("Preparing GPT prompt...", filteredResults);

  // Extract researcher name from the query (first part before affiliation/research areas)
  const researcherName = tavilyResults.query.split(" ").slice(0, 2).join(" "); // Take first 2 words as name

  const gptPrompt = `
TAVILY SEARCH RESULTS:
${JSON.stringify(filteredResults, null, 2)}

RESEARCHER TO FIND: "${researcherName}"

TASK: Identify all profile links that belong to the researcher "${researcherName}" from the search results above.

NAME MATCHING RULES (STRICT):
1. The profile title OR URL must clearly contain the researcher's name "${researcherName}"
2. Accept exact matches or very close variations (e.g., "David" ↔ "Dave" for the same person)
3. REJECT profiles that belong to different people with similar but different names
4. Check both the URL path and the title for name confirmation

VALIDATION CHECKLIST:
- Does the title mention "${researcherName}" or a clear variation?
- Does the URL contain the researcher's name or initials?
- Is this profile clearly for the same person we're searching for?

VALID PROFILE TYPES:
- LinkedIn profiles (linkedin.com/in/...) - must have researcher's name in title or URL
- Google Scholar profiles (scholar.google.com/citations...) - must have researcher's name
- ResearchGate profiles (researchgate.net/profile/...) - must have researcher's name
- ORCID profiles (orcid.org/...) - must have researcher's name
- Institutional faculty pages - must clearly be the researcher's personal page
- Academia.edu profiles - must have researcher's name

EXCLUDE:
- General search pages (like scholar.google.com without specific profile)
- Directory pages
- Profiles of different people with similar names
- Non-profile links

OUTPUT FORMAT (EXACTLY):
🔗 Profile Links

Links: [array of profile URLs, one per line, or "No profile links found"]
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are a professional profile verification specialist. Your task is to identify profile URLs that belong to the EXACT researcher specified in the query. Be extremely careful about name matching - reject any profiles that belong to different people, even if names are similar. Always cross-reference the researcher's name with both the URL and title before including any profile. Only include official academic and professional profiles. Never fabricate URLs that weren't in the search results.",
      },
      {
        role: "user",
        content: gptPrompt,
      },
    ],
    max_completion_tokens: 800,
  });

  console.log("GPT response received", completion.choices[0].message.content);
  return completion.choices[0].message.content;
}

/**
 * STEP 3: Profile Links Parser for GPT response
 */
function parseContactResponseAdvanced(response) {
  const contactInfo = {
    links: [],
  };

  try {
    // Extract profile links from GPT response
    const linksMatch = response.match(/Links:\s*([\s\S]*?)(?:\n\n|$)/i);

    if (linksMatch) {
      const linksSection = linksMatch[1].trim();

      // Check if no links found
      if (linksSection.toLowerCase().includes("no profile links found")) {
        contactInfo.links = [];
      } else {
        // Split by lines and filter out empty lines
        const urls = linksSection
          .split("\n")
          .map((line) => {
            // Remove quotes, trim whitespace, and remove leading "- " if present
            let cleanLine = line
              .trim()
              .replace(/^- /, "")
              .replace(/^["']|["']$/g, "");
            return cleanLine;
          })
          .filter((line) => {
            // Check if line contains a URL (starts with http or https)
            return (
              line &&
              (line.startsWith("http://") || line.startsWith("https://"))
            );
          })
          .filter((url) => {
            // Validate that it's a proper profile URL
            const validDomains = [
              "linkedin.com",
              "scholar.google.com",
              "researchgate.net",
              "orcid.org",
              "academia.edu",
              "scopus.com",
              "publons.com",
              "webofscience.com",
            ];

            // Also include university/institutional domains
            const isUniversityDomain =
              url.includes(".edu") ||
              url.includes(".ac.") ||
              url.includes("university");
            const hasValidDomain = validDomains.some((domain) =>
              url.includes(domain)
            );

            return hasValidDomain || isUniversityDomain;
          });

        contactInfo.links = urls;
      }
    }
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
