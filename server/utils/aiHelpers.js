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
];

/**
 * Maximum size for text chunks when processing with AI
 * @constant {number}
 */
const MAX_CHUNK_SIZE = 6000;

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
    .filter(Boolean); // Step 2: Identify potential publication section headers (not individual publications)
  const sectionHeaders = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      (line === line.toUpperCase() && line.length > 3) || // All caps headers like "PUBLICATIONS"
      PUBLICATION_PATTERNS.some((pattern) => pattern.test(line)) // Publication section headers
    ) {
      sectionHeaders.push({ index: i, text: line });
    }
  }

  console.log(
    `[Section Detection] Found ${sectionHeaders.length} potential section headers:`
  );
  sectionHeaders.forEach((header, idx) => {
    console.log(
      `[Section Detection]   ${idx + 1}. Line ${header.index}: "${header.text}"`
    );
  });

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
  console.log(
    `[Section Processing] Starting to process ${publicationSections.length} publication sections...`
  );
  const allPublications = [];

  for (
    let sectionIndex = 0;
    sectionIndex < publicationSections.length;
    sectionIndex++
  ) {
    const section = publicationSections[sectionIndex];
    console.log(
      `\n[Section ${sectionIndex + 1}/${
        publicationSections.length
      }] Processing section: "${section.header}"`
    );
    console.log(
      `[Section ${sectionIndex + 1}] Content length: ${
        section.content.length
      } characters`
    );
    console.log(
      `[Section ${
        sectionIndex + 1
      }] Content preview: "${section.content.substring(0, 200)}..."`
    );

    // Analyze content for potential publication entries
    const contentLines = section.content.split("\n");
    const potentialPubLines = contentLines.filter((line) => {
      return (
        /^\[\w+\]/.test(line) || // [1], [P1], etc.
        /^[0-9]+\./.test(line) || // Numbered entries
        /(19|20)[0-9]{2}/.test(line) || // Contains a year
        /et al\./i.test(line) || // Contains et al.
        /journal|conference|proceedings/i.test(line) || // Contains publication venues
        /In .+edited by|Faber|Press|Publisher|University Press/i.test(line) || // Book identifiers
        /^".*"/.test(line) || // Titles in quotes
        /review of|dissertation|thesis/i.test(line) || // Reviews and theses
        /technical report|tr[- ]?\d+/i.test(line) // Technical reports
      );
    });
    console.log(
      `[Section ${sectionIndex + 1}] Found ${
        potentialPubLines.length
      } lines that look like publications`
    );

    // Split section into chunks if needed
    if (section.content.length > MAX_CHUNK_SIZE) {
      console.log(
        `[Section ${
          sectionIndex + 1
        }] Section exceeds MAX_CHUNK_SIZE (${MAX_CHUNK_SIZE}), splitting into chunks...`
      );
      const chunks = [];
      let currentChunk = section.header + "\n\n";
      let currentSize = currentChunk.length;

      // Split at logical boundaries (lines)
      let lineCount = 0;
      for (const line of contentLines) {
        lineCount++;
        if (
          currentSize + line.length + 1 > MAX_CHUNK_SIZE &&
          currentChunk.length > 0
        ) {
          console.log(
            `[Section ${sectionIndex + 1}] Creating chunk ${
              chunks.length + 1
            } at line ${lineCount} (${currentSize} chars)`
          );
          console.log(
            `[Section ${sectionIndex + 1}] Chunk ${
              chunks.length + 1
            } preview: "${currentChunk.substring(0, 150)}..."`
          );
          chunks.push(currentChunk);
          currentChunk = section.header + " (continued)\n\n";
          currentSize = currentChunk.length;
        }

        currentChunk += line + "\n";
        currentSize += line.length + 1;
      }
      if (currentChunk.length > 0) {
        console.log(
          `[Section ${sectionIndex + 1}] Creating final chunk ${
            chunks.length + 1
          } (${currentSize} chars)`
        );
        console.log(
          `[Section ${
            sectionIndex + 1
          }] Final chunk preview: "${currentChunk.substring(0, 150)}..."`
        );
        chunks.push(currentChunk);
      }

      console.log(
        `[Section ${sectionIndex + 1}] Split into ${chunks.length} chunks total`
      );

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        console.log(
          `\n[Chunk Processing] Section ${sectionIndex + 1}, Chunk ${i + 1}/${
            chunks.length
          }`
        );
        console.log(
          `[Chunk Processing] Chunk size: ${chunks[i].length} characters`
        );

        // Analyze chunk content for publications
        const chunkLines = chunks[i].split("\n");
        const chunkPubLines = chunkLines.filter((line) => {
          return (
            /^\[\w+\]/.test(line) ||
            /^[0-9]+\./.test(line) ||
            /(19|20)[0-9]{2}/.test(line) ||
            /et al\./i.test(line)
          );
        });
        console.log(
          `[Chunk Processing] Chunk contains ${chunkPubLines.length} potential publication lines:`
        );
        chunkPubLines.slice(0, 3).forEach((line, idx) => {
          console.log(
            `[Chunk Processing]   ${idx + 1}. "${line.substring(0, 100)}${
              line.length > 100 ? "..." : ""
            }"`
          );
        });
        if (chunkPubLines.length > 3) {
          console.log(
            `[Chunk Processing]   ... and ${
              chunkPubLines.length - 3
            } more lines`
          );
        }

        console.log(
          `[Chunk Processing] Calling extractPublicationsFromChunk for section ${
            sectionIndex + 1
          }, chunk ${i + 1}...`
        );
        const chunkPubs = await extractPublicationsFromChunk(model, chunks[i]);
        console.log(
          `[Chunk Processing] ✅ Extracted ${
            chunkPubs.length
          } publications from section ${sectionIndex + 1}, chunk ${i + 1}`
        );
        allPublications.push(...chunkPubs);
      }
    } else {
      // Process entire section
      console.log(
        `[Section ${
          sectionIndex + 1
        }] Section fits in single chunk, processing entire section...`
      );
      const sectionText = `${section.header}\n\n${section.content}`;
      console.log(
        `[Section ${sectionIndex + 1}] Total section size: ${
          sectionText.length
        } characters`
      );
      console.log(
        `[Section ${sectionIndex + 1}] Potential publications in section: ${
          potentialPubLines.length
        }`
      );

      if (potentialPubLines.length > 0) {
        console.log(`[Section ${sectionIndex + 1}] Sample publication lines:`);
        potentialPubLines.slice(0, 3).forEach((line, idx) => {
          console.log(
            `[Section ${sectionIndex + 1}]   ${idx + 1}. "${line.substring(
              0,
              100
            )}${line.length > 100 ? "..." : ""}"`
          );
        });
      }

      console.log(
        `[Section ${
          sectionIndex + 1
        }] Calling extractPublicationsFromChunk for entire section...`
      );
      const sectionPubs = await extractPublicationsFromChunk(
        model,
        sectionText
      );
      console.log(
        `[Section ${sectionIndex + 1}] ✅ Extracted ${
          sectionPubs.length
        } publications from entire section`
      );
      allPublications.push(...sectionPubs);
    }

    console.log(
      `[Section ${
        sectionIndex + 1
      }] Section processing complete. Total publications so far: ${
        allPublications.length
      }`
    );
  } // If nothing was found, try a general extraction as a fallback
  if (allPublications.length === 0 && cvText.length > 0) {
    console.log(
      `\n[Fallback Processing] No publications found in sections, attempting fallback extraction...`
    );
    console.log(
      `[Fallback Processing] Total CV text length: ${cvText.length} characters`
    );

    // Split the full text into manageable chunks
    const chunks = [];
    for (let i = 0; i < cvText.length; i += MAX_CHUNK_SIZE) {
      chunks.push(cvText.substring(i, i + MAX_CHUNK_SIZE));
    }

    console.log(
      `[Fallback Processing] Split CV into ${chunks.length} chunks for fallback processing`
    );

    for (let i = 0; i < chunks.length; i++) {
      console.log(
        `\n[Fallback Chunk ${i + 1}/${
          chunks.length
        }] Processing fallback chunk...`
      );
      console.log(
        `[Fallback Chunk ${i + 1}] Chunk size: ${chunks[i].length} characters`
      );

      // Analyze chunk for potential publications
      const chunkLines = chunks[i].split("\n");
      const potentialPubs = chunkLines.filter((line) => {
        return (
          /^\[\w+\]/.test(line) ||
          /^[0-9]+\./.test(line) ||
          /(19|20)[0-9]{2}/.test(line) ||
          /et al\./i.test(line) ||
          /journal|conference|proceedings/i.test(line)
        );
      });

      console.log(
        `[Fallback Chunk ${i + 1}] Found ${
          potentialPubs.length
        } potential publication lines`
      );
      if (potentialPubs.length > 0) {
        console.log(`[Fallback Chunk ${i + 1}] Sample lines:`);
        potentialPubs.slice(0, 2).forEach((line, idx) => {
          console.log(
            `[Fallback Chunk ${i + 1}]   ${idx + 1}. "${line.substring(0, 80)}${
              line.length > 80 ? "..." : ""
            }"`
          );
        });
      }

      console.log(
        `[Fallback Chunk ${i + 1}] Calling extractPublicationsFromChunk...`
      );
      const fallbackPubs = await extractPublicationsFromChunk(model, chunks[i]);
      console.log(
        `[Fallback Chunk ${i + 1}] ✅ Extracted ${
          fallbackPubs.length
        } publications from fallback chunk`
      );
      allPublications.push(...fallbackPubs);
    }

    console.log(
      `[Fallback Processing] Fallback extraction complete. Total publications found: ${allPublications.length}`
    );
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
  console.log(
    `[AI Processing] Starting publication extraction from chunk (${chunkText.length} chars, fallback: ${isFallback})`
  );
  // Create a more specific prompt with strong anti-hallucination instructions
  let prompt = `You are an expert academic CV analyzer focusing on publications.
From the text below, extract EVERY publication that appears in the text. BE CONCISE in your extraction.

Each publication must be returned as an object inside a JSON array with these fields:
- "publication": the full original text of the publication entry exactly as it appears
- "title": just the title of the publication
- "doi": the DOI if written (starts with 10.), otherwise null

Format: [{"publication": "...", "title": "...", "doi": null}]

IMPORTANT RULES:
- Extract EVERY publication in the text (there are multiple)
- Be EXTREMELY CONCISE - only include essential text in the "publication" field
- Return VALID JSON that can be parsed without errors
- DO NOT include long quotes, explanations or descriptions
- Return only valid JSON without markdown formatting
- Publications may be numbered like [1], [P1], [TR1] or bulleted or unnumbered

TEXT:
${chunkText}`;
  console.log(`[AI Processing] Chunk text: ${chunkText}`);
  console.log(`[AI Processing] Chunk text length: ${chunkText.length}`);
  console.log(`[AI Processing] Prompt length: ${prompt.length} characters`);
  console.log(`[AI Processing] Sending request to AI model...`);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log(
      `[AI Processing] ✅ Received AI response (${text.length} chars)`
    );
    console.log(
      `[AI Processing] Raw response preview: "${text.substring(0, 200)}${
        text.length > 200 ? "..." : ""
      }"`
    );

    // Parse and clean the response
    let cleanedText = text
      .trim()
      .replace(/```json|```/g, "")
      .replace(/^[^[{]*(\[.*\])[^}\]]*$/s, "$1")
      .trim();

    console.log(
      `[AI Processing] Cleaned response: "${cleanedText.substring(0, 200)}${
        cleanedText.length > 200 ? "..." : ""
      }"`
    ); // Handle edge cases where the model doesn't return valid JSON
    try {
      // Fix common JSON issues - sometimes the model returns malformed JSON
      cleanedText = cleanedText.replace(/,\s*\]/g, "]");
      cleanedText = cleanedText.replace(/([^\\])\\([^\\"])/g, "$1\\\\$2");

      // Handle truncated responses - try to extract complete objects
      if (cleanedText.includes('"publication"') && !cleanedText.endsWith("]")) {
        console.log("[AI Processing] Attempting to repair truncated JSON...");
        // Find the last complete object by looking for the last "},"
        const lastCompleteObjectPos = cleanedText.lastIndexOf("},");
        if (lastCompleteObjectPos > 0) {
          // Extract up to the last complete object and close the array
          cleanedText =
            cleanedText.substring(0, lastCompleteObjectPos + 1) + "]";
          console.log(
            "[AI Processing] Repaired JSON by extracting complete objects"
          );
        } else {
          // Try to find the last complete object ending with "}"
          const lastObjectEnd = cleanedText.lastIndexOf("}");
          if (lastObjectEnd > 0) {
            cleanedText = cleanedText.substring(0, lastObjectEnd + 1) + "]";
            console.log(
              "[AI Processing] Repaired JSON by finding last complete object"
            );
          }
        }
      }

      const publications = JSON.parse(cleanedText);
      console.log(
        `[AI Processing] ✅ Successfully parsed ${publications.length} publications from AI response`
      );

      // Log sample of extracted publications
      if (publications.length > 0) {
        console.log(`[AI Processing] Sample publications extracted:`);
        publications.slice(0, 2).forEach((pub, idx) => {
          console.log(
            `[AI Processing]   ${idx + 1}. Title: "${
              pub.title ? pub.title.substring(0, 60) : "NO TITLE"
            }${pub.title && pub.title.length > 60 ? "..." : ""}"`
          );
          console.log(`[AI Processing]      DOI: ${pub.doi || "None"}`);
        });
        if (publications.length > 2) {
          console.log(
            `[AI Processing]   ... and ${
              publications.length - 2
            } more publications`
          );
        }
      } else {
        console.log(`[AI Processing] No publications found in this chunk`);
      } // Post-processing to filter out obviously hallucinated entries
      const filteredPublications = publications.filter((pub) => {
        // Filter out entries with generic author patterns
        if (
          /A\.\s*Author|B\.\s*Author|C\.\s*Author/.test(pub.publication) ||
          /\[1\]|\[P1\]|\[TR1\]/.test(pub.publication) ||
          /example|template|placeholder/i.test(pub.publication)
        ) {
          return false;
        }
        // Filter out publications with extremely short text (likely hallucinations)
        if (pub.publication.length < 15) {
          return false;
        } // Only keep publications with specific publication details
        // const hasPublicationMetadata =
        //   pub.publication.includes("(") || // Has year or volume info
        //   pub.publication.includes(":") || // Has page numbers
        //   /vol|volume|issue|journal|proceedings/i.test(pub.publication); // Has publication metadata

        // if (!hasPublicationMetadata) {
        //   return false;
        // }

        return true;
      });

      console.log(
        `[AI Processing] After filtering: ${
          filteredPublications.length
        } valid publications (filtered out ${
          publications.length - filteredPublications.length
        })`
      );
      return filteredPublications;
    } catch (e) {
      console.log(`[AI Processing] ❌ JSON parsing failed: ${e.message}`);
      console.log(
        `[AI Processing] Failed to parse: "${cleanedText.substring(0, 100)}..."`
      );
      return [];
    }
  } catch (error) {
    console.error(
      `[AI Processing] ❌ Error in publication chunk extraction:`,
      error
    );
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
