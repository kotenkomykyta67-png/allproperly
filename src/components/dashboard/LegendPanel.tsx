import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { getAuth } from 'firebase/auth';
import { getLatestPropertyTax, calculateForecastingMonthly } from '../../utils/dashboardUtils';

interface PropertyItem {
  id: string;
  ownerId?: string;
  noMortgage?: boolean;
  hoa?: string;
  yearly?: string;
  pmi?: string;
  isPT?: boolean;
  insurance?: { amount?: string; frequency?: string };
  propertyTaxHistory?: Array<{ date: string; amount: string }>;
  mortgagePaymentAmount?: string;
  forecasting?: {
    Roof?: { type?: string; cost?: number; lifespan?: number; installDate?: string };
    HVAC?: { cost?: number; lifespan?: number; installDate?: string };
    WaterHeater?: { cost?: number; lifespan?: number; installDate?: string };
  };
  sharedWith?: Array<{ userId: string; role?: string }>;
}

interface LegendPanelProps {
  properties: PropertyItem[];
  rentalOnlyIncome: number;
  rentalOnlyExpenses: number;
  rentalOnlyPrice: number;
  rentalOnlyBalance: number;
  rentalOnlyMortgage: number;
  rentalOnlyInsurance: number;
  rentalOnlyForecasting: number;
  rentalOnlyPM: number;
  rentalOnlyHOA: number;
  rentalOnlyPMI: number;
  onScrollLeft: () => void;
  onScrollRight: () => void;
}

const LegendPanel: React.FC<LegendPanelProps> = ({
  properties,
  rentalOnlyIncome,
  rentalOnlyExpenses,
  rentalOnlyPrice,
  rentalOnlyBalance,
  rentalOnlyMortgage,
  rentalOnlyInsurance,
  rentalOnlyForecasting,
  rentalOnlyPM,
  rentalOnlyHOA,
  rentalOnlyPMI,
  onScrollLeft,
  onScrollRight,
}) => {
  const profitVal = rentalOnlyIncome - rentalOnlyExpenses;
  const amountPaidOff = Math.max(0, rentalOnlyPrice - rentalOnlyBalance);

  // Build a list of properties where the user is owner or co-owner (exclude PM/Friend roles)
  const auth = getAuth();
  const user = auth.currentUser;
  const ownerFiltered = (properties || []).filter(p => {
    if (!user) return false;
    if (p.ownerId === user.uid) return true;
    if (Array.isArray(p.sharedWith)) {
      const entry = p.sharedWith.find((sw: any) => sw.userId === user.uid);
      if (entry && entry.role !== 'PM' && entry.role !== 'Property Manager' && entry.role !== 'Friend' && entry.role !== 'Friend Manager') return true;
    }
    return false;
  });

  // Presence flags: show these legend items if at least one owner/co-owner property has a non-zero amount
  const anyForecasting = ownerFiltered.some(p => {
    const forecastingMonthly = calculateForecastingMonthly(p.forecasting);
    return forecastingMonthly > 0;
  });

  const anyHOA = ownerFiltered.some(p => {
    if (p.noMortgage) return false;
    let hoaAmount = p.hoa ? parseFloat(p.hoa as any) : 0;
    if (p.yearly === 'Yearly') hoaAmount = hoaAmount / 12;
    return hoaAmount > 0;
  });

  const anyPMI = ownerFiltered.some(p => {
    if (p.noMortgage) return false;
    const pmiAmount = p.pmi ? parseFloat(p.pmi as any) : 0;
    return pmiAmount > 0;
  });

  const anyInsurance = ownerFiltered.some(p => {
    if (p.isPT && !p.noMortgage) return false;
    
    let insuranceAmount = p.insurance?.amount ? parseFloat(p.insurance.amount as any) : 0;
    if (p.insurance?.frequency === 'Yearly') insuranceAmount = insuranceAmount / 12;
    const propertyTaxAmount = getLatestPropertyTax(p.propertyTaxHistory || []);
    const propertyTaxMonthly = propertyTaxAmount / 12;
    return (insuranceAmount + propertyTaxMonthly) > 0;
  });

  const anyMortgage = ownerFiltered.some(p => {
    if (p.noMortgage) return false;
    const mortgageAmount = parseFloat(p.mortgagePaymentAmount as any) || 0;
    return mortgageAmount > 0;
  });

  // Always include Amount Paid Off first
  const legendSegments: Array<{ color: string; label: string; value?: number }> = [
    { color: '#658093', label: 'Amount Paid Off', value: amountPaidOff },
  ];

  // Add items in the specified order when they have non-zero values
  if (anyMortgage) legendSegments.push({ color: '#E35E61', label: 'Mortgage', value: rentalOnlyMortgage });
  if (profitVal && profitVal > 0) legendSegments.push({ color: '#89AE99', label: 'Profit', value: profitVal });
  if (anyInsurance) legendSegments.push({ color: '#EEB05E', label: 'Taxes/Insurance', value: rentalOnlyInsurance });
  if (anyForecasting) legendSegments.push({ color: '#D2794F', label: 'Forecasting/Planning', value: rentalOnlyForecasting });
  if (rentalOnlyPM && rentalOnlyPM > 0) legendSegments.push({ color: '#B38796', label: 'Property Management', value: rentalOnlyPM });
  if (anyHOA) legendSegments.push({ color: '#db83ad', label: 'HOA', value: rentalOnlyHOA });
  if (anyPMI) legendSegments.push({ color: '#C45584', label: 'PMI', value: rentalOnlyPMI });

  const count = legendSegments.length;
  const mobileGridColumns = count >= 3 ? '1fr 1fr 1fr' : count === 2 ? '1fr 1fr' : '1fr';
  const mobileJustify = count === 1 ? 'center' : 'flex-start';
  // Below 400px, cap at 2 columns
  const smallMobileGridColumns = count >= 2 ? '1fr 1fr' : '1fr';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, md: 2 }, mb: 1.5, px: { xs: 0, md: 1 }, ml: { xs: 0, md: -1 }, justifyContent: 'space-between' }}>
      {/* Legend Panel — on mobile: 3 cols (3+ items), 2 cols (2 items), center (1 item); desktop: wrap */}
      <Box sx={{ bgcolor: '#fff', borderRadius: 2, px: 2, py: 2, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'center', flex: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.13)' }}>
        <Box sx={{
          display: { xs: 'grid', md: 'flex' },
          gridTemplateColumns: { xs: smallMobileGridColumns, sm: mobileGridColumns, md: 'none' },
          '@media (min-width: 400px) and (max-width: 899.95px)': {
            gridTemplateColumns: mobileGridColumns,
          },
          justifyContent: { xs: mobileJustify, md: 'center' },
          gap: 1,
          alignItems: 'center',
          flexWrap: { md: 'wrap' },
          mx: 0,
          width: { xs: '100%', md: 'auto' },
        }}>
          {legendSegments.map((item, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: { xs: 0, md: 2 }, mb: { xs: 0, md: 0.5 }, width: { xs: count === 1 ? 'fit-content' : 'auto', md: 'auto' }, justifySelf: { xs: count === 1 ? 'center' : 'start', md: undefined } }}>
              <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 13, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', whiteSpace: 'nowrap' }}>
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Carousel Navigation Buttons — hidden on mobile */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <IconButton
          sx={{
            bgcolor: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
            borderRadius: 2,
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
            borderRadius: 2,
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
        <Box sx={{ width: 2, opacity: 0, height: 5, flexShrink: 0, marginLeft: -1 }} />
      </Box>
    </Box>
  );
};

export default LegendPanel;
