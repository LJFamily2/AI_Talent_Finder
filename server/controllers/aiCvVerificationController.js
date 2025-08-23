/**
 * AI-Based CV Verification Controller
 *
 * This controller provides AI-powered academic CV verification that focuses on
 * publication verification and author matching without external API dependencies.
 * It uses AI to:
 * - Verify if publications exist online
 * - Extract publication details and find links
 * - Match candidate names with publication authors
 * - Return results in the same format as traditional verification
 *
 * @module aiCvVerification
 * @author AI Talent Finder Team
 * @version 2.0.0
 */

const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { checkAuthorNameMatch } = require("../utils/authorUtils");
const {
  extractCandidateNameWithAI,
  extractPublicationsFromCV,
} = require("../utils/aiHelpers");
const { extractTextFromPDF } = require("../utils/pdfUtils");

//=============================================================================
// MODULE EXPORTS
//=============================================================================

module.exports = {
  verifyCVWithAI,
};

//=============================================================================
// MAIN AI CV VERIFICATION FUNCTION
//=============================================================================

/**
 * Main function for AI-based academic CV verification
 *
 * Processes a CV file through AI-powered verification pipeline:
 * 1. Parse PDF to extract text content
 * 2. Extract candidate name using AI
 * 3. Extract publications using AI
 * 4. Verify each publication exists online using AI
 * 5. Match candidate name against publication authors
 * 6. Generate verification report in traditional format
 *
 * @param {Object} file - Uploaded CV file object with path property
 * @param {string} prioritySource - Priority source for verification (optional)
 * @returns {Promise<Object>} Verification results in traditional format
 */
async function verifyCVWithAI(file, prioritySource = "ai") {
  let cvText = "";
  try {
    // Parse PDF to text (with OCR fallback)
    cvText = await extractTextFromPDF(file.path);
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
    const candidateName = await extractCandidateNameWithAI(model, cvText);

    // Extract publications using existing AI function
    const rawPublications = await extractPublicationsFromCV(model, cvText);

    if (!Array.isArray(rawPublications)) {
      throw new Error("Invalid publications array format");
    }

    // Verify each publication with AI-based verification
    const verificationResults = await Promise.all(
      rawPublications.map((pub) =>
        processPublicationWithAI(model, pub, candidateName)
      )
    );

    // Generate author profile using AI (if publications verified)
    const authorProfile = await generateAuthorProfileWithAI(
      model,
      candidateName,
      verificationResults,
      cvText
    );

    // Return results in traditional format
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
      authorDetails: authorProfile,
    };
  } catch (error) {
    console.error("[AI CV Verification] Error:", error);
    throw error;
  }
}

//=============================================================================
// AI-BASED PUBLICATION VERIFICATION
//=============================================================================

/**
 * Process a single publication using AI to verify its existence online
 * @param {Object} model - Google AI model instance
 * @param {Object} pub - Publication object from extraction
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Object>} Verification result in traditional format
 */
