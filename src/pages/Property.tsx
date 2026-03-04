import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FilterPropertyModal from '../components/FilterPropertyModal';
import EditPropertyModalComponent from '../components/EditPropertyModal';
import { deleteProperty } from '../services/PropertyService';

import { deleteDoc } from 'firebase/firestore';
import { Switch } from '@mui/material';
// Inventory item schema
export interface InventoryItem {
  id?: string; // Firestore doc id
  brand: string;
  model: string;
  note: string; // serial number, number of detectors, or air filter size
}
// Example: CRUD operations for inventory
export function useInventory(propertyId: string) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch inventory items for a property
  async function fetchInventory() {
    setLoading(true);
    const q = query(collection(db, 'inventory'), where('propertyId', '==', propertyId));
    const snap = await getDocs(q);
    const items: InventoryItem[] = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as InventoryItem));
    setInventory(items);
    setLoading(false);
  }

  // Add inventory item
  async function addInventoryItem(item: Omit<InventoryItem, 'id'>) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const docRef = await addDoc(collection(db, 'inventory'), {
      ...item,
      propertyId,
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
    });
    await fetchInventory();
    return docRef.id;
  }

  // Update inventory item
  async function updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
    await updateDoc(doc(db, 'inventory', id), updates);
    await fetchInventory();
  }

  // Delete inventory item
  async function deleteInventoryItem(id: string) {
    await deleteDoc(doc(db, 'inventory', id));
    await fetchInventory();
  }

  return { inventory, loading, fetchInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem };
}

// InventoryEditForm moved to components/property/InventoryEditForm.tsx
import InventoryEditForm from '../components/property/InventoryEditForm';
import ForecastingSection from '../components/property/ForecastingSection';
import PropertyHealthSection from '../components/property/PropertyHealthSection';
import UtilityCard from '../components/property/UtilityCard';
import { FieldTooltipProvider, TooltipField, useFieldTooltipControl } from '../hooks/useFieldTooltip';
import React, { useRef, useMemo } from 'react';

import AddPropertyModal from '../components/AddPropertyModal';
import UpgradeLimitModal from '../components/UpgradeLimitModal';
import { formatShortDate, formatLongDate, parseLongDate, formatNumber, formatCurrencyAmount } from '../utils/dateUtils';
import UpcomingTasksTable from '../components/UpcomingTasksTable';

import Box from "@mui/material/Box";
import Autocomplete from '@mui/material/Autocomplete';
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import InputAdornment from '@mui/material/InputAdornment';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format as formatDateFns, parse as parseDateFns, isValid as isValidDateFns } from 'date-fns';
import MenuItem from '@mui/material/MenuItem';
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc, query, collection, where, getDocs } from "firebase/firestore";
import { addDoc } from "firebase/firestore";
import { getNextUniqueTasks } from '../utils/taskRecurringHelpers';
import { db } from "../services/firebase";
import PhotoPicker from '../components/PhotoPicker';
import { getStorage, ref, uploadBytes } from "firebase/storage";
import EmptyState from '../components/common/EmptyState';
import { PropertyOverviewSkeleton } from '../components/common/AppSkeletons';

interface PropertyProps {
  id: string;
  onShowUpgrade(): void;
  sidebar?: boolean;
}

export interface PropertyData {
  forecasting?: {
    Roof?: {
      type?: string;
      cost?: number;
      lifespan?: number;
      installDate?: string;
    };
    HVAC?: {
      cost?: number;
      lifespan?: number;
      installDate?: string;
    };
    WaterHeater?: {
      cost?: number;
      lifespan?: number;
      installDate?: string;
    };
  };
  id?: string;
  ownerId: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  price: string;
  date: string;
  interestRate: string;
  balance: string;
  lender: string;
  type: string;
  alias: string;
  notes: string;
  photoUrl: string;
  originalPhotoUrl?: string; // NEW: stores the original (uncropped) image
  createdAt: string;
  updatedAt: string;
  sharedWith: Array<{ userId: string; alias?: string; [key: string]: any }>;
  propertyStatus: string;
  historyVisible: boolean;
  yearBuilt: number;
  squareFeet: number;
  bedrooms: number;
  bathsFull: number;
  bathsHalf: number;
  bathsTotal: number;
  lotAcres: number;
  lotSqFt: number;
  inventory: string[];
  estimatedValue: string;
  insurance?: {
    insuranceCompany: string;
    assetsCovered: string;
    policyNumber: string;
    dueDate: string;
    amount: string;
    frequency?: string;
  };
  utilities?: UtilityItem[];
  noMortgage?: boolean;
  securityDeposit?: string;
  securityDepositDate?: string;
  leaseStart?: string;
  leaseEnd?: string;
  rentalRate?: number;
  rentRenewalSuggestion?: number;
  isRental?: boolean;
  isPT?: boolean;
  rentalInsurance?: {
    insuranceCompany: string;
    assetsCovered: string;
    policyNumber: string;
  };
  pm_company?: string;
  pm_rate?: string;
  pmi?: string;
  term?: string;
  mortgagePaymentAmount?: string;
  mortgagePaidOffDate?: string;
  propertyTaxHistory?: Array<{ date: string; amount: string }>;
  hoa?: string;
  yearly?: string;
}

interface UtilityItem {
  type: string;
  company: string;
  number?: string;
  link?: string;
}

