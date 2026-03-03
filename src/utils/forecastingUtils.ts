/**
 * Utility functions for forecasting calculations (Roof, HVAC, Water Heater)
 * Shared across Property.tsx and potentially MainDashboard.tsx
 */

// Inflation rate for future cost calculations
const INFLATION_RATE = 0.027;

export interface ForecastingSystem {
  cost?: number;
  lifespan?: number;
  installDate?: string;
}

/**
 * Calculate how much time is left for a system based on install date and lifespan
 */
export function getTimeLeft(installDate: string, lifespan: number): string {
  const install = new Date(installDate);
  const end = new Date(install);
  end.setFullYear(end.getFullYear() + lifespan);
  const now = new Date();
  
  if (end > now) {
    let years = end.getFullYear() - now.getFullYear();
    let months = end.getMonth() - now.getMonth();
    let days = end.getDate() - now.getDate();
    
    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    
    if (years > 0) return `${years} Years left`;
    if (months > 0) return `${months} Months left`;
    if (days > 0) return `${days} Days left`;
  }
  return 'Expired';
}

/**
 * Calculate the future cost of a system with inflation
 */
export function getFutureCost(cost: number, lifespan: number): number {
  return Math.floor(cost * Math.pow(1 + INFLATION_RATE, lifespan));
}

/**
 * Get estimate string (e.g., "$15,000 in 2035")
 */
export function getEstimateString(system: ForecastingSystem | undefined): string {
  if (!system) return 'N/A';
  const { cost, lifespan, installDate } = system;
  const year = installDate ? new Date(installDate).getFullYear() : null;
  
  if (cost && lifespan && year) {
    const futureCost = getFutureCost(cost, lifespan);
    return `$${futureCost.toLocaleString()} in ${year + lifespan}`;
  }
  return 'N/A';
}

/**
 * Get recommended monthly savings string (e.g., "$125.50")
 */
export function getRecommendedString(system: ForecastingSystem | undefined): string {
  const amount = getRecommendedMonthly(system);
  return amount > 0 ? `$${amount.toFixed(2)}` : 'N/A';
}

/**
 * Get recommended monthly savings as a number
 */
export function getRecommendedMonthly(system: ForecastingSystem | undefined): number {
  if (!system) return 0;
  const { cost, lifespan, installDate } = system;
  const year = installDate ? new Date(installDate).getFullYear() : null;
  const currentYear = new Date().getFullYear();
  
  if (cost && lifespan && year) {
    const futureCost = getFutureCost(cost, lifespan);
    const yearsLeft = Math.floor(lifespan + year - currentYear);
    if (yearsLeft > 0) {
      return futureCost / 12 / yearsLeft;
    }
  }
  return 0;
}

/**
 * Get sub-label string showing time left
 */
export function getSubLabel(system: ForecastingSystem | undefined): string {
  if (!system) return 'N/A';
  const { lifespan, installDate } = system;
  if (lifespan && installDate) {
    return getTimeLeft(installDate, lifespan);
  }
  return 'N/A';
}

/**
 * Get progress color based on percentage
 */
export function getProgressColor(progress: number): string {
  if (progress > 75) return '#89AE99';
  if (progress >= 41) return '#E5B26B';
  return '#D36666';
}