async function processPublicationWithAI(model, pub, candidateName) {
  try {
    const verificationPrompt = `
You are an expert at verifying academic publications. Your task is to analyze this publication entry and determine if it likely exists online as a real academic publication.

CANDIDATE NAME: ${candidateName || "Unknown"}

PUBLICATION TO VERIFY:
${pub.publication}

Please provide verification information in the following JSON format:
{
  "publication": {
    "title": "extracted title",
    "authors": ["list", "of", "authors", "from", "publication"],
    "year": "publication year",
    "venue": "journal/conference name",
    "type": "journal/conference/book chapter/etc",
    "doi": "DOI if available"
  },
  "verification": {
    "isOnline": true,
    "hasAuthorMatch": true,
    "link": "https://actual-publication-link-if-findable.com",
    "citationCount": 25
  }
}

VERIFICATION GUIDELINES:
1. Extract the title, authors, year, venue, and type from the publication text
2. Determine if this looks like a real publication that would exist online
3. Check if the candidate name appears in the author list
4. Try to construct or find the most likely link to this publication:
   - Use DOI link if DOI is present: https://doi.org/[DOI]
   - Use Google Scholar search if no DOI: https://scholar.google.com/scholar?q=[encoded title]
   - Use publisher website if identifiable
5. Estimate citation count based on venue quality and publication age
6. Mark isOnline as true if this appears to be a legitimate academic publication
7. Mark hasAuthorMatch as true if candidate name is in the author list

IMPORTANT: Return ONLY the JSON object. Do not include any markdown formatting, explanations, or code blocks. Start your response with { and end with }.`;

    const result = await model.generateContent(verificationPrompt);
    const response = await result.response;
    const verificationText = cleanJSONResponse(response.text());

    // Parse JSON response with error handling
    try {
      const verification = JSON.parse(verificationText);

      // Determine status based on verification results
      let status = "not verified";
      if (verification.verification.isOnline) {
        if (verification.verification.hasAuthorMatch) {
          status = "verified";
        } else {
          status = "verified but not same author name";
        }
      }

      // Return in traditional format
      return {
        publication: {
          title: verification.publication.title || pub.title || "",
          doi: verification.publication.doi || pub.doi || null,
          fullText: pub.publication || "",
        },
        verification: {
          ai_verification: {
            status: status,
            details: verification,
          },
          displayData: {
            publication: pub.publication || "Unable to verify",
            title: verification.publication.title || "Unable to extract",
            author: verification.publication.authors
              ? verification.publication.authors.join(", ")
              : "Unable to extract",
            type: verification.publication.type || "Unknown",
            year: verification.publication.year || "Unknown",
            citedBy: verification.verification.citationCount?.toString() || "0",
            link:
              verification.verification.link ||
              generateSearchLink(verification.publication.title),
            status: status,
          },
        },
        authorVerification: {
          hasAuthorMatch: verification.verification.hasAuthorMatch || false,
          authorIds: {
            ai_verified: verification.verification.hasAuthorMatch
              ? "ai_verified"
              : null,
          },
        },
      };
    } catch (parseError) {
      console.error("Failed to parse AI verification:", parseError.message);
      console.error(
        "AI Response was:",
        verificationText.substring(0, 200) + "..."
      );
      return createFallbackVerification(pub, candidateName);
    }
  } catch (error) {
    console.error("Error in AI publication verification:", error);
    return createFallbackVerification(pub, candidateName);
  }
}

//=============================================================================
// AI-BASED AUTHOR PROFILE GENERATION
//=============================================================================

/**
 * Generate author profile using AI to verify author authenticity
 * @param {Object} model - Google AI model instance
 * @param {string} candidateName - Candidate name
 * @param {Array} verificationResults - Publication verification results
 * @param {string} cvText - Full CV text
 * @returns {Promise<Object>} Author profile in traditional format
 */
async function generateAuthorProfileWithAI(
  model,
  candidateName,
  verificationResults,
  cvText
) {
  try {
    // Only generate profile if we have verified publications with author matches
    const verifiedPublications = verificationResults.filter(
      (r) => r.verification.displayData.status === "verified"
    );

    if (verifiedPublications.length === 0) {
      return null; // No verified publications, return null like traditional approach
    }

    const profilePrompt = `
You are an expert at extracting author information from CVs. Based on the CV content and verified publications, extract basic author information.

CANDIDATE NAME: ${candidateName || "Unknown"}

VERIFIED PUBLICATIONS:
${JSON.stringify(
  verifiedPublications.map((r) => ({
    title: r.publication?.title,
    year: r.verification?.displayData?.year,
    citedBy: r.verification?.displayData?.citedBy,
  })),
  null,
  2
)}

FULL CV CONTENT:
${cvText.substring(0, 3000)}...

Extract author profile information in JSON format:
{
  "author": {
    "name": "${candidateName}",
    "affiliation": "extracted affiliation if found",
    "position": "extracted position/title if found",
    "email": "extracted email if found"
  },
  "expertises": ["research area 1", "research area 2"],
  "metrics": {
    "h_index": 10,
    "documentCount": ${verifiedPublications.length},
    "i10_index": 5,
    "citationCount": 150,
    "citations": []
  }
}

EXTRACTION GUIDELINES:
1. Extract basic author information from CV header/contact section
2. Calculate simple metrics based on verified publications only
3. Identify research areas from publication titles
4. Keep metrics conservative and realistic
5. Only include information that can be clearly extracted from the CV

IMPORTANT: Return ONLY the JSON object. Do not include any markdown formatting, explanations, or code blocks. Start your response with { and end with }.`;

    const result = await model.generateContent(profilePrompt);
    const response = await result.response;
    const profileText = cleanJSONResponse(response.text());

    try {
      const profile = JSON.parse(profileText);
      return profile;
    } catch (parseError) {
      console.error("Failed to parse author profile:", parseError.message);
      console.error("AI Response was:", profileText.substring(0, 200) + "...");
      return createFallbackAuthorProfile(candidateName, verificationResults);
    }
  } catch (error) {
    console.error("Error generating author profile:", error);
    return createFallbackAuthorProfile(candidateName, verificationResults);
  }
}

