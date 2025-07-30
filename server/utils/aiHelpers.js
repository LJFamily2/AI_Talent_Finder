

/**
 * AI Helper Utilities
 *
 * This module provides AI-powered utilities for academic CV processing and verification.
 * It includes functions for:
 * - Extracting candidate names from CVs using AI
 * - Identifying and extracting academic publications from CV text
 * - Processing publication data with intelligent chunking and validation
 *
 * Key Features:
 * - Anti-hallucination safeguards to prevent AI from generating fake content
 * - Intelligent section detection using multiple pattern matching strategies
 * - Chunked processing for large documents
 * - Duplicate detection and validation
 * - Comprehensive error handling and logging
 *
 * @module aiHelpers
 * @author AI Talent Finder Team
 * @version 1.0.0
 */

const { getTitleSimilarity } = require("./textUtils");
const { SimpleHeaderClassifier } = require("./simpleHeaderClassifier");
const { PUBLICATION_PATTERNS } = require("./constants");
const path = require("path");

//=============================================================================
// CONSTANTS AND CONFIGURATION
//=============================================================================

// Initialize header classifier
let headerClassifier = null;
try {
  headerClassifier = new SimpleHeaderClassifier();
  headerClassifier.load(
    path.join(__dirname, "../models/header_classifier.json")
  );
} catch (error) {
  console.warn("Could not load header classifier model:", error.message);
}

/**
 * Maximum size for text chunks when processing with AI
 * @constant {number}
 */
const MAX_CHUNK_SIZE = 4000;

/**
 * Similarity threshold for duplicate publication detection
 * @constant {number}
 */
const DUPLICATE_SIMILARITY_THRESHOLD = 80;

//=============================================================================
// CANDIDATE NAME EXTRACTION
//=============================================================================

/**
 * Extracts the candidate's name from CV text using AI
 *
 * Uses AI to intelligently identify and extract the full name of the person
 * whose CV is being processed. Includes validation to prevent hallucination.
 *
 * @param {Object} model - Google Generative AI model instance
 * @param {string} cvText - The full CV text content
 * @returns {Promise<string|null>} The candidate's full name or null if not found
 */
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
    const candidateName = response.text().trim();

    // Basic validation to prevent hallucination
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
    console.error("Error extracting candidate name:", error);
    return null;
  }
}

//=============================================================================
// PUBLICATION EXTRACTION
//=============================================================================

/**
 * Detects the end of the publications section in a CV, using robust pattern-based and document structure cues.
 * @param {string[]} lines - Array of lines from the CV text
 * @param {number} startIndex - Index to start searching for the section (after the main Publications header)
 * @param {RegExp[]} publicationSubheadings - List of regexes for valid publication subheadings
 * @returns {number} The index of the last line in the publications section (inclusive)
 */
function findPublicationsSectionEnd(lines, startIndex, publicationSubheadings) {
  // is a year line (strict 4-digit year)
  const isYearLine = (line) => /^\d{4}$/.test(line.trim());

  // is a publication subheading
  const isPubSubheading = (line) =>
    publicationSubheadings.some((re) => re.test(line.trim()));
  
  // is a blank or navigation line
  const isSkipLine = (line) => !line.trim() || /back to top/i.test(line);

  let nonPubCount = 0;
  let lastPubIdx = startIndex;
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (isSkipLine(line)) continue;
    if (isYearLine(line) || isPubSubheading(line)) {
      nonPubCount = 0;
      lastPubIdx = i;
      continue;
    }

    // All caps, likely a new section
    if (/^[A-Z][^a-z]*$/.test(line.trim())) {
      nonPubCount++;
    } else {
      // If it looks like a publication entry (e.g., contains a year, or is not a heading)
      if (/\b(19|20)\d{2}\b/.test(line) || /\./.test(line)) {
        nonPubCount = 0;
        lastPubIdx = i;
        continue;
      } else {
        nonPubCount++;
      }
    }
    if (nonPubCount >= 5) {
      // Stop after 5 consecutive non-publication lines
      return lastPubIdx;
    }
  }
  return lastPubIdx;
}

/**
 * Extracts academic publications from CV text using AI
 *
 * Intelligently identifies publication sections in a CV and extracts individual
 * publications with their titles and DOIs. Uses sophisticated pattern matching
 * and AI processing with anti-hallucination safeguards.
 *
 * @param {Object} model - Google Generative AI model instance
 * @param {string} cvText - The full CV text content
 * @returns {Promise<Array<Object>>} Array of publication objects with title, DOI, and full text
 */
