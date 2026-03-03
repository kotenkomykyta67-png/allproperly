import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { DoubleCircleProgress } from '../DoubleCircleProgress';
import { getSubLabel, getEstimateString, getRecommendedString, getRecommendedMonthly, getProgressColor } from '../../utils/forecastingUtils';

interface ForecastingData {
  Roof?: {
    type?: string;
    cost?: number;
    lifespan?: number;
    installDate?: string;
  };
  HVAC?: {
    cost?: number;
    lifespan?: number;
    installDate?: string;
  };
  WaterHeater?: {
    cost?: number;
    lifespan?: number;
    installDate?: string;
  };
}

export interface ForecastingSectionProps {
  forecasting?: ForecastingData;
  roofProgress: number;
  hvacProgress: number;
  waterProgress: number;
  sidebar?: boolean;
  onEditClick: () => void;
}

const ForecastingSection: React.FC<ForecastingSectionProps> = ({
  forecasting,
  roofProgress,
  hvacProgress,
  waterProgress,
  sidebar = false,
  onEditClick,
}) => {
  const roof = getRecommendedMonthly(forecasting?.Roof);
  const hvac = getRecommendedMonthly(forecasting?.HVAC);
  const water = getRecommendedMonthly(forecasting?.WaterHeater);
  const totalMonthly = roof + hvac + water;

  return (
    <>
      <Paper sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.13)', pt: { xs: 2, sm: 4 }, pb: { xs: 4, sm: 6 }, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, position: 'relative' }}>
        <Button 
          size="small" 
          onClick={onEditClick} 
          sx={{ position: 'absolute', top: 40, right: 50, minWidth: 0, px: 2, py: 0.5, fontSize: 13, fontWeight: 400, borderRadius: 2, background: '#fff', border: '1px solid #B0B8C1', color: '#333', boxShadow: 'none', textTransform: 'none', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }}
        >
          Edit
        </Button>
        <Typography
          variant="h5"
          fontWeight={550}
          sx={{ 
            textAlign: 'center',
            mb: 5, 
            color: '#343748',
            fontFamily: 'Nunito, Arial, sans-serif',
            fontSize: { xs: 18, sm: 22, md: 26 } 
          }}
        >
          Forecasting and Planning
        </Typography>
        
        {/* Responsive progress circles */}
        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'stretch',
          gap: { xs: 2, sm: 4, md: sidebar ? 12 : 6 },
          mt: { xs: 2, sm: 4 },
        }}>
          <Box sx={{ flex: '1 1 260px', minWidth: 180, maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: { xs: 2, sm: 0 } }}>
            <DoubleCircleProgress
              percentage={Math.floor(roofProgress)}
              color={getProgressColor(roofProgress)}
              label="Roof"
              subLabel={getSubLabel(forecasting?.Roof)}
              estimate={getEstimateString(forecasting?.Roof)}
              recommended={getRecommendedString(forecasting?.Roof)}
              recommendedColor="#89AE99"
            />
          </Box>
          <Box sx={{ flex: '1 1 260px', minWidth: 180, maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: { xs: 2, sm: 0 } }}>
            <DoubleCircleProgress
              percentage={Math.floor(hvacProgress)}
              color={getProgressColor(hvacProgress)}
              label="HVAC System"
              subLabel={getSubLabel(forecasting?.HVAC)}
              estimate={getEstimateString(forecasting?.HVAC)}
              recommended={getRecommendedString(forecasting?.HVAC)}
              recommendedColor="#E5B26B"
            />
          </Box>
          <Box sx={{ flex: '1 1 260px', minWidth: 180, maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: { xs: 2, sm: 0 } }}>
            <DoubleCircleProgress
              percentage={Math.floor(waterProgress)}
              color={getProgressColor(waterProgress)}
              label="Water Heater"
              subLabel={getSubLabel(forecasting?.WaterHeater)}
              estimate={getEstimateString(forecasting?.WaterHeater)}
              recommended={getRecommendedString(forecasting?.WaterHeater)}
              recommendedColor="#D36666"
            />
          </Box>
        </Box>
      </Paper>
      
      {/* Bottom bar with recommended monthly amount */}
      <Box sx={{
        background: '#3A3A3A',
        color: '#fff',
        borderTopLeftRadius: 0, 
        borderTopRightRadius: 0, 
        borderBottomLeftRadius: 8, 
        borderBottomRightRadius: 8,
        mb: 1.5,
        px: { xs: 1, sm: 4, md: 6 },
        py: { xs: 1, sm: 2 },
        textAlign: 'center',
        fontSize: { xs: 16, sm: 20, md: 24 },
        fontWeight: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: 48,
      }}>
        Recommended money to set aside per month: 
        <span style={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#fff', marginLeft: 8, fontWeight: 550 }}>
          ${totalMonthly.toFixed(2)}
        </span>
      </Box>
    </>
  );
};

export default React.memo(ForecastingSection);
