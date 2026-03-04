import React, { useState, useEffect } from "react";
import { Box, Typography, Avatar, Button, Modal, TextField, Switch, FormControlLabel, IconButton } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import EmptyState from "../components/common/EmptyState";
import { getAuth } from "firebase/auth";
import { db } from "../services/firebase";
import { collection, getDocs, query, where, addDoc, updateDoc, doc, deleteDoc, getDoc } from "firebase/firestore";

interface SharedAccessProps {
  setting?: boolean;
  sidebar?: boolean;
}

const SharedAccess: React.FC<SharedAccessProps> = ({ setting, sidebar }) => {
  const sidebarWidthFallback = sidebar ? '72px' : 'clamp(220px, 18vw, 300px)';
  const [friendIsPropertyManager, setFriendIsPropertyManager] = useState(false);
  // State for member details modal
  const [memberDetailsOpen, setMemberDetailsOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberProperties, setMemberProperties] = useState<string[]>([]);
  const [memberIsCoOwner, setMemberIsCoOwner] = useState(false);
  const [householdMembers, setHouseholdMembers] = useState<Array<{ avatar: string; name: string; role: string; email?: string; userId?: string }>>([]);
  const [trustedFriends, setTrustedFriends] = useState<Array<{ avatar: string; name: string; role: string; email?: string; userId?: string }>>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<any>(null);

  const confirmRemoveMember = async () => {
    if (!pendingRemove) return;
    const member = pendingRemove;
    setConfirmOpen(false);
    setPendingRemove(null);
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    // Remove member from all properties owned by user
    const propQ = query(collection(db, "properties"), where("ownerId", "==", user.uid));
    const propSnap = await getDocs(propQ);
    for (const propDoc of propSnap.docs) {
      const propData = propDoc.data();
      if (Array.isArray(propData.sharedWith)) {
        console.log("Before removal, sharedWith:", propData.sharedWith);
        const updatedSharedWith = propData.sharedWith.filter((sw: any) => {
          // Remove if userId or email matches
          console.log(member, "Member info");
          if (member.userId && sw.userId && sw.userId === member.userId) return false;
          if (member.email && sw.email && sw.email === member.email) return false;
          if (member.email && sw.userId && sw.userId === member.email) return false;
          if (member.userId && sw.email && sw.email === member.userId) return false;
          return true;
        });
        await updateDoc(doc(db, "properties", propDoc.id), { sharedWith: updatedSharedWith });
      }
    }
    // Remove invites by both email and userId
    let inviteQueries = [];
    if (member.email) inviteQueries.push(query(collection(db, "invites"), where("email", "==", member.email)));
    if (member.userId) inviteQueries.push(query(collection(db, "invites"), where("userId", "==", member.userId)));
    for (const iq of inviteQueries) {
      const invitesSnap = await getDocs(iq);
      for (const inviteDoc of invitesSnap.docs) {
        await deleteDoc(doc(db, "invites", inviteDoc.id));
      }
    }
    setHouseholdMembers(prev => prev.filter(m => m !== member));
    setTrustedFriends(prev => prev.filter(m => m !== member));
  };

  // Fetch user's property types and shared members from Firestore
  useEffect(() => {
    async function fetchMembersBySharedWith() {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      // Try to load from sessionStorage first
      const cacheKey = `sharedMembers_${user.uid}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setHouseholdMembers(parsed.household || []);
          setTrustedFriends(parsed.friends || []);
        } catch (e) {
          // Ignore cache parse errors
        }
      }
      // Always fetch fresh data in background
      const propQ = query(collection(db, "properties"), where("ownerId", "==", user.uid));
      const propSnap = await getDocs(propQ);
      // Removed duplicate declarations; only use household/friends after merging user info
      let rawMembers: Array<{ avatar: string; name: string; role: string; userId?: string }> = [];
      for (const propDoc of propSnap.docs) {
        const propData = propDoc.data();
        if (Array.isArray(propData.sharedWith)) {
          for (const sw of propData.sharedWith) {
            // Only include if userId is a UID (not an email)
            if (sw.userId && typeof sw.userId === 'string' && !sw.userId.includes('@')) {
              let displayRole = sw.role;
              if (sw.role === 'Co-owner') displayRole = 'Family Member';
              else if (sw.role === 'Family Manager') displayRole = 'Family Manager';
              else if (sw.role === 'Friend') displayRole = 'Friend';
              else if (sw.role === 'PM') displayRole = 'Property Manager';
              rawMembers.push({
                avatar: sw.avatar || sw.photoURL || "/avatar.png",
                name: sw.name || sw.displayName || sw.email || sw.userId || "Unknown",
                role: displayRole,
                userId: sw.userId || null
              });
            }
          }
        }
      }
      // Fetch user info for all unique userIds
      const userIdSet = new Set(rawMembers.map(m => m.userId).filter(Boolean));
      let userInfoMap: { [userId: string]: { photoURL?: string; displayName?: string } } = {};
      if (userIdSet.size > 0) {
        const userQ = query(collection(db, "users"), where("uid", "in", Array.from(userIdSet)));
        const userSnap = await getDocs(userQ);
        userSnap.forEach(docSnap => {
          const data = docSnap.data();
          userInfoMap[data.uid] = {
            photoURL: data.photoURL,
            displayName: data.displayName
          };
        });
      }
      // Merge user info into members
      const mergedMembers = rawMembers.map(m => {
        if (m.userId && userInfoMap[m.userId]) {
          return {
            ...m,
            avatar: userInfoMap[m.userId].photoURL || m.avatar,
            name: userInfoMap[m.userId].displayName || m.name
          };
        }
        return m;
      });
      // Categorize and deduplicate
      let household: Array<{ avatar: string; name: string; role: string; userId?: string }> = [];
      let friends: Array<{ avatar: string; name: string; role: string; userId?: string }> = [];
      mergedMembers.forEach(memberObj => {
        // Accept either the display role values or legacy role codes
        if (memberObj.role === 'Friend' || memberObj.role === 'Property Manager' || memberObj.role === 'Friend' || memberObj.role === 'PM') {
          friends.push(memberObj);
        } else {
          household.push(memberObj);
        }
      });
      const dedup = (arr: Array<{ userId?: string; name: string; avatar: string; role: string }>) => {
        const map = new Map();
        arr.forEach(m => {
          if (m.userId) map.set(m.userId, m);
          else map.set(m.name, m);
        });
        return Array.from(map.values());
      };
      setHouseholdMembers(dedup(household));
      setTrustedFriends(dedup(friends));
      sessionStorage.setItem(cacheKey, JSON.stringify({ household: dedup(household), friends: dedup(friends) }));
    }
    fetchMembersBySharedWith();
  }, []);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteEmailError, setInviteEmailError] = useState("");
  const [isCoOwner, setIsCoOwner] = useState(false);
  const [friendOpen, setFriendOpen] = useState(false);
  const [friendEmail, setFriendEmail] = useState("");
  const [friendEmailError, setFriendEmailError] = useState("");
  // Separate state for "All Properties" toggles (independent, not synced)
  const [friendAllPropsToggle, setFriendAllPropsToggle] = useState(false);
  const [familyAllPropsToggle, setFamilyAllPropsToggle] = useState(false);
  const [memberAllPropsToggle, setMemberAllPropsToggle] = useState(false);
  // Separate selected properties for each modal
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]); // For Family modal
  const [friendSelectedProperties, setFriendSelectedProperties] = useState<string[]>([]); // For Friend modal
  const [propertyNames, setPropertyNames] = useState<string[]>([]);
  const [propertyIdMap, setPropertyIdMap] = useState<{ [type: string]: string }>({});
  // Fetch user's property types from Firestore
  useEffect(() => {
    async function fetchUserProperties() {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      const propQ = query(collection(db, "properties"), where("ownerId", "==", user.uid));
      const propSnap = await getDocs(propQ);
      let propNames: string[] = [];
      const otherTypes: string[] = [];
      let ourHomeFound = false;
      const idMap: { [type: string]: string } = {};
      const propertiesArr: any[] = [];
      propSnap.forEach(docSnap => {
        const data = docSnap.data();
        propertiesArr.push(data);
        if (data.type) {
          idMap[data.type] = docSnap.id;
          if (data.type === 'Our Home') {
            ourHomeFound = true;
          } else {
            otherTypes.push(data.type);
          }
        }
      });
      setPropertyIdMap(idMap);
      // Always add 'All Properties' as the first toggle button
      propNames.push('All Properties');
      if (ourHomeFound) {
        propNames.push('Our Home');
      }
      propNames.push(...otherTypes);
      setPropertyNames(propNames);
      // All toggle buttons are non-selected by default
      setSelectedProperties([]);
    }
    fetchUserProperties();
  }, []);

  const handleOpenInvite = () => setInviteOpen(true);
  const handleCloseInvite = () => {
    setInviteOpen(false);
    setInviteEmail("");
    setInviteEmailError("");
    setIsCoOwner(false);
    setSendingInvite(false);
    setFamilyAllPropsToggle(false);
    setSelectedProperties([]);
  };

  const handleOpenFriend = () => setFriendOpen(true);
  const handleCloseFriend = () => {
    setFriendOpen(false);
    setFriendEmail("");
    setFriendEmailError("");
    setSendingInvite(false);
    setFriendAllPropsToggle(false);
    setFriendSelectedProperties([]);
  };

  // Email validation helper
  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // Modal box style for invitation modals
  const modalBoxSx = {
    bgcolor: '#fff',
    borderRadius: { xs: 0, sm: 2 },
    p: { xs: 2, sm: 3 },
    boxShadow: 6,
    outline: 'none',
    width: { xs: '100vw', sm: '70vw', md: '55vw' },
    maxWidth: 760,
    maxHeight: { xs: '100dvh', sm: '90dvh' },
    height: { xs: '100dvh', sm: 'auto' },
    overflowY: 'auto',
  };

  const [sendingInvite, setSendingInvite] = useState(false);
  // Separate pending invites for household and friends
  const [pendingHouseholdInvites, setPendingHouseholdInvites] = useState<string[]>([]);
  const [pendingFriendInvites, setPendingFriendInvites] = useState<string[]>([]);
  useEffect(() => {
    async function fetchPendingInvites() {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      // Get all property IDs owned by user
      const propQ = query(collection(db, "properties"), where("ownerId", "==", user.uid));
      const propSnap = await getDocs(propQ);
      const propertyIds = propSnap.docs.map(doc => doc.id);
      if (propertyIds.length === 0) {
        setPendingHouseholdInvites([]);
        setPendingFriendInvites([]);
        return;
      }
      // Query invites for these propertyIds
      const invitesQ = query(collection(db, "invites"), where("propertyIds", "array-contains-any", propertyIds));
      const invitesSnap = await getDocs(invitesQ);
      const householdPending: string[] = [];
      const friendPending: string[] = [];
      invitesSnap.forEach(inviteDoc => {
        const data = inviteDoc.data();
        if (data.email && !data.used) {
          if (data.type === 'friend') {
            friendPending.push(data.email);
          } else {
            householdPending.push(data.email);
          }
        }
      });
      // Remove duplicate emails before setting state
      const uniqueHousehold = Array.from(new Set(householdPending));
      const uniqueFriends = Array.from(new Set(friendPending));
      setPendingHouseholdInvites(uniqueHousehold);
      setPendingFriendInvites(uniqueFriends);
    }
    fetchPendingInvites();
  }, []);

  return (
    <Box
      sx={{
        p: !setting ? { xs: 1.5, sm: 2, md: 3 } : 0,
        bgcolor: "#F9F9F9",
        minHeight: "100dvh",
        ml: { xs: 0, md: !setting ? `var(--app-sidebar-width, ${sidebarWidthFallback})` : 0 },
        width: {
          xs: '100%',
          md: !setting
            ? `calc(100% - var(--app-sidebar-width, ${sidebarWidthFallback}))`
            : '100%',
        },
        maxWidth: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: !setting ? 3 : 1.2,
        overflowX: 'hidden',
      }}
    >
      {/* Remove Member Confirm Modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} aria-labelledby="remove-member-modal" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ bgcolor: '#fff', borderRadius: { xs: 0, sm: 2 }, p: { xs: 2, sm: 3 }, minWidth: 0, width: { xs: '100vw', sm: '92vw', md: '35vw' }, maxWidth: { xs: '100vw', sm: 560 }, maxHeight: { xs: '100dvh', sm: '90dvh' }, height: { xs: '100dvh', sm: 'auto' }, overflowY: 'auto', boxShadow: 6, outline: 'none' }}>
          <Typography variant="h6" sx={{ fontWeight: 550, mb: 2, fontSize: 19, color: '#232B36' }}>Remove Member</Typography>
          <Box sx={{ bgcolor: '#F6A94A', p: 2.5, color: '#222', borderRadius: 1, mb: 3, fontSize: 18, fontWeight: 400, lineHeight: 1.35 }}>
            Are you sure you want to remove this member?
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              sx={{ ":hover": { borderColor: "#222" }, textTransform: 'none', color: '#232B36', fontWeight: 400, fontSize: 16, px: 3, minWidth: 0, borderRadius: 2, borderColor: '#ccc', bgcolor: '#fff', boxShadow: 'none', height: 44 }}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              sx={{ bgcolor: '#E57373', textTransform: 'none', borderRadius: 2, fontWeight: 600, px: 4, fontSize: 17, boxShadow: 'none', color: '#fff', minWidth: 120, height: 44, '&:hover': { bgcolor: '#d32f2f' } }}
              onClick={confirmRemoveMember}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Modal>
      { !setting ? <Typography variant="h5" sx={{ fontWeight: 550, fontSize: 18, color: '#222', fontFamily: 'Nunito, Arial, sans-serif', pt: 1 }}>Shared Access</Typography> : null}
      {/* Household Members Card */}
      <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: { xs: 2, sm: 3, md: 4.5 }, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', mb: !setting ? -1.8 : 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: !setting ? 2 : 1 }}>
          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 16, fontWeight: 550, color: '#343748' }}>Household Members</Typography>
          <Typography
            sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#89AE99', fontWeight: 550, textTransform: 'none', fontSize: 15, cursor: 'pointer', userSelect: 'none' }}
            onClick={handleOpenInvite}
            component="span"
          >
            Add Household Member
          </Typography>
        </Box>
      <Typography sx={{ color: '#343748', mb: 3, mt: 3, fontSize: 19 }}><span style={{ fontWeight: 550 }}>Share the load. </span>
        <span style={{ fontWeight: 400 }}>Add your kids, siblings, partners, or helpers so everyone's on the same page and every property stays in proper order.</span>
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Render current user as Account Owner at the top */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }} onClick={async () => {
            const auth = getAuth();
            const user = auth.currentUser;
            if (!user) return;
            setSelectedMember({
              name: user.displayName || user.email || "Account Owner",
              email: user.email,
              role: 'Account Owner',
              avatar: user.photoURL || "/avatar.png",
              userId: user.uid
            });
            // Find properties owned by the current user
            const propQ = query(collection(db, "properties"), where("ownerId", "==", user.uid));
            const propSnap = await getDocs(propQ);
            const ownedProps: string[] = [];
            propSnap.forEach(docSnap => {
              const data = docSnap.data();
              if (data.type) {
                ownedProps.push(data.type);
              }
            });
            setMemberProperties(ownedProps);
            setMemberAllPropsToggle(false);
            setMemberDetailsOpen(true);
            setMemberIsCoOwner(true);
          }}>
            <Avatar src={getAuth().currentUser?.photoURL || "/avatar.png"} sx={{ width: 40, height: 40 }} />
            <Box>
              <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', fontWeight: 550 }}>{getAuth().currentUser?.displayName}</Typography>
              <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', fontSize: 15 }}>Account Owner</Typography>
            </Box>
          </Box>
          {/* No close button for the current user (owner) */}
        </Box>
        {/* Render other household members below the owner */}
        {householdMembers.length > 0 && householdMembers.map((member, idx) => (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }} onClick={async () => {
              setSelectedMember(member);
              // Find only properties actually shared with this member
              const auth = getAuth();
              const user = auth.currentUser;
              if (!user) return;
              const propQ = query(collection(db, "properties"), where("ownerId", "==", user.uid));
              const propSnap = await getDocs(propQ);
              const sharedProps: string[] = [];
              propSnap.forEach(docSnap => {
                const data = docSnap.data();
                if (Array.isArray(data.sharedWith)) {
                  const isShared = data.sharedWith.some(sw =>
                    (member.userId && sw.userId === member.userId) ||
                    (member.email && sw.email === member.email)
                  );
                  if (isShared && data.type) {
                    sharedProps.push(data.type);
                  }
                }
              });
              setMemberProperties(sharedProps);
              setMemberAllPropsToggle(false);
              setMemberDetailsOpen(true);
              setMemberIsCoOwner(member.role === 'Co-owner' || member.role === 'Family Member');
            }}>
              <Avatar src={member.avatar} sx={{ width: 40, height: 40 }} />
              <Box>
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', fontWeight: 550 }}>{member.name}</Typography>
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', fontSize: 15 }}>{member.role}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton edge="end" aria-label="remove" onClick={() => { setPendingRemove(member); setConfirmOpen(true); }} sx={{ ml: 1, color: '#000', bgcolor: '#fff', borderRadius: 2 }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        ))}
      </Box>
      {/* Pending Invites UI (after main content) */}
      {pendingHouseholdInvites.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {pendingHouseholdInvites.map((email) => (
            <Box key={email} sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Pending icon as avatar, using provided SVG */}
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="40" height="40" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clipPath="url(#clip0_4683_5091)">
                      <rect width="44" height="44" rx="22" fill="#32425B"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M21.9847 25.3462C18.1171 25.3462 14.8142 25.931 14.8142 28.2729C14.8142 30.6148 18.0961 31.2205 21.9847 31.2205C25.8523 31.2205 29.1542 30.6348 29.1542 28.2938C29.1542 25.9529 25.8733 25.3462 21.9847 25.3462Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M21.9846 22.0059C24.5227 22.0059 26.5799 19.9478 26.5799 17.4097C26.5799 14.8716 24.5227 12.8145 21.9846 12.8145C19.4465 12.8145 17.3885 14.8716 17.3885 17.4097C17.3799 19.9392 19.4237 21.9973 21.9523 22.0059H21.9846Z" stroke="white" strokeWidth="1.42857" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_4683_5091">
                        <rect width="44" height="44" rx="22" fill="white"/>
                      </clipPath>
                    </defs>
                  </svg>
                </Box>
                <Box>
                  <Typography sx={{ color: '#475567', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550 }}>Pending invite</Typography>
                  <Typography sx={{ color: '#475567', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 15 }}>{email}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton edge="end" aria-label="remove" onClick={() => {
                  setPendingHouseholdInvites(prev => prev.filter(e => e !== email));
                  import('firebase/firestore').then(async ({ collection, query, where, getDocs, deleteDoc, doc }) => {
                    const { db } = await import('../services/firebase');
                    const invitesQ = query(collection(db, "invites"), where("email", "==", email), where("type", "==", "household"));
                    const invitesSnap = await getDocs(invitesQ);
                    for (const inviteDoc of invitesSnap.docs) {
                      await deleteDoc(doc(db, "invites", inviteDoc.id));
                    }
                  });
                }} sx={{ ml: 1, color: '#000', bgcolor: '#fff', borderRadius: 2 }}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      )}
      </Box>
      {/* Trusted Friend Card */}
      <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: { xs: 2, sm: 3, md: 4.5 }, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2  }}>
        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 16, fontWeight: 550, color: '#343748' }}>Trusted Friend</Typography>
        <Typography
          sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#89AE99', fontWeight: 550, textTransform: 'none', fontSize: 15, cursor: 'pointer', userSelect: 'none' }}
          onClick={handleOpenFriend}
          component="span"
        >
          Invite Friend
        </Typography>
      </Box>
      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, color: '#343748', fontSize: 19 }}>
        Whether it’s a friend or a professional handling responsibilities,
      </Typography>
      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 19, color: '#343748', mb: 3, fontWeight: 400 }}>
        they’ll have secure, temporary access for up to 90 days – and you can end access at any time.
      </Typography>
      {/* Pending Friend Invites UI (after main content) */}
      {pendingFriendInvites.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
          {pendingFriendInvites.map((email) => (
            <Box key={email} sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Pending icon as avatar, using provided SVG */}
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="40" height="40" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clipPath="url(#clip0_4683_5091)">
                      <rect width="44" height="44" rx="22" fill="#32425B"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M21.9847 25.3462C18.1171 25.3462 14.8142 25.931 14.8142 28.2729C14.8142 30.6148 18.0961 31.2205 21.9847 31.2205C25.8523 31.2205 29.1542 30.6348 29.1542 28.2938C29.1542 25.9529 25.8733 25.3462 21.9847 25.3462Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M21.9846 22.0059C24.5227 22.0059 26.5799 19.9478 26.5799 17.4097C26.5799 14.8716 24.5227 12.8145 21.9846 12.8145C19.4465 12.8145 17.3885 14.8716 17.3885 17.4097C17.3799 19.9392 19.4237 21.9973 21.9523 22.0059H21.9846Z" stroke="white" strokeWidth="1.42857" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_4683_5091">
                        <rect width="44" height="44" rx="22" fill="white"/>
                      </clipPath>
                    </defs>
                  </svg>
                </Box>
                <Box>
                  <Typography sx={{ color: '#475567', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550 }}>Pending invite</Typography>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#475567', fontSize: 15 }}>{email}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton edge="end" aria-label="remove" onClick={() => {
                  setPendingFriendInvites(prev => prev.filter(e => e !== email));
                  import('firebase/firestore').then(async ({ collection, query, where, getDocs, deleteDoc, doc }) => {
                    const { db } = await import('../services/firebase');
                    const invitesQ = query(collection(db, "invites"), where("email", "==", email), where("type", "==", "friend"));
                    const invitesSnap = await getDocs(invitesQ);
                    for (const inviteDoc of invitesSnap.docs) {
                      await deleteDoc(doc(db, "invites", inviteDoc.id));
                    }
                  });
                }} sx={{ ml: 1, color: '#000', bgcolor: '#fff', borderRadius: 2 }}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
        {trustedFriends.length > 0 && trustedFriends.map((member, idx) => (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }} onClick={async () => {
              setSelectedMember(member);
              // Find only properties actually shared with this member
              const auth = getAuth();
              const user = auth.currentUser;
              if (!user) return;
              const propQ = query(collection(db, "properties"), where("ownerId", "==", user.uid));
              const propSnap = await getDocs(propQ);
              const sharedProps: string[] = [];
              propSnap.forEach(docSnap => {
                const data = docSnap.data();
                if (Array.isArray(data.sharedWith)) {
                  const isShared = data.sharedWith.some(sw =>
                    (member.userId && sw.userId === member.userId) ||
                    (member.email && sw.email === member.email)
                  );
                  if (isShared && data.type) {
                    sharedProps.push(data.type);
                  }
                }
              });
              setMemberProperties(sharedProps);
              setMemberAllPropsToggle(false);
              setMemberDetailsOpen(true);
              setMemberIsCoOwner(member.role === 'Co-owner' || member.role === 'Family Member');
            }}>
              <Avatar src={member.avatar} sx={{ width: 40, height: 40 }} />
              <Box>
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', fontWeight: 550 }}>{member.name}</Typography>
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', fontSize: 15 }}>{member.role}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton edge="end" aria-label="remove" onClick={() => { setPendingRemove(member); setConfirmOpen(true); }} sx={{ ml: 1, color: '#000', bgcolor: '#fff', borderRadius: 2 }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        ))}
      </Box>
      {/* Invite Trusted Friend Modal */}
      <Modal open={friendOpen} onClose={handleCloseFriend} aria-labelledby="invite-friend-modal" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={modalBoxSx}>
          <Typography variant="h6" sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#222', fontWeight: 550, mb: 2 }}>Grant Access to Trusted Friend</Typography>
          <Box sx={{ bgcolor: '#F6A94A', fontFamily: 'Nunito, Arial, sans-serif', color: '#222', borderRadius: 1, p: 2, mb: 3, fontSize: 15 }}>
            <b>IMPORTANT:</b> Trusted friends you invite will have full access to your household’s data. You should only invite people you fully trust. For security reasons, invite expires after 90 days
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif' }}>Grant Access via Email Address:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ mr: 2, fontWeight: 400, color: '#232B36', fontSize: 16, fontFamily: 'Nunito, Arial, sans-serif' }}>Property Manager</Typography>
              <Switch
                checked={friendIsPropertyManager}
                onChange={(e) => setFriendIsPropertyManager(e.target.checked)}
                sx={{
                  width: 38,
                  height: 22,
                  p: 0,
                  display: 'flex',
                  alignItems: 'center',
                  '& .MuiSwitch-switchBase': {
                    top: '50%',
                    transform: 'translateY(-50%)',
                    '&.Mui-checked': {
                      transform: 'translateX(12px) translateY(-50%)',
                      color: '#fff',
                      '& + .MuiSwitch-track': {
                        backgroundColor: '#89AE99',
                        opacity: 1,
                      },
                    },
                  },
                  '& .MuiSwitch-thumb': {
                    width: 14,
                    height: 14,
                    boxShadow: 'none',
                    backgroundColor: '#fff',
                    transition: 'all 0.3s',
                    position: 'relative',
                    left: '-3px',
                  },
                  '& .MuiSwitch-track': {
                    borderRadius: 18,
                    backgroundColor: '#A8A8A8',
                    opacity: 1,
                    transition: 'all 0.3s',
                  },
                }}
              />
            </Box>
          </Box>
          <TextField
            fullWidth
            value={friendEmail}
            onChange={e => {
              setFriendEmail(e.target.value);
              setFriendEmailError(''); // Clear error on input, do not validate
            }}
            error={!!friendEmailError}
            helperText={friendEmailError}
            placeholder="Enter email address"
            sx={{ mb: 3 }}
          />
          {/* Property selection toggles for Trusted Friend modal */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
            mb: 1,
            mt: 0,
            alignItems: 'center',
            maxWidth: 420,
            mx: 'auto',
            justifyItems: 'start',
          }}>
            {propertyNames.length === 0 ? (
              <Box sx={{ gridColumn: '1 / -1', width: '100%' }}>
                <EmptyState
                  iconType="property"
                  compact
                  title="No Properties Added"
                  description="Add a property first to grant access."
                  minHeight={160}
                />
              </Box>
            ) : (
              propertyNames.map((prop) => {
                if (prop === 'All Properties') {
                  const allPropsExceptAll = propertyNames.filter(p => p !== 'All Properties');
                  return (
                    <FormControlLabel
                      key={prop}
                      control={
                        <Switch
                          checked={friendAllPropsToggle}
                          onChange={() => {
                            if (friendAllPropsToggle) {
                              setFriendSelectedProperties([]);
                              setFriendAllPropsToggle(false);
                            } else {
                              setFriendSelectedProperties(allPropsExceptAll);
                              setFriendAllPropsToggle(true);
                            }
                          }}
                          sx={{
                            mr: -3,
                            width: 38,
                            height: 22,
                            top: 1,
                            fontFamily: 'Nunito, Arial, sans-serif',
                            p: 0,
                            display: 'flex',
                            alignItems: 'center',
                            '& .MuiSwitch-switchBase': {
                              top: '50%',
                              transform: 'translateY(-50%)',
                              '&.Mui-checked': {
                                transform: 'translateX(12px) translateY(-50%)',
                                color: '#fff',
                                '& + .MuiSwitch-track': {
                                  backgroundColor: '#89AE99',
                                  opacity: 1,
                                },
                              },
                            },
                            '& .MuiSwitch-thumb': {
                              width: 14,
                              height: 14,
                              boxShadow: 'none',
                              backgroundColor: '#fff',
                              transition: 'all 0.3s',
                              position: 'relative',
                              left: '-3px',
                            },
                            '& .MuiSwitch-track': {
                              borderRadius: 18,
                              backgroundColor: '#A8A8A8',
                              opacity: 1,
                              transition: 'all 0.3s',
                            },
                          }}
                        />
                      }
                      label={<span style={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#232B36', fontSize: 16, marginLeft: 2 }}>{prop}</span>}
                      sx={{
                        minWidth: 80,
                        alignItems: 'flex-start',
                        justifyContent: 'flex-start',
                        '.MuiFormControlLabel-label': { fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#232B36', fontSize: 16, marginLeft: 4 },
                        mr: 4,
                        pl: 0.5,
                      }}
                      labelPlacement="end"
                    />
                  );
                }
                return (
                  <FormControlLabel
                    key={prop}
                    control={
                      <Switch
                        checked={friendSelectedProperties.includes(prop)}
                        onChange={() => {
                          const isRemoving = friendSelectedProperties.includes(prop);
                          let newSelected = isRemoving
                            ? friendSelectedProperties.filter(p => p !== prop)
                            : [...friendSelectedProperties, prop];
                          setFriendSelectedProperties(newSelected);
                          // Turn off "All Properties" if any property is toggled off
                          if (isRemoving && friendAllPropsToggle) {
                            setFriendAllPropsToggle(false);
                          }
                        }}
                        sx={{
                          mr: -3,
                          width: 38,
                          height: 22,
                          top: 1,
                          p: 0,
                          display: 'flex',
                          alignItems: 'center',
                          '& .MuiSwitch-switchBase': {
                            top: '50%',
                            transform: 'translateY(-50%)',
                            '&.Mui-checked': {
                              transform: 'translateX(12px) translateY(-50%)',
                              color: '#fff',
                              '& + .MuiSwitch-track': {
                                backgroundColor: '#89AE99',
                                opacity: 1,
                              },
                            },
                          },
                          '& .MuiSwitch-thumb': {
                            width: 14,
                            height: 14,
                            boxShadow: 'none',
                            backgroundColor: '#fff',
                            transition: 'all 0.3s',
                            position: 'relative',
                            
                            left: '-3px',
                          },
                          '& .MuiSwitch-track': {
                            borderRadius: 18,
                            backgroundColor: '#A8A8A8',
                            opacity: 1,
                            transition: 'all 0.3s',
                          },
                        }}
                      />
                    }
                    label={<span style={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#232B36', fontSize: 16, marginLeft: 2 }}>{prop}</span>}
                    sx={{
                      minWidth: 80,
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      '.MuiFormControlLabel-label': { fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#232B36', fontSize: 16, marginLeft: 4 },
                      mr: 2,
                      pl: 0.5,
                    }}
                    labelPlacement="end"
                  />
                );
              })
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 2, position: { xs: 'sticky', sm: 'static' }, bottom: 0, bgcolor: '#fff', pt: { xs: 1.5, sm: 0 } }}>
            <Button
              variant="contained"
              sx={{
                bgcolor: '#89AE99',
                textTransform: 'none',
                borderRadius: 2,
                fontWeight: 600,
                px: 4,
                fontSize: 17,
                boxShadow: 'none',
                color: '#fff',
                fontFamily: 'Nunito, Arial, sans-serif',
                minWidth: 120,
                height: 44,
                '&:hover': { bgcolor: '#89AE99' }
              }}
              disabled={sendingInvite || friendSelectedProperties.length === 0 || !validateEmail(friendEmail)}
              onClick={async () => {
                setSendingInvite(true);
                if (!friendEmail) {
                  setFriendEmailError('Email is required');
                  return;
                } else if (!validateEmail(friendEmail)) {
                  setFriendEmailError('Enter a valid email');
                  return;
                } else {
                  setFriendEmailError('');
                }
                const role = friendIsPropertyManager ? 'PM' : 'Friend';
                let propertyIds: string[] = [];
                if (friendSelectedProperties.includes('All Properties')) {
                  propertyIds = Object.values(propertyIdMap);
                } else {
                  propertyIds = friendSelectedProperties.map(type => propertyIdMap[type]).filter(Boolean);
                }
                // Fetch addressLine1 for selected properties
                let propertyLabel;
                if (propertyIds.length === 1) {
                  console.log(propertyIds[0]);
                  const propSnap = await getDoc(doc(db, 'properties', propertyIds[0]));
                  const propData = propSnap.data();
                  console.log(propData, "==============");
                  propertyLabel = propData?.address1 || 'one property';
                  console.log(propData?.address1, "==============");
                } else if (propertyIds.length > 1) {
                  propertyLabel = `${propertyIds.length} properties`;
                } else {
                  propertyLabel = 'one property';
                }
                try {
                  // Create invite doc with expire = 90 for friend
                  const inviteRef = await addDoc(collection(db, 'invites'), {
                    email: friendEmail,
                    propertyIds,
                    role,
                    invitedAt: new Date(),
                    type: 'friend',
                    expire: friendIsPropertyManager ? 0 : 90,
                  });
                  // Immediately show pending invite
                  setPendingFriendInvites(prev => prev.includes(friendEmail) ? prev : [...prev, friendEmail]);
                  // Extract first name from email (before @) as fallback
                  const firstName = friendEmail.split('@')[0];
                  const inviteLink = `https://us-central1-allproperly.cloudfunctions.net/inviteHandler/invite/${inviteRef.id}`;
                  const auth = getAuth();
                  const inviter = (auth.currentUser && auth.currentUser.displayName) ? auth.currentUser.displayName : 'Someone';
                  const textMsg = `Hi ${firstName},\n\nYou’ve been invited to join AllProperly to help manage:\n${propertyLabel}\n\nWith AllProperly.com you’ll:\n    •    See upcoming tasks and reminders\n    •    Mark tasks as complete so everyone stays in sync\n    •    Help keep this property in proper order\n\nGetting started is quick - just click below to accept your invite and create your account (it’s free to join when you’ve been invited).\n\nAccept Invite → ${inviteLink}\n\nYour house won’t text you when it needs something… but AllProperly will.`;
                  const htmlMsg = `<!DOCTYPE html>
                    <html lang="en">
                      <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>AllProperly Property Invite</title>

                        <!-- Google Fonts -->
                        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" type="text/css">

                        <!-- Responsive Styles -->
                        <style>
                          @media only screen and (max-width:600px) {
                            .container {
                              width: 100% !important;
                            }
                            .stack-column,
                            .stack-column td {
                              display: block !important;
                              width: 100% !important;
                              text-align: center !important;
                              padding: 10px 0px !important;
                            }
                            img {
                              max-width: 100% !important;
                              height: auto !important;
                            }
                          }
                        </style>
                      </head>
                      <body style="background:#475567; margin:0; padding:20px; font-family:Nunito, Arial, sans-serif;">

                        <!-- Outer Wrapper -->
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center">

                              <!-- Main Container -->
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="650" class="container" 
                                    style="max-width:650px; background:#ffffff; border:1px solid #e4e9f0; border-radius:10px; padding:20px;">

                                <!-- Logo -->
                                <tr>
                                  <td align="center" style="padding:20px;">
                                      <img src="https://allproperly.com/invite_email/logo.png" 
                                          alt="AllProperly Logo" width="200"
                                          style="display:block; border:0; outline:none; text-decoration:none;">
                                  </td>
                                </tr>

                                <!-- Header Text -->
                                <tr>
                                  <td align="center" style="color:#475567; font-size:36px; font-weight:bold; padding:20px 20px 10px;">
                                    You’ve been invited to <br> collaborate!
                                  </td>
                                </tr>

                                <!-- Banner Image -->
                                <tr>
                                  <td align="center" style="padding:10px 20px;">
                                    <img src="https://allproperly.com/invite_email/invite.png" 
                                        alt="Property Invite" width="500"
                                        style="max-width:100%; display:block; border:0; outline:none; text-decoration:none;">
                                  </td>
                                </tr>

                                <!-- Invite Text -->
                                <tr>
                                  <td align="center" style="color:#475567; font-size:16px; line-height:24px; padding:20px 30px;">
                                    <strong>${inviter}</strong> added you to <strong>${propertyLabel}</strong> on AllProperly.com<br>
                                    because you have been selected to play an important role in helping manage this property.
                                  </td>
                                </tr>

                                <!-- Benefits Title -->
                                <tr>
                                  <td align="left" style="color:#475567; font-size:15px; font-weight:bold; padding:10px; padding-left: 7.3%;">
                                    By accepting, you’ll be able to:
                                  </td>
                                </tr>

                                <!-- Benefits List -->
                                <tr>
                                  <td align="left" style="color:#475567; font-size:15px; line-height:25px; padding:10px; padding-left: 10%; padding-top:0px;">
                                    <ul style="text-align:left; display:inline-block; padding:0; margin:0;">
                                      <li>See what needs to get done</li>
                                      <li>Mark tasks complete when you handle them</li>
                                      <li>Access property details anytime, anywhere</li>
                                    </ul>
                                  </td>
                                </tr>

                                <!-- Closing Line -->
                                <tr>
                                  <td align="center" style="color:#475567; font-size:16px; padding:10px; padding-top:18px;">
                                    This way, everyone involved can stay on the same page.
                                  </td>
                                </tr>

                                <!-- Call To Action -->
                                <tr>
                                  <td align="center" style="padding:15px 20px 30px;">
                                    <a href="${inviteLink}" target="_blank"
                                      style="background:#89AE99; color:#ffffff; text-decoration:none; 
                                              font-size:16px; font-weight:600; padding:12px 28px; 
                                              border-radius:8px; display:inline-block;">
                                      Accept Invitation →
                                    </a>
                                  </td>
                                </tr>

                                <!-- Features Section -->
                                <tr>
                                  <td style="background:#f5f8f6; border:1px solid #e4e9f0; border-radius:10px; padding:20px;">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                                      <!-- Title -->
                                      <tr>
                                        <td colspan="3" align="center" style="color:#475567; font-size:18px; font-weight:bold; padding:10px 0 20px;">
                                          Why collaborate with AllProperly?
                                        </td>
                                      </tr>

                                      <!-- Columns -->
                                      <tr class="stack-column">
                                        <!-- Property Dashboard -->
                                        <td align="center" width="33.33%" style="padding:10px">
                                          <img src="https://allproperly.com/invite_email/dashbord.png" alt="Property Dashboard" width="60"
                                              style="display:block; margin:0 auto 10px;">
                                          <div style="font-size:14px; font-weight:bold; color:#475567;">Property Dashboard</div>
                                          <div style="font-size:14px; color:#475567; line-height:18px; padding-top:5px;">
                                            See all details in one place.
                                          </div>
                                        </td>

                                        <!-- Organize Tasks -->
                                        <td align="center" width="33.33%" style="padding:10px">
                                          <img src="https://allproperly.com/invite_email/checklist.png" alt="Organize Tasks" width="60"
                                              style="display:block; margin:0 auto 10px;">
                                          <div style="font-size:14px; font-weight:bold; color:#475567;">Organize Tasks</div>
                                          <div style="font-size:14px; color:#475567; line-height:18px; padding-top:5px;">
                                            Stay on top of every reminder.
                                          </div>
                                        </td>

                                        <!-- Shared Access -->
                                        <td align="center" width="33.33%" style="padding:10px">
                                          <img src="https://allproperly.com/invite_email/shared.png" alt="Shared Access" width="60"
                                              style="display:block; margin:0 auto 10px;">
                                          <div style="font-size:14px; font-weight:bold; color:#475567;">Shared Access</div>
                                          <div style="font-size:14px; color:#475567; line-height:18px; padding-top:5px;">
                                            Work with family & managers.
                                          </div>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                  <td align="center" style="color:#475567; font-size:14px; line-height:22px; padding:20px;">
                                    You’re receiving this email because someone invited you to collaborate on AllProperly.com.
                                  </td>
                                </tr>
                                <tr>
                                  <td align="center" style="color:#475567; font-size:14px; line-height:22px; padding:0 20px 20px;">
                                    © 2025 All Properly LLC.
                                  </td>
                                </tr>

                              </table>
                              <!-- End Container -->

                            </td>
                          </tr>
                        </table>
                        <!-- End Wrapper -->

                      </body>
                    </html>
                  `;
                  await addDoc(collection(db, 'mail'), {
                    invite_id: inviteRef.id,
                    to: friendEmail,
                    subject: `You're invited to join AllProperly!`,
                    text: textMsg,
                    html: htmlMsg,
                    from: 'notify@allproperly.com',
                    headers: { 'X-PM-Message-Stream': 'outbound' }
                  });
                  setFriendIsPropertyManager(false); // Reset toggle
                  handleCloseFriend();
                  // Optionally show a success message (snackbar, etc.)
                } catch (err) {
                  alert('Failed to send invite.');
                }
                setSendingInvite(false);
              }}
            >
              {sendingInvite ? "Sending Invite..." : "Send Invite"}
            </Button>
          </Box>
        </Box>
      </Modal>
      </Box>

      {/* Member Details Modal (outside map) */}
      <Modal open={memberDetailsOpen} onClose={() => setMemberDetailsOpen(false)} aria-labelledby="member-details-modal" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ bgcolor: '#fff', borderRadius: { xs: 0, sm: 2 }, p: { xs: 2, sm: 4 }, minWidth: 0, maxWidth: 500, boxShadow: 6, outline: 'none', width: { xs: '100vw', sm: '90vw' }, maxHeight: { xs: '100dvh', sm: '90dvh' }, height: { xs: '100dvh', sm: 'auto' }, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
            <Avatar src={selectedMember?.avatar} sx={{ width: 64, height: 64 }} />
            <Box>
              <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: "#212121", fontWeight: 550, fontSize: 20 }}>{selectedMember?.name}</Typography>
              <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 16, color: "#212121" }}>{selectedMember?.role || 'Family Member'}</Typography>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <FormControlLabel
              control={<Switch checked={memberIsCoOwner} onChange={e => setMemberIsCoOwner(e.target.checked)}
                sx={{
                  ml: 2,
                  width: 38,
                  height: 22,
                  top: 1,
                  p: 0,
                  display: 'flex',
                  alignItems: 'center',
                  '& .MuiSwitch-switchBase': {
                    top: '50%',
                    transform: 'translateY(-50%)',
                    '&.Mui-checked': {
                      transform: 'translateX(12px) translateY(-50%)',
                      color: '#fff',
                      '& + .MuiSwitch-track': {
                        backgroundColor: '#89AE99',
                        opacity: 1,
                      },
                    },
                  },
                  '& .MuiSwitch-thumb': {
                    width: 14,
                    height: 14,
                    boxShadow: 'none',
                    backgroundColor: '#fff',
                    transition: 'all 0.3s',
                    position: 'relative',
                    
                    left: '-3px',
                  },
                  '& .MuiSwitch-track': {
                    borderRadius: 18,
                    backgroundColor: '#A8A8A8',
                    opacity: 1,
                    transition: 'all 0.3s',
                  },
                }}
              />}
              label={<Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 18, color: "#212121", ml: 1 }}>Co-owner</Typography>}
              sx={{ ml: 0 }}
            />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2, width: '100%' }}>
            {/* All Properties toggle logic */}
            {propertyNames.length > 0 && (
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                width: '100%',
                mb: 2,
                ml: 2.5,
              }}>
                {/* All Properties toggle first */}
                <FormControlLabel
                  key="All Properties"
                  control={
                    <Switch
                      checked={memberAllPropsToggle}
                      onChange={e => {
                        if (e.target.checked) {
                          setMemberProperties(propertyNames.filter(p => p !== 'All Properties'));
                          setMemberAllPropsToggle(true);
                        } else {
                          setMemberProperties([]);
                          setMemberAllPropsToggle(false);
                        }
                      }}
                      sx={{
                        mr: 1,
                        width: 38,
                        height: 22,
                        top: 1,
                        p: 0,
                        display: 'flex',
                        alignItems: 'center',
                        '& .MuiSwitch-switchBase': {
                          top: '50%',
                          transform: 'translateY(-50%)',
                          '&.Mui-checked': {
                            transform: 'translateX(12px) translateY(-50%)',
                            color: '#fff',
                            '& + .MuiSwitch-track': {
                              backgroundColor: '#89AE99',
                              opacity: 1,
                            },
                          },
                        },
                        '& .MuiSwitch-thumb': {
                          width: 14,
                          height: 14,
                          boxShadow: 'none',
                          backgroundColor: '#fff',
                          transition: 'all 0.3s',
                          position: 'relative',
                          
                          left: '-3px',
                        },
                        '& .MuiSwitch-track': {
                          borderRadius: 18,
                          backgroundColor: '#A8A8A8',
                          opacity: 1,
                          transition: 'all 0.3s',
                        },
                      }}
                    />
                  }
                  label={<Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: "#212121", fontWeight: 400, fontSize: 15, ml: 0.5 }}>All Properties</Typography>}
                  sx={{ minWidth: 180, mr: 1, mb: 1 }}
                />
                {/* Individual property toggles */}
                {propertyNames.filter(p => p !== 'All Properties').map((prop) => (
                  <FormControlLabel
                    key={prop}
                    control={
                      <Switch
                        checked={memberProperties.includes(prop)}
                        onChange={() => {
                          const isRemoving = memberProperties.includes(prop);
                          let updated;
                          if (isRemoving) {
                            updated = memberProperties.filter(p => p !== prop);
                          } else {
                            updated = [...memberProperties, prop];
                          }
                          setMemberProperties(updated);
                          // Turn off "All Properties" if any property is toggled off
                          if (isRemoving && memberAllPropsToggle) {
                            setMemberAllPropsToggle(false);
                          }
                        }}
                        sx={{
                          mr: -0.5,
                          width: 38,
                          height: 22,
                          top: 1,
                          p: 0,
                          display: 'flex',
                          alignItems: 'center',
                          '& .MuiSwitch-switchBase': {
                            top: '50%',
                            transform: 'translateY(-50%)',
                            '&.Mui-checked': {
                              transform: 'translateX(12px) translateY(-50%)',
                              color: '#fff',
                              '& + .MuiSwitch-track': {
                                backgroundColor: '#89AE99',
                                opacity: 1,
                              },
                            },
                          },
                          '& .MuiSwitch-thumb': {
                            width: 14,
                            height: 14,
                            boxShadow: 'none',
                            backgroundColor: '#fff',
                            transition: 'all 0.3s',
                            position: 'relative',
                            
                            left: '-3px',
                          },
                          '& .MuiSwitch-track': {
                            borderRadius: 18,
                            backgroundColor: '#A8A8A8',
                            opacity: 1,
                            transition: 'all 0.3s',
                          },
                        }}
                      />
                    }
                    label={<Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: "#212121", fontWeight: 400, fontSize: 15, ml: 2 }}>{prop}</Typography>}
                    sx={{ minWidth: 180, mr: 1, mb: 1}}
                  />
                ))}
              </Box>
            )}
          </Box>
          <Button variant="contained" sx={{ fontFamily: 'Nunito, Arial, sans-serif', textTransform: 'none', bgcolor: '#89AE99', color: '#fff', fontWeight: 200, fontSize: 16, borderRadius: 2, px: 4, py: 1, alignSelf: 'flex-end' }} onClick={() => setMemberDetailsOpen(false)}>
            Update
          </Button>
        </Box>
      </Modal>
      
      {/* Invite Member Modal */}
      <Modal open={inviteOpen} onClose={handleCloseInvite} aria-labelledby="invite-member-modal" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ bgcolor: '#fff', borderRadius: { xs: 0, sm: 2 }, p: { xs: 2, sm: 3 }, minWidth: 0, width: { xs: '100vw', sm: '70vw', md: '55vw' }, maxWidth: 760, maxHeight: { xs: '100dvh', sm: '90dvh' }, height: { xs: '100dvh', sm: 'auto' }, overflowY: 'auto', boxShadow: 6, outline: 'none' }}>
          <Typography variant="h6" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 2, fontSize: 19, color: '#232B36' }}>Invite Member to Household</Typography>
          <Box sx={{ fontFamily: 'Nunito, Arial, sans-serif', bgcolor: '#F6A94A', color: '#222', borderRadius: 1, p: '13px 16px', mb: 3, fontSize: 17, fontWeight: 400, lineHeight: 1.35 }}>
            IMPORTANT: Members you invite will have full access to your household’s data. You should only invite people you trust.
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 16, color: '#232B36', fontWeight: 400, minWidth: 170 }}>Invite via Email Address:</Typography>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={
                  <Switch checked={isCoOwner} onChange={e => setIsCoOwner(e.target.checked)}
                    sx={{
                      ml: 2,
                      width: 38,
                      height: 22,
                      top: 1,
                      p: 0,
                      display: 'flex',
                      alignItems: 'center',
                      '& .MuiSwitch-switchBase': {
                        top: '50%',
                        transform: 'translateY(-50%)',
                        '&.Mui-checked': {
                          transform: 'translateX(12px) translateY(-50%)',
                          color: '#fff',
                          '& + .MuiSwitch-track': {
                            backgroundColor: '#89AE99',
                            opacity: 1,
                          },
                        },
                      },
                      '& .MuiSwitch-thumb': {
                        width: 14,
                        height: 14,
                        boxShadow: 'none',
                        backgroundColor: '#fff',
                        transition: 'all 0.3s',
                        position: 'relative',
                        
                        left: '-3px',
                      },
                      '& .MuiSwitch-track': {
                        borderRadius: 18,
                        backgroundColor: '#A8A8A8',
                        opacity: 1,
                        transition: 'all 0.3s',
                      },
                    }}
                  />
                }
                label={<span style={{ fontWeight: 400, color: '#232B36', fontSize: 16 }}>Co-owner</span>}
                labelPlacement="start"
                sx={{ ml: 0, mr: 0, mb: 0, '.MuiFormControlLabel-label': { fontWeight: 400, color: '#232B36', fontSize: 16 } }}
              />
            </Box>
          </Box>
          <TextField
            fullWidth
            value={inviteEmail}
            onChange={e => {
              setInviteEmail(e.target.value);
              setInviteEmailError(''); // Clear error on input, do not validate
            }}
            error={!!inviteEmailError}
            helperText={inviteEmailError}
            placeholder=""
            sx={{ mb: 2, mt: 0, bgcolor: '#fff', borderRadius: 2, fontSize: 17, '& .MuiInputBase-root': { fontSize: 17, py: 1.2, px: 1.5 } }}
            inputProps={{ style: { padding: '12px 12px', fontSize: 17 } }}
          />
          {/* Property selection pills */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
            mb: 1,
            mt: 0,
            alignItems: 'center',
            maxWidth: 420,
            mx: 'auto',
            justifyItems: 'start',
          }}>
            {propertyNames.length === 0 ? (
              <Box sx={{ gridColumn: '1 / -1', width: '100%' }}>
                <EmptyState
                  iconType="property"
                  compact
                  title="No Properties Added"
                  description="Add a property first to invite members."
                  minHeight={160}
                />
              </Box>
            ) : (
              propertyNames.map((prop) => {
                if (prop === 'All Properties') {
                  const allPropsExceptAll = propertyNames.filter(p => p !== 'All Properties');
                  return (
                    <FormControlLabel
                      key={prop}
                      control={
                        <Switch
                          checked={familyAllPropsToggle}
                          onChange={() => {
                            if (familyAllPropsToggle) {
                              setSelectedProperties([]);
                              setFamilyAllPropsToggle(false);
                            } else {
                              setSelectedProperties(allPropsExceptAll);
                              setFamilyAllPropsToggle(true);
                            }
                          }}
                          sx={{
                            mr: -1,
                            width: 38,
                            height: 22,
                            top: 1,
                            p: 0,
                            display: 'flex',
                            alignItems: 'center',
                            '& .MuiSwitch-switchBase': {
                              top: '50%',
                              transform: 'translateY(-50%)',
                              '&.Mui-checked': {
                                transform: 'translateX(12px) translateY(-50%)',
                                color: '#fff',
                                '& + .MuiSwitch-track': {
                                  backgroundColor: '#89AE99',
                                  opacity: 1,
                                },
                              },
                            },
                            '& .MuiSwitch-thumb': {
                              width: 14,
                              height: 14,
                              boxShadow: 'none',
                              backgroundColor: '#fff',
                              transition: 'all 0.3s',
                              position: 'relative',
                              left: '-3px',
                            },
                            '& .MuiSwitch-track': {
                              borderRadius: 18,
                              backgroundColor: '#A8A8A8',
                              opacity: 1,
                              transition: 'all 0.3s',
                            },
                          }}
                        />
                      }
                      label={<span style={{ fontWeight: 400, color: '#232B36', fontSize: 16, marginLeft: 2 }}>{prop}</span>}
                      sx={{
                        minWidth: 180,
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        '.MuiFormControlLabel-label': { fontWeight: 400, color: '#232B36', fontSize: 16, marginLeft: 2 },
                      }}
                      labelPlacement="end"
                    />
                  );
                }
                return (
                  <FormControlLabel
                    key={prop}
                    control={
                      <Switch
                        checked={selectedProperties.includes(prop)}
                        onChange={() => {
                          const isRemoving = selectedProperties.includes(prop);
                          let newSelected = isRemoving
                            ? selectedProperties.filter(p => p !== prop)
                            : [...selectedProperties, prop];
                          setSelectedProperties(newSelected);
                          // Turn off "All Properties" if any property is toggled off
                          if (isRemoving && familyAllPropsToggle) {
                            setFamilyAllPropsToggle(false);
                          }
                        }}
                        sx={{
                          mr: -1,
                          width: 38,
                          height: 22,
                          top: 1,
                          p: 0,
                          display: 'flex',
                          alignItems: 'center',
                          '& .MuiSwitch-switchBase': {
                            top: '50%',
                            transform: 'translateY(-50%)',
                            '&.Mui-checked': {
                              transform: 'translateX(12px) translateY(-50%)',
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
                            
                            left: '-3px',
                          },
                          '& .MuiSwitch-track': {
                            borderRadius: 18,
                            backgroundColor: '#A8A8A8',
                            opacity: 1,
                            transition: 'all 0.3s',
                          },
                        }}
                      />
                    }
                    label={<span style={{ fontWeight: 400, color: '#232B36', fontSize: 16, marginLeft: 2 }}>{prop}</span>}
                    sx={{
                      minWidth: 180,
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      '.MuiFormControlLabel-label': { fontWeight: 400, color: '#232B36', fontSize: 16, marginLeft: 2 },
                    }}
                    labelPlacement="end"
                  />
                );
              })
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 2, position: { xs: 'sticky', sm: 'static' }, bottom: 0, bgcolor: '#fff', pt: { xs: 1.5, sm: 0 } }}>
            <Button
              variant="contained"
              sx={{
                bgcolor: '#89AE99',
                textTransform: 'none',
                borderRadius: 2,
                fontWeight: 600,
                px: 4,
                fontFamily: 'Nunito, Arial, sans-serif',
                fontSize: 17,
                boxShadow: 'none',
                color: '#fff',
                minWidth: 120,
                height: 44,
                '&:hover': { bgcolor: '#89AE99' }
              }}
              disabled={sendingInvite || selectedProperties.length === 0 || !validateEmail(inviteEmail)}
              onClick={async () => {
                setSendingInvite(true);
                if (!inviteEmail) {
                  setInviteEmailError('Email is required');
                  return;
                } else if (!validateEmail(inviteEmail)) {
                  setInviteEmailError('Enter a valid email');
                  return;
                } else {
                  setInviteEmailError('');
                }
                const role = isCoOwner ? 'Co-owner' : 'Family Manager';
                let propertyIds: string[] = [];
                if (selectedProperties.includes('All Properties')) {
                  // All property IDs for this user
                  propertyIds = Object.values(propertyIdMap);
                } else {
                  propertyIds = selectedProperties.map(type => propertyIdMap[type]).filter(Boolean);
                }
                // Fetch addressLine1 for selected properties
                let propertyLabel = '';
                if (propertyIds.length === 1) {
                  console.log(propertyIds[0]);
                  const propSnap = await getDoc(doc(db, 'properties', propertyIds[0]));
                  const propData = propSnap.data();
                  console.log(propData, "==============");
                  propertyLabel = propData?.address1 || 'one property';
                  console.log(propData?.address1, "==============");
                } else if (propertyIds.length > 1) {
                  propertyLabel = `${propertyIds.length} properties`;
                } else {
                  propertyLabel = 'one property';
                }
                try {
                  // Create invite doc with expire = null for household
                  const inviteRef = await addDoc(collection(db, 'invites'), {
                    email: inviteEmail,
                    propertyIds,
                    role,
                    invitedAt: new Date(),
                    type: 'household',
                    expire: null,
                  });
                  // Immediately show pending invite
                  setPendingHouseholdInvites(prev => prev.includes(inviteEmail) ? prev : [...prev, inviteEmail]);
                  // Extract first name from email (before @) as fallback
                  const firstName = inviteEmail.split('@')[0];
                  const auth = getAuth();
                  const inviter = (auth.currentUser && auth.currentUser.displayName) ? auth.currentUser.displayName : 'Someone';
                  const inviteLink = `https://us-central1-allproperly.cloudfunctions.net/inviteHandler/invite/${inviteRef.id}`;
                  const textMsg = `Hi ${firstName},\n\nYou’ve been invited to join AllProperly to help manage:\n${propertyLabel}\n\nWith AllProperly.com you’ll:\n    •    See upcoming tasks and reminders\n    •    Mark tasks as complete so everyone stays in sync\n    •    Help keep this property in proper order\n\nGetting started is quick - just click below to accept your invite and create your account (it’s free to join when you’ve been invited).\n\nAccept Invite → ${inviteLink}\n\nYour house won’t text you when it needs something… but AllProperly will.`;
                  const htmlMsg = `<!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>AllProperly Property Invite</title>

                                  <!-- Google Fonts -->
                                  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" type="text/css">

                                  <!-- Responsive Styles -->
                                  <style>
                                    @media only screen and (max-width:600px) {
                                      .container {
                                        width: 100% !important;
                                      }
                                      .stack-column,
                                      .stack-column td {
                                        display: block !important;
                                        width: 100% !important;
                                        text-align: center !important;
                                        padding: 10px 0px !important;
                                      }
                                      img {
                                        max-width: 100% !important;
                                        height: auto !important;
                                      }
                                    }
                                  </style>
                                </head>
                                <body style="background:#475567; margin:0; padding:20px; font-family:Nunito, Arial, sans-serif;">

                                  <!-- Outer Wrapper -->
                                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                      <td align="center">

                                        <!-- Main Container -->
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="650" class="container" 
                                              style="max-width:650px; background:#ffffff; border:1px solid #e4e9f0; border-radius:10px; padding:20px;">

                                          <!-- Logo -->
                                          <tr>
                                            <td align="center" style="padding:20px;">
                                                <img src="https://allproperly.com/invite_email/logo.png" 
                                                    alt="AllProperly Logo" width="200"
                                                    style="display:block; border:0; outline:none; text-decoration:none;">
                                            </td>
                                          </tr>

                                          <!-- Header Text -->
                                          <tr>
                                            <td align="center" style="color:#475567; font-size:36px; font-weight:bold; padding:20px 20px 10px;">
                                              You’ve been invited to <br> collaborate!
                                            </td>
                                          </tr>

                                          <!-- Banner Image -->
                                          <tr>
                                            <td align="center" style="padding:10px 20px;">
                                              <img src="https://allproperly.com/invite_email/invite.png" 
                                                   alt="Property Invite" width="500"
                                                   style="max-width:100%; display:block; border:0; outline:none; text-decoration:none;">
                                            </td>
                                          </tr>

                                          <!-- Invite Text -->
                                          <tr>
                                            <td align="center" style="color:#475567; font-size:16px; line-height:24px; padding:20px 30px;">
                                              <strong>${inviter}</strong> added you to <strong>${propertyLabel}</strong> on AllProperly.com<br>
                                              because you have been selected to play an important role in helping manage this property.
                                            </td>
                                          </tr>

                                          <!-- Benefits Title -->
                                          <tr>
                                            <td align="left" style="color:#475567; font-size:15px; font-weight:bold; padding:10px; padding-left: 7.3%;">
                                              By accepting, you’ll be able to:
                                            </td>
                                          </tr>

                                          <!-- Benefits List -->
                                          <tr>
                                            <td align="left" style="color:#475567; font-size:15px; line-height:25px; padding:10px; padding-left: 10%; padding-top:0px;">
                                              <ul style="text-align:left; display:inline-block; padding:0; margin:0;">
                                                <li>See what needs to get done</li>
                                                <li>Mark tasks complete when you handle them</li>
                                                <li>Access property details anytime, anywhere</li>
                                              </ul>
                                            </td>
                                          </tr>

                                          <!-- Closing Line -->
                                          <tr>
                                            <td align="center" style="color:#475567; font-size:16px; padding:10px; padding-top:18px;">
                                              This way, everyone involved can stay on the same page.
                                            </td>
                                          </tr>

                                          <!-- Call To Action -->
                                          <tr>
                                            <td align="center" style="padding:15px 20px 30px;">
                                              <a href="${inviteLink}" target="_blank"
                                                 style="background:#89AE99; color:#ffffff; text-decoration:none; 
                                                        font-size:16px; font-weight:600; padding:12px 28px; 
                                                        border-radius:8px; display:inline-block;">
                                                Accept Invitation →
                                              </a>
                                            </td>
                                          </tr>

                                          <!-- Features Section -->
                                          <tr>
                                            <td style="background:#f5f8f6; border:1px solid #e4e9f0; border-radius:10px; padding:20px;">
                                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                                                <!-- Title -->
                                                <tr>
                                                  <td colspan="3" align="center" style="color:#475567; font-size:18px; font-weight:bold; padding:10px 0 20px;">
                                                    Why collaborate with AllProperly?
                                                  </td>
                                                </tr>

                                                <!-- Columns -->
                                                <tr class="stack-column">
                                                  <!-- Property Dashboard -->
                                                  <td align="center" width="33.33%" style="padding:10px">
                                                    <img src="https://allproperly.com/invite_email/dashbord.png" alt="Property Dashboard" width="60"
                                                         style="display:block; margin:0 auto 10px;">
                                                    <div style="font-size:14px; font-weight:bold; color:#475567;">Property Dashboard</div>
                                                    <div style="font-size:14px; color:#475567; line-height:18px; padding-top:5px;">
                                                      See all details in one place.
                                                    </div>
                                                  </td>

                                                  <!-- Organize Tasks -->
                                                  <td align="center" width="33.33%" style="padding:10px">
                                                    <img src="https://allproperly.com/invite_email/checklist.png" alt="Organize Tasks" width="60"
                                                         style="display:block; margin:0 auto 10px;">
                                                    <div style="font-size:14px; font-weight:bold; color:#475567;">Organize Tasks</div>
                                                    <div style="font-size:14px; color:#475567; line-height:18px; padding-top:5px;">
                                                      Stay on top of every reminder.
                                                    </div>
                                                  </td>

                                                  <!-- Shared Access -->
                                                  <td align="center" width="33.33%" style="padding:10px">
                                                    <img src="https://allproperly.com/invite_email/shared.png" alt="Shared Access" width="60"
                                                         style="display:block; margin:0 auto 10px;">
                                                    <div style="font-size:14px; font-weight:bold; color:#475567;">Shared Access</div>
                                                    <div style="font-size:14px; color:#475567; line-height:18px; padding-top:5px;">
                                                      Work with family & managers.
                                                    </div>
                                                  </td>
                                                </tr>
                                              </table>
                                            </td>
                                          </tr>

                                          <!-- Footer -->
                                          <tr>
                                            <td align="center" style="color:#475567; font-size:14px; line-height:22px; padding:20px;">
                                              You’re receiving this email because someone invited you to collaborate on AllProperly.com.
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="center" style="color:#475567; font-size:14px; line-height:22px; padding:0 20px 20px;">
                                              © 2025 All Properly LLC.
                                            </td>
                                          </tr>

                                        </table>
                                        <!-- End Container -->

                                      </td>
                                    </tr>
                                  </table>
                                  <!-- End Wrapper -->

                                </body>
                                </html>
`;
                  await addDoc(collection(db, 'mail'), {
                    invite_id: inviteRef.id,
                    to: inviteEmail,
                    subject: `You're invited to join AllProperly!`,
                    text: textMsg,
                    html: htmlMsg,
                    from: 'notify@allproperly.com',
                    headers: { 'X-PM-Message-Stream': 'outbound' }
                  });
                  handleCloseInvite();
                  // Optionally show a success message (snackbar, etc.)
                } catch (err) {
                  alert('Failed to send invite.');
                  setSendingInvite(false);
                }
              }}
            >
              {sendingInvite ? "Sending Invite..." : "Send Invite"}
            </Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};
export default SharedAccess;
