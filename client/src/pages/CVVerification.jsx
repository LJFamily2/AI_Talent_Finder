import { useState } from 'react'
import ResearcherProfile from "../components/ResearcherProfile";
import { Pagination, FormControl, FormGroup, FormLabel, RadioGroup, FormControlLabel, Radio, Checkbox, Button } from "@mui/material";
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { samplePublications } from './seed';
import Header from '../components/Header';

export default function CVVerification() {

    const [sortOrder, setSortOrder] = useState('Newest')

    const [inputStartYear, setInputStartYear] = useState('');
    const [inputEndYear, setInputEndYear] = useState('');
    const [filterStartYear, setFilterStartYear] = useState('');
    const [filterEndYear, setFilterEndYear] = useState('');
    const [yearFilterActive, setYearFilterActive] = useState(false);

    const typeOptions = ["Journal", "Conference", "Book", "Other"];
    const [selectedTypes, setSelectedTypes] = useState([]);

    const [filterStatus, setFilterStatus] = useState('All')

    const [page, setPage] = useState(1)
    const itemsPerPage = 3

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


    const filtered = samplePublications
        .filter(pub => {
            if (filterStatus === 'All') return true;
            if (filterStatus === 'unable') {
                return pub.status === 'unable to verify' || pub.status === 'not existed';
            }
            return pub.status === filterStatus;
        })
        .filter(pub => selectedTypes.length === 0 || selectedTypes.includes(pub.type))
        .filter(pub => {
            if (!yearFilterActive) return true;

            const year = parseInt(pub.published_year);
            const start = parseInt(filterStartYear);
            const end = parseInt(filterEndYear);

            if (!isNaN(start) && !isNaN(end)) return year >= start && year <= end;
            if (!isNaN(start)) return year >= start;
            if (!isNaN(end)) return year <= end;

            return true;
        })
        .sort((a, b) =>
            sortOrder === 'Newest'
                ? b.published_year.localeCompare(a.published_year)
                : a.published_year.localeCompare(b.published_year)
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
                        <div className="mb-4">
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
                            <FormLabel component="legend" sx={{ fontSize: 14, fontWeight: 500, mb: 1 }}>
                                Year Range
                            </FormLabel>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="number"
                                    placeholder="Start"
                                    value={inputStartYear}
                                    onChange={e => setInputStartYear(e.target.value)}
                                    className="w-full border px-2 py-1 rounded text-sm"
                                />
                                <span className='flex items-center'> - </span>
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
                                    className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
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
                                <button
                                    className="text-sm bg-gray-300 px-3 py-1 rounded hover:bg-gray-400"
                                    onClick={() => {
                                        setInputStartYear('');
                                        setInputEndYear('');
                                        setFilterStartYear('');
                                        setFilterEndYear('');
                                        setYearFilterActive(false);
                                        setPage(1);
                                    }}
                                >
                                    Any Time
                                </button>

                            </div>
                        </div>

                        {/* Type Selection */}
                        <div className="mb-4">
                            <FormControl component="fieldset" sx={{ mb: 2 }}>
                                <FormLabel component="legend" sx={{ fontSize: 14, fontWeight: 500 }}>
                                    Type
                                </FormLabel>
                                <FormGroup>
                                    {typeOptions.map((type) => (
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
                                <Button
                                    onClick={handleResetTypes}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: 12, textTransform: 'none' }}
                                >
                                    Reset
                                </Button>
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
                                        value="unable"
                                        control={<Radio size="small" />}
                                        label="Unable To Verify"
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
                    {paginated.map((pub, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-6 mb-2 p-4 h-fit bg-white rounded-md">
                            <div className="md:col-span-5">

                                <h3 className="text-sm font-semibold mb-2">{pub.parsed_text}</h3>

                                <div className="mb-2">
                                    <span className="text-xs font-semibold text-gray-700">Title:</span>{' '}
                                    <span className="text-xs text-gray-600">{pub.title}</span>
                                </div>

                                <div className="flex flex-wrap gap-4">
                                    <div>
                                        <span className="text-xs font-semibold text-gray-700">Author:</span>{' '}
                                        <span className="text-xs text-gray-600">{pub.author}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs font-semibold text-gray-700">Published Year:</span>{' '}
                                        <span className="text-xs text-gray-600">{pub.published_year}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs font-semibold text-gray-700">Type:</span>{' '}
                                        <span className="text-xs text-gray-600">{pub.type}</span>
                                    </div>
                                </div>
                            </div>
                            <div className='md:col-span-1 md:ml-auto'>
                                {pub.status === 'verified' ? (
                                    <>
                                        <p className='md:text-center'><CheckCircleOutlinedIcon color='success' /></p>
                                        <a
                                            href={pub.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 underline hover:text-blue-800"
                                        >
                                            View Source
                                        </a>

                                    </>
                                ) : (
                                    <p className="text-xs text-red-600">Status: {pub.status}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Researcher Profile */}
                <aside className="md:col-span-3">
                    <ResearcherProfile />
                </aside>
            </div>

        </div>
    )
}
