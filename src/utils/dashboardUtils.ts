// Dashboard utility functions

/**
 * Format a number as currency
 */
export const formatCurrency = (val: number, fractionDigits: number = 2): string => {
  return val < 0 
    ? `-$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}` 
    : `$${val.toLocaleString('en-US', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
};

/**
 * Format currency with no decimal places
 */
export const formatCurrencyNoDecimals = (val: number): string => {
  return val < 0 
    ? `-$${Math.abs(val).toLocaleString('en-US', { maximumFractionDigits: 0 })}` 
    : `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

/**
 * Parse a value (string or number) to a number, handling currency formatting
 */
export const parseValue = (val: any): number => {
  if (!val) return 0;
  const cleaned = String(val).replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

/**
 * Get the latest property tax amount from tax history (yearly amount)
 * Only returns value if from current or previous year
 */
export const getLatestPropertyTax = (taxHistory: Array<{ date: string; amount: string }>): number => {
  if (!taxHistory || taxHistory.length === 0) return 0;
  
  // Get the latest entry from all years
  const latest = taxHistory.reduce((latestEntry, current) => {
    return new Date(current.date) > new Date(latestEntry.date) ? current : latestEntry;
  });
  
  // Check if latest entry is from current year or previous year
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const latestYear = new Date(latest.date).getFullYear();
  
  // Only use tax info if it's from current year or previous year
  if (latestYear === currentYear || latestYear === previousYear) {
    return parseValue(latest.amount);
  }
  
  return 0; // Tax info is too old, don't use it
};

/**
 * Calculate recommended monthly savings for a system (Roof, HVAC, Water Heater)
 */
export const getRecommendedMonthly = (system: any): number => {
  if (!system) return 0;
  const { cost, lifespan, installDate } = system;
  const year = installDate ? new Date(installDate).getFullYear() : null;
  const currentYear = new Date().getFullYear();
  if (cost && lifespan && year) {
    const r = 0.027; // inflation rate
    const n = lifespan;
    const futureCost = Math.floor(cost * Math.pow(1 + r, n));
    const yearsLeft = Math.floor(lifespan + year - currentYear);
    if (yearsLeft > 0) return futureCost / 12 / yearsLeft;
  }
  return 0;
};

/**
 * Calculate total forecasting monthly cost from property forecasting data
 */
export const calculateForecastingMonthly = (forecasting: any): number => {
  if (!forecasting || typeof forecasting !== 'object') return 0;
  return (
    getRecommendedMonthly(forecasting.Roof) +
    getRecommendedMonthly(forecasting.HVAC) +
    getRecommendedMonthly(forecasting.WaterHeater)
  );
};

/**
 * Month names array (short)
 */
export const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Month names array (full)
 */
export const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Get current month index (0-based)
 */
export const getCurrentMonthIdx = (): number => new Date().getMonth();

/**
 * Get current month (1-based)
 */
export const getCurrentMonth = (): number => new Date().getMonth() + 1;
