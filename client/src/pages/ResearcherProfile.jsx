import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { BarChart } from "@mui/x-charts/BarChart";
import {
  Chip,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  CircularProgress,
  Skeleton,
  Stack,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import {
  getResearcherProfile,
  getResearcherWorks,
  exportResearcherProfile,
} from "../services/api";
import { exportResearcherById } from "../services/pdfExportService";
export default function ResearcherProfile() {
  const { slug } = useParams();
  const [researcher, setResearcher] = useState(null);
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [worksLoading, setWorksLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [worksPerPage] = useState(20);
  const [totalWorks, setTotalWorks] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Dropdown state for export button
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // Function to fetch works for a specific page
  const fetchWorksPage = useCallback(
    async (page) => {
      if (!slug) return;

      setWorksLoading(true);
      try {
        const worksData = await getResearcherWorks(slug, page, worksPerPage);
        setWorks(worksData.results || []);
        setTotalWorks(worksData.meta?.count || 0);
        setTotalPages(worksData.meta?.total_pages || 0);
      } catch (worksError) {
        console.error("Error fetching works:", worksError);
        setWorks([]);
      } finally {
        setWorksLoading(false);
      }
    },
    [slug, worksPerPage]
  );

  const handleExportMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleExportMenuClose = () => {
    setAnchorEl(null);
  };

  const getExportFileName = () => {
    const safeName = (researcher?.basic_info?.name || "researcher")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "");
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `${safeName}_profile_${dateStr}`;
  };

  const handleExportXLSX = async () => {
    handleExportMenuClose();
    try {
      const blob = await exportResearcherProfile(slug);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${getExportFileName()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export profile. Please try again.");
    }
  };

  const handleExportPDF = async () => {
    handleExportMenuClose();
    try {
      await exportResearcherById(slug);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF. Please try again.");
    }
  };

  useEffect(() => {
    const fetchResearcherData = async () => {
      if (!slug) return;

      try {
        setLoading(true);
        const researcherData = await getResearcherProfile(slug);
        setResearcher(researcherData);
      } catch (error) {
        console.error("Error fetching researcher:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResearcherData();
  }, [slug]);

  // Fetch works when researcher is loaded or page changes
  useEffect(() => {
    if (researcher) {
      fetchWorksPage(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, researcher]);

  // Effect to fetch works when page changes
  useEffect(() => {
    if (researcher && slug) {
      fetchWorksPage(currentPage);
    }
  }, [currentPage, researcher, slug, fetchWorksPage]);

  if (loading) {
    return (
      <div className="bg-gray-100 min-h-screen">
        <Header />
        <div className="mx-10 mt-4 px-4">
          {/* Profile skeleton */}
          <div className="bg-white p-4 rounded-md shadow space-y-4 mb-6">
            <Skeleton variant="text" width={220} height={40} />
            <Skeleton variant="text" width={120} />
            <Skeleton variant="rectangular" width="100%" height={24} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <Skeleton variant="text" width={180} />
                <Skeleton variant="text" width={120} />
                <Skeleton variant="text" width={100} />
              </div>
              <div>
                <Skeleton variant="text" width={180} />
                <Skeleton variant="text" width={120} />
                <Skeleton variant="text" width={100} />
              </div>
            </div>
          </div>
          {/* Works skeleton */}
          <div className="bg-white p-4 rounded-md shadow">
            <Skeleton variant="text" width={180} height={32} />
            {[...Array(5)].map((_, i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                width="100%"
                height={32}
                className="mb-2"
              />
            ))}
          </div>
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
    // support either nested fields.topics shape or legacy topics array
    research_areas: { fields = [], topics: legacyTopics = [] } = {},
    citation_trends: { counts_by_year = [] } = {},
    current_affiliation: {
      institution: currentInst = "",
      display_name: currentInstDisplayName = "",
    } = {},
    current_affiliations = [],
  } = researcher;

  // derive topics from fields if present, otherwise fall back to legacy topics
  let topics = [];
  if (Array.isArray(fields) && fields.length > 0) {
    for (const fld of fields) {
      if (Array.isArray(fld.topics)) {
        for (const t of fld.topics) {
          // keep only display_name for previous UI; include field name if needed
          topics.push({
            display_name: t.display_name || t.name || "",
            field: fld.display_name || "",
          });
        }
      }
    }
  } else if (Array.isArray(legacyTopics) && legacyTopics.length > 0) {
    topics = legacyTopics.map((t) =>
      typeof t === "string" ? { display_name: t } : { display_name: t.display_name || t.name || "" }
    );
  }

  const currentAffiliations =
    Array.isArray(researcher.current_affiliations) &&
      researcher.current_affiliations.length > 0
      ? researcher.current_affiliations
      : [];

  const pastAffiliations = affiliations.filter(
    (aff) =>
      aff.institution?.display_name !== (currentInstDisplayName || currentInst)
  );

  const citationYears = counts_by_year
    .map((d) => String(d.year).replace(/,/g, ""))
    .reverse();
  const citationCounts = counts_by_year.map((d) => d.cited_by_count).reverse();
  const workYears = counts_by_year
    .map((d) => String(d.year).replace(/,/g, ""))
    .reverse();
  const workCounts = counts_by_year.map((d) => d.works_count).reverse();

  // Format works data from OpenAlex API (removed slice to show all works)
  const formatWorksData = (works) => {
    return works.map((work) => ({
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

  // Use current works directly (no client-side pagination since we're doing server-side pagination)
  const currentWorks = formattedWorks;

  const handlePageChange = (page) => {
    setCurrentPage(page);
    // Scroll to works section when page changes
    document
      .getElementById("works-section")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <Header />
      {/* Back Btn & Export Btn */}
      <div className="mx-10 mt-5 px-4 flex justify-between items-center">
        <Stack direction="row" spacing={2}>
          <Button
            size="sm"
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => window.history.back()}
          >
            Back
          </Button>
        </Stack>

        <ButtonGroup variant="contained" color="primary">
          <Button
            onClick={handleExportMenuClick}
            endIcon={<ArrowDropDownIcon />}
            aria-controls={open ? "export-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={open ? "true" : undefined}
          >
            Export Profile
          </Button>
        </ButtonGroup>
        <Menu
          id="export-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleExportMenuClose}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "right",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
        >
          <MenuItem onClick={handleExportXLSX}>Export as XLSX</MenuItem>
          <MenuItem onClick={handleExportPDF}>Export as PDF</MenuItem>
        </Menu>
      </div>

      {/* Profile Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 mx-10">
        {/* LEFT Column (8 cols) */}
        <div className="md:col-span-8 space-y-4">
          {/* Researcher Info Card */}
          <div className="bg-white p-4 rounded-md shadow space-y-4 self-start">
            {/* Top: Name + ORCID */}
            <div className="flex flex-col space-y-2">
              <h2 className="text-2xl font-semibold">{name}</h2>
              {orcid && (
                <p className="text-md">
                  <span className="">ORCID:</span>{" "}
                  <a
                    href={orcid}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline text-md hover:text-blue-600"
                  >
                    {orcid}
                  </a>
                </p>
              )}
            </div>

            {/* Line break */}
            <hr className="my-5 border-gray-300" />

            {/* Bottom: 2-column layout: Left = Affils, Right = Research Areas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column: Affiliations */}
              <div className="space-y-10 pr-4">
                <div>
                  <h3 className="font-semibold text-gray-700">
                    {currentAffiliations.length == 1
                      ? "Current Affiliation"
                      : "Current Affiliations"}
                  </h3>
                  <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                    {currentAffiliations.length > 0 ? (
                      currentAffiliations.map((aff, i) => (
                        <li key={i}>{aff.display_name || "N/A"}</li>
                      ))
                    ) : (
                      <li>N/A</li>
                    )}
                  </ul>
                </div>

                {pastAffiliations.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-700">
                      {pastAffiliations.length == 1
                        ? "Past Affiliation"
                        : "Past Affiliations"}
                    </h3>
                    <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                      {pastAffiliations.map((aff, i) => (
                        <li key={i}>{aff.institution?.display_name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Right column: Research Areas, with left border */}
              <div className="space-y-10 border-t md:border-t-0 md:border-l md:pl-6 border-gray-300">
                {fields.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Fields</h3>
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
                    <h3 className="font-semibold mb-2">Topics</h3>
                    <div className="space-y-2">
                      {topics.map((topic, i) => (
                        <div
                          key={i}
                          className="flex justify-between text-sm text-gray-700 border-b"
                        >
                          <span>{topic.display_name}</span>
                          {/* <span>{topic.count}</span> */}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Works List */}
          <div id="works-section" className="bg-white p-4 rounded-md shadow">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Research Works</h2>
                <p className="text-sm text-gray-600">
                  {worksLoading
                    ? "Loading..."
                    : `Showing ${currentWorks.length} of ${totalWorks} works`}
                </p>
              </div>
              {worksLoading && <CircularProgress size={20} />}
            </div>

            {currentWorks.length > 0 ? (
              <>
                <ul className="space-y-4">
                  {currentWorks.map((work, idx) => {
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

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center space-x-2 mt-6">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>

                    <div className="flex space-x-1">
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          const pageNumber =
                            Math.max(
                              1,
                              Math.min(totalPages - 4, currentPage - 2)
                            ) + i;
                          return pageNumber <= totalPages ? (
                            <Button
                              key={pageNumber}
                              variant={
                                currentPage === pageNumber
                                  ? "contained"
                                  : "outlined"
                              }
                              size="small"
                              onClick={() => handlePageChange(pageNumber)}
                              className="min-w-0 w-10"
                            >
                              {pageNumber}
                            </Button>
                          ) : null;
                        }
                      )}
                    </div>

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                )}
              </>
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
              <div>Total Works: {total_works.toLocaleString()}</div>
              <div>Total Citations: {total_citations.toLocaleString()}</div>
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
                  <td className="py-1 px-2">{h_index.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-1 px-2">i10-index</td>
                  <td className="py-1 px-2">{i10_index.toLocaleString()}</td>
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
                series={[{ data: workCounts }]}
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
                series={[{ data: citationCounts }]}
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
