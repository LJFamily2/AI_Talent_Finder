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

// Main function
// 1. parse the CV PDF to text
// 2. extract candidate name using AI
// 3. extract publications using the Google AI model
// 4. verify each publication with Google Scholar and Scopus
// 5. check if candidate name matches publication authors
// 6. return the results
const verifyCV = async (file, prioritySource = "googleScholar") => {
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
        temperature: 0.0,
        topP: 0.1,
        maxOutputTokens: 4096,
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
        const [scholarResult, scopusResult, openAlexResult] = await Promise.all(
          [
            verifyWithGoogleScholar(pub.title, pub.doi, candidateName),
            verifyWithScopus(pub.title, pub.doi, candidateName),
            verifyWithOpenAlex(pub.title, pub.doi, candidateName),
          ]
        );

        // Combine authors from all three sources
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

        // Flag potential false claims
        const isVerified =
          scholarResult.status === "verified" ||
          scopusResult.status === "verified" ||
          openAlexResult.status === "verified" ||
          scholarResult.status === "verified but not same author name" ||
          scopusResult.status === "verified but not same author name" ||
          openAlexResult.status === "verified but not same author name";
        const isPotentialFalseClaim =
          isVerified && candidateName && !hasAuthorMatch;
        if (isPotentialFalseClaim) {
          falseClaims++;
        } // Get best available link
        const scholarLink = scholarResult.details?.link;
        const openAlexLink = openAlexResult.details?.id; // OpenAlex ID as fallback link
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
                // Then try OpenAlex author info
                if (openAlexResult.details?.extractedAuthors?.length) {
                  return openAlexResult.details.extractedAuthors.join(", ");
                }
                return "Unable to verify";
              })(),
              type: (() => {
                // Use type from any source
                return (
                  openAlexResult.details?.type ||
                  scholarResult.details?.type ||
                  scopusResult.details?.subtypeDescription ||
                  "Not specified"
                );
              })(),
              year: (() => {
                const currentYear = new Date().getFullYear();

                // Try OpenAlex year first (usually most reliable)
                if (openAlexResult.details?.publication_year) {
                  const year =
                    openAlexResult.details.publication_year.toString();
                  if (
                    parseInt(year) >= 1700 &&
                    parseInt(year) <= currentYear + 1
                  ) {
                    return year;
                  }
                }

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
                // Try to get any link in order of preference
                if (scholarLink) return scholarLink;
                if (openAlexLink) return openAlexLink;
                return fallbackLink || "No link available";
              })(),
              status: (() => {
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
                  scholarResult.status ===
                    "verified but not same author name" ||
                  scopusResult.status === "verified but not same author name" ||
                  openAlexResult.status === "verified but not same author name"
                ) {
                  return "verified but not same author name";
                }
                // If none are verified
                return "not verified";
              })(),
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
      })
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
    if (Object.values(allAuthorIds).some((id) => id)) {
      try {
        // Use the aggregator to get comprehensive author details
        const rawAuthorDetails = await aggregateAuthorDetails(
          allAuthorIds,
          candidateName,
          prioritySource
        );
        if (rawAuthorDetails) {
          // Transform the result to match the expected structure
          aggregatedAuthorDetails = {
            author: rawAuthorDetails.author,
            articles: rawAuthorDetails.articles,
            expertises: rawAuthorDetails.expertises,
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
      authorDetails: aggregatedAuthorDetails,
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  verifyCV,
};
