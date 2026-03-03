import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// ============ Types ============
export interface FieldExplanation {
  title: string;
  description: string;
}

interface TooltipContextValue {
  hideTooltip: () => void;
  updatePosition: (x: number, y: number) => void;
  startHoverTimer: (fieldKey: string, x: number, y: number, hasValue: boolean, element: HTMLElement | null) => void;
  cancelHoverTimer: () => void;
}

// Label area height where tooltip triggers for fields with values
const LABEL_AREA_HEIGHT = 28;

// Default delay in milliseconds
const DEFAULT_DELAY = 500;

// ============ Context ============
const TooltipContext = createContext<TooltipContextValue | null>(null);

// ============ Provider Props ============
interface FieldTooltipProviderProps {
  children: React.ReactNode;
  explanations: Record<string, FieldExplanation>;
  delay?: number;
}

// ============ Provider Component ============
export function FieldTooltipProvider({ children, explanations, delay = DEFAULT_DELAY }: FieldTooltipProviderProps) {
  const [activeField, setActiveField] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFieldRef = useRef<string | null>(null);
  const currentElementRef = useRef<HTMLElement | null>(null);
  // Track live mouse position so tooltip appears at current cursor location
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Store initial position to avoid flash at (0,0)
  const initialPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const updatePosition = useCallback((x: number, y: number) => {
    // Always track mouse position, even when tooltip isn't visible
    mousePosRef.current = { x, y };
    
    if (!tooltipRef.current) return;
    
    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    let posX = x + 12;
    let posY = y + 12;
    
    // Flip if near edges
    if (posX + rect.width > vw - 10) posX = x - rect.width - 12;
    if (posY + rect.height > vh - 10) posY = y - rect.height - 12;
    
    posX = Math.max(10, posX);
    posY = Math.max(10, posY);
    
    tooltip.style.transform = `translate(${posX}px, ${posY}px)`;
  }, []);

  const showTooltip = useCallback((fieldKey: string) => {
    // First, position the tooltip BEFORE making it visible
    // Set initial position immediately (not in rAF) to avoid flash at (0,0)
    const { x, y } = mousePosRef.current;
    currentFieldRef.current = fieldKey;
    
    // Pre-calculate position before render
    const posX = x + 12;
    const posY = y + 12;
    
    // Store for initial render
    initialPosRef.current = { x: posX, y: posY };
    
    setActiveField(fieldKey);
    
    // Then fine-tune position after render (for edge detection)
    requestAnimationFrame(() => updatePosition(x, y));
  }, [updatePosition]);

  const hideTooltip = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    currentFieldRef.current = null;
    currentElementRef.current = null;
    setActiveField(null);
  }, []);

  const startHoverTimer = useCallback((
    fieldKey: string, 
    x: number, 
    y: number, 
    hasValue: boolean, 
    element: HTMLElement | null
  ) => {
    // Track initial position
    mousePosRef.current = { x, y };
    currentElementRef.current = element;
    
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Hide current tooltip if showing different field
    if (currentFieldRef.current && currentFieldRef.current !== fieldKey) {
      setActiveField(null);
    }
    
    // If field has value, only trigger on label area
    if (hasValue && element) {
      const rect = element.getBoundingClientRect();
      const mouseY = y - rect.top;
      if (mouseY > LABEL_AREA_HEIGHT) {
        currentFieldRef.current = null;
        return;
      }
    }
    
    // Check if explanation exists
    if (!explanations[fieldKey]) {
      currentFieldRef.current = null;
      return;
    }
    
    currentFieldRef.current = fieldKey;
    
    // Start timer - check focus state using DOM when timer fires
    timerRef.current = setTimeout(() => {
      // Production-grade: Check if any element inside the field is focused
      const el = currentElementRef.current;
      if (el && el.contains(document.activeElement)) {
        // User is focused on an input inside this field - don't show tooltip
        return;
      }
      
      if (currentFieldRef.current === fieldKey) {
        showTooltip(fieldKey);
      }
    }, delay);
  }, [explanations, delay, showTooltip]);

  const cancelHoverTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo<TooltipContextValue>(() => ({
    hideTooltip,
    updatePosition,
    startHoverTimer,
    cancelHoverTimer,
  }), [hideTooltip, updatePosition, startHoverTimer, cancelHoverTimer]);

  const explanation = activeField ? explanations[activeField] : null;

  // SSR safety: only render portal on client
  const portalContainer = typeof document !== 'undefined' ? document.body : null;

  return (
    <TooltipContext.Provider value={contextValue}>
      {children}
      {activeField && explanation && portalContainer && createPortal(
        <Box
          ref={tooltipRef}
          sx={{
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 9999,
            bgcolor: '#fff',
            color: '#111',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
            borderRadius: 1,
            p: 1.5,
            minWidth: 180,
            maxWidth: 280,
            pointerEvents: 'none',
            fontFamily: 'Nunito, Arial, sans-serif',
            willChange: 'transform',
            // Use initial position to prevent flash at (0,0)
            transform: `translate(${initialPosRef.current.x}px, ${initialPosRef.current.y}px)`,
            // Subtle fade-in animation (opacity only, position is already set)
            animation: 'tooltipFadeIn 0.15s ease-out',
            '@keyframes tooltipFadeIn': {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
          }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#333', mb: 0.5 }}>
            {explanation.title}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#666', lineHeight: 1.4 }}>
            {explanation.description}
          </Typography>
        </Box>,
        portalContainer
      )}
    </TooltipContext.Provider>
  );
}

// ============ TooltipField Component (Static, defined once) ============
interface TooltipFieldProps {
  fieldKey: string;
  children: React.ReactNode;
  value?: any;
  sx?: any;
}

export const TooltipField = React.memo(function TooltipField({ 
  fieldKey, 
  children, 
  value, 
  sx 
}: TooltipFieldProps) {
  const context = useContext(TooltipContext);
  const boxRef = useRef<HTMLDivElement>(null);
  const hasValue = value !== undefined && value !== null && value !== '';
  
  // Memoize handlers to prevent re-renders
  const handlePointerEnter = useCallback((e: React.PointerEvent) => {
    if (!context) return;
    context.startHoverTimer(fieldKey, e.clientX, e.clientY, hasValue, boxRef.current);
  }, [context, fieldKey, hasValue]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!context) return;
    // Always track position (for accurate tooltip placement after delay)
    context.updatePosition(e.clientX, e.clientY);
  }, [context]);

  const handlePointerLeave = useCallback((e: React.PointerEvent) => {
    if (!context) return;
    const relatedTarget = e.relatedTarget as Element | null;
    // If moving to another tooltip field, let it handle
    if (relatedTarget?.closest?.('[data-tooltip-field]')) {
      context.cancelHoverTimer();
      return;
    }
    context.hideTooltip();
  }, [context]);

  // Production-grade: Use onPointerDown to hide tooltip immediately when user clicks
  // This fires BEFORE focus events and doesn't interfere with input behavior
  const handlePointerDown = useCallback(() => {
    if (!context) return;
    context.hideTooltip();
  }, [context]);
  
  if (!context) {
    // If no provider, just render children
    return <>{children}</>;
  }

  return (
    <Box
      ref={boxRef}
      data-tooltip-field={fieldKey}
      sx={{ 
        position: 'relative', 
        width: '100%',
        minWidth: 0,
        ...sx 
      }}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
    >
      {children}
    </Box>
  );
});

// ============ Hook for imperative control ============
export function useFieldTooltipControl() {
  const context = useContext(TooltipContext);
  if (!context) {
    return { hideTooltip: () => {} };
  }
  return { hideTooltip: context.hideTooltip };
}
