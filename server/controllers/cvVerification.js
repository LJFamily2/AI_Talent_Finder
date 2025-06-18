/**
 * CV Verification Controller
 *
 * This is the main controller for academic CV verification system.
 * It handles the complete CV analysis pipeline including:
 * - PDF parsing and text extraction
 * - AI-powered candidate name extraction
 * - Academic publication identification and extraction
 * - Cross-verification with Google Scholar and Scopus databases
 * - Author name matching and verification
 * - Comprehensive result aggregation and reporting
 *
 * @module cvVerification
 * @author AI Talent Finder Team
 * @version 1.0.0
 */

const fs = require("fs");
const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getTitleSimilarity } = require("../utils/textUtils");
const {
  verifyWithGoogleScholar,
  createGoogleScholarSearchUrl,
} = require("./googleScholarVerification");
const { verifyWithScopus } = require("./scopusVerification");
const { checkAuthorNameMatch } = require("../utils/authorUtils");
const { aggregateAuthorDetails } = require("../utils/authorDetailsAggregator");

//=============================================================================
// MAIN CV VERIFICATION FUNCTION
//=============================================================================

/**
 * Main function for verifying academic CVs
 *
 * Processes a CV file through the complete verification pipeline:
 * 1. Parse PDF to extract text content
 * 2. Extract candidate name using AI
 * 3. Identify and extract publications using AI
 * 4. Verify each publication with Google Scholar and Scopus
 * 5. Match candidate name against publication authors
 * 6. Generate comprehensive verification report
 *
 * @param {Object} file - Uploaded CV file object with path property
 * @returns {Promise<Object>} Comprehensive verification results
 *
 * @example
 * const result = await verifyCV(uploadedFile);
 * console.log(`Verified ${result.verifiedPublications}/${result.total} publications`);
 * console.log(`Publications with author match: ${result.verifiedWithAuthorMatch}`);
 * console.log(`Potential false claims: ${result.falseClaims}`);
 */

