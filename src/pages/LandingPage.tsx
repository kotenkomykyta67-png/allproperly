import React, { useEffect, useState } from "react";
import { Box, Typography, Button, IconButton, Drawer } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import logo from "/All_Properly_logo-01.png";

const LandingPage: React.FC = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);
  const [visibleSections, setVisibleSections] = useState<string[]>(["Features Section", "What is AllProperly", "Payment", "New Section", "Footer Section"]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    if(path.includes("features")) {
      setActiveTab("Features");
      setVisibleSections(["Features Section", "Features Section4", "Payment", "New Section", "Footer Section"]);
    } else if(path.includes("about")) {
      setActiveTab("About");
      setVisibleSections(["Screenshot Section", "New Section", "Footer Section"]);
    } else if(path.includes("faqs")) {
      setActiveTab("FAQs");
      setVisibleSections(["FAQ Section", "Payment", "New Section", "Footer Section"]);
    } else if(path.includes("pricing")) {
      setActiveTab("Pricing");
      setVisibleSections(["Payment", "Footer Section"]);
    } else if(path.includes("support")) {
      setActiveTab("Support");
      setVisibleSections([]);
    } else {
      setActiveTab("");
      setVisibleSections(["Features Section", "What is AllProperly", "Payment", "New Section", "Footer Section"]);
    }
  }, []);

  const handleToggleChange = () => {
    setIsAnnual(!isAnnual);
  };

  const toggleFAQ = (index: number) => {
    setActiveFAQ(activeFAQ === index ? null : index);
  };

  const handleNavClick = (section: string) => {
    setActiveTab(section);
    switch (section) {
      case "Features":
        setVisibleSections(["Features Section", "Features Section4", "Payment", "New Section", "Footer Section"]);
        window.history.pushState(null, "", "/features");
        break;
      case "About":
        setVisibleSections(["Screenshot Section", "New Section", "Footer Section"]);
        window.history.pushState(null, "", "/about");
        break;
      case "FAQs":
        setVisibleSections(["FAQ Section", "Payment", "New Section", "Footer Section"]);
        window.history.pushState(null, "", "/faqs");
        break;
      case "Pricing":
        setVisibleSections(["Payment", "Footer Section"]);
        window.history.pushState(null, "", "/pricing");
        break;
      case "Support":
        setVisibleSections([]);
        window.history.pushState(null, "", "/support");
        break;
      default:
        setVisibleSections([]);
        window.history.pushState(null, "", "/");
    }
  };

  const handleLogoClick = () => {
    setActiveTab("");
    setVisibleSections([
      "Features Section", "What is AllProperly", "Payment", "New Section", "Footer Section"]);
    window.history.pushState(null, "", "/homepage");
  };

  // Disable horizontal scroll globally
  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
    };
  }, []);

  return (
  <Box sx={{ height: "fit-content", width: '100vw', fontFamily: 'Nunito, Arial, sans-serif', bgcolor: '#F9F9F9', position: 'relative' }}>

    {/* Navigation Bar - Figma style */}
    <Box sx={{
      width: { xs: '95vw', md: '90vw', lg: '90vw' },
      mx: 'auto',
      mt: 2,
      mb: 2,
      px: { xs: 1, md: 2 },
      py: 0,
      bgcolor: 'white',
      borderRadius: 5,
      boxShadow: '0 4px 24px 0 rgba(0,0,0,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'absolute',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20
    }}>
      {/* Logo left - smaller on mobile */}
      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: { xs: 100, md: 180 } }}>
        <Box onClick={handleLogoClick} sx={{ cursor: "pointer", width: { xs: 120, sm: 160, md: 220 }, flexShrink: 0 }}>
          <img src={logo} alt="AllProperly Logo" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </Box>
      </Box>
      {/* Desktop nav links - hidden on mobile */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 3, flex: 1, justifyContent: 'center' }}>
        <Typography onClick={() => handleNavClick("Features")} sx={{ fontWeight: activeTab === "Features" ? 700 : 300, color: "#222", cursor: "pointer", fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif', mr: 0.5 }}>Features</Typography>
        <Typography onClick={() => handleNavClick("About")} sx={{ fontWeight: activeTab == "About" ? 700 : 300, color: "#222", cursor: "pointer", fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif' }}>About</Typography>
        <Typography onClick={() => handleNavClick("Pricing")} sx={{ fontWeight: activeTab === "Pricing" ? 700 : 300, color: "#222", cursor: 'pointer', fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif' }}>Pricing</Typography>
        <Typography onClick={() => handleNavClick("FAQs")} sx={{ fontWeight: activeTab === "FAQs" ? 700 : 300, color: "#222", cursor: "pointer", fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif' }}>FAQs</Typography>
        <Typography onClick={() => handleNavClick("Support")} sx={{ fontWeight: activeTab === "Support" ? 700 : 300, color: "#222", cursor: 'pointer', fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif' }}>Support</Typography>
      </Box>
      {/* Right: hamburger on mobile, Sign in always */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button variant="contained" sx={{ borderRadius: 99, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 300, minWidth: { xs: 70, md: 90 }, px: { xs: 1.5, md: 2 }, py: 0.8, bgcolor: '#8CB19C', color: 'white', boxShadow: 'none', textTransform: 'none', fontSize: { xs: 12, md: 14 }, '&:hover': { bgcolor: '#89AE99', color: 'white' } }} href="https://app.allproperly.com/">Sign in</Button>
        <IconButton sx={{ display: { xs: 'flex', md: 'none' }, p: 1 }} onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <MenuIcon sx={{ color: '#222', fontSize: 28 }} />
        </IconButton>
      </Box>
    </Box>

    {/* Mobile drawer menu */}
    <Drawer
      anchor="right"
      open={mobileMenuOpen}
      onClose={() => setMobileMenuOpen(false)}
      PaperProps={{ sx: { width: 'min(280px, 85vw)', pt: 3, px: 2, fontFamily: 'Nunito, Arial, sans-serif' } }}
    >
      <Typography onClick={() => { handleNavClick("Features"); setMobileMenuOpen(false); }} sx={{ py: 2, fontWeight: activeTab === "Features" ? 700 : 400, color: "#222", cursor: "pointer", fontSize: 16 }}>Features</Typography>
      <Typography onClick={() => { handleNavClick("About"); setMobileMenuOpen(false); }} sx={{ py: 2, fontWeight: activeTab === "About" ? 700 : 400, color: "#222", cursor: "pointer", fontSize: 16 }}>About</Typography>
      <Typography onClick={() => { handleNavClick("Pricing"); setMobileMenuOpen(false); }} sx={{ py: 2, fontWeight: activeTab === "Pricing" ? 700 : 400, color: "#222", cursor: "pointer", fontSize: 16 }}>Pricing</Typography>
      <Typography onClick={() => { handleNavClick("FAQs"); setMobileMenuOpen(false); }} sx={{ py: 2, fontWeight: activeTab === "FAQs" ? 700 : 400, color: "#222", cursor: "pointer", fontSize: 16 }}>FAQs</Typography>
      <Typography onClick={() => { handleNavClick("Support"); setMobileMenuOpen(false); }} sx={{ py: 2, fontWeight: activeTab === "Support" ? 700 : 400, color: "#222", cursor: "pointer", fontSize: 16 }}>Support</Typography>
    </Drawer>

      {/* Hero Video Section */}
      {activeTab === "About" ? (
      <Box sx={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
        <img
          src="/About.png"
          alt="About Section Image"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: { xs: '3%', md: '5%' },
            left: '50%',
            transform: 'translateX(-50%)',
            width: { xs: '95vw', md: '40%' },
            bgcolor: 'white',
            borderRadius: 2,
            boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
            p: { xs: 2, sm: 3, md: 3.4 },
            textAlign: 'left',
            border: '1px solid #E0E0E0',
          }}
        >
            <Typography sx={{ fontSize: { xs: 16, md: 20 }, fontFamily: 'Nunito, Arial, sans-serif', letterSpacing: -0.5, lineHeight: 1.4, fontWeight: 440, color: '#89AE99', mb: 1 }}>
            Our Mission
          </Typography>
          <Typography sx={{ fontSize: { xs: 20, sm: 26, md: 32 }, fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.4, letterSpacing: -0.8, fontWeight: 440, color: '#22210D', mb: 1 }}>
            Bring peace of mind by keeping every property in proper order.
          </Typography>
        </Box>
      </Box>
      ) : activeTab === "FAQs" ? (
      <Box sx={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
        <img
          src="/FAQs.png"
          alt="FAQs Section Image"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: { xs: '3%', md: '5%' },
            left: '50%',
            transform: 'translateX(-50%)',
            width: { xs: '95vw', md: '40%' },
            zIndex: 10,
            bgcolor: 'white',
            borderRadius: 2,
            boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
            p: { xs: 2, sm: 3, md: 3.4 },
            textAlign: 'left',
            border: '1px solid #E0E0E0',
          }}
        >
          <Typography sx={{ fontSize: { xs: 16, md: 20 }, fontFamily: 'Nunito, Arial, sans-serif', letterSpacing: -0.5, lineHeight: 1.4, fontWeight: 440, color: '#89AE99', mb: 1 }}>
                All Features
              </Typography>
              <Typography sx={{ fontSize: { xs: 20, sm: 26, md: 32 }, fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.4, letterSpacing: -0.8, fontWeight: 440, color: '#22210D', mb: 3 }}>
                All your property care, in one place.
              </Typography>
              <Button
                variant="contained"
                sx={{
                  bgcolor: '#8CB19C',
                  color: 'white',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 16,
                  fontFamily: 'Nunito, Arial, sans-serif',
                  px: 2.2,
                  py: 0.8,
                  textTransform: 'none', // Ensure text remains as is
                  letterSpacing: 0,
                  '&:hover': { bgcolor: '#89AE99', color: 'white' },
                }}                href="https://app.allproperly.com/"
              >
                Add Your First Property For Free
              </Button>
        </Box>
      </Box>
      ) : activeTab === "Pricing" ? null : (
      <Box sx={{ width: '100vw', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        {/* Hero Image/Video Container */}
        <Box
          sx={{
            width: '100vw',
            height: { xs: '100vh', md: '100vh' },
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Preload image - shown while video is loading on both mobile and desktop */}
          <img
            src="/preload.png"
            alt="Loading"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: videoReady ? 0 : 1,
              transition: 'opacity 0.3s ease-in-out',
              pointerEvents: 'none'
            }}
          />
          
          {/* Video - autoplay on both mobile and desktop */}
          <Box
            component="video"
            src={typeof window !== 'undefined' && window.innerWidth <= 700 ? '/video_m.mov' : '/video.mov'}
            autoPlay
            loop
            muted
            playsInline
            onCanPlayThrough={() => setVideoReady(true)}
            sx={{
              width: '100vw',
              height: '100vh',
              position: 'absolute',
              top: 0,
              left: 0,
              objectFit: 'cover',
              opacity: videoReady ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out'
            }}
          />
        </Box>

        {/* Overlay Card */}
        <Box
          sx={{
            position: 'absolute',
            bottom: { xs: '5%', md: '3%' },
            left: { xs: '5%', md: '5%' },
            width: { xs: '90vw', md: 'auto' },
            maxWidth: { xs: 'none', md: 615 },
            bgcolor: 'white',
            borderRadius: 2,
            boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
            p: { xs: 2.5, sm: 2.5 },
            mx: { xs: 'auto', md: 0 },
            mt: { xs: 3, md: 0 },
            fontFamily: 'Nunito, Arial, sans-serif',
            textAlign: 'left',
            border: '1px solid #E0E0E0',
          }}
        >
          {activeTab === "Features" ? (
            <>
              <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 16, md: 20 }, letterSpacing: -0.5, lineHeight: 1.4, fontWeight: 440, color: '#89AE99', mb: 1 }}>
                All Features
              </Typography>
              <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 20, sm: 26, md: 32 }, lineHeight: 1.4, letterSpacing: -0.5, fontWeight: 440, color: '#22210D', mb: 2 }}>
                All your property care, in one place.
              </Typography>
              <Button
                variant="contained"
                sx={{
                  bgcolor: '#8CB19C',
                  color: 'white',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 16,
                  fontFamily: 'Nunito, Arial, sans-serif',
                  px: 2.2,
                  py: 0.8,
                  textTransform: 'none', // Ensure text remains as is
                  letterSpacing: 0,
                  '&:hover': { bgcolor: '#89AE99', color: 'white' },
                }}
                href="https://app.allproperly.com/"
              >
                Add Your First Property For Free
              </Button>
            </>
          ) : (
            <>
              <Typography sx={{ fontSize: { xs: 18, sm: 24, md: 32 }, fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.35, fontWeight: 440, color: '#22210D', mb: 1, width: '100%', letterSpacing: -0.7, maxWidth: 650 }}>
                Your house won’t text you when it needs something.
                <span style={{ color: '#538C6C', fontWeight: 550 }}> But AllProperly will.</span>
              </Typography>
              <Typography variant="body1" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 14, md: 17 }, color: '#22210D', mb: 1.5, width: '100%', letterSpacing: -0.5, maxWidth: 650 }}>
                Stay ahead of costly repairs, keep your home in proper order, and make maintaining a house feel simple.
              </Typography>
              <Button
                variant="contained"
                sx={{
                  bgcolor: '#8CB19C',
                  color: 'white',
                  borderRadius: 6,
                  fontWeight: 600,
                  letterSpacing: 0,
                  fontSize: 16,
                  fontFamily: 'Nunito, Arial, sans-serif',
                  px: 2.2,
                  py: 0.8,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#89AE99', color: 'white' },
                }}
                href="https://app.allproperly.com/"
              >
                Add Your First Property For Free
              </Button>
            </>
          )}
        </Box>
      </Box>
      )}

      {/* Features Section */}
      {visibleSections.includes("Features Section") && (
        <Box sx={{ width: '100vw', px: { xs: 2, sm: 3, md: 8 }, py: { xs: 4, md: 12 }, fontFamily: 'Nunito, Arial, sans-serif', bgcolor: '#F9F9F9', mt: 0, overflowX: { xs: 'hidden', md: 'visible' } }}>
          {/* Feature 1 */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: { xs: 2, md: 6 }, py: { xs: 2, md: 6 } }}>
            <Box sx={{ flex: 1, width: '100%', textAlign: { xs: 'center', md: 'left' }, px: { xs: 0, md: 8 }, order: { xs: 1, md: 0 } }}>
              <Typography variant="h4" fontFamily={'Nunito, Arial, sans-serif'} color="#22210D" fontWeight={400} mb={1} sx={{ fontSize: { xs: 26, md: 40 } }}>Track Property Tasks</Typography>
              <Typography variant="body1" color="#22210D" mb={{ xs: 2, md: 4 }} fontFamily={'Nunito, Arial, sans-serif'} sx={{ fontWeight: 50, fontSize: { xs: 15, md: 18 }, width: { xs: '100%', md: '70%' }, lineHeight: 1.6, mx: { xs: 'auto', md: 0 } }}>
                Never forget a gutter cleaning or HVAC tune-up. Add tasks once and get friendly reminders so nothing slips through the cracks.
              </Typography>
            </Box>
            <Box sx={{ flex: 1, width: '100%', order: { xs: 2, md: 0 }, mx: { xs: -2, md: 0 }, aspectRatio: { xs: '16/10', md: 'auto' }, overflow: 'hidden', borderRadius: 3 }}>
              <img src="/feature.svg" alt="Track Property Tasks" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 12 }} />
            </Box>
          </Box>

          {/* Feature 2 */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: { xs: 2, md: 6 }, py: { xs: 2, md: 6 } }}>
            <Box sx={{ flex: 1, width: '100%', order: { xs: 2, md: 0 }, mx: { xs: -2, md: 0 }, aspectRatio: { xs: '16/10', md: 'auto' }, overflow: 'hidden', borderRadius: 3 }}>
              <img src="/feature2.svg" alt="Plan Big Expenses" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 12 }} />
            </Box>
            <Box sx={{ flex: 1, width: '100%', textAlign: { xs: 'center', md: 'left' }, px: { xs: 0, md: 8 }, order: { xs: 1, md: 0 } }}>
              <Typography variant="h4" color="#22210D" fontFamily={'Nunito, Arial, sans-serif'} fontWeight={400} mb={1} sx={{ fontSize: { xs: 26, md: 40 } }}>Plan Big Expenses</Typography>
              <Typography variant="body1" color="#22210D" fontFamily={'Nunito, Arial, sans-serif'} mb={{ xs: 2, md: 4 }} sx={{ fontWeight: 50, fontSize: { xs: 15, md: 18 }, width: { xs: '100%', md: '70%' }, lineHeight: 1.6, mx: { xs: 'auto', md: 0 } }}>
                Roof, HVAC, or water heater—we forecast their lifespan and show you how much to save so you’re ready when the time comes.
              </Typography>
            </Box>
          </Box>

          {/* Feature 3 */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: { xs: 2, md: 6 }, py: { xs: 2, md: 6 } }}>
            <Box sx={{ flex: 1, width: '100%', textAlign: { xs: 'center', md: 'left' }, px: { xs: 0, md: 8 }, order: { xs: 1, md: 0 } }}>
              <Typography variant="h4" color="#22210D" fontFamily={'Nunito, Arial, sans-serif'} fontWeight={400} mb={1} sx={{ fontSize: { xs: 26, md: 40 } }}>Share Responsibilities</Typography>
              <Typography variant="body1" color="#22210D" fontFamily={'Nunito, Arial, sans-serif'} mb={{ xs: 2, md: 4 }} sx={{ fontWeight: 50, fontSize: { xs: 15, md: 18 }, width: { xs: '100%', md: '70%' }, lineHeight: 1.6, mx: { xs: 'auto', md: 0 } }}>
                Easily invite a spouse, family member, or property manager to help. Everyone stays on the same page with tasks and history.
              </Typography>
            </Box>
            <Box sx={{ flex: 1, width: '100%', order: { xs: 2, md: 0 }, mx: { xs: -2, md: 0 }, aspectRatio: { xs: '16/10', md: 'auto' }, overflow: 'hidden', borderRadius: 3 }}>
              <img src="/feature3.svg" alt="Share Responsibilities" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 12 }} />
            </Box>
          </Box>

          {/* Feature 4 */}
          {visibleSections.includes("Features Section4") && (
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: { xs: 2, md: 6 }, py: { xs: 2, md: 6 } }}>
            <Box sx={{ flex: 1, width: '100%', order: { xs: 2, md: 0 }, mx: { xs: -2, md: 0 }, aspectRatio: { xs: '16/10', md: 'auto' }, overflow: 'hidden', borderRadius: 3 }}>
              <img src="/feature4.svg" alt="Build a Property History" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 12 }} />
            </Box>
            <Box sx={{ flex: 1, width: '100%', textAlign: { xs: 'center', md: 'left' }, px: { xs: 0, md: 8 }, order: { xs: 1, md: 0 } }}>
              <Typography variant="h4" fontFamily={'Nunito, Arial, sans-serif'} color="#22210D" fontWeight={400} mb={1} sx={{ fontSize: { xs: 26, md: 40 } }}>Build a Property History</Typography>
              <Typography variant="body1" fontFamily={'Nunito, Arial, sans-serif'} color="#22210D" mb={{ xs: 2, md: 4 }} sx={{ fontWeight: 50, fontSize: { xs: 15, md: 18 }, width: { xs: '100%', md: '70%' }, lineHeight: 1.6, mx: { xs: 'auto', md: 0 } }}>
                Completing tasks builds a record of care, just like Carfax but for your house. And when it’s time to sell, you’ll have proof of maintenance.
              </Typography>
            </Box>
          </Box>)}

          {/* Feature 5 */}
          {visibleSections.includes("Features Section4") && (
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: { xs: 2, md: 6 }, py: { xs: 2, md: 6 } }}>
            <Box sx={{ flex: 1, width: '100%', textAlign: { xs: 'center', md: 'left' }, px: { xs: 0, md: 8 }, order: { xs: 1, md: 0 } }}>
              <Typography variant="h4" fontFamily={'Nunito, Arial, sans-serif'} color="#22210D" fontWeight={400} mb={1} sx={{ fontSize: { xs: 26, md: 40 } }}>Multi-Property Made Simple</Typography>
              <Typography variant="body1" fontFamily={'Nunito, Arial, sans-serif'} color="#22210D" mb={{ xs: 2, md: 4 }} sx={{ fontWeight: 50, fontSize: { xs: 15, md: 18 }, width: { xs: '100%', md: '70%' }, lineHeight: 1.6, mx: { xs: 'auto', md: 0 } }}>
                Whether you manage your own rentals or help parents with their home, AllProperly gives you one dashboard to see it all.
              </Typography>
            </Box>
            <Box sx={{ flex: 1, width: '100%', order: { xs: 2, md: 0 }, mx: { xs: -2, md: 0 }, aspectRatio: { xs: '16/10', md: 'auto' }, overflow: 'hidden', borderRadius: 3 }}>
              <img src="/feature5.svg" alt="Multi-Property Made Simple" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 12 }} />
            </Box>
          </Box>)}
        </Box>
      )}

      {/* What is AllProperly Section */}
      {visibleSections.includes("What is AllProperly") && (
      <Box sx={{ width: '100vw', px: { xs: 2, sm: 3, md: 8 }, py: { xs: 4, md: 12 }, mt: { xs: 0, md: -12 }, textAlign: 'center', bgcolor: '#F9F9F9' }}>
        <Typography variant="h6" fontFamily={'Nunito, Arial, sans-serif'} color="#89AE99" fontWeight={300} mb={1} sx={{ fontSize: { xs: 12, md: 14 }, letterSpacing: 1 }}>
          WHAT IS ALLPROPERLY?
        </Typography>
        <Typography variant="h4" fontFamily={'Nunito, Arial, sans-serif'} color="#22210D" fontWeight={400} sx={{ fontSize: { xs: 24, md: 48 }, lineHeight: 1.2, maxWidth: 1000, mx: 'auto', width: '100%', px: { xs: 1, md: 0 } }}>
          See your home’s health at a glance, track tasks, and know exactly what’s coming next.
        </Typography>
      </Box>)}

      {/* UI Image Section */}
      {visibleSections.includes("What is AllProperly") && (
      <Box sx={{ width: '100vw', px: { xs: 2, sm: 3, md: 8 }, py: { xs: 4, md: 12 }, mt: { xs: 0, md: -20 }, textAlign: 'center', bgcolor: '#F9F9F9' }}>
        <img src="/UI.svg" alt="Track Property Tasks" style={{ width: '100%', borderRadius: 12 }} />
      </Box>)}
      {/* Crisis Avoided Section */}
      {visibleSections.includes("What is AllProperly") && (
      <Box sx={{ width: { xs: 'calc(100% - 24px)', md: '92.8vw' }, maxWidth: { md: '92.8vw' }, mb: 5, px: { xs: 2, sm: 3, md: 8 }, py: { xs: 4, md: 8 }, textAlign: 'center', bgcolor: '#475567', color: '#FFFFFF', borderRadius: 4, boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)', mx: 'auto' }}>
        <Typography variant="h4" fontWeight={100} mb={4} sx={{ fontSize: { xs: 18, sm: 24, md: 48 }, lineHeight: 1.4, paddingRight: { xs: 0, md: 15 }, paddingLeft: { xs: 0, md: 15 } }}>
          Your dad forgets to clean the gutters before the first freeze. Instead of an expensive leak later, <span style={{ fontWeight: 550 }}>AllProperly sends a reminder and you assign it to him (or do it yourself)</span>. Everyone stays updated. Crisis avoided.
        </Typography>
        <Button
          variant="contained"
          sx={{
            bgcolor: 'white',
            color: '#22210D',
            borderRadius: 99,
            fontWeight: 300,
            fontSize: 15.5,
            fontFamily: 'Nunito, Arial, sans-serif',
            px: 4,
            py: 1.5,
            '&:hover': { bgcolor: '#E0E0E0', color: '#22210D' }
          }}
          href="https://app.allproperly.com"
        >
          Get started today
        </Button>
      </Box>)}

      {/* FAQ Section */}
      {visibleSections.includes("FAQ Section") && (
        <Box sx={{ width: '100vw', fontFamily: 'Nunito, Arial, sans-serif', mt: { xs: 2, sm: 2, md: 20 }, px: { xs: 2, sm: 3, md: 8 }, py: { xs: 4, md: 12 }, textAlign: 'center', bgcolor: '#F9F9F9' }}>
          <Typography variant="h4" fontFamily={'Nunito, Arial, sans-serif'} fontWeight={550} mt={{ xs: 0, md: -25 }} mb={2} sx={{ color: '#22210D', fontSize: { xs: 28, md: 40 }, lineHeight: 1.6 }}>
            FAQs
          </Typography>
          <Box sx={{ width: '100%', mx: 'auto', fontFamily: 'Nunito, Arial, sans-serif', textAlign: 'left', mt: 4 }}>
            {/* FAQ Item 1 */}
            <Box sx={{ bgcolor: '#EFECEA', px: { xs: 2, md: 3 }, py: 3, mb: 2 }}>
              <Typography
                variant="h6"
                fontWeight={300}
                fontFamily={'Nunito, Arial, sans-serif'}
                sx={{ fontSize: { xs: 16, md: 20 }, mb: 1, color: '#22201D', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => toggleFAQ(1)}
              >
                What is AllProperly?
                <span style={{ paddingRight: 10, fontFamily: 'Nunito, Arial, sans-serif', color: 'gray', fontSize: activeFAQ === 1 ? '15px' : '27px' }}>{activeFAQ === 1 ? '—' : '+'}</span>
              </Typography>
              <Box
                sx={{
                  maxHeight: activeFAQ === 1 ? '200px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.3s ease',
                }}
              >
                <Typography variant="body1" mt={1} sx={{ fontSize: { xs: 15, md: 20 }, fontFamily: 'Nunito, Arial, sans-serif', color: '#22201D', bgcolor: 'white', p: { xs: 2, md: 4 }, borderRadius: 4 }}>
                  AllProperly is a hub for all your home maintenance needs. You can plan for big expenses and share responsibility with others.
                </Typography>
              </Box>
            </Box>
            {/* FAQ Item 2 */}
            <Box sx={{ bgcolor: '#EFECEA', px: { xs: 2, md: 3 }, py: 3, mb: 2 }}>
              <Typography
                variant="h6"
                fontWeight={300}
                fontFamily={'Nunito, Arial, sans-serif'}
                sx={{ fontSize: { xs: 16, md: 20 }, mb: 1, color: '#22201D', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => toggleFAQ(2)}
              >
                How much does it cost?
                <span style={{ paddingRight: 10, fontFamily: 'Nunito, Arial, sans-serif', color: 'gray', fontSize: activeFAQ === 2 ? '15px' : '27px' }}>{activeFAQ === 2 ? '—' : '+'}</span>
              </Typography>
              <Box
                sx={{
                  maxHeight: activeFAQ === 2 ? '200px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.3s ease',
                }}
              >
                <Typography variant="body1" mt={1} sx={{ fontSize: { xs: 15, md: 20 }, fontFamily: 'Nunito, Arial, sans-serif', color: '#22201D', bgcolor: 'white', p: { xs: 2, md: 4 }, borderRadius: 4 }}>
                  Free accounts let you add 1 property. Paid plans start at $15/month for up to 5 properties, or $30/month for up to 10 properties. Paid plan also unlocks more features to help you manage your home better.
                </Typography>
              </Box>
            </Box>
            {/* FAQ Item 3 */}
            <Box sx={{ bgcolor: '#EFECEA', px: { xs: 2, md: 3 }, py: 3, mb: 2 }}>
              <Typography
                variant="h6"
                fontWeight={300}
                fontFamily={'Nunito, Arial, sans-serif'}
                sx={{ fontSize: { xs: 16, md: 20 }, mb: 1, color: '#22201D', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => toggleFAQ(3)}
              >
                Can I share my property with family?
                <span style={{ paddingRight: 10, color: 'gray', fontFamily: 'Nunito, Arial, sans-serif', fontSize: activeFAQ === 3 ? '15px' : '27px' }}>{activeFAQ === 3 ? '—' : '+'}</span>
              </Typography>
              <Box
                sx={{
                  maxHeight: activeFAQ === 3 ? '200px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.3s ease',
                }}
              >
                <Typography variant="body1" mt={1} sx={{ fontSize: { xs: 15, md: 20 }, fontFamily: 'Nunito, Arial, sans-serif', color: '#22201D', bgcolor: 'white', p: { xs: 2, md: 4 }, borderRadius: 4 }}>
                  Yes! Paid users can invite family members, roommates, or property managers. Free collaborators can view and complete tasks, but can’t add properties or create tasks.
                </Typography>
              </Box>
            </Box>

            {/* FAQ Item 4 */}
            <Box sx={{ bgcolor: '#EFECEA', py: 3, px: { xs: 2, md: 3 }, mb: 2 }}>
              <Typography
                variant="h6"
                fontWeight={300}
                fontFamily={'Nunito, Arial, sans-serif'}
                sx={{ fontSize: { xs: 16, md: 20 }, mb: 1, color: '#22201D', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => toggleFAQ(4)}
              >
                Do I lose my data if I cancel?
                <span style={{ paddingRight: 10, fontFamily: 'Nunito, Arial, sans-serif', color: 'gray', fontSize: activeFAQ === 4 ? '15px' : '27px' }}>{activeFAQ === 4 ? '—' : '+'}</span>
              </Typography>
              <Box
                sx={{
                  maxHeight: activeFAQ === 4 ? '200px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.3s ease',
              }}
              >
                <Typography variant="body1" mt={1} sx={{ fontSize: { xs: 15, md: 20 }, fontFamily: 'Nunito, Arial, sans-serif', color: '#22201D', bgcolor: 'white', p: { xs: 2, md: 4 }, borderRadius: 4 }}>
                  No. Your property history is saved. If you come back, you can pick up where you left off.
                </Typography>
              </Box>
            </Box>
          </Box>
          <Typography variant="body1" fontFamily={'Nunito, Arial, sans-serif'} color="#22210D" mt={{ xs: 4, md: 10 }} sx={{ py: 3, px: 2, fontSize: { xs: 18, md: 32 }, borderRadius: 2, backgroundColor: 'white' }}>
            Still have questions? <a href="mailto:support@allproperly.com" style={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#8CB19C', textDecoration: 'none' }}>Contact us at support@allproperly.com</a>.
          </Typography>
        </Box>
      )}
      
      {/* Payment Section */}
      {visibleSections.includes("Payment") && (
      <Box sx={{ width: '100%', mb: { xs: 0, md: -9 }, px: { xs: 1.5, sm: 1.5, md: 8 }, py: { xs: 4, md: 12 }, textAlign: 'center', bgcolor: '#F9F9F9' }}>
        <Typography variant="h4" fontWeight={400} fontFamily={'Nunito, Arial, sans-serif'} mt={activeTab == "Pricing" ? { xs: 12, md: 10 } : { xs: 2, md: -4 }} sx={{ color: '#22210D', fontSize: { xs: 26, sm: 34, md: 48 }, lineHeight: 1.6 }}>
          Simple, transparent pricing.
        </Typography>
        <Typography variant="body1" fontFamily={'Nunito, Arial, sans-serif'} color="#22210D" mb={4} sx={{ fontWeight: 100, fontSize: { xs: 16, md: 20 } }}>
          No hidden fees. Cancel anytime.
        </Typography>
        {/* Toggle between Monthly and Annually */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 4 }}>
          <Typography
            variant="body2"
            color="#545454"
            sx={{
              fontSize: 16,
              fontFamily: 'Nunito, Arial, sans-serif',
              fontWeight: 100,
              cursor: 'pointer',
            }}
            onClick={() => setIsAnnual(false)}
          >
            Monthly
          </Typography>
          <Box 
            sx={{ 
              position: "relative", 
              width: 50, 
              height: 28, 
              mx: 2, 
              cursor: "pointer",
              WebkitTapHighlightColor: 'transparent',
              outline: 'none',
              '&:focus': { outline: 'none' },
              '&:focus-visible': { outline: 'none' }
            }} 
            onClick={handleToggleChange}
          >
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                bgcolor: "#89AE99",
                borderRadius: 14,
                transition: "background 0.2s",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                top: 4,
                left: isAnnual ? 26 : 6,
                width: 19,
                height: 19,
                bgcolor: "#fff",
                borderRadius: "50%",
                boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                transition: "left 0.2s, background 0.2s",
              }}
            />
          </Box>
          <Typography
            variant="body2"
            color="#545454"
            sx={{
              fontSize: 16,
              fontWeight: 100,
              fontFamily: 'Nunito, Arial, sans-serif',
              cursor: 'pointer',
            }}
            onClick={() => setIsAnnual(true)}
          >
            Annually
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, justifyContent: 'center', width: { xs: '100%', md: '75vw' }, mx: 'auto' }}>
          {/* Free Plan */}
          <Box sx={{ flex: 1, border: '1px solid #E0E0E0', p: 3,  borderRadius: 2, textAlign: 'left', height: 'fit-content', bgcolor: 'white' }}>
            <Typography variant="h6" fontFamily={'Nunito, Arial, sans-serif'} mt={-2} color="#22210D" fontWeight={550} mb={2.5} sx={{ fontSize: 32 }}>
              Free
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box component="span" sx={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}> {/* Added padding after checkbox */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.334 2.75H7.665C4.644 2.75 2.75 4.889 2.75 7.916V16.084C2.75 19.111 4.635 21.25 7.665 21.25H16.333C19.364 21.25 21.25 19.111 21.25 16.084V7.916C21.25 4.889 19.364 2.75 16.334 2.75Z" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.43945 12L10.8135 14.373L15.5595 9.62695" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} color="#22210D">
                Manage 1 property
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box component="span" sx={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}> {/* Added padding after checkbox */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.334 2.75H7.665C4.644 2.75 2.75 4.889 2.75 7.916V16.084C2.75 19.111 4.635 21.25 7.665 21.25H16.333C19.364 21.25 21.25 19.111 21.25 16.084V7.916C21.25 4.889 19.364 2.75 16.334 2.75Z" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.43945 12L10.8135 14.373L15.5595 9.62695" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} color="#22210D">
                View the property details
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box component="span" sx={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}> {/* Added padding after checkbox */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.334 2.75H7.665C4.644 2.75 2.75 4.889 2.75 7.916V16.084C2.75 19.111 4.635 21.25 7.665 21.25H16.333C19.364 21.25 21.25 19.111 21.25 16.084V7.916C21.25 4.889 19.364 2.75 16.334 2.75Z" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.43945 12L10.8135 14.373L15.5595 9.62695" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} color="#22210D">
                Access auto-generated tasks
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
              <Box component="span" sx={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.3955 9.59473L9.60352 14.3867" stroke="#FF5F57" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14.3976 14.3898L9.60156 9.59277" stroke="#FF5F57" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.335 2.75H7.66598C4.64498 2.75 2.75098 4.889 2.75098 7.916V16.084C2.75098 19.111 4.63598 21.25 7.66598 21.25H16.334C19.365 21.25 21.251 19.111 21.251 16.084V7.916C21.251 4.889 19.365 2.75 16.335 2.75Z" stroke="#FF5F57" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} color="#E57373">
                Task creation or sharing
              </Typography>
            </Box>
            <Button
              variant="contained"
              sx={{
                bgcolor: '#89AE99',
                color: 'white',
                width: '100%',
                borderRadius: 2.5,
                fontWeight: 100,
                fontSize: 12,
                fontFamily: 'Nunito, Arial, sans-serif',
                px: 3,
                py: 0.55,
                textTransform: 'none',
                '&:hover': { bgcolor: '#89AE99', color: 'white' }
              }}
              href="https://app.allproperly.com/"
            >
              Choose Plan
            </Button>
          </Box>

          {/* Basic Plan */}
          <Box sx={{ flex: 1, border: '1px solid #E0E0E0',  borderRadius: 2, p: 4, textAlign: 'left', height: 'fit-content', bgcolor: 'white' }}>
            <Typography variant="h6" fontFamily={'Nunito, Arial, sans-serif'} mt={-2} color="#22210D" fontWeight={550} mb={-1} sx={{ fontSize: 32 }}>
              Basic
            </Typography>
            <Typography variant="body1" fontFamily={'Nunito, Arial, sans-serif'} color="#22210D" mb={isAnnual ? 0 : 2.5} sx={{ opacity: 0.6, fontSize: 22 }}>
              {isAnnual ? "$100 / year" : "$15 / month"}
            </Typography>
            {isAnnual && (
              <Typography variant="body2" fontFamily={'Nunito, Arial, sans-serif'} color="#22210D" mb={4} sx={{ opacity: 0.6, fontSize: 16 }}>
                (just $8.33/mo - save 45%)
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box component="span" sx={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.334 2.75H7.665C4.644 2.75 2.75 4.889 2.75 7.916V16.084C2.75 19.111 4.635 21.25 7.665 21.25H16.333C19.364 21.25 21.25 19.111 21.25 16.084V7.916C21.25 4.889 19.364 2.75 16.334 2.75Z" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.43945 12L10.8135 14.373L15.5595 9.62695" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} color="#22210D">
                Manage up to <b>5 properties</b>
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box component="span" sx={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.334 2.75H7.665C4.644 2.75 2.75 4.889 2.75 7.916V16.084C2.75 19.111 4.635 21.25 7.665 21.25H16.333C19.364 21.25 21.25 19.111 21.25 16.084V7.916C21.25 4.889 19.364 2.75 16.334 2.75Z" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.43945 12L10.8135 14.373L15.5595 9.62695" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} color="#22210D">
                Create & edit tasks
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box component="span" sx={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.334 2.75H7.665C4.644 2.75 2.75 4.889 2.75 7.916V16.084C2.75 19.111 4.635 21.25 7.665 21.25H16.333C19.364 21.25 21.25 19.111 21.25 16.084V7.916C21.25 4.889 19.364 2.75 16.334 2.75Z" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.43945 12L10.8135 14.373L15.5595 9.62695" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} color="#22210D">
                Task history + health barometer
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box component="span" sx={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.334 2.75H7.665C4.644 2.75 2.75 4.889 2.75 7.916V16.084C2.75 19.111 4.635 21.25 7.665 21.25H16.333C19.364 21.25 21.25 19.111 21.25 16.084V7.916C21.25 4.889 19.364 2.75 16.334 2.75Z" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.43945 12L10.8135 14.373L15.5595 9.62695" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} color="#22210D">
                Weather & seasonal reminders
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
              <Box component="span" sx={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.334 2.75H7.665C4.644 2.75 2.75 4.889 2.75 7.916V16.084C2.75 19.111 4.635 21.25 7.665 21.25H16.333C19.364 21.25 21.25 19.111 21.25 16.084V7.916C21.25 4.889 19.364 2.75 16.334 2.75Z" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.43945 12L10.8135 14.373L15.5595 9.62695" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} color="#22210D">
                Share & invite family or managers
              </Typography>
            </Box>
            <Button
              variant="contained"
              sx={{
                bgcolor: '#89AE99',
                color: 'white',
                width: '100%',
                borderRadius: 2.5,
                fontWeight: 100,
                fontSize: 12,
                fontFamily: 'Nunito, Arial, sans-serif',
                px: 3,
                py: 0.55,
                textTransform: 'none',
                '&:hover': { bgcolor: '#89AE99', color: 'white' }
              }}
              href="https://app.allproperly.com/"
            >
              Choose Plan
            </Button>
          </Box>

          {/* Plus Plan */}
          <Box sx={{ flex: 1, border: '1px solid #E0E0E0',  borderRadius: 2, p: 4, textAlign: 'left', height: 'fit-content', bgcolor: 'white' }}>
            <Typography variant="h6" fontFamily={'Nunito, Arial, sans-serif'} mt={-2} color="#22210D" mb={-1} fontWeight={550} sx={{ fontSize: 32 }}>
              Plus
            </Typography>
            <Typography variant="body1" fontFamily={'Nunito, Arial, sans-serif'} color="#212121" mb={isAnnual ? 0 : 2.5} sx={{ opacity: 0.6, fontSize: 22 }}>
              {isAnnual ? "$200 / year" : "$30 / month"}
            </Typography>
            {isAnnual && (
              <Typography variant="body2" fontFamily={'Nunito, Arial, sans-serif'} color="#22210D" mb={4} sx={{ opacity: 0.6, fontSize: 16 }}>
                (just $16.67/mo - save 45%)
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box component="span" sx={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.334 2.75H7.665C4.644 2.75 2.75 4.889 2.75 7.916V16.084C2.75 19.111 4.635 21.25 7.665 21.25H16.333C19.364 21.25 21.25 19.111 21.25 16.084V7.916C21.25 4.889 19.364 2.75 16.334 2.75Z" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.43945 12L10.8135 14.373L15.5595 9.62695" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} color="#22210D">
                Manage up to <b>10 properties</b>
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box component="span" sx={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.334 2.75H7.665C4.644 2.75 2.75 4.889 2.75 7.916V16.084C2.75 19.111 4.635 21.25 7.665 21.25H16.333C19.364 21.25 21.25 19.111 21.25 16.084V7.916C21.25 4.889 19.364 2.75 16.334 2.75Z" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.43945 12L10.8135 14.373L15.5595 9.62695" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} color="#22210D">
                Everything in Basic Plan
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
              <Box component="span" sx={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.334 2.75H7.665C4.644 2.75 2.75 4.889 2.75 7.916V16.084C2.75 19.111 4.635 21.25 7.665 21.25H16.333C19.364 21.25 21.25 19.111 21.25 16.084V7.916C21.25 4.889 19.364 2.75 16.334 2.75Z" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.43945 12L10.8135 14.373L15.5595 9.62695" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} color="#22210D">
                More space for growing portfolios
              </Typography>
            </Box>
            <Button
              variant="contained"
              sx={{
                bgcolor: '#89AE99',
                color: 'white',
                width: '100%',
                borderRadius: 2.5,
                fontWeight: 100,
                fontFamily: 'Nunito, Arial, sans-serif',
                fontSize: 12,
                px: 3,
                py: 0.55,
                textTransform: 'none',
                '&:hover': { bgcolor: '#89AE99', color: 'white' }
              }}
              href="https://app.allproperly.com/"
            >
              Choose Plan
            </Button>
          </Box>
        </Box>
      </Box>)}

      {/* Screenshot Section */}
      {visibleSections.includes("Screenshot Section") && (
        <Box sx={{ width: '80vw', px: { xs: 2, sm: 3, md: 8 }, py: { xs: 4, md: 8 }, textAlign: 'center', bgcolor: '#F9F9F9', color: '#22210D', mx: 'auto', mt: 3 }}>
          <Typography variant="h6" fontFamily={'Nunito, Arial, sans-serif'} fontWeight={200} mb={2} sx={{ color: '#89AE99', fontSize: { xs: 12, md: 14 }, letterSpacing: 1 }}>
            ABOUT US
          </Typography>
          <Typography variant="h4" fontFamily={'Nunito, Arial, sans-serif'} fontWeight={400} mb={4} sx={{ color: '#22201D', fontSize: { xs: 24, md: 40 }, lineHeight: 1.6 }}>
            Why We Built AllProperly
          </Typography>
          <Typography variant="body1" color="#22210D" mb={4} sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 100, fontSize: { xs: 16, md: 28 }, color: '#22201D', lineHeight: 1.5 }}>
            Owning a home is one thing. Keeping track of everything it needs is another. From seasonal chores to expensive replacements, homeowners are often left reacting to problems instead of staying ahead.
          </Typography>
          <Typography variant="body1" color="#22210D" mb={4} sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 100, fontSize: { xs: 16, md: 28 }, color: '#22201D', lineHeight: 1.5 }}>
            We built AllProperly to change that. Our mission is simple: help homeowners, landlords, and families keep properties in proper order without the stress.
          </Typography>
          <Typography variant="body1" color="#22210D" mb={4} sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 100, fontSize: { xs: 16, md: 28 }, color: '#22201D', lineHeight: 1.5 }}>
            AllProperly turns maintenance into a plan you can follow—track tasks, forecast costs, and share responsibilities so nothing slips through the cracks.
          </Typography>
        </Box>
      )}

      {/* New Section */}
      {visibleSections.includes("New Section") && (
        <Box sx={{ width: { xs: 'calc(100% - 24px)', md: '92.8vw' }, maxWidth: { md: '92.8vw' }, mb: 3, px: { xs: 2, sm: 3, md: 8 }, py: { xs: 4, md: 8 }, textAlign: 'center', bgcolor: '#89AE99', color: 'white', borderRadius: 4, boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)', mx: 'auto', mt: 3 }}>
          <Typography variant="h4" fontWeight={300} mb={4} sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 20, sm: 28, md: 48 }, lineHeight: 1.4, paddingRight: { xs: 0, md: 15 }, paddingLeft: { xs: 0, md: 15 } }}>
            One day, when you buy or sell a home, you’ll be able to see how it was maintained—like a Carfax for houses. 
            <span style={{ fontWeight: 550 }}> AllProperly is building that future, starting with your property today.</span>
          </Typography>
          <Button
            variant="contained"
            sx={{
              bgcolor: 'white',
              color: '#22210D',
              borderRadius: 99,
              fontFamily: 'Nunito, Arial, sans-serif',
              fontWeight: 300,
              fontSize: 15.5,
              px: 4,
              py: 1.5,
              '&:hover': { bgcolor: '#E0E0E0', color: '#22210D' }
            }}
            href="https://app.allproperly.com"
          >
            Get started today
          </Button>
        </Box>
      )}

      {/* Footer Section - Original desktop layout (absolute positions). Mobile: stacked responsive. */}
      {visibleSections.includes("Footer Section") && (
        <Box sx={{ width: { xs: 'calc(100% - 24px)', md: '92.8vw' }, maxWidth: { md: '92.8vw' }, px: { xs: 2, sm: 3, md: 8 }, py: { xs: 2, md: 8 }, mb: { xs: 2, md: '100px' }, textAlign: 'left', bgcolor: 'white', borderRadius: 4, boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)', mx: 'auto', mt: 6, position: 'relative' }}>
          {/* Logo - original: absolute top-left on desktop; in flow on mobile */}
          <Box sx={{ position: { xs: 'relative', md: 'absolute' }, top: { md: 15 }, left: { md: 10 }, mb: { xs: 2, md: 0 }, width: { xs: '100%', md: 'auto' }, display: 'flex', justifyContent: { xs: 'center', md: 'flex-start' } }}>
            <img src="/All_Properly_logo-01.png" alt="AllProperly Logo" style={{ width: '100%', maxWidth: 220, borderRadius: 4 }} />
          </Box>
          {/* Links - original: centered full width with negative margin on desktop; two columns on mobile */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'row', sm: 'row' }, alignItems: 'flex-start', gap: { xs: 6, md: 8 }, justifyContent: 'center', width: '100%', mt: { xs: 0, md: 0 } }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, mt: { xs: 0, md: 0 } }}>
              <Typography variant="body2" color="#22210D" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14, cursor: 'pointer', textAlign: 'left', '&:hover': { textDecoration: 'underline' } }} onClick={() => handleNavClick('Features')}>Features</Typography>
              <Typography variant="body2" color="#22210D" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14, cursor: 'pointer', textAlign: 'left', '&:hover': { textDecoration: 'underline' } }} onClick={() => handleNavClick('About')}>About</Typography>
              <Typography variant="body2" color="#22210D" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14, cursor: 'pointer', textAlign: 'left', '&:hover': { textDecoration: 'underline' } }} onClick={() => handleNavClick('Support')}>Support</Typography>
              <Typography variant="body2" color="#22210D" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14, cursor: 'pointer', textAlign: 'left', '&:hover': { textDecoration: 'underline' } }}>Contact</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, mt: { xs: 0, md: 0 } }}>
              <Typography variant="body2" color="#22210D" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14, cursor: 'pointer', textAlign: 'left', '&:hover': { textDecoration: 'underline' } }} onClick={() => handleNavClick('Pricing')}>Pricing</Typography>
              <Typography variant="body2" color="#22210D" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14, cursor: 'pointer', textAlign: 'left', '&:hover': { textDecoration: 'underline' } }} onClick={() => handleNavClick('FAQs')}>FAQs</Typography>
              <Typography variant="body2" color="#22210D" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14, cursor: 'pointer', textAlign: 'left', '&:hover': { textDecoration: 'underline' } }}>Help Center</Typography>
              <Typography variant="body2" color="#22210D" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14, cursor: 'pointer', textAlign: 'left', '&:hover': { textDecoration: 'underline' } }}>Cookie Preferences</Typography>
            </Box>
          </Box>
          {/* YouTube & Copyright - same line on mobile, absolute positions on desktop */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column-reverse', md: 'row' }, alignItems: { xs: 'center', md: 'center' }, justifyContent: { xs: 'center', md: 'space-between' }, width: '100%', mt: { xs: 2, md: 0 } }}>
            {/* YouTube */}
            <Box sx={{ position: { xs: 'relative', md: 'absolute' }, bottom: { md: 16 }, left: { md: 35 }, mt: { xs: 1, md: 0 } }}>
              <a href="https://www.youtube.com/@AllProperly" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block' }}>
                <svg width="19" height="14" viewBox="0 0 19 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.3161 3.34953C18.3161 3.34953 18.1421 2.12053 17.6061 1.58053C16.9261 0.870531 16.1671 0.866531 15.8191 0.825531C13.3261 0.644531 9.58209 0.644531 9.58209 0.644531H9.57509C9.57509 0.644531 5.83109 0.644531 3.33709 0.824531C2.98909 0.866531 2.23009 0.870531 1.55109 1.58053C1.01409 2.12053 0.844086 3.35053 0.844086 3.35053C0.844086 3.35053 0.663086 4.79553 0.663086 6.23753V7.58853C0.663086 9.03053 0.840086 10.4755 0.840086 10.4755C0.840086 10.4755 1.01409 11.7055 1.54709 12.2455C2.22709 12.9555 3.11709 12.9305 3.51509 13.0075C4.94309 13.1435 9.57809 13.1855 9.57809 13.1855C9.57809 13.1855 13.3261 13.1785 15.8191 13.0005C16.1671 12.9585 16.9271 12.9555 17.6061 12.2445C18.1421 11.7045 18.3161 10.4755 18.3161 10.4755C18.3161 10.4755 18.4941 9.03353 18.4941 7.58853V6.23753C18.4941 4.79553 18.3161 3.35053 18.3161 3.35053M7.73609 9.22953V4.21653L12.5531 6.73053L7.73609 9.22953Z" fill="#2A2926"/>
                </svg>
              </a>
            </Box>
            {/* Copyright */}
            <Box sx={{ position: { xs: 'relative', md: 'absolute' }, fontFamily: 'Nunito, Arial, sans-serif', bottom: { md: 16 }, right: { md: 16 }, mb: { xs: 0, md: 0 }, mt: { xs: 2, md: 0 } }}>
                <Typography variant="body2" color="#777573" sx={{ fontSize: { xs: 12, md: 14 } }}>Copyright © 2025 AllProperly, Inc. All rights reserved.</Typography>
              </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default LandingPage;