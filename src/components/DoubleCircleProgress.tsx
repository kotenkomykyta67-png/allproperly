import React, { useEffect, useState } from "react";

interface DoubleCircleProgressProps {
  percentage: number;
  color: string;
  label: string;
  subLabel: string;
  estimate: string;
  recommended: string;
  recommendedColor: string;
  size?: number; // optional, px
}

export const DoubleCircleProgress: React.FC<DoubleCircleProgressProps> = ({
  percentage,
  color,
  label,
  subLabel,
  estimate,
  recommended,
  size = 250,
}) => {
  // Animation state
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const [disableTransition, setDisableTransition] = useState(false);
  useEffect(() => {
    // If percentage is 0, show immediately without animation
    if (percentage === 0) {
      setDisableTransition(true);
      setAnimatedPercent(0);
      // ensure any future non-zero updates re-enable transitions
      const t = setTimeout(() => setDisableTransition(false), 50);
      return () => clearTimeout(t);
    }
    setDisableTransition(false);
    setAnimatedPercent(0);
    const timeout = setTimeout(() => {
      setAnimatedPercent(percentage);
    }, 80); // slight delay for mount effect
    return () => clearTimeout(timeout);
  }, [percentage]);

  // Make circle bar thicker and overall size bigger for perfect UI
  const outerStroke = 15;
  const innerStroke = 26;
  const radiusOuter = (size - outerStroke) / 2;
  const radiusInner = radiusOuter - 26;

  // Cap alignment: inner arc cap is larger, so extend outer arc to visually align
  const innerCapRadius = innerStroke / 2;
  const outerCapRadius = outerStroke / 2;
  const capRadiusDiff = innerCapRadius - outerCapRadius;
  const outerCircumference = 2 * Math.PI * radiusOuter;
  const outerAngleAdjustment = (capRadiusDiff / outerCircumference) * 360;

  // Arc path helper for outer circle (with cap alignment adjustment)
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const arcPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  // Outer progress value (for now, 100 - inner)
  const outerValue = 100 - animatedPercent;
  
  // Outer arc angles with alignment adjustment
  const outerStartAngle = -outerAngleAdjustment; // extend start backwards
  const outerEndAngle = (outerValue / 100) * 360 + outerAngleAdjustment; // extend end forwards
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: size, position: "relative", padding: "0 0" }}>
      <svg width={size} height={size} style={{ margin: "0 auto", display: "block", position: "relative" }}>
        {/* Outer progress bar background (white) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radiusOuter}
          stroke="#fff"
          strokeWidth={outerStroke}
          fill="none"
        />
        {/* Outer progress bar (dark gray) - path arc for cap alignment */}
        {outerValue > 0 && outerValue < 100 && (
          <path
            d={arcPath(size / 2, size / 2, radiusOuter, outerStartAngle, outerEndAngle)}
            stroke="#475567"
            strokeWidth={outerStroke}
            fill="none"
            strokeLinecap="round"
          />
        )}
        {/* Outer progress bar - full circle when 100% */}
        {outerValue >= 100 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radiusOuter}
            stroke="#475567"
            strokeWidth={outerStroke}
            fill="none"
          />
        )}
        {/* Inner progress bar */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radiusInner}
          stroke={color}
          strokeWidth={innerStroke}
          fill="none"
          strokeDasharray={2 * Math.PI * radiusInner}
          strokeDashoffset={2 * Math.PI * radiusInner - (2 * Math.PI * radiusInner) * (animatedPercent / 100)}
          strokeLinecap="round"
          style={{ transition: disableTransition ? 'none' : "stroke-dashoffset 0.8s cubic-bezier(.4,1.6,.6,1)", transitionDelay: disableTransition ? '0s' : '0.1s' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {/* Centered text inside the circle */}
        <foreignObject x={size / 2 - 70} y={size / 2 - 44} width={140} height={88}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ fontSize: 38, fontWeight: 400, color: '#475567', lineHeight: 1 }}>{animatedPercent}%</div>
            <div style={{ fontSize: 18, color: '#7B8A97', marginTop: 2 }}>{subLabel}</div>
          </div>
        </foreignObject>
      </svg>
      {/* Main label */}
      {label ? (
        <div style={{ fontSize: 24, fontWeight: 550, color: "#475567", marginTop: 18, marginBottom: 2, letterSpacing: "-0.5px" }}>{label}</div>
      ) : null}
      {estimate ? (
        <div style={{ fontSize: 17, color: "#7B8A97", marginTop: 2, marginBottom: 0 }}>
          estimated {estimate}
        </div>
      ) : null}
      {recommended ? (
        <div style={{ fontSize: 17, color: "#7B8A97", marginTop: 2, marginBottom: 0 }}>
          Recommended {recommended} per month
        </div>
      ) : null}
    </div>
  );
};

export const MemoizedDoubleCircleProgress = React.memo(DoubleCircleProgress);
