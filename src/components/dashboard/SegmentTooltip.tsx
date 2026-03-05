import React from 'react';
import { Box, Typography } from '@mui/material';
import { formatCurrency } from '../../utils/dashboardUtils';

// Source types that match MainDashboard's hoveredSegment type
export type SegmentSource = 'rental' | 'homeowner' | 'portfolio' | 'pm' | 'pm-summary' | 'friend-health' | 'rental-inner' | 'homeowner-inner' | 'portfolio-inner' | 'all-properties' | 'all-properties-inner';

export interface SegmentTooltipData {
  label: string;
  percent: number;
  amount: number;
  period: 'Monthly' | 'Yearly' | 'Lease' | 'Actual';
  x: number;
  y: number;
  source?: SegmentSource;
  propertyId?: string;
  yearsLeft?: number;
}

interface SegmentTooltipProps {
  data: SegmentTooltipData | null;
  /** Which source(s) to show for - can be single string or array */
  source: SegmentSource | SegmentSource[];
  /** Optional propertyId to match (for property-specific tooltips) */
  propertyId?: string;
  /** 
   * Tooltip variant:
   * - 'simple': Just label (for 12-segment months, inner circles)
   * - 'full': Label + percent + amount with period (for expense segments)
   * - 'amount-only': Label + amount (no percent)
   * - 'health': Label + percent + yearsLeft (for health indicators)
   * - 'percent-amount': Label + percent + amount without period suffix (for portfolio)
   */
  variant?: 'simple' | 'full' | 'amount-only' | 'health' | 'percent-amount';
  /** Custom amount formatter - defaults to formatCurrency */
  formatAmount?: (amount: number) => string;
  /** Minimum width of tooltip box */
  minWidth?: number;
}

/**
 * Reusable tooltip component for chart segment hover states.
 * Reduces ~40 lines per tooltip instance to a single component.
 */
const SegmentTooltip: React.FC<SegmentTooltipProps> = ({
  data,
  source,
  propertyId,
  variant = 'full',
  formatAmount,
  minWidth = 110,
}) => {
  // Check if tooltip should be shown
  if (!data) return null;
  if (!data.source) return null;
  
  // Check source match (supports array of sources)
  const sources = Array.isArray(source) ? source : [source];
  if (!sources.includes(data.source)) return null;
  
  // Check propertyId match if specified
  if (propertyId !== undefined && data.propertyId !== propertyId) return null;

  const tooltipStyle = {
    position: 'fixed' as const,
    left: `${data.x + 12}px`,
    top: `${data.y + 8}px`,
    zIndex: 1400,
    bgcolor: '#fff',
    color: '#111',
    border: '1px solid rgba(0,0,0,0.08)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
    borderRadius: 1,
    p: 1.2,
    minWidth: variant === 'simple' ? 90 : minWidth,
    pointerEvents: 'none' as const,
    fontFamily: 'Nunito, Arial, sans-serif',
  };

  // Simple variant - just label
  if (variant === 'simple') {
    return (
      <Box sx={tooltipStyle}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#333' }}>
          {data.label}
        </Typography>
      </Box>
    );
  }

  // Amount-only variant - label + amount
  if (variant === 'amount-only') {
    const amountDisplay = data.amount !== undefined && data.amount !== -1
      ? (formatAmount ? formatAmount(data.amount) : (data.amount < 0 ? `-$${Math.abs(Math.round(data.amount)).toLocaleString()}` : `$${Math.round(data.amount).toLocaleString()}`))
      : '';
    
    return (
      <Box sx={tooltipStyle}>
        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: '#1A1A1A', fontWeight: 700 }}>
          {data.label}
        </Typography>
        {data.amount !== undefined && data.amount !== -1 && (
          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: data.amount < 0 ? '#E35E61' : '#1A1A1A', fontWeight: 400 }}>
            {amountDisplay}
          </Typography>
        )}
      </Box>
    );
  }

  // Health variant - label + percent + yearsLeft
  if (variant === 'health') {
    return (
      <Box sx={tooltipStyle}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: '#1A1A1A', fontWeight: 700, mr: 0.5 }}>
            {data.label}
          </Typography>
          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: '#1A1A1A', fontWeight: 400 }}>
            {Math.round(data.percent)}%
          </Typography>
        </Box>
        {data.yearsLeft !== null && data.yearsLeft !== undefined && (
          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: '#1A1A1A', fontWeight: 400 }}>
            {data.yearsLeft > 0 ? `${data.yearsLeft} Years Left` : 'Replace Soon'}
          </Typography>
        )}
      </Box>
    );
  }

  // Percent-amount variant - label + percent + amount (no period suffix)
  if (variant === 'percent-amount') {
    const amountDisplay = typeof data.amount === 'number'
      ? (formatAmount ? formatAmount(data.amount) : `$${data.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`)
      : '';
    
    return (
      <Box sx={tooltipStyle}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: '#1A1A1A', fontWeight: 700, mr: 0.5 }}>
            {data.label}
          </Typography>
          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: '#1A1A1A', fontWeight: 400 }}>
            {Math.round(data.percent)}%
          </Typography>
        </Box>
        {typeof data.amount === 'number' && (
          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: '#1A1A1A', fontWeight: 400, mt: 0.5 }}>
            {amountDisplay}
          </Typography>
        )}
      </Box>
    );
  }

  // Full variant - label + percent + amount with period
  const periodSuffix = data.period === 'Yearly' ? '/ Year' : '/ Month';
  const amountDisplay = data.amount !== undefined && data.amount !== -1
    ? (formatAmount ? formatAmount(data.amount) : (data.amount < 0 ? `-${formatCurrency(Math.abs(data.amount))}` : formatCurrency(data.amount)))
    : '';

  return (
    <Box sx={tooltipStyle}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: '#1A1A1A', fontWeight: 700, mr: 0.5 }}>
          {data.label}
        </Typography>
        {data.percent !== undefined && data.percent >= 0 && (
          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: '#1A1A1A', fontWeight: 400 }}>
            {Math.round(data.percent)}%
          </Typography>
        )}
      </Box>
      {data.amount !== undefined && data.amount !== -1 && (
        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: data.amount < 0 ? '#E35E61' : '#1A1A1A', fontWeight: 400, mt: 0.5 }}>
          {amountDisplay} {periodSuffix}
        </Typography>
      )}
    </Box>
  );
};

export default React.memo(SegmentTooltip);
