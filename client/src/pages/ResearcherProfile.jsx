import Footer from '../components/Footer';
import Header from '../components/Header';
// import { researcherSampleData, sampleWorks } from './seed';
import { BarChart } from '@mui/x-charts/BarChart';
import { Chip } from '@mui/material';

export default function ResearcherProfile() {
    const r = researcherSampleData;
    if (!r) return <p>No researcher was found.</p>;

    const {
        basic_info: { name, email, thumbnail, affiliations = [] } = {},
        identifiers: { orcid, google_scholar_id } = {},
        research_metrics: { h_index, i10_index, two_year_mean_citedness, total_citations, total_works } = {},
        research_areas: { fields = [], topics = [] } = {},
        works: workIDs = [],
        citation_trends: {
            cited_by_table: { citations = {}, h_index: h_idx = {}, i10_index: i10_idx = {} } = {},
            counts_by_year = [],
        } = {},
        current_affiliation: { institution: currentInst = {} } = {},
    } = r;

    const fullWorks = workIDs.map(id =>
        sampleWorks.find(w => w.workID === id)
    );

    const pastAffiliations = affiliations.filter(
        (aff) => aff.institution.display_name !== currentInst.display_name
    );


    const citationYears = counts_by_year.map(d => d.year).reverse();
    const citationCounts = counts_by_year.map(d => d.cited_by_count).reverse();

    const workYears = counts_by_year.map(d => d.year).reverse();
    const workCounts = counts_by_year.map(d => d.works_count).reverse();

    return (
        <div className="bg-gray-100 min-h-screen">
            <Header />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 mx-10">

                {/* LEFT Column (8 cols) */}
                <div className="md:col-span-8 space-y-4">
                    {/* Researcher Info Card */}
                    <div className="bg-white p-4 rounded-md shadow space-y-4 self-start">
                        {/* Top: Thumbnail + Name + Email */}
                        <div className="flex items-center space-x-4">
                            {thumbnail && (
                                <img
                                    src={thumbnail}
                                    alt={name}
                                    className="w-24 h-24 rounded-full shadow-md"
                                />
                            )}
                            <div>
                                <h2 className="text-xl font-semibold">{name}</h2>
                                <p className="text-sm text-gray-600">
                                    {email || "Email not available"}
                                </p>
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
                                            Yes
                                        </a>
                                    </p>
                                )}

                                <div>
                                    <h3 className="font-semibold text-gray-700">Current Affiliation</h3>
                                    <p className="text-sm">{currentInst.display_name || "N/A"}</p>
                                </div>

                                <div>
                                    <h3 className="font-semibold text-gray-700">Past Affiliations</h3>
                                    <ul className="list-disc list-inside text-sm text-gray-700">
                                        {pastAffiliations.map((aff, i) => (
                                            <li key={i}>{aff.institution.display_name}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Right column: Research Areas, with left border */}
                            <div className="space-y-4 border-t md:border-t-0 md:border-l md:pl-6 border-gray-300">
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
                            </div>
                        </div>

                    </div>

                    {/* Works List */}
                    <div className="bg-white p-4 rounded-md shadow">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-xl font-semibold">Top Works</h2>
                            {orcid && (
                                <a
                                    href={`https://orcid.org/${orcid}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
                                >
                                    View all works
                                </a>
                            )}
                        </div>

                        <ul className="space-y-4">
                            {fullWorks.map((w, idx) => {
                                const authorsList = w.authors.map(a => a.name);
                                const displayAuthors =
                                    authorsList.length > 2
                                        ? `${authorsList[0]}, ${authorsList[1]}, et al.`
                                        : authorsList.join(', ');

                                const pubYear = w.publication_date?.slice(0, 4);

                                return (
                                    <li key={idx} className="border-b pb-2">
                                        <a
                                            href={w.link}
                                            className="text-blue-600 font-medium hover:underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {w.title}
                                        </a>

                                        <div className="text-sm text-gray-600">
                                            {displayAuthors} &middot; {w.journal_name}
                                        </div>

                                        <div className="text-sm text-gray-700 flex space-x-8">
                                            {pubYear && <span className="italic text-gray-500">{pubYear}</span>}
                                            <span>
                                                <span className="font-semibold">Cited by:</span> {w.cited_by}
                                            </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                </div>

                {/* RIGHT Column (4 cols) */}
                <div className="md:col-span-4 space-y-4">
                    {/* Citation Summary */}
                    <div className="bg-white p-4 rounded-md shadow space-y-2">
                        <h2 className="text-xl font-semibold">Citation Summary</h2>

                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>Total Works: {total_works}</div>
                            <div>2-Yr Mean Citedness: {two_year_mean_citedness?.toFixed(2)}</div>
                        </div>

                        <table className="w-full text-sm text-left mt-2">
                            <thead>
                                <tr className="border-b">
                                    <th className="py-1 px-2">Metric</th>
                                    <th className="py-1 px-2">All</th>
                                    <th className="py-1 px-2">Since 2020</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="py-1 px-2">Citations</td>
                                    <td className="py-1 px-2">{citations.all}</td>
                                    <td className="py-1 px-2">{citations.since_2020}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 px-2">h-index</td>
                                    <td className="py-1 px-2">{h_idx.all}</td>
                                    <td className="py-1 px-2">{h_idx.since_2020}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 px-2">i10-index</td>
                                    <td className="py-1 px-2">{i10_idx.all}</td>
                                    <td className="py-1 px-2">{i10_idx.since_2020}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Works Per Year Chart */}
                    <div className="bg-white p-4 rounded-md shadow">
                        <h3 className="text-md font-semibold mb-2">Works Per Year</h3>
                        <BarChart
                            xAxis={[{ scaleType: 'band', data: workYears }]}
                            series={[{ data: workCounts, label: 'Works' }]}
                            height={300}
                        />
                    </div>

                    {/* Citations Per Year Chart */}
                    <div className="bg-white p-4 rounded-md shadow">
                        <h3 className="text-md font-semibold mb-2">Citations Per Year</h3>
                        <BarChart
                            xAxis={[{ scaleType: 'band', data: citationYears }]}
                            series={[{ data: citationCounts, label: 'Citations' }]}
                            height={300}
                        />
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}
