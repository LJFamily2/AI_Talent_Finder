import { useEffect, useState, useRef } from "react";
import ResearcherSection from "../components/ResearcherSection";
import {
  Pagination,
  FormControl,
  FormGroup,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  Button,
  Snackbar,
  Alert,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import Header from "../components/Header";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { io } from "socket.io-client";
import SimplePDFViewer from "../components/SimplePDFViewer";
import api from "../config/api";
// import { sampleResearcher } from './seed';      // sample researcher data

export default function CVVerification() {
  const [sortOrder, setSortOrder] = useState("Newest");

  const [inputStartYear, setInputStartYear] = useState("");
  const [inputEndYear, setInputEndYear] = useState("");
  const [filterStartYear, setFilterStartYear] = useState("");
  const [filterEndYear, setFilterEndYear] = useState("");
  const [yearFilterActive, setYearFilterActive] = useState(false);

  const invalidTypeKeywords = [
    "unable to verify",
    "not specified",
    "unverified",
  ];
  const [selectedTypes, setSelectedTypes] = useState([]);

  const [filterStatus, setFilterStatus] = useState("All");

  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // PDF viewing state
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const pdfObjectUrlRef = useRef(null);
  const [jobRecord, setJobRecord] = useState(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError, setJobError] = useState(null);
  const socketRef = useRef(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastSeverity, setToastSeverity] = useState("info");

  // Navigation and state logic
  const location = useLocation();
  const navigate = useNavigate();
  const { jobId } = useParams();

  const transientPublications = location.state?.publications;
  const originalFile = location.state?.originalFile;

  const closePdfModal = () => {
    setShowPDFModal(false);
    setPdfError(null);
    setPdfLoading(false);
    setPdfBlobUrl(null);
    if (pdfObjectUrlRef.current) {
      URL.revokeObjectURL(pdfObjectUrlRef.current);
      pdfObjectUrlRef.current = null;
    }
  };

  const loadPdfForJob = async () => {
    if (!jobId || pdfLoading) return;

    setPdfError(null);
    setPdfLoading(true);

    try {
      const response = await api.get(`/api/cv/batch-jobs/${jobId}/pdf`);

      const url = response.data.url;
      if (!url) {
        throw new Error("No PDF URL returned from server.");
      }

      setPdfBlobUrl(url);
    } catch (error) {
      setPdfError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Unable to load the PDF.",
      );
    } finally {
      setPdfLoading(false);
    }
  };

  const openPdfModal = () => {
    setShowPDFModal(true);
    if (!originalFile) {
      void loadPdfForJob();
    }
  };

  useEffect(() => {
    if (!jobId || transientPublications) {
      setJobRecord(null);
      setJobLoading(false);
      setJobError(null);
      return;
    }

    let active = true;
    let poller = null;

    const loadJob = async () => {
      setJobLoading(true);
      try {
        const response = await api.get(`/api/cv/batch-jobs/${jobId}`);
        if (!active) return;

        const record = response.data.data || null;
        setJobRecord(record);
        setJobError(null);

        if (
          record &&
          (record.status === "completed" || record.status === "failed")
        ) {
          setJobLoading(false);
          if (poller) {
            clearInterval(poller);
            poller = null;
          }
        }
      } catch (error) {
        if (!active) return;
        setJobError(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Unable to load this verification job.",
        );
        setJobLoading(false);
        if (poller) {
          clearInterval(poller);
          poller = null;
        }
      }
    };

    loadJob();
    poller = setInterval(loadJob, 4000);

    return () => {
      active = false;
      if (poller) {
        clearInterval(poller);
      }
    };
  }, [jobId, transientPublications]);

  // Socket: join job room to receive real-time updates when viewing a saved job
  useEffect(() => {
    if (!jobId || transientPublications) return;

    // Connect socket if not connected
    if (!socketRef.current) {
      const backendUrl =
        import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
      socketRef.current = io(backendUrl, { withCredentials: true });
    }

    const socket = socketRef.current;

    const onJoined = (data) => {
      setToastMessage(`Connected to job ${data.jobId.substring(0, 8)}...`);
      setToastSeverity("success");
      setToastOpen(true);
    };

    const onProgress = (data) => {
      setJobRecord((prev) => ({
        ...(prev || {}),
        progress: data.progress ?? prev?.progress ?? 0,
        stage: data.step ?? prev?.stage,
      }));
      setJobLoading(false);
      setToastMessage(`Progress: ${data.progress}% - ${data.step}`);
      setToastSeverity("info");
      setToastOpen(true);
    };

    const onComplete = (payload) => {
      const result = payload?.result || payload;
      setJobRecord((prev) => ({
        ...(prev || {}),
        result: result || prev?.result || null,
        status: result?.success === false ? "failed" : "completed",
        progress: 100,
        stage: "done",
      }));
      if (result && result.success === false) {
        setJobError(result.error || "Verification failed");
        setToastMessage(`Verification complete: ${result.error || "Failed"}`);
        setToastSeverity("error");
      } else {
        setJobError(null);
        setToastMessage("Verification completed successfully!");
        setToastSeverity("success");
      }
      setToastOpen(true);
      setJobLoading(false);
    };

    const onError = (data) => {
      const errorMsg = data?.error || data || "An error occurred";
      setJobError(errorMsg);
      setToastMessage(`Error: ${errorMsg}`);
      setToastSeverity("error");
      setToastOpen(true);
      setJobLoading(false);
    };

    socket.on("joined", onJoined);
    socket.on("progress", onProgress);
    socket.on("complete", onComplete);
    socket.on("error", onError);

    socket.emit("joinJob", jobId);

    return () => {
      if (!socket) return;
      socket.off("joined", onJoined);
      socket.off("progress", onProgress);
      socket.off("complete", onComplete);
      socket.off("error", onError);
    };
  }, [jobId, transientPublications]);

  const publications = transientPublications || jobRecord?.result || null;

  // If the verification completed but returned a failure payload, show a clear
  // announcement to the user and allow returning to the publication check.
  if (publications && publications.success === false) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-red-600">
              Publication Check
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Verification failed
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              {publications.error ||
                "An unknown error occurred during verification."}
            </p>
            <div className="mt-4">
              <button
                className="mr-3 rounded-full bg-[#000054] px-5 py-2.5 text-sm font-semibold text-white"
                onClick={() => navigate("/publication-check")}
              >
                Back to publication check
              </button>
              {publications.retryable ? (
                <button
                  className="rounded-full bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white"
                  onClick={() => navigate("/publication-check")}
                >
                  Try again
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (jobId && jobLoading && !jobRecord && !jobError) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Publication Check
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Loading your saved verification job
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              This job is running in the background and will update here as soon
              as the results are ready.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (jobId && jobError) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-red-600">
              Publication Check
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Unable to load this job
            </h2>
            <p className="mt-3 text-sm text-slate-600">{jobError}</p>
            <button
              className="mt-5 rounded-full bg-[#000054] px-5 py-2.5 text-sm font-semibold text-white"
              onClick={() => navigate("/publication-check")}
            >
              Back to publication check
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (jobId && jobRecord && jobRecord.status === "completed" && !publications) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
              Publication Check
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              No saved verification results were found
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              This job completed, but the saved result payload is missing or
              could not be loaded.
            </p>
            <button
              className="mt-5 rounded-full bg-[#000054] px-5 py-2.5 text-sm font-semibold text-white"
              onClick={() => navigate("/publication-check")}
            >
              Back to publication check
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!jobId && !publications) {
    return <Navigate to="/publication-check" replace />;
  }

  const allDisplayData = Array.isArray(publications?.results)
    ? publications.results.map((r) => r.verification.displayData)
    : [];

  // Helper: normalize and pretty-print publication type
  const formatType = (t) => {
    if (!t) return "";
    // Replace underscores/hyphens with spaces, lowercase, collapse spaces
    const cleaned = String(t)
      .replace(/[-_]+/g, " ")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
    // Sentence case: capitalize only the first character
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };
  const researcherData = publications?.authorDetails;

  // Type Selection - Handle toggle
  const handleTypeChange = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
    setPage(1);
  };

  // Type Selection - Reset button
  const handleResetTypes = () => {
    setSelectedTypes([]);
    setPage(1);
  };

  // Type Selection - Get the valid types
  // Build list of valid unique types (case-insensitive)
  const validTypes = (() => {
    const map = new Map(); // key: lowercased type -> original raw type
    for (const pub of allDisplayData) {
      const raw = (pub.type || "").trim();
      if (!raw) continue;
      const lower = raw.toLowerCase();
      if (invalidTypeKeywords.some((k) => lower.includes(k))) continue;
      if (!map.has(lower)) map.set(lower, raw);
    }
    return Array.from(map.values());
  })();

  const filtered = allDisplayData
    .filter((pub) => {
      if (filterStatus === "All") return true;
      const statusLC = String(pub.status || "").toLowerCase();
      if (filterStatus === "verified") return statusLC.startsWith("verified");
      if (filterStatus === "not verified")
        return statusLC.startsWith("not verified");
      return (pub.status || "") === filterStatus;
    })
    .filter((pub) => {
      if (selectedTypes.length === 0) return true;
      const selectedLC = selectedTypes.map((t) => String(t).toLowerCase());
      const pt = (pub.type || "").toLowerCase();
      return selectedLC.includes(pt);
    })
    .filter((pub) => {
      if (!yearFilterActive) return true;

      const year = parseInt(pub.year);
      const start = parseInt(filterStartYear);
      const end = parseInt(filterEndYear);

      if (!isNaN(start) && !isNaN(end)) return year >= start && year <= end;
      if (!isNaN(start)) return year >= start;
      if (!isNaN(end)) return year <= end;

      return true;
    })
    .sort((a, b) =>
      sortOrder === "Newest"
        ? b.year.localeCompare(a.year)
        : a.year.localeCompare(b.year),
    );

  const paginated = filtered.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  return (
    <div className="bg-gray-100">
      <Header />
      <div className="grid grid-cols-1 md:grid-cols-12 p-4 min-h-screen">
        {/* Filters */}
        <div className="md:col-span-2 p-4 h-fit border-r border-gray-300 ">
          {/* <h2 className="text-lg font-semibold mb-5">Filters</h2> */}
          <div>
            {/* Sort By Date */}
            <div className="mb-5">
              <FormControl component="fieldset">
                <FormLabel
                  component="legend"
                  sx={{ fontSize: 14, fontWeight: 500 }}
                >
                  Sort By
                </FormLabel>
                <RadioGroup
                  row
                  value={sortOrder}
                  onChange={(e) => {
                    setSortOrder(e.target.value);
                    setPage(1);
                  }}
                >
                  <FormControlLabel
                    value="Newest"
                    control={<Radio size="small" />}
                    sx={{ mb: 1 }}
                    slotProps={{
                      typography: {
                        fontSize: 14,
                      },
                    }}
                    label="Newest"
                  />
                  <FormControlLabel
                    value="Oldest"
                    control={<Radio size="small" />}
                    sx={{ mb: 1 }}
                    slotProps={{
                      typography: {
                        fontSize: 14,
                      },
                    }}
                    label="Oldest"
                  />
                </RadioGroup>
              </FormControl>
            </div>

            {/* Year Range */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-2">
                <FormLabel
                  component="legend"
                  sx={{ fontSize: 14, fontWeight: 500 }}
                >
                  Year Range
                </FormLabel>
                <button
                  className="text-xs bg-gray-300 px-3 py-1 rounded hover:bg-gray-400 hover:cursor-pointer"
                  onClick={() => {
                    setInputStartYear("");
                    setInputEndYear("");
                    setFilterStartYear("");
                    setFilterEndYear("");
                    setYearFilterActive(false);
                    setPage(1);
                  }}
                >
                  Any time
                </button>
              </div>

              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  placeholder="Start"
                  value={inputStartYear}
                  onChange={(e) => setInputStartYear(e.target.value)}
                  className="w-full border px-2 py-1 rounded text-sm"
                />
                <span className="flex items-center">-</span>
                <input
                  type="number"
                  placeholder="End"
                  value={inputEndYear}
                  onChange={(e) => setInputEndYear(e.target.value)}
                  className="w-full border px-2 py-1 rounded text-sm"
                />
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  className="text-sm bg-blue-400 text-white px-3 py-1 w-full rounded hover:bg-blue-500 hover:cursor-pointer"
                  onClick={() => {
                    let start = parseInt(inputStartYear);
                    let end = parseInt(inputEndYear);

                    // Swap if needed
                    if (!isNaN(start) && !isNaN(end) && start > end) {
                      [start, end] = [end, start];
                    }

                    // Update filter values and display values
                    const startStr = start ? start.toString() : "";
                    const endStr = end ? end.toString() : "";

                    setFilterStartYear(startStr);
                    setFilterEndYear(endStr);
                    setInputStartYear(startStr);
                    setInputEndYear(endStr);
                    setYearFilterActive(true);
                    setPage(1);
                  }}
                >
                  Search
                </button>
              </div>
            </div>

            {/* Type Selection */}
            <div className="mb-10">
              {/* Full-width flex container for label + reset */}
              <div className="flex items-center justify-between mb-2">
                <FormLabel
                  component="legend"
                  sx={{ fontSize: 14, fontWeight: 500 }}
                >
                  Type
                </FormLabel>
                <button
                  onClick={handleResetTypes}
                  className="text-xs bg-gray-300 px-3 py-1 rounded hover:bg-gray-400 hover:cursor-pointer"
                >
                  Reset
                </button>
              </div>

              {/* Actual form control content */}
              <FormControl component="fieldset" sx={{ width: "100%" }}>
                <FormGroup>
                  {validTypes.map((type) => (
                    <FormControlLabel
                      key={type}
                      control={
                        <Checkbox
                          size="small"
                          checked={selectedTypes.includes(type)}
                          onChange={() => handleTypeChange(type)}
                        />
                      }
                      label={formatType(type)}
                      slotProps={{
                        typography: {
                          fontSize: 13,
                        },
                      }}
                    />
                  ))}
                </FormGroup>
              </FormControl>
            </div>

            {/* Status Selection */}
            <div>
              <FormControl component="fieldset">
                <FormLabel
                  component="legend"
                  sx={{ fontSize: 14, fontWeight: 500, mb: 1 }}
                >
                  Status
                </FormLabel>
                <RadioGroup
                  row
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <FormControlLabel
                    value="All"
                    control={<Radio size="small" />}
                    label="All"
                    slotProps={{ typography: { fontSize: 13 } }}
                  />
                  <FormControlLabel
                    value="verified"
                    control={<Radio size="small" />}
                    label="Verified"
                    slotProps={{ typography: { fontSize: 13 } }}
                  />
                  <FormControlLabel
                    value="not verified"
                    control={<Radio size="small" />}
                    label="Not Verified"
                    slotProps={{ typography: { fontSize: 13 } }}
                  />
                </RadioGroup>
              </FormControl>
            </div>
          </div>
        </div>

        {/* Publications */}
        <div className="md:col-span-7 p-4">
          <h2 className="text-xl font-bold pl-4">Publications</h2>
          <p className="text-md text-gray-500 mb-4 pl-4">
            Found {filtered.length}{" "}
            {filtered.length <= 1 ? "result" : "results"}
          </p>
          <div className="flex justify-between items-center my-3">
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={openPdfModal}
              size="small"
              sx={{ ml: 2 }}
            >
              View PDF
            </Button>
            <Pagination
              count={Math.ceil(filtered.length / itemsPerPage)}
              page={page}
              onChange={(_, value) => setPage(value)}
              shape="rounded"
            />
          </div>
          {paginated.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              No results were found that fit the filters.
            </div>
          ) : (
            paginated.map((pub, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-10 mb-2 p-4 h-fit bg-white rounded-md shadow"
              >
                <div className="md:col-span-9">
                  <h3 className="text-md font-light mb-5">{pub.publication}</h3>

                  {String(pub.status || "")
                    .toLowerCase()
                    .startsWith("verified") && (
                    <>
                      <div className="mb-2 text-sm text-gray-700">
                        <span className="font-semibold">Title:</span>{" "}
                        <span>{pub.title}</span>
                      </div>

                      <div className="flex flex-wrap gap-10 text-sm text-gray-700">
                        <div className="block md:max-w-[200px] truncate">
                          <span className="font-semibold">Author:</span>{" "}
                          <span title={pub.author}>{pub.author}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Published Year:</span>{" "}
                          <span>{pub.year}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Type:</span>{" "}
                          <span>{formatType(pub.type)}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Cited By:</span>{" "}
                          <span>{pub.citedBy}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="md:col-span-1 md:ml-auto">
                  {String(pub.status || "")
                    .toLowerCase()
                    .startsWith("verified") ? (
                    <p className="md:text-center">
                      <CheckCircleOutlinedIcon color="success" />
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 md:text-right">
                      {pub.status}
                    </p>
                  )}
                  {pub.link && (
                    <a
                      href={pub.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-1 text-xs text-blue-600 underline hover:text-blue-800 md:text-center md:mt-2"
                    >
                      View Source
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Researcher Profile */}
        <aside className="md:col-span-3">
          <ResearcherSection researcherData={researcherData} />
        </aside>
      </div>

      {/* PDF Viewing Modal */}
      {showPDFModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-6xl bg-white rounded-lg shadow-lg overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">
                Uploaded CV
              </h3>
              <button
                onClick={closePdfModal}
                className="text-gray-500 hover:text-gray-700 text-xl font-semibold px-2"
              >
                ×
              </button>
            </div>

            {/* PDF Content */}
            <div className="h-[80vh] p-4">
              {originalFile ? (
                <SimplePDFViewer file={originalFile} className="h-full" />
              ) : pdfLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-600">Loading PDF...</p>
                </div>
              ) : pdfBlobUrl ? (
                <SimplePDFViewer file={pdfBlobUrl} className="h-full" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-gray-600 mb-4">No PDF file available</p>
                    {pdfError ? (
                      <p className="text-sm text-red-600">{pdfError}</p>
                    ) : null}
                    <p className="text-sm text-gray-500">
                      Debug: originalFile = {JSON.stringify(originalFile)}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Available location.state keys:{" "}
                      {Object.keys(location.state || {}).join(", ")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToastOpen(false)}
          severity={toastSeverity}
          sx={{ width: "100%" }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </div>
  );
}
