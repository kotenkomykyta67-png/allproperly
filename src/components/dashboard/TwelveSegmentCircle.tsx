import React from 'react';

interface TwelveSegmentCircleProps {
  /** Radius of the circle */
  radius?: number;
  /** Center X coordinate */
  cx?: number;
  /** Center Y coordinate */
  cy?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Color for past/current month segments */
  activeColor?: string;
  /** Color for future month segments */
  inactiveColor?: string;
  /** Whether segments are interactive */
  interactive?: boolean;
  /** Callback for mouse enter on segment */
  onMouseEnter?: (e: React.MouseEvent, monthIndex: number, monthName: string) => void;
  /** Callback for mouse move on segment */
  onMouseMove?: (e: React.MouseEvent) => void;
  /** Callback for mouse leave on segment */
  onMouseLeave?: () => void;
  /** Use full month names vs abbreviations */
  useFullMonthNames?: boolean;
  /** Starting month index (0-11) - month the property was created */
  startMonthIdx?: number;
  /** Optional array indicating which months have data (for All Properties aggregated view) */
  monthHasData?: boolean[];
}

const TwelveSegmentCircle: React.FC<TwelveSegmentCircleProps> = ({
  radius = 35,
  cx = 55,
  cy = 55,
  strokeWidth = 6.5,
  activeColor = '#89AE99',
  inactiveColor = '#e0e0e0',
  interactive = true,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  useFullMonthNames = true,
  startMonthIdx = 0,
  monthHasData,
}) => {
  const circ = 2 * Math.PI * radius;
  const segmentCount = 12;
  const gapAngle = 13; // degrees
  const totalGapDegrees = segmentCount * gapAngle;
  const availableDegrees = 360 - totalGapDegrees;
  const segmentDegrees = availableDegrees / segmentCount;
  const segmentLength = (segmentDegrees / 360) * circ;
  
  const monthNamesFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNames = useFullMonthNames ? monthNamesFull : monthNamesShort;
  
  const currentMonthIdx = new Date().getMonth();

  return (
    <>
      {Array.from({ length: segmentCount }).map((_, i) => {
        const startAngle = i * (segmentDegrees + gapAngle) - 90; // Start from top
        const offset = -(startAngle / 360) * circ;
        // If monthHasData is provided, use it; otherwise use startMonthIdx logic
        const isInRange = monthHasData ? monthHasData[i] : (i >= startMonthIdx && i <= currentMonthIdx);
        
        return (
          <circle
            key={`twelve-segment-${i}`}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={isInRange ? activeColor : inactiveColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${segmentLength} ${circ - segmentLength}`}
            strokeDashoffset={offset}
            style={{
              transition: 'opacity 0.2s',
              cursor: interactive ? 'pointer' : 'default',
              pointerEvents: interactive ? 'stroke' : 'none',
            }}
            onMouseEnter={interactive && onMouseEnter ? (e) => onMouseEnter(e, i, monthNames[i]) : undefined}
            onMouseMove={interactive && onMouseMove ? (e) => onMouseMove(e) : undefined}
            onMouseLeave={interactive && onMouseLeave ? () => onMouseLeave() : undefined}
          />
        );
      })}
    </>
  );
};

export default React.memo(TwelveSegmentCircle);
