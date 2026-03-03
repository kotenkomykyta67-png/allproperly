import { IconButton } from '@mui/material';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, TextField, MenuItem, Divider, Avatar, Checkbox, FormControlLabel, Modal, Skeleton, ClickAwayListener, CircularProgress } from '@mui/material';
// Add import for Snackbar if not present
import Autocomplete from '@mui/material/Autocomplete';
import PhotoPicker from '../components/PhotoPicker';
import CloseIcon from '@mui/icons-material/Close';
// Helper: Parse YYYY-MM-DD as local date (no timezone shift)
function parseLocalDate(dateString: string) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}
import EditIcon from '@mui/icons-material/Edit';
// Utility: Use a darker shade of the card color for checked background and border
function darkenColor(hex: string, amount = 0.18) {
  hex = hex.replace('#', '');
  let r = parseInt(hex.substring(0,2),16);
  let g = parseInt(hex.substring(2,4),16);
  let b = parseInt(hex.substring(4,6),16);
  r = Math.max(0, Math.floor(r * (1 - amount)));
  g = Math.max(0, Math.floor(g * (1 - amount)));
  b = Math.max(0, Math.floor(b * (1 - amount)));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
// Animated Checkbox using framer-motion
import { motion, AnimatePresence } from 'framer-motion';
// Animated Checkbox with OUTER SVG border draw effect
// Only animate border when explicitly told
function CustomCheckbox({ checked, onChange, disabled = false, animateBorder = false }: { checked: boolean, onChange?: () => void, color: string, disabled?: boolean, animateBorder?: boolean }) {
  // Animate border only when animateBorder is true
  const [borderAnim, setBorderAnim] = React.useState(false);
  React.useEffect(() => {
    if (animateBorder) {
      setBorderAnim(true);
      const timeout = setTimeout(() => setBorderAnim(false), 1000);
      return () => clearTimeout(timeout);
    } else {
      setBorderAnim(false);
    }
  }, [animateBorder]);

  // Checkbox and outer border sizes
  const boxSize = 32;
  const borderRadius = 6;
  const strokeWidth = 2.5;
  // Outer border: 6px outside the checkbox (3px all around)
  const outerBoxSize = boxSize + 4; // 36
  const outerRadius = borderRadius + 3; // 9
  // Position SVG absolutely, centered over checkbox
  // Animate border draw with correct dasharray
  const borderLength = 4 * (outerBoxSize - outerRadius * 2) + 2 * Math.PI * outerRadius;

  return (
    <Box
      onClick={e => {
        if (!disabled) {
          e.stopPropagation();
          onChange && onChange();
        }
      }}
      sx={{
        width: boxSize,
        height: boxSize,
        borderRadius: 2,
        border: '2.5px solid #333', // original border
        bgcolor: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mr: 2,
        cursor: disabled ? 'default' : 'pointer',
        boxSizing: 'border-box',
        position: 'relative',
        boxShadow: 'none',
        overflow: 'visible',
        zIndex: 10,
      }}
    >
      {/* OUTER SVG border animation - perfectly outside the checkbox */}
      {animateBorder && (
        <svg
          width={outerBoxSize}
          height={outerBoxSize}
          style={{
            position: 'absolute',
            top: -(outerBoxSize - boxSize) / 2 - 2,
            left: -(outerBoxSize - boxSize) / 2 - 2,
            zIndex: 100,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          {/* Counter-clockwise path for rounded rectangle */}
          <path
            d={`M${strokeWidth / 2 + outerRadius},${strokeWidth / 2}
                H${outerBoxSize - strokeWidth / 2 - outerRadius}
                A${outerRadius},${outerRadius} 0 0 1 ${outerBoxSize - strokeWidth / 2},${strokeWidth / 2 + outerRadius}
                V${outerBoxSize - strokeWidth / 2 - outerRadius}
                A${outerRadius},${outerRadius} 0 0 1 ${outerBoxSize - strokeWidth / 2 - outerRadius},${outerBoxSize - strokeWidth / 2}
                H${strokeWidth / 2 + outerRadius}
                A${outerRadius},${outerRadius} 0 0 1 ${strokeWidth / 2},${outerBoxSize - strokeWidth / 2 - outerRadius}
                V${strokeWidth / 2 + outerRadius}
                A${outerRadius},${outerRadius} 0 0 1 ${strokeWidth / 2 + outerRadius},${strokeWidth / 2}
                Z`}
            fill="none"
            stroke="#89AE99"
            strokeWidth={strokeWidth}
            strokeDasharray={borderLength}
            strokeDashoffset={checked ? 0 : borderLength}
            style={{
              opacity: checked ? 1 : 0,
              filter: 'drop-shadow(0 0 1.5px #89AE99)',
              transition: borderAnim ? undefined : 'opacity 0s',
              animation: borderAnim ? 'checkboxBorderDrawCCW 1s linear forwards' : 'none',
            }}
          />
          {borderAnim && (
            <style>{`
              @keyframes checkboxBorderDrawCCW {
                0% { stroke-dashoffset: ${borderLength}; }
                100% { stroke-dashoffset: 0; }
              }
            `}</style>
          )}
        </svg>
      )}
      <AnimatePresence>
        {checked && (
          <motion.svg
            key="checkmark"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            style={{ display: 'block', zIndex: 2 }}
          >
            <motion.polyline
              points="5,11 9,15 15,6"
              fill="none"
              stroke="#89AE99"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              exit={{ pathLength: 0 }}
              transition={{ duration: animateBorder ? 1 : 1, ease: 'easeInOut' }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </Box>
  );
}
import { updateDoc, where, doc, deleteDoc } from "firebase/firestore";
import { sendTaskCompletedNotification } from '../utils/notificationUtil';
import { uploadTaskImage, uploadOriginalTaskImage } from "../services/uploadTaskImage";
import React, { useEffect, useState, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { collection, getDocs, query, addDoc, serverTimestamp, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
// import { Box, Divider, Typography, Button, Avatar, TextField, MenuItem, Dialog, DialogTitle, DialogContent, Tabs, Tab, Skeleton, Checkbox, FormControlLabel, IconButton, Modal } from "@mui/material";
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

interface TasksProps {
  sidebar: boolean;
}

const Tasks: React.FC<TasksProps> = ({ sidebar }) => {
  // Map of userId to photoURL (using userId as key to avoid displayName collisions)
  const [userPhotoMap, setUserPhotoMap] = useState<{ [userId: string]: string }>({});
  // Map of displayName to userId (for looking up userId when assigning by displayName)
  const [displayNameToUserIdMap, setDisplayNameToUserIdMap] = useState<{ [displayName: string]: string }>({});
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string>('');

  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [photoPickerImage, setPhotoPickerImage] = useState<string | null>(null);
  // Store the original image file for re-cropping
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
  // FIXES: Track image upload state and errors (ISSUE #4, #6, #10)
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  // Track blob URLs for cleanup (ISSUE #5, #7)
  // Track active uploads by taskId to prevent race conditions
  const activeUploadsRef = React.useRef<Set<string>>(new Set());
  const blobUrlsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    // Fetch all users from Firebase and build maps using userId as key
    async function fetchUserPhotos() {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const photoMap: { [userId: string]: string } = {};
        const displayNameToIdMap: { [displayName: string]: string } = {};
        usersSnapshot.forEach(docSnap => {
          const data = docSnap.data();
          const userId = docSnap.id;
          if (data.photoURL) {
            photoMap[userId] = data.photoURL;
          }
          if (data.displayName) {
            displayNameToIdMap[data.displayName] = userId;
          }
        });
        setUserPhotoMap(photoMap);
        setDisplayNameToUserIdMap(displayNameToIdMap);
      } catch (err) {
        // Ignore errors, fallback to default avatar
      }
    }
    fetchUserPhotos();
  }, []);
  
  // Ref and handler for image upload (must be inside component, not in JSX)
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Track selected image file for upload
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // Handle image file selection for tasks
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    // Validate task is selected
    if (!selectedTask?.id) {
      setImageUploadError('No task selected');
      return;
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setImageUploadError(`Invalid file type. Please use JPG, PNG, or WebP.`);
      return;
    }
    
    // Store files and read for preview
    setSelectedImageFile(file);
    setOriginalImageFile(file);
    setImageUploadError(null);
    
    const reader = new FileReader();
    
    reader.onerror = () => {
      setImageUploadError('Failed to read image file');
    };
    
    reader.onabort = () => {
      setImageUploadError('Image reading was aborted');
    };
    
    reader.onload = () => {
      const imageData = reader.result as string;
      
      if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
        setImageUploadError('Invalid image data');
        return;
      }
      
      setPhotoPickerImage(imageData);
      setShowPhotoPicker(true);
    };
    
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  
  // Inline editing state for title and description
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);

  // State for toggling Autocomplete open/close on click (task info section)
  const [frequencyOpen, setFrequencyOpen] = useState(false);
  const [assignUserOpen, setAssignUserOpen] = useState(false);
  // Placeholder handlers for skip/delete
  async function handleSkipTask() {
    setRemoveModalOpen(false);
    if (!selectedTask || !selectedTask.id) return;
    // Only process if recurring
    const freq = selectedTask.recurrency?.frequency;
    if (freq && ["Weekly", "Monthly", "Quarterly", "Yearly"].includes(freq)) {
      // Helper to add days/months/years
      function addToDate(dateStr: string | undefined | null, { days = 0, months = 0, years = 0 }: { days?: number; months?: number; years?: number }): string {
        if (!dateStr || typeof dateStr !== 'string') return '';
        // Ensure dateStr is in YYYY-MM-DD format
        const [y, m, d] = dateStr.split('-').map(Number);
        if (!y || !m || !d) return '';
        const date = new Date(y, m - 1, d);
        if (days) date.setDate(date.getDate() + days);
        if (months) date.setMonth(date.getMonth() + months);
        if (years) date.setFullYear(date.getFullYear() + years);
        return date.toISOString().slice(0, 10);
      }
      let nextStart = selectedTask.startDate;
      let nextDue = selectedTask.dueDate;
      if (freq === "Weekly") {
        nextStart = addToDate(selectedTask.startDate, { days: 7 * (Number(selectedTask.recurrency?.interval) || 1) });
        nextDue = addToDate(selectedTask.dueDate, { days: 7 * (Number(selectedTask.recurrency?.interval) || 1) });
      } else if (freq === "Monthly") {
        nextStart = addToDate(selectedTask.startDate, { months: Number(selectedTask.recurrency?.interval) || 1 });
        nextDue = addToDate(selectedTask.dueDate, { months: Number(selectedTask.recurrency?.interval) || 1 });
      } else if (freq === "Quarterly") {
        nextStart = addToDate(selectedTask.startDate, { months: 3 * (Number(selectedTask.recurrency?.interval) || 1) });
        nextDue = addToDate(selectedTask.dueDate, { months: 3 * (Number(selectedTask.recurrency?.interval) || 1) });
      } else if (freq === "Yearly") {
        nextStart = addToDate(selectedTask.startDate, { years: Number(selectedTask.recurrency?.interval) || 1 });
        nextDue = addToDate(selectedTask.dueDate, { years: Number(selectedTask.recurrency?.interval) || 1 });
      }
      // Remove fields that shouldn't be copied
      const { id, status, completedBy, createdAt, updatedAt, ...rest } = selectedTask;
      await addDoc(collection(db, "tasks"), {
        ...rest,
        startDate: nextStart,
        dueDate: nextDue,
        status: 'pending',
        completedBy: '',
        assigned_user: '',
        assigned_user_id: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    // Delete the skipped task
    try {
      await deleteDoc(doc(db, "tasks", selectedTask.id));
      setSelectedTask(null);
    } catch (err) {
      console.error('Failed to skip/delete task.');
    }
  }
  async function handleDeleteTask() {
    setRemoveModalOpen(false);
    if (!selectedTask || !selectedTask.id) return;
    try {
      await deleteDoc(doc(db, "tasks", selectedTask.id));
      // Find the top task in the current tab after deletion
      // Use the same filtering logic as filteredTasks
      const selectedPropertyId = propertyMap[selectedTab];
      let nextTasks = [];
      if (showAllTasks) {
        if (selectedTab === propertyNames[0]) {
          nextTasks = tasks.filter(task => task.id !== selectedTask.id);
        } else {
          nextTasks = tasks.filter(task => task.propertyId === selectedPropertyId && task.id !== selectedTask.id);
        }
      } else {
        if (selectedTab === propertyNames[0]) {
          nextTasks = quarterFilteredTasks.filter(task => task.id !== selectedTask.id);
        } else {
          nextTasks = quarterFilteredTasks.filter(task => task.propertyId === selectedPropertyId && task.id !== selectedTask.id);
        }
      }
      // Sort by due date (same as sortByDueDate)
      nextTasks = nextTasks.slice().sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        const dateDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (dateDiff !== 0) return dateDiff;
        if (a.title && b.title) {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
      setSelectedTask(nextTasks.length > 0 ? nextTasks[0] : null);
    } catch (err) {
      console.error('Failed to delete task.');
    }
  }



  async function handleUpdateSelectedTask() {
    if (!selectedTask || !selectedTask.id) return;
    const taskRef = doc(db, "tasks", selectedTask.id);
    // Update all editable fields, including title and description
    const updateData: any = {
      assigned_user: selectedTask.assigned_user,
      startDate: selectedTask.startDate || '',
      dueDate: selectedTask.dueDate || '',
      title: selectedTask.title || '',
      description: selectedTask.description || '',
      updatedAt: serverTimestamp(),
    };
    if (selectedTask.inventory === 'Smoke Detectors') {
      updateData.inventory_info = { numSmokeAlarms: selectedTask.inventory_info?.numSmokeAlarms ?? null };
    } else if (selectedTask.inventory === 'CO Detectors') {
      updateData.inventory_info = { numCO2Detectors: selectedTask.inventory_info?.numCO2Detectors ?? null };
    } else if (selectedTask.inventory === 'HVAC') {
      updateData.inventory_info = { filterSize: selectedTask.inventory_info?.filterSize ?? null };
    } else {
      updateData.inventory_info = null;
    }

    // recurrency update - always include to ensure frequency changes are saved
    if (selectedTask.recurrency) {
      updateData['recurrency'] = {
        frequency: selectedTask.recurrency.frequency || 'None',
        interval: selectedTask.recurrency.frequency !== 'None' ? (selectedTask.recurrency.interval || '1') : '',
      };
    }
    // Upload both original and cropped images if available
    let originalImageUrl = selectedTask.originalImageUrl;
    let croppedImageUrl = selectedTask.imageUrl;
    try {
      // Upload original and cropped images in parallel
      // Both are converted to WebP for consistency
      let originalUploadPromise: Promise<string | null> = Promise.resolve(null);
      let croppedUploadPromise: Promise<string | null> = Promise.resolve(null);
      if (originalImageFile) {
        originalUploadPromise = uploadOriginalTaskImage(selectedTask.id, originalImageFile);
      }
      if (selectedImageFile) {
        croppedUploadPromise = uploadTaskImage(selectedTask.id, selectedImageFile);
      }
      const [originalUrl, croppedUrl] = await Promise.all([originalUploadPromise, croppedUploadPromise]);
      if (originalUrl) originalImageUrl = originalUrl;
      if (croppedUrl) croppedImageUrl = croppedUrl;
      setSelectedImageFile(null);

      // Build final data to update - always include recurrency and assigned_user for auto-save
      const changedData: Record<string, any> = {};
      for (const key in updateData) {
        const currentValue = updateData[key];
        const originalValue = originalTask?.[key];
        
        // Always save recurrency and assigned_user (auto-save fields)
        if (key === 'recurrency' || key === 'assigned_user') {
          changedData[key] = currentValue;
          // Also update assigned_user_id when assigned_user changes (use updateData.assigned_user_id if available)
          if (key === 'assigned_user') {
            changedData.assigned_user_id = updateData.assigned_user_id || '';
          }
        } else if (key === 'updatedAt') {
          // Always include updatedAt when there are changes
          changedData[key] = currentValue;
        } else if (currentValue !== undefined && currentValue !== originalValue) {
          changedData[key] = currentValue;
        }
      }
      // Only set imageUrl/originalImageUrl if changed and valid
      if (croppedImageUrl !== undefined && croppedImageUrl !== originalTask?.imageUrl) {
        changedData.imageUrl = croppedImageUrl;
      }
      if (originalImageUrl !== undefined && originalImageUrl !== originalTask?.originalImageUrl) {
        changedData.originalImageUrl = originalImageUrl;
      }
      setSelectedTask((prev: any) => prev ? { ...prev, imageUrl: croppedImageUrl, originalImageUrl } : prev);
      if (Object.keys(changedData).length > 0) {
        await updateDoc(taskRef, changedData);
        // Update originalTask after successful save to reflect new baseline
        setOriginalTask(JSON.parse(JSON.stringify(selectedTask)));
      }
    } catch (err) {
      console.error('Image upload or update failed.', err);
    }
  }
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [originalTask, setOriginalTask] = useState<any | null>(null);
    // When selectedTask changes, store a deep copy as the original for change detection
    useEffect(() => {
      if (selectedTask) {
        setOriginalTask(JSON.parse(JSON.stringify(selectedTask)));
      }
    }, [selectedTask?.id]);
  const today = new Date().toISOString().slice(0, 10);
  const [newTask, setNewTask] = useState({
    name: '',
    type: '',
    description: '',
    startDate: today,
    frequency: '',
    property: '',
    assigned_user: currentUserDisplayName,
    dueDate: '',
    recurrency: { frequency: 'None', interval: '1' }, // default interval is 1
  });

  // Always keep Select value in sync with allowed options
  const selectFrequencyValue =
    newTask.recurrency.frequency === 'None' ? 'None'
    : ['Quarterly', 'Weekly', 'Monthly', 'Yearly'].includes(newTask.recurrency.frequency)
      ? newTask.recurrency.frequency
      : 'None';

  // Update newTask assigned_user when currentUserDisplayName is loaded
  useEffect(() => {
    if (currentUserDisplayName && newTask.assigned_user === '') {
      setNewTask(t => ({ ...t, assigned_user: currentUserDisplayName }));
    }
  }, [currentUserDisplayName]);

  const [propertyOwnerDisplayName, setPropertyOwnerDisplayName] = useState<string>('');
  // Store userId along with displayName to avoid displayName collision issues
  const [propertyOwnerUserId, setPropertyOwnerUserId] = useState<string>('');
  const [sharedUsers, setSharedUsers] = useState<{ userId: string; displayName: string }[]>([]);
  React.useEffect(() => {
    if (selectedTask && selectedTask.propertyId) {
      import('firebase/firestore').then(async (firebase) => {
        const { doc, getDoc, getFirestore } = firebase;
        const db = getFirestore();
        const propertyRef = doc(db, 'properties', selectedTask.propertyId);
        const propertySnap = await getDoc(propertyRef);
        if (propertySnap.exists()) {
          const parentProperty = propertySnap.data();
          
          // Get property owner's displayName and userId
          if (parentProperty.ownerId) {
            try {
              const ownerRef = doc(db, 'users', parentProperty.ownerId);
              const ownerSnap = await getDoc(ownerRef);
              if (ownerSnap.exists()) {
                setPropertyOwnerDisplayName(ownerSnap.data().displayName || '');
                setPropertyOwnerUserId(parentProperty.ownerId);
              }
            } catch (e) {
              // ignore error
            }
          }
          
          if (Array.isArray(parentProperty.sharedWith) && parentProperty.sharedWith.length > 0) {
            const sharedUsersData = await Promise.all(parentProperty.sharedWith.map(async (sw: any) => {
              let displayName = sw.displayName || '';
              const swUserId = sw.userId || '';
              if (!displayName && swUserId) {
                try {
                  const userRef = doc(db, 'users', swUserId);
                  const userSnap = await getDoc(userRef);
                  if (userSnap.exists()) {
                    displayName = userSnap.data().displayName || '';
                  }
                } catch (e) {
                  // ignore error
                }
              }
              return { userId: swUserId, displayName };
            }));
            const validSharedUsers = sharedUsersData.filter((u) => !!u.displayName && !!u.userId);
            setSharedUsers(validSharedUsers);
          } else {
            setSharedUsers([]);
          }
        } else {
          setSharedUsers([]);
        }
      });
    } else {
      setSharedUsers([]);
      setPropertyOwnerDisplayName('');
      setPropertyOwnerUserId('');
    }
  }, [selectedTask]);

  const [propertyNames, setPropertyNames] = useState<string[]>(['All Properties']);
  const [ownedPropertyUserDisplayNames, setOwnedPropertyUserDisplayNames] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    const saved = sessionStorage.getItem('appTab');
    return saved || '';
  });

  // Only reset selectedTab after propertyNames is loaded and saved tab is not present
  useEffect(() => {
    if (propertyNames.length > 1 && (!selectedTab || !propertyNames.includes(selectedTab))) {
      setSelectedTab(propertyNames[0]);
      sessionStorage.setItem('appTab', propertyNames[0]);
    }
  }, [propertyNames]);

  // (Removed) previous immediate selection effect — replaced by a delayed effect
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [propertyMap, setPropertyMap] = useState<{ [id: string]: any }>({});
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  // Prevent multiple animations/Firebase actions at once
  const [isAnimating, setIsAnimating] = useState(false);
  // Separate animation state to prevent Firestore interference
  const [animationState, setAnimationState] = useState<{ [taskId: string]: { 
    _pendingComplete?: boolean;
    _pendingVisualComplete?: boolean; 
    _pendingStrikeComplete?: boolean;
    _pendingSlideOut?: boolean;
  } }>({});
  const [quarterFilteredTasks, setQuarterFilteredTasks] = useState<any[]>([]);
  const [quarterFilteredCompletedTasks, setQuarterFilteredCompletedTasks] = useState<any[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showAllCompletedTasks, setShowAllCompletedTasks] = useState(false);
  // Exact colors sampled from screenshot (background, border, checkbox)
  const tabColors = [
    '#e6f4ea', // green card bg
    '#e6ecf9', // blue card bg
    '#fff3e6', // yellow card bg
    '#fdeaea', // red card bg
  ];
  // Removed tabBorderColors; use darkenColor(tabColors[...]) for border instead
  // Checkbox color: just a touch darker than card bg, almost matching
  // Checkbox color: exactly the same as card bg for the brightest effect
  const tabCheckboxColors = [
    '#e6f4ea', // green, same as card
    '#e6ecf9', // blue, same as card
    '#fff3e6', // yellow, same as card
    '#fdeaea', // red, same as card
  ];

  useEffect(() => {
    async function fetchPropertyAndUserData() {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      
      // Fetch current user's displayName
      try {
        const currentUserDoc = await getDoc(doc(db, 'users', user.uid));
        if (currentUserDoc.exists()) {
          const displayName = currentUserDoc.data().displayName || '';
          setCurrentUserDisplayName(displayName);
        }
      } catch (err) {
        // Ignore error, fallback to empty string
      }
      
      // Fetch all properties
      const allPropsSnap = await getDocs(collection(db, "properties"));
      let propNames: string[] = ['All Properties'];
      const propMap: { [name: string]: string } = {};
      const otherTypes: string[] = [];
      let ourHomeId = '';
      // Find owned and shared properties
      allPropsSnap.forEach(docSnap => {
        const data = docSnap.data();
        const isOwner = data.ownerId === user.uid;
        let tabName = data.type;
        if (Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === user.uid)) {
          // Use alias for shared property
          const entry = data.sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === user.uid);
          if (entry && typeof entry === 'object' && entry.alias) {
            tabName = entry.alias;
          }
        }
        if ((isOwner || (Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === user.uid))) && tabName && docSnap.id) {
          if (tabName === 'Our Home') {
            ourHomeId = docSnap.id;
          } else {
            otherTypes.push(tabName);
          }
          propMap[tabName] = docSnap.id;
        }
      });
      if (ourHomeId) {
        propNames.push('Our Home');
      }
      propNames = propNames.concat(otherTypes);
      setPropertyNames(propNames);
      setPropertyMap(propMap);

      // Fetch only users that are shared with the current user's properties
      // Collect all userIds from sharedWith arrays of owned properties + property owners for shared properties
      const allowedUserIds = new Set<string>();
      const ownedPropertyUserIds = new Set<string>(); // Users from owned properties only
      allowedUserIds.add(user.uid); // Always include current user
      ownedPropertyUserIds.add(user.uid); // Always include current user
      
      allPropsSnap.forEach(docSnap => {
        const data = docSnap.data();
        const isOwner = data.ownerId === user.uid;
        const isShared = Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === user.uid);
        
        if (isOwner) {
          // For owned properties, add all shared users
          if (Array.isArray(data.sharedWith)) {
            data.sharedWith.forEach((sw: any) => {
              if (sw.userId) {
                allowedUserIds.add(sw.userId);
                ownedPropertyUserIds.add(sw.userId); // Also add to owned property users
              }
            });
          }
        } else if (isShared) {
          // For shared properties, add the owner
          if (data.ownerId) {
            allowedUserIds.add(data.ownerId);
          }
          // Also add other users the property is shared with
          if (Array.isArray(data.sharedWith)) {
            data.sharedWith.forEach((sw: any) => {
              if (sw.userId) {
                allowedUserIds.add(sw.userId);
              }
            });
          }
        }
      });

      // Skip fetching all user display names since we only use owned property users

      // Fetch display names for owned property users only
      const ownedDisplayNames: string[] = [];
      const ownedUserPromises = Array.from(ownedPropertyUserIds).map(async (userId) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.displayName) {
              return data.displayName;
            }
          }
        } catch (e) {
          // Ignore error
        }
        return null;
      });
      
      const ownedNames = await Promise.all(ownedUserPromises);
      ownedNames.forEach(name => {
        if (name && !ownedDisplayNames.includes(name)) {
          ownedDisplayNames.push(name);
        }
      });
      
      setOwnedPropertyUserDisplayNames(ownedDisplayNames);
    }
    fetchPropertyAndUserData();
  }, []);

  useEffect(() => {
    if (!propertyNames.length) return;
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    // Listen for all tasks, then filter for owned/shared properties
    const unsub = onSnapshot(collection(db, "tasks"), async (snapshot) => {
      const docs = snapshot.docs;
      // Get all propertyIds for owned/shared properties
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      const allPropsSnap = await getDocs(collection(db, "properties"));
      const allowedPropertyIds: string[] = [];
      allPropsSnap.forEach(docSnap => {
        const data = docSnap.data();
        const isOwner = data.ownerId === user.uid;
        const isShared = Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === user.uid);
        if ((isOwner || isShared) && docSnap.id) {
          allowedPropertyIds.push(docSnap.id);
        }
      });
      // Collect all propertyIds and ownerIds for allowed tasks
      const filteredDocs = docs.filter(docSnap => allowedPropertyIds.includes(docSnap.data().propertyId));
      const propertyIds = Array.from(new Set(filteredDocs.map(docSnap => docSnap.data().propertyId).filter(Boolean)));

      // Batch fetch all properties
      const propertyDocs = await Promise.all(propertyIds.map(id => getDoc(doc(db, "properties", id))));
      const propertyMap: { [id: string]: any } = {};
      propertyDocs.forEach((docSnap, idx) => {
        if (docSnap.exists()) propertyMap[propertyIds[idx]] = docSnap.data();
      });

      // Get property owner IDs from properties (not from tasks)
      const propertyOwnerIds = Array.from(new Set(
        Object.values(propertyMap).map((p: any) => p.ownerId).filter(Boolean)
      ));

      // Batch fetch all property owners
      const userDocs = await Promise.all(propertyOwnerIds.map(id => getDoc(doc(db, "users", id))));
      const userMap: { [id: string]: any } = {};
      userDocs.forEach((docSnap, idx) => {
        if (docSnap.exists()) userMap[propertyOwnerIds[idx]] = docSnap.data();
      });

      const active: any[] = [];
      const completed: any[] = [];
      for (const docSnap of filteredDocs) {
        const data = docSnap.data();
        // Get property type or alias from propertyId using already fetched propertyMap
        let propertyType = '';
        if (data.propertyId && propertyMap[data.propertyId]) {
          const property = propertyMap[data.propertyId];
          const userId = getAuth().currentUser?.uid;
          if (property.sharedWith && Array.isArray(property.sharedWith)) {
            const entry = property.sharedWith.find((sw: any) => sw.userId === userId);
            if (entry && typeof entry.alias === 'string' && entry.alias.trim()) {
              propertyType = entry.alias;
            } else {
              propertyType = property.type || '';
            }
          } else {
            propertyType = property.type || '';
          }
        }
        // Get property owner's avatar using propertyMap and userMap
        let propertyAvatar = '/avatar.png';
        if (data.propertyId && propertyMap[data.propertyId]) {
          const property = propertyMap[data.propertyId];
          if (property.ownerId && userMap[property.ownerId]) {
            const owner = userMap[property.ownerId];
            // Use photoURL directly from owner data
            if (owner.photoURL) {
              propertyAvatar = owner.photoURL;
            }
          }
        }
        const tabIdx = propertyNames.indexOf(selectedTab);
        const taskItem = {
          ...data,
          id: docSnap.id,
          propertyType,
          avatar: propertyAvatar,
          color: tabColors[tabIdx >= 0 ? tabIdx % tabColors.length : 0] || '#E6F4EA',
        };
        if (data.status === 'completed') completed.push(taskItem);
        else active.push(taskItem);
      }
      setTasks(active);
      setCompletedTasks(completed);
      setLoading(false);
    });
    return () => unsub();
  }, [propertyNames]);

  // Select first task on initial load or when tasks change

  // Default quarterly filter logic
  useEffect(() => {
    if (!tasks.length) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based
    // Determine season (Spring: Mar-May, Summer: Jun-Aug, Fall: Sep-Nov, Winter: Dec-Feb)
    let season = '';
    let startMonth = 0, endMonth = 0;
    if (month >= 2 && month <= 4) { // Mar-May
      season = 'spring'; startMonth = 2; endMonth = 4;
    } else if (month >= 5 && month <= 7) { // Jun-Aug
      season = 'summer'; startMonth = 5; endMonth = 7;
    } else if (month >= 8 && month <= 10) { // Sep-Nov
      season = 'fall'; startMonth = 8; endMonth = 10;
    } else { // Dec-Feb
      season = 'winter';
      // For winter, Dec is month 11, Jan is 0, Feb is 1
      // We'll treat winter as spanning two years
      startMonth = 11; endMonth = 1;
    }
    function isInSeason(dateStr: string) {
      if (!dateStr) return false;
      // Parse as US Central Time (America/Chicago)
      const usDateStr = new Date(dateStr + 'T00:00:00-06:00');
      const d = usDateStr;
      if (season === 'winter') {
        // Winter: Dec (prev year), Jan, Feb (current year)
        // If Dec, year can be current or previous
        if ((d.getMonth() === 11 && (d.getFullYear() === year - 1 || d.getFullYear() === year)) ||
            (d.getMonth() === 0 && d.getFullYear() === year) ||
            (d.getMonth() === 1 && d.getFullYear() === year)) {
          return true;
        }
        return false;
      } else {
        return d.getFullYear() === year && d.getMonth() >= startMonth && d.getMonth() <= endMonth;
      }
    }
    const sortByDueDate = (arr: any[]) =>
      arr.slice().sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        const dateDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (dateDiff !== 0) return dateDiff;
        // If dueDate is the same, sort by title alphabetically
        if (a.title && b.title) {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
    setQuarterFilteredTasks(sortByDueDate(tasks.filter(task => isInSeason(task.dueDate))));
    setQuarterFilteredCompletedTasks(sortByDueDate(completedTasks.filter(task => isInSeason(task.dueDate))));
  }, [tasks, completedTasks]);

  // Preserve selected task after refresh if it still exists
  useEffect(() => {
    if (selectedTask && selectedTask.id) {
      // If the selected task is still in either active or completed list, keep it
      const foundActive = quarterFilteredTasks.find(task => task.id === selectedTask.id);
      const foundCompleted = quarterFilteredCompletedTasks.find(task => task.id === selectedTask.id);
      if (foundActive) {
        setSelectedTask(foundActive);
        return;
      } else if (foundCompleted) {
        setSelectedTask(foundCompleted);
        return;
      }
    }
    // Do not auto-select first task - let user choose
  }, [quarterFilteredTasks, quarterFilteredCompletedTasks]);

  function validateTaskFields(task: typeof newTask): { [key: string]: string } {
    const newErrors: { [key: string]: string } = {};
    if (!task.name) newErrors.name = 'This is required field';
    if (!task.type) newErrors.type = 'This is required field';
    if (!task.startDate) newErrors.startDate = 'This is required field';
    if (!task.dueDate) newErrors.dueDate = 'This is required field';
    if (!task.property) newErrors.property = 'This is required field';
    if (task.recurrency?.frequency !== 'None' && (!task.recurrency?.interval || Number(task.recurrency.interval) < 1)) {
      newErrors.interval = 'This is required field';
    }
    return newErrors;
  }

  async function handleSaveTask() {
    const validation = validateTaskFields(newTask);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const propertyId = propertyMap[newTask.property] || '';
    // For new tasks, default assigned user is current user, so use their uid directly
    // If assigned_user matches current user's displayName, use current user's uid
    // Otherwise fallback to displayNameToUserIdMap lookup (less reliable)
    let assignedUserId = '';
    if (newTask.assigned_user === currentUserDisplayName) {
      assignedUserId = user.uid;
    } else {
      assignedUserId = displayNameToUserIdMap[newTask.assigned_user] || '';
    }
    const taskDoc = {
      propertyId,
      type: newTask.type,
      title: newTask.name,
      description: newTask.description,
      dueDate: newTask.dueDate,
      status: 'pending',
      completedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      recurrency: {
        frequency: newTask.recurrency?.frequency || 'None',
        interval: newTask.recurrency?.frequency === 'None' ? '' : newTask.recurrency?.interval || '1',
      },
      assigned_user: newTask.assigned_user,
      assigned_user_id: assignedUserId,
      startDate: newTask.startDate,
      ownerId: user.uid,
    };

    try {
      const docRef = await addDoc(collection(db, "tasks"), taskDoc);
      // Auto-select the newly created task
      setSelectedTask({
        id: docRef.id,
        ...taskDoc,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setAddTaskOpen(false);
      setNewTask({
        name: '',
        type: '',
        description: '',
        startDate: today,
        frequency: '',
        property: '',
        assigned_user: currentUserDisplayName,
        dueDate: '',
        recurrency: { frequency: 'None', interval: '1' },
      });
      setErrors({});
    } catch (err) {
      console.error('Error adding task:', err);
      setErrors({ general: 'Failed to add task. Please try again.' });
    }
  }

  async function handleTaskCheck(taskId: string) {
    if (isAnimating) return;
    setIsAnimating(true);
    
    // Find the task
    const taskIdx = tasks.findIndex(t => t.id === taskId);
    if (taskIdx === -1) {
      setIsAnimating(false);
      return;
    }
    const task = tasks[taskIdx];

    try {
      console.log('Starting task completion animation for:', taskId);
      
      // Step 1: Set _pendingComplete to trigger checkbox animation
      setAnimationState(prev => ({ ...prev, [taskId]: { ...prev[taskId], _pendingComplete: true } }));
      console.log('Step 1: Checkbox animation started');
      // Wait for checkbox animation (1s)
      await new Promise(res => setTimeout(res, 800));

      // Add 1s delay before starting card/text color animation
      await new Promise(res => setTimeout(res, 800));

      // Step 2: Set _pendingVisualComplete to trigger card/text color change
      setAnimationState(prev => ({ ...prev, [taskId]: { ...prev[taskId], _pendingVisualComplete: true } }));
      console.log('Step 2: Visual complete animation started');
      // Wait for card/text color animation (0.5s)
      await new Promise(res => setTimeout(res, 500));

      await new Promise(res => setTimeout(res, 500)); // Small delay before slide out

      // Step 3: Set _pendingStrikeComplete to trigger strike-through
      setAnimationState(prev => ({ ...prev, [taskId]: { ...prev[taskId], _pendingStrikeComplete: true } }));
      console.log('Step 3: Strike-through animation started');
      // Wait for strike-through animation (0.7s)
      await new Promise(res => setTimeout(res, 700));

      await new Promise(res => setTimeout(res, 500)); // Small delay before slide out

      // Step 4: Set _pendingSlideOut to trigger slide/fade out
      setAnimationState(prev => ({ ...prev, [taskId]: { ...prev[taskId], _pendingSlideOut: true } }));
      console.log('Step 4: Slide out animation started');
      // Wait for slide/fade out animation (0.5s)
      await new Promise(res => setTimeout(res, 500));


      console.log('Step 5: Moving task to completed');
      // Remove from active, add to completed
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setCompletedTasks(prev => [{ ...task, status: 'completed' }, ...prev]);
      
      // Clean up animation state
      setAnimationState(prev => {
        const { [taskId]: removed, ...rest } = prev;
        return rest;
      });

      console.log('Animation sequence completed, starting backend operations');
      setIsAnimating(false); // Animation is done, release the lock

      // Backend operations - run separately from animation to prevent interruption
      try {
        console.log('Step 6: Updating Firestore');
        const taskRef = doc(db, "tasks", taskId);
        const auth = getAuth();
        const user = auth.currentUser;
        const completedBy = user ? user.uid : '';
        
        await updateDoc(taskRef, { status: 'completed', updatedAt: serverTimestamp(), completedBy });

      // Check notification toggle before sending
      let sendNotification = true;
      if (user?.uid) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          sendNotification = userData.inside_taskCompleted !== false;
        }
      }
      // Send notification to property owners/shared members except completer
      if (sendNotification) {
        await sendTaskCompletedNotification({
          propertyId: task.propertyId,
          taskId,
          taskTitle: task.title,
          completedBy,
          completerName: user?.displayName || '',
        });
      }

      // If recurring, create next instance
      const freq = task.recurrency?.frequency;
      if (freq && ["Weekly", "Monthly", "Quarterly", "Yearly"].includes(freq)) {
        // Helper to add days/months/years
        function addToDate(dateStr: string, { days = 0, months = 0, years = 0 }) {
          const [y, m, d] = dateStr.split('-').map(Number);
          // Create date in US Central Time (America/Chicago)
          // JS Date does not support direct TZ, so use string with offset
          const date = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00-06:00`);
          if (days) date.setDate(date.getDate() + days);
          if (months) date.setMonth(date.getMonth() + months);
          if (years) date.setFullYear(date.getFullYear() + years);
          // Format YYYY-MM-DD
          return date.toISOString().slice(0, 10);
        }
        let nextStart = task.startDate;
        let nextDue = task.dueDate;
        if (freq === "Weekly") {
          nextStart = addToDate(task.startDate, { days: 7 });
          nextDue = addToDate(task.dueDate, { days: 7 });
        } else if (freq === "Monthly") {
          nextStart = addToDate(task.startDate, { months: 1 });
          nextDue = addToDate(task.dueDate, { months: 1 });
        } else if (freq === "Quarterly") {
          nextStart = addToDate(task.startDate, { months: 3 });
          nextDue = addToDate(task.dueDate, { months: 3 });
        } else if (freq === "Yearly") {
          nextStart = addToDate(task.startDate, { years: 1 });
          nextDue = addToDate(task.dueDate, { years: 1 });
        }
        // Create next instance
        const { id, status, completedBy, createdAt, updatedAt, ...rest } = task;
        await addDoc(collection(db, "tasks"), {
          ...rest,
          startDate: nextStart,
          dueDate: nextDue,
          status: 'pending',
          completedBy: '',
          assigned_user: '',
          assigned_user_id: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      console.log('Backend operations completed successfully');
      } catch (backendError) {
        console.error('Backend operation failed (animation already completed):', backendError);
        // Don't revert UI since animation completed successfully
      }

    } catch (err) {
      console.error('Animation sequence failed:', err);
      // Revert optimistic update if animation failed
      setTasks(prev => {
        const taskExists = prev.find(t => t.id === taskId);
        return taskExists ? prev : [task, ...prev];
      });
      setCompletedTasks(prev => prev.filter(t => t.id !== taskId));
      
      // Clean up animation state
      setAnimationState(prev => {
        const { [taskId]: removed, ...rest } = prev;
        return rest;
      });
      
      console.error('Failed to update task status:', err);
      setIsAnimating(false);
    }
  }

  // Add state for unchecking confirmation
  const [uncheckModalOpen, setUncheckModalOpen] = useState(false);
  const [pendingUncheckTask, setPendingUncheckTask] = useState<any | null>(null);

  // Handler for completed task checkbox
  const handleCompletedTaskCheckbox = (task: any) => {
    setPendingUncheckTask(task);
    setUncheckModalOpen(true);
  };

  const handleConfirmUncheck = async () => {
    if (!pendingUncheckTask) return;
    // Optimistically update UI
    setTasks(prev => [pendingUncheckTask, ...prev]);
    setCompletedTasks(prev => prev.filter(t => t.id !== pendingUncheckTask.id));
    setUncheckModalOpen(false);
    setPendingUncheckTask(null);
    // Update Firestore in background
    try {
      await updateDoc(doc(db, 'tasks', pendingUncheckTask.id), { status: 'pending', completedBy: null, updatedAt: serverTimestamp() });

      // If this is a recurring task, find and delete the next auto-generated instance
      const freq = pendingUncheckTask.recurrency?.frequency;
      if (freq && ["Weekly", "Monthly", "Quarterly", "Yearly"].includes(freq)) {
        // Calculate next start/due date
        interface AddToDateOptions {
          days?: number;
          months?: number;
          years?: number;
        }

        function addToDate(dateStr: string, { days = 0, months = 0, years = 0 }: AddToDateOptions): string {
          const [y, m, d] = dateStr.split('-').map(Number);
          const date = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00-06:00`);
          if (days) date.setDate(date.getDate() + days);
          if (months) date.setMonth(date.getMonth() + months);
          if (years) date.setFullYear(date.getFullYear() + years);
          return date.toISOString().slice(0, 10);
        }
        let nextStart = pendingUncheckTask.startDate;
        let nextDue = pendingUncheckTask.dueDate;
        if (freq === "Weekly") {
          nextStart = addToDate(pendingUncheckTask.startDate, { days: 7 });
          nextDue = addToDate(pendingUncheckTask.dueDate, { days: 7 });
        } else if (freq === "Monthly") {
          nextStart = addToDate(pendingUncheckTask.startDate, { months: 1 });
          nextDue = addToDate(pendingUncheckTask.dueDate, { months: 1 });
        } else if (freq === "Quarterly") {
          nextStart = addToDate(pendingUncheckTask.startDate, { months: 3 });
          nextDue = addToDate(pendingUncheckTask.dueDate, { months: 3 });
        } else if (freq === "Yearly") {
          nextStart = addToDate(pendingUncheckTask.startDate, { years: 1 });
          nextDue = addToDate(pendingUncheckTask.dueDate, { years: 1 });
        }
        // Find the next instance in Firestore
        const q = query(
          collection(db, "tasks"),
          where("propertyId", "==", pendingUncheckTask.propertyId)
        );
        const snapshot = await getDocs(q);
        const nextTask = snapshot.docs
          .map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as any) }))
          .find((t: any) =>
            t.title === pendingUncheckTask.title &&
            t.startDate === nextStart &&
            t.dueDate === nextDue
          );
        if (nextTask) {
          await deleteDoc(doc(db, "tasks", nextTask.id));
        }
      }
    } catch (err) {
      // Revert UI if Firestore update fails
      setTasks(prev => prev.filter(t => t.id !== pendingUncheckTask.id));
      setCompletedTasks(prev => [pendingUncheckTask, ...prev]);
      console.error('Failed to undo completed task. Please try again.');
    }
  };

  const handleCancelUncheck = () => {
    setUncheckModalOpen(false);
    setPendingUncheckTask(null);
  };

  // Use quarterly filtered tasks as default

  // Always sort by due date for correct visual order
  function sortByDueDate(arr: any[]) {
    return arr.slice().sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      const dateDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      // If dueDate is the same, sort by title alphabetically
      if (a.title && b.title) {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }

  const filteredTasks = useMemo(() => sortByDueDate(
    showAllTasks
      ? (selectedTab === propertyNames[0]
          ? tasks
          : (() => {
              const selectedPropertyId = propertyMap[selectedTab];
              return tasks.filter(task => task.propertyId === selectedPropertyId);
            })())
      : (selectedTab === propertyNames[0]
          ? quarterFilteredTasks
          : (() => {
              const selectedPropertyId = propertyMap[selectedTab];
              return quarterFilteredTasks.filter(task => task.propertyId === selectedPropertyId);
            })())
  ), [showAllTasks, selectedTab, propertyNames, tasks, quarterFilteredTasks, propertyMap]);

  // Auto-select first task when the tab changes only (not on filteredTasks updates).
  // Use a short delay so selection happens after filtering/sorting completes.
  useEffect(() => {
    if (selectedTab) sessionStorage.setItem('appTab', selectedTab);
    if (!selectedTab) return;
    const DELAY_MS = 60;
    let mounted = true;
    const timer = setTimeout(() => {
      if (!mounted) return;
      try {
        setSelectedTask(filteredTasks.length > 0 ? filteredTasks[0] : null);
      } catch (err) {
        setSelectedTask(null);
      }
    }, DELAY_MS);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
    // Intentionally only depend on `selectedTab` so user selection in the same tab isn't overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab]);

  const filteredCompletedTasks = useMemo(() => sortByDueDate(
    showAllCompletedTasks
      ? (selectedTab === propertyNames[0]
          ? completedTasks
          : (() => {
              const selectedPropertyId = propertyMap[selectedTab];
              return completedTasks.filter(task => task.propertyId === selectedPropertyId);
            })())
      : (selectedTab === propertyNames[0]
          ? quarterFilteredCompletedTasks
          : (() => {
              const selectedPropertyId = propertyMap[selectedTab];
              return quarterFilteredCompletedTasks.filter(task => task.propertyId === selectedPropertyId);
            })())
  ), [showAllCompletedTasks, selectedTab, propertyNames, completedTasks, quarterFilteredCompletedTasks, propertyMap]);

  function debouncedAutoSave(taskToSave?: any) {
    const key = '__tasks_auto_save_timeout';
    // clear any existing timeout
    if ((window as any)[key]) {
      clearTimeout((window as any)[key]);
      (window as any)[key] = null;
    }
    // schedule save
    (window as any)[key] = setTimeout(async () => {
      try {
        // Use passed task or fall back to selectedTask
        const task = taskToSave || selectedTask;
        if (!task || !task.id) return;
        
        const taskRef = doc(db, "tasks", task.id);
        // Use assigned_user_id directly (already set from dropdown selection)
        const assignedUserId = task.assigned_user_id || '';
        // Get displayName from userId for display purposes
        const assignedUserDisplayName = task.assigned_user || '';
        const updateData: any = {
          assigned_user: assignedUserDisplayName,
          assigned_user_id: assignedUserId,
          startDate: task.startDate || '',
          dueDate: task.dueDate || '',
          title: task.title || '',
          description: task.description || '',
          updatedAt: serverTimestamp(),
        };
        
        if (task.inventory === 'Smoke Detectors') {
          updateData.inventory_info = { numSmokeAlarms: task.inventory_info?.numSmokeAlarms ?? null };
        } else if (task.inventory === 'CO Detectors') {
          updateData.inventory_info = { numCO2Detectors: task.inventory_info?.numCO2Detectors ?? null };
        } else if (task.inventory === 'HVAC') {
          updateData.inventory_info = { filterSize: task.inventory_info?.filterSize ?? null };
        } else {
          updateData.inventory_info = null;
        }

        // Always save recurrency
        if (task.recurrency) {
          updateData['recurrency'] = {
            frequency: task.recurrency.frequency || 'None',
            interval: task.recurrency.frequency !== 'None' ? (task.recurrency.interval || '1') : '',
          };
        }

        // Update Firestore
        if (Object.keys(updateData).length > 0) {
          await updateDoc(taskRef, updateData);
        }
      } catch (e) {
        console.error('Auto-save failed', e);
      } finally {
        (window as any)[key] = null;
      }
    }, 800);
  }

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0, p: 3, bgcolor: "#F9F9F9", height: "100vh", overflow: 'hidden', ml: sidebar ? '75px' : '18vw', width: sidebar ? 'calc(100vw - 75px)' : 'calc(100vw - 18vw)' }}>
      {/* Top Tabs - dynamic property types */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 2 }}>
        <Typography variant="h5" sx={{ fontSize: 18, fontWeight: 550, color: '#222', fontFamily: 'Nunito, Arial, sans-serif' }}>Tasks</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          {propertyNames.map((name) => (
            <Box
              key={name}
              onClick={() => setSelectedTab(name)}
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
                color: name === selectedTab ? '#89AE99' : 'gray',
                ":hover": {
                  color: name === selectedTab ? '#89AE99' : '#000'
                },
                "::selection": {
                  color: '#89AE99'
                },
                // Custom indicator
                ...(name === selectedTab ? {
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
              {name}
            </Box>
          ))}
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          sx={{
            bgcolor: "#89AE99",
            color: "#fff",
            fontWeight: 400,
            fontSize: 16,
            fontFamily: 'Nunito, Arial, sans-serif',
            borderRadius: 2,
            px: 3,
            py: 1,
            boxShadow: 'none',
            textTransform: 'none',
            display: { xs: 'none', sm: 'none', md: 'none', lg: 'block' },
            '@media (min-width:700px)': { display: 'block' },
            '@media (max-width:699px)': { display: 'none' },
          }}
          onClick={() => {
            // Prefill property field with current selected tab name (except for 'All Property' tab)
            setNewTask(t => ({
              ...t,
              property: selectedTab && selectedTab !== 'All Properties' ? selectedTab : ''
            }));
            setAddTaskOpen(true);
          }}
        >
          + Add Task
        </Button>
      </Box>
      {/* Add Task Modal */}
      <Dialog open={addTaskOpen} onClose={() => setAddTaskOpen(false)}  fullWidth PaperProps={{ sx: { borderRadius: 2, p: 2 } }}>
        <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', minWidth: 400, fontWeight: 550, fontSize: 22, pb: 1 }}>
          Add Task
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Task Name"
              value={newTask.name}
              onChange={e => setNewTask(t => ({ ...t, name: e.target.value }))}
              fullWidth
              size="medium"
              sx={{ background: '#fff' }}
              required
              error={!!errors.name}
              helperText={errors.name}
            />
            <TextField
              label="Task Type"
              value={newTask.type}
              onChange={e => setNewTask(t => ({ ...t, type: e.target.value }))}
              fullWidth
              size="medium"
              sx={{ background: '#fff' }}
              required
              error={!!errors.type}
              helperText={errors.type}
            />
            <TextField
              label="Description (optional)"
              value={newTask.description}
              onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))}
              fullWidth
              size="medium"
              sx={{ background: '#fff' }}
            />
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <DatePicker
                  label="Start Date"
                  value={newTask.startDate ? parseLocalDate(newTask.startDate) : null}
                  onChange={date => {
                    const newStart = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
                    setNewTask(t => {
                      // If dueDate is before new start, clear dueDate
                      let dueDate = t.dueDate;
                      if (dueDate && newStart && dueDate < newStart) dueDate = '';
                      return { ...t, startDate: newStart, dueDate };
                    });
                  }}
                  slotProps={{
                    textField: {
                      variant: "outlined",
                      fullWidth: true,
                      size: "medium",
                      sx: { background: '#fff' },
                      error: !!errors.startDate,
                      helperText: errors.startDate,
                    },
                  }}
                />
                <DatePicker
                  label="Due Date"
                  value={newTask.dueDate ? parseLocalDate(newTask.dueDate) : null}
                  minDate={newTask.startDate ? parseLocalDate(newTask.startDate) || undefined : undefined}
                  onChange={date => {
                    setNewTask(t => ({
                      ...t,
                      dueDate: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : ''
                    }));
                  }}
                  slotProps={{
                    textField: {
                      variant: "outlined",
                      fullWidth: true,
                      size: "medium",
                      sx: { background: '#fff' },
                      error: !!errors.dueDate,
                      helperText: errors.dueDate,
                    },
                  }}
                />
              </Box>
            </LocalizationProvider>
              {/* recurrency section */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  select
                  label="Recurrency Frequency"
                  value={selectFrequencyValue}
                  onChange={e => {
                    let val = e.target.value;
                    if (!['Weekly', 'Monthly', 'Quarterly', 'Yearly'].includes(val)) val = 'None';
                    setNewTask(t => ({ ...t, recurrency: { ...t.recurrency, frequency: val } }));
                  }}
                  fullWidth
                  size="medium"
                  sx={{ background: '#fff', flex: 2 }}
                >
                  <MenuItem value="None">None</MenuItem>
                  <MenuItem value="Weekly">Weekly</MenuItem>
                  <MenuItem value="Monthly">Monthly</MenuItem>
                  <MenuItem value="Quarterly">Quarterly</MenuItem>
                  <MenuItem value="Yearly">Yearly</MenuItem>
                </TextField>
              </Box>
              <TextField
                select
                label="Assign to Property"
                value={newTask.property || ''}
                onChange={e => setNewTask(t => ({ ...t, property: e.target.value }))}
                fullWidth
                size="medium"
                sx={{ background: '#fff' }}
                required
                error={!!errors.property}
                helperText={errors.property}
              >
                {/* Only show real properties, not 'All Properties' */}
                {propertyNames.filter(option => option !== 'All Properties').map((option: string) => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </TextField>
            <Autocomplete
              freeSolo
              disableClearable
              options={currentUserDisplayName ? [currentUserDisplayName, ...ownedPropertyUserDisplayNames.filter((name: string) => name !== currentUserDisplayName)] : ownedPropertyUserDisplayNames}
              value={newTask.assigned_user || currentUserDisplayName || ''}
              onInputChange={(_, value) => {
                setNewTask(t => ({ ...t, assigned_user: value }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Assign to User"
                  variant="outlined"
                  size="medium"
                  fullWidth
                  sx={{ background: '#fff', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 15 }}
                  InputLabelProps={{ shrink: true }}
                />
              )}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
              <Button variant="outlined" sx={{ fontSize: 15, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, textTransform: 'none', '&:hover': { border: '1px solid #ccc', background: '#F5F6F8' }, border: '1px solid #ccc', bgcolor: '#fff', color: '#222', px: 3.5, py: 1.5, borderRadius: 2, minWidth: 110
                  }} onClick={() => setAddTaskOpen(false)}>
                Cancel
              </Button>
              <Button variant="contained" sx={{ fontSize: 15, fontFamily: 'Nunito, Arial, sans-serif', borderRadius: 2, minWidth: 110, background: '#89AE99', textTransform: 'none', fontWeight: 400, boxShadow: 'none' }} onClick={handleSaveTask}>
                Save
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    {/* Main content: left and right columns */}
    <Box sx={{ 
      display: "flex", 
      gap: 3, 
      flex: 1, 
      // Ensure the main container allows overflow from scaled cards
      overflow: 'visible',
      position: 'relative' 
    }}>
        {/* Left: Tasks List */}
        <Box sx={{
          flex: 2,
          minHeight: '91vh',
          maxHeight: '91vh',
          overflowY: 'auto',
          overflowX: 'visible', // allow box-shadow and border to show fully
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          // Ensure proper overflow handling for scaled cards
          position: 'relative',
          // Add responsive padding to accommodate card scaling overflow
          paddingLeft: { xs: '4px', sm: '6px', md: '8px' },
          paddingRight: { xs: '4px', sm: '6px', md: '8px' },
          // Ensure container can accommodate scaled elements
          '@media (max-width: 1200px)': {
            paddingLeft: '12px',
            paddingRight: '12px'
          }
        }}>
        {/* Tasks count above the task list, and show all tasks checkbox right-aligned in the left panel only */}
        <Box sx={{ display: 'flex', flexDirection: 'column', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mr: 2 }}>
            <Typography variant="subtitle1" sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', fontWeight: 550, fontSize: 20, ml: 3.5 }}>
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showAllTasks}
                  onChange={e => setShowAllTasks(e.target.checked)}
                  sx={{
                    fontWeight: 400,
                    color: '#89AE99',
                    '&.Mui-checked': {
                      color: '#89AE99',
                    },
                  }}
                />
              }
              label={<span style={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#222', marginRight: 8, fontWeight: 600 }}>Show all tasks</span>}
              sx={{ ml: 1, userSelect: 'none', mr: 2 }}
            />
          </Box>
        </Box>
          {/* Active Tasks */}
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f5f5f5', borderRadius: '12px', p: 2, mb: '9px', mx: 3.5, border: '2px solid #e0e0e0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Skeleton variant="rectangular" width={32} height={32} sx={{ borderRadius: 2, mr: 2 }} />
                  <Box>
                    <Skeleton variant="text" width={120} height={28} sx={{ mb: 1, borderRadius: 1 }} />
                    <Skeleton variant="text" width={180} height={18} sx={{ mb: 0.5, borderRadius: 1 }} />
                    <Skeleton variant="text" width={90} height={14} sx={{ borderRadius: 1 }} />
                  </Box>
                </Box>
                <Skeleton variant="circular" width={24} height={24} />
              </Box>
            ))
          ) : (
            filteredTasks.map((task) => {
              let tabIdx = propertyNames.findIndex(name => name === task.propertyType);
              if (tabIdx === -1) tabIdx = 0;
              const isSelected = selectedTask && selectedTask.id === task.id;
              const isHovered = hoveredTaskId === task.id;
              const showHoverEffect = !selectedTask && isHovered;
              const taskAnimState = animationState[task.id] || {};
              // Responsive scaling: smaller scale on smaller screens to prevent cutting
              const getScaleFactor = () => {
                if (window.innerWidth < 1200) {
                  return isSelected ? 1.02 : showHoverEffect ? 1.015 : 1; // Smaller scale for small screens
                } else {
                  return isSelected ? 1.03 : showHoverEffect ? 1.02 : 1; // Original scale for larger screens
                }
              };
              const getCompletionScale = () => {
                return window.innerWidth < 1200 ? 1.04 : 1.06; // Smaller completion scale for small screens
              };
              return (
                <motion.div
                  initial={false}
                  key={task.id}
                  animate={{
                    backgroundColor: taskAnimState._pendingVisualComplete ? '#89AE99' : tabColors[tabIdx % tabColors.length],
                    scale: taskAnimState._pendingVisualComplete ? getCompletionScale() : getScaleFactor(),
                    y: taskAnimState._pendingSlideOut ? window.innerHeight : 0,
                    opacity: taskAnimState._pendingSlideOut ? 0 : 1,
                  }}
                  transition={{
                    backgroundColor: { duration: 0.5 },
                    borderColor: { duration: 0.5 },
                    // Use Calendar page timing for hover/select animations
                    scale: { duration: taskAnimState._pendingVisualComplete ? 0.5 : 0.48 },
                    y: { duration: 0.5 },
                    opacity: { duration: 0.5 },
                  }}
                  style={{
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 9,
                    marginLeft: window.innerWidth < 1200 ? (isSelected ? 18 : 20) : (isSelected ? 26 : 28), // Reduce margin slightly when selected to accommodate scaling
                    marginRight: window.innerWidth < 1200 ? (isSelected ? 18 : 20) : (isSelected ? 26 : 28), // More space for smaller screens
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    border: `2px solid ${task._pendingVisualComplete ? '#89AE99' : darkenColor(tabColors[tabIdx % tabColors.length])}`,
                    boxShadow: task._pendingVisualComplete ? '0 4px 24px 0 rgba(137,174,153,0.25)' : '0 1px 4px rgba(0,0,0,0.04)',
                    zIndex: task._pendingVisualComplete ? 100 : (isSelected ? 2 : showHoverEffect ? 1.5 : 1),
                    position: task._pendingVisualComplete ? 'relative' : 'static',
                    // Ensure smooth scaling without clipping
                    transformOrigin: 'center center',
                  }}
                  onMouseEnter={() => setHoveredTaskId(task.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  onClick={() => setSelectedTask((prev: any) => prev?.id === task.id ? null : task)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ display: { xs: 'none', sm: 'none', md: 'none', lg: 'block' }, '@media (min-width:700px)': { display: 'block' }, '@media (max-width:699px)': { display: 'none' } }}>
                      <CustomCheckbox
                        checked={taskAnimState._pendingComplete || false}
                        onChange={() => {
                          if (!isAnimating) {
                            handleTaskCheck(task.id);
                            setSelectedTask(task);
                          }
                        }}
                        color={tabCheckboxColors[tabIdx % tabCheckboxColors.length]}
                        animateBorder={!!taskAnimState._pendingComplete}
                      />
                    </Box>
                    <Box>
                      <motion.span
                        animate={{
                          color: taskAnimState._pendingVisualComplete ? '#fff' : '#343438',
                          opacity: taskAnimState._pendingVisualComplete ? 0.8 : 1,
                        }}
                        transition={{ color: { duration: 0.5 }, opacity: { duration: 0.5 } }}
                        style={{ position: 'relative', display: 'inline-block', fontSize: 20, fontWeight: 550 }}
                      >
                        {task.title}
                        {taskAnimState._pendingStrikeComplete && (
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.9, ease: 'easeInOut' }}
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: '50%',
                              width: '100%',
                              height: 2,
                              background: '#fff',
                              transformOrigin: 'left',
                              pointerEvents: 'none',
                            }}
                          />
                        )}
                      </motion.span>
                      <motion.div
                        animate={{ color: task._pendingVisualComplete ? '#fff' : '#343748' }}
                        transition={{ color: { duration: 0.5 } }}
                        style={{ width: '100%', maxWidth: '40vw', overflow: 'hidden' }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            mb: 0.5,
                            whiteSpace: 'normal',
                            overflowWrap: 'break-word',
                            wordBreak: 'break-word',
                            width: '100%',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            fontFamily: 'Nunito, Arial, sans-serif',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                          title={task.description}
                        >
                          {task.description}
                        </Typography>
                      </motion.div>
                      <motion.div
                        animate={{ color: task._pendingVisualComplete ? '#fff' : '#343748' }}
                        transition={{ color: { duration: 0.5 } }}
                        style={{ fontWeight: 400, fontSize: 14, marginTop: 4, fontFamily: 'Nunito, Arial, sans-serif' }}
                      >
                        Property: {
                          (() => {
                            let property = propertyMap[task.propertyId];
                            if (!property && task.propertyType) {
                              property = propertyMap[task.propertyType];
                            }
                            const userId = getAuth().currentUser?.uid;
                            if (property && Array.isArray(property.sharedWith)) {
                              const entry = property.sharedWith.find((sw: any) => sw.userId === userId);
                              if (entry && typeof entry.alias === 'string' && entry.alias.trim()) {
                                return entry.alias;
                              }
                            }
                            return property?.type || task.propertyType;
                          })()
                        }
                      </motion.div>
                    </Box>
                  </Box>
                  <Avatar
                    sx={{ width: 24, height: 24 }}
                    src={
                      // First try assigned_user_id, then fallback to looking up from displayName, then property owner avatar
                      (task.assigned_user_id && userPhotoMap[task.assigned_user_id])
                        ? userPhotoMap[task.assigned_user_id]
                        : (task.assigned_user && displayNameToUserIdMap[task.assigned_user] && userPhotoMap[displayNameToUserIdMap[task.assigned_user]])
                          ? userPhotoMap[displayNameToUserIdMap[task.assigned_user]]
                          : (task.avatar || "/avatar.png")
                    }
                  />
                </motion.div>
              );
            })
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, mr: 2 }}>
            <Typography variant="subtitle1" sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', fontWeight: 550, fontSize: 20, ml: 3.5 }}>
              {filteredCompletedTasks.length} completed task{filteredCompletedTasks.length !== 1 ? 's' : ''}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showAllCompletedTasks}
                  onChange={e => setShowAllCompletedTasks(e.target.checked)}
                  sx={{
                    fontWeight: 400,
                    color: '#89AE99',
                    '&.Mui-checked': {
                      color: '#89AE99',
                    },
                  }}
                />
              }
              label={<span style={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#222', marginRight: 8, fontWeight: 600 }}>Show all completed tasks</span>}
              sx={{ ml: 1, userSelect: 'none', mr: 2 }}
            />
          </Box>
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f5f5f5', borderRadius: '12px', p: 2, mb: 1.1, mx: 3.5, border: '2px solid #e0e0e0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Skeleton variant="rectangular" width={32} height={32} sx={{ borderRadius: 2, mr: 2 }} />
                  <Box>
                    <Skeleton variant="text" width={120} height={28} sx={{ mb: 1, borderRadius: 1 }} />
                    <Skeleton variant="text" width={180} height={18} sx={{ mb: 0.5, borderRadius: 1 }} />
                    <Skeleton variant="text" width={90} height={14} sx={{ borderRadius: 1 }} />
                  </Box>
                </Box>
                <Skeleton variant="circular" width={24} height={24} />
              </Box>
            ))
          ) : (
            filteredCompletedTasks.map((task) => {
              let tabIdx = propertyNames.findIndex(name => name === task.propertyType);
              if (tabIdx === -1) tabIdx = 0;
              const isSelected = selectedTask && selectedTask.id === task.id;
              const isHovered = hoveredTaskId === task.id;
              const showHoverEffect = !selectedTask && isHovered;
              return (
                <Box
                  key={task.id}
                  sx={{
                    bgcolor: tabColors[tabIdx % tabColors.length],
                     borderRadius: 2,
                    p: 2,
                    mb: 1.1,
                    mx: 2.2,
                    marginLeft: 3.5, // Adjusted to match active tasks
                    marginRight: 3.5, // Adjusted to match active tasks
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    border: `2px solid ${darkenColor(tabColors[tabIdx % tabColors.length])}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    transform: isSelected 
                      ? (window.innerWidth < 1200 ? 'scale(1.02)' : 'scale(1.025)') 
                      : showHoverEffect 
                        ? (window.innerWidth < 1200 ? 'scale(1.015)' : 'scale(1.02)') 
                        : 'none',
                    transition: 'box-shadow 0.4s, border 0.25s, transform 0.48s',
                    zIndex: isSelected ? 2 : showHoverEffect ? 1.5 : 1,
                    // Ensure proper scaling transform origin
                    transformOrigin: 'center center',
                  }}
                  onMouseEnter={() => setHoveredTaskId(task.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  onClick={() => setSelectedTask((prev: any) => prev?.id === task.id ? null : task)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CustomCheckbox
                      checked={true}
                      onChange={() => {
                        handleCompletedTaskCheckbox(task);
                        setSelectedTask(task);
                      }}
                      color={tabCheckboxColors[tabIdx % tabCheckboxColors.length]}
                      animateBorder={false}
                    />
                    <Box>
                      <Typography variant="h6" sx={{ color: "#343748", fontWeight: 550, textDecoration: "line-through" }}>{task.title}</Typography>
                      <Box sx={{ width: '100%', maxWidth: '40vw', overflow: 'hidden' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "#343748",
                            mb: 0.5,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '100%',
                            fontFamily: 'Nunito, Arial, sans-serif',
                            maxWidth: '100%',
                            display: 'block',
                          }}
                          title={task.description}
                        >
                          {task.description}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: "#343748", fontSize: 14, mt: 1 }}>Property: {task.propertyType}</Typography>
                    </Box>
                  </Box>
                  <Avatar
                    sx={{ width: 24, height: 24 }}
                    src={
                      // First try assigned_user_id, then fallback to looking up from displayName, then property owner avatar
                      (task.assigned_user_id && userPhotoMap[task.assigned_user_id])
                        ? userPhotoMap[task.assigned_user_id]
                        : (task.assigned_user && displayNameToUserIdMap[task.assigned_user] && userPhotoMap[displayNameToUserIdMap[task.assigned_user]])
                          ? userPhotoMap[displayNameToUserIdMap[task.assigned_user]]
                          : (task.avatar || "/avatar.png")
                    }
                  />
                </Box>
              );
            })
          )}
        </Box>

        {/* Right: Task Information or Completed Task Info Panel */}
        <Box sx={{
          flex: 1,
          bgcolor: "#fff",
          borderRadius: 2,
          p: 3,
          boxShadow: 1,
          minWidth: 340,
          maxHeight: '90vh',
          height: 'fit-content',
          overflowY: 'auto',
          display: { xs: 'none', sm: 'none', md: 'none', lg: 'none', xl: 'block' },
          '@media (min-width:1230px)': { display: 'block' },
          '@media (max-width:1229px)': { display: 'none' },
        }}>
          {selectedTask ? (
            <>
              {/* Removed Task Information header and Save button for auto-save */}
              <Box sx={{ mb: 2, position: 'relative', width: '100%', borderRadius: 2, overflow: 'hidden', aspectRatio: '16 / 9', background: '#E5E5E5' }}>
                {selectedTask.imageUrl ? (
                  <img
                    src={selectedTask.imageUrl}
                    alt="Title"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: 0,
                      transition: 'filter 0.2s',
                      filter: 'brightness(0.97)',
                      cursor: 'pointer',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }}
                    onClick={() => {
                      if (!selectedTask) {
                        console.warn('No task selected');
                        return;
                      }
                      
                      // Check if there's a real image (not default placeholder)
                      const hasRealImage = selectedTask.imageUrl;
                      
                      if (hasRealImage) {
                        // Image exists: show PhotoPicker to allow re-cropping with ORIGINAL image
                        const imageToEdit = selectedTask.originalImageUrl || selectedTask.imageUrl;
                        console.log('[Image Click] Re-crop mode: showing', imageToEdit?.substring(0, 50), 'isOriginal:', !!selectedTask.originalImageUrl);
                        setPhotoPickerImage(imageToEdit);
                        setShowPhotoPicker(true);
                      } else {
                        // Default image: open file selector to upload new image
                        if (fileInputRef.current) fileInputRef.current.click();
                      }
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }}
                    onClick={() => {
                      if (fileInputRef.current) fileInputRef.current.click();
                    }}
                  >
                    <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 2V8H20" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Box>
                )}
                <IconButton
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: '#343748',
                    zIndex: 2,
                    p: 0.5,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.4)' },
                  }}
                  tabIndex={-1}
                  aria-label="Edit Image"
                  disableRipple
                  disableFocusRipple
                  onClick={e => { e.stopPropagation(); if (fileInputRef.current) fileInputRef.current.click(); }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleImageChange}
                />
                {/* PhotoPicker modal, only shown when triggered */}
                {imageUploadError && (
                  <Box sx={{ bgcolor: '#ffebee', color: '#c62828', p: 2, mb: 2, borderRadius: 1, fontSize: 14 }}>
                    {imageUploadError}
                  </Box>
                )}
                {/* PhotoPicker modal - render directly without Dialog wrapper to avoid interference */}
                {showPhotoPicker ? (
                  photoPickerImage ? (
                    <PhotoPicker
                      aspect={16 / 9}
                      avatarStyle={false}
                      imageSrc={photoPickerImage}
                      onCropped={async (blob, previewUrl) => {
                        // Capture task context immediately (avoid closure issues)
                        const taskId = selectedTask?.id;
                        const originalFile = originalImageFile;
                    
                        setShowPhotoPicker(false);
                        setImageUploadError(null);
                        
                        // Validate preconditions
                        if (!taskId) {
                          setImageUploadError('No task selected');
                          URL.revokeObjectURL(previewUrl);
                          return;
                        }
                        
                        if (!blob) {
                          setImageUploadError('Image processing failed');
                          URL.revokeObjectURL(previewUrl);
                          return;
                        }
                        
                        // Prevent concurrent uploads for the same task
                        if (activeUploadsRef.current.has(taskId)) {
                          setImageUploadError('Image upload already in progress');
                          URL.revokeObjectURL(previewUrl);
                          return;
                        }
                        
                        // Mark as uploading
                        activeUploadsRef.current.add(taskId);
                        blobUrlsRef.current.add(previewUrl);
                        
                        try {
                          // Create cropped file from blob
                          const croppedFile = new File([blob], 'cropped_image.webp', { type: 'image/webp' });
                          setSelectedImageFile(croppedFile);
                          
                          // Show preview immediately while uploading
                          setSelectedTask((prev: any) => 
                            prev?.id === taskId ? { ...prev, imageUrl: previewUrl } : prev
                          );
                          
                          // Upload strategy: new original file → upload both; otherwise re-crop only
                          if (originalFile) {
                            // New upload: both original and cropped in parallel
                            const [originalUrl, croppedUrl] = await Promise.all([
                              uploadOriginalTaskImage(taskId, originalFile).catch(err => {
                                console.error('Original upload failed:', err);
                                return null; // Don't fail entire operation
                              }),
                              uploadTaskImage(taskId, croppedFile).catch(err => {
                                console.error('Cropped upload failed:', err);
                                throw err; // Fail if cropped fails
                              })
                            ]);
                            
                            // Update state and Firestore
                            const updateData: any = { imageUrl: croppedUrl };
                            if (originalUrl) updateData.originalImageUrl = originalUrl;
                            
                            setSelectedTask((prev: any) => {
                              if (prev?.id !== taskId) return prev;
                              return { ...prev, imageUrl: croppedUrl, originalImageUrl: originalUrl || prev.originalImageUrl };
                            });
                            
                            const { db } = await import('../services/firebase');
                            const { doc, updateDoc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'tasks', taskId), updateData);
                          } else {
                            // Re-crop only: upload cropped image
                            const croppedUrl = await uploadTaskImage(taskId, croppedFile);
                            
                            setSelectedTask((prev: any) => 
                              prev?.id === taskId ? { ...prev, imageUrl: croppedUrl } : prev
                            );
                            
                            const { db } = await import('../services/firebase');
                            const { doc, updateDoc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'tasks', taskId), { imageUrl: croppedUrl });
                          }
                          
                          // Clear upload state
                          setOriginalImageFile(null);
                          setSelectedImageFile(null);
                        } catch (err) {
                          // Handle upload errors gracefully
                          setImageUploadError('Failed to save image. Please try again.');
                          setSelectedTask((prev: any) => 
                            prev?.id === taskId ? { ...prev, imageUrl: null } : prev
                          );
                        } finally {
                          // Clean up resources
                          activeUploadsRef.current.delete(taskId);
                          setTimeout(() => {
                            URL.revokeObjectURL(previewUrl);
                            blobUrlsRef.current.delete(previewUrl);
                          }, 500);
                        }
                      }}
                      onClose={() => {
                        setShowPhotoPicker(false);
                        
                        // Clean up blob URLs
                        if (photoPickerImage?.startsWith('blob:')) {
                          URL.revokeObjectURL(photoPickerImage);
                          blobUrlsRef.current.delete(photoPickerImage);
                        }
                        
                        // Reset state
                        setOriginalImageFile(null);
                        setImageUploadError(null);
                      }}
                    />
                  ) : (
                    <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', bgcolor: 'rgba(30, 34, 44, 0.85)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box sx={{ background: '#fff', borderRadius: 2, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', p: 5, textAlign: 'center' }}>
                        <Typography sx={{ color: '#343748', fontWeight: 550, fontSize: 18, mb: 2 }}>Loading image...</Typography>
                        <CircularProgress size={48} />
                      </Box>
                    </Box>
                  )
                ) : null}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                {editingTitle ? (
                  <TextField
                    value={selectedTask.title}
                    onChange={e => {
                      setSelectedTask((prev: any) => prev ? { ...prev, title: e.target.value.slice(0, 64) } : prev);
                    }}
                    onBlur={async () => {
                      setEditingTitle(false);
                      await handleUpdateSelectedTask();
                    }}
                    autoFocus
                    size="small"
                    sx={{ flex: 1, mr: 1 }}
                    inputProps={{ maxLength: 64 }}
                  />
                ) : (
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', fontWeight: 550, flex: 1, wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal' }}>
                    {selectedTask.title}
                  </Typography>
                )}
                <IconButton size="small" onClick={() => setEditingTitle(true)} sx={{ ml: 1 }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 0.5 }}>
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', fontWeight: 550, flex: 1 }}>Description:</Typography>
                <IconButton size="small" onClick={() => setEditingDescription(true)} sx={{ ml: 1 }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Box>
              {editingDescription ? (
                <TextField
                  value={selectedTask.description}
                  onChange={e => {
                    setSelectedTask((prev: any) => prev ? { ...prev, description: e.target.value.slice(0, 128) } : prev);
                  }}
                  onBlur={async () => {
                    setEditingDescription(false);
                    await handleUpdateSelectedTask();
                  }}
                  autoFocus
                  size="small"
                  fullWidth
                  sx={{ mb: 2, fontFamily: 'Nunito, Arial, sans-serif', }}
                  inputProps={{ maxLength: 128 }}
                />
              ) : (
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: "#343748", mb: 2, wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal' }}>{selectedTask.description || "No description"}</Typography>
              )}
              <Box sx={{ borderBottom: '1px solid #E0E0E0', my: 2 }} />
              {selectedTask.inventory === 'Air Filter' && (
                <TextField 
                  label="Filter Size" 
                  variant="outlined" 
                  size="small" 
                  fullWidth 
                  sx={{ mb: 2, fontFamily: 'Nunito, Arial, sans-serif' }} 
                  value={selectedTask.inventory_info?.filterSize || ''} 
                  onChange={e => {
                    const updatedTask = selectedTask ? { ...selectedTask, inventory_info: { ...selectedTask.inventory_info, filterSize: e.target.value } } : null;
                    setSelectedTask(updatedTask);
                    if (updatedTask) {
                      debouncedAutoSave(updatedTask);
                    }
                  }}
                />
              )}
              {selectedTask.inventory === 'Smoke Detectors' && (
                <TextField 
                  label="Number of Smoke Alarms" 
                  type="number"
                  variant="outlined"
                  size="small" 
                  fullWidth 
                  sx={{ mb: 2 }} 
                  value={selectedTask.inventory_info?.numSmokeAlarms === 0 ? 0 : selectedTask.inventory_info?.numSmokeAlarms || ''}
                  inputProps={{ min: 0, max: 50, step: 1 }}
                  onChange={e => {
                    let val = e.target.value;
                    let numVal: any = '';
                    if (val === '') {
                      numVal = '';
                    } else {
                      numVal = Math.max(0, Math.min(50, Number(val)));
                    }
                    const updatedTask = selectedTask ? { ...selectedTask, inventory_info: { ...selectedTask.inventory_info, numSmokeAlarms: numVal } } : null;
                    setSelectedTask(updatedTask);
                    if (updatedTask) {
                      debouncedAutoSave(updatedTask);
                    }
                  }}
                />
              )}
              {selectedTask.inventory === 'CO Detectors' && (
                <TextField 
                  label="Number of CO Detectors" 
                  type="number"
                  variant="outlined" 
                  size="small" 
                  fullWidth 
                  sx={{ mb: 2 }} 
                  value={selectedTask.inventory_info?.numCO2Detectors === 0 ? 0 : selectedTask.inventory_info?.numCO2Detectors || ''}
                  inputProps={{ min: 0, max: 50, step: 1 }}
                  onChange={e => {
                    let val = e.target.value;
                    let numVal: any = '';
                    if (val === '') {
                      numVal = '';
                    } else {
                      numVal = Math.max(0, Math.min(50, Number(val)));
                    }
                    const updatedTask = selectedTask ? { ...selectedTask, inventory_info: { ...selectedTask.inventory_info, numCO2Detectors: numVal } } : null;
                    setSelectedTask(updatedTask);
                    if (updatedTask) {
                      debouncedAutoSave(updatedTask);
                    }
                  }}
                />
              )}
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={parseLocalDate(selectedTask.startDate)}
                  maxDate={parseLocalDate(selectedTask.dueDate) || undefined}
                  onChange={date => {
                    const formattedDate = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
                    const updatedTask = selectedTask ? { ...selectedTask, startDate: formattedDate } : null;
                    setSelectedTask(updatedTask);
                    if (updatedTask) {
                      debouncedAutoSave(updatedTask);
                    }
                  }}
                  slotProps={{
                    textField: {
                      variant: "outlined",
                      fullWidth: true,
                      size: "small",
                      sx: { mb: 2 },
                      InputLabelProps: { shrink: true },
                    },
                  }}
                />
                <DatePicker
                  label="Due Date"
                  value={parseLocalDate(selectedTask.dueDate)}
                  minDate={parseLocalDate(selectedTask.startDate) || undefined}
                  onChange={date => {
                    const formattedDate = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
                    const updatedTask = selectedTask ? { ...selectedTask, dueDate: formattedDate } : null;
                    setSelectedTask(updatedTask);
                    if (updatedTask) {
                      debouncedAutoSave(updatedTask);
                    }
                  }}
                  slotProps={{
                    textField: {
                      variant: "outlined",
                      fullWidth: true,
                      size: "small",
                      sx: { mb: 2 },
                      InputLabelProps: { shrink: true },
                    },
                  }}
                />
              </LocalizationProvider>
              <ClickAwayListener onClickAway={() => setFrequencyOpen(false)}>
                <div>
                  <Autocomplete
                    freeSolo
                    disableClearable
                    options={['None', 'Weekly', 'Monthly', 'Quarterly', 'Yearly']}
                    value={selectedTask.recurrency?.frequency || 'None'}
                    open={frequencyOpen}
                    onInputChange={(_, value) => {
                      const updatedTask = selectedTask ? { ...selectedTask, recurrency: { ...selectedTask.recurrency, frequency: value } } : null;
                      setSelectedTask(updatedTask);
                      setFrequencyOpen(false);
                      if (updatedTask) {
                        debouncedAutoSave(updatedTask);
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Frequency"
                        variant="outlined"
                        size="small"
                        fullWidth
                        sx={{ mb: 2, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 15, minWidth: 180, background: '#fff' }}
                        InputLabelProps={{ shrink: true }}
                        onClick={e => {
                          e.stopPropagation();
                          setFrequencyOpen(open => !open);
                        }}
                      />
                    )}
                  />
                </div>
              </ClickAwayListener>
              <ClickAwayListener onClickAway={() => setAssignUserOpen(false)}>
                <div>
                  <Autocomplete
                    freeSolo
                    disableClearable
                    options={(() => {
                      // Build options with userId to avoid displayName collision
                      const ownerOption = propertyOwnerDisplayName && propertyOwnerUserId 
                        ? { userId: propertyOwnerUserId, displayName: propertyOwnerDisplayName } 
                        : null;
                      const sharedOptions = sharedUsers.filter(u => u.userId !== propertyOwnerUserId);
                      return ownerOption ? [ownerOption, ...sharedOptions] : sharedOptions;
                    })()}
                    getOptionLabel={(option) => typeof option === 'string' ? option : option.displayName}
                    isOptionEqualToValue={(option, value) => {
                      if (typeof option === 'string' || typeof value === 'string') return option === value;
                      return option.userId === value.userId;
                    }}
                    value={(() => {
                      // Find the matching option object by userId for proper display
                      const assignedUserId = selectedTask.assigned_user_id;
                      if (assignedUserId) {
                        if (assignedUserId === propertyOwnerUserId) {
                          return { userId: propertyOwnerUserId, displayName: propertyOwnerDisplayName };
                        }
                        const sharedUser = sharedUsers.find(u => u.userId === assignedUserId);
                        if (sharedUser) return sharedUser;
                      }
                      // Fallback to property owner
                      return propertyOwnerDisplayName && propertyOwnerUserId 
                        ? { userId: propertyOwnerUserId, displayName: propertyOwnerDisplayName }
                        : selectedTask.assigned_user || '';
                    })()}
                    open={assignUserOpen}
                    onChange={(_, value) => {
                      // Use userId directly from selected option to avoid displayName collision
                      let newAssignedUserId = '';
                      let newAssignedUser = '';
                      if (typeof value === 'string') {
                        // FreeSolo typed value - fallback to displayName lookup
                        newAssignedUser = value;
                        newAssignedUserId = displayNameToUserIdMap[value] || '';
                      } else if (value && typeof value === 'object') {
                        // Selected from dropdown - use userId directly
                        newAssignedUser = value.displayName;
                        newAssignedUserId = value.userId;
                      }
                      const updatedTask = selectedTask ? { ...selectedTask, assigned_user: newAssignedUser, assigned_user_id: newAssignedUserId } : null;
                      setSelectedTask(updatedTask);
                      setAssignUserOpen(false);
                      if (updatedTask) {
                        debouncedAutoSave(updatedTask);
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Assign User"
                        variant="outlined"
                        size="small"
                        fullWidth
                        sx={{ mb: 2, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 15, minWidth: 180, background: '#fff' }}
                        InputLabelProps={{ shrink: true }}
                        onClick={e => {
                          e.stopPropagation();
                          setAssignUserOpen(open => !open);
                        }}
                      />
                    )}
                  />
                </div>
              </ClickAwayListener>
              <Box sx={{ borderBottom: '1px solid #E0E0E0', my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                <Button
                  variant="outlined"
                  color="error"
                  sx={{ 
                    background: '#fff',
                    color: '#222',
                    fontFamily: 'Nunito, Arial, sans-serif',
                    border: '1px solid #D1D5DB',
                    borderRadius: '9px',
                    fontWeight: 400,
                    boxShadow: 'none',
                    textTransform: 'none',
                    minWidth: 70,
                    height: 30,
                    fontSize: 15,
                    '&:hover': {
                      background: '#f5f5f5',
                      borderColor: '#B0B0B0',
                    }, }}
                  onClick={() => setRemoveModalOpen(true)}
                >
                  Delete
                </Button>
              </Box>
              {/* Remove/Delete Modal UI */}
              <Modal open={removeModalOpen} onClose={() => setRemoveModalOpen(false)}>
                <Box sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  bgcolor: '#fff',
                  borderRadius: 2,
                  boxShadow: 24,
                  p: { xs: 2, sm: 4 },
                  minWidth: 340,
                  maxWidth: '90vw',
                  outline: 'none',
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                    <Typography sx={{ fontWeight: 550, fontSize: { xs: 20, sm: 24 }, color: '#343748' }}>
                      How do you want to remove this task?
                    </Typography>
                    <IconButton onClick={() => setRemoveModalOpen(false)} size="small" sx={{ top: -20, right: -15,ml: 1 }}>
                      <CloseIcon fontSize="medium" />
                    </IconButton>
                  </Box>
                  <Typography sx={{ color: '#6B7280', fontSize: 15, mb: 2 }}>
                    Skip this time removes the task from the list till the next reoccurrence.<br />
                    Or Delete will permanently delete this task.
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mt: 2, mb: 1 }}>
                    <Button
                      variant="outlined"
                      sx={{
                        flex: 1,
                        bgcolor: '#fff',
                        border: '2px solid #d1d5db',
                        color: '#343748',
                        fontWeight: 550,
                        fontSize: 20,
                        borderRadius: 2,
                        px: 0,
                        py: 1,
                        '&:hover': { borderColor: '#89AE99', bgcolor: '#f5f5f5' },
                      }}
                      onClick={handleSkipTask}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 550, fontSize: 18, color: '#343748' }}>Skip this time</Typography>
                        <Typography sx={{ color: '#6B7280', fontSize: 12, fontWeight: 400 }}>Back next cycle</Typography>
                      </Box>
                    </Button>
                    <Button
                      variant="contained"
                      sx={{
                        flex: 1,
                        bgcolor: '#e57373',
                        color: '#fff',
                        fontWeight: 550,
                        fontSize: 20,
                        borderRadius: 2,
                        py: 1,
                        px: 0,
                        boxShadow: 'none',
                        '&:hover': { bgcolor: '#d32f2f' },
                      }}
                      onClick={handleDeleteTask}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 550, fontSize: 18, color: '#fff' }}>Delete task</Typography>
                        <Typography sx={{ color: '#fff', fontSize: 12, fontWeight: 400, opacity: 0.8 }}>Gone for good</Typography>
                      </Box>
                    </Button>
                  </Box>
                </Box>
              </Modal>
            </>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', p: 0 }}>
              {/* Inner box with border */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '1.5px solid #E5E7EB',
                borderRadius: 3,
                py: 6,
                px: 4,
                width: '100%',
                mb: 3
              }}>
                {/* Document icon - no background, just the icon */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  mb: 2
                }}>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#C4C4C4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2V8H20" stroke="#C4C4C4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Box>
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 700, fontSize: 20, color: '#343748', mb: 1.5 }}>
                  Select task to display info
                </Typography>
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 16, color: '#9CA3AF', mb: 4, textAlign: 'center' }}>
                  Select a task or add a task to display here.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<span style={{ fontSize: 18, fontWeight: 400 }}>+</span>}
                  onClick={() => setAddTaskOpen(true)}
                  sx={{
                    bgcolor: '#89AE99',
                    color: '#fff',
                    fontFamily: 'Nunito, Arial, sans-serif',
                    fontWeight: 600,
                    fontSize: 15,
                    borderRadius: 2.5,
                    px: 4,
                    py: 1.2,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#7a9e8a' },
                  }}
                >
                  Add Task
                </Button>
              </Box>
              {/* Disabled form fields placeholder */}
              <Box sx={{ width: '100%' }}>
                {/* Title */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#9CA3AF', fontWeight: 400, fontSize: 14 }}>Title</Typography>
                  <EditIcon sx={{ color: '#E0E0E0', fontSize: 18 }} />
                </Box>
                <Divider sx={{ mb: 2 }} />
                {/* Description */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#9CA3AF', fontWeight: 400, fontSize: 14 }}>Description:</Typography>
                    <EditIcon sx={{ color: '#E0E0E0', fontSize: 18 }} />
                  </Box>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#D1D5DB', fontWeight: 400, fontSize: 14, mt: 0.5 }}>Task Description.</Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                {/* Start Date */}
                <TextField
                  label="Start Date"
                  disabled
                  fullWidth
                  size="small"
                  sx={{ mb: 2, '& .MuiInputBase-root': { bgcolor: '#F9FAFB' } }}
                  InputProps={{
                    endAdornment: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="4" width="18" height="18" rx="2" stroke="#D1D5DB" strokeWidth="2"/>
                        <path d="M16 2V6M8 2V6M3 10H21" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    ),
                  }}
                />
                {/* Due Date */}
                <TextField
                  label="Due Date"
                  disabled
                  fullWidth
                  size="small"
                  sx={{ mb: 2, '& .MuiInputBase-root': { bgcolor: '#F9FAFB' } }}
                  InputProps={{
                    endAdornment: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="4" width="18" height="18" rx="2" stroke="#D1D5DB" strokeWidth="2"/>
                        <path d="M16 2V6M8 2V6M3 10H21" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    ),
                  }}
                />
                {/* Frequency */}
                <TextField
                  label="Frequency"
                  disabled
                  fullWidth
                  size="small"
                  sx={{ mb: 2, '& .MuiInputBase-root': { bgcolor: '#F9FAFB' } }}
                />
                {/* Assign User */}
                <TextField
                  label="Assign User"
                  disabled
                  fullWidth
                  size="small"
                  sx={{ mb: 3, '& .MuiInputBase-root': { bgcolor: '#F9FAFB' } }}
                />
                {/* Delete button */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#D1D5DB', fontWeight: 400, fontSize: 14 }}>Delete</Typography>
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
      {/* Uncheck confirmation modal */}
      <Modal open={uncheckModalOpen} onClose={handleCancelUncheck} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ bgcolor: '#fff',  borderRadius: 2, p: 3, minWidth: 420, maxWidth: '90vw', outline: 'none', boxShadow: 6 }}>
          <Typography variant="h6" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 3, color: '#343748' }}>Uncheck Task</Typography>
          <Box sx={{ bgcolor: '#F6A94A', color: '#222',  borderRadius: 2, p: 2, mb: 3, fontSize: 18, fontWeight: 400 }}>
            Are you sure you want to uncheck this task?
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>        
            <Button onClick={handleCancelUncheck} variant="outlined" sx={{ fontFamily: 'Nunito, Arial, sans-serif', bgcolor: '#fff', color: '#343748', borderRadius: 2, px: 3, fontWeight: 400, fontSize: 14, border: '1.5px solid #B0B0B0', boxShadow: 'none', textTransform: 'none', '&:hover': { borderColor: '#B0B0B0', bgcolor: '#f5f5f5' } }}>Cancel</Button>
            <Button onClick={handleConfirmUncheck} variant="contained" sx={{  bgcolor: "#89AE99", color: "#fff", borderRadius: 2, px: 4, fontWeight: 550, fontSize: 14, boxShadow: 'none', textTransform: 'none' }}>Yes</Button>
          </Box>
        </Box>
      </Modal>
    </Box>
    </>
  );
};

export default Tasks;

