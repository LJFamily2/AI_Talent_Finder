import { useState } from 'react'
import ResearcherSection from "../components/ResearcherSection";
import { Pagination, FormControl, FormGroup, FormLabel, RadioGroup, FormControlLabel, Radio, Checkbox, Button } from "@mui/material";
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import Header from '../components/Header';
import { useLocation, useNavigate } from 'react-router-dom';
// import { sampleResearcher } from './seed';      // sample researcher data

export default function CVVerification() {

    const [sortOrder, setSortOrder] = useState('Newest')

    const [inputStartYear, setInputStartYear] = useState('');
    const [inputEndYear, setInputEndYear] = useState('');
    const [filterStartYear, setFilterStartYear] = useState('');
    const [filterEndYear, setFilterEndYear] = useState('');
    const [yearFilterActive, setYearFilterActive] = useState(false);

    const invalidTypeKeywords = ["unable to verify", "not specified", "unverified"];
    const [selectedTypes, setSelectedTypes] = useState([]);

    const [filterStatus, setFilterStatus] = useState('All')

    const [page, setPage] = useState(1)
    const itemsPerPage = 3

    // Navigation and state logic
    const location = useLocation();
    const navigate = useNavigate();

    const publications = location.state?.publications;

    if (!publications) {
        navigate("/upload-cv");
        return null;
    } else {
        console.log(publications);
    }

    const allDisplayData = publications.results.map(r => r.verification.displayData);
    const researcherData = publications.authorDetails;

    // Type Selection - Handle toggle
    const handleTypeChange = (type) => {
        setSelectedTypes((prev) =>
            prev.includes(type)
                ? prev.filter((t) => t !== type)
                : [...prev, type]
        );
        setPage(1);
    };

    // Type Selection - Reset button
    const handleResetTypes = () => {
        setSelectedTypes([]);
        setPage(1);
    };

    // Type Selection - Get the valid types
    const validTypes = Array.from(
        new Set(
            allDisplayData
                .map(pub => pub.type?.trim()) // ensure it's a string
                .filter(type =>
                    type &&
                    !invalidTypeKeywords.some(keyword =>
                        type.toLowerCase().includes(keyword)
                    )
                )
        )
    );


    const filtered = allDisplayData
        .filter(pub => {
            if (filterStatus === 'All') return true;
            return pub.status === filterStatus;
        })
        .filter(pub => selectedTypes.length === 0 || selectedTypes.includes(pub.type))
        .filter(pub => {
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
            sortOrder === 'Newest'
                ? b.year.localeCompare(a.year)
                : a.year.localeCompare(b.year)
        )

    const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage)

    return (
        <div className='bg-gray-100'>
            <Header />
            <div className="grid grid-cols-1 md:grid-cols-12 p-4 min-h-screen">
                {/* Filters */}
                <div className="md:col-span-2 p-4 h-fit border-r border-gray-300 ">
                    {/* <h2 className="text-lg font-semibold mb-5">Filters</h2> */}
                    <div>
                        {/* Sort By Date */}
                        <div className="mb-5">
                            <FormControl component="fieldset">
                                <FormLabel component="legend" sx={{ fontSize: 14, fontWeight: 500 }}>Sort By</FormLabel>
                                <RadioGroup
                                    row
                                    value={sortOrder}
                                    onChange={(e) => {
                                        setSortOrder(e.target.value);
                                        setPage(1);
                                    }}
                                >
                                    <FormControlLabel value="Newest" control={<Radio size="small" />} sx={{ mb: 1 }} slotProps={{
                                        typography: {
                                            fontSize: 14,
                                        },
                                    }} label="Newest" />
                                    <FormControlLabel value="Oldest" control={<Radio size="small" />} sx={{ mb: 1 }} slotProps={{
                                        typography: {
                                            fontSize: 14,
                                        },
                                    }} label="Oldest" />
                                </RadioGroup>
                            </FormControl>
                        </div>

                        {/* Year Range */}
                        <div className='mb-10'>
                            <div className="flex items-center justify-between mb-2">
                                <FormLabel component="legend" sx={{ fontSize: 14, fontWeight: 500 }}>
                                    Year Range
                                </FormLabel>
                                <button
                                    className="text-xs bg-gray-300 px-3 py-1 rounded hover:bg-gray-400 hover:cursor-pointer"
                                    onClick={() => {
                                        setInputStartYear('');
                                        setInputEndYear('');
                                        setFilterStartYear('');
                                        setFilterEndYear('');
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
                                    onChange={e => setInputStartYear(e.target.value)}
                                    className="w-full border px-2 py-1 rounded text-sm"
                                />
                                <span className='flex items-center'>-</span>
                                <input
                                    type="number"
                                    placeholder="End"
                                    value={inputEndYear}
                                    onChange={e => setInputEndYear(e.target.value)}
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
                                        const startStr = start ? start.toString() : '';
                                        const endStr = end ? end.toString() : '';

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
                                <FormLabel component="legend" sx={{ fontSize: 14, fontWeight: 500 }}>
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
                            <FormControl component="fieldset" sx={{ width: '100%' }}>
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
                                            label={type}
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
                                <FormLabel component="legend" sx={{ fontSize: 14, fontWeight: 500, mb: 1 }}>
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
                    <p className="text-md text-gray-500 mb-4 pl-4">Found {filtered.length} {filtered.length <= 1 ? "result" : "results"}</p>
                    <div className="flex justify-end my-3">
                        <Pagination
                            count={Math.ceil(filtered.length / itemsPerPage)}
                            page={page}
                            onChange={(_, value) => setPage(value)}
                            shape='rounded'
                        />
                    </div>
                    {paginated.length === 0 ? (
                        <div className="text-center text-gray-500 mt-10">
                            No results were found that fit the filters.
                        </div>
                    ) : (
                        paginated.map((pub, idx) => (
                            <div key={idx} className="grid grid-cols-1 md:grid-cols-10 mb-2 p-4 h-fit bg-white rounded-md shadow">
                                <div className="md:col-span-9">
                                    <h3 className="text-md font-light mb-5">{pub.publication}</h3>

                                    {pub.status === 'verified' && (
                                        <>
                                            <div className="mb-2 text-sm text-gray-700">
                                                <span className="font-semibold">Title:</span>{' '}
                                                <span>{pub.title}</span>
                                            </div>

                                            <div className="flex flex-wrap gap-10 text-sm text-gray-700">
                                                <div className="block md:max-w-[200px] truncate">
                                                    <span className="font-semibold">Author:</span>{' '}
                                                    <span title={pub.author}>{pub.author}</span>
                                                </div>
                                                <div>
                                                    <span className="font-semibold">Published Year:</span>{' '}
                                                    <span>{pub.year}</span>
                                                </div>
                                                <div>
                                                    <span className="font-semibold">Type:</span>{' '}
                                                    <span>{pub.type}</span>
                                                </div>
                                                <div>
                                                    <span className="font-semibold">Cited By:</span>{' '}
                                                    <span>{pub.citedBy}</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className='md:col-span-1 md:ml-auto'>
                                    {pub.status === 'verified' ? (
                                        <>
                                            <p className='md:text-center'><CheckCircleOutlinedIcon color='success' /></p>
                                            <a
                                                href={pub.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 underline hover:text-blue-800"
                                            >
                                                View Source
                                            </a>
                                        </>
                                    ) : (
                                        <p className="text-xs text-red-600 md:text-right">{pub.status}</p>
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

        </div>
    )
}
