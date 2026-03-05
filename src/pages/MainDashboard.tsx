import React, { useMemo } from "react";
import { Box, Typography, Paper, Button, IconButton, Skeleton, useMediaQuery, useTheme } from "@mui/material";
import { BarChart, Bar, ResponsiveContainer, Cell, XAxis, YAxis } from 'recharts';
import UpgradeLimitModal from "../components/UpgradeLimitModal";
import EditPropertyModal from "../components/EditPropertyModal";
import { GaugeProgress } from "../components/GaugeProgress";
import LegendPanel from "../components/dashboard/LegendPanel";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import SegmentTooltip from "../components/dashboard/SegmentTooltip";
import TwelveSegmentCircle from "../components/dashboard/TwelveSegmentCircle";
import HomeSetupJourney from "../components/dashboard/HomeSetupJourney";
import type { RefObject } from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { getAuth } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import { deleteProperty } from "../services/PropertyService";
import AddPropertyModal from "../components/AddPropertyModal";
import { formatCurrency, formatCurrencyNoDecimals, parseValue, getLatestPropertyTax, calculateForecastingMonthly } from "../utils/dashboardUtils";
import "./MainDashboard.css";

interface PropertyItem {
  alias?: string;
  isShared?: boolean;
  createdAt?: string; // <-- Add this line
  id: string;
  propertyName: string;
  photoUrl?: string;
  tag?: string;
  type?: string;
  sharedWith?: any[];
  ownerId?: string;
  rentalRate?: number;
  isRental?: boolean;
  leaseStart?: string;
  leaseEnd?: string;
  rentRenewalSuggestion?: number;
  pm_rate?: string;
  pm_company?: string;
  insurance?: { amount?: string; frequency?: string };
  pmi?: string;
  propertyTaxHistory?: Array<{ date: string; amount: string }>;
  hoa?: string;
  yearly?: string;
  mortgagePaymentAmount?: string;
  forecasting?: {
    Roof?: { type?: string; cost?: number; lifespan?: number; installDate?: string };
    HVAC?: { cost?: number; lifespan?: number; installDate?: string };
    WaterHeater?: { cost?: number; lifespan?: number; installDate?: string };
  };
  roofHealthYear?: string;
  hvacHealthYear?: string;
  waterHeaterHealthYear?: string;
  inventory?: any[]; // inventory list from Firestore (array of strings or objects)
  price?: string;
  estimatedValue?: string;
  balance?: string;
  mortgagePaidOffDate?: string;
  term?: string;
  date?: string;
  noMortgage?: boolean;
  isPT?: boolean; // Escrow account toggle - when true, taxes/insurance are bundled into mortgage
  isPM?: boolean;
  isFriend?: boolean;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  bedrooms?: number;
  bathrooms?: number;
  bathsTotal?: number;
  squareFeet?: number;
  yearBuilt?: number;
  ownerName?: string;
  overallHealth?: number; // Overall property health percentage (0-100)
  forecastingMonthly?: number; // Monthly forecasting cost
  roofHealth?: number; // Roof health percentage (0-100)
  hvacHealth?: number; // HVAC health percentage (0-100)
  waterHeaterHealth?: number; // Water heater health percentage (0-100)
  rentalInsurance?: { insuranceCompany?: string; assetsCovered?: string; policyNumber?: string };
  securityDeposit?: number;
  securityDepositDate?: string;
  originalPhotoUrl?: string;
}

// leaderboard state should be inside MainDashboard, not top-level

interface MainDashboardProps {
  carouselRef: RefObject<HTMLDivElement>;
  properties?: PropertyItem[];
  loading?: boolean;
  sidebar?: boolean;
  onAddClick?: () => void;
  onAddSomeoneClick?: () => void;
  onPropertyClick?: (propertyId: string) => void;
  onTaskClick?: () => void;
  onShowUpgrade?: () => void;
}

