import React, { useEffect, useState, useMemo } from "react";
import "react-datepicker/dist/react-datepicker.css";
import {
  Box,
  Typography,
  Button,
  Avatar,
  Skeleton,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  MenuItem,
  IconButton,
  Autocomplete
} from "@mui/material";
import { getAuth } from "firebase/auth";
import { collection, getDocs, query, where, doc, getDoc, onSnapshot, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';


// Use the same color system as Tasks page for property types
const tabColors = [
  '#e6f4ea', // green card bg
  '#e6ecf9', // blue card bg
  '#fff3e6', // yellow card bg
  '#fdeaea', // red card bg
];

// Helper: get consistent color index for a property name
function getPropertyColorIdx(propertyName: string, propertyNames: string[]) {
  // Use the same logic as Tasks page: index in propertyNames array, fallback to 0
  const idx = propertyNames.findIndex(name => name === propertyName);
  return idx >= 0 ? idx % tabColors.length : 0;
}

// Utility: darken a hex color by a given amount
function darkenColor(hex: string, amount = 0.18) {
  hex = hex.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  r = Math.max(0, Math.floor(r * (1 - amount)));
  g = Math.max(0, Math.floor(g * (1 - amount)));
  b = Math.max(0, Math.floor(b * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Helper: check if task date range overlaps with the selected month
function taskOverlapsMonth(task: { startDate?: string; dueDate?: string }, year: number, month: number): boolean {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
  
  let taskStart = task.startDate ? new Date(task.startDate + 'T00:00:00') : null;
  let taskEnd = task.dueDate ? new Date(task.dueDate + 'T00:00:00') : null;
  
  if (!taskStart && !taskEnd) return false;
  
  if (!taskStart) taskStart = taskEnd;
  if (!taskEnd) taskEnd = taskStart;
  
  if (!taskStart || !taskEnd) return false;
  return taskStart <= monthEnd && taskEnd >= monthStart;
}

// Extracted style constants to avoid recreating on each render
const iconButtonStyle = {
  color: '#fff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
  borderRadius: '50%',
  p: 1,
  mr: 1,
  transition: 'box-shadow 0.2s',
  '&:active': { boxShadow: '0 2px 8px rgba(0,0,0,0.13)' },
  '&:focus': { boxShadow: '0 2px 8px rgba(0,0,0,0.13)' },
  '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.18)' },
} as const;

const cancelButtonStyle = {
  fontSize: 15,
  fontFamily: 'Nunito, Arial, sans-serif',
  fontWeight: 400,
  textTransform: 'none',
  '&:hover': { border: '1px solid #ccc', background: '#F5F6F8' },
  border: '1px solid #ccc',
  bgcolor: '#fff',
  color: '#222',
  px: 3.5,
  py: 1,
  borderRadius: 2,
  minWidth: 110,
} as const;

const saveButtonStyle = {
  fontSize: 15,
  fontFamily: 'Nunito, Arial, sans-serif',
  borderRadius: 2,
  minWidth: 110,
  background: '#89AE99',
  textTransform: 'none',
  fontWeight: 400,
  boxShadow: 'none',
} as const;

interface CalendarProps {
  sidebar?: boolean;
}

const Calendar: React.FC<CalendarProps> = ({ sidebar }) => {
  // Calendar date selection for new task creation
  const [calendarSelectedStart, setCalendarSelectedStart] = useState<string | null>(null);
  const [calendarSelectedEnd, setCalendarSelectedEnd] = useState<string | null>(null);
  // Helper to reset calendar date selection
  const resetCalendarDateSelection = () => {
    setCalendarSelectedStart(null);
    setCalendarSelectedEnd(null);
  };
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  // For MUI DatePicker
  // Add Task modal state and fields (copied from Tasks page)
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    name: '',
    type: '',
    description: '',
    startDate: '',
    dueDate: '',
    recurrency: { frequency: 'None', interval: '1' },
    property: '',
    assigned_user: '',
  });
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string>('');
  const [ownedPropertyUserDisplayNames, setOwnedPropertyUserDisplayNames] = useState<string[]>([]);
  const [displayNameToUserIdMap, setDisplayNameToUserIdMap] = useState<{ [displayName: string]: string }>({});

  // Get current user once for all hooks (moved up before usage in handleSaveTask)
  const auth = getAuth();
  const user = auth.currentUser;

  // Update newTask assigned_user when currentUserDisplayName is loaded
  useEffect(() => {
    if (currentUserDisplayName && newTask.assigned_user === '') {
      setNewTask(t => ({ ...t, assigned_user: currentUserDisplayName }));
    }
  }, [currentUserDisplayName]);

  // Validate and save new task to Firebase
  const validateTaskFields = (task: typeof newTask): { [key: string]: string } => {
    const newErrors: { [key: string]: string } = {};
    if (!task.name) newErrors.name = 'This is required field';
    if (!task.type) newErrors.type = 'This is required field';
    if (!task.startDate) newErrors.startDate = 'This is required field';
    if (!task.dueDate) newErrors.dueDate = 'This is required field';
    if (!task.property) newErrors.property = 'This is required field';
    return newErrors;
  };

const [savingTask, setSavingTask] = useState(false);

const handleSaveTask = async () => {
  const validation = validateTaskFields(newTask);
  setErrors(validation);
  if (Object.keys(validation).length > 0) return;
  if (savingTask) return; // Prevent double creation
  setSavingTask(true);
  // Use component-level user instead of calling getAuth() again
  if (!user) {
    setSavingTask(false);
    return;
  }
  // Use selectedTab for propertyId, handle shared/custom tab names
  let propertyId = '';
  if (newTask.property && propertyMap[newTask.property]) {
    propertyId = propertyMap[newTask.property];
  } else if (selectedTab !== propertyNames[0] && propertyMap[selectedTab]) {
    propertyId = propertyMap[selectedTab];
  }
  // Get userId for assigned user
  const assignedUserId = displayNameToUserIdMap[newTask.assigned_user] || '';
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
    await addDoc(collection(db, "tasks"), taskDoc);
    setAddTaskOpen(false);
    setNewTask({
      name: '',
      type: '',
      description: '',
      startDate: '',
      dueDate: '',
      recurrency: { frequency: 'None', interval: '' },
      property: '',
      assigned_user: '',
    });
  } catch (err) {
    console.error('Error adding task:', err);
  }
  setSavingTask(false);
};

  const [propertyNames, setPropertyNames] = useState<string[]>(["All Properties"]);
  const [propertyMap, setPropertyMap] = useState<{ [name: string]: string }>({});
  const [cachedProperties, setCachedProperties] = useState<{ id: string; data: any }[]>([]);
  const [cachedUsers, setCachedUsers] = useState<any[]>([]);

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

  useEffect(() => {
    if (selectedTab) {
      sessionStorage.setItem('appTab', selectedTab);
    }
  }, [selectedTab]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  // Track selected task's startDate and dueDate for calendar highlight
  const [selectedTaskStartDate, setSelectedTaskStartDate] = useState<Date | null>(null);
  const [selectedTaskDueDate, setSelectedTaskDueDate] = useState<Date | null>(null);

  useEffect(() => {
    async function fetchPropertyTypes() {
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

      // Fetch all properties, then filter for owned/shared
      const allPropsSnap = await getDocs(collection(db, "properties"));
      // Cache properties for reuse in tasks useEffect
      const propertiesArr = allPropsSnap.docs.map(docSnap => ({ id: docSnap.id, data: docSnap.data() }));
      setCachedProperties(propertiesArr);
      let propNames: string[] = ["All Properties"];
      const propMap: { [name: string]: string } = {};
      const otherTypes: string[] = [];
      let ourHomeId = "";
      propertiesArr.forEach(({ id, data }) => {
        const isOwner = data.ownerId === user.uid;
        let tabName = data.type;
        if (Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === user.uid)) {
          // Use alias for shared property
          const entry = data.sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === user.uid);
          if (entry && typeof entry === 'object' && entry.alias) {
            tabName = entry.alias;
          }
        }
        if ((isOwner || (Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === user.uid))) && tabName && id) {
          if (tabName === "Our Home") {
            ourHomeId = id;
          } else {
            otherTypes.push(tabName);
          }
          propMap[tabName] = id;
        }
      });
      if (ourHomeId) {
        propNames.push("Our Home");
      }
      propNames = propNames.concat(otherTypes);
      setPropertyNames(propNames);
      setPropertyMap(propMap);

      // Fetch users from owned properties only (for Add Task modal)
      const ownedPropertyUserIds = new Set<string>();
      ownedPropertyUserIds.add(user.uid); // Always include current user

      propertiesArr.forEach(({ data }) => {
        const isOwner = data.ownerId === user.uid;
        
        if (isOwner) {
          // For owned properties, add all shared users
          if (Array.isArray(data.sharedWith)) {
            data.sharedWith.forEach((sw: any) => {
              if (sw.userId) {
                ownedPropertyUserIds.add(sw.userId);
              }
            });
          }
        }
      });

      // Fetch display names and build userId map for owned property users
      const ownedDisplayNames: string[] = [];
      const displayNameToUserId: { [displayName: string]: string } = {};
      const ownedUserPromises = Array.from(ownedPropertyUserIds).map(async (userId) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.displayName) {
              return { displayName: data.displayName, oderId: userId };
            }
          }
        } catch (e) {
          // Ignore error
        }
        return null;
      });
      
      const ownedUsers = await Promise.all(ownedUserPromises);
      ownedUsers.forEach(user => {
        if (user) {
          ownedDisplayNames.push(user.displayName);
          displayNameToUserId[user.displayName] = user.oderId;
        }
      });
      
      setOwnedPropertyUserDisplayNames(ownedDisplayNames);
      setDisplayNameToUserIdMap(displayNameToUserId);

      // Fetch and cache ALL users once for task assignment lookups
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers: any[] = [];
      usersSnap.forEach(docSnap => {
        if (docSnap.exists()) allUsers.push(docSnap.data());
      });
      setCachedUsers(allUsers);
    }
    fetchPropertyTypes();
  }, []);

  useEffect(() => {
    if (cachedProperties.length === 0) return;
    if (cachedUsers.length === 0) return;
    if (!user) return;
    setLoading(true);
    
    // Use cached properties instead of fetching again
    const propertyIds: string[] = [];
    const propertyDataMap: { [id: string]: any } = {};
    cachedProperties.forEach(({ id, data }) => {
      const isOwner = data.ownerId === user.uid;
      const isShared = Array.isArray(data.sharedWith) && data.sharedWith.some((sw: any) => sw.userId === user.uid);
      if ((isOwner || isShared) && id) {
        propertyIds.push(id);
        propertyDataMap[id] = data;
      }
    });
    
    if (propertyIds.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }
    
    // Chunk propertyIds for Firestore "in" query limit (max 10)
    const chunks: string[][] = [];
    for (let i = 0; i < propertyIds.length; i += 10) {
      chunks.push(propertyIds.slice(i, i + 10));
    }
    
    // Set up listeners for each chunk
    const unsubscribers: (() => void)[] = [];
    const tasksByChunk: Map<number, any[]> = new Map();
    
    chunks.forEach((chunk, chunkIdx) => {
      const tasksQ = query(collection(db, "tasks"), where("propertyId", "in", chunk));
      const unsub = onSnapshot(tasksQ, (snapshot) => {
        const docs = snapshot.docs;
        // Use cached users instead of fetching on every snapshot
        const usersList = cachedUsers;
        
        const chunkTasks: any[] = [];
        for (const docSnap of docs) {
          const data = docSnap.data();
          // Get property type or alias for shared property
          let propertyType = "";
          if (data.propertyId && propertyDataMap[data.propertyId]) {
            const prop = propertyDataMap[data.propertyId];
            if (Array.isArray(prop.sharedWith) && user && prop.sharedWith.some((sw: any) => sw.userId === user.uid && sw.alias)) {
              const entry = prop.sharedWith.find((sw: any) => sw.userId === user.uid && sw.alias);
              propertyType = entry.alias;
            } else {
              propertyType = prop.type || "";
            }
          }
          // Find user by assigned_user_id first, then fallback to displayName (assigned_user), or default to property owner
          let avatar = "/avatar.png";
          let assignedUserName = "Unassigned";
          
          if (data.assigned_user_id) {
            const foundUser = usersList.find(u => u.uid === data.assigned_user_id);
            if (foundUser) {
              if (foundUser.photoURL) avatar = foundUser.photoURL;
              if (foundUser.displayName) assignedUserName = foundUser.displayName;
            }
          } else if (data.assigned_user) {
            const foundUser = usersList.find(u => u.displayName === data.assigned_user);
            if (foundUser) {
              if (foundUser.photoURL) avatar = foundUser.photoURL;
              if (foundUser.displayName) assignedUserName = foundUser.displayName;
            }
          } else if (data.propertyId && propertyDataMap[data.propertyId]) {
            const prop = propertyDataMap[data.propertyId];
            if (prop.ownerId) {
              const ownerUser = usersList.find(u => u.uid === prop.ownerId);
              if (ownerUser) {
                if (ownerUser.photoURL) avatar = ownerUser.photoURL;
                if (ownerUser.displayName) assignedUserName = ownerUser.displayName;
              }
            }
          }
          chunkTasks.push({
            ...data,
            id: docSnap.id,
            propertyType,
            avatar,
            assignedUserName,
          });
        }
        
        tasksByChunk.set(chunkIdx, chunkTasks);
        // Merge all chunks and update state
        const allTasks: any[] = [];
        tasksByChunk.forEach(tasks => allTasks.push(...tasks));
        setTasks(allTasks);
        setLoading(false);
      });
      unsubscribers.push(unsub);
    });
    
    // Cleanup: unsubscribe all listeners on unmount
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [cachedProperties, cachedUsers]);

  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());

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

  // Precompute Set of date strings (YYYY-MM-DD) that have tasks - O(n) once instead of O(n×42) per render
  const taskDateSet = useMemo(() => {
    const dateSet = new Set<string>();
    tasks.forEach((task: any) => {
      if (task.dueDate) dateSet.add(task.dueDate);
      if (task.startDate) dateSet.add(task.startDate);
    });
    return dateSet;
  }, [tasks]);

  // Monthly view: show all tasks (including completed) for the selected month, sorted by dueDate
  const selectedYear = calendarYear;
  const selectedMonth = calendarMonth;

  // Memoized filtered tasks to avoid recalculating on every render
  const filteredTasks = useMemo(() => {
    if (showAllTasks) {
      // Show all tasks for current tab, ignore month filter
      if (selectedTab === propertyNames[0]) {
        return sortByDueDate(tasks);
      } else {
        const selectedPropertyId = propertyMap[selectedTab];
        return sortByDueDate(tasks.filter((task: any) => task.propertyId === selectedPropertyId));
      }
    } else {
      // Monthly filter: show tasks that overlap with selected month
      if (selectedTab === propertyNames[0]) {
        return sortByDueDate(tasks.filter((task: any) => 
          taskOverlapsMonth(task, selectedYear, selectedMonth)
        ));
      } else {
        const selectedPropertyId = propertyMap[selectedTab];
        return sortByDueDate(tasks.filter((task: any) => 
          task.propertyId === selectedPropertyId && taskOverlapsMonth(task, selectedYear, selectedMonth)
        ));
      }
    }
  }, [tasks, showAllTasks, selectedTab, propertyNames, propertyMap, selectedYear, selectedMonth]);

  // Remove auto-select: user must click to select a task
  return (
    <Box sx={{ bgcolor: "#F9F9F9", height: "100vh", p: 3, width: sidebar ? 'calc(100vw - 75px)' : 'calc(100vw - 18vw)', ml: sidebar ? '75px' : '18vw', overflow: "hidden", overflowX: 'hidden', display: "flex", flexDirection: "column" }}>
      {/* Top Tabs Row */}
    <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 550, color: '#222', fontSize: 18, fontFamily: 'Nunito, Arial, sans-serif' }}>Calendar</Typography>     
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
        {propertyNames.map((type) => (
          <Box
            key={type}
            onClick={() => setSelectedTab(type)}
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
                color: type === selectedTab ? '#89AE99' : 'gray',
                ":hover": {
                  color: selectedTab === type ? '#89AE99' : '#000'
                },
                "::selection": {
                  color: '#89AE99'
                },
                // Custom indicator
                ...(type === selectedTab ? {
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
            {type}
          </Box>
        ))}
      </Box>
      <Box sx={{ flexGrow: 1 }} />
      <Button
        variant="contained"
        sx={{
          bgcolor: "#89AE99",
          color: "#fff",
          fontFamily: 'Nunito, Arial, sans-serif',
          borderRadius: 2,
          textTransform: "none",
          fontSize: 16,
          fontWeight: 400,
          ml: 2,
        }}
        onClick={() => {
          // Prefill modal with selected calendar dates and property tab
          setNewTask(t => ({
            ...t,
            startDate: calendarSelectedStart || '',
            dueDate: calendarSelectedEnd || '',
            property: selectedTab !== propertyNames[0] ? selectedTab : '',
          }));
          setAddTaskOpen(true);
        }}
      >
        + Create Task
      </Button>
    </Box>
      {/* Main content area */}
      <Dialog open={addTaskOpen} onClose={() => setAddTaskOpen(false)} fullWidth PaperProps={{ sx: { borderRadius: 2, p: 2 } }}>
        <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', minWidth: 400, fontWeight: 550, fontSize: 22, pb: 1 }}>Add Task</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {errors.general && (
              <Typography color="error" sx={{ mb: 1, fontWeight: 600 }}>
                {errors.general}
              </Typography>
            )}
            <TextField
              label="Task Name"
              value={newTask.name}
              onChange={e => setNewTask(t => ({ ...t, name: e.target.value }))}
              fullWidth
              size="medium"
              sx={{ background: '#fff' }}
              required
              error={!!errors.name}
              helperText={errors.name || ''}
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
              helperText={errors.type || ''}
            />
            <TextField
              label="Description (optional)"
              value={newTask.description}
              onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))}
              fullWidth
              size="medium"
              sx={{ background: '#fff' }}
              error={!!errors.description}
              helperText={errors.description || ''}
            />
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <DatePicker
                  label="Start Date"
                  value={newTask.startDate ? new Date(newTask.startDate + 'T00:00:00') : null}
                  maxDate={newTask.dueDate ? new Date(newTask.dueDate + 'T00:00:00') : undefined}
                  onChange={date => {
                    const newStart = date ? date.toISOString().slice(0, 10) : '';
                    setNewTask(t => {
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
                      helperText: errors.startDate || '',
                    },
                  }}
                />
                <DatePicker
                  label="Due Date"
                  value={newTask.dueDate ? new Date(newTask.dueDate + 'T00:00:00') : null}
                  minDate={newTask.startDate ? new Date(newTask.startDate + 'T00:00:00') : undefined}
                  onChange={date => setNewTask(t => ({ ...t, dueDate: date ? date.toISOString().slice(0, 10) : '' }))}
                  slotProps={{
                    textField: {
                      variant: "outlined",
                      fullWidth: true,
                      size: "medium",
                      sx: { background: '#fff' },
                      error: !!errors.dueDate,
                      helperText: errors.dueDate || '',
                    },
                  }}
                />
              </Box>
            </LocalizationProvider>
            <TextField
              select
              label="Recurrency Frequency"
              value={newTask.recurrency?.frequency || 'None'}
              onChange={e => setNewTask(t => ({ ...t, recurrency: { ...t.recurrency, frequency: e.target.value } }))}
              fullWidth
              size="medium"
              sx={{ background: '#fff' }}
            >
              <MenuItem value="None">None</MenuItem>
              <MenuItem value="Weekly">Weekly</MenuItem>
              <MenuItem value="Quarterly">Quarterly</MenuItem>
              <MenuItem value="Monthly">Monthly</MenuItem>
              <MenuItem value="Yearly">Yearly</MenuItem>
            </TextField>
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
              helperText={errors.property || ''}
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
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
              <Button variant="outlined" sx={cancelButtonStyle} onClick={() => setAddTaskOpen(false)}>
                Cancel
              </Button>
              <Button variant="contained" sx={saveButtonStyle} onClick={handleSaveTask}>
                Save
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
      <Box sx={{ display: "flex", gap: 3, flex: 1, minHeight: 0 }}>
        {/* Left: Task List */}
        <Box sx={{
          flex: 2,
          overflowY: 'auto',
          overflowX: 'visible', // allow box-shadow and border to show fully
          maxHeight: '91vh',
          minHeight: '91vh',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, mr: 0.5 }}>
            <Typography variant="subtitle1" sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', fontWeight: 550, fontSize: 20, ml: 2 }}>
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
              label={<span style={{ color: '#222', fontWeight: 600 }}>Show all tasks</span>}
              sx={{ ml: 1, userSelect: 'none', mr: 3 }}
            />
          </Box>
          <Box sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.125,
            pr: 1,
            pt: 1,
            pb: 3,
          }}>
            {loading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f5f5f5', borderRadius: 2, p: 2, mx: 2.2, border: '2px solid #e0e0e0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width={120} height={28} sx={{ mb: 1, borderRadius: 1 }} />
                    <Skeleton variant="text" width="80%" height={18} sx={{ mb: 0.5, borderRadius: 1 }} />
                    <Skeleton variant="text" width={90} height={14} sx={{ borderRadius: 1 }} />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <Skeleton variant="text" width={40} height={14} sx={{ mb: 1, borderRadius: 1 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Skeleton variant="circular" width={24} height={24} />
                      <Skeleton variant="text" width={60} height={18} />
                    </Box>
                  </Box>
                </Box>
              ))
            ) : (
              (Array.isArray(filteredTasks) ? filteredTasks : []).map((task: any) => {
                const tabIdx = getPropertyColorIdx(task.propertyType, propertyNames);
                const isSelected = selectedTaskId === task.id;
                const isHovered = hoveredTaskId === task.id;
                const showHoverEffect = !selectedTaskId && isHovered;
                return (
                  <Box
                    key={task.id}
                    sx={{
                      bgcolor: tabColors[tabIdx],
                       borderRadius: 2,
                      p: 2,
                      display: "flex",
                      mx: 2.2,
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      border: `2px solid ${darkenColor(tabColors[tabIdx])}`,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                      // Use CSS media query based scaling instead of window.innerWidth
                      transform: isSelected 
                        ? { xs: 'scale(1.035)', lg: 'scale(1.025)' }
                        : showHoverEffect 
                          ? { xs: 'scale(1.02)', lg: 'scale(1.015)' }
                          : 'none',
                      transformOrigin: 'center center',
                      transition: 'box-shadow 0.4s, border 0.25s, transform 0.48s',
                      zIndex: isSelected ? 2 : showHoverEffect ? 1.5 : 1,
                    }}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    onClick={() => {
                      // Reset calendar date selection for modal prefill
                      resetCalendarDateSelection();
                      if (isSelected) {
                        setSelectedTaskId(null);
                        setSelectedTaskStartDate(null);
                        setSelectedTaskDueDate(null);
                      } else {
                        setSelectedTaskId(task.id);
                        
                        // Parse startDate
                        if (task.startDate) {
                          const [sy, sm, sd] = task.startDate.split("-").map(Number);
                          setSelectedTaskStartDate(new Date(sy, sm - 1, sd));
                        } else {
                          setSelectedTaskStartDate(null);
                        }
                        
                        // Parse dueDate
                        if (task.dueDate) {
                          const [ey, em, ed] = task.dueDate.split("-").map(Number);
                          setSelectedTaskDueDate(new Date(ey, em - 1, ed));
                        } else {
                          setSelectedTaskDueDate(null);
                        }
                        
                        // Don't auto-navigate calendar - keep user on current month view
                        // Task highlights will only show if dates are visible in current month
                      }
                    }}
                  >
                    <Box>
                      <Typography variant="h6" sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: "#343748", fontWeight: 550 }}>
                        {task.title}
                      </Typography>
                      <Box sx={{ width: '100%', maxWidth: '40vw', overflow: 'hidden' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "#343748",
                            mb: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '100%',
                            maxWidth: '100%',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            fontFamily: 'Nunito, Arial, sans-serif',
                            WebkitBoxOrient: 'vertical',
                            whiteSpace: 'normal',
                          }}
                          title={task.description}
                        >
                          {task.description}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: "#343748" }}>
                        Property: {task.propertyType}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                      <Typography variant="caption" sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: "#343748", fontWeight: 400 }}>
                        {task.duration || ""}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Avatar src={task.avatar || "/avatar.png"} sx={{ width: 24, height: 24 }} />
                        <Typography variant="body2" sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: "#343748", fontWeight: 400 }}>
                          {task.assignedUserName || ""}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>

        {/* Right: Calendar */}
        <Box
          sx={{
            flex: 1,
            bgcolor: "#fff",
             borderRadius: 2,
            p: 3,
            boxShadow: 1,
            minWidth: 340,
            height: "fit-content",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
            <IconButton
              sx={iconButtonStyle}
              onClick={() => {
                // Previous month logic: update both month and year together
                if (calendarMonth === 0) {
                  setCalendarMonth(11);
                  setCalendarYear(calendarYear - 1);
                } else {
                  setCalendarMonth(calendarMonth - 1);
                }
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#212121" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </IconButton>
            <Typography variant="h6" sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: "#343748", fontWeight: 550 }}>
              {new Date(calendarYear, calendarMonth).toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}
            </Typography>
            <IconButton
              sx={iconButtonStyle}
              onClick={() => {
                // Next month logic: update both month and year together
                if (calendarMonth === 11) {
                  setCalendarMonth(0);
                  setCalendarYear(calendarYear + 1);
                } else {
                  setCalendarMonth(calendarMonth + 1);
                }
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6l6 6-6 6" stroke="#212121" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </IconButton>
          </Box>

          {/* Days of week */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, mb: 1 }}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <Typography key={day} variant="caption" sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: "#343748", textAlign: "center", fontWeight: 550, fontSize: 14 }}>
                {day}
              </Typography>
            ))}
          </Box>

          {/* Calendar dates */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
            {(() => {
              const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
              const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
              const grid: (number | "")[] = [];
              for (let i = 0; i < firstDay; i++) grid.push("");
              for (let d = 1; d <= daysInMonth; d++) grid.push(d);
              while (grid.length % 7 !== 0) grid.push("");
              return grid.map((date, idx) => {
                if (typeof date !== "number") return <Box key={idx} />;
                // Normalize all dates to midnight for accurate comparison
                const cellDate = new Date(calendarYear, calendarMonth, date);
                cellDate.setHours(0, 0, 0, 0);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const isToday = cellDate.getTime() === now.getTime();
                // Highlight: only start/end are green, in-between are gray
                let isMarked = false;
                let isRangeGray = false;
                // Calendar date selection highlight
                if (calendarSelectedStart && !calendarSelectedEnd) {
                  // Only startDate selected: mark it
                  const start = new Date(calendarSelectedStart + 'T00:00:00');
                  start.setHours(0, 0, 0, 0);
                  if (cellDate.getTime() === start.getTime()) {
                    isMarked = true;
                  }
                } else if (calendarSelectedStart && calendarSelectedEnd) {
                  const start = new Date(calendarSelectedStart + 'T00:00:00');
                  const end = new Date(calendarSelectedEnd + 'T00:00:00');
                  start.setHours(0, 0, 0, 0);
                  end.setHours(0, 0, 0, 0);
                  if (cellDate.getTime() === start.getTime() || cellDate.getTime() === end.getTime()) {
                    isMarked = true;
                  } else if (cellDate.getTime() > start.getTime() && cellDate.getTime() < end.getTime()) {
                    isRangeGray = true;
                  }
                }
                // Existing selectedTask highlight (for viewing)
                if (!calendarSelectedStart && !calendarSelectedEnd && selectedTaskStartDate && selectedTaskDueDate) {
                  const start = new Date(selectedTaskStartDate.getFullYear(), selectedTaskStartDate.getMonth(), selectedTaskStartDate.getDate());
                  start.setHours(0, 0, 0, 0);
                  const end = new Date(selectedTaskDueDate.getFullYear(), selectedTaskDueDate.getMonth(), selectedTaskDueDate.getDate());
                  end.setHours(0, 0, 0, 0);
                  if (cellDate.getTime() === start.getTime() || cellDate.getTime() === end.getTime()) {
                    isMarked = true;
                  } else if (cellDate.getTime() > start.getTime() && cellDate.getTime() < end.getTime()) {
                    isRangeGray = true;
                  }
                }
                // Mark all dates with a dot if any task has a date (startDate or dueDate) on this day
                // O(1) lookup using precomputed Set instead of O(n) loop
                const cellDateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                const hasTaskDue = taskDateSet.has(cellDateStr);
                // Determine correct color for today if it overlaps with selection
                let cellBg = undefined;
                let cellBorder = undefined;
                let cellColor = '#343748';
                if (isMarked) {
                  cellBg = '#89AE99';
                  cellBorder = '3px solid #89AE99';
                  cellColor = '#fff';
                } else if (isRangeGray) {
                  cellBg = '#F3F4F6';
                } else if (isToday) {
                  cellBg = '#E5B26B';
                  cellBorder = '3px solid #E5B26B';
                  cellColor = '#fff';
                }
                // Calendar date click logic
                const handleCalendarDateClick = () => {
                  const clickedDateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                  if (!calendarSelectedStart) {
                    setCalendarSelectedStart(clickedDateStr);
                    setCalendarSelectedEnd(clickedDateStr);
                  } else if (!calendarSelectedEnd || calendarSelectedStart === calendarSelectedEnd) {
                    // Only allow dueDate after startDate
                    if (new Date(clickedDateStr) > new Date(calendarSelectedStart)) {
                      setCalendarSelectedEnd(clickedDateStr);
                    } else {
                      // If clicked before start, reset selection
                      setCalendarSelectedStart(clickedDateStr);
                      setCalendarSelectedEnd(clickedDateStr);
                    }
                  } else {
                    // If both are set, any other click resets
                    resetCalendarDateSelection();
                    setCalendarSelectedStart(clickedDateStr);
                    setCalendarSelectedEnd(clickedDateStr);
                  }
                };
                return (
                  <Box
                    key={idx}
                    sx={{
                      bgcolor: cellBg,
                      color: cellColor,
                      borderRadius: 2,
                      width: '100%',
                      height: { xs: '36px', sm: '40px', md: '48px', lg: '56px' },
                      minWidth: '32px',
                      minHeight: '32px',
                      maxWidth: '64px',
                      maxHeight: '64px',
                      mt: 0.5,
                      mb: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 400,
                      mx: 'auto',
                      cursor: 'pointer',
                      border: cellBorder,
                      position: 'relative',
                      boxShadow: isMarked ? '0 2px 8px rgba(123,170,152,0.10)' : undefined,
                      transition: 'background 0.18s, border 0.18s',
                      fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem', lg: '1.3rem' },
                    }}
                    onClick={handleCalendarDateClick}
                  >
                    {typeof date === "number" ? date : ""}
                    {hasTaskDue && (
                      <span style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: 6,
                        transform: 'translateX(-50%)',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: '#89AE99',
                        display: 'block',
                      }} />
                    )}
                  </Box>
                );
              });
            })()}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
export default Calendar;

