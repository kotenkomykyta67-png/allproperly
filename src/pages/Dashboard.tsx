import { listenForTaskEvents } from '../utils/notificationUtil';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, getDocs } from 'firebase/firestore';
import Popper from "@mui/material/Popper";
import UpgradePlans from './UpgradePlans';
import { auth } from "../services/firebase";
import React, { useState, useEffect, Suspense } from "react";
import CloseIcon from '@mui/icons-material/Close';

// Help & Support Modal UI
const HelpSupportModal = ({ open, onClose }: { open: boolean, onClose: () => void }) => (
  <Dialog
    open={open}
    onClose={onClose}
    fullScreen
    PaperProps={{
      sx: {
        bgcolor: '#fff',
        borderRadius: 2,
        maxWidth: 526,
        width: '100%',
        mx: 'auto',
        height: 'fit-content',
        my: 4,
        boxShadow: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 0,
      }
    }}
  >
    <Box sx={{
      p: { xs: 2, sm: 4 },
      position: 'relative',
      minWidth: 0,
      maxWidth: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      boxSizing: 'border-box',
    }}>
      <IconButton onClick={onClose} sx={{ position: 'absolute', right: 16, top: 16 }}>
        <CloseIcon sx={{ fontSize: 32 }} />
      </IconButton>
      <Typography variant="h4" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 4, color: '#343748' }}>Help & Support</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Help Center */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ bgcolor: '#F5F6F8', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="23" height="22" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.32491 11.1176V9.42627" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M12.4552 3.55322C13.5819 3.55322 14.4885 4.46656 14.4885 5.59322V7.88656C12.8485 8.84656 10.6819 9.42656 8.32187 9.42656C5.96187 9.42656 3.80187 8.84656 2.16187 7.88656V5.58656C2.16187 4.45989 3.0752 3.55322 4.20187 3.55322H12.4552Z" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.6586 3.55034V3.30634C10.6586 2.49301 9.99861 1.83301 9.18528 1.83301H7.46528C6.65194 1.83301 5.99194 2.49301 5.99194 3.30634V3.55034" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2.1781 10.3218L2.3041 11.9944C2.38943 13.1218 3.32877 13.9931 4.45877 13.9931H12.1914C13.3214 13.9931 14.2608 13.1218 14.3461 11.9944L14.4721 10.3218" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Box>
          <Box>
            <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 300, fontSize: 20, color: '#212121' }}>Help Center</Typography>
            <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', opacity: 0.8, fontSize: 16 }}>Read more about how to fully utilize AllProperly</Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#B0B8C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Box>
        {/* Feature Request */}
        {/* <Box sx={{ display: 'none', alignItems: 'center', gap: 2 }}>
          <Box sx={{ bgcolor: '#F5F6F8', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M13.4875 4.10229C13.4875 2.26837 12.2337 1.5332 10.4285 1.5332H6.18928C4.43957 1.5332 3.1283 2.21825 3.1283 3.97999V13.7959C3.1283 14.2797 3.64893 14.5845 4.07065 14.3479L8.32529 11.9613L12.5432 14.3439C12.9656 14.5818 13.4875 14.2771 13.4875 13.7925V4.10229Z" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.84241 6.01874H10.7213" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Box>
          <Box>
            <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 300, fontSize: 20, color: '#212121' }}>Feature Request</Typography>
            <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', opacity: 0.8, fontSize: 16 }}>View our product roadmap and vote on features</Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#B0B8C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Box> */}
        {/* Contact Support */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ bgcolor: '#F5F6F8', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M7.01555 7.31476C9.67493 9.97341 10.2782 6.89765 11.9715 8.58971C13.6039 10.2217 14.5421 10.5486 12.4739 12.6163C12.2148 12.8245 10.5688 15.3293 4.78412 9.54628C-1.00127 3.7625 1.50211 2.1148 1.71036 1.8558C3.78363 -0.217599 4.10496 0.726092 5.73738 2.35806C7.43063 4.05083 4.35616 4.65611 7.01555 7.31476Z" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Box>
          <Box>
            <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 300, fontSize: 20, color: '#212121' }}>Contact Support</Typography>
            <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', opacity: 0.8, fontSize: 16 }}>Get in touch with our customer success team</Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#B0B8C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Box>
        {/* What's New */}
        {/* <Box sx={{ display: 'none', alignItems: 'center', gap: 2 }}>
          <Box sx={{ bgcolor: '#F5F6F8', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M10.4354 8.03525C10.4354 9.19925 9.49143 10.1426 8.32743 10.1426C7.16343 10.1426 6.22009 9.19925 6.22009 8.03525C6.22009 6.87058 7.16343 5.92725 8.32743 5.92725C9.49143 5.92725 10.4354 6.87058 10.4354 8.03525Z" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M8.32647 12.9035C10.8651 12.9035 13.1871 11.0781 14.4945 8.03548C13.1871 4.99281 10.8651 3.16748 8.32647 3.16748H8.32913C5.79047 3.16748 3.46847 4.99281 2.16113 8.03548C3.46847 11.0781 5.79047 12.9035 8.32913 12.9035H8.32647Z" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Box>
          <Box>
            <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 300, fontSize: 20, color: '#212121' }}>What’s New</Typography>
            <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', opacity: 0.8, fontSize: 16 }}>Catch up on the latest product improvements</Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#B0B8C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Box> */}
      </Box>
    </Box>
  </Dialog>
);
import { doc } from "firebase/firestore";
import { Dialog, CircularProgress } from "@mui/material";
import BellIcon from '../components/BellIcon';

// Lazy load pages for better code splitting
const Property = React.lazy(() => import('./Property'));
const MainDashboard = React.lazy(() => import('./MainDashboard'));
const Settings = React.lazy(() => import('./Settings'));
const Tasks = React.lazy(() => import('./Tasks'));
const Calendar = React.lazy(() => import('./Calendar'));
const Reports = React.lazy(() => import('./Reports'));
const SharedAccess = React.lazy(() => import('./SharedAccess'));

import { getAuth } from "firebase/auth";
// Reports SVG Icon from Figma

// Shared Access SVG Icon from Figma
// Tasks SVG Icon from Figma

// Calendar SVG Icon from Figma
// Dashboard SVG Icon from Figma

import { Box, Typography, List, ListItemText, Button, Avatar, IconButton, ListItemButton, Paper, Drawer, useMediaQuery } from "@mui/material";
import { useUserAvatar } from '../context/UserAvatarContext';
import Fade from "@mui/material/Fade";

// Help & Support SVG Icon
const HelpSupportIcon = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <mask id="mask0_2829_145" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="2" y="1" width="14" height="15">
      <path fillRule="evenodd" clipRule="evenodd" d="M2.02539 1.71844H15.3587V15.0518H2.02539V1.71844Z" fill="white"/>
    </mask>
    <g mask="url(#mask0_2829_145)">
      <path fillRule="evenodd" clipRule="evenodd" d="M5.80135 2.7184C4.11535 2.7184 3.02535 3.87374 3.02535 5.6624V11.1077C3.02535 12.8964 4.11535 14.0517 5.80135 14.0517H11.58C13.268 14.0517 14.3587 12.8964 14.3587 11.1077V5.6624C14.3587 3.87374 13.268 2.7184 11.5814 2.7184H5.80135ZM11.5801 15.0518H5.80139C3.54272 15.0518 2.02539 13.4664 2.02539 11.1078V5.66244C2.02539 3.30378 3.54272 1.71844 5.80139 1.71844H11.5814C13.8407 1.71844 15.3587 3.30378 15.3587 5.66244V11.1078C15.3587 13.4664 13.8407 15.0518 11.5801 15.0518Z" fill="#343748"/>
    </g>
    <path fillRule="evenodd" clipRule="evenodd" d="M8.68848 11.5517C8.41248 11.5517 8.18848 11.3277 8.18848 11.0517V8.38507C8.18848 8.10907 8.41248 7.88507 8.68848 7.88507C8.96448 7.88507 9.18848 8.10907 9.18848 8.38507V11.0517C9.18848 11.3277 8.96448 11.5517 8.68848 11.5517Z" fill="#343748"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M8.69148 6.52114C8.32282 6.52114 8.02148 6.22314 8.02148 5.85447C8.02148 5.48581 8.31682 5.18781 8.68482 5.18781H8.69148C9.06015 5.18781 9.35815 5.48581 9.35815 5.85447C9.35815 6.22314 9.06015 6.52114 8.69148 6.52114Z" fill="#343748"/>
  </svg>
);

type DashboardProps = {
  defaultPage?: string;
};

const Dashboard: React.FC<DashboardProps> = ({ defaultPage = "dashboard" }) => {
  const { avatarUrl } = useUserAvatar();
  const handleSignOut = async () => {
    const { getAuth, signOut } = await import("firebase/auth");
    const auth = getAuth();
    await signOut(auth);
  };
  // On app start, check all tasks and mark overdue, then send notifications
  useEffect(() => {
    async function checkAndMarkOverdueTasks() {
      const tasksSnap = await getDocs(collection(db, 'tasks'));
      const now = new Date();
      for (const docSnap of tasksSnap.docs) {
        const data = docSnap.data();
        if (
          data.dueDate &&
          new Date(data.dueDate) < now &&
          data.status !== 'completed' &&
          data.status !== 'overdue'
        ) {
          console.log(`Marking task ${docSnap.id} as overdue=========`, data);
          await updateDoc(docSnap.ref, { status: 'overdue' });
        }
      }
    }
    checkAndMarkOverdueTasks();
  }, []);
  // Listen for real-time task assignment/overdue notifications
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const unsubscribe = listenForTaskEvents(user.uid);
      return () => unsubscribe();
    }
  }, []);
  // Helper: Format Firestore timestamp as 'xh ago' or 'ym ago' in US Central Time
  function getCentralTimeAgo(ts: any): string {
    if (!ts) return '';
    // Support Firestore Timestamp or JS Date
    let notifDate;
    if (typeof ts.toDate === 'function') {
      notifDate = ts.toDate();
    } else if (ts instanceof Date) {
      notifDate = ts;
    } else {
      notifDate = new Date(ts);
    }
    // Always convert to US Central Time
    const notifCentral = new Date(notifDate.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const nowCentral = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const diffMs = nowCentral.getTime() - notifCentral.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
  // Real-time notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  //sidbar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const shouldAutoCollapseSidebar = useMediaQuery('(max-width:1279px)');
  const expandedSidebarWidth = 'clamp(220px, 18vw, 300px)';
  const collapsedSidebarWidth = '72px';

  useEffect(() => {
    setIsSidebarCollapsed(shouldAutoCollapseSidebar);
  }, [shouldAutoCollapseSidebar]);

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          read: data.read ?? false // Ensure 'read' property exists
        };
      });
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    });
    return () => unsub();
  }, []);
  // Notification dropdown state
  const [notificationDropdownOpen, setNotificationDropdownOpen] = React.useState(false);
  const notificationAnchorRef = React.useRef<HTMLButtonElement>(null);
  const mobileNotificationAnchorRef = React.useRef<HTMLButtonElement>(null);

  // Mark all unread notifications as read when closing the dropdown
  React.useEffect(() => {
    if (!notificationDropdownOpen && notifications.filter(n => !n.read).length > 0) {
      // Mark all unread notifications as read
      notifications.filter(n => !n.read).forEach(n => {
        updateDoc(doc(db, 'notifications', n.id), { read: true });
      });
    }
  }, [notificationDropdownOpen]);

  // Close notification dropdown when clicking outside
  React.useEffect(() => {
    if (!notificationDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const anchor = notificationAnchorRef.current;
      const dropdown = document.getElementById('notification-dropdown-popper');
      const isInAnchor = anchor && anchor.contains(target);
      const isInDropdown = dropdown && dropdown.contains(target);
      if (!isInAnchor && !isInDropdown) {
        setNotificationDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationDropdownOpen]);

  const NotificationDropdown = (
  <Popper id="notification-dropdown-popper" open={notificationDropdownOpen} anchorEl={notificationAnchorRef.current} placement="bottom-end" style={{ zIndex: 1300 }} transition>
    {({ TransitionProps }) => (
      <Fade {...TransitionProps} timeout={300}>
        <Paper sx={{ mt: 1, minWidth: 420, maxWidth: 420, borderRadius: 2, boxShadow: '0 0 32px 0 rgba(52,55,72,0.18)', bgcolor: '#fff', p: 0 }}>
          <Box sx={{ p: 3, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, color: '#343748', fontSize: 18, mr: 4 }}>Notifications</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="outlined" 
                  sx={{               
                    borderRadius: 2,
                    bgcolor: '#fff',
                    color: '#343748',
                    fontWeight: 400,
                    fontFamily: 'Nunito, Arial, sans-serif',
                    textTransform: 'none',
                    borderColor: '#e0e0e0',
                    px: 1,
                    py: 0.5,
                    fontSize: 14,
                    display: { xs: 'none', md: 'inline-flex' },
                    '&:hover': { background: '#f5f5f5',
                    borderColor: '#B0B0B0' } }} 
                  onClick={async () => {
                  // Delete all notifications (unread and read) using batch for speed
                  const firestore = await import('firebase/firestore');
                  const batch = firestore.writeBatch(db);
                  for (const n of notifications) {
                    batch.delete(firestore.doc(db, 'notifications', n.id));
                  }
                  await batch.commit();
                }}>Clear</Button>
              </Box>
            </Box>
            {/* Unread Section with limit and show more */}
            <Box sx={{ bgcolor: '#F6F6F4', borderRadius: 1, px: 1, py: 1, mb: 1 }}>
              <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, color: '#343748', fontSize: 16 }}>Unread ({unreadCount})</Typography>
            </Box>
            {(() => {
              const unread = notifications.filter(n => !n.read);
              return unread.length > 0 ? (
                <Box sx={{ maxHeight: 260, overflowY: 'auto', pr: 1 }}>
                  {unread.map((notif) => (
                    <Box key={notif.id} sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                      <Avatar src={notif.type === 'task_completed' ? '/gift.svg' : '/calendar.svg'} sx={{ width: 40, height: 40, bgcolor: '#F5F6F8', mr: 2, mt: 0.5 }} />
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 15, color: '#343748', lineHeight: 1.2 }}>
                          {notif.type === 'task_assigned'
                            ? 'Task Assigned'
                            : notif.type === 'task_completed'
                            ? 'Task Completed'
                            : notif.type === 'task_overdue'
                            ? 'Task Overdue'
                            : notif.title || 'Notification'}
                        </Typography>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 200, fontSize: 13, color: '#343748', mt: 0.5 }}>{notif.message}</Typography>
                      </Box>
                      {notif.createdAt && (
                        <Typography sx={{ color: '#343748', fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, ml: 2, minWidth: 40, textAlign: 'right', mt: 0.5 }}>
                          {getCentralTimeAgo(notif.createdAt).replace(' ago', '')}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography sx={{ textTransform: 'none', color: '#343748', fontSize: 14, fontWeight: 400, textAlign: 'center', py: 2 }}>No unread notifications.</Typography>
              );
            })()}
            {/* Read Section with limit and show more */}
            <Box sx={{ bgcolor: '#F6F6F4', borderRadius: 1, px: 1, py: 1, mb: 1 }}>
              <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, color: '#343748', fontSize: 16 }}>
                Read ({notifications.filter(n => n.read).length})
              </Typography>
            </Box>
            {(() => {
              const read = notifications.filter(n => n.read);
              return read.length > 0 ? (
                <Box sx={{ maxHeight: 260, overflowY: 'auto', pr: 1 }}>
                  {read.map((notif) => (
                    <Box key={notif.id} sx={{ display: 'flex', alignItems: 'flex-start', mb: 2, opacity: 0.6 }}>
                      <Avatar src={notif.type === 'task_completed' ? '/gift.svg' : '/calendar.svg'} sx={{ width: 40, height: 40, bgcolor: '#F5F6F8', mr: 2, mt: 0.5 }} />
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography sx={{ fontWeight: 550, fontSize: 15, fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', lineHeight: 1.2 }}>
                          {notif.type === 'task_assigned' ? 'Task Assigned' : notif.type === 'task_completed' ? 'Task Completed' : notif.title || 'Notification'}
                        </Typography>
                        <Typography sx={{ fontWeight: 200, fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14, color: '#343748', mt: 0.5 }}>{notif.message}</Typography>
                      </Box>
                      {notif.createdAt && (
                        <Typography sx={{ color: '#343748', fontSize: 14, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, ml: 2, minWidth: 40, textAlign: 'right', mt: 0.5 }}>
                          {getCentralTimeAgo(notif.createdAt).replace(' ago', '')}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#343748', fontSize: 16, fontWeight: 400, textAlign: 'center', py: 2 }}>No read notifications.</Typography>
              );
            })()}
            {/* No notifications at all - removed, since section-specific labels are shown */}
          </Box>
        </Paper>
      </Fade>
    )}
  </Popper>
  );
  // All hooks at the top
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const avatarButtonRef = React.useRef<HTMLDivElement>(null);
  // Close user menu when clicking outside
  React.useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isInMenu = userMenuRef.current && userMenuRef.current.contains(target);
      const isInAvatar = avatarButtonRef.current && avatarButtonRef.current.contains(target);
      if (!isInMenu && !isInAvatar) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileAccountPopupOpen, setMobileAccountPopupOpen] = useState(false);
  const carouselRef = React.useRef<HTMLDivElement>(null!);
  const [page, setPage] = useState(defaultPage);

  // Ensure page updates when defaultPage prop changes (for upgrade redirect)
  useEffect(() => {
    if (defaultPage && defaultPage !== page) {
      setPage(defaultPage);
    }
  }, [defaultPage]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [hasOwnedProperties, setHasOwnedProperties] = useState(true); // Assume true until checked

  // Check if user has any owned properties (for disabling Shared Access tab)
  useEffect(() => {
    async function checkOwnedProperties() {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      const ownedQ = query(collection(db, "properties"), where("ownerId", "==", user.uid));
      const ownedSnap = await getDocs(ownedQ);
      setHasOwnedProperties(ownedSnap.docs.length > 0);
    }
    checkOwnedProperties();
  }, []);

  // Save page and propertyId to sessionStorage on change
  useEffect(() => {
    if (page === 'property') {
      sessionStorage.setItem('lastPage', JSON.stringify({ page, propertyId: selectedPropertyId }));
    } else {
      console.log(page);
      sessionStorage.setItem('lastPage', JSON.stringify({ page }));
    }
  }, [page, selectedPropertyId]);
 
  React.useEffect(() => {
    console.log("Page changed to:", page, "Selected Property ID:", selectedPropertyId);
    if (page === "property" && !selectedPropertyId) {
      const fetchFirstProperty = async () => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;
        const { db } = await import("../services/firebase");
        const userId = user.uid;
        // Fetch owned properties
        const ownedQ = query(collection(db, "properties"), where("ownerId", "==", userId));
        const ownedSnap = await getDocs(ownedQ);
        const ownedDocs = ownedSnap.docs;
        // Fetch all properties and filter shared ones in JS
        const allPropsSnap = await getDocs(collection(db, "properties"));
        const sharedDocs = allPropsSnap.docs.filter(doc => {
          const data = doc.data();
          return Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === userId);
        });
        // Combine all properties
        const allDocs = [...ownedDocs, ...sharedDocs.filter(sd => !ownedDocs.some(od => od.id === sd.id))];
        if (allDocs.length > 0) {
          // Try to find 'Our Home' property first
          const ourHomeDoc = allDocs.find(doc => (doc.data().type === "Our Home"));
          if (ourHomeDoc) {
            setSelectedPropertyId(ourHomeDoc.id);
          } else {
            setSelectedPropertyId(allDocs[0].id);
          }
        }
      };
      fetchFirstProperty();
    }
  }, [page, selectedPropertyId]);

  return (
    <Box
      sx={{
        '--app-sidebar-width': { xs: '0px', md: isSidebarCollapsed ? collapsedSidebarWidth : expandedSidebarWidth },
        display: 'flex',
        minHeight: '100vh',
        bgcolor: '#F9F9F9',
        fontFamily: 'Nunito, Arial, sans-serif',
        maxWidth: '100%',
        overflowX: 'hidden',
      }}
    >
      {/* Mobile top bar: hamburger + page title + bell (only on small screens) */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, position: 'fixed', top: 0, left: 0, right: 0, height: 48, bgcolor: '#fff', borderBottom: '1px solid #e8e8e8', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: '6px', pb: '2px', zIndex: 1100 }}>
        <IconButton onClick={() => setMobileDrawerOpen(true)} edge="start" sx={{ p: 0.5 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="#444" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </IconButton>
        <Typography sx={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {(() => {
            const titles: Record<string, string> = { dashboard: 'Dashboard', property: 'Properties', task: 'Tasks', calendar: 'Calendar', reports: 'Reports', sharedaccess: 'Shared Access', setting: 'Settings', upgrade: 'Upgrade' };
            return titles[page] || 'Dashboard';
          })()}
        </Typography>
        <IconButton
          size="small"
          onClick={() => setNotificationDropdownOpen((open) => !open)}
          ref={mobileNotificationAnchorRef}
          aria-label="Notifications"
          sx={{ p: 0.5, '& svg': { width: 20, height: 20 } }}
        >
          <BellIcon hasUnread={unreadCount > 0} />
        </IconButton>
      </Box>
      {/* Mobile nav drawer */}
      <Drawer anchor="left" open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} PaperProps={{ sx: { width: 'min(84vw, 340px)', bgcolor: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', height: '100%' } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* User Profile Header */}
          <Box sx={{ position: 'relative', p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#fff', borderBottom: '1px solid #f0f0f0' }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar 
                sx={{ width: 56, height: 56, bgcolor: '#89AE99' }} 
                src={avatarUrl || undefined}
              >
                {getAuth().currentUser?.email?.[0]?.toUpperCase()}
              </Avatar>
              <IconButton size="small" onClick={() => {/* edit avatar */}} sx={{ position: 'absolute', right: -4, bottom: -4, bgcolor: '#E9F3EE', border: '2px solid #fff', width: 28, height: 28 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 21v-3.75L14.06 6.19l3.75 3.75L6.75 21H3z" stroke="#5D9B80" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18.37 6.63l-1.37 1.37" stroke="#5D9B80" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </IconButton>
            </Box>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>
                {getAuth().currentUser?.displayName || getAuth().currentUser?.email?.split('@')[0] || 'User'}
              </Typography>
              <Box 
                onClick={() => setMobileAccountPopupOpen(!mobileAccountPopupOpen)}
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5, 
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#6f8b79',
                  fontFamily: 'Nunito, Arial, sans-serif',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                  '&:hover': { color: '#56745e' },
                  '&:focus': { outline: 'none' },
                  '&:active': { outline: 'none' }
                }}
              >
                <span>Account</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: mobileAccountPopupOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Box>
              {/* Account Popup - positioned below Account button */}
              {mobileAccountPopupOpen && (
                <Paper
                  elevation={4}
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    mt: 1,
                    width: 200,
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: '#fff',
                    zIndex: 10
                  }}
                >
                  <List sx={{ py: 0.5 }}>
                    <ListItemButton 
                      sx={{ py: 1, px: 1.5 }}
                      onClick={() => {
                        setMobileAccountPopupOpen(false);
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <Typography sx={{ fontSize: 13, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>Dark mode</Typography>
                      </Box>
                    </ListItemButton>
                    <ListItemButton 
                      sx={{ py: 1, px: 1.5 }}
                      onClick={() => {
                        setMobileAccountPopupOpen(false);
                        setMobileDrawerOpen(false);
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="10" stroke="#1a1a1a" strokeWidth="1.5"/>
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="17" r="0.5" fill="#1a1a1a" stroke="#1a1a1a" strokeWidth="1"/>
                        </svg>
                        <Typography sx={{ fontSize: 13, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>FAQs</Typography>
                      </Box>
                    </ListItemButton>
                    <ListItemButton 
                      sx={{ py: 1, px: 1.5 }}
                      onClick={() => {
                        setMobileAccountPopupOpen(false);
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <Typography sx={{ fontSize: 13, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>What's new</Typography>
                      </Box>
                    </ListItemButton>

                    <ListItemButton 
                      sx={{ py: 1, px: 1.5 }}
                      onClick={() => {
                        setMobileAccountPopupOpen(false);
                        setMobileDrawerOpen(false);
                        setHelpModalOpen(true);
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="10" stroke="#1a1a1a" strokeWidth="1.5"/>
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="17" r="0.5" fill="#1a1a1a" stroke="#1a1a1a" strokeWidth="1"/>
                        </svg>
                        <Typography sx={{ fontSize: 13, color: '#1a1a1a', fontFamily: 'Nunito, Arial, sans-serif' }}>Help & Support</Typography>
                      </Box>
                    </ListItemButton>
                  </List>
                </Paper>
              )}
            </Box>
            <IconButton 
              size="small" 
              onClick={() => setMobileDrawerOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </IconButton>
          </Box>

          {/* Navigation Menu */}
          <List sx={{ flex: 1, pt: 1.5, bgcolor: '#fff', px: 1.5, pb: 2 }}>
            <ListItemButton 
              onClick={() => { setPage('dashboard'); setMobileDrawerOpen(false); }}
              sx={{ 
                px: 2, 
                py: 1.2,
                color: page === 'dashboard' ? '#fff' : '#1a1a1a',
                bgcolor: page === 'dashboard' ? '#89AE99' : 'transparent',
                borderRadius: 2,
                fontFamily: 'Nunito, Arial, sans-serif',
                fontWeight: page === 'dashboard' ? 700 : 500,
                fontSize: 15,
                '&:hover': { bgcolor: page === 'dashboard' ? '#79a88a' : 'rgba(137, 174, 153, 0.04)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Box sx={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1.5, bgcolor: page === 'dashboard' ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.02563 10.282C8.02563 8.53186 8.04437 7.94867 10.359 7.94867C12.6736 7.94867 12.6923 8.53186 12.6923 10.282C12.6923 12.0321 12.6997 12.6153 10.359 12.6153C8.01825 12.6153 8.02563 12.0321 8.02563 10.282Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M0.692322 10.282C0.692322 8.53186 0.711061 7.94867 3.02566 7.94867C5.34025 7.94867 5.35899 8.53186 5.35899 10.282C5.35899 12.0321 5.36637 12.6153 3.02566 12.6153C0.68494 12.6153 0.692322 12.0321 0.692322 10.282Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.02563 2.94869C8.02563 1.19855 8.04437 0.615356 10.359 0.615356C12.6736 0.615356 12.6923 1.19855 12.6923 2.94869C12.6923 4.69883 12.6997 5.28202 10.359 5.28202C8.01825 5.28202 8.02563 4.69883 8.02563 2.94869Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M0.692322 2.94869C0.692322 1.19855 0.711061 0.615356 3.02566 0.615356C5.34025 0.615356 5.35899 1.19855 5.35899 2.94869C5.35899 4.69883 5.36637 5.28202 3.02566 5.28202C0.68494 5.28202 0.692322 4.69883 0.692322 2.94869Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Box>
                <span>Home</span>
              </Box>
            </ListItemButton>

            <ListItemButton 
              onClick={() => { setPage('property'); setMobileDrawerOpen(false); }}
              sx={{ 
                px: 2, 
                py: 1.2,
                color: page === 'property' ? '#fff' : '#1a1a1a',
                bgcolor: page === 'property' ? '#89AE99' : 'transparent',
                borderRadius: 2,
                fontFamily: 'Nunito, Arial, sans-serif',
                fontWeight: page === 'property' ? 700 : 500,
                fontSize: 15,
                '&:hover': { bgcolor: page === 'property' ? '#79a88a' : 'rgba(137, 174, 153, 0.04)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Box sx={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1.5, bgcolor: page === 'property' ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clipPath="url(#clip0_mobile_prop)">
                      <path d="M5.05601 14.9885V13.1622C5.05601 12.6975 5.43477 12.32 5.90391 12.3175H7.62263C8.09369 12.3175 8.47626 12.6956 8.47626 13.1622V14.9936C8.47626 15.3883 8.79391 15.7104 9.1924 15.7193H10.3382C11.4802 15.7193 12.4064 14.8026 12.4064 13.6721V8.47774C12.4 8.03278 12.1893 7.6152 11.8335 7.34338L7.91545 4.2185C7.22924 3.67424 6.25339 3.67424 5.56654 4.2185L1.66568 7.34911C1.30857 7.61965 1.09723 8.03787 1.09277 8.48347V13.6727C1.09277 14.8033 2.01834 15.7199 3.16097 15.7199H4.30678C4.71481 15.7199 5.04583 15.3921 5.04583 14.9885" stroke="currentColor" strokeWidth="0.893167" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M15.1461 12.4989C15.5223 12.1284 15.7559 11.6147 15.7559 11.0475V5.8532C15.7496 5.40824 15.5389 4.99065 15.183 4.71884L11.265 1.59396C10.5788 1.0497 9.60291 1.0497 8.91605 1.59396L8.66016 1.79893" stroke="currentColor" strokeWidth="0.893167" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_mobile_prop">
                        <rect width="16" height="15.8122" fill="white" transform="translate(0.432617 0.593903)"/>
                      </clipPath>
                    </defs>
                  </svg>
                </Box>
                <span>Properties</span>
              </Box>
            </ListItemButton>

            <ListItemButton 
              onClick={() => { setPage('task'); setMobileDrawerOpen(false); }}
              sx={{ 
                px: 2, 
                py: 1.2,
                color: page === 'task' ? '#fff' : '#1a1a1a',
                bgcolor: page === 'task' ? '#89AE99' : 'transparent',
                borderRadius: 2,
                fontFamily: 'Nunito, Arial, sans-serif',
                fontWeight: page === 'task' ? 700 : 500,
                fontSize: 15,
                '&:hover': { bgcolor: page === 'task' ? '#79a88a' : 'rgba(137, 174, 153, 0.04)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Box sx={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1.5, bgcolor: page === 'task' ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.1696 11.7773H6.35623C6.08023 11.7773 5.85623 11.5533 5.85623 11.2773C5.85623 11.0013 6.08023 10.7773 6.35623 10.7773H11.1696C11.4456 10.7773 11.6696 11.0013 11.6696 11.2773C11.6696 11.5533 11.4456 11.7773 11.1696 11.7773Z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.1696 8.98627H6.35623C6.08023 8.98627 5.85623 8.76227 5.85623 8.48627C5.85623 8.21027 6.08023 7.98627 6.35623 7.98627H11.1696C11.4456 7.98627 11.6696 8.21027 11.6696 8.48627C11.6696 8.76227 11.4456 8.98627 11.1696 8.98627Z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.19265 6.20178H6.35599C6.07999 6.20178 5.85599 5.97778 5.85599 5.70178C5.85599 5.42578 6.07999 5.20178 6.35599 5.20178H8.19265C8.46865 5.20178 8.69265 5.42578 8.69265 5.70178C8.69265 5.97778 8.46865 6.20178 8.19265 6.20178Z" fill="currentColor"/>
                    <mask id="mask0_mobile_task" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="2" y="1" width="13" height="15">
                      <path fillRule="evenodd" clipRule="evenodd" d="M2.69232 1.79492H14.8021V15.0681H2.69232V1.79492Z" fill="white"/>
                    </mask>
                    <g mask="url(#mask0_mobile_task)">
                      <path fillRule="evenodd" clipRule="evenodd" d="M11.2981 2.79482L6.1721 2.79749C4.6201 2.80682 3.6921 3.76682 3.6921 5.36615V11.4968C3.6921 13.1068 4.62876 14.0682 6.1961 14.0682L11.3221 14.0662C12.8741 14.0568 13.8021 13.0955 13.8021 11.4968V5.36615C13.8021 3.75615 12.8661 2.79482 11.2981 2.79482ZM6.19668 15.0681C4.10068 15.0681 2.69202 13.6327 2.69202 11.4967V5.36607C2.69202 3.21074 4.05668 1.81007 6.16868 1.79741L11.2973 1.79474H11.298C13.394 1.79474 14.802 3.23007 14.802 5.36607V11.4967C14.802 13.6514 13.4374 15.0527 11.3253 15.0661L6.19668 15.0681Z" fill="currentColor"/>
                    </g>
                  </svg>
                </Box>
                <span>Tasks</span>
              </Box>
            </ListItemButton>

            <ListItemButton 
              onClick={() => { setPage('calendar'); setMobileDrawerOpen(false); }}
              sx={{ 
                px: 2, 
                py: 1.2,
                color: page === 'calendar' ? '#fff' : '#1a1a1a',
                bgcolor: page === 'calendar' ? '#89AE99' : 'transparent',
                borderRadius: 2,
                fontFamily: 'Nunito, Arial, sans-serif',
                fontWeight: page === 'calendar' ? 700 : 500,
                fontSize: 15,
                '&:hover': { bgcolor: page === 'calendar' ? '#79a88a' : 'rgba(137, 174, 153, 0.04)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Box sx={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1.5, bgcolor: page === 'calendar' ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.6536 11.8487H11.6598" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8.6953 11.8487H8.70148" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5.73079 11.8487H5.73697" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M11.6536 9.25771H11.6598" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8.6953 9.25771H8.70148" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5.73079 9.25771H5.73697" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2.75418 6.65408H14.6368" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M11.3882 1.7179V3.91175" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6.00274 1.7179V3.91175" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.5178 2.77069H5.87296C3.91517 2.77069 2.69232 3.86131 2.69232 5.86604V11.8991C2.69232 13.9354 3.91517 15.0512 5.87296 15.0512H11.5117C13.4756 15.0512 14.6923 13.9543 14.6923 11.9496V5.86604C14.6985 3.86131 13.4818 2.77069 11.5178 2.77069Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Box>
                <span>Calendar</span>
              </Box>
            </ListItemButton>

            <ListItemButton 
              onClick={() => { setPage('reports'); setMobileDrawerOpen(false); }}
              sx={{ 
                px: 2, 
                py: 1.2,
                color: page === 'reports' ? '#fff' : '#1a1a1a',
                bgcolor: page === 'reports' ? '#89AE99' : 'transparent',
                borderRadius: 2,
                fontFamily: 'Nunito, Arial, sans-serif',
                fontWeight: page === 'reports' ? 700 : 500,
                fontSize: 15,
                '&:hover': { bgcolor: page === 'reports' ? '#79a88a' : 'rgba(137, 174, 153, 0.04)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Box sx={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1.5, bgcolor: page === 'reports' ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M6.61357 4.70235C6.59224 4.70235 6.5709 4.70502 6.54957 4.71035C4.56957 5.19769 2.9589 7.34302 2.9589 9.49235C2.9589 12.1964 5.1589 14.3964 7.86357 14.3964C10.3016 14.3964 12.3389 12.6597 12.7082 10.2664C12.7109 10.2464 12.7202 10.1884 12.6656 10.1237C12.6136 10.063 12.5309 10.027 12.4442 10.027C11.5036 10.027 10.7856 10.0484 10.2249 10.0644C8.86757 10.105 8.30624 10.1204 7.75157 9.70902C6.91557 9.08969 6.8449 8.02569 6.8449 4.89635C6.8449 4.84035 6.8209 4.79369 6.7729 4.75635C6.72824 4.72102 6.67157 4.70235 6.61357 4.70235ZM7.86365 15.3963C4.60765 15.3963 1.95898 12.7477 1.95898 9.49233C1.95898 6.911 3.91098 4.32967 6.31032 3.739C6.68498 3.64767 7.08765 3.733 7.39032 3.969C7.67898 4.19567 7.84499 4.53367 7.84499 4.89633C7.84499 7.81967 7.94365 8.60633 8.34698 8.90567C8.61165 9.101 8.97432 9.099 10.1963 9.065C10.7643 9.04833 11.4917 9.027 12.4443 9.027C12.8243 9.027 13.1823 9.18967 13.425 9.473C13.6503 9.73633 13.749 10.0803 13.697 10.419C13.2517 13.3023 10.7983 15.3963 7.86365 15.3963Z" fill="currentColor"/>
                    <mask id="mask0_mobile_reports" style={{maskType:'luminance'}} maskUnits="userSpaceOnUse" x="8" y="1" width="8" height="8">
                      <path fillRule="evenodd" clipRule="evenodd" d="M8.94141 1.16699H15.8874V8.02653H8.94141V1.16699Z" fill="white"/>
                    </mask>
                    <g mask="url(#mask0_mobile_reports)">
                      <path fillRule="evenodd" clipRule="evenodd" d="M9.96583 2.16789C9.8925 3.84722 10.0012 6.01655 10.0518 6.87589C10.0545 6.92722 10.0918 6.96455 10.1425 6.96722C10.8278 7.00655 13.1892 7.11589 14.8872 6.86589C14.8912 5.92989 14.2505 4.66055 13.2858 3.69655C12.2965 2.70855 11.1258 2.16789 9.9805 2.16789H9.96583ZM12.1686 8.02639C11.2952 8.02639 10.5266 7.99106 10.0846 7.96573C9.52857 7.93306 9.08591 7.48973 9.05391 6.93373C9.00191 6.05239 8.88924 3.81306 8.96924 2.08106C8.99124 1.57773 9.39791 1.17706 9.89524 1.16839C11.3199 1.12706 12.7899 1.78839 13.9926 2.98906C15.1646 4.16039 15.9086 5.69973 15.8872 6.91106C15.8792 7.38373 15.5359 7.77839 15.0719 7.84839C14.1666 7.98506 13.1066 8.02639 12.1686 8.02639Z" fill="currentColor"/>
                    </g>
                  </svg>
                </Box>
                <span>Reports</span>
              </Box>
            </ListItemButton>

            <ListItemButton 
              onClick={() => { setPage('sharedaccess'); setMobileDrawerOpen(false); }}
              sx={{ 
                px: 2, 
                py: 1.2,
                color: page === 'sharedaccess' ? '#fff' : '#1a1a1a',
                bgcolor: page === 'sharedaccess' ? '#89AE99' : 'transparent',
                borderRadius: 2,
                fontFamily: 'Nunito, Arial, sans-serif',
                fontWeight: page === 'sharedaccess' ? 700 : 500,
                fontSize: 15,
                '&:hover': { bgcolor: page === 'sharedaccess' ? '#79a88a' : 'rgba(137, 174, 153, 0.04)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Box sx={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1.5, bgcolor: page === 'sharedaccess' ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M9.08078 6.52539H5.48145C5.20545 6.52539 4.98145 6.30139 4.98145 6.02539C4.98145 5.74939 5.20545 5.52539 5.48145 5.52539H9.08078C9.35678 5.52539 9.58078 5.74939 9.58078 6.02539C9.58078 6.30139 9.35678 6.52539 9.08078 6.52539Z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M12.8232 9.26239H12.6152C12.3392 9.26239 12.1152 9.03839 12.1152 8.76239C12.1152 8.48639 12.3392 8.26239 12.6152 8.26239H12.8232C13.0992 8.26239 13.3232 8.48639 13.3232 8.76239C13.3232 9.03839 13.0992 9.26239 12.8232 9.26239Z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M15.217 11.0971H12.5183C11.2536 11.0971 10.2243 10.0684 10.2236 8.80443C10.2236 7.53909 11.253 6.50976 12.5183 6.50909H15.217C15.493 6.50909 15.717 6.73309 15.717 7.00909C15.717 7.28509 15.493 7.50909 15.217 7.50909H12.5183C11.8043 7.50976 11.2236 8.09043 11.2236 8.80376C11.2236 9.51643 11.805 10.0971 12.5183 10.0971H15.217C15.493 10.0971 15.717 10.3211 15.717 10.5971C15.717 10.8731 15.493 11.0971 15.217 11.0971Z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.95676 3.5C4.30342 3.5 2.95809 4.84533 2.95809 6.49867V11.2833C2.95809 12.9367 4.30342 14.282 5.95676 14.282H11.7194C13.3728 14.282 14.7174 12.9367 14.7174 11.2833V6.49867C14.7174 4.84533 13.3728 3.5 11.7194 3.5H5.95676ZM11.7193 15.282H5.95667C3.75201 15.282 1.95801 13.488 1.95801 11.2833V6.49867C1.95801 4.29333 3.75201 2.5 5.95667 2.5H11.7193C13.924 2.5 15.7173 4.29333 15.7173 6.49867V11.2833C15.7173 13.488 13.924 15.282 11.7193 15.282Z" fill="currentColor"/>
                  </svg>
                </Box>
                <span>Shared Access</span>
              </Box>
            </ListItemButton>

            <ListItemButton 
              onClick={() => { setPage('setting'); setMobileDrawerOpen(false); }}
              sx={{ 
                px: 2, 
                py: 1.2,
                color: page === 'setting' ? '#fff' : '#1a1a1a',
                bgcolor: page === 'setting' ? '#89AE99' : 'transparent',
                borderRadius: 2,
                fontFamily: 'Nunito, Arial, sans-serif',
                fontWeight: page === 'setting' ? 700 : 500,
                fontSize: 15,
                '&:hover': { bgcolor: page === 'setting' ? '#79a88a' : 'rgba(137, 174, 153, 0.04)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Box sx={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1.5, bgcolor: page === 'setting' ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clipPath="url(#clip0_mobile_settings)">
                      <path fillRule="evenodd" clipRule="evenodd" d="M3.61392 11.127C3.76659 11.127 3.91925 11.1463 4.06859 11.1863C4.51925 11.3077 4.91059 11.609 5.14259 12.0137C5.29325 12.2677 5.37659 12.5643 5.37925 12.867C5.37925 13.3003 5.72725 13.6477 6.15525 13.6477H6.99059C7.41659 13.6477 7.76459 13.3023 7.76659 12.8763C7.76392 12.4057 7.94792 11.9583 8.28459 11.6217C8.61659 11.2897 9.08059 11.0903 9.54459 11.1037C9.84859 11.111 10.1413 11.193 10.3993 11.3397C10.7706 11.5523 11.2446 11.4257 11.4593 11.059L11.9019 10.321C12.0006 10.151 12.0293 9.93768 11.9766 9.74101C11.9246 9.54435 11.7939 9.37368 11.6179 9.27301C11.2059 9.03568 10.9119 8.65301 10.7899 8.19435C10.6693 7.74435 10.7353 7.25301 10.9706 6.84835C11.1239 6.58168 11.3486 6.35701 11.6179 6.20235C11.9793 5.99101 12.1059 5.51835 11.8959 5.15035C11.8873 5.13568 11.8793 5.12035 11.8726 5.10435L11.4819 4.42701C11.2693 4.05701 10.7959 3.92968 10.4246 4.14101C10.0233 4.37835 9.54592 4.44635 9.08726 4.32568C8.62926 4.20701 8.24526 3.91701 8.00592 3.50768C7.85259 3.25168 7.76926 2.95368 7.76659 2.65035C7.77259 2.42235 7.69259 2.21768 7.54725 2.06768C7.40259 1.91835 7.19925 1.83368 6.99059 1.83368H6.15525C5.94859 1.83368 5.75525 1.91435 5.60925 2.05968C5.46392 2.20568 5.38459 2.39968 5.38592 2.60635C5.37192 3.58101 4.57525 4.36568 3.61059 4.36568C3.30125 4.36235 3.00325 4.27901 2.74459 4.12435C2.38125 3.91768 1.90659 4.04501 1.69392 4.41501L1.24259 5.15701C1.03592 5.51568 1.16259 5.98968 1.53059 6.20368C2.07659 6.51968 2.41725 7.10901 2.41725 7.74101C2.41725 8.37301 2.07659 8.96168 1.52925 9.27835C1.16325 9.49035 1.03659 9.96168 1.24859 10.3283L1.66925 11.0537C1.77325 11.241 1.94325 11.3763 2.13992 11.4317C2.33592 11.4863 2.55192 11.463 2.73192 11.363C2.99659 11.2077 3.30459 11.127 3.61392 11.127M6.99039 14.6477H6.15505C5.17572 14.6477 4.37905 13.8517 4.37905 12.8723C4.37772 12.7517 4.34305 12.6263 4.27839 12.5177C4.17372 12.335 4.00439 12.2043 3.80905 12.1523C3.61505 12.1003 3.40239 12.129 3.22772 12.2303C2.80905 12.4637 2.31639 12.5203 1.86572 12.3937C1.41572 12.2663 1.02705 11.957 0.799054 11.547L0.382388 10.829C-0.104946 9.98368 0.185054 8.90035 1.02905 8.41235C1.26839 8.27435 1.41705 8.01701 1.41705 7.74101C1.41705 7.46501 1.26839 7.20701 1.02905 7.06901C0.184388 6.57835 -0.104946 5.49235 0.381721 4.64701L0.833721 3.90501C1.31439 3.06901 2.40105 2.77435 3.24839 3.26101C3.36372 3.32968 3.48905 3.36435 3.61639 3.36568C4.03172 3.36568 4.37905 3.02301 4.38572 2.60168C4.38305 2.13701 4.56639 1.69101 4.90039 1.35435C5.23572 1.01835 5.68105 0.833679 6.15505 0.833679H6.99039C7.46772 0.833679 7.93172 1.02968 8.26439 1.37035C8.59639 1.71301 8.77972 2.18301 8.76572 2.65968C8.76705 2.76701 8.80239 2.89101 8.86639 2.99968C8.97239 3.17968 9.13972 3.30635 9.33839 3.35835C9.53705 3.40768 9.74505 3.38101 9.92172 3.27635C10.7751 2.78901 11.8611 3.08101 12.3484 3.92768L12.7637 4.64701C12.7744 4.66635 12.7837 4.68501 12.7917 4.70435C13.2331 5.53835 12.9384 6.58835 12.1184 7.06768C11.9991 7.13635 11.9024 7.23235 11.8357 7.34835C11.7324 7.52768 11.7037 7.74101 11.7557 7.93701C11.8091 8.13701 11.9364 8.30301 12.1157 8.40568C12.5204 8.63835 12.8224 9.03035 12.9431 9.48301C13.0637 9.93501 12.9977 10.4257 12.7624 10.8303L12.3197 11.5677C11.8324 12.405 10.7464 12.695 9.90172 12.207C9.78905 12.1423 9.65905 12.107 9.52972 12.1037H9.52572C9.33305 12.1037 9.13505 12.1857 8.99105 12.329C8.84505 12.475 8.76505 12.6697 8.76639 12.8763C8.76172 13.8557 7.96505 14.6477 6.99039 14.6477" fill="currentColor"/>
                    </g>
                    <path fillRule="evenodd" clipRule="evenodd" d="M6.57472 6.48305C5.88138 6.48305 5.31738 7.04772 5.31738 7.74105C5.31738 8.43439 5.88138 8.99772 6.57472 8.99772C7.26805 8.99772 7.83205 8.43439 7.83205 7.74105C7.83205 7.04772 7.26805 6.48305 6.57472 6.48305M6.57472 9.99773C5.33005 9.99773 4.31738 8.98573 4.31738 7.74106C4.31738 6.4964 5.33005 5.48306 6.57472 5.48306C7.81938 5.48306 8.83205 6.4964 8.83205 7.74106C8.83205 8.98573 7.81938 9.99773 6.57472 9.99773" fill="currentColor"/>
                    <defs>
                      <clipPath id="clip0_mobile_settings">
                        <rect width="13.1548" height="13.814" fill="white" transform="translate(0 0.833679)"/>
                      </clipPath>
                    </defs>
                  </svg>
                </Box>
                <span>Settings</span>
              </Box>
            </ListItemButton>
            </List>

          {/* Logout Button at bottom */}
          <Box sx={{ p: 2, borderTop: '1px solid #f0f0f0' }}>
            <Box 
              onClick={async () => {
                setMobileDrawerOpen(false);
                await getAuth().signOut();
              }}
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2, 
                cursor: 'pointer',
                color: '#E57373',
                fontFamily: 'Nunito, Arial, sans-serif',
                fontWeight: 500,
                fontSize: 15,
                py: 1,
                '&:hover': { color: '#d32f2f' }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Logout</span>
            </Box>
          </Box>
        </Box>
      </Drawer>

      {/* Sidebar - hidden on mobile (xs/sm), visible on md+ */}
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 'var(--app-sidebar-width)',
          height: '100vh',
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          py: 2,
          transition: 'width 0.2s',
          bgcolor: '#F9F9F9',
          boxSizing: 'border-box',
          zIndex: 1200,
        }}>
          {/* Top Logo and Actions */}
          <Box>
            <Box sx={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              px: 2,
              mb: 1.8,
              gap: 1,
              ml: isSidebarCollapsed ? 0.5 : 0.5,
            }}>
              <Box
                sx={{
                  width: 60,
                  height: 65,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  marginTop: 0,
                  marginBottom: 0,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setPage('dashboard');
                }}
              >
                <img
                  src="/All_Properly_logo-02.png"
                  alt="Logo"
                  style={{ width: 60, height: 65 }}
                />
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              {/* Top action icons - custom SVGs */}

              <IconButton size="small" sx={{ display: 'none' }}>
                <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8.29134" cy="8.16668" r="6.33333" stroke="#8F8F8F"/>
                  <path d="M12.958 12.8333L15.2913 15.1667" stroke="#8F8F8F" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </IconButton>
              <IconButton
                size="small"
                sx={{ display: isSidebarCollapsed ? 'none' : 'visible', '@media (max-width:1000px)': {
                    display: 'none',
                }, }}
                ref={notificationAnchorRef}
                onClick={() => setNotificationDropdownOpen((open) => !open)}
                aria-label="Notifications"
              >
                <BellIcon hasUnread={unreadCount > 0} />
              </IconButton>
              {NotificationDropdown}
              <IconButton onClick={() => setPage('setting')} size="small" sx={{ display: isSidebarCollapsed ? 'none' : 'visible', '@media (max-width:1000px)': {
                display: 'none',
            }, }}>
                <svg width="13" height="15" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <mask id="mask0_2829_6" style={{maskType:'luminance'}} maskUnits="userSpaceOnUse" x="0" y="0" width="14" height="15">
                    <path fillRule="evenodd" clipRule="evenodd" d="M0.144531 0.833649H13.0011V14.6476H0.144531V0.833649Z" fill="white"/>
                  </mask>
                  <g mask="url(#mask0_2829_6)">
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.61392 11.127C3.76659 11.127 3.91925 11.1463 4.06859 11.1863C4.51925 11.3077 4.91059 11.609 5.14259 12.0137C5.29325 12.2677 5.37659 12.5643 5.37925 12.867C5.37925 13.3003 5.72725 13.6477 6.15525 13.6477H6.99059C7.41659 13.6477 7.76459 13.3023 7.76659 12.8763C7.76392 12.4057 7.94792 11.9583 8.28459 11.6217C8.61659 11.2897 9.08059 11.0903 9.54459 11.1037C9.84859 11.111 10.1413 11.193 10.3993 11.3397C10.7706 11.5523 11.2446 11.4257 11.4593 11.059L11.9019 10.321C12.0006 10.151 12.0293 9.93768 11.9766 9.74101C11.9246 9.54435 11.7939 9.37368 11.6179 9.27301C11.2059 9.03568 10.9119 8.65301 10.7899 8.19435C10.6693 7.74435 10.7353 7.25301 10.9706 6.84835C11.1239 6.58168 11.3486 6.35701 11.6179 6.20235C11.9793 5.99101 12.1059 5.51835 11.8959 5.15035C11.8873 5.13568 11.8793 5.12035 11.8726 5.10435L11.4819 4.42701C11.2693 4.05701 10.7959 3.92968 10.4246 4.14101C10.0233 4.37835 9.54592 4.44635 9.08726 4.32568C8.62926 4.20701 8.24526 3.91701 8.00592 3.50768C7.85259 3.25168 7.76926 2.95368 7.76659 2.65035C7.77259 2.42235 7.69259 2.21768 7.54725 2.06768C7.40259 1.91835 7.19925 1.83368 6.99059 1.83368H6.15525C5.94859 1.83368 5.75525 1.91435 5.60925 2.05968C5.46392 2.20568 5.38459 2.39968 5.38592 2.60635C5.37192 3.58101 4.57525 4.36568 3.61059 4.36568C3.30125 4.36235 3.00325 4.27901 2.74459 4.12435C2.38125 3.91768 1.90659 4.04501 1.69392 4.41501L1.24259 5.15701C1.03592 5.51568 1.16259 5.98968 1.53059 6.20368C2.07659 6.51968 2.41725 7.10901 2.41725 7.74101C2.41725 8.37301 2.07659 8.96168 1.52925 9.27835C1.16325 9.49035 1.03659 9.96168 1.24859 10.3283L1.66925 11.0537C1.77325 11.241 1.94325 11.3763 2.13992 11.4317C2.33592 11.4863 2.55192 11.463 2.73192 11.363C2.99659 11.2077 3.30459 11.127 3.61392 11.127M6.99039 14.6477H6.15505C5.17572 14.6477 4.37905 13.8517 4.37905 12.8723C4.37772 12.7517 4.34305 12.6263 4.27839 12.5177C4.17372 12.335 4.00439 12.2043 3.80905 12.1523C3.61505 12.1003 3.40239 12.129 3.22772 12.2303C2.80905 12.4637 2.31639 12.5203 1.86572 12.3937C1.41572 12.2663 1.02705 11.957 0.799054 11.547L0.382388 10.829C-0.104946 9.98368 0.185054 8.90035 1.02905 8.41235C1.26839 8.27435 1.41705 8.01701 1.41705 7.74101C1.41705 7.46501 1.26839 7.20701 1.02905 7.06901C0.184388 6.57835 -0.104946 5.49235 0.381721 4.64701L0.833721 3.90501C1.31439 3.06901 2.40105 2.77435 3.24839 3.26101C3.36372 3.32968 3.48905 3.36435 3.61639 3.36568C4.03172 3.36568 4.37905 3.02301 4.38572 2.60168C4.38305 2.13701 4.56639 1.69101 4.90039 1.35435C5.23572 1.01835 5.68105 0.833679 6.15505 0.833679H6.99039C7.46772 0.833679 7.93172 1.02968 8.26439 1.37035C8.59639 1.71301 8.77972 2.18301 8.76572 2.65968C8.76705 2.76701 8.80239 2.89101 8.86639 2.99968C8.97239 3.17968 9.13972 3.30635 9.33839 3.35835C9.53705 3.40768 9.74505 3.38101 9.92172 3.27635C10.7751 2.78901 11.8611 3.08101 12.3484 3.92768L12.7637 4.64701C12.7744 4.66635 12.7837 4.68501 12.7917 4.70435C13.2331 5.53835 12.9384 6.58835 12.1184 7.06768C11.9991 7.13635 11.9024 7.23235 11.8357 7.34835C11.7324 7.52768 11.7037 7.74101 11.7557 7.93701C11.8091 8.13701 11.9364 8.30301 12.1157 8.40568C12.5204 8.63835 12.8224 9.03035 12.9431 9.48301C13.0637 9.93501 12.9977 10.4257 12.7624 10.8303L12.3197 11.5677C11.8324 12.405 10.7464 12.695 9.90172 12.207C9.78905 12.1423 9.65905 12.107 9.52972 12.1037H9.52572C9.33305 12.1037 9.13505 12.1857 8.99105 12.329C8.84505 12.475 8.76505 12.6697 8.76639 12.8763C8.76172 13.8557 7.96505 14.6477 6.99039 14.6477" fill="#8F8F8F"/>
                  </g>
                  <path fillRule="evenodd" clipRule="evenodd" d="M6.57472 6.48305C5.88138 6.48305 5.31738 7.04772 5.31738 7.74105C5.31738 8.43439 5.88138 8.99772 6.57472 8.99772C7.26805 8.99772 7.83205 8.43439 7.83205 7.74105C7.83205 7.04772 7.26805 6.48305 6.57472 6.48305M6.57472 9.99773C5.33005 9.99773 4.31738 8.98573 4.31738 7.74106C4.31738 6.4964 5.33005 5.48306 6.57472 5.48306C7.81938 5.48306 8.83205 6.4964 8.83205 7.74106C8.83205 8.98573 7.81938 9.99773 6.57472 9.99773" fill="#8F8F8F"/>
                </svg>
              </IconButton>
              <IconButton size="small" sx={{ display: isSidebarCollapsed ? 'none' : 'visible', '@media (max-width:1000px)': { display: 'none' } }} onClick={() => setIsSidebarCollapsed(true)}>
                <svg width="14" height="13" viewBox="0 0 14 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.14486 0.5H11.4782C12.2146 0.5 12.8115 1.09695 12.8115 1.83333V11.1667C12.8115 11.903 12.2146 12.5 11.4782 12.5H2.14486C1.40848 12.5 0.811523 11.903 0.811523 11.1667V1.83333C0.811523 1.09695 1.40848 0.5 2.14486 0.5Z" stroke="#8F8F8F" strokeWidth="0.95" strokeMiterlimit="10"/>
                  <path d="M4.81152 12.5V0.5" stroke="#8F8F8F" strokeWidth="0.95" strokeMiterlimit="10"/>
                </svg>
              </IconButton>
            </Box>
            {/* Expand arrow button - only visible when collapsed */}
            {isSidebarCollapsed && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ml: 3,
                  mb: 1,
                  px: 1,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: '#E9E9E7',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: '#d9d9d7' },
                }}
                onClick={() => setIsSidebarCollapsed(false)}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.5 5L15.5 12L8.5 19" stroke="#212121" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </Box>
            )}
            {/* Navigation */}
            <Box sx={{ mt: 2 }}>
              <List>
                <ListItemButton
                  selected={page === "dashboard"}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    ml: 3,
                    bgcolor: page === 'dashboard' ? '#E9E9E7' : 'transparent',
                    '&.Mui-selected': {
                      bgcolor: '#E9E9E7',
                      '&:hover': { bgcolor: '#E9E9E7' },
                    },
                  }}
                  onClick={() => setPage("dashboard")}
                >
                  <span style={{ display: 'flex', marginLeft: 1, alignItems: 'center', marginRight: 8, width: 28, justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M8.02563 10.282C8.02563 8.53186 8.04437 7.94867 10.359 7.94867C12.6736 7.94867 12.6923 8.53186 12.6923 10.282C12.6923 12.0321 12.6997 12.6153 10.359 12.6153C8.01825 12.6153 8.02563 12.0321 8.02563 10.282Z" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M0.692322 10.282C0.692322 8.53186 0.711061 7.94867 3.02566 7.94867C5.34025 7.94867 5.35899 8.53186 5.35899 10.282C5.35899 12.0321 5.36637 12.6153 3.02566 12.6153C0.68494 12.6153 0.692322 12.0321 0.692322 10.282Z" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M8.02563 2.94869C8.02563 1.19855 8.04437 0.615356 10.359 0.615356C12.6736 0.615356 12.6923 1.19855 12.6923 2.94869C12.6923 4.69883 12.6997 5.28202 10.359 5.28202C8.01825 5.28202 8.02563 4.69883 8.02563 2.94869Z" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M0.692322 2.94869C0.692322 1.19855 0.711061 0.615356 3.02566 0.615356C5.34025 0.615356 5.35899 1.19855 5.35899 2.94869C5.35899 4.69883 5.36637 5.28202 3.02566 5.28202C0.68494 5.28202 0.692322 4.69883 0.692322 2.94869Z" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <ListItemText onClick={() => setPage("dashboard")} primary={<span style={{ display: isSidebarCollapsed ? 'none' : 'block', color: '#343748', fontWeight: 550 }}>Dashboard</span>} sx={{ display: { xs: 'none', sm: 'none', md: 'block' } }} />
                </ListItemButton>
                <ListItemButton
                  selected={page === "property"}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    ml: 3,
                    bgcolor: page === 'property' ? '#E9E9E7' : 'transparent',
                    '&.Mui-selected': {
                      bgcolor: '#E9E9E7',
                      '&:hover': { bgcolor: '#E9E9E7' },
                    },
                  }}
                  onClick={() => {
                    if (page !== "property") {
                      setPage("property");
                    }
                  }}
                >
                  <span style={{ display: 'flex', marginLeft: 2, alignItems: 'center', marginRight: 8, width: 28, justifyContent: 'center' }}>
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g clipPath="url(#clip0_2466_6492)">
                        <path d="M5.05601 14.9885V13.1622C5.05601 12.6975 5.43477 12.32 5.90391 12.3175H7.62263C8.09369 12.3175 8.47626 12.6956 8.47626 13.1622V14.9936C8.47626 15.3883 8.79391 15.7104 9.1924 15.7193H10.3382C11.4802 15.7193 12.4064 14.8026 12.4064 13.6721V8.47774C12.4 8.03278 12.1893 7.6152 11.8335 7.34338L7.91545 4.2185C7.22924 3.67424 6.25339 3.67424 5.56654 4.2185L1.66568 7.34911C1.30857 7.61965 1.09723 8.03787 1.09277 8.48347V13.6727C1.09277 14.8033 2.01834 15.7199 3.16097 15.7199H4.30678C4.71481 15.7199 5.04583 15.3921 5.04583 14.9885" stroke="#212121" strokeWidth="0.893167" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M15.1461 12.4989C15.5223 12.1284 15.7559 11.6147 15.7559 11.0475V5.8532C15.7496 5.40824 15.5389 4.99065 15.183 4.71884L11.265 1.59396C10.5788 1.0497 9.60291 1.0497 8.91605 1.59396L8.66016 1.79893" stroke="#212121" strokeWidth="0.893167" strokeLinecap="round" strokeLinejoin="round"/>
                      </g>
                      <defs>
                        <clipPath id="clip0_2466_6492">
                          <rect width="16" height="15.8122" fill="white" transform="translate(0.432617 0.593903)"/>
                        </clipPath>
                      </defs>
                    </svg>
                  </span>
                  <ListItemText onClick={() => setPage("property")} primary={<span style={{ display: isSidebarCollapsed ? 'none' : 'block', color: '#343748', fontWeight: 600 }}>Properties</span>} sx={{ display: { xs: 'none', sm: 'none', md: 'block' } }} />
                </ListItemButton>
                <ListItemButton
                  selected={page === "task"}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    ml: 3,
                    bgcolor: page === 'task' ? '#E9E9E7' : 'transparent',
                    '&.Mui-selected': {
                      bgcolor: '#E9E9E7',
                      '&:hover': { bgcolor: '#E9E9E7' },
                    },
                  }}
                  onClick={() => setPage("task")}
                >
                  <span style={{ display: 'flex', alignItems: 'center', marginRight: 8, width: 28, justifyContent: 'center' }}>
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M11.1696 11.7773H6.35623C6.08023 11.7773 5.85623 11.5533 5.85623 11.2773C5.85623 11.0013 6.08023 10.7773 6.35623 10.7773H11.1696C11.4456 10.7773 11.6696 11.0013 11.6696 11.2773C11.6696 11.5533 11.4456 11.7773 11.1696 11.7773Z" fill="#212121"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M11.1696 8.98627H6.35623C6.08023 8.98627 5.85623 8.76227 5.85623 8.48627C5.85623 8.21027 6.08023 7.98627 6.35623 7.98627H11.1696C11.4456 7.98627 11.6696 8.21027 11.6696 8.48627C11.6696 8.76227 11.4456 8.98627 11.1696 8.98627Z" fill="#212121"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M8.19265 6.20178H6.35599C6.07999 6.20178 5.85599 5.97778 5.85599 5.70178C5.85599 5.42578 6.07999 5.20178 6.35599 5.20178H8.19265C8.46865 5.20178 8.69265 5.42578 8.69265 5.70178C8.69265 5.97778 8.46865 6.20178 8.19265 6.20178Z" fill="#212121"/>
                      <mask id="mask0_3412_827" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="2" y="1" width="13" height="15">
                        <path fillRule="evenodd" clipRule="evenodd" d="M2.69232 1.79492H14.8021V15.0681H2.69232V1.79492Z" fill="white"/>
                      </mask>
                      <g mask="url(#mask0_3412_827)">
                        <path fillRule="evenodd" clipRule="evenodd" d="M11.2981 2.79482L6.1721 2.79749C4.6201 2.80682 3.6921 3.76682 3.6921 5.36615V11.4968C3.6921 13.1068 4.62876 14.0682 6.1961 14.0682L11.3221 14.0662C12.8741 14.0568 13.8021 13.0955 13.8021 11.4968V5.36615C13.8021 3.75615 12.8661 2.79482 11.2981 2.79482ZM6.19668 15.0681C4.10068 15.0681 2.69202 13.6327 2.69202 11.4967V5.36607C2.69202 3.21074 4.05668 1.81007 6.16868 1.79741L11.2973 1.79474H11.298C13.394 1.79474 14.802 3.23007 14.802 5.36607V11.4967C14.802 13.6514 13.4374 15.0527 11.3253 15.0661L6.19668 15.0681Z" fill="#212121"/>
                      </g>
                    </svg>
                  </span>
                  <ListItemText primary={<span style={{ display: isSidebarCollapsed ? 'none' : 'block', color: '#343748', fontWeight: 600 }}>Tasks</span>} sx={{ display: { xs: 'none', sm: 'none', md: 'block' } }} />
                </ListItemButton>
                <ListItemButton
                  selected={page === "calendar"}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    ml: 3,
                    bgcolor: page === 'calendar' ? '#E9E9E7' : 'transparent',
                    '&.Mui-selected': {
                      bgcolor: '#E9E9E7',
                      '&:hover': { bgcolor: '#E9E9E7' },
                    },
                  }}
                  onClick={() => setPage("calendar")}
                >
                  <span style={{ display: 'flex', alignItems: 'center', marginRight: 8, width: 28, justifyContent: 'center' }}>
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.6536 11.8487H11.6598" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8.6953 11.8487H8.70148" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5.73079 11.8487H5.73697" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M11.6536 9.25771H11.6598" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8.6953 9.25771H8.70148" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5.73079 9.25771H5.73697" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2.75418 6.65408H14.6368" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M11.3882 1.7179V3.91175" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6.00274 1.7179V3.91175" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M11.5178 2.77069H5.87296C3.91517 2.77069 2.69232 3.86131 2.69232 5.86604V11.8991C2.69232 13.9354 3.91517 15.0512 5.87296 15.0512H11.5117C13.4756 15.0512 14.6923 13.9543 14.6923 11.9496V5.86604C14.6985 3.86131 13.4818 2.77069 11.5178 2.77069Z" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <ListItemText primary={<span style={{ display: isSidebarCollapsed ? 'none' : 'block', color: '#343748', fontWeight: 600 }}>Calendar</span>} sx={{ display: { xs: 'none', sm: 'none', md: 'block' } }} />
                </ListItemButton>
                <ListItemButton
                  selected={page === "reports"}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    ml: 3,
                    bgcolor: page === 'reports' ? '#E9E9E7' : 'transparent',
                    '&.Mui-selected': {
                      bgcolor: '#E9E9E7',
                      '&:hover': { bgcolor: '#E9E9E7' },
                    },
                  }}
                  onClick={() => setPage("reports")}
                >
                  <span style={{ display: 'flex', alignItems: 'center', marginRight: 8, width: 28, justifyContent: 'center' }}>
                    {/* Reports SVG Icon */}
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M6.61357 4.70235C6.59224 4.70235 6.5709 4.70502 6.54957 4.71035C4.56957 5.19769 2.9589 7.34302 2.9589 9.49235C2.9589 12.1964 5.1589 14.3964 7.86357 14.3964C10.3016 14.3964 12.3389 12.6597 12.7082 10.2664C12.7109 10.2464 12.7202 10.1884 12.6656 10.1237C12.6136 10.063 12.5309 10.027 12.4442 10.027C11.5036 10.027 10.7856 10.0484 10.2249 10.0644C8.86757 10.105 8.30624 10.1204 7.75157 9.70902C6.91557 9.08969 6.8449 8.02569 6.8449 4.89635C6.8449 4.84035 6.8209 4.79369 6.7729 4.75635C6.72824 4.72102 6.67157 4.70235 6.61357 4.70235ZM7.86365 15.3963C4.60765 15.3963 1.95898 12.7477 1.95898 9.49233C1.95898 6.911 3.91098 4.32967 6.31032 3.739C6.68498 3.64767 7.08765 3.733 7.39032 3.969C7.67898 4.19567 7.84499 4.53367 7.84499 4.89633C7.84499 7.81967 7.94365 8.60633 8.34698 8.90567C8.61165 9.101 8.97432 9.099 10.1963 9.065C10.7643 9.04833 11.4917 9.027 12.4443 9.027C12.8243 9.027 13.1823 9.18967 13.425 9.473C13.6503 9.73633 13.749 10.0803 13.697 10.419C13.2517 13.3023 10.7983 15.3963 7.86365 15.3963Z" fill="#212121"/>
                      <mask id="mask0_40_2016" style={{maskType:'luminance'}} maskUnits="userSpaceOnUse" x="8" y="1" width="8" height="8">
                        <path fillRule="evenodd" clipRule="evenodd" d="M8.94141 1.16699H15.8874V8.02653H8.94141V1.16699Z" fill="white"/>
                      </mask>
                      <g mask="url(#mask0_40_2016)">
                        <path fillRule="evenodd" clipRule="evenodd" d="M9.96583 2.16789C9.8925 3.84722 10.0012 6.01655 10.0518 6.87589C10.0545 6.92722 10.0918 6.96455 10.1425 6.96722C10.8278 7.00655 13.1892 7.11589 14.8872 6.86589C14.8912 5.92989 14.2505 4.66055 13.2858 3.69655C12.2965 2.70855 11.1258 2.16789 9.9805 2.16789H9.96583ZM12.1686 8.02639C11.2952 8.02639 10.5266 7.99106 10.0846 7.96573C9.52857 7.93306 9.08591 7.48973 9.05391 6.93373C9.00191 6.05239 8.88924 3.81306 8.96924 2.08106C8.99124 1.57773 9.39791 1.17706 9.89524 1.16839C11.3199 1.12706 12.7899 1.78839 13.9926 2.98906C15.1646 4.16039 15.9086 5.69973 15.8872 6.91106C15.8792 7.38373 15.5359 7.77839 15.0719 7.84839C14.1666 7.98506 13.1066 8.02639 12.1686 8.02639Z" fill="#212121"/>
                      </g>
                    </svg>
                  </span>
                  <ListItemText primary={<span style={{ display: isSidebarCollapsed ? 'none' : 'block', color: '#343748', fontWeight: 600 }}>Reports</span>} sx={{ display: { xs: 'none', sm: 'none', md: 'block' } }} />
                </ListItemButton>
                <ListItemButton
                  selected={page === "sharedaccess"}
                  disabled={!hasOwnedProperties}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    ml: 3,
                    bgcolor: page === 'sharedaccess' ? '#E9E9E7' : 'transparent',
                    opacity: hasOwnedProperties ? 1 : 0.5,
                    cursor: hasOwnedProperties ? 'pointer' : 'not-allowed',
                    '&.Mui-selected': {
                      bgcolor: '#E9E9E7',
                      '&:hover': { bgcolor: '#E9E9E7' },
                    },
                    '&.Mui-disabled': {
                      opacity: 0.5,
                    },
                  }}
                  onClick={() => hasOwnedProperties && setPage("sharedaccess")}
                >
                  <span style={{ display: 'flex', alignItems: 'center', marginRight: 8, width: 28, justifyContent: 'center' }}>
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M9.08078 6.52539H5.48145C5.20545 6.52539 4.98145 6.30139 4.98145 6.02539C4.98145 5.74939 5.20545 5.52539 5.48145 5.52539H9.08078C9.35678 5.52539 9.58078 5.74939 9.58078 6.02539C9.58078 6.30139 9.35678 6.52539 9.08078 6.52539Z" fill="#212121"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M12.8232 9.26239H12.6152C12.3392 9.26239 12.1152 9.03839 12.1152 8.76239C12.1152 8.48639 12.3392 8.26239 12.6152 8.26239H12.8232C13.0992 8.26239 13.3232 8.48639 13.3232 8.76239C13.3232 9.03839 13.0992 9.26239 12.8232 9.26239Z" fill="#212121"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M15.217 11.0971H12.5183C11.2536 11.0971 10.2243 10.0684 10.2236 8.80443C10.2236 7.53909 11.253 6.50976 12.5183 6.50909H15.217C15.493 6.50909 15.717 6.73309 15.717 7.00909C15.717 7.28509 15.493 7.50909 15.217 7.50909H12.5183C11.8043 7.50976 11.2236 8.09043 11.2236 8.80376C11.2236 9.51643 11.805 10.0971 12.5183 10.0971H15.217C15.493 10.0971 15.717 10.3211 15.717 10.5971C15.717 10.8731 15.493 11.0971 15.217 11.0971Z" fill="#212121"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M5.95676 3.5C4.30342 3.5 2.95809 4.84533 2.95809 6.49867V11.2833C2.95809 12.9367 4.30342 14.282 5.95676 14.282H11.7194C13.3728 14.282 14.7174 12.9367 14.7174 11.2833V6.49867C14.7174 4.84533 13.3728 3.5 11.7194 3.5H5.95676ZM11.7193 15.282H5.95667C3.75201 15.282 1.95801 13.488 1.95801 11.2833V6.49867C1.95801 4.29333 3.75201 2.5 5.95667 2.5H11.7193C13.924 2.5 15.7173 4.29333 15.7173 6.49867V11.2833C15.7173 13.488 13.924 15.282 11.7193 15.282Z" fill="#212121"/>
                    </svg>
                  </span>
                  <ListItemText primary={<span style={{ display: isSidebarCollapsed ? 'none' : 'block', color: '#343748', fontWeight: 600 }}>Shared Access</span>} sx={{ display: { xs: 'none', sm: 'none', md: 'block' } }} />
                </ListItemButton>
              </List>
            </Box>
          </Box>
          {/* Bottom Help & Support and User */}
          <Box sx={{ px: 3, pb: 2 }}>
            <ListItemButton
              selected={helpModalOpen}
              onClick={() => setHelpModalOpen(true)}
              sx={{
                borderRadius: 2,
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                width: isSidebarCollapsed ? '48px' : '100%',
                height: isSidebarCollapsed ? '32px' : 'auto',
                minHeight: isSidebarCollapsed ? '32px' : 'auto',
                p: isSidebarCollapsed ? 0 : undefined,
              }}
            >
              <span style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isSidebarCollapsed ? '32px' : 'auto',
                height: isSidebarCollapsed ? '32px' : 'auto',
                borderRadius: isSidebarCollapsed ? '8px' : '0',
                marginRight: isSidebarCollapsed ? 0 : 8,
              }}>
                <HelpSupportIcon />
              </span>
              {!isSidebarCollapsed && (
                <Typography 
                  variant="subtitle2"
                  sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: '1.05rem', opacity: 0.8, fontWeight: 550, color: '#343748' }}
                >
                  Help & Support
                </Typography>
              )}
            </ListItemButton>
            <HelpSupportModal open={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
            <Box sx={{
              position: 'relative',
              width: isSidebarCollapsed ? '60px' : '100%',
              minWidth: 60,
              maxWidth: 'none',
            }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: '#fafaf7',
                  borderRadius: '16px',
                  padding: "3px 3px",
                  marginLeft: -0.35,
                  p: '0.5rem 0.75rem',
                  minHeight: 50,
                  boxShadow: 'none',
                  border: '1px solid #F0F0ED',
                  width: isSidebarCollapsed ? '60px' : '100%',
                  cursor: 'pointer',
                }}
                ref={avatarButtonRef}
                onClick={e => {
                  e.stopPropagation();
                  setUserMenuOpen(!userMenuOpen);
                }}
              >
                <Avatar
                  src={avatarUrl || auth.currentUser?.photoURL || "/avatar.png"}
                  alt={auth.currentUser?.displayName || auth.currentUser?.email || "User"}
                  sx={{ width: 30, height: 30, mr: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                />
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: '1rem',
                    fontWeight: 400,
                    color: '#343748',
                    ml: 1,
                    fontFamily: 'Nunito, Arial, sans-serif',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {(auth.currentUser?.displayName && auth.currentUser.displayName.length > 18)
                    ? auth.currentUser.displayName.slice(0, 18) + '...'
                    : auth.currentUser?.displayName || "User"}
                </Typography>
                <Box sx={{ display: isSidebarCollapsed ? 'none' : 'flex', ml: 2, alignItems: 'center', height: 20, mr: 1 }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4.10254 12.3076L9.84613 7.38454L15.5897 12.3076" stroke="#9CA3AF" strokeWidth="1.23077" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Box>
              </Box>
              <Box
                id="user-menu-popup"
                ref={userMenuRef}
                sx={{
                  position: 'absolute',
                  left: 0,
                  bottom: 'calc(100% + 8px)',
                  width: '100%',
                  minWidth: 160,
                  maxWidth: 280,
                  bgcolor: '#fff',
                  borderRadius: '16px',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                  border: '1px solid #E0E0E0',
                  p: 1.5,
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                  pointerEvents: userMenuOpen ? 'auto' : 'none',
                  opacity: userMenuOpen ? 1 : 0,
                  transform: userMenuOpen ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'opacity 0.35s cubic-bezier(.4,0,.2,1), transform 0.35s cubic-bezier(.4,0,.2,1)',
                  boxSizing: 'border-box',
                }}
              >
                  {/* Settings item */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      px: 2,
                      py: 1,
                      fontWeight: 400,
                      transition: 'background 0.18s',
                      bgcolor: page === 'setting' ? '#E9E9E7' : 'transparent',
                      '&:hover': {
                        background: '#E9E9E7',
                      },
                    }}
                    onClick={() => { setPage('setting'); setUserMenuOpen(false); }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="#212121" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="#212121" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#212121' }}>Settings</Typography>
                  </Box>
                  {/* Sign out item */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      px: 2,
                      py: 1,
                      fontWeight: 400,
                      transition: 'background 0.18s',
                      '&:hover': {
                        background: '#F5F6F8',
                      },
                    }}
                    onClick={handleSignOut}
                  >
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10.0107 4.92632V4.30432C10.0107 2.94766 8.91069 1.84766 7.55402 1.84766H4.30402C2.94802 1.84766 1.84802 2.94766 1.84802 4.30432V11.7243C1.84802 13.081 2.94802 14.181 4.30402 14.181H7.56069C8.91336 14.181 10.0107 13.0843 10.0107 11.7317V11.103" stroke="#C67D57" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14.5397 8.01449H6.51233" stroke="#C67D57" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12.5875 6.0708L14.5395 8.01413L12.5875 9.95813" stroke="#C67D57" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#D97B53', cursor: 'pointer' }} onClick={handleSignOut}>Sign out</Typography>
                  </Box>
              </Box>
              </Box>
            </Box>
          </Box>
      {/* Main Content - Wrapped in Suspense for lazy loading */}
      <Suspense fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
          <CircularProgress sx={{ color: '#89AE99' }} />
        </Box>
      }>
      <Box sx={{ mt: { xs: '48px', md: 0 } }}>
      {page === "setting" ? (
        <Settings sidebar={isSidebarCollapsed} onSubscription={() => {setPage('upgrade')}} />
      ) : page === "property" && selectedPropertyId ? (
        <Property sidebar={isSidebarCollapsed} id={selectedPropertyId || ""} onShowUpgrade={() => setPage('upgrade')} />
      ) : page === "dashboard" ? (
        <MainDashboard
          sidebar={isSidebarCollapsed}
          carouselRef={carouselRef}
          onAddSomeoneClick={() => setPage('sharedaccess')}
          onPropertyClick={(propertyId: string) => {
            setSelectedPropertyId(propertyId);
            setPage('property');
          }}
          onTaskClick={() => {
            setPage('task');
          }}
          onShowUpgrade={() => setPage('upgrade')}
        />
      ) : page === "task" ? (
        <Tasks sidebar={isSidebarCollapsed} />
      ) : page === "calendar" ? (
        <Calendar sidebar={isSidebarCollapsed} />
      ) : page === "reports" ? (
        <Reports sidebar={isSidebarCollapsed} />
      ) : page === "sharedaccess" ? (
        <SharedAccess setting={false} sidebar={isSidebarCollapsed} />
      ) : page === "upgrade" ? (
        <UpgradePlans sidebar={isSidebarCollapsed} onBilling={() => {setPage('setting')}} />
      ) : null}
      </Box>
      </Suspense>
    </Box>
  );
}

export default Dashboard;