const MainDashboard: React.FC<MainDashboardProps> = ({ carouselRef, sidebar, onAddClick, onPropertyClick, onShowUpgrade }) => {
  // State for All Properties inner circle animation
  const [allPropertiesCircleAnimState, setAllPropertiesCircleAnimState] = useState<'origin' | 'to5' | 'back' | 'toFull' | 'shrink' | 'expandFromZero' | 'shrinkToOrigin'>('origin');
  // State for All Properties Monthly/Yearly/Actual toggle
    const [allPropertiesPeriod, setAllPropertiesPeriod] = useState<'Monthly' | 'Yearly' | 'Actual'>('Monthly');
  // State for triggering re-animation on button change
  // Per-card animation key and animation state for rental view
  const [rentalAnimationKey, setRentalAnimationKey] = useState<{ [propertyId: string]: number }>({});
  const [circleAnimState, setCircleAnimState] = useState<{ [propertyId: string]: 'origin' | 'to5' | 'back' | 'toFull' | 'shrink' | 'expandFromZero' | 'shrinkToOrigin' }>({});

  // Upgrade modal state
  const [upgradeLimitOpen, setUpgradeLimitOpen] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<string>("free");
  // Add property modal state
  const [addPropertyOpen, setAddPropertyOpen] = useState(false);
  const handleAddClick = useCallback(async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const adminEmails = ['river@fishdawgproductions.com', 'andrii@allproperly.com'];
    if (adminEmails.includes(user.email || '')) {
      setAddPropertyOpen(true);
      if (onAddClick) onAddClick();
      return;
    }
    const { doc, getDoc, collection, getDocs } = await import("firebase/firestore");
    const { db } = await import("../services/firebase");
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const plan = userDoc.exists() ? (userDoc.data()?.planState || "free") : "free";
    let maxProperties = 1;
    if (plan === "basic" || plan === "basic_annual") maxProperties = 5;
    if (plan === "plus" || plan === "plus_annual") maxProperties = 10;
    const allPropsSnap = await getDocs(collection(db, "properties"));
    const allProps = allPropsSnap.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() }));
    const userProperties = allProps.filter((p: any) => {
      const isOwner = p.ownerId === user.uid;
      const isShared = Array.isArray(p.sharedWith) && p.sharedWith.some((sw: any) => (typeof sw === 'object' && sw && sw.userId === user.uid) || sw === user.uid);
      return isOwner || isShared;
    });
    if (userProperties.length >= maxProperties) {
      setUpgradePlan(plan);
      setUpgradeLimitOpen(true);
    } else {
      setAddPropertyOpen(true);
      if (onAddClick) onAddClick();
    }
  }, [onAddClick]);
  // PM card button state (cycles through Lease -> Actual -> Monthly -> Yearly -> Lease)
  const [pmButtonState, setPmButtonState] = useState<{ [propertyId: string]: 'Lease' | 'Monthly' | 'Actual' | 'Yearly' }>({});
  // PM card animation state for Lease -> Actual transition
  const [pmCircleAnimState, setPmCircleAnimState] = useState<{ [propertyId: string]: 'origin' | 'toFull' | 'shrink' | 'expandFromZero' | 'shrinkToOrigin' }>({});
  // Rental and Homeowner card button state (cycles through Monthly -> Yearly -> Actual -> Monthly)
  const [cardButtonState, setCardButtonState] = useState<{ [propertyId: string]: 'Monthly' | 'Yearly' | 'Actual' }>({});
  // Friend view system health hover state
  const [hoveredSystem, setHoveredSystem] = useState<string | null>(null);
  // Hovered segment info for rental/chart/tooltips
  const [hoveredSegment, setHoveredSegment] = useState<{ label: string; percent: number; amount: number; period: 'Monthly' | 'Yearly' | 'Lease' | 'Actual'; x: number; y: number; 
    source?: 'rental' | 'homeowner' | 'portfolio' | 'pm' | 'pm-summary' | 'friend-health' | 'rental-inner' | 'homeowner-inner' | 'portfolio-inner' | 'all-properties' | 'all-properties-inner'; propertyId?: string; yearsLeft?: number } | null>(null);
  // Leaderboard hover tooltip state and cache (moved to top-level to avoid hooks-in-conditional issues)
  const [hoveredLeader, setHoveredLeader] = useState<{ name: string; x: number; y: number; tasks: string[] | null; loading?: boolean; anchor?: 'avatar' | 'name' | 'count' } | null>(null);
  const [leaderTasksCache, setLeaderTasksCache] = useState<{ [key: string]: string[] }>({});
  
  // Edit Property modal state (for "Add info" click on N/A)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalProperty, setEditModalProperty] = useState<PropertyItem | null>(null);
  const [editModalRole, setEditModalRole] = useState<'owner' | 'pm'>('owner');
  
  // Bottom boards carousel ref and state
  const bottomBoardsRef = useRef<HTMLDivElement>(null);
  
  // Responsive layout for bottom boards - detect large screens (>=1200px) and extra large (>=1650px)
  const isLargeScreen = useMediaQuery('(min-width:1200px)');
  const isExtraLargeScreen = useMediaQuery('(min-width:1650px)');
  const isSingleViewEnabled = useMediaQuery('(min-width:1000px)');
  const theme = useTheme();
  const isMobileOrSmall = useMediaQuery(theme.breakpoints.down('md'));

  // Format numbers as 'k' for thousands and 'M' for millions (use M when >= 1,000,000)
  const formatKOrM = (val: number) => {
    const v = Number(val) || 0;
    const abs = Math.abs(v);
    if (abs >= 1000000) {
      const n = v / 1000000;
      const s = n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
      return `${s}M`;
    }
    return `${Math.round(v / 1000)}k`;
  };
  
  // Scroll animation for bottom boards carousel - matching property cards carousel
  const scrollBoardsPage = (direction: 'left' | 'right') => {
    if (!bottomBoardsRef.current) return;
    
    const animateScroll = (start: number, end: number, duration = 500) => {
      const startTime = performance.now();
      const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      function step(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOut(progress);
        const value = start + (end - start) * eased;
        bottomBoardsRef.current!.scrollLeft = value;
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      }
      window.requestAnimationFrame(step);
    };

    const current = bottomBoardsRef.current.scrollLeft;
    
    // Get actual board width from first child
    const firstBoard = bottomBoardsRef.current.querySelector('[data-board]') as HTMLElement;
    const boardWidth = firstBoard ? firstBoard.offsetWidth : bottomBoardsRef.current.offsetWidth / 2;
    const gap = 12; // 1.5 * 8px theme spacing
    const scrollAmount = boardWidth + gap;
    let target: number;
    
    if (direction === 'left') {
      target = Math.max(0, current - scrollAmount);
    } else {
      const maxScroll = bottomBoardsRef.current.scrollWidth - bottomBoardsRef.current.offsetWidth;
      target = Math.min(current + scrollAmount, maxScroll);
    }
    
    animateScroll(current, target, 500);
  };

  // Properties state (must be above usage)
  const [properties, setProperties] = useState<PropertyItem[]>([]);

  // Helper function to open edit modal with correct role
  const handleOpenEditModal = (prop: PropertyItem, role: 'owner' | 'pm') => {
    setEditModalProperty(prop);
    setEditModalRole(role);
    setEditModalOpen(true);
  };

  // Memoized PM properties filter (avoids repeated filtering)
  const pmProperties = useMemo(() => properties.filter(p => p.isPM), [properties]);

  // Carousel animation state
  const cardWidth = 360; // Default card width, matches Paper sx
  const gapWidth = 24; // gap: 3 (theme spacing unit, usually 8px)

  // Track carousel container width for proper scroll clamping and mobile one-card-per-view
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    if (carouselRef.current) {
      const handleResize = () => {
        setContainerWidth(carouselRef.current!.offsetWidth);
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [carouselRef]);

  // On mobile: card is 95% of container width, min 280px
  const effectiveCardWidth = (isMobileOrSmall && containerWidth > 0) ? Math.max(280, Math.floor(containerWidth * 0.95)) : cardWidth;
  const mobileShadowSpacerPx = 28; // leading/trailing spacer so card box shadows are not clipped by overflow
  const mobileCardWidthXs = (isMobileOrSmall && containerWidth > 0) ? effectiveCardWidth : '100%';
  // Card width responsive: on mobile/small (< md) use dynamic 95%, on sm+ desktop use fixed values
  const cardWidthSm = isMobileOrSmall ? mobileCardWidthXs : 480;
  const cardWidthMd = 548;
  // Bottom boards: on mobile use 95% of container width, on desktop use 550px
  const boardMinWidth = (isMobileOrSmall && containerWidth > 0) ? Math.floor(containerWidth * 0.95) : 550;
  // Single property card width: fill carousel minus add-property card (548), gap (12px), carousel padding (16px)
  const singleCardWidth = Math.max(750, containerWidth - 576);
  const cardSnapSx = isMobileOrSmall ? { scrollSnapAlign: 'start' as const, scrollSnapStop: 'always' as const } : {};
  // Mobile: prevent content overflow and text cutoff (pixel-perfect)
  const mobileCardContentSx = isMobileOrSmall
    ? {
        '& > *': { minWidth: 0 },
        '& .MuiTypography-root': { wordBreak: 'break-word', overflowWrap: 'break-word' },
        '& *': { scrollbarWidth: 'none', msOverflowStyle: 'none' },
        '& *::-webkit-scrollbar': { width: 0, height: 0, display: 'none' },
      }
    : {};

        // Scroll by container width (like paging with a scrollbar)
        // Custom scroll animation for smoother/eased transitions
        const animateScroll = (start: number, end: number, duration = 500) => {
          if (!carouselRef.current) return;
          const startTime = performance.now();
          const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          function step(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeInOut(progress);
            const value = start + (end - start) * eased;
            carouselRef.current!.scrollLeft = value;
            if (progress < 1) {
              window.requestAnimationFrame(step);
            }
          }
          window.requestAnimationFrame(step);
        };

        const scrollByPage = (direction: 'left' | 'right') => {
          if (carouselRef.current) {
            const current = carouselRef.current.scrollLeft;
            const page = effectiveCardWidth + gapWidth; // scroll by one card (including gap)
            const scrollWidth = carouselRef.current.scrollWidth;
            const maxScroll = Math.max(0, scrollWidth - containerWidth);
            let target;
            if (direction === 'left') {
              target = current <= page ? 0 : current - page;
            } else {
              target = current + page;
              if (target > maxScroll - 10) target = maxScroll;
              target = Math.min(target, maxScroll);
            }
            target = Math.max(0, target);
            animateScroll(current, target, 500);
          }
        };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async user => {
      if (!user) return;
      // Fetch owned properties
      const ownedQ = query(collection(db, "properties"), where("ownerId", "==", user.uid));
      const ownedSnap = await getDocs(ownedQ);
      const ownedProps = ownedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Optimize: Single loop for all checklist checks
      let hvacWaterHeaterColor = '#FFE0B2';
      let smokeCOColor = '#FFE0B2';
      let airFilterColor = '#FFE0B2';
      for (const prop of ownedProps) {
        let propertyObj: any = prop;
        if (typeof prop === 'string') {
          const docSnap = await getDoc(doc(db, 'properties', prop));
          if (!docSnap.exists()) continue;
          propertyObj = { id: prop, ...docSnap.data() };
        }
        if (!propertyObj || typeof propertyObj !== 'object') continue;

        // HVAC/Water Heater/Roof
        if (hvacWaterHeaterColor !== '#89AE99') {
          const fc = propertyObj.forecasting && typeof propertyObj.forecasting === 'object' ? propertyObj.forecasting : {};
          const hvac = fc.HVAC || {};
          const wh = fc.WaterHeater || {};
          const roof = fc.Roof || {};
          const hvacValid = hvac.cost != null && hvac.installDate && hvac.lifespan != null;
          const whValid = wh.cost != null && wh.installDate && wh.lifespan != null;
          const roofValid = roof.cost != null && roof.installDate && roof.lifespan != null;
          if (hvacValid && whValid && roofValid) hvacWaterHeaterColor = '#89AE99';
        }

        // Smoke/CO Detectors
        if (smokeCOColor !== '#89AE99') {
          const inv = Array.isArray(propertyObj.inventory) ? propertyObj.inventory : Array.isArray(propertyObj.inventories) ? propertyObj.inventories : [];
          // Find Smoke Detectors with valid count
          const hasSmoke = inv.some((item: any) => {
            let str = '';
            if (!item) return false;
            if (typeof item === 'string') str = item;
            else if (item.name) str = item.name;
            else if (item.alias) str = item.alias;
            if (!str.toLowerCase().includes('smoke detectors')) return false;
            const parts = str.split('~').map(s => s.trim());
            const count = parts[3] ? parseInt(parts[3], 10) : 0;
            return count > 0;
          });
          // Find CO Detectors with valid count
          const hasCO = inv.some((item: any) => {
            let str = '';
            if (!item) return false;
            if (typeof item === 'string') str = item;
            else if (item.name) str = item.name;
            else if (item.alias) str = item.alias;
            if (!str.toLowerCase().includes('co detectors')) return false;
            const parts = str.split('~').map(s => s.trim());
            const count = parts[3] ? parseInt(parts[3], 10) : 0;
            return count > 0;
          });
          if (hasSmoke && hasCO) smokeCOColor = '#89AE99';
        }

        // Air Filter
        if (airFilterColor !== '#89AE99') {
          const inv = Array.isArray(propertyObj.inventory) ? propertyObj.inventory : Array.isArray(propertyObj.inventories) ? propertyObj.inventories : [];
          const hasFilter = inv.some((item: any) => {
            let str = '';
            if (!item) return false;
            if (typeof item === 'string') str = item;
            else if (item.name) str = item.name;
            else if (item.alias) str = item.alias;
            if (!str.toLowerCase().includes('air filter')) return false;
            const parts = str.split('~').map(s => s.trim());
            return !!parts[3];
          });
          if (hasFilter) airFilterColor = '#89AE99';
        }

        // Early exit if all are green
        if (hvacWaterHeaterColor === '#89AE99' && smokeCOColor === '#89AE99' && airFilterColor === '#89AE99') break;
      }

    });
    return () => unsubscribe();
  }, []);

  // ...existing code...
  const [loading, setLoading] = useState(true);
  const [propertyTasksMap, setPropertyTasksMap] = useState<{
    [propertyId: string]: {
      upcoming: { name: string; date: string; id: string }[];
      overdue: { name: string; date: string; id: string }[];
    };
  }>({});

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (!user) {
        setProperties([]);
        setLoading(false);
        return;
      }
      async function fetchProperties() {
        setLoading(true);
        try {
          // Fetch owned properties
          const ownedQ = query(collection(db, "properties"), where("ownerId", "==", user?.uid));
          const ownedSnap = await getDocs(ownedQ);
          const ownedProps: PropertyItem[] = [];
          ownedSnap.forEach(docSnap => {
            const data = docSnap.data();
            ownedProps.push({
              id: docSnap.id,
              propertyName: data.propertyName || data.address1 || "Unnamed Property",
              photoUrl: data.photoUrl,
              tag: data.type || "Property",
              type: data.type || "Property",
              sharedWith: data.sharedWith || [],
              ownerId: data.ownerId,
              rentalRate: data.rentalRate,
              isRental: data.isRental,
              leaseStart: data.leaseStart,
              leaseEnd: data.leaseEnd,
              rentRenewalSuggestion: data.rentRenewalSuggestion,
              pm_rate: data.pm_rate,
              pm_company: data.pm_company,
              insurance: data.insurance,
              pmi: data.pmi,
              propertyTaxHistory: data.propertyTaxHistory,
              hoa: data.hoa,
              yearly: data.yearly,
              mortgagePaymentAmount: data.mortgagePaymentAmount,
              forecasting: data.forecasting,
              inventory: data.inventory || data.inventories || [],
              price: data.price,
              estimatedValue: data.estimatedValue,
              balance: data.balance,
              mortgagePaidOffDate: data.mortgagePaidOffDate,
              term: data.term,
              date: data.date,
              noMortgage: data.noMortgage,
              isPT: data.isPT,
              isPM: false,
              isFriend: false,
              address1: data.address1,
              city: data.city,
              state: data.state,
              zip: data.zip,
              bedrooms: data.bedrooms,
              bathrooms: data.bathrooms,
              bathsTotal: data.bathsTotal ?? data.bathrooms,
              squareFeet: data.squareFeet,
              yearBuilt: data.yearBuilt,
              securityDeposit: data.securityDeposit,
              securityDepositDate: data.securityDepositDate,
              originalPhotoUrl: data.originalPhotoUrl,
              overallHealth: data.overallHealth,
              roofHealth: data.roofHealth,
              hvacHealth: data.hvacHealth,
              waterHeaterHealth: data.waterHeaterHealth,
              roofHealthYear: (() => {
                const installYear = data.forecasting?.Roof?.installDate ? new Date(data.forecasting.Roof.installDate).getFullYear() : 0;
                const lifespan = data.forecasting?.Roof?.lifespan || 0;
                const currentYear = new Date().getFullYear();
                return String(installYear + lifespan - currentYear);
              })(),
              hvacHealthYear: (() => {
                const installYear = data.forecasting?.HVAC?.installDate ? new Date(data.forecasting.HVAC.installDate).getFullYear() : 0;
                const lifespan = data.forecasting?.HVAC?.lifespan || 0;
                const currentYear = new Date().getFullYear();
                return String(installYear + lifespan - currentYear);
              })(),
              waterHeaterHealthYear: (() => {
                const installYear = data.forecasting?.WaterHeater?.installDate ? new Date(data.forecasting.WaterHeater.installDate).getFullYear() : 0;
                const lifespan = data.forecasting?.WaterHeater?.lifespan || 0;
                const currentYear = new Date().getFullYear();
                return String(installYear + lifespan - currentYear);
              })(),
              createdAt: data.createdAt || null
            });
          });

          // Fetch all properties and filter for sharedWith containing UID
          const allPropsSnap = await getDocs(collection(db, "properties"));
          const sharedProps: PropertyItem[] = allPropsSnap.docs
            .filter(docSnap => {
              const data = docSnap.data();
              return Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === user?.uid);
            })
            .map(docSnap => {
              const data = docSnap.data();
              let alias = undefined;
              let isShared = false;
              if (Array.isArray(data.sharedWith)) {
                const sharedEntry = data.sharedWith.find((sw: any) => sw.userId === user?.uid);
                if (sharedEntry) {
                  isShared = true;
                  if (sharedEntry.alias) alias = sharedEntry.alias;
                }
              }
              const isPM = Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === user?.uid && (sw.role === 'PM' || sw.role === 'Property Manager'));
              const isFriend = Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === user?.uid && (sw.role === 'Friend' || sw.role === 'Friend Manager'));
              return {
                id: docSnap.id,
                propertyName: data.propertyName || data.address1 || "Unnamed Property",
                photoUrl: data.photoUrl,
                tag: data.type || "Property",
                sharedWith: data.sharedWith || [],
                ownerId: data.ownerId,
                rentalRate: data.rentalRate,
                isRental: data.isRental,
                leaseStart: data.leaseStart,
                leaseEnd: data.leaseEnd,
                rentRenewalSuggestion: data.rentRenewalSuggestion,
                pm_rate: data.pm_rate,
                insurance: data.insurance,
                pmi: data.pmi,
                propertyTaxHistory: data.propertyTaxHistory,
                hoa: data.hoa,
                yearly: data.yearly,
                mortgagePaymentAmount: data.mortgagePaymentAmount,
                forecasting: data.forecasting,
                inventory: data.inventory || data.inventories || [],
                price: data.price,
                estimatedValue: data.estimatedValue,
                balance: data.balance,
                mortgagePaidOffDate: data.mortgagePaidOffDate,
                term: data.term,
                date: data.date,
                noMortgage: data.noMortgage,
                isPT: data.isPT,
                isPM,
                isFriend,
                alias,
                isShared,
                rentalInsurance: {
                  insuranceCompany: data.rentalInsurance?.insuranceCompany,
                  assetsCovered: data.rentalInsurance?.assetsCovered,
                  policyNumber: data.rentalInsurance?.policyNumber,
                },
                address1: data.address1,
                city: data.city,
                state: data.state,
                zip: data.zip,
                bedrooms: data.bedrooms,
                bathrooms: data.bathsTotal,
                bathsTotal: data.bathsTotal,
                squareFeet: data.squareFeet,
                yearBuilt: data.yearBuilt,
                overallHealth: data.overallHealth,
                roofHealth: data.roofHealth,
                hvacHealth: data.hvacHealth,
                waterHeaterHealth: data.waterHeaterHealth,
                createdAt: data.createdAt || null,
                pm_company: data.pm_company,
                securityDeposit: data.securityDeposit,
                securityDepositDate: data.securityDepositDate,
                originalPhotoUrl: data.originalPhotoUrl
              };
            });

          // Merge and deduplicate properties
          const allProps = [
            ...ownedProps,
            ...sharedProps.filter(sp => !ownedProps.some(op => op.id === sp.id))
          ];
          // Sort by createdAt descending (newest first)
          // Sort by createdAt ascending (oldest first)
          allProps.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return aTime - bTime;
          });
          // Ensure 'Our Home' is first if it exists
          const ourHomeIdx = allProps.findIndex(p => p.tag === "Our Home");
          let orderedProps = allProps;
          if (ourHomeIdx > 0) {
            orderedProps = [allProps[ourHomeIdx], ...allProps.filter((_, idx) => idx !== ourHomeIdx)];
          }
          setProperties(orderedProps);
        } finally {
          setLoading(false);
        }
      }
      fetchProperties();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (!user) {
        return;
      }
      async function fetchPropertyNames() {
        const propQ = query(collection(db, "properties"), where("ownerId", "==", user?.uid));
        const propSnap = await getDocs(propQ);
        const propNames: string[] = ['All Property'];
        const propMap: { [name: string]: string } = {};
        propSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (data.type && docSnap.id) {
            propNames.push(data.type);
            propMap[data.type] = docSnap.id;
          }
        });
      }
      fetchPropertyNames();
    });
    return () => unsubscribe();
  }, []);

  let totalRental = 0;
  let totalExpenses = 0;
  let totalForecasting = 0;
  let totalPM = 0;
  let totalHOA = 0;
  let totalPMI = 0;
  let totalMortgage = 0;
  let totalInsurance = 0;
  let totalPrice = 0;
  let totalBalance = 0;
  let totalRentalView = 0;
  
  // Separate totals for All Properties section (rental only)
  let rentalOnlyIncome = 0;
  let rentalOnlyExpenses = 0;
  let rentalOnlyForecasting = 0;
  let rentalOnlyPM = 0;
  let rentalOnlyHOA = 0;
  let rentalOnlyPMI = 0;
  let rentalOnlyMortgage = 0;
  let rentalOnlyInsurance = 0;
  let rentalOnlyPrice = 0;
  let rentalOnlyBalance = 0;
  let paidoff = false;
  let earliestPropertyCreatedMonth = 0; // Track earliest property creation month for All Properties Actual mode
  let earliestPropertyCreatedYear = new Date().getFullYear(); // Track earliest property creation year
  
  // Per-month profit array for All Rental Properties Actual mode
  // Each month stores the sum of profits from properties that have that month filled
  const monthlyRentalProfits: number[] = Array(12).fill(0);
  // Track which months have at least one property contributing
  const monthlyRentalHasData: boolean[] = Array(12).fill(false);

  // Fetch tasks for a specific property
  const fetchTasksForProperty = (propertyId: string) => {
    // Use local date to avoid timezone issues
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const q = query(
      collection(db, "tasks"),
      where("propertyId", "==", propertyId),
      where("status", "!=", "completed")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const allTasks: { name: string; date: string; id: string }[] = [];
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.title && data.dueDate) {
          allTasks.push({
            name: data.title,
            date: data.dueDate,
            id: docSnap.id
          });
        }
      });

      // Split into upcoming and overdue (comparing date strings directly for consistency)
      const upcoming = allTasks
        .filter(t => t.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6);
      
      const overdue = allTasks
        .filter(t => t.date < today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6);

      setPropertyTasksMap(prev => ({
        ...prev,
        [propertyId]: { upcoming, overdue }
      }));
    });

    return unsubscribe;
  };

  // Subscribe to tasks for all properties
  useEffect(() => {
    if (!properties || properties.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    properties.forEach(prop => {
      const unsubscribe = fetchTasksForProperty(prop.id);
      if (unsubscribe) unsubscribers.push(unsubscribe);
    });

    // Cleanup all subscriptions on unmount or when properties change
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [properties]);

  // Compute visible board count and flex value for bottom carousel
  const boardFlexValue = React.useMemo(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    // Board 1: All Properties - visible if user has rental properties as owner/co-owner
    let rentalCount = 0;
    properties.forEach(prop => {
      const isOwner = user && prop.ownerId === user.uid;
      const isPM = Array.isArray(prop.sharedWith) && prop.sharedWith.some((sw: any) => sw.userId === user?.uid && (sw.role === 'PM' || sw.role === 'Property Manager'));
      const isFriend = Array.isArray(prop.sharedWith) && prop.sharedWith.some((sw: any) => sw.userId === user?.uid && (sw.role === 'Friend' || sw.role === 'Friend Manager'));
      const isCoOwner = !isOwner && !isPM && !isFriend && Array.isArray(prop.sharedWith) && prop.sharedWith.some((sw: any) => sw.userId === user?.uid);
      if (prop.isRental && (isCoOwner || isOwner)) {
        rentalCount++;
      }
    });
    const showAllProperties = rentalCount > 0;
    
    // Board 2: Setup Journey - visible if properties exist AND not all complete
    const showSetupJourney = (() => {
      if (!properties || properties.length === 0) return false;
      // Check if ALL properties have 100% setup - if so, hide the board
      const allComplete = properties.every((p) => {
        const fc = p.forecasting || {};
        const hvacInstall = (fc as any).HVAC?.installDate || '';
        const roofInstall = (fc as any).Roof?.installDate || '';
        const waterInstall = (fc as any).WaterHeater?.installDate || '';
        const hvacDone = typeof hvacInstall === 'string' ? hvacInstall.trim() !== '' : !!hvacInstall;
        const roofDone = typeof roofInstall === 'string' ? roofInstall.trim() !== '' : !!roofInstall;
        const waterDone = typeof waterInstall === 'string' ? waterInstall.trim() !== '' : !!waterInstall;
        const firstDone = hvacDone && roofDone && waterDone;
        const inventory = p.inventory || [];
        let smokeValue = '';
        let airFilterValue = '';
        const invArray = Array.isArray(inventory) ? inventory : Object.values(inventory || {});
        for (const item of invArray) {
          if (!item) continue;
          let str = '';
          if (typeof item === 'string') str = item;
          else if ((item as any).name) str = (item as any).name;
          else if ((item as any).alias) str = (item as any).alias;
          const low = str.toLowerCase();
          if (low.includes('smoke') || (low.includes('co') && low.includes('detector'))) smokeValue = str;
          if (low.includes('air filter')) airFilterValue = str;
          if (smokeValue && airFilterValue) break;
        }
        const smokeParts = (smokeValue || '').split('~');
        const smokeAmount = smokeParts && smokeParts.length >= 4 ? parseInt(smokeParts[3], 10) : 0;
        const smokeDone = !isNaN(smokeAmount) && smokeAmount > 0;
        const airParts = (airFilterValue || '').split('~');
        const airFourth = airParts && airParts.length >= 4 ? (airParts[3] || '').toString().trim() : '';
        const airFilterDone = airFourth !== '';
        const addAnotherDone = (properties && properties.length >= 2) ? 1 : 0;
        const completedCount = (firstDone ? 1 : 0) + (smokeDone ? 1 : 0) + (airFilterDone ? 1 : 0) + addAnotherDone;
        const percent = Math.round((completedCount / 4) * 100);
        return percent === 100;
      });
      return !allComplete;
    })();
    
    // Board 3: All Managed Properties - visible if user has PM properties
    const showManagedProperties = pmProperties.length > 0;
    
    // Board 4: Real Estate Portfolio - visible if user has eligible properties (owner or co-owner, not PM/Friend)
    const showPortfolio = (() => {
      if (!user) return false;
      const portfolioFiltered = properties.filter(p => {
        if (p.ownerId === user.uid) return true;
        if (Array.isArray(p.sharedWith)) {
          const entry = p.sharedWith.find((sw: any) => sw.userId === user.uid);
          if (entry && entry.role !== 'PM' && entry.role !== 'Property Manager' && entry.role !== 'Friend' && entry.role !== 'Friend Manager') return true;
        }
        return false;
      });
      return portfolioFiltered.length > 0;
    })();
    
    // Board 5: Leaderboard - visible if ANY property has sharedWith.length >= 2
    const showLeaderboard = (() => {
      const leaderboardProps = properties
        .filter(p => Array.isArray(p.sharedWith) && p.sharedWith.length >= 2);
      return leaderboardProps.length > 0;
    })();
    
    // Count total visible boards
    const visibleBoardCount = [showAllProperties, showSetupJourney, showManagedProperties, showPortfolio, showLeaderboard].filter(Boolean).length;
    
    // DEBUG: Log board visibility with more details
    console.log('Board visibility:', { 
      showAllProperties, 
      showSetupJourney, 
      showManagedProperties, 
      showPortfolio, 
      showLeaderboard, 
      visibleBoardCount,
      propertiesCount: properties.length,
      pmPropertiesCount: pmProperties.length,
      rentalCount
    });
    
    // Determine flex value based on board count and screen size
    // ONLY 2 boards: use 50% to fill the space
    // 3+ boards on extra large screen (>=1650px): use 33.33% to show 3 at once
    // 3+ boards on smaller screens: use fixed 550px width
    if (visibleBoardCount === 2) {
      return { xs: '0 0 100%', sm: '0 0 calc(50% - 6px)' };
    }
    // 3+ boards - use 33.33% on extra large screens, fixed 550px otherwise
    if (isExtraLargeScreen) {
      return { xs: '0 0 100%', sm: '0 0 calc(33.33% - 8px)' };
    }
    return { xs: '0 0 100%', sm: '0 0 550px' };
  }, [properties, isLargeScreen, isExtraLargeScreen]);

  return (
    <Box sx={{
      bgcolor: '#F9F9F9',
      flexGrow: 1,
      px: { xs: 0, sm: 2, md: 4 },
      pt: { xs: 2, sm: 3, md: 4 },
      pb: { xs: 1, sm: 3, md: 4 },
      overflowY: 'auto',
      overflowX: 'hidden',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      '&::-webkit-scrollbar': { width: 0, height: 0, display: 'none' },
      maxHeight: '100vh',
      width: { xs: '100vw', md: sidebar ? 'calc(100vw - 75px)' : 'calc(100vw - 18vw)' },
      ml: { xs: 0, md: sidebar ? '75px' : '18vw' },
    }}>
      {/* Top row: Dashboard title, Customize button, and carousel nav */}
      {/* On mobile: content width 92.8vw centered, balanced left/right padding. Desktop: full width. */}
      <Box sx={{ width: '100%', maxWidth: { xs: '100%', md: 'none' }, mx: { xs: 'auto', md: 0 }, px: { xs: 2, md: 0 }, overflow: 'visible' }}>
        <DashboardHeader
          onScrollLeft={() => scrollByPage('left')}
          onScrollRight={() => scrollByPage('right')}
          onAddClick={handleAddClick}
        />
      {/* Carousel and Add Property cards row */}
      <Box sx={{ width: '100%' }}>
        {/* Carousel region with all cards inside */}
        <Box
          ref={carouselRef}
          sx={{
            width: '100%',
            height: 'auto',
            pb: 1.5,
            pt: { xs: 1.5, md: 1 },
            overflowX: 'auto',
            overflowY: 'visible',
            position: 'relative',
            boxSizing: 'border-box',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            // Desktop: minimal padding, negative margin to align with header
            pl: { xs: 0, md: 1 },
            pr: { xs: 0, md: 1 },
            ml: { xs: 0, md: -1 },
            // Mobile: left padding only, no right padding — card goes flush to right edge
            ...(isMobileOrSmall && {
              scrollSnapType: 'x mandatory',
              scrollPaddingLeft: `${mobileShadowSpacerPx}px`,
              scrollPaddingRight: 0,
              WebkitOverflowScrolling: 'touch',
            }),
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              gap: 1.5,
              width: 'max-content',
              minWidth: 0,
              transition: 'none',
              willChange: 'auto',
            }}
          >
            {loading ? (
              <>
                {[1, 2, 3].map((index) => (
                  <Paper key={index} sx={{ borderRadius: 2, width: { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, minWidth: { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, maxWidth: { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, height: 'auto', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', flex: '0 0 auto', p: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.16)', ...cardSnapSx, ...mobileCardContentSx }}>
                    {/* Skeleton Image */}
                    <Box sx={{ mb: 1.5, borderRadius: 1, height: { xs: 200, sm: 240, md: 290 }, overflow: 'hidden' }}>
                      <Skeleton variant="rectangular" width="100%" height="100%" />
                    </Box>
                    
                    {/* Skeleton Content */}
                    <Box sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                      {/* Skeleton Gauge and Details */}
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        {/* Skeleton Gauge */}
                        <Skeleton variant="circular" width={140} height={140} sx={{ flexShrink: 0 }} />
                        
                        {/* Skeleton Details */}
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8, width: '100%' }}>
                          <Skeleton variant="text" width="60%" height={20} />
                          <Skeleton variant="text" width="100%" height={16} />
                          <Skeleton variant="text" width="100%" height={16} />
                          <Skeleton variant="text" width="80%" height={16} />
                          <Skeleton variant="rectangular" width="100%" height={8} sx={{ borderRadius: 1, mt: 0.5 }} />
                        </Box>
                      </Box>
                      
                      {/* Skeleton Tasks Section */}
                      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <Skeleton variant="text" width="100%" height={18} sx={{ mb: 1 }} />
                          <Skeleton variant="text" width="100%" height={14} />
                          <Skeleton variant="text" width="100%" height={14} sx={{ mt: 0.5 }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Skeleton variant="text" width="100%" height={18} sx={{ mb: 1 }} />
                          <Skeleton variant="text" width="100%" height={14} />
                          <Skeleton variant="text" width="100%" height={14} sx={{ mt: 0.5 }} />
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </>
            ) : properties.length === 0 ? (
              <Paper sx={{ width: { xs: '100%', sm: 360, md: 480 }, minWidth: { xs: '100%', sm: 360, md: 480 }, maxWidth: { xs: '100%', sm: 360, md: 480 }, height: { xs: 200, sm: 240, md: 290 }, display: 'flex', alignItems: 'center', justifyContent: 'center',  borderRadius: 2 }}>
                <Typography variant="body1" color="text.secondary">No properties found.</Typography>
              </Paper>
            ) : (
              <>
                {properties.map((prop) => {
                  // Get current user for ownership check
                  const auth = getAuth();
                  const currentUser = auth.currentUser;
                  const isOwner = currentUser && prop.ownerId === currentUser.uid;
                  // Co-owner: not owner, not PM, not Friend, but in sharedWith
                  const isPM = Array.isArray(prop.sharedWith) && prop.sharedWith.some(sw => sw.userId === currentUser?.uid && (sw.role === 'PM' || sw.role === 'Property Manager'));
                  const isFriend = Array.isArray(prop.sharedWith) && prop.sharedWith.some(sw => sw.userId === currentUser?.uid && (sw.role === 'Friend' || sw.role === 'Friend Manager'));
                  const isCoOwner = !isOwner && !isPM && !isFriend && Array.isArray(prop.sharedWith) && prop.sharedWith.some(sw => sw.userId === currentUser?.uid);
                  
                  // Get rental income from property's rental rate
                  const rentalIncomeValue = prop.rentalRate ?? 0;
                  const rentalIncome = typeof rentalIncomeValue === 'string' ? parseFloat(rentalIncomeValue) : rentalIncomeValue;
                  
                  // Calculate property management fee
                  const pmRate = prop.pm_rate ? (typeof prop.pm_rate === 'string' ? parseFloat(prop.pm_rate.replace('%', '')) / 100 : prop.pm_rate / 100) : 0;
                  let pmCost = rentalIncome * pmRate;

                  if(!prop.isRental) {
                    pmCost = 0;
                  }
                  
                  // Get property tax amount (use latest date only if from current or previous year)
                  const propertyTaxAmount = getLatestPropertyTax(prop.propertyTaxHistory || []);
                  
                  // Insurance with frequency adjustment
                  let insuranceAmount = prop.insurance?.amount ? parseFloat(prop.insurance.amount as any) : 0;
                  if (prop.insurance?.frequency === 'Yearly') {
                    insuranceAmount = insuranceAmount / 12;
                  }
                  
                  let pmiAmount = prop.pmi ? parseFloat(prop.pmi as any) : 0;
                  
                  // HOA with frequency adjustment
                  let hoaAmount = prop.hoa ? parseFloat(prop.hoa as any) : 0;
                  if (prop.yearly === 'Yearly') {
                    hoaAmount = hoaAmount / 12;
                  }

                  if (prop.noMortgage) {
                    pmiAmount = 0;
                  }
                  
                  const mortgageAmount = prop.noMortgage ? 0 : (parseFloat(prop.mortgagePaymentAmount as any) || 0);
                  
                  // Escrow logic: When escrow (isPT) is ON and property is NOT paid off,
                  // taxes and insurance are bundled into mortgage, so don't count them separately
                  let effectiveInsuranceAmount = insuranceAmount;
                  let effectivePropertyTaxAmount = propertyTaxAmount;
                  if (prop.isPT && !prop.noMortgage) {
                    effectiveInsuranceAmount = 0;
                    effectivePropertyTaxAmount = 0;
                  }
                  
                  // Calculate forecasting value based on Roof, HVAC, WaterHeater
                  const forecastingMonthly = calculateForecastingMonthly(prop.forecasting);
                  
                  const expenses = pmCost + effectiveInsuranceAmount + pmiAmount + (effectivePropertyTaxAmount / 12) + hoaAmount + mortgageAmount + forecastingMonthly;
                  const netIncome = rentalIncome - expenses;

                  if(prop.isRental && (isCoOwner || isOwner)) {
                    totalRental += (rentalIncome);
                    totalExpenses += (expenses);
                    totalForecasting += (forecastingMonthly);
                    totalPM += (pmCost);
                    totalHOA += (hoaAmount);
                    totalPMI += (pmiAmount);
                    totalMortgage += (mortgageAmount);
                    // Include property tax (yearly amount) as monthly portion in insurance totals
                    // But respect escrow logic - only include if not in escrow or if paid off
                    const propTaxForTotals = (prop.isPT && !prop.noMortgage) ? 0 : getLatestPropertyTax(prop.propertyTaxHistory || []);
                    totalInsurance += (effectiveInsuranceAmount + (propTaxForTotals / 12));
                    // Add for equity/progress circle
                    const purchasePrice = prop.price ? parseFloat(prop.price as any) : 0;
                    const remainingBalance = prop.balance ? parseFloat(prop.balance as any) : 0;
                    totalPrice += purchasePrice;
                    totalBalance += remainingBalance;
                    if(prop.noMortgage) paidoff = true;
                    totalRentalView ++;
                    
                    // Rental-only totals for All Properties section
                    rentalOnlyIncome += rentalIncome;
                    rentalOnlyExpenses += expenses;
                    rentalOnlyForecasting += forecastingMonthly;
                    rentalOnlyPM += pmCost;
                    rentalOnlyHOA += hoaAmount;
                    rentalOnlyPMI += pmiAmount;
                    rentalOnlyMortgage += mortgageAmount;
                    // Respect escrow logic for rental-only insurance totals
                    rentalOnlyInsurance += (effectiveInsuranceAmount + (propTaxForTotals / 12));
                    rentalOnlyPrice += purchasePrice;
                    rentalOnlyBalance += remainingBalance;
                    // Track earliest property creation month/year for All Properties Actual mode
                    if (prop.createdAt) {
                      const createdDate = new Date(prop.createdAt);
                      // Use UTC to avoid timezone issues
                      const createdMonth = createdDate.getUTCMonth();
                      const createdYear = createdDate.getUTCFullYear();
                      // Compare by year first, then month
                      if (createdYear < earliestPropertyCreatedYear || 
                          (createdYear === earliestPropertyCreatedYear && createdMonth < earliestPropertyCreatedMonth)) {
                        earliestPropertyCreatedMonth = createdMonth;
                        earliestPropertyCreatedYear = createdYear;
                      }
                      
                      // Add this property's monthly profit to each month it has filled
                      const currentYear = new Date().getFullYear();
                      const currentMonthIdx = new Date().getMonth();
                      const propMonthlyProfit = rentalIncome - expenses;
                      // If property created in previous year, it contributes to all months (0-11)
                      const propEffectiveStartMonth = createdYear < currentYear ? 0 : createdMonth;
                      // Add profit to each filled month for this property
                      for (let m = propEffectiveStartMonth; m <= currentMonthIdx; m++) {
                        monthlyRentalProfits[m] += propMonthlyProfit;
                        monthlyRentalHasData[m] = true;
                      }
                    }
                  }
                  
                  // Calculate lease length in months from leaseStart and leaseEnd
                  let leaseEndDate = null;
                  let leaseLength = null;
                  let hasValidLease = false;
                  
                  if (prop.leaseStart && prop.leaseEnd) {
                    try {
                      const leaseStartDate = new Date(prop.leaseStart);
                      leaseEndDate = new Date(prop.leaseEnd);
                      // Calculate months between two dates
                      leaseLength = Math.round((leaseEndDate.getFullYear() - leaseStartDate.getFullYear()) * 12 + (leaseEndDate.getMonth() - leaseStartDate.getMonth()));
                      hasValidLease = true;
                    } catch (e) {
                      leaseEndDate = null;
                      leaseLength = null;
                      hasValidLease = false;
                    }
                  } else if (prop.leaseEnd) {
                    try {
                      leaseEndDate = new Date(prop.leaseEnd);
                      const today = new Date();
                      leaseLength = Math.round((leaseEndDate.getFullYear() - today.getFullYear()) * 12 + (leaseEndDate.getMonth() - today.getMonth()));
                      hasValidLease = true;
                    } catch (e) {
                      leaseEndDate = null;
                      leaseLength = null;
                      hasValidLease = false;
                    }
                  } else {
                    leaseEndDate = null;
                    leaseLength = null;
                    hasValidLease = false;
                  }
                  
                  // Get upcoming and overdue tasks for this property from the map
                  const propertyUpcoming = propertyTasksMap[prop.id]?.upcoming || [];
                  const propertyOverdue = propertyTasksMap[prop.id]?.overdue || [];
                  
                  const propertyValue = prop.estimatedValue ? parseFloat(prop.estimatedValue as any) : 0;
                  const purchasePrice = prop.price ? parseFloat(prop.price as any) : 0;
                  const remainingBalance = prop.balance ? parseFloat(prop.balance as any) : 0;
                  const equity = propertyValue - remainingBalance;
                  const appreciation = propertyValue - purchasePrice;


                  // Homeowner expenses should also respect escrow logic
                  const monthlyHomeownerExpenses = effectiveInsuranceAmount + pmiAmount + hoaAmount + mortgageAmount + forecastingMonthly + (effectivePropertyTaxAmount / 12);
                  let homeownerExpenses = monthlyHomeownerExpenses;
                  if (cardButtonState[prop.id] === 'Yearly') {
                    homeownerExpenses = monthlyHomeownerExpenses * 12;
                  } else if (cardButtonState[prop.id] === 'Actual') {
                    const currentMonthIdx = new Date().getMonth();
                    const currentYear = new Date().getFullYear();
                    const createdDate = prop.createdAt ? new Date(prop.createdAt) : null;
                    const createdYear = createdDate ? createdDate.getFullYear() : currentYear;
                    const createdMonthIdx = createdDate ? createdDate.getMonth() : 0;
                    const effectiveStartMonth = createdYear < currentYear ? 0 : createdMonthIdx;
                    const filledMonthsCount = Math.max(1, currentMonthIdx - effectiveStartMonth + 1);
                    homeownerExpenses = monthlyHomeownerExpenses * filledMonthsCount;
                  }
                  // Aggregate totals for homeowner (non-rental) properties so All Properties reflects taxes too
                  if ((isOwner || isCoOwner) && !prop.isRental) {
                    totalForecasting += (forecastingMonthly);
                    totalHOA += (hoaAmount);
                    totalPMI += (pmiAmount);
                    totalMortgage += (mortgageAmount);
                    // Respect escrow logic for homeowner insurance totals
                    const propTaxForTotals = (prop.isPT && !prop.noMortgage) ? 0 : getLatestPropertyTax(prop.propertyTaxHistory || []);
                    totalInsurance += ((effectiveInsuranceAmount || 0) + (propTaxForTotals / 12));
                    totalPrice += purchasePrice;
                    totalBalance += remainingBalance;
                    if(prop.noMortgage) paidoff = true;
                  }
                  
                  // Use wide 2x2 grid layout on desktop (>=1000px) when user has only one property
                  const isSingleProperty = properties.length === 1 && isSingleViewEnabled;
                  
                  // Conditional rendering logic:
                  // 1. If owner or co-owner and rental property: show RENTAL CARD
                  // 2. If shared member (not owner) and PM role: show PM CARD
                  // 3. If owner or co-owner and not rental: show HOMEOWNER CARD
                  // 4. Otherwise: show FRIEND CARD (if you have one)
                  return ((isOwner || isCoOwner) && prop.isRental) ? (
                    // RENTAL PROPERTY CARD (for owner or co-owner)
                    <Paper key={prop.id} sx={{ borderRadius: 2, width: isSingleProperty ? { xs: '100%', sm: '100%', md: singleCardWidth } : { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, minWidth: isSingleProperty ? { xs: '100%', sm: '100%', md: singleCardWidth } : { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, maxWidth: isSingleProperty ? { xs: '100vw', sm: '100%', md: singleCardWidth } : { xs: '100vw', sm: cardWidthSm, md: cardWidthMd }, height: 'auto', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', flex: '0 0 auto', p: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.16)', ...cardSnapSx, ...mobileCardContentSx }}>
                      
                      {/* Main content wrapper - 2x2 grid for single property, vertical for multiple */}
                      {false ? (
                        // SINGLE PROPERTY: on mobile stacked (image → breakdown → chart → tasks), on desktop 2x2 grid
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: { xs: 'auto', md: 580 } }}>
                          {/* Top Row: Image + Property Breakdown — column on xs/sm, row on md */}
                          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, flex: { xs: '0 0 auto', md: '0 0 52%' }, overflow: 'hidden' }}>
                            {/* Image: full width on mobile, 50% on desktop */}
                            <Box sx={{ width: { xs: '100%', md: '50%' }, maxHeight: { md: '100%' }, minHeight: { xs: 200, md: 0 }, position: 'relative', overflow: 'hidden', cursor: 'pointer', flexShrink: 0, borderRadius: 2 }}
                              onClick={() => {
                                if (typeof onPropertyClick === 'function') onPropertyClick(prop.id);
                              }}>
                              <img src={prop.photoUrl || "/empty-property.png"} alt={prop.propertyName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </Box>
                            
                            {/* Property Breakdown Details: full width on mobile, 50% on desktop */}
                            <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex', flexDirection: 'column', gap: 0.8, p: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ bgcolor: "rgba(52,55,72,0.85)", color: '#fff', px: 2, py: 0.75, borderRadius: 1.5, fontWeight: 600, fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif' }}>
                                  {(() => {
                                    const auth = getAuth();
                                    const user = auth.currentUser;
                                    if (user && prop.id) {
                                      const loadedProp = properties.find(p => p.id === prop.id);
                                      if (loadedProp && (loadedProp as any).sharedWith && Array.isArray((loadedProp as any).sharedWith)) {
                                        const entry = (loadedProp as any).sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === user.uid);
                                        if (entry && typeof entry === 'object') {
                                          return (entry as any).alias ?? '';
                                        }
                                      }
                                    }
                                    return prop.tag || 'Unknown';
                                  })()}
                                </Box>
                                <Button variant="outlined" size="small" sx={{ minWidth: 0, px: 1.2, py: 0.4, fontSize: 12, fontWeight: 400, borderRadius: 2, background: '#fff', border: '1px solid #B0B8C1', color: '#333', boxShadow: 'none', textTransform: 'none', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }}
                                  onClick={() => {
                                    const currentState = cardButtonState[prop.id] || 'Monthly';
                                    const nextState = currentState === 'Monthly' ? 'Yearly' : currentState === 'Yearly' ? 'Actual' : 'Monthly';
                                    
                                    if (currentState === 'Yearly' && nextState === 'Actual') {
                                      // Yearly to Actual: expand to full, then shrink to zero while showing segments
                                      setCircleAnimState(prev => ({ ...prev, [prop.id]: 'toFull' }));
                                      setTimeout(() => {
                                        setCircleAnimState(prev => ({ ...prev, [prop.id]: 'shrink' }));
                                        setCardButtonState(prev => ({ ...prev, [prop.id]: nextState }));
                                        setTimeout(() => {
                                          setCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                          setRentalAnimationKey(prev => ({ ...prev, [prop.id]: (prev[prop.id] || 0) + 1 }));
                                        }, 700);
                                      }, 500);
                                    } else if (currentState === 'Actual' && nextState === 'Monthly') {
                                      // Actual to Monthly: expand from zero to full, then shrink to monthly value
                                      setCircleAnimState(prev => ({ ...prev, [prop.id]: 'expandFromZero' }));
                                      setTimeout(() => {
                                        setCardButtonState(prev => ({ ...prev, [prop.id]: nextState }));
                                        setCircleAnimState(prev => ({ ...prev, [prop.id]: 'shrinkToOrigin' }));
                                        setTimeout(() => {
                                          setCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                          setRentalAnimationKey(prev => ({ ...prev, [prop.id]: (prev[prop.id] || 0) + 1 }));
                                        }, 700);
                                      }, 500);
                                    } else {
                                      // Normal animation for Monthly <-> Yearly transitions
                                      setCardButtonState(prev => ({ ...prev, [prop.id]: nextState }));
                                      setCircleAnimState(prev => ({ ...prev, [prop.id]: 'to5' }));
                                      setTimeout(() => {
                                        setCircleAnimState(prev => ({ ...prev, [prop.id]: 'back' }));
                                        setTimeout(() => {
                                          setCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                          setRentalAnimationKey(prev => ({ ...prev, [prop.id]: (prev[prop.id] || 0) + 1 }));
                                        }, 700);
                                      }, 700);
                                    }
                                  }}
                                >
                                  {(() => {
                                    const current = cardButtonState[prop.id] || 'Monthly';
                                    return current === 'Monthly' ? 'Monthly' : current === 'Yearly' ? 'Yearly' : 'Actual';
                                  })()}
                                </Button>
                              </Box>
                              <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                Property Breakdown
                              </Typography>
                              <Typography sx={{ fontSize: 15, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.7 }}>
                                <strong>Rental Income:</strong> ${(() => {
                                  const income = rentalIncome ?? 0;
                                  if (cardButtonState[prop.id] === 'Yearly') {
                                    const leaseMonths = leaseLength ?? 0;
                                    return Math.round(income * leaseMonths).toLocaleString() + ' Total';
                                  }
                                  return income.toLocaleString() + ' Monthly';
                                })()}<br/>
                                <strong>Expenses:</strong> {(() => {
                                  const monthly = expenses ?? 0;
                                  if (cardButtonState[prop.id] === 'Yearly') {
                                    const leaseMonths = leaseLength ?? 0;
                                    return '$' + Math.round(monthly * leaseMonths).toLocaleString() + ' Total';
                                  }
                                  return '$' + Math.round(monthly).toLocaleString() + ' Monthly';
                                })()}
                              </Typography>
                              <Box sx={{ my: 1 }} />
                              <Typography sx={{ fontSize: 15, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.7 }}>
                                <strong>Lease Length:</strong> {hasValidLease ? `${leaseLength} Months` : ''}<br/>
                                <strong>Lease End Date:</strong> {hasValidLease && leaseEndDate ? leaseEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}<br/>
                                <strong>Total Lease Revenue:</strong> ${hasValidLease ? ((rentalIncome ?? 0) * (leaseLength ?? 0)).toLocaleString() : '0'}
                              </Typography>
                              
                              {/* Lease Progress Bar */}
                              <Box sx={{ mt: 2 }}>
                                {(() => {
                                  const today = new Date();
                                  const monthsLeft = Math.max(0, Math.round((leaseEndDate ? leaseEndDate.getFullYear() : today.getFullYear()) - today.getFullYear()) * 12 + ((leaseEndDate ? leaseEndDate.getMonth() : today.getMonth()) - today.getMonth()));
                                  const filledPercentage = leaseLength && leaseLength > 0 ? (monthsLeft / leaseLength) * 100 : 0;
                                  return (
                                    <>
                                      <Box sx={{ width: '100%', height: 18, bgcolor: '#e8e8e8', borderRadius: 10, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                                        <Box sx={{ height: '100%', width: `${filledPercentage}%`, bgcolor: '#89AE99', borderRadius: 10 }} />
                                      </Box>
                                      <Typography sx={{ fontSize: 12, color: '#666', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.5, textAlign: 'center', fontWeight: 500 }}>
                                        {monthsLeft} Months Left
                                      </Typography>
                                    </>
                                  );
                                })()}
                              </Box>
                            </Box>
                          </Box>
                          
                          {/* Bottom Row: Chart + Tasks — column on xs/sm, row on md */}
                          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 1, md: 2 }, flex: { xs: '0 0 auto', md: '0 0 48%' }, alignItems: { xs: 'stretch', md: 'center' } }}>
                            {/* Chart: full width on mobile, 50% on desktop */}
                            <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex', alignItems: 'center', justifyContent: 'center', mt: { xs: 0, md: -1.5 } }}>
                              <Box sx={{ position: 'relative', width: { xs: 180, md: 300 }, height: { xs: 180, md: 300 } }}>
                                <svg width="300" height="300" viewBox="0 0 110 110" style={{ position: 'absolute' }}>
                                  <defs>
                                    <path
                                      id="arcPathRentalSingle"
                                      d="M 32 55 A 23 23 0 0 1 78 55"
                                      fill="none"
                                    />
                                  </defs>
                                  
                                  {/* OUTER CIRCLE - Dynamic Colored Segments */}
                                  {(() => {
                                    const mortgagePayment = prop.noMortgage ? 0 : parseValue(prop.mortgagePaymentAmount);
                                    let insuranceAmount = parseValue(prop.insurance?.amount);
                                    if (prop.insurance?.frequency === 'Yearly') {
                                      insuranceAmount = insuranceAmount / 12;
                                    }
                                    const propertyTaxAmount = getLatestPropertyTax(prop.propertyTaxHistory || []);
                                    const propertyTaxMonthly = propertyTaxAmount / 12;
                                    if (prop.isPT && !prop.noMortgage) {
                                      insuranceAmount = 0;
                                    } else {
                                      insuranceAmount = insuranceAmount + propertyTaxMonthly;
                                    }
                                    let hoaAmount = prop.hoa ? (prop.yearly === 'Yearly' ? parseValue(prop.hoa) / 12 : parseValue(prop.hoa)) : 0;
                                    let pmiAmount = parseValue(prop.pmi);
                                    if (prop.noMortgage) pmiAmount = 0;
                                    const forecastingMonthly = calculateForecastingMonthly(prop.forecasting);
                                    let pmCost = 0;
                                    if (prop.pm_rate && rentalIncome) {
                                      const pmRate = typeof prop.pm_rate === 'string' ? parseFloat(prop.pm_rate) : prop.pm_rate;
                                      if (!isNaN(pmRate)) pmCost = rentalIncome * (pmRate / 100);
                                    }
                                    const income = rentalIncome ?? 0;
                                    const expenses = mortgagePayment + insuranceAmount + hoaAmount + pmiAmount + forecastingMonthly + pmCost;
                                    const profit = income - expenses;
                                    
                                    // Use same colors as multi-property view
                                    const allSegments = [
                                      ...(profit > 0 ? [{ value: profit, color: '#89AE99', label: 'Profit' }] : []),
                                      { value: pmCost, color: '#B38796', label: 'Property Management' },
                                      ...(prop.noMortgage ? [] : [{ value: mortgagePayment, color: '#E35E61', label: 'Mortgage' }]),
                                      { value: insuranceAmount, color: '#EEB05E', label: 'Taxes/Insurance' },
                                      { value: hoaAmount, color: '#db83ad', label: 'HOA' },
                                      { value: pmiAmount, color: '#C45584', label: 'PMI' },
                                      { value: forecastingMonthly, color: '#D2794F', label: 'Forecasting/Planning' }
                                    ];
                                    const segments = allSegments.filter(seg => seg.value > 0);
                                    const totalValue = segments.reduce((s, seg) => s + seg.value, 0);
                                    if (totalValue === 0) return <circle cx="55" cy="55" r="44" fill="none" stroke="#e8e8e8" strokeWidth="6.5" />;
                                    
                                    // Sort and reorder segments for visual distribution (same as multi-property view)
                                    const sorted = [...segments].sort((a, b) => b.value - a.value);
                                    const drawSegments: typeof sorted = [];
                                    for (let i = 0; i < sorted.length; i += 2) {
                                      drawSegments.push(sorted[i]);
                                    }
                                    for (let i = sorted.length % 2 === 0 ? sorted.length - 1 : sorted.length - 2; i > 0; i -= 2) {
                                      drawSegments.push(sorted[i]);
                                    }
                                    
                                    const gap = 8;
                                    const radius = 44;
                                    const circumference = 2 * Math.PI * radius;
                                    const totalGaps = drawSegments.length > 1 ? gap * drawSegments.length : 0;
                                    const availableSpace = circumference - totalGaps;
                                    const biggestSegment = drawSegments[0];
                                    const biggestPercent = totalValue > 0 ? (biggestSegment.value / totalValue) * 100 : 0;
                                    const biggestDashLength = (biggestPercent / 100) * availableSpace;
                                    const angleForBiggest = (biggestDashLength / circumference) * 360;
                                    const rotationAngle = 180 - (angleForBiggest / 2);
                                    let offset = 0;
                                    const circles: React.ReactElement[] = [];
                                    
                                    drawSegments.forEach((segment) => {
                                      const percent = totalValue > 0 ? (segment.value / totalValue) * 100 : 0;
                                      const dashLength = (percent / 100) * availableSpace;
                                      circles.push(
                                        <circle
                                          key={segment.label}
                                          cx="55"
                                          cy="55"
                                          r={radius}
                                          fill="none"
                                          stroke={segment.color}
                                          strokeWidth={
                                            hoveredSegment?.source === 'rental' && hoveredSegment?.propertyId === prop.id
                                              ? hoveredSegment?.label === segment.label ? "7.5" : "5.5"
                                              : "6.5"
                                          }
                                          strokeDasharray={`${dashLength} ${circumference}`}
                                          strokeDashoffset={offset}
                                          strokeLinecap="round"
                                          transform={`rotate(${rotationAngle + 90} 55 55)`}
                                          style={{
                                            opacity: hoveredSegment?.source === 'rental-inner' && hoveredSegment?.propertyId === prop.id ? 0.3 :
                                                    hoveredSegment?.source === 'rental' && hoveredSegment?.propertyId === prop.id && hoveredSegment?.label !== segment.label ? 0.3 : 1,
                                            transition: 'opacity 0.2s ease-in-out, stroke-width 0.2s ease-in-out'
                                          }}
                                          onMouseEnter={(e: any) => {
                                            const period = cardButtonState[prop.id] || 'Monthly';
                                            const amt = period === 'Yearly' ? segment.value * 12 : segment.value;
                                            setHoveredSegment({ label: segment.label, percent, amount: amt, period, x: e.clientX, y: e.clientY, source: 'rental', propertyId: prop.id });
                                          }}
                                          onMouseMove={(e: any) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                          onMouseLeave={() => setHoveredSegment(null)}
                                        />
                                      );
                                      offset -= (dashLength + gap);
                                    });
                                    return <>{circles}</>;
                                  })()}
                                  
                                  {/* Inner circle */}
                                  {(() => {
                                    const currentButtonState = cardButtonState[prop.id] || 'Monthly';
                                    const r = 35;
                                    const circ = 2 * Math.PI * r;
                                    const animState = circleAnimState[prop.id] || 'origin';
                                    
                                    // Calculate 12 segments data (for Actual state)
                                    const segmentCount = 12;
                                    const gapAngle = 13; // degrees
                                    const totalGapDegrees = segmentCount * gapAngle;
                                    const availableDegrees = 360 - totalGapDegrees;
                                    const segmentDegrees = availableDegrees / segmentCount;
                                    const segmentLength = (segmentDegrees / 360) * circ;
                                    const currentMonthIdx = new Date().getMonth();
                                    const currentYear = new Date().getFullYear();
                                    const createdDate = prop.createdAt ? new Date(prop.createdAt) : null;
                                    const createdYear = createdDate ? createdDate.getFullYear() : currentYear;
                                    const createdMonthIdx = createdDate ? createdDate.getMonth() : 0;
                                    // If created in a previous year, start from January (0); otherwise use creation month
                                    const startMonthIdx = createdYear < currentYear ? 0 : createdMonthIdx;
                                    
                                    // Calculate outer circle total for tooltips
                                    const mortgagePayment = prop.noMortgage ? 0 : parseValue(prop.mortgagePaymentAmount);
                                    let insuranceAmount = parseValue(prop.insurance?.amount);
                                    if (prop.insurance?.frequency === 'Yearly') insuranceAmount = insuranceAmount / 12;
                                    const propertyTaxAmount = getLatestPropertyTax(prop.propertyTaxHistory || []);
                                    if (prop.isPT && !prop.noMortgage) insuranceAmount = 0; else insuranceAmount += propertyTaxAmount / 12;
                                    let hoaAmount = prop.hoa ? (prop.yearly === 'Yearly' ? parseValue(prop.hoa) / 12 : parseValue(prop.hoa)) : 0;
                                    let pmiAmount = prop.noMortgage ? 0 : parseValue(prop.pmi);
                                    let forecastingMonthly = 0;
                                    if (prop.forecasting && typeof prop.forecasting === 'object') {
                                      forecastingMonthly = calculateForecastingMonthly(prop.forecasting);
                                    }
                                    let pmCost = 0;
                                    const rentalIncomeVal = prop.rentalRate ? parseValue(prop.rentalRate) : 0;
                                    if (prop.pm_rate && rentalIncomeVal) { const pmRate = typeof prop.pm_rate === 'string' ? parseFloat(prop.pm_rate) : prop.pm_rate; if (!isNaN(pmRate)) pmCost = rentalIncomeVal * (pmRate / 100); }
                                    // Monthly profit for 12-segment tooltips (rental income - expenses)
                                    const monthlyExpenses = mortgagePayment + insuranceAmount + hoaAmount + pmiAmount + forecastingMonthly + pmCost;
                                    const monthlyTotal = rentalIncomeVal - monthlyExpenses;
                                    
                                    // Actual state (no animation): show only 12 segments
                                    if (currentButtonState === 'Actual' && animState === 'origin') {
                                      return (
                                        <TwelveSegmentCircle
                                          activeColor="#89AE99"
                                          startMonthIdx={startMonthIdx}
                                          onMouseEnter={(e, idx, name) => {
                                            const isInRange = idx >= startMonthIdx && idx <= currentMonthIdx;
                                            setHoveredSegment({ label: name, amount: isInRange ? monthlyTotal : -1, percent: -1, period: 'Actual', x: e.clientX, y: e.clientY, source: 'rental-inner', propertyId: prop.id });
                                          }}
                                          onMouseMove={(e) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                          onMouseLeave={() => setHoveredSegment(null)}
                                        />
                                      );
                                    }
                                    
                                    // Monthly/Yearly state: Paid vs Owed segments
                                    const purchasePrice = prop.price ? parseFloat(prop.price as any) : 0;
                                    const remainingBalance = prop.noMortgage ? 0 : (prop.balance ? parseFloat(prop.balance as any) : 0);
                                    const equity = purchasePrice - remainingBalance;
                                    let filledPercentage = 0;
                                    if (prop.noMortgage) {
                                      filledPercentage = 100;
                                    } else if (purchasePrice > 0) {
                                      filledPercentage = Math.min(100, Math.max(0, (equity / purchasePrice) * 100));
                                    }
                                    const dashLength = (filledPercentage / 100) * circ;
                                    const dashGap = circ - dashLength;
                                    
                                    // Animation state
                                    let targetPercent = 5;
                                    if (filledPercentage < 5) targetPercent = Math.max(0, filledPercentage / 2);
                                    const targetLength = (targetPercent / 100) * circ;
                                    const targetGap = circ - targetLength;
                                    let animation = '';
                                    if (animState === 'to5') animation = 'fillTo5 0.7s ease-in-out forwards';
                                    else if (animState === 'back') animation = 'fillBack 0.7s ease-in-out forwards';
                                    else if (animState === 'toFull') animation = 'fillToFull 0.5s ease-in-out forwards';
                                    else if (animState === 'shrink') animation = 'shrinkToZero 0.7s ease-in-out forwards';
                                    else if (animState === 'expandFromZero') animation = 'expandFromZero 0.5s ease-in-out forwards';
                                    else if (animState === 'shrinkToOrigin') animation = 'shrinkToOrigin 0.7s ease-in-out forwards';
                                    
                                    // Show segments during shrink (revealing) or expandFromZero (covering)
                                    const showSegments = animState === 'shrink' || animState === 'expandFromZero';
                                    
                                    return (
                                      <>
                                        {/* Show 12 segments during shrink/expand animation - render FIRST so they're underneath */}
                                        {showSegments && Array.from({ length: segmentCount }).map((_, i) => {
                                          const startAngle = i * (segmentDegrees + gapAngle) - 90;
                                          const offset = -(startAngle / 360) * circ;
                                          const isInRange = i >= startMonthIdx && i <= currentMonthIdx;
                                          return (
                                            <circle
                                              key={`shrink-segment-single-${i}`}
                                              cx="55" cy="55" r={r}
                                              fill="none"
                                              stroke={isInRange ? "#89AE99" : "#e0e0e0"}
                                              strokeWidth="6.5"
                                              strokeLinecap="round"
                                              strokeDasharray={`${segmentLength} ${circ - segmentLength}`}
                                              strokeDashoffset={offset}
                                              style={{ pointerEvents: 'none' }}
                                            />
                                          );
                                        })}
                                        {/* Background grey circle (Owed) - hide during shrink/expand so segments show through */}
                                        {!showSegments && (
                                          <circle 
                                            cx="55" cy="55" r={r} fill="none" stroke="#e8e8e8" strokeWidth="6.5"
                                            style={{ opacity: hoveredSegment?.source === 'rental' && hoveredSegment?.propertyId === prop.id ? 0.3 : 1, transition: 'opacity 0.2s ease-in-out' }}
                                            onMouseEnter={e => setHoveredSegment({ label: 'Owed', amount: Math.max(0, remainingBalance), percent: purchasePrice > 0 ? (Math.max(0, remainingBalance) / purchasePrice) * 100 : 0, period: 'Monthly', x: e.clientX, y: e.clientY, source: 'rental-inner', propertyId: prop.id })}
                                            onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                            onMouseLeave={() => setHoveredSegment(null)}
                                          />
                                        )}
                                        {/* Progress fill (Paid) */}
                                        {filledPercentage > 0 && (
                                          <circle 
                                            key={`paid-circle-single-${rentalAnimationKey[prop.id] || 0}`}
                                            cx="55" cy="55" r={r} fill="none" stroke="#6A7F91" strokeWidth="6.5"
                                            strokeLinecap="round"
                                            strokeDasharray={animState === 'to5' ? `${targetLength} ${targetGap}` : animState === 'toFull' || animState === 'shrink' ? `${circ} 0` : animState === 'expandFromZero' ? `0 ${circ}` : animState === 'shrinkToOrigin' ? `${circ} 0` : `${dashLength} ${dashGap}`} 
                                            strokeDashoffset={-circ / 4}
                                            transform="rotate(-180 55 55)"
                                            style={{ 
                                              animation,
                                              '--origin-length': `${dashLength}px`,
                                              '--origin-gap': `${dashGap}px`,
                                              '--five-length': `${targetLength}px`,
                                              '--five-gap': `${targetGap}px`,
                                              '--full-length': `${circ}px`,
                                              '--full-gap': '0px',
                                              opacity: hoveredSegment?.source === 'rental' && hoveredSegment?.propertyId === prop.id ? 0.3 : 1,
                                              transition: 'opacity 0.2s ease-in-out'
                                            } as any}
                                            onMouseEnter={e => setHoveredSegment({ label: 'Paid', amount: Math.max(0, equity), percent: purchasePrice > 0 ? (Math.max(0, equity) / purchasePrice) * 100 : 0, period: 'Monthly', x: e.clientX, y: e.clientY, source: 'rental-inner', propertyId: prop.id })}
                                            onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                            onMouseLeave={() => setHoveredSegment(null)}
                                          />
                                        )}
                                      </>
                                    );
                                  })()}
                                  
                                  {/* Curved text for equity ratio */}
                                  {!prop.noMortgage && (cardButtonState[prop.id] || 'Monthly') !== 'Actual' && (
                                    <text fill="#999" fontSize="6" textAnchor="middle">
                                      <textPath href="#arcPathRentalSingle" startOffset="50%">
                                        {(() => {
                                          const purchasePriceVal = prop.price ? parseFloat(prop.price as any) : 0;
                                          const remainingBalanceVal = prop.balance ? parseFloat(prop.balance as any) : 0;
                                          const equityVal = purchasePriceVal - remainingBalanceVal;
                                          if (!purchasePriceVal || isNaN(purchasePriceVal) || purchasePriceVal === 0) return 'N/A';
                                          return `${formatKOrM(equityVal)}/${formatKOrM(purchasePriceVal)}`;
                                        })()}
                                      </textPath>
                                    </text>
                                  )}
                                </svg>
                                
                                {/* Tooltips */}
                                <SegmentTooltip data={hoveredSegment} source="rental-inner" propertyId={prop.id} variant="amount-only" formatAmount={(amt) => amt < 0 ? `-$${Math.abs(amt).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : `$${amt.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
                                <SegmentTooltip data={hoveredSegment} source="rental" propertyId={prop.id} variant="full" />
                                
                                {/* Center text */}
                                {(() => {
                                  const currentState = cardButtonState[prop.id] || 'Monthly';
                                  const monthlyExact = netIncome;
                                  const currentMonthIdx = new Date().getMonth();
                                  const currentYear = new Date().getFullYear();
                                  const createdDate = prop.createdAt ? new Date(prop.createdAt) : null;
                                  const createdYear = createdDate ? createdDate.getFullYear() : currentYear;
                                  const createdMonthIdx = createdDate ? createdDate.getMonth() : 0;
                                  // If created in a previous year, start from January (0); otherwise use creation month
                                  const effectiveStartMonth = createdYear < currentYear ? 0 : createdMonthIdx;
                                  const filledMonthsCount = Math.max(1, currentMonthIdx - effectiveStartMonth + 1);
                                  const displayValue = currentState === 'Yearly' ? Math.round(monthlyExact * 12) : currentState === 'Actual' ? Math.round(monthlyExact * filledMonthsCount) : Math.round(monthlyExact);
                                  let showNA = false;
                                  if (displayValue === null || displayValue === undefined || isNaN(displayValue) || (displayValue > -1 && displayValue < 1)) showNA = true;
                                  const isNegative = displayValue < 0;
                                  const canEdit = showNA && !isFriend; // Friends can't edit
                                  return (
                                    <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 1, pointerEvents: canEdit ? 'auto' : 'none', cursor: canEdit ? 'pointer' : 'default' }}
                                      onClick={canEdit ? () => handleOpenEditModal(prop, 'owner') : undefined}
                                    >
                                      <Typography sx={{ fontSize: 27, fontWeight: 700, color: showNA ? '#89AE99' : (isNegative ? '#E35E61' : '#89AE99'), fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1, '&:hover': canEdit ? { textDecoration: 'underline' } : {} }}>
                                        {showNA ? 'Add info' : `${isNegative ? '-' : ''}$${Math.abs(displayValue).toLocaleString('en-US')}`}
                                      </Typography>
                                      <Typography sx={{ fontSize: 11, color: '#888', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1, mt: 0.5 }}>
                                        {currentState === 'Yearly' ? 'Yearly Profit' : currentState === 'Actual' ? 'Year to Date' : 'Monthly Profit'}
                                      </Typography>
                                    </Box>
                                  );
                                })()}
                              </Box>
                            </Box>
                            
                            {/* Tasks: full width on mobile, 50% on desktop */}
                            <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex', gap: { xs: 1.5, md: 3 }, p: { xs: 1, md: 2 } }}>
                              {/* Upcoming Tasks */}
                              <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                                <Typography sx={{ fontSize: { xs: 12, md: 14 }, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1.5 }}>
                                  Upcoming Tasks
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                                  {propertyUpcoming.length > 0 ? (
                                    propertyUpcoming.slice(0, 6).map(task => (
                                      <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#E8A8A8', flexShrink: 0, mt: 0.5 }} />
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                          <Typography sx={{ fontSize: 12, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {task.name.length > 25 ? task.name.substring(0, 25) + '...' : task.name}
                                          </Typography>
                                          <Typography sx={{ fontSize: 10, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                            {task.date}
                                          </Typography>
                                        </Box>
                                      </Box>
                                    ))
                                  ) : (
                                    <Typography sx={{ fontSize: 11, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No upcoming tasks</Typography>
                                  )}
                                </Box>
                              </Box>
                              
                              {/* Overdue Tasks */}
                              <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                                <Typography sx={{ fontSize: { xs: 12, md: 14 }, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1.5 }}>
                                  Overdue Tasks
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                                  {propertyOverdue.length > 0 ? (
                                    propertyOverdue.slice(0, 6).map(task => (
                                      <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#E8A8A8', flexShrink: 0, mt: 0.5 }} />
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                          <Typography sx={{ fontSize: 12, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {task.name.length > 25 ? task.name.substring(0, 25) + '...' : task.name}
                                          </Typography>
                                          <Typography sx={{ fontSize: 10, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                            {task.date}
                                          </Typography>
                                        </Box>
                                      </Box>
                                    ))
                                  ) : (
                                    <Typography sx={{ fontSize: 11, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No overdue tasks</Typography>
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      ) : (
                        // MULTIPLE PROPERTIES: Original vertical layout
                        <>
                      {/* Property Image Section - Original Size */}
                      <Box sx={{ position: 'relative', height: { xs: 200, sm: 240, md: 290 }, overflow: 'hidden', cursor: 'pointer', flexShrink: 0, borderRadius: 2 }}
                        onClick={() => {
                          if (typeof onPropertyClick === 'function') onPropertyClick(prop.id);
                        }}>
                        {/* Property type label in top-left corner */}
                        <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 2, bgcolor: "rgba(52,55,72,0.7)", color: '#fff', px: 2, py: 0.75,  borderRadius: 1.5, fontWeight: 600, fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif' }}>
                          {(() => {
                            const auth = getAuth();
                            const user = auth.currentUser;
                            if (user && prop.id) {
                              const loadedProp = properties.find(p => p.id === prop.id);
                              if (loadedProp && (loadedProp as any).sharedWith && Array.isArray((loadedProp as any).sharedWith)) {
                                const entry = (loadedProp as any).sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === user.uid);
                                if (entry && typeof entry === 'object') {
                                  return (entry as any).alias ?? '';
                                }
                              }
                            }
                            return prop.tag || 'Unknown';
                          })()}
                        </Box>
                        <img src={prop.photoUrl || "/empty-property.png"} alt={prop.propertyName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </Box>
                      
                      {/* Property Breakdown Section */}
                      <Box sx={{ p: 1.5, pb: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8, overflowY: 'auto' }}>
                        {/* Breakdown with Gauge and Details */}
                        <Box sx={{
                          display: 'flex',
                          gap: 2,
                          alignItems: 'flex-start',
                          flexWrap: { xs: 'wrap', sm: 'nowrap' },
                          minWidth: 0,
                          width: '100%',
                          overflowX: { xs: 'auto', sm: 'visible' },
                          boxSizing: 'border-box',
                        }}>
                          <Box sx={{ flexShrink: 0, width: 220, height: 220, minWidth: 220, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', mt: -1.5, ml: -1 }}>
                            <svg width="220" height="220" viewBox="0 0 110 110" style={{ position: 'absolute' }}>
                              <defs>
                                <path
                                  id="arcPathRental"
                                  d="M 32 55 A 23 23 0 0 1 78 55"
                                  fill="none"
                                />
                              </defs>
                              
                              {/* OUTER CIRCLE - Dynamic Colored Segments (same logic as homeowner view) */}
                              {(() => {
                                // ...existing code for segment calculation...
                                // (copy the same logic as before up to segment calculation)
                                const mortgagePayment = prop.noMortgage ? 0 : parseValue(prop.mortgagePaymentAmount);
                                let insuranceAmount = parseValue(prop.insurance?.amount);
                                if (prop.insurance?.frequency === 'Yearly') {
                                  insuranceAmount = insuranceAmount / 12;
                                }
                                const propertyTaxAmount = getLatestPropertyTax(prop.propertyTaxHistory || []);
                                const propertyTaxMonthly = propertyTaxAmount / 12;
                                
                                // Escrow logic: When escrow (isPT) is ON and property is NOT paid off,
                                // taxes and insurance are bundled into mortgage, so set to 0
                                if (prop.isPT && !prop.noMortgage) {
                                  insuranceAmount = 0;
                                } else {
                                  insuranceAmount = insuranceAmount + propertyTaxMonthly;
                                }
                                
                                let hoaAmount = prop.hoa ? (prop.yearly === 'Yearly' ? parseValue(prop.hoa) / 12 : parseValue(prop.hoa)) : 0;
                                let pmiAmount = parseValue(prop.pmi);
                                if (prop.noMortgage) {
                                  pmiAmount = 0;
                                }
                                const forecastingMonthly = calculateForecastingMonthly(prop.forecasting);
                                let pmCost = 0;
                                if (prop.pm_rate && rentalIncome) {
                                  const pmRate = typeof prop.pm_rate === 'string' ? parseFloat(prop.pm_rate) : prop.pm_rate;
                                  if (!isNaN(pmRate)) {
                                    pmCost = rentalIncome * (pmRate / 100);
                                  }
                                }
                                if(!prop.isRental) {
                                  pmCost = 0;
                                }
                                const expenses = mortgagePayment + insuranceAmount + hoaAmount + pmiAmount + forecastingMonthly + pmCost;
                                const profit = rentalIncome - expenses;
                                const allSegments = [
                                  ...(profit > 0 ? [{ value: profit, color: '#89AE99', label: 'Profit' }] : []),
                                  { value: pmCost, color: '#B38796', label: 'Property Management' },
                                  ...(prop.noMortgage ? [] : [{ value: mortgagePayment, color: '#E35E61', label: 'Mortgage' }]),
                                  { value: insuranceAmount, color: '#EEB05E', label: 'Taxes/Insurance' },
                                  { value: hoaAmount, color: '#db83ad', label: 'HOA' },
                                  { value: pmiAmount, color: '#C45584', label: 'PMI' },
                                  { value: forecastingMonthly, color: '#D2794F', label: 'Forecasting/Planning' }
                                ];
                                const segments = allSegments.filter(seg => seg.value > 0);
                                if (segments.length === 0) {
                                  // Show a gray background circle if no segments
                                  return (
                                    <circle
                                      cx="55"
                                      cy="55"
                                      r="44"
                                      fill="none"
                                      stroke="#e8e8e8"
                                      strokeWidth="6.5"
                                      style={{
                                        opacity: hoveredSegment?.source === 'rental-inner' && hoveredSegment?.propertyId === prop.id ? 0.3 : 1,
                                        transition: 'opacity 0.2s ease-in-out'
                                      }}
                                      onMouseEnter={e => {
                                        setHoveredSegment({
                                          label: 'No Expenses',
                                          amount: 0,
                                          percent: 0,
                                          period: cardButtonState[prop.id] || 'Monthly',
                                          x: e.clientX,
                                          y: e.clientY,
                                          source: 'rental',
                                          propertyId: prop.id,
                                        });
                                      }}
                                      onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                      onMouseLeave={() => setHoveredSegment(null)}
                                    />
                                  );
                                }
                                // ...existing code for drawing segments...
                                const totalValue = segments.reduce((sum, seg) => sum + seg.value, 0);
                                const sorted = [...segments].sort((a, b) => b.value - a.value);
                                const drawSegments: typeof sorted = [];
                                for (let i = 0; i < sorted.length; i += 2) {
                                  drawSegments.push(sorted[i]);
                                }
                                for (let i = sorted.length % 2 === 0 ? sorted.length - 1 : sorted.length - 2; i > 0; i -= 2) {
                                  drawSegments.push(sorted[i]);
                                }
                                const gap = 8;
                                const radius = 44;
                                const circumference = 2 * Math.PI * radius;
                                let totalGaps = drawSegments.length > 1 ? gap * drawSegments.length : 0;
                                let availableSpace = circumference - totalGaps;
                                const biggestSegment = drawSegments[0];
                                const biggestPercent = totalValue > 0 ? (biggestSegment.value / totalValue) * 100 : 0;
                                const biggestDashLength = (biggestPercent / 100) * availableSpace;
                                const angleForBiggest = (biggestDashLength / circumference) * 360;
                                const rotationAngle = 180 - (angleForBiggest / 2);
                                let offset = 0;
                                const circles: React.ReactElement[] = [];
                                drawSegments.forEach((segment) => {
                                  const percent = totalValue > 0 ? (segment.value / totalValue) * 100 : 0;
                                  const dashLength = (percent / 100) * availableSpace;
                                  // (no precomputed tooltip coords here) will use mouse client coords
                                  circles.push(
                                    <circle
                                      key={segment.label}
                                      cx="55"
                                      cy="55"
                                      r="44"
                                      fill="none"
                                      stroke={segment.color}
                                      strokeWidth={
                                        hoveredSegment?.source === 'rental' && hoveredSegment?.propertyId === prop.id
                                          ? hoveredSegment?.label === segment.label ? "7.5" : "5.5"  // Hovered: thicker, Others: thinner
                                          : "6.5"  // Default thickness
                                      }
                                      strokeDasharray={`${dashLength} ${circumference}`}
                                      strokeDashoffset={offset}
                                      strokeLinecap="round"
                                      transform={`rotate(${rotationAngle+90} 55 55)`}
                                      style={{
                                        opacity: hoveredSegment?.source === 'rental-inner' && hoveredSegment?.propertyId === prop.id ? 0.3 : 
                                                hoveredSegment?.source === 'rental' && hoveredSegment?.propertyId === prop.id && hoveredSegment?.label !== segment.label ? 0.3 : 1,
                                        transition: 'opacity 0.2s ease-in-out, stroke-width 0.2s ease-in-out'
                                      }}
                                      onMouseEnter={(e: any) => {
                                        const period = cardButtonState[prop.id] || 'Monthly';
                                        const amt = period === 'Yearly' ? segment.value * 12 : segment.value;
                                        setHoveredSegment({ label: segment.label, percent, amount: amt, period, x: e.clientX, y: e.clientY, source: 'rental', propertyId: prop.id });
                                      }}
                                      onMouseMove={(e: any) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                      onMouseLeave={() => setHoveredSegment(null)}
                                    />
                                  );
                                  offset -= (dashLength + gap);
                                });
                                return <>{circles}</>;
                              })()}
                              
                              {/* INNER CIRCLE - Rental Income vs Expenses/Profit */}
                              {(() => {
                                const currentButtonState = cardButtonState[prop.id] || 'Monthly';
                                const r = 35;
                                const circ = 2 * Math.PI * r;
                                const animState = circleAnimState[prop.id] || 'origin';
                                
                                // Calculate 12 segments data (for Actual state)
                                const segmentCount = 12;
                                const gapAngle = 13; // degrees
                                const totalGapDegrees = segmentCount * gapAngle;
                                const availableDegrees = 360 - totalGapDegrees;
                                const segmentDegrees = availableDegrees / segmentCount;
                                const segmentLength = (segmentDegrees / 360) * circ;
                                const currentMonthIdx = new Date().getMonth();
                                const currentYear = new Date().getFullYear();
                                const createdDate = prop.createdAt ? new Date(prop.createdAt) : null;
                                const createdYear = createdDate ? createdDate.getFullYear() : currentYear;
                                const createdMonthIdx = createdDate ? createdDate.getMonth() : 0;
                                // If created in a previous year, start from January (0); otherwise use creation month
                                const startMonthIdx = createdYear < currentYear ? 0 : createdMonthIdx;
                                
                                // Calculate outer circle total for tooltips
                                const mortgagePayment = prop.noMortgage ? 0 : parseValue(prop.mortgagePaymentAmount);
                                let insuranceAmount = parseValue(prop.insurance?.amount);
                                if (prop.insurance?.frequency === 'Yearly') insuranceAmount = insuranceAmount / 12;
                                const propertyTaxAmount = getLatestPropertyTax(prop.propertyTaxHistory || []);
                                if (prop.isPT && !prop.noMortgage) insuranceAmount = 0; else insuranceAmount += propertyTaxAmount / 12;
                                let hoaAmount = prop.hoa ? (prop.yearly === 'Yearly' ? parseValue(prop.hoa) / 12 : parseValue(prop.hoa)) : 0;
                                let pmiAmount = prop.noMortgage ? 0 : parseValue(prop.pmi);
                                let forecastingMonthly = 0;
                                if (prop.forecasting && typeof prop.forecasting === 'object') {
                                  forecastingMonthly = calculateForecastingMonthly(prop.forecasting);
                                }
                                let pmCost = 0;
                                const rentalIncomeVal = prop.rentalRate ? parseValue(prop.rentalRate) : 0;
                                if (prop.pm_rate && rentalIncomeVal) { const pmRate = typeof prop.pm_rate === 'string' ? parseFloat(prop.pm_rate) : prop.pm_rate; if (!isNaN(pmRate)) pmCost = rentalIncomeVal * (pmRate / 100); }
                                // Monthly profit for 12-segment tooltips (rental income - expenses)
                                const monthlyExpenses = mortgagePayment + insuranceAmount + hoaAmount + pmiAmount + forecastingMonthly + pmCost;
                                const monthlyTotal = rentalIncomeVal - monthlyExpenses;
                                
                                // Actual state (no animation): show only 12 segments
                                if (currentButtonState === 'Actual' && animState === 'origin') {
                                  return (
                                    <TwelveSegmentCircle
                                      activeColor="#89AE99"
                                      startMonthIdx={startMonthIdx}
                                      onMouseEnter={(e, idx, name) => {
                                        const isInRange = idx >= startMonthIdx && idx <= currentMonthIdx;
                                        setHoveredSegment({ label: name, amount: isInRange ? monthlyTotal : -1, percent: -1, period: 'Actual', x: e.clientX, y: e.clientY, source: 'rental-inner', propertyId: prop.id });
                                      }}
                                      onMouseMove={(e) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                      onMouseLeave={() => setHoveredSegment(null)}
                                    />
                                  );
                                }
                                
                                // Monthly/Yearly state: Paid vs Owed segments
                                const purchasePrice = prop.price ? parseFloat(prop.price as any) : 0;
                                const remainingBalance = prop.noMortgage ? 0 : (prop.balance ? parseFloat(prop.balance as any) : 0);
                                const equity = purchasePrice - remainingBalance;
                                let filledPercentage = 0;
                                if (prop.noMortgage) {
                                  filledPercentage = 100;
                                } else if (purchasePrice > 0) {
                                  filledPercentage = Math.min(100, Math.max(0, (equity / purchasePrice) * 100));
                                }
                                const dashLength = (filledPercentage / 100) * circ;
                                const dashGap = circ - dashLength;
                                
                                // Animation state
                                let targetPercent = 5;
                                if (filledPercentage < 5) targetPercent = Math.max(0, filledPercentage / 2);
                                const targetLength = (targetPercent / 100) * circ;
                                const targetGap = circ - targetLength;
                                let animation = '';
                                if (animState === 'to5') animation = 'fillTo5 0.7s ease-in-out forwards';
                                else if (animState === 'back') animation = 'fillBack 0.7s ease-in-out forwards';
                                else if (animState === 'toFull') animation = 'fillToFull 0.5s ease-in-out forwards';
                                else if (animState === 'shrink') animation = 'shrinkToZero 0.7s ease-in-out forwards';
                                else if (animState === 'expandFromZero') animation = 'expandFromZero 0.5s ease-in-out forwards';
                                else if (animState === 'shrinkToOrigin') animation = 'shrinkToOrigin 0.7s ease-in-out forwards';
                                
                                // Show segments during shrink (revealing) or expandFromZero (covering)
                                const showSegments = animState === 'shrink' || animState === 'expandFromZero';
                                
                                return (
                                  <>
                                    {/* Show 12 segments during shrink/expand animation - render FIRST so they're underneath */}
                                    {showSegments && Array.from({ length: segmentCount }).map((_, i) => {
                                      const startAngle = i * (segmentDegrees + gapAngle) - 90;
                                      const offset = -(startAngle / 360) * circ;
                                      const isInRange = i >= startMonthIdx && i <= currentMonthIdx;
                                      return (
                                        <circle
                                          key={`shrink-segment-multi-${i}`}
                                          cx="55" cy="55" r={r}
                                          fill="none"
                                          stroke={isInRange ? "#89AE99" : "#e0e0e0"}
                                          strokeWidth="6.5"
                                          strokeLinecap="round"
                                          strokeDasharray={`${segmentLength} ${circ - segmentLength}`}
                                          strokeDashoffset={offset}
                                          style={{ pointerEvents: 'none' }}
                                        />
                                      );
                                    })}
                                    {/* Background grey circle (Owed) - hide during shrink/expand so segments show through */}
                                    {!showSegments && (
                                      <circle
                                        cx="55"
                                        cy="55"
                                        r={r}
                                        fill="none"
                                        stroke="#e8e8e8"
                                        strokeWidth="6.5"
                                        style={{
                                          opacity: hoveredSegment?.source === 'rental' && hoveredSegment?.propertyId === prop.id ? 0.3 : 1,
                                          transition: 'opacity 0.2s ease-in-out'
                                        }}
                                        onMouseEnter={e => {
                                          setHoveredSegment({
                                            label: 'Owed',
                                            amount: Math.max(0, remainingBalance),
                                            percent: purchasePrice > 0 ? (Math.max(0, remainingBalance) / purchasePrice) * 100 : 0,
                                            period: 'Monthly',
                                            x: e.clientX,
                                            y: e.clientY,
                                            source: 'rental-inner',
                                            propertyId: prop.id,
                                          });
                                        }}
                                        onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                        onMouseLeave={() => setHoveredSegment(null)}
                                      />
                                    )}
                                    {/* Progress fill (Paid) */}
                                    {filledPercentage > 0 && (
                                      <circle
                                        key={`paid-circle-multi-${rentalAnimationKey[prop.id] || 0}`}
                                        cx="55"
                                        cy="55"
                                        r={r}
                                        fill="none"
                                        stroke="#6A7F91"
                                        strokeWidth="6.5"
                                        strokeDasharray={animState === 'to5' ? `${targetLength} ${targetGap}` : animState === 'toFull' || animState === 'shrink' ? `${circ} 0` : animState === 'expandFromZero' ? `0 ${circ}` : animState === 'shrinkToOrigin' ? `${circ} 0` : `${dashLength} ${dashGap}`}
                                        strokeDashoffset={-circ / 4}
                                        strokeLinecap="round"
                                        transform="rotate(-180 55 55)"
                                        style={{
                                          animation,
                                          '--origin-length': `${dashLength}px`,
                                          '--origin-gap': `${dashGap}px`,
                                          '--five-length': `${targetLength}px`,
                                          '--five-gap': `${targetGap}px`,
                                          '--full-length': `${circ}px`,
                                          '--full-gap': '0px',
                                          opacity: hoveredSegment?.source === 'rental' && hoveredSegment?.propertyId === prop.id ? 0.3 : 1,
                                          transition: 'opacity 0.2s ease-in-out'
                                        } as any}
                                        onMouseEnter={e => {
                                          setHoveredSegment({
                                            label: 'Paid',
                                            amount: Math.max(0, equity),
                                            period: "Monthly",
                                            percent: purchasePrice > 0 ? (Math.max(0, equity) / purchasePrice) * 100 : 0,
                                            x: e.clientX,
                                            y: e.clientY,
                                            source: 'rental-inner',
                                            propertyId: prop.id,
                                          });
                                        }}
                                        onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                        onMouseLeave={() => setHoveredSegment(null)}
                                      />
                                    )}
                                  </>
                                );
                              })()}
                              
                              {/* Curved text for equity ratio */}
                              {!prop.noMortgage && (cardButtonState[prop.id] || 'Monthly') !== 'Actual' && (
                                <text fill="#999" fontSize="6" textAnchor="middle">
                                  <textPath href="#arcPathRental" startOffset="50%">
                                    {(() => {
                                      const purchasePrice = prop.price ? parseFloat(prop.price as any) : 0;
                                      const remainingBalance = prop.balance ? parseFloat(prop.balance as any) : 0;
                                      const equity = purchasePrice - remainingBalance;
                                      // Show N/A if no data or chart is empty
                                      if (!purchasePrice || isNaN(purchasePrice) || purchasePrice === 0) return 'N/A';
                                      return `${formatKOrM(equity)}/${formatKOrM(purchasePrice)}`;
                                    })()}
                                  </textPath>
                                </text>
                              )}
                            </svg>

                            {/* Tooltip for rental inner circle (Paid/Owed) */}
                            <SegmentTooltip data={hoveredSegment} source="rental-inner" variant="amount-only" formatAmount={(amt) => amt < 0 ? `-$${Math.abs(amt).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : `$${amt.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
                            
                            {/* Tooltip for hovered outer segment (positioned using SVG coords scaled to px) */}
                            <SegmentTooltip data={hoveredSegment} source="rental" variant="full" />
                            {/* Center text */}
                            {(() => {
                              const currentState = cardButtonState[prop.id] || 'Monthly';
                              const monthlyExact = netIncome; // use the precise monthly value
                              const currentMonthIdx = new Date().getMonth();
                              const currentYear = new Date().getFullYear();
                              const createdDate = prop.createdAt ? new Date(prop.createdAt) : null;
                              const createdYear = createdDate ? createdDate.getFullYear() : currentYear;
                              const createdMonthIdx = createdDate ? createdDate.getMonth() : 0;
                              // If created in a previous year, start from January (0); otherwise use creation month
                              const effectiveStartMonth = createdYear < currentYear ? 0 : createdMonthIdx;
                              const filledMonthsCount = Math.max(1, currentMonthIdx - effectiveStartMonth + 1);
                              const displayValue = currentState === 'Yearly' ? Math.round(monthlyExact * 12) : currentState === 'Actual' ? Math.round(monthlyExact * filledMonthsCount) : Math.round(monthlyExact);
                              let showNA = false;
                              if (
                                displayValue === null ||
                                displayValue === undefined ||
                                isNaN(displayValue) ||
                                (displayValue > -1 && displayValue < 1)
                              ) {
                                showNA = true;
                              }
                              const isNegative = displayValue < 0;
                              const canEdit = showNA && !isFriend; // Friends can't edit
                              return (
                                <Box sx={{ textAlign: 'center', zIndex: 1, pointerEvents: canEdit ? 'auto' : 'none', cursor: canEdit ? 'pointer' : 'default' }}
                                  onClick={canEdit ? () => handleOpenEditModal(prop, 'owner') : undefined}
                                >
                                  <Typography sx={{ fontSize: 22, fontWeight: 700, color: showNA ? '#89AE99' : (isNegative ? '#E35E61' : '#89AE99'), fontFamily: 'Nunito, Arial, sans-serif', '&:hover': canEdit ? { textDecoration: 'underline' } : {} }}>
                                    {showNA ? 'Add info' : `${isNegative ? '-' : ''}$${Math.abs(displayValue).toLocaleString('en-US')}`}
                                  </Typography>
                                  <Typography sx={{ fontSize: 11, color: '#888', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1 }}>
                                    {currentState === 'Yearly' ? 'Yearly Profit' : currentState === 'Actual' ? 'Year to Date' : 'Monthly Profit'}
                                  </Typography>
                                </Box>
                              );
                            })()}
                          </Box>
                          
                          {/* Breakdown Details */}
                          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                Property Breakdown
                              </Typography>
                              <Button variant="outlined" size="small" sx={{ minWidth: 0, px: 1.2, py: 0.4, fontSize: 12, fontWeight: 400, borderRadius: 2, background: '#fff', border: '1px solid #B0B8C1', color: '#333', boxShadow: 'none', textTransform: 'none', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }}
                                onClick={() => {
                                  const currentState = cardButtonState[prop.id] || 'Monthly';
                                  const nextState = currentState === 'Monthly' ? 'Yearly' : currentState === 'Yearly' ? 'Actual' : 'Monthly';
                                  
                                  if (currentState === 'Yearly' && nextState === 'Actual') {
                                    // Yearly to Actual: expand to full, then shrink to zero while showing segments
                                    setCircleAnimState(prev => ({ ...prev, [prop.id]: 'toFull' }));
                                    setTimeout(() => {
                                      setCircleAnimState(prev => ({ ...prev, [prop.id]: 'shrink' }));
                                      setCardButtonState(prev => ({ ...prev, [prop.id]: nextState }));
                                      setTimeout(() => {
                                        setCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                        setRentalAnimationKey(prev => ({ ...prev, [prop.id]: (prev[prop.id] || 0) + 1 }));
                                      }, 700);
                                    }, 500);
                                  } else if (currentState === 'Actual' && nextState === 'Monthly') {
                                    // Actual to Monthly: expand from zero to full, then shrink to monthly value
                                    setCircleAnimState(prev => ({ ...prev, [prop.id]: 'expandFromZero' }));
                                    setTimeout(() => {
                                      setCardButtonState(prev => ({ ...prev, [prop.id]: nextState }));
                                      setCircleAnimState(prev => ({ ...prev, [prop.id]: 'shrinkToOrigin' }));
                                      setTimeout(() => {
                                        setCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                        setRentalAnimationKey(prev => ({ ...prev, [prop.id]: (prev[prop.id] || 0) + 1 }));
                                      }, 700);
                                    }, 500);
                                  } else {
                                    // Normal animation for Monthly <-> Yearly transitions
                                    setCardButtonState(prev => ({ ...prev, [prop.id]: nextState }));
                                    setCircleAnimState(prev => ({ ...prev, [prop.id]: 'to5' }));
                                    setTimeout(() => {
                                      setCircleAnimState(prev => ({ ...prev, [prop.id]: 'back' }));
                                      setTimeout(() => {
                                        setCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                        setRentalAnimationKey(prev => ({ ...prev, [prop.id]: (prev[prop.id] || 0) + 1 }));
                                      }, 700);
                                    }, 700);
                                  }
                                }}
                              >
                                {(() => {
                                  const current = cardButtonState[prop.id] || 'Monthly';
                                  return current === 'Monthly' ? 'Monthly' : current === 'Yearly' ? 'Yearly' : 'Actual';
                                })()}
                              </Button>
                            </Box>
                            <Typography sx={{ fontSize: 14, mt: 1.5, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.5 }}>
                              <strong>Rental Income:</strong> ${(() => {
                                const currentState = cardButtonState[prop.id] || 'Monthly';
                                const monthlyExact = rentalIncome;
                                return currentState === 'Yearly'
                                  ? Math.round(monthlyExact * 12).toLocaleString('en-US', { maximumFractionDigits: 0 })
                                  : Math.round(monthlyExact).toLocaleString('en-US', { maximumFractionDigits: 0 });
                              })()} {cardButtonState[prop.id] === 'Yearly' ? 'Yearly' : 'Monthly'}<br/>
                              <strong>Expenses:</strong> {(() => {
                                const currentState = cardButtonState[prop.id] || 'Monthly';
                                const monthlyExact = expenses;
                                const yearlyDisplay = Math.round(monthlyExact * 12);
                                return currentState === 'Yearly'
                                  ? formatCurrencyNoDecimals(yearlyDisplay)
                                  : formatCurrencyNoDecimals(Math.round(monthlyExact));
                              })()} {cardButtonState[prop.id] === 'Yearly' ? 'Yearly' : 'Monthly'}
                            </Typography>
                            <Box sx={{ my: 1.3 }} />
                            <Typography sx={{ fontSize: 14, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.5 }}>
                              <strong>Lease Length:</strong> {hasValidLease ? `${leaseLength} Months` : ''}<br/>
                              <strong>Lease End Date:</strong> {hasValidLease && leaseEndDate ? leaseEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                            </Typography>
                            
                            {/* Lease Progress Bar */}
                            <Box sx={{ mt: 2 }}>
                              {(() => {
                                if (!hasValidLease) {
                                  return (
                                    <>
                                      <Box sx={{ width: '100%', height: 15, bgcolor: '#e8e8e8', borderRadius: 10, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                                        {/* Empty bar - no progress */}
                                      </Box>
                                      <Typography sx={{ fontSize: 12, color: '#666', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.5, textAlign: 'center', fontWeight: 500 }}>
                                        0 Months Left
                                      </Typography>
                                    </>
                                  );
                                }
                                
                                const today = new Date();
                                const monthsLeft = Math.max(0, Math.round((leaseEndDate ? leaseEndDate.getFullYear() : today.getFullYear()) - today.getFullYear()) * 12 + ((leaseEndDate ? leaseEndDate.getMonth() : today.getMonth()) - today.getMonth()));
                                const filledPercentage = leaseLength && leaseLength > 0 ? (monthsLeft / leaseLength) * 100 : 0;
                                
                                return (
                                  <>
                                    <Box sx={{ width: '100%', height: 15, bgcolor: '#e8e8e8', borderRadius: 10, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                                      <Box sx={{ height: '100%', width: `${filledPercentage}%`, bgcolor: '#89AE99', borderRadius: 10 }} />
                                    </Box>
                                    <Typography sx={{ fontSize: 12, color: '#666', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.5, textAlign: 'center', fontWeight: 500 }}>
                                      {monthsLeft} Months Left
                                    </Typography>
                                  </>
                                );
                              })()}
                            </Box>
                          </Box>
                        </Box>
                        
                        {/* Tasks Section */}
                        <Box sx={{ display: 'flex', gap: 2, mt: 1, flex: 0, mb: 0 }}>
                          {/* Upcoming Tasks */}
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                              Upcoming Tasks
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {propertyUpcoming.length > 0 ? (
                                propertyUpcoming.slice(0, 2).map(task => (
                                  <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#E8A8A8', flexShrink: 0, mt: 0.3 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography sx={{ fontSize: 13, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                        {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                                      </Typography>
                                      <Typography sx={{ fontSize: 12, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                        {task.date}
                                      </Typography>
                                    </Box>
                                  </Box>
                                ))
                              ) : (
                                <Typography sx={{ fontSize: 12, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No upcoming tasks</Typography>
                              )}
                            </Box>
                          </Box>
                          
                          {/* Overdue Tasks */}
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                              Overdue Tasks
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {propertyOverdue.length > 0 ? (
                                propertyOverdue.slice(0, 2).map(task => (
                                  <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#E8A8A8', flexShrink: 0, mt: 0.3 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography sx={{ fontSize: 13, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                        {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                                      </Typography>
                                      <Typography sx={{ fontSize: 12, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                        {task.date}
                                      </Typography>
                                    </Box>
                                  </Box>
                                ))
                              ) : (
                                <Typography sx={{ fontSize: 12, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No overdue tasks</Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                        </>
                      )}
                    </Paper>
                  ) : (!isOwner && isPM) ? (
                    // PROPERTY MANAGER CARD (for shared members with PM role)
                    <Paper key={prop.id} sx={{ borderRadius: 4, width: isSingleProperty ? { xs: '100%', sm: '100%', md: singleCardWidth } : { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, minWidth: isSingleProperty ? { xs: '100%', sm: '100%', md: singleCardWidth } : { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, maxWidth: isSingleProperty ? { xs: '100%', sm: '100%', md: singleCardWidth } : { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, height: 'auto', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', flex: '0 0 auto', p: { xs: 2, md: 3 }, bgcolor: '#F7F8FA', boxShadow: '0 10px 24px rgba(15,23,42,0.08)', ...cardSnapSx, ...mobileCardContentSx }}>
                      
                      {/* Main content wrapper - 2x2 grid for single property, vertical for multiple */}
                      {isSingleProperty ? (
                        // SINGLE PROPERTY: 2x2 grid layout for PM
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: 580 }}>
                          {/* Top Row: Image (50%) + Property Breakdown (50%) - Height 52% */}
                          <Box sx={{ display: 'flex', gap: 2, flex: '0 0 52%', overflow: 'hidden' }}>
                            {/* Top-Left: Image */}
                            <Box sx={{ width: '50%', maxHeight: '100%', position: 'relative', overflow: 'hidden', cursor: 'pointer', flexShrink: 0, borderRadius: 2 }}
                              onClick={() => {
                                if (typeof onPropertyClick === 'function') onPropertyClick(prop.id);
                              }}>
                              <img src={prop.photoUrl || "/empty-property.png"} alt={prop.propertyName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </Box>
                            
                            {/* Property Breakdown Details: full width on mobile, 50% on desktop */}
                            <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex', flexDirection: 'column', gap: 0.8, p: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ bgcolor: "rgba(52,55,72,0.85)", color: '#fff', px: 2, py: 0.75, borderRadius: 1.5, fontWeight: 600, fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif' }}>
                                  {(() => {
                                    if (currentUser && prop.id && Array.isArray(prop.sharedWith)) {
                                      const sharedEntry = prop.sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === currentUser.uid);
                                      if (sharedEntry && typeof sharedEntry === 'object' && sharedEntry.alias) {
                                        return sharedEntry.alias;
                                      }
                                    }
                                    return prop.tag || 'Rental';
                                  })()}
                                </Box>
                                <Button variant="outlined" size="small" sx={{ minWidth: 0, px: 1.2, py: 0.4, fontSize: 12, fontWeight: 400, borderRadius: 2, background: '#fff', border: '1px solid #B0B8C1', color: '#333', boxShadow: 'none', textTransform: 'none', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }}
                                  onClick={() => {
                                    const currentState = pmButtonState[prop.id] || 'Lease';
                                    let nextState: 'Lease' | 'Monthly' | 'Actual' | 'Yearly';
                                    if (currentState === 'Lease') nextState = 'Actual';
                                    else if (currentState === 'Actual') nextState = 'Monthly';
                                    else if (currentState === 'Monthly') nextState = 'Yearly';
                                    else nextState = 'Lease';
                                    setPmButtonState(prev => ({ ...prev, [prop.id]: nextState }));
                                    
                                    // Lease to Actual: expand to full, then shrink to zero revealing segments
                                    if (currentState === 'Lease' && nextState === 'Actual') {
                                      setPmCircleAnimState(prev => ({ ...prev, [prop.id]: 'toFull' }));
                                      setTimeout(() => {
                                        setPmCircleAnimState(prev => ({ ...prev, [prop.id]: 'shrink' }));
                                        setTimeout(() => {
                                          setPmCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                        }, 700);
                                      }, 500);
                                    } else if (currentState === 'Actual' && nextState === 'Monthly') {
                                      // Actual to Monthly: expand from zero to full, then shrink to monthly value
                                      setPmCircleAnimState(prev => ({ ...prev, [prop.id]: 'expandFromZero' }));
                                      setTimeout(() => {
                                        setPmCircleAnimState(prev => ({ ...prev, [prop.id]: 'shrinkToOrigin' }));
                                        setTimeout(() => {
                                          setPmCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                        }, 700);
                                      }, 500);
                                    }
                                  }}
                                >
                                  {pmButtonState[prop.id] || 'Lease'}
                                </Button>
                              </Box>
                              <Typography sx={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mt: 1 }}>
                                Property Breakdown
                              </Typography>
                              <Typography sx={{ fontSize: 14, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.7 }}>
                                <strong>Rental Income:</strong> ${(() => {
                                  const currentButtonState = pmButtonState[prop.id] || 'Lease';
                                  if (currentButtonState === 'Monthly') {
                                    return rentalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                  } else if (currentButtonState === 'Actual') {
                                    const currentMonth = new Date().getMonth() + 1;
                                    return (rentalIncome * currentMonth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                  } else if (currentButtonState === 'Yearly') {
                                    const currentMonth = new Date().getMonth() + 1;
                                    const monthsLeftInYear = 12 - currentMonth + 1;
                                    return (rentalIncome * monthsLeftInYear).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                  } else {
                                    return (rentalIncome * (leaseLength || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                  }
                                })()} {(() => {
                                  const currentButtonState = pmButtonState[prop.id] || 'Lease';
                                  if (currentButtonState === 'Monthly') return 'Monthly';
                                  if (currentButtonState === 'Actual') return 'Actual';
                                  if (currentButtonState === 'Yearly') return 'Yearly';
                                  return 'Total';
                                })()}
                              </Typography>
                              <Box sx={{ my: 1 }} />
                              <Typography sx={{ fontSize: 14, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.7 }}>
                                <strong>Lease Length:</strong> {hasValidLease ? `${leaseLength} Months` : ''}<br/>
                                <strong>Lease End Date:</strong> {hasValidLease && leaseEndDate ? leaseEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}<br/>
                                <strong>Total Lease Revenue:</strong> {hasValidLease && leaseLength ? `$${(rentalIncome * leaseLength).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                              </Typography>
                              
                              {/* Lease Progress Bar */}
                              <Box sx={{ mt: 2 }}>
                                {(() => {
                                  if (!hasValidLease) {
                                    return (
                                      <>
                                        <Box sx={{ width: '100%', height: 18, bgcolor: '#e8e8e8', borderRadius: 10, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }} />
                                        <Typography sx={{ fontSize: 12, color: '#666', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.5, textAlign: 'center', fontWeight: 500 }}>
                                          0 Months Left
                                        </Typography>
                                      </>
                                    );
                                  }
                                  const today = new Date();
                                  const monthsLeft = Math.max(0, Math.ceil((leaseEndDate ? leaseEndDate.getTime() - today.getTime() : 0) / (1000 * 60 * 60 * 24 * 30)));
                                  const filledPercentage = leaseLength && leaseLength > 0 ? (monthsLeft / leaseLength) * 100 : 0;
                                  return (
                                    <>
                                      <Box sx={{ width: '100%', height: 18, bgcolor: '#e8e8e8', borderRadius: 10, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                                        <Box sx={{ height: '100%', width: `${filledPercentage}%`, bgcolor: '#89AE99', borderRadius: 10 }} />
                                      </Box>
                                      <Typography sx={{ fontSize: 12, color: '#666', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.5, textAlign: 'center', fontWeight: 500 }}>
                                        {monthsLeft} Months Left
                                      </Typography>
                                    </>
                                  );
                                })()}
                              </Box>
                            </Box>
                          </Box>
                          
                          {/* Bottom Row: Chart + Tasks — column on xs/sm, row on md */}
                          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 1, md: 2 }, flex: { xs: '0 0 auto', md: '0 0 48%' }, alignItems: { xs: 'stretch', md: 'center' } }}>
                            {/* Chart: full width on mobile, 50% on desktop */}
                            <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex', alignItems: 'center', justifyContent: 'center', mt: { xs: 0, md: -1.5 } }}>
                              <Box sx={{ position: 'relative', width: { xs: 160, md: 260 }, height: { xs: 160, md: 260 } }}>
                                <svg width="260" height="260" viewBox="0 0 110 110" style={{ position: 'absolute' }}>
                                  {(() => {
                                    const currentButtonState = pmButtonState[prop.id] || 'Lease';
                                    const animState = pmCircleAnimState[prop.id] || 'origin';
                                    const circumference = 2 * Math.PI * 49;
                                    const pmRateValue = prop.pm_rate ? parseFloat(String(prop.pm_rate).replace(/[%$,]/g, '')) / 100 : 0;
                                    const monthlyFee = Math.round(rentalIncome * pmRateValue);
                                    
                                    // Animation segment data for Actual state
                                    const segmentCount = 12;
                                    const gapAngle = 13;
                                    const totalGapAngle = gapAngle * segmentCount;
                                    const totalSegmentAngle = 360 - totalGapAngle;
                                    const segmentDegrees = totalSegmentAngle / segmentCount;
                                    const r = 49;
                                    const circ = 2 * Math.PI * r;
                                    const segmentLength = (segmentDegrees / 360) * circ;
                                    const currentMonthIdx = new Date().getMonth();
                                    const currentYear = new Date().getFullYear();
                                    const createdDate = prop.createdAt ? new Date(prop.createdAt) : null;
                                    const createdYear = createdDate ? createdDate.getFullYear() : currentYear;
                                    const createdMonthIdx = createdDate ? createdDate.getMonth() : 0;
                                    // If created in a previous year, start from January (0); otherwise use creation month
                                    const startMonthIdx = createdYear < currentYear ? 0 : createdMonthIdx;
                                    
                                    // Show segments during shrink (revealing) or expandFromZero (covering)
                                    const showSegments = animState === 'shrink' || animState === 'expandFromZero';
                                    
                                    // Actual state (no animation): show only 12 segments
                                    if (currentButtonState === 'Actual' && animState === 'origin') {
                                      return (
                                        <g>
                                          <TwelveSegmentCircle
                                            radius={49}
                                            strokeWidth={8.5}
                                            activeColor="#B5869E"
                                            startMonthIdx={startMonthIdx}
                                            onMouseEnter={(e, idx, name) => {
                                              const isInRange = idx >= startMonthIdx && idx <= currentMonthIdx;
                                              setHoveredSegment({ label: name, amount: isInRange ? monthlyFee : -1, percent: -1, period: 'Actual', x: e.clientX, y: e.clientY, source: 'pm', propertyId: prop.id });
                                            }}
                                            onMouseMove={(e) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                            onMouseLeave={() => setHoveredSegment(null)}
                                          />
                                        </g>
                                      );
                                    }
                                    
                                    let filledPercentage = 0;
                                    if (currentButtonState === 'Monthly') {
                                      filledPercentage = 100;
                                    } else if (currentButtonState === 'Yearly') {
                                      const currentMonth = new Date().getMonth() + 1;
                                      filledPercentage = (currentMonth / 12) * 100;
                                    } else {
                                      if (hasValidLease && leaseLength !== null && leaseLength > 0) {
                                        const leaseStartDate = prop.leaseStart ? new Date(prop.leaseStart) : new Date();
                                        const today = new Date();
                                        const monthsPassed = Math.floor((today.getFullYear() - leaseStartDate.getFullYear()) * 12 + (today.getMonth() - leaseStartDate.getMonth()));
                                        filledPercentage = Math.min(100, Math.max(0, (monthsPassed / leaseLength) * 100));
                                      } else {
                                        filledPercentage = 0;
                                      }
                                    }
                                    if (isNaN(filledPercentage) || filledPercentage < 0) return null;
                                    const dashLength = (Math.max(0, filledPercentage) / 100) * circumference;
                                    const dashGap = circumference - dashLength;
                                    let paid = 0, remaining = 0;
                                    if (currentButtonState === 'Monthly') {
                                      paid = monthlyFee;
                                      remaining = 0;
                                    } else if (currentButtonState === 'Yearly') {
                                      const currentMonth = new Date().getMonth() + 1;
                                      paid = Math.round(monthlyFee * currentMonth);
                                      remaining = Math.round(monthlyFee * (12 - currentMonth));
                                    } else {
                                      if (hasValidLease && leaseLength !== null && leaseLength > 0) {
                                        paid = Math.round(monthlyFee * Math.floor(filledPercentage * leaseLength / 100));
                                        remaining = Math.round(monthlyFee * (leaseLength - Math.floor(filledPercentage * leaseLength / 100)));
                                      } else {
                                        paid = 0;
                                        remaining = 0;
                                      }
                                    }
                                    
                                    // Animation logic
                                    let animation = '';
                                    if (animState === 'toFull') animation = 'fillToFull 0.5s ease-in-out forwards';
                                    else if (animState === 'shrink') animation = 'shrinkToZero 0.7s ease-in-out forwards';
                                    else if (animState === 'expandFromZero') animation = 'expandFromZero 0.5s ease-in-out forwards';
                                    else if (animState === 'shrinkToOrigin') animation = 'shrinkToOrigin 0.7s ease-in-out forwards';
                                    
                                    // Calculate strokeDasharray based on animation state
                                    let strokeDasharray = `${dashLength} ${circumference}`;
                                    if (animState === 'toFull' || animState === 'shrink' || animState === 'expandFromZero' || animState === 'shrinkToOrigin') {
                                      strokeDasharray = `${circumference} 0`;
                                    }
                                    
                                    return (
                                      <>
                                        {/* Show 12 segments during shrink/expand animation */}
                                        {showSegments && Array.from({ length: segmentCount }).map((_, i) => {
                                          const startAngle = i * (segmentDegrees + gapAngle) - 90;
                                          const offset = -(startAngle / 360) * circ;
                                          const isInRange = i >= startMonthIdx && i <= currentMonthIdx;
                                          return (
                                            <circle
                                              key={`pm-single-shrink-segment-${i}`}
                                              cx="55" cy="55" r={r}
                                              fill="none"
                                              stroke={isInRange ? "#B5869E" : "#e0e0e0"}
                                              strokeWidth="8.5"
                                              strokeLinecap="round"
                                              strokeDasharray={`${segmentLength} ${circ - segmentLength}`}
                                              strokeDashoffset={offset}
                                              style={{ pointerEvents: 'none' }}
                                            />
                                          );
                                        })}
                                        <g>
                                          {/* Grey background circle - hide during shrink to reveal segments */}
                                          {!showSegments && (
                                            <circle cx="55" cy="55" r="49" fill="none" stroke="#f0f0f0" strokeWidth="8.5" strokeLinecap="round" transform="rotate(-90 55 55)" style={{ pointerEvents: 'none' }} />
                                          )}
                                          {/* Animated filled circle */}
                                          {animState === 'origin' ? (
                                            <>
                                              {dashLength > 0 && (
                                                <circle cx="55" cy="55" r="49" fill="none" stroke="#B5869E" strokeWidth="8.5" strokeDasharray={`${dashLength} ${circumference}`} strokeDashoffset={0} strokeLinecap="round" transform="rotate(-90 55 55)" style={{ transition: 'stroke-dasharray 0.6s ease-in-out', pointerEvents: 'none' }} />
                                              )}
                                              {filledPercentage < 100 && (
                                                <circle key={`remaining-single-${currentButtonState}-${Math.round(filledPercentage)}`} cx="55" cy="55" r="49" fill="none" stroke="transparent" strokeWidth="8.5" strokeDasharray={filledPercentage <= 0 ? undefined : `${dashGap} ${circumference}`} strokeDashoffset={filledPercentage <= 0 ? 0 : -dashLength} strokeLinecap="round" transform="rotate(-90 55 55)" style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                                                  onMouseEnter={e => setHoveredSegment({ label: 'Remaining', percent: 100 - filledPercentage, amount: remaining, period: currentButtonState, x: e.clientX, y: e.clientY, source: 'pm' })}
                                                  onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                                  onMouseLeave={() => setHoveredSegment(null)}
                                                />
                                              )}
                                              {dashLength > 0 && (
                                                <circle key={`paid-single-${currentButtonState}-${Math.round(filledPercentage)}`} cx="55" cy="55" r="49" fill="none" stroke="transparent" strokeWidth="8.5" strokeDasharray={filledPercentage >= 100 ? undefined : `${dashLength} ${circumference}`} strokeDashoffset={0} strokeLinecap="round" transform="rotate(-90 55 55)" style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                                                  onMouseEnter={e => setHoveredSegment({ label: 'Paid', percent: filledPercentage, amount: paid, period: currentButtonState, x: e.clientX, y: e.clientY, source: 'pm' })}
                                                  onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                                  onMouseLeave={() => setHoveredSegment(null)}
                                                />
                                              )}
                                            </>
                                          ) : (
                                            <circle
                                              cx="55" cy="55" r="49"
                                              fill="none"
                                              stroke="#B5869E"
                                              strokeWidth="8.5"
                                              strokeDasharray={strokeDasharray}
                                              strokeLinecap="round"
                                              transform="rotate(-90 55 55)"
                                              style={{
                                                animation,
                                                '--full-length': `${circumference}`,
                                                '--origin-length': `${dashLength}`,
                                                '--origin-gap': `${circumference - dashLength}`,
                                                pointerEvents: 'none',
                                              } as React.CSSProperties}
                                            />
                                          )}
                                        </g>
                                      </>
                                    );
                                  })()}
                                </svg>
                                
                                {/* Center text */}
                                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 1, width: '100%', px: 1 }}
                                >
                                  {(() => {
                                    const currentButtonState = pmButtonState[prop.id] || 'Lease';
                                    const pmRateValue = prop.pm_rate ? parseFloat(String(prop.pm_rate).replace(/[%$,]/g, '')) / 100 : 0;
                                    const monthlyFee = Math.round(rentalIncome * pmRateValue);
                                    let value = 0;
                                    if (currentButtonState === 'Monthly') {
                                      value = monthlyFee;
                                    } else if (currentButtonState === 'Actual') {
                                      const currentMonthIdx = new Date().getMonth();
                                      const currentYear = new Date().getFullYear();
                                      const createdDate = prop.createdAt ? new Date(prop.createdAt) : null;
                                      const createdYear = createdDate ? createdDate.getFullYear() : currentYear;
                                      const createdMonthIdx = createdDate ? createdDate.getMonth() : 0;
                                      const effectiveStartMonth = createdYear < currentYear ? 0 : createdMonthIdx;
                                      const filledMonthsCount = Math.max(1, currentMonthIdx - effectiveStartMonth + 1);
                                      value = monthlyFee * filledMonthsCount;
                                    } else if (currentButtonState === 'Yearly') {
                                      value = monthlyFee * 12;
                                    } else {
                                      value = monthlyFee * (leaseLength || 0);
                                    }
                                    const showNA = value === null || value === undefined || isNaN(value) || (value > -1 && value < 1);
                                    return (
                                      <Box sx={{ pointerEvents: showNA ? 'auto' : 'none', cursor: showNA ? 'pointer' : 'default' }}
                                        onClick={showNA ? () => handleOpenEditModal(prop, 'pm') : undefined}
                                      >
                                        <Typography sx={{ fontSize: 27, fontWeight: 700, color: showNA ? '#89AE99' : '#B38796', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.2, '&:hover': showNA ? { textDecoration: 'underline' } : {} }}>
                                          {showNA ? 'Add info' : `$${value.toLocaleString('en-US')}`}
                                        </Typography>
                                      </Box>
                                    );
                                  })()}
                                  <Typography sx={{ fontSize: 11, color: '#888', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.2, mt: 0.5 }}>
                                    Management Fee
                                  </Typography>
                                </Box>
                                
                                {/* Tooltip */}
                                <SegmentTooltip data={hoveredSegment} source="pm" variant="amount-only" formatAmount={(amt) => `$${Math.round(amt).toLocaleString()}`} />
                              </Box>
                            </Box>
                            
                            {/* Bottom-Right: Tasks */}
                            <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 }, p: { xs: 1, md: 2 } }}>
                              <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 } }}>
                                {/* Upcoming Tasks */}
                                <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                                  <Typography sx={{ fontSize: { xs: 11, md: 13 }, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                                    Upcoming Tasks
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {propertyUpcoming.length > 0 ? (
                                      propertyUpcoming.map(task => (
                                        <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#E8A8A8', flexShrink: 0, mt: 0.3 }} />
                                          <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{ fontSize: 12, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                              {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                              {task.date}
                                            </Typography>
                                          </Box>
                                        </Box>
                                      ))
                                    ) : (
                                      <Typography sx={{ fontSize: 11, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No upcoming tasks</Typography>
                                    )}
                                  </Box>
                                </Box>
                                
                                {/* Overdue Tasks */}
                                <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                                  <Typography sx={{ fontSize: { xs: 11, md: 13 }, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                                    Overdue Tasks
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {propertyOverdue.length > 0 ? (
                                      propertyOverdue.map(task => (
                                        <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#E8A8A8', flexShrink: 0, mt: 0.3 }} />
                                          <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{ fontSize: 12, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                              {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                              {task.date}
                                            </Typography>
                                          </Box>
                                        </Box>
                                      ))
                                    ) : (
                                      <Typography sx={{ fontSize: 11, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No overdue tasks</Typography>
                                    )}
                                  </Box>
                                </Box>
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      ) : (
                        // MULTIPLE PROPERTIES: Original vertical layout for PM
                        <>
                      {/* Property Image Section */}
                      <Box sx={{ position: 'relative', height: { xs: 200, sm: 240, md: 290 }, overflow: 'hidden', cursor: 'pointer', flexShrink: 0, borderRadius: 2 }}
                        onClick={() => {
                          if (typeof onPropertyClick === 'function') onPropertyClick(prop.id);
                        }}>
                        {/* Property type label */}
                        <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 2, bgcolor: "rgba(52,55,72,0.7)", color: '#fff', px: 2, py: 0.75, borderRadius: 1.5, fontWeight: 600, fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif' }}>
                          {(() => {
                            // Check if user is in sharedWith and has a custom alias
                            if (currentUser && prop.id && Array.isArray(prop.sharedWith)) {
                              const sharedEntry = prop.sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === currentUser.uid);
                              if (sharedEntry && typeof sharedEntry === 'object' && sharedEntry.alias) {
                                return sharedEntry.alias;
                              }
                            }
                            // Default: show original tag for owners, tag or fallback for others
                            return prop.tag || 'Rental';
                          })()}
                        </Box>
                        <img src={prop.photoUrl || "/empty-property.png"} alt={prop.propertyName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </Box>
                          
                      {/* PM Property Breakdown Section */}
                      <Box sx={{ p: 1.5, pb: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8, overflowY: 'auto' }}>
                        {/* Breakdown with Gauge and Details */}
                        <Box sx={{ display: 'flex', gap: 3.2, alignItems: 'flex-start' }}>
                          {/* Circular Gauge for Management Fee - Single Circle */}
                          <Box sx={{ flexShrink: 0, width: 175, height: 175, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="175" height="175" viewBox="0 0 110 110" style={{ position: 'absolute' }}>
                              {/* Background circle (gray, for Remaining) */}
                              {(() => {
                                const currentButtonState = pmButtonState[prop.id] || 'Lease';
                                const animState = pmCircleAnimState[prop.id] || 'origin';
                                const circumference = 2 * Math.PI * 49;
                                const pmRateValue = prop.pm_rate ? parseFloat(String(prop.pm_rate).replace(/[%$,]/g, '')) / 100 : 0;
                                const monthlyFee = Math.round(rentalIncome * pmRateValue);
                                
                                // Animation segment data for Actual state
                                const segmentCount = 12;
                                const gapAngle = 13;
                                const totalGapAngle = gapAngle * segmentCount;
                                const totalSegmentAngle = 360 - totalGapAngle;
                                const segmentDegrees = totalSegmentAngle / segmentCount;
                                const r = 49;
                                const circ = 2 * Math.PI * r;
                                const segmentLength = (segmentDegrees / 360) * circ;
                                const currentMonthIdx = new Date().getMonth();
                                const currentYear = new Date().getFullYear();
                                const createdDate = prop.createdAt ? new Date(prop.createdAt) : null;
                                const createdYear = createdDate ? createdDate.getFullYear() : currentYear;
                                const createdMonthIdx = createdDate ? createdDate.getMonth() : 0;
                                // If created in a previous year, start from January (0); otherwise use creation month
                                const startMonthIdx = createdYear < currentYear ? 0 : createdMonthIdx;
                                
                                // Show segments during shrink (revealing) or expandFromZero (covering)
                                const showSegments = animState === 'shrink' || animState === 'expandFromZero';
                                
                                // Actual state (no animation): show only 12 segments
                                if (currentButtonState === 'Actual' && animState === 'origin') {
                                  return (
                                    <g>
                                      <TwelveSegmentCircle
                                        radius={49}
                                        strokeWidth={8.5}
                                        activeColor="#B5869E"
                                        startMonthIdx={startMonthIdx}
                                        onMouseEnter={(e, idx, name) => {
                                          const isInRange = idx >= startMonthIdx && idx <= currentMonthIdx;
                                          setHoveredSegment({ label: name, amount: isInRange ? monthlyFee : -1, percent: -1, period: 'Actual', x: e.clientX, y: e.clientY, source: 'pm', propertyId: prop.id });
                                        }}
                                        onMouseMove={(e) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                        onMouseLeave={() => setHoveredSegment(null)}
                                      />
                                    </g>
                                  );
                                }
                                
                                let filledPercentage = 0;
                                if (currentButtonState === 'Monthly') {
                                  filledPercentage = 100;
                                } else if (currentButtonState === 'Yearly') {
                                  const currentMonth = new Date().getMonth() + 1;
                                  filledPercentage = (currentMonth / 12) * 100;
                                } else {
                                  if (hasValidLease && leaseLength !== null && leaseLength > 0) {
                                    const leaseStartDate = prop.leaseStart ? new Date(prop.leaseStart) : new Date();
                                    const today = new Date();
                                    const monthsPassed = Math.floor((today.getFullYear() - leaseStartDate.getFullYear()) * 12 + (today.getMonth() - leaseStartDate.getMonth()));
                                    filledPercentage = Math.min(100, Math.max(0, (monthsPassed / leaseLength) * 100));
                                  } else {
                                    filledPercentage = 0;
                                  }
                                }
                                if (isNaN(filledPercentage) || filledPercentage < 0) return null;
                                const dashLength = (Math.max(0, filledPercentage) / 100) * circumference;
                                const dashGap = circumference - dashLength;
                                // Amounts
                                let paid = 0, remaining = 0;
                                if (currentButtonState === 'Monthly') {
                                  paid = monthlyFee;
                                  remaining = 0;
                                } else if (currentButtonState === 'Yearly') {
                                  const currentMonth = new Date().getMonth() + 1;
                                  paid = Math.round(monthlyFee * currentMonth);
                                  remaining = Math.round(monthlyFee * (12 - currentMonth));
                                } else {
                                  if (hasValidLease && leaseLength !== null && leaseLength > 0) {
                                    paid = Math.round(monthlyFee * Math.floor(filledPercentage * leaseLength / 100));
                                    remaining = Math.round(monthlyFee * (leaseLength - Math.floor(filledPercentage * leaseLength / 100)));
                                  } else {
                                    paid = 0;
                                    remaining = 0;
                                  }
                                }
                                
                                // Animation logic
                                let animation = '';
                                if (animState === 'toFull') animation = 'fillToFull 0.5s ease-in-out forwards';
                                else if (animState === 'shrink') animation = 'shrinkToZero 0.7s ease-in-out forwards';
                                else if (animState === 'expandFromZero') animation = 'expandFromZero 0.5s ease-in-out forwards';
                                else if (animState === 'shrinkToOrigin') animation = 'shrinkToOrigin 0.7s ease-in-out forwards';
                                
                                // Calculate strokeDasharray based on animation state
                                let strokeDasharray = `${dashLength} ${circumference}`;
                                if (animState === 'toFull' || animState === 'shrink' || animState === 'expandFromZero' || animState === 'shrinkToOrigin') {
                                  strokeDasharray = `${circumference} 0`;
                                }
                                
                                return (
                                  <>
                                    {/* Show 12 segments during shrink/expand animation */}
                                    {showSegments && Array.from({ length: segmentCount }).map((_, i) => {
                                      const startAngle = i * (segmentDegrees + gapAngle) - 90;
                                      const offset = -(startAngle / 360) * circ;
                                      const isInRange = i >= startMonthIdx && i <= currentMonthIdx;
                                      return (
                                        <circle
                                          key={`pm-multi-shrink-segment-${i}`}
                                          cx="55" cy="55" r={r}
                                          fill="none"
                                          stroke={isInRange ? "#B5869E" : "#e0e0e0"}
                                          strokeWidth="8.5"
                                          strokeLinecap="round"
                                          strokeDasharray={`${segmentLength} ${circ - segmentLength}`}
                                          strokeDashoffset={offset}
                                          style={{ pointerEvents: 'none' }}
                                        />
                                      );
                                    })}
                                    <g>
                                      {/* Grey background circle - hide during shrink to reveal segments */}
                                      {!showSegments && (
                                        <circle cx="55" cy="55" r="49" fill="none" stroke="#f0f0f0" strokeWidth="8.5" strokeLinecap="round" transform="rotate(-90 55 55)" style={{ pointerEvents: 'none' }} />
                                      )}
                                      {/* Animated filled circle */}
                                      {animState === 'origin' ? (
                                        <>
                                          {dashLength > 0 && (
                                            <circle cx="55" cy="55" r="49" fill="none" stroke="#B5869E" strokeWidth="8.5" strokeDasharray={`${dashLength} ${circumference}`} strokeDashoffset={0} strokeLinecap="round" transform="rotate(-90 55 55)" style={{ transition: 'stroke-dasharray 0.6s ease-in-out', pointerEvents: 'none' }} />
                                          )}
                                          {filledPercentage < 100 && (
                                            <circle key={`remaining-multi-${currentButtonState}-${Math.round(filledPercentage)}`} cx="55" cy="55" r="49" fill="none" stroke="transparent" strokeWidth="8.5" strokeDasharray={filledPercentage <= 0 ? undefined : `${dashGap} ${circumference}`} strokeDashoffset={filledPercentage <= 0 ? 0 : -dashLength} strokeLinecap="round" transform="rotate(-90 55 55)" style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                                              onMouseEnter={e => setHoveredSegment({ label: 'Remaining', percent: 100 - filledPercentage, amount: remaining, period: currentButtonState, x: e.clientX, y: e.clientY, source: 'pm' })}
                                              onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                              onMouseLeave={() => setHoveredSegment(null)}
                                            />
                                          )}
                                          {dashLength > 0 && (
                                            <circle key={`paid-multi-${currentButtonState}-${Math.round(filledPercentage)}`} cx="55" cy="55" r="49" fill="none" stroke="transparent" strokeWidth="8.5" strokeDasharray={filledPercentage >= 100 ? undefined : `${dashLength} ${circumference}`} strokeDashoffset={0} strokeLinecap="round" transform="rotate(-90 55 55)" style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                                              onMouseEnter={e => setHoveredSegment({ label: 'Paid', percent: filledPercentage, amount: paid, period: currentButtonState, x: e.clientX, y: e.clientY, source: 'pm' })}
                                              onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                              onMouseLeave={() => setHoveredSegment(null)}
                                            />
                                          )}
                                        </>
                                      ) : (
                                        <circle
                                          cx="55" cy="55" r="49"
                                          fill="none"
                                          stroke="#B5869E"
                                          strokeWidth="8.5"
                                          strokeDasharray={strokeDasharray}
                                          strokeLinecap="round"
                                          transform="rotate(-90 55 55)"
                                          style={{
                                            animation,
                                            '--full-length': `${circumference}`,
                                            '--origin-length': `${dashLength}`,
                                            '--origin-gap': `${circumference - dashLength}`,
                                            pointerEvents: 'none',
                                          } as React.CSSProperties}
                                        />
                                      )}
                                    </g>
                                  </>
                                );
                              })()}
                            </svg>

                            <SegmentTooltip data={hoveredSegment} source="pm" variant="amount-only" formatAmount={(amt) => `$${Math.round(amt).toLocaleString()}`} />

                            {/* Center text */}
                            <Box sx={{ textAlign: 'center', zIndex: 1 }}>
                              {(() => {
                                const currentButtonState = pmButtonState[prop.id] || 'Lease';
                                const pmRateValue = prop.pm_rate ? parseFloat(String(prop.pm_rate).replace(/[%$,]/g, '')) / 100 : 0;
                                const monthlyFee = Math.round(rentalIncome * pmRateValue);
                                let value = 0;
                                if (currentButtonState === 'Monthly') {
                                  value = monthlyFee;
                                } else if (currentButtonState === 'Actual') {
                                  const currentMonthIdx = new Date().getMonth();
                                  const currentYear = new Date().getFullYear();
                                  const createdDate = prop.createdAt ? new Date(prop.createdAt) : null;
                                  const createdYear = createdDate ? createdDate.getFullYear() : currentYear;
                                  const createdMonthIdx = createdDate ? createdDate.getMonth() : 0;
                                  const effectiveStartMonth = createdYear < currentYear ? 0 : createdMonthIdx;
                                  const filledMonthsCount = Math.max(1, currentMonthIdx - effectiveStartMonth + 1);
                                  value = monthlyFee * filledMonthsCount;
                                } else if (currentButtonState === 'Yearly') {
                                  value = monthlyFee * 12;
                                } else { // Lease
                                  value = monthlyFee * (leaseLength || 0);
                                }
                                const showNA = value === null || value === undefined || isNaN(value) || (value > -1 && value < 1);
                                return (
                                  <Box sx={{ pointerEvents: showNA ? 'auto' : 'none', cursor: showNA ? 'pointer' : 'default' }}
                                    onClick={showNA ? () => handleOpenEditModal(prop, 'pm') : undefined}
                                  >
                                    <Typography sx={{ fontSize: 22, fontWeight: 700, color: showNA ? '#89AE99' : '#B38796', fontFamily: 'Nunito, Arial, sans-serif', '&:hover': showNA ? { textDecoration: 'underline' } : {} }}>
                                      {showNA ? 'Add info' : `$${value.toLocaleString('en-US')}`}
                                    </Typography>
                                  </Box>
                                );
                              })()}
                              <Typography sx={{ fontSize: 11, color: '#888', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1 }}>
                                Management Fee
                              </Typography>
                            </Box>
                          </Box>
                          
                          {/* PM Details */}
                          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8, minWidth: 0, maxWidth: '100%' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <Typography sx={{ mb: 2, fontSize: 16, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                Property Breakdown
                              </Typography>
                              <Button variant="outlined" size="small" sx={{ minWidth: 0, px: 1.2, py: 0.4, fontSize: 12, fontWeight: 400, borderRadius: 2, background: '#fff', border: '1px solid #B0B8C1', color: '#333', boxShadow: 'none', textTransform: 'none', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }}
                                onClick={() => {
                                  const currentState = pmButtonState[prop.id] || 'Lease';
                                  let nextState: 'Lease' | 'Monthly' | 'Actual' | 'Yearly';
                                  if (currentState === 'Lease') nextState = 'Actual';
                                  else if (currentState === 'Actual') nextState = 'Monthly';
                                  else if (currentState === 'Monthly') nextState = 'Yearly';
                                  else nextState = 'Lease';
                                  setPmButtonState(prev => ({ ...prev, [prop.id]: nextState }));
                                  
                                  // Lease to Actual: expand to full, then shrink to zero revealing segments
                                  if (currentState === 'Lease' && nextState === 'Actual') {
                                    setPmCircleAnimState(prev => ({ ...prev, [prop.id]: 'toFull' }));
                                    setTimeout(() => {
                                      setPmCircleAnimState(prev => ({ ...prev, [prop.id]: 'shrink' }));
                                      setTimeout(() => {
                                        setPmCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                      }, 700);
                                    }, 500);
                                  } else if (currentState === 'Actual' && nextState === 'Monthly') {
                                    // Actual to Monthly: expand from zero to full, then shrink to monthly value
                                    setPmCircleAnimState(prev => ({ ...prev, [prop.id]: 'expandFromZero' }));
                                    setTimeout(() => {
                                      setPmCircleAnimState(prev => ({ ...prev, [prop.id]: 'shrinkToOrigin' }));
                                      setTimeout(() => {
                                        setPmCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                      }, 700);
                                    }, 500);
                                  }
                                }}
                              >
                                {pmButtonState[prop.id] || 'Lease'}
                              </Button>
                            </Box>
                            <Typography sx={{ fontSize: 14, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.5 }}>
                              <strong>Rental Income:</strong> ${(() => {
                                const currentButtonState = pmButtonState[prop.id] || 'Lease';
                                
                                if (currentButtonState === 'Monthly') {
                                  return rentalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                } else if (currentButtonState === 'Actual') {
                                  const currentMonth = new Date().getMonth() + 1;
                                  return (rentalIncome * currentMonth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                } else if (currentButtonState === 'Yearly') {
                                  const currentMonth = new Date().getMonth() + 1; // 1-12
                                  const monthsLeftInYear = 12 - currentMonth + 1;
                                  return (rentalIncome * monthsLeftInYear).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                } else { // Lease
                                  return (rentalIncome * (leaseLength || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                }
                              })()} {(() => {
                                const currentButtonState = pmButtonState[prop.id] || 'Lease';
                                if (currentButtonState === 'Monthly') return 'Monthly';
                                if (currentButtonState === 'Actual') return 'Actual';
                                if (currentButtonState === 'Yearly') return 'Yearly';
                                return 'Total';
                              })()}<br/>
                            </Typography>
                            <Box sx={{ py: 1.7 }}>
                              <Typography sx={{ fontSize: 14, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.7 }}>
                                <strong>Lease Length:</strong> {hasValidLease ? `${leaseLength} Months` : ''}<br/>
                                <strong>Lease End Date:</strong> {hasValidLease && leaseEndDate ? leaseEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}<br/>
                                <strong>Total Lease Revenue:</strong> {hasValidLease && leaseLength ? `$${(rentalIncome * leaseLength).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                              </Typography>
                            </Box>
                            
                            {/* Lease Progress Bar */}
                            <Box sx={{ mt: 1 }}>
                              {(() => {
                                if (!hasValidLease) {
                                  return (
                                    <>
                                      <Box sx={{ width: '100%', height: 15, bgcolor: '#e8e8e8', borderRadius: 10, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                                        {/* Empty bar - no progress */}
                                      </Box>
                                      <Typography sx={{ fontSize: 12, color: '#666', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.5, textAlign: 'center', fontWeight: 500 }}>
                                        0 Months Left
                                      </Typography>
                                    </>
                                  );
                                }
                                
                                const today = new Date();
                                const monthsLeft = Math.max(0, Math.ceil((leaseEndDate ? leaseEndDate.getTime() - today.getTime() : 0) / (1000 * 60 * 60 * 24 * 30)));
                                const filledPercentage = leaseLength && leaseLength > 0 ? (monthsLeft / leaseLength) * 100 : 0;
                                
                                return (
                                  <>
                                    <Box sx={{ width: '100%', height: 15, bgcolor: '#e8e8e8', borderRadius: 10, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                                      <Box sx={{ height: '100%', width: `${filledPercentage}%`, bgcolor: '#89AE99', borderRadius: 10 }} />
                                    </Box>
                                    <Typography sx={{ fontSize: 12, color: '#666', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.5, textAlign: 'center', fontWeight: 500 }}>
                                      {monthsLeft} Months Left
                                    </Typography>
                                  </>
                                );
                              })()}
                            </Box>
                          </Box>
                        </Box>
                        
                        {/* Tasks Section */}
                        <Box sx={{ display: 'flex', gap: 2, mt: 1, flex: 0, mb: 0 }}>
                          {/* Upcoming Tasks */}
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                              Upcoming Tasks
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {propertyUpcoming.length > 0 ? (
                                propertyUpcoming.slice(0, 2).map(task => (
                                  <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#E8A8A8', flexShrink: 0, mt: 0.3 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography sx={{ fontSize: 13, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                        {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                                      </Typography>
                                      <Typography sx={{ fontSize: 12, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                        {task.date}
                                      </Typography>
                                    </Box>
                                  </Box>
                                ))
                              ) : (
                                <Typography sx={{ fontSize: 12, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No upcoming tasks</Typography>
                              )}
                            </Box>
                          </Box>
                          
                          {/* Overdue Tasks */}
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                              Overdue Tasks
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {propertyOverdue.length > 0 ? (
                                propertyOverdue.slice(0, 2).map(task => (
                                  <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#E8A8A8', flexShrink: 0, mt: 0.3 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography sx={{ fontSize: 13, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                        {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                                      </Typography>
                                      <Typography sx={{ fontSize: 12, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                        {task.date}
                                      </Typography>
                                    </Box>
                                  </Box>
                                ))
                              ) : (
                                <Typography sx={{ fontSize: 12, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No overdue tasks</Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                        </>
                      )}
                    </Paper>
                  ) : (!isOwner && prop.isFriend) ? (
                    // FRIEND CARD (for shared members with Friend role)
                    <Paper key={prop.id} sx={{ borderRadius: 2, width: isSingleProperty ? { xs: '100%', sm: '100%', md: singleCardWidth } : { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, minWidth: isSingleProperty ? { xs: '100%', sm: '100%', md: singleCardWidth } : { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, maxWidth: isSingleProperty ? { xs: '100%', sm: '100%', md: singleCardWidth } : { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, height: 'auto', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', flex: '0 0 auto', p: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.16)', ...cardSnapSx, ...mobileCardContentSx }}>
                      
                      {/* Main content wrapper - 2x2 grid for single property, vertical for multiple */}
                      {isSingleProperty ? (
                        // SINGLE PROPERTY: 2x2 grid layout for Friend
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: 580 }}>
                          {/* Top Row: Image (50%) + Property Details (50%) - Height 52% */}
                          <Box sx={{ display: 'flex', gap: 2, flex: '0 0 52%', overflow: 'hidden' }}>
                            {/* Top-Left: Image */}
                            <Box sx={{ width: '50%', maxHeight: '100%', position: 'relative', overflow: 'hidden', cursor: 'pointer', flexShrink: 0, borderRadius: 2 }}
                              onClick={() => {
                                if (typeof onPropertyClick === 'function') onPropertyClick(prop.id);
                              }}>
                              <img src={prop.photoUrl || "/empty-property.png"} alt={prop.propertyName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </Box>
                            
                            {/* Top-Right: Property Details */}
                            <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', gap: 0.8, p: 2 }}>
                              <Box sx={{ bgcolor: "rgba(52,55,72,0.85)", color: '#fff', px: 2, py: 0.75, borderRadius: 1.5, fontWeight: 600, fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif', alignSelf: 'flex-start' }}>
                                {(() => {
                                  if (currentUser && prop.id && Array.isArray(prop.sharedWith)) {
                                    const sharedEntry = prop.sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === currentUser.uid);
                                    if (sharedEntry && typeof sharedEntry === 'object' && sharedEntry.alias) {
                                      return sharedEntry.alias;
                                    }
                                  }
                                  return prop.tag || 'Property';
                                })()}
                              </Box>
                              <Typography sx={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mt: 1 }}>
                                Property Breakdown
                              </Typography>
                              <Typography sx={{ fontSize: 14, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.7 }}>
                                <strong>Owner:</strong> {prop?.rentalInsurance?.assetsCovered || ''}<br/>
                                <strong>Address:</strong> {prop.address1 || ''}<br/>
                                <strong>Year Built:</strong> {prop.yearBuilt || ''}<br/>
                                <strong>Bedrooms:</strong> {prop.bedrooms || ''}<br/>
                                <strong>Bathrooms:</strong> {prop.bathrooms || ''}<br/>
                                <strong>Square Feet:</strong> {prop.squareFeet?.toLocaleString() || ''}
                              </Typography>
                            </Box>
                          </Box>
                          
                          {/* Bottom Row: Health Gauges (50%) + Tasks (50%) - Height 48% */}
                          <Box sx={{ display: 'flex', gap: 2, flex: '0 0 48%', alignItems: 'center' }}>
                            {/* Bottom-Left: Health Gauges - Scaled up for single property view */}
                            <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', mt: -1.5 }}>
                              {/* Overall Property Health Gauge */}
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: hoveredSystem && hoveredSystem !== 'overall' ? 0.3 : 1, transition: 'opacity 0.2s ease-in-out', transform: 'scale(1.55)', transformOrigin: 'center bottom' }}
                                onMouseEnter={e => {
                                  setHoveredSystem('overall');
                                  setHoveredSegment({
                                    label: 'Property Health',
                                    percent: prop.overallHealth || 0,
                                    amount: 0,
                                    period: 'Monthly',
                                    x: e.clientX,
                                    y: e.clientY,
                                    source: "friend-health",
                                  });
                                }}
                                onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                onMouseLeave={() => {
                                  setHoveredSegment(null);
                                  setHoveredSystem(null);
                                }}
                              >
                                <GaugeProgress 
                                  percentage={prop.overallHealth || 0} 
                                  whichfrom={true}
                                />
                                <Typography sx={{ fontWeight: 550, color: '#343748', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 13, mb: 0.5, mt: -0.5 }}>
                                  Overall Property Health
                                </Typography>
                              </Box>
                              
                              {/* System Health Indicators - Scaled up to match gauge */}
                              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1, transform: 'scale(1.55)', transformOrigin: 'center top' }}>
                                {/* Roof indicator */}
                                <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: hoveredSystem && hoveredSystem !== 'roof' ? 0.3 : 1, transition: 'opacity 0.2s ease-in-out' }}
                                  onMouseEnter={e => {
                                    setHoveredSystem('roof');
                                    const currentYear = new Date().getFullYear();
                                    let yearsLeft = null;
                                    if (prop.forecasting?.Roof) {
                                      const { lifespan, installDate } = prop.forecasting.Roof;
                                      if (lifespan && installDate) {
                                        const installYear = new Date(installDate).getFullYear();
                                        yearsLeft = Math.max(0, Math.floor(lifespan + installYear - currentYear));
                                      }
                                    }
                                    setHoveredSegment({
                                      label: 'Roof',
                                      amount: 0,
                                      percent: prop.roofHealth || 0,
                                      period: 'Monthly',
                                      x: e.clientX,
                                      y: e.clientY,
                                      source: "friend-health",
                                      yearsLeft: yearsLeft || 0,
                                    });
                                  }}
                                  onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                  onMouseLeave={() => {
                                    setHoveredSegment(null);
                                    setHoveredSystem(null);
                                  }}
                                >
                                  <Box sx={{ width: 50, height: 50, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="50" height="50" viewBox="0 0 70 70" style={{ position: 'absolute' }}>
                                      <circle cx="35" cy="35" r="28" fill="none" stroke="#f0f0f0" strokeWidth="12" />
                                      {(prop.roofHealth || 0) > 0 && (
                                        <circle cx="35" cy="35" r="28" fill="none" stroke={
                                          (prop.roofHealth || 0) > 75 ? '#89AE99' :
                                          (prop.roofHealth || 0) >= 41 ? '#E5B26B' :
                                          '#D36666'
                                        } strokeWidth="12" strokeDasharray={`${(prop.roofHealth || 0) * 1.76} 176`} strokeLinecap="round" transform="rotate(-90 35 35)" />
                                      )}
                                    </svg>
                                  </Box>
                                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.8 }}>Roof</Typography>
                                </Box>
                                
                                {/* Water Heater indicator */}
                                <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: hoveredSystem && hoveredSystem !== 'waterheater' ? 0.3 : 1, transition: 'opacity 0.2s ease-in-out' }}
                                  onMouseEnter={e => {
                                    setHoveredSystem('waterheater');
                                    const currentYear = new Date().getFullYear();
                                    let yearsLeft = null;
                                    if (prop.forecasting?.WaterHeater) {
                                      const { lifespan, installDate } = prop.forecasting.WaterHeater;
                                      if (lifespan && installDate) {
                                        const installYear = new Date(installDate).getFullYear();
                                        yearsLeft = Math.max(0, Math.floor(lifespan + installYear - currentYear));
                                      }
                                    }
                                    setHoveredSegment({
                                      label: 'Water Heater',
                                      amount: 0,
                                      percent: prop.waterHeaterHealth || 0,
                                      period: 'Monthly',
                                      x: e.clientX,
                                      y: e.clientY,
                                      source: 'friend-health',
                                      yearsLeft: yearsLeft || 0,
                                    });
                                  }}
                                  onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                  onMouseLeave={() => {
                                    setHoveredSegment(null);
                                    setHoveredSystem(null);
                                  }}
                                >
                                  <Box sx={{ width: 50, height: 50, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="50" height="50" viewBox="0 0 70 70" style={{ position: 'absolute' }}>
                                      <circle cx="35" cy="35" r="28" fill="none" stroke="#f0f0f0" strokeWidth="12" />
                                      {(prop.waterHeaterHealth || 0) > 0 && (
                                        <circle cx="35" cy="35" r="28" fill="none" stroke={
                                          (prop.waterHeaterHealth || 0) > 75 ? '#89AE99' :
                                          (prop.waterHeaterHealth || 0) >= 41 ? '#E5B26B' :
                                          '#D36666'
                                        } strokeWidth="12" strokeDasharray={`${(prop.waterHeaterHealth || 0) * 1.76} 176`} strokeLinecap="round" transform="rotate(-90 35 35)" />
                                      )}
                                    </svg>
                                  </Box>
                                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.8 }}>Water Heater</Typography>
                                </Box>
                                
                                {/* HVAC indicator */}
                                <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: hoveredSystem && hoveredSystem !== 'hvac' ? 0.3 : 1, transition: 'opacity 0.2s ease-in-out' }}
                                  onMouseEnter={e => {
                                    setHoveredSystem('hvac');
                                    const currentYear = new Date().getFullYear();
                                    let yearsLeft = null;
                                    if (prop.forecasting?.HVAC) {
                                      const { lifespan, installDate } = prop.forecasting.HVAC;
                                      if (lifespan && installDate) {
                                        const installYear = new Date(installDate).getFullYear();
                                        yearsLeft = Math.max(0, Math.floor(lifespan + installYear - currentYear));
                                      }
                                    }
                                    setHoveredSegment({
                                      label: 'HVAC',
                                      percent: prop.hvacHealth || 0,
                                      period: 'Monthly',
                                      amount: 0,
                                      x: e.clientX,
                                      y: e.clientY,
                                      source: 'friend-health',
                                      yearsLeft: yearsLeft || 0,
                                    });
                                  }}
                                  onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                  onMouseLeave={() => {
                                    setHoveredSegment(null);
                                    setHoveredSystem(null);
                                  }}
                                >
                                  <Box sx={{ width: 50, height: 50, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="50" height="50" viewBox="0 0 70 70" style={{ position: 'absolute' }}>
                                      <circle cx="35" cy="35" r="28" fill="none" stroke="#f0f0f0" strokeWidth="12" />
                                      {(prop.hvacHealth || 0) > 0 && (
                                        <circle cx="35" cy="35" r="28" fill="none" stroke={
                                          (prop.hvacHealth || 0) > 75 ? '#89AE99' :
                                          (prop.hvacHealth || 0) >= 41 ? '#E5B26B' :
                                          '#D36666'
                                        } strokeWidth="12" strokeDasharray={`${(prop.hvacHealth || 0) * 1.76} 176`} strokeLinecap="round" transform="rotate(-90 35 35)" />
                                      )}
                                    </svg>
                                  </Box>
                                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.8 }}>HVAC</Typography>
                                </Box>
                              </Box>
                              
                              {/* Tooltip for Friend Health indicators */}
                              <SegmentTooltip data={hoveredSegment} source="friend-health" variant="health" />
                            </Box>
                            
                            {/* Bottom-Right: Tasks */}
                            <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 }, p: { xs: 1, md: 2 } }}>
                              <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 } }}>
                                {/* Upcoming Tasks */}
                                <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                                  <Typography sx={{ fontSize: { xs: 11, md: 13 }, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                                    Upcoming Tasks
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {propertyUpcoming.length > 0 ? (
                                      propertyUpcoming.map(task => (
                                        <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FFB366', flexShrink: 0, mt: 0.3 }} />
                                          <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{ fontSize: 12, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                              {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                              {task.date}
                                            </Typography>
                                          </Box>
                                        </Box>
                                      ))
                                    ) : (
                                      <Typography sx={{ fontSize: 11, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No upcoming tasks</Typography>
                                    )}
                                  </Box>
                                </Box>
                                
                                {/* Overdue Tasks */}
                                <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                                  <Typography sx={{ fontSize: { xs: 11, md: 13 }, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                                    Overdue Tasks
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {propertyOverdue.length > 0 ? (
                                      propertyOverdue.map(task => (
                                        <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FFB366', flexShrink: 0, mt: 0.3 }} />
                                          <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{ fontSize: 12, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                              {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                              {task.date}
                                            </Typography>
                                          </Box>
                                        </Box>
                                      ))
                                    ) : (
                                      <Typography sx={{ fontSize: 11, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No overdue tasks</Typography>
                                    )}
                                  </Box>
                                </Box>
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      ) : (
                        // MULTIPLE PROPERTIES: Original vertical layout for Friend
                        <>
                      {/* Property Image Section */}
                      <Box sx={{ position: 'relative', height: { xs: 200, sm: 240, md: 290 }, overflow: 'hidden', cursor: 'pointer', flexShrink: 0, borderRadius: 2 }}
                        onClick={() => {
                          if (typeof onPropertyClick === 'function') onPropertyClick(prop.id);
                        }}>
                        {/* Property type label */}
                        <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 2, bgcolor: "rgba(52,55,72,0.7)", color: '#fff', px: 2, py: 0.75, borderRadius: 1.5, fontWeight: 600, fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif' }}>
                          {(() => {
                            // Check if user is in sharedWith and has a custom alias
                            if (currentUser && prop.id && Array.isArray(prop.sharedWith)) {
                              const sharedEntry = prop.sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === currentUser.uid);
                              if (sharedEntry && typeof sharedEntry === 'object' && sharedEntry.alias) {
                                return sharedEntry.alias;
                              }
                            }
                            // Default: show original tag
                            return prop.tag || 'Property';
                          })()}
                        </Box>
                        <img src={prop.photoUrl || "/empty-property.png"} alt={prop.propertyName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </Box>
                      
                      {/* Friend Card Property Breakdown Section */}
                      <Box sx={{ p: 1.5, pb: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.2, overflowY: 'auto' }}>
                        {/* Overall Property Health Gauge and Details */}
                        <Box sx={{ display: 'flex', gap: 3.5, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          {/* LEFT SECTION: Gauge + System Health Indicators */}
                          <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', mt: -2 }}>
                            {/* Semicircle Gauge for Property Health with needle */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: hoveredSystem && hoveredSystem !== 'overall' ? 0.3 : 1, transition: 'opacity 0.2s ease-in-out' }}
                              onMouseEnter={e => {
                                setHoveredSystem('overall');
                                setHoveredSegment({
                                  label: 'Property Health',
                                  percent: prop.overallHealth || 0,
                                  amount: 0,
                                  period: 'Monthly',
                                  x: e.clientX,
                                  y: e.clientY,
                                  source: "friend-health",
                                });
                              }}
                              onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                              onMouseLeave={() => {
                                setHoveredSegment(null);
                                setHoveredSystem(null);
                              }}
                            >
                              <GaugeProgress 
                                percentage={prop.overallHealth || 0} 
                                whichfrom={true}
                              />
                              <Typography sx={{ fontWeight: 550, color: '#343748', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 13, mb: 0.5, mt: -0.5 }}>
                                Overall Property Health
                              </Typography>
                            </Box>
                            
                            {/* System Health Indicators - Progress Arcs */}
                            <Box sx={{ display: 'flex', gap: 0.1, justifyContent: 'center' }}>
                              {/* Roof indicator */}
                              <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: hoveredSystem && hoveredSystem !== 'roof' ? 0.3 : 1, transition: 'opacity 0.2s ease-in-out' }}
                                onMouseEnter={e => {
                                  setHoveredSystem('roof');
                                  const currentYear = new Date().getFullYear();
                                  let yearsLeft = null;
                                  if (prop.forecasting?.Roof) {
                                    const { lifespan, installDate } = prop.forecasting.Roof;
                                    if (lifespan && installDate) {
                                      const installYear = new Date(installDate).getFullYear();
                                      yearsLeft = Math.max(0, Math.floor(lifespan + installYear - currentYear));
                                    }
                                  }
                                  setHoveredSegment({
                                    label: 'Roof',
                                    amount: 0,
                                    percent: prop.roofHealth || 0,
                                    period: 'Monthly',
                                    x: e.clientX,
                                    y: e.clientY,
                                    source: "friend-health",
                                    yearsLeft: yearsLeft || 0,
                                  });
                                }}
                                onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                onMouseLeave={() => {
                                  setHoveredSegment(null);
                                  setHoveredSystem(null);
                                }}
                              >
                                <Box sx={{ width: 50, height: 50, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="50" height="50" viewBox="0 0 70 70" style={{ position: 'absolute' }}>
                                    {/* Background circle */}
                                    <circle cx="35" cy="35" r="28" fill="none" stroke="#f0f0f0" strokeWidth="12" />
                                    {/* Progress arc - only show if health > 0 */}
                                    {(prop.roofHealth || 0) > 0 && (
                                      <circle cx="35" cy="35" r="28" fill="none" stroke={
                                        (prop.roofHealth || 0) > 75 ? '#89AE99' :
                                        (prop.roofHealth || 0) >= 41 ? '#E5B26B' :
                                        '#D36666'
                                      } strokeWidth="12" strokeDasharray={`${(prop.roofHealth || 0) * 1.76} 176`} strokeLinecap="round" transform="rotate(-90 35 35)"
                                      />
                                    )}
                                  </svg>
                                </Box>
                                <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.8 }}>Roof</Typography>
                              </Box>
                              
                              {/* Water Heater indicator */}
                              <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: hoveredSystem && hoveredSystem !== 'waterheater' ? 0.3 : 1, transition: 'opacity 0.2s ease-in-out' }}
                                onMouseEnter={e => {
                                  setHoveredSystem('waterheater');
                                  const currentYear = new Date().getFullYear();
                                  let yearsLeft = null;
                                  if (prop.forecasting?.WaterHeater) {
                                    const { lifespan, installDate } = prop.forecasting.WaterHeater;
                                    if (lifespan && installDate) {
                                      const installYear = new Date(installDate).getFullYear();
                                      yearsLeft = Math.max(0, Math.floor(lifespan + installYear - currentYear));
                                    }
                                  }
                                  setHoveredSegment({
                                    label: 'Water Heater',
                                    amount: 0,
                                    percent: prop.waterHeaterHealth || 0,
                                    period: 'Monthly',
                                    x: e.clientX,
                                    y: e.clientY,
                                    source: 'friend-health',
                                    yearsLeft: yearsLeft || 0,
                                  });
                                }}
                                onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                onMouseLeave={() => {
                                  setHoveredSegment(null);
                                  setHoveredSystem(null);
                                }}
                              >
                                <Box sx={{ width: 50, height: 50, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="50" height="50" viewBox="0 0 70 70" style={{ position: 'absolute' }}>
                                    {/* Background circle */}
                                    <circle cx="35" cy="35" r="28" fill="none" stroke="#f0f0f0" strokeWidth="12" />
                                    {/* Progress arc - only show if health > 0 */}
                                    {(prop.waterHeaterHealth || 0) > 0 && (
                                      <circle cx="35" cy="35" r="28" fill="none" stroke={
                                        (prop.waterHeaterHealth || 0) > 75 ? '#89AE99' :
                                        (prop.waterHeaterHealth || 0) >= 41 ? '#E5B26B' :
                                        '#D36666'
                                      } strokeWidth="12" strokeDasharray={`${(prop.waterHeaterHealth || 0) * 1.76} 176`} strokeLinecap="round" transform="rotate(-90 35 35)"
                                      />
                                    )}
                                  </svg>
                                </Box>
                                <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.8 }}>Water Heater</Typography>
                              </Box>
                              
                              {/* HVAC indicator */}
                              <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: hoveredSystem && hoveredSystem !== 'hvac' ? 0.3 : 1, transition: 'opacity 0.2s ease-in-out' }}
                                onMouseEnter={e => {
                                  setHoveredSystem('hvac');
                                  const currentYear = new Date().getFullYear();
                                  let yearsLeft = null;
                                  if (prop.forecasting?.HVAC) {
                                    const { lifespan, installDate } = prop.forecasting.HVAC;
                                    if (lifespan && installDate) {
                                      const installYear = new Date(installDate).getFullYear();
                                      yearsLeft = Math.max(0, Math.floor(lifespan + installYear - currentYear));
                                    }
                                  }
                                  setHoveredSegment({
                                    label: 'HVAC',
                                    percent: prop.hvacHealth || 0,
                                    period: 'Monthly',
                                    amount: 0,
                                    x: e.clientX,
                                    y: e.clientY,
                                    source: 'friend-health',
                                    yearsLeft: yearsLeft || 0,
                                  });
                                }}
                                onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                onMouseLeave={() => {
                                  setHoveredSegment(null);
                                  setHoveredSystem(null);
                                }}
                              >
                                <Box sx={{ width: 50, height: 50, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="50" height="50" viewBox="0 0 70 70" style={{ position: 'absolute' }}>
                                    {/* Background circle */}
                                    <circle cx="35" cy="35" r="28" fill="none" stroke="#f0f0f0" strokeWidth="12" />
                                    {/* Progress arc - only show if health > 0 */}
                                    {(prop.hvacHealth || 0) > 0 && (
                                      <circle cx="35" cy="35" r="28" fill="none" stroke={
                                        (prop.hvacHealth || 0) > 75 ? '#89AE99' :
                                        (prop.hvacHealth || 0) >= 41 ? '#E5B26B' :
                                        '#D36666'
                                      } strokeWidth="12" strokeDasharray={`${(prop.hvacHealth || 0) * 1.76} 176`} strokeLinecap="round" transform="rotate(-90 35 35)"
                                      />
                                    )}
                                  </svg>
                                </Box>
                                <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.8 }}>HVAC</Typography>
                              </Box>
                              {/* Tooltip for Friend Health indicators */}
                              <SegmentTooltip data={hoveredSegment} source="friend-health" variant="health" />
                            </Box>
                          </Box>
                          
                          {/* RIGHT SECTION: Property Details */}
                          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', pb: 1.5 }}>
                              Property Breakdown
                            </Typography>
                            <Typography sx={{ fontSize: 14, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.5 }}>
                              <span style={{ fontWeight: 700 }}>Owner:</span> {prop?.rentalInsurance?.assetsCovered || ''}<br/>
                              <Box sx={{ py: 0.5 }}>
                                <span style={{ fontWeight: 700 }}>Address:</span> {prop.address1 || ''}
                              </Box>
                              <span style={{ fontWeight: 700 }}>Year Built:</span> {prop.yearBuilt || ''}<br/>
                              <span style={{ fontWeight: 700 }}>Bedrooms:</span> {prop.bedrooms || ''}<br/>
                              <span style={{ fontWeight: 700 }}>Bathrooms:</span> {prop.bathrooms || ''}<br/>
                              <span style={{ fontWeight: 700 }}>Square Feet:</span> {prop.squareFeet?.toLocaleString() || ''}
                            </Typography>
                          </Box>
                        </Box>
                        
                        {/* Tasks Section */}
                        <Box sx={{ display: 'flex', gap: 2, mt: 5.3, flex: 0, mb: 0 }}>
                          {/* Upcoming Tasks */}
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                              Upcoming Tasks
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {propertyUpcoming.length > 0 ? (
                                propertyUpcoming.slice(0, 2).map(task => (
                                  <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FFB366', flexShrink: 0, mt: 0.3 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography sx={{ fontSize: 13, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                        {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                                      </Typography>
                                      <Typography sx={{ fontSize: 12, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                        {task.date}
                                      </Typography>
                                    </Box>
                                  </Box>
                                ))
                              ) : (
                                <Typography sx={{ fontSize: 12, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No upcoming tasks</Typography>
                              )}
                            </Box>
                          </Box>
                          
                          {/* Overdue Tasks */}
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                              Overdue Tasks
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {propertyOverdue.length > 0 ? (
                                propertyOverdue.slice(0, 2).map(task => (
                                  <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FFB366', flexShrink: 0, mt: 0.3 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography sx={{ fontSize: 13, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                        {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                                      </Typography>
                                      <Typography sx={{ fontSize: 12, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                        {task.date}
                                      </Typography>
                                    </Box>
                                  </Box>
                                ))
                              ) : (
                                <Typography sx={{ fontSize: 12, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No overdue tasks</Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                        </>
                      )}
                    </Paper>
                                    ) : ((isOwner || isCoOwner) && !prop.isRental) ? (
                    // HOMEOWNER (NON-RENTAL) PROPERTY CARD (for owner or co-owner)
                    <Paper
                      key={prop.id}
                      sx={{
                        borderRadius: '16px',
                        width: isSingleProperty ? { xs: '100%', sm: '100%', md: singleCardWidth } : { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd },
                        minWidth: isSingleProperty ? { xs: '100%', sm: '100%', md: singleCardWidth } : { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd },
                        maxWidth: isSingleProperty ? { xs: '100%', sm: '100%', md: singleCardWidth } : { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd },
                        overflow: 'hidden',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        flex: '0 0 auto',
                        p: { xs: 2, sm: 2.5, md: 3 },
                        bgcolor: '#f7f8fa',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
                        gap: { xs: 2, md: 2.5 },
                        ...cardSnapSx,
                        ...mobileCardContentSx
                      }}
                    >
                      {/* Top: property image with overlay label */}
                      <Box
                        sx={{
                          position: 'relative',
                          width: '100%',
                          height: { xs: 210, sm: 240, md: 300 },
                          borderRadius: '12px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                        onClick={() => {
                          if (typeof onPropertyClick === 'function') onPropertyClick(prop.id);
                        }}
                      >
                        <img
                          src={prop.photoUrl || "/empty-property.png"}
                          alt={prop.propertyName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 100%)',
                            pointerEvents: 'none'
                          }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 12,
                            left: 12,
                            px: 2,
                            py: 0.75,
                            borderRadius: '12px',
                            bgcolor: 'rgba(52,55,72,0.85)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 14,
                            fontFamily: 'Nunito, Arial, sans-serif',
                            zIndex: 2
                          }}
                        >
                          {(() => {
                            if (currentUser && prop.id && Array.isArray(prop.sharedWith)) {
                              const sharedEntry = prop.sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === currentUser.uid);
                              if (sharedEntry && typeof sharedEntry === 'object' && sharedEntry.alias) {
                                return sharedEntry.alias;
                              }
                            }
                            return prop.tag || 'Home';
                          })()}
                        </Box>
                        {prop.noMortgage && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 12,
                              right: 12,
                              px: 2,
                              py: 0.75,
                              borderRadius: '12px',
                              bgcolor: 'rgba(52,55,72,0.75)',
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: 13,
                              fontFamily: 'Nunito, Arial, sans-serif',
                              zIndex: 2
                            }}
                          >
                            Paid Off
                          </Box>
                        )}
                      </Box>

                      {/* Middle: chart + breakdown */}
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1.15fr', md: '1fr 1.3fr' },
                          gap: { xs: 1.5, sm: 2, md: 3 },
                          alignItems: 'center'
                        }}
                      >
                        {/* Chart column */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: { xs: 0.5, md: 2 } }}>
                          <Box sx={{ position: 'relative', width: { xs: 160, sm: 200, md: 280 }, height: { xs: 160, sm: 200, md: 280 } }}>
                            <svg width="100%" height="100%" viewBox="0 0 110 110" style={{ position: 'absolute' }}>
                              <defs>
                                <path
                                  id={`arcPathHomeowner-${prop.id}`}
                                  d="M 32 55 A 23 23 0 0 1 78 55"
                                  fill="none"
                                />
                              </defs>

                              {/* OUTER CIRCLE - Homeowner Expense Breakdown */}
                              {(() => {
                                const mortgagePayment = prop.noMortgage ? 0 : parseValue(prop.mortgagePaymentAmount);
                                let insuranceAmount = parseValue(prop.insurance?.amount);
                                if (prop.insurance?.frequency === 'Yearly') {
                                  insuranceAmount = insuranceAmount / 12;
                                }
                                const propertyTaxAmountLocal = getLatestPropertyTax(prop.propertyTaxHistory || []);
                                if (prop.isPT && !prop.noMortgage) {
                                  insuranceAmount = 0;
                                } else {
                                  insuranceAmount += (propertyTaxAmountLocal / 12);
                                }
                                let hoaAmount = prop.hoa ? (prop.yearly === 'Yearly' ? parseValue(prop.hoa) / 12 : parseValue(prop.hoa)) : 0;
                                let pmiAmount = parseValue(prop.pmi);
                                if (prop.noMortgage) {
                                  pmiAmount = 0;
                                }
                                const forecastingMonthlyLocal = calculateForecastingMonthly(prop.forecasting);
                                const total = mortgagePayment + insuranceAmount + hoaAmount + pmiAmount + forecastingMonthlyLocal;
                                const segments = [
                                  ...(prop.noMortgage ? [] : [{ value: mortgagePayment, color: '#E35E61', label: 'Mortgage' }]),
                                  { value: insuranceAmount, color: '#EEB05E', label: 'Taxes/Insurance' },
                                  { value: hoaAmount, color: '#db83ad', label: 'HOA' },
                                  { value: pmiAmount, color: '#C45584', label: 'PMI' },
                                  { value: forecastingMonthlyLocal, color: '#D2794F', label: 'Forecasting/Planning' }
                                ].filter(seg => seg.value > 0);
                                if (segments.length === 0) {
                                  return (
                                    <circle cx="55" cy="55" r="44" fill="none" stroke="#e8e8e8" strokeWidth="6.5" />
                                  );
                                }
                                const sorted = [...segments].sort((a, b) => b.value - a.value);
                                const drawSegments: typeof sorted = [];
                                for (let i = 0; i < sorted.length; i += 2) {
                                  drawSegments.push(sorted[i]);
                                }
                                for (let i = sorted.length % 2 === 0 ? sorted.length - 1 : sorted.length - 2; i > 0; i -= 2) {
                                  drawSegments.push(sorted[i]);
                                }
                                const gap = 8;
                                const radius = 44;
                                const circumference = 2 * Math.PI * radius;
                                const totalGaps = drawSegments.length > 1 ? gap * drawSegments.length : 0;
                                const availableSpace = circumference - totalGaps;
                                const biggestSegment = drawSegments[0];
                                const biggestPercent = (biggestSegment.value / total) * 100;
                                const biggestDashLength = (biggestPercent / 100) * availableSpace;
                                const angleForBiggest = (biggestDashLength / circumference) * 360;
                                const rotationAngle = 180 - (angleForBiggest / 2);
                                let offset = 0;
                                return drawSegments.map((segment) => {
                                  const percent = (segment.value / total) * 100;
                                  const dashLength = (percent / 100) * availableSpace;
                                  const el = (
                                    <circle
                                      key={segment.label}
                                      cx="55"
                                      cy="55"
                                      r="44"
                                      fill="none"
                                      stroke={segment.color}
                                      strokeWidth={
                                        hoveredSegment?.source === 'homeowner' && hoveredSegment?.propertyId === prop.id
                                          ? hoveredSegment?.label === segment.label ? "7.5" : "5.5"
                                          : "6.5"
                                      }
                                      strokeDasharray={`${dashLength} ${circumference}`}
                                      strokeDashoffset={offset}
                                      strokeLinecap="round"
                                      transform={`rotate(${rotationAngle + 90} 55 55)`}
                                      style={{
                                        opacity: hoveredSegment?.source === 'homeowner-inner' && hoveredSegment?.propertyId === prop.id ? 0.3 :
                                                hoveredSegment?.source === 'homeowner' && hoveredSegment?.propertyId === prop.id && hoveredSegment?.label !== segment.label ? 0.3 : 1,
                                        transition: 'opacity 0.2s ease-in-out, stroke-width 0.2s ease-in-out'
                                      }}
                                      onMouseEnter={(e: any) => {
                                        const period = cardButtonState[prop.id] || 'Monthly';
                                        const amt = period === 'Yearly' ? segment.value * 12 : segment.value;
                                        setHoveredSegment({ label: segment.label, percent, amount: amt, period, x: e.clientX, y: e.clientY, source: 'homeowner', propertyId: prop.id });
                                      }}
                                      onMouseMove={(e: any) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                      onMouseLeave={() => setHoveredSegment(null)}
                                    />
                                  );
                                  offset -= (dashLength + gap);
                                  return el;
                                });
                              })()}

                              {/* INNER CIRCLE - Balance vs Purchase Price */}
                              {(() => {
                                const currentButtonState = cardButtonState[prop.id] || 'Monthly';
                                const r = 35;
                                const circ = 2 * Math.PI * r;
                                const animState = circleAnimState[prop.id] || 'origin';

                                const segmentCount = 12;
                                const gapAngle = 13;
                                const totalGapDegrees = segmentCount * gapAngle;
                                const availableDegrees = 360 - totalGapDegrees;
                                const segmentDegrees = availableDegrees / segmentCount;
                                const segmentLength = (segmentDegrees / 360) * circ;
                                const currentMonthIdx = new Date().getMonth();
                                const currentYear = new Date().getFullYear();
                                const createdDate = prop.createdAt ? new Date(prop.createdAt) : null;
                                const createdYear = createdDate ? createdDate.getFullYear() : currentYear;
                                const createdMonthIdx = createdDate ? createdDate.getMonth() : 0;
                                const startMonthIdx = createdYear < currentYear ? 0 : createdMonthIdx;

                                const mortgagePayment = prop.noMortgage ? 0 : parseValue(prop.mortgagePaymentAmount);
                                let insuranceAmount = parseValue(prop.insurance?.amount);
                                if (prop.insurance?.frequency === 'Yearly') insuranceAmount = insuranceAmount / 12;
                                const propertyTaxAmountLocal = getLatestPropertyTax(prop.propertyTaxHistory || []);
                                if (prop.isPT && !prop.noMortgage) insuranceAmount = 0; else insuranceAmount += propertyTaxAmountLocal / 12;
                                let hoaAmount = prop.hoa ? (prop.yearly === 'Yearly' ? parseValue(prop.hoa) / 12 : parseValue(prop.hoa)) : 0;
                                let pmiAmount = prop.noMortgage ? 0 : parseValue(prop.pmi);
                                let forecastingMonthly = 0;
                                if (prop.forecasting && typeof prop.forecasting === 'object') {
                                  forecastingMonthly = calculateForecastingMonthly(prop.forecasting);
                                }
                                const monthlyTotal = mortgagePayment + insuranceAmount + hoaAmount + pmiAmount + forecastingMonthly;

                                if (currentButtonState === 'Actual' && animState === 'origin') {
                                  return (
                                    <TwelveSegmentCircle
                                      activeColor="#6A7F91"
                                      startMonthIdx={startMonthIdx}
                                      onMouseEnter={(e, idx, name) => {
                                        const isInRange = idx >= startMonthIdx && idx <= currentMonthIdx;
                                        setHoveredSegment({ label: name, amount: isInRange ? monthlyTotal : -1, percent: -1, period: 'Actual', x: e.clientX, y: e.clientY, source: 'homeowner-inner', propertyId: prop.id });
                                      }}
                                      onMouseMove={(e) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                      onMouseLeave={() => setHoveredSegment(null)}
                                    />
                                  );
                                }

                                const purchasePrice = prop.price ? parseFloat(prop.price as any) : 0;
                                const remainingBalance = prop.noMortgage ? 0 : (prop.balance ? parseFloat(prop.balance as any) : 0);
                                const equity = purchasePrice - remainingBalance;
                                let filledPercentage = 0;
                                if (prop.noMortgage) {
                                  filledPercentage = 100;
                                } else if (purchasePrice > 0) {
                                  filledPercentage = Math.min(100, Math.max(0, (equity / purchasePrice) * 100));
                                }
                                const dashLength = (filledPercentage / 100) * circ;
                                const dashGap = circ - dashLength;

                                let targetPercent = 5;
                                if (filledPercentage < 5) targetPercent = Math.max(0, filledPercentage / 2);
                                const targetLength = (targetPercent / 100) * circ;
                                const targetGap = circ - targetLength;
                                let animation = '';
                                if (animState === 'to5') animation = 'fillTo5 0.7s ease-in-out forwards';
                                else if (animState === 'back') animation = 'fillBack 0.7s ease-in-out forwards';
                                else if (animState === 'toFull') animation = 'fillToFull 0.5s ease-in-out forwards';
                                else if (animState === 'shrink') animation = 'shrinkToZero 0.7s ease-in-out forwards';
                                else if (animState === 'expandFromZero') animation = 'expandFromZero 0.5s ease-in-out forwards';
                                else if (animState === 'shrinkToOrigin') animation = 'shrinkToOrigin 0.7s ease-in-out forwards';

                                const showSegments = animState === 'shrink' || animState === 'expandFromZero';

                                return (
                                  <>
                                    {showSegments && Array.from({ length: segmentCount }).map((_, i) => {
                                      const startAngle = i * (segmentDegrees + gapAngle) - 90;
                                      const offset = -(startAngle / 360) * circ;
                                      const isInRange = i >= startMonthIdx && i <= currentMonthIdx;
                                      return (
                                        <circle
                                          key={`shrink-segment-homeowner-${prop.id}-${i}`}
                                          cx="55" cy="55" r={r}
                                          fill="none"
                                          stroke={isInRange ? "#6A7F91" : "#e0e0e0"}
                                          strokeWidth="6.5"
                                          strokeLinecap="round"
                                          strokeDasharray={`${segmentLength} ${circ - segmentLength}`}
                                          strokeDashoffset={offset}
                                          style={{ pointerEvents: 'none' }}
                                        />
                                      );
                                    })}
                                    {!showSegments && (
                                      <circle
                                        cx="55"
                                        cy="55"
                                        r={r}
                                        fill="none"
                                        stroke="#e8e8e8"
                                        strokeWidth="6.5"
                                        style={{
                                          opacity: hoveredSegment?.source === 'homeowner' && hoveredSegment?.propertyId === prop.id ? 0.3 : 1,
                                          transition: 'opacity 0.2s ease-in-out'
                                        }}
                                        onMouseEnter={e => {
                                          setHoveredSegment({
                                            label: 'Owed',
                                            amount: Math.max(0, remainingBalance),
                                            percent: purchasePrice > 0 ? (Math.max(0, remainingBalance) / purchasePrice) * 100 : 0,
                                            period: 'Monthly',
                                            x: e.clientX,
                                            y: e.clientY,
                                            source: 'homeowner-inner',
                                            propertyId: prop.id,
                                          });
                                        }}
                                        onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                        onMouseLeave={() => setHoveredSegment(null)}
                                      />
                                    )}
                                    {filledPercentage > 0 && (
                                      <circle
                                        key={`paid-circle-homeowner-${prop.id}-${rentalAnimationKey[prop.id] || 0}`}
                                        cx="55"
                                        cy="55"
                                        r={r}
                                        fill="none"
                                        stroke="#6A7F91"
                                        strokeWidth="6.5"
                                        strokeDasharray={animState === 'to5' ? `${targetLength} ${targetGap}` : animState === 'toFull' || animState === 'shrink' ? `${circ} 0` : animState === 'expandFromZero' ? `0 ${circ}` : animState === 'shrinkToOrigin' ? `${circ} 0` : `${dashLength} ${dashGap}`}
                                        strokeDashoffset={-circ / 4}
                                        strokeLinecap="round"
                                        transform="rotate(-180 55 55)"
                                        style={{
                                          animation,
                                          '--origin-length': `${dashLength}px`,
                                          '--origin-gap': `${dashGap}px`,
                                          '--five-length': `${targetLength}px`,
                                          '--five-gap': `${targetGap}px`,
                                          '--full-length': `${circ}px`,
                                          '--full-gap': '0px',
                                          opacity: hoveredSegment?.source === 'homeowner' && hoveredSegment?.propertyId === prop.id ? 0.3 : 1,
                                          transition: 'opacity 0.2s ease-in-out'
                                        } as any}
                                        onMouseEnter={e => {
                                          setHoveredSegment({
                                            label: 'Paid',
                                            amount: Math.max(0, equity),
                                            period: 'Monthly',
                                            percent: purchasePrice > 0 ? (Math.max(0, equity) / purchasePrice) * 100 : 0,
                                            x: e.clientX,
                                            y: e.clientY,
                                            source: 'homeowner-inner',
                                            propertyId: prop.id,
                                          });
                                        }}
                                        onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                        onMouseLeave={() => setHoveredSegment(null)}
                                      />
                                    )}
                                  </>
                                );
                              })()}

                              {/* Curved text for equity ratio */}
                              {!prop.noMortgage && (cardButtonState[prop.id] || 'Monthly') !== 'Actual' && (
                                <text fill="#999" fontSize="6" textAnchor="middle">
                                  <textPath href={`#arcPathHomeowner-${prop.id}`} startOffset="50%">
                                    {(() => {
                                      const purchasePrice = prop.price ? parseFloat(prop.price as any) : 0;
                                      const remainingBalance = prop.balance ? parseFloat(prop.balance as any) : 0;
                                      const equity = purchasePrice - remainingBalance;
                                      if (!purchasePrice || isNaN(purchasePrice) || purchasePrice === 0) return 'N/A';
                                      return `${formatKOrM(equity)}/${formatKOrM(purchasePrice)}`;
                                    })()}
                                  </textPath>
                                </text>
                              )}
                            </svg>

          {(() => {
            let monthlyExact = Math.round(Number(homeownerExpenses?.toFixed?.(2) ?? homeownerExpenses));
            const showNA = monthlyExact === null || monthlyExact === undefined || isNaN(monthlyExact) || (monthlyExact > -1 && monthlyExact < 1);
            const canEdit = showNA && !isFriend;
            return (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  zIndex: 1,
                  pointerEvents: canEdit ? 'auto' : 'none',
                  cursor: canEdit ? 'pointer' : 'default'
                }}
                onClick={canEdit ? () => handleOpenEditModal(prop, 'owner') : undefined}
              >
                                <Typography sx={{ fontSize: { xs: 16, sm: 18, md: 22 }, fontWeight: 700, color: '#89AE99', fontFamily: 'Nunito, Arial, sans-serif', '&:hover': canEdit ? { textDecoration: 'underline' } : {} }}>
                                  {showNA ? 'Add info' : ((monthlyExact < 0 ? '-' : '') + `$${Math.abs(monthlyExact).toLocaleString('en-US')}`)}
                                </Typography>
                                <Typography sx={{ fontSize: { xs: 10, sm: 11 }, color: '#888', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1 }}>
                                  {cardButtonState[prop.id] === 'Yearly' ? 'Yearly Expenses' : cardButtonState[prop.id] === 'Actual' ? 'Year to Date' : 'Monthly Expenses'}
                                </Typography>
              </Box>
            );
          })()}
                            <SegmentTooltip data={hoveredSegment} source="homeowner" variant="full" />
                            <SegmentTooltip data={hoveredSegment} source="homeowner-inner" propertyId={prop.id} variant="amount-only" formatAmount={(amt) => `$${amt.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
                          </Box>
                        </Box>

                        {/* Breakdown column */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0.8, sm: 1.1 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>
                              Property Breakdown
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            sx={{
                              px: 1.6,
                              py: 0.5,
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: '20px',
                              background: '#fff',
                              border: '1px solid #B0B8C1',
                              color: '#333',
                              boxShadow: 'none',
                              textTransform: 'none',
                              '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' }
                            }}
                            onClick={() => {
                              const currentState = cardButtonState[prop.id] || 'Monthly';
                              const nextState = currentState === 'Monthly' ? 'Yearly' : currentState === 'Yearly' ? 'Actual' : 'Monthly';

                              if (currentState === 'Yearly' && nextState === 'Actual') {
                                setCircleAnimState(prev => ({ ...prev, [prop.id]: 'toFull' }));
                                setTimeout(() => {
                                  setCircleAnimState(prev => ({ ...prev, [prop.id]: 'shrink' }));
                                  setCardButtonState(prev => ({ ...prev, [prop.id]: nextState }));
                                  setTimeout(() => {
                                    setCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                    setRentalAnimationKey(prev => ({ ...prev, [prop.id]: (prev[prop.id] || 0) + 1 }));
                                  }, 700);
                                }, 500);
                              } else if (currentState === 'Actual' && nextState === 'Monthly') {
                                setCircleAnimState(prev => ({ ...prev, [prop.id]: 'expandFromZero' }));
                                setTimeout(() => {
                                  setCardButtonState(prev => ({ ...prev, [prop.id]: nextState }));
                                  setCircleAnimState(prev => ({ ...prev, [prop.id]: 'shrinkToOrigin' }));
                                  setTimeout(() => {
                                    setCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                    setRentalAnimationKey(prev => ({ ...prev, [prop.id]: (prev[prop.id] || 0) + 1 }));
                                  }, 700);
                                }, 500);
                              } else {
                                setCardButtonState(prev => ({ ...prev, [prop.id]: nextState }));
                                setCircleAnimState(prev => ({ ...prev, [prop.id]: 'to5' }));
                                setTimeout(() => {
                                  setCircleAnimState(prev => ({ ...prev, [prop.id]: 'back' }));
                                  setTimeout(() => {
                                    setCircleAnimState(prev => ({ ...prev, [prop.id]: 'origin' }));
                                    setRentalAnimationKey(prev => ({ ...prev, [prop.id]: (prev[prop.id] || 0) + 1 }));
                                  }, 700);
                                }, 700);
                              }
                            }}
                          >
                            {(() => {
                              const current = cardButtonState[prop.id] || 'Monthly';
                              return current === 'Monthly' ? 'Monthly' : current === 'Yearly' ? 'Yearly' : 'Actual';
                            })()}
                          </Button>
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>Property Value</Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#333', fontFamily: 'Nunito, Arial, sans-serif' }}>{formatCurrency(propertyValue)}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>Equity</Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#333', fontFamily: 'Nunito, Arial, sans-serif' }}>{formatCurrency(equity)}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>Appreciation</Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#333', fontFamily: 'Nunito, Arial, sans-serif' }}>{appreciation !== 0 ? formatCurrency(appreciation) : ''}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>Expenses</Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#333', fontFamily: 'Nunito, Arial, sans-serif' }}>
                              {(() => {
                                const currentState = cardButtonState[prop.id] || 'Monthly';
                                const monthlyExact = expenses;
                                return currentState === 'Yearly'
                                  ? formatCurrency(Math.round(monthlyExact * 12), 0)
                                  : formatCurrency(Math.round(monthlyExact), 0);
                              })()} {cardButtonState[prop.id] === 'Yearly' ? 'Yearly' : 'Monthly'}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>Paid-off date</Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#333', fontFamily: 'Nunito, Arial, sans-serif' }}>
                              {(() => {
                                if (prop.noMortgage) {
                                  return prop.mortgagePaidOffDate ? new Date(prop.mortgagePaidOffDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
                                }
                                if (prop.date) {
                                  try {
                                    const purchaseDate = new Date(prop.date);
                                    const term = prop.term || '';
                                    const years = parseInt(term.split(' ')[0]);
                                    const termYears = isNaN(years) ? 30 : years;
                                    const paidOffDate = new Date(purchaseDate.getFullYear() + termYears, purchaseDate.getMonth(), purchaseDate.getDate());
                                    return paidOffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                  } catch (e) {
                                    return '';
                                  }
                                }
                                return '';
                              })()}
                            </Typography>
                          </Box>
                          {!prop.noMortgage && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>Remaining Balance</Typography>
                              <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#333', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                {remainingBalance < 0 ? '-' : ''}${Math.abs(remainingBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* Progress Bar */}
                        <Box sx={{ mt: 1 }}>
                          {(() => {
                            if (prop.noMortgage || (!prop.term && !prop.date)) {
                              return (
                                <>
                                  <Box sx={{ width: '100%', height: 16, bgcolor: '#e6e8ec', borderRadius: 999, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                                    <Box sx={{ height: '100%', width: '0%', bgcolor: '#6f8fa3', borderRadius: 999 }} />
                                  </Box>
                                  <Typography sx={{ fontSize: 12, color: '#666', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.5, textAlign: 'center', fontWeight: 600 }}>
                                    0 Months Left
                                  </Typography>
                                </>
                              );
                            }

                            const termMonths = (() => {
                              const term = prop.term || '30 Year Fixed';
                              const years = parseInt(term.split(' ')[0]);
                              return isNaN(years) ? 0 : years * 12;
                            })();

                            let monthsElapsed = 0;
                            if (prop.date) {
                              try {
                                const purchaseDate = new Date(prop.date);
                                const today = new Date();
                                monthsElapsed = (today.getFullYear() - purchaseDate.getFullYear()) * 12 + (today.getMonth() - purchaseDate.getMonth());
                                monthsElapsed = Math.max(0, monthsElapsed);
                              } catch (e) {
                                monthsElapsed = 0;
                              }
                            }

                            const remainingMonths = Math.max(0, termMonths - monthsElapsed);
                            const remainingPercentage = termMonths > 0 ? (remainingMonths / termMonths) * 100 : 0;

                            return (
                              <>
                        <Box sx={{ width: '100%', height: 16, bgcolor: '#e6e8ec', borderRadius: 999, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                          <Box sx={{ height: '100%', width: `${Math.min(100, remainingPercentage)}%`, bgcolor: '#6f8fa3', borderRadius: 999 }} />
                        </Box>
                                <Typography sx={{ fontSize: 12, color: '#666', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.5, textAlign: 'center', fontWeight: 600 }}>
                                  {remainingMonths} Months Left
                                </Typography>
                              </>
                            );
                          })()}
                        </Box>
                      </Box>
                    </Box>

                    {/* Bottom: Tasks */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 2, sm: 3 }, mt: { xs: 1, md: 2 } }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>
                          Upcoming Tasks
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                          {propertyUpcoming.length > 0 ? (
                            propertyUpcoming.slice(0, 2).map(task => (
                              <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#e58a5c', flexShrink: 0, mt: 0.35 }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                                  </Typography>
                                  <Typography sx={{ fontSize: 12, color: '#888', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.2 }}>
                                    {task.date}
                                  </Typography>
                                </Box>
                              </Box>
                            ))
                          ) : (
                            <Typography sx={{ fontSize: 12, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No upcoming tasks</Typography>
                          )}
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>
                          Overdue Tasks
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                          {propertyOverdue.length > 0 ? (
                            propertyOverdue.slice(0, 2).map(task => (
                              <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#c85f5f', flexShrink: 0, mt: 0.35 }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                                  </Typography>
                                  <Typography sx={{ fontSize: 12, color: '#888', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.2 }}>
                                    {task.date}
                                  </Typography>
                                </Box>
                              </Box>
                            ))
                          ) : (
                            <Typography sx={{ fontSize: 12, color: '#aaa', fontFamily: 'Nunito, Arial, sans-serif' }}>No overdue tasks</Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </Paper>

                  ) : (
                    // FRIEND CARD or fallback (for other shared users)
                    <Paper key={prop.id} sx={{ borderRadius: 2, width: { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, minWidth: { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, maxWidth: { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, height: 'auto', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', flex: '0 0 auto', p: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.16)', ...cardSnapSx, ...mobileCardContentSx }}>
                      <Box sx={{ position: 'relative', height: { xs: 200, sm: 240, md: 290 }, overflow: 'hidden', cursor: 'pointer', flexShrink: 0, borderRadius: 2 }}
                        onClick={() => {
                          if (typeof onPropertyClick === 'function') onPropertyClick(prop.id);
                        }}>
                        <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 2, bgcolor: "rgba(52,55,72,0.7)", color: '#fff', px: 2, py: 0.75, borderRadius: 1.5, fontWeight: 600, fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif' }}>
                          {prop.tag || 'Property'}
                        </Box>
                        <img src={prop.photoUrl || "/empty-property.png"} alt={prop.propertyName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </Box>
                      <Box sx={{ p: 1.5, pb: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8, overflowY: 'auto' }}>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                          Shared Property
                        </Typography>
                        <Typography sx={{ fontSize: 14, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.5 }}>
                          You have access to this property as a shared user.
                        </Typography>
                      </Box>
                    </Paper>
                  );
                })}
                {/* Add Property Card at the end */}
                <Paper sx={{ borderRadius: 2, width: { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, minWidth: { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, maxWidth: { xs: mobileCardWidthXs, sm: cardWidthSm, md: cardWidthMd }, height: 'auto', display: 'flex', flexDirection: 'column', bgcolor: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.16)', flex: '0 0 auto', ...cardSnapSx, ...mobileCardContentSx }}>
                  {/* Top Section - Add Property Prompt */}
                  <Box sx={{ width: '100%', height: { xs: 232, sm: 272, md: 322 }, minHeight: { xs: 232, sm: 272, md: 322 }, maxHeight: { xs: 232, sm: 272, md: 322 }, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#fff', borderRadius: '8px 8px 0 0', py: 2, px: 2, opacity: 1 }}>
                    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#fff', borderRadius: 2, p: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.13)' }}>
                      <Box sx={{ mb: 2, mt: 1 }}>
                        {/* Provided SVG icon, slightly smaller */}
                      <svg width="48" height="52" viewBox="0 0 42 45" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g opacity="1">
                          <path d="M7.31587 1.84052L7.22112 12.5006" stroke="#212121" strokeWidth="2.35958" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M12.6027 7.21973L1.93262 7.12378" stroke="#212121" strokeWidth="2.35958" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M18.5845 39.8547V35.0306C18.5844 33.8036 19.5848 32.8066 20.8242 32.7983H25.3641C26.6095 32.7983 27.619 33.7977 27.619 35.0306V35.0306V39.8697C27.6187 40.9115 28.4586 41.763 29.5106 41.7874H32.5373C35.5544 41.7874 38.0004 39.366 38.0004 36.379V36.379V22.6556C37.9842 21.4806 37.4269 20.3771 36.487 19.6593L26.1359 11.4043C24.3225 9.96696 21.7447 9.96696 19.9313 11.4043L9.62562 19.6743C8.68216 20.3892 8.12392 21.4945 8.1123 22.6706V36.379C8.1123 39.366 10.5582 41.7874 13.5754 41.7874H16.602C17.6802 41.7874 18.5542 40.9221 18.5542 39.8547V39.8547" stroke="#212121" strokeWidth="2.35958" strokeLinecap="round" strokeLinejoin="round"/>
                        </g>
                      </svg>
                    </Box>
                    <Typography variant="h4" fontWeight={550} sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 1, color: '#343748', textAlign: 'center', fontSize: 24, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                      You have {properties.length} {properties.length === 1 ? 'property' : 'properties'}
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#7a7a7a', mb: 2, textAlign: 'center', fontSize: 14, fontWeight: 400, lineHeight: 1.2 }}>
                      Got another home on your mind?<br/>Let’s get it in proper order.
                    </Typography>
                    <Button variant="contained" sx={{ bgcolor: '#89AE99', color: '#fff', px: 3, py: 0.5, borderRadius: 2, fontSize: '1rem', fontWeight: 400, boxShadow: 0, minWidth: 140, textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif' }}
                      onClick={async () => {
                        const auth = getAuth();
                        const user = auth.currentUser;
                        if (!user) return;
                        
                        // Check for special admin emails that bypass limits
                        const adminEmails = ['river@fishdawgproductions.com', 'andrii@allproperly.com'];
                        if (adminEmails.includes(user.email || '')) {
                          setAddPropertyOpen(true);
                          if(onAddClick) onAddClick();
                          return;
                        }
                        
                        const { doc, getDoc, collection, getDocs } = await import("firebase/firestore");
                        const { db } = await import("../services/firebase");
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        const plan = userDoc.exists() ? (userDoc.data().planState || "free") : "free";
                        let maxProperties = 1;
                        if (plan === "basic" || plan === "basic_annual") maxProperties = 5;
                        if (plan === "plus" || plan === "plus_annual") maxProperties = 10;
                        // Fetch all properties from Firebase
                        const allPropsSnap = await getDocs(collection(db, "properties"));
                        const allProps = allPropsSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                        // Count both owned and shared properties
                        const userProperties = allProps.filter((p: any) => {
                        const isOwner = p.ownerId === user.uid;
                          const isShared = Array.isArray(p.sharedWith) && p.sharedWith.some((sw: any) => {
                            if (typeof sw === 'string') return sw === user.uid;
                            if (typeof sw === 'object' && sw && sw.userId) return sw.userId === user.uid;
                                 return false;
                          });
                          return isOwner || isShared;
                        });
                        if (userProperties.length >= maxProperties) {
                          setUpgradePlan(plan);
                          setUpgradeLimitOpen(true);
                        } else {
                          setAddPropertyOpen(true);
                          if(onAddClick) onAddClick()
                        }
                      }}
                    >
                      Add Property
                    </Button>
                    </Box>
                  </Box>

                  {/* Bottom Section - Disabled Placeholder Content */}
                  <Box sx={{ px: 1, pb: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8, overflowY: 'auto', opacity: 0.8 }}>
                    <Box sx={{ p: 1.5, pb: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8, overflowY: 'auto', opacity: 0.7, mt: -1 }}>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        {/* Circular Chart Placeholder - imitating provided design */}
                        <Box sx={{ flexShrink: 0, width: 220, height: 220, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', mt: -2, ml: -1 }}>
                          <svg width="220" height="220" viewBox="0 0 110 110" style={{ position: 'absolute' }}>
                            {/* OUTER CIRCLE - Disabled style, same as Homeowner view */}
                            {(() => {
                              let segments = [50, 20, 15, 20, 5]; // Example segment values
                              // Sort descending
                              const sorted = [...segments].sort((a, b) => b - a);
                              // Balanced order: biggest, 3rd, 5th..., then last, 4th, 2nd...
                              const drawSegments = [];
                              for (let i = 0; i < sorted.length; i += 2) {
                                drawSegments.push(sorted[i]);
                              }
                              for (let i = sorted.length % 2 === 0 ? sorted.length - 1 : sorted.length - 2; i > 0; i -= 2) {
                                drawSegments.push(sorted[i]);
                              }
                              const total = drawSegments.reduce((a, b) => a + b, 0);
                              const gap = 8;
                              const radius = 44;
                              const circumference = 2 * Math.PI * radius;
                              const totalGaps = gap * drawSegments.length;
                              const availableSpace = circumference - totalGaps;
                              // Calculate rotation angle to center the biggest segment at 12 o'clock
                              const biggestSegment = drawSegments[0];
                              const biggestPercent = total > 0 ? (biggestSegment / total) * 100 : 0;
                              const biggestDashLength = (biggestPercent / 100) * availableSpace;
                              const angleForBiggest = (biggestDashLength / circumference) * 360;
                              const rotationAngle = 270 - (angleForBiggest / 2); // 270deg is top, minus half the segment
                              let offset = 0;
                              return drawSegments.map((value, i) => {
                                const percent = (value / total) * 100;
                                const dashLength = (percent / 100) * availableSpace;
                                const el = (
                                  <circle
                                    key={i}
                                    cx="55"
                                    cy="55"
                                    r="44"
                                    fill="none"
                                    stroke="#e0e0e0"
                                    style={{ opacity: 0.35 }}
                                    strokeWidth="6.5"
                                    strokeDasharray={`${dashLength} ${circumference}`}
                                    strokeDashoffset={offset}
                                    strokeLinecap="round"
                                    transform={`rotate(${rotationAngle} 55 55)`}
                                  />
                                );
                                offset -= (dashLength + gap);
                                return el;
                              });
                            })()}
                            {/* INNER CIRCLE - Disabled style */}
                            <circle cx="55" cy="55" r="35" fill="none" stroke="#e8e8e8" strokeWidth="6.5" style={{ opacity: 0.35 }} />
                          </svg>
                          <Box sx={{ textAlign: 'center', zIndex: 1, position: 'absolute', width: '100%', top: '50%', left: 0, transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                            <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif', mb: 0, lineHeight: 1 }}>
                              $ Profit
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1, mt: 0.5 }}>
                              Profit
                            </Typography>
                          </Box>
                        </Box>
                        {/* Details */}
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif' }}>
                              Property Breakdown
                            </Typography>
                            <Box sx={{ bgcolor: '#fafafa', border: '1px solid #ededed', borderRadius: 2, px: 1.2, py: 0.4, ml: 1 }}>
                              <Typography sx={{ fontSize: 12, color: '#e0e0e0', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif' }}>Monthly</Typography>
                            </Box>
                          </Box>
                          <Typography sx={{ fontSize: 14, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 700 }}>Property Value:</span> $ N/A<br/>
                            <span style={{ fontWeight: 700 }}>Equity:</span> $ N/A<br/>
                            <span style={{ fontWeight: 700 }}>Appreciation:</span> + $ N/A
                          </Typography>
                          <Typography sx={{ fontSize: 14, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.5, mt: 0.8 }}>
                            <span style={{ fontWeight: 700 }}>Paid-off date:</span> N/A<br/>
                            <span style={{ fontWeight: 700 }}>Remaining Balance:</span> $ N/A
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            <Box sx={{ width: '100%', height: 15, bgcolor: '#e8e8e8', borderRadius: 10, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end', opacity: 0.35 }}>
                              <Box sx={{ height: '100%', width: '100%', bgcolor: '#e0e0e0', borderRadius: 10 }} />
                            </Box>
                            <Typography sx={{ fontSize: 12, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.5, textAlign: 'center', fontWeight: 500 }}>
                              Months Left
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      {/* Tasks Section */}
                      <Box sx={{ display: 'flex', gap: 2, mt: 1, flex: 0, mb: 0 }}>
                        {/* Upcoming Tasks */}
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                            Upcoming Tasks
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#e0e0e0', flexShrink: 0, mt: 0.3, opacity: 0.35 }} />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontSize: 13, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                  Add Property to add tasks
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                  Date
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#e0e0e0', flexShrink: 0, mt: 0.3, opacity: 0.35 }} />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontSize: 13, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                  Add Property to add tasks
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                  Date
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                        {/* Overdue Tasks */}
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                            Overdue Tasks
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#e0e0e0', flexShrink: 0, mt: 0.3, opacity: 0.35 }} />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontSize: 13, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                  Add Property to add tasks
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                  Date
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#e0e0e0', flexShrink: 0, mt: 0.3, opacity: 0.35 }} />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontSize: 13, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                  Add Property to add tasks
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: '#e0e0e0', fontFamily: 'Nunito, Arial, sans-serif' }}>
                                  Date
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </>
            )}
          </Box>
        </Box>
      </Box>

      {/* Legend Panel with Carousel Buttons */}
      <LegendPanel
        properties={properties}
        rentalOnlyIncome={rentalOnlyIncome}
        rentalOnlyExpenses={rentalOnlyExpenses}
        rentalOnlyPrice={rentalOnlyPrice}
        rentalOnlyBalance={rentalOnlyBalance}
        rentalOnlyMortgage={rentalOnlyMortgage}
        rentalOnlyInsurance={rentalOnlyInsurance}
        rentalOnlyForecasting={rentalOnlyForecasting}
        rentalOnlyPM={rentalOnlyPM}
        rentalOnlyHOA={rentalOnlyHOA}
        rentalOnlyPMI={rentalOnlyPMI}
        onScrollLeft={() => scrollBoardsPage('left')}
        onScrollRight={() => scrollBoardsPage('right')}
      />

      {/* All Properties and Setup Journey Sections - Carousel */}
      <Box sx={{ position: 'relative', mb: 3 }}>
        {/* Boards Container - Scrollable carousel */}
        <Box
          ref={bottomBoardsRef}
          sx={{
            width: '100%',
            height: 'auto',
            px: { xs: 0, md: 1 },
            ml: { xs: 0, md: -1 },
            overflowX: 'auto',
            overflowY: 'hidden',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            position: 'relative',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {loading && (
            <Box sx={{ display: 'flex', gap: 1.5, pb: 1, boxSizing: 'border-box' }}>
              {/* Skeleton Board 1 */}
              <Paper sx={{ bgcolor: '#fff', borderRadius: 2, py: 1.5, px: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minWidth: '50%', flex: '0 0 50%' }}>
                <Skeleton width={160} height={28} />
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2 }}>
                  <Skeleton variant="circular" width={140} height={140} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton width="100%" height={20} />
                    <Skeleton width="80%" height={16} sx={{ mt: 1 }} />
                    <Skeleton width="60%" height={16} sx={{ mt: 1 }} />
                  </Box>
                </Box>
              </Paper>

              {/* Skeleton Board 2 */}
              <Paper sx={{ bgcolor: '#fff', borderRadius: 2, py: 1.5, px: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minWidth: '50%', flex: '0 0 50%' }}>
                <Skeleton width={180} height={28} />
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2 }}>
                  <Skeleton variant="rectangular" width={220} height={180} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton width="90%" height={18} />
                    <Skeleton width="70%" height={18} sx={{ mt: 1 }} />
                    <Skeleton width="50%" height={18} sx={{ mt: 1 }} />
                  </Box>
                </Box>
              </Paper>

              {/* Skeleton Board 3 */}
              <Paper sx={{ bgcolor: '#fff', borderRadius: 2, py: 1.5, px: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minWidth: '50%', flex: '0 0 50%' }}>
                <Skeleton width={160} height={28} />
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2 }}>
                  <Skeleton variant="circular" width={140} height={140} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton width="100%" height={20} />
                    <Skeleton width="80%" height={16} sx={{ mt: 1 }} />
                    <Skeleton width="60%" height={16} sx={{ mt: 1 }} />
                  </Box>
                </Box>
              </Paper>
            </Box>
          )}
          <Box sx={{ display: loading ? 'none' : 'flex', gap: 1.5, pb: 1, width: '100%' }}>
            {/* All Properties Section */}
            {totalRentalView === 0 ? null : (
            <Box data-board sx={{ bgcolor: '#fff', borderRadius: 2, py: 1.5, px: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minWidth: boardMinWidth, position: 'relative', display: 'flex', flexDirection: 'column', gap: 2, flex: boardFlexValue }}>
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Nunito, Arial, sans-serif' }}>
                All Rental Properties
              </Typography>
              <Button
                variant="outlined"
                size="small"
                sx={{ position: 'absolute', top: 16, right: 16, minWidth: 0, px: 1.2, py: 0.4, fontSize: 12, fontWeight: 400, borderRadius: 2, background: '#fff', border: '1px solid #B0B8C1', color: '#333', boxShadow: 'none', textTransform: 'none', flexShrink: 0, zIndex: 2, '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }}
                onClick={() => {
                  const currentState = allPropertiesPeriod;
                  // Cycle: Monthly -> Yearly -> Actual -> Monthly
                  if (currentState === 'Monthly') {
                    // Monthly -> Yearly: standard animation
                    setAllPropertiesPeriod('Yearly');
                    setAllPropertiesCircleAnimState('to5');
                    setTimeout(() => {
                      setAllPropertiesCircleAnimState('back');
                      setTimeout(() => {
                        setAllPropertiesCircleAnimState('origin');
                      }, 700);
                    }, 700);
                  } else if (currentState === 'Yearly') {
                    // Yearly -> Actual: expand to full, then shrink to reveal 12 segments
                    setAllPropertiesCircleAnimState('toFull');
                    setTimeout(() => {
                      setAllPropertiesCircleAnimState('shrink');
                      setAllPropertiesPeriod('Actual');
                      setTimeout(() => {
                        setAllPropertiesCircleAnimState('origin');
                      }, 700);
                    }, 500);
                  } else {
                    // Actual -> Monthly: expand from zero to cover segments, then shrink to origin
                    setAllPropertiesCircleAnimState('expandFromZero');
                    setTimeout(() => {
                      setAllPropertiesPeriod('Monthly');
                      setAllPropertiesCircleAnimState('shrinkToOrigin');
                      setTimeout(() => {
                        setAllPropertiesCircleAnimState('origin');
                      }, 700);
                    }, 500);
                  }
                }}
              >
                {allPropertiesPeriod === 'Actual' ? 'Actual' : allPropertiesPeriod === 'Yearly' ? 'Yearly' : 'Monthly'}
              </Button>
              {/* Main content row: chart and breakdown */}
              <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%', height: 240, alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                {/* Donut Chart - 45% width, perfectly centered horizontally */}
                <Box sx={{ width: '45%', minWidth: 240, maxWidth: 320, height: 240, mt: -1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', pr: 4 }}>
              <svg width="240" height="240" viewBox="0 0 110 110" style={{ position: 'absolute' }}>
                {/* OUTER CIRCLE - Dynamic Segments (same logic as rental view) */}
                {(() => {
                  // Build segments array from rental-only totals
                  const profit = rentalOnlyIncome - rentalOnlyExpenses;
                  const segments = [
                    { value: profit, color: '#89AE99', label: 'Profit' },
                    { value: rentalOnlyForecasting, color: '#D2794F', label: 'Forecasting/Planning' },
                    { value: rentalOnlyInsurance, color: '#EEB05E', label: 'Taxes/Insurance' },
                    { value: rentalOnlyPM, color: '#B38796', label: 'Property Management' },
                    { value: rentalOnlyMortgage, color: '#E35E61', label: 'Mortgage' },
                    { value: rentalOnlyHOA, color: '#db83ad', label: 'HOA' },
                    { value: rentalOnlyPMI, color: '#C45584', label: 'PMI' },
                  ].filter(seg => seg.value > 0);
                  if (segments.length === 0) {
                    // Show a gray background circle if no segments
                    return (
                      <circle
                        cx="55"
                        cy="55"
                        r="44"
                        fill="none"
                        stroke="#e8e8e8"
                        strokeWidth="6.5"
                        style={{
                          opacity: hoveredSegment?.source === 'all-properties-inner' ? 0.3 : 1,
                          transition: 'opacity 0.2s ease-in-out'
                        }}
                        onMouseEnter={e => {
                          setHoveredSegment({
                            label: 'No Expenses',
                            amount: 0,
                            percent: 0,
                            period: allPropertiesPeriod === 'Yearly' ? 'Yearly' : 'Monthly',
                            x: e.clientX,
                            y: e.clientY,
                            source: 'all-properties',
                            propertyId: 'all-properties',
                          });
                        }}
                        onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                        onMouseLeave={() => setHoveredSegment(null)}
                      />
                    );
                  }
                  // If there's only one segment, draw a full circle (no gap)
                  if (segments.length === 1) {
                    const seg = segments[0];
                    const radiusSingle = 44;
                    const circSingle = 2 * Math.PI * radiusSingle;
                    return (
                      <circle
                        key={seg.label}
                        cx="55"
                        cy="55"
                        r="44"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="6.5"
                        strokeDasharray={circSingle}
                        strokeDashoffset={0}
                        strokeLinecap="butt"
                        transform="rotate(0 55 55)"
                        style={{
                          opacity: hoveredSegment?.source === 'all-properties-inner' ? 0.3 : 1,
                          transition: 'opacity 0.2s ease-in-out'
                        }}
                        onMouseEnter={(e:any) => {
                          const amt = allPropertiesPeriod === 'Yearly' ? seg.value * 12 : seg.value;
                          setHoveredSegment({ label: seg.label, percent: 100, amount: amt, period: allPropertiesPeriod === 'Yearly' ? 'Yearly' : 'Monthly', x: e.clientX, y: e.clientY, source: 'all-properties' });
                        }}
                        onMouseMove={(e:any) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                        onMouseLeave={() => setHoveredSegment(null)}
                      />
                    );
                  }
                  // Sort and order segments as in rental view
                  const sorted = [...segments].sort((a, b) => b.value - a.value);
                  const drawSegments = [];
                  for (let i = 0; i < sorted.length; i += 2) drawSegments.push(sorted[i]);
                  for (let i = sorted.length % 2 === 0 ? sorted.length - 1 : sorted.length - 2; i > 0; i -= 2) drawSegments.push(sorted[i]);
                  const total = segments.reduce((a, b) => a + b.value, 0);
                  const gap = 8;

                  const circumference = 2 * Math.PI * 44;
                  const totalGaps = gap * segments.length;
                  const availableSpace = circumference - totalGaps;
                  // Center biggest segment at 9 o'clock
                  const biggestSegment = drawSegments[0];
                  const biggestPercent = (biggestSegment.value / total) * 100;
                  const biggestDashLength = (biggestPercent / 100) * availableSpace;
                  const angleForBiggest = (biggestDashLength / circumference) * 360;
                  const rotationAngle = 180 - (angleForBiggest / 2);
                  let offset = 0;
                  return drawSegments.map((segment) => {
                    const percent = (segment.value / total) * 100;
                    const dashLength = (percent / 100) * availableSpace;
                    const el = (
                      <circle
                        key={segment.label}
                        cx="55"
                        cy="55"
                        r="44"
                        fill="none"
                        stroke={segment.color}
                        strokeWidth={
                          hoveredSegment?.source === 'all-properties'
                            ? hoveredSegment?.label === segment.label ? "7.5" : "5.5"  // Hovered: thicker, Others: thinner
                            : "6.5"  // Default thickness
                        }
                        strokeDasharray={`${dashLength} ${circumference}`}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        transform={`rotate(${rotationAngle+90} 55 55)`}
                        style={{
                          opacity: hoveredSegment?.source === 'all-properties-inner' ? 0.3 : 
                                  hoveredSegment?.source === 'all-properties' && hoveredSegment?.label !== segment.label ? 0.3 : 1,
                          transition: 'opacity 0.2s ease-in-out, stroke-width 0.2s ease-in-out'
                        }}
                        onMouseEnter={(e:any) => {
                          const amt = allPropertiesPeriod === 'Yearly' ? segment.value * 12 : segment.value;
                          setHoveredSegment({ label: segment.label, percent, amount: amt, period: allPropertiesPeriod === 'Yearly' ? 'Yearly' : 'Monthly', x: e.clientX, y: e.clientY, source: 'all-properties' });
                        }}
                        onMouseMove={(e:any) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                        onMouseLeave={() => setHoveredSegment(null)}
                      />
                    );
                    offset -= (dashLength + gap);
                    return el;
                  });
                })()}
                {/* INNER CIRCLE - 12 segments for Actual mode, equity circle for Monthly/Yearly */}
                {(() => {
                  const animState = allPropertiesCircleAnimState;
                  
                  // 12-segment configuration
                  const segmentCount = 12;
                  const gapAngle = 13;
                  const totalGapAngle = gapAngle * segmentCount;
                  const totalSegmentAngle = 360 - totalGapAngle;
                  const segmentDegrees = totalSegmentAngle / segmentCount;
                  const r = 35;
                  const circ = 2 * Math.PI * r;
                  const segmentLength = (segmentDegrees / 360) * circ;
                  
                  // Show segments during shrink (revealing) or expandFromZero (covering)
                  const showSegments = animState === 'shrink' || animState === 'expandFromZero';
                  
                  // Actual state (no animation): show only 12 segments
                  if (allPropertiesPeriod === 'Actual' && animState === 'origin') {
                    return (
                      <g style={{ opacity: hoveredSegment?.source === 'all-properties' ? 0.3 : 1, transition: 'opacity 0.2s ease-in-out' }}>
                        <TwelveSegmentCircle
                          activeColor="#6A7F91"
                          monthHasData={monthlyRentalHasData}
                          onMouseEnter={(e, idx, name) => {
                            // Use per-month profit sum (only includes properties that have this month filled)
                            setHoveredSegment({ label: name, amount: monthlyRentalHasData[idx] ? monthlyRentalProfits[idx] : -1, percent: -1, period: 'Actual', x: e.clientX, y: e.clientY, source: 'all-properties-inner' });
                          }}
                          onMouseMove={(e) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                          onMouseLeave={() => setHoveredSegment(null)}
                        />
                      </g>
                    );
                  }
                  
                  // Monthly/Yearly/transitioning state: show equity circle with animations
                  const equityRatio = rentalOnlyPrice > 0 ? Math.max(0, Math.min(1, (rentalOnlyPrice - rentalOnlyBalance) / rentalOnlyPrice)) : 0;
                  let filledPercentage = 0;
                  if (typeof totalRentalView === 'number' && totalRentalView === 1 && paidoff) {
                    filledPercentage = 100;
                  } else if (rentalOnlyPrice > 0) {
                    filledPercentage = equityRatio * 100;
                  }
                  const dashLength = (filledPercentage / 100) * circ;
                  const dashGap = circ - dashLength;
                  
                  // Animation state
                  let targetPercent = 5;
                  if (filledPercentage < 5) targetPercent = Math.max(0, filledPercentage / 2);
                  const targetLength = (targetPercent / 100) * circ;
                  const targetGap = circ - targetLength;
                  let animation = '';
                  if (animState === 'to5') animation = 'fillTo5 0.7s ease-in-out forwards';
                  else if (animState === 'back') animation = 'fillBack 0.7s ease-in-out forwards';
                  else if (animState === 'toFull') animation = 'fillToFull 0.5s ease-in-out forwards';
                  else if (animState === 'shrink') animation = 'shrinkToZero 0.7s ease-in-out forwards';
                  else if (animState === 'expandFromZero') animation = 'expandFromZero 0.5s ease-in-out forwards';
                  else if (animState === 'shrinkToOrigin') animation = 'shrinkToOrigin 0.7s ease-in-out forwards';
                  
                  return (
                    <>
                      {/* Show 12 segments during shrink/expand animation - render FIRST so they're underneath */}
                      {showSegments && Array.from({ length: segmentCount }).map((_, i) => {
                        const startAngle = i * (segmentDegrees + gapAngle) - 90;
                        const offset = -(startAngle / 360) * circ;
                        const isInRange = monthlyRentalHasData[i];
                        return (
                          <circle
                            key={`all-properties-shrink-segment-${i}`}
                            cx="55" cy="55" r={r}
                            fill="none"
                            stroke={isInRange ? "#6A7F91" : "#e0e0e0"}
                            strokeWidth="6.5"
                            strokeLinecap="round"
                            strokeDasharray={`${segmentLength} ${circ - segmentLength}`}
                            strokeDashoffset={offset}
                            style={{ pointerEvents: 'none' }}
                          />
                        );
                      })}
                      {/* Background grey circle (Owed) - hide during shrink/expand so segments show through */}
                      {!showSegments && (
                        <circle
                          cx="55"
                          cy="55"
                          r={r}
                          fill="none"
                          stroke="#e8e8e8"
                          strokeWidth="6.5"
                          style={{
                            opacity: hoveredSegment?.source === 'all-properties' ? 0.3 : 1,
                            transition: 'opacity 0.2s ease-in-out'
                          }}
                          onMouseEnter={e => {
                            setHoveredSegment({
                              label: rentalOnlyPrice > 0 ? 'Owed' : 'No rental data',
                              amount: rentalOnlyPrice > 0 ? Math.max(0, rentalOnlyBalance) : 0,
                              percent: rentalOnlyPrice > 0 ? (Math.max(0, rentalOnlyBalance) / rentalOnlyPrice) * 100 : 0,
                              period: allPropertiesPeriod === 'Yearly' ? 'Yearly' : 'Monthly',
                              x: e.clientX,
                              y: e.clientY,
                              source: 'all-properties-inner',
                            });
                          }}
                          onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                          onMouseLeave={() => setHoveredSegment(null)}
                        />
                      )}
                      {/* Progress fill (Paid) - animate during transitions */}
                      {(filledPercentage > 0 || showSegments) && (
                        <circle
                          key={`balance-circle-allproperties-${animState}`}
                          cx="55"
                          cy="55"
                          r={r}
                          fill="none"
                          stroke="#6A7F91"
                          strokeWidth="6.5"
                          strokeDasharray={animState === 'to5' ? `${targetLength} ${targetGap}` : animState === 'toFull' || animState === 'shrink' ? `${circ} 0` : animState === 'expandFromZero' ? `0 ${circ}` : animState === 'shrinkToOrigin' ? `${circ} 0` : `${dashLength} ${dashGap}`}
                          strokeDashoffset={-circ / 4}
                          strokeLinecap="round"
                          transform="rotate(-180 55 55)"
                          style={{
                            animation,
                            '--origin-length': `${dashLength}px`,
                            '--origin-gap': `${dashGap}px`,
                            '--five-length': `${targetLength}px`,
                            '--five-gap': `${targetGap}px`,
                            '--full-length': `${circ}px`,
                            '--full-gap': '0px',
                            opacity: hoveredSegment?.source === 'all-properties' ? 0.3 : 1,
                            transition: 'opacity 0.2s ease-in-out'
                          } as any}
                          onMouseEnter={e => {
                            setHoveredSegment({
                              label: 'Paid',
                              amount: Math.max(0, rentalOnlyPrice - rentalOnlyBalance),
                              period: 'Monthly',
                              percent: rentalOnlyPrice > 0 ? (Math.max(0, rentalOnlyPrice - rentalOnlyBalance) / rentalOnlyPrice) * 100 : 0,
                              x: e.clientX,
                              y: e.clientY,
                              source: 'all-properties-inner',
                            });
                          }}
                          onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                          onMouseLeave={() => setHoveredSegment(null)}
                        />
                      )}
                    </>
                  );
                })()}
                {/* Curved text for equity ratio - hide in Actual mode */}
                {allPropertiesPeriod !== 'Actual' && (
                  <>
                    <defs>
                      <path
                        id="arcPathAllProperties"
                        d="M 32 55 A 23 23 0 0 1 78 55"
                        fill="none"
                      />
                    </defs>
                    <text fill="#999" fontSize="6" textAnchor="middle">
                      <textPath href="#arcPathAllProperties" startOffset="50%">
                        {(() => {
                          const filledRaw = (rentalOnlyPrice - rentalOnlyBalance);
                          const totalRaw = rentalOnlyPrice;
                          if (!totalRaw || isNaN(totalRaw) || totalRaw === 0) return 'N/A';
                          const equityRatio = Math.max(0, Math.min(1, filledRaw / totalRaw));
                          if (equityRatio >= 1) {
                            return `${formatKOrM(totalRaw)}/${formatKOrM(totalRaw)}`;
                          }
                          return `${formatKOrM(filledRaw)}/${formatKOrM(totalRaw)}`;
                        })()}
                      </textPath>
                    </text>
                  </>
                )}
              </svg>
              {/* Center text */}
              <Box sx={{ textAlign: 'center', zIndex: 1, pointerEvents: 'none' }}>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: (() => {
                    // For Actual mode, sum profits only for months that have data
                    let actualSum = 0;
                    for (let m = 0; m < 12; m++) {
                      if (monthlyRentalHasData[m]) {
                        actualSum += monthlyRentalProfits[m];
                      }
                    }
                    const value = allPropertiesPeriod === 'Yearly' ? ((rentalOnlyIncome - rentalOnlyExpenses) * 12) : allPropertiesPeriod === 'Actual' ? actualSum : (rentalOnlyIncome - rentalOnlyExpenses);
                    return value < 0 ? '#E35E61' : '#89AE99';
                  })(), fontFamily: 'Nunito, Arial, sans-serif' }}>
                  {(() => {
                    // For Actual mode, sum profits only for months that have data
                    let actualSum = 0;
                    for (let m = 0; m < 12; m++) {
                      if (monthlyRentalHasData[m]) {
                        actualSum += monthlyRentalProfits[m];
                      }
                    }
                    const value = allPropertiesPeriod === 'Yearly' ? ((rentalOnlyIncome - rentalOnlyExpenses) * 12) : allPropertiesPeriod === 'Actual' ? actualSum : (rentalOnlyIncome - rentalOnlyExpenses);
                    if (
                      value === null ||
                      value === undefined ||
                      isNaN(value) ||
                      (value > -1 && value < 1)
                    ) {
                      return 'N/A';
                    }
                    if (value < 0) {
                      return `-$${Math.abs(Math.round(value)).toLocaleString('en-US')}`;
                    }
                    return `$${Math.round(value).toLocaleString('en-US')}`;
                  })()}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#888', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1 }}>
                  {allPropertiesPeriod === 'Actual' ? 'Year to Date' : allPropertiesPeriod === 'Yearly' ? 'Yearly Profit' : 'Monthly Profit'}
                </Typography>
              </Box>
                </Box>
                {/* Tooltip for all-properties outer circle */}
                <SegmentTooltip data={hoveredSegment} source="all-properties" variant="full" formatAmount={(amt) => `$${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                {/* Tooltip for all-properties inner circle */}
                <SegmentTooltip data={hoveredSegment} source="all-properties-inner" variant="amount-only" formatAmount={(amt) => `$${amt.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
            
                {/* Property Breakdown Details */}
                  {/* Property Breakdown - 55% width, left aligned, vertical center, improved for cutting issue */}
                    <Box sx={{ width: '55%', minWidth: 240, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', mt: 0, height: 300, minHeight: 300, pb: 4, boxSizing: 'border-box' }}>
                      <Box sx={{ width: '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', minHeight: '100%', overflow: 'visible', boxSizing: 'border-box' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, wordBreak: 'break-word', whiteSpace: 'normal', width: '100%' }}>
                          <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mr: 4, width: '100%', maxWidth: '100%', overflowWrap: 'anywhere', wordBreak: 'break-word', pb: 1.5 }}>
                            Global Property Breakdown
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 15, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'normal', width: '100%' }}>
                          <strong>Rental Income:</strong> {allPropertiesPeriod === 'Yearly' ? formatCurrency(Math.round(rentalOnlyIncome * 12), 0) : formatCurrency(Math.round(rentalOnlyIncome), 0)}<br/>
                          <strong style={{ display: 'inline-block', marginBottom: '12px' }}>Expenses:</strong> {allPropertiesPeriod === 'Yearly' ? formatCurrency(Math.round(rentalOnlyExpenses * 12), 0) : formatCurrency(Math.round(rentalOnlyExpenses), 0)}
                          <br style={{ marginBottom: '12px' }} />
                        </Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: { xs: 1.5, sm: 2.5 },
                            alignItems: 'center',
                            justifyContent: { xs: 'center', md: 'flex-start' },
                            width: '100%',
                            py: 0.5
                          }}
                        >
                          {[
                            { color: '#89AE99', label: 'Profit', value: (allPropertiesPeriod === 'Yearly' ? (rentalOnlyIncome-rentalOnlyExpenses)*12 : (rentalOnlyIncome-rentalOnlyExpenses)) },
                            { color: '#D2794F', label: 'Forecasting/Planning', value: (allPropertiesPeriod === 'Yearly' ? rentalOnlyForecasting*12 : rentalOnlyForecasting) },
                            { color: '#EEB05E', label: 'Taxes/Insurance', value: (allPropertiesPeriod === 'Yearly' ? rentalOnlyInsurance*12 : rentalOnlyInsurance) },
                            { color: '#B38796', label: 'Property Management', value: (allPropertiesPeriod === 'Yearly' ? rentalOnlyPM*12 : rentalOnlyPM) },
                            { color: '#E35E61', label: 'Mortgage', value: (allPropertiesPeriod === 'Yearly' ? rentalOnlyMortgage*12 : rentalOnlyMortgage) },
                            { color: '#db83ad', label: 'HOA', value: (allPropertiesPeriod === 'Yearly' ? rentalOnlyHOA*12 : rentalOnlyHOA) },
                            { color: '#C45584', label: 'PMI', value: (allPropertiesPeriod === 'Yearly' ? rentalOnlyPMI*12 : rentalOnlyPMI) },
                          ]
                            .filter(item => item.value !== 0)
                            .map((item, index) => (
                              <Box
                                key={index}
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 0.8,
                                  flexShrink: 0,
                                  minWidth: { xs: '48%', sm: '40%', md: 'auto' },
                                  height: 20
                                }}
                              >
                                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />
                                <Typography
                                  component="span"
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    fontSize: 14,
                                    fontWeight: 550,
                                    color: '#333',
                                    fontFamily: 'Nunito, Arial, sans-serif',
                                    whiteSpace: 'nowrap',
                                    lineHeight: 1
                                  }}
                                >
                                  {item.label}:&nbsp;
                                  <Box component="span" sx={{ fontSize: 14, fontWeight: 400, lineHeight: 1 }}>
                                    {formatCurrency(Math.round(item.value), 0)}
                                  </Box>
                                </Typography>
                              </Box>
                            ))}
                        </Box>
                      </Box>
                    </Box>
              </Box>
            </Box>
          )}

          {/* Setup Journey Section */}
          {(() => {
            const [selectedPropertyIdx, setSelectedPropertyIdx] = React.useState<number|null>(null);
            const [hoveredBarIndex, setHoveredBarIndex] = React.useState<number|null>(null);
            const [hoveredBarTooltip, setHoveredBarTooltip] = React.useState<{ name: string; percent: number } | null>(null);
            const mouseCoords = React.useRef({ x: 0, y: 0 });
            const chartContainerRef = React.useRef<HTMLDivElement>(null);
            
            // Global mouse tracking to fix tooltip freezing on fast mouse exit
            React.useEffect(() => {
              const clearTooltip = () => {
                setHoveredBarIndex(null);
                setHoveredBarTooltip(null);
              };
              
              const handleMouseMove = (e: MouseEvent) => {
                const chartEl = chartContainerRef.current;
                if (!chartEl) return;
                
                // Only check if we have an active tooltip
                if (hoveredBarTooltip === null) return;
                
                const rect = chartEl.getBoundingClientRect();
                const isInside =
                  e.clientX >= rect.left &&
                  e.clientX <= rect.right &&
                  e.clientY >= rect.top &&
                  e.clientY <= rect.bottom;
                
                if (!isInside) {
                  clearTooltip();
                }
              };
              
              const handleBlur = () => {
                clearTooltip();
              };
              
              window.addEventListener('mousemove', handleMouseMove);
              window.addEventListener('blur', handleBlur);
              document.addEventListener('mouseleave', clearTooltip);
              
              return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('blur', handleBlur);
                document.removeEventListener('mouseleave', clearTooltip);
              };
            }, [hoveredBarTooltip]);
            
            const effectiveSelectedIdx = (properties && properties.length === 1) ? 0 : selectedPropertyIdx;
            // Use the same palette as Real Estate Portfolio
            const palette = ['#E35E61','#EEB05E','#D2794F','#B38796','#51BEB4','#89AE99','#658093','#A3C6C4','#F7C873','#B6A6CA','#F6A6B2'];
            if (effectiveSelectedIdx !== null) {
              // Show setup progress screen (static demo)
              const selectedProperty = properties[effectiveSelectedIdx];
              let propertyTitle = 'Setup Journey';
              if (selectedProperty) {
                const name = (selectedProperty.isShared && selectedProperty.alias)
                  ? selectedProperty.alias
                  : (selectedProperty.tag || selectedProperty.alias || 'Property');
                propertyTitle = `${name} Setup Journey`;
              }
              return (
                <Box data-board sx={{ bgcolor: '#fff', borderRadius: 2, py: 1.5, px: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minWidth: boardMinWidth, position: 'relative', display: 'flex', flexDirection: 'column', gap: 2, flex: boardFlexValue }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0 }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>
                      {propertyTitle}
                    </Typography>
                    {(!(properties && properties.length === 1)) && (
                      <Button variant="outlined" size="small" sx={{ minWidth: 0, px: 1.5, py: 0.5, fontSize: 12, fontWeight: 400, borderRadius: 2, background: '#fff', border: '1px solid #B0B8C1', color: '#333', boxShadow: 'none', textTransform: 'none', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }} onClick={() => setSelectedPropertyIdx(null)}>
                        Back
                      </Button>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between', width: '100%', gap: { xs: 3, md: 0 } }}>
                    {/* Task List */}
                    <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex', flexDirection: 'column', gap: 2, mt: 2, mb: { xs: 1, md: 2 } }}>
                      {(() => {
                        const forecasting = selectedProperty?.forecasting || {};
                        const hvacInstall = forecasting.HVAC?.installDate || '';
                        const roofInstall = forecasting.Roof?.installDate || '';
                        const waterInstall = forecasting.WaterHeater?.installDate || '';
                        const hvacDone = typeof hvacInstall === 'string' ? hvacInstall.trim() !== '' : !!hvacInstall;
                        const roofDone = typeof roofInstall === 'string' ? roofInstall.trim() !== '' : !!roofInstall;
                        const waterDone = typeof waterInstall === 'string' ? waterInstall.trim() !== '' : !!waterInstall;
                        const firstDone = hvacDone && roofDone && waterDone;
                        // Determine smoke detector count from inventory string (4th '~' segment)
                        const inventory = selectedProperty?.inventory || [];
                        let smokeValue = '';
                        const invArray = Array.isArray(inventory) ? inventory : Object.values(inventory || {});
                        for (const item of invArray) {
                          if (!item) continue;
                          let str = '';
                          if (typeof item === 'string') str = item;
                          else if (item.name) str = item.name;
                          else if (item.alias) str = item.alias;
                          const low = str.toLowerCase();
                          if (low.includes('smoke')) {
                            smokeValue = str;
                            break;
                          }
                          if (low.includes('co') && low.includes('detector')) {
                            smokeValue = str;
                            break;
                          }
                        }
                        const smokeParts = (smokeValue || '').split('~');
                        const smokeAmount = smokeParts && smokeParts.length >= 4 ? parseInt(smokeParts[3], 10) : 0;
                        const smokeDone = !isNaN(smokeAmount) && smokeAmount > 0;

                        // Air filter: look for "air filter" entry and check 4th '~' segment is non-empty
                        let airFilterValue = '';
                        for (const item of invArray) {
                          if (!item) continue;
                          let str = '';
                          if (typeof item === 'string') str = item;
                          else if (item.name) str = item.name;
                          else if (item.alias) str = item.alias;
                          const low = str.toLowerCase();
                          if (low.includes('air filter')) {
                            airFilterValue = str;
                            break;
                          }
                        }
                        const airParts = (airFilterValue || '').split('~');
                        const airFourth = airParts && airParts.length >= 4 ? (airParts[3] || '').toString().trim() : '';
                        const airFilterDone = airFourth !== '';

                        // Build steps array for new component
                        const steps = [
                          { label: 'Add Roof, HVAC and Water Heater', done: firstDone },
                          { label: 'Add amount of smoke alarms/CO Detectors', done: smokeDone },
                          { label: 'Add HVAC Air Filter Size', done: airFilterDone },
                          { label: (properties && properties.length >= 2) ? 'Add Purchased Price' : 'Add another property', done: (properties && properties.length >= 2) ? (selectedProperty && selectedProperty.price ? parseFloat(String(selectedProperty.price).replace(/[$,]/g, '')) > 0 : false) : false },
                        ];
                        return <HomeSetupJourney steps={steps} />;
                      })()}
                    </Box>
                    {/* Chart */}
                    <Box sx={{ width: { xs: '100%', md: '50%' }, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box sx={{ width: '100%', maxWidth: { xs: 180, sm: 200, md: 230 }, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible', mt: { xs: 2, md: 3 }, mb: { xs: 2, md: 3 } }}>
                        {(() => {
                          const totalTasks = 4;
                          const addAnotherDone = (() => {
                            // If there are 2 or more properties, this task becomes "Add Purchased Price"
                            if (properties && properties.length >= 2) {
                              const priceVal = selectedProperty && selectedProperty.price ? parseFloat(String(selectedProperty.price).replace(/[$,]/g, '')) : 0;
                              return (!isNaN(priceVal) && priceVal > 0) ? 1 : 0;
                            }
                            // Otherwise keep original "Add another property" rule
                            return (properties && properties.length >= 2) ? 1 : 0;
                          })();
                          // Compute completion flags for the selected property
                          let firstDone = false, smokeDone = false, airFilterDone = false;
                          if (selectedProperty) {
                            const forecasting = selectedProperty.forecasting || {};
                            const hvacInstall = forecasting.HVAC?.installDate || '';
                            const roofInstall = forecasting.Roof?.installDate || '';
                            const waterInstall = forecasting.WaterHeater?.installDate || '';
                            const hvacDone = typeof hvacInstall === 'string' ? hvacInstall.trim() !== '' : !!hvacInstall;
                            const roofDone = typeof roofInstall === 'string' ? roofInstall.trim() !== '' : !!roofInstall;
                            const waterDone = typeof waterInstall === 'string' ? waterInstall.trim() !== '' : !!waterInstall;
                            firstDone = hvacDone && roofDone && waterDone;
                            // Smoke detector
                            const inventory = selectedProperty.inventory || [];
                            let smokeValue = '';
                            const invArray = Array.isArray(inventory) ? inventory : Object.values(inventory || {});
                            for (const item of invArray) {
                              if (!item) continue;
                              let str = '';
                              if (typeof item === 'string') str = item;
                              else if (item.name) str = item.name;
                              else if (item.alias) str = item.alias;
                              const low = str.toLowerCase();
                              if (low.includes('smoke')) {
                                smokeValue = str;
                                break;
                              }
                              if (low.includes('co') && low.includes('detector')) {
                                smokeValue = str;
                                break;
                              }
                            }
                            const smokeParts = (smokeValue || '').split('~');
                            const smokeAmount = smokeParts && smokeParts.length >= 4 ? parseInt(smokeParts[3], 10) : 0;
                            smokeDone = !isNaN(smokeAmount) && smokeAmount > 0;
                            // Air filter
                            let airFilterValue = '';
                            for (const item of invArray) {
                              if (!item) continue;
                              let str = '';
                              if (typeof item === 'string') str = item;
                              else if (item.name) str = item.name;
                              else if (item.alias) str = item.alias;
                              const low = str.toLowerCase();
                              if (low.includes('air filter')) {
                                airFilterValue = str;
                                break;
                              }
                            }
                            const airParts = (airFilterValue || '').split('~');
                            const airFourth = airParts && airParts.length >= 4 ? (airParts[3] || '').toString().trim() : '';
                            airFilterDone = airFourth !== '';
                          }
                          const completedCount = (firstDone ? 1 : 0) + (smokeDone ? 1 : 0) + (airFilterDone ? 1 : 0) + addAnotherDone;
                          const percent = Math.round((completedCount / totalTasks) * 100);
                          const radius = 48;
                          const strokeWidth = 10;
                          const circumference = 2 * Math.PI * radius;
                          const dashLength = (percent / 100) * circumference;
                          const dashGap = Math.max(0, circumference - dashLength);
                          // Color system: 25% -> #db8f6c, 50% -> #e2b36e, 75%+ -> #a1b78f
                          let strokeColor = '#db8f6c';
                          if (percent >= 75) strokeColor = '#a1b78f';
                          else if (percent >= 50) strokeColor = '#e2b36e';
                          return (
                            <svg width="100%" height="100%" viewBox="0 0 110 110" style={{ display: 'block', overflow: 'visible' }}>
                              {((percent === null || percent === undefined || isNaN(percent))) ? (
                                <circle cx="55" cy="55" r={radius} fill="none" stroke="#e8e8e8" strokeWidth={strokeWidth} />
                              ) : percent < 1 ? (
                                <>
                                  <circle cx="55" cy="55" r={radius} fill="none" stroke="#e8e8e8" strokeWidth={strokeWidth} />
                                  <circle
                                    cx="55"
                                    cy="55"
                                    r={radius}
                                    fill="none"
                                    stroke="#D36666"
                                    strokeWidth={strokeWidth}
                                    strokeDasharray={`${(0.01 * circumference).toFixed(2)} ${(circumference - 0.01 * circumference).toFixed(2)}`}
                                    strokeDashoffset={-circumference / 4}
                                    strokeLinecap="round"
                                    transform="rotate(-180 55 55)"
                                  />
                                </>
                              ) : (
                                <>
                                  <circle cx="55" cy="55" r={radius} fill="none" stroke="#e8e8e8" strokeWidth={strokeWidth} />
                                  <circle
                                    cx="55"
                                    cy="55"
                                    r={radius}
                                    fill="none"
                                    stroke={strokeColor}
                                    strokeWidth={strokeWidth}
                                    strokeDasharray={`${dashLength} ${dashGap}`}
                                    strokeDashoffset={-circumference / 4}
                                    strokeLinecap="round"
                                    transform="rotate(-180 55 55)"
                                  />
                                </>
                              )}
                              <text x="55" y="61" textAnchor="middle" fontFamily="Nunito, Arial, sans-serif" fontSize="22" fill="#555" fontWeight="400">{(percent === null || percent === undefined || isNaN(percent)) ? 'N/A' : `${Math.round(percent)}%`}</text>
                            </svg>
                          );
                        })()}
                      </Box>
                  </Box>
                </Box>
              </Box>
              );
            }
            // If every property's setup percent is 100, hide the entire Setup Journey board
            const allComplete = (properties && properties.length > 0) ? properties.every((p) => {
              const fc = p.forecasting || {};
              const hvacInstall = fc.HVAC?.installDate || '';
              const roofInstall = fc.Roof?.installDate || '';
              const waterInstall = fc.WaterHeater?.installDate || '';
              const hvacDone = typeof hvacInstall === 'string' ? hvacInstall.trim() !== '' : !!hvacInstall;
              const roofDone = typeof roofInstall === 'string' ? roofInstall.trim() !== '' : !!roofInstall;
              const waterDone = typeof waterInstall === 'string' ? waterInstall.trim() !== '' : !!waterInstall;
              const firstDone = hvacDone && roofDone && waterDone;
              const inventory = p.inventory || [];
              const invArray = Array.isArray(inventory) ? inventory : Object.values(inventory || {});
              let smokeValue = '';
              let airFilterValue = '';
              for (const item of invArray) {
                if (!item) continue;
                let str = '';
                if (typeof item === 'string') str = item;
                else if (item.name) str = item.name;
                else if (item.alias) str = item.alias;
                const low = str.toLowerCase();
                if (!smokeValue && low.includes('smoke')) smokeValue = str;
                if (!airFilterValue && low.includes('air filter')) airFilterValue = str;
                if (smokeValue && airFilterValue) break;
              }
              const smokeParts = (smokeValue || '').split('~');
              const smokeAmount = smokeParts && smokeParts.length >= 4 ? parseInt(smokeParts[3], 10) : 0;
              const smokeDone = !isNaN(smokeAmount) && smokeAmount > 0;
              const airParts = (airFilterValue || '').split('~');
              const airFourth = airParts && airParts.length >= 4 ? (airParts[3] || '').toString().trim() : '';
              const airFilterDone = airFourth !== '';
              const addAnotherDone = (properties && properties.length >= 2) ? 1 : 0;
              const completedCount = (firstDone ? 1 : 0) + (smokeDone ? 1 : 0) + (airFilterDone ? 1 : 0) + addAnotherDone;
              const percent = Math.round((completedCount / 4) * 100);
              return percent === 100;
            }) : false;
            if (allComplete) return null;

            return (
              <Box data-board sx={{ bgcolor: '#fff', borderRadius: 2, py: 1.5, px: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minWidth: boardMinWidth, flex: boardFlexValue }}>
                <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1}}>
                  Setup Journey
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                  {/* Dynamic Setup Tasks List */}
                  <Box sx={{ width: { xs: '100%', md: '50%' }, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.4, mt: 1.5  }}>
                    {(!properties || properties.length === 0) ? (
                      <Typography sx={{ fontSize: 12, color: '#888' }}>No properties found.</Typography>
                    ) : properties.map((p, idx) => {
                      let displayName = p.tag || `Property ${idx+1}`;
                      if (p.isShared && p.alias) {
                        displayName = p.alias;
                      }
                      // compute percent for this property (same rules as chart)
                      const fc = p.forecasting || {};
                      const hvacInstall = fc.HVAC?.installDate || '';
                      const roofInstall = fc.Roof?.installDate || '';
                      const waterInstall = fc.WaterHeater?.installDate || '';
                      const hvacDone = typeof hvacInstall === 'string' ? hvacInstall.trim() !== '' : !!hvacInstall;
                      const roofDone = typeof roofInstall === 'string' ? roofInstall.trim() !== '' : !!roofInstall;
                      const waterDone = typeof waterInstall === 'string' ? waterInstall.trim() !== '' : !!waterInstall;
                      const firstDone = hvacDone && roofDone && waterDone;

                      const inventory = p.inventory || [];
                      const invArray = Array.isArray(inventory) ? inventory : Object.values(inventory || {});
                      let smokeValue = '';
                      let airFilterValue = '';
                      for (const item of invArray) {
                        if (!item) continue;
                        let str = '';
                        if (typeof item === 'string') str = item;
                        else if (item.name) str = item.name;
                        else if (item.alias) str = item.alias;
                        const low = str.toLowerCase();
                        if (!smokeValue && low.includes('smoke')) smokeValue = str;
                        if (!airFilterValue && low.includes('air filter')) airFilterValue = str;
                        if (smokeValue && airFilterValue) break;
                      }
                      const smokeParts = (smokeValue || '').split('~');
                      const smokeAmount = smokeParts && smokeParts.length >= 4 ? parseInt(smokeParts[3], 10) : 0;
                      const smokeDone = !isNaN(smokeAmount) && smokeAmount > 0;
                      const airParts = (airFilterValue || '').split('~');
                      const airFourth = airParts && airParts.length >= 4 ? (airParts[3] || '').toString().trim() : '';
                      const airFilterDone = airFourth !== '';

                      const addAnotherDone = (() => {
                        if (properties && properties.length >= 2) {
                          // For property list when there are 2+ properties, treat this as "Add Purchased Price"
                          const priceVal = p && p.price ? parseFloat(String(p.price).replace(/[$,]/g, '')) : 0;
                          return (!isNaN(priceVal) && priceVal > 0) ? 1 : 0;
                        }
                        return (properties && properties.length >= 2) ? 1 : 0;
                      })();
                      const completedCount = (firstDone ? 1 : 0) + (smokeDone ? 1 : 0) + (airFilterDone ? 1 : 0) + addAnotherDone;
                      const percent = Math.round((completedCount / 4) * 100);

                      const color = palette[idx % palette.length];
                      const clickable = percent < 100;
                      return (
                        <Box
                          key={p.id || idx}
                          sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 24, ml: 2, cursor: clickable ? 'pointer' : 'default' }}
                          onClick={clickable ? () => setSelectedPropertyIdx(idx) : undefined}
                        >
                          <Box sx={{ 
                            width: 14, 
                            height: 14, 
                            borderRadius: '50%', 
                            bgcolor: color, 
                            flexShrink: 0,
                            opacity: hoveredBarIndex !== null && hoveredBarIndex !== idx ? 0.3 : 1,
                            transition: 'opacity 0.2s ease-in-out'
                          }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ 
                              fontSize: 15, 
                              color: '#333', 
                              fontFamily: 'Nunito, Arial, sans-serif', 
                              fontWeight: 700, 
                              wordBreak: 'break-word', 
                              whiteSpace: 'normal', 
                              maxWidth: '100%',
                              opacity: hoveredBarIndex !== null && hoveredBarIndex !== idx ? 0.3 : 1,
                              transition: 'opacity 0.2s ease-in-out',
                              display: 'inline-block',
                              cursor: clickable ? 'pointer' : 'default'
                            }}
                            onMouseEnter={() => setHoveredBarIndex(idx)}
                            onMouseLeave={() => setHoveredBarIndex(null)}
                            >
                              {displayName}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                  {/* Bar Chart using Recharts */}
                  <Box 
                    ref={chartContainerRef}
                    sx={{ width: { xs: '100%', md: '50%' }, height: { xs: 200, sm: 220 }, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', '& svg:focus': { outline: 'none' }, '& *:focus': { outline: 'none' }, '& rect:focus': { outline: 'none' } }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      {(() => {
                        if (!properties || properties.length === 0) return null;
                        // Use the same palette as the property list
                        const barData = properties.map((p, idx) => {
                          // Use alias for shared properties, otherwise use tag or fallback to generic name
                          const name = (p.isShared && p.alias) ? p.alias : (p.tag || p.alias || `Property ${idx+1}`);
                          // Forecasting install dates
                          const fc = p.forecasting || {};
                          const hvacInstall = fc.HVAC?.installDate || '';
                          const roofInstall = fc.Roof?.installDate || '';
                          const waterInstall = fc.WaterHeater?.installDate || '';
                          const hvacDone = typeof hvacInstall === 'string' ? hvacInstall.trim() !== '' : !!hvacInstall;
                          const roofDone = typeof roofInstall === 'string' ? roofInstall.trim() !== '' : !!roofInstall;
                          const waterDone = typeof waterInstall === 'string' ? waterInstall.trim() !== '' : !!waterInstall;
                          const firstDone = hvacDone && roofDone && waterDone;

                          // Inventory parsing (smoke detectors and air filter)
                          const inventory = p.inventory || [];
                          const invArray = Array.isArray(inventory) ? inventory : Object.values(inventory || {});
                          let smokeValue = '';
                          let airFilterValue = '';
                          for (const item of invArray) {
                            if (!item) continue;
                            let str = '';
                            if (typeof item === 'string') str = item;
                            else if (item.name) str = item.name;
                            else if (item.alias) str = item.alias;
                            const low = str.toLowerCase();
                            if (!smokeValue && low.includes('smoke')) smokeValue = str;
                            if (!airFilterValue && low.includes('air filter')) airFilterValue = str;
                            if (smokeValue && airFilterValue) break;
                          }
                          const smokeParts = (smokeValue || '').split('~');
                          const smokeAmount = smokeParts && smokeParts.length >= 4 ? parseInt(smokeParts[3], 10) : 0;
                          const smokeDone = !isNaN(smokeAmount) && smokeAmount > 0;
                          const airParts = (airFilterValue || '').split('~');
                          const airFourth = airParts && airParts.length >= 4 ? (airParts[3] || '').toString().trim() : '';
                          const airFilterDone = airFourth !== '';

                          let addPurchasedPriceDone = 0;
                          if (properties && properties.length >= 2) {
                            const priceVal = p && p.price ? parseFloat(String(p.price).replace(/[$,]/g, '')) : 0;
                            addPurchasedPriceDone = (!isNaN(priceVal) && priceVal > 0) ? 1 : 0;
                          }
                          const completedCount = (firstDone ? 1 : 0) + (smokeDone ? 1 : 0) + (airFilterDone ? 1 : 0) + addPurchasedPriceDone;
                          const actualPercent = Math.round((completedCount / 4) * 100);
                          // Show minimum height for rounded bar visibility (just enough for round effect)
                          // Bar radius is 10px in 220px chart height, so ~5% gives visible rounded ends
                          const minBarPercent = 12;
                          const displayPercent = actualPercent === 0 ? minBarPercent : actualPercent;
                          return {
                            name,
                            value: displayPercent,
                            actualPercent: actualPercent,
                            fill: palette[idx % palette.length],
                          };
                        });
                        return (
                          <div
                          >
                            <BarChart
                              data={barData}
                              margin={{ top: 10, right: 15, left: 0, bottom: 0 }}
                            >
                              <Bar
                                dataKey="value"
                                radius={[10, 10, 10, 10]}
                                isAnimationActive={false}
                                maxBarSize={48}
                                barSize={44}
                                background={{ fill: '#F1F1F1', radius: 10 }}
                              >
                                {barData.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.value > 0 ? entry.fill : 'transparent'}
                                    style={{ 
                                      cursor: entry.actualPercent < 100 ? 'pointer' : 'default',
                                      opacity: hoveredBarIndex !== null && hoveredBarIndex !== index ? 0.3 : 1,
                                      transition: 'opacity 1.2s ease-in-out'
                                    }}
                                    onClick={() => {
                                      if (entry.actualPercent < 100) setSelectedPropertyIdx(index);
                                    }}
                                    onMouseEnter={(e) => {
                                      mouseCoords.current = { x: e.clientX, y: e.clientY };
                                      setHoveredBarIndex(index);
                                      setHoveredBarTooltip({
                                        name: entry.name,
                                        percent: entry.actualPercent
                                      });
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredBarIndex(null);
                                      setHoveredBarTooltip(null);
                                    }}
                                  />
                                ))}
                              </Bar>
                              <XAxis dataKey="name" hide />
                              <YAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={false} />
                            </BarChart>
                          </div>
                        );
                      })()}
                    </ResponsiveContainer>
                  </Box>
                </Box>
                {/* Custom Tooltip - positioned at mouse cursor */}
                {hoveredBarTooltip && (
                  <Box sx={{ 
                    position: 'fixed', 
                    left: `${mouseCoords.current.x + 12}px`, 
                    top: `${mouseCoords.current.y + 8}px`, 
                    zIndex: 1400, 
                    bgcolor: '#fff', 
                    color: '#111', 
                    border: '1px solid rgba(0,0,0,0.08)', 
                    boxShadow: '0 6px 18px rgba(0,0,0,0.12)', 
                    borderRadius: 1, 
                    p: 1.2, 
                    minWidth: 110, 
                    pointerEvents: 'none', 
                    fontFamily: 'Nunito, Arial, sans-serif' 
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: '#1A1A1A', fontWeight: 700, mr: 0.5 }}>
                        {hoveredBarTooltip.name}
                      </Typography>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, color: '#1A1A1A', fontWeight: 400 }}>
                        {Math.round(hoveredBarTooltip.percent)}%
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            );
          })()}


          {/* All Managed Properties Section - Third Board (conditionally rendered) */}
          {pmProperties.length > 0 && (
            <Box data-board sx={{ bgcolor: '#fff', borderRadius: 2, py: 1.5, px: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minWidth: boardMinWidth, flex: boardFlexValue }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>
                  All Managed Properties
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ minWidth: 0, px: 1.2, py: 0.4, fontSize: 12, fontWeight: 400, borderRadius: 2, background: '#fff', border: '1px solid #B0B8C1', color: '#333', boxShadow: 'none', textTransform: 'none', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }}
                  onClick={() => {
                    setAllPropertiesPeriod(prev => prev === 'Monthly' ? 'Yearly' : 'Monthly');
                  }}
                >
                  {allPropertiesPeriod}
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                {/* Responsive, center-aligned chart */}
                <Box sx={{ flexShrink: 0, width: { xs: 220, sm: 260 }, height: { xs: 180, sm: 220 }, minWidth: 220, minHeight: 180, maxWidth: 300, maxHeight: 220, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto' }}>
                  <>
                    <svg width="220" height="220" viewBox="0 0 110 110" style={{ position: 'absolute', pointerEvents: 'auto' }}>
                      {(() => {
                        // Gather PM properties and their amounts
                        const pmProps = pmProperties;
                        const total = pmProps.reduce((sum, p) => sum + (p.rentalRate ? Number(p.rentalRate) : 0), 0);
                        // Use purple for Rental 1 (PM view color: #B38796), rest as before
                        const colors = ['#B38796','#D2794F','#EEB05E','#E35E61','#89AE99','#db83ad','#51BEB4','#C45584'];
                        const radius = 44;
                        const circumference = 2 * Math.PI * radius;
                        let segments = pmProps.map((p, idx) => ({
                          value: p.rentalRate ? Number(p.rentalRate) : 0,
                          color: idx === 0 ? '#B38796' : colors[idx % colors.length],
                          label: p.isShared ? (p.alias || `Property ${idx+1}`) : (p.tag || `Property ${idx+1}`),
                        })).filter(seg => seg.value > 0);
                        if (segments.length === 0) {
                          // Show a gray background circle if no segments
                          return (
                            <circle
                              cx="55"
                              cy="55"
                              r="44"
                              fill="none"
                              stroke="#e8e8e8"
                              strokeWidth={6.5}
                            />
                          );
                        }
                        // If only one property, fill 100% (no gap)
                        if (segments.length === 1) {
                          return [
                            <circle
                              key={segments[0].label}
                              cx="55"
                              cy="55"
                              r="44"
                              fill="none"
                              stroke={segments[0].color}
                              strokeWidth={hoveredSegment?.source === 'pm-summary' && hoveredSegment?.label === segments[0].label ? 7.5 : 6.5}
                              strokeDasharray={`${circumference} 0`}
                              strokeDashoffset={0}
                              strokeLinecap="round"
                              transform="rotate(270 55 55)"
                              style={{
                                pointerEvents: 'auto',
                                opacity: 1,
                                transition: 'opacity 0.2s ease-in-out, stroke-width 0.2s ease-in-out'
                              }}
                              onMouseEnter={(e:any) => {
                                const amt = allPropertiesPeriod === 'Yearly' ? segments[0].value * 12 : segments[0].value;
                                setHoveredSegment({ label: segments[0].label, percent: 100, amount: amt, period: allPropertiesPeriod === 'Yearly' ? 'Yearly' : 'Monthly', x: e.clientX, y: e.clientY, source: 'pm-summary' });
                              }}
                              onMouseMove={(e:any) => {
                                setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)
                              }}
                              onMouseLeave={() => {
                                setHoveredSegment(null)
                              }}
                            />
                          ];
                        }
                        // Otherwise, use gaps as before
                        const gap = 8;
                        const totalGaps = gap * segments.length;
                        const availableSpace = circumference - totalGaps;
                        let offset = 0;
                        return segments.map((segment) => {
                          const percent = total > 0 ? (segment.value / total) * 100 : 0;
                          const dashLength = (percent / 100) * availableSpace;
                          const el = (
                            <circle
                              key={segment.label}
                              cx="55"
                              cy="55"
                              r="44"
                              fill="none"
                              stroke={segment.color}
                              strokeWidth={hoveredSegment?.source === 'pm-summary' && hoveredSegment?.label === segment.label ? 7.5 : hoveredSegment?.source === 'pm-summary' ? 5.5 : 6.5}
                              strokeDasharray={`${dashLength} ${circumference}`}
                              strokeDashoffset={offset}
                              strokeLinecap="round"
                              transform="rotate(270 55 55)"
                              style={{
                                opacity: hoveredSegment?.source === 'pm-summary' && hoveredSegment?.label !== segment.label ? 0.3 : 1,
                                transition: 'opacity 0.2s ease-in-out, stroke-width 0.2s ease-in-out'
                              }}
                              onMouseEnter={(e:any) => {
                                const amt = allPropertiesPeriod === 'Yearly' ? segment.value * 12 : segment.value;
                                setHoveredSegment({ label: segment.label, percent, amount: amt, period: allPropertiesPeriod === 'Yearly' ? 'Yearly' : 'Monthly', x: e.clientX, y: e.clientY, source: 'pm-summary' });
                              }}
                              onMouseMove={(e:any) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                              onMouseLeave={() => setHoveredSegment(null)}
                            />
                          );
                          offset -= (dashLength + gap);
                          return el;
                        });
                      })()}
                    </svg>
                    {/* Tooltip OUTSIDE SVG, at same level as SVG, to match working pattern */}
                    <SegmentTooltip data={hoveredSegment} source="pm-summary" variant="full" />
                  </>
                  <Box sx={{ textAlign: 'center', zIndex: 1, pointerEvents: 'none' }}>
                    <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#89AE99', fontFamily: 'Nunito, Arial, sans-serif' }}>
                      {(() => {
                        // Sum of all PM property management fees for selected period, matching PM view chart's middle number
                        const pmProps = pmProperties;
                        const total = pmProps.reduce((sum, p) => {
                          const rentalRate = p.rentalRate ? Number(p.rentalRate) : 0;
                          let pmRate = 0;
                          if (p.pm_rate) {
                            if (typeof p.pm_rate === 'string') {
                              pmRate = parseFloat(p.pm_rate.replace('%', '')) / 100;
                            } else {
                              pmRate = p.pm_rate / 100;
                            }
                          }
                          let value = 0;
                          if (allPropertiesPeriod === 'Monthly') {
                            value = rentalRate * pmRate;
                          } else if (allPropertiesPeriod === 'Yearly') {
                            value = rentalRate * pmRate * 12;
                          } else {
                            // Actual mode - use monthly value
                            value = rentalRate * pmRate;
                          }
                          return sum + Math.round(value);
                        }, 0);
                        return `$${total.toLocaleString('en-US')}`;
                      })()}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#888', fontFamily: 'Nunito, Arial, sans-serif' }}>
                      Monthly Profit
                    </Typography>
                  </Box>
                </Box>

                {/* Property Manager Breakdown */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}>
                    Property Manager Breakdown
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, maxHeight: 200, overflowY: 'auto' }}>
                    {(() => {
                      const colors = ['#89AE99','#D2794F','#EEB05E','#E35E61','#B38796','#db83ad','#51BEB4','#C45584'];
                      return pmProperties.map((prop, idx) => (
                        <Box key={prop.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {/* Colored circle - single, not cut off. Rental 1 is purple (#B38796) */}
                            <span style={{
                              display: 'inline-block',
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              backgroundColor: idx === 0 ? '#B38796' : colors[idx % colors.length],
                              marginRight: 2,
                              verticalAlign: 'middle',
                              boxSizing: 'border-box',
                            }} />
                            <Typography sx={{ fontSize: 15, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 600, pl: 1.5, display: 'inline-block' }}>
                              {`Rental ${idx + 1}:`}
                              <span style={{ paddingLeft: 10, fontSize: 13, fontWeight: 400, color: '#666', display: 'inline-block', verticalAlign: 'middle' }}>
                                {/* Show alias name as main label instead of address/propertyName */}
                                {(() => {
                                  let alias = '';
                                  if (Array.isArray(prop.sharedWith)) {
                                    const entry = prop.sharedWith.find(sw => sw && sw.role && (sw.role === 'PM' || sw.role === 'Property Manager'));
                                    if (entry && entry.alias) alias = entry.alias;
                                  }
                                  return alias ? <span style={{ fontSize: 13, fontWeight: 400, color: '#666' }}>{alias}</span> : <span style={{ fontSize: 13, fontWeight: 400, color: '#666' }}>{prop.propertyName || prop.tag || 'Property'}</span>;
                                })()}
                              </span>
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: 13, color: '#333', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 600 }}>
                            {(() => {
                              // PM view chart's middle number: rentalRate * pm_rate, but period can be Monthly/Yearly/Lease
                              const rentalRate = prop.rentalRate ? Number(prop.rentalRate) : 0;
                              let pmRate = 0;
                              if (prop.pm_rate) {
                                if (typeof prop.pm_rate === 'string') {
                                  pmRate = parseFloat(prop.pm_rate.replace('%', '')) / 100;
                                } else {
                                  pmRate = prop.pm_rate / 100;
                                }
                              }
                              let value = 0;
                              if (allPropertiesPeriod === 'Monthly') {
                                value = rentalRate * pmRate;
                              } else if (allPropertiesPeriod === 'Yearly') {
                                value = rentalRate * pmRate * 12;
                              } else {
                                // Actual mode - use monthly value
                                value = rentalRate * pmRate;
                              }
                              return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
                            })()}
                          </Typography>
                        </Box>
                      ));
                    })()}
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          {/* Real Estate Portfolio Board */}
          {(() => {
            // Check if there are eligible properties for portfolio
            const auth = getAuth();
            const user = auth.currentUser;
            const portfolioFiltered = (properties || []).filter(p => {
              if (!user) return false;
              if (p.ownerId === user.uid) return true;
              if (Array.isArray(p.sharedWith)) {
                const entry = p.sharedWith.find((sw: any) => sw.userId === user.uid);
                if (entry && entry.role !== 'PM' && entry.role !== 'Property Manager' && entry.role !== 'Friend' && entry.role !== 'Friend Manager') return true;
              }
              return false;
            });
            // Hide board if no eligible properties
            if (portfolioFiltered.length === 0) return null;
            return (
          <Box data-board sx={{ bgcolor: '#fff', borderRadius: 2, py: 1.5, px: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minWidth: boardMinWidth, position: 'relative', display: 'flex', flexDirection: 'column', gap: 2, flex: boardFlexValue }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Nunito, Arial, sans-serif', textAlign: 'left' }}>
              Real Estate Portfolio
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 2.5, sm: 3, md: 4 }, alignItems: { xs: 'center', md: 'flex-start' }, justifyContent: 'center', width: '100%' }}>
              {/* Responsive Donut Chart (All Properties Section Style) */}
              {(() => {
                // Calculate portfolio-wide segment totals
                const auth = getAuth();
                const user = auth.currentUser;
                const filtered = (properties || []).filter(p => {
                  if (!user) return false;
                  if (p.ownerId === user.uid) return true;
                  if (Array.isArray(p.sharedWith)) {
                    const entry = p.sharedWith.find((sw: any) => sw.userId === user.uid);
                    if (entry && entry.role !== 'PM' && entry.role !== 'Property Manager' && entry.role !== 'Friend' && entry.role !== 'Friend Manager') return true;
                  }
                  return false;
                });
                // Assign colors
                const palette = ['#E35E61','#EEB05E','#D2794F','#B38796','#51BEB4','#89AE99','#658093','#A3C6C4','#F7C873','#B6A6CA','#F6A6B2'];
                // Calculate total assets and what you owe
                let totalAssets = 0;
                let totalOwe = 0;
                let totalPrice = 0;
                let totalBalance = 0;
                filtered.forEach((p, i) => {
                  const asset = p.estimatedValue ? parseFloat(p.estimatedValue as any) : 0;
                  const owe = p.balance ? parseFloat(p.balance as any) : 0;
                  const price = p.price ? parseFloat(p.price as any) : 0;
                  const balance = p.balance ? parseFloat(p.balance as any) : 0;
                  totalAssets += asset;
                  totalOwe += owe;
                  totalPrice += price;
                  totalBalance += balance;
                  // Use alias for shared property, otherwise propertyName
                  let displayName = p.tag || `House ${i+1}`;
                  if (p.isShared && p.alias) {
                    displayName = p.alias;
                  }
                  return {
                    name: displayName,
                    estimate: asset,
                    color: palette[i % palette.length],
                  };
                });
                return (
                  <Box sx={{ mt: -1, position: 'relative', width: { xs: 180, sm: 200, md: 240 }, height: { xs: 180, sm: 200, md: 240 }, minWidth: { xs: 180, sm: 200, md: 240 }, minHeight: { xs: 180, sm: 200, md: 240 }, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', flexShrink: 0 }}>
                    <svg width="100%" height="100%" viewBox="0 0 110 110" style={{ position: 'absolute' }}>
                      {/* OUTER CIRCLE - Dynamic Segments (All Properties logic) */}
                        // Use asset values per property for segments
                      {(() => {
                        const palette = ['#E35E61','#EEB05E','#D2794F','#B38796','#51BEB4','#89AE99','#658093','#A3C6C4','#F7C873','#B6A6CA','#F6A6B2'];
                        const segments = filtered.map((p, i) => {
                          const displayName = (p.isShared && p.alias) ? p.alias : (p.tag || p.propertyName || `Property ${i+1}`);
                          return ({
                            value: p.estimatedValue ? parseFloat(p.estimatedValue as any) : 0,
                            color: palette[i % palette.length],
                            label: displayName
                          });
                        }).filter(seg => seg.value > 0);
                        if (segments.length === 0) return null;
                        const radius = 44;
                        const circumference = 2 * Math.PI * radius;
                        if (segments.length === 1) {
                          // Draw a full circle, no gap, no rounded ends
                          return (
                            <circle
                              key={segments[0].label}
                              cx="55"
                              cy="55"
                              r="44"
                              fill="none"
                              stroke={segments[0].color}
                              strokeWidth={
                                hoveredSegment?.source === 'portfolio'
                                  ? hoveredSegment?.label === segments[0].label ? "7.5" : "5.5"  // Hovered: thicker, Others: thinner
                                  : "6.5"  // Default thickness
                              }
                              strokeDasharray={circumference}
                              strokeDashoffset={0}
                              strokeLinecap="butt"
                              transform="rotate(0 55 55)"
                              style={{
                                opacity: hoveredSegment?.source === 'portfolio-inner' ? 0.3 : 1,
                                transition: 'opacity 0.2s ease-in-out, stroke-width 0.2s ease-in-out'
                              }}
                              onMouseEnter={(e:any) => {
                                const amt = segments[0].value;
                                setHoveredSegment({ label: segments[0].label, percent: 100, amount: amt, period: allPropertiesPeriod === 'Yearly' ? 'Yearly' : 'Monthly', x: e.clientX, y: e.clientY, source: 'portfolio' });
                              }}
                              onMouseMove={(e:any) => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                              onMouseLeave={() => setHoveredSegment(null)}
                            />
                          );
                        }
                        // Sort and order segments as in rental view
                        const sorted = [...segments].sort((a, b) => b.value - a.value);
                        const drawSegments = [];
                        for (let i = 0; i < sorted.length; i += 2) drawSegments.push(sorted[i]);
                        for (let i = sorted.length % 2 === 0 ? sorted.length - 1 : sorted.length - 2; i > 0; i -= 2) drawSegments.push(sorted[i]);
                        const total = segments.reduce((a, b) => a + b.value, 0);
                        const gap = 8;
                        const totalGaps = gap * segments.length;
                        const availableSpace = circumference - totalGaps;
                        // Center biggest segment at 9 o'clock
                        const biggestSegment = drawSegments[0];
                        const biggestPercent = (biggestSegment.value / total) * 100;
                        const biggestDashLength = (biggestPercent / 100) * availableSpace;
                        const angleForBiggest = (biggestDashLength / circumference) * 360;
                        const rotationAngle = 180 - (angleForBiggest / 2);
                        let offset = 0;
                        return drawSegments.map((segment) => {
                          const percent = (segment.value / total) * 100;
                          const dashLength = (percent / 100) * availableSpace;
                          const el = (
                            <circle
                              key={segment.label}
                              cx="55"
                              cy="55"
                              r="44"
                              fill="none"
                              stroke={segment.color}
                              strokeWidth={
                                hoveredSegment?.source === 'portfolio'
                                  ? hoveredSegment?.label === segment.label ? "7.5" : "5.5"  // Hovered: thicker, Others: thinner
                                  : "6.5"  // Default thickness
                              }
                              strokeDasharray={`${dashLength} ${circumference}`}
                              strokeDashoffset={offset}
                              strokeLinecap="round"
                              transform={`rotate(${rotationAngle+90} 55 55)`}
                              style={{
                                opacity: hoveredSegment?.source === 'portfolio-inner' ? 0.3 : 
                                        hoveredSegment?.source === 'portfolio' && hoveredSegment?.label !== segment.label ? 0.3 : 1,
                                transition: 'opacity 0.2s ease-in-out, stroke-width 0.2s ease-in-out'
                              }}
                              onMouseEnter={(e:any) => {
                                const amt = segment.value;
                                setHoveredSegment({ label: segment.label, percent, amount: amt, period: 'Monthly', x: e.clientX, y: e.clientY, source: 'portfolio' });
                              }}
                              onMouseMove={(e:any)=> setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                              onMouseLeave={() => setHoveredSegment(null)}
                            />
                          );
                          offset -= (dashLength + gap);
                          return el;
                        });
                      })()}
                      {/* INNER CIRCLE - Portfolio Equity Ratio */}
                      <circle
                        cx="55"
                        cy="55"
                        r={35}
                        fill="none"
                        stroke="#e8e8e8"
                        strokeWidth="6.5"
                        style={{
                          opacity: hoveredSegment?.source === 'portfolio' ? 0.3 : 1,
                          transition: 'opacity 0.2s ease-in-out'
                        }}
                        onMouseEnter={e => {
                          setHoveredSegment({
                            label: 'Owed',
                            amount: Math.max(0, totalBalance),
                            percent: totalPrice > 0 ? (Math.max(0, totalBalance) / totalPrice) * 100 : 0,
                            period: 'Monthly',
                            x: e.clientX,
                            y: e.clientY,
                            source: 'portfolio-inner',
                          });
                        }}
                        onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                        onMouseLeave={() => setHoveredSegment(null)}
                      />
                      {(() => {
                        const radius = 35;
                        const circumference = 2 * Math.PI * radius;
                        // totalPrice = total purchase price, totalBalance = what you still owe
                        // filledPercentage should show equity (how much you've paid off)
                        const equity = Math.max(0, totalPrice - totalBalance);
                        let filledPercentage = 0;
                        if (totalPrice > 0) {
                          filledPercentage = Math.max(0, Math.min(100, (equity / totalPrice) * 100));
                        }
                        const dashLength = (filledPercentage / 100) * circumference;
                        const dashGap = circumference - dashLength;

                        // No animation for portfolio
                        if (filledPercentage === 0) return null;
                        return (
                          <>
                            <circle
                              key={`balance-circle-portfolio`}
                              cx="55"
                              cy="55"
                              r="35"
                              fill="none"
                              stroke="#6A7F91"
                              strokeWidth="6.5"
                              strokeDasharray={`${dashLength} ${dashGap}`}
                              strokeDashoffset={-circumference / 4}
                              strokeLinecap="round"
                              transform="rotate(-180 55 55)"
                              style={{
                                opacity: hoveredSegment?.source === 'portfolio' ? 0.3 : 1,
                                transition: 'opacity 0.2s ease-in-out'
                              }}
                              onMouseEnter={e => {
                                setHoveredSegment({
                                  label: 'Paid',
                                  amount: Math.max(0, totalPrice - totalBalance),
                                  period: 'Monthly',
                                  percent: totalPrice > 0 ? (Math.max(0, totalPrice - totalBalance) / totalPrice) * 100 : 0,
                                  x: e.clientX,
                                  y: e.clientY,
                                  source: 'portfolio-inner',
                                });
                              }}
                              onMouseMove={e => setHoveredSegment(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                              onMouseLeave={() => setHoveredSegment(null)}
                            />
                            <defs>
                              <path
                                id="arcPathPortfolio"
                                d="M 32 55 A 23 23 0 0 1 78 55"
                                fill="none"
                              />
                            </defs>
                            <text fill="#999" fontSize="6" textAnchor="middle">
                              <textPath href="#arcPathPortfolio" startOffset="50%">
                                {(() => {
                                  // Show paid amount (equity) / total purchase price
                                  const paidRaw = Math.max(0, totalPrice - totalBalance);
                                  const totalRaw = totalPrice;
                                  let paid, total, paidSuffix, totalSuffix;
                                  if (!totalRaw || isNaN(totalRaw) || totalRaw === 0) return 'N/A';
                                  if (totalRaw >= 1_000_000) {
                                    total = (totalRaw / 1_000_000).toFixed(2).replace(/\.00$/, '');
                                    totalSuffix = 'M';
                                  } else {
                                    total = Math.round(totalRaw / 1000);
                                    totalSuffix = 'K';
                                  }
                                  if (paidRaw >= 1_000_000) {
                                    paid = (paidRaw / 1_000_000).toFixed(2).replace(/\.00$/, '');
                                    paidSuffix = 'M';
                                  } else {
                                    paid = Math.round(paidRaw / 1000);
                                    paidSuffix = 'K';
                                  }
                                  return `${paid}${paidSuffix}/${total}${totalSuffix}`;
                                })()}
                              </textPath>
                            </text>
                          </>
                        );
                      })()}
                    </svg>
                    {/* Center Net Wealth Value */}
                    <Box sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#89AE99', fontFamily: 'Nunito, Arial, sans-serif' }}>
                        {(() => {
                          const net = (totalAssets - totalOwe) || 0;
                          const abs = Math.floor(Math.abs(net)).toLocaleString('en-US');
                          return net < 0 ? `-$${abs}` : `$${abs}`;
                        })()}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: '#888', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400 }}>
                        Net Wealth
                      </Typography>
                    </Box>
                    {/* Tooltip for portfolio outer circle */}
                    <SegmentTooltip data={hoveredSegment} source="portfolio" variant="percent-amount" />
                    {/* Tooltip for portfolio inner circle */}
                    <SegmentTooltip data={hoveredSegment} source="portfolio-inner" variant="amount-only" formatAmount={(amt) => `$${amt.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
                  </Box>
                );
              })()}
              {/* Net Wealth Breakdown */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: { xs: '100%', sm: 220 }, maxWidth: { xs: '100%', sm: 320, md: 360 }, alignItems: { xs: 'center', md: 'flex-start' }, justifyContent: 'center', overflow: 'hidden' }}>
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#111', fontFamily: 'Nunito, Arial, sans-serif', mb: 1, textAlign: { xs: 'center', md: 'left' } }}>
                  Net Wealth Breakdown
                </Typography>
                {(() => {
                  // Get current user
                  const auth = getAuth();
                  const user = auth.currentUser;
                  // Filter properties: owned or co-owned (not PM, not Friend)
                  const filtered = (properties || []).filter(p => {
                    if (!user) return false;
                    if (p.ownerId === user.uid) return true;
                    if (Array.isArray(p.sharedWith)) {
                      const entry = p.sharedWith.find((sw: any) => sw.userId === user.uid);
                      if (entry && entry.role !== 'PM' && entry.role !== 'Property Manager' && entry.role !== 'Friend' && entry.role !== 'Friend Manager') return true;
                    }
                    return false;
                  });
                  // Assign colors
                  const palette = ['#E35E61','#EEB05E','#D2794F','#B38796','#51BEB4','#89AE99','#658093','#A3C6C4','#F7C873','#B6A6CA','#F6A6B2'];
                  // Calculate total assets and what you owe
                  let totalAssets = 0;
                  let totalOwe = 0;
                  const items = filtered.map((p, i) => {
                    const asset = p.estimatedValue ? parseFloat(p.estimatedValue as any) : 0;
                    const owe = p.balance ? parseFloat(p.balance as any) : 0;
                    totalAssets += asset;
                    totalOwe += owe;
                    // Use alias for shared property, otherwise propertyName
                    let displayName = p.tag || `House ${i+1}`;
                    if (p.isShared && p.alias) {
                      displayName = p.alias;
                    }
                    return {
                      name: displayName,
                      estimate: asset,
                      color: palette[i % palette.length],
                    };
                  });
                  return (
                    <Box sx={{ width: '100%', maxWidth: { xs: 300, sm: 320, md: 340 }, display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                      {/* Shared value column for perfect right alignment */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: { xs: 14, md: 15 }, fontWeight: 700, color: '#222', minWidth: { xs: 100, md: 110 }, fontFamily: 'Nunito, Arial, sans-serif' }}>
                          Total Assets:
                        </Typography>
                        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                          <Typography sx={{ fontSize: { xs: 13, md: 15 }, fontWeight: 400, color: '#222', minWidth: { xs: 80, md: 90 }, maxWidth: { xs: 120, md: 130 }, textAlign: 'right', fontFamily: 'Nunito, Arial, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {`$${totalAssets.toLocaleString('en-US')}`}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: { xs: 14, md: 15 }, fontWeight: 700, color: '#222', minWidth: { xs: 100, md: 110 }, fontFamily: 'Nunito, Arial, sans-serif' }}>
                          What You Owe:
                        </Typography>
                        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                          <Typography sx={{ fontSize: { xs: 13, md: 15 }, fontWeight: 400, color: '#222', minWidth: { xs: 80, md: 90 }, maxWidth: { xs: 120, md: 130 }, textAlign: 'right', fontFamily: 'Nunito, Arial, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {`$${totalOwe.toLocaleString('en-US')}`}
                          </Typography>
                        </Box>
                      </Box>
                      {/* Property values, perfectly aligned with above */}
                      {items.map((item, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, width: '100%' }}>
                          <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: item.color, flexShrink: 0, mr: 1 }} />
                          <Typography sx={{ fontSize: { xs: 14, md: 15 }, color: '#222', fontFamily: 'Nunito, Arial, sans-serif', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}:
                          </Typography>
                          <Box sx={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                            <Typography sx={{ fontSize: { xs: 13, md: 15 }, color: '#222', fontWeight: 400, minWidth: { xs: 80, md: 90 }, maxWidth: { xs: 120, md: 130 }, textAlign: 'right', fontFamily: 'Nunito, Arial, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {typeof item.estimate === 'number' && !isNaN(item.estimate) ? `$${item.estimate.toLocaleString('en-US')}` : '$0'}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  );
                })()}
              </Box>
            </Box>
          </Box>
            );
          })()}

          {/* Property Tag Leaderboard Board - One at a time with navigation */}
          {(() => {
            const propertyList = properties || [];
            const leaderboardProps = propertyList
              .map((property, idx) => ({
                property,
                propertyName: (property.isShared && (property.alias || property.alias))
                  ? (property.alias || property.alias)
                  : (property.tag || property.propertyName || `Property ${idx + 1}`)
              }))
              .filter(item => Array.isArray(item.property.sharedWith) && item.property.sharedWith.length >= 2);
            const [leaderboardMembers, setLeaderboardMembers] = React.useState<{ [propertyId: string]: any[] }>({});
            const [selectedLeaderboardIdx, setSelectedLeaderboardIdx] = React.useState(0);
            React.useEffect(() => {
              async function fetchAllMembers() {
                const membersMap: { [propertyId: string]: any[] } = {};
                for (const item of leaderboardProps) {
                  const sharedWith = Array.isArray(item.property.sharedWith) ? item.property.sharedWith : [];
                  const userIds = sharedWith.map((sw: any) => sw.userId).filter(Boolean);
                  // Always include ownerId
                  const ownerId = item.property.ownerId;
                  const allUserIds = ownerId ? Array.from(new Set([ownerId, ...userIds])) : userIds;
                  if (allUserIds.length === 0) {
                    membersMap[item.property.id] = [];
                    continue;
                  }
                  // Fetch user info for all members (owner + shared)
                  const userQuery = query(collection(db, "users"), where("uid", "in", allUserIds));
                  const userSnap = await getDocs(userQuery);
                  const userMap: { [uid: string]: any } = {};
                  userSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    const key = (data && data.uid) ? data.uid : docSnap.id;
                    userMap[key] = data;
                  });
                  // Fetch completed tasks for this property (status === 'completed')
                  const tasksQuery = query(collection(db, "tasks"), where("propertyId", "==", item.property.id), where("status", "==", "completed"));
                  const tasksSnap = await getDocs(tasksQuery);
                  const completedByCount: { [userId: string]: number } = {};
                  const completedByTasks: { [userId: string]: string[] } = {};
                  tasksSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.completedBy) {
                      completedByCount[data.completedBy] = (completedByCount[data.completedBy] || 0) + 1;
                      if (!completedByTasks[data.completedBy]) completedByTasks[data.completedBy] = [];
                      const taskTitle = data.title || data.name;
                      if (taskTitle) completedByTasks[data.completedBy].push(taskTitle);
                    }
                  });
                  // Build members array: owner first, then others (excluding duplicates)
                  // Role priority: Co-owner > Family Manager > PM > Friend
                  const rolePriority: Record<string, number> = {
                    'Co-owner': 4,
                    'Family Manager': 3,
                    'PM': 2,
                    'Property Manager': 2,
                    'Friend': 1,
                    'Friend Manager': 1
                  };
                  // Build a map of userId to best sharedWith entry
                  const uniqueMembers: Record<string, any> = {};
                  for (const sw of sharedWith) {
                    if (!sw.userId) continue;
                    const prev = uniqueMembers[sw.userId];
                    const currPriority = rolePriority[sw.role] || 0;
                    const prevPriority = prev ? (rolePriority[prev.role] || 0) : -1;
                    if (!prev || currPriority > prevPriority) {
                      uniqueMembers[sw.userId] = sw;
                    }
                  }
                  // Add owner first if present
                  // Build all members (owner + unique shared), then sort by completedTasks
                  const allMembers: any[] = [];
                  if (ownerId && userMap[ownerId]) {
                    const ownerUser = userMap[ownerId];
                    let name = ownerUser.displayName || ownerUser.name || 'Owner';
                    let photoUrl = ownerUser.photoURL || ownerUser.avatarUrl || '';
                    let completedTasks = completedByCount[ownerId] || 0;
                    allMembers.push({ name, photoUrl, completedTasks, isOwner: true, userId: ownerId, tasksList: completedByTasks[ownerId] || [] });
                  }
                  Object.entries(uniqueMembers)
                    .filter(([userId]) => userId !== ownerId)
                    .forEach(([userId, sw]) => {
                      const user = userMap[userId] || {};
                      let name = user.displayName || user.name || sw.displayName || sw.name || '';
                      let photoUrl = user.photoURL || user.avatarUrl || sw.photoUrl || sw.photoURL || '';
                      let completedTasks = completedByCount[userId] || 0;
                      allMembers.push({ name, photoUrl, completedTasks, role: sw.role, userId, tasksList: completedByTasks[userId] || [] });
                    });
                  allMembers.sort((a, b) => b.completedTasks - a.completedTasks);
                  membersMap[item.property.id] = allMembers;
                }
                setLeaderboardMembers(membersMap);
              }
              fetchAllMembers();
            }, [JSON.stringify(leaderboardProps)]);
            if (!leaderboardProps.length) return null;
            const leaderboardItem = leaderboardProps[selectedLeaderboardIdx];
            const sharedMembers = leaderboardMembers[leaderboardItem.property.id] || [];
            // tooltip state for leaderboard (hooks declared at component top-level)
            // Show unique shared member count (excluding owner)
            return (
              <Box data-board sx={{ bgcolor: '#fff', borderRadius: 2, py: 1.5, px: { xs: 3, md: 3 }, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minWidth: boardMinWidth, flex: boardFlexValue }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
                  <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#222', fontFamily: 'Nunito, Arial, sans-serif', textAlign: { xs: 'center', sm: 'left' } }}>
                    {leaderboardItem.propertyName} Leaderboard
                  </Typography>
                  {leaderboardProps.length > 1 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => setSelectedLeaderboardIdx(idx => idx === 0 ? leaderboardProps.length - 1 : idx - 1)}
                        sx={{ borderRadius: 2, bgcolor: '#f5f5f5', ml: 1 }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6l-6 6 6 6" stroke="#212121" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => setSelectedLeaderboardIdx(idx => idx === leaderboardProps.length - 1 ? 0 : idx + 1)}
                        sx={{ borderRadius: 2, bgcolor: '#f5f5f5' }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6l6 6-6 6" stroke="#212121" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </IconButton>
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 2 }}>
                  {sharedMembers.map((item, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <Box
                        sx={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#eee' }}
                        onMouseEnter={async (e: any) => {
                          const clientX = e.clientX;
                          const clientY = e.clientY;
                          const uid = (item as any).userId;
                          setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: null, loading: true, anchor: 'avatar' });
                          if (uid) {
                            const cacheKey = `${leaderboardItem.property.id}::${uid}`;
                            const preTasks = (item as any).tasksList;
                            if (preTasks && Array.isArray(preTasks)) {
                              setLeaderTasksCache(prev => ({ ...prev, [cacheKey]: preTasks }));
                              setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: preTasks, loading: false, anchor: 'avatar' });
                            } else if (leaderTasksCache[cacheKey]) {
                              setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: leaderTasksCache[cacheKey], loading: false, anchor: 'avatar' });
                            } else {
                              try {
                                const tasksQuery = query(collection(db, "tasks"), where("propertyId", "==", leaderboardItem.property.id), where("status", "==", "completed"), where("completedBy", "==", uid));
                                const snap = await getDocs(tasksQuery);
                                const tasks: string[] = [];
                                snap.forEach(ds => { const d = ds.data(); const title = d.title || d.name; if (title) tasks.push(title); });
                                setLeaderTasksCache(prev => ({ ...prev, [cacheKey]: tasks }));
                                setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks, loading: false, anchor: 'avatar' });
                              } catch (err) {
                                setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: [], loading: false, anchor: 'avatar' });
                              }
                            }
                          } else {
                            setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: [], loading: false, anchor: 'avatar' });
                          }
                        }}
                        onMouseMove={(e:any)=> hoveredLeader && setHoveredLeader(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                        onMouseLeave={() => setHoveredLeader(null)}
                      >
                        {item.photoUrl ? (
                          <img src={item.photoUrl} alt={item.name} style={{ width: 40, height: 40, objectFit: 'cover' }} />
                        ) : (
                          <Typography sx={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
                            {item.name ? item.name.charAt(0) : '?'}
                          </Typography>
                        )}
                      </Box>
                      <Typography sx={{ fontSize: 18, fontWeight: 400, color: '#222', fontFamily: 'Nunito, Arial, sans-serif', flex: 1, minWidth: 140 }}>
                        <Box component="span" sx={{ display: 'inline-block' }}
                          onMouseEnter={async (e: any) => {
                            const clientX = e.clientX;
                            const clientY = e.clientY;
                            const uid = (item as any).userId;
                            const cacheKey = `${leaderboardItem.property.id}::${uid}`;
                            const preTasks = (item as any).tasksList;
                            setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: null, loading: true, anchor: 'name' });
                              if (uid) {
                                if (preTasks && Array.isArray(preTasks)) {
                                  setLeaderTasksCache(prev => ({ ...prev, [cacheKey]: preTasks }));
                                  setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: preTasks, loading: false, anchor: 'name' });
                                } else if (leaderTasksCache[cacheKey]) {
                                  setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: leaderTasksCache[cacheKey], loading: false, anchor: 'name' });
                                } else {
                                  try {
                                    const tasksQuery = query(collection(db, "tasks"), where("propertyId", "==", leaderboardItem.property.id), where("status", "==", "completed"), where("completedBy", "==", uid));
                                    const snap = await getDocs(tasksQuery);
                                    const tasks: string[] = [];
                                    snap.forEach(ds => { const d = ds.data(); const title = d.title || d.name; if (title) tasks.push(title); });
                                    setLeaderTasksCache(prev => ({ ...prev, [cacheKey]: tasks }));
                                    setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks, loading: false, anchor: 'name' });
                                  } catch (err) {
                                    setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: [], loading: false, anchor: 'name' });
                                  }
                                }
                              } else {
                                setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: [], loading: false, anchor: 'name' });
                              }
                          }}
                          onMouseMove={(e: any) => hoveredLeader && setHoveredLeader(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                          onMouseLeave={() => setHoveredLeader(null)}
                        >{item.name}</Box>
                      </Typography>
                      <Typography
                        sx={{ fontSize: 14, color: '#888', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 600, textAlign: 'right', minWidth: 140 }}
                        onMouseEnter={async (e:any) => {
                          const clientX = e.clientX;
                          const clientY = e.clientY;
                          const uid = (item as any).userId;
                          const cacheKey = `${leaderboardItem.property.id}::${uid}`;
                          const preTasks = (item as any).tasksList;
                          setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: null, loading: true, anchor: 'count' });
                          if (uid) {
                            if (preTasks && Array.isArray(preTasks)) {
                              setLeaderTasksCache(prev => ({ ...prev, [cacheKey]: preTasks }));
                              setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: preTasks, loading: false, anchor: 'count' });
                            } else if (leaderTasksCache[cacheKey]) {
                              setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: leaderTasksCache[cacheKey], loading: false, anchor: 'count' });
                            } else {
                              try {
                                const tasksQuery = query(collection(db, "tasks"), where("propertyId", "==", leaderboardItem.property.id), where("status", "==", "completed"), where("completedBy", "==", uid));
                                const snap = await getDocs(tasksQuery);
                                const tasks: string[] = [];
                                snap.forEach(ds => { const d = ds.data(); const title = d.title || d.name; if (title) tasks.push(title); });
                                setLeaderTasksCache(prev => ({ ...prev, [cacheKey]: tasks }));
                                setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks, loading: false, anchor: 'count' });
                              } catch (err) {
                                setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: [], loading: false, anchor: 'count' });
                              }
                            }
                          } else {
                            setHoveredLeader({ name: item.name, x: clientX, y: clientY, tasks: [], loading: false, anchor: 'count' });
                          }
                        }}
                        onMouseMove={(e:any)=> hoveredLeader && setHoveredLeader(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                        onMouseLeave={() => setHoveredLeader(null)}
                      >
                        {item.completedTasks.toLocaleString('en-US')} Tasks Finished
                      </Typography>
                    </Box>
                  ))}
                    {hoveredLeader && (
                      <Box sx={{
                        position: 'fixed',
                        left: (hoveredLeader.anchor === 'count') ? Math.max(8, hoveredLeader.x - 260) : Math.min((typeof window !== 'undefined' ? window.innerWidth - 260 - 8 : hoveredLeader.x + 12), hoveredLeader.x + 12),
                        top: hoveredLeader.y + 8,
                        zIndex: 1400,
                        bgcolor: '#fff',
                        color: '#222',
                        border: '1px solid rgba(0,0,0,0.08)',
                        boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                        borderRadius: 1,
                        p: 2,
                        minWidth: 220,
                        pointerEvents: 'none',
                      }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 550, mb: 1, fontFamily: 'Nunito, Arial, sans-serif' }}>{hoveredLeader.name}'s Completed Tasks</Typography>
                        {hoveredLeader.loading ? (
                          <Typography sx={{ color: '#666', fontFamily: 'Nunito, Arial, sans-serif' }}>Loading...</Typography>
                        ) : hoveredLeader.tasks && hoveredLeader.tasks.length > 0 ? (
                          <>
                            {hoveredLeader.tasks.slice(0,5).map((t, i) => (
                              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.6 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#89AE99' }} />
                                <Typography sx={{ fontSize: 13, color: '#333', fontFamily: 'Nunito, Arial, sans-serif' }}>{t}</Typography>
                              </Box>
                            ))}
                            {hoveredLeader.tasks.length > 5 && (
                              <Typography sx={{ fontSize: 12, color: '#888', mt: 0.5, fontFamily: 'Nunito, Arial, sans-serif' }}>+{hoveredLeader.tasks.length - 5} more</Typography>
                            )}
                          </>
                        ) : (
                          <Typography sx={{ color: '#666', fontFamily: 'Nunito, Arial, sans-serif' }}>No completed tasks</Typography>
                        )}
                      </Box>
                    )}
                </Box>
              </Box>
            );
          })()}
          {/* Spacer to prevent shadow clipping on right side */}
          <Box sx={{ width: 2, opacity: 0, height: 100, flexShrink: 0, marginLeft: -1 }} />
          </Box>
        </Box>
      </Box>

      {/* Responsive Footer — hidden on mobile (Add is in header); shown on md+ */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: { md: 'row' }, alignItems: 'center', justifyContent: "center", mt: 1, bgcolor: "inherit", px: { md: 4 }, py: 3, borderRadius: 2, minHeight: 64, gap: 2 }}>
      <Typography variant="body1" color="#404040" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: "bold", fontSize: 20, textAlign: 'center', mb: 0 }}>Add your next Property</Typography>
      <Button variant="contained" sx={{ fontFamily: 'Nunito, Arial, sans-serif', textTransform: 'none', bgcolor: '#89AE99', color: '#fff', fontWeight: 400, borderRadius: 2, px: 3, py: 1.5, fontSize: 18, boxShadow: 2, ml: 2, width: 'auto' }}
        onClick={async () => {
          const auth = getAuth();
          const user = auth.currentUser;
          if (!user) return;
          
          // Check for special admin emails that bypass limits
          const adminEmails = ['river@fishdawgproductions.com', 'andrii@allproperly.com'];
          if (adminEmails.includes(user.email || '')) {
            setAddPropertyOpen(true);
            if (onAddClick) onAddClick();
            return;
          }
          
          const { doc, getDoc, collection, getDocs } = await import("firebase/firestore");
          const { db } = await import("../services/firebase");
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const plan = userDoc.exists() ? (userDoc.data().planState || "free") : "free";
          let maxProperties = 1;
          if (plan === "basic" || plan === "basic_annual") maxProperties = 5;
          if (plan === "plus" || plan === "plus_annual") maxProperties = 10;
          // Fetch all properties from Firebase
          const allPropsSnap = await getDocs(collection(db, "properties"));
          const allProps = allPropsSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          // Count both owned and shared properties
          const userProperties = allProps.filter((p: any) => {
            const isOwner = p.ownerId === user.uid;
            const isShared = Array.isArray(p.sharedWith) && p.sharedWith.some((sw: any) => {
              if (typeof sw === 'string') return sw === user.uid;
              if (typeof sw === 'object' && sw && sw.userId) return sw.userId === user.uid;
              return false;
            });
            return isOwner || isShared;
          });
          if (userProperties.length >= maxProperties) {
            setUpgradePlan(plan);
            setUpgradeLimitOpen(true);
          } else {
            setAddPropertyOpen(true);
            if (onAddClick) onAddClick();
          }
        }}
      >+ Add</Button>
    </Box>
      </Box>
    <AddPropertyModal
      open={addPropertyOpen}
      onClose={() => setAddPropertyOpen(false)}
      onPropertyAdded={async (newPropertyId: string) => {
        // Fetch the new property and update state, ensuring correct role flags
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("../services/firebase");
        const propertyDoc = await getDoc(doc(db, "properties", newPropertyId));
        if (propertyDoc.exists()) {
          const newProperty = propertyDoc.data();
          // Determine role flags for the current user
          const userId = (await import("firebase/auth")).getAuth().currentUser?.uid;
          let isOwner = false, isCoOwner = false, isPM = false, isFriend = false;
          if (userId) {
            if (newProperty.ownerId === userId) isOwner = true;
            if (Array.isArray(newProperty.sharedWith)) {
              for (const sw of newProperty.sharedWith) {
                if (sw && typeof sw === 'object' && sw.userId === userId) {
                  if (sw.role === 'PM' || sw.role === 'Property Manager') isPM = true;
                  else if (sw.role === 'Friend') isFriend = true;
                  else isCoOwner = true;
                }
              }
            }
          }
          setProperties(prev => [
            {
              ...newProperty,
              id: newPropertyId,
              propertyName: newProperty.propertyName || newProperty.address1 || "Unnamed Property",
              photoUrl: newProperty.photoUrl,
              tag: newProperty.type || "Property",
              sharedWith: newProperty.sharedWith || [],
              isOwner,
              isCoOwner,
              isPM,
              isFriend,
              isRental: !!newProperty.isRental
            },
            ...prev
          ]);
        }
        setAddPropertyOpen(false);
      }}
    />
    <UpgradeLimitModal
      open={upgradeLimitOpen}
      onCancel={() => setUpgradeLimitOpen(false)}
      onUpgrade={() => {
        setUpgradeLimitOpen(false);
        if (onShowUpgrade) onShowUpgrade();
      }}
      planState={upgradePlan}
    />
    
    {/* Edit Property Modal - Using reusable component */}
    <EditPropertyModal
      open={editModalOpen}
      onClose={() => {
        setEditModalOpen(false);
        setEditModalProperty(null);
      }}
      property={editModalProperty as any}
      role={editModalRole}
      onSave={(updatedProperty) => {
        setProperties(prev => prev.map(p => 
          p.id === updatedProperty.id ? { ...p, ...updatedProperty } as PropertyItem : p
        ));
      }}
      onDelete={async (propertyId: string) => {
        try {
          const auth = getAuth();
          const user = auth.currentUser;
          if (!user) throw new Error('No authenticated user');
          await deleteProperty(propertyId, user.uid);
          setProperties(prev => prev.filter(p => p.id !== propertyId));
          setEditModalOpen(false);
          setEditModalProperty(null);
        } catch (err) {
          console.error('Error deleting property:', err);
          throw err;
        }
      }}
      onGoToSettings={() => {
        if (editModalProperty && onPropertyClick) {
          onPropertyClick(editModalProperty.id);
        }
      }}
    />

    {/* Mobile Add Property button at the bottom of dashboard */}
    {isMobileOrSmall && (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 3 }}>
        <Button
          variant="contained"
          onClick={handleAddClick}
          sx={{
            bgcolor: '#89AE99',
            color: '#fff',
            fontWeight: 600,
            fontFamily: 'Nunito, Arial, sans-serif',
            textTransform: 'none',
            borderRadius: 2,
            px: 3,
            py: 1.2,
            fontSize: 16,
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
            '&:hover': { bgcolor: '#7a9d8a', boxShadow: '0 4px 16px rgba(0,0,0,0.28)' },
          }}
        >
          + Add Property
        </Button>
      </Box>
    )}
  </Box>
  );
};
export default MainDashboard;
