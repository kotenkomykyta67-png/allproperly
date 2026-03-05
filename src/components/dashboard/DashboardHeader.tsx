import React from "react";
import { Box, Typography, Button, IconButton, useTheme, useMediaQuery } from "@mui/material";

interface DashboardHeaderProps {
  onScrollLeft: () => void;
  onScrollRight: () => void;
  onAddClick?: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onScrollLeft,
  onScrollRight,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, ml: -1, px: 1 }}>
      <Typography variant="h5" sx={{ fontWeight: 550, fontSize: 18, color: '#222', fontFamily: 'Nunito, Arial, sans-serif' }}>Dashboard</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button variant="outlined" sx={{ ":hover": {borderColor: '#222'}, bgcolor: '#fff', color: '#343748', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', textTransform: 'none', borderColor: '#e0e0e0', px: { xs: 1, sm: 2 }, py: { xs: 0.5, sm: 1 }, fontSize: { xs: 13, sm: 16 }, borderRadius: 2 }}>
          <span style={{ marginRight: 8, display: 'flex', alignItems: 'center' }}>
            <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M6.7708 12.3952H2.57013C2.29413 12.3952 2.07013 12.1712 2.07013 11.8952C2.07013 11.6192 2.29413 11.3952 2.57013 11.3952H6.7708C7.0468 11.3952 7.2708 11.6192 7.2708 11.8952C7.2708 12.1712 7.0468 12.3952 6.7708 12.3952Z" fill="#1F1F1F"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M11.6425 10.8053C11.0492 10.8053 10.5665 11.2827 10.5665 11.8693C10.5665 12.4567 11.0492 12.9333 11.6425 12.9333C12.2352 12.9333 12.7172 12.4567 12.7172 11.8693C12.7172 11.2827 12.2352 10.8053 11.6425 10.8053ZM11.6425 13.9334C10.4979 13.9334 9.56653 13.0074 9.56653 11.8694C9.56653 10.7314 10.4979 9.80536 11.6425 9.80536C12.7865 9.80536 13.7172 10.7314 13.7172 11.8694C13.7172 13.0074 12.7865 13.9334 11.6425 13.9334Z" fill="#1F1F1F"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M12.8447 5.93365H8.64465C8.36865 5.93365 8.14465 5.70965 8.14465 5.43365C8.14465 5.15765 8.36865 4.93365 8.64465 4.93365H12.8447C13.1207 4.93365 13.3447 5.15765 13.3447 5.43365C13.3447 5.70965 13.1207 5.93365 12.8447 5.93365Z" fill="#1F1F1F"/>
              <mask id="mask0_2394_3645" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="2" y="3" width="5" height="5">
                <path fillRule="evenodd" clipRule="evenodd" d="M2.05072 3.33362H6.20125V7.46135H2.05072V3.33362Z" fill="white"/>
              </mask>
              <g mask="url(#mask0_2394_3645)">
                <path fillRule="evenodd" clipRule="evenodd" d="M4.12591 4.33333C3.53324 4.33333 3.05058 4.81067 3.05058 5.398C3.05058 5.98467 3.53324 6.46133 4.12591 6.46133C4.71924 6.46133 5.20124 5.98467 5.20124 5.398C5.20124 4.81067 4.71924 4.33333 4.12591 4.33333ZM4.12584 7.46119C2.98184 7.46119 2.05051 6.53586 2.05051 5.39786C2.05051 4.25986 2.98184 3.33319 4.12584 3.33319C5.27051 3.33319 6.20117 4.25986 6.20117 5.39786C6.20117 6.53586 5.27051 7.46119 4.12584 7.46119Z" fill="#1F1F1F"/>
              </g>
            </svg>
          </span>
          Customize
        </Button>
        <Box sx={{ width: 8 }} />
        <IconButton
          sx={{
            bgcolor: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
            borderRadius: '50%',
            p: 1,
            transition: 'box-shadow 0.2s',
            '&:active': { boxShadow: '0 2px 8px rgba(0,0,0,0.13)' },
            '&:focus': { boxShadow: '0 2px 8px rgba(0,0,0,0.13)' },
            '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.18)' },
          }}
          onClick={onScrollLeft}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6l-6 6 6 6" stroke="#212121" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </IconButton>
        <IconButton
          sx={{
            bgcolor: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
            borderRadius: '50%',
            p: 1,
            transition: 'box-shadow 0.2s',
            '&:active': { boxShadow: '0 2px 8px rgba(0,0,0,0.13)' },
            '&:focus': { boxShadow: '0 2px 8px rgba(0,0,0,0.13)' },
            '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.18)' },
          }}
          onClick={onScrollRight}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6l6 6-6 6" stroke="#212121" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </IconButton>
      </Box>
    </Box>
  );
};

export default DashboardHeader;
