import { Box, Typography, Button, Avatar, TextField, Autocomplete, MenuItem, Divider, Switch } from "@mui/material";
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import { useEffect, useState, useRef } from "react";
import SharedAccess from './SharedAccess';
import PhotoPicker from '../components/PhotoPicker';
import { db } from "../services/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, orderBy, limit } from "firebase/firestore";

const accountMenu = ["Profile", "Display", "Notification", "Security"];
// const householdMenu = ["General", "Members", "Data", "Billing", "Referrals"];
const householdMenu = ["General", "Members", "Billing"];

import { getAuth } from "firebase/auth";
import { useUserAvatar } from '../context/UserAvatarContext';
interface SettingsProps {
  onSubscription: () => void;
  sidebar?: boolean;
}

export default function Settings({ onSubscription, sidebar }: SettingsProps) {
  // Track turn all on/off state for each notification type
  const [allProperlyAllOn, setAllProperlyAllOn] = useState(true);
  const [emailAllOn, setEmailAllOn] = useState(true);

  //photopicker 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [photoPickerImage, setPhotoPickerImage] = useState<string | null>(null);

  // Country and State options
  const countryOptions = [
    "United States", "Canada", "Mexico", "United Kingdom", "Australia", "Germany", "France", "Italy", "Spain", "India", "China", "Japan", "South Korea", "Brazil", "Argentina", "South Africa", "Russia", "Turkey", "Netherlands", "Sweden", "Norway", "Finland", "Denmark", "Switzerland", "Austria", "Belgium", "Ireland", "New Zealand", "Singapore", "Malaysia", "Thailand", "Indonesia", "Philippines", "Vietnam", "Pakistan", "Bangladesh", "Egypt", "Nigeria", "Kenya", "Morocco", "Israel", "Saudi Arabia", "UAE", "Qatar", "Chile", "Colombia", "Peru", "Venezuela", "Poland", "Czech Republic", "Hungary", "Greece", "Portugal"
  ].sort((a, b) => a.localeCompare(b));
  const usStates = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
  function getStateOptions(country: string) {
    if (country === "United States") return usStates;
    return [];
  }
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [panelState, setPanelState] = useState("Profile");
  const [hasOwnedProperties, setHasOwnedProperties] = useState(true); // Assume true until checked
  const auth = getAuth();
  const user = auth.currentUser;
  const { setAvatarUrl } = useUserAvatar();

  // Check if user has any owned properties (for disabling Members tab)
  useEffect(() => {
    async function checkOwnedProperties() {
      if (!user?.uid) return;
      const ownedQ = query(collection(db, "properties"), where("ownerId", "==", user.uid));
      const ownedSnap = await getDocs(ownedQ);
      setHasOwnedProperties(ownedSnap.docs.length > 0);
    }
    checkOwnedProperties();
  }, [user?.uid]);

  // Prefill General panel from user's first property
  useEffect(() => {
    const state = sessionStorage.getItem('onBilling');
    if(state) {
      setPanelState('Billing');
      sessionStorage.removeItem('onBilling');
    }
    // Set all on/off state based on toggles
    setAllProperlyAllOn(
      tasksOverdueToggles[0] && tasksAddedToggles[0] && tasksCompletedToggles[0]
    );
    setEmailAllOn(
      tasksOverdueToggles[1] && tasksAddedToggles[1] && tasksCompletedToggles[1]
    );
    async function prefillGeneralPanel() {
      if (!user?.uid) return;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : {};
      if (userData.household) {
        setHouseholdName(userData.household.householdName || user?.displayName || "");
        setCountry(userData.household.country || "United States");
        setAddress(userData.household.address || "");
        setCity(userData.household.city || "");
        setState(userData.household.state || "");
        setZipCode(userData.household.zipCode || "");
      } else {
        const propertiesRef = collection(db, "properties");
        const q = query(propertiesRef, where("ownerId", "==", user.uid), orderBy("createdAt", "asc"), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const prop = snap.docs[0].data();
          setCity(prop.city || "");
          setCountry(prop.country || "United States");
          setAddress(prop.address1 || "");
          setState(prop.state || "");
          setZipCode(prop.zip || "");
        }
        setHouseholdName(user?.displayName || "");
      }
    }
    prefillGeneralPanel();
  }, [user?.uid]);
  

  interface Invoice {
    id: string;
    date: number;
    amount_paid: number;
  }
  const [userData, setUserData] = useState<any>(null);
  const [invoiceHistory, setInvoiceHistory] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  // Profile panel local state
  const [profileName, setProfileName] = useState("");
  const [profileMonth, setProfileMonth] = useState<number | undefined>(undefined);
  const [profileYear, setProfileYear] = useState<number | undefined>(undefined);
  const [profileTimezone, setProfileTimezone] = useState<string>("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [profileChanged, setProfileChanged] = useState(false);
  const [imageChanged, setImageChanged] = useState(false);
  const [householdChanged, setHouseholdChanged] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [editImage, setEditImage] = useState<string | null>(null); // Cropped image preview (data URL)
  const [originalImage, setOriginalImage] = useState<string | null>(null); // Original image preview (data URL)
  const [editImageBlob, setEditImageBlob] = useState<Blob | null>(null); // Cropped image blob
  const [originalImageBlob, setOriginalImageBlob] = useState<Blob | null>(null); // Original image blob
  const [newFileSelected, setNewFileSelected] = useState(false); // Track if a new file was selected

    useEffect(() => {
      // Fetch originalImage from Firestore for PhotoPicker re-cropping
      if (user?.uid) {
        (async () => {
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data();
            if (data.originalProfileImage) {
              setOriginalImage(data.originalProfileImage);
            }
          }
        })();
      }
    }, [user?.uid, user?.photoURL]);
  // const [editImageBlob, setEditImageBlob] = useState<Blob | null>(null); // Removed duplicate

  // Birthday validation error state
  const [birthdayError, setBirthdayError] = useState<string>("");

  const handleDeleteProperty = () => {
    async function deleteUserTasks() {
      if (!user?.uid) return;
      setDeleteLoading(true);
      try {
        // Delete tasks
        const tasksRef = collection(db, "tasks");
        const tasksQ = query(tasksRef, where("ownerId", "==", user.uid));
        const tasksSnap = await getDocs(tasksQ);
        const deleteTaskPromises = tasksSnap.docs.map(taskDoc => deleteDoc(doc(db, "tasks", taskDoc.id)));
        await Promise.all(deleteTaskPromises);

        // Delete properties owned by user
        const propertiesRef = collection(db, "properties");
        const propsQ = query(propertiesRef, where("ownerId", "==", user.uid));
        const propsSnap = await getDocs(propsQ);
        const deletePropPromises = propsSnap.docs.map(propDoc => deleteDoc(doc(db, "properties", propDoc.id)));
        await Promise.all(deletePropPromises);

        // Remove user from sharedWith in all properties
        const allPropsSnap = await getDocs(propertiesRef);
        const updateSharedPromises = allPropsSnap.docs
          .filter(docSnap => Array.isArray(docSnap.data().sharedWith) && docSnap.data().sharedWith.some((sw: any) => sw.userId === user.uid))
          .map(docSnap => {
            const sharedWith = docSnap.data().sharedWith.filter((sw: any) => sw.userId !== user.uid);
            return updateDoc(doc(db, "properties", docSnap.id), { sharedWith });
          });
        await Promise.all(updateSharedPromises);

        // Delete user document
        const userRef = doc(db, "users", user.uid);
        await deleteDoc(userRef);
      
        setDeleteLoading(false);
        setShowDeleteConfirmModal(false);
        setShowDeleteModal(false);
        // Sign out the user
        await auth.signOut();
      } catch (err) {
        console.error('Failed to delete account:', err);
        setDeleteLoading(false);
        alert('Failed to delete account. Please try again or contact support.');
      }
    }
    deleteUserTasks();
  };

  useEffect(() => {
    async function fetchUserDataAndInvoices() {
      if (user?.uid) {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        let data = snap.exists() ? snap.data() : {};
        setUserData(data);
          // Notification toggles initialization
          setManagerAddedToggles([
            data.inside_managerAdded ?? false,
            data.email_managerAdded ?? false,
            false // push_managerAdded always off
          ]);
          setTasksOverdueToggles([
            data.inside_overdue ?? true,
            data.email_overdue ?? true,
            false // push_overdue always off
          ]);
          setTasksAddedToggles([
            data.inside_taskAdded ?? true,
            data.email_taskAdded ?? true,
            false // push_taskAdded always off
          ]);
          setTasksCompletedToggles([
            data.inside_taskCompleted ?? true,
            data.email_taskCompleted ?? true,
            false // push_taskCompleted always off
          ]);
          setLeaseEndReminderToggles([
            data.insideLeaseEnd ?? true,
            data.emailLeaseEnd ?? true,
            false // pushLeaseEnd always off
          ]);
        setProfileName(data.displayName || user?.displayName || "");
        setProfileMonth(data.birthMonth ?? (user as any)?.birthMonth ?? undefined);
        setProfileYear(data.birthYear ?? (user as any)?.birthYear ?? undefined);
        // Only allow valid US zones
        const allowedZones = ["Eastern", "Central", "Mountain", "Pacific"];
        let tz = data.timezone;
        if (!tz || !allowedZones.includes(tz)) {
          // Try to map IANA to US zone
          type UsZone = 'Eastern' | 'Central' | 'Mountain' | 'Pacific';
          interface IanaGroups {
            eastern: string[];
            central: string[];
            mountain: string[];
            pacific: string[];
          }
          const ianaToUsZone = (tz: unknown): UsZone => {
            if (!tz || typeof tz !== 'string') return 'Eastern';
            const groups: IanaGroups = {
              eastern: [
                'America/New_York', 'America/Detroit', 'America/Kentucky/Louisville', 'America/Kentucky/Monticello',
                'America/Indiana/Indianapolis', 'America/Indiana/Vincennes', 'America/Indiana/Winamac',
                'America/Indiana/Marengo', 'America/Indiana/Petersburg', 'America/Indiana/Vevay',
                'America/Toronto', 'America/Nassau', 'America/Panama', 'America/Port-au-Prince',
                'America/Havana', 'America/Grand_Turk', 'America/Santo_Domingo', 'America/Atikokan',
                'America/Iqaluit', 'America/Montreal', 'America/Nipigon', 'America/Thunder_Bay',
                'America/Resolute', 'America/Rankin_Inlet', 'America/Coral_Harbour'
              ],
              central: [
                'America/Chicago', 'America/Indiana/Tell_City', 'America/Indiana/Knox', 'America/Menominee',
                'America/North_Dakota/Center', 'America/North_Dakota/New_Salem', 'America/North_Dakota/Beulah',
                'America/Winnipeg', 'America/Rainy_River', 'America/Regina', 'America/Swift_Current',
                'America/Matamoros', 'America/Monterrey', 'America/Mexico_City', 'America/Belize',
                'America/Costa_Rica', 'America/El_Salvador', 'America/Guatemala', 'America/Tegucigalpa',
                'America/Managua'
              ],
              mountain: [
                'America/Denver', 'America/Boise', 'America/Shiprock', 'America/Phoenix', 'America/Edmonton',
                'America/Yellowknife', 'America/Cambridge_Bay', 'America/Inuvik', 'America/Hermosillo',
                'America/Chihuahua', 'America/Mazatlan'
              ],
              pacific: [
                'America/Los_Angeles', 'America/Vancouver', 'America/Tijuana', 'America/Whitehorse',
                'America/Dawson', 'America/Juneau', 'America/Sitka', 'America/Yakutat', 'America/Metlakatla',
                'America/Anchorage', 'America/Nome', 'America/Adak'
              ],
            };
            if (groups.eastern.includes(tz)) return 'Eastern';
            if (groups.central.includes(tz)) return 'Central';
            if (groups.mountain.includes(tz)) return 'Mountain';
            if (groups.pacific.includes(tz)) return 'Pacific';
            try {
              const now = new Date();
              const offset: number = -1 * (new Date(now.toLocaleString('en-US', { timeZone: tz as string })).getTimezoneOffset());
              if (offset === 300) return 'Eastern';
              if (offset === 360) return 'Central';
              if (offset === 420) return 'Mountain';
              if (offset === 480) return 'Pacific';
            } catch (e) {}
            return 'Eastern';
          };
          const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone as string;
          tz = ianaToUsZone(userTimezone);
        }
        setProfileTimezone(allowedZones.includes(tz) ? tz : "Eastern");

        // Fetch invoice history from backend API if customerId exists
        if (data.stripeCustomerId) {
          setLoadingInvoices(true);
          try {
            const response = await fetch('https://getstripeinvoicehistory-kgqlakneiq-uc.a.run.app/getStripeInvoiceHistory', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ customerId: data.stripeCustomerId }),
            });
            const result = await response.json();
            if (result.invoice_history) {
              setInvoiceHistory(result.invoice_history);
            }
          } catch (err) {
            console.error('Failed to fetch invoice history:', err);
          } finally {
            setLoadingInvoices(false);
          }
        }
      }
    }
    fetchUserDataAndInvoices();
  }, [user?.uid]);
  // Household General panel state
  const [householdName, setHouseholdName] = useState('');
  const [country, setCountry] = useState('')
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  // Add toggle state for each group of three toggles
  const [tasksOverdueToggles, setTasksOverdueToggles] = useState([true, true, true]);
  const [tasksAddedToggles, setTasksAddedToggles] = useState([true, true, true]);
  const [tasksCompletedToggles, setTasksCompletedToggles] = useState([true, true, true]);
  const [managerAddedToggles, setManagerAddedToggles] = useState([false, false, false]);
  const [leaseEndReminderToggles, setLeaseEndReminderToggles] = useState([true, true, true]);

  const handleStripePortalRedirect = async () => {
    try {
      // Call backend to create Stripe portal session
      const response = await fetch('https://createstripeportalsession-kgqlakneiq-uc.a.run.app/createStripePortalSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: userData?.stripeCustomerId })
      });
      const result = await response.json();
      if (result.url) {
        window.location.href = result.url;
      } else {
        console.log('Unable to redirect to Stripe.');
      }
    } catch (err) {
      console.log('Error connecting to Stripe.');
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 3, bgcolor: "#F9F9F9", minHeight: "100vh", ml: sidebar ? '75px' : '18vw', width: sidebar ? "calc(100vw - 75px)" : "calc(100vw - 18vw)", overflowX: 'hidden' }}>
    {/* <Box sx={{ p: 3, bgcolor: '#F9F9F9', ml: '18vw', width: 'calc(100vw - 18vw)',  display: 'flex', minHeight: '100vh' }}> */}
      <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%', flex: 1 }}>
        {/* Main content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 0, height: '90vh', width: '100%', mt: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 550, fontSize: 18, color: '#222', fontFamily: 'Nunito, Arial, sans-serif', mb: 4 }}>Settings</Typography>
          <Box sx={{ display: 'flex', gap : 1, alignItems: 'stretch', width: '100%', flex: 1 }}>
            {/* Left menu */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                flex: '0 0 340px',
                minWidth: 280,
                maxWidth: 340,
                height: '100%',
                justifyContent: 'flex-start',
              }}
            >
              <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 3, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', width: '100%' }}>
                <Typography sx={{ ml: 2, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 2, color: '#212121', fontSize: 16 }}>Account</Typography>
                {accountMenu.map((item) => (
                  <Button
                    key={item}
                    variant={panelState === item ? "contained" : "text"}
                    sx={{
                      mb: 1,
                      bgcolor: panelState === item ? '#343748' : 'transparent',
                      color: panelState === item ? '#fff' : '#343748',
                      textAlign: 'left',
                      textTransform: 'none',
                      borderRadius: 2,
                      boxShadow: 'none',
                      fontWeight: panelState === item ? 550 : 400,
                      px: 2,
                      py: 1.2,
                      fontFamily: 'Nunito, Arial, sans-serif',
                      width: '100%',
                      justifyContent: 'flex-start',
                      fontSize: 16,
                      letterSpacing: 0.1,
                      '&:hover': { bgcolor: panelState === item ? '#343748' : '#F0F0ED' }
                    }}
                    onClick={() => setPanelState(item)}
                  >
                    {item}
                  </Button>
                ))}
              </Box>
              <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 3, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', width: '100%' }}>
                <Typography sx={{ ml: 2, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 2, color: '#212121', fontSize: 16 }}>HouseHold</Typography>
                {householdMenu.map((item) => {
                  const isDisabled = item === "Members" && !hasOwnedProperties;
                  return (
                  <Button
                    key={item}
                    variant={panelState === item ? "contained" : "text"}
                    disabled={isDisabled}
                    sx={{
                      mb: 1,
                      bgcolor: panelState === item ? '#343748' : 'transparent',
                      color: panelState === item ? '#fff' : '#343748',
                      textAlign: 'left',
                      borderRadius: 2,
                      boxShadow: 'none',
                      fontWeight: panelState === item ? 550 : 400,
                      px: 2,
                      py: 1.2,
                      textTransform: 'none',
                      width: '100%',
                      fontFamily: 'Nunito, Arial, sans-serif',
                      justifyContent: 'flex-start',
                      fontSize: 16,
                      letterSpacing: 0.1,
                      opacity: isDisabled ? 0.5 : 1,
                      '&:hover': { bgcolor: panelState === item ? '#343748' : '#F0F0ED' },
                      '&.Mui-disabled': {
                        color: '#343748',
                        opacity: 0.5,
                      },
                    }}
                    onClick={() => !isDisabled && setPanelState(item)}
                  >
                    {item}
                  </Button>
                  );
                })}
              </Box>
            </Box>
            {/* Right panel */}
            {panelState === "Referrals" && (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                width: '100%',
                height: '100vh',
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                scrollbarWidth: 'none', // Firefox
                '&::-webkit-scrollbar': {
                  display: 'none', // Chrome, Safari
                },
              }}>
                {/* Top promo box - Figma style */}
                <Box sx={{ background: '#fff',  borderRadius: 2, p: 5, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', width: '100%', mb: 1 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'row', gap: 5, width: '100%' }}>
                    {/* Left column: Promo */}
                    <Box sx={{ flex: 1.2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Box sx={{ display: 'inline-block', width: 'fit-content', px: 2, py: 0.5, bgcolor: '#E1F3ED', borderRadius: 99, }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 13, color: '#89AE99' }}>Limited Time</Typography>
                      </Box>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 24, color: '#212121', mb: 2, mt: 1 }}>Give 50% off. Get $50.</Typography>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 16, color: '#212121', mb: 3 }}>Sharing All Properly is a win-win. Gift them 50% off their first year and you'll receive a $50 gift card.</Typography>
                      <Button
                        variant="contained"
                        startIcon={
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M9.82545 1.84133H5.39011C4.00345 1.83599 2.86678 2.94133 2.83411 4.32733V11.4693C2.80345 12.878 3.92011 14.0453 5.32878 14.0767C5.34945 14.0767 5.36945 14.0773 5.39011 14.0767H10.7161C12.1121 14.02 13.2121 12.8667 13.2021 11.4693V5.35866L9.82545 1.84133Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M9.52529 10.2391H5.92529" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M8.16214 7.73714H5.9248" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M9.6499 1.8335V3.77283C9.6499 4.7195 10.4152 5.48683 11.3619 5.4895H13.1986" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        }
                        sx={{ fontFamily: 'Nunito, Arial, sans-serif', background: '#89AE99', color: '#fff', borderRadius: 2, fontSize: 14, fontWeight: 400, mb: 2, boxShadow: 'none', width: 180, height: 42, textTransform: 'none' }}
                      >
                        Copy referral link
                      </Button>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 13, color: '#979797', mb: 3 }}>Must sign up for the annual plan on web using your referral link.</Typography>
                    </Box>
                    {/* Right column: Share buttons and social icons */}
                    <Box sx={{ flex: 1.1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                      <Button
                        startIcon={
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="24" height="24" rx="2" fill="#55A271"/>
                            <path fillRule="evenodd" clipRule="evenodd" d="M16.7139 16.7134C14.6765 18.7511 11.6595 19.1913 9.19062 18.0495C8.82615 17.9028 8.52733 17.7842 8.24326 17.7842C7.452 17.7889 6.46712 18.5561 5.95525 18.0448C5.44338 17.5329 6.21118 16.5472 6.21118 15.7512C6.21118 15.4671 6.09728 15.1736 5.95056 14.8084C4.80823 12.3399 5.24908 9.32195 7.28651 7.28497C9.88741 4.68312 14.113 4.68312 16.7139 7.2843C19.3195 9.89017 19.3148 14.1122 16.7139 16.7134Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M14.6253 12.2752H14.6313" stroke="white" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M11.9534 12.2752H11.9594" stroke="white" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M9.28053 12.2752H9.28653" stroke="white" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        }
                        endIcon={
                          <svg width="17" height="14" viewBox="0 0 17 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.75 6.77441L0.75 6.77441" stroke="#999999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M9.7002 0.749828L15.7502 6.77383L9.7002 12.7988" stroke="#999999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        }
                          sx={{
                            fontFamily: 'Nunito, Arial, sans-serif',
                            background: '#F7F6F4',
                            color: '#212121',
                            borderRadius: 2,
                            fontWeight: 400,
                            fontSize: 15,
                            px: 3,
                            py: 4,
                            boxShadow: 'none',
                            textTransform: 'none',
                            width: '100%',
                            height: 48,
                            justifyContent: 'flex-start',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0,
                            '& .MuiButton-startIcon': {
                              marginRight: 2,
                              display: 'flex',
                              alignItems: 'center',
                            },
                            '& .MuiButton-endIcon': {
                              marginLeft: 'auto',
                              display: 'flex',
                              alignItems: 'center',
                            },
                            '& .MuiButton-label': {
                              textAlign: 'left',
                            },
                          }}
                      >
                        Send Via Chat
                      </Button>
                      <Button
                        startIcon={
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="24" height="24" rx="2" fill="#ED7240"/>
                            <path d="M15.9352 9.90088L12.973 12.3096C12.4134 12.7536 11.626 12.7536 11.0663 12.3096L8.0791 9.90088" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                            <path fillRule="evenodd" clipRule="evenodd" d="M15.2723 18C17.2998 18.0056 18.6663 16.3397 18.6663 14.2922V9.71334C18.6663 7.66588 17.2998 6 15.2723 6H8.7271C6.69953 6 5.33301 7.66588 5.33301 9.71334V14.2922C5.33301 16.3397 6.69953 18.0056 8.7271 18H15.2723Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        }
                        endIcon={
                          <svg width="17" height="14" viewBox="0 0 17 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.75 6.77441L0.75 6.77441" stroke="#999999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M9.7002 0.749828L15.7502 6.77383L9.7002 12.7988" stroke="#999999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        }
                          sx={{
                            fontFamily: 'Nunito, Arial, sans-serif',
                            background: '#F7F6F4',
                            color: '#212121',
                            borderRadius: 2,
                            fontWeight: 400,
                            fontSize: 15,
                            px: 3,
                            py: 4,
                            boxShadow: 'none',
                            textTransform: 'none',
                            width: '100%',
                            height: 48,
                            justifyContent: 'flex-start',
                            display: 'flex',
                            alignItems: 'center',
                            mb: -2,
                            '& .MuiButton-startIcon': {
                              marginRight: 2,
                              display: 'flex',
                              alignItems: 'center',
                            },
                            '& .MuiButton-endIcon': {
                              marginLeft: 'auto',
                              display: 'flex',
                              alignItems: 'center',
                            },
                            '& .MuiButton-label': {
                              textAlign: 'left',
                            },
                          }}
                      >
                        Share Via Email
                      </Button>
                      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3, mt: 2, justifyContent: 'space-between', width: '100%' }}>
                        <Button sx={{ flex: 1, minWidth: 0, minHeight: 56, height: 64, background: '#F7F6F4', color: '#212121', borderRadius: 2, boxShadow: 'none', p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', maxWidth: 'none' }}>
                          <img src="/facebook.svg" alt="Facebook" style={{ width: 24, height: 24 }} />
                        </Button>
                        <Button sx={{ flex: 1, minWidth: 0, minHeight: 56, height: 64, background: '#F7F6F4', color: '#212121', borderRadius: 2, boxShadow: 'none', p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', maxWidth: 'none' }}>
                          <img src="/linkedin.svg" alt="LinkedIn" style={{ width: 24, height: 24 }} />
                        </Button>
                        <Button sx={{ flex: 1, minWidth: 0, minHeight: 56, height: 64, background: '#F7F6F4', color: '#212121', borderRadius: 2, boxShadow: 'none', p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', maxWidth: 'none' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="24" height="24" rx="2" fill="#000"/>
                            <path d="M7 17L17 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M17 17L7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </Box>
                {/* Referrals summary box */}
                <Box sx={{ background: '#fff', borderRadius: 2, p: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', width: '100%', mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 18, color: '#212121', mb: 2 }}>Referrals</Typography>
                  </Box>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 15, color: '#212121', mb: 2 }}>2025</Typography>
                  <Box sx={{ position: 'relative', width: '100%', height: 6, bgcolor: '#ECEAE6',  borderRadius: 2, mb: 2 }}>
                    <Box sx={{ position: 'absolute', right: 0, top: -22, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 15, color: '#979797' }}>
                      $0 / $500
                    </Box>
                    <Box sx={{ width: '0%', height: '100%', bgcolor: '#89AE99',  borderRadius: 2 }} />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Box sx={{ flex: 1, bgcolor: '#F9F9F9', borderRadius: 2, p: 2, textAlign: 'center' }}>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 32, color: '#348E14' }}>$0</Typography>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 13, color: '#212121' }}>Earned in 2025</Typography>
                    </Box>
                    <Box sx={{ flex: 1, bgcolor: '#F9F9F9', borderRadius: 2, p: 2, textAlign: 'center' }}>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 32, color: '#212121' }}>1</Typography>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 13, color: '#212121' }}>Pending</Typography>
                    </Box>
                    <Box sx={{ flex: 1, bgcolor: '#F9F9F9', borderRadius: 2, p: 2, textAlign: 'center' }}>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 32, color: '#212121' }}>0</Typography>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 13, color: '#212121' }}>Completed</Typography>
                    </Box>
                  </Box>
                </Box>
                {/* Referrals info box */}
                <Box sx={{ background: '#fff', borderRadius: 2, p: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 4, mb: 2 }}>
                  <Box sx={{ flex: 7, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 18, color: '#212121', mb: 2 }}>Referrals</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box sx={{ width: 32, height: 32, bgcolor: '#F9F9F9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 550, color: '#BDBDBD', fontSize: 18 }}>1</Box>
                      <Box>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 16, color: '#212121', mb: 0.5 }}>Share your referral link</Typography>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 14, color: '#212121', mb: 0.5 }}>Using your referral link will make sure you both benefit.</Typography>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 13, color: '#979797', mb: 0.5 }}>https://www.allproperly.com/referral/dqby4flj0g</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box sx={{ width: 32, height: 32, bgcolor: '#F9F9F9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 550, color: '#BDBDBD', fontSize: 18 }}>2</Box>
                      <Box>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 16, color: '#212121', mb: 0.5 }}>They get 50% off their first year</Typography>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 14, color: '#212121' }}>Once they become a subscriber and connect their accounts, you're one step closer to earning a gift card.</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box sx={{ width: 32, height: 32, bgcolor: '#F9F9F9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 550, color: '#BDBDBD', fontSize: 18 }}>3</Box>
                      <Box>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 16, color: '#212121', mb: 0.5 }}>You earn a $50 gift card</Typography>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 14, color: '#212121' }}>30 days after they subscribe, we'll email you a link to redeem your gift.</Typography>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 14, color: '#212121' }}>Choose from thousands of options such as Amazon, Airbnb, and Uber or even donate to charity!</Typography>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 12, color: '#979797', mb: 1 }}>You may earn up to $500 in gift cards per year. By participating in this program, you agree with these terms.</Typography>
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ flex: 5, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                    <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                      <img src="/referral.png" alt="$50 Gift Card" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8, background: '#F9F9F9' }} />
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ width: '100%', background: '#fff', borderRadius: 2, p: 3, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', display: 'flex', alignItems: 'center', mt: 2 }}>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 15, color: '#212121', flex: 1 }}>
                      Quickly access your referral link in the left navigation and monthly review flow
                    </Typography>
                    <Switch
                      checked
                      color="success"
                      sx={{
                        mr: 2,
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
                          top: '0.4px',
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
            )}
            {panelState === "Billing" && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                <Box sx={{ background: '#fff', borderRadius: 2, p: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', width: '100%' }}>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 4, color: '#212121', fontSize: 16 }}>Billing</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 14, color: '#212121' }}>Current Plan</Typography>
                    <Typography onClick={onSubscription} sx={{ cursor: 'pointer', color: '#89AE99', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 14, textTransform: 'none', background: 'none', boxShadow: 'none', p: 0, minWidth: 0 }}>
                      Manage Subscription
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#212121', fontSize: 16 }}>
                      {(() => {
                        const planMap: Record<string, string> = {
                          free: 'Free',
                          basic: 'Basic Monthly',
                          plus: 'Plus Monthly',
                          plus_annual: 'Plus Yearly',
                          basic_annual: 'Basic Yearly',
                        };
                        const plan = userData?.planState || 'free';
                        return planMap[plan] || 'Free';
                      })()}
                    </Typography>
                    {userData?.planState && userData.planState !== 'free' && (
                      <Box sx={{ bgcolor: '#475567', color: '#fff', px: 1.5, py: 0.5, borderRadius: 2, fontSize: 13, fontWeight: 550, ml: 1 }}>Active</Box>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontWeight: 400, mb: 1, color: '#61636D', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }}>Payment Method</Typography>
                    <Typography onClick={handleStripePortalRedirect} sx={{ cursor: 'pointer', color: '#89AE99', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 14, textTransform: 'none', background: 'none', boxShadow: 'none', p: 0, minWidth: 0 }}>
                      Update Payment Method
                    </Typography>
                  </Box>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, mb: 4, color: '#212121', fontSize: 16 }}>Visa ending in {userData?.cardLast4}</Typography>
                  <Typography sx={{ fontWeight: 400, mb: 2, color: '#61636D', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }}>Next Payment</Typography>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, mb: 2, color: '#212121', fontSize: 16 }}>
                    {(() => {
                      const planPrices: Record<string, number> = {
                        basic: 15,
                        plus: 30,
                        basic_annual: 100,
                        plus_annual: 200,
                      };
                      const planIntervals: Record<string, string> = {
                        basic: 'month',
                        plus: 'month',
                        basic_annual: 'year',
                        plus_annual: 'year',
                      };
                      const plan = userData?.planState;
                      const updatedDate = userData?.subscriptionUpdatedDate;
                      if (!plan || !updatedDate || !planPrices[plan] || !planIntervals[plan]) return '—';
                      const price = planPrices[plan];
                      const dateObj = new Date(updatedDate);
                      if (planIntervals[plan] === 'month') {
                        dateObj.setMonth(dateObj.getMonth() + 1);
                      } else if (planIntervals[plan] === 'year') {
                        dateObj.setFullYear(dateObj.getFullYear() + 1);
                      }
                      return `$${price} on ${dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
                    })()}
                  </Typography>
                  <Typography sx={{ fontWeight: 400, color: '#61636D', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }}>Depending on your state, you may see sales tax included in your final charge.</Typography>
                </Box>
                <Box sx={{ background: '#fff', borderRadius: 2, p: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', width: '100%' }}>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, color: '#212121', fontSize: 16, mb: 2 }}>Invoices</Typography>
                  <Box sx={{ maxHeight: '320px', overflowY: 'auto', 'scrollbar-width': 'none', msOverflowStyle: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
                    {loadingInvoices ? (
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#212121', fontSize: 16 }}>Loading...</Typography>
                    ) : invoiceHistory.length === 0 ? (
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#212121', fontSize: 16 }}>No invoices found.</Typography>
                    ) : (
                      invoiceHistory.filter(inv => inv.amount_paid > 0).map((inv) => (
                        <Box key={inv.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, py: 1 }}>
                          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#212121', fontSize: 16 }}>
                            {new Date(inv.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </Typography>
                          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#212121', fontSize: 16 }}>
                            ${inv.amount_paid.toFixed(2)}
                          </Typography>
                        </Box>
                      ))
                    )}
                  </Box>
                </Box>
              </Box>
            )}
            {panelState === "Data" && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                <Box sx={{ background: '#fff', borderRadius: 2, p: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', width: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 2, color: '#212121', fontSize: 16 }}>Download report</Typography>
                  </Box>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 15, color: '#212121', mb: 3 }}>
                    Easily download all your reports in CSV format by clicking the button below.
                  </Typography>
                  <Button variant="contained" disabled sx={{ textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif', background: '#89AE99', color: '#fff', borderRadius: 2, fontSize: 16, height: 48, boxShadow: 'none', width: '100%' }}>
                    Download Report
                  </Button>
                </Box>
                <Box sx={{ background: '#fff', borderRadius: 2, p: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', width: '100%' }}>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 2, color: '#212121', fontSize: 16 }}>Remove property data</Typography>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 15, color: '#212121', mb: 2 }}>
                    If you want to remove the data collected on your property. Read more about this in our <a href="#" style={{ fontWeight: 550, color: '#89AE99' }}>help center</a>.
                  </Typography>
                  <Button variant="contained" onClick={() => setShowDeleteModal(true)} sx={{ textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif', background: '#89AE99', color: '#fff', borderRadius: 2, fontSize: 16, height: 48, boxShadow: 'none', width: '100%' }}>
                    Remove
                  </Button>
                </Box>
                  {/* Shared backdrop for delete modals */}
                  {(showDeleteModal || showDeleteConfirmModal) && (
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
                        setShowDeleteModal(false);
                        setShowDeleteConfirmModal(false);
                      }}
                    />
                  )}
                  {/* First Delete Modal (permanently remove) - replaced with Dialog */}
                  {showDeleteModal && (
                    <Dialog
                      open={showDeleteModal}
                      onClose={() => setShowDeleteModal(false)}
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
                        Delete Account
                      </DialogTitle>
                      <DialogContent sx={{ px: 3, pt: 0, pb: 3 }}>
                        <Box
                          sx={{
                            bgcolor: '#F9B55D',
                            color: '#343748',
                            borderRadius: '10px',
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
                          You are about to delete your account permanently. Are you sure you want to continue?
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                          <Button
                            onClick={() => { setShowDeleteModal(false); setShowDeleteConfirmModal(true); }}
                            sx={{
                              borderRadius: '8px',
                              minWidth: 120,
                              height: 44,
                              bgcolor: '#E57373',
                              color: 'rgba(255, 255, 255, 1)',
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
                            onClick={() => setShowDeleteModal(false)}
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
                  )}
                  {/* Second Confirm Modal (cannot be undone) */}
                  {showDeleteConfirmModal && (
                    <Dialog
                      open={showDeleteConfirmModal}
                      onClose={() => setShowDeleteConfirmModal(false)}
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
                        Delete Account
                      </DialogTitle>
                      <DialogContent sx={{ px: 3, pt: 0, pb: 3 }}>
                        <Box
                          sx={{
                            bgcolor: '#F9B55D',
                            color: '#343748',
                            borderRadius: '10px',
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
                          Are you sure you want to remove your account? This CANNOT be undone.
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                          <Button
                            onClick={() => setShowDeleteConfirmModal(false)}
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
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                          </Button>
                        </Box>
                      </DialogContent>
                    </Dialog>
                  )}
              </Box>
            )}
            {panelState === "Members" && (
              <Box sx={{ height: 'fit-content', maxHeight: '90vh', width: '100%', minHeight: 400 }}>
                {/* <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 2, color: '#212121', fontSize: 16 }}>
                    Household Members
                  </Typography>
                  <Typography sx={{ cursor: 'pointer', color: '#509CBA', fontWeight: 400, fontSize: 14, textTransform: 'none', background: 'none', mb: 2, boxShadow: 'none', p: 0, minWidth: 0 }}>
                    Add Household Member
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 20, color: '#212121', mb: 1 }}>
                  Share the load. <span style={{ fontWeight: 400 }}>Add your kids, siblings, partners, or helpers so everyone’s on the same page and every property stays in proper order.</span>
                </Typography>
                <Box sx={{ mt: 3, mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Avatar src="/avatar.png" sx={{ width: 32, height: 32 }} />
                    <Box>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 15, color: '#212121' }}>Janette Fisher</Typography>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 13, color: '#89AE99' }}>Family Member</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Avatar src="/avatar.png" sx={{ width: 32, height: 32 }} />
                    <Box>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 15, color: '#212121' }}>Brandan Fisher</Typography>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 13, color: '#89AE99' }}>Family Manager</Typography>
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, mb: 1 }}>
                  <Typography variant="h6" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 2, color: '#212121', fontSize: 16 }}>Trusted Friend</Typography>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', cursor: 'pointer', color: '#509CBA', mb: 2, fontWeight: 400, fontSize: 14, textTransform: 'none', background: 'none', boxShadow: 'none', p: 0, minWidth: 0 }}>
                    Give Access to Friend
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 20, color: '#212121', mb: 1 }}>
                  Whether it’s a friend or a professional handling responsibilities,
                </Typography>
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 20, color: '#212121' }}>
                  they’ll have secure, temporary access for up to 90 days – and you can end access at any time.
                </Typography> */}
                <SharedAccess setting={true} />
              </Box>
            )}
            {panelState === "General" && (
              <Box sx={{ background: '#fff', borderRadius: 2, p: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', width: '100%', height: 'fit-content', minHeight: 500 }}>
                <Typography variant="h6" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 600, mb: 3, color: '#343748', fontSize: 20 }}>
                  Household
                </Typography>
                <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#404040', fontSize: 14, mb: 1 }}>Household Name</Typography>
                    <TextField
                      variant="outlined"
                      value={householdName}
                      onChange={e => { setHouseholdName(e.target.value); setHouseholdChanged(true); }}
                      sx={{ background: '#fff', borderRadius: 4, fontSize: 14 }}
                      InputProps={{ style: { fontSize: 14, color: '#525252' } }}
                      fullWidth
                    />
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#404040', fontSize: 14, mb: 1 }}>Country</Typography>
                    <Autocomplete
                      options={countryOptions}
                      value={country || null}
                      onChange={(_, value) => { setCountry(value ?? ""); setHouseholdChanged(true); }}
                      freeSolo
                      renderInput={(params) => (
                        <TextField {...params} variant="outlined" sx={{ background: '#fff', borderRadius: 4, fontSize: 14 }} InputProps={{ ...params.InputProps, style: { fontSize: 14, color: '#525252' } }} />
                      )}
                      sx={{ width: '100%' }}
                    />
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#404040', fontSize: 14, mb: 1 }}>Address</Typography>
                    <TextField
                      variant="outlined"
                      value={address}
                      onChange={e => { setAddress(e.target.value); setHouseholdChanged(true); }}
                      sx={{ background: '#fff', borderRadius: 4, fontSize: 14 }}
                      InputProps={{ style: { fontSize: 14, color: '#525252' } }}
                      fullWidth
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#404040', fontSize: 14, mb: 1 }}>City</Typography>
                      <TextField
                        variant="outlined"
                        value={city}
                        onChange={e => { setCity(e.target.value); setHouseholdChanged(true); }}
                        sx={{ background: '#fff', borderRadius: 4, fontSize: 14 }}
                        InputProps={{ style: { fontSize: 14, color: '#525252' } }}
                        fullWidth
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#404040', fontSize: 14, mb: 1 }}>State</Typography>
                      <Autocomplete
                        options={getStateOptions(country)}
                        value={state || null}
                        onChange={(_, value) => { setState(value ?? ""); setHouseholdChanged(true); }}
                        freeSolo
                        renderInput={(params) => (
                          <TextField {...params} variant="outlined" sx={{ background: '#fff', borderRadius: 4, fontSize: 14 }} InputProps={{ ...params.InputProps, style: { fontSize: 14, color: '#525252' } }} />
                        )}
                        sx={{ width: '100%' }}
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#404040', fontSize: 14, mb: 1 }}>Zip Code</Typography>
                      <TextField
                        variant="outlined"
                        value={zipCode}
                        onChange={e => { setZipCode(e.target.value); setHouseholdChanged(true); }}
                        sx={{ background: '#fff', borderRadius: 4, fontSize: 14 }}
                        inputProps={{ maxLength: 5, inputMode: 'numeric' }}
                        InputProps={{ style: { fontSize: 14, color: '#525252' } }}
                        fullWidth
                      />
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    sx={{
                      bgcolor: '#89AE99',
                      color: '#fff',
                      borderRadius: 2,
                      fontWeight: 550,
                      fontSize: 17,
                      py: 1.5,
                      fontFamily: 'Nunito, Arial, sans-serif',
                      width: '100%',
                      boxShadow: 'none',
                      textTransform: 'none',
                      mt: 2
                    }}
                    disabled={!householdChanged}
                    onClick={async () => {
                      if (user?.uid) {
                        const ref = doc(db, "users", user.uid);
                        await updateDoc(ref, {
                          household: {
                            householdName,
                            country,
                            address,
                            city,
                            state,
                            zipCode,
                          }
                        });
                      }
                      setHouseholdChanged(false);
                    }}
                  >
                    Update Household
                  </Button>
                </Box>
              </Box>
            )}
            {panelState === "Profile" && (
              <Box
                sx={{
                  flex: 1,
                  bgcolor: '#fff',
                  borderRadius: 2,
                  p: 4,
                  boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                  border: '1px solid #E0E0E0',
                  minWidth: 480,
                  height: 'fit-content',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                }}
              >
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 2, color: '#212121', fontSize: 16 }}>Profile</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box sx={{ position: 'relative', width: 48, height: 48 }}>
                    <Avatar
                      src={editImage || user?.photoURL || "/avatar.png"}
                      sx={{ width: 48, height: 48, cursor: 'pointer' }}
                      onClick={() => {
                        // If showing default avatar, open file selector; else open PhotoPicker with original image
                        if (!originalImage && !editImage && !user?.photoURL) {
                          fileInputRef.current?.click();
                        } else {
                          // Always use in-memory original image for cropping if available
                          const imageToShow = originalImage || editImage || user?.photoURL;
                          if (imageToShow) {
                            setPhotoPickerImage(imageToShow);
                            setShowPhotoPicker(true);
                          }
                        }
                      }}
                    />
                  </Box>
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
                    '&:hover': {
                        background: '#f5f5f5',
                        borderColor: '#B0B0B0',
                    },
                  }} onClick={() => { if (fileInputRef.current) fileInputRef.current.click(); }}>
                    <span style={{ fontFamily: 'Nunito, Arial, sans-serif', padding: 1, color: '#212121', fontWeight: 400, fontSize: 13 }}>Change Picture</span>
                  </Button>
                </Box>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.tif,.tiff,.webp"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setNewFileSelected(true); // Mark that a new file was selected
                    const reader = new FileReader();
                    reader.onload = () => {
                      setPhotoPickerImage(reader.result as string);
                      setShowPhotoPicker(true);
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
                {/* PhotoPicker modal, only shown when triggered */}
                <Dialog open={showPhotoPicker} onClose={() => setShowPhotoPicker(false)} maxWidth="xs" fullWidth>
                  <Box>
                    {photoPickerImage && (
                      <PhotoPicker
                        aspect={1}
                        imageSrc={photoPickerImage}
                        avatarStyle={true}
                        onCropped={async (blob, previewUrl) => {
                          setShowPhotoPicker(false);
                          setPhotoPickerImage(null);
                          if (blob && previewUrl) {
                            setEditImage(previewUrl);
                            setEditImageBlob(blob);
                            setImageChanged(true);
                            // Always set originalImageBlob to something valid
                            if (photoPickerImage) {
                              if (photoPickerImage.startsWith('data:')) {
                                const res = await fetch(photoPickerImage);
                                const origBlob = await res.blob();
                                setOriginalImageBlob(origBlob);
                                setOriginalImage(photoPickerImage);
                              } else {
                                setOriginalImageBlob(blob); // Use cropped blob as fallback
                                setOriginalImage(photoPickerImage);
                              }
                            } else {
                              setOriginalImageBlob(blob); // Fallback if no photoPickerImage
                            }
                          } else {
                            alert('Failed to crop image. Please try again.');
                          }
                        }}
                        onClose={() => {
                          setShowPhotoPicker(false);
                          setPhotoPickerImage(null);
                        }}
                      />
                    )}
                  </Box>
                </Dialog>
                <Divider sx={{ mb: 2 }} />
                <Typography sx={{ fontWeight: 400, mb: 1, color: '#61636D', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }}>Name</Typography>
                <TextField
                  fullWidth
                  value={profileName}
                  onChange={e => {setProfileName(e.target.value); setProfileChanged(true);}}
                  variant="outlined"
                  sx={{ mb: 2, background: '#fff', fontSize: 14, borderRadius: 2 }}
                  inputProps={{ style: { fontSize: 14, color: '#525252' } }}
                />
                <Typography sx={{ fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 1, color: '#212121', fontSize: 14 }}>Birthday</Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Typography sx={{ fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.5, color: '#61636D', fontSize: 13 }}>Month</Typography>
                    <Autocomplete
                      options={[...Array(12)].map((_, i) => i + 1)}
                      value={profileMonth ?? null}
                      onChange={(_, value) => {
                        setProfileMonth(value ?? undefined);
                        setProfileChanged(true);
                        // Validate birthday
                        if (profileYear && value) {
                          const today = new Date();
                          const selected = new Date(profileYear, value - 1, 1);
                          if (selected > today) {
                            setBirthdayError("Birthday cannot be in the future.");
                          } else {
                            setBirthdayError("");
                          }
                        } else {
                          setBirthdayError("");
                        }
                      }}
                      getOptionLabel={option => option?.toString()}
                      renderInput={(params) => (
                        <TextField {...params} variant="outlined" sx={{ background: '#fff', fontSize: 14, borderRadius: 4 }} />
                      )}
                      sx={{ width: '100%' }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Typography sx={{ fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.5, color: '#61636D', fontSize: 13 }}>Year</Typography>
                    <Autocomplete
                      options={[...Array(2025 - 1935 + 1)].map((_, i) => 2025 - i)}
                      value={profileYear ?? null}
                      onChange={(_, value) => {
                        setProfileYear(value ?? undefined);
                        setProfileChanged(true);
                        // Validate birthday
                        if (value && profileMonth) {
                          const today = new Date();
                          const selected = new Date(value, profileMonth - 1, 1);
                          if (selected > today) {
                            setBirthdayError("Birthday cannot be in the future.");
                          } else {
                            setBirthdayError("");
                          }
                        } else {
                          setBirthdayError("");
                        }
                      }}
                      getOptionLabel={option => option?.toString()}
                      renderInput={(params) => (
                        <TextField {...params} variant="outlined" sx={{ background: '#fff', fontSize: 14, borderRadius: 4 }} />
                      )}
                      sx={{ width: '100%' }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Typography sx={{ fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.5, color: '#61636D', fontSize: 13 }}>Timezone</Typography>
                    <Autocomplete
                      options={["Eastern", "Central", "Mountain", "Pacific"]}
                      value={profileTimezone || null}
                      onChange={(_, value) => { setProfileTimezone(value ?? ""); setProfileChanged(true); }}
                      getOptionLabel={option => option?.toString()}
                      renderInput={(params) => (
                        <TextField {...params} variant="outlined" sx={{ background: '#fff', fontSize: 14, borderRadius: 4 }} />
                      )}
                      sx={{ width: '100%' }}
                    />
                  </Box>
                </Box>
                {birthdayError && (
                  <Typography color="error" sx={{ mb: 2, fontWeight: 400, fontSize: 14 }}>{birthdayError}</Typography>
                )}
                <Button
                  variant="contained"
                  sx={{
                    bgcolor: '#89AE99',
                    color: '#fff',
                    borderRadius: 2,
                    fontWeight: 550,
                    fontSize: 17,
                    py: 1.5,
                    fontFamily: 'Nunito, Arial, sans-serif',
                    width: '100%',
                    boxShadow: 'none',
                    textTransform: 'none',
                    mt: 2
                  }}
                  disabled={updatingProfile || !(profileChanged || imageChanged) || !!birthdayError}
                  onClick={async () => {
                    setUpdatingProfile(true);
                    try {
                      // Final validation before submit
                      if (profileYear && profileMonth) {
                        const today = new Date();
                        const selected = new Date(profileYear, profileMonth - 1, 1);
                        if (selected > today) {
                          setBirthdayError("Birthday cannot be in the future.");
                          setUpdatingProfile(false);
                          return;
                        }
                      }
                      let updateSuccess = true;
                      if (user?.uid) {
                        try {
                          const ref = doc(db, "users", user.uid);
                          let photoURL = user.photoURL;
                          // If image changed, upload to storage and get URL
                          if (imageChanged && editImageBlob && originalImageBlob) {
                            // Only compress if image size > 1.5MB
                            const compressAndResizeImage = async (blob: Blob) => {
                              // Always resize to max 1024px on longest side, apply sharpening, and convert to WebP
                              return new Promise<Blob>((resolve) => {
                                const img = new window.Image();
                                const objectUrl = URL.createObjectURL(blob);
                                img.onload = () => {
                                  URL.revokeObjectURL(objectUrl); // Prevent memory leak
                                  let w = img.width;
                                  let h = img.height;
                                  const maxSide = 1024;
                                  if (w > h && w > maxSide) {
                                    h = Math.round((maxSide / w) * h);
                                    w = maxSide;
                                  } else if (h > w && h > maxSide) {
                                    w = Math.round((maxSide / h) * w);
                                    h = maxSide;
                                  } else if (w === h && w > maxSide) {
                                    w = h = maxSide;
                                  }
                                  const canvas = document.createElement('canvas');
                                  canvas.width = w;
                                  canvas.height = h;
                                  const ctx = canvas.getContext('2d');
                                  if (ctx) {
                                    ctx.drawImage(img, 0, 0, w, h);
                                    // Apply sharpening filter (simple convolution kernel)
                                    try {
                                      const imageData = ctx.getImageData(0, 0, w, h);
                                      // Sharpen kernel
                                      const kernel = [
                                        0, -1,  0,
                                       -1,  5, -1,
                                        0, -1,  0
                                      ];
                                      const side = 3;
                                      const halfSide = Math.floor(side / 2);
                                      const src = imageData.data;
                                      const sw = imageData.width;
                                      const sh = imageData.height;
                                      const output = ctx.createImageData(sw, sh);
                                      const dst = output.data;
                                      for (let y = 0; y < sh; y++) {
                                        for (let x = 0; x < sw; x++) {
                                          for (let c = 0; c < 4; c++) {
                                            let sum = 0;
                                            for (let ky = 0; ky < side; ky++) {
                                              for (let kx = 0; kx < side; kx++) {
                                                const px = x + kx - halfSide;
                                                const py = y + ky - halfSide;
                                                if (px >= 0 && px < sw && py >= 0 && py < sh) {
                                                  const offset = ((py * sw) + px) * 4 + c;
                                                  sum += src[offset] * kernel[ky * side + kx];
                                                }
                                              }
                                            }
                                            const dstOffset = ((y * sw) + x) * 4 + c;
                                            if (c === 3) {
                                              // alpha channel
                                              dst[dstOffset] = src[dstOffset];
                                            } else {
                                              dst[dstOffset] = Math.min(255, Math.max(0, sum));
                                            }
                                          }
                                        }
                                      }
                                      ctx.putImageData(output, 0, 0);
                                    } catch (e) {
                                      // If sharpening fails, fallback to unsharpened
                                    }
                                  }
                                  canvas.toBlob((compressedBlob) => {
                                    resolve(compressedBlob || blob);
                                  }, 'image/webp', 0.8);
                                };
                                img.onerror = () => {
                                  URL.revokeObjectURL(objectUrl);
                                  resolve(blob); // Fallback to original blob
                                };
                                img.src = objectUrl;
                              });
                            };
                            const { getStorage, ref: sRef, uploadBytes, getDownloadURL } = await import("firebase/storage");
                            const storage = getStorage();
                            let originalUrl = originalImage;
                            // If a new file was selected, upload original image
                            if (newFileSelected && originalImageBlob) {
                              const compressedOriginal = await compressAndResizeImage(originalImageBlob);
                              const originalRef = sRef(storage, `avatars/${user.uid}_original`);
                              await uploadBytes(originalRef, compressedOriginal);
                              originalUrl = await getDownloadURL(originalRef);
                              setOriginalImage(originalUrl);
                              setNewFileSelected(false); // Reset flag after upload
                            }
                            // Always upload cropped image
                            const compressedCropped = await compressAndResizeImage(editImageBlob);
                            const croppedRef = sRef(storage, `avatars/${user.uid}`);
                            await uploadBytes(croppedRef, compressedCropped);
                            const croppedUrl = await getDownloadURL(croppedRef);
                            photoURL = croppedUrl;
                            // Update Firebase Auth user profile
                            const { updateProfile } = await import("firebase/auth");
                            await updateProfile(user, { photoURL });
                            // Update avatar context so sidebar updates immediately
                            try { setAvatarUrl(photoURL); } catch (e) { /* ignore if provider missing */ }
                          }
                          const updateData: Record<string, any> = {
                            displayName: profileName,
                            timezone: profileTimezone,
                            ...(photoURL ? { photoURL } : {}),
                          };
                          if (typeof profileMonth !== 'undefined') updateData.birthMonth = profileMonth;
                          if (typeof profileYear !== 'undefined') updateData.birthYear = profileYear;
                          if (imageChanged && editImageBlob && originalImage) {
                            updateData.originalProfileImage = originalImage;
                          }
                          await updateDoc(ref, updateData);
                          setUserData((prev: any) => ({ ...prev, displayName: profileName, birthMonth: profileMonth, birthYear: profileYear, timezone: profileTimezone, photoURL }));
                        } catch (err) {
                          updateSuccess = false;
                          alert('Failed to update avatar. Please try again.');
                        }
                      }
                      if (updateSuccess) {
                        setEditImage(null);
                        setEditImageBlob(null);
                        setProfileChanged(false);
                        setImageChanged(false);
                      }
                    } finally {
                      setUpdatingProfile(false);
                    }
                  }}
                >
                  {updatingProfile ? 'Updating Profile' : 'Update Profile'}
                </Button>
              </Box>
            )}
            {panelState === "Security" && (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* Email & Password */}
                <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', width: '100%' }}>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 3, color: '#212121', fontSize: 18 }}>Email & Password</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', mb: 1 }}>
                    <Box>
                      <Typography sx={{ fontWeight: 400, color: '#383838', fontSize: 16, mb: 1, fontFamily: 'Nunito, Arial, sans-serif' }}>Email</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography sx={{ fontWeight: 400, color: '#343748', fontSize: 16, fontFamily: 'Nunito, Arial, sans-serif' }}>{user?.email || ""}</Typography>
                        {user?.email && (
                          <Box sx={{ bgcolor: '#475567', color: '#fff', px: 1.5, py: 0.5, borderRadius: 2, fontSize: 13, fontWeight: 550, ml: 2 }}>Verified</Box>
                        )}
                      </Box>
                      {/* <Typography sx={{ fontWeight: 400, color: '#383838', fontSize: 16, mb: 1, fontFamily: 'Nunito, Arial, sans-serif' }}>Change Password</Typography>
                      <Typography sx={{ fontWeight: 400, color: '#343748', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 16, mb: 2 }}>Currently using login with google</Typography> */}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        {/* <Button variant="outlined" sx={{ 
                          textTransform: 'none',
                          borderRadius: 2,
                          fontSize: 13,
                          height: 34,
                          fontFamily: 'Nunito, Arial, sans-serif',
                          px: 2,
                          background: '#F7F6F4',
                          border: '1px solid #E0E0E0',
                          boxShadow: 'none',
                          color: '#212121',
                          minWidth: 0,
                          fontWeight: 400,
                          '&:hover': {
                            background: '#F0F0ED',
                            borderColor: '#B0B0B0',
                          }, }}>Edit Email</Button> */}
                        <Button variant="outlined" sx={{
                          textTransform: 'none',
                          borderRadius: 2,
                          fontSize: 13,
                          height: 34,
                          fontFamily: 'Nunito, Arial, sans-serif',
                          px: 2,
                          background: '#F7F6F4',
                          border: '1px solid #E0E0E0',
                          boxShadow: 'none',
                          color: '#212121',
                          minWidth: 0,
                          fontWeight: 400,
                          pointerEvents: 'none', // Prevent interaction
                          cursor: 'default', // Show default cursor
                          '&:hover': {
                            background: '#F7F6F4',
                            borderColor: '#E0E0E0',
                          }
                        }}>
                          <img src="/google.svg" alt="Google" style={{ width: 18, verticalAlign: 'middle', marginRight: 6 }} />
                          Google is connected
                          {/* <span style={{ display: 'flex', alignItems: 'center', marginLeft: 6 }}>
                            <svg width="7" height="7" viewBox="0 0 7 7" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M5.542 0.752441L0.75 5.54444" stroke="#343748" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M5.546 5.547L0.75 0.75" stroke="#343748" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span> */}
                        </Button>
                      </Box>
                      {/* <Button variant="outlined" sx={{ textTransform: 'none',
                        borderRadius: 2,
                        fontSize: 13,
                        height: 34,
                        fontFamily: 'Nunito, Arial, sans-serif',
                        px: 2,
                        background: '#F7F6F4',
                        border: '1px solid #E0E0E0',
                        boxShadow: 'none',
                        color: '#212121',
                        minWidth: 0,
                        fontWeight: 400,
                        '&:hover': {
                          background: '#F0F0ED',
                          borderColor: '#B0B0B0',} }}>Change Password
                      </Button> */}
                    </Box>
                  </Box>
                </Box>
                {/* Customer Support */}
                {/* <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0' }}>
                  <Typography sx={{ fontWeight: 550, mb: 2, color: '#212121', fontSize: 18 }}>Customer Support</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Typography sx={{ fontWeight: 400, color: '#212121', fontSize: 16 }}>Account access</Typography>
                    <Button variant="outlined" sx={{ ml: 2, borderRadius: 2, textTransform: 'none', fontWeight: 400, fontSize: 14, px: 2, py: 0.5, borderColor: '#B7CFC2', color: '#343748', background: '#fff', boxShadow: 'none' }}>Grant Access</Button>
                  </Box>
                  <Typography sx={{ color: '#212121', fontSize: 14, mb: 1 }}>To better help troubleshoot your issues, you may grant full account access to Monarch authorized support agents. Access will auto-disable after 14 days, or can be revoked by you at any time.</Typography>
                  <Typography sx={{ color: '#212121', fontSize: 14, mb: 1 }}>If you haven't already, you may also <a href="#" style={{ color: '#89AE99', textDecoration: 'none' }}>create a new support ticket</a>.</Typography>
                </Box> */}
                {/* Account Data */}
                <Box sx={{
                  bgcolor: '#fff',
                  borderRadius: 2,
                  p: 4,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  border: '1px solid #E0E0E0',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  mb: 2,
                }}>
                  <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 600, mb: 2, color: '#212121', fontSize: 18 }}>
                    Account Data
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Box>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 500, color: '#212121', fontSize: 17, mb: 1 }}>
                        Delete Account
                      </Typography>
                      <Typography sx={{ color: '#212121', fontSize: 15, fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', maxWidth: 540 }}>
                        Delete your account and all associated data. This action is permanent and cannot be undone. You must cancel your subscription or trial before you can delete your account.
                      </Typography>
                    </Box>
                    <Button variant="outlined" sx={{
                      textTransform: 'none',
                      borderRadius: 2,
                      fontSize: 15,
                      height: 38,
                      fontFamily: 'Nunito, Arial, sans-serif',
                      px: 3,
                      background: '#F7F6F4',
                      border: '1px solid #E0E0E0',
                      boxShadow: 'none',
                      color: '#212121',
                      minWidth: 0,
                      fontWeight: 500,
                      '&:hover': {
                        background: '#F0F0ED',
                        borderColor: '#B0B0B0',
                      },
                    }} onClick={() => setShowDeleteModal(true)}>
                      Delete Account
                    </Button>
                  </Box>
                  {/* Shared backdrop for delete modals */}
                  {(showDeleteModal || showDeleteConfirmModal) && (
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
                        setShowDeleteModal(false);
                        setShowDeleteConfirmModal(false);
                      }}
                    />
                  )}
                  {/* First Delete Modal (permanently remove) - replaced with Dialog */}
                  {showDeleteModal && (
                    <Dialog
                      open={showDeleteModal}
                      onClose={() => setShowDeleteModal(false)}
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
                        Delete Account
                      </DialogTitle>
                      <DialogContent sx={{ px: 3, pt: 0, pb: 3 }}>
                        <Box
                          sx={{
                            bgcolor: '#F9B55D',
                            color: '#343748',
                            borderRadius: '10px',
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
                          You are about to delete your account permanently. Are you sure you want to continue?
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                          <Button
                            onClick={() => { setShowDeleteModal(false); setShowDeleteConfirmModal(true); }}
                            sx={{
                              borderRadius: '8px',
                              minWidth: 120,
                              height: 44,
                              bgcolor: '#E57373',
                              color: 'rgba(255, 255, 255, 1)',
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
                            onClick={() => setShowDeleteModal(false)}
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
                  )}
                  {/* Second Confirm Modal (cannot be undone) */}
                  {showDeleteConfirmModal && (
                    <Dialog
                      open={showDeleteConfirmModal}
                      onClose={() => setShowDeleteConfirmModal(false)}
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
                        Delete Account
                      </DialogTitle>
                      <DialogContent sx={{ px: 3, pt: 0, pb: 3 }}>
                        <Box
                          sx={{
                            bgcolor: '#F9B55D',
                            color: '#343748',
                            borderRadius: '10px',
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
                          Are you sure you want to remove your account? This CANNOT be undone.
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                          <Button
                            onClick={() => setShowDeleteConfirmModal(false)}
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
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                          </Button>
                        </Box>
                      </DialogContent>
                    </Dialog>
                  )}
                </Box>
              </Box>
            )}
            {panelState === "Display" && (
              <Box
                sx={{
                  flex: 1,
                  bgcolor: '#fff',
                  borderRadius: 2,
                  p: 4,
                  boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                  border: '1px solid #E0E0E0',
                  minWidth: 480,
                  height: 'fit-content',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                }}
              >
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 5, color: '#212121', fontSize: 16 }}>Display</Typography>
                <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, mb: 1, color: '#212121', fontSize: 14 }}>Visual Appearance</Typography>
                <TextField
                  select
                  fullWidth
                  variant="outlined"
                  defaultValue="Light"
                  size="small"
                  sx={{ mb: 2, fontFamily: 'Nunito, Arial, sans-serif', background: '#fff', fontSize: 13, borderRadius: 2 }}
                  inputProps={{ style: { fontFamily: 'Nunito, Arial, sans-serif', fontSize: 13 } }}
                >
                  <MenuItem sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} value="Light">Light</MenuItem>
                  <MenuItem sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 14 }} disabled value="Dark">Dark (Coming Soon...)</MenuItem>
                </TextField>
              </Box>
            )}
            {panelState === "Notification" && (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Notification Header - Figma style */}
                <Box sx={{ bgcolor: '#fff',  borderRadius: 2, p: 3, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '5.5fr 4.5fr', alignItems: 'center', mb: 1 }}>
                    <Box>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 16, color: '#343748', ml: 1 }}>Notifications</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: '100%', alignItems: 'center', justifyItems: 'center' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 16, color: '#343748' }}>All Properly</Typography>
                        </Box>
                        <Typography
                          sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 14, color: '#89AE99', cursor: 'pointer', mt: 0.5, textAlign: 'center' }}
                          onClick={async () => {
                            const newVal = !allProperlyAllOn;
                            setAllProperlyAllOn(newVal);
                            const newManager = [newVal, managerAddedToggles[1], managerAddedToggles[2]];
                            const newOverdue = [newVal, tasksOverdueToggles[1], tasksOverdueToggles[2]];
                            const newAdded = [newVal, tasksAddedToggles[1], tasksAddedToggles[2]];
                            const newCompleted = [newVal, tasksCompletedToggles[1], tasksCompletedToggles[2]];
                            const newLease = [newVal, leaseEndReminderToggles[1], leaseEndReminderToggles[2]];
                            setManagerAddedToggles(newManager);
                            setTasksOverdueToggles(newOverdue);
                            setTasksAddedToggles(newAdded);
                            setTasksCompletedToggles(newCompleted);
                            setLeaseEndReminderToggles(newLease);
                            if (user?.uid) {
                              const { db } = await import("../services/firebase");
                              const { doc, updateDoc } = await import("firebase/firestore");
                              const userRef = doc(db, "users", user.uid);
                              await updateDoc(userRef, {
                                inside_managerAdded: newVal,
                                inside_overdue: newVal,
                                inside_taskAdded: newVal,
                                inside_taskCompleted: newVal,
                                insideLeaseEnd: newVal
                              });
                            }
                          }}
                        >
                          {allProperlyAllOn ? "Turn all off" : "Turn all on"}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 16, color: '#343748' }}>Email</Typography>
                      </Box>
                        <Typography
                          sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 14, color: '#89AE99', cursor: 'pointer', mt: 0.5, textAlign: 'center' }}
                          onClick={async () => {
                            const newVal = !emailAllOn;
                            setEmailAllOn(newVal);
                            const newManager = [managerAddedToggles[0], newVal, managerAddedToggles[2]];
                            const newOverdue = [tasksOverdueToggles[0], newVal, tasksOverdueToggles[2]];
                            const newAdded = [tasksAddedToggles[0], newVal, tasksAddedToggles[2]];
                            const newCompleted = [tasksCompletedToggles[0], newVal, tasksCompletedToggles[2]];
                            const newLease = [leaseEndReminderToggles[0], newVal, leaseEndReminderToggles[2]];
                            setManagerAddedToggles(newManager);
                            setTasksOverdueToggles(newOverdue);
                            setTasksAddedToggles(newAdded);
                            setTasksCompletedToggles(newCompleted);
                            setLeaseEndReminderToggles(newLease);
                            if (user?.uid) {
                              const { db } = await import("../services/firebase");
                              const { doc, updateDoc } = await import("firebase/firestore");
                              const userRef = doc(db, "users", user.uid);
                              await updateDoc(userRef, {
                                email_managerAdded: newVal,
                                email_overdue: newVal,
                                email_taskAdded: newVal,
                                email_taskCompleted: newVal,
                                emailLeaseEnd: newVal
                              });
                            }
                          }}
                        >
                          {emailAllOn ? "Turn all off" : "Turn all on"}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 16, color: '#343748' }}>Push</Typography>
                        </Box>
                        <Typography
                          sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 14, color: '#89AE99', cursor: 'pointer', mt: 0.5, textAlign: 'center' }}
                          onClick={async () => {
                            const newVal = false;
                            const newManager = [managerAddedToggles[0], managerAddedToggles[1], newVal];
                            const newOverdue = [tasksOverdueToggles[0], tasksOverdueToggles[1], newVal];
                            const newAdded = [tasksAddedToggles[0], tasksAddedToggles[1], newVal];
                            const newCompleted = [tasksCompletedToggles[0], tasksCompletedToggles[1], newVal];
                            const newLease = [leaseEndReminderToggles[0], leaseEndReminderToggles[1], newVal];
                            setManagerAddedToggles(newManager);
                            setTasksOverdueToggles(newOverdue);
                            setTasksAddedToggles(newAdded);
                            setTasksCompletedToggles(newCompleted);
                            setLeaseEndReminderToggles(newLease);
                            if (user?.uid) {
                              const { db } = await import("../services/firebase");
                              const { doc, updateDoc } = await import("firebase/firestore");
                              const userRef = doc(db, "users", user.uid);
                              await updateDoc(userRef, {
                                push_managerAdded: newVal,
                                push_overdue: newVal,
                                push_taskAdded: newVal,
                                push_taskCompleted: newVal,
                                pushLeaseEnd: newVal
                              });
                            }
                          }}
                        >
                          Turn all on
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
                {/* Shared Access Section Header - outside card */}
                <Box sx={{ fontWeight: 400, fontSize: 16, color: '#A6A6A6', ml: 4, mb: -2, mt: -2 }}>Shared Access</Box>
                <Box sx={{ bgcolor: '#fff',  borderRadius: 2, p: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '5.5fr 4.5fr', alignItems: 'center', mb: 1 }}>
                    <Box>
                      <Typography sx={{ mb: 2, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 16, color: '#212121' }}>Manager Added</Typography>
                      <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 14, color: '#212121' }}>Receive a notification if one of your properties has a manager added.</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: '100%', alignItems: 'center', justifyItems: 'center' }}>
                      {managerAddedToggles.map((_, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <Switch
                            checked={false}
                            color="success"
                            onChange={async () => {
                              const newToggles = [...managerAddedToggles];
                              newToggles[idx] = !newToggles[idx];
                              if(idx === 2) newToggles[idx] = false; // Push notifications for Task Added are not supported 
                              setManagerAddedToggles(newToggles);
                              if (user?.uid) {
                                const { db } = await import("../services/firebase");
                                const { doc, updateDoc } = await import("firebase/firestore");
                                const userRef = doc(db, "users", user.uid);
                                await updateDoc(userRef, {
                                  inside_managerAdded: newToggles[0],
                                  email_managerAdded: newToggles[1],
                                  push_managerAdded: newToggles[2]
                                });
                              }
                            }}
                            sx={{
                              width: 28,
                              height: 16,
                              p: 0,
                              display: 'flex',
                              alignItems: 'center',
                              margin: '0 auto',
                              '& .MuiSwitch-switchBase': {
                                top: '50%',
                                transform: 'translateY(-50%)',
                                '&.Mui-checked': {
                                  transform: 'translateX(10px) translateY(-50%)',
                                  color: '#fff',
                                  '& + .MuiSwitch-track': {
                                    backgroundColor: '#89AE99',
                                    opacity: 1,
                                  },
                                },
                              },
                              '& .MuiSwitch-thumb': {
                                width: 10,
                                height: 10,
                                boxShadow: 'none',
                                backgroundColor: '#fff',
                                transition: 'all 0.3s',
                                position: 'relative',
                                left: '-5px',
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
                      ))}
                    </Box>
                  </Box>
                </Box>
                {/* Tasks Section Header - outside card */}
                <Box sx={{ fontWeight: 400, fontSize: 16, color: '#A6A6A6', ml: 4, mb: -2, mt: -2 }}>Tasks</Box>
                <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '5.5fr 4.5fr', alignItems: 'center', width: '100%' }}>
                      <Box>
                        <Typography sx={{ mb: 2, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, color: '#212121', fontSize: 16 }}>Overdue Tasks</Typography>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#212121', fontSize: 14 }}>Receive a notification when a task is overdue.</Typography>
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: '100%', alignItems: 'center', justifyItems: 'center' }}>
                        {tasksOverdueToggles.map((checked, idx) => (
                          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <Switch
                              checked={checked}
                              color="success"
                              onChange={async () => {
                                const newToggles = [...tasksOverdueToggles];
                                newToggles[idx] = !newToggles[idx];
                                if(idx === 2) newToggles[idx] = false; // Push notifications for Task Added are not supported 
                                setTasksOverdueToggles(newToggles);
                                if (user?.uid) {
                                  const { db } = await import("../services/firebase");
                                  const { doc, updateDoc } = await import("firebase/firestore");
                                  const userRef = doc(db, "users", user.uid);
                                  await updateDoc(userRef, {
                                    inside_overdue: newToggles[0],
                                    email_overdue: newToggles[1],
                                    push_overdue: newToggles[2]
                                  });
                                }
                              }}
                              sx={{
                                width: 28,
                                height: 16,
                                p: 0,
                                display: 'flex',
                                alignItems: 'center',
                                margin: '0 auto',
                                '& .MuiSwitch-switchBase': {
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  '&.Mui-checked': {
                                    transform: 'translateX(10px) translateY(-50%)',
                                    color: '#fff',
                                    '& + .MuiSwitch-track': {
                                      backgroundColor: '#89AE99',
                                      opacity: 1,
                                    },
                                  },
                                },
                                '& .MuiSwitch-thumb': {
                                  width: 10,
                                  height: 10,
                                  boxShadow: 'none',
                                  backgroundColor: '#fff',
                                  transition: 'all 0.3s',
                                  position: 'relative',
                                  left: '-5px',
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
                        ))}
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '5.5fr 4.5fr', alignItems: 'center', width: '100%' }}>
                      <Box>
                        <Typography sx={{ mb: 2, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, color: '#212121', fontSize: 16 }}>Task Added</Typography>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#212121', fontSize: 14 }}>Receive a notification when a task has been created.</Typography>
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: '100%', alignItems: 'center', justifyItems: 'center' }}>
                        {tasksAddedToggles.map((checked, idx) => (
                          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <Switch
                              checked={checked}
                              color="success"
                              onChange={async () => {
                                const newToggles = [...tasksAddedToggles];
                                newToggles[idx] = !newToggles[idx];
                                if(idx === 2) newToggles[idx] = false; // Push notifications for Task Added are not supported 
                                setTasksAddedToggles(newToggles);
                                if (user?.uid) {
                                  const { db } = await import("../services/firebase");
                                  const { doc, updateDoc } = await import("firebase/firestore");
                                  const userRef = doc(db, "users", user.uid);
                                  await updateDoc(userRef, {
                                    inside_taskAdded: newToggles[0],
                                    email_taskAdded: newToggles[1],
                                    push_taskAdded: newToggles[2]
                                  });
                                }
                              }}
                              sx={{
                                width: 28,
                                height: 16,
                                p: 0,
                                display: 'flex',
                                alignItems: 'center',
                                margin: '0 auto',
                                '& .MuiSwitch-switchBase': {
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  '&.Mui-checked': {
                                    transform: 'translateX(10px) translateY(-50%)',
                                    color: '#fff',
                                    '& + .MuiSwitch-track': {
                                      backgroundColor: '#89AE99',
                                      opacity: 1,
                                    },
                                  },
                                },
                                '& .MuiSwitch-thumb': {
                                  width: 10,
                                  height: 10,
                                  boxShadow: 'none',
                                  backgroundColor: '#fff',
                                  transition: 'all 0.3s',
                                  position: 'relative',
                                  left: '-5px',
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
                        ))}
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '5.5fr 4.5fr', alignItems: 'center', width: '100%' }}>
                      <Box>
                        <Typography sx={{ mb: 2, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, color: '#212121', fontSize: 16 }}>Task Has Been Completed</Typography>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#212121', fontSize: 14 }}>Receive a notification if you have tasks that have been completed.</Typography>
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', minHeight: 48, alignItems: 'center', justifyItems: 'center' }}>
                        {tasksCompletedToggles.map((checked, idx) => (
                          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48 }}>
                            <Switch
                              checked={checked}
                              color="success"
                              onChange={async () => {
                                const newToggles = [...tasksCompletedToggles];
                                newToggles[idx] = !newToggles[idx];
                                if(idx === 2) newToggles[idx] = false; // Push notifications for Task Added are not supported 
                                setTasksCompletedToggles(newToggles);
                                if (user?.uid) {
                                  const { db } = await import("../services/firebase");
                                  const { doc, updateDoc } = await import("firebase/firestore");
                                  const userRef = doc(db, "users", user.uid);
                                  await updateDoc(userRef, {
                                    inside_taskCompleted: newToggles[0],
                                    email_taskCompleted: newToggles[1],
                                    push_taskCompleted: newToggles[2]
                                  });
                                }
                              }}
                              sx={{
                                width: 28,
                                height: 16,
                                p: 0,
                                display: 'flex',
                                alignItems: 'center',
                                margin: '0 auto',
                                '& .MuiSwitch-switchBase': {
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  '&.Mui-checked': {
                                    transform: 'translateX(10px) translateY(-50%)',
                                    color: '#fff',
                                    '& + .MuiSwitch-track': {
                                      backgroundColor: '#89AE99',
                                      opacity: 1,
                                    },
                                  },
                                },
                                '& .MuiSwitch-thumb': {
                                  width: 10,
                                  height: 10,
                                  boxShadow: 'none',
                                  backgroundColor: '#fff',
                                  transition: 'all 0.3s',
                                  position: 'relative',
                                  left: '-5px',
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
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Box>
                {/* Renewal Reminder Section Header - outside card */}
                <Box sx={{ fontWeight: 400, fontSize: 16, color: '#A6A6A6', ml: 4, mt: -2, mb: -2 }}>Renewal Reminder</Box>
                <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E0E0E0', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '5.5fr 4.5fr', alignItems: 'center', width: '100%' }}>
                      <Box>
                        <Typography sx={{ mb: 2, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, color: '#212121', fontSize: 16 }}>Lease End Reminder</Typography>
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#212121', fontSize: 14 }}>30/60/90 days before lease ends</Typography>
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', minHeight: 48, alignItems: 'center', justifyItems: 'center' }}>
                        {leaseEndReminderToggles.map((_, idx) => (
                          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48 }}>
                            <Switch
                              checked={false}
                              color="success"
                              onChange={async () => {
                                const newToggles = [...leaseEndReminderToggles];
                                newToggles[idx] = !newToggles[idx];
                                if(idx === 2) newToggles[idx] = false; // Push notifications for Task Added are not supported 
                                setLeaseEndReminderToggles(newToggles);
                                if (user?.uid) {
                                  const { db } = await import("../services/firebase");
                                  const { doc, updateDoc } = await import("firebase/firestore");
                                  const userRef = doc(db, "users", user.uid);
                                  await updateDoc(userRef, {
                                    insideLeaseEnd: newToggles[0],
                                    emailLeaseEnd: newToggles[1],
                                    pushLeaseEnd: newToggles[2]
                                  });
                                }
                              }}
                              sx={{
                                width: 28,
                                height: 16,
                                p: 0,
                                display: 'flex',
                                alignItems: 'center',
                                margin: '0 auto',
                                '& .MuiSwitch-switchBase': {
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  '&.Mui-checked': {
                                    transform: 'translateX(10px) translateY(-50%)',
                                    color: '#fff',
                                    '& + .MuiSwitch-track': {
                                      backgroundColor: '#89AE99',
                                      opacity: 1,
                                    },
                                  },
                                },
                                '& .MuiSwitch-thumb': {
                                  width: 10,
                                  height: 10,
                                  boxShadow: 'none',
                                  backgroundColor: '#fff',
                                  transition: 'all 0.3s',
                                  position: 'relative',
                                  left: '-5px',
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
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