const extractPublicationsFromCV = async (model, cvText) => {
  // Enhanced patterns for academic publication sections
  const PUBLICATION_PATTERNS = [
    /publications?$/i,
    /selected publications/i,
    /journal (?:articles|publications)/i,
    /conference (?:papers|publications)/i,
    /peer[- ]reviewed publications/i,
    /in-progress manuscripts/i,
    /peer-reviewed publications/i,
    /policy-related publications/i,
    /workshop papers/i,
    /technical reports/i,
    /book chapters/i,
    /book reviews/i,
    /research publications/i,
    /policy-related publications and reports/i,
    /workshop papers and technical reports/i,
    /articles/i,
    /published works/i,
    /scholarly publications/i,
    /papers/i,
    /\[.*\]/i, // Matches publication entries with reference numbers like [1], [P1]
  ];

  // Process the CV text to find sections
  const lines = cvText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Identify potential publication sections
  const sectionHeaders = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      (line === line.toUpperCase() && line.length > 3) || // All caps headers
      PUBLICATION_PATTERNS.some((pattern) => pattern.test(line)) || // Publication patterns
      /^\[.*\]/.test(line) || // Publication entries starting with [x]
      /^[0-9]+\./.test(line) // Numbered entries
    ) {
      sectionHeaders.push({ index: i, text: line });
    }
  }

  // Extract sections that appear to be publication lists
  const publicationSections = [];
  for (let i = 0; i < sectionHeaders.length; i++) {
    const header = sectionHeaders[i];
    const nextHeader = sectionHeaders[i + 1];

    const sectionEnd = nextHeader ? nextHeader.index : lines.length;
    const sectionContent = lines.slice(header.index + 1, sectionEnd).join("\n");
    if (
      PUBLICATION_PATTERNS.some((pattern) => pattern.test(header.text)) ||
      /publications|papers|manuscripts|reports/i.test(header.text)
    ) {
      publicationSections.push({
        header: header.text,
        content: sectionContent,
      });
    }
  }
  if (publicationSections.length === 0) {
    // If no sections found, look for entries with common publication patterns
    const pubEntries = lines.filter(
      (line) =>
        /^\[\w+\]/.test(line) || // [1], [P1], etc.
        /^[0-9]+\./.test(line) || // Numbered entries
        /(19|20)[0-9]{2}/.test(line) // Contains a year
    );

    if (pubEntries.length > 0) {
      publicationSections.push({
        header: "Publications",
        content: pubEntries.join("\n"),
      });
    }
  }
  // Process each section in chunks
  const allPublications = [];
  const MAX_CHUNK_SIZE = 4000; // Characters per chunk

  for (const section of publicationSections) {
    // Split section into chunks if needed
    if (section.content.length > MAX_CHUNK_SIZE) {
      const chunks = [];
      let currentChunk = section.header + "\n\n";
      let currentSize = currentChunk.length;

      // Split at logical boundaries (lines)
      const contentLines = section.content.split("\n");
      for (const line of contentLines) {
        if (
          currentSize + line.length + 1 > MAX_CHUNK_SIZE &&
          currentChunk.length > 0
        ) {
          chunks.push(currentChunk);
          currentChunk = section.header + " (continued)\n\n";
          currentSize = currentChunk.length;
        }

        currentChunk += line + "\n";
        currentSize += line.length + 1;
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunkPubs = await extractPublicationsFromChunk(model, chunks[i]);
        allPublications.push(...chunkPubs);
      }
    } else {
      // Process entire section
      const sectionText = `${section.header}\n\n${section.content}`;
      const sectionPubs = await extractPublicationsFromChunk(
        model,
        sectionText
      );
      allPublications.push(...sectionPubs);
    }
  }
  // If nothing was found, try a general extraction as a fallback
  if (allPublications.length === 0 && cvText.length > 0) {
    // Split the full text into manageable chunks
    const chunks = [];
    for (let i = 0; i < cvText.length; i += MAX_CHUNK_SIZE) {
      chunks.push(cvText.substring(i, i + MAX_CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i++) {
      const fallbackPubs = await extractPublicationsFromChunk(
        model,
        chunks[i],
        true
      );
      allPublications.push(...fallbackPubs);
    }
  } // Remove duplicates (based on title similarity) and validate publications
  const uniquePublications = [];
  for (const pub of allPublications) {
    if (!pub.title) continue;

    // Additional validation to filter out fabricated publications
    if (
      /\[([0-9]+|P[0-9]+|TR[0-9]+)\]/.test(pub.publication) ||
      /^[A-Z]\.\s*Author/.test(pub.publication) ||
      (/et al\./.test(pub.publication) &&
        !/[A-Z][a-z]+/.test(pub.publication.split("et al")[0]))
    ) {
      continue;
    }

    // Check if title has reasonable length and not generic words
    if (
      pub.title &&
      (pub.title.length < 10 ||
        (/study|framework|analysis|research|impact/i.test(pub.title) &&
          pub.title.length < 25))
    ) {
      // If title is too generic and short, verify it appears in the original text
      const titleInText = new RegExp(
        pub.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      if (!titleInText.test(cvText)) {
        continue;
      }
    }

    const isDuplicate = uniquePublications.some((existingPub) => {
      if (!existingPub.title) return false;

      const similarity = getTitleSimilarity(pub.title, existingPub.title);
      return similarity > 98; // Adjust threshold as needed
    });
    if (!isDuplicate) {
      uniquePublications.push(pub);
    }
  }

  return uniquePublications;
};

// Helper function to extract publications from a chunk of text
async function extractPublicationsFromChunk(
  model,
  chunkText,
  isFallback = false
) {
  // Create a more specific prompt with strong anti-hallucination instructions
  let prompt = `You are an expert academic CV analyzer focusing on publications.
From the text below, which contains part of an academic CV, extract ONLY ACTUAL publications that appear in the text.
Each publication must be returned as an object inside a JSON array, with the following keys:
- "publication": the full original text of the publication entry exactly as it appears
- "title": the publication title extracted from the publication text
- "doi": the DOI if written (starts with 10.), otherwise null
Format: [{"publication": "...", "title": "...", "doi": "10.xxxx/..." or null}]

IMPORTANT RULES:
- ONLY extract publications that are explicitly written in the text
- DO NOT create or invent ANY publications that aren't explicitly in the text
- Return an EMPTY array [] if you can't find actual publications
- If you're uncertain if something is a publication, DO NOT include it
- DO NOT include example, template or placeholder publications with generic author names like "A. Author"
- DO NOT fabricate ANY content or publications
- Return only valid JSON. No markdown, no explanation, no extra output.

TEXT:
${chunkText}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse and clean the response
    let cleanedText = text
      .trim()
      .replace(/```json|```/g, "")
      .replace(/^[^[{]*(\[.*\])[^}\]]*$/s, "$1")
      .trim();

    // Handle edge cases where the model doesn't return valid JSON
    try {
      // Fix common JSON issues - sometimes the model returns malformed JSON
      cleanedText = cleanedText.replace(/,\s*\]/g, "]");
      cleanedText = cleanedText.replace(/([^\\])\\([^\\"])/g, "$1\\\\$2");

      const publications = JSON.parse(cleanedText); // Post-processing to filter out obviously hallucinated entries
      return publications.filter((pub) => {
        // Filter out entries with generic author patterns
        if (
          /A\.\s*Author|B\.\s*Author|C\.\s*Author/.test(pub.publication) ||
          /\[1\]|\[P1\]|\[TR1\]/.test(pub.publication) ||
          /example|template|placeholder/i.test(pub.publication)
        ) {
          return false;
        } // Filter out publications with extremely short text (likely hallucinations)
        if (pub.publication.length < 15) {
          return false;
        } // Only keep publications with specific publication details
        const hasPublicationMetadata =
          pub.publication.includes("(") || // Has year or volume info
          pub.publication.includes(":") || // Has page numbers
          /vol|volume|issue|journal|proceedings/i.test(pub.publication); // Has publication metadata

        if (!hasPublicationMetadata) {
          return false;
        }

        return true;
      });
    } catch (e) {
      return [];
    }
  } catch (error) {
    return [];
  }
}

// AI-based function to extract candidate name from CV
async function extractCandidateNameWithAI(model, cvText) {
  const prompt = `You are an expert CV analyzer.
From the text of this CV/resume, extract ONLY the full name of the candidate/person whose CV this is.
Return ONLY the name as plain text - no explanation, no JSON, no additional information.
If you cannot determine the name with high confidence, return "UNKNOWN".

CV TEXT:
${cvText.substring(0, 2000)}`; // Only need the beginning of the CV

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const candidateName = response.text().trim(); // Basic validation to prevent hallucination
    if (
      candidateName === "UNKNOWN" ||
      candidateName.length > 100 ||
      candidateName.length < 2
    ) {
      return null;
    }

    // Additional validation - should look like a name
    if (!/^[A-Za-z\s\.\-']+$/.test(candidateName)) {
      return null;
    }

    return candidateName;
  } catch (error) {
    return null;
  }
}

// Main function
// 1. parse the CV PDF to text
// 2. extract candidate name using AI
// 3. extract publications using the Google AI model
// 4. verify each publication with Google Scholar and Scopus
// 5. check if candidate name matches publication authors
// 6. return the results
const verifyCV = async (file) => {
  try {
    // Parse PDF to text
    const pdfBuffer = fs.readFileSync(file.path);
    const parsedData = await pdfParse(pdfBuffer);
    const cvText = parsedData.text;

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    // Initialize Google AI model
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemma-3n-e4b-it",
      generationConfig: {
        temperature: 0.1,
        topP: 1,
        maxOutputTokens: 2048,
      },
    }); // Extract candidate name using AI
    const candidateName = await extractCandidateNameWithAI(model, cvText);
    const publications = await extractPublicationsFromCV(model, cvText);

    if (!Array.isArray(publications)) {
      throw new Error("Invalid publications array format");
    } // Verify each publication with both Google Scholar and Scopus
    let falseClaims = 0;
    const verificationResults = await Promise.all(
      publications.map(async (pub) => {
        const [scholarResult, scopusResult] = await Promise.all([
          verifyWithGoogleScholar(pub.title, pub.doi, candidateName),
          verifyWithScopus(pub.title, pub.doi, candidateName),
        ]);

        // Combine authors from both sources
        let allAuthors = [];
        let hasAuthorMatch = false;

        // Get authors from Google Scholar
        if (scholarResult.details?.extractedAuthors) {
          allAuthors.push(...scholarResult.details.extractedAuthors);
        }

        // Get authors from Scopus
        if (scopusResult.details?.extractedAuthors) {
          allAuthors.push(...scopusResult.details.extractedAuthors);
        }

        // Remove duplicates and clean author names
        if (candidateName && allAuthors.length > 0) {
          hasAuthorMatch = checkAuthorNameMatch(candidateName, allAuthors);
        }
        // Flag potential false claims
        const isVerified =
          scholarResult.status === "verified" ||
          scopusResult.status === "verified" ||
          scholarResult.status === "verified but not same author name" ||
          scopusResult.status === "verified but not same author name";
        const isPotentialFalseClaim =
          isVerified && candidateName && !hasAuthorMatch;
        if (isPotentialFalseClaim) {
          falseClaims++;
        }

        // Get the best available link or create a Google Scholar search link
        const scholarLink = scholarResult.details?.link;
        const fallbackLink = createGoogleScholarSearchUrl(pub.title);

        return {
          publication: {
            title: pub.title?.trim() || "",
            doi: pub.doi?.trim() || null,
            fullText: pub.publication?.trim() || "",
          },
          verification: {
            google_scholar: {
              status: scholarResult.status,
              details: scholarResult.details,
            },
            scopus: {
              status: scopusResult.status,
              details: scopusResult.details,
            },
            displayData: {
              publication: pub.publication || "Unable to verify",
              title:
                scholarResult.details?.title ||
                scopusResult.details?.["dc:title"] ||
                "Unable to verify",
              author: (() => {
                // Try Google Scholar author info first
                if (scholarResult.details?.publication_info?.summary) {
                  return scholarResult.details.publication_info.summary
                    .split("-")[0]
                    .trim();
                }
                if (scholarResult.details?.publication_info?.authors) {
                  return scholarResult.details.publication_info.authors
                    .map((a) => a.name)
                    .join(", ");
                }
                // Then try Scopus author info
                if (scopusResult.details?.["dc:creator"]) {
                  return scopusResult.details["dc:creator"];
                }
                return "Unable to verify";
              })(),
              type: (() => {
                // Use type from either source
                const scopusType = scopusResult.details?.subtypeDescription;
                const scholarType = scholarResult.details?.type;
                return scopusType || scholarType || "Not specified";
              })(),
              year: (() => {
                const currentYear = new Date().getFullYear();

                // Try Scopus coverDate first as it's usually more reliable
                const scopusDate = scopusResult.details?.["prism:coverDate"];
                if (scopusDate) {
                  const year = scopusDate.substring(0, 4);
                  if (
                    parseInt(year) >= 1700 &&
                    parseInt(year) <= currentYear + 1
                  ) {
                    return year;
                  }
                }

                // Then try Google Scholar summary
                const summary =
                  scholarResult.details?.publication_info?.summary;
                if (summary) {
                  const match = summary.match(/[,-]?\s*(\d{4})\b/);
                  const year = match?.[1];
                  if (
                    year &&
                    parseInt(year) >= 1700 &&
                    parseInt(year) <= currentYear + 1
                  ) {
                    return year;
                  }
                }

                return "Unable to verify";
              })(),
              citedBy: (() => {
                // Get citation counts from both sources
                const scholarCitations = parseInt(
                  scholarResult.details?.inline_links?.cited_by?.total || "0"
                );
                const scopusCitations = parseInt(
                  scopusResult.details?.["citedby-count"] || "0"
                );

                // Return the higher citation count
                return Math.max(scholarCitations, scopusCitations).toString();
              })(),
              link: (() => {
                // Try to get Scopus link first
                if (scopusResult.details?.link) {
                  const scopusLink = scopusResult.details.link.find(
                    (link) => link["@ref"] === "scopus"
                  );
                  if (scopusLink) return scopusLink["@href"];
                }

                // Then try Google Scholar link
                if (scholarLink) return scholarLink;

                // Finally use the fallback
                return fallbackLink || "No link available";
              })(),
              // Determine the most specific status
              status: (() => {
                // If either source shows verified with author match
                if (
                  scholarResult.status === "verified" ||
                  scopusResult.status === "verified"
                ) {
                  return "verified";
                }
                // If either source shows verified but not same author
                if (
                  scholarResult.status ===
                    "verified but not same author name" ||
                  scopusResult.status === "verified but not same author name"
                ) {
                  return "verified but not same author name";
                }
                // If neither is verified
                return "not verified";
              })(),
              // Additional Scopus fields
              publicationName:
                scopusResult.details?.["prism:publicationName"] || null,
              volume: scopusResult.details?.["prism:volume"] || null,
              issue: scopusResult.details?.["prism:issueIdentifier"] || null,
              pageRange: scopusResult.details?.["prism:pageRange"] || null,
              doi: scopusResult.details?.["prism:doi"] || null,
            },
          }, // Enhanced author verification information
          authorVerification: {
            hasAuthorMatch: hasAuthorMatch,
            authorIds: {
              google_scholar: scholarResult.details?.authorId || null,
              scopus: scopusResult.details?.authorId || null,
            },
          },
        };
      })
    ); // Aggregate author details from multiple sources
    // Find publications with author matches and collect IDs
    const allAuthorIds = {
      google_scholar: null,
      scopus: null,
    };

    // Find verified publications with author matches
    const verifiedWithAuthorMatch = verificationResults.filter(
      (result) =>
        result.authorVerification.hasAuthorMatch &&
        Object.keys(result.authorVerification.authorIds || {}).length > 0
    );

    // Collect author IDs from each source
    verifiedWithAuthorMatch.forEach((result) => {
      const { authorIds } = result.authorVerification;

      if (authorIds?.google_scholar && !allAuthorIds.google_scholar) {
        allAuthorIds.google_scholar = authorIds.google_scholar;
      }

      if (authorIds?.scopus && !allAuthorIds.scopus) {
        allAuthorIds.scopus = authorIds.scopus;
      }
    }); // Only proceed with aggregation if we have at least one author ID

    let aggregatedAuthorDetails = null;
    if (Object.values(allAuthorIds).some((id) => id)) {
      try {
        // Use the aggregator to get comprehensive author details
        const rawAuthorDetails = await aggregateAuthorDetails(
          allAuthorIds,
          candidateName
        );

        if (rawAuthorDetails) {
          // Transform the result to match the expected structure
          aggregatedAuthorDetails = {
            author: rawAuthorDetails.author,
            articles: rawAuthorDetails.articles,
            metrics: {
              h_index: rawAuthorDetails.h_index,
              documentCounts: rawAuthorDetails.documentCounts,
              i10_index: rawAuthorDetails.i10_index,
              citations: rawAuthorDetails.graph,
            },
          };

        } 
      } catch (error) {
        console.error("Failed to aggregate author details:", error.message);
        console.warn("Failed to aggregate author details:", error.message); // Fallback to using Google Scholar author details if available
        const match = verificationResults.find(
          (result) =>
            result.verification.google_scholar.status === "verified" &&
            result.authorVerification.hasAuthorMatch &&
            result.verification.google_scholar.details?.authorDetails
        );

        if (match?.verification.google_scholar.details?.authorDetails) {
          aggregatedAuthorDetails =
            match.verification.google_scholar.details.authorDetails;
        } 
      }
    } 

    return {
      success: true,
      candidateName: candidateName,
      total: verificationResults.length,
      verifiedPublications: verificationResults.filter(
        (r) =>
          r.verification.google_scholar.status === "verified" ||
          r.verification.scopus.status === "verified" ||
          r.verification.google_scholar.status ===
            "verified but not same author name" ||
          r.verification.scopus.status === "verified but not same author name"
      ).length,
      verifiedWithAuthorMatch: verificationResults.filter(
        (r) =>
          r.verification.google_scholar.status === "verified" ||
          r.verification.scopus.status === "verified"
      ).length,
      verifiedButDifferentAuthor: verificationResults.filter(
        (r) =>
          r.verification.google_scholar.status ===
            "verified but not same author name" ||
          r.verification.scopus.status === "verified but not same author name"
      ).length,
      falseClaims: falseClaims,
      results: verificationResults,
      authorDetails: aggregatedAuthorDetails, // Use aggregated details instead of single source
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  verifyCV,
};