const extractPublicationsFromCV = async (model, cvText) => {
  if (cvText.length <= MAX_CHUNK_SIZE) {
    return extractPublicationsFromChunk(model, cvText);
  }

  // Use ML-based header extraction
  const lines = cvText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sectionHeaders = extractHeadersFromText(cvText);

  // Step 1: Find publication sections using ML headers
  const publicationSections = [];
  for (let i = 0; i < sectionHeaders.length; i++) {
    const header = sectionHeaders[i];
    const nextHeader = sectionHeaders[i + 1];
    // Use robust section end detection
    let sectionEnd;
    if (nextHeader) {
      sectionEnd = nextHeader.index;
    } else {
      // Use pattern-based/document-structure section end detection for the last section
      sectionEnd =
        findPublicationsSectionEnd(
          lines,
          header.index + 1,
          PUBLICATION_PATTERNS // Use only publication subheadings from PUBLICATION_PATTERNS
        ) + 1; // inclusive
    }
    const sectionContent = lines.slice(header.index + 1, sectionEnd).join("\n");
    publicationSections.push({
      header: header.text,
      content: sectionContent,
    });
  }

  // console.log(`Found ${publicationSections.length} publication sections`);
  // publicationSections.forEach((section, index) => {
  //   console.log(
  //     `Section ${index + 1}: ${section.header} (${
  //       section.content.length
  //     } chars)`
  //   );
  // });

  // Process each section in chunks
  const allPublications = [];

  for (
    let sectionIndex = 0;
    sectionIndex < publicationSections.length;
    sectionIndex++
  ) {
    const section = publicationSections[sectionIndex];

    if (section.content.length === 0) {
      continue; // Skip to the next section
    }

    // Analyze content for potential publication entries
    const contentLines = section.content.split("\n");

    // Split section into chunks if needed
    if (section.content.length > MAX_CHUNK_SIZE) {
      const chunks = [];
      let currentChunk = "";
      let currentSize = 0;

      // Split at logical boundaries (lines)
      for (const line of contentLines) {
        if (
          currentSize + line.length + 1 > MAX_CHUNK_SIZE &&
          currentChunk.length > 0
        ) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
          currentSize = 0;
        }
        currentChunk += line + "\n";
        currentSize += line.length + 1;
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
      }

      const chunkResults = await Promise.all(
        chunks.map(async (chunk, idx) => {
          // console.log(
          //   `\n[extractPublicationsFromChunk] Input chunk #${
          //     idx + 1
          //   } (section ${sectionIndex + 1}):\n`,
          //   chunk
          // );
          const result = await extractPublicationsFromChunk(model, chunk);
          // console.log(
          //   `[extractPublicationsFromChunk] Output for chunk #${
          //     idx + 1
          //   } (section ${sectionIndex + 1}):\n`,
          //   result
          // );
          // console.log(
          //   `[extractPublicationsFromChunk] Total publications in chunk #${
          //     idx + 1
          //   } (section ${sectionIndex + 1}): ${result.length}`
          // );
          return result;
        })
      );

      chunkResults.forEach((chunkPubs) => {
        allPublications.push(...chunkPubs);
      });
    } else {
      // console.log(
      //   `\n[extractPublicationsFromChunk] Input section (section ${
      //     sectionIndex + 1
      //   }):\n`,
      //   section.content
      // );
      const sectionPubs = await extractPublicationsFromChunk(
        model,
        section.content
      );
      // console.log(
      //   `[extractPublicationsFromChunk] Output for section (section ${
      //     sectionIndex + 1
      //   }):\n`,
      //   sectionPubs
      // );
      // console.log(
      //   `[extractPublicationsFromChunk] Total publications in section ${
      //     sectionIndex + 1
      //   }: ${sectionPubs.length}`
      // );
      allPublications.push(...sectionPubs);
    }
  }

  // Remove duplicates (based on title similarity) and validate publications
  const uniquePublications = [];
  let filteredCount = 0;

  for (const pub of allPublications) {
    if (!pub.title) {
      filteredCount++;
      continue;
    }

    // Additional validation to filter out fabricated publications
    if (
      /^[A-Z]\.\s*Author/.test(pub.publication) ||
      (/et al\./.test(pub.publication) &&
        !/[A-Z][a-z]+/.test(pub.publication.split("et al")[0]))
    ) {
      filteredCount++;
      continue;
    }

    // Check if title has reasonable length and not generic words
    if (
      pub.title &&
      (pub.title.length < 6 || // Changed from 10 to 6
        (/\b(study|framework|analysis|research|impact)\b/i.test(pub.title) &&
          pub.title.length < 20)) // Changed from 25 to 20
    ) {
      // If title is too generic and short, verify it appears in the original text
      const titleInText = new RegExp(
        pub.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      if (!titleInText.test(cvText)) {
        filteredCount++;
        continue;
      }
    }

    const isDuplicate = uniquePublications.some((existingPub) => {
      if (!existingPub.title) return false;

      const similarity = getTitleSimilarity(pub.title, existingPub.title);
      return similarity > DUPLICATE_SIMILARITY_THRESHOLD;
    });
    if (!isDuplicate) {
      uniquePublications.push(pub);
    } else {
      filteredCount++;
    }
  }

  // console.log(allPublications.length, "publications found");
  // console.log(uniquePublications.length, "unique publications found");

  return uniquePublications;
};