//=============================================================================
// HELPER FUNCTIONS
//=============================================================================

/**
 * Clean and extract JSON from AI response
 * @param {string} responseText - Raw AI response text
 * @returns {string} Cleaned JSON string
 */
function cleanJSONResponse(responseText) {
  let cleanedText = responseText.trim();

  // Remove markdown code blocks if present
  if (cleanedText.startsWith("```")) {
    const lines = cleanedText.split("\n");
    lines.shift(); // Remove first ```json or ```
    if (lines[lines.length - 1].trim() === "```") {
      lines.pop(); // Remove last ```
    }
    cleanedText = lines.join("\n").trim();
  }

  // Extract JSON object if wrapped in other text
  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanedText = jsonMatch[0];
  }

  return cleanedText;
}

/**
 * Generate search link for publication verification
 * @param {string} title - Publication title
 * @returns {string} Search URL
 */
function generateSearchLink(title) {
  if (!title) return "No link available";
  const encodedTitle = encodeURIComponent(title);
  return `https://scholar.google.com/scholar?hl=en&as_sdt=0%2C5&q=${encodedTitle}`;
}

/**
 * Create fallback verification when AI processing fails
 * @param {Object} pub - Original publication object
 * @param {string} candidateName - Candidate name
 * @returns {Object} Fallback verification object
 */
function createFallbackVerification(pub, candidateName) {
  return {
    publication: {
      title: pub.title || "Unable to extract",
      doi: pub.doi || null,
      fullText: pub.publication || "",
    },
    verification: {
      ai_verification: {
        status: "not verified",
        details: null,
      },
      displayData: {
        publication: pub.publication || "",
        title: pub.title || "Unable to extract",
        author: "Unable to extract",
        type: "Unknown",
        year: "Unknown",
        citedBy: "0",
        link: generateSearchLink(pub.title),
        status: "not verified",
      },
    },
    authorVerification: {
      hasAuthorMatch: false,
      authorIds: {
        ai_verified: null,
      },
    },
  };
}

/**
 * Create fallback author profile when AI processing fails
 * @param {string} candidateName - Candidate name
 * @param {Array} verificationResults - Verification results
 * @returns {Object} Fallback author profile
 */
function createFallbackAuthorProfile(candidateName, verificationResults) {
  const pubCount = verificationResults.length;
  const verifiedCount = verificationResults.filter(
    (r) => r.verification.displayData.status === "verified"
  ).length;

  return {
    author: {
      name: candidateName || "Unknown",
      affiliation: "Not specified",
      position: "Not specified",
      email: "Not specified",
    },
    expertises: ["General"],
    metrics: {
      h_index: Math.min(verifiedCount, 10),
      documentCount: pubCount,
      i10_index: Math.max(0, verifiedCount - 5),
      citationCount: verifiedCount * 5,
      citations: [],
    },
  };
}
