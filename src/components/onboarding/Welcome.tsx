import React from "react";
import { getAuth } from "firebase/auth";
import { Box, Typography, Button, } from "@mui/material";
import logo from "/All_Properly_logo-02.png";

interface WelcomeProps {
  onNext: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onNext }) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="100vh"
      width="100%"
      bgcolor="white"
      fontFamily="Nunito, Arial, sans-serif"
      position="relative"
      textAlign="center"
      px={2}
    >

      {/* Step Counter */}
      <Typography
        variant="body2"
        sx={{ position: "absolute", top: 28, right: 24, color: "#6B7280", fontSize: "24px" }}
      >
        1/5
      </Typography>

      {/* Logo */}
      <Box
        component="img"
        src={logo}
        alt="Welcome"
        sx={{
          width: "24%",
          height: "auto",
          ml: 2,
          mb: 5,
          mt: -10,
        }}
      />

      {/* Greeting */}
      <Typography
        sx={{ fontSize: "24px", color: "#6B7280",fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}
      >
        {(() => {
          const user = getAuth().currentUser;
          let firstName = "";
          if (user && user.displayName) {
            firstName = user.displayName.split(" ")[0];
          }
          return `We’re glad you’re here${firstName ? ", " + firstName : ""}!`;
        })()}
      </Typography>

      {/* Title */}
      <Typography
        sx={{
          fontSize: "42px",
          fontWeight: 600,
          lineHeight: 1.4,
          fontFamily: 'Nunito, Arial, sans-serif',
          color: "#374151",
          mb: 14,
        }}
      >
        Answer a few questions <br /> to set up your property.
      </Typography>

      {/* Button */}
      <Button
        variant="contained"
        onClick={onNext}
        sx={{
          backgroundColor: "#89AE99",
          fontSize: "18px",
          fontWeight: 400,
          px: 12,
          py: 1.5,
          maxWidth: "260",
          borderRadius: "8px",
          fontFamily: 'Nunito, Arial, sans-serif',
          textTransform: "none",
        }}
      >
        Get Started
      </Button>
    </Box>
  );
};

export default Welcome;
