import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import api from "../config/api";

function formatNumber(value) {
  if (value === null || value === undefined) return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  return number.toLocaleString();
}

function renderTopTypes(topTypes) {
  if (!Array.isArray(topTypes) || topTypes.length === 0) {
    return <span className="text-xs text-slate-400">No data</span>;
  }

  return (
    <ul className="text-xs text-slate-600 space-y-1">
      {topTypes.map((item) => (
        <li key={item.type} className="flex justify-between gap-2">
          <span className="truncate">{item.type}</span>
          <span className="text-slate-500">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

function renderYearlyTrend(yearlyTrend) {
  if (!Array.isArray(yearlyTrend) || yearlyTrend.length === 0) {
    return <span className="text-xs text-slate-400">No data</span>;
  }

  const recent = yearlyTrend.slice(-8);

  return (
    <div className="flex flex-wrap gap-2">
      {recent.map((item) => (
        <span
          key={item.year}
          className="rounded-none bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
        >
          {item.year}: {item.count}
        </span>
      ))}
    </div>
  );
}

export default function CVCompare() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [missingIds, setMissingIds] = useState([]);

  const ids = useMemo(() => {
    const raw = searchParams.get("ids") || "";
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }, [searchParams]);

  useEffect(() => {
    if (ids.length === 0) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get("/api/cv/batch-jobs/compare", {
          params: { ids: ids.join(",") },
        });
        setSummaries(response.data.data || []);
        setMissingIds(response.data.missingIds || []);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Unable to load comparison",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [ids]);

  const gridClass =
    summaries.length === 3
      ? "md:grid-cols-3"
      : summaries.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-1";

  if (ids.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-slate-800">No CVs selected</h2>
          <p className="mt-3 text-sm text-slate-500">
            Go back and select up to three completed verification jobs to
            compare.
          </p>
          <button
            type="button"
            className="mt-6 rounded-none bg-[#000054] px-5 py-2.5 text-sm font-semibold text-white"
            onClick={() => navigate("/publication-check")}
          >
            Back to publication check
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              CV Comparison
            </p>
            <h2 className="text-2xl font-bold text-slate-800">
              Compare CV verification results
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Side-by-side metrics for selected CVs.
            </p>
          </div>
          <button
            type="button"
            className="rounded-none border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
            onClick={() => navigate("/publication-check")}
          >
            Back to publication check
          </button>
        </div>

        {missingIds.length > 0 && (
          <div className="mt-4 rounded-none border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            Some jobs could not be loaded: {missingIds.join(", ")}
          </div>
        )}

        {loading ? (
          <div className="mt-10 rounded-none border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading comparison data...
          </div>
        ) : error ? (
          <div className="mt-10 rounded-none border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-600">
            {error}
          </div>
        ) : (
          <div className={`mt-8 grid gap-6 ${gridClass}`}>
            {summaries.map((summary) => (
              <div
                key={summary.jobId}
                className="flex h-full flex-col rounded-none border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="text-sm font-bold text-slate-800 truncate"
                      title={summary.originalFileName}
                    >
                      {summary.originalFileName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {summary.candidateName || summary.authorName || "—"}
                    </p>
                  </div>
                  <span className="rounded-none bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
                    {summary.status}
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Total publications</span>
                    <span className="font-semibold text-slate-800">
                      {formatNumber(summary.totals?.publications)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Verified</span>
                    <span className="font-semibold text-emerald-600">
                      {formatNumber(summary.totals?.verified)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">
                      Verified (diff. author)
                    </span>
                    <span className="font-semibold text-amber-600">
                      {formatNumber(summary.totals?.verifiedDifferentAuthor)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Not verified</span>
                    <span className="font-semibold text-rose-600">
                      {formatNumber(summary.totals?.notVerified)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Total citations</span>
                    <span className="font-semibold text-slate-800">
                      {formatNumber(summary.citations?.total)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Author metrics
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div className="rounded-none bg-slate-50 px-3 py-2">
                      H-index
                      <div className="text-sm font-semibold text-slate-800">
                        {formatNumber(summary.authorMetrics?.h_index)}
                      </div>
                    </div>
                    <div className="rounded-none bg-slate-50 px-3 py-2">
                      i10-index
                      <div className="text-sm font-semibold text-slate-800">
                        {formatNumber(summary.authorMetrics?.i10_index)}
                      </div>
                    </div>
                    <div className="rounded-none bg-slate-50 px-3 py-2">
                      Documents
                      <div className="text-sm font-semibold text-slate-800">
                        {formatNumber(summary.authorMetrics?.documentCount)}
                      </div>
                    </div>
                    <div className="rounded-none bg-slate-50 px-3 py-2">
                      Citations
                      <div className="text-sm font-semibold text-slate-800">
                        {formatNumber(summary.authorMetrics?.citationCount)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Top types
                  </p>
                  <div className="mt-2">{renderTopTypes(summary.topTypes)}</div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Recent yearly trend
                  </p>
                  <div className="mt-2">
                    {renderYearlyTrend(summary.yearlyTrend)}
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-6 w-full rounded-none bg-[#000054] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#000066]"
                  onClick={() =>
                    navigate(`/publication-check/results/${summary.jobId}`)
                  }
                >
                  View results
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
