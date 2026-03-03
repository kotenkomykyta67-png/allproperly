import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { GaugeProgress } from '../GaugeProgress';

export interface PropertyHealthSectionProps {
  completedTasksThisMonth: number;
  totalOverallHealthValue: number;
  topContributor: string;
}

const PropertyHealthSection: React.FC<PropertyHealthSectionProps> = ({
  completedTasksThisMonth,
  totalOverallHealthValue,
  topContributor,
}) => {
  return (
    <Paper sx={{ p: { xs: 2, sm: 4 }, borderRadius: 2, mb: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.13)', position: 'relative', background: '#fff' }}>
      <Typography variant="h5" fontWeight={550} sx={{ textAlign: 'center', mb: 1.5, color: '#343748', fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 18, sm: 22, md: 26 } }}>
        Overall Property Health
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: { xs: 3, sm: 4, md: 6 },
          width: '100%',
          minHeight: 180,
          py: { xs: 2, md: 3 },
        }}
      >
        {/* Left: Tasks completed */}
        <Box sx={{ overflow: 'hidden', width: 'fit-content', flex: 1, textAlign: 'center', pl: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 180 }}>
          <Typography sx={{ fontWeight: 550, color: '#343748', mb: 1, fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 19, sm: 22, md: 26 } }}>
            Tasks completed this month
          </Typography>
          <Typography sx={{ fontWeight: 550, color: '#89AE99', mb: 1, fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 22, sm: 28, md: 36 } }}>
            {completedTasksThisMonth}
          </Typography>
          <Typography sx={{ color: '#343748', mt: 1, fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 12, sm: 14, md: 15 } }}>
            This property is in a <span style={{ color: '#89AE99', fontWeight: 550 }}>good condition</span>,<br />continue completing tasks to boost your score
          </Typography>
        </Box>

        {/* Center: GaugeProgress chart */}
        <Box sx={{ flex: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 260 }}>
          <Box
            sx={{
              width: '100%',
              maxWidth: { xs: 340, sm: 440, md: 540, lg: 600 },
              minWidth: 200,
              aspectRatio: '2 / 1.25',
              mx: 'auto',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              pb: { xs: 3, sm: 4, md: 6 },
              overflow: 'visible',
            }}
          >
            <GaugeProgress percentage={totalOverallHealthValue} whichfrom={false} />
          </Box>
          <Typography sx={{ fontWeight: 550, color: '#343748', fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 15, sm: 18, md: 22 } }}>
            Current overall health: <span style={{ color: '#89AE99' }}>{totalOverallHealthValue}%</span>
          </Typography>
        </Box>

        {/* Right: Top contributor */}
        <Box sx={{ overflow: 'hidden', width: 'fit-content', flex: 1, textAlign: 'center', pl: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 180 }}>
          <Typography sx={{ fontWeight: 550, color: '#343748', mb: 1, fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 19, sm: 22, md: 26 } }}>
            Top monthly contributor
          </Typography>
          <Typography sx={{ fontWeight: 550, color: '#89AE99', mb: 1, fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 22, sm: 28, md: 36 } }}>
            {topContributor}
          </Typography>
          <Typography sx={{ color: '#343748', mt: 1, fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 12, sm: 14, md: 15 } }}>
            The dark blue line shows your Home Shield. Complete tasks to charge it up and protect your home.
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default React.memo(PropertyHealthSection);