//=============================================================================
// HEADER EXTRACTION FUNCTIONALITY
//=============================================================================

/**
 * Extract all headers from CV text using ML-based header detection
 * @param {string} cvText - The CV text to analyze
 * @returns {Array<Object>} Array of header objects with text and line number
 */
function extractHeadersFromText(cvText) {
  // Parse CV text into lines
  const lines = cvText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headers = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip phone numbers
    if (/^\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}$/.test(line)) {
      continue;
    }

    // Skip standalone years when they appear in contact info section (near top)
    if (
      /^(19|20)[0-9]{2}$/i.test(line) &&
      i < 30 &&
      !PUBLICATION_PATTERNS.some((p) => p.test(line))
    ) {
      continue;
    }

    // Try ML model first, fall back to regex rules
    let isHeader = false;

    if (headerClassifier && headerClassifier.trained) {
      try {
        isHeader = headerClassifier.predict(line, i, lines.length);
      } catch (error) {
        console.warn("Error using ML header detection:", error.message);
        // Fall back to regex rules
        isHeader =
          (line === line.toUpperCase() &&
            line.length > 3 &&
            !/^[A-Z]\.$/.test(line) &&
            !/^\d+\.?$/.test(line) &&
            !/^[A-Z\s\.\,]+\s+\d+$/.test(line) &&
            !/^PG\.\s*\d+$/.test(line)) ||
          PUBLICATION_PATTERNS.some((pattern) => pattern.test(line));
      }
    }

    if (isHeader) {
      headers.push({
        text: line,
        lineNumber: i + 1,
        index: i,
      });
    }
  }

  return headers;
}

//=============================================================================
// HELPER FUNCTIONS
//=============================================================================

/**
 * Extracts publications from a specific chunk of CV text using AI
 *
 * Processes a smaller section of CV text to identify and extract individual
 * publications. Uses strict prompting and validation to prevent AI hallucination.
 *
 * @param {Object} model - Google Generative AI model instance
 * @param {string} chunkText - A portion of CV text to process
 * @param {boolean} [isFallback=false] - Whether this is a fallback extraction attempt
 * @returns {Promise<Array<Object>>} Array of publication objects found in the chunk
 *
 * @private
 */

