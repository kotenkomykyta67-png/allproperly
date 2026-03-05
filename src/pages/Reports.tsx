import React, { useState, useMemo } from "react";
import { Box, Typography, TextField, Button, Avatar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, InputAdornment, Skeleton, Tooltip } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import { getAuth } from "firebase/auth";
import { db } from "../services/firebase";
import { getDocs, collection, query, where, doc, getDoc } from "firebase/firestore";
// import FilterPropertyModal from '../components/FilterPropertyModal';

interface ReportsProps {
  sidebar?: boolean;
}

const Reports: React.FC<ReportsProps> = ({ sidebar }) => {
        const [thisMonthActive, setThisMonthActive] = useState(false);
      const [searchValue, setSearchValue] = useState("");
    const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number | null>(null);
  const [propertyTypes, setPropertyTypes] = React.useState<string[]>([]);
  const [selectedTab, setSelectedTab] = React.useState<string>(() => {
    const saved = sessionStorage.getItem('appTab');
    return saved || '';
  });
  const [completedTasks, setCompletedTasks] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  // const [showFilterModal, setShowFilterModal] = useState(false);
  const [sharedMembers, setSharedMembers] = useState<any[]>([]); // [{uid, displayName, photoURL}]

  // Memoized filtered rows - computed once per render instead of 5 times
  const filteredRows = useMemo(() => {
    return completedTasks.filter(row => {
      const tabMatch = selectedTab === 'All Properties' || row.propertyType === selectedTab;
      let photoMatch = true;
      if (selectedPhotoIdx !== null) {
        const member = sharedMembers[selectedPhotoIdx as number];
        photoMatch = member && member.displayName ? row.completedBy === member.displayName : true;
      }
      let searchMatch = true;
      if (searchValue.trim()) {
        searchMatch = row.title && row.title.toLowerCase().includes(searchValue.trim().toLowerCase());
      }
      let monthMatch = true;
      if (thisMonthActive && row.completedDate) {
        const date = new Date(row.completedDate);
        const now = new Date();
        monthMatch = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      return tabMatch && photoMatch && searchMatch && monthMatch;
    });
  }, [completedTasks, selectedTab, selectedPhotoIdx, sharedMembers, searchValue, thisMonthActive]);

  const isFilteredEmpty = filteredRows.length === 0;
  const svgStrokeColor = isFilteredEmpty ? '#BDBDBD' : '#1F1F1F';

  React.useEffect(() => {
    async function fetchAllData() {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      setLoading(true);

      // === FETCH PROPERTIES ONCE ===
      const allPropsSnap = await getDocs(collection(db, "properties"));
      const propertiesArr = allPropsSnap.docs.map(docSnap => ({ id: docSnap.id, data: docSnap.data() }));

      // === PROCESS PROPERTY TYPES ===
      const sharedUserIds = new Set<string>();
      propertiesArr.forEach(({ data }) => {
        if (data.ownerId === user.uid && Array.isArray(data.sharedWith)) {
          data.sharedWith.forEach((sw: any) => {
            if (sw.userId !== user.uid && sw.userId) {
              sharedUserIds.add(sw.userId);
            }
          });
        }
      });

      // Fetch user profiles for shared members
      const sharedUserArr = Array.from(sharedUserIds);
      const sharedUserDocs = await Promise.all(sharedUserArr.map(uid => getDoc(doc(db, "users", uid))));
      const members = sharedUserDocs.map((docSnap, idx) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          return {
            uid: sharedUserArr[idx],
            displayName: d.displayName || '',
            photoURL: d.photoURL || '',
          };
        }
        return null;
      }).filter(Boolean);
      setSharedMembers(members);

      // Build property types tabs
      let ourHome = false;
      const otherTypes: string[] = [];
      propertiesArr.forEach(({ data }) => {
        const isOwner = data.ownerId === user.uid;
        let tabName = data.type;
        if (Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === user.uid)) {
          const entry = data.sharedWith.find((sw: any) => typeof sw === 'object' && sw.userId === user.uid);
          if (entry && typeof entry === 'object' && entry.alias) {
            tabName = entry.alias;
          }
        }
        if ((isOwner || (Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === user.uid))) && tabName) {
          if (tabName === 'Our Home') ourHome = true;
          else otherTypes.push(tabName);
        }
      });
      otherTypes.sort();
      const allTypes = ["All Properties"];
      if (ourHome) allTypes.push("Our Home");
      allTypes.push(...otherTypes);
      setPropertyTypes(allTypes);

      // Restore tab from storage
      const saved = sessionStorage.getItem('appTab');
      if (saved && allTypes.includes(saved)) {
        setSelectedTab(saved);
      } else {
        setSelectedTab(allTypes[0]);
        sessionStorage.setItem('appTab', allTypes[0]);
      }

      // === PROCESS COMPLETED TASKS ===
      const allowedPropertyIds: string[] = [];
      const propertyMapFromCache: { [id: string]: any } = {};
      propertiesArr.forEach(({ id, data }) => {
        const isOwner = data.ownerId === user.uid;
        const isShared = Array.isArray(data.sharedWith) && data.sharedWith.some((sw: any) => sw.userId === user.uid);
        if ((isOwner || isShared) && id) {
          allowedPropertyIds.push(id);
          propertyMapFromCache[id] = data;
        }
      });

      if (allowedPropertyIds.length === 0) {
        setCompletedTasks([]);
        setLoading(false);
        return;
      }

      // Fetch completed tasks for these properties (chunked for >10 properties)
      const chunks: string[][] = [];
      for (let i = 0; i < allowedPropertyIds.length; i += 10) {
        chunks.push(allowedPropertyIds.slice(i, i + 10));
      }
      const allTasks: any[] = [];
      for (const chunk of chunks) {
        const tasksQ = query(collection(db, "tasks"), where("propertyId", "in", chunk), where("status", "==", "completed"));
        const snap = await getDocs(tasksQ);
        snap.docs.forEach(docSnap => allTasks.push({ id: docSnap.id, ...docSnap.data() }));
      }

      // Collect unique userIds for completedBy
      const userIds = Array.from(new Set(allTasks.map(t => t.completedBy).filter(Boolean)));
      const userDocs = await Promise.all(userIds.map(id => getDoc(doc(db, "users", id))));
      const userMap: { [id: string]: any } = {};
      userDocs.forEach((docSnap, idx) => {
        if (docSnap.exists()) userMap[userIds[idx]] = docSnap.data();
      });

      // Build rows using cached property data
      const currentUserId = user.uid;
      const rows: any[] = allTasks.map(data => {
        let propertyType = "";
        if (data.propertyId && propertyMapFromCache[data.propertyId]) {
          const property = propertyMapFromCache[data.propertyId];
          const isShared = property.sharedWith && Array.isArray(property.sharedWith) && property.sharedWith.some((sw: any) => sw.userId === currentUserId);
          if (isShared) {
            const entry = property.sharedWith.find((sw: any) => sw.userId === currentUserId);
            if (entry && typeof entry.alias === 'string' && entry.alias.trim()) {
              propertyType = entry.alias;
            } else {
              propertyType = property.type || "";
            }
          } else {
            propertyType = property.type || "";
          }
        }
        let completedBy = "";
        if (data.completedBy && userMap[data.completedBy]) {
          completedBy = userMap[data.completedBy].displayName || "";
        } else if (typeof data.completedBy === 'string') {
          completedBy = data.completedBy;
        }
        return {
          title: data.title || "",
          propertyType,
          completedDate: data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate().toLocaleDateString() : "",
          completedBy,
        };
      });

      setCompletedTasks(rows);
      setLoading(false);
    }
    fetchAllData();
  }, []);

  // const handleOpenFilter = () => {
  //   setShowFilterModal(true);
  // };

  // const handleCloseFilter = () => {
  //   setShowFilterModal(false);
  // };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 3, bgcolor: "#F9F9F9", minHeight: 0, maxHeight: "100vh", ml: sidebar ? '75px' : '18vw', width: sidebar ? "calc(100vw - 75px)" : "calc(100vw - 18vw)", overflowX: 'hidden' }}>
      {/* Top Tabs - dynamic property types */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 3 }}>
        <Typography variant="h5" sx={{ fontSize: 18, fontWeight: 550, color: '#222', fontFamily: 'Nunito, Arial, sans-serif' }}>Reports</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          {propertyTypes.map((type) => (
            <Box
              key={type}
              onClick={() => {
                setSelectedTab(type);
                sessionStorage.setItem('appTab', type);
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
                color: type === selectedTab ? '#89AE99' : 'gray',
                ":hover": {
                  color: selectedTab === type ? '#89AE99' : '#000'
                },
                "::selection": {
                  color: '#89AE99'
                },
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
          variant="outlined"
          sx={{
            borderRadius: '8px',
            bgcolor: thisMonthActive ? '#475567' : '#fff',
            color: thisMonthActive ? '#fff' : '#343748',
            fontWeight: 440,
            fontFamily: 'Nunito, Arial, sans-serif',
            textTransform: 'none',
            borderColor: thisMonthActive ? '#475567' : '#B0B0B0',
            px: 2,
            py: 1,
            fontSize: 14,
            display: { xs: 'none', md: 'inline-flex' },
            boxShadow: thisMonthActive ? '0 2px 8px rgba(71,85,103,0.10)' : 'none',
            transition: 'all 0.2s',
            '&:hover': {
              background: thisMonthActive ? '#475567' : '#fff',
              borderColor: thisMonthActive ? '#475567' : '#222',
              borderRadius: '8px'
            },
          }}
          onClick={() => setThisMonthActive((prev) => !prev)}
        >
          <span style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}>
            <svg width="20" height="20" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M9.46739 11.1309C9.19139 11.1309 8.96472 10.9069 8.96472 10.6309C8.96472 10.3549 9.18539 10.1309 9.46139 10.1309H9.46739C9.74339 10.1309 9.96739 10.3549 9.96739 10.6309C9.96739 10.9069 9.74339 11.1309 9.46739 11.1309" fill={thisMonthActive ? '#fff' : '#1F1F1F'}/>
              <path fillRule="evenodd" clipRule="evenodd" d="M6.50901 11.1309C6.23301 11.1309 6.00635 10.9069 6.00635 10.6309C6.00635 10.3549 6.22701 10.1309 6.50301 10.1309H6.50901C6.78501 10.1309 7.00901 10.3549 7.00901 10.6309C7.00901 10.9069 6.78501 11.1309 6.50901 11.1309" fill={thisMonthActive ? '#fff' : '#1F1F1F'}/>
              <path fillRule="evenodd" clipRule="evenodd" d="M3.54459 11.1309C3.26859 11.1309 3.04126 10.9069 3.04126 10.6309C3.04126 10.3549 3.26259 10.1309 3.53859 10.1309H3.54459C3.82059 10.1309 4.04459 10.3549 4.04459 10.6309C4.04459 10.9069 3.82059 11.1309 3.54459 11.1309" fill={thisMonthActive ? '#fff' : '#1F1F1F'}/>
              <path fillRule="evenodd" clipRule="evenodd" d="M9.46739 8.53955C9.19139 8.53955 8.96472 8.31555 8.96472 8.03955C8.96472 7.76355 9.18539 7.53955 9.46139 7.53955H9.46739C9.74339 7.53955 9.96739 7.76355 9.96739 8.03955C9.96739 8.31555 9.74339 8.53955 9.46739 8.53955" fill={thisMonthActive ? '#fff' : '#1F1F1F'}/>
              <path fillRule="evenodd" clipRule="evenodd" d="M6.50901 8.53955C6.23301 8.53955 6.00635 8.31555 6.00635 8.03955C6.00635 7.76355 6.22701 7.53955 6.50301 7.53955H6.50901C6.78501 7.53955 7.00901 7.76355 7.00901 8.03955C7.00901 8.31555 6.78501 8.53955 6.50901 8.53955" fill={thisMonthActive ? '#fff' : '#1F1F1F'}/>
              <path fillRule="evenodd" clipRule="evenodd" d="M3.54459 8.53955C3.26859 8.53955 3.04126 8.31555 3.04126 8.03955C3.04126 7.76355 3.26259 7.53955 3.53859 7.53955H3.54459C3.82059 7.53955 4.04459 7.76355 4.04459 8.03955C4.04459 8.31555 3.82059 8.53955 3.54459 8.53955" fill={thisMonthActive ? '#fff' : '#1F1F1F'}/>
              <path fillRule="evenodd" clipRule="evenodd" d="M12.4443 5.93604H0.561646C0.285646 5.93604 0.0616455 5.71204 0.0616455 5.43604C0.0616455 5.16004 0.285646 4.93604 0.561646 4.93604H12.4443C12.7203 4.93604 12.9443 5.16004 12.9443 5.43604C12.9443 5.71204 12.7203 5.93604 12.4443 5.93604" fill={thisMonthActive ? '#fff' : '#1F1F1F'}/>
              <path fillRule="evenodd" clipRule="evenodd" d="M9.19556 3.194C8.91956 3.194 8.69556 2.97 8.69556 2.694V0.5C8.69556 0.224 8.91956 0 9.19556 0C9.47156 0 9.69556 0.224 9.69556 0.5V2.694C9.69556 2.97 9.47156 3.194 9.19556 3.194" fill={thisMonthActive ? '#fff' : '#1F1F1F'}/>
              <path fillRule="evenodd" clipRule="evenodd" d="M3.81018 3.194C3.53418 3.194 3.31018 2.97 3.31018 2.694V0.5C3.31018 0.224 3.53418 0 3.81018 0C4.08618 0 4.31018 0.224 4.31018 0.5V2.694C4.31018 2.97 4.08618 3.194 3.81018 3.194" fill={thisMonthActive ? '#fff' : '#1F1F1F'}/>
              <mask id="mask0_6167_2232" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="0" y="1" width="13" height="14">
                <path fillRule="evenodd" clipRule="evenodd" d="M0 1.05273H13V14.3333H0V1.05273Z" fill="white"/>
              </mask>
              <g mask="url(#mask0_6167_2232)">
                <path fillRule="evenodd" clipRule="evenodd" d="M3.68063 2.05265C1.95196 2.05265 0.999959 2.97465 0.999959 4.64865V10.6813C0.999959 12.392 1.95196 13.3333 3.68063 13.3333H9.31929C11.048 13.3333 12 12.4093 12 10.732V4.64865C12.0026 3.82532 11.7813 3.18532 11.342 2.74532C10.89 2.29199 10.1933 2.05265 9.32529 2.05265H3.68063ZM9.31933 14.3334H3.68067C1.41067 14.3334 0 12.9341 0 10.6814V4.64873C0 2.43007 1.41067 1.05273 3.68067 1.05273H9.32533C10.4647 1.05273 11.4067 1.39407 12.05 2.03873C12.6747 2.66607 13.0033 3.56807 13 4.65007V10.7321C13 12.9534 11.5893 14.3334 9.31933 14.3334V14.3334Z" fill={thisMonthActive ? '#fff' : '#1F1F1F'}/>
              </g>
            </svg>
          </span>
          This Month
        </Button>
        {/* <Button
          variant="outlined"
          sx={{
            borderRadius: 2,
            bgcolor: '#fff',
            color: '#343748',
            fontWeight: 600,
            fontFamily: 'Nunito, Arial, sans-serif',
            textTransform: 'none',
            borderColor: '#e0e0e0',
            px: 2,
            py: 0.5,
            fontSize: 16,
            display: { xs: 'none', md: 'inline-flex' },
            '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' }
          }}
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
        </Button> */}
      </Box>
      {/* Search and Actions - Card style */}
      <Box sx={{ bgcolor: '#fff', borderRadius: 2, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', p: 2.2, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
            <TextField
              variant="outlined"
              size="small"
              placeholder="Search"
              fullWidth
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#BDBDBD' }} /></InputAdornment>,
                sx: {
                  borderRadius: 3,
                  background: '#fff',
                  fontSize: 16,
                  boxShadow: 'none',
                }
              }}
              sx={{
                bgcolor: "#fff",
                '& .MuiOutlinedInput-root': {
                  borderRadius: 8,
                },
              }}
            />
            {/* Center avatars between search and download button if present */}
            {sharedMembers.length > 0 ? (
              <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 72, minWidth: 56, mx: 1 }}>
                {sharedMembers.slice(0, 3).map((member, idx) => {
                  const isSelected = selectedPhotoIdx === idx;
                  return (
                    <Tooltip key={member.uid} title={member.displayName || ""} arrow>
                      <Avatar
                        src={member.photoURL || "/avatar.png"}
                        alt={member.displayName}
                        sx={{
                          width: 32,
                          height: 32,
                          ml: idx === 0 ? 0 : -1.5,
                          border: isSelected ? '2px solid #475567' : '2px solid transparent',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedPhotoIdx(isSelected ? null : idx)}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            ) : (
              <Box sx={{ width: 24, minWidth: 24, mx: 2 }} />
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 120 }}>
          <Button
            variant="outlined"
            // sx={{ fontFamily: 'Nunito, Arial, sans-serif', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' }, borderRadius: 2, textTransform: "none", fontWeight: 400, bgcolor: '#fff', color: '#1F1F1F', borderColor: '#E0E0E0', display: 'flex', alignItems: 'center', gap: 1 }}
            sx={{ ":hover": {borderColor: '#222'}, bgcolor: '#fff', color: '#343748', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', textTransform: 'none', borderColor: '#e0e0e0', px: { xs: 1, sm: 2 }, py: { xs: 0.5, sm: 1 }, fontSize: { xs: 12, sm: 14 }, borderRadius: 2, mt: { xs: 1, sm: 0 } }}
            disabled={isFilteredEmpty}
          >
            <span style={{ display: 'flex', alignItems: 'center', marginRight: 10 }}>
              <svg width="14" height="13" viewBox="0 0 14 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.66691 8.52733L6.66691 0.5" stroke={svgStrokeColor} strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8.61096 6.57544L6.66696 8.52744L4.72296 6.57544" stroke={svgStrokeColor} strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9.75537 3.65527H10.3774C11.734 3.65527 12.8334 4.75461 12.8334 6.11194L12.8334 9.36794C12.8334 10.7213 11.7367 11.8179 10.3834 11.8179L2.95671 11.8179C1.60004 11.8179 0.50004 10.7179 0.50004 9.36127L0.50004 6.10461C0.50004 4.75194 1.59737 3.65527 2.95004 3.65527H3.57804" stroke={svgStrokeColor} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            Download
          </Button>
        </Box>
      </Box>
      {/* Table with scroll and sticky header */}
      <TableContainer component={Paper} sx={{ height: '100%', borderRadius: 2, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', bgcolor: '#fff', minHeight: 400, overflowY: 'auto', scrollbarWidth: 'thin', mb: 1, '&::-webkit-scrollbar': { width: 8 }, '&::-webkit-scrollbar-thumb': { background: '#E0E0E0', borderRadius: 2 } }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '45%', minWidth: 120, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 16, color: '#343748', borderBottom: '2px solid #E0E0E0', background: '#fff', position: 'sticky', top: 0, zIndex: 2 }}>Task</TableCell>
              <TableCell sx={{ width: '15%', minWidth: 60, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 16, color: '#343748', borderBottom: '2px solid #E0E0E0', background: '#fff', position: 'sticky', top: 0, zIndex: 2 }}>Property</TableCell>
              <TableCell sx={{ width: '20%', minWidth: 90, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 16, color: '#343748', borderBottom: '2px solid #E0E0E0', background: '#fff', position: 'sticky', top: 0, zIndex: 2 }}>Date Completed</TableCell>
              <TableCell sx={{ width: '20%', minWidth: 100, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 16, color: '#343748', borderBottom: '2px solid #E0E0E0', background: '#fff', position: 'sticky', top: 0, zIndex: 2 }}>Completed by</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              [...Array(6)].map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell sx={{ width: '45%', minWidth: 120 }}><Skeleton variant="text" width="100%" height={28} /></TableCell>
                  <TableCell sx={{ width: '15%', minWidth: 60 }}><Skeleton variant="text" width="100%" height={28} /></TableCell>
                  <TableCell sx={{ width: '20%', minWidth: 90 }}><Skeleton variant="text" width="100%" height={28} /></TableCell>
                  <TableCell sx={{ width: '20%', minWidth: 100 }}><Skeleton variant="text" width="100%" height={28} /></TableCell>
                </TableRow>
              ))
            ) : (
              filteredRows.map((row, idx) => (
                  <TableRow key={idx} sx={{ fontFamily: 'Nunito, Arial, sans-serif', borderBottom: '1.5px solid #E0E0E0', '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={{ width: '40%', minWidth: 120, fontFamily: 'Nunito, Arial, sans-serif', borderBottom: '1.5px solid #E0E0E0', fontSize: 16, color: '#343748', fontWeight: 400 }}>{row.title}</TableCell>
                    <TableCell sx={{ width: '10%', minWidth: 60, fontFamily: 'Nunito, Arial, sans-serif', borderBottom: '1.5px solid #E0E0E0', fontSize: 16, color: '#343748', fontWeight: 400 }}>{row.propertyType}</TableCell>
                    <TableCell sx={{ width: '20%', minWidth: 90, fontFamily: 'Nunito, Arial, sans-serif', borderBottom: '1.5px solid #E0E0E0', fontSize: 16, color: '#343748', fontWeight: 400 }}>{row.completedDate}</TableCell>
                    <TableCell sx={{ width: '30%', minWidth: 100, fontFamily: 'Nunito, Arial, sans-serif', borderBottom: '1.5px solid #E0E0E0', fontSize: 16, color: '#343748', fontWeight: 400 }}>
                      <span style={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#343748', fontSize: 16 }}>{row.completedBy}</span>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {/* {showFilterModal && (
        <div className="modal-overlay" onClick={handleCloseFilter}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <FilterPropertyModal open={showFilterModal} onClose={handleCloseFilter} />
            <button onClick={handleCloseFilter}>Close</button>
          </div>
        </div>
      )} */}
    </Box>
  );
};

export default Reports;
