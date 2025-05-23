import { sampleResearcher } from "../pages/seed"
import { Avatar, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts";

export default function ResearcherProfile() {

    const researcher = sampleResearcher.author;

    // set up table
    const statsTable = sampleResearcher.cited_by.table;

    function createData(name, all, since2020) {
        return { name, all, since2020 };
    }

    const rows = [
        createData('Citations', statsTable[0].citations?.all, statsTable[0].citations?.depuis_2016),
        createData('h-index', statsTable[1].indice_h?.all, statsTable[1].indice_h?.depuis_2016),
        createData('i10-index', statsTable[2].indice_i10?.all, statsTable[2].indice_i10?.depuis_2016),
    ];

    // set up graph
    const statsGraph = sampleResearcher.cited_by.graph;
    const dataMap = new Map();
    statsGraph.forEach(d => dataMap.set(d.year, Number(d.citations)));

    const latestYear = Math.max(...statsGraph.map(d => d.year));
    const fullYears = Array.from({ length: 8 }, (_, i) => latestYear - 7 + i);

    const years = fullYears.map(year => year.toString());
    const citations = fullYears.map(year => dataMap.get(year) || 0);

    return (
        <div className="bg-white p-4 rounded-md sticky top-4 flex flex-col items-center">
            <h2 className="text-lg font-bold mb-4">Researcher Profile</h2>
            <Avatar
                alt="Scholar Avatar"
                src={researcher.thumbnail}
                sx={{ width: 100, height: 100, marginBottom: 2 }}
            />
            <p className="font-bold">{researcher.name}</p>
            <p className="text-center">{researcher.affiliations}</p>
            <div className="mt-4">
                <h3 className="font-semibold text-lg mb-2">
                    Expertise
                </h3>
                <div className="flex flex-wrap gap-2">
                    {researcher.interests.map((interest, index) => (
                        <Chip key={index} label={interest.title} color="primary" variant="outlined" />
                    ))}
                </div>
            </div>

            <div className="mt-8 md:w-full">
                <h3 className="font-semibold text-lg mb-2">
                    Cited By
                </h3>
                <div className="mb-2">
                    <TableContainer component={Paper}>
                        <Table size="small" aria-label="a dense table">
                            <TableHead>
                                <TableRow>
                                    <TableCell></TableCell>
                                    <TableCell align="right">All</TableCell>
                                    <TableCell align="right">Since 2020</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow
                                        key={row.name}
                                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                    >
                                        <TableCell component="th" scope="row">
                                            {row.name}
                                        </TableCell>
                                        <TableCell align="right">{row.all}</TableCell>
                                        <TableCell align="right">{row.since2020}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>

                <div>
                    {/* <Box className="bg-white shadow rounded"> */}
                    <Typography variant="subtitle1" gutterBottom>
                        Citations per Year
                    </Typography>
                    <BarChart
                        xAxis={[{ scaleType: 'band', data: years }]}
                        series={[{ data: citations, color: '#1a73e8' }]}
                        height={250}
                    />
                    {/* </Box> */}
                </div>
            </div>

        </div>
    )
}
