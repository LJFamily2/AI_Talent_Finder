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
  /^publications?$/i,
  /^selected publications$/i,
  /^journal (articles|publications)$/i,
  /^conference (papers|publications)$/i,
  /^peer[- ]?reviewed publications$/i,
  /^in-progress manuscripts$/i,
  /^policy-related publications$/i,
  /^workshop papers$/i,
  /^technical reports$/i,
  /^book chapters$/i,
  /^book reviews$/i,
  /^research publications$/i,
  /^published works$/i,
  /^scholarly publications$/i,
  /^papers$/i,
  /^articles$/i,
  /^grants?$/i,
  /^funding$/i,
  /^service$/i,
  /^leadership$/i,
  /^awards?$/i,
  /^honors?$/i,
  /^education$/i,
  /^employment$/i,
  /^experience$/i,
  /^teaching$/i,
  /^appointments?$/i,
  /^memberships?$/i,
  /^activities$/i,
  /^presentations?$/i,
  /^talks$/i,
  /^invited talks$/i,
  /^conferences?$/i,
  /^workshops?$/i,
  /^outreach$/i,
  /^community service$/i,
  /^volunteering$/i,
  /^skills$/i,
  /^languages$/i,
  /^references?$/i,
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
  console.log("Cv text", cvText);
  // Step 1: Parse CV text into lines
  const lines = cvText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean); // Step 2: Identify potential publication section headers (not individual publications)
  const sectionHeaders = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      (line === line.toUpperCase() && // Check if line is all uppercase
        line.length > 3 && // Ensure line is long enough to be a header
        !/^[A-Z]\.$/.test(line) && // Exclude single uppercase letters (e.g., initials)
        !/^\d+\.?$/.test(line)) || // Exclude numbered lines
      PUBLICATION_PATTERNS.some((pattern) => pattern.test(line))
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
  // if (publicationSections.length === 0) {
  //   // If no sections found, look for entries with common publication patterns
  //   const pubEntries = lines.filter(
  //     (line) =>
  //       /^\[\w+\]/.test(line) || // [1], [P1], etc.
  //       /^[0-9]+\./.test(line) || // Numbered entries
  //       /(19|20)[0-9]{2}/.test(line) // Contains a year
  //   );

  //   if (pubEntries.length > 0) {
  //     publicationSections.push({
  //       header: "Publications",
  //       content: pubEntries.join("\n"),
  //     });
  //   }
  // } // Process each section in chunks
  console.log("Publication Sections:", publicationSections);
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
      `[Section ${sectionIndex + 1}] Processing: "${section.header}" (${
        section.content.length
      } chars)`
    );

    if (section.content.length === 0) {
      console.log(
        `[Section ${sectionIndex + 1}] Skipping empty section "${
          section.header
        }".`
      );
      continue; // Skip to the next section
    }

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
    ); // Split section into chunks if needed
    if (section.content.length > MAX_CHUNK_SIZE) {
      console.log(`[Section ${sectionIndex + 1}] Splitting into chunks...`);

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

      console.log(
        `[Section ${sectionIndex + 1}] Processing ${chunks.length} chunks...`
      );

      // Process chunks in parallel for better performance
      const chunkResults = await Promise.all(
        chunks.map((chunk) => extractPublicationsFromChunk(model, chunk))
      );

      // Flatten results
      chunkResults.forEach((chunkPubs) => {
        allPublications.push(...chunkPubs);
      });
    } else {
      // Process the entire section as a single chunk
      const sectionPubs = await extractPublicationsFromChunk(
        model,
        section.content
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
  }
  // Remove duplicates (based on title similarity) and validate publications
  console.log(
    `[Filtering] Total publications before filtering: ${allPublications.length}`
  );
  const uniquePublications = [];
  let filteredCount = 0;

  for (const pub of allPublications) {
    if (!pub.title) {
      console.log(`[Filtering] Filtered out publication without title`);
      filteredCount++;
      continue;
    } // Additional validation to filter out fabricated publications
    if (
      /^[A-Z]\.\s*Author/.test(pub.publication) ||
      (/et al\./.test(pub.publication) &&
        !/[A-Z][a-z]+/.test(pub.publication.split("et al")[0]))
    ) {
      console.log(`[Filtering] Filtered out fabricated: "${pub.title}"`);
      filteredCount++;
      continue;
    } // Check if title has reasonable length and not generic words
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
        console.log(
          `[Filtering] Filtered out generic title not in text: "${pub.title}"`
        );
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
      console.log(`[Filtering] Filtered out duplicate: "${pub.title}"`);
      filteredCount++;
    }
  }

  console.log(
    `[Filtering] Filtered out ${filteredCount} publications, ${uniquePublications.length} remain`
  );
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
  console.log(`[AI Processing] Processing chunk: (${chunkText})`);

  // Create a more specific prompt with strong anti-hallucination instructions
  let prompt = `You are an expert academic CV analyzer focusing on publications.
From the text below, extract EVERY publication that appears in the text. BE CONCISE in your extraction.

Format: [{"publication": "...", "title": "...", "doi": null}]

Each publication must be returned as an object inside a JSON array with these fields:
- "publication": the full original text of the publication entry EXACTLY as it appears (combine lines if needed)
- "title": just the title of the publication
- "doi": the DOI if written (starts with 10.), otherwise null

IMPORTANT RULES:
- Extract EVERY publication in the text (there are multiple)
- Combine lines that belong to the same publication into a single entry
- Be EXTREMELY CONCISE - only include essential text in the "publication" field
- Return VALID JSON that can be parsed without errors
- DO NOT include long quotes, explanations or descriptions
- Return only valid JSON without markdown formatting
- DO NOT hallucinate the content of publications
- DO NOT invent titles, DOIs or publication details
- DO NOT include any fabricated entries or placeholders
- If you cannot find any publications, return an empty array: []

TEXT:
${chunkText}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log(`[AI Processing] Received response (${text.length} chars)`); // Parse and clean the response
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

      console.log(
        `[AI Processing] Extracted ${publications.length} publications`
      ); // Filter out obviously fabricated entries
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
      console.log(`[AI Processing] JSON parsing failed: ${e.message}`);

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

        console.log(
          `[AI Processing] Recovered with ${publications.length} publications`
        );

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
        console.log(
          `[AI Processing] Recovery failed: ${recoveryError.message}`
        );
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
};
