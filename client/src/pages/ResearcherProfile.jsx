import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { BarChart } from "@mui/x-charts/BarChart";
import { Chip, Button, CircularProgress } from "@mui/material";
import { getResearcherProfile, getResearcherWorks } from "../services/api";

export default function ResearcherProfile() {
  const { id } = useParams();
  const [researcher, setResearcher] = useState(null);
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [worksLoading, setWorksLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResearcherData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const researcherData = await getResearcherProfile(id);
        setResearcher(researcherData);

        // Fetch works data if we have an OpenAlex ID
        if (id) {
            console.log(id)
          setWorksLoading(true);
          try {
            const worksData = await getResearcherWorks(id);
            setWorks(worksData.results || []);
          } catch (worksError) {
            console.error("Error fetching works:", worksError);
          } finally {
            setWorksLoading(false);
          }
        }
      } catch (error) {
        console.error("Error fetching researcher:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResearcherData();
  }, [id]);

  if (loading) {
    return (
      <div className="bg-gray-100 min-h-screen">
        <Header />
        <div className="flex justify-center items-center h-64">
          <CircularProgress />
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-100 min-h-screen">
        <Header />
        <div className="mx-10 mt-4 p-4">
          <p className="text-red-600">Error: {error}</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!researcher) {
    return (
      <div className="bg-gray-100 min-h-screen">
        <Header />
        <div className="mx-10 mt-4 p-4">
          <p>No researcher was found.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const {
    basic_info: { name = "", affiliations = [] } = {},
    identifiers: { orcid = "" } = {},
    research_metrics: {
      h_index = 0,
      i10_index = 0,
      two_year_mean_citedness = 0,
      total_citations = 0,
      total_works = 0,
    } = {},
    research_areas: { fields = [], topics = [] } = {},
    citation_trends: { counts_by_year = [] } = {},
    current_affiliation: {
      institution: currentInst = "",
      display_name: currentInstDisplayName = "",
    } = {},
  } = researcher;

  const pastAffiliations = affiliations.filter(
    (aff) =>
      aff.institution?.display_name !== (currentInstDisplayName || currentInst)
  );

  const citationYears = counts_by_year.map((d) => d.year).reverse();
  const citationCounts = counts_by_year.map((d) => d.cited_by_count).reverse();
  const workYears = counts_by_year.map((d) => d.year).reverse();
  const workCounts = counts_by_year.map((d) => d.works_count).reverse();

  // Format works data from OpenAlex API
  const formatWorksData = (works) => {
    return works.slice(0, 10).map((work) => ({
      id: work.id,
      title: work.title || work.display_name,
      authors:
        work.authorships?.map((auth) => ({
          name: auth.author?.display_name || auth.raw_author_name,
        })) || [],
      journal_name:
        work.primary_location?.source?.display_name || "Unknown Journal",
      publication_year: work.publication_year,
      cited_by: work.cited_by_count || 0,
      doi: work.doi,
      link: work.doi || work.id,
      open_access: work.open_access?.is_oa || false,
    }));
  };

  const formattedWorks = formatWorksData(works);

  return (
    <div className="bg-gray-100 min-h-screen">
      <Header />
      <div className="mx-10 mt-4 px-4 flex justify-between items-center">
        <button
          onClick={() => window.history.back()}
          className="text-blue-600 hover:underline text-sm"
        >
          ← Back
        </button>

        <Button variant="contained" color="primary" size="small">
          Export Profile
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 mx-10">
        {/* LEFT Column (8 cols) */}
        <div className="md:col-span-8 space-y-4">
          {/* Researcher Info Card */}
          <div className="bg-white p-4 rounded-md shadow space-y-4 self-start">
            {/* Top: Name */}
            <div className="flex items-center space-x-4">
              <div>
                <h2 className="text-xl font-semibold">{name}</h2>
                <p className="text-sm text-gray-600">Researcher Profile</p>
              </div>
            </div>

            {/* Line break */}
            <hr className="my-5 border-gray-300" />

            {/* Bottom: 2-column layout: Left = ORCID + Affils, Right = Research Areas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column: ORCID + Affiliations */}
              <div className="space-y-4 pr-4">
                {orcid && (
                  <p className="text-md">
                    <span className="font-semibold">ORCID:</span>{" "}
                    <a
                      href={`https://orcid.org/${orcid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      {orcid}
                    </a>
                  </p>
                )}

                <div>
                  <h3 className="font-semibold text-gray-700">
                    Current Affiliation
                  </h3>
                  <p className="text-sm">
                    {currentInstDisplayName || currentInst || "N/A"}
                  </p>
                </div>

                {pastAffiliations.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-700">
                      Past Affiliations
                    </h3>
                    <ul className="list-disc list-inside text-sm text-gray-700">
                      {pastAffiliations.map((aff, i) => (
                        <li key={i}>{aff.institution?.display_name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Right column: Research Areas, with left border */}
              <div className="space-y-4 border-t md:border-t-0 md:border-l md:pl-6 border-gray-300">
                {fields.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Fields</h3>
                    <div className="flex flex-wrap gap-2">
                      {fields.map((field, i) => (
                        <Chip
                          key={i}
                          label={field.display_name}
                          color="primary"
                          variant="outlined"
                          size="small"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {topics.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Topics</h3>
                    <div className="space-y-1">
                      {topics.map((topic, i) => (
                        <div
                          key={i}
                          className="flex justify-between text-sm text-gray-700"
                        >
                          <span>{topic.display_name}</span>
                          <span>{topic.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Works List */}
          <div className="bg-white p-4 rounded-md shadow">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold">Research Works</h2>
              {worksLoading && <CircularProgress size={20} />}
            </div>

            {formattedWorks.length > 0 ? (
              <ul className="space-y-4">
                {formattedWorks.map((work, idx) => {
                  const authorsList = work.authors.map((a) => a.name);
                  const displayAuthors =
                    authorsList.length > 2
                      ? `${authorsList[0]}, ${authorsList[1]}, et al.`
                      : authorsList.join(", ");

                  return (
                    <li key={work.id || idx} className="border-b pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <a
                            href={work.link}
                            className="text-blue-600 font-medium hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {work.title}
                          </a>

                          <div className="text-sm text-gray-600 mt-1">
                            {displayAuthors} &middot; {work.journal_name}
                          </div>

                          <div className="text-sm text-gray-700 flex space-x-8 mt-1">
                            {work.publication_year && (
                              <span className="italic text-gray-500">
                                {work.publication_year}
                              </span>
                            )}
                            <span>
                              <span className="font-semibold">Cited by:</span>{" "}
                              {work.cited_by}
                            </span>
                          </div>
                        </div>
                        {work.open_access && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded ml-2">
                            Open Access
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center text-gray-500 py-8">
                {worksLoading ? "Loading works..." : "No works found"}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT Column (4 cols) */}
        <div className="md:col-span-4 space-y-4">
          {/* Citation Summary */}
          <div className="bg-white p-4 rounded-md shadow space-y-2">
            <h2 className="text-xl font-semibold">Research Metrics</h2>

            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>Total Works: {total_works}</div>
              <div>Total Citations: {total_citations}</div>
            </div>

            <table className="w-full text-sm text-left mt-2">
              <thead>
                <tr className="border-b">
                  <th className="py-1 px-2">Metric</th>
                  <th className="py-1 px-2">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 px-2">h-index</td>
                  <td className="py-1 px-2">{h_index}</td>
                </tr>
                <tr>
                  <td className="py-1 px-2">i10-index</td>
                  <td className="py-1 px-2">{i10_index}</td>
                </tr>
                <tr>
                  <td className="py-1 px-2">2-Year Mean Citedness</td>
                  <td className="py-1 px-2">
                    {two_year_mean_citedness?.toFixed(2) || "N/A"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Works Per Year Chart */}
          {workYears.length > 0 && (
            <div className="bg-white p-4 rounded-md shadow">
              <h3 className="text-md font-semibold mb-2">Works Per Year</h3>
              <BarChart
                xAxis={[{ scaleType: "band", data: workYears }]}
                series={[{ data: workCounts, label: "Works" }]}
                height={250}
              />
            </div>
          )}

          {/* Citations Per Year Chart */}
          {citationYears.length > 0 && (
            <div className="bg-white p-4 rounded-md shadow">
              <h3 className="text-md font-semibold mb-2">Citations Per Year</h3>
              <BarChart
                xAxis={[{ scaleType: "band", data: citationYears }]}
                series={[{ data: citationCounts, label: "Citations" }]}
                height={250}
              />
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
