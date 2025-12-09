const axios = require("axios");
const {
  verifyWithOpenAlexBatch,
} = require("../controllers/openAlexVerification");

jest.mock("axios");

describe("verifyWithOpenAlexBatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify publications using batch API", async () => {
    const titles = [
      "Improving service delivery performance in the United Kingdom, Organization theory perspectives on central intervention strategies",
      "Investigating the Value of a Peer-To-Peer Mentoring Experience",
    ];
    const candidateName = "Steven Kelman";

    const mockResponse = {
      data: {
        results: [
          {
            id: "https://openalex.org/W2028641483",
            title:
              "Improving service delivery performance in the United Kingdom: Organization theory perspectives on central intervention strategies",
            display_name:
              "Improving service delivery performance in the United Kingdom: Organization theory perspectives on central intervention strategies",
            publication_year: 2006,
            type: "article",
            authorships: [
              {
                author: {
                  display_name: "Steven Kelman",
                  id: "https://openalex.org/A5063979477",
                },
              },
            ],
          },
          {
            id: "https://openalex.org/W2809214248",
            title:
              "Investigating the Value of a Peer-To-Peer Mentoring Experience",
            display_name:
              "Investigating the Value of a Peer-To-Peer Mentoring Experience",
            publication_year: 2018,
            type: "article",
            authorships: [
              {
                author: {
                  display_name: "Kathleen M Griffiths",
                  id: "https://openalex.org/A5031195345",
                },
              },
            ],
          },
        ],
      },
    };

    axios.get.mockResolvedValue(mockResponse);

    const results = await verifyWithOpenAlexBatch(titles, candidateName);

    // Check first title (should be verified)
    expect(results).toHaveProperty(titles[0]);
    expect(results[titles[0]].status).toBe("verified");
    expect(results[titles[0]].details.title).toBe(
      mockResponse.data.results[0].title
    );
    expect(results[titles[0]].details.hasAuthorMatch).toBe(true);

    // Check second title (should be verified but not same author)
    expect(results).toHaveProperty(titles[1]);
    expect(results[titles[1]].status).toBe("verified but not same author name");
    expect(results[titles[1]].details.hasAuthorMatch).toBe(false);

    // Verify API call structure
    expect(axios.get).toHaveBeenCalledTimes(1);
    const url = axios.get.mock.calls[0][0];
    expect(url).toContain("filter=title.search:");
    // Note: The sanitizer now removes colons and commas and truncates to 15 words
    // "Improving service delivery performance in the United Kingdom Organization theory perspectives on central intervention strategies" is 15 words
    expect(url).toContain(
      encodeURIComponent(
        '"Improving service delivery performance in the United Kingdom Organization theory perspectives on central intervention strategies"|"Investigating the Value of a Peer-To-Peer Mentoring Experience"'
      )
    );
  });

  it("should handle empty results", async () => {
    axios.get.mockResolvedValue({ data: { results: [] } });
    const results = await verifyWithOpenAlexBatch(
      ["Some Random Title"],
      "Name"
    );
    expect(results["Some Random Title"].status).toBe("unable to verify");
  });

  it("should handle API errors gracefully", async () => {
    axios.get.mockRejectedValue(new Error("API Error"));
    const results = await verifyWithOpenAlexBatch(["Title"], "Name");
    expect(results).toEqual({});
  });
});