let extractPublicationsFromChunkCallCount = 0;
async function extractPublicationsFromChunk(model, chunkText) {
  extractPublicationsFromChunkCallCount++;
  // console.log(
  //   `[extractPublicationsFromChunk] Call count: ${extractPublicationsFromChunkCallCount}`
  // );
  // Create a more specific prompt with strong anti-hallucination instructions
  let prompt = `${chunkText}

You are an expert academic CV parser. Your task is to analyze the provided text and extract a clean, structured list of all distinct publication entries.

Output a single JSON array of objects. Each object must represent one unique publication and have the following keys:
- "publication": The full, original text of the publication entry, including all associated authors, titles, venues, and any annotations.
- "title": The main title of the publication.
- "doi": The DOI if explicitly included (a string starting with "10."), otherwise null.

Guiding Principles for Parsing:

1. Locate Publication Sections: First, identify sections in the CV dedicated to publications. Look for headers like "Publications," "Papers," "Journal Articles," "Conference Proceedings," "Peer-reviewed Publications," "Book Chapters," etc. Focus your extraction on these sections.

2. Identify Individual Entries: A new publication entry is typically indicated by:
   - A new item in a numbered or bulleted list (e.g., 1., [5], *).
   - A new paragraph that begins with a list of authors.

3. Identify and Merge Annotations: Often, a primary publication entry is followed by explanatory notes. These are part of the same entry and must be merged. Do NOT treat them as separate publications.
   - Common Annotations Include: Status updates ("in press," "to appear"), award information ("Best Paper Award"), links to pre-prints (arXiv), or notes about expanded versions.
   - How to Spot Annotations: They are often indented, on a new line directly following a main entry, and crucially, they do not begin with a new, full list of authors.

Rules:

1. Combine all text belonging to a single publication into one "publication" field. This includes the main citation and all its annotations.
2. Extract the "title" from the primary citation line, not from the annotation text.
3. If no publications are found, return an empty array [].
4. Do not invent or infer any information. The "publication" field must be an exact copy of the source text for that entry.
5. Output ONLY a valid JSON array. Do not include any commentary, markdown code blocks, or other text outside the JSON.

Example of Correct Handling:

Given this text:
23. Doe, J., & Smith, A. (2022). A General Theory of Everything. Journal of Foundational Research, 45(3), 123-145.
    *Winner of the 2022 Breakthrough Idea Award.
    A preliminary version appeared in the Proc. of the Annual Symposium on Big Ideas, 2021.

The correct single JSON object is:
[
  {
    "publication": "23. Doe, J., & Smith, A. (2022). A General Theory of Everything. Journal of Foundational Research, 45(3), 123-145.\n    *Winner of the 2022 Breakthrough Idea Award.\n    A preliminary version appeared in the Proc. of the Annual Symposium on Big Ideas, 2021.",
    "title": "A General Theory of Everything",
    "doi": null
  }
]

Begin your response with the JSON array only.
`;

  try {
    // Check if chunkText is too short to process
    if (chunkText.length < 20) {
      console.log("Chunk text is too short for processing.");
      return [];
    }
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean up the text to ensure it's a valid JSON array
    let cleanedText = text
      .trim()
      .replace(/```json|```/g, "")
      .trim();

    // Extract JSON array if embedded in other text
    const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }
    try {
      // Fix common JSON issues
      cleanedText = cleanedText.replace(/,\s*\]/g, "]");
      // Handle bad control characters that cause parsing failures
      cleanedText = cleanedText.replace(/[\u0000-\u001F]+/g, " ");

      const publications = JSON.parse(cleanedText);

      // Clean quotes and format publications
      publications.forEach((pub) => {
        if (pub.publication) {
          pub.publication = pub.publication
            .replace(/"/g, "'") // Replace all double quotes with single quotes
            .replace(/\s*\n\s*/g, " ") // Replace any newline (with optional surrounding spaces) with a single space
            .replace(/\s{2,}/g, " ") // Replace multiple consecutive spaces with a single space
            .trim(); // Remove leading and trailing whitespace
        }
        if (pub.title) {
          pub.title = pub.title
            .replace(/"/g, "'") // Replace all double quotes with single quotes
            .replace(/\s*\n\s*/g, " ") // Replace any newline (with optional surrounding spaces) with a single space
            .replace(/\s{2,}/g, " ") // Replace multiple consecutive spaces with a single space
            .trim(); // Remove leading and trailing whitespace
        }
      });

      // Filter out obviously fabricated entries
      const filteredPublications = publications.filter((pub) => {
        return (
          pub.publication &&
          pub.publication.length >= 15 &&
          !/A\.\s*Author|B\.\s*Author|example|template|placeholder/i.test(
            pub.publication
          )
        );
      });
      return filteredPublications;
    } catch (e) {
      // Add recovery attempt for common JSON issues
      try {
        // Try to repair broken JSON by more aggressive cleaning
        const fixedJson = cleanedText
          .replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ") // Remove all control chars
          .replace(/\\(?!["\\/bfnrt])/g, "\\\\") // Fix unescaped backslashes
          .replace(
            /"([^"]*)((?:"[^"]*"[^"]*)*)":/g,
            (match, p1, p2) => `"${p1.replace(/"/g, '\\"')}${p2}":`
          ) // Fix quotes in keys
          .replace(/,(\s*[\]}])/g, "$1"); // Remove trailing commas

        const publications = JSON.parse(fixedJson);

        // Clean quotes and format publications
        publications.forEach((pub) => {
          if (pub.publication) {
            pub.publication = pub.publication.replace(/"/g, "'");
          }
          if (pub.title) {
            pub.title = pub.title.replace(/"/g, "'");
          }
        });

        // Filter out obviously fabricated entries
        const filteredPublications = publications.filter((pub) => {
          return (
            pub.publication &&
            pub.publication.length >= 15 &&
            !/A\.\s*Author|B\.\s*Author|example|template|placeholder/i.test(
              pub.publication
            )
          );
        });

        return filteredPublications;
      } catch (recoveryError) {
        return [];
      }
    }
  } catch (error) {
    console.error(`[AI Processing] Error in chunk extraction:`, error);
    return [];
  }
}

//=============================================================================
// MODULE EXPORTS
//=============================================================================

/**
 * Exported functions for AI-powered CV processing
 */
module.exports = {
  extractCandidateNameWithAI,
  extractPublicationsFromCV,
  extractHeadersFromText,
};
