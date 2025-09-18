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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ContactPageIcon from "@mui/icons-material/ContactPage";
import CloseIcon from "@mui/icons-material/Close";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import {
  getResearcherProfile,
  getResearcherWorks,
  exportResearcherProfile,
  findResearcherContact,
} from "../services/api";
import { exportResearcherById } from "../services/pdfExportService";
import BookmarkIcon from "../components/BookmarkIcon";
import PaginationBar from "@/components/PaginationBar";

// Add custom styles for animations
const animationStyles = `
  @keyframes glow-pulse {
    0%, 100% {
      box-shadow: 0 0 8px rgba(139, 69, 19, 0.2), 0 0 16px rgba(255, 193, 7, 0.2);
    }
    50% {
      box-shadow: 0 0 12px rgba(139, 69, 19, 0.4), 0 0 24px rgba(255, 193, 7, 0.3);
    }
  }
  
  @keyframes spin-gentle {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes sparkle {
    0%, 100% { 
      transform: scale(1) rotate(0deg);
      opacity: 0.8;
    }
    25% { 
      transform: scale(1.2) rotate(90deg);
      opacity: 1;
    }
    50% { 
      transform: scale(1.1) rotate(180deg);
      opacity: 0.9;
    }
    75% { 
      transform: scale(1.2) rotate(270deg);
      opacity: 1;
    }
  }
  
  @keyframes ai-search-pulse {
    0% { 
      transform: scale(1);
      opacity: 0.7;
    }
    50% { 
      transform: scale(1.05);
      opacity: 1;
    }
    100% { 
      transform: scale(1);
      opacity: 0.7;
    }
  }
  
  @keyframes magic-shimmer {
    0% { transform: translateX(-100%) translateY(-100%) rotate(0deg); }
    100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
  }
`;

