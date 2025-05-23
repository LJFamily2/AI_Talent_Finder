import { sampleResearcher } from "../pages/seed"
import { Avatar, Chip } from "@mui/material";

export default function ResearcherProfile() {

    const researcher = sampleResearcher.author;
    return (
        <div className="bg-white p-4 rounded-md sticky top-4 flex flex-col items-center">
            <h2 className="text-lg font-bold mb-4">Researcher Profile</h2>
            <Avatar
                alt="Scholar Avatar"
                src="https://scholar.google.com/citations/images/avatar_scholar_256.png"
                sx={{ width: 100, height: 100, marginBottom: 2 }}
            />
            <p className="font-bold">{researcher.name}</p>
            <p>{researcher.affiliations}</p>
            <div className="mt-4">
                <h3 className="font-semibold text-lg mb-2">
                    Expertise
                </h3>
                <div className="flex flex-wrap gap-2">
                    {researcher.interests.map((interest, index) => (
                        <Chip key={index} label={interest} color="primary" variant="outlined" />
                    ))}
                </div>
            </div>

        </div>
    )
}
