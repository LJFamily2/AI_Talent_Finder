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

const OpenAI = require("openai");
const {
  verifyWithGoogleScholar,
  createGoogleScholarSearchUrl,
} = require("./googleScholarVerification");
const { verifyWithScopus } = require("./scopusVerification");
const {
  verifyWithOpenAlex,
  verifyWithOpenAlexBatch,
} = require("./openAlexVerification");
const { verifyWithPubMed } = require("./pubmedVerification");
const { checkAuthorNameMatch } = require("../utils/authorUtils");
const { aggregateAuthorDetails } = require("../utils/authorDetailsAggregator");
const {
  extractCandidateNameWithAI,
  extractPublicationsFromCV,
} = require("../utils/aiHelpers");
const { extractTextFromSupabasePDF } = require("../utils/supabasePdfUtils");
const { deleteFromSupabase } = require("../utils/supabaseStorage");

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
  const { jobId, io, shouldCancel, keepFile = false } = options;
  const storedFileName = file.storedFileName || file.filename;
  let cvText = "";
  try {
    const checkCancellation = async (stage) => {
      if (typeof shouldCancel === "function" && (await shouldCancel())) {
        if (io && jobId) {
          io.to(jobId).emit("error", {
            error: "Verification cancelled",
            code: "JOB_CANCELLED",
            retryable: false,
            stage,
          });
        }

        return {
          success: false,
          cancelled: true,
          code: "JOB_CANCELLED",
          error: "Verification cancelled",
          stage: "canceled",
          retryable: false,
        };
      }

      return null;
    };

    // Parse PDF to text (with OCR fallback)
    const pdfStartTime = Date.now();
    cvText = await extractTextFromSupabasePDF(storedFileName);
    const pdfEndTime = Date.now();
    if (io && jobId)
      io.to(jobId).emit("progress", { progress: 10, step: "pdf_extracted" });

    const pdfCancellation = await checkCancellation("pdf_extracted");
    if (pdfCancellation) return pdfCancellation;

    // Initialize OpenAI client (OpenRouter)
    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });

    // Create an adapter to match the expected Google Generative AI interface
    // This allows us to switch models without rewriting all the helper functions
    const model = {
      generateContent: async (prompt) => {
        try {
          const completion = await openai.chat.completions.create({
            model: "google/gemini-3.1-flash-lite-preview",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful AI assistant that extracts information from documents.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.1, // Low temperature for extraction tasks
          });

          return {
            response: {
              text: () => completion.choices[0].message.content,
            },
          };
        } catch (error) {
          console.error("OpenRouter API Error:", error);
          throw error;
        }
      },
    };

    // Extract candidate name using AI (with robust error handling)
    const nameStartTime = Date.now();
    let candidateName;
    try {
      candidateName = await extractCandidateNameWithAI(model, cvText);
    } catch (aiErr) {
      const nameFailTime = Date.now();
      // Emit socket error with retry suggestion
      if (io && jobId) {
        io.to(jobId).emit("error", {
          error:
            "AI model is currently overloaded. Please try again in a minute.",
          code: "AI_NAME_EXTRACTION_FAILED",
          retryable: true,
        });
      }
      // Return structured object signalling an AI failure so route can stop
      return {
        success: false,
        stage: "name_extraction",
        error:
          "AI model overloaded while extracting candidate name. Please retry shortly.",
        code: "AI_NAME_EXTRACTION_FAILED",
        retryable: true,
      };
    }

    const nameCancellation = await checkCancellation("name_extracted");
    if (nameCancellation) return nameCancellation;
    const nameEndTime = Date.now();
    if (io && jobId)
      io.to(jobId).emit("progress", { progress: 30, step: "name_extracted" });

    // Extract publications using AI (with robust error handling)
    const pubStartTime = Date.now();
    let publications;
    try {
      publications = await extractPublicationsFromCV(model, cvText);
    } catch (aiErr) {
      const pubFailTime = Date.now();
      // Emit socket error with retry suggestion
      if (io && jobId) {
        io.to(jobId).emit("error", {
          error:
            "AI model is currently overloaded. Please try again in a minute.",
          code: "AI_PUBLICATION_EXTRACTION_FAILED",
          retryable: true,
        });
      }
      // Return structured object signalling an AI failure so route can stop
      return {
        success: false,
        stage: "publication_extraction",
        error:
          "AI model overloaded while extracting publications. Please retry shortly.",
        code: "AI_PUBLICATION_EXTRACTION_FAILED",
        retryable: true,
      };
    }

    const publicationCancellation = await checkCancellation(
      "publications_extracted",
    );
    if (publicationCancellation) return publicationCancellation;
    const pubEndTime = Date.now();
    if (io && jobId)
      io.to(jobId).emit("progress", {
        progress: 50,
        step: "publications_extracted",
      });

    if (!Array.isArray(publications)) {
      throw new Error("Invalid publications array format");
    }

    // Batch verify with OpenAlex first
    const openAlexBatchResults = {};
    try {
      const titles = publications.map((p) => p.title).filter((t) => t);
      // Reduced batch size to avoid 400 Bad Request errors from OpenAlex due to long URLs
      const batchSize = 3;

      // Process in chunks
      for (let i = 0; i < titles.length; i += batchSize) {
        const chunkCancellation = await checkCancellation("openalex_batch");
        if (chunkCancellation) return chunkCancellation;

        const chunk = titles.slice(i, i + batchSize);
        const batchResult = await verifyWithOpenAlexBatch(chunk, candidateName);
        Object.assign(openAlexBatchResults, batchResult);

        // Delay to respect rate limits and avoid server overload
        if (i + batchSize < titles.length) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    } catch (err) {
      console.error("Batch OpenAlex verification failed:", err);
      // Continue without batch results
    }

    // Verify each publication with both Google Scholar and Scopus
    if (io && jobId)
      io.to(jobId).emit("progress", {
        progress: 60,
        step: "verification_started",
      });
    const verificationStartTime = Date.now();
    const verificationResults = [];
    for (let i = 0; i < publications.length; i++) {
      const loopCancellation = await checkCancellation(
        "publication_verification",
      );
      if (loopCancellation) return loopCancellation;

      const pub = publications[i];
      const preFetchedOpenAlex = openAlexBatchResults[pub.title];
      const result = await processPublicationVerification(
        pub,
        candidateName,
        preFetchedOpenAlex,
      );
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

    // Aggregate author details from multiple sources
    // Find publications with author matches and collect IDs
    const allAuthorIds = {
      google_scholar: null,
      scopus: null,
      openalex: null,
      pubmed: null,
    };

    // Find verified publications with author matches
    const verifiedWithAuthorMatch = verificationResults.filter(
      (result) =>
        result.authorVerification.hasAuthorMatch &&
        Object.keys(result.authorVerification.authorIds || {}).length > 0,
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
      if (authorIds?.pubmed && !allAuthorIds.pubmed) {
        allAuthorIds.pubmed = authorIds.pubmed;
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
        const aggregationCancellation = await checkCancellation(
          "aggregation_started",
        );
        if (aggregationCancellation) return aggregationCancellation;

        // Use the aggregator to get comprehensive author details
        const aggregationStartTime = Date.now();
        const rawAuthorDetails = await aggregateAuthorDetails(
          allAuthorIds,
          candidateName,
          prioritySource,
        );
        const aggregationEndTime = Date.now();

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
        // Fallback to using Google Scholar author details if available
      }
    }

    const beforeWrapUpCancellation = await checkCancellation(
      "aggregation_complete",
    );
    if (beforeWrapUpCancellation) return beforeWrapUpCancellation;
    if (io && jobId)
      io.to(jobId).emit("progress", {
        progress: 95,
        step: "aggregation_complete",
      });

    // Second-stage author verification: Check if aggregated author details match candidate
    let secondStageAuthorMatch = false;
    if (
      aggregatedAuthorDetails &&
      aggregatedAuthorDetails.author &&
      aggregatedAuthorDetails.author.name
    ) {
      secondStageAuthorMatch = checkAuthorNameMatch(candidateName, [
        aggregatedAuthorDetails.author.name,
      ]);
    } else {
    }

    // If second stage fails (no aggregated data OR name mismatch), update all verified publications
    if (!secondStageAuthorMatch) {
      const beforeCount = verificationResults.filter(
        (r) => r.verification.displayData.status === "verified",
      ).length;

      verificationResults.forEach((result) => {
        if (result.verification.displayData.status === "verified") {
          result.verification.displayData.status =
            "verified but not same author name";
        }
      });

      const afterCount = verificationResults.filter(
        (r) =>
          r.verification.displayData.status ===
          "verified but not same author name",
      ).length;
    }

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
            "verified but not same author name",
      ).length,
      verifiedWithAuthorMatch: verificationResults.filter(
        (r) => r.verification.displayData.status === "verified",
      ).length,
      verifiedButDifferentAuthor: verificationResults.filter(
        (r) =>
          r.verification.displayData.status ===
          "verified but not same author name",
      ).length,
      results: verificationResults,
      authorDetails: aggregatedAuthorDetails,
    };
  } catch (error) {
    throw error;
  } finally {
    if (!keepFile && storedFileName) {
      try {
        await deleteFromSupabase(storedFileName);
      } catch (cleanupError) {
        console.error(
          "[CV Verification] Failed to clean up upload from Supabase:",
          cleanupError,
        );
      }
    }
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
const extractAuthorInfo = (
  scholarResult = {},
  scopusResult = {},
  openAlexResult = {},
  pubmedResult = {},
) => {
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
  // Then try PubMed author info
  if (pubmedResult.details?.extractedAuthors?.length) {
    return pubmedResult.details.extractedAuthors.join(", ");
  }
  return "Unable to verify";
};

/**
 * Extract publication type from verification results
 * @param {Object} scholarResult - Google Scholar verification result
 * @param {Object} scopusResult - Scopus verification result
 * @param {Object} openAlexResult - OpenAlex verification result
 * @param {Object} pubmedResult - PubMed verification result
 * @returns {string} Publication type
 */
const extractPublicationType = (
  scholarResult,
  scopusResult,
  openAlexResult,
  pubmedResult,
) => {
  // Fallback to other sources, but use pubmedResult.details?.pubTypes instead of .source
  const type =
    openAlexResult.details?.type ||
    scholarResult.details?.type ||
    scopusResult.details?.subtypeDescription ||
    (pubmedResult.details?.pubTypes
      ? pubmedResult.details.pubTypes.join(" | ")
      : undefined) ||
    "article";
  return typeof type === "string" ? type.toLowerCase() : type;
};

/**
 * Extract publication year from verification results
 * @param {Object} scholarResult - Google Scholar verification result
 * @param {Object} scopusResult - Scopus verification result
 * @param {Object} openAlexResult - OpenAlex verification result
 * @param {Object} pubmedResult - PubMed verification result
 * @returns {string} Publication year or fallback message
 */
const extractPublicationYear = (
  scholarResult,
  scopusResult,
  openAlexResult,
  pubmedResult,
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

  // Then try PubMed pubDate
  if (pubmedResult.details?.pubDate) {
    const pubDate = pubmedResult.details.pubDate;
    const match = pubDate.match(/(\d{4})/);
    const year = match?.[1];
    if (year && parseInt(year) >= 1700 && parseInt(year) <= currentYear + 1) {
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
 * @param {Object} openAlexResult - OpenAlex verification result
 * @returns {string} Citation count
 */
const extractCitationCount = (scholarResult, scopusResult, openAlexResult) => {
  // Get citation counts from sources
  const scholarCitations = parseInt(
    scholarResult.details?.inline_links?.cited_by?.total || "0",
  );
  const scopusCitations = parseInt(
    scopusResult.details?.["citedby-count"] || "0",
  );
  const openAlexCitations = parseInt(
    openAlexResult?.details?.cited_by_count || "0",
  );

  // Return the higher citation count
  return Math.max(
    scholarCitations,
    scopusCitations,
    openAlexCitations,
  ).toString();
};

/**
 * Extract best available link from verification results
 * @param {string} scholarLink - Google Scholar link
 * @param {string} scopusLink - Scopus link
 * @param {string} openAlexLink - OpenAlex link
 * @param {string} pubmedLink - PubMed link
 * @param {string} fallbackLink - Fallback search link
 * @returns {string} Best available link
 */
const extractBestLink = (
  scholarLink,
  scopusLink,
  openAlexLink,
  pubmedLink,
  fallbackLink,
) => {
  if (scopusLink) return scopusLink;
  if (openAlexLink) return openAlexLink;
  if (pubmedLink) return pubmedLink;
  if (scholarLink) return scholarLink;
  return fallbackLink || "No link available";
};

/**
 * Determine verification status from multiple sources
 * @param {Object} scholarResult - Google Scholar verification result
 * @param {Object} scopusResult - Scopus verification result
 * @param {Object} openAlexResult - OpenAlex verification result
 * @param {Object} pubmedResult - PubMed verification result
 * @returns {string} Overall verification status
 */
const determineVerificationStatus = (
  scholarResult,
  scopusResult,
  openAlexResult,
  pubmedResult,
) => {
  // If any source shows verified with author match
  if (
    scholarResult.status === "verified" ||
    scopusResult.status === "verified" ||
    openAlexResult.status === "verified" ||
    pubmedResult.status === "verified"
  ) {
    return "verified";
  }
  // If any source shows verified but not same author
  if (
    scholarResult.status === "verified but not same author name" ||
    scopusResult.status === "verified but not same author name" ||
    openAlexResult.status === "verified but not same author name" ||
    pubmedResult.status === "verified but not same author name"
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
 * @param {Object} preFetchedOpenAlex - Optional pre-fetched OpenAlex result
 * @returns {Promise<Object>} Verification result for the publication
 */
const processPublicationVerification = async (
  pub,
  candidateName,
  preFetchedOpenAlex = null,
) => {
  const overallStartTime = Date.now();

  // Check if we can skip other verifications based on preFetchedOpenAlex
  let skipOthers = false;
  if (
    preFetchedOpenAlex &&
    (preFetchedOpenAlex.status === "verified" ||
      preFetchedOpenAlex.status === "verified but not same author name")
  ) {
    skipOthers = true;
  }

  const [scholarResult, scopusResult, openAlexResult, pubmedResult] =
    await Promise.all([
      (async () => {
        if (skipOthers) return { status: "not verified", details: null };
        // The following code is commented out to save Google Scholar credits:

        const start = Date.now();
        const result = await verifyWithGoogleScholar(
          pub.title,
          pub.doi,
          candidateName,
        );
        const end = Date.now();
        return result;

        // Skip Google Scholar request to save credits
        return null;
      })(),
      (async () => {
        if (skipOthers) return { status: "not verified", details: null };
        const start = Date.now();
        const result = await verifyWithScopus(
          pub.title,
          pub.doi,
          candidateName,
        );
        const end = Date.now();
        return result;
      })(),
      (async () => {
        // Use pre-fetched result or return not verified
        // We only use batch verification for OpenAlex as requested
        if (preFetchedOpenAlex) return preFetchedOpenAlex;

        return {
          source: "openalex",
          status: "not verified",
          details: null,
          rawData: null,
        };
      })(),
      (async () => {
        if (skipOthers) return { status: "not verified", details: null };
        const start = Date.now();
        const result = await verifyWithPubMed(
          pub.title,
          pub.doi,
          candidateName,
        );
        const end = Date.now();
        return result;
      })(),
    ]);

  const overallEndTime = Date.now();

  // Combine authors from all sources
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
  // Get authors from PubMed
  if (pubmedResult.details?.extractedAuthors) {
    allAuthors.push(...pubmedResult.details.extractedAuthors);
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
  const pubmedLink = pubmedResult.details?.link;
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
      pubmed: {
        status: pubmedResult.status,
        details: pubmedResult.details,
      },
      displayData: {
        publication: pub.publication || "Unable to verify",
        title:
          scholarResult.details?.title ||
          scopusResult.details?.["dc:title"] ||
          openAlexResult.details?.title ||
          pubmedResult.details?.title ||
          "Unable to verify",
        author: extractAuthorInfo(
          scholarResult,
          scopusResult,
          openAlexResult,
          pubmedResult,
        ),
        type: extractPublicationType(
          scholarResult,
          scopusResult,
          openAlexResult,
          pubmedResult,
        ),
        year: extractPublicationYear(
          scholarResult,
          scopusResult,
          openAlexResult,
          pubmedResult,
        ),
        citedBy: extractCitationCount(
          scholarResult,
          scopusResult,
          openAlexResult,
        ),
        link: extractBestLink(
          scholarLink,
          scopusLink,
          openAlexLink,
          pubmedLink,
          fallbackLink,
        ),
        status: determineVerificationStatus(
          scholarResult,
          scopusResult,
          openAlexResult,
          pubmedResult,
        ),
      },
    },
    authorVerification: {
      hasAuthorMatch: hasAuthorMatch,
      authorIds: {
        google_scholar: scholarResult.details?.authorId || null,
        scopus: scopusResult.details?.authorId || null,
        openalex: openAlexResult.details?.authorId || null,
        pubmed: pubmedResult.details?.authorId || null,
      },
    },
  };
};