// Inject styles into the document head
if (typeof document !== "undefined") {
  const styleElement = document.createElement("style");
  styleElement.textContent = animationStyles;
  if (!document.head.querySelector("style[data-ai-search-animations]")) {
    styleElement.setAttribute("data-ai-search-animations", "true");
    document.head.appendChild(styleElement);
  }
}

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

  // Contact finder state
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactInfo, setContactInfo] = useState(null);
  const [contactError, setContactError] = useState(null);

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

  // Contact finder functions
  const handleContactSearch = async () => {
    if (!researcher) return;

    setContactLoading(true);
    setContactError(null);
    setContactDialogOpen(true);
    setContactInfo(null);

    try {
      const {
        basic_info: { name = "" } = {},
        identifiers: { orcid = "" } = {},
      } = researcher;

      // Get current affiliation
      const currentAffiliations =
        Array.isArray(researcher.current_affiliations) &&
        researcher.current_affiliations.length > 0
          ? researcher.current_affiliations
          : [];
      const affiliation =
        currentAffiliations.length > 0
          ? currentAffiliations[0].display_name
          : "";

      // Get research areas
      const { research_areas: { fields = [] } = {} } = researcher;
      const researchAreas = fields.map((field) => field.display_name);

      const contactData = await findResearcherContact(
        name,
        affiliation,
        orcid,
        researchAreas
      );
      setContactInfo(contactData);
    } catch (error) {
      console.error("Contact search failed:", error);
      setContactError(error.message || "Failed to find profile links");
    } finally {
      setContactLoading(false);
    }
  };

  const handleContactDialogClose = () => {
    setContactDialogOpen(false);
    setContactInfo(null);
    setContactError(null);
  };

  // Helper function to get profile type and display name
  const getProfileInfo = (url) => {
    if (url.includes("linkedin.com")) {
      return { type: "LinkedIn", icon: "💼", displayName: "LinkedIn Profile" };
    } else if (url.includes("scholar.google.com")) {
      return {
        type: "Google Scholar",
        icon: "📚",
        displayName: "Google Scholar Profile",
      };
    } else if (url.includes("researchgate.net")) {
      return {
        type: "ResearchGate",
        icon: "🔬",
        displayName: "ResearchGate Profile",
      };
    } else if (url.includes("orcid.org")) {
      return { type: "ORCID", icon: "🆔", displayName: "ORCID Profile" };
    } else if (url.includes("academia.edu")) {
      return {
        type: "Academia.edu",
        icon: "🎓",
        displayName: "Academia.edu Profile",
      };
    } else if (
      url.includes(".edu") ||
      url.includes(".ac.") ||
      url.includes("university")
    ) {
      return {
        type: "Institutional",
        icon: "🏫",
        displayName: "Institutional Profile",
      };
    } else {
      return { type: "Other", icon: "🌐", displayName: "Academic Profile" };
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
      typeof t === "string"
        ? { display_name: t }
        : { display_name: t.display_name || t.name || "" }
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
        <div className="md:col-span-8 spae-y-4">
          {/* Researcher Info Card */}
          <div className="bg-white p-4 rounded-md shadow space-y-4 self-start relative">
            {/* Bookmark Icon */}
            <div className="absolute top-4 right-4 flex items-center space-x-2">
              <BookmarkIcon
                researcherId={researcher._id}
                researcherName={name}
                size={28}
                onBookmarkChange={(newStatus) => {
                  console.log("Bookmark status changed:", newStatus);
                }}
              />
            </div>

            {/* Top: Name + AI Contact Button inline */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-3">
                <h2 className="text-2xl font-semibold">{name}</h2>
                <Button
                  onClick={handleContactSearch}
                  disabled={contactLoading}
                  variant="outlined"
                  size="small"
                  startIcon={
                    contactLoading ? (
                      <CircularProgress size={16} />
                    ) : (
                      <SmartToyIcon />
                    )
                  }
                  endIcon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    background:
                      "linear-gradient(45deg, rgba(139, 69, 19, 0.08), rgba(255, 193, 7, 0.08))",
                    borderColor: "rgba(139, 69, 19, 0.4)",
                    color: "rgb(139, 69, 19)",
                    fontSize: "0.75rem",
                    padding: "4px 12px",
                    minWidth: "auto",
                    border: "2px solid",
                    borderImage:
                      "linear-gradient(45deg, rgba(139, 69, 19, 0.4), rgba(255, 193, 7, 0.4)) 1",
                    borderRadius: "12px",
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                      background:
                        "linear-gradient(45deg, rgba(139, 69, 19, 0.15), rgba(255, 193, 7, 0.15))",
                      borderColor: "rgba(139, 69, 19, 0.6)",
                      transform: "translateY(-2px) scale(1.05)",
                      boxShadow:
                        "0 8px 20px rgba(139, 69, 19, 0.3), 0 0 20px rgba(255, 193, 7, 0.4)",
                      animation: "none",
                    },
                    "&:active": {
                      transform: "translateY(0) scale(1.02)",
                    },
                    "& .MuiButton-startIcon": {
                      marginRight: "6px",
                    },
                    "& .MuiButton-endIcon": {
                      marginLeft: "6px",
                    },
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      top: 0,
                      left: "-100%",
                      width: "100%",
                      height: "100%",
                      background:
                        "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)",
                      transition: "left 0.6s",
                    },
                    "&:hover::before": {
                      left: "100%",
                    },
                  }}
                >
                  AI Contact Search
                </Button>
              </div>
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

            {/* Bottom: 2-column layout: Left = Affiliations, Right = Research Areas */}
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
                  <div className="mt-6">
                    <PaginationBar
                      currentPage={currentPage}
                      perPage={worksPerPage}
                      totalResults={totalWorks}
                      onGoToPage={(p) => handlePageChange(p)}
                      showFirstLast
                    />
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

      {/* Profile Links Dialog */}
      <Dialog
        open={contactDialogOpen}
        onClose={handleContactDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Contact Information</DialogTitle>
        <DialogContent>
          {/* AI Disclaimer */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <Typography
              variant="body2"
              sx={{
                color: "rgb(133, 77, 14)",
                display: "flex",
                alignItems: "center",
                fontSize: "0.875rem",
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 16, marginRight: 1 }} />
              AI can make mistakes. Check important info.
            </Typography>
          </div>

          {contactLoading ? (
            <div className="flex flex-col justify-center items-center py-8">
              <div className="relative mb-6">
                {/* Enhanced rotating AI brain/robot icon with glow */}
                <div
                  className="animate-spin"
                  style={{
                    animation: "spin-gentle 2s linear infinite",
                    filter: "drop-shadow(0 0 12px rgba(139, 69, 19, 0.4))",
                  }}
                >
                  <SmartToyIcon
                    sx={{
                      fontSize: 56,
                      color: "rgb(139, 69, 19)",
                      background:
                        "linear-gradient(45deg, rgb(139, 69, 19), rgb(184, 134, 11))",
                      backgroundClip: "text",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  />
                </div>

                {/* Orbiting sparkles with enhanced animations */}
                <div
                  className="absolute -top-3 -right-3"
                  style={{
                    animation:
                      "sparkle 1.5s ease-in-out infinite, ai-search-pulse 2s ease-in-out infinite",
                  }}
                >
                  <AutoAwesomeIcon
                    sx={{
                      fontSize: 18,
                      color: "rgb(255, 193, 7)",
                      filter: "drop-shadow(0 0 6px rgba(255, 193, 7, 0.8))",
                    }}
                  />
                </div>
                <div
                  className="absolute -bottom-3 -left-3"
                  style={{
                    animation:
                      "sparkle 1.5s ease-in-out infinite 0.5s, ai-search-pulse 2s ease-in-out infinite 0.5s",
                  }}
                >
                  <AutoAwesomeIcon
                    sx={{
                      fontSize: 16,
                      color: "rgb(255, 193, 7)",
                      filter: "drop-shadow(0 0 6px rgba(255, 193, 7, 0.8))",
                    }}
                  />
                </div>
                <div
                  className="absolute top-0 -left-4"
                  style={{
                    animation:
                      "sparkle 1.5s ease-in-out infinite 1s, ai-search-pulse 2s ease-in-out infinite 1s",
                  }}
                >
                  <AutoAwesomeIcon
                    sx={{
                      fontSize: 14,
                      color: "rgb(255, 193, 7)",
                      filter: "drop-shadow(0 0 6px rgba(255, 193, 7, 0.8))",
                    }}
                  />
                </div>
                <div
                  className="absolute -top-1 left-8"
                  style={{
                    animation:
                      "sparkle 1.5s ease-in-out infinite 1.5s, ai-search-pulse 2s ease-in-out infinite 1.5s",
                  }}
                >
                  <AutoAwesomeIcon
                    sx={{
                      fontSize: 12,
                      color: "rgb(255, 193, 7)",
                      filter: "drop-shadow(0 0 6px rgba(255, 193, 7, 0.8))",
                    }}
                  />
                </div>

                {/* Magic shimmer effect overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.5) 50%, transparent 70%)",
                    animation: "magic-shimmer 3s linear infinite",
                    borderRadius: "50%",
                  }}
                />
              </div>

              <Typography
                sx={{
                  color: "rgb(139, 69, 19)",
                  fontWeight: 600,
                  fontSize: "1.2rem",
                  background:
                    "linear-gradient(45deg, rgb(139, 69, 19), rgb(184, 134, 11))",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  textAlign: "center",
                  mb: 1,
                }}
              >
                🤖 AI is searching for contact information...
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  textAlign: "center",
                  fontStyle: "italic",
                  animation: "ai-search-pulse 2s ease-in-out infinite",
                }}
              >
                ✨ Analyzing academic databases and professional networks
              </Typography>
            </div>
          ) : contactError ? (
            <div className="text-center py-4">
              <Typography color="error" gutterBottom>
                Error: {contactError}
              </Typography>
              <Button
                onClick={handleContactSearch}
                variant="outlined"
                size="small"
              >
                Try Again
              </Button>
            </div>
          ) : contactInfo ? (
            <div className="space-y-4">
              {contactInfo.links && contactInfo.links.length > 0 ? (
                <>
                  {contactInfo.links.map((link, index) => {
                    const profileInfo = getProfileInfo(link);
                    return (
                      <div
                        key={index}
                        className="border-l-4 border-blue-500 pl-4 py-2"
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600, color: "text.primary" }}
                        >
                          {profileInfo.icon} {profileInfo.displayName}
                        </Typography>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          <Typography variant="body2">{link}</Typography>
                        </a>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-center py-4">
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ color: "text.primary" }}
                  >
                    🔍 No Profile Links Found
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    No academic or professional profile links were found for
                    this researcher.
                  </Typography>
                  <div className="mt-4">
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", mb: 1, mt: 2 }}
                    >
                      Try searching manually:
                    </Typography>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(
                        researcher?.basic_info?.name || ""
                      )} LinkedIn`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:underline"
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        🔍 Search "{researcher?.basic_info?.name}" on Google
                      </Typography>
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleContactDialogClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Footer />
    </div>
  );
}
