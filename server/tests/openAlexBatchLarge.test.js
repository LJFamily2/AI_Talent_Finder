const axios = require("axios");
const {
  verifyWithOpenAlexBatch,
} = require("../controllers/openAlexVerification");

jest.mock("axios");

describe("verifyWithOpenAlexBatch Large Dataset", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify a batch of 15 publications", async () => {
    // Generate 15 titles
    const titles = Array.from(
      { length: 15 },
      (_, i) => `Publication Title ${i + 1}`
    );
    const candidateName = "Test Author";

    // Mock response with 15 results
    const mockResults = titles.map((title, i) => ({
      id: `https://openalex.org/W${i}`,
      title: title,
      display_name: title,
      publication_year: 2020,
      type: "article",
      authorships: [
        {
          author: {
            display_name: "Test Author",
            id: `https://openalex.org/A${i}`,
          },
        },
      ],
    }));

    axios.get.mockResolvedValue({
      data: {
        results: mockResults,
      },
    });

    const results = await verifyWithOpenAlexBatch(titles, candidateName);

    expect(Object.keys(results).length).toBe(15);
    expect(results[titles[0]].status).toBe("verified");

    // Verify API call
    expect(axios.get).toHaveBeenCalledTimes(1);
    const url = axios.get.mock.calls[0][0];
    // Check if per-page is set correctly (15 * 5 = 75, capped at 200)
    expect(url).toContain("per-page=75");
  });
});