function Property({ id, onShowUpgrade, sidebar }: PropertyProps) {
  const [editLoading, setEditLoading] = React.useState(false);
    // Ref and state for left box height sync
    const leftBoxRef = useRef<HTMLDivElement>(null);
    const [leftHeight, setLeftHeight] = useState<number | undefined>(undefined);

    useEffect(() => {
      const measureHeight = () => {
        if (leftBoxRef.current) {
          const rect = leftBoxRef.current.getBoundingClientRect();
          setLeftHeight(rect.height);
        }
      };
      measureHeight();
      // Remeasure after sidebar animation completes
      const timeout = setTimeout(measureHeight, 350);
      window.addEventListener('resize', measureHeight);
      return () => {
        window.removeEventListener('resize', measureHeight);
        clearTimeout(timeout);
      };
    }, [sidebar]);
  const auth = getAuth();
  const user = auth.currentUser;
  // Utility function to normalize URLs
  // function normalizeUrl(url?: string): string {
  //   if (!url) return '';
  //   if (url.startsWith('http://') || url.startsWith('https://')) {
  //     return url;
  //   }
  //   return `https://${url}`;
  // }
  // State for upgrade modal
  const [upgradeLimitOpen, setUpgradeLimitOpen] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState("free");
  // Utility delete modal state
  const [deleteUtilityIdx, setDeleteUtilityIdx] = useState<number | null>(null);
  const [deleteUtilityLoading, setDeleteUtilityLoading] = useState(false);
  // Ensure allProperties is hydrated whenever tabNames change
  // Inventory modal state
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<{ name: string, type: string, brand: string, model: string, serial: string } | null>(null);
  const [addPropertyOpen, setAddPropertyOpen] = useState(false);
  // Removed onboarding state
  const [currentPropertyId, setCurrentPropertyId] = useState<string>(id);
  const [propertyTagError, setPropertyTagError] = useState<string>('');
  // Upcoming tasks for this property
  const [upcomingTasks, setUpcomingTasks] = useState<{ name: string; date: string; id: string; propertyType?: string; assigned_user?: string }[]>([]);
  // Memoized filter for tasks assigned to current user (avoids repeated filtering)
  const myAssignedTasks = useMemo(() => 
    upcomingTasks.filter(task => task.assigned_user === user?.displayName), 
    [upcomingTasks, user?.displayName]
  );
  // Completed tasks for this property in the current month
  const [completedTasksThisMonth, setCompletedTasksThisMonth] = useState<number>(0);
  // Top contributor for this property in the current month
  const [topContributor, setTopContributor] = useState<string>("-");
  // TaskShield score for this property
  const [taskShieldScore, setTaskShieldScore] = useState<number | null>(null);
  // Cache all properties for fast tab switching
  const [allProperties, setAllProperties] = useState<any[]>([]);
  useEffect(() => {
    ResetConditionVariables();
    async function fetchUpcomingTasks() {
        const q = query(
          collection(db, "tasks"),
          where("propertyId", "==", currentPropertyId),
          where("status", "!=", "completed")
        );
        const snap = await getDocs(q);
        let tasks: { name: string; date: string; id: string; propertyType?: string; assigned_user: string; }[] = [];
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          if (data.title && data.dueDate) {
            // Use existing property data instead of fetching it again
            let propertyType = "";
            if (property) {
              const isShared = Array.isArray(property.sharedWith) && property.sharedWith.some((sw: any) => sw.userId === user?.uid);
              if (isShared) {
                const entry = property.sharedWith.find((sw: any) => sw.userId === user?.uid);
                if (entry && typeof entry.alias === 'string' && entry.alias.trim()) {
                  propertyType = entry.alias;
                } else {
                  propertyType = property.type;
                }
              } else {
                propertyType = property.type;
              }
            }
            tasks.push({ name: data.title, date: data.dueDate, id: docSnap.id, propertyType, assigned_user: data.assigned_user  });
          }
        }
        // Filter tasks to only those due between today and one month from today
        const todayDate = new Date();
        const oneMonthLater = new Date(todayDate);
        oneMonthLater.setFullYear(todayDate.getFullYear() + 1);
        tasks = tasks.filter(task => {
          const due = new Date(task.date);
          return due >= todayDate && due <= oneMonthLater;
        });
        // Sort by due date ascending
        tasks = tasks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setUpcomingTasks(tasks);

        // Fetch completed tasks for this property in the current month
        const now = new Date();
        const completedQ = query(
          collection(db, "tasks"),
          where("propertyId", "==", currentPropertyId),
          where("status", "==", "completed")
        );
        const completedSnap = await getDocs(completedQ);
        let completedCount = 0;
        const contributorCount: Record<string, number> = {};
        for (const docSnap of completedSnap.docs) {
          const data = docSnap.data();
          // Prefer completedAt, fallback to dueDate if not present
          const completedAt = data.completedAt ? new Date(data.completedAt) : (data.dueDate ? new Date(data.dueDate) : null);
          if (
            completedAt &&
            completedAt.getFullYear() === now.getFullYear() &&
            completedAt.getMonth() === now.getMonth()
          ) {
            completedCount++;
            const completedBy = data.completedBy || data.ownerId || "Unknown";
            contributorCount[completedBy] = (contributorCount[completedBy] || 0) + 1;
          }
        }
        setCompletedTasksThisMonth(completedCount);
        // Find top contributor userId
        let topUserId = "-";
        let maxCount = 0;
        for (const [userId, count] of Object.entries(contributorCount)) {
          if (count > maxCount) {
            maxCount = count;
            topUserId = userId;
          }
        }
        // Optionally, resolve userId to display name (if available)
        if (topUserId !== "-" && topUserId !== "Unknown") {
          try {
            const userDoc = await getDoc(doc(db, "users", topUserId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setTopContributor(userData.displayName || userData.name || topUserId);
            } else {
              setTopContributor(topUserId);
            }
          } catch {
            setTopContributor(topUserId);
          }
        } else {
          setTopContributor("-");
        }
    }
    fetchUpcomingTasks();
    fetchTaskShieldScore();
    if (tabNames.length > 1 && (!selectedTab || !tabNames.includes(selectedTab))) {
      setSelectedTab(tabNames[0]);
      sessionStorage.setItem('appTab', tabNames[0]);
    }
  }, [currentPropertyId]);

  // --- TaskShield Score Calculation ---
  async function fetchTaskShieldScore() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !currentPropertyId) {
      setTaskShieldScore(null);
      return;
    }
    const { getDocs, collection, query, where } = await import("firebase/firestore");
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 365);
    // Query all tasks for this property with dueDate in the last 365 days
    const tasksQ = query(
      collection(db, "tasks"),
      where("ownerId", "==", user.uid),
      where("propertyId", "==", currentPropertyId)
    );
    const snap = await getDocs(tasksQ);
    let weightedSum = 0;
    let totalWeight = 0;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.dueDate) return;
      const dueDate = new Date(data.dueDate);
      if (dueDate < windowStart || dueDate > now) return;
      // All tasks are severity 1
      const weight = 1;
      let completionFactor = 0;
      if (data.status === "completed") {
        const completedAt = data.completedAt ? new Date(data.completedAt) : dueDate;
        if (completedAt <= dueDate) {
          completionFactor = 1.0;
        } else if ((completedAt.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24) <= 30) {
          completionFactor = 0.7;
        } else {
          completionFactor = 0.0;
        }
      } else if (data.status === "skipped") {
        completionFactor = 0.0; // or 0.3 for softer penalty
      } else if ((data.status === "pending" || !data.status) && dueDate < now) {
        // Missed if still pending and dueDate is more than 30 days ago
        if ((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24) > 30) {
          completionFactor = 0.0;
        } else {
          // Still within 30 days grace period, treat as not yet missed
          completionFactor = 0.0;
        }
      }
      weightedSum += weight * completionFactor;
      totalWeight += weight;
    });
    const score = totalWeight > 0 ? Math.round(100 * (weightedSum / totalWeight)) : 100;
    setTaskShieldScore(score);
  }
  // Insurance modal state
  const [editInsuranceOpen, setEditInsuranceOpen] = useState(false);
    // RentalInsurance modal state
  const [editRentalInsuranceOpen, setEditRentalInsuranceOpen] = useState(false);
  // Forecasting modal state
  const [forecastModalOpen, setForecastModalOpen] = useState(false);
  const [editPropertyTaxesOpen, setEditPropertyTaxesOpen] = useState(false);
  const [editTaxDate, setEditTaxDate] = useState<Date | null>(null);
  const [localTaxHistory, setLocalTaxHistory] = useState<Array<{ date: string; amount: string }>>([]);
  const [savingTaxHistory, setSavingTaxHistory] = useState(false);
  const [selectedPropertyTaxYear, setSelectedPropertyTaxYear] = useState<{ date: string; amount: string } | null>(null);
  const [costErrors, setCostErrors] = useState<{ roofCost: string; hvacCost: string; waterCost: string }>({
    roofCost: '',
    hvacCost: '',
    waterCost: ''
  });

  // --- Property Tax Edit State ---
  const [editingTaxDate, setEditingTaxDate] = useState<Date | null>(null);
  const [editingTaxAmount, setEditingTaxAmount] = useState<string>('');
  const [taxDateError, setTaxDateError] = useState<string>('');
  const [editingPaidOffDate, setEditingPaidOffDate] = useState<Date | null>(null);
  // --- Security Deposit Modal State ---
  const [securityDepositModalOpen, setSecurityDepositModalOpen] = useState(false);
  const [leaseModalOpen, setLeaseModalOpen] = useState(false);
  // Handler to open modal and prefill values
  const handleOpenLeaseModal = () => {
    if(property) {
      setEditForm({ ...property, id: currentPropertyId });
      setLeaseModalOpen(true);
    }
  };

  const handleUpdateLease = async () => {
    if (!currentPropertyId) return;
    setLeaseModalOpen(false);
    try {
      const docRef = doc(db, "properties", currentPropertyId);
      const updateData: any = {};
      // Update or clear leaseStart
      const leaseStartFilled = editForm?.leaseStart !== undefined && editForm?.leaseStart !== '';
      updateData.leaseStart = leaseStartFilled ? editForm.leaseStart : null;

      // Update or clear leaseEnd
      const leaseEndFilled = editForm?.leaseEnd !== undefined && editForm?.leaseEnd !== '';
      updateData.leaseEnd = leaseEndFilled ? editForm.leaseEnd : null;

      // Update or clear rentalRate (number or string)
      // Update or clear rentalRate (number)
      updateData.rentalRate = (editForm?.rentalRate !== undefined && editForm?.rentalRate !== null) ? editForm.rentalRate : null;

      // Update or clear rentRenewalSuggestion (number)
      updateData.rentRenewalSuggestion = (editForm?.rentRenewalSuggestion !== undefined && editForm?.rentRenewalSuggestion !== null) ? editForm.rentRenewalSuggestion : null;
      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date().toISOString();
        await updateDoc(docRef, updateData);
        setProperty(prev => prev ? { ...prev, ...updateData } : prev);
        setEditForm(prev => prev ? { ...prev, ...updateData } : prev);
      }

      // Check if rentRenewalSuggestion is filled
      const suggestionFilled = editForm?.rentRenewalSuggestion !== undefined && editForm?.rentRenewalSuggestion !== null;

      // If both dates are filled and suggestion is NOT filled, call API
      if (leaseStartFilled && leaseEndFilled && !suggestionFilled) {
        try {
          const address = property?.address1 || '';
          const city = property?.city || '';
          const state = property?.state || '';
          const zip = property?.zip || '';
          const response = await fetch("https://getrentrenewalsuggestionhttp-kgqlakneiq-uc.a.run.app/getRentRenewalSuggestion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address, city, state, zip })
          });
          if (!response.ok) throw new Error("Failed to get rent renewal suggestion.");
          const result = await response.json();
          const suggestion = result.suggestion;
          if (suggestion) {
            await updateDoc(docRef, { rentRenewalSuggestion: suggestion, updatedAt: new Date().toISOString() });
            setProperty(prev => prev ? { ...prev, rentRenewalSuggestion: suggestion } : prev);
            setEditForm(prev => prev ? { ...prev, rentRenewalSuggestion: suggestion } : prev);
          }
        } catch (apiErr) {
          console.error('[Attom API] Failed to fetch rent renewal suggestion:', apiErr);
        }
      }
    } catch (err) {
      console.error("[Lease Tracking Update] Error:", err);
    }
  }

  // Handler to update values (replace with Firestore update if needed)
  const handleUpdateSecurityDeposit = async () => {
    if (!currentPropertyId) return;
    setSecurityDepositModalOpen(false);
    try {
      const docRef = doc(db, "properties", currentPropertyId);
      const updateData: any = {};
      // Update or clear securityDeposit
      if (editForm?.securityDeposit !== undefined) {
        updateData.securityDeposit = editForm.securityDeposit !== '' ? editForm.securityDeposit : null;
      }
      // Update or clear securityDepositDate
      if (editForm?.securityDepositDate !== undefined) {
        updateData.securityDepositDate = editForm.securityDepositDate !== '' ? editForm.securityDepositDate : null;
      }
      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date().toISOString();
        await updateDoc(docRef, updateData);
        setProperty(prev => prev ? { ...prev, ...updateData } : prev);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const [forecastForm, setForecastForm] = useState({
    roofType: 'Shingle',
    roofCost: '',
    roofDate: '',
    roofLifespan: '30',
    hvacCost: '',
    hvacDate: '',
    hvacLifespan: '15',
    waterCost: '',
    waterDate: '',
    waterLifespan: '10',
  });

  // Prefill forecasting modal with current property roof, HVAC, and Water Heater data
  const handleOpenForecastModal = () => {
    setForecastForm(f => ({
      ...f,
      // Roof
      roofType: property?.forecasting?.Roof?.type || 'Shingle',
      roofCost: property?.forecasting?.Roof?.cost !== undefined ? String(property.forecasting.Roof.cost) : '',
      roofLifespan: property?.forecasting?.Roof?.lifespan !== undefined ? String(property.forecasting.Roof.lifespan) : '30',
      roofDate: property?.forecasting?.Roof?.installDate || '',
      // HVAC
      hvacCost: property?.forecasting?.HVAC?.cost !== undefined ? String(property.forecasting.HVAC.cost) : '',
      hvacLifespan: property?.forecasting?.HVAC?.lifespan !== undefined ? String(property.forecasting.HVAC.lifespan) : '15',
      hvacDate: property?.forecasting?.HVAC?.installDate || '',
      // Water Heater
      waterCost: property?.forecasting?.WaterHeater?.cost !== undefined ? String(property.forecasting.WaterHeater.cost) : '',
      waterLifespan: property?.forecasting?.WaterHeater?.lifespan !== undefined ? String(property.forecasting.WaterHeater.lifespan) : '10',
      waterDate: property?.forecasting?.WaterHeater?.installDate || '',
    }));
    setForecastModalOpen(true);
  };

    // State for two-step delete confirmation
  const [showFirstDeleteConfirm, setShowFirstDeleteConfirm] = useState(false);
  const [showSecondDeleteConfirm, setShowSecondDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Handler for actual delete logic — uses shared deleteProperty from PropertyService
  const handleDeleteProperty = async () => {
    if (!currentPropertyId) return;
    setDeleteLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        console.error('No authenticated user.');
        setDeleteLoading(false);
        return;
      }

      // Call shared delete function (handles owner vs shared member, tasks, invites)
      await deleteProperty(currentPropertyId, user.uid);

      // Calculate the tab name for this property
      let removedTabName = property?.type;
      if (Array.isArray(property?.sharedWith)) {
        const entry = property!.sharedWith.find(
          (sw: any) => typeof sw === 'object' && sw.userId === user.uid
        );
        if (entry && entry.alias && entry.alias.trim()) {
          removedTabName = entry.alias;
        }
      }

      // Update local state to remove this property from view
      const updatedTabNames = tabNames.filter(name => name !== removedTabName);
      setTabNames(updatedTabNames);

      const updatedAllProperties = allProperties.filter((p: any) => p.id !== currentPropertyId);
      setAllProperties(updatedAllProperties);

      const updatedTabNameToPropertyId = { ...tabNameToPropertyId };
      if (removedTabName) {
        delete updatedTabNameToPropertyId[removedTabName];
      }
      setTabNameToPropertyId(updatedTabNameToPropertyId);

      // Navigate to next property or dashboard
      if (updatedAllProperties.length > 0) {
        const nextProperty = updatedAllProperties[0];
        if (nextProperty && nextProperty.id) {
          const nextPropertyTab = nextProperty.tabName || nextProperty.type || 'Home';
          setCurrentPropertyId(nextProperty.id);
          setProperty(nextProperty);
          setSelectedTab(nextPropertyTab);
        } else {
          window.location.href = "/";
        }
      } else {
        window.location.href = "/";
      }

      // Clean up property-related state
      setUpcomingTasks([]);
      setCompletedTasksThisMonth(0);
      setTopContributor("-");
      setTaskShieldScore(null);

      setEditOpen(false);
    } catch (err: any) {
      alert('Failed to delete property and related data: ' + (err?.message || err));
    } finally {
      setDeleteLoading(false);
      setShowFirstDeleteConfirm(false);
      setShowSecondDeleteConfirm(false);
    }
  };

  // Add Item modal state
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItem, setNewItem] = useState({ type: '', brand: '', model: '', serial: '' });
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [isPropertyBootstrapping, setIsPropertyBootstrapping] = useState(true);
  const [isPropertyFetching, setIsPropertyFetching] = useState(false);
  const [tabNames, setTabNames] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>("");
  // Map of tabName to propertyId for quick lookup
  const [tabNameToPropertyId, setTabNameToPropertyId] = useState<Record<string, string>>({});


  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<PropertyData | null>(null);
  const [pmCompanyLocal, setPmCompanyLocal] = useState('');

  // --- Field Tooltip System (using Context-based approach) ---
  const fieldExplanations: Record<string, { title: string; description: string }> = {
    'propertyTag': { title: 'Property Tag', description: 'A display name you assign to a property.' },
    'pm_company': { title: 'Property Management Company', description: 'The company hired to manage the property, such as handling tenants, maintenance, and rent collection.' },
    'pm_rate': { title: 'Property Management Rate', description: 'The percentage fee charged by the property management company.' },
    'price': { title: 'Purchase Price', description: 'The amount you paid to buy the home.' },
    'date': { title: 'Purchase Date', description: 'The date you officially bought and took ownership of the home.' },
    'interestRate': { title: 'Interest Rate', description: 'The percentage charged by the lender for borrowing money for the mortgage.' },
    'mortgageBalance': { title: 'Balance', description: 'The remaining amount you still owe on your mortgage.' },
    'estimatedValue': { title: 'Estimated Value', description: 'An approximate current market value of the home.' },
    'pmi': { title: 'PMI (Private Mortgage Insurance)', description: 'Insurance required by lenders when your down payment is less than 20%.' },
    'term': { title: 'Term', description: 'The total length of the mortgage loan.' },
    'currentLender': { title: 'Current Lender', description: 'The bank or company that currently holds your mortgage loan.' },
    'mortgagePayment': { title: 'Mortgage Payment', description: 'The regular payment made toward your loan, usually including principal and interest.' },
    'escrowAccount': { title: 'Escrow Account', description: 'An account managed by your lender where a portion of your monthly payment is set aside to pay property taxes and insurance on your behalf.' },
    'hoa': { title: 'HOA Fee', description: 'A charge for living in a community with a Home Owners Association.' },
    'hoaPayment': { title: 'HOA Payment Term', description: 'How often HOA fees are paid.' },
    'propertyTaxDate': { title: 'Property Tax Due Date', description: 'The date property taxes must be paid to the local government.' },
    'propertyTaxAmount': { title: 'Property Tax Amount', description: 'The total amount of property tax owed for the year or payment period.' },
    'insuranceDueDate': { title: 'Insurance Due Date', description: 'The date your homeowners insurance premium is due.' },
    'insuranceAmount': { title: 'Insurance Amount', description: 'The cost of your homeowners insurance policy.' },
    'insurancePayment': { title: 'Insurance Payment', description: 'The actual payment made toward homeowners insurance, either directly or through escrow.' },
  };

  const { hideTooltip } = useFieldTooltipControl();

    useEffect(() => {
    // Animate progress bars and numbers
    let roofTarget = 0;
    if (property?.forecasting?.Roof) {
      const { lifespan, installDate } = property.forecasting.Roof;
      const year = installDate ? new Date(installDate).getFullYear() : null;
      const currentYear = new Date().getFullYear();
      if (lifespan && year) {
        roofTarget = 100 / lifespan * (lifespan + year - currentYear);
        if (roofTarget < 0) roofTarget = 0;
        if (roofTarget > 100) roofTarget = 100;
        roofTarget = Math.floor(roofTarget);
      }
    }
    let hvacTarget = 0;
    if (property?.forecasting?.HVAC) {
      const { lifespan, installDate } = property.forecasting.HVAC;
      const year = installDate ? new Date(installDate).getFullYear() : null;
      const currentYear = new Date().getFullYear();
      if (lifespan && year) {
        hvacTarget = 100 / lifespan * (lifespan + year - currentYear);
        if (hvacTarget < 0) hvacTarget = 0;
        if (hvacTarget > 100) hvacTarget = 100;
        hvacTarget = Math.floor(hvacTarget);
      }
    }
    let waterTarget = 0;
    if (property?.forecasting?.WaterHeater) {
      const { lifespan, installDate } = property.forecasting.WaterHeater;
      const year = installDate ? new Date(installDate).getFullYear() : null;
      const currentYear = new Date().getFullYear();
      if (lifespan && year) {
        waterTarget = 100 / lifespan * (lifespan + year - currentYear);
        if (waterTarget < 0) waterTarget = 0;
        if (waterTarget > 100) waterTarget = 100;
        waterTarget = Math.floor(waterTarget);
      }
    }
    // If all targets are zero, don't animate — set to 0 and exit early.
    if (roofTarget === 0 && hvacTarget === 0 && waterTarget === 0) {
      setRoofProgress(0);
      setHvacProgress(0);
      setWaterProgress(0);
      return;
    }

    // Ensure any target that is zero is immediately set to 0 (no animation)
    if (roofTarget === 0) { setRoofProgress(0); roofProgressRef.current = 0; }
    else if (roofTarget < roofProgressRef.current) { setRoofProgress(roofTarget); roofProgressRef.current = roofTarget; }

    if (hvacTarget === 0) { setHvacProgress(0); hvacProgressRef.current = 0; }
    else if (hvacTarget < hvacProgressRef.current) { setHvacProgress(hvacTarget); hvacProgressRef.current = hvacTarget; }

    if (waterTarget === 0) { setWaterProgress(0); waterProgressRef.current = 0; }
    else if (waterTarget < waterProgressRef.current) { setWaterProgress(waterTarget); waterProgressRef.current = waterTarget; }

    if(!isSharedMember || isRealPM) {
      if (leftBoxRef.current) {
        const rect = leftBoxRef.current.getBoundingClientRect();
        setLeftHeight(rect.height);
      }
    }

    const interval = setInterval(() => {
      if (roofTarget > 0) {
        setRoofProgress(prev => {
          const next = prev < roofTarget ? Math.min(prev + Math.floor(Math.random() * 20) + 10, roofTarget) : prev;
          roofProgressRef.current = next;
          return next;
        });
      }
      if (hvacTarget > 0) {
        setHvacProgress(prev => {
          const next = prev < hvacTarget ? Math.min(prev + Math.floor(Math.random() * 20) + 10, hvacTarget) : prev;
          hvacProgressRef.current = next;
          return next;
        });
      }
      if (waterTarget > 0) {
        setWaterProgress(prev => {
          const next = prev < waterTarget ? Math.min(prev + Math.floor(Math.random() * 20) + 10, waterTarget) : prev;
          waterProgressRef.current = next;
          return next;
        });
      }

      // Clear interval when all non-zero targets are reached
      const roofDone = roofTarget === 0 || roofProgressRef.current >= roofTarget;
      const hvacDone = hvacTarget === 0 || hvacProgressRef.current >= hvacTarget;
      const waterDone = waterTarget === 0 || waterProgressRef.current >= waterTarget;
      if (roofDone && hvacDone && waterDone) {
        clearInterval(interval);
      }
    }, 40); // moderate animation speed
    return () => clearInterval(interval);
  }, [property]);

  useEffect(() => {
    if (editOpen && property) {
      setEditForm({ ...property, noMortgage: property.noMortgage ?? false, yearly: property.yearly || 'Yearly' });
    }
  }, [editOpen, property]);


  const [editImage, setEditImage] = useState<string | null>(null); // Cropped preview URL
  const [editImageBlob, setEditImageBlob] = useState<Blob | null>(null); // Cropped blob
  const [originalImageBlob, setOriginalImageBlob] = useState<Blob | null>(null); // Original image blob
  const [originalImageDataUrl, setOriginalImageDataUrl] = useState<string | null>(null); // Original image data URL
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [photoPickerImage, setPhotoPickerImage] = useState<string | null>(null);
  const [isOrigin, setIsOrigin] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Add Utility modal state
  const [addUtilityOpen, setAddUtilityOpen] = useState(false);
  const [utilityType, setUtilityType] = useState('');
  const [utilityCompany, setUtilityCompany] = useState('');
  const [utilityAccount, setUtilityAccount] = useState('');
  const [utilityUrl, setUtilityUrl] = useState('');

  //utility update button state
  const [utilityState, setUtilityState] = useState(false);

  // Edit Utility modal state
  const [editUtilityOpen, setEditUtilityOpen] = useState(false);
  const [editUtilityType, setEditUtilityType] = useState('');
  const [editUtilityCompany, setEditUtilityCompany] = useState('');
  const [editUtilityAccount, setEditUtilityAccount] = useState('');
  const [editUtilityUrl, setEditUtilityUrl] = useState('');
  const [editUtilityIndex, setEditUtilityIndex] = useState<number | null>(null);
  const utilityTypes = [
    'Water',
    'Electricity',
    'Gas',
    'Trash',
    'Other',
  ];

  // Animated progress state for Forecasting and Planning
  const [roofProgress, setRoofProgress] = useState(0);
  const [hvacProgress, setHvacProgress] = useState(0);
  const [waterProgress, setWaterProgress] = useState(0);

  // Refs to hold latest progress values so interval can read them without stale closures
  const roofProgressRef = React.useRef<number>(0);
  const hvacProgressRef = React.useRef<number>(0);
  const waterProgressRef = React.useRef<number>(0);

  // Keep refs in sync whenever state changes
  useEffect(() => { roofProgressRef.current = roofProgress; }, [roofProgress]);
  useEffect(() => { hvacProgressRef.current = hvacProgress; }, [hvacProgress]);
  useEffect(() => { waterProgressRef.current = waterProgress; }, [waterProgress]);

  function getAssetScoreFloat(installDate?: string, lifespan?: number): number {
    if (!installDate || !lifespan || lifespan <= 0) return 100.0;
    const now = new Date();
    const install = new Date(installDate);
    let ageYears = (now.getFullYear() - install.getFullYear()) + (now.getMonth() - install.getMonth()) / 12;
    if (ageYears < 0) ageYears = 0;
    const agePct = Math.min(1, Math.max(0, ageYears / lifespan));
    return 100 * (1 - agePct);
  }

  const roofScore = property?.forecasting?.Roof ? getAssetScoreFloat(property.forecasting.Roof.installDate, property.forecasting.Roof.lifespan) : 0.0;
  const hvacScore = property?.forecasting?.HVAC ? getAssetScoreFloat(property.forecasting.HVAC.installDate, property.forecasting.HVAC.lifespan) : 0.0;
  const waterHeaterScore = property?.forecasting?.WaterHeater ? getAssetScoreFloat(property.forecasting.WaterHeater.installDate, property.forecasting.WaterHeater.lifespan) : 0.0;

  const assetPoint = 0.60 * roofScore + 0.25 * hvacScore + 0.15 * waterHeaterScore;
  const overallHealthValue = Math.max(0, Math.min(100, assetPoint));

  // --- Combined Overall Health Value ---
  const totalOverallHealthValue = (taskShieldScore !== null)
    ? Math.round(overallHealthValue * 0.55 + 0.45 * taskShieldScore)
    : overallHealthValue;

  // Save overall health value and system health values to Firebase
  useEffect(() => {
    const saveHealthValues = async () => {
      if (!id || !property) return;
      try {
        const { updateDoc, doc } = await import("firebase/firestore");
        const docRef = doc(db, "properties", id);
        await updateDoc(docRef, {
          overallHealth: totalOverallHealthValue,
          roofHealth: Math.floor(roofProgress),
          hvacHealth: Math.floor(hvacProgress),
          waterHeaterHealth: Math.floor(waterProgress)
        });
        console.log('Saved health values to Firebase:', {
          overallHealth: totalOverallHealthValue,
          roofHealth: Math.floor(roofProgress),
          hvacHealth: Math.floor(hvacProgress),
          waterHeaterHealth: Math.floor(waterProgress)
        });
      } catch (err) {
        console.error('Failed to save health values:', err);
      }
    };
    saveHealthValues();
  }, [id, totalOverallHealthValue, roofProgress, hvacProgress, waterProgress, property]);

  useEffect(() => {
    // On mount, build tabNames and tabNameToPropertyId, and set selectedTab
    async function buildTabsAndSelect() {
      setIsPropertyBootstrapping(true);
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          setTabNames([]);
          setTabNameToPropertyId({});
          setSelectedTab("");
          setProperty(null);
          return;
        }

        const { getDocs, collection, doc, getDoc } = await import("firebase/firestore");
        const allPropsSnap = await getDocs(collection(db, "properties"));
        const tabNamesArr: string[] = [];
        const tabNameToId: Record<string, string> = {};
        const processedPropertyIds = new Set<string>();
        let initialTab = "";
        const initialPropertyId = id;
        let foundTabForId = "";

        allPropsSnap.forEach(docSnap => {
          const data = docSnap.data();
          // Skip if already processed this property
          if (processedPropertyIds.has(docSnap.id)) return;
          processedPropertyIds.add(docSnap.id);

          const isOwner = data.ownerId === user.uid;
          let tabName = data.type;

          if (Array.isArray(data.sharedWith)) {
            const entry = data.sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === user.uid);
            if (entry && typeof entry === 'object' && entry.alias && entry.alias.trim()) {
              // Use alias if it exists and is not empty
              tabName = entry.alias;
            }
          }

          if ((isOwner || (Array.isArray(data.sharedWith) && data.sharedWith.some((sw: any) => sw.userId === user.uid))) && tabName) {
            if (!tabNamesArr.includes(tabName)) {
              tabNamesArr.push(tabName);
              tabNameToId[tabName] = docSnap.id;
            }
            if (docSnap.id === initialPropertyId) {
              foundTabForId = tabName;
            }
          }
        });

        // Ensure 'Our Home' is always first if present
        let orderedTypes = tabNamesArr;
        const ourHomeIdx = orderedTypes.indexOf("Our Home");
        if (ourHomeIdx > 0) {
          orderedTypes = ["Our Home", ...orderedTypes.filter(t => t !== "Our Home")];
        }
        setTabNames(orderedTypes);
        setTabNameToPropertyId(tabNameToId);

        // Determine which tab to select
        if (foundTabForId) {
          initialTab = foundTabForId;
        } else {
          initialTab = sessionStorage.getItem('appTab') || "";
          if (!initialTab || !orderedTypes.includes(initialTab)) {
            initialTab = orderedTypes[0] || "";
          }
        }
        setSelectedTab(initialTab);
        sessionStorage.setItem('appTab', initialTab);

        // If id prop is provided, fetch and set property immediately
        if (initialPropertyId) {
          const docRef = doc(db, "properties", initialPropertyId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProperty(docSnap.data() as PropertyData);
            setCurrentPropertyId(initialPropertyId);
          }
        }
      } catch (error) {
        console.error('Failed to bootstrap properties view:', error);
        setTabNames([]);
        setTabNameToPropertyId({});
        setSelectedTab("");
        setProperty(null);
      } finally {
        setIsPropertyBootstrapping(false);
      }
    }
    buildTabsAndSelect();
  }, []);

  const ResetConditionVariables = () => {
    let alias = '';
    let shared = false;
    let family = false;
    let pmview = true;
    let realPM = false;
    let friend = false;
    if (user && property?.ownerId !== user.uid && Array.isArray(property?.sharedWith)) {
      // sharedWith can be array of objects or strings
      const entry = property?.sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === user.uid);
      if (entry && typeof entry === 'object') {
        shared = true;
        alias = (entry as any).alias || '';
      }
      if (entry?.role === 'PM') {
        pmview = false;
        realPM = true;
      } else if (entry?.role === 'Friend') {
        pmview = false;
        friend = true;
      } else if (entry?.role === 'Family' || entry?.role === 'Family Member' || entry?.role === 'Family Manager') {
        pmview = false;
        family = true;
      }
    }
    setIsSharedMember(shared);
    setIsPMview(pmview);
    setIsRealPM(realPM);
    setIsFriend(friend);
    setIsFamilyMember(family);
    setEditAlias(alias);
  }

  // Re-run condition variables when property changes
  useEffect(() => {
    ResetConditionVariables();
  }, [property]);

  // When selectedTab changes, update property state
  useEffect(() => {
    async function updatePropertyForTab() {
      if (!selectedTab) {
        setProperty(null);
        setCurrentPropertyId("");
        setIsPropertyFetching(false);
        return;
      }
      const propertyId = tabNameToPropertyId[selectedTab];
      if (!propertyId) {
        setProperty(null);
        setCurrentPropertyId("");
        setIsPropertyFetching(false);
        return;
      }
      setIsPropertyFetching(true);
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const docRef = doc(db, "properties", propertyId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProperty(docSnap.data() as PropertyData);
          setCurrentPropertyId(propertyId);
        } else {
          setProperty(null);
          setCurrentPropertyId("");
        }
      } catch (error) {
        console.error('Failed to fetch selected property:', error);
        setProperty(null);
        setCurrentPropertyId("");
      } finally {
        setIsPropertyFetching(false);
      }
    }

    if (selectedTab) {
      sessionStorage.setItem('appTab', selectedTab);
      updatePropertyForTab();
    } else {
      setIsPropertyFetching(false);
    }
  }, [selectedTab, tabNameToPropertyId]);

  // Handler to open edit modal and prefill with current property data
  const [isSharedMember, setIsSharedMember] = useState(false);
  const [isPMview, setIsPMview] = useState(true);
  const [isRealPM, setIsRealPM] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [isFamilyMember, setIsFamilyMember] = useState(false);
  const [editAlias, setEditAlias] = useState('');
  
  //Filtermodal
  const [showFilterModal, setShowFilterModal] = useState(false);

  const handleCloseFilter = () => {
    setShowFilterModal(false);
  }
  
  const handleEditClick = () => {
    if (property) {
      setEditForm({ ...property, id: currentPropertyId });
      setPmCompanyLocal(property.pm_company || '');
      setEditImage(null);
      // Prefill the property tax amount with the latest tax history
      const taxHistory = property?.propertyTaxHistory || [];
      if (taxHistory.length > 0) {
        const latestTax = taxHistory.reduce((prev: any, current: any) => {
          const prevDate = new Date(prev.date).getTime();
          const currentDate = new Date(current.date).getTime();
          return currentDate > prevDate ? current : prev;
        });
        setEditingTaxAmount(latestTax.amount || '');
      } else {
        setEditingTaxAmount('');
      }
      setEditLoading(false); // Reset loading state when opening the dialog
      setEditOpen(true);
    }
  };

  const handleSecurityDepositModal = () => {
    if (property) {
      setEditForm({ ...property, id: currentPropertyId });
      setSecurityDepositModalOpen(true);
    }
  }

  //formatURL
    // const formatUrl = (url: string) => {
    //   if (!url) return '';
    //   // Normalize to ensure protocol
    //   let normalized = url.trim();
    //   if (!/^https?:\/\//i.test(normalized)) {
    //     normalized = 'https://' + normalized;
    //   }
    //   try {
    //     const u = new URL(normalized);
    //     let host = u.hostname;
    //     // Remove www. if present
    //     if (host.startsWith('www.')) host = host.slice(4);
    //     // Get only the first part before the first dot
    //     let main = host.split('.')[0];
    //     // Capitalize first letter
    //     main = main.charAt(0).toUpperCase() + main.slice(1);
    //     return main;
    //   } catch {
    //     // Fallback: try to extract domain manually
    //     let host = normalized.replace(/^https?:\/\//i, '').split('/')[0];
    //     if (host.startsWith('www.')) host = host.slice(4);
    //     let main = host.split('.')[0];
    //     main = main.charAt(0).toUpperCase() + main.slice(1);
    //     return main;
    //   }
    // }

  const handleEnsuranceModal = () => {
    if (property) {
      setEditForm({ ...property, id: currentPropertyId });
      setEditInsuranceOpen(true);
    }
  }

  const handleRentalEnsuranceModal = () => {
    if (property) {
      setEditForm({ ...property, id: currentPropertyId });
      setEditRentalInsuranceOpen(true);
    }
  }

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      (async () => {
        const { getDocs, collection } = await import("firebase/firestore");
        const allPropsSnap = await getDocs(collection(db, "properties"));
        const allPropsArr: any[] = [];
        allPropsSnap.forEach(docSnap => {
          const data = docSnap.data();
          const isOwner = data.ownerId === user.uid;
          let tabName = data.type;
          if (Array.isArray(data.sharedWith) && data.sharedWith.some((sw: any) => sw.userId === user.uid)) {
            const entry = data.sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === user.uid);
            if (entry && typeof entry === 'object' && entry.alias && entry.alias.trim()) {
              tabName = entry.alias;
            }
          }
          if ((isOwner || (Array.isArray(data.sharedWith) && data.sharedWith.some((sw: any) => sw.userId === user.uid))) && tabName) {
            allPropsArr.push({ id: docSnap.id, ...data, tabName });
          }
        });
        setAllProperties(allPropsArr);
      })();
    } else {
      setAllProperties([]);
    }
  }, []); // Remove tabNames dependency to prevent circular updates

  // Edit Modal JSX
  const EditPropertyModal = (
    <Dialog open={editOpen} onClose={() => {
      setEditOpen(false);
      setEditingTaxDate(null);
      setEditingTaxAmount('');
      setTaxDateError('');
      setEditingPaidOffDate(null);
      hideTooltip();
    }} maxWidth="md" fullWidth>
      <FieldTooltipProvider explanations={fieldExplanations} delay={500}>
      <DialogContent sx={{ px: 4, py: 1.5 }}>
        <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 2, ml: -3 }}>Edit Property</DialogTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2,  borderRadius: 2, bgcolor: '#fff' }}>
          {/* Image region and 2x2 grid for Bedrooms, Bathrooms, Square Ft, Year Built */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2, gap: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: { xs: '100%', sm: '60%' }, minWidth: 180 }}>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100%', mb: 2, gap: 2 }}>
                <Box sx={{ width: '60%', minWidth: 120 }}>
                  <Box sx={{ width: '100%', aspectRatio: '16/9', bgcolor: '#ededed', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <Box
                      sx={{ width: '100%', aspectRatio: '16/9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                      onClick={() => {
                        // If a new image was selected, use its original (uncropped) data URL for re-editing
                        const imageToEdit = !isOrigin ? editForm?.originalPhotoUrl : originalImageDataUrl || editForm?.photoUrl || '/empty-property.png';
                        // If the image is the default placeholder, open file picker directly
                        if (!imageToEdit || imageToEdit === '/empty-property.png') {
                          fileInputRef.current?.click();
                        } else {
                          setPhotoPickerImage(imageToEdit);
                          setShowPhotoPicker(true);
                        }
                      }}
                    >
                      {editImage ? (
                        <img src={editImage} alt="Property" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <img src={editForm?.photoUrl || '/empty-property.png'} alt="Property" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                      )}
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ width: '40%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: 1 }}>
                  <Button variant="outlined" size="small" sx={{
                    textTransform: 'none',
                    borderRadius: 2,
                    fontSize: '0.95rem',
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    background: '#fff',
                    border: '1px solid #B0B8C1',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    color: '#212121',
                    minWidth: 0,
                    mt: 6.5,
                    '&:hover': {
                      background: '#f5f5f5',
                      borderColor: '#B0B0B0',
                    },
                  }} onClick={e => { e.stopPropagation(); if (fileInputRef.current) fileInputRef.current.click(); }}>
                    <span style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}>
                      <svg width="20" height="20" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                        <path d="M4.92632 6.4436H4.30432C2.94766 6.4436 1.84766 7.5436 1.84766 8.90026L1.84766 12.1503C1.84766 13.5063 2.94766 14.6063 4.30432 14.6063H11.7243C13.081 14.6063 14.181 13.5063 14.181 12.1503V8.8936C14.181 7.54093 13.0843 6.4436 11.7317 6.4436H11.103" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8.01424 1.91456V9.94189" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M6.07092 3.86676L8.01426 1.91476L9.95826 3.86676" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span style={{ color: '#212121', fontWeight: 400, fontSize: '0.9rem' }}>Change Image</span>
                  </Button>
                  {/* Hidden file input for image selection */}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.tif,.tiff,.webp"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setOriginalImageBlob(file);
                      const reader = new FileReader();
                      reader.onload = () => {
                        setOriginalImageDataUrl(reader.result as string); // Store original image data URL
                        setPhotoPickerImage(reader.result as string);
                        setShowPhotoPicker(true);
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                  {/* PhotoPicker modal, only shown when triggered */}
                  <Dialog open={showPhotoPicker && !!photoPickerImage} onClose={() => {
                    setShowPhotoPicker(false);
                    setPhotoPickerImage(null);
                  }} maxWidth="md" fullWidth>
                    <Box>
                      {photoPickerImage && (
                        <PhotoPicker
                          aspect={16 / 9}
                          imageSrc={photoPickerImage}
                          onCropped={async (blob, previewUrl) => {
                            setShowPhotoPicker(false);
                            setPhotoPickerImage(null);
                            if (blob && previewUrl) {
                              setEditImage(previewUrl);
                              setEditImageBlob(blob);
                            } else {
                              // Defensive: show error if crop failed
                              alert('Failed to crop image. Please try again.');
                            }
                            setIsOrigin(true);
                          }}
                          onClose={() => {
                            setShowPhotoPicker(false);
                            setPhotoPickerImage(null);
                            setIsOrigin(false);
                          }}
                        />
                      )}
                    </Box>
                  </Dialog>
                </Box>
              </Box>
            </Box>
            {/* 2x2 grid for Bedrooms, Bathrooms, Square Ft, Year Built */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
              mb: 2,
              ml: 3,
              width: { xs: '100%', sm: '40%' },
              minWidth: 220,
            }}>
              <TextField
                label="Bedrooms"
                placeholder="e.g. 3"
                fullWidth
                value={editForm?.bedrooms !== undefined && editForm?.bedrooms !== null ? String(editForm.bedrooms) : ''}
                onChange={e => {
                  const val = e.target.value.replace(/[^\d]/g, '');
                  setEditForm(f => f ? { ...f, bedrooms: val ? Number(val) : 0 } : f);
                }}
                sx={{ bgcolor: '#fff' }}
                inputProps={{ inputMode: 'numeric', maxLength: 2 }}
              />
              <TextField
                label="Bathrooms"
                placeholder="e.g. 4"
                fullWidth
                value={editForm?.bathsTotal !== undefined && editForm?.bathsTotal !== null ? String(editForm.bathsTotal) : ''}
                onChange={e => {
                  const val = e.target.value.replace(/[^\d.]/g, '');
                  setEditForm(f => f ? { ...f, bathsTotal: val ? Number(val) : 0 } : f);
                }}
                sx={{ bgcolor: '#fff' }}
                inputProps={{ inputMode: 'decimal', maxLength: 2 }}
              />
              <TextField
                label="Square Ft"
                placeholder="e.g. 1200"
                fullWidth
                value={editForm?.squareFeet !== undefined && editForm?.squareFeet !== null ? String(editForm.squareFeet) : ''}
                onChange={e => {
                  const val = e.target.value.replace(/[^\d]/g, '');
                  setEditForm(f => f ? { ...f, squareFeet: val ? Number(val) : 0 } : f);
                }}
                sx={{ bgcolor: '#fff', mt: 3}}
                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
              />
              <Autocomplete
                options={(() => {
                  const currentYear = new Date().getFullYear();
                  const years = [];
                  for (let y = currentYear; y >= 1800; y--) years.push(String(y));
                  return years;
                })()}
                value={editForm?.yearBuilt ? String(editForm.yearBuilt) : ''}
                onChange={(_e, newValue) => {
                  const year = Number(newValue);
                  const currentYear = new Date().getFullYear();
                  if (!year || year > currentYear) return;
                  setEditForm(f => f ? { ...f, yearBuilt: year } : f);
                }}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Year Built"
                    placeholder="e.g. 2015"
                    fullWidth
                    sx={{ bgcolor: '#fff' }}
                    inputProps={{ ...params.inputProps, inputMode: 'numeric', maxLength: 4 }}
                  />
                )}
                disableClearable
                sx={{ mt: 3 }}
              />
            </Box>
          </Box>
          {/* Show alias field for shared members, otherwise property tag with rental toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                {isSharedMember ? (
                  <TextField
                    label="Rename for me only"
                    placeholder="Your custom name for this property"
                    value={editAlias}
                    inputProps={{ maxLength: 15 }}
                    onChange={e => setEditAlias(e.target.value)}
                    fullWidth
                  />
                ) : (
                  <TooltipField fieldKey="propertyTag" value={editForm?.type}>
                  <Autocomplete
                    freeSolo
                    options={["Our Home", "Parents House", "Rental"]}
                    value={editForm?.type || ''}
                    onChange={(
                      _event: React.SyntheticEvent,
                      newValue: string | null
                    ) => {
                      const newTag = (newValue || '').trim();
                      setEditForm(f => f ? { ...f, type: newTag } : f);
                      if (tabNames.includes(newTag) && newTag !== property?.type) {
                        setPropertyTagError('This property tag already exists.');
                      } else {
                        setPropertyTagError('');
                      }
                    }}
                    onInputChange={(
                      _event: React.SyntheticEvent,
                      newInputValue: string
                    ) => {
                      const newTag = newInputValue.trim();
                      setEditForm(f => f ? { ...f, type: newTag } : f);
                      if (tabNames.includes(newTag) && newTag !== property?.type) {
                        setPropertyTagError('This property tag already exists.');
                      } else {
                        setPropertyTagError('');
                      }
                    }}
                    renderInput={(params: any) => (
                      <TextField
                        {...params}
                        label="Property Tag"
                        placeholder="Example - Our Home, Parents House or Rental"
                        fullWidth
                        inputProps={{ ...params.inputProps, maxLength: 15 }}
                        error={!!propertyTagError}
                        helperText={propertyTagError}
                      />
                    )}
                  />
                  </TooltipField>
                )}
              </Box>
              {!isSharedMember && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 160 }}>
                <span style={{ fontSize: 14, fontWeight: 550, color: "#343748", marginRight: 8 }}>Rental Property</span>
                <Switch
                  checked={editForm?.isRental}
                  onChange={e => {
                    const checked = e.target.checked;
                    setEditForm(f => f ? { ...f, isRental: checked } : f);
                  }}
                  inputProps={{ 'aria-label': 'Rental Property toggle' }}
                  sx={{
                    ml: 1,
                    width: 40,
                    height: 24,
                    p: 0,
                    display: 'flex',
                    alignItems: 'center',
                    '& .MuiSwitch-switchBase': {
                      top: '50%',
                      transform: 'translateY(-50%)',
                      '&.Mui-checked': {
                        transform: 'translateX(14.5px) translateY(-50%)',
                        color: '#fff',
                        '& + .MuiSwitch-track': {
                          backgroundColor: '#89AE99',
                          opacity: 1,
                        },
                      },
                    },
                    '& .MuiSwitch-thumb': {
                      width: 15,
                      height: 15,
                      boxShadow: 'none',
                      backgroundColor: '#fff',
                      transition: 'all 0.3s',
                      position: 'relative',
                      top: '0px',
                      left: '-3px',
                    },
                    '& .MuiSwitch-track': {
                      borderRadius: 18,
                      backgroundColor: '#A6A6A6',
                      opacity: 1,
                      transition: 'all 0.3s',
                    },
                  }}
                />
              </Box>
              )}
            </Box>
          </Box>

          {editForm?.isRental && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TooltipField fieldKey="pm_company" sx={{ flex: 1 }} value={pmCompanyLocal}>
                <TextField 
                  label="Property Management Company" 
                  fullWidth 
                  value={pmCompanyLocal} 
                  onChange={e => setPmCompanyLocal(e.target.value)} 
                  onBlur={() => setEditForm(f => f ? { ...f, pm_company: pmCompanyLocal } : f)} 
                  sx={{ mb: 1 }} 
                  inputProps={{ maxLength: 30 }}
                />
              </TooltipField>
              <TooltipField fieldKey="pm_rate" sx={{ flex: 1 }} value={editForm?.pm_rate}>
                <TextField
                  label="Property Management Rate"
                  placeholder="Optional"
                  fullWidth
                  value={(() => {
                    const val = editForm?.pm_rate || '';
                    if (!val) return '';
                    return val.endsWith('%') ? val : val + '%';
                  })()}
                  onChange={e => {
                    let raw = e.target.value.replace(/%/g, '');
                    if (!/^\d*(\.\d{0,2})?$/.test(raw)) return;
                    if (raw.startsWith('00')) raw = raw.replace(/^0+/, '0');
                    const rateNum = parseFloat(raw);
                    // Enforce limits: 0.01 to 99.99
                    if (raw) {
                      if (rateNum < 0.01 || rateNum > 99.99) return;
                    }
                    setEditForm(f => f ? { ...f, pm_rate: raw } : f);
                    const input = e.target as HTMLInputElement;
                    window.requestAnimationFrame(() => {
                      input.setSelectionRange(raw.length, raw.length);
                    });
                  }}
                  inputProps={{ inputMode: 'decimal', maxLength: 7, style: { textAlign: 'left' } }}
                />
              </TooltipField>
            </Box>
          )}

          <TextField label="Address" fullWidth value={editForm?.address1 || ''} onChange={e => setEditForm(f => f ? { ...f, address1: e.target.value } : f)} sx={{ mb: 1 }} inputProps={{ maxLength: 50 }} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="City" fullWidth value={editForm?.city || ''} onChange={e => setEditForm(f => f ? { ...f, city: e.target.value } : f)} sx={{ mb: 1, flex: 1 }} inputProps={{ maxLength: 15 }} />
            {/* US State Dropdown */}
            <Autocomplete
              options={["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
                "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
                "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
                "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
                "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"]}
              value={editForm?.state || ''}
              onChange={(_event, newValue) => setEditForm(f => f ? { ...f, state: newValue || '' } : f)}
              renderInput={params => (
                <TextField {...params} label="State" fullWidth sx={{ flex: 1 }} />
              )}
              sx={{ flex: 1 }}
              autoHighlight
              autoSelect
              freeSolo={false}
            />
            <TextField label="Zip Code" fullWidth value={editForm?.zip || ''} onChange={e => {
              const val = e.target.value.replace(/[^\d]/g, '');
              if (val.length <= 15) {
                setEditForm(f => f ? { ...f, zip: val } : f);
              }
            }} sx={{ flex: 1 }} inputProps={{ inputMode: 'numeric', maxLength: 15 }} />
          </Box>
          <Typography variant="subtitle1" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mt: 1, fontSize: { xs: 13, sm: 16, md: 18 } }}>
            Purchased Price and Date</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TooltipField fieldKey="price" sx={{ flex: 1 }} value={editForm?.price}>
              <TextField
                label="Purchased Price"
                fullWidth
                value={editForm?.price || ''}
                onChange={e => {
                  let input = e.target.value;
                  input = input.replace(/[^0-9.]/g, '');
                  const parts = input.split('.');
                  if (parts.length > 2) return;
                  // Limit before decimal to 8 digits
                  if (parts[0].length > 8) return;
                  if (parts[1] && parts[1].length > 2) return;
                  setEditForm(f => f ? { ...f, price: input } : f);
                }}
                sx={{ bgcolor: '#fff' }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                inputProps={{ inputMode: 'numeric', min: 0, maxLength: 11 }}
              />
            </TooltipField>
            <TooltipField fieldKey="date" sx={{ flex: 1 }} value={editForm?.date}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Purchased Date"
                  value={editForm?.date && isValidDateFns(parseDateFns(editForm.date, 'MM/dd/yyyy', new Date()))
                    ? parseDateFns(editForm.date, 'MM/dd/yyyy', new Date())
                    : null}
                  disableFuture
                  onChange={date => {
                    let newDate = '';
                    if (date instanceof Date && isValidDateFns(date)) {
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      if (date > today) {
                        // If future, do not update
                        date = today;
                      }
                      newDate = formatDateFns(date, 'MM/dd/yyyy');
                    }
                    setEditForm(f => f ? { ...f, date: newDate } : f);
                  }}
                  slotProps={{ textField: { fullWidth: true, sx: { bgcolor: '#fff' } } }}
                  format="MM/dd/yyyy"
                />
              </LocalizationProvider>
            </TooltipField>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
            <Typography variant="subtitle1" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: { xs: 13, sm: 16, md: 18 } }}>Mortgage Information</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 550, color: "#343748", marginRight: 8 }}>{editForm?.noMortgage ? 'Paid Off' : 'No Mortgage'}</span>
              <Switch
                checked={!!editForm?.noMortgage}
                onChange={e => {
                  const checked = e.target.checked;
                  setEditForm(f => f ? { ...f, noMortgage: checked } : f);
                }}
                inputProps={{ 'aria-label': 'No Mortgage toggle' }}
                sx={{
                  ml: 1,
                  width: 40,
                  height: 24,
                  p: 0,
                  display: 'flex',
                  alignItems: 'center',
                  '& .MuiSwitch-switchBase': {
                    top: '50%',
                    transform: 'translateY(-50%)',
                    '&.Mui-checked': {
                      transform: 'translateX(14.5px) translateY(-50%)',
                      color: '#fff',
                      '& + .MuiSwitch-track': {
                        backgroundColor: '#B94B41',
                        opacity: 1,
                      },
                    },
                  },
                  '& .MuiSwitch-thumb': {
                    width: 15,
                    height: 15,
                    boxShadow: 'none',
                    backgroundColor: '#fff',
                    transition: 'all 0.3s',
                    position: 'relative',
                    top: '0px',
                    left: '-3px',
                  },
                  '& .MuiSwitch-track': {
                    borderRadius: 18,
                    backgroundColor: '#A6A6A6',
                    opacity: 1,
                    transition: 'all 0.3s',
                  },
                }}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: editForm?.noMortgage ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)' }, gap: 2, alignItems: 'flex-start' }}>
            {editForm?.noMortgage ? (
              // When Paid Off (noMortgage = true): Show simple 2x2 grid
              <>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Date You Paid House Off"
                    disableFuture
                    minDate={editForm?.date && isValidDateFns(parseDateFns(editForm.date, 'MM/dd/yyyy', new Date()))
                      ? parseDateFns(editForm.date, 'MM/dd/yyyy', new Date())
                      : undefined}
                    value={editingPaidOffDate || (editForm?.mortgagePaidOffDate ? parseLongDate(editForm?.mortgagePaidOffDate) : null)}
                    onChange={(date) => {
                      // Prevent selecting a paid off date before purchase date
                      let purchaseDate = editForm?.date && isValidDateFns(parseDateFns(editForm.date, 'MM/dd/yyyy', new Date()))
                        ? parseDateFns(editForm.date, 'MM/dd/yyyy', new Date())
                        : null;
                      if (purchaseDate && date && date < purchaseDate) {
                        setEditingPaidOffDate(purchaseDate);
                      } else {
                        setEditingPaidOffDate(date);
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        sx: {
                          bgcolor: '#fff',
                          fontFamily: 'Nunito, Arial, sans-serif',
                        },
                      },
                    }}
                    format="MM/dd/yyyy"
                  />
                </LocalizationProvider>
                <TextField
                  label="HOA Dues"
                  placeholder="Optional"
                  fullWidth
                  value={editForm?.hoa || ''}
                  onChange={e => {
                    let input = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = input.split('.');
                    // Only allow 1 decimal point
                    if (parts.length > 2) return;
                    // Limit before decimal to 5 digits
                    if (parts[0].length > 5) return;
                    // Limit after decimal to 2 digits
                    if (parts[1] && parts[1].length > 2) return;
                    // Prevent value above 99999.99
                    const asNumber = parseFloat(input);
                    if (!isNaN(asNumber) && asNumber > 99999.99) return;
                    setEditForm(f => f ? { ...f, hoa: input } : f);
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal', maxLength: 8 }}
                />
                <Autocomplete
                  options={['Monthly', 'Yearly']}
                  value={editForm?.yearly || ''}
                  onChange={(_event, newValue) => {
                    setEditForm(f => f ? { ...f, yearly: newValue || '' } : f);
                  }}
                  fullWidth
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="HOA Payment" 
                      inputProps={{ ...params.inputProps, readOnly: true }}
                    />
                  )}
                />
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, gridColumn: '1 / -1' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Property Tax Due Date"
                    value={editingTaxDate || ((() => {
                      const taxHistory = property?.propertyTaxHistory || [];
                      if (taxHistory.length === 0) return null;
                      const sortedTaxes = [...taxHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                      const dateStr = sortedTaxes[0].date;
                      const parsedDate = parseLongDate(dateStr);
                      return parsedDate;
                    })())}
                    maxDate={new Date()}
                    onChange={date => {
                      let newDate = null;
                      if (date instanceof Date && isValidDateFns(date)) {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        if (date > today) {
                          // If future, do not update
                          newDate = today;
                        } else {
                          newDate = date;
                        }
                      }
                      setEditingTaxDate(newDate);
                      setTaxDateError('');
                      // Check if date already exists in other entries (not just latest)
                      if (newDate) {
                        const selectedYear = new Date(newDate).getFullYear();
                        const taxHistory = property?.propertyTaxHistory || [];
                        // If editing, exclude the currently selected entry from duplicate check
                        let excludeDate = null;
                        if (selectedPropertyTaxYear) {
                          excludeDate = selectedPropertyTaxYear.date;
                        }
                        const yearExists = taxHistory.some((item: any) => {
                          const itemYear = new Date(item.date).getFullYear();
                          if (excludeDate && item.date === excludeDate) return false;
                          return itemYear === selectedYear;
                        });
                        if (yearExists) {
                          setTaxDateError('This Tax Year has already been recorded');
                        }
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        sx: {
                          bgcolor: '#fff',
                          fontFamily: 'Nunito, Arial, sans-serif',
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
                {taxDateError && (
                  <Typography sx={{ color: '#d32f2f', fontSize: '0.75rem', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.25 }}>
                    {taxDateError}
                  </Typography>
                )}
                </Box>
                <TextField
                  label="Property Tax Amount"
                  fullWidth
                  value={editingTaxAmount}
                  onChange={(e) => {
                    let input = e.target.value;
                    input = input.replace(/[^0-9.]/g, '');
                    const parts = input.split('.');
                    if (parts.length > 2) return;
                    // Limit before decimal to 7 digits
                    if (parts[0].length > 7) return;
                    if (parts[1] && parts[1].length > 2) return;
                    setEditingTaxAmount(input);
                  }}
                  onBlur={() => {
                    if (editingTaxAmount === '' || editingTaxAmount === null) return;
                    const num = parseFloat(editingTaxAmount);
                    if (isNaN(num)) return;
                    setEditingTaxAmount(num.toFixed(2));
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal', maxLength: 10 }}
                />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, gridColumn: '1 / -1' }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Insurance Due Date"
                    value={editForm?.insurance?.dueDate && isValidDateFns(parseDateFns(editForm.insurance.dueDate, 'MM/dd/yyyy', new Date()))
                      ? parseDateFns(editForm.insurance.dueDate, 'MM/dd/yyyy', new Date())
                      : null}
                    onChange={date => {
                      if (date instanceof Date && isValidDateFns(date)) {
                        const formatted = formatDateFns(date, 'MM/dd/yyyy');
                        setEditForm(f => f ? { 
                          ...f, 
                          insurance: { 
                            insuranceCompany: f.insurance?.insuranceCompany || '',
                            assetsCovered: f.insurance?.assetsCovered || '',
                            policyNumber: f.insurance?.policyNumber || '',
                            amount: f.insurance?.amount || '',
                            frequency: f.insurance?.frequency || '',
                            dueDate: formatted 
                          } 
                        } : f);
                      } else {
                        setEditForm(f => f ? { 
                          ...f, 
                          insurance: { 
                            insuranceCompany: f.insurance?.insuranceCompany || '',
                            assetsCovered: f.insurance?.assetsCovered || '',
                            policyNumber: f.insurance?.policyNumber || '',
                            amount: f.insurance?.amount || '',
                            frequency: f.insurance?.frequency || '',
                            dueDate: '' 
                          } 
                        } : f);
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        sx: {
                          bgcolor: '#fff',
                          fontFamily: 'Nunito, Arial, sans-serif',
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
                <TextField
                  label="Insurance Amount"
                  fullWidth
                  value={editForm?.insurance?.amount || ''}
                  onChange={e => {
                    let input = e.target.value;
                    input = input.replace(/[^0-9.]/g, '');
                    const parts = input.split('.');
                    if (parts.length > 2) return;
                    if (parts[1] && parts[1].length > 2) return;
                    setEditForm(f => f ? { 
                      ...f, 
                      insurance: { 
                        insuranceCompany: f.insurance?.insuranceCompany || '',
                        assetsCovered: f.insurance?.assetsCovered || '',
                        policyNumber: f.insurance?.policyNumber || '',
                        dueDate: f.insurance?.dueDate || '',
                        frequency: f.insurance?.frequency || '',
                        amount: input 
                      } 
                    } : f);
                  }}
                  onBlur={() => {
                    const val = editForm?.insurance?.amount;
                    if (!val || val === '') return;
                    const num = parseFloat(val);
                    if (isNaN(num)) return;
                    setEditForm(f => f ? { 
                      ...f, 
                      insurance: { 
                        insuranceCompany: f.insurance?.insuranceCompany || '',
                        assetsCovered: f.insurance?.assetsCovered || '',
                        policyNumber: f.insurance?.policyNumber || '',
                        dueDate: f.insurance?.dueDate || '',
                        frequency: f.insurance?.frequency || '',
                        amount: num.toFixed(2) 
                      } 
                    } : f);
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal', maxLength: 12 }}
                />
                <Autocomplete
                  options={['Monthly', 'Yearly']}
                  value={editForm?.insurance?.frequency || ''}
                  onChange={(_event, newValue) => {
                    setEditForm(f => f ? { 
                      ...f, 
                      insurance: { 
                        insuranceCompany: f.insurance?.insuranceCompany || '',
                        assetsCovered: f.insurance?.assetsCovered || '',
                        policyNumber: f.insurance?.policyNumber || '',
                        dueDate: f.insurance?.dueDate || '',
                        amount: f.insurance?.amount || '',
                        frequency: newValue || '' 
                      } 
                    } : f);
                  }}
                  fullWidth
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Insurance Payment" 
                      inputProps={{ ...params.inputProps, readOnly: true }}
                    />
                  )}
                />
                </Box>
              </>
            ) : (
              // When No Mortgage (noMortgage = false): Show full mortgage fields
              <>
                <TooltipField fieldKey="interestRate" value={editForm?.interestRate}>
                  <TextField
                    label="Interest Rate"
                    placeholder="Optional"
                    fullWidth
                    value={(() => {
                      const val = editForm?.interestRate || '';
                      if (!val) return '';
                      return val.endsWith('%') ? val : val + '%';
                    })()}
                    onChange={e => {
                      let raw = e.target.value.replace(/%/g, '');
                      if (!/^\d*(\.\d{0,2})?$/.test(raw)) return;
                      if (raw.startsWith('00')) raw = raw.replace(/^0+/, '0');
                      const rateNum = parseFloat(raw);
                      // Enforce limits: 0.01 to 99.99
                      if (raw) {
                        if (rateNum < 0.01 || rateNum > 99.99) return;
                      }
                      setEditForm(f => f ? { ...f, interestRate: raw } : f);
                      const input = e.target as HTMLInputElement;
                      window.requestAnimationFrame(() => {
                        input.setSelectionRange(raw.length, raw.length);
                      });
                    }}
                    inputProps={{ inputMode: 'decimal', pattern: '[0-9.]*', maxLength: 7, style: { textAlign: 'left' } }}
                  />
                </TooltipField>
                <TooltipField fieldKey="mortgageBalance" value={editForm?.balance}>
                  <TextField
                    label="Balance"
                    placeholder="Optional"
                    fullWidth
                    value={editForm?.balance || ''}
                    onChange={e => {
                      let input = e.target.value;
                      input = input.replace(/[^0-9.]/g, '');
                      const parts = input.split('.');
                      if (parts.length > 2) return;
                      // Limit before decimal to 8 digits
                      if (parts[0].length > 8) return;
                      if (parts[1] && parts[1].length > 2) return;
                      setEditForm(f => f ? { ...f, balance: input } : f);
                    }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    inputProps={{ inputMode: 'decimal', maxLength: 11 }}
                  />
                </TooltipField>
                <TooltipField fieldKey="estimatedValue" value={editForm?.estimatedValue}>
                  <TextField
                    label="Estimate Value"
                    placeholder="Optional"
                    fullWidth
                    value={editForm?.estimatedValue || ''}
                    onChange={e => {
                      let input = e.target.value;
                      input = input.replace(/[^0-9.]/g, '');
                      const parts = input.split('.');
                      if (parts.length > 2) return;
                      if (parts[1] && parts[1].length > 2) return;
                      setEditForm(f => f ? { ...f, estimatedValue: input } : f);
                    }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    inputProps={{ inputMode: 'decimal', maxLength: 9 }}
                  />
                </TooltipField>
                <TooltipField fieldKey="pmi" value={editForm?.pmi}>
                  <TextField
                    label="PMI"
                    placeholder="Optional"
                    fullWidth
                    value={editForm?.pmi || ''}
                    onChange={e => {
                      let input = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = input.split('.');
                      // Only allow 1 decimal point
                      if (parts.length > 2) return;
                      // Limit before decimal to 4 digits
                      if (parts[0].length > 4) return;
                      // Limit after decimal to 2 digits
                      if (parts[1] && parts[1].length > 2) return;
                      // Prevent value above 9999.99
                      const asNumber = parseFloat(input);
                      if (!isNaN(asNumber) && asNumber > 9999.99) return;
                      setEditForm(f => f ? { ...f, pmi: input } : f);
                    }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    inputProps={{ inputMode: 'decimal', maxLength: 7 }}
                  />
                </TooltipField>
                <Box sx={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1.1fr 1.6fr 0.8fr auto', gap: 2, alignItems: 'center' }}>
                  <TooltipField fieldKey="term" value={editForm?.term}>
                    <Autocomplete
                      options={['10 Year Fixed', '15 Year Fixed', '20 Year Fixed', '30 Year Fixed', '40 Year Fixed', '50 Year Fixed']}
                      value={editForm?.term || ''}
                      onChange={(_event, newValue) => {
                        setEditForm(f => f ? { ...f, term: newValue || '' } : f);
                      }}
                      fullWidth
                      renderInput={(params) => (
                        <TextField {...params} label="Term" placeholder="Optional" />
                      )}
                    />
                  </TooltipField>
                  <TooltipField fieldKey="currentLender" value={editForm?.lender}>
                    <TextField
                      label="Current Lender"
                      placeholder="Optional"
                      fullWidth
                      value={editForm?.lender || ''}
                      onChange={e => setEditForm(f => f ? { ...f, lender: e.target.value } : f)}
                      inputProps={{ maxLength: 15 }}
                    />
                  </TooltipField>
                  <TooltipField fieldKey="mortgagePayment" value={editForm?.mortgagePaymentAmount}>
                    <TextField
                      label="Mortgage Payment"
                      placeholder="Optional"
                      fullWidth
                      value={editForm?.mortgagePaymentAmount || ''}
                      onChange={e => {
                        let input = e.target.value;
                        input = input.replace(/[^0-9.]/g, '');
                        const parts = input.split('.');
                        if (parts.length > 2) return;
                        // Limit before decimal to 5 digits
                        if (parts[0].length > 5) return;
                        if (parts[1] && parts[1].length > 2) return;
                        setEditForm(f => f ? { ...f, mortgagePaymentAmount: input } : f);
                      }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                      inputProps={{ inputMode: 'decimal', maxLength: 8 }}
                    />
                  </TooltipField>
                  <TooltipField fieldKey="escrowAccount" value="">
                    <Box 
                      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 550, color: "#343748", marginRight: 5, cursor: 'help' }}>Escrow Account</span>
                      <Switch
                        checked={editForm?.isPT}
                        onChange={e => {
                          const checked = e.target.checked;
                          setEditForm(f => f ? { ...f, isPT: checked } : f);
                          if (!checked) {
                            const active = document.activeElement;
                            if (active instanceof HTMLElement) active.blur();
                          }
                        }}
                        inputProps={{ 'aria-label': 'Escrow Account toggle' }}
                        sx={{
                          ml: 1,
                          width: 40,
                          height: 24,
                          p: 0,
                          display: 'flex',
                          alignItems: 'center',
                          '& .MuiSwitch-switchBase': {
                            top: '50%',
                            transform: 'translateY(-50%)',
                            '&.Mui-checked': {
                              transform: 'translateX(14.5px) translateY(-50%)',
                              color: '#fff',
                              '& + .MuiSwitch-track': {
                                backgroundColor: '#89AE99',
                                opacity: 1,
                              },
                            },
                          },
                          '& .MuiSwitch-thumb': {
                            width: 15,
                            height: 15,
                            boxShadow: 'none',
                            backgroundColor: '#fff',
                            transition: 'all 0.3s',
                            position: 'relative',
                            top: '0px',
                            left: '-3px',
                          },
                          '& .MuiSwitch-track': {
                            borderRadius: 18,
                            backgroundColor: '#A6A6A6',
                            opacity: 1,
                            transition: 'all 0.3s',
                          },
                        }}
                      />
                    </Box>
                  </TooltipField>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, gridColumn: '1 / -1' }}>
                  <TooltipField fieldKey="hoa" value={editForm?.hoa}>
                    <TextField
                      label="HOA Dues"
                      placeholder="Optional"
                      fullWidth
                      value={editForm?.hoa || ''}
                      onChange={e => {
                        let input = e.target.value;
                        input = input.replace(/[^0-9.]/g, '');
                        const parts = input.split('.');
                        if (parts.length > 2) return;
                        if (parts[1] && parts[1].length > 2) return;
                        setEditForm(f => f ? { ...f, hoa: input } : f);
                      }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                      inputProps={{ inputMode: 'decimal', maxLength: 9 }}
                    />
                  </TooltipField>
                  <TooltipField fieldKey="hoaPayment" value={editForm?.yearly}>
                    <Autocomplete
                      options={['Monthly', 'Yearly']}
                      value={editForm?.yearly || ''}
                      onChange={(_event, newValue) => {
                        setEditForm(f => f ? { ...f, yearly: newValue || '' } : f);
                      }}
                      fullWidth
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label="HOA Payment" 
                          inputProps={{ ...params.inputProps, readOnly: true }}
                        />
                      )}
                    />
                  </TooltipField>
                </Box>
              </>
            )}
          </Box>
          {!editForm?.noMortgage && !editForm?.isPT && (
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <TooltipField fieldKey="propertyTaxDate" value={editingTaxDate}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Property Tax Due Date"
                  value={editingTaxDate || ((() => {
                    const taxHistory = property?.propertyTaxHistory || [];
                    if (taxHistory.length === 0) return null;
                    const sortedTaxes = [...taxHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    const dateStr = sortedTaxes[0].date;
                    const parsedDate = parseLongDate(dateStr);
                    return parsedDate;
                  })())}
                  maxDate={new Date()}
                  onChange={date => {
                    let newDate = null;
                    if (date instanceof Date && isValidDateFns(date)) {
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      if (date > today) {
                        // If future, do not update
                        newDate = today;
                      } else {
                        newDate = date;
                      }
                    }
                    setEditingTaxDate(newDate);
                    setTaxDateError('');
                    // Check if date already exists in other entries (not just latest)
                    if (newDate) {
                      const selectedYear = new Date(newDate).getFullYear();
                      const taxHistory = property?.propertyTaxHistory || [];
                      // If editing, exclude the currently selected entry from duplicate check
                      let excludeDate = null;
                      if (selectedPropertyTaxYear) {
                        excludeDate = selectedPropertyTaxYear.date;
                      }
                      const yearExists = taxHistory.some((item: any) => {
                        const itemYear = new Date(item.date).getFullYear();
                        if (excludeDate && item.date === excludeDate) return false;
                        return itemYear === selectedYear;
                      });
                      if (yearExists) {
                        setTaxDateError('This Tax Year has already been recorded');
                      }
                    }
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      sx: {
                        bgcolor: '#fff',
                        fontFamily: 'Nunito, Arial, sans-serif',
                      },
                    },
                  }}
                />
              </LocalizationProvider>
            </TooltipField>
            <TooltipField fieldKey="propertyTaxAmount" value={editingTaxAmount}>
              <TextField
                label="Property Tax Amount"
                fullWidth
                value={editingTaxAmount}
                onChange={(e) => {
                  let input = e.target.value;
                  input = input.replace(/[^0-9.]/g, '');
                  const parts = input.split('.');
                  if (parts.length > 2) return;
                  if (parts[1] && parts[1].length > 2) return;
                  setEditingTaxAmount(input);
                }}
                onBlur={() => {
                  if (editingTaxAmount === '' || editingTaxAmount === null) return;
                  const num = parseFloat(editingTaxAmount);
                  if (isNaN(num)) return;
                  setEditingTaxAmount(num.toFixed(2));
                }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                inputProps={{ inputMode: 'decimal', maxLength: 12 }}
              />
            </TooltipField>
          </Box>
          )}
          {!editForm?.noMortgage && !editForm?.isPT && (
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TooltipField fieldKey="insuranceDueDate" value={editForm?.insurance?.dueDate}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Insurance Due Date"
                  value={editForm?.insurance?.dueDate && isValidDateFns(parseDateFns(editForm.insurance.dueDate, 'MM/dd/yyyy', new Date()))
                    ? parseDateFns(editForm.insurance.dueDate, 'MM/dd/yyyy', new Date())
                    : null}
                  onChange={date => {
                    if (date instanceof Date && isValidDateFns(date)) {
                      const formatted = formatDateFns(date, 'MM/dd/yyyy');
                      setEditForm(f => f ? { 
                        ...f, 
                        insurance: { 
                          insuranceCompany: f.insurance?.insuranceCompany || '',
                          assetsCovered: f.insurance?.assetsCovered || '',
                          policyNumber: f.insurance?.policyNumber || '',
                          amount: f.insurance?.amount || '',
                          frequency: f.insurance?.frequency || '',
                          dueDate: formatted 
                        } 
                      } : f);
                    } else {
                      setEditForm(f => f ? { 
                        ...f, 
                        insurance: { 
                          insuranceCompany: f.insurance?.insuranceCompany || '',
                          assetsCovered: f.insurance?.assetsCovered || '',
                          policyNumber: f.insurance?.policyNumber || '',
                          amount: f.insurance?.amount || '',
                          frequency: f.insurance?.frequency || '',
                          dueDate: '' 
                        } 
                      } : f);
                    }
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      sx: {
                        bgcolor: '#fff',
                        fontFamily: 'Nunito, Arial, sans-serif',
                      },
                    },
                  }}
                />
              </LocalizationProvider>
            </TooltipField>
            <TooltipField fieldKey="insuranceAmount" value={editForm?.insurance?.amount}>
              <TextField
                label="Insurance Amount"
                fullWidth
                value={editForm?.insurance?.amount || ''}
                onChange={e => {
                  let input = e.target.value;
                  input = input.replace(/[^0-9.]/g, '');
                  const parts = input.split('.');
                  if (parts.length > 2) return;
                  if (parts[1] && parts[1].length > 2) return;
                  setEditForm(f => f ? { 
                    ...f, 
                    insurance: { 
                      insuranceCompany: f.insurance?.insuranceCompany || '',
                      assetsCovered: f.insurance?.assetsCovered || '',
                      policyNumber: f.insurance?.policyNumber || '',
                      dueDate: f.insurance?.dueDate || '',
                      frequency: f.insurance?.frequency || '',
                      amount: input 
                    } 
                  } : f);
                }}
                onBlur={() => {
                  const val = editForm?.insurance?.amount;
                  if (!val || val === '') return;
                  const num = parseFloat(val);
                  if (isNaN(num)) return;
                  setEditForm(f => f ? { 
                    ...f, 
                    insurance: { 
                      insuranceCompany: f.insurance?.insuranceCompany || '',
                      assetsCovered: f.insurance?.assetsCovered || '',
                      policyNumber: f.insurance?.policyNumber || '',
                      dueDate: f.insurance?.dueDate || '',
                      frequency: f.insurance?.frequency || '',
                      amount: num.toFixed(2) 
                    } 
                  } : f);
                }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                inputProps={{ inputMode: 'decimal', maxLength: 12 }}
              />
            </TooltipField>
            <TooltipField fieldKey="insurancePayment" value={editForm?.insurance?.frequency}>
              <Autocomplete
                options={['Monthly', 'Yearly']}
                value={editForm?.insurance?.frequency || ''}
                onChange={(_event, newValue) => {
                  setEditForm(f => f ? { 
                    ...f, 
                    insurance: { 
                      insuranceCompany: f.insurance?.insuranceCompany || '',
                      assetsCovered: f.insurance?.assetsCovered || '',
                      policyNumber: f.insurance?.policyNumber || '',
                      dueDate: f.insurance?.dueDate || '',
                      amount: f.insurance?.amount || '',
                      frequency: newValue || '' 
                    } 
                  } : f);
                }}
                fullWidth
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Insurance Payment" 
                    inputProps={{ ...params.inputProps, readOnly: true }}
                  />
                )}
              />
            </TooltipField>
          </Box>
          )}
        </Box>
        {taxDateError && !editForm?.noMortgage && !editForm?.isPT && (
          <Typography sx={{ color: '#d32f2f', fontSize: '0.75rem', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.25 }}>
            {taxDateError}
          </Typography>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, mb: 2 }}>
          <Button
            variant="contained"
            sx={{
              bgcolor: '#fff', // grey by default
              color: '#555',
              px: 4,
              py: 1.5,
              borderRadius: 2,
              minWidth: 120,
              fontSize: 18,
              border: '1.5px solid #888',
              fontFamily: 'Nunito, Arial, sans-serif',
              boxShadow: 'none',
              textTransform: 'none',
              '&:hover': {
                bgcolor: '#E57373', // red on hover,
                color: '#fff',
                borderColor: '#d32f2f',
              },
            }}
            onClick={() => setShowFirstDeleteConfirm(true)}
          >
            Delete
          </Button>

          {/* Shared backdrop for delete modals */}
          {(showFirstDeleteConfirm || showSecondDeleteConfirm) && (
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1299,
              }}
              onClick={() => {
                setShowFirstDeleteConfirm(false);
                setShowSecondDeleteConfirm(false);
              }}
            />
          )}

          {/* First Delete Confirmation Modal */}
          <Dialog
            open={showFirstDeleteConfirm}
            onClose={() => setShowFirstDeleteConfirm(false)}
            hideBackdrop
            PaperProps={{
              sx: {
                borderRadius: '16px',
                boxShadow: '0 2px 16px rgba(0,0,0,0.13)',
                minWidth: 500,
                maxWidth: 640,
                width: '100%',
                p: 0,
                bgcolor: '#fff',
              }
            }}
          >
            <DialogTitle
              sx={{
                fontWeight: 550,
                fontSize: 18,
                color: '#343748',
                px: 3,
                pt: 3,
                pb: 1.5,
                fontFamily: 'Nunito, Arial, sans-serif',
                background: 'transparent',
              }}
            >
              Remove Property
            </DialogTitle>
            <DialogContent sx={{ px: 3, pt: 0, pb: 3 }}>
              <Box
                sx={{
                  bgcolor: '#F9B55D',
                  color: '#343748',
                  borderRadius: '8px',
                  p: '12px 20px',
                  mb: 4,
                  fontWeight: 400,
                  fontSize: 17,
                  fontFamily: 'Nunito, Arial, sans-serif',
                  letterSpacing: 0,
                  lineHeight: 1.3,
                  boxSizing: 'border-box',
                }}
              >
                You are about to remove this property permanently. Are you sure you want to continue?
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  onClick={() => { setShowFirstDeleteConfirm(false); setShowSecondDeleteConfirm(true); }}
                  sx={{
                    borderRadius: '8px',
                    minWidth: 120,
                    height: 44,
                    bgcolor: '#E57373',
                    color: '#fff',
                    fontWeight: 400,
                    fontSize: 16,
                    fontFamily: 'Nunito, Arial, sans-serif',
                    boxShadow: 'none',
                    textTransform: 'none',
                    mr: 2,
                    '&:hover': {
                      bgcolor: '#d32f2f',
                    },
                  }}
                >
                  Delete
                </Button>
                <Button
                  onClick={() => setShowFirstDeleteConfirm(false)}
                  sx={{
                    borderRadius: '8px',
                    minWidth: 120,
                    height: 44,
                    bgcolor: '#fff',
                    color: '#343748',
                    fontWeight: 400,
                    fontSize: 16,
                    fontFamily: 'Nunito, Arial, sans-serif',
                    border: '1.5px solid #D9D9D9',
                    boxShadow: 'none',
                    textTransform: 'none',
                    '&:hover': {
                      bgcolor: '#f5f5f5',
                      borderColor: '#B0B8C1',
                    },
                  }}
                >
                  Cancel
                </Button>
              </Box>
            </DialogContent>
          </Dialog>
          {/* Second Delete Confirmation Modal */}
          <Dialog
            open={showSecondDeleteConfirm}
            onClose={() => setShowSecondDeleteConfirm(false)}
            hideBackdrop
            PaperProps={{
              sx: {
                borderRadius: '16px',
                boxShadow: '0 2px 16px rgba(0,0,0,0.13)',
                minWidth: 500,
                maxWidth: 640,
                width: '100%',
                p: 0,
                bgcolor: '#fff',
              }
            }}
          >
            <DialogTitle
              sx={{
                fontWeight: 550,
                fontSize: 18,
                color: '#343748',
                px: 3,
                pt: 3,
                pb: 1.5,
                fontFamily: 'Nunito, Arial, sans-serif',
                background: 'transparent',
              }}
            >
              Remove Property
            </DialogTitle>
            <DialogContent sx={{ px: 3, pt: 0, pb: 3 }}>
              <Box
                sx={{
                  bgcolor: '#F9B55D',
                  color: '#343748',
                  borderRadius: '8px',
                  p: '12px 20px',
                  mb: 4,
                  fontWeight: 400,
                  fontSize: 17,
                  fontFamily: 'Nunito, Arial, sans-serif',
                  letterSpacing: 0,
                  lineHeight: 1.3,
                  boxSizing: 'border-box',
                }}
              >
                Are you sure you want to remove this property? This CANNOT be undone.
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  onClick={() => setShowSecondDeleteConfirm(false)}
                  sx={{
                    borderRadius: '8px',
                    minWidth: 120,
                    height: 44,
                    bgcolor: '#fff',
                    color: '#343748',
                    fontWeight: 400,
                    fontSize: 16,
                    fontFamily: 'Nunito, Arial, sans-serif',
                    border: '1.5px solid #D9D9D9',
                    boxShadow: 'none',
                    textTransform: 'none',
                    mr: 2,
                    '&:hover': {
                      bgcolor: '#f5f5f5',
                      borderColor: '#B0B8C1',
                    },
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteProperty}
                  disabled={deleteLoading}
                  sx={{
                    borderRadius: '8px',
                    minWidth: 120,
                    height: 44,
                    bgcolor: '#E57373',
                    color: '#fff',
                    fontWeight: 400,
                    fontSize: 16,
                    fontFamily: 'Nunito, Arial, sans-serif',
                    boxShadow: 'none',
                    textTransform: 'none',
                    '&:hover': {
                      bgcolor: '#d32f2f',
                    },
                  }}
                >
                  {deleteLoading ? 'Removing...' : 'Remove'}
                </Button>
              </Box>
            </DialogContent>
          </Dialog>

          <Button variant="contained" sx={{ fontWeight: 400, fontSize: 16, fontFamily: 'Nunito, Arial, sans-serif', textTransform: 'none', bgcolor: '#89AE99', color: '#fff', px: 4, py: 1.5, borderRadius: 2, minWidth: 120 }}
            onClick={async () => {
              setEditLoading(true);
              let formattedInterestRate = '';
              let rateRaw = editForm?.interestRate?.trim() || '';
              if (rateRaw) {
                if (rateRaw.endsWith('%')) rateRaw = rateRaw.slice(0, -1);
                const rateNum = parseFloat(rateRaw);
                // Enforce limits: 0.01 to 99.99
                if (rateNum < 0.01 || rateNum > 99.99) {
                  setEditLoading(false);
                  return;
                }
                formattedInterestRate = `${rateNum.toFixed(2)}%`;
              }
              const newTag = editForm?.type?.trim() || '';
              if (tabNames.includes(newTag) && newTag !== property?.type) {
                setPropertyTagError('This property tag already exists.');
                setEditLoading(false);
                return;
              }
              setPropertyTagError('');
              if (!editForm?.type) {
                setEditLoading(false);
                return;
              }
              try {
                if (!editForm || !currentPropertyId) {
                  setEditLoading(false);
                  return;
                }
                const auth = getAuth();
                const user = auth.currentUser;
                const docRef = doc(db, "properties", currentPropertyId);
                let cacheBustedPhotoUrl = editForm.photoUrl;
                let cacheBustedOriginalPhotoUrl = editForm.originalPhotoUrl;
                const storage = getStorage();
                const { getDownloadURL } = await import("firebase/storage");
                // Helper to compress image blob to under 1MB
                async function compressImageToUnder1MB(blob: Blob): Promise<Blob> {
                  const maxSize = 1024 * 1024; // 1MB
                  const maxWidth = 1280;
                  const maxHeight = 720;
                  let quality = 0.92;
                  let resultBlob = blob;
                  // Only compress/resize if over 1MB or not JPEG/WEBP
                  if (blob.size > maxSize || !['image/jpeg', 'image/webp'].includes(blob.type)) {
                    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                      const image = new window.Image();
                      image.onload = () => resolve(image);
                      image.onerror = reject;
                      image.src = URL.createObjectURL(blob);
                    });
                    // Resize logic
                    let targetWidth = img.width;
                    let targetHeight = img.height;
                    if (img.width > maxWidth || img.height > maxHeight) {
                      const widthRatio = maxWidth / img.width;
                      const heightRatio = maxHeight / img.height;
                      const ratio = Math.min(widthRatio, heightRatio);
                      targetWidth = Math.round(img.width * ratio);
                      targetHeight = Math.round(img.height * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                      let mimeType = 'image/webp';
                      // Try compressing until under 1MB or quality too low
                      while (quality > 0.5) {
                        const b = await new Promise<Blob | null>(res => canvas.toBlob(res, mimeType, quality));
                        if (b && b.size <= maxSize) {
                          resultBlob = b;
                          break;
                        }
                        quality -= 0.07;
                      }
                    }
                  }
                  return resultBlob;
                }

                // Parallelize original and cropped image uploads
                const uploadTasks = [];
                let originalUrl = null;
                let croppedUrl = null;
                if (originalImageBlob) {
                  const originalRef = ref(storage, `properties/${currentPropertyId}/original.jpg`);
                  uploadTasks.push(
                    (async () => {
                      try {
                        const compressedOriginal = await compressImageToUnder1MB(originalImageBlob);
                        await uploadBytes(originalRef, compressedOriginal);
                        const url = await getDownloadURL(originalRef);
                        originalUrl = url + `?t=${Date.now()}`;
                      } catch (uploadErr: any) {
                        console.error("[Property Image Upload] Firebase Storage upload error (original):", uploadErr);
                        alert('Failed to upload original image: ' + (uploadErr?.message || uploadErr));
                        throw uploadErr;
                      }
                    })()
                  );
                }
                if (editImageBlob) {
                  const imageRef = ref(storage, `properties/${currentPropertyId}/photo.jpg`);
                  uploadTasks.push(
                    (async () => {
                      try {
                        const compressedCropped = await compressImageToUnder1MB(editImageBlob);
                        await uploadBytes(imageRef, compressedCropped);
                        const url = await getDownloadURL(imageRef);
                        croppedUrl = url + `?t=${Date.now()}`;
                      } catch (uploadErr: any) {
                        console.error("[Property Image Upload] Firebase Storage upload error (cropped):", uploadErr);
                        alert('Failed to upload cropped image: ' + (uploadErr?.message || uploadErr));
                        throw uploadErr;
                      }
                    })()
                  );
                }
                // Wait for all uploads in parallel
                if (uploadTasks.length > 0) {
                  try {
                    await Promise.all(uploadTasks);
                  } catch (err) {
                    setEditLoading(false);
                    return;
                  }
                }
                if (originalUrl) cacheBustedOriginalPhotoUrl = originalUrl;
                if (croppedUrl) {
                  cacheBustedPhotoUrl = croppedUrl;
                  setEditImage(cacheBustedPhotoUrl);
                }
                // --- PROPERTY TAX HISTORY UPDATE LOGIC ---
                let updatedPropertyTaxHistory = property?.propertyTaxHistory || [];
                // --- Improved Property Tax History Logic ---
                if (editingTaxDate && editingTaxAmount) {
                  // Add new entry if year doesn't exist, else update existing year
                  const formattedDate = formatLongDate(editingTaxDate);
                  const taxYear = new Date(editingTaxDate).getFullYear();
                  let found = false;
                  updatedPropertyTaxHistory = updatedPropertyTaxHistory.map((item: any) => {
                    const itemYear = new Date(item.date).getFullYear();
                    if (itemYear === taxYear) {
                      found = true;
                      return { ...item, date: formattedDate, amount: editingTaxAmount };
                    }
                    return item;
                  });
                  if (!found) {
                    updatedPropertyTaxHistory = [
                      ...updatedPropertyTaxHistory,
                      { date: formattedDate, amount: editingTaxAmount }
                    ];
                  }
                  // Sort by year descending (most recent first)
                  updatedPropertyTaxHistory = updatedPropertyTaxHistory.sort((a, b) => {
                    const yearA = new Date(a.date).getFullYear();
                    const yearB = new Date(b.date).getFullYear();
                    return yearB - yearA;
                  });
                  // Update localTaxHistory state for immediate UI feedback
                  setLocalTaxHistory(updatedPropertyTaxHistory);
                } else if (editingTaxDate === null && editingTaxAmount === '') {
                  // Remove latest entry if both are cleared
                  const sortedTaxes = [...updatedPropertyTaxHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  const latestTax = sortedTaxes[0];
                  if (latestTax) {
                    updatedPropertyTaxHistory = updatedPropertyTaxHistory.filter((item: any) => 
                      !(item.date === latestTax.date && item.amount === latestTax.amount)
                    );
                  }
                }

                // --- SHARED MEMBER ALIAS UPDATE LOGIC ---
                let updateData: any;
                if (isSharedMember && user && Array.isArray(property?.sharedWith)) {
                  // Only update the current user's sharedWith entry
                  const updatedSharedWith = property?.sharedWith.map((sw: any) => {
                    if (typeof sw === 'object' && sw.userId === user.uid) {
                      return { ...sw, alias: editAlias };
                    }
                    return sw;
                  });
                  updateData = {
                    sharedWith: updatedSharedWith,
                    updatedAt: new Date().toISOString(),
                    photoUrl: cacheBustedPhotoUrl,
                    originalPhotoUrl: cacheBustedOriginalPhotoUrl,
                    propertyTaxHistory: updatedPropertyTaxHistory,
                    mortgagePaidOffDate: editingPaidOffDate 
                      ? formatLongDate(editingPaidOffDate)
                      : (editForm?.mortgagePaidOffDate || undefined),
                    // Remove these keys from editForm before spreading
                    ...(() => {
                      const { sharedWith, updatedAt, photoUrl, originalPhotoUrl, mortgagePaidOffDate, interestRate, ...rest } = editForm || {};
                      return rest;
                    })(),
                    interestRate: formattedInterestRate,
                  };
                } else {
                  const { photoUrl, originalPhotoUrl, interestRate, ...fieldsToUpdate } = editForm;
                  const updateDataFields = {
                    ...fieldsToUpdate,
                    updatedAt: new Date().toISOString(),
                    photoUrl: cacheBustedPhotoUrl,
                    originalPhotoUrl: cacheBustedOriginalPhotoUrl,
                    propertyTaxHistory: updatedPropertyTaxHistory,
                    mortgagePaidOffDate: editingPaidOffDate 
                      ? formatLongDate(editingPaidOffDate)
                      : (fieldsToUpdate.mortgagePaidOffDate || undefined),
                    interestRate: formattedInterestRate,
                  };
                  updateData = updateDataFields;
                }
                // Filter out undefined fields before updating Firestore
                const filteredUpdateData: Record<string, any> = Object.fromEntries(
                  Object.entries(updateData).filter(([_, v]) => v !== undefined)
                );
                await updateDoc(docRef, filteredUpdateData);
                setEditOpen(false);
                setEditingTaxDate(null);
                setEditingTaxAmount('');
                setTaxDateError('');
                setEditingPaidOffDate(null);
                setProperty(prev => {
                  if (!prev || !property) return prev;
                  return {
                    ...prev,
                    ...editForm,
                    interestRate: formattedInterestRate,
                    photoUrl: cacheBustedPhotoUrl, 
                    originalPhotoUrl: cacheBustedOriginalPhotoUrl,
                    propertyTaxHistory: updatedPropertyTaxHistory,
                    sharedWith: isSharedMember && user
                      ? property.sharedWith.map((sw: any) => (typeof sw === 'object' && sw.userId === user.uid ? { ...sw, alias: editAlias } : sw))
                      : property.sharedWith
                  };
                });
                setEditForm(prev => prev ? { ...prev, interestRate: formattedInterestRate, photoUrl: cacheBustedPhotoUrl, originalPhotoUrl: cacheBustedOriginalPhotoUrl } : prev);
                // Clear blobs after upload
                setEditImageBlob(null);
                setOriginalImageBlob(null);
                // Update tabNames immediately if property name (type) changed
                // But only add origin name if it's not a shared property with an alias
                if (editForm?.type && !tabNames.includes(editForm.type)) {
                  let newTabName = editForm.type;
                  // For shared properties, check if there's an alias - if so, don't add the origin name
                  const isShared = property && property.ownerId !== user?.uid && Array.isArray(property?.sharedWith) && 
                                   property.sharedWith.some((sw: any) => sw.userId === user?.uid);
                  if (isShared) {
                    const sharedEntry = property?.sharedWith?.find((sw: any) => typeof sw === 'object' && sw.userId === user?.uid);
                    if (sharedEntry && sharedEntry.alias && sharedEntry.alias.trim()) {
                      // Has alias - use alias instead
                      newTabName = sharedEntry.alias;
                    }
                  }
                  // Only add to tabs if it's not already there
                  if (!tabNames.includes(newTabName)) {
                    setTabNames(prev => {
                      const filtered = prev.filter(name => name !== property?.type && name !== editForm.type);
                      return [newTabName, ...filtered];
                    });
                    setSelectedTab(newTabName);
                  }
                }
                // Clear the blob after upload
                setEditImageBlob(null);
                // Note: Don't reset editLoading here - the dialog will close and unmount
                // This prevents the brief flash back to "Update" button before dialog closes
              } catch (err: any) {
                console.error("[Property Edit] General error:", err);
                setPropertyTagError(err?.message || 'An error occurred while updating.');
                setEditLoading(false);
              }
            }}
            disabled={!editForm?.type || editLoading}
          >
            {editLoading ? 'Updating...' : 'Update'}
          </Button>
          {!editForm?.type && (
            <Typography color="error" sx={{ mt: 1, fontWeight: 400, textAlign: 'center' }}>
              Property Name is required
            </Typography>
          )}
        </Box>
      </DialogContent>
      </FieldTooltipProvider>
    </Dialog>
  );

  // Modal JSX
  const ForecastingModal = (
    <Dialog open={forecastModalOpen} onClose={() => setForecastModalOpen(false)} maxWidth="md" fullWidth>
      <DialogContent sx={{ p: 4 }}>
        <DialogTitle sx={{ fontWeight: 700, mb: 2, ml: -3, color: '#374748', fontFamily: 'Nunito, Arial, sans-serif' }}>Forecasting and Planning</DialogTitle>
        <Box component="form" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 4 }}>
          {/* Roof Column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2,  borderRadius: 2, bgcolor: '#fff' }}>
            <Typography variant="subtitle2" sx={{ fontFamily: 'Nunito, Arial, sans-serif ', fontSize: 19, fontWeight: 600, mb: 1, color: '#888', pl: 0.5 }}>Roof</Typography>
            <TextField
              select
              label="Installed Roof Type?"
              value={formatNumber(forecastForm.roofType)}
              onChange={e => {
                const type = e.target.value;
                const lifespanMap: Record<string, number> = {
                  Shingle: 30,
                  Tile: 50,
                  Metal: 80,
                  Other: 30
                };
                setForecastForm(f => ({
                  ...f,
                  roofType: type,
                  roofLifespan: String(lifespanMap[type] || 20)
                }));
              }}
              fullWidth
              sx={{ bgcolor: '#fff' }}
            >
              {['Shingle', 'Tile', 'Metal'].map(opt => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Lifespan (years)"
              type="number"
              value={formatNumber(forecastForm.roofLifespan)}
              onChange={e => {
                let val = e.target.value.replace(/[^\d]/g, '');
                if (val.length > 3) val = val.slice(0, 3);
                setForecastForm(f => ({ ...f, roofLifespan: val }));
              }}
              fullWidth
              sx={{ bgcolor: '#fff' }}
              inputProps={{ maxLength: 3 }}
            />
            <TextField
              label="Cost of Roof (Optional)"
              value={formatNumber(forecastForm.roofCost)}
              onChange={e => {
                let val = e.target.value.replace(/[^\d]/g, '');
                if (val.length > 9) val = val.slice(0, 9);
                setForecastForm(f => ({ ...f, roofCost: val }));
                setCostErrors(errs => ({ ...errs, roofCost: '' }));
              }}
              error={!!costErrors.roofCost}
              helperText={costErrors.roofCost}
              fullWidth
              sx={{ bgcolor: '#fff' }}
              inputProps={{ maxLength: 9, inputMode: 'numeric', pattern: '[0-9,]*' }}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>
              }}
            />
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Install date"
                value={forecastForm.roofDate && isValidDateFns(parseDateFns(forecastForm.roofDate, 'MM/dd/yyyy', new Date()))
                  ? parseDateFns(forecastForm.roofDate, 'MM/dd/yyyy', new Date())
                  : null}
                disableFuture
                onChange={date => {
                  let newDate = '';
                  if (date instanceof Date && isValidDateFns(date)) {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    if (date > today) {
                      // If future, do not update
                      date = today;
                    }
                    newDate = formatDateFns(date, 'MM/dd/yyyy');
                  }
                  setForecastForm(f => ({ ...f, roofDate: newDate }));
                }}
                slotProps={{ textField: { fullWidth: true, sx: { bgcolor: '#fff' } } }}
                format="MM/dd/yyyy"
              />
            </LocalizationProvider>
          </Box>
          {/* HVAC Column */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 19, fontWeight: 600, mb: 1, color: '#888', pl: 0.5 }}>HVAC</Typography>
            <TextField
              label="Lifespan (years)"
              type="number"
              value={formatNumber(forecastForm.hvacLifespan)}
              onChange={e => {
                let val = e.target.value.replace(/[^\d]/g, '');
                if (val.length > 3) val = val.slice(0, 3);
                setForecastForm(f => ({ ...f, hvacLifespan: val }));
              }}
              fullWidth
              sx={{ bgcolor: '#fff' }}
              inputProps={{ maxLength: 3 }}
            />
            <TextField
              label="Cost of HVAC System (Optional)"
              value={formatNumber(forecastForm.hvacCost)}
              onChange={e => {
                let val = e.target.value.replace(/[^\d]/g, '');
                if (val.length > 9) val = val.slice(0, 9);
                setForecastForm(f => ({ ...f, hvacCost: val }));
                setCostErrors(errs => ({ ...errs, hvacCost: '' }));
              }}
              error={!!costErrors.hvacCost}
              helperText={costErrors.hvacCost}
              fullWidth
              sx={{ bgcolor: '#fff' }}
              inputProps={{ maxLength: 9, inputMode: 'numeric', pattern: '[0-9,]*' }}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>
              }}
            />
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Install date"
                value={forecastForm.hvacDate && isValidDateFns(parseDateFns(forecastForm.hvacDate, 'MM/dd/yyyy', new Date()))
                  ? parseDateFns(forecastForm.hvacDate, 'MM/dd/yyyy', new Date())
                  : null}
                disableFuture
                onChange={date => {
                  let newDate = '';
                  if (date instanceof Date && isValidDateFns(date)) {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    if (date > today) {
                      // If future, do not update
                      date = today;
                    }
                    newDate = formatDateFns(date, 'MM/dd/yyyy');
                  }
                  setForecastForm(f => ({ ...f, hvacDate: newDate }));
                }}
                slotProps={{ textField: { fullWidth: true, sx: { bgcolor: '#fff' } } }}
                format="MM/dd/yyyy"
              />
            </LocalizationProvider>
          </Box>
          {/* Water Heater Column */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" sx={{ fontSize: 19, fontWeight: 600, mb: 1, fontFamily: 'Nunito, Arial, sans-serif', color: '#888', pl: 0.5 }}>Water Heater</Typography>
            <TextField
              label="Lifespan (years)"
              type="number"
              value={formatNumber(forecastForm.waterLifespan)}
              onChange={e => {
                let val = e.target.value.replace(/[^\d]/g, '');
                if (val.length > 3) val = val.slice(0, 3);
                setForecastForm(f => ({ ...f, waterLifespan: val }));
              }}
              fullWidth
              sx={{ bgcolor: '#fff' }}
              inputProps={{ maxLength: 3 }}
            />
            <TextField
              label="Cost of Water Heater (Optional)"
              value={formatNumber(forecastForm.waterCost)}
              onChange={e => {
                let val = e.target.value.replace(/[^\d]/g, '');
                if (val.length > 9) val = val.slice(0, 9);
                setForecastForm(f => ({ ...f, waterCost: val }));
                setCostErrors(errs => ({ ...errs, waterCost: '' }));
              }}
              error={!!costErrors.waterCost}
              helperText={costErrors.waterCost}
              fullWidth
              sx={{ bgcolor: '#fff' }}
              inputProps={{ maxLength: 9, inputMode: 'numeric', pattern: '[0-9,]*' }}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>
              }}
            />
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Install date"
                value={forecastForm.waterDate && isValidDateFns(parseDateFns(forecastForm.waterDate, 'MM/dd/yyyy', new Date()))
                  ? parseDateFns(forecastForm.waterDate, 'MM/dd/yyyy', new Date())
                  : null}
                disableFuture
                onChange={date => {
                  let newDate = '';
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  if (date instanceof Date && isValidDateFns(date)) {
                    if (date > today) {
                      // If future, do not update
                      date = today;
                    }
                    newDate = formatDateFns(date, 'MM/dd/yyyy');
                  }
                  setForecastForm(f => ({ ...f, waterDate: newDate }));
                }}
                slotProps={{ textField: { fullWidth: true, sx: { bgcolor: '#fff' } } }}
                format="MM/dd/yyyy"
              />
            </LocalizationProvider>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
          <Button variant="outlined" sx={{ borderRadius: 2, color: '#333', borderColor: '#D9D9D9', background: '#fff', textTransform: 'none', fontWeight: 400, '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }} onClick={() => setForecastModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" sx={{ borderRadius: 2, background: '#89AE99', color: '#fff', textTransform: 'none', fontWeight: 400, boxShadow: 'none' }}
            onClick={async () => {
              if (!currentPropertyId) return;
              const docRef = doc(db, 'properties', currentPropertyId);
              const roofCost = forecastForm.roofCost === '' ? 0 : Number(forecastForm.roofCost.replace(/\$/g, ''));
              const roofLifespan = forecastForm.roofLifespan === '' ? 0 : Number(forecastForm.roofLifespan);
              const hvacCost = forecastForm.hvacCost === '' ? 0 : Number(forecastForm.hvacCost.replace(/\$/g, ''));
              const hvacLifespan = forecastForm.hvacLifespan === '' ? 0 : Number(forecastForm.hvacLifespan);
              const waterCost = forecastForm.waterCost === '' ? 0 : Number(forecastForm.waterCost.replace(/\$/g, ''));
              const waterLifespan = forecastForm.waterLifespan === '' ? 0 : Number(forecastForm.waterLifespan);
              const updateData = {
                forecasting: {
                  Roof: {
                    type: forecastForm.roofType,
                    cost: roofCost,
                    lifespan: roofLifespan,
                    installDate: forecastForm.roofDate
                  },
                  HVAC: {
                    cost: hvacCost,
                    lifespan: hvacLifespan,
                    installDate: forecastForm.hvacDate
                  },
                  WaterHeater: {
                    cost: waterCost,
                    lifespan: waterLifespan,
                    installDate: forecastForm.waterDate
                  }
                }
              };
              await updateDoc(docRef, updateData);
              setProperty(prev => prev ? ({
                ...prev,
                forecasting: {
                  ...prev.forecasting,
                  Roof: {
                    type: forecastForm.roofType,
                    cost: roofCost,
                    lifespan: roofLifespan,
                    installDate: forecastForm.roofDate
                  },
                  HVAC: {
                    cost: hvacCost,
                    lifespan: hvacLifespan,
                    installDate: forecastForm.hvacDate
                  },
                  WaterHeater: {
                    cost: waterCost,
                    lifespan: waterLifespan,
                    installDate: forecastForm.waterDate
                  }
                }
              }) : prev);
              setForecastModalOpen(false);
            }}
          >
            Save
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );

  // Update handleEditUtility to set index
  const handleEditUtility = (utility: UtilityItem, idx: number) => {
    setEditUtilityType(utility.type);
    setEditUtilityCompany(utility.company);
    setEditUtilityAccount(utility.number || '');
    setEditUtilityUrl(utility.link || '');
    setEditUtilityIndex(idx);
    setEditUtilityOpen(true);
  };

  // Calculate purchase price diff, color, and arrow
  const est = property?.estimatedValue ?? 0;
  // Ensure estimated value is treated as a number (may be string in some records)
  const estNum = typeof est === 'number' ? est : (est === '' ? 0 : Number(est));
  const price = property?.price ? parseFloat(property.price.replace(/[^\d.\-]/g, '')) : 0;
  // Only compute diff when both sides are valid numbers
  const diff = (!isNaN(estNum) && !isNaN(price)) ? estNum - price : null;
  const isNegative = diff !== null && diff < 0;
  const buttonColor = isNegative ? '#E57373' : '#435569';
  const arrow = isNegative ? '↓' : '↑';
  const showPropertyLoadingOverlay = !property && (isPropertyBootstrapping || isPropertyFetching);
  const showPropertyEmptyOverlay = !property && !showPropertyLoadingOverlay;

  return (
    <>
      <AddPropertyModal
        open={addPropertyOpen}
        onClose={() => setAddPropertyOpen(false)}
        onPropertyAdded={async (newPropertyId: string) => {
          // Fetch the new property and update state
          const { doc, getDoc } = await import("firebase/firestore");
          const { db } = await import("../services/firebase");
          const propertyDoc = await getDoc(doc(db, "properties", newPropertyId));
          if (propertyDoc.exists()) {
            const newProperty = propertyDoc.data();
            setCurrentPropertyId(newPropertyId);
            setProperty(newProperty as PropertyData);
            // Add the new tab with proper name (alias if shared, type if owned)
            let tabNameToAdd = newProperty.type;
            if (Array.isArray(newProperty.sharedWith)) {
              const userEntry = newProperty.sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === user?.uid);
              if (userEntry && userEntry.alias && userEntry.alias.trim()) {
                tabNameToAdd = userEntry.alias;
              }
            }
            setTabNames(prev => {
              const filtered = prev.filter(t => t !== newProperty.type && t !== tabNameToAdd);
              return [...filtered, tabNameToAdd];
            });
            setSelectedTab(tabNameToAdd);
          }
          setAddPropertyOpen(false);
        }}
      />
      <Box sx={{ bgcolor: '#F9F9F9', position: 'relative', flexGrow: 1, px: { xs: 1.5, sm: 2, md: 3 }, pt: { xs: 2, sm: 2.5, md: 3 }, pb: { xs: 2, sm: 3, md: 4 }, overflowY: 'auto', overflowX: 'hidden', ml: { xs: 0, md: 'var(--app-sidebar-width, 72px)' }, minHeight: '100dvh', width: { xs: '100%', md: 'calc(100% - var(--app-sidebar-width, 72px))' }, maxWidth: '100%', minWidth: 0 }}>
        {(isRealPM || isFamilyMember) ? (
          <EditPropertyModalComponent
            open={editOpen}
            onClose={() => {
              setEditOpen(false);
              setEditingTaxDate(null);
              setEditingTaxAmount('');
              setTaxDateError('');
              setEditingPaidOffDate(null);
            }}
            property={property ? { 
              ...property, 
              id: currentPropertyId,
              securityDeposit: property.securityDeposit !== undefined 
                ? (typeof property.securityDeposit === 'string' 
                    ? parseFloat(property.securityDeposit) || undefined 
                    : property.securityDeposit)
                : undefined
            } : null}
            role={isRealPM ? 'pm' : 'owner'}
            onSave={(updatedProperty) => {
              setProperty(updatedProperty as PropertyData);
              setEditOpen(false);
            }}
            onDelete={async () => {
              await handleDeleteProperty();
            }}
          />
        ) : (
          EditPropertyModal
        )}
        {ForecastingModal}
        {/* Overlay while property data is loading to avoid partial/flash render */}
        {showPropertyLoadingOverlay && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#F9F9F9', zIndex: 60, p: { xs: 1.5, sm: 2, md: 3 }, overflow: 'hidden' }}>
            <PropertyOverviewSkeleton />
          </Box>
        )}
        {showPropertyEmptyOverlay && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#F9F9F9', zIndex: 60, p: { xs: 1.5, sm: 2, md: 3 }, overflow: 'hidden' }}>
            <Paper sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', height: '100%' }}>
              <EmptyState
                title="No Properties Added"
                description="Add a property to begin managing finances and maintenance."
                iconType="property"
                actionLabel="+ Add Property"
                onAction={() => setAddPropertyOpen(true)}
                minHeight="100%"
              />
            </Paper>
          </Box>
        )}
      {/* Top Navigation Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flexWrap: 'wrap' }}>
          <Typography variant="h5" sx={{ fontSize: 18, fontWeight: 550, color: '#222', fontFamily: 'Nunito, Arial, sans-serif' }}>Properties</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, overflowX: 'auto', maxWidth: '100%', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
            {tabNames.map((tab) => (
              <Box
                key={tab}
                onClick={() => {
                  setSelectedTab(tab);
                  const foundProp = allProperties.find((p: any) => p.tabName === tab);
                  if (foundProp) {
                    setCurrentPropertyId(foundProp.id);
                    setProperty(foundProp as PropertyData);
                  }
                }}
                sx={{
                  cursor: 'pointer',
                  fontWeight: 400,
                  fontSize: 18,
                  px: 2.5,
                  mt: -1,
                  py: 0.5,
                  borderRadius: '8px',
                  background: 'none',
                  boxShadow: 'none',
                  border: 'none',
                  transition: 'color 0.2s',
                  position: 'relative',
                  outline: 'none',
                  textTransform: 'none',
                  color: tab === selectedTab ? '#89AE99' : 'gray',
                  ":hover": {
                    color: selectedTab === tab ? '#89AE99' : '#000'
                  },
                  "::selection": {
                    color: '#89AE99'
                  },
                  // Custom indicator
                  ...(tab === selectedTab ? {
                    '&:after': {
                      content: '""',
                      display: 'block',
                      position: 'absolute',
                      left: 19,
                      right: 19,
                      bottom: 2,
                      height: '3px',
                      borderRadius: 2,
                      backgroundColor: '#89AE99',
                    }
                  } : {})
                }}
              >
                {tab}
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
          <Button
            variant="outlined"
            sx={{
              borderRadius: 2,
              bgcolor: '#fff',
              color: '#343748',
              fontWeight: 400,
              fontFamily: 'Nunito, Arial, sans-serif',
              textTransform: 'none',
              borderColor: '#e0e0e0',
              px: 2,
              py: 0.5,
              fontSize: 16,
              display: 'inline-flex',
              width: { xs: '100%', sm: 'auto' },
              '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' }
            }}
            onClick={() => setShowFilterModal(true)}
          >
            <span style={{ marginRight: 8, display: 'flex', alignItems: 'center' }}>
              <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M7.66929 12.3952H3.46863C3.19263 12.3952 2.96863 12.1712 2.96863 11.8952C2.96863 11.6192 3.19263 11.3952 3.46863 11.3952H7.66929C7.94529 11.3952 8.16929 11.6192 8.16929 11.8952C8.16929 12.1712 7.94529 12.3952 7.66929 12.3952Z" fill="#1F1F1F"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M12.541 10.8053C11.9477 10.8053 11.465 11.2827 11.465 11.8693C11.465 12.4567 11.9477 12.9333 12.541 12.9333C13.1337 12.9333 13.6157 12.4567 13.6157 11.8693C13.6157 11.2827 13.1337 10.8053 12.541 10.8053ZM12.541 13.9334C11.3963 13.9334 10.465 13.0074 10.465 11.8694C10.465 10.7314 11.3963 9.80536 12.541 9.80536C13.685 9.80536 14.6156 10.7314 14.6156 11.8694C14.6156 13.0074 13.685 13.9334 12.541 13.9334Z" fill="#1F1F1F"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M13.7431 5.93365H9.54309C9.26709 5.93365 9.04309 5.70965 9.04309 5.43365C9.04309 5.15765 9.26709 4.93365 9.54309 4.93365H13.7431C14.0191 4.93365 14.2431 5.15765 14.2431 5.43365C14.2431 5.70965 14.0191 5.93365 13.7431 5.93365Z" fill="#1F1F1F"/>
                <mask id="mask0_3578_4125" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="2" y="3" width="6" height="5">
                  <path fillRule="evenodd" clipRule="evenodd" d="M2.94922 3.33362H7.09975V7.46135H2.94922V3.33362Z" fill="white"/>
                </mask>
                <g mask="url(#mask0_3578_4125)">
                  <path fillRule="evenodd" clipRule="evenodd" d="M5.02439 4.33333C4.43172 4.33333 3.94906 4.81067 3.94906 5.398C3.94906 5.98467 4.43172 6.46133 5.02439 6.46133C5.61772 6.46133 6.09972 5.98467 6.09972 5.398C6.09972 4.81067 5.61772 4.33333 5.02439 4.33333ZM5.02431 7.46119C3.88031 7.46119 2.94897 6.53586 2.94897 5.39786C2.94897 4.25986 3.88031 3.33319 5.02431 3.33319C6.16897 3.33319 7.09964 4.25986 7.09964 5.39786C7.09964 6.53586 6.16897 7.46119 5.02431 7.46119Z" fill="#1F1F1F"/>
                </g>
              </svg>
            </span>
            Filter
          </Button>
          <Button
            variant="contained"
            sx={{
              borderRadius: 2,
              bgcolor: '#89AE99',
              color: '#fff',
              fontWeight: 400,
              fontFamily: 'Nunito, Arial, sans-serif',
              textTransform: 'none',
              px: 1.5,
              py: 0.7,
              fontSize: 15,
              display: 'inline-flex',
              width: { xs: '100%', sm: 'auto' }
            }}
            onClick={async () => {
              const auth = getAuth();
              const user = auth.currentUser;
              if (!user) return;
              
              // Check for special admin emails that bypass limits
              const adminEmails = ['river@fishdawgproductions.com', 'andrii@allproperly.com'];
              if (adminEmails.includes(user.email || '')) {
                setAddPropertyOpen(true);
                return;
              }
              
              const { doc, getDoc } = await import("firebase/firestore");
              const { db } = await import("../services/firebase");
              const userDoc = await getDoc(doc(db, "users", user.uid));
              const plan = userDoc.exists() ? (userDoc.data().planState || "free") : "free";
              let maxProperties = 1;
              if (plan === "basic" || plan === "basic_annual") maxProperties = 5;
              if (plan === "plus" || plan === "plus_annual") maxProperties = 10;
              // Count both owned and shared properties
              const userProperties = Array.isArray(allProperties)
                ? allProperties.filter((p: any) => {
                    const isOwner = p.ownerId === user.uid;
                    const isShared = Array.isArray(p.sharedWith) && p.sharedWith.some((sw: any) => {
                      if (typeof sw === 'string') return sw === user.uid;
                      if (typeof sw === 'object' && sw && sw.userId) return sw.userId === user.uid;
                      return false;
                    });
                    return isOwner || isShared;
                  })
                : [];
              if (userProperties.length >= maxProperties) {
                setUpgradePlan(plan);
                setUpgradeLimitOpen(true);
              } else {
                setAddPropertyOpen(true);
              }
            }}
          >
            + Add Property
          </Button>
          <UpgradeLimitModal
            open={upgradeLimitOpen}
            onCancel={() => setUpgradeLimitOpen(false)}
            onUpgrade={() => {
              setUpgradeLimitOpen(false);
              onShowUpgrade();
            }}
            planState={upgradePlan}
          />
        </Box>
      </Box>

      {showFilterModal && (
        <div className="modal-overlay" onClick={handleCloseFilter}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <FilterPropertyModal open={showFilterModal} onClose={handleCloseFilter} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, px: 0, pt: 4, pb: 1 }}>
        {/* Property Details Section - Flexbox Two Columns */}
        <Box sx={{
           display: 'flex',
           flexDirection: { xs: 'column', lg: 'row' },
           gap: 1.5,
           width: '100%',
           alignItems: 'stretch',
           mb: 1.5,
           height: 'auto',
        }}>
          {/* Left Column */}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Paper
              ref={leftBoxRef}
              sx={{
                py: 3,
                px: 3,
                borderRadius: 2,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                gap: 5,
                boxSizing: 'border-box',
                boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
              }}>
              {/* Responsive image/content split: stack on xs/sm, strict split on md+ */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16/9',         // FORCE 16:9 display region
                  overflow: 'hidden',
                  borderRadius: 2,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <img
                  src={property?.photoUrl || "/empty-property.png"}
                  alt="Property"
                  style={{
                    width: "100%",
                    height: "100%",             // Fill the 16:9 box vertically too
                    objectFit: "cover",         // Perfect cropping
                    display: "block",
                  }}
                />
                {/* Label overlay */}
                <Box
                  sx={{
                    position: "absolute",
                    top: 24,
                    left: 32,
                    bgcolor: "rgba(52,55,72,0.7)",
                    color: "#fff",
                    px: 2,
                    py: 0.5,
                    borderRadius: 2,
                    fontSize: 16,
                    fontWeight: 600
                  }}
                >
                  {(() => {
                    const auth = getAuth();
                    const user = auth.currentUser;
                    if (user && Array.isArray(property?.sharedWith)) {
                      const entry = property.sharedWith.find(
                        (sw: any) => typeof sw === "object" && sw.userId === user.uid
                      );
                      if (entry && entry.alias !== undefined) {
                        return entry.alias;
                      }
                    }
                    return property?.type || "";
                  })()}
                </Box>
              </Box>
              <Box sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                wordBreak: 'break-word',
              }}>
                {(property?.rentalInsurance?.assetsCovered && (!isSharedMember || isRealPM)) && (
                  <Typography sx={{ color: '#4A4A4A', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 11, sm: 13, md: 15, lg: 16, xl: 16 }, mt: -2 }}>
                    <span style={{ fontWeight: 550, fontSize: 24 }}>{property.rentalInsurance.assetsCovered}</span>
                  </Typography>
                )}
                <Typography sx={{ color: '#4A4A4A', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.2, fontSize: { xs: 11, sm: 13, md: 15, lg: 16, xl: 16 }, '@media (max-width:1350px)': { fontSize: 15} }}>
                  {property?.address1 || "Unknown"}
                  {property?.city ? `, ${property.city}` : ""}
                  {property?.state ? `, ${property.state}` : ""}
                  {property?.zip ? ` ${property.zip}` : ""}
                  <br />
                  {property?.bedrooms ? `${property.bedrooms} Bds` : "Unknown Bds"} / {property?.bathsTotal ? `${property.bathsTotal} Ba` : "Unknown Ba"} / {property?.squareFeet ? `${property.squareFeet} sqft` : "Unknown sqft"} / {property?.yearBuilt || "Unknown Year"}
                </Typography>
              </Box>
              {/* Absolutely positioned ... button inside Paper at bottom right - hidden for Friend role */}
              {!isFriend && (
                <Button
                  variant="text"
                  sx={{
                    position: 'absolute',
                    right: 3,
                    bottom: 3,
                    color: '#343748',
                    fontWeight: 550,
                    fontSize: 24,
                    minWidth: 0,
                    zIndex: 2,
                    width: 44,
                    height: 44,
                    pt: -5,
                    pb: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 2,
                    lineHeight: 1,
                    transition: 'background 0.2s',
                    '&:hover': {
                      background: '#f5f5f5',
                    },
                  }}
                  onClick={handleEditClick}
                >
                  <span style={{ display: 'inline-block', transform: 'translateY(2px)' }}>...</span>
                </Button>
              )}
            </Paper>
          </Box>
          {/* Right Column - Stacked Cards, Flex: 1 for equal height */}
          {(!isSharedMember && !isRealPM) ? (          
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5, height: { xs: 'auto', lg: leftHeight ? `${leftHeight}px` : '100%' } }}>
              <Paper sx={{ flex: 1, height: '100%', p: { xs: 2, sm: 3 }, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.13)', background: '#fff', display: 'flex', flexDirection: 'row', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', minHeight: 120, border: 'none', fontFamily: 'Nunito, Arial, sans-serif', overflow: 'hidden', position: 'relative' }}>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 2.5, py: 1.5, overflowY: 'auto' }}>
                  <Typography sx={{ fontWeight: 550, color: '#4A4A4A', mb: 1, fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 12, sm: 13, md: 16, lg: 20, xl: 20 }, '@media (max-width:1350px)': { fontSize: 18 } }}>
                    Purchase Price and Date
                  </Typography>
                  <Typography sx={{ color: '#4A4A4A', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.2, fontSize: { xs: 11, sm: 13, md: 15, lg: 16, xl: 16 }, '@media (max-width:1350px)': { fontSize: 15} }}>
                    Price: <span style={{ fontWeight: 550 }}>${property?.price !== undefined && Number(property?.price) > 0 ? formatNumber(property?.price?.split('.')[0] || '0') + '.' + (property?.price?.includes('.') ? property.price.split('.')[1] : '00') : ''}</span>
                  </Typography>
                  <Typography sx={{ color: '#4A4A4A', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.2, fontSize: { xs: 11, sm: 13, md: 15, lg: 16, xl: 16 }, '@media (max-width:1350px)': { fontSize: 15} }}>
                    Date: <span style={{ fontWeight: 550 }}>{property?.date ? formatLongDate(property.date) : ''}</span>
                  </Typography>
                </Box>
                <Box sx={{ pr: 2.5, display: { xs: 'none', md: 'flex', '@media (max-width:1350px)': { display: 'none' } } }}>
                  {property && (
                    <Button
                      disableElevation
                      variant="contained"
                      disabled
                      sx={{
                        bgcolor: buttonColor,
                        color: '#fff',
                        borderRadius: '8px',
                        fontWeight: 550,
                        fontSize: 18,
                        px: 2.5,
                        py: 1,
                        boxShadow: 'none',
                        textTransform: 'none',
                        minWidth: '120px',
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.2,
                        fontFamily: 'Nunito, Arial, sans-serif',
                        position: 'relative',
                        visibility: diff === null || diff === 0 ? 'hidden' : 'visible',
                        pointerEvents: 'none',
                        cursor: 'default',
                        '&.Mui-disabled': {
                          bgcolor: buttonColor,
                          color: '#fff',
                          opacity: 1,
                        },
                      }}
                    >
                      <span style={{ fontSize: 20, marginRight: 8, display: 'flex', alignItems: 'center', height: '100%', marginTop: '-4.8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' }}>{arrow}</span>
                      </span>
                      {diff !== null ? (() => { const formatted = parseFloat(String(diff) || '0').toFixed(2); const parts = formatted.split('.'); return `$${formatNumber(parts[0])}.${parts[1] || '00'}`; })() : ''}
                    </Button>
                  )}
                </Box>
              </Paper>
              <Paper sx={{ flex: 1, height: 'auto', minHeight: 0, p: { xs: 2, sm: 3 }, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.13)', background: '#fff', display: 'flex', flexDirection: 'row', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', border: 'none', fontFamily: 'Nunito, Arial, sans-serif', overflow: 'hidden', position: 'relative' }}>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 2.5, py: 2.5, overflowY: 'auto' }}>
                  <Typography sx={{ fontWeight: 550, color: '#4A4A4A', mb: 1.5, fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 14, sm: 15, md: 18, lg: 22, xl: 22 }, '@media (max-width:1350px)': { fontSize: 20 } }}>
                    Mortgage Info
                  </Typography>
                  <Typography sx={{ color: '#666666', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.5, fontSize: { xs: 12, sm: 13, md: 14, lg: 15, xl: 15 }, '@media (max-width:1350px)': { fontSize: 13 } }}>
                    Current Lender: <span style={{ fontWeight: 550, color: '#4A4A4A' }}>{property?.lender || ''}</span>
                  </Typography>
                  <Typography sx={{ color: '#666666', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.5, fontSize: { xs: 12, sm: 13, md: 14, lg: 15, xl: 15 }, '@media (max-width:1350px)': { fontSize: 13 } }}>
                    Interest Rate: <span style={{ fontWeight: 550, color: '#4A4A4A' }}>{property?.interestRate ? (property.interestRate.endsWith('%') ? property.interestRate : property.interestRate + '%') : ''}</span>
                  </Typography>
                  <Typography sx={{ color: '#666666', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0, fontSize: { xs: 12, sm: 13, md: 14, lg: 15, xl: 15 }, '@media (max-width:1350px)': { fontSize: 13 } }}>
                    Balance: <span style={{ fontWeight: 550, color: '#4A4A4A' }}>${formatNumber(property?.balance?.split('.')[0] || '0')}.{property?.balance?.includes('.') ? property?.balance.split('.')[1] : '00'}</span>
                  </Typography>
                  {property?.noMortgage && (
                    <img src="/paidoff.png" alt="Paid Off" style={{ position: 'absolute', right: '9%', top: '14%', width: '24%', height: 'auto', pointerEvents: 'none' }} />
                  )}
                </Box>
                {!property?.noMortgage && property?.term && property?.date && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pr: 3, py: 2.5 }}>
                    <Typography sx={{ fontWeight: 550, color: '#89AE99', fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 28, sm: 32, md: 36, lg: 40, xl: 40 }, '@media (max-width:1350px)': { fontSize: 36 }, lineHeight: 1 }}>
                      {(() => {
                        const term = property?.term ? parseInt(property.term) : 0;
                        const purchaseDate = property?.date;
                        
                        if (!term || !purchaseDate) return '—';
                        
                        // Total months in mortgage term
                        const totalMonths = term * 12;
                        
                        // Parse purchase date (MM/dd/yyyy format)
                        const purchaseDateObj = parseDateFns(purchaseDate as string, 'MM/dd/yyyy', new Date());
                        if (!isValidDateFns(purchaseDateObj)) return '—';
                        
                        // Get current date normalized to start of day
                        const now = new Date();
                        now.setHours(0, 0, 0, 0);
                        
                        // Calculate months elapsed
                        const yearDiff = now.getFullYear() - purchaseDateObj.getFullYear();
                        const monthDiff = now.getMonth() - purchaseDateObj.getMonth();
                        let monthsElapsed = yearDiff * 12 + monthDiff;
                        
                        // Calculate months remaining
                        const monthsRemaining = totalMonths - monthsElapsed;
                        
                        // Return remaining months or 0 if expired
                        return monthsRemaining > 0 ? monthsRemaining : 0;
                      })()}
                    </Typography>
                    <Typography sx={{ color: '#4A4A4A', fontWeight: 550, fontFamily: 'Nunito, Arial, sans-serif', mt: 0.5, fontSize: { xs: 16, sm: 18, md: 20, lg: 22, xl: 22 }, '@media (max-width:1350px)': { fontSize: 20 }, textAlign: 'center' }}>
                      Months Left
                    </Typography>
                  </Box>
                )}
              </Paper>
              <Paper sx={{ flex: 1, height: '100%', p: { xs: 2, sm: 3 }, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.13)', background: '#fff', display: 'flex', flexDirection: 'row', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', minHeight: 120, border: 'none', fontFamily: 'Nunito, Arial, sans-serif', overflow: 'hidden', position: 'relative' }}>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 2.5, py: 1.5, overflowY: 'auto' }}>
                  <Typography sx={{ fontWeight: 550, color: '#4A4A4A', mb: 1.5, fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 14, sm: 15, md: 18, lg: 22, xl: 22 }, '@media (max-width:1350px)': { fontSize: 20 } }}>
                    Estimated Value
                  </Typography>
                  <Typography sx={{ color: '#4A4A4A', fontWeight: 550, fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 11, sm: 13, md: 15, lg: 16, xl: 16 }, '@media (max-width:1350px)': { fontSize: 16 } }}>
                    ${formatNumber(String(property?.estimatedValue || '0').split('.')[0])}.{String(property?.estimatedValue || '0').includes('.') ? String(property?.estimatedValue).split('.')[1] : '00'}
                  </Typography>
                </Box>
                <Box sx={{ pr: 2.5, display: { xs: 'none', md: 'flex', '@media (max-width:1350px)': { display: 'none' } } }}>
                  {property && (() => {
                    const est = property?.estimatedValue || 0;
                    const price = property?.price ? parseFloat(property.price.replace(/[^\d.\-]/g, '')) : 0;
                    // Ensure numeric types and avoid division by zero
                    const estNum = typeof est === 'number' ? est : Number(est);
                    const priceNum = typeof price === 'number' ? price : Number(price);
                    const percent = (priceNum !== 0 && !isNaN(estNum) && !isNaN(priceNum)) ? (estNum / priceNum) * 100 : null;
                    const isBelow100 = percent !== null && percent < 100;
                    const buttonColor = isBelow100 ? '#E57373' : '#435569';
                    const arrow = isBelow100 ? '↓' : '↑';
                    return (
                      <Button
                        disableElevation
                        variant="contained"
                        disabled
                        sx={{
                          bgcolor: buttonColor,
                          color: '#fff',
                          borderRadius: '8px',
                          fontWeight: 550,
                          fontSize: 18,
                          px: 2.5,
                          py: 1,
                          boxShadow: 'none',
                          textTransform: 'none',
                          minWidth: '120px',
                          height: 40,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.2,
                          fontFamily: 'Nunito, Arial, sans-serif',
                          position: 'relative',
                          visibility: percent === null ? 'hidden' : 'visible',
                          pointerEvents: 'none',
                          cursor: 'default',
                          '&.Mui-disabled': {
                            bgcolor: buttonColor,
                            color: '#fff',
                            opacity: 1,
                          },
                        }}
                      >
                        <span style={{ fontSize: 20, marginRight: 8, display: 'flex', alignItems: 'center', height: '100%', marginTop: '-4.2px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' }}>{arrow}</span>
                        </span>
                        {percent !== null ? `${percent.toFixed(2)}%` : ''}
                      </Button>
                    );
                  })()}
                </Box>
              </Paper>
            </Box>) : (
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', gap: 2, height: { xs: 'auto', lg: leftHeight ? `${leftHeight}px` : '100%' } }}>
              <Paper sx={{ p: { xs: 2, sm: 3 },  borderRadius: 2, flex: 1, display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.13)', gap: 1 }}>
              <Typography variant="h5" fontWeight={550} mb={-1} sx={{ 
                textAlign: 'left',
                color: '#343748',
                fontFamily: 'Nunito, Arial, sans-serif',
                fontSize: { xs: 18, sm: 22, md: 26 } }}>
                  Task Assigned
                  <span style={{ color: '#343748', fontWeight: 550, marginLeft: 10, fontSize: '0.9em' }}>({myAssignedTasks.length})</span>
              </Typography>
              <Box sx={{ width: '100%', overflowY: 'auto', overflowX: 'auto', maxHeight: 320, p: 0, m: 0 }}>
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontFamily: 'Nunito, Arial, sans-serif', margin: 0, padding: 0 }}>
                  <thead>
                    <tr>
                      <th style={{
                        textAlign: 'left',
                        width: '75%',
                        fontWeight: 550,
                        fontSize: '1rem',
                        padding: 0,
                        color: '#343748',
                        position: 'sticky',
                        top: 0,
                        background: '#fff',
                        zIndex: 10,
                        height: 44,
                        lineHeight: '44px',
                        boxSizing: 'border-box',
                        margin: 0,
                        border: 'none',
                        verticalAlign: 'middle',
                        outline: 'none',
                        boxShadow: 'none',
                      }}>Task</th>
                      <th style={{
                        textAlign: 'left',
                        width: '25%',
                        fontWeight: 550,
                        fontSize: '1rem',
                        padding: 0,
                        color: '#343748',
                        position: 'sticky',
                        top: 0,
                        background: '#fff',
                        zIndex: 10,
                        height: 44,
                        lineHeight: '44px',
                        boxSizing: 'border-box',
                        margin: 0,
                        border: 'none',
                        verticalAlign: 'middle',
                        outline: 'none',
                        boxShadow: 'none',
                      }}>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAssignedTasks.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: 0, border: 'none' }}>
                          <Box sx={{ borderRadius: 2, background: '#fff' }}>
                            <EmptyState
                              title="No Assigned Tasks"
                              description="Assigned tasks for this property will appear here."
                              iconType="task"
                              compact
                              minHeight={130}
                            />
                          </Box>
                        </td>
                      </tr>
                    ) : (
                      myAssignedTasks.map((task) => (
                        <tr key={task.id}>
                          {/* <td colSpan={3} style={{ padding: 0, border: 'none' }}>
                            <Box sx={{ display: 'flex', alignItems: 'left', borderRadius: 2, border: '1px solid #A3D9A5', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', width: "100%", background: '#fff', p: '12px 18px', fontWeight: 600 }}>
                              <Box sx={{ flex: 2, position: 'relative', fontWeight: 400, color: '#343748', fontSize: '1rem', textAlign: 'left' }}>{task.name}</Box>
                              <Box sx={{ flex: 2, position: 'relative', fontWeight: 400, left: "5%", color: '#343748', fontSize: '1rem', textAlign: 'left' }}>{property?.type || ''}</Box>
                              <Box sx={{ flex: 1, position: 'relative', fontWeight: 400, left: "6%", color: '#343748', fontSize: '1rem', textAlign: 'left' }}>{task.date}</Box>
                            </Box>
                          </td> */}
                          <td style={{ padding: 0, height: 44, lineHeight: '44px', border: 'none', verticalAlign: 'middle', overflow: 'hidden', paddingLeft: '12px' }}>
                            <Box sx={{ fontWeight: 400, color: '#343748', fontSize: '1rem', lineHeight: '44px', height: 44, display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</Box>
                          </td>
                          <td style={{ padding: 0, height: 44, lineHeight: '44px', border: 'none', verticalAlign: 'middle' }}>
                            <Box sx={{ fontWeight: 400, color: '#343748', fontSize: '1rem', lineHeight: '44px', height: 44, display: 'flex', alignItems: 'center' }}>{formatShortDate(task.date)}</Box>
                          </td>
                        </tr>
                      )))
                    }
                  </tbody>
                </table>
              </Box>
              </Paper>
            </Box>
          )}
        </Box>
        {/* Security Deposit and Lease Tracking Section - Figma-style UI */}
        {property?.isRental && (isRealPM || isPMview) && (
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 1.5 }}>
          <Paper sx={{ flex: 1, p: { xs: 2, sm: 4 },  borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.13)', position: 'relative', minWidth: 280 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography fontWeight={550} sx={{
                textAlign: 'left',
                color: '#343748',
                fontFamily: 'Nunito, Arial, sans-serif',
                fontSize: { xs: 18, sm: 22, md: 26 } }}>
                  Security Deposit
              </Typography>
              <Button size="small" sx={{ minWidth: 0, px: 2, py: 0.5, fontSize: 13, fontWeight: 400, borderRadius: 2, background: '#fff', border: '1px solid #B0B8C1', color: '#333', boxShadow: 'none', textTransform: 'none', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }} onClick={handleSecurityDepositModal}>Edit</Button>
            </Box>
            {/* Security Deposit Edit Modal */}
            <Dialog open={securityDepositModalOpen} onClose={() => setSecurityDepositModalOpen(false)} maxWidth="xs" fullWidth>
              <DialogTitle sx={{ fontWeight: 550, color: '#2D3442', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 18, pb: 1 }}>
                Security Deposit Information
              </DialogTitle>
              <DialogContent sx={{ pt: 1, pb: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  <TextField
                    label="Security Deposit"
                    fullWidth
                    value={(() => {
                      const val = formatNumber(editForm?.securityDeposit ?? '');
                      return val ? `$${val}` : '';
                    })()}
                    onChange={e => {
                      // Remove $ and commas and non-numeric except dot and dash
                      let raw = e.target.value.replace(/[^\d.]/g, ''); // Remove negative sign
                      // Prevent negative numbers
                      if (raw.startsWith('-')) raw = raw.replace('-', '');
                      setEditForm(f => f ? { ...f, securityDeposit: raw } : f);
                    }}
                    sx={{ flex: 1 }}
                    inputProps={{ inputMode: 'numeric', min: 0, maxLength: 8 }}
                  />
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Received Date"
                      value={editForm?.securityDepositDate && isValidDateFns(parseDateFns(editForm.securityDepositDate, 'MM/dd/yyyy', new Date()))
                        ? parseDateFns(editForm.securityDepositDate, 'MM/dd/yyyy', new Date())
                        : null}
                      disableFuture
                      onChange={date => {
                        let newDate = '';
                        if (date instanceof Date && isValidDateFns(date)) {
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          if (date > today) {
                            // If future, do not update
                            date = today;
                          }
                          newDate = formatDateFns(date, 'MM/dd/yyyy');
                        }
                        setEditForm(f => f ? { ...f, securityDepositDate: newDate } : f);
                      }}
                      slotProps={{ textField: { fullWidth: true, sx: { flex: 1, bgcolor: '#fff' } } }}
                      format="MM/dd/yyyy"
                    />
                  </LocalizationProvider>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                    <Button variant="outlined" onClick={() => setSecurityDepositModalOpen(false)} sx={{ textTransform: 'none', minWidth: 110, borderRadius: 2, fontWeight: 400, color: '#2D3442', borderColor: '#B0B8C1', background: '#fff', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }}>
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      disabled={
                        !(
                          (editForm?.securityDeposit !== property?.securityDeposit?.toString()) ||
                          (editForm?.securityDepositDate !== property?.securityDepositDate)
                        )
                      }
                      sx={{ textTransform: 'none', borderRadius: 2, minWidth: 110, background: '#89AE99', color: '#fff', fontWeight: 400, boxShadow: 'none', fontSize: 15 }}
                      onClick={handleUpdateSecurityDeposit}
                    >
                      Update
                    </Button>
                  </Box>
                </Box>
              </DialogContent>
            </Dialog>
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ color: '#4A4A4A', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.2, fontSize: { xs: 11, sm: 13, md: 15, lg: 16, xl: 16 }, '@media (max-width:1350px)': { fontSize: 14 } }}>
                  Security Deposit: {(property?.securityDeposit !== undefined && property?.securityDeposit !== null && String(property.securityDeposit) !== '') ? `$${Number(property.securityDeposit).toLocaleString()}` : ''}
                </Typography>
                <Typography sx={{ color: '#4A4A4A', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.2, fontSize: { xs: 11, sm: 13, md: 15, lg: 16, xl: 16 }, '@media (max-width:1350px)': { fontSize: 14 } }}>
                  Received Date: {property?.securityDepositDate ? property.securityDepositDate : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {(property?.securityDeposit && property.securityDeposit !== undefined) ? (
                  <img
                    src="/collection.png"
                    alt="Collected"
                    style={{
                      height: 120,
                      width: 180,
                      position: 'absolute',
                      right: property?.securityDepositDate == null ? '18%' : '15%',
                      top: `calc(50% - 60px)`,
                      transform: 'rotate(-4deg)',
                    }}
                />) : null}
              </Box>
            </Box>
          </Paper>
            <Paper sx={{ flex: 1, p: { xs: 2, sm: 4 },  borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.13)', position: 'relative', minWidth: 280 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0 }}>
              <Typography fontWeight={550} sx={{ 
                textAlign: 'left',
                mb: 0, 
                color: '#343748',
                fontFamily: 'Nunito, Arial, sans-serif',
                fontSize: { xs: 18, sm: 22, md: 26 } }}>
                  Lease Tracking
              </Typography>
              <Button size="small" sx={{ minWidth: 0, px: 2, py: 0.5, fontSize: 13, fontWeight: 400, borderRadius: 2, background: '#fff', border: '1px solid #B0B8C1', color: '#333', boxShadow: 'none', textTransform: 'none', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }} onClick={handleOpenLeaseModal}>Edit</Button>
            </Box>
            {/* Lease Tracking Edit Modal */}
          <Dialog open={leaseModalOpen} onClose={() => setLeaseModalOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 550, color: '#2D3442', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 18, pb: 2 }}>
              Lease Tracking
            </DialogTitle>
            <DialogContent sx={{ pt: 1, pb: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                {/* <Typography sx={{ fontWeight: 600, color: '#2D3442', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15 }}>Lease Starts</Typography>
                <TextField
                  value={editForm?.leaseStart || ''}
                  onChange={e => setEditForm(f => f ? { ...f, leaseStart: e.target.value } : f)}
                  placeholder="08/07/2024"
                  fullWidth
                /> */}
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Lease Starts"
                    value={editForm?.leaseStart && isValidDateFns(parseDateFns(editForm.leaseStart, 'MM/dd/yyyy', new Date()))
                      ? parseDateFns(editForm.leaseStart, 'MM/dd/yyyy', new Date())
                      : null}
                    disableFuture
                    onChange={date => {
                      let newDate = '';
                      if (date instanceof Date && isValidDateFns(date)) {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        if (date > today) {
                          // If future, do not update
                          date = today;
                        }
                        newDate = formatDateFns(date, 'MM/dd/yyyy');
                      }
                      setEditForm(f => f ? { ...f, leaseStart: newDate } : f);
                    }}
                    slotProps={{ textField: { fullWidth: true, sx: { flex: 1, bgcolor: '#fff' } } }}
                    format="MM/dd/yyyy"
                  />
                </LocalizationProvider>
                {/* Lease Ends */}
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Lease Ends"
                    minDate={editForm?.leaseStart && isValidDateFns(parseDateFns(editForm.leaseStart, 'MM/dd/yyyy', new Date()))
                      ? parseDateFns(editForm.leaseStart, 'MM/dd/yyyy', new Date())
                      : undefined}
                    value={editForm?.leaseEnd && isValidDateFns(parseDateFns(editForm.leaseEnd, 'MM/dd/yyyy', new Date()))
                      ? parseDateFns(editForm.leaseEnd, 'MM/dd/yyyy', new Date())
                      : null}
                    onChange={date => {
                      let newDate = '';
                      let leaseStartDate = editForm?.leaseStart && isValidDateFns(parseDateFns(editForm.leaseStart, 'MM/dd/yyyy', new Date()))
                        ? parseDateFns(editForm.leaseStart, 'MM/dd/yyyy', new Date())
                        : null;
                      if (date instanceof Date && isValidDateFns(date)) {
                        if (leaseStartDate && date <= leaseStartDate) {
                          newDate = formatDateFns(new Date(leaseStartDate.getTime() + 86400000), 'MM/dd/yyyy'); // next day
                        } else {
                          newDate = formatDateFns(date, 'MM/dd/yyyy');
                        }
                      }
                      setEditForm(f => f ? { ...f, leaseEnd: newDate } : f);
                    }}
                    slotProps={{ textField: { fullWidth: true, sx: { flex: 1, bgcolor: '#fff' } } }}
                    format="MM/dd/yyyy"
                  />
                </LocalizationProvider>
                <TextField
                  label="Rental Rate"
                  fullWidth
                  value={(() => {
                    const val = formatNumber(editForm?.rentalRate ?? '');
                    return val ? `$${val}` : '';
                  })()}
                  onChange={e => {
                    // Remove $ and commas and non-numeric except dot and dash
                    let raw = e.target.value.replace(/[^\d.]/g, ''); // Remove negative sign
                    // Prevent negative numbers
                    if (raw.startsWith('-')) raw = raw.replace('-', '');
                    // Convert to number (or undefined when empty) to match PropertyData.rentalRate type
                    const numeric = raw === '' ? undefined : Number(raw);
                    setEditForm(f => f ? { ...f, rentalRate: numeric } : f);
                  }}
                  sx={{ flex: 1 }}
                  inputProps={{ inputMode: 'numeric', min: 0, maxLength: 8 }}
                />
                {/* <Typography sx={{ fontWeight: 600, color: '#2D3442', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15 }}>Rent Renewal Suggestion</Typography>
                <TextField
                  value={editForm?.rentRenewalSuggestion !== undefined && editForm?.rentRenewalSuggestion !== null ? String(editForm.rentRenewalSuggestion) : ''}
                  onChange={e => {
                    // strip non-numeric characters (allow dot and dash), convert to number, use undefined when empty
                    const raw = e.target.value.replace(/[^\d.\-]/g, '');
                    const numeric = raw === '' ? undefined : Number(raw);
                    setEditForm(f => f ? { ...f, rentRenewalSuggestion: numeric } : f);
                  }}
                  placeholder="$1500"
                  fullWidth
                  sx={{ background: '#fff' }}
                /> */}
                <TextField
                  label="Rent Renewal Suggestion"
                  fullWidth
                  value={(() => {
                    const val = formatNumber(editForm?.rentRenewalSuggestion ?? '');
                    return val ? `$${val}` : '';
                  })()}
                  onChange={e => {
                    // Remove $ and commas and non-numeric except dot and dash
                    let raw = e.target.value.replace(/[^\d.]/g, ''); // Remove negative sign
                    // Prevent negative numbers
                    if (raw.startsWith('-')) raw = raw.replace('-', '');
                    // Convert to number (or undefined when empty) to match PropertyData.rentalRate type
                    const numeric = raw === '' ? undefined : Number(raw);
                    setEditForm(f => f ? { ...f, rentRenewalSuggestion: numeric } : f);
                  }}
                  sx={{ flex: 1 }}
                  inputProps={{ inputMode: 'numeric', min: 0, maxLength: 8 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'right', gap: 2, mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => setLeaseModalOpen(false)}
                    sx={{ textTransform: 'none', minWidth: 120, borderRadius: 2, fontWeight: 400, color: '#2D3442', borderColor: '#B0B8C1', background: '#fff', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    disabled={
                      !(
                        (editForm?.leaseStart !== property?.leaseStart) ||
                        (editForm?.leaseEnd !== property?.leaseEnd) ||
                        (editForm?.rentalRate !== property?.rentalRate) ||
                        (editForm?.rentRenewalSuggestion !== property?.rentRenewalSuggestion)
                      )
                    }
                    onClick={handleUpdateLease}
                    sx={{ textTransform: 'none', minWidth: 120, borderRadius: 2, fontWeight: 400, background: '#8CB7A1', color: '#fff', boxShadow: 'none', '&:hover': { background: '#7AA68F' } }}
                  >
                    Update
                  </Button>
                </Box>
              </Box>
            </DialogContent>
          </Dialog>
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ color: '#4A4A4A', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.2, fontSize: { xs: 11, sm: 13, md: 15, lg: 16, xl: 16 }, '@media (max-width:1350px)': { fontSize: 14 } }}>
                  Lease Starts: {property?.leaseStart || ''}
                </Typography>
                <Typography sx={{ color: '#4A4A4A', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.2, fontSize: { xs: 11, sm: 13, md: 15, lg: 16, xl: 16 }, '@media (max-width:1350px)': { fontSize: 14 } }}>
                  Lease Ends: {property?.leaseEnd || ''}
                </Typography>
                <Typography sx={{ color: '#4A4A4A', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.2, fontSize: { xs: 11, sm: 13, md: 15, lg: 16, xl: 16 }, '@media (max-width:1350px)': { fontSize: 14 } }}>
                  Rental Rate: {property?.rentalRate !== undefined && property?.rentalRate !== null ? `$${Number(property.rentalRate).toLocaleString()}` : ''}
                </Typography>
                <Typography sx={{ color: '#4A4A4A', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.2, fontSize: { xs: 11, sm: 13, md: 15, lg: 16, xl: 16 }, '@media (max-width:1350px)': { fontSize: 14 } }}>
                  Rent Renewal Suggestion: {property?.rentRenewalSuggestion !== undefined && property?.rentRenewalSuggestion !== null ? `$${Number(property.rentRenewalSuggestion).toLocaleString()}` : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100, mt: -4 }}>
                {(() => {
                  interface MonthsLeftResult {
                    value: number | string;
                    label: string;
                  }

                  function getMonthsLeft(endDateStr?: string | null): MonthsLeftResult {
                    if (!endDateStr) return { value: '', label: '' };
                    const now: Date = new Date();
                    const end: Date = new Date(endDateStr);
                    if (isNaN(end.getTime())) return { value: '', label: '' };
                    let months: number = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
                    // If the end day is before the current day, don't count the current month
                    if (end.getDate() < now.getDate()) months--;
                    if (months < 0) months = 0;
                    if (months === 0) return { value: 0, label: 'Month Left' };
                    if (months === 1) return { value: 1, label: 'Month Left' };
                    return { value: months, label: 'Months Left' };
                  }
                  const { value, label } = getMonthsLeft(property?.leaseEnd || '');
                  return (
                    <>
                      <span style={{ fontSize: 56, color: '#89AE99', fontWeight: 550, lineHeight: 1 }}>{value}</span>
                      <span style={{ fontSize: 24, color: '#343748', fontWeight: 550, lineHeight: 1 }}>{label}</span>
                    </>
                  );
                })()}
              </Box>
            </Box>
          </Paper>
          </Box>
        )}

        {/* Forecasting and Planning Section */}
        <ForecastingSection
          forecasting={property?.forecasting}
          roofProgress={roofProgress}
          hvacProgress={hvacProgress}
          waterProgress={waterProgress}
          sidebar={sidebar}
          onEditClick={handleOpenForecastModal}
        />

        {/* Overall Property Health Section */}
        <PropertyHealthSection
          completedTasksThisMonth={completedTasksThisMonth}
          totalOverallHealthValue={totalOverallHealthValue}
          topContributor={topContributor}
        />

        {/* Property Inventory Section - Flexbox Grid */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, boxShadow: '0 2px 8px rgba(0,0,0,0.13)', borderRadius: 2, mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', mb: 2 }}>
              <Typography variant="h5" fontWeight={550} sx={{ textAlign: 'center', mb: 2, color: '#343748', fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 18, sm: 22, md: 26 } }}>Property Inventory</Typography>
              <Button variant="outlined" sx={{ borderColor: '#e0e0e0', color: '#343748', borderRadius: 2, fontWeight: 400, position: 'absolute', right: 0, textTransform: 'none', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }} onClick={() => setAddItemOpen(true)}>+Add Item</Button>
              {/* Add Item Modal */}
              <Dialog open={addItemOpen} onClose={() => setAddItemOpen(false)} maxWidth='xs' fullWidth>
                <DialogContent sx={{ px: 4, py: 2 }}>
                  <DialogTitle sx={{ ml: -3, fontWeight: 550, mb: 1, fontSize: 22, fontFamily: 'Nunito, Arial, sans-serif', }}>Add Item</DialogTitle>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                    <Autocomplete
                      freeSolo
                      options={[  'Fridge',
                        'Microwave',
                        'Dishwasher',
                        'Washing Machine',
                        'Dryer',
                        'Smoke Detectors',
                        'CO Detectors',
                        'Garage Door',
                        'Water Heater Tank',
                        'HVAC',
                      ]}
                      value={newItem.type}
                      onInputChange={(_, value) => {
                        if (value.length <= 20) setNewItem(item => ({ ...item, type: value }));
                      }}
                      renderInput={(params) => (
                        <TextField {...params} label="Type" fullWidth sx={{ bgcolor: '#fff', borderRadius: 2 }} inputProps={{ ...params.inputProps, maxLength: 20 }} />
                      )}
                    />
                    <TextField
                      label="Brand"
                      value={newItem.brand}
                      onChange={e => {
                        const value = e.target.value;
                        if (value.length <= 20) setNewItem(item => ({ ...item, brand: value }));
                      }}
                      fullWidth
                      sx={{ bgcolor: '#fff', borderRadius: 2 }}
                      inputProps={{ maxLength: 20 }}
                    />
                    <TextField
                      label="Model"
                      value={newItem.model}
                      onChange={e => {
                        const value = e.target.value;
                        if (value.length <= 32) setNewItem(item => ({ ...item, model: value }));
                      }}
                      fullWidth
                      sx={{ bgcolor: '#fff', borderRadius: 2 }}
                      inputProps={{ maxLength: 32 }}
                    />
                    <TextField
                      label="Serial number (optional)"
                      value={newItem.serial}
                      onChange={e => {
                        const value = e.target.value;
                        if (value.length <= 32) setNewItem(item => ({ ...item, serial: value }));
                      }}
                      fullWidth
                      sx={{ bgcolor: '#fff', borderRadius: 2 }}
                      inputProps={{ maxLength: 32 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'right', gap: 3, mt: 2 }}>
                    <Button variant="outlined" sx={{ fontFamily: 'Nunito, Arial, sans-serif', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' }, borderRadius: 2, px: 4, py: 1.5, minWidth: 110, color: '#333', borderColor: '#D9D9D9', background: '#fff', textTransform: 'none', fontWeight: 400 }} onClick={() => setAddItemOpen(false)}>Cancel</Button>
                    <Button variant="contained" sx={{ textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif', bgcolor: '#89AE99', color: '#fff', borderRadius: 2, fontWeight: 550, px: 4, py: 1.5, fontSize: 15 }}
                      disabled={!newItem.type && !newItem.brand && !newItem.model && !newItem.serial}
                      onClick={async () => {
                        console.log('Add Item clicked', { newItem, property });
                        if (newItem.type && property) {
                          const itemString = `${newItem.type}~${newItem.brand || ''}~${newItem.model || ''}~${newItem.serial || ''}`;
                          // Check for duplicate
                          const exists = (property.inventory || []).some(item => item === itemString);
                          if (exists) {
                            setAddItemOpen(false);
                            setNewItem({ type: '', brand: '', model: '', serial: '' });
                            return;
                          }
                          const updatedInventory = [...(property.inventory || []), itemString];
                          // Update local state immediately for instant UI feedback
                          setProperty(prev => prev ? { ...prev, inventory: updatedInventory } : prev);
                          const docRef = doc(db, "properties", currentPropertyId);
                          await updateDoc(docRef, { inventory: updatedInventory });
                          console.log('Inventory updated in Firestore', updatedInventory);

                          try {
                            if (!user) {
                              console.log('No user found, aborting task creation');
                              return;
                            }
                            // Dynamically import task.json
                            const taskTemplates = (await import('../context/task.json')).default;
                            console.log('Loaded taskTemplates', taskTemplates);
                            const matchingTemplates = taskTemplates.filter(t => t.inventory && t.inventory === newItem.type);
                            console.log('Matching templates for inventory', newItem.type, matchingTemplates);
                            const recurringTasks = getNextUniqueTasks(matchingTemplates);
                            console.log('Recurring tasks to add', recurringTasks);
                            const results = await Promise.all(
                              recurringTasks.map(template => {
                                const newTask = {
                                  title: template.title,
                                  description: template.description,
                                  type: template.type,
                                  startDate: template.startDate,
                                  dueDate: template.dueDate,
                                  recurrency: {
                                    frequency: template.frequency,
                                    interval: template.interval
                                  },
                                  propertyId: currentPropertyId,
                                  ownerId: user.uid,
                                  status: 'pending',
                                  createdAt: new Date().toISOString(),
                                  updatedAt: new Date().toISOString(),
                                  assigned_user: null,
                                  completedBy: '',
                                  inventory: template.inventory,
                                };
                                console.log('Adding new task', newTask);
                                return addDoc(collection(db, "tasks"), newTask);
                              })
                            );
                            console.log('Task add results', results);
                          } catch (err) {
                            console.error('Error adding tasks for inventory:', err);
                          }
                          setAddItemOpen(false);
                          setNewItem({ type: '', brand: '', model: '', serial: '' });
                        } else {
                          console.log('Missing required fields for Add Item', { newItem, property });
                        }
                      }}
                    >Add Item</Button>
                  </Box>
                </DialogContent>
              </Dialog>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {(property && Array.isArray(property.inventory) && property.inventory.length > 0) ? (
              <>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gridAutoFlow: 'row',
                  gap: 4,
                  width: '100%',
                  justifyItems: 'center',
                  alignItems: 'center',
                  mt: 2
                }}>
                  {(() => {
                    // Predefined order
                    const ORDER = [
                      'Fridge', 'Microwave', 'Dishwasher', 'Washing Machine',
                      'Dryer', 'Smoke Detectors', 'CO Detectors', 'Garage Door',
                      'Water Heater Tank', 'Air Filter'
                    ];
                    // Map property.inventory to a lookup by type
                    const inventoryMap: { [type: string]: string } = {};
                    property.inventory.forEach((name: string) => {
                      const parts = name.split('~').map(s => s.trim());
                      const type = parts[0] || '';
                      inventoryMap[type] = name;
                    });
                    // Show items in ORDER first
                    // Only show items from Firebase inventory, ordered by ORDER array
                    const inventoryItems = [...property.inventory]
                      .map((name: string) => {
                        const parts = name.split('~').map(s => s.trim());
                        let type = parts[0] || '';
                        // If type is HVAC, display as Air Filter
                        const displayType = type === 'HVAC' ? 'Air Filter' : type;
                        const brand = parts[1] || '';
                        const model = parts[2] || '';
                        const serial = parts[3] || '';
                        const iconFile = `/inventory/${displayType.replace(/ /g, '%20')}.png`;
                        return {
                          name,
                          type,
                          displayType,
                          brand,
                          model,
                          serial,
                          iconFile
                        };
                      });
                    // Sort by ORDER array, then by original order
                    inventoryItems.sort((a, b) => {
                      const aIdx = ORDER.indexOf(a.displayType);
                      const bIdx = ORDER.indexOf(b.displayType);
                      if (aIdx === -1 && bIdx === -1) return 0;
                      if (aIdx === -1) return 1;
                      if (bIdx === -1) return -1;
                      return aIdx - bIdx;
                    });
                    return inventoryItems.map((item, idx) => (
                      <Box key={item.name + idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2, boxShadow: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedInventory({
                            name: item.name ?? '',
                            type: item.displayType ?? '',
                            brand: item.brand ?? '',
                            model: item.model ?? '',
                            serial: item.serial ?? ''
                          });
                          setInventoryModalOpen(true);
                        }}
                      >
                        <img
                          src={item.iconFile}
                          alt={item.displayType}
                          style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 8, background: '#ededed', borderRadius: 12 }}
                          onError={e => {
                            const img = e.target as HTMLImageElement;
                            img.onerror = null;
                            img.src = '/inventory/default.png';
                          }}
                        />
                        <Typography fontWeight={550} sx={{ fontFamily: 'Nunito, Arial, sans-serif' }}>{item.displayType}</Typography>
                      </Box>
                    ));
                  })()}
                </Box>
                {/* Inventory Edit Modal */}
                <Dialog open={inventoryModalOpen} onClose={() => setInventoryModalOpen(false)} maxWidth="xs" fullWidth>
                  <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mt: 2, px: 4 }}>Edit Inventory Item</DialogTitle>
                  <DialogContent sx={{ p: 4 }}>
                    {selectedInventory && (
                      <InventoryEditForm
                        property={property}
                        currentPropertyId={currentPropertyId}
                        selectedInventory={selectedInventory}
                        setInventoryModalOpen={setInventoryModalOpen}
                        setProperty={setProperty}
                      />
                    )}
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <EmptyState
                title="No Inventory Items"
                description="Add inventory items to keep track of important home equipment."
                iconType="property"
                compact
                minHeight={170}
              />
            )}
          </Box>
        </Paper>

        {/* Utilities left, Three sections stacked right, equal height */}
        <Box sx={{ display: 'flex', height: 680, flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 1, md: 1.5 }, mb: 1.5, alignItems: 'stretch' }}>
          {/* Left: Utilities */}
          <Box sx={{ flex: 1, minWidth: { xs: 0, sm: 320 }, display: 'flex', flexDirection: 'column' }}>
            <Paper
              sx={(() => {
                const count = property?.utilities?.length || 0;
                // Three sections on right: Insurance height: 220, Rental Insurance height: 220, Documents height: 220
                const minHeight = 680; // 220 + 220 + 220, matches right side
                if (count > 4) {
                  return {
                    p: 3,
                    borderRadius: 2,
                    height: '100%',
                    minHeight,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
                    overflowY: 'auto',
                  };
                }
                return {
                  p: 3,
                  borderRadius: 2,
                  minHeight,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
                };
              })()}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="h5" fontWeight={550} sx={{ textAlign: 'center', color: '#343748', fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 18, sm: 22, md: 26 } }}>Utilities</Typography>
                <Button
                  variant="outlined"
                  sx={{ textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif', borderColor: '#e0e0e0', color: '#343748', borderRadius: 2, fontWeight: 400,  '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }}
                  onClick={() => setAddUtilityOpen(true)}
                >
                  + Add Utility
                </Button>
              </Box>
              {(property?.utilities && property.utilities.length > 0) ? (
                <>
                  <Box
                    sx={(() => {
                      const count = property.utilities.length;
                      if (count > 4) {
                        return { maxHeight: '90%', overflowY: 'auto', pr: 1 };
                      }
                      return {};
                    })()}
                  >
                    {property.utilities.map((util, idx) => (
                      <UtilityCard
                        key={idx}
                        utility={util}
                        onEdit={() => handleEditUtility(util, idx)}
                      />
                    ))}
                  </Box>
                  {/* Utility Delete Confirmation Modal */}
                  <Dialog open={deleteUtilityIdx !== null} onClose={() => setDeleteUtilityIdx(null)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 18 }}>Remove Utility</DialogTitle>
                    <DialogContent sx={{ p: 3 }}>
                      <Box sx={{ fontFamily: 'Nunito, Arial, sans-serif', bgcolor: '#F9B55D', color: '#343748', borderRadius: '8px', p: '16px 24px', mb: 2, fontWeight: 400, fontSize: 18, letterSpacing: 0, lineHeight: 1.3, boxSizing: 'border-box' }}>
                        Are you sure you want to remove this utility?
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <Button
                          onClick={() => {
                            setDeleteUtilityIdx(null);
                            // Keep edit modal open after cancel
                          }}
                          sx={{ borderRadius: '8px', minWidth: 120, height: 44, bgcolor: '#fff', color: '#343748', fontWeight: 400, fontSize: 18, fontFamily: 'Nunito, Arial, sans-serif', border: '1.5px solid #D9D9D9', boxShadow: 'none', textTransform: 'none', '&:hover': { bgcolor: '#f5f5f5', borderColor: '#B0B8C1' } }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={async () => {
                            if (deleteUtilityIdx === null || !property || !property.utilities) return;
                            setDeleteUtilityLoading(true);
                            try {
                              const updatedUtilities = property.utilities.filter((_, i) => i !== deleteUtilityIdx);
                              const docRef = doc(db, 'properties', currentPropertyId);
                              await updateDoc(docRef, { utilities: updatedUtilities });
                              setProperty(prev => prev ? { ...prev, utilities: updatedUtilities } : prev);
                              setDeleteUtilityIdx(null);
                              setEditUtilityOpen(false);
                              setEditUtilityIndex(null);
                              setEditUtilityType('');
                              setEditUtilityCompany('');
                              setEditUtilityAccount('');
                              setEditUtilityUrl('');
                            } catch (err) {
                              alert('Failed to delete utility.');
                            }
                            setDeleteUtilityLoading(false);
                          }}
                          disabled={deleteUtilityLoading}
                          sx={{ borderRadius: '8px', minWidth: 120, height: 44, bgcolor: '#E57373', color: '#fff', fontWeight: 400, fontSize: 18, fontFamily: 'Nunito, Arial, sans-serif', boxShadow: 'none', textTransform: 'none', '&:hover': { bgcolor: '#d32f2f' } }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </DialogContent>
                  </Dialog>
                </>
              ) : (
                <EmptyState
                  title="No Utilities Added"
                  description="Add utility providers to keep your billing and account details in one place."
                  iconType="default"
                  compact
                  minHeight={170}
                />
              )}
            </Paper>
          </Box>
          {/* Right: Upcoming Tasks and Insurance stacked */}
          <Box sx={{ flex: 1, minWidth: { xs: 0, sm: 320 }, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
            {/* Insurance Section - always show as second section for rental properties, show for non-rental as well */}
            <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, height: 220, maxHeight: 220, minHeight: 180, display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.13)', gap: 1.5, overflow: 'auto' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h5" fontWeight={550} sx={{ textAlign: 'center', color: '#343748', fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 18, sm: 22, md: 26 } }}>Insurance</Typography>
                <Button variant="outlined" sx={{ bgcolor: '#fff', color: '#343748', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', textTransform: 'none', borderColor: '#e0e0e0', px: 2, py: 0.5, fontSize: 14, borderRadius: 2, '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }} onClick={handleEnsuranceModal}>Edit</Button>
                {/* Edit Insurance Modal */}
                <Dialog open={editInsuranceOpen} onClose={() => setEditInsuranceOpen(false)} maxWidth="xs" fullWidth>
                  <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ p: 4, bordersRadius: 4, bgcolor: '#fff', minWidth: 340 }}>
                      <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 3, p: 0 }}>Edit Insurance Information</DialogTitle>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 1 }}>
                        <TextField
                          label="Insurance company name"
                          value={editForm?.insurance?.insuranceCompany || ''}
                          onChange={e => {
                            const value = e.target.value.slice(0, 30);
                            setEditForm(prev => prev ? {
                              ...prev,
                              insurance: {
                                insuranceCompany: value,
                                assetsCovered: prev.insurance?.assetsCovered || '',
                                policyNumber: prev.insurance?.policyNumber || '',
                                dueDate: prev.insurance?.dueDate || '',
                                amount: prev.insurance?.amount || '0.00'
                              }
                            } : prev);
                          }}
                          fullWidth
                          sx={{ bgcolor: '#fff', borderRadius: 1, fontSize: 16, '& .MuiInputBase-root': { borderRadius: 1, fontSize: 16 } }}
                          InputLabelProps={{ sx: { fontSize: 16 } }}
                          inputProps={{ maxLength: 30 }}
                        />
                        {/* <TextField
                          label="Assets covered"
                          // value={editForm?.insurance?.assetsCovered || ''}
                          value={'Home'}
                          onChange={e => {
                            const value = e.target.value.slice(0, 30);
                            setEditForm(prev => prev ? {
                              ...prev,
                              insurance: {
                                insuranceCompany: prev.insurance?.insuranceCompany || '',
                                assetsCovered: value,
                                policyNumber: prev.insurance?.policyNumber || ''
                              }
                            } : prev);
                          }}
                          fullWidth
                          sx={{ bgcolor: '#fff', borderRadius: 2, fontSize: 16, '& .MuiInputBase-root': { borderRadius: 2, fontSize: 16 } }}
                          InputLabelProps={{ sx: { fontSize: 16 } }}
                          inputProps={{ maxLength: 30 }}
                        /> */}
                        <Autocomplete
                          freeSolo
                          options={[  'Home',
                          ]}
                          value={editForm?.insurance?.assetsCovered || ''}
                          onInputChange={(_, value) => {
                            if (value.length <= 20)
                              setEditForm(prev => prev ? {
                                ...prev,
                                insurance: {
                                  insuranceCompany: prev.insurance?.insuranceCompany || '',
                                  assetsCovered: value,
                                  policyNumber: prev.insurance?.policyNumber || '',
                                  dueDate: prev.insurance?.dueDate || '',
                                  amount: prev.insurance?.amount || '0.00'
                                }
                              } : prev);
                          }}
                          renderInput={(params) => (
                            <TextField {...params} label="Assets covered" fullWidth sx={{ bgcolor: '#fff', borderRadius: 1, fontSize: 16, '& .MuiInputBase-root': { borderRadius: 1, fontSize: 16 } }} inputProps={{ ...params.inputProps, maxLength: 20 }} />
                          )}
                        />
                        <TextField
                          label="Policy number (optional)"
                          value={editForm?.insurance?.policyNumber || ''}
                          onChange={e => {
                            // Allow any character, up to 30 chars
                            const value = e.target.value.slice(0, 30);
                            setEditForm(prev => prev ? {
                              ...prev,
                              insurance: {
                                insuranceCompany: prev.insurance?.insuranceCompany || '',
                                assetsCovered: prev.insurance?.assetsCovered || '',
                                policyNumber: value,
                                dueDate: prev.insurance?.dueDate || '',
                                amount: prev.insurance?.amount || '0.00'
                              }
                            } : prev);
                          }}
                          fullWidth
                          sx={{ bgcolor: '#fff', borderRadius: 1, fontSize: 16, '& .MuiInputBase-root': { borderRadius: 1, fontSize: 16 } }}
                          InputLabelProps={{ sx: { fontSize: 16 } }}
                          inputProps={{ maxLength: 30 }}
                        />
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <TextField
                            label="Insurance Amount (optional)"
                            placeholder="0.00"
                            value={editForm?.insurance?.amount || ''}
                            onChange={e => {
                              let input = e.target.value;
                              input = input.replace(/[^0-9.]/g, '');
                              const parts = input.split('.');
                              if (parts.length > 2) return;
                              if (parts[1] && parts[1].length > 2) return;
                              setEditForm(prev => prev ? {
                                ...prev,
                                insurance: {
                                  insuranceCompany: prev.insurance?.insuranceCompany || '',
                                  assetsCovered: prev.insurance?.assetsCovered || '',
                                  policyNumber: prev.insurance?.policyNumber || '',
                                  dueDate: prev.insurance?.dueDate || '',
                                  amount: input ? input : '0.00'
                                }
                              } : prev);
                            }}
                            sx={{ flex: 1, bgcolor: '#fff', borderRadius: 1, fontSize: 16, '& .MuiInputBase-root': { borderRadius: 1, fontSize: 16 } }}
                            InputLabelProps={{ sx: { fontSize: 16 } }}
                            inputProps={{ inputMode: 'decimal', maxLength: 12 }}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            }}
                          />
                          <Autocomplete
                            options={['Monthly', 'Yearly']}
                            value={editForm?.insurance?.frequency || 'Monthly'}
                            onChange={(_, value) => {
                              setEditForm(prev => prev ? {
                                ...prev,
                                insurance: {
                                  insuranceCompany: prev.insurance?.insuranceCompany || '',
                                  assetsCovered: prev.insurance?.assetsCovered || '',
                                  policyNumber: prev.insurance?.policyNumber || '',
                                  dueDate: prev.insurance?.dueDate || '',
                                  amount: prev.insurance?.amount || '0.00',
                                  frequency: value || 'Monthly'
                                }
                              } : prev);
                            }}
                            disableClearable
                            sx={{ flex: 1 }}
                            renderInput={(params) => (
                              <TextField {...params} label="Term" fullWidth sx={{ bgcolor: '#fff', borderRadius: 1, fontSize: 16, '& .MuiInputBase-root': { borderRadius: 1, fontSize: 16 } }} />
                            )}
                          />
                        </Box>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DatePicker
                            label="Due Date (optional)"
                            value={editForm?.insurance?.dueDate && isValidDateFns(parseDateFns(editForm.insurance.dueDate, 'MM/dd/yyyy', new Date()))
                              ? parseDateFns(editForm.insurance.dueDate, 'MM/dd/yyyy', new Date())
                              : null}
                            onChange={date => {
                              let newDate = '';
                              if (date instanceof Date && isValidDateFns(date)) {
                                newDate = formatDateFns(date, 'MM/dd/yyyy');
                              }
                              setEditForm(prev => prev ? {
                                ...prev,
                                insurance: {
                                  insuranceCompany: prev.insurance?.insuranceCompany || '',
                                  assetsCovered: prev.insurance?.assetsCovered || '',
                                  policyNumber: prev.insurance?.policyNumber || '',
                                  dueDate: newDate,
                                  amount: prev.insurance?.amount || '0.00'
                                }
                              } : prev);
                            }}
                            slotProps={{ textField: { fullWidth: true, sx: { bgcolor: '#fff', borderRadius: 1, fontSize: 16, '& .MuiInputBase-root': { borderRadius: 1, fontSize: 16 } } } }}
                            format="MM/dd/yyyy"
                          />
                        </LocalizationProvider>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'right', gap: 3, mt: 2 }}>
                        <Button variant="outlined" sx={{ fontFamily: 'Nunito, Arial, sans-serif', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' }, borderRadius: 2, color: '#333', borderColor: '#D9D9D9', px: 3, py: 1, background: '#fff', fontSize: 14, textTransform: 'none', fontWeight: 400 }} onClick={() => setEditInsuranceOpen(false)}>Cancel</Button>
                        <Button variant="contained" sx={{ textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif', bgcolor: '#89AE99', color: '#fff', borderRadius: 2, fontWeight: 400, px: 3, py: 1, fontSize: 14, boxShadow: 'none', minWidth: 110 }}
                          disabled={!editForm?.insurance?.insuranceCompany && !editForm?.insurance?.assetsCovered && !editForm?.insurance?.policyNumber && !editForm?.insurance?.dueDate && !editForm?.insurance?.amount}
                          onClick={async () => {
                            if (!property || !currentPropertyId) return;
                            const docRef = doc(db, "properties", currentPropertyId);
                            const newInsurance = {
                              insuranceCompany: editForm?.insurance?.insuranceCompany || '',
                              assetsCovered: editForm?.insurance?.assetsCovered || '',
                              policyNumber: editForm?.insurance?.policyNumber || '',
                              dueDate: editForm?.insurance?.dueDate || '',
                              amount: editForm?.insurance?.amount ? editForm.insurance.amount : '0.00',
                              frequency: editForm?.insurance?.frequency || 'Monthly'
                            };
                            await updateDoc(docRef, { insurance: newInsurance });
                            setProperty(prev => prev ? { ...prev, insurance: newInsurance } : prev);
                            setEditInsuranceOpen(false);
                          }}
                        >Update</Button>
                      </Box>
                    </Box>
                  </DialogContent>
                </Dialog>
              </Box>
              <Box sx={{ display: 'flex', gap: 3, justifyContent: 'space-between', width: '100%' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                  <Typography fontFamily="Nunito, Arial, sans-serif" color="#374748" fontWeight={550} sx={{ fontSize: '0.95rem' }}>Insurance Company: <span style={{ color: '#374748', fontWeight: 400 }}>{property?.insurance?.insuranceCompany || ''}</span></Typography>
                  <Typography fontFamily="Nunito, Arial, sans-serif" color="#374748" fontWeight={550} sx={{ fontSize: '0.95rem' }}>Assets Covered: <span style={{ color: '#374748', fontWeight: 400 }}>{property?.insurance?.assetsCovered || 'Home, auto'}</span></Typography>
                  <Typography fontFamily="Nunito, Arial, sans-serif" color="#374748" fontWeight={550} sx={{ fontSize: '0.95rem' }}>Policy number: <span style={{ color: '#374748', fontWeight: 400 }}>{property?.insurance?.policyNumber || ''}</span></Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
                  <Typography sx={{ fontSize: '2rem', fontWeight: 550, color: '#89AE99', fontFamily: 'Nunito, Arial, sans-serif' }}>{property?.insurance?.amount ? `$${formatNumber(String(property.insurance.amount || '0').split('.')[0])}.${String(property.insurance.amount || '0').includes('.') ? String(property.insurance.amount).split('.')[1] : '00'}` : '$0.00'}</Typography>
                  {property?.insurance?.dueDate && (
                    <Typography sx={{ fontSize: '0.85rem', color: '#6B7280', fontFamily: 'Nunito, Arial, sans-serif' }}>
                      {formatDateFns(parseDateFns(property.insurance.dueDate, 'MM/dd/yyyy', new Date()), 'MMM d yyyy')}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Paper>
            {/* Property Taxes Section */}
            <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, height: 220, maxHeight: 220, minHeight: 180, display: 'flex', flexDirection: 'row', boxShadow: '0 2px 8px rgba(0,0,0,0.13)', gap: 2, overflow: 'hidden', position: 'relative' }}>
              {/* Flip button - positioned top right */}
              <Button variant="outlined" onClick={() => {
                setEditPropertyTaxesOpen(true);
                const taxHistory = ((property as any)?.propertyTaxHistory || []);
                setLocalTaxHistory(taxHistory);
                setSelectedPropertyTaxYear(null);
                
                // Clear fields for adding new entry
                setEditTaxDate(null);
                setEditingTaxAmount('');
              }} sx={{ position: 'absolute', top: { xs: 12, sm: 16 }, right: { xs: 12, sm: 16 }, bgcolor: '#fff', color: '#343748', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', textTransform: 'none', borderColor: '#e0e0e0', px: 2, py: 0.5, fontSize: 14, borderRadius: 2, mr: 1, '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' }, zIndex: 10 }}>Edit</Button>
              {/* Edit Property Taxes Modal */}
              <Dialog open={editPropertyTaxesOpen} onClose={() => setEditPropertyTaxesOpen(false)} maxWidth="sm" fullWidth>
                <DialogContent sx={{ p: 0 }}>
                  <Box sx={{ p: 4, borderRadius: 2, bgcolor: '#fff', minWidth: 400 }}>
                    <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 3, p: 0 }}>Edit Property Tax</DialogTitle>
                    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, mb: 1.5 }}>
                      <Box sx={{ flex: 1 }}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DatePicker
                            label="Property Tax Due Date"
                            value={editTaxDate}
                            disableFuture
                            maxDate={new Date()}
                            onChange={date => {
                              let newDate = null;
                              if (date instanceof Date && isValidDateFns(date)) {
                                const today = new Date();
                                today.setHours(0,0,0,0);
                                if (date > today) {
                                  // If future, do not update
                                  newDate = today;
                                } else {
                                  newDate = date;
                                }
                              }
                              setEditTaxDate(newDate);
                            }}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                error: (() => {
                                  if (!editTaxDate) return false;
                                  const selectedYear = new Date(editTaxDate).getFullYear();
                                  // If editing an existing entry, check against other entries
                                  if (selectedPropertyTaxYear) {
                                    const yearExists = localTaxHistory.some((item: any) => {
                                      const isSameEntry = item.date === selectedPropertyTaxYear.date && item.amount === selectedPropertyTaxYear.amount;
                                      if (isSameEntry) return false; // Exclude current entry
                                      const itemYear = parseInt(item.date.split(',')[1].trim());
                                      return itemYear === selectedYear;
                                    });
                                    return yearExists;
                                  }
                                  // If adding new entry, check against all entries
                                  const yearExists = localTaxHistory.some((item: any) => {
                                    const itemYear = parseInt(item.date.split(',')[1].trim());
                                    return itemYear === selectedYear;
                                  });
                                  return yearExists;
                                })(),
                                sx: { 
                                  bgcolor: '#fff', 
                                  borderRadius: 1, 
                                  fontSize: 16, 
                                  '& .MuiInputBase-root': { borderRadius: 1, fontSize: 16, bgcolor: '#fff' }, 
                                  '& .MuiOutlinedInput-root': { bgcolor: '#fff' },
                                  '& .MuiOutlinedInput-root.Mui-disabled': { bgcolor: '#fff' }
                                },
                              },
                            }}
                          />
                        </LocalizationProvider>
                        {(() => {
                          if (!editTaxDate) return null;
                          const selectedYear = new Date(editTaxDate).getFullYear();
                          
                          // If editing an existing entry, check against other entries
                          let yearExists = false;
                          if (selectedPropertyTaxYear) {
                            yearExists = localTaxHistory.some((item: any) => {
                              const isSameEntry = item.date === selectedPropertyTaxYear.date && item.amount === selectedPropertyTaxYear.amount;
                              if (isSameEntry) return false; // Exclude current entry
                              const itemYear = parseInt(item.date.split(',')[1].trim());
                              return itemYear === selectedYear;
                            });
                          } else {
                            // If adding new entry, check against all entries
                            yearExists = localTaxHistory.some((item: any) => {
                              const itemYear = parseInt(item.date.split(',')[1].trim());
                              return itemYear === selectedYear;
                            });
                          }
                          
                          return yearExists ? (
                            <Typography sx={{ color: '#d32f2f', fontSize: '0.75rem', mt: 0.5, fontFamily: 'Nunito, Arial, sans-serif' }}>
                              This Tax Year has already been recorded
                            </Typography>
                          ) : null;
                        })()}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <TextField
                          label="Property Tax Amount"
                          fullWidth
                          value={editingTaxAmount}
                          onChange={(e) => {
                            let input = e.target.value;
                            input = input.replace(/[^0-9.]/g, '');
                            const parts = input.split('.');
                            if (parts.length > 2) return;
                            if (parts[1] && parts[1].length > 2) return;
                            setEditingTaxAmount(input);
                          }}
                          onBlur={() => {
                            if (editingTaxAmount === '' || editingTaxAmount === null) return;
                            const num = parseFloat(editingTaxAmount);
                            if (isNaN(num)) return;
                            setEditingTaxAmount(num.toFixed(2));
                          }}
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                          }}
                          sx={{
                            mb: 1,
                            flex: 1,
                            transition: 'none',
                            '& *': { transition: 'none !important' },
                          }}
                          inputProps={{ inputMode: 'decimal', maxLength: 12 }}
                        />
                      </Box>
                    </Box>
                    {!selectedPropertyTaxYear ? (
                      <Button 
                        variant="outlined"
                        disabled={
                          !editTaxDate ||
                          !editingTaxAmount ||
                          (() => {
                            if (!editTaxDate) return false;
                            const selectedYear = new Date(editTaxDate).getFullYear();
                            const yearExists = localTaxHistory.some((item: any) => {
                              const itemYear = parseInt(item.date.split(',')[1].trim());
                              return itemYear === selectedYear;
                            });
                            return yearExists;
                          })()
                        }
                        title={(() => {
                          if (!editTaxDate) return '';
                          const selectedYear = new Date(editTaxDate).getFullYear();
                          const yearExists = localTaxHistory.some((item: any) => {
                            const itemYear = parseInt(item.date.split(',')[1].trim());
                            return itemYear === selectedYear;
                          });
                          return yearExists ? `Tax entry for year ${selectedYear} already exists` : '';
                        })()}
                        sx={{ 
                          fontFamily: 'Nunito, Arial, sans-serif', 
                          color: '#333', 
                          borderColor: '#D9D9D9', 
                          bgcolor: '#fff', 
                          px: 3, 
                          py: 1, 
                          fontSize: 14, 
                          textTransform: 'none', 
                          fontWeight: 400, 
                          borderRadius: 1, 
                          mb: 2, 
                          height: 40, 
                          '&:hover': { bgcolor: '#f5f5f5', borderColor: '#B0B0B0' },
                          '&.Mui-disabled': { color: '#999', borderColor: '#E0E0E0', bgcolor: '#f5f5f5' }
                        }} 
                        onClick={async () => {
                          // Add new property tax to local list and save to Firebase
                          if (!editTaxDate || !editingTaxAmount || !currentPropertyId) return;
                          try {
                              setSavingTaxHistory(true);
                              const newEntry = {
                                date: formatLongDate(editTaxDate),
                                amount: editingTaxAmount
                              };
                            const updatedTaxHistory = [newEntry, ...localTaxHistory];
                            
                            const docRef = doc(db, "properties", currentPropertyId);
                            await updateDoc(docRef, { 
                              propertyTaxHistory: updatedTaxHistory,
                              updatedAt: new Date().toISOString()
                            });
                            
                            setLocalTaxHistory(updatedTaxHistory);
                            setProperty(prev => prev ? { ...prev, propertyTaxHistory: updatedTaxHistory } : prev);
                            setEditTaxDate(null);
                            setEditingTaxAmount('');
                          } catch (err) {
                            console.error('Failed to add property tax:', err);
                          } finally {
                            setSavingTaxHistory(false);
                          }
                        }}
                      >
                        Add Property Tax
                      </Button>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                        <Button 
                          variant="contained" 
                          disabled={
                            !editTaxDate ||
                            !editingTaxAmount ||
                            savingTaxHistory ||
                            (formatLongDate(editTaxDate) === selectedPropertyTaxYear?.date && parseFloat(editingTaxAmount).toFixed(2) === parseFloat(selectedPropertyTaxYear?.amount || '0').toFixed(2)) ||
                            (() => {
                              if (!editTaxDate) return false;
                              const selectedYear = new Date(editTaxDate).getFullYear();
                              // Exclude current entry from duplicate check
                              const yearExists = localTaxHistory.some((item: any) => {
                                const isSameEntry = item.date === selectedPropertyTaxYear?.date && item.amount === selectedPropertyTaxYear?.amount;
                                if (isSameEntry) return false;
                                const itemYear = parseInt(item.date.split(',')[1].trim());
                                return itemYear === selectedYear;
                              });
                              return yearExists;
                            })()
                          }
                          sx={{ 
                            textTransform: 'none', 
                            fontFamily: 'Nunito, Arial, sans-serif', 
                            bgcolor: '#89AE99', 
                            color: '#fff', 
                            borderRadius: 1, 
                            fontWeight: 400, 
                            px: 3, 
                            py: 1, 
                            fontSize: 14, 
                            boxShadow: 'none',
                            height: 40,
                          }}
                          onClick={async () => {
                            // Update selected tax item and save to Firebase
                            if (!selectedPropertyTaxYear || !editTaxDate || !editingTaxAmount || !currentPropertyId) return;
                            try {
                              setSavingTaxHistory(true);
                              const newDate = formatLongDate(editTaxDate);
                              const newAmount = editingTaxAmount;
                              
                              const updatedTaxHistory = localTaxHistory.map((item: any) => {
                                if (item.date === selectedPropertyTaxYear.date && item.amount === selectedPropertyTaxYear.amount) {
                                  return {
                                    date: newDate,
                                    amount: newAmount
                                  };
                                }
                                return item;
                              });
                              
                              const docRef = doc(db, "properties", currentPropertyId);
                              await updateDoc(docRef, { 
                                propertyTaxHistory: updatedTaxHistory,
                                updatedAt: new Date().toISOString()
                              });
                              
                              setLocalTaxHistory(updatedTaxHistory);
                              setProperty(prev => prev ? { ...prev, propertyTaxHistory: updatedTaxHistory } : prev);
                              setSelectedPropertyTaxYear(null);
                              setEditTaxDate(null);
                              setEditingTaxAmount('');
                            } catch (err) {
                              console.error('Failed to update property tax:', err);
                            } finally {
                              setSavingTaxHistory(false);
                            }
                          }}
                        >Update</Button>
                        <Button 
                          variant="outlined" 
                          disabled={!selectedPropertyTaxYear || savingTaxHistory}
                          sx={{
                            bgcolor: '#fff', // grey by default
                            color: '#555',
                            borderRadius: 1,
                            fontWeight: 400, 
                            px: 3, 
                            py: 1, 
                            fontSize: 14, 
                            boxShadow: 'none',
                            border: '1.5px solid #888',
                            height: 40,
                            textTransform: 'none',
                            '&:hover': {
                              bgcolor: '#E57373', // red on hover,
                              color: '#fff',
                              borderColor: '#d32f2f',
                            },
                          }}
                          onClick={async () => {
                            // Delete selected tax item and save to Firebase
                            if (!selectedPropertyTaxYear || !currentPropertyId) return;
                            try {
                              setSavingTaxHistory(true);
                              
                              const updatedTaxHistory = localTaxHistory.filter((item: any) => 
                                !(item.date === selectedPropertyTaxYear.date && item.amount === selectedPropertyTaxYear.amount)
                              );
                              
                              const docRef = doc(db, "properties", currentPropertyId);
                              await updateDoc(docRef, { 
                                propertyTaxHistory: updatedTaxHistory,
                                updatedAt: new Date().toISOString()
                              });
                              
                              setLocalTaxHistory(updatedTaxHistory);
                              setProperty(prev => prev ? { ...prev, propertyTaxHistory: updatedTaxHistory } : prev);
                              setSelectedPropertyTaxYear(null);
                              setEditTaxDate(null);
                              setEditingTaxAmount('');
                            } catch (err) {
                              console.error('Failed to delete property tax:', err);
                            } finally {
                              setSavingTaxHistory(false);
                            }
                          }}
                        >Delete</Button>
                      </Box>
                    )}
                    {/* Tax History List */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, px: 2 }}>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 14, color: '#343748' }}>Date</Typography>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 14, color: '#343748' }}>Amount</Typography>
                    </Box>
                    <Box sx={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                      {/* Tax history items from local state, show all entries in modal */}
                      {[...localTaxHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item: any, idx: number) => (
                        <Box
                          key={idx}
                          onClick={() => {
                            if (selectedPropertyTaxYear?.date === item.date && selectedPropertyTaxYear?.amount === item.amount) {
                              // Deselect if already selected
                              setSelectedPropertyTaxYear(null);
                              setEditTaxDate(null);
                              setEditingTaxAmount('');
                            } else {
                              // Select the item and prefill form with parsed date
                              setSelectedPropertyTaxYear(item);
                              const parsed = parseLongDate(item.date);
                              if (parsed) setEditTaxDate(parsed);
                              const formattedAmount = parseFloat(item.amount).toFixed(2);
                              setEditingTaxAmount(formattedAmount);
                            }
                          }}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            px: 2,
                            py: 1.5,
                            bgcolor: selectedPropertyTaxYear?.date === item.date && selectedPropertyTaxYear?.amount === item.amount ? '#89AE99' : '#f9f9f9',
                            borderRadius: 1,
                            fontFamily: 'Nunito, Arial, sans-serif',
                            fontSize: 14,
                            color: selectedPropertyTaxYear?.date === item.date && selectedPropertyTaxYear?.amount === item.amount ? '#fff' : '#343748',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                              bgcolor: selectedPropertyTaxYear?.date === item.date && selectedPropertyTaxYear?.amount === item.amount ? '#89AE99' : '#f0f0f0'
                            }
                          }}
                        >
                          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14, color: 'inherit' }}>{item.date}</Typography>
                          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14, fontWeight: 500, color: 'inherit' }}>${formatCurrencyAmount(item.amount)}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </DialogContent>
              </Dialog>
              {/* Left side: Title, amount, date */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 'fit-content', justifyContent: 'flex-start', pt: 0 }}>
                <Typography variant="h5" fontWeight={550} sx={{ color: '#343748', fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 18, sm: 26, md: 28 }, mt: 0 }}>Property Taxes</Typography>
                <Box>
                  {(() => {
                      // Show only the latest 5 tax entries (by date desc)
                      const sorted = property?.propertyTaxHistory && property.propertyTaxHistory.length > 0
                        ? [...property.propertyTaxHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        : [];
                      const latestFive = sorted.slice(0, 5);
                      const latestTax = latestFive[0] || null;
                      return (
                        <>
                          <Typography sx={{ fontSize: '2.2rem', fontWeight: 550, color: '#89AE99', fontFamily: 'Nunito, Arial, sans-serif' }}>
                            ${formatNumber(latestTax?.amount?.split('.')[0] || '0')}.{latestTax?.amount?.includes('.') ? latestTax.amount.split('.')[1] : '00'}
                          </Typography>
                          <Typography sx={{ fontSize: '0.85rem', color: '#6B7280', fontFamily: 'Nunito, Arial, sans-serif' }}>
                            {latestTax?.date || 'No tax data'}
                          </Typography>
                        </>
                    );
                  })()}
                </Box>
              </Box>
              {/* Right side: Chart section with Y-axis scale and bars - Only show if 2+ tax entries */}
              {((property as any)?.propertyTaxHistory || []).length >= 2 && (
              <Box sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 1, mr: 8, position: 'relative', zIndex: 10 }}>
                {/* Y-axis labels - dynamically generated based on maxScale */}
                <Box sx={{ display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between', height: '100%', pr: 1, minWidth: 28, position: 'relative', zIndex: 2 }}>
                  {(() => {
                    // Only show the latest 5 tax entries in the chart (by date, not by year)
                    interface PropertyTaxHistoryItem {
                      date: string;
                      amount: string | number;
                    }
                    const taxHistory: PropertyTaxHistoryItem[] = ((property as { propertyTaxHistory?: PropertyTaxHistoryItem[] })?.propertyTaxHistory || [])
                      .slice()
                      .sort((a: PropertyTaxHistoryItem, b: PropertyTaxHistoryItem) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 5);
                    if (taxHistory.length === 0) return null;
                    // Find max amount to scale the chart
                    let maxAmount = 0;
                    taxHistory.forEach(item => {
                      const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
                      if (!isNaN(amount) && amount > maxAmount) maxAmount = amount;
                    });
                    // Set max scale based on nice intervals
                    function getNiceInterval(maxValue: number, ticks = 3) {
                      if (maxValue <= 0) return 1;
                      const raw = maxValue / ticks;
                      const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
                      const normalized = raw / magnitude;
                      const niceSteps = [1, 2, 2.5, 5, 10];
                      const nice = niceSteps.find(v => normalized <= v) ?? 10;
                      return nice * magnitude;
                    }
                    const selectedInterval = getNiceInterval(maxAmount);
                    const labels = [0, selectedInterval, selectedInterval * 2, selectedInterval * 3];
                    return labels.map((label, idx) => {
                      if (label === 0) {
                        return (
                          <Typography key={idx} sx={{ fontSize: '0.65rem', color: 'transparent', fontFamily: 'Nunito, Arial, sans-serif' }}>
                            0
                          </Typography>
                        );
                      }
                      const formattedLabel = `${(label / 1000).toFixed(1)}k`;
                      return (
                        <Typography key={idx} sx={{ fontSize: '0.65rem', color: '#999', fontFamily: 'Nunito, Arial, sans-serif' }}>
                          {formattedLabel}
                        </Typography>
                      );
                    });
                  })()}
                </Box>
                {/* Bars container */}
                <Box sx={{ width: '75%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 0.1, pr: 6, position: 'relative', zIndex: 1 }}>
                  {(() => {
                    // Only show the latest 5 tax entries in the chart (by date, not by year)
                    interface PropertyTaxHistoryItem {
                      date: string;
                      amount: string | number;
                    }
                    const taxHistory: PropertyTaxHistoryItem[] = ((property as { propertyTaxHistory?: PropertyTaxHistoryItem[] })?.propertyTaxHistory || [])
                      .slice()
                      .sort((a: PropertyTaxHistoryItem, b: PropertyTaxHistoryItem) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 5)
                      .reverse(); // Oldest of the 5 on the left, newest on the right
                    if (taxHistory.length === 0) return null;
                    // Find max amount to scale the chart
                    let maxAmount = 0;
                    taxHistory.forEach(item => {
                      const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
                      if (!isNaN(amount) && amount > maxAmount) maxAmount = amount;
                    });
                    function getNiceInterval(maxValue: number, ticks = 3) {
                      if (maxValue <= 0) return 1;
                      const raw = maxValue / ticks;
                      const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
                      const normalized = raw / magnitude;
                      const niceSteps = [1, 2, 2.5, 5, 10];
                      const nice = niceSteps.find(v => normalized <= v) ?? 10;
                      return nice * magnitude;
                    }
                    const maxScale = getNiceInterval(maxAmount) * 3;
                    const currentYear = new Date().getFullYear();
                    return taxHistory.map((item, idx) => {
                      const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
                      const parsedDate = parseDateFns(item.date, 'MMM dd, yyyy', new Date());
                      const year = isValidDateFns(parsedDate) ? parsedDate.getFullYear() : '';
                      const height = Math.max(0, (amount / maxScale) * 150);
                      const isCurrentYear = year === currentYear;
                      return (
                        <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 0.1 }}>
                          {/* Background container - full height with data bar inside */}
                          <Box sx={{ width: '60%', height: '150px', backgroundColor: '#E8E8E8', borderRadius: '8px', minWidth: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative' }}>
                            {/* Actual data bar */}
                            <Box
                              sx={{
                                width: '100%',
                                height: `${height}px`,
                                backgroundColor: isCurrentYear ? '#374151' : '#89AE99',
                                borderRadius: '8px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              }}
                            />
                          </Box>
                          <Typography sx={{ fontSize: '0.65rem', color: '#888', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, mt: 0.3 }}>{year}</Typography>
                        </Box>
                      );
                    });
                  })()}
                </Box>
              </Box>
              )}
            </Paper>
            {/* Insurance Section - show for rental properties, otherwise show upcoming tasks */}
            {property?.isRental ? (
              <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, flex: 1, minHeight: 180, display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.13)', gap: 1, height: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h5" fontWeight={550} sx={{ textAlign: 'center', color: '#343748', fontFamily: 'Nunito, Arial, sans-serif', fontSize: { xs: 18, sm: 22, md: 26 } }}>Rental Insurance</Typography>
                  <Button variant="outlined" sx={{ bgcolor: '#fff', color: '#343748', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', textTransform: 'none', borderColor: '#e0e0e0', px: 2, py: 0.5, fontSize: 14, borderRadius: 2, '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' } }} onClick={handleRentalEnsuranceModal}>Edit</Button>
                {/* Edit Rental Insurance Modal */}
                <Dialog open={editRentalInsuranceOpen} onClose={() => setEditRentalInsuranceOpen(false)} maxWidth="xs" fullWidth>
                  <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ p: 4, borderRadius: 2, bgcolor: '#fff', minWidth: 340 }}>
                      <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 3, p: 0 }}>Edit Rental Insurance Information</DialogTitle>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 1 }}>
                        <TextField
                          label="Renters Name"
                          value={editForm?.rentalInsurance?.assetsCovered || ''}
                          fullWidth
                          onChange={e => {
                            const value = e.target.value.slice(0, 30);
                            setEditForm(prev => prev ? {
                              ...prev,
                              rentalInsurance: {
                                insuranceCompany: prev.rentalInsurance?.insuranceCompany || '',
                                assetsCovered: value,
                                policyNumber: prev.rentalInsurance?.policyNumber || ''
                              }
                            } : prev);
                          }}
                          sx={{ bgcolor: '#fff', borderRadius: 1, fontSize: 16, '& .MuiInputBase-root': { borderRadius: 1, fontSize: 16 } }}
                          InputLabelProps={{ sx: { fontSize: 16 } }}
                          inputProps={{ maxLength: 30 }}
                        />
                        <TextField
                          label="Insurance company name"
                          value={editForm?.rentalInsurance?.insuranceCompany || ''}
                          onChange={e => {
                            const value = e.target.value.slice(0, 30);
                            setEditForm(prev => prev ? {
                              ...prev,
                              rentalInsurance: {
                                insuranceCompany: value,
                                assetsCovered: prev.rentalInsurance?.assetsCovered || '',
                                policyNumber: prev.rentalInsurance?.policyNumber || ''
                              }
                            } : prev);
                          }}
                          fullWidth
                          sx={{ bgcolor: '#fff', borderRadius: 1, fontSize: 16, '& .MuiInputBase-root': { borderRadius: 1, fontSize: 16 } }}
                          InputLabelProps={{ sx: { fontSize: 16 } }}
                          inputProps={{ maxLength: 30 }}
                        />
                        <TextField
                          label="Policy number (optional)"
                          value={editForm?.rentalInsurance?.policyNumber || ''}
                          onChange={e => {
                            // Allow any character, up to 30 chars
                            const value = e.target.value.slice(0, 30);
                            setEditForm(prev => prev ? {
                              ...prev,
                              rentalInsurance: {
                                insuranceCompany: prev.rentalInsurance?.insuranceCompany || '',
                                assetsCovered: prev.rentalInsurance?.assetsCovered || '',
                                policyNumber: value
                              }
                            } : prev);
                          }}
                          fullWidth
                          sx={{ bgcolor: '#fff', borderRadius: 1, fontSize: 16, '& .MuiInputBase-root': { borderRadius: 1, fontSize: 16 } }}
                          InputLabelProps={{ sx: { fontSize: 16 } }}
                          inputProps={{ maxLength: 30 }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'right', gap: 3, mt: 2 }}>
                        <Button variant="outlined" sx={{ fontFamily: 'Nunito, Arial, sans-serif', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' }, borderRadius: 2, color: '#333', borderColor: '#D9D9D9', px: 3, py: 1, background: '#fff', fontSize: 14, textTransform: 'none', fontWeight: 400 }} onClick={() => setEditRentalInsuranceOpen(false)}>Cancel</Button>
                        <Button variant="contained" sx={{ textTransform: 'none', bgcolor: '#89AE99', color: '#fff', fontFamily: 'Nunito, Arial, sans-serif', borderRadius: 2, fontWeight: 400, px: 3, py: 1, fontSize: 14, boxShadow: 'none', minWidth: 110 }}
                          onClick={async () => {
                            if (!property || !currentPropertyId) return;
                            const docRef = doc(db, "properties", currentPropertyId);
                            const newRentalInsurance = {
                              insuranceCompany: editForm?.rentalInsurance?.insuranceCompany || '',
                              assetsCovered: editForm?.rentalInsurance?.assetsCovered || '',
                              policyNumber: editForm?.rentalInsurance?.policyNumber || ''
                            };
                            await updateDoc(docRef, { rentalInsurance: newRentalInsurance });
                            setProperty({ ...property, rentalInsurance: newRentalInsurance });
                            setEditRentalInsuranceOpen(false);
                          }}
                        >Update</Button>
                      </Box>
                    </Box>
                  </DialogContent>
                </Dialog>
              </Box>
                <Typography fontFamily="Nunito, Arial, sans-serif" color='#374748' fontWeight={550}>Renters Name: <span style={{ color: '#374748', fontWeight: 200 }}>{property?.rentalInsurance?.assetsCovered || ''}</span></Typography>
                <Typography fontFamily="Nunito, Arial, sans-serif" color='#374748' fontWeight={550}>Insurance Company: <span style={{ color: '#374748', fontWeight: 200 }}>{property?.rentalInsurance?.insuranceCompany || ''}</span></Typography>
                <Typography fontFamily="Nunito, Arial, sans-serif" color='#374748' fontWeight={550}>Policy number: <span style={{ color: '#374748', fontWeight: 200 }}>{property?.rentalInsurance?.policyNumber || ''}</span></Typography>
              </Paper>
            ) : (
              /* Upcoming Tasks Section - show for non-rental properties */
              <UpcomingTasksTable 
                tasks={upcomingTasks} 
                showAssignedTo={false}
                paperSx={{ flex: 1, minHeight: 180, display: 'flex', flexDirection: 'column', gap: 1, height: 'auto' }}
              />
            )}
          </Box>
        </Box>

        {/* Upcoming Tasks Section for Rental Properties - at end of page */}
        {property?.isRental && (
          <UpcomingTasksTable 
            tasks={upcomingTasks} 
            showAssignedTo={true}
            paperSx={{ mb: 1.5 }}
          />
        )}

      </Box>
      {/* Add Utility Modal */}
      <Dialog open={addUtilityOpen} onClose={() => setAddUtilityOpen(false)} PaperProps={{ sx: { borderRadius: 2, minWidth: { xs: 0, sm: 400 } } }}>
        <DialogTitle sx={{ textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, py: 4, mb: -2, fontSize: 20 }}>Add Utility</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Autocomplete
              freeSolo
              options={utilityTypes}
              value={utilityType}
              onInputChange={(_, value) => {
                if ((value || '').length <= 25) setUtilityType(value);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Type of Utility" fullWidth size="medium" sx={{ background: '#fff' }} inputProps={{ ...params.inputProps, maxLength: 25 }} />
              )}
            />
            <TextField
              label="Company name"
              value={utilityCompany}
              onChange={e => {
                const value = e.target.value;
                if (value.length <= 25) setUtilityCompany(value);
              }}
              fullWidth
              size="medium"
              sx={{ background: '#fff' }}
              inputProps={{ maxLength: 25 }}
            />
            <TextField
              label="Account number"
              value={utilityAccount}
              onChange={e => {
                // Only allow numbers
                const value = e.target.value.replace(/[^0-9]/g, '');
                if (value.length <= 25) setUtilityAccount(value);
              }}
              fullWidth
              size="medium"
              sx={{ background: '#fff' }}
              inputProps={{ maxLength: 25, inputMode: 'numeric', pattern: '[0-9]*' }}
            />
            <TextField
              label="Link URL (optional)"
              value={utilityUrl}
              onChange={e => {
                const value = e.target.value;
                setUtilityUrl(value);
              }}
              fullWidth
              size="medium"
              sx={{ background: '#fff' }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'right', gap: 2, mt: 1 }}>
              <Button
                variant="outlined"
                onClick={() => setAddUtilityOpen(false)}
                sx={{ fontFamily: 'Nunito, Arial, sans-serif', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' }, borderRadius: 2, minWidth: 110, color: '#333', borderColor: '#D9D9D9', background: '#fff', textTransform: 'none', fontWeight: 400 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={async () => {
                  if (!property || !currentPropertyId || !utilityType) {
                    setAddUtilityOpen(false);
                    return;
                  }
                  const newUtility: UtilityItem = {
                    type: utilityType,
                    company: utilityCompany || '',
                    number: utilityAccount || '',
                    link: utilityUrl || '',
                  };
                  const updatedUtilities = [...(property.utilities || []), newUtility];
                  const docRef = doc(db, "properties", currentPropertyId);
                  await updateDoc(docRef, { utilities: updatedUtilities });
                  setProperty(prev => prev ? { ...prev, utilities: updatedUtilities } : prev);
                  setUtilityType('');
                  setUtilityCompany('');
                  setUtilityAccount('');
                  setUtilityUrl('');
                  setAddUtilityOpen(false);
                }}
                disabled={!utilityType && !utilityCompany && !utilityAccount && !utilityUrl}
                sx={{ textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif', borderRadius: 2, minWidth: 110, bgcolor: '#89AE99', fontWeight: 400, boxShadow: 'none' }}
              >
                Add Utility
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
      {/* Edit Utility Modal */}
      <Dialog open={editUtilityOpen} onClose={() => setEditUtilityOpen(false)} PaperProps={{ sx: {  borderRadius: 2, minWidth: { xs: 0, sm: 400 } } }}>
        <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 20, mt: 1, pb: 1, mb: 2 }}>Edit Utility</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Autocomplete
              freeSolo
              options={utilityTypes}
              value={editUtilityType}
              onInputChange={(_, value) => {
                if ((value || '').length <= 25) setEditUtilityType(value);
                setUtilityState(true);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Type of Utility" fullWidth size="medium" sx={{ background: '#fff' }} inputProps={{ ...params.inputProps, maxLength: 25 }} />
              )}
            />
            <TextField
              label="Company name"
              value={editUtilityCompany}
              onChange={e => {
                const value = e.target.value;
                if (value.length <= 25) setEditUtilityCompany(value);
                setUtilityState(true);
              }}
              fullWidth
              size="medium"
              sx={{ background: '#fff' }}
              inputProps={{ maxLength: 25 }}
            />
            <TextField
              label="Account number"
              value={editUtilityAccount}
              onChange={e => {
                // Only allow numbers
                const value = e.target.value.replace(/[^0-9]/g, '');
                if (value.length <= 25) setEditUtilityAccount(value);
                setUtilityState(true);
              }}
              fullWidth
              size="medium"
              sx={{ background: '#fff' }}
              inputProps={{ maxLength: 25, inputMode: 'numeric', pattern: '[0-9]*' }}
            />
            <TextField
              label="Link URL (optional)"
              value={editUtilityUrl}
              onChange={e => {
                const value = e.target.value;
                setEditUtilityUrl(value);
                setUtilityState(true);
              }}
              fullWidth
              size="medium"
              sx={{ background: '#fff' }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 1 }}>
              <Button
                variant="outlined"
                color="error"
                onClick={() => {
                  if (editUtilityIndex !== null) {
                    setDeleteUtilityIdx(editUtilityIndex);
                  }
                }}
                sx={{
                  bgcolor: '#fff',
                  color: '#555',
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  minWidth: 100,
                  fontSize: 15,
                  border: '1.5px solid #888',
                  fontFamily: 'Nunito, Arial, sans-serif',
                  boxShadow: 'none',
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: '#E57373',
                    color: '#fff',
                    borderColor: '#d32f2f',
                  },
                }}>
                Delete
              </Button>
              <Button
                variant="contained"
                onClick={async () => {
                  if (
                    editUtilityIndex === null ||
                    !property ||
                    !currentPropertyId ||
                    !editUtilityType
                  ) {
                    setEditUtilityOpen(false);
                    return;
                  }
                  const updatedUtility: UtilityItem = {
                    type: editUtilityType,
                    company: editUtilityCompany,
                    number: editUtilityAccount,
                    link: editUtilityUrl,
                  };
                  const updatedUtilities = [...(property.utilities || [])];
                  updatedUtilities[editUtilityIndex] = updatedUtility;
                  const docRef = doc(db, "properties", currentPropertyId);
                  await updateDoc(docRef, { utilities: updatedUtilities });
                  setProperty(prev => prev ? { ...prev, utilities: updatedUtilities } : prev);
                  setEditUtilityOpen(false);
                  setEditUtilityIndex(null);
                  setEditUtilityType('');
                  setEditUtilityCompany('');
                  setEditUtilityAccount('');
                  setEditUtilityUrl('');
                }}
                disabled={!utilityState}
                sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15, borderRadius: 2, minWidth: 110, background: '#89AE99', textTransform: 'none', fontWeight: 400, boxShadow: 'none' }}
              >
                Update
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
      <Box sx={{ height: 32 }} />
    </Box>
    </>
  );
}

export default Property;
