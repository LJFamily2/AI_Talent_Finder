import { Avatar, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";
import { BarChart } from "@mui/x-charts";

export default function ResearcherSection({ researcherData }) {

    if (!researcherData || !researcherData.author.name) {
        return (
            <div className="bg-white p-4 rounded-md sticky top-4 flex flex-col items-center justify-center min-h-[200px]">
                <p className="text-gray-500">No Researcher profile found.</p>
            </div>
        );
    }

    const researcher = researcherData.author;

    // set up table
    const statsTable = researcherData.metrics || [];

    function createData(name, all) {
        return { name, all };
    }

    const rows = [
        createData('Citations', statsTable.citationCount),
        createData('h-index', statsTable.h_index),
        createData('i10-index', statsTable.i10_index),
    ];

    // set up graph
    const statsGraph = researcherData.metrics.citations || [];
    const dataMap = new Map();
    statsGraph.forEach(d => dataMap.set(d.year, Number(d.cited_by_count)));

    const latestYear = Math.max(...statsGraph.map(d => d.year));
    const fullYears = Array.from({ length: 8 }, (_, i) => latestYear - 7 + i);

    const years = fullYears.map(year => year.toString());
    const citations = fullYears.map(year => dataMap.get(year) || 0);

    return (
        <div className="bg-white p-4 rounded-md sticky top-4 flex flex-col gap-2">
            <div className="flex items-center gap-5">
                <Avatar
                    alt="Scholar Avatar"
                    src={researcher.thumbnail}
                    sx={{ width: 80, height: 80 }}
                />
                <div>
                    <p className="font-bold text-lg">{researcher.name}</p>
                    <p className="text-sm text-gray-600">{researcher.affiliationHistory[0]?.name}</p>
                </div>
            </div>
            <div className="mt-4">
                <h3 className="font-semibold text-md mb-2">
                    Expertise
                </h3>
                <div className="flex flex-wrap gap-2">
                    {researcherData.expertises.map((interest, index) => (
                        <Chip key={index} label={interest} color="primary" variant="outlined" size="small" />
                    ))}
                </div>
            </div>

            <div className="mt-4 md:w-full">
                <h3 className="font-semibold text-md mb-2">
                    Citation Metrics
                </h3>
                <div className="mb-2">
                    <TableContainer component={Paper}>
                        <Table size="small" aria-label="a dense table">
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow
                                        key={row.name}
                                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                    >
                                        <TableCell component="th" scope="row" sx={{ fontSize: 13 }}>
                                            {row.name}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontSize: 13 }}>{row.all}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>

                <div>
                    <h3 className="font-semilight text-sm text-gray-500">
                        Citations per Year
                    </h3>
                    <BarChart
                        xAxis={[{ scaleType: 'band', data: years }]}
                        series={[{ data: citations, color: '#1a73e8' }]}
                        height={230}
                    />
                </div>
            </div>

        </div>
    )
}
