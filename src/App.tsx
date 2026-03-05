import { useEffect, useState } from "react";
import { Box } from "@mui/material";
// ...existing code...
import { auth } from "./services/firebase";
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence
} from "firebase/auth";
import type { User } from "firebase/auth";
import { Snackbar, Alert } from "@mui/material";
import AcceptSharedPropertiesModal from "./components/AcceptSharedPropertiesModal";
import Login from "./components/Login";
import OnboardingFlow from "./components/onboarding/OnboardingFlow";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";
import { getDoc, doc } from "firebase/firestore";
import { db }  from "./services/firebase";

function App() {
  // Domain detection
  const hostname = window.location.hostname;

  console.log(hostname, "=======hostname is here");
  const isLandingDomain = hostname === "allproperly.com" || hostname === "www.allproperly.com";
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [showPropertyDashboard, setShowPropertyDashboard] = useState(false);
  // Persisted page state
  const [persistedPage, setPersistedPage] = useState<{ page: string, propertyId?: string } | null>(null);
  const [planState, setPlanState] = useState<string>("free");

  // On mount, restore last page from session storage or URL path
  useEffect(() => {
    // Check URL path first (for direct links like /tasks, /calendar, etc.)
    const pathname = window.location.pathname;
    console.log(pathname);
    const pathPageMap: Record<string, string> = {
      '/tasks': 'task',
      '/calendar': 'calendar',
      '/reports': 'reports',
      '/settings': 'setting',
      '/property': 'property',
      '/upgrade': 'upgrade',
      '/shared': 'sharedaccess',
    };
    
    if (pathname && pathPageMap[pathname]) {
      const targetPage = pathPageMap[pathname];
      setPersistedPage({ page: targetPage });
      // Store in sessionStorage so it persists through auth state changes
      sessionStorage.setItem('lastPage', JSON.stringify({ page: targetPage }));
      // Clean up URL to avoid issues on refresh
      window.history.replaceState({}, document.title, '/');
      return;
    }
    
    const lastPage = sessionStorage.getItem('lastPage');
    if (lastPage) {
      try {
        setPersistedPage(JSON.parse(lastPage));
      } catch {}
    }
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showError, setShowError] = useState(false);

    // Invite modal state
  // const [inviteModalOpen, setInviteModalOpen] = useState(false);
  // const [invitePropertyName, setInvitePropertyName] = useState("");
  // const [inviteInviter, setInviteInviter] = useState("");
  // Shared property modal state
  const [acceptSharedModalOpen, setAcceptSharedModalOpen] = useState(false);
  const [sharedProperties, setSharedProperties] = useState<any[]>([]);
  const [inviteId, setInviteId] = useState<string | null>(null);

  useEffect(() => {
    // Show invite modal after login or on mount
    const params = new URLSearchParams(window.location.search);
    const _inviteId = params.get("inviteId");
    const checkoutResult = params.get("checkout");
    if (checkoutResult && user) {
      if (checkoutResult !== "cancel") {
        // Process pendingSharedProperties for current user
        const pendingRaw = sessionStorage.getItem("pendingSharedProperties");
        if (pendingRaw) {
          try {
            const pending = JSON.parse(pendingRaw);
            if (pending.flag && Array.isArray(pending.properties)) {
              // Import helper dynamically
              (async () => {
                const { getSharedPropertyCountForUser, addUserToPropertySharedWith } = await import("./services/PropertyService");
                const { getUserProfile } = await import("./services/UserService");
                const profile = await getUserProfile(user.uid);
                let planLimit = 1;
                if (profile?.planState === "basic" || profile?.planState === "basic_annual") planLimit = 5;
                if (profile?.planState === "plus" || profile?.planState === "plus_annual") planLimit = 10;
                const currentCount = await getSharedPropertyCountForUser(user.uid);
                const pendinginfo = doc(db, "invites", pending.inviteId);
                const pendingdoc = await getDoc(pendinginfo);

                let displayRole = pendingdoc.data()?.role || "Friend";
                let expired = pendingdoc.data()?.expired || null;
                if (displayRole === 'Co-owner') displayRole = 'Family Member', expired = 0;
                else if (displayRole === 'Family Manager') displayRole = 'Family Manager', expired = 0;
                else if (displayRole === 'Friend') displayRole = 'Friend', expired = 90;
                else if (displayRole === 'PM') displayRole = 'Property Manager', expired = 0;
                
                // Special users bypass plan limit check
                const specialUsers = ['andrii@allproperly.com', 'river@fishdawgproductions.com'];
                const currentUserEmail = user.email || '';
                const isSpecialUser = specialUsers.includes(currentUserEmail);
                
                if (isSpecialUser || currentCount + pending.properties.length <= planLimit) {
                  for (const prop of pending.properties) {
                    await addUserToPropertySharedWith(
                      prop.id,
                      user.uid,
                      {
                        expired: expired,
                        role: displayRole,
                        alias: prop.alias ?? prop.label ?? "Shared Property"
                      }
                    );
                  }
                }
              })();
            }
          } catch (e) {
            // Ignore parse errors
          }
          // Always clear sessionStorage after processing
          sessionStorage.removeItem("pendingSharedProperties");
          setPersistedPage({ page: "dashboard" });
        }
        else setPersistedPage({ page: "upgrade" });
      }
      // Optionally, remove checkout param from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (_inviteId && user) {
      setInviteId(_inviteId);
      (async () => {
        const inviteRef = doc(db, "invites", _inviteId);
        const inviteDoc = await getDoc(inviteRef);
        if (inviteDoc.exists()) {
          const data = inviteDoc.data();
          if (data.used) {
            setAcceptSharedModalOpen(false);
            alert("This invite link has been used.");
            window.location.href = "https://app.allproperly.com";
            return;
          }
          let props: any[] = [];
          let ownerDisplayName = "";
          if (Array.isArray(data.propertyIds)) {
            for (let i = 0; i < data.propertyIds.length; i++) {
              const propId = data.propertyIds[i];
              const propRef = doc(db, "properties", propId);
              const propDoc = await getDoc(propRef);
              if (propDoc.exists()) {
                const propData = propDoc.data();
                if (i === 0 && propData.ownerId) {
                  const ownerRef = doc(db, "users", propData.ownerId);
                  const ownerDoc = await getDoc(ownerRef);
                  if (ownerDoc.exists()) {
                    ownerDisplayName = ownerDoc.data().displayName || "";
                  }
                }
                props.push({
                  id: propId,
                  name: propData.type ||  "Property",
                  inviter: ownerDisplayName,
                  photoUrl: propData.photoUrl || "/empty-property.png",
                  address1: propData.address1 || "",
                  city: propData.city || "",
                  state: propData.state || "",
                  zip: propData.zip || ""
                });
              }
            }
          }
          setSharedProperties(props);
          setAcceptSharedModalOpen(true);
        }
      })();
    }
    // Fetch and set planState as soon as user is authenticated
    if (user) {
      (async () => {
        const { getDoc, doc } = await import("firebase/firestore");
        const { db } = await import("./services/firebase");
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const plan = userDoc.exists() ? (userDoc.data().planState || "free") : "free";
        setPlanState(plan);
      })();
    }
  }, [user]);

  const handleAcceptSharedSave = async (selected: Array<{ id: string; label: string }>) => {
    setAcceptSharedModalOpen(false);
    if (!user || !inviteId) return;
    const { doc, getDoc, updateDoc } = await import("firebase/firestore");
    const { db } = await import("./services/firebase");
    // Fetch invite document to get role information (use invite.role if present)
    let inviteRole = "Friend";
    let inviteExpired = null;
    try {
      const inviteRef = doc(db, "invites", inviteId);
      const inviteDoc = await getDoc(inviteRef);
      if (inviteDoc.exists()) {
        const invData = inviteDoc.data();
        if (invData?.role) inviteRole = invData.role;
        if (invData?.expired) inviteExpired = invData.expired;
      }
    } catch (err) {
      console.error("Failed to fetch invite data for role, defaulting to Manager", err);
    }

    // Role priority: higher number = higher priority
    const rolePriority: { [key: string]: number } = {
      'Friend': 1,
      'PM': 2,
      'Property Manager': 2,
      'Family Manager': 3,
      'Co-owner': 4
    };

    for (const prop of selected) {
      const propRef = doc(db, "properties", prop.id);
      const propDoc = await getDoc(propRef);
      if (propDoc.exists()) {
        const propData = propDoc.data();
        const currentSharedWith = Array.isArray(propData.sharedWith) ? propData.sharedWith : [];
        
        // Check if user already exists in sharedWith
        const existingEntryIndex = currentSharedWith.findIndex((sw: any) => sw.userId === user.uid);
        
        if (existingEntryIndex >= 0) {
          // User already exists - only update if new role has higher priority
          const existingEntry = currentSharedWith[existingEntryIndex];
          const existingPriority = rolePriority[existingEntry.role] || 0;
          const newPriority = rolePriority[inviteRole] || 0;
          
          if (newPriority > existingPriority) {
            // Update to higher priority role
            const updatedSharedWith = [...currentSharedWith];
            updatedSharedWith[existingEntryIndex] = {
              ...existingEntry,
              role: inviteRole,
              expired: inviteExpired || existingEntry.expired,
              // Keep existing alias if set, otherwise use new label
              alias: existingEntry.alias || prop.label || propData.type || propData.name || "Property"
            };
            await updateDoc(propRef, { sharedWith: updatedSharedWith });
          }
          // If existing role is same or higher priority, do nothing
        } else {
          // User doesn't exist - add new entry
          const sharedEntry = {
            userId: user.uid,
            role: inviteRole || "Friend",
            expired: inviteExpired || null,
            alias: prop.label || propData.type || propData.name || "Property"
          };
          await updateDoc(propRef, {
            sharedWith: [...currentSharedWith, sharedEntry]
          });
        }
      }
    }
    // Mark invite as used (do not delete, keep history)
    const inviteRef = doc(db, "invites", inviteId);
    await updateDoc(inviteRef, { used: true, usedAt: new Date() });
    // Set onboarding complete only after invite flow
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { hasCompletedOnboarding: true });
    setHasCompletedOnboarding(true);
    // Redirect after confirmation
    window.location.replace("https://app.allproperly.com");
  };

  // Auth State Management - Listen for authentication state changes
  useEffect(() => {
    console.log("🔧 Setting up authentication state listener...");
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("[DEBUG] onAuthStateChanged triggered", currentUser);
      // Only set default dashboard if no page was set by URL path
      const existingPage = sessionStorage.getItem('lastPage');
      if (!existingPage) {
        sessionStorage.setItem('lastPage', JSON.stringify({ page: "dashboard" }));
      }
      setIsLoading(true);
      if (currentUser) {
        setUser(currentUser);
        try {
          const { getDoc, setDoc, doc, Timestamp, getDocs, collection, updateDoc, where, query } = await import("firebase/firestore");
          const { db } = await import("./services/firebase");
          const userRef = doc(db, "users", currentUser.uid);
          let userDoc = await getDoc(userRef);
          const now = Timestamp.now();
          const timezone = (currentUser as any)?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
         // If user doc does not exist, create it
          console.log(userDoc, "|-------", currentUser);
          if (!userDoc.exists()) {
            const newUserData = {
              uid: currentUser.uid,
              email: currentUser.email || "",
              displayName: currentUser.displayName || "",
              photoURL: currentUser.photoURL || "",
              lastLoginedAt: now,
              hasCompletedOnboarding: false,
              role: "owner",
              createdAt: now,
              timezone
            };
            console.log(newUserData, "newwwwwwwwwwwwwwwwwwwwwwwwwwww");
            await setDoc(userRef, newUserData);
            userDoc = await getDoc(userRef);
            
            // Send welcome email
            try {
              console.log("==============");
              const { addDoc, collection } = await import("firebase/firestore");
              const { db } = await import("./services/firebase");
              // await addDoc(collection(db, 'mail'), {
              //         invite_id: inviteRef.id,
              //         to: inviteEmail,
              //         subject: `You're invited to join AllProperly!`,
              //         text: textMsg,
              //         html: htmlMsg,
              //         from: 'notify@allproperly.com',
              //         headers: { 'X-PM-Message-Stream': 'outbound' }
              //       });
              // Get first name from displayName or email
              const displayName = currentUser.displayName || "";
              let firstName = displayName.split(" ")[0];
              if (!firstName) {
                // fallback to email prefix
                firstName = (currentUser.email || "").split("@")[0];
              }
              await addDoc(collection(db, "mail"), {
                to: currentUser.email,
                subject: "Welcome to AllProperly!",
                text: `Welcome to AllProperly!\n\nWe're excited to have you on board. Start organizing and managing your properties today.\n\nIf you have any questions, reply to this email or visit our help center.\n\nBest,\nThe AllProperly Team`,
                html: `<!DOCTYPE html>
                  <html lang="en">
                  <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>AllProperly Welcome Email</title>
                    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" type="text/css">
                    <style>
                      @media only screen and (max-width:600px) {
                        .container { width: 100% !important; }
                        .stack-column,
                        .stack-column td { display:block !important; width:100% !important; text-align:center !important; }
                        img { max-width:100% !important; height:auto !important; }
                      }
                    </style>
                  </head>
                  <body style="background:#475567; margin:0; padding:20px; font-family:Nunito,Arial, sans-serif;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="650" class="container" style="max-width:650px; background:#ffffff; border:1px solid #e4e9f0; border-radius:10px; padding:20px;">
                            <tr>
                              <td align="center" style="padding:20px;">
                                <a href="https://app.allproperly.com/" target="_blank">
                                  <img src="https://app.allproperly.com/welcome/logo.png" alt="AllProperly Logo" width="200" style="display:block; border:0; outline:none; text-decoration:none;">
                                </a>
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="padding:10px 20px;">
                                <img src="https://app.allproperly.com/welcome/home.png" alt="Real Estate Welcome" width="550" style="max-width:100%; display:block; border:0; outline:none; text-decoration:none;">
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="color:#475567; font-size:22px; font-weight:bold; padding:30px 20px 10px;">
                                ${firstName}, Welcome to AllProperly.com!
                              </td>
                            </tr>
                            <tr> 
                              <td align="center" style="color:#475567; font-size:16px; line-height:24px; padding:0 20px 20px;">
                                We’re thrilled to have you here! AllProperly.com helps you organize, track, and simplify home management — all in one friendly dashboard.
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="padding:10px 20px 30px;">
                                <a href="https://app.allproperly.com" target="_blank"
                                  style="background:#89AE99; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600; padding:12px 28px; border-radius:8px; display:inline-block;">
                                  Get Started
                                </a>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#f5f8f6; border:1px solid #e4e9f0; border-radius:10px; padding:20px;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                  <tr>
                                    <td colspan="3" align="center" style="color:#475567; font-size:18px; font-weight:bold; padding:10px 0 20px;">
                                      Here’s what you can do right away
                                    </td>
                                  </tr>
                                  <tr class="stack-column">
                                    <td align="center" width="33.33%" style="padding:10px 0px;">
                                      <img src="https://app.allproperly.com/welcome/add.png" alt="Add Properties" width="60" style="display:block; margin:0 auto 10px;">
                                      <div style="font-size:14px; font-weight:bold; color:#475567;">Add Properties</div>
                                      <div style="font-size:14px; color:#475567; line-height:18px; padding-top: 5px;">Keep all your homes in one place</div>
                                    </td>
                                    <td align="center" width="33.33%" style="padding:10px 0px;">
                                      <img src="https://app.allproperly.com/welcome/checklist.png" alt="Track Tasks" width="60" style="display:block; margin:0 auto 10px;">
                                      <div style="font-size:14px; font-weight:bold; color:#475567;">Track Tasks</div>
                                      <div style="font-size:14px; color:#475567; line-height:18px; padding-top: 5px;">Never miss important reminders</div>
                                    </td>
                                    <td align="center" width="33.33%" style="padding:10px 0px;">
                                      <img src="https://app.allproperly.com/welcome/shared.png" alt="Share Access" width="60" style="display:block; margin:0 auto 10px;">
                                      <div style="font-size:14px; font-weight:bold; color:#475567;">Share Access</div>
                                      <div style="font-size:14px; color:#475567; line-height:18px; padding-top: 5px;">Invite family & managers easily</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="color:#475567; font-size:14px; line-height:22px; padding:20px;">
                                You’re receiving this email because you signed up for AllProperly.com
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="color:#475567; font-size:14px; line-height:22px; padding:0 20px 20px;">
                                © 2025 All Properly LLC. |
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </body>
                  </html>`,
                from: 'notify@allproperly.com',
                headers: { 'X-PM-Message-Stream': 'outbound' }
              });
              console.log(currentUser.email, "email sent===================");
            } catch (err) {
              console.error("Failed to send welcome email:", err);
            }
          }
          const userDataRaw = userDoc.data() || {};
          let hasCompletedOnboarding = userDataRaw.hasCompletedOnboarding ?? false;
          console.log('userDataRaw.hasCompletedOnboarding:', userDataRaw.hasCompletedOnboarding);
          console.log('Initial hasCompletedOnboarding:', hasCompletedOnboarding);
          // 1. Query owned properties
          const propertiesQuery = query(collection(db, "properties"), where("ownerId", "==", currentUser.uid));
          const propertiesSnap = await getDocs(propertiesQuery);
          const ownedCount = propertiesSnap.docs.length;
          console.log('Owned properties count:', ownedCount);

          // 2. Query shared properties (scalable for moderate size, but not huge DBs)
          // For large DBs, consider indexing or storing shared property IDs in user doc
          const allPropsSnap = await getDocs(collection(db, "properties"));
          const sharedCount = allPropsSnap.docs.filter(doc => {
            const sharedWith = doc.data().sharedWith || [];
            // 6. Ensure UID is used, not email
            return sharedWith.some((sw: { userId: string }) => sw.userId === currentUser.uid);
          }).length;
          console.log('Shared properties count:', sharedCount);

          // 5. Multiple roles/accounts: Only set onboarding false if user has zero properties
          const hasAnyProperty = (ownedCount + sharedCount) > 0;
          console.log('Has any property:', hasAnyProperty);

          // 2. Race condition: After invite accept, re-check property access before updating onboarding
          // 3. Atomicity: Not possible across collections, but do property update before onboarding update
          // 4. Always use { merge: true } for setDoc

          // 7. Error handling: Wrap all Firestore ops in try/catch
          let onboardingShouldBeFalse = false;
          try {
            const params = new URLSearchParams(window.location.search);
            const inviteIdParam = params.get("inviteId");
            if (inviteIdParam && !hasAnyProperty) {
              console.log('InviteId present and no property, force onboarding');
              onboardingShouldBeFalse = true;
            }
          } catch (err) {
            console.error('Error checking inviteId for onboarding:', err);
          }

          // 1/5. Set onboarding status
          hasCompletedOnboarding = onboardingShouldBeFalse ? false : hasAnyProperty;
          // Check invites collection for user's email
          if (currentUser.email) {
            console.log('Current user email:', currentUser.email);
            // 6. Update sharedWith.userId from email to UID in properties
            try {
              const allPropertiesQuery = query(collection(db, "properties"));
              const allPropertiesSnap = await getDocs(allPropertiesQuery);
              for (const docSnap of allPropertiesSnap.docs) {
                const prop = docSnap.data();
                if (Array.isArray(prop.sharedWith)) {
                  let updated = false;
                  const newSharedWith = prop.sharedWith.map((entry: any) => {
                    if (entry.userId === currentUser.email) {
                      updated = true;
                      return { ...entry, userId: currentUser.uid };
                    }
                    return entry;
                  });
                  if (updated) {
                    await updateDoc(doc(db, "properties", docSnap.id), { sharedWith: newSharedWith });
                  }
                }
              }
            } catch (err) {
              console.error('Error updating sharedWith userId:', err);
            }
          const userData = {
            uid: currentUser.uid,
            email: currentUser.email || "",
            displayName: currentUser.displayName || "",
            photoURL: currentUser.photoURL || "",
            lastLoginedAt: now,
            hasCompletedOnboarding,
            role: userDataRaw.role ?? "owner",
            createdAt: userDataRaw.createdAt ?? now,
            timezone
          };
          // 4. Always use { merge: true } for setDoc
          try {
            await setDoc(userRef, userData, { merge: true });
            setHasCompletedOnboarding(userData.hasCompletedOnboarding);
          } catch (err) {
            console.error('Error updating user doc:', err);
            setHasCompletedOnboarding(false);
          }
          }
        } catch (err) {
          setHasCompletedOnboarding(false);
        }
      } else {
        setUser(null);
        setHasCompletedOnboarding(null);
      }
      setIsLoading(false);
    });

    return () => {
      console.log("🔧 Cleaning up authentication listener");
      unsubscribe();
    };
    }, []);


  // Email/Password Sign-In Handler
  const handleEmailSignIn = async (email: string, password: string, staySignedIn?: boolean) => {
    setError("");
    
    try {
      console.log(`🚀 Starting email sign-in for: ${email}`);
      console.log(`🔒 Stay signed in: ${staySignedIn ? 'YES' : 'NO'}`);
      
      // Configure persistence based on "stay signed in" preference
      const persistence = staySignedIn ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      console.log(`💾 Persistence set to: ${staySignedIn ? 'LOCAL (persistent)' : 'SESSION (temporary)'}`);
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log(`✅ Email sign-in successful for: ${result.user.email}`);
      // Clear lastPage so user lands on dashboard after login
      sessionStorage.setItem('lastPage', JSON.stringify({ page: "dashboard" }));
      // onAuthStateChanged will handle navigation and user state
      
    } catch (error: any) {
      console.error("❌ Email sign-in error:", error);
      let errorMessage = "Failed to sign in. Please check your credentials.";
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = "No account found with this email. Please sign up first.";
          break;
        case 'auth/wrong-password':
          errorMessage = "Incorrect password. Please try again.";
          break;
        case 'auth/invalid-email':
          errorMessage = "Invalid email address.";
          break;
        case 'auth/too-many-requests':
          errorMessage = "Too many failed attempts. Please try again later.";
          break;
      }
      
      setError(errorMessage);
      setShowError(true);
    } finally {
      // ...existing code...
    }
  };

  // Email/Password Sign-Up Handler
  const handleEmailSignUp = async (email: string, password: string, staySignedIn?: boolean) => {
    setError("");
    try {
      console.log(`🚀 Starting email sign-up for: ${email}`);
      console.log(`🔒 Stay signed in: ${staySignedIn ? 'YES' : 'NO'}`);
      // Configure persistence based on "stay signed in" preference
      const persistence = staySignedIn ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      console.log(`💾 Persistence set to: ${staySignedIn ? 'LOCAL (persistent)' : 'SESSION (temporary)'}`);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      console.log(`✅ Email sign-up successful for: ${result.user.email}`);
      // onAuthStateChanged will handle profile creation, navigation and user state
    } catch (error: any) {
      console.error("❌ Email sign-up error:", error);
      let errorMessage = "Failed to create account. Please try again.";
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = "An account with this email already exists. Please sign in instead.";
          break;
        case 'auth/invalid-email':
          errorMessage = "Invalid email address.";
          break;
        case 'auth/weak-password':
          errorMessage = "Password is too weak. Please use at least 6 characters.";
          break;
      }
      
      setError(errorMessage);
      setShowError(true);
    } finally {
      // ...existing code...
    }
  };

  // Handle error close
  const handleCloseError = () => {
    setShowError(false);
    setError("");
  };

  // Show landing page if on allproperly.com
  if (isLandingDomain) {
    return <LandingPage />;
  }

  // Show loading screen while checking auth state
  if (isLoading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#F9F9F9',
        fontFamily: 'Nunito, Arial, sans-serif',
        zIndex: 9999
      }}>
        <div style={{ position: 'relative', width: 180, height: 180, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <svg width="180" height="180" viewBox="0 0 180 180" style={{ position: 'absolute', top: 0, left: 0, animation: 'spinRotate 3s linear infinite' }}>
            <circle
              cx="90"
              cy="90"
              r="80"
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
              style={{
                transformOrigin: 'center',
                animation: 'spinDash 2.5s ease-in-out infinite, spinColor 5s ease-in-out infinite'
              }}
            />
            <style>{`
              @keyframes spinRotate {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes spinDash {
                0% {
                  stroke-dasharray: 1, 502;
                  stroke-dashoffset: 0;
                }
                50% {
                  stroke-dasharray: 400, 502;
                  stroke-dashoffset: -100;
                }
                100% {
                  stroke-dasharray: 1, 502;
                  stroke-dashoffset: -502;
                }
              }
              @keyframes spinColor {
                0%, 49% {
                  stroke: #89AE99;
                }
                50%, 99% {
                  stroke: #6A7F91;
                }
                100% {
                  stroke: #89AE99;
                }
              }
            `}</style>
          </svg>
          <span style={{ color: '#333', fontWeight: 550, fontSize: 22, zIndex: 1 }}>Loading...</span>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return (
      <>
        <Login
          onEmailSignIn={handleEmailSignIn}
          onEmailSignUp={handleEmailSignUp}
        />
        {/* Error Message */}
        <Snackbar
          open={showError}
          autoHideDuration={6000}
          onClose={handleCloseError}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert 
            onClose={handleCloseError} 
            severity="error" 
            sx={{ width: '100%' }}
          >
            {error}
          </Alert>
        </Snackbar>
      </>
    );
  }

  // Show main app content if authenticated
  if (user && hasCompletedOnboarding === false) {
    return (
      <>
        <OnboardingFlow onFinish={() => {
          setHasCompletedOnboarding(true);
          setShowPropertyDashboard(true);
        }} />
        {/* Invite Modal removed: now only AcceptSharedPropertiesModal is shown for invite accept */}
        {/* Accept Shared Properties Modal */}
        {acceptSharedModalOpen && (
          <Box>
            <AcceptSharedPropertiesModal
              open={acceptSharedModalOpen}
              properties={sharedProperties}
              onSave={handleAcceptSharedSave}
              onClose={() => setAcceptSharedModalOpen(false)}
              planState={planState}
              onShowUpgrade={() => setPersistedPage({ page: "upgrade" })}
            />
          </Box>
        )}
      </>
    );
  }
  if (user && (hasCompletedOnboarding === true || showPropertyDashboard)) {
    // Pass persistedPage info to Dashboard
    return (
      <Box sx={{ bgcolor: '#F9F9F9', minHeight: '100vh' }}>
        <Box sx={{ margin: '0 auto', minHeight: '100vh', overflowX: 'hidden' }}>
          <Dashboard defaultPage={persistedPage?.page || (showPropertyDashboard ? "property" : "dashboard")} />
        </Box>
        {/* Invite Modal removed: now only AcceptSharedPropertiesModal is shown for invite accept */}
        {/* Accept Shared Properties Modal */}
        {acceptSharedModalOpen && (
          <Box>
            <AcceptSharedPropertiesModal
              open={acceptSharedModalOpen}
              properties={sharedProperties}
              onSave={handleAcceptSharedSave}
              onClose={() => setAcceptSharedModalOpen(false)}
              planState={planState}
              onShowUpgrade={() => setPersistedPage({ page: "upgrade" })}
            />
          </Box>
        )}
      </Box>
    );
  }
}

export default App;
