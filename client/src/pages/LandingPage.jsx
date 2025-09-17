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
import landingBg from "../assets/landing-bg.jpg";
import React, { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

function LandingPage() {
  const [videoEnded, setVideoEnded] = useState(false);
  const [hideHeading, setHideHeading] = useState(false);
  const [fadeInImage, setFadeInImage] = useState(false);
  const videoRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Hide heading 1s before video ends, show after video ends
  React.useEffect(() => {
    const video = videoRef.current;
    let interval;
    if (video && !videoEnded) {
      interval = setInterval(() => {
        if (video.duration && video.currentTime) {
          if (video.duration - video.currentTime <= 1) {
            setHideHeading(true);
          } else {
            setHideHeading(false);
          }
        }
      }, 200);
    }
    return () => interval && clearInterval(interval);
  }, [videoEnded]);

  React.useEffect(() => {
    if (videoEnded) setHideHeading(false);
  }, [videoEnded]);

  React.useEffect(() => {
    if (videoEnded) {
      setFadeInImage(true);
    } else {
      setFadeInImage(false);
    }
  }, [videoEnded]);

  return (
    <div className="w-full min-h-screen relative">
      <div className="w-full bg-[#000054] fixed top-0 left-0 z-10">
        <Header />
      </div>

      <div className="w-full h-[100dvh] flex justify-center items-center overflow-clip z-0 relative">
        {/* Video background, then fallback to image */}
        <div className="w-full h-full absolute top-0 left-0 z-0">
          {!videoEnded ? (
            <video
              ref={videoRef}
              src={autoplayVideo}
              width="100%"
              autoPlay
              loop={false}
              muted
              className="object-cover brightness-40 w-full h-full"
              onEnded={() => setVideoEnded(true)}
            />
          ) : (
            <img
              src={landingBg}
              alt="Hero banner"
              className={`w-full h-full object-cover transition-opacity duration-1000 ${fadeInImage ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
          {/* Show gradient only after video ends */}
          {videoEnded && (
            <div className="w-full h-1/2 bg-gradient-to-b from-transparent to-black absolute bottom-0 left-0 z-0"></div>
          )}
        </div>
        {/* Animated heading */}
        <div
          className={`absolute w-full px-4 text-center transition-all duration-1000 ease-in-out flex flex-col items-center justify-center`}
          style={
            !videoEnded
              ? {
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }
              : {
                  bottom: '3.8rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                }
          }
        >
          {!hideHeading && (
            <>
              <h1
                className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-5 px-2 sm:px-0"
                style={{ fontFamily: 'Times New Roman, Times, serif' }}
              >
                The world is big,<br />we bring talents closer to you
              </h1>
              {!videoEnded && (
                <button
                  className="text-white text-base sm:text-lg md:text-xl underline focus:outline-none cursor-pointer mt-4 opacity-70 px-2"
                  onClick={() => {
                    const el = document.getElementById('hr-features');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  type="button"
                >
                  Discover all features
                </button>
              )}
            </>
          )}
        </div>
        {/* Show button at bottom only after video ends */}
        {videoEnded && (
          <div className="absolute text-center bottom-4 sm:bottom-8 px-4">
            <button
              className="text-white text-lg sm:text-xl underline focus:outline-none cursor-pointer opacity-100"
              onClick={() => {
                const el = document.getElementById('hr-features');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              type="button"
            >
              Discover all features
            </button>
            {/* <img src={arrowDownIcon} alt="Arrow Down" className="h-8 w-8 mx-auto mt-4 animate-bounce invert" /> */}
          </div>
        )}
      </div>

      <hr id="hr-features" className="w-2/3 border-[#E60028] border-2 my-10 sm:my-15 mx-auto" />

      <h2 className="text-center font-bold text-2xl sm:text-3xl text-[#000054] mb-10 mt-10 sm:mt-20 px-4"> What can we provide?</h2>

      {/* Feature 1: Find academic talent */}
      <div className="w-full md:w-5/6 sm:hover:scale-100 h-max bg-[#000054] mx-auto rounded-2xl flex flex-col md:flex-row pt-10 border-1 border-[#000054] hover:scale-105 transition-transform duration-300 shadow-md px-4 md:px-0">
          <div className="w-full md:w-1/2 text-white pl-0 md:pl-10 flex flex-col justify-between">
              <div>
                  <h3 className="font-bold text-2xl md:text-3xl mb-5">Academics around the world,<br></br>now in one place</h3>
                  <p className="text-justify text-base md:line-clamp-3">Pulling data from reliable databases such as Scopus, ORCID and OpenAlex, our product presents to you a list of potential academics with the necessary details already given, sparing you much time of looking up on various individual platforms.</p>
              </div>
              <button className="w-max bg-[#E60028] text-white px-6 md:px-8 py-3 mt-4 rounded-2xl mb-10 hover:underline text-base md:text-lg">
                  <a href="/search-tool">Explore now</a>
              </button>
          </div>
          <div className="max-w-500 w-full md:w-2/5 px-0 md:px-8 mt-8 md:mt-0">
                  <img src={imageFindAcademics} alt="Find Academics" className="border-gray-200 border-x-1 border-t-1 w-full"/>
          </div>
      </div>
      {/* Spacer for decoration purpose */}
      <div className="h-10 md:h-16"></div>
      {/* Two remaining features */}
      <div className="w-full md:w-5/6 h-max flex flex-col md:flex-row gap-8 md:gap-16 mx-auto text-white px-4 md:px-0">
          {/* Feature 2: Verify candidate CVs */}
          <div className="w-full md:w-1/2 sm:hover:scale-100 h-full bg-[#000054] rounded-2xl pt-10 shadow-md hover:scale-105 transition-transform duration-300 shadow-md mb-8 md:mb-0 px-4 sm:px-5">
              <div className="h-max px-0 md:px-10">
                  <h3 className="font-bold text-2xl md:text-3xl mb-4">Verify candidates’ CVs</h3>
                  <p className="text-balance text-base md:line-clamp-3">By comparing candidates’ statements in CV with some of our Internet sources, this product could give early alarms to the recruiters, highlighting which claims of the candidates are unverifiable.
                  </p>
                  <button className="w-max bg-[#E60028] text-white px-6 md:px-8 py-3 mt-10 rounded-2xl mb-6 hover:underline text-base md:text-lg"><a href="/verify-cv">Explore now</a></button>
              </div>
              <div className="bg-white w-full h-1/2 py-8 px-0 md:px-5 border-1 rounded-b-lg border-gray-200 border-1">
                  <img src={imageVerifyCV} alt="Verify CV" className="border-white border-x-1 border-t-1 w-full"/>
              </div>
          </div>
          {/* Feature 3: Export to report */}
          <div className="w-full md:w-1/2 sm:hover:scale-100 bg-[#000054] rounded-2xl shadow-md grow flex flex-col justify-between hover:scale-105 transition-transform duration-300 shadow-md px-4 sm:px-5">
                  <div className="h-full px-0 md:px-10 pt-10 flex flex-col justify-between">
                          <div>
                                  <h3 className="font-bold text-2xl md:text-3xl mb-4">Export to report</h3>
                                  <p className="text-balance text-base md:text-lg sm:mb-5">Recruiters can export their search results for further analysis.</p>
                          </div>
                          <button className="w-max bg-[#E60028] text-white px-6 md:px-8 py-3 mb-6 rounded-2xl hover:underline text-base md:text-lg"><a href="/login">Explore now</a></button>
                  </div>
                  <div className="bg-white w-full py-8 px-0 md:px-5 rounded-b-lg border-gray-200 border-1 flex flex-col md:flex-row justify-around gap-4 md:gap-0">
                          <div className="w-full md:w-1/2 border-gray-300 border-1 mb-4 md:mb-0">
                                  <img src={imageExportToReport} alt="Sample CV" className="blur-xs w-full"/>
                          </div>
                          <div className="flex flex-col items-center md:items-start">
                                  <button className="w-max bg-[#FFF2D3] text-black px-8 md:px-10 py-3 mt-4 rounded-full flex text-base md:text-lg"><img src={fileIcon} className="w-auto h-3 self-center mr-2"></img>Export result</button>
                                  <img src={clickIcon} className="w-14 md:w-16 h-auto justify-self-end relative bottom-3" alt="Click Icon"></img>
                          </div>
                  </div>
          </div>
      </div>

      {/* Spacer for decoration purpose */}
      <div className="h-20"></div>
  
      <div className="w-screen h-max bg-[#F3F4F5] text-[#000054] text-lg sm:text-xl text-center py-10 sm:py-15 px-4">
          <p className="mb-6 sm:mb-8">We extract the <b>essence</b> of multiple large databases <b>used by millions</b> around the world</p>
          <div className="w-full sm:w-3/4 flex flex-wrap justify-center sm:justify-between items-center mt-2 mx-auto gap-6 sm:gap-4 md:gap-0">
              <img src={scopusLogo} alt="Scopus Logo" className="h-12 sm:h-16 md:h-24 mx-2 md:mx-4 inline-block w-auto" />
              <img src={orcidLogo} alt="ORCID Logo" className="h-10 sm:h-12 md:h-16 mx-2 md:mx-4 inline-block w-auto" />
              <img src={openAlexLogo} alt="OpenAlex Logo" className="h-6 sm:h-8 md:h-10 mx-2 md:mx-4 inline-block w-auto" />
              <img src={googleScholarLogo} alt="Google Scholar Logo" className="h-14 sm:h-16 md:h-24 mx-2 md:mx-4 inline-block w-auto" />
          </div>

          {/* <hr className="w-3/4 border-gray-200 border-1 my-6 mx-auto shadow-xs" /> */}
      </div>

      {/* Spacer for decoration purpose */}
      <div className="h-10"></div>

      <div className="w-full h-max text-[#000054] text-center py-10 sm:py-20 px-4">
          <h3 className="text-2xl sm:text-3xl mb-8 sm:mb-13 px-2"> We strive for <b>high quality</b> <br></br>in all aspects of our product</h3>
          <div className="w-full sm:w-5/6 lg:w-2/3 bg-[#000054] text-white mx-auto py-8 sm:py-15 px-4 sm:px-8 lg:px-20 rounded-2xl flex flex-col sm:flex-row gap-6 sm:gap-10">
              <div className="w-full sm:w-1/3 flex flex-col items-center text-center">
                  <img
                  src={monitorIcon}
                  alt="Monitor Icon"
                  className="w-auto h-10 sm:h-12 mb-4 sm:mb-8"
                  style={{
                      filter:
                          "invert(17%) sepia(97%) saturate(7494%) hue-rotate(-8deg) brightness(100%) contrast(110%)"
                      }}
                  />
                  <h4 className="font-bold text-lg sm:text-xl mb-3 sm:mb-4">User-friendly interface</h4>
                  <p className="text-base sm:text-lg">Our product has undergone careful review and UX test before being launched.</p>
              </div>
              <div className="w-full sm:w-1/3 flex flex-col items-center text-center">
                  <img 
                  src={reliableIcon} 
                  alt="Reliable Icon" 
                  className="w-auto h-10 sm:h-12 mb-4 sm:mb-8" 
                  style={{
                      filter:
                          "invert(17%) sepia(97%) saturate(7494%) hue-rotate(-8deg) brightness(100%) contrast(110%)"
                      }}/>
                  <h4 className="font-bold text-lg sm:text-xl mb-3 sm:mb-4">Reliable data</h4>
                  <p className="text-base sm:text-lg">We get data from reliable sources such as Scopus, ORCID and OpenAlex.</p>
              </div>
              <div className="w-full sm:w-1/3 flex flex-col items-center text-center">
                  <img 
                  src={updateIcon} 
                  alt="Update Icon" 
                  className="h-10 sm:h-12 w-auto mb-4 sm:mb-8" 
                  style={{
                      filter:
                          "invert(17%) sepia(97%) saturate(7494%) hue-rotate(-8deg) brightness(100%) contrast(110%)"
                      }}/>
                  <h4 className="font-bold text-lg sm:text-xl mb-3 sm:mb-4">Real-time update</h4>
                  <p className="text-base sm:text-lg">We only display the latest data to you so that you have the most up-to-date information.</p>
              </div>
          </div>
      </div>
      <div className="h-10"></div>

      <div className="bg-[#F3F4F6] w-full h-max text-[#000054] text-center py-10 sm:py-20 px-4">
          <h2 className="text-2xl sm:text-3xl mb-10 sm:mb-20 font-bold">Frequently asked questions</h2>

          <div className="w-full sm:w-5/6 lg:w-2/3 h-max mx-auto mb-10 flex flex-col text-justify">
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
