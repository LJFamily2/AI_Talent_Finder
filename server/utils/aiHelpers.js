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

//=============================================================================
// CONSTANTS AND CONFIGURATION
//=============================================================================

/**
 * Patterns for identifying academic publication sections in CVs
 * @constant {RegExp[]}
 */
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

/**
 * Maximum size for text chunks when processing with AI
 * @constant {number}
 */
const MAX_CHUNK_SIZE = 4000;

/**
 * Similarity threshold for duplicate publication detection
 * @constant {number}
 */
const DUPLICATE_SIMILARITY_THRESHOLD = 98;

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
 *
 * @example
 * const candidateName = await extractCandidateNameWithAI(model, cvText);
 * if (candidateName) {
 *   console.log(`Processing CV for: ${candidateName}`);
 * }
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
 * Extracts academic publications from CV text using AI
 *
 * Intelligently identifies publication sections in a CV and extracts individual
 * publications with their titles and DOIs. Uses sophisticated pattern matching
 * and AI processing with anti-hallucination safeguards.
 *
 * @param {Object} model - Google Generative AI model instance
 * @param {string} cvText - The full CV text content
 * @returns {Promise<Array<Object>>} Array of publication objects with title, DOI, and full text
 *
 * @example
 * const publications = await extractPublicationsFromCV(model, cvText);
 * console.log(`Found ${publications.length} publications`);
 * publications.forEach(pub => console.log(pub.title));
 */
const extractPublicationsFromCV = async (model, cvText) => {
  // Step 1: Parse CV text into lines
  const lines = cvText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Step 2: Identify potential publication section headers
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

  // Step 3: Extract content from identified publication sections
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
  } // Process each section in chunks
  const allPublications = [];

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
      const fallbackPubs = await extractPublicationsFromChunk(model, chunks[i]);
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
      return similarity > DUPLICATE_SIMILARITY_THRESHOLD;
    });
    if (!isDuplicate) {
      uniquePublications.push(pub);
    }
  }
  return uniquePublications;
};

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
    console.error("Error in publication chunk extraction:", error);
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
};
