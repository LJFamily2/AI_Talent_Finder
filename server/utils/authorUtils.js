const axios = require("axios");
const { getTitleSimilarity } = require("./textUtils");

// Cache for author details to avoid repeated API calls
const authorCache = new Map();

/**
 * Comprehensive author name matching function for academic publications
 * Handles various academic name formats, abbreviations, and ordering
 */
const checkAuthorNameMatch = (candidateName, authorList) => {
  if (!candidateName || !authorList || authorList.length === 0) {
    return false;
  }
  // Normalize candidate name
  const normalizeName = (name) => {
    return name
      .toLowerCase()
      .replace(/[^\w\s\-\.,]/g, " ") // Keep commas for surname-first format parsing
      .replace(/\s+/g, " ")
      .trim();
  };
  const extractNameParts = (name) => {
    // Check for surname-first format (e.g., "Smith, J.")
    let firstName = "",
      lastName = "",
      middleNames = [];

    const normalizedName = normalizeName(name);
    if (normalizedName.includes(",")) {
      // Handle "Lastname, Firstname" format
      const parts = normalizedName.split(",").map((part) => part.trim());
      lastName = parts[0];

      if (parts.length > 1 && parts[1]) {
        const firstParts = parts[1].split(" ").filter(Boolean);
        firstName = firstParts[0] || "";
        middleNames = firstParts.slice(1) || [];
      }
    } else {
      // Standard "Firstname [Middle] Lastname" format
      let parts = normalizedName.split(" ").filter(Boolean);

      // Special handling for initials with dots (e.g., "B.F. Goldfarb")
      if (parts.length >= 2 && parts[0].includes(".") && parts[0].length <= 4) {
        // This looks like initials - split them up
        const initialsStr = parts[0];
        const initialParts = initialsStr.split(".").filter(Boolean);

        if (initialParts.length > 1) {
          firstName = initialParts[0];
          middleNames = initialParts.slice(1);
          lastName = parts[parts.length - 1];
        } else {
          // Single initial with dot
          firstName = parts[0];
          lastName = parts[parts.length - 1];
          middleNames = parts.slice(1, -1);
        }
      } else {
        // Standard format
        // Check for concatenated initials (e.g., "BD Goldstein" -> firstName: "B", middleNames: ["D"])
        // Only consider it concatenated initials if it's 2-4 letters AND all uppercase in original form
        const originalParts = name.split(" ").filter(Boolean);
        if (
          parts.length === 2 &&
          parts[0].length >= 2 &&
          parts[0].length <= 4 &&
          originalParts.length >= 1 &&
          /^[A-Z]+$/.test(originalParts[0])
        ) {
          // This looks like concatenated initials
          const initialsStr = parts[0];
          firstName = initialsStr.charAt(0);
          middleNames = initialsStr.slice(1).split("").filter(Boolean);
          lastName = parts[1];
        } else {
          firstName = parts[0] || "";
          lastName = parts[parts.length - 1] || "";
          middleNames = parts.slice(1, -1);
        }
      }
    }

    // Get all initials
    const firstInitial = firstName.replace(/\./g, "").charAt(0);
    const middleInitials = middleNames.map((n) =>
      n.replace(/\./g, "").charAt(0)
    );

    // Get all initials as a string (e.g., "BFG" for "Benjamin F. Goldfarb")
    const allInitialsStr = firstInitial + middleInitials.join("");

    // Get full name without dots for comparison
    const fullNameNoDots = normalizedName.replace(/\./g, "");

    return {
      firstName: firstName.replace(/\./g, ""), // Remove dots for consistency
      lastName,
      middleNames: middleNames.map((n) => n.replace(/\./g, "")), // Remove dots for consistency
      firstInitial,
      middleInitials,
      allInitials: allInitialsStr,
      fullName: normalizedName,
      fullNameNoDots,
    };
  };
  const candidate = extractNameParts(candidateName);

  // Check each author in the list
  for (const authorName of authorList) {
    if (!authorName || typeof authorName !== "string") continue;

    const author = extractNameParts(authorName);

    // ------------------ MATCHING LOGIC -----------------

    // 1. EXACT MATCH - Full name match with or without dots
    if (
      candidate.fullName === author.fullName ||
      candidate.fullNameNoDots === author.fullNameNoDots
    ) {
      return true;
    }

    // 2. LAST NAME MATCH - Last name must match in all cases
    if (candidate.lastName !== author.lastName) {
      continue; // Skip to next author if last names don't match
    }

    // 3. FULL NAME WITH INITIALS: "Benjamin F. Goldfarb" matches "B.F. Goldfarb"
    // OR: "John Smith" matches "Smith, J."
    // The candidate has full name, author has initials
    if (
      candidate.firstName.length > 1 &&
      author.firstName.length === 1 &&
      author.firstInitial === candidate.firstInitial &&
      candidate.lastName === author.lastName
    ) {
      // Check middle initials match if both have them
      if (
        author.middleInitials.length > 0 &&
        candidate.middleInitials.length > 0
      ) {
        // Every middle initial in author must match candidate's middle initials
        const middleInitialsMatch =
          author.middleInitials.length === candidate.middleInitials.length &&
          author.middleInitials.every((initial, index) => {
            return candidate.middleInitials[index] === initial;
          });

        if (middleInitialsMatch) {
          return true;
        }
      }
      // If author has middle initials but candidate doesn't, they don't match
      else if (
        author.middleInitials.length > 0 &&
        candidate.middleInitials.length === 0
      ) {
        continue;
      }
      // If candidate has middle initials but author doesn't, they don't match
      else if (
        candidate.middleInitials.length > 0 &&
        author.middleInitials.length === 0
      ) {
        continue;
      }
      // Neither has middle initials, and first initial + last name match
      else {
        return true;
      }
    }

    // 4. INITIAL TO FULL NAME: "B.F. Goldfarb" matches "Benjamin F. Goldfarb"
    // The candidate has initials, author has full name
    if (
      candidate.firstName.length === 1 &&
      author.firstName.length > 1 &&
      candidate.firstInitial === author.firstInitial &&
      candidate.lastName === author.lastName
    ) {
      // Check middle initials match if both have them
      if (
        candidate.middleInitials.length > 0 &&
        author.middleInitials.length > 0
      ) {
        const middleInitialsMatch = candidate.middleInitials.every(
          (initial, index) => {
            return author.middleInitials[index] === initial;
          }
        );

        if (middleInitialsMatch) {
          return true;
        }
      }
      // If either has middle initials but the other doesn't, they don't match
      else if (
        candidate.middleInitials.length !== author.middleInitials.length
      ) {
        continue;
      }
      // Neither has middle initials
      else {
        return true;
      }
    }

    // 5. BOTH HAVE INITIALS: "B.F. Goldfarb" matches "B.F. Goldfarb"
    if (
      candidate.firstName.length === 1 &&
      author.firstName.length === 1 &&
      candidate.firstInitial === author.firstInitial &&
      candidate.lastName === author.lastName
    ) {
      // All middle initials must match exactly
      if (
        candidate.middleInitials.join("") === author.middleInitials.join("")
      ) {
        return true;
      }
    }

    // 6. FULL NAMES WITH DIFFERENT FORMATS: "John Smith" matches "Smith, John"
    if (
      candidate.firstName.length > 1 &&
      author.firstName.length > 1 &&
      candidate.firstName === author.firstName &&
      candidate.lastName === author.lastName
    ) {
      // If both have middle names/initials, they must match
      if (candidate.middleNames.length > 0 && author.middleNames.length > 0) {
        // Either full middle names match or initials match
        if (
          candidate.middleNames.join(" ") === author.middleNames.join(" ") ||
          candidate.middleInitials.join("") === author.middleInitials.join("")
        ) {
          return true;
        }
      }
      // If neither has middle names
      else if (
        candidate.middleNames.length === 0 &&
        author.middleNames.length === 0
      ) {
        return true;
      }
      // Special case: if one has no middle names but first and last match perfectly, accept it
      // This handles cases like "Benjamin Goldstein" matching "Benjamin C. Goldstein"
      else {
        return true;
      }
    }
  }

  return false;
};

