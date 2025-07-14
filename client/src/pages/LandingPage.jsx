import Footer from "../components/Footer";
import Header from "../components/Header";
import autoplayVideo from "../assets/landing-page-autoplay.mp4";
import imageFindAcademics from "../assets/landing-find-academics.png";
import arrowDownIcon from "../assets/arrow-down.png";
import imageVerifyCV from "../assets/landing-verify-cv.png";
import imageExportToReport from "../assets/landing-export-to-report.png";
import fileIcon from "../assets/file.png";
import clickIcon from "../assets/click.png";
import scopusLogo from "../assets/scopus-logo.png";
import orcidLogo from "../assets/orcid-logo.png";
import openAlexLogo from "../assets/OpenAlex_logo.svg";
import googleScholarLogo from "../assets/google-scholar-logo.png";
import updateIcon from "../assets/updated.png";
import reliableIcon from "../assets/shield.png";
import Accordion from '@mui/material/Accordion';
import AccordionActions from '@mui/material/AccordionActions';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Button from '@mui/material/Button';
import monitorIcon from "../assets/dashboard-monitor.png";

function LandingPage() {
return (
    <div className="w-full min-h-screen bg-[#F3F4F6] relative">
        <div className="w-full bg-[#000054] fixed top-0 left-0 z-10">
            <Header/>
        </div>

        <div className="w-full h-screen flex justify-center items-center overflow-clip z-0 relative mx-auto">
            <video src={autoplayVideo} width={"100%"} autoPlay loop muted className="object-cover brightness-40" />
            <div className="absolute text-center">
                <h1 className="text-white text-6xl font-bold mb-15">The world is big,<br></br>we bring talents closer to you</h1>
            </div>
            <div className="absolute text-center bottom-3">
                <p className="text-white text-xl"> Explore how we help you find talents from all over the globe more easily</p>
                <img src={arrowDownIcon} alt="Arrow Down" className="h-8 w-8 mx-auto mt-4 animate-bounce invert" />
            </div>
        </div>

        <hr className="w-2/3 border-[#E60028] border-2 my-15 place-self-center" />

        <h2 className="text-center font-bold text-3xl text-[#000054] mb-10 mt-15"> What can we provide?</h2>

        {/* Feature 1: Find academic talent */}
        <div className="w-2/3 h-max bg-[#000054] mx-auto rounded-2xl flex pt-10 border-1 border-[#000054] hover:scale-105 transition-transform duration-300 shadow-md">
            <div className="w-1/2 text-white pl-10 flex flex-col justify-between">
                <div>
                    <h3 className="font-bold text-3xl mb-5">Academics around the world,<br></br>now in one place</h3>
                    <p className="text-justify">Pulling data from reliable databases such as Scopus, ORCID and OpenAlex, our product presents to you a list of potential academics with the necessary details already given, sparing you much time of looking up on various individual platforms.</p>
                </div>
                <button className="w-max bg-[#E60028] text-white px-8 py-3 mt-4 rounded-2xl mb-10 hover:underline">
                    <a href="/search-tool">Explore now</a>
                </button>
            </div>
            <div className="max-w-500 w-1/2 px-25">
                    <img src={imageFindAcademics} alt="Find Academics" className="border-gray-200 border-x-1 border-t-1"/>
            </div>
        </div>

        {/* Spacer for decoration purpose */}
        <div className="h-15"></div>

        {/* Two remaining features */}
        <div className="w-2/3 h-max flex gap-15 mx-auto text-white">
            {/* Feature 2: Verify candidate CVs */}
            <div className="w-1/2 h-full bg-[#000054] rounded-2xl pt-10 shadow-md hover:scale-105 transition-transform duration-300 shadow-md">
                <div className="h-max px-10">
                    <h3 className="font-bold text-3xl mb-4">Verify candidates’ CVs</h3>
                    <p className="text-justify">By comparing candidates’ statements in CV with some of our Internet sources, this product could give early alarms to the recruiters, highlighting which claims of the candidates are unverifiable.
                    </p>
                    <button className="w-max bg-[#E60028] text-white px-8 py-3 mt-10 rounded-2xl mb-6 hover:underline"><a href="/verify-cv">Explore now</a></button>
                </div>
                                
                <div className="bg-white w-full h-1/2 py-8 px-5 border-1 rounded-b-lg border-gray-200 border-1">
                    <img src={imageVerifyCV} alt="Verify CV" className="border-white border-x-1 border-t-1 w-full"/>
                </div>
            </div>

            {/* Feature 3: Export to report */}
            <div className="w-1/2 bg-[#000054] rounded-2xl shadow-md grow flex flex-col justify-between hover:scale-105 transition-transform duration-300 shadow-md">
                    <div className="h-full px-10 pt-10 flex flex-col justify-between">
                            <div>
                                    <h3 className="font-bold text-3xl mb-4">Export to report</h3>
                                    <p className="text-justify">Recruiters can export their search results for further analysis.</p>
                            </div>
                            
                            <button className="w-max bg-[#E60028] text-white px-8 py-3 mb-6 rounded-2xl hover:underline"><a href="#">Explore now</a></button>
                    </div>
                    
                    <div className="bg-white w-full py-8 px-5 rounded-b-lg border-gray-200 border-1 flex justify-around">
                            <div className="w-1/2 border-gray-300 border-1">
                                    <img src={imageExportToReport} alt="Sample CV" className="blur-xs"/>
                            </div>
                            <div>
                                    <button className="w-max bg-[#FFF2D3] text-black px-10 py-3 mt-4 rounded-full flex"><img src={fileIcon} className="w-auto h-3 self-center mr-2"></img>Export result</button>
                                    <img src={clickIcon} className="w-18 h-auto justify-self-end relative bottom-3" alt="Click Icon"></img>
                            </div>
                    </div>
            </div>
        </div>

        {/* Spacer for decoration purpose */}
        <div className="h-20"></div>
    
        <div className="w-screen h-max bg-white text-[#000054] text-xl text-center pt-20 pb-25">
            <p>We extract the <b>essence</b> of multiple large databases <b>used by millions</b> around the world</p>
            <div className="w-3/4 flex justify-between items-center mt-2 mx-auto">
                <img src={scopusLogo} alt="Scopus Logo" className="h-27 mx-4 inline-block" />
                <img src={orcidLogo} alt="ORCID Logo" className="h-18 mx-4 inline-block" />
                <img src={openAlexLogo} alt="OpenAlex Logo" className="h-11 mx-4 inline-block" />
                <img src={googleScholarLogo} alt="Google Scholar Logo" className="h-30 mx-4 inline-block" />
            </div>

            <hr className="w-3/4 border-gray-200 border-1 my-6 mx-auto shadow-xs" />

            {/* Spacer for decoration purpose */}
            <div className="h-20"></div>

            <h3 className="text-3xl mb-13"> We strive for <b>high quality</b> <br></br>in all aspects of our product</h3>
            <div className="w-2/3 bg-[#000054] text-white mx-auto py-15 px-20 rounded-2xl flex gap-10">
                <div className="w-1/3 flex flex-col items-center">
                    <img
                    src={monitorIcon}
                    alt="Monitor Icon"
                    className="w-auto h-12 mb-8"
                    style={{
                        filter:
                            "invert(17%) sepia(97%) saturate(7494%) hue-rotate(-8deg) brightness(100%) contrast(110%)"
                        }}
                    />
                    <h4 className="font-bold text-xl mb-4">User-friendly interface</h4>
                    <p className="text-lg">Our product has undergone careful review and UX test before being launched.</p>
                </div>
                <div className="w-1/3 flex flex-col items-center">
                    <img 
                    src={reliableIcon} 
                    alt="Reliable Icon" 
                    className="w-auto h-12 mb-8" 
                    style={{
                        filter:
                            "invert(17%) sepia(97%) saturate(7494%) hue-rotate(-8deg) brightness(100%) contrast(110%)"
                        }}/>
                    <h4 className="font-bold text-xl mb-4">Reliable data</h4>
                    <p className="text-lg">We get data from reliable sources such as Scopus, ORCID and OpenAlex.</p>
                </div>
                <div className="w-1/3 flex flex-col items-center">
                    <img 
                    src={updateIcon} 
                    alt="Update Icon" 
                    className="h-12 w-auto mb-8" 
                    style={{
                        filter:
                            "invert(17%) sepia(97%) saturate(7494%) hue-rotate(-8deg) brightness(100%) contrast(110%)"
                        }}/>
                    <h4 className="font-bold text-xl mb-4">Real-time update</h4>
                    <p className="text-lg">We only display the latest data to you so that you have the most up-to-date information.</p>
                </div>
            </div>
        </div>

        <div className="h-10"></div>

        <div className="bg-[#F3F4F6] w-full h-max text-[#000054] text-center py-20">
            <h2 className="text-3xl mb-20 font-bold">Frequently asked questions</h2>
            
            <div className="w-2/3 h-max mx-auto mb-10 flex flex-col text-justify">
            <Accordion>
                <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="panel1-content"
                id="panel1-header"
                >
                <Typography component="span">Is this system completely foolproof?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                Unfortunately, our system is not without error. For instance let's look at our CV Verification feature: we rely on Scopus, ORCID and OpenAlex (and Google Scholar as a last resort) to give you the verification results of candidates’ CVs, but what if the information that we want to verify falls outside of all these databases?, which means there will false negative cases. Therefore, we recommend that you use this system as a <b>supplement</b> to your own research, rather than a replacement.
                </AccordionDetails>
            </Accordion>
            <Accordion>
                <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="panel2-content"
                id="panel2-header"
                >
                <Typography component="span">What type of statements in a CV can this system verify?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                Considering the complexity of the tasks and the limitation of our abilities, we currently only verify the <b>Publications</b> section of a CV. Specifically, we check whether the publications listed in the CV can be found in Scopus, ORCID or OpenAlex. If they are not found in any of these databases, we will mark them as unverifiable.
                </AccordionDetails>
            </Accordion>
            <Accordion>
                <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="panel2-content"
                id="panel2-header"
                >
                <Typography component="span">Does this system include any paid features?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                No, all features of this system are <b>free to use</b>.
                </AccordionDetails>
            </Accordion>
            <Accordion>
                <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="panel2-content"
                id="panel2-header"
                >
                <Typography component="span">Is there a limit on how many CVs I can upload in a day?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                No, you can upload as many CVs as you want in a day. However, we need to emphasize that CVs containing more pages take longer to process. We estimate that a CV with 18 pages may take around 2 minutes to process.
                </AccordionDetails>
            </Accordion>
            </div>
        </div>

        <Footer />
    </div>
);
}

export default LandingPage;
