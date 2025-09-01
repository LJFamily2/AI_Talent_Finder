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
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  verifyWithGoogleScholar,
  createGoogleScholarSearchUrl,
} = require("./googleScholarVerification");
const { verifyWithScopus } = require("./scopusVerification");
const { verifyWithOpenAlex } = require("./openAlexVerification");
const { checkAuthorNameMatch } = require("../utils/authorUtils");
const { aggregateAuthorDetails } = require("../utils/authorDetailsAggregator");
const {
  extractCandidateNameWithAI,
  extractPublicationsFromCV,
} = require("../utils/aiHelpers");
const { extractTextFromPDF } = require("../utils/pdfUtils");

//=============================================================================
// MODULE EXPORTS
//=============================================================================

module.exports = {
  verifyCV,
};

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
 */

async function verifyCV(file, prioritySource, options = {}) {
  const { jobId, io } = options;
  let cvText = "";
  try {
    // Parse PDF to text (with OCR fallback)
    console.log("[CV Verification] Starting PDF text extraction...");
    const pdfStartTime = Date.now();
    cvText = await extractTextFromPDF(file.path);
    const pdfEndTime = Date.now();
    console.log(
      `[CV Verification] PDF text extraction completed in ${
        pdfEndTime - pdfStartTime
      }ms`
    );
    if (io && jobId)
      io.to(jobId).emit("progress", { progress: 10, step: "pdf_extracted" });

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    // Initialize Google AI model
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite-preview-06-17",
      generationConfig: {
        temperature: 0.0,
        topP: 0.0,
        maxOutputTokens: 4096,
      },
    });

    // Extract candidate name using AI
    console.log("[CV Verification] Starting candidate name extraction...");
    const nameStartTime = Date.now();
    const candidateName = await extractCandidateNameWithAI(model, cvText);
    const nameEndTime = Date.now();
    console.log(
      `[CV Verification] Candidate name extraction completed in ${
        nameEndTime - nameStartTime
      }ms`
    );
    if (io && jobId)
      io.to(jobId).emit("progress", { progress: 30, step: "name_extracted" });

    // Extract publications using AI
    console.log("[CV Verification] Starting publications extraction...");
    const pubStartTime = Date.now();
    const publications = await extractPublicationsFromCV(model, cvText);
    const pubEndTime = Date.now();
    console.log(
      `[CV Verification] Publications extraction completed in ${
        pubEndTime - pubStartTime
      }ms`
    );
    if (io && jobId)
      io.to(jobId).emit("progress", {
        progress: 50,
        step: "publications_extracted",
      });

    if (!Array.isArray(publications)) {
      throw new Error("Invalid publications array format");
    }

    // Verify each publication with both Google Scholar and Scopus
    console.log(
      `[CV Verification] Starting verification of ${publications.length} publications...`
    );
    if (io && jobId)
      io.to(jobId).emit("progress", {
        progress: 60,
        step: "verification_started",
      });
    const verificationStartTime = Date.now();
    const verificationResults = [];
    for (let i = 0; i < publications.length; i++) {
      const pub = publications[i];
      const result = await processPublicationVerification(pub, candidateName);
      verificationResults.push(result);
      if (io && jobId) {
        // Progress between 60 and 80%
        const prog = 60 + Math.round((20 * (i + 1)) / publications.length);
        io.to(jobId).emit("progress", {
          progress: prog,
          step: "publication_verified",
          index: i + 1,
          total: publications.length,
        });
      }
    }
    const verificationEndTime = Date.now();
    console.log(
      `[CV Verification] Publication verification completed in ${
        verificationEndTime - verificationStartTime
      }ms`
    );

    // Aggregate author details from multiple sources
    // Find publications with author matches and collect IDs
    const allAuthorIds = {
      google_scholar: null,
      scopus: null,
      openalex: null,
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
      if (authorIds?.openalex && !allAuthorIds.openalex) {
        allAuthorIds.openalex = authorIds.openalex;
      }
    }); // Only proceed with aggregation if we have at least one author ID

    let aggregatedAuthorDetails = null;
    if (io && jobId)
      io.to(jobId).emit("progress", {
        progress: 85,
        step: "aggregation_started",
      });
    if (Object.values(allAuthorIds).some((id) => id)) {
      try {
        // Use the aggregator to get comprehensive author details
        console.log("[CV Verification] Starting author details aggregation...");
        const aggregationStartTime = Date.now();
        const rawAuthorDetails = await aggregateAuthorDetails(
          allAuthorIds,
          candidateName,
          prioritySource
        );
        const aggregationEndTime = Date.now();
        console.log(
          `[CV Verification] Author details aggregation completed in ${
            aggregationEndTime - aggregationStartTime
          }ms`
        );

        if (rawAuthorDetails) {
          // Transform the result to match the expected structure
          aggregatedAuthorDetails = {
            author: rawAuthorDetails.author,
            // articles: rawAuthorDetails.articles,
            expertises: rawAuthorDetails.expertise,
            metrics: {
              h_index: rawAuthorDetails.h_index,
              documentCount: rawAuthorDetails.documentCount,
              i10_index: rawAuthorDetails.i10_index,
              citationCount: rawAuthorDetails.citationCount,
              citations: rawAuthorDetails.graph,
            },
          };
        }
      } catch (error) {
        console.error("Failed to aggregate author details:", error.message);
        console.warn("Failed to aggregate author details:", error.message); // Fallback to using Google Scholar author details if available
      }
    }
    if (io && jobId)
      io.to(jobId).emit("progress", {
        progress: 95,
        step: "aggregation_complete",
      });
    if (io && jobId)
      io.to(jobId).emit("progress", { progress: 100, step: "done" });
    return {
      success: true,
      candidateName: candidateName,
      total: verificationResults.length,
      verifiedPublications: verificationResults.filter(
        (r) =>
          r.verification.displayData.status === "verified" ||
          r.verification.displayData.status ===
            "verified but not same author name"
      ).length,
      verifiedWithAuthorMatch: verificationResults.filter(
        (r) => r.verification.displayData.status === "verified"
      ).length,
      verifiedButDifferentAuthor: verificationResults.filter(
        (r) =>
          r.verification.displayData.status ===
          "verified but not same author name"
      ).length,
      results: verificationResults,
      authorDetails: aggregatedAuthorDetails,
    };
  } catch (error) {
    console.error("[CV Verification] Error:", error);
    throw error;
  }
}