/**
 * Fetches detailed author information from Google Scholar
 * Uses cache to avoid repeated API calls for the same author
 */
const getAuthorDetails = async (authorId, serpApiKey, searchTitle) => {
  // Helper function to find matching article
  const findMatchingArticle = (articles, title) => {
    if (!articles || !title) return null;

    const normalizedSearchTitle = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, "");

    return articles.find((article) => {
      if (!article.title) return false;

      const normalizedArticleTitle = article.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, "");

      // Try exact match first
      if (normalizedArticleTitle === normalizedSearchTitle) return true;

      // Try fuzzy matching using getTitleSimilarity
      const similarity = getTitleSimilarity(
        normalizedArticleTitle,
        normalizedSearchTitle
      );
      if (similarity > 70) return true;

      // Try partial matching in either direction
      if (
        normalizedArticleTitle.length > 20 &&
        normalizedSearchTitle.length > 20
      ) {
        if (
          normalizedArticleTitle.includes(normalizedSearchTitle) ||
          normalizedSearchTitle.includes(normalizedArticleTitle)
        )
          return true;
      }

      return false;
    });
  };

  // Check cache first
  if (authorCache.has(authorId)) {
    const cachedAuthor = authorCache.get(authorId);
    const matchingArticle = findMatchingArticle(
      cachedAuthor.articles,
      searchTitle
    );

    if (matchingArticle) {
      return {
        year: matchingArticle.year,
        details: {
          name: cachedAuthor.name,
          affiliations: cachedAuthor.affiliations,
          interests: cachedAuthor.interests,
          citedBy: matchingArticle.cited_by,
        },
      };
    }
  }

  try {
    const authorApiUrl = `https://serpapi.com/search?engine=google_scholar_author&author_id=${authorId}&api_key=${serpApiKey}`;
    const { data: authorResult } = await axios.get(authorApiUrl);

    // Cache the full author result
    const authorData = {
      name: authorResult.author?.name,
      affiliations: authorResult.author?.affiliations,
      interests: authorResult.author?.interests,
      articles: authorResult.articles,
    };
    authorCache.set(authorId, authorData);

    // Find the matching article
    const matchingArticle = findMatchingArticle(
      authorResult.articles,
      searchTitle
    );

    if (matchingArticle) {
      return {
        year: matchingArticle.year,
        details: {
          author: authorResult.author,
          articles: authorResult.articles,
          citedBy: authorResult.cited_by,
        },
      };
    }
  } catch (error) {
    // Error handled silently
  }

  return null;
};

module.exports = {
  authorCache,
  checkAuthorNameMatch,
  getAuthorDetails,
};
