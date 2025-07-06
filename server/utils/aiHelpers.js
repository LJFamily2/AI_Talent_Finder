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
const MAX_CHUNK_SIZE = 6000;

/**
 * Similarity threshold for duplicate publication detection
 * @constant {number}
 */
const DUPLICATE_SIMILARITY_THRESHOLD = 90;

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
  // Use ML-based header extraction
  const lines = cvText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sectionHeaders = extractHeadersFromText(cvText);

  // Step 3: Extract content from identified publication sections
  const publicationSections = [];
  for (let i = 0; i < sectionHeaders.length; i++) {
    console.log(
      `Processing section header ${i + 1}: "${sectionHeaders[i].text}"`
    );
    const header = sectionHeaders[i];
    const nextHeader = sectionHeaders[i + 1];

    const sectionEnd = nextHeader ? nextHeader.index : lines.length;
    const sectionContent = lines.slice(header.index + 1, sectionEnd).join("\n");
    publicationSections.push({
      header: header.text,
      content: sectionContent,
    });
  }
  if (publicationSections.length === 0) {
    // Expanded pattern matching for publications
    const pubEntries = lines.filter(
      (line) =>
        /^\[\w+\]/.test(line) || // [1], [P1], etc.
        /^[0-9]+\./.test(line) || // Numbered entries
        /(19|20)[0-9]{2}/.test(line) || // Contains a year
        /et al\./i.test(line) || // Contains et al.
        /journal|conference|proceedings/i.test(line) || // Publication venues
        /In .+edited by|Press|Publisher/i.test(line) // Book identifiers
    );

    // Create smaller chunks of publications if there are many
    if (pubEntries.length > 0) {
      // Group entries into smaller chunks to avoid AI processing limits
      const chunkSize = 50; // Process 50 publications at a time
      for (let i = 0; i < pubEntries.length; i += chunkSize) {
        publicationSections.push({
          header: `Publications (Group ${Math.floor(i / chunkSize) + 1})`,
          content: pubEntries.slice(i, i + chunkSize).join("\n"),
        });
      }
    }
  }

  console.log(`Found ${publicationSections.length} publication sections`);
  publicationSections.forEach((section, index) => {
    console.log(
      `Section ${index + 1}: ${section.header} (${
        section.content.length
      } chars)`
    );
  });

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
          chunks.push(currentChunk.trim()); // Trim trailing newline
          currentChunk = ""; // Start new chunk
          currentSize = 0;
        }
        currentChunk += line + "\n";
        currentSize += line.length + 1;
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim()); // Trim trailing newline
      }

      // Process chunks in parallel for better performance
      const chunkResults = await Promise.all(
        chunks.map(async (chunk, idx) => {
          console.log(
            `\n[extractPublicationsFromChunk] Input chunk #${
              idx + 1
            } (section ${sectionIndex + 1}):\n`,
            chunk
          );
          const result = await extractPublicationsFromChunk(model, chunk);
          console.log(
            `[extractPublicationsFromChunk] Output for chunk #${
              idx + 1
            } (section ${sectionIndex + 1}):\n`,
            result
          );
          console.log(
            `[extractPublicationsFromChunk] Total publications in chunk #${
              idx + 1
            } (section ${sectionIndex + 1}): ${result.length}`
          );
          return result;
        })
      );

      // Flatten results
      chunkResults.forEach((chunkPubs) => {
        allPublications.push(...chunkPubs);
      });
    } else {
      // Process the entire section as a single chunk
      console.log(
        `\n[extractPublicationsFromChunk] Input section (section ${
          sectionIndex + 1
        }):\n`,
        section.content
      );
      const sectionPubs = await extractPublicationsFromChunk(
        model,
        section.content
      );
      console.log(
        `[extractPublicationsFromChunk] Output for section (section ${
          sectionIndex + 1
        }):\n`,
        sectionPubs
      );
      console.log(
        `[extractPublicationsFromChunk] Total publications in section ${
          sectionIndex + 1
        }: ${sectionPubs.length}`
      );
      allPublications.push(...sectionPubs);
    }
  }

  // Remove duplicates (based on title similarity) and validate publications
  // const uniquePublications = [];
  // let filteredCount = 0;

  // for (const pub of allPublications) {
  //   if (!pub.title) {
  //     filteredCount++;
  //     continue;
  //   } // Additional validation to filter out fabricated publications
  //   if (
  //     /^[A-Z]\.\s*Author/.test(pub.publication) ||
  //     (/et al\./.test(pub.publication) &&
  //       !/[A-Z][a-z]+/.test(pub.publication.split("et al")[0]))
  //   ) {
  //     filteredCount++;
  //     continue;
  //   } // Check if title has reasonable length and not generic words
  //   if (
  //     pub.title &&
  //     (pub.title.length < 6 || // Changed from 10 to 6
  //       (/\b(study|framework|analysis|research|impact)\b/i.test(pub.title) &&
  //         pub.title.length < 20)) // Changed from 25 to 20
  //   ) {
  //     // If title is too generic and short, verify it appears in the original text
  //     const titleInText = new RegExp(
  //       pub.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  //       "i"
  //     );
  //     if (!titleInText.test(cvText)) {
  //       filteredCount++;
  //       continue;
  //     }
  //   }
  //   const isDuplicate = uniquePublications.some((existingPub) => {
  //     if (!existingPub.title) return false;

  //     const similarity = getTitleSimilarity(pub.title, existingPub.title);
  //     return similarity > DUPLICATE_SIMILARITY_THRESHOLD;
  //   });
  //   if (!isDuplicate) {
  //     uniquePublications.push(pub);
  //   } else {
  //     filteredCount++;
  //   }
  // }

  console.log(allPublications.length, "unique publications found");

  return allPublications;
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
    } else {
      // Use existing regex rules
      isHeader =
        (line === line.toUpperCase() &&
          line.length > 3 &&
          !/^[A-Z]\.$/.test(line) &&
          !/^\d+\.?$/.test(line) &&
          !/^[A-Z\s\.\,]+\s+\d+$/.test(line) &&
          !/^PG\.\s*\d+$/.test(line)) ||
        PUBLICATION_PATTERNS.some((pattern) => pattern.test(line));
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
async function extractPublicationsFromChunk(model, chunkText) {
  // Create a more specific prompt with strong anti-hallucination instructions
  let prompt = `${chunkText}

You are an expert academic CV analyzer focusing on extracting publication records.

From the text above, extract EVERY publication that appears. Your task is to output a structured JSON array, where each object contains:

- "publication": the full original publication entry EXACTLY as it appears (including authors, title, and source)
- "title": only the title of the publication
- "doi": the DOI if included (starting with "10."), otherwise null

Return format:
[
  {
    "publication": "...",
    "title": "...",
    "doi": "10.xxxx/xxxxx" or null
  },
  ...
]

Rules:
- Combine lines that belong to the same publication into one entry.
- Include all author names, titles, dates, and publication source in the "publication" field.
- Do NOT add commentary, markdown, bullet points, or extra explanation.
- Output ONLY valid JSON — no code block markers, no extra characters.
- Do NOT invent or guess any missing information.
- If no publications are found, return: []

Example output:
[
  {
    "publication": "Smith J., Doe A. 'Analyzing Policy Impacts on Education'. Education Review Journal, 2021.",
    "title": "Analyzing Policy Impacts on Education",
    "doi": null
  }
]

Begin your response with the JSON array only.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
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
