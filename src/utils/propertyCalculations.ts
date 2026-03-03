// Property calculation utilities
import { getLatestPropertyTax, calculateForecastingMonthly } from './dashboardUtils';

export interface PropertyCalculations {
  rentalIncome: number;
  pmRate: number;
  pmCost: number;
  propertyTaxAmount: number;
  propertyTaxMonthly: number;
  insuranceAmount: number;
  pmiAmount: number;
  hoaAmount: number;
  mortgageAmount: number;
  forecastingMonthly: number;
  effectiveInsuranceAmount: number;
  effectivePropertyTaxAmount: number;
  expenses: number;
  netIncome: number;
  purchasePrice: number;
  remainingBalance: number;
  equity: number;
  equityPercentage: number;
  owedPercentage: number;
}

export interface PropertyItem {
  id: string;
  propertyName: string;
  rentalRate?: number;
  isRental?: boolean;
  pm_rate?: string;
  insurance?: { amount?: string; frequency?: string };
  pmi?: string;
  propertyTaxHistory?: Array<{ date: string; amount: string }>;
  hoa?: string;
  yearly?: string;
  mortgagePaymentAmount?: string;
  forecasting?: any;
  price?: string;
  balance?: string;
  noMortgage?: boolean;
  isPT?: boolean;
  isPM?: boolean;
  leaseStart?: string;
  leaseEnd?: string;
  // ... add other properties as needed
}

/**
 * Calculate all property-related financial values
 */
export function calculatePropertyFinancials(prop: PropertyItem): PropertyCalculations {
  // Get rental income from property's rental rate
  const rentalIncomeValue = prop.rentalRate ?? 0;
  const rentalIncome = typeof rentalIncomeValue === 'string' ? parseFloat(rentalIncomeValue as any) : rentalIncomeValue;
  
  // Calculate property management fee
  const pmRate = prop.pm_rate 
    ? (typeof prop.pm_rate === 'string' 
        ? parseFloat(prop.pm_rate.replace('%', '')) / 100 
        : (prop.pm_rate as any) / 100) 
    : 0;
  let pmCost = rentalIncome * pmRate;
  if (!prop.isRental) {
    pmCost = 0;
  }
  
  // Get property tax amount (yearly)
  const propertyTaxAmount = getLatestPropertyTax(prop.propertyTaxHistory || []);
  const propertyTaxMonthly = propertyTaxAmount / 12;
  
  // Insurance with frequency adjustment
  let insuranceAmount = prop.insurance?.amount ? parseFloat(prop.insurance.amount as any) : 0;
  if (prop.insurance?.frequency === 'Yearly') {
    insuranceAmount = insuranceAmount / 12;
  }
  
  // PMI
  let pmiAmount = prop.pmi ? parseFloat(prop.pmi as any) : 0;
  if (prop.noMortgage) {
    pmiAmount = 0;
  }
  
  // HOA with frequency adjustment
  let hoaAmount = prop.hoa ? parseFloat(prop.hoa as any) : 0;
  if (prop.yearly === 'Yearly') {
    hoaAmount = hoaAmount / 12;
  }
  
  // Mortgage
  const mortgageAmount = prop.noMortgage ? 0 : (parseFloat(prop.mortgagePaymentAmount as any) || 0);
  
  // Forecasting
  const forecastingMonthly = calculateForecastingMonthly(prop.forecasting);
  
  // Escrow logic: When escrow (isPT) is ON and property is NOT paid off,
  // taxes and insurance are bundled into mortgage, so don't count them separately
  let effectiveInsuranceAmount = insuranceAmount;
  let effectivePropertyTaxAmount = propertyTaxAmount;
  if (prop.isPT && !prop.noMortgage) {
    effectiveInsuranceAmount = 0;
    effectivePropertyTaxAmount = 0;
  }
  
  // Total expenses
  const expenses = pmCost + effectiveInsuranceAmount + pmiAmount + (effectivePropertyTaxAmount / 12) + hoaAmount + mortgageAmount + forecastingMonthly;
  
  // Net income
  const netIncome = rentalIncome - expenses;
  
  // Purchase price and balance for equity calculations
  const purchasePrice = prop.price ? parseFloat(prop.price as any) : 0;
  const remainingBalance = prop.noMortgage ? 0 : (prop.balance ? parseFloat(prop.balance as any) : 0);
  const equity = purchasePrice - remainingBalance;
  const equityPercentage = purchasePrice > 0 ? (equity / purchasePrice) * 100 : 0;
  const owedPercentage = 100 - equityPercentage;
  
  return {
    rentalIncome,
    pmRate,
    pmCost,
    propertyTaxAmount,
    propertyTaxMonthly,
    insuranceAmount,
    pmiAmount,
    hoaAmount,
    mortgageAmount,
    forecastingMonthly,
    effectiveInsuranceAmount,
    effectivePropertyTaxAmount,
    expenses,
    netIncome,
    purchasePrice,
    remainingBalance,
    equity,
    equityPercentage,
    owedPercentage,
  };
}

/**
 * Calculate lease information
 */
export function calculateLeaseInfo(leaseStart?: string, leaseEnd?: string): {
  hasValidLease: boolean;
  leaseLength: number | null;
  leaseEndDate: Date | null;
  monthsPassed: number;
  filledPercentage: number;
} {
  let leaseEndDate: Date | null = null;
  let leaseLength: number | null = null;
  let hasValidLease = false;
  let monthsPassed = 0;
  let filledPercentage = 0;
  
  if (leaseStart && leaseEnd) {
    const startDate = new Date(leaseStart);
    leaseEndDate = new Date(leaseEnd);
    
    if (!isNaN(startDate.getTime()) && !isNaN(leaseEndDate.getTime())) {
      leaseLength = Math.round(
        (leaseEndDate.getFullYear() - startDate.getFullYear()) * 12 +
        (leaseEndDate.getMonth() - startDate.getMonth())
      );
      hasValidLease = leaseLength > 0;
      
      if (hasValidLease) {
        const today = new Date();
        monthsPassed = Math.floor(
          (today.getFullYear() - startDate.getFullYear()) * 12 +
          (today.getMonth() - startDate.getMonth())
        );
        filledPercentage = Math.min(100, Math.max(0, (monthsPassed / leaseLength) * 100));
      }
    }
  }
  
  return {
    hasValidLease,
    leaseLength,
    leaseEndDate,
    monthsPassed,
    filledPercentage,
  };
}

/**
 * Calculate segment data for the 12-month circle charts
 */
export function calculateSegmentData(segmentCount: number = 12, gapAngle: number = 13) {
  const totalGapDegrees = segmentCount * gapAngle;
  const availableDegrees = 360 - totalGapDegrees;
  const segmentDegrees = availableDegrees / segmentCount;
  const circumference = 2 * Math.PI * 49; // Standard radius of 49
  const segmentLength = (segmentDegrees / 360) * circumference;
  
  return {
    segmentCount,
    gapAngle,
    segmentDegrees,
    segmentLength,
    circumference,
  };
}