//=============================================================================
// HELPER FUNCTIONS FOR DISPLAY DATA EXTRACTION
//=============================================================================

/**
 * Extract author information from verification results
 * @param {Object} scholarResult - Google Scholar verification result
 * @param {Object} scopusResult - Scopus verification result
 * @param {Object} openAlexResult - OpenAlex verification result
 * @returns {string} Author information or fallback message
 */
const extractAuthorInfo = (scholarResult = {}, scopusResult = {}, openAlexResult = {}) => {
  // Try Google Scholar author info first
  if (scholarResult.details?.publication_info?.summary) {
    return scholarResult.details.publication_info.summary.split("-")[0].trim();
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
  // Then try OpenAlex author info
  if (openAlexResult.details?.extractedAuthors?.length) {
    return openAlexResult.details.extractedAuthors.join(", ");
  }
  return "Unable to verify";
};

/**
 * Extract publication type from verification results
 * @param {Object} scholarResult - Google Scholar verification result
 * @param {Object} scopusResult - Scopus verification result
 * @param {Object} openAlexResult - OpenAlex verification result
 * @returns {string} Publication type
 */
const extractPublicationType = (
  scholarResult,
  scopusResult,
  openAlexResult
) => {
  const type =
    openAlexResult.details?.type ||
    scholarResult.details?.type ||
    scopusResult.details?.subtypeDescription ||
    "Not specified";
  return typeof type === "string" ? type.toLowerCase() : type;
};

/**
 * Extract publication year from verification results
 * @param {Object} scholarResult - Google Scholar verification result
 * @param {Object} scopusResult - Scopus verification result
 * @param {Object} openAlexResult - OpenAlex verification result
 * @returns {string} Publication year or fallback message
 */
const extractPublicationYear = (
  scholarResult,
  scopusResult,
  openAlexResult
) => {
  const currentYear = new Date().getFullYear();

  // Try OpenAlex year first (usually most reliable)
  if (openAlexResult.details?.publication_year) {
    const year = openAlexResult.details.publication_year.toString();
    if (parseInt(year) >= 1700 && parseInt(year) <= currentYear + 1) {
      return year;
    }
  }

  // Try Scopus coverDate first as it's usually more reliable
  const scopusDate = scopusResult.details?.["prism:coverDate"];
  if (scopusDate) {
    const year = scopusDate.substring(0, 4);
    if (parseInt(year) >= 1700 && parseInt(year) <= currentYear + 1) {
      return year;
    }
  }

  // Then try Google Scholar summary
  const summary = scholarResult.details?.publication_info?.summary;
  if (summary) {
    const match = summary.match(/[,-]?\s*(\d{4})\b/);
    const year = match?.[1];
    if (year && parseInt(year) >= 1700 && parseInt(year) <= currentYear + 1) {
      return year;
    }
  }

  return "Unable to verify";
};

/**
 * Extract citation count from verification results
 * @param {Object} scholarResult - Google Scholar verification result
 * @param {Object} scopusResult - Scopus verification result
 * @returns {string} Citation count
 */
const extractCitationCount = (scholarResult, scopusResult) => {
  // Get citation counts from both sources
  const scholarCitations = parseInt(
    scholarResult.details?.inline_links?.cited_by?.total || "0"
  );
  const scopusCitations = parseInt(
    scopusResult.details?.["citedby-count"] || "0"
  );

  // Return the higher citation count
  return Math.max(scholarCitations, scopusCitations).toString();
};

/**
 * Extract best available link from verification results
 * @param {string} scholarLink - Google Scholar link
 * @param {string} scopusLink - Scopus link
 * @param {string} openAlexLink - OpenAlex link
 * @param {string} fallbackLink - Fallback search link
 * @returns {string} Best available link
 */
const extractBestLink = (
  scholarLink,
  scopusLink,
  openAlexLink,
  fallbackLink
) => {
  if (scopusLink) return scopusLink;
  if (openAlexLink) return openAlexLink;
  if (scholarLink) return scholarLink;
  return fallbackLink || "No link available";
};

/**
 * Determine verification status from multiple sources
 * @param {Object} scholarResult - Google Scholar verification result
 * @param {Object} scopusResult - Scopus verification result
 * @param {Object} openAlexResult - OpenAlex verification result
 * @returns {string} Overall verification status
 */
const determineVerificationStatus = (
  scholarResult,
  scopusResult,
  openAlexResult
) => {
  // If any source shows verified with author match
  if (
    scholarResult.status === "verified" ||
    scopusResult.status === "verified" ||
    openAlexResult.status === "verified"
  ) {
    return "verified";
  }
  // If any source shows verified but not same author
  if (
    scholarResult.status === "verified but not same author name" ||
    scopusResult.status === "verified but not same author name" ||
    openAlexResult.status === "verified but not same author name"
  ) {
    return "verified but not same author name";
  }
  // If none are verified
  return "not verified";
};

/**
 * Process a single publication through verification pipeline
 * @param {Object} pub - Publication object with title, doi, etc.
 * @param {string} candidateName - Name of the candidate
 * @returns {Promise<Object>} Verification result for the publication
 */
const processPublicationVerification = async (pub, candidateName) => {
  console.log(
    `[Publication Verification] Starting verification for: "${pub.title}"`
  );
  const overallStartTime = Date.now();

  const [scholarResult, scopusResult, openAlexResult] = await Promise.all([
    (async () => {
      const start = Date.now();
      const result = await verifyWithGoogleScholar(
        pub.title,
        pub.doi,
        candidateName
      );
      const end = Date.now();
      console.log(
        `[Publication Verification] Google Scholar verification completed in ${
          end - start
        }ms for: "${pub.title}"`
      );
      return result;
    })(),
    (async () => {
      const start = Date.now();
      const result = await verifyWithScopus(pub.title, pub.doi, candidateName);
      const end = Date.now();
      console.log(
        `[Publication Verification] Scopus verification completed in ${
          end - start
        }ms for: "${pub.title}"`
      );
      return result;
    })(),
    (async () => {
      const start = Date.now();
      const result = await verifyWithOpenAlex(
        pub.title,
        pub.doi,
        candidateName
      );
      const end = Date.now();
      console.log(
        `[Publication Verification] OpenAlex verification completed in ${
          end - start
        }ms for: "${pub.title}"`
      );
      return result;
    })(),
  ]);

  const overallEndTime = Date.now();
  console.log(
    `[Publication Verification] Overall verification completed in ${
      overallEndTime - overallStartTime
    }ms for: "${pub.title}"`
  );

  // Combine authors from all three sources
  let allAuthors = [];
  let hasAuthorMatch = false;

  // Create a mock scholarResult to maintain compatibility
  // const scholarResult = {
  //   status: "not verified",
  //   details: null,
  // };

  // Get authors from Google Scholar
  if (scholarResult.details?.extractedAuthors) {
    allAuthors.push(...scholarResult.details.extractedAuthors);
  }
  // Get authors from Scopus
  if (scopusResult.details?.extractedAuthors) {
    allAuthors.push(...scopusResult.details.extractedAuthors);
  }
  // Get authors from OpenAlex
  if (openAlexResult.details?.extractedAuthors) {
    allAuthors.push(...openAlexResult.details.extractedAuthors);
  }

  // Remove duplicates and clean author names
  allAuthors = [...new Set(allAuthors)].filter(Boolean);

  // Check author match
  if (candidateName && allAuthors.length > 0) {
    hasAuthorMatch = checkAuthorNameMatch(candidateName, allAuthors);
  }

  // Get best available link
  const scholarLink = scholarResult.details?.link;
  let scopusLink = scopusResult.details?.["prism:doi"]
    ? `https://doi.org/${scopusResult.details["prism:doi"]}`
    : undefined;
  const openAlexLink =
    openAlexResult.details?.doi || openAlexResult.details?.id;
  const fallbackLink = createGoogleScholarSearchUrl(pub.title);

  // Return detailed verification result for this publication
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
      openalex: {
        status: openAlexResult.status,
        details: openAlexResult.details,
      },
      displayData: {
        publication: pub.publication || "Unable to verify",
        title:
          scholarResult.details?.title ||
          scopusResult.details?.["dc:title"] ||
          openAlexResult.details?.title ||
          "Unable to verify",
        author: extractAuthorInfo(scholarResult, scopusResult, openAlexResult),
        type: extractPublicationType(
          scholarResult,
          scopusResult,
          openAlexResult
        ),
        year: extractPublicationYear(
          scholarResult,
          scopusResult,
          openAlexResult
        ),
        citedBy: extractCitationCount(scholarResult, scopusResult),
        link: extractBestLink(
          scholarLink,
          scopusLink,
          openAlexLink,
          fallbackLink
        ),
        status: determineVerificationStatus(
          scholarResult,
          scopusResult,
          openAlexResult
        ),
      },
    },
    authorVerification: {
      hasAuthorMatch: hasAuthorMatch,
      authorIds: {
        google_scholar: scholarResult.details?.authorId || null,
        scopus: scopusResult.details?.authorId || null,
        openalex: openAlexResult.details?.authorId || null,
      },
    },
  };
};
