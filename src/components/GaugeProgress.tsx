// ...existing code...

interface GaugeProgressProps {
  percentage: number; // 0-100
  whichfrom?: boolean; // if true, renders in smaller size for property card
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
}


import React, { useEffect, useRef, useState } from "react";

export const GaugeProgress: React.FC<GaugeProgressProps> = ({ percentage, whichfrom = false, onMouseEnter, onMouseMove, onMouseLeave }) => {
  // Clamp percentage between 0 and 100
  const pct = Math.max(0, Math.min(percentage, 100));
  
  // Reduce size for property card display - sized to align with Roof and HVAC circles below
  // Arc endpoints should align with Roof (left) and HVAC (right) circle centers
  // Three circles use strokeWidth=12 in 70x70 viewBox at 50x50 display = 12*(50/70) ≈ 8.5px
  const sizeBase = whichfrom ? 160 : 440;
  
  const strokeWidthOuter = whichfrom ? 6 : 27;
  const strokeWidthInner = whichfrom ? 12 : 40; // Match three circles' visual thickness
  const strokePadding = strokeWidthInner / 2;
  const size = sizeBase + strokePadding * 2;
  const extra = whichfrom ? 12 : 32;
  const radiusOuter = (size - strokeWidthOuter) / 2;
  const radiusInner = radiusOuter - (whichfrom ? 22 : 47);
  
  // Calculate round cap radius difference for alignment
  // Inner cap radius is larger, so outer arc needs to extend further to align visually
  const innerCapRadius = strokeWidthInner / 2;
  const outerCapRadius = strokeWidthOuter / 2;
  const capRadiusDiff = innerCapRadius - outerCapRadius;
  // Convert cap radius difference to angular offset (in degrees)
  const outerCircumference = 2 * Math.PI * radiusOuter;
  const outerAngleAdjustment = (capRadiusDiff / outerCircumference) * 360;
  
  // Shift center up to make room for round ends, and right for left padding
  const center = whichfrom ? size / 2 : size / 2 + extra / 2 - strokePadding + 5;
  // For indicator, use a separate center for visual alignment
  const indicatorOffsetX = whichfrom ? 0 : 10;
  const indicatorCenter = whichfrom ? size / 2 : size / 2 + indicatorOffsetX - 8.5;
  // Use slightly less than 180° to reveal round ends
  const arcAngle = 178;
  const startAngle = -180 + (180 - arcAngle) / 2; // e.g. -180 + 2 = -178
  const endAngle = 0 - (180 - arcAngle) / 2;      // e.g. 0 - 2 = -2
  
  // For inner arc (reference)
  const arc = (value: number, r: number) => {
    const angle = startAngle + (endAngle - startAngle) * (value / 100);
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + r * Math.cos(rad),
      y: center + r * Math.sin(rad),
    };
  };
  
  // For outer arc - adjusted to extend further to align round caps with inner arc
  const arcOuter = (value: number) => {
    // Extend outer arc by angle adjustment to compensate for smaller cap radius
    const adjustedStartAngle = startAngle - outerAngleAdjustment;
    const adjustedEndAngle = endAngle + outerAngleAdjustment;
    const angle = adjustedStartAngle + (adjustedEndAngle - adjustedStartAngle) * (value / 100);
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + radiusOuter * Math.cos(rad),
      y: center + radiusOuter * Math.sin(rad),
    };
  };

  // Animate outer arc progress
  const [animatedPct, setAnimatedPct] = useState(0);
  const animationRef = useRef<number | null>(null);
  useEffect(() => {
    // Don't run animation for 0% — set immediately and skip RAF work
    if (pct === 0) {
      setAnimatedPct(0);
      return;
    }

    let start: number | null = null;
    const duration = 900; // ms
    function animate(ts: number) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setAnimatedPct(progress * pct);
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setAnimatedPct(pct);
      }
    }
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [pct]);

  // Indicator shape (triangle pointer)
  const blackRadius = whichfrom ? 6 : 16;
  const whiteRadius = whichfrom ? 2 : 4;
  const needleLength = whichfrom ? (radiusInner - 5) * 0.6 : ((radiusInner - 10) / 3) * 2;
  const needleAngle = startAngle + (endAngle - startAngle) * (animatedPct / 100);
  const needleRad = (needleAngle * Math.PI) / 180;
  // Triangle base is 2 * blackRadius
  const baseLen = blackRadius * 2;
  const perpRad = needleRad + Math.PI / 2;
  // Triangle base points (use indicatorCenter)
  const baseLeftX = indicatorCenter + (baseLen / 2) * Math.cos(perpRad);
  const baseLeftY = indicatorCenter + (baseLen / 2) * Math.sin(perpRad);
  const baseRightX = indicatorCenter - (baseLen / 2) * Math.cos(perpRad);
  const baseRightY = indicatorCenter - (baseLen / 2) * Math.sin(perpRad);
  // Tip point
  const tipX = indicatorCenter + needleLength * Math.cos(needleRad);
  const tipY = indicatorCenter + needleLength * Math.sin(needleRad);

  return (
    <svg
      width={size}
      height={size / 2 + extra}
      viewBox={`0 0 ${size} ${(size / 2) + extra}`}
      style={{ display: "block", margin: "0 auto" }}
    >
      {/* Outer ring - only show for Property page, hide for property cards */}
      {!whichfrom && (
        <>
          {/* Outer arc background (white) */}
          <path
            d={`M ${arcOuter(0).x} ${arcOuter(0).y}
              A ${radiusOuter} ${radiusOuter} 0 0 1 ${arcOuter(100).x} ${arcOuter(100).y}`}
            stroke="#fff"
            strokeWidth={strokeWidthOuter}
            fill="none"
            strokeLinecap="round"
          />
          {/* Outer arc background round ends */}
          <circle
            cx={arcOuter(0).x}
            cy={arcOuter(0).y}
            r={strokeWidthOuter / 2}
            fill="#fff"
          />
          <circle
            cx={arcOuter(100).x}
            cy={arcOuter(100).y}
            r={strokeWidthOuter / 2}
            fill="#fff"
          />
          {/* Outer arc progress (dark gray, animated) - only show when > 0 */}
          {animatedPct > 0 && (
            <path
              d={`M ${arcOuter(0).x} ${arcOuter(0).y}
                A ${radiusOuter} ${radiusOuter} 0 0 1 ${arcOuter(animatedPct).x} ${arcOuter(animatedPct).y}`}
              stroke="#475567"
              strokeWidth={strokeWidthOuter}
              fill="none"
              strokeLinecap="round"
              onMouseEnter={onMouseEnter}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
            />
          )}
          {/* Outer arc progress round ends */}
          <circle
            cx={arcOuter(0).x}
            cy={arcOuter(0).y}
            r={strokeWidthOuter / 2}
            fill="#475567"
            style={{ opacity: animatedPct > 0 ? 1 : 0 }}
          />
          {animatedPct > 0 && (
            <circle
              cx={arcOuter(animatedPct).x}
              cy={arcOuter(animatedPct).y}
              r={strokeWidthOuter / 2}
              fill="#475567"
            />
          )}
        </>
      )}
      {/* Inner arc background (white) */}
      <path
        d={`M ${arc(0, radiusInner).x} ${arc(0, radiusInner).y}
          A ${radiusInner} ${radiusInner} 0 0 1 ${arc(100, radiusInner).x} ${arc(100, radiusInner).y}`}
        stroke="#fff"
        strokeWidth={strokeWidthInner}
        fill="none"
        strokeLinecap="round"
      />
      {/* Inner arc background round ends */}
      <circle
        cx={arc(0, radiusInner).x}
        cy={arc(0, radiusInner).y}
        r={strokeWidthInner / 2}
        fill="#fff"
      />
      <circle
        cx={arc(100, radiusInner).x}
        cy={arc(100, radiusInner).y}
        r={strokeWidthInner / 2}
        fill="#fff"
      />
      {/* Inner arc progress (gradient, always full) */}
      <defs>
        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D36A6A" />
          <stop offset="50%" stopColor="#E2B46D" />
          <stop offset="100%" stopColor="#7CB9A3" />
        </linearGradient>
      </defs>
      <path
        d={`M ${arc(0, radiusInner).x} ${arc(0, radiusInner).y}
          A ${radiusInner} ${radiusInner} 0 0 1 ${arc(100, radiusInner).x} ${arc(100, radiusInner).y}`}
        stroke="url(#gaugeGradient)"
        strokeWidth={strokeWidthInner}
        fill="none"
        strokeLinecap="round"
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      />
      {/* Inner arc progress round ends */}
      <circle
        cx={arc(0, radiusInner).x}
        cy={arc(0, radiusInner).y}
        r={strokeWidthInner / 2}
        fill="#D36A6A"
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      />
      <circle
        cx={arc(100, radiusInner).x}
        cy={arc(100, radiusInner).y}
        r={strokeWidthInner / 2}
        fill="#7CB9A3"
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      />
      {/* Indicator triangle pointer with sharp tip */}
      <path
        d={`M ${baseLeftX} ${baseLeftY}
            L ${baseRightX} ${baseRightY}
            L ${tipX} ${tipY}
            Z`}
        fill="#475567"
      />
  {/* Black circle at center */}
  <circle cx={indicatorCenter} cy={indicatorCenter} r={blackRadius} fill="#475567" />
  {/* White small circle inside */}
  <circle cx={indicatorCenter} cy={indicatorCenter} r={whiteRadius} fill="#fff" />
    </svg>
  );
};

export const MemoizedGaugeProgress = React.memo(GaugeProgress);
