import React from 'react';
import { Box, Typography } from '@mui/material';

export interface HomeSetupStep {
  label: string;
  done: boolean;
}

interface HomeSetupJourneyProps {
  steps: HomeSetupStep[];
}

const HomeSetupJourney: React.FC<HomeSetupJourneyProps> = ({ steps }) => (
  <Box sx={{
    maxWidth: 360,
    mx: 'auto',
    p: 0,
    bgcolor: 'transparent',
    borderRadius: 0,
    boxShadow: 'none',
  }}>
    <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
      Andrii Home Setup Journey
    </Typography>
    {steps.map((step, idx) => (
      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Box sx={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          bgcolor: step.done ? '#89AE99' : '#F7C873',
          flexShrink: 0,
        }} />
        <Typography sx={{
          fontSize: { xs: 14, sm: 15, md: 16 },
          color: '#555',
          fontFamily: 'Nunito, Arial, sans-serif',
          fontWeight: 400,
          wordBreak: 'break-word',
          whiteSpace: 'normal',
          maxWidth: '100%',
        }}>
          {step.label}
        </Typography>
      </Box>
    ))}
  </Box>
);

export default HomeSetupJourney;
