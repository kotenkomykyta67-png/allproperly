import { collection, getDocs, deleteDoc } from "firebase/firestore";
/**
 * Clean up invites when a property is deleted
 * Removes the propertyId from all invites and deletes invite docs if empty
 */
export async function cleanupInvitesForDeletedProperty(propertyId: string): Promise<void> {
  try {
    const invitesRef = collection(db, "invites");
    const invitesSnap = await getDocs(invitesRef);
    for (const inviteDoc of invitesSnap.docs) {
      const inviteData = inviteDoc.data();
      const propertyIds: string[] = inviteData.propertyIds || [];
      if (propertyIds.includes(propertyId)) {
        const updatedPropertyIds = propertyIds.filter(id => id !== propertyId);
        if (updatedPropertyIds.length === 0) {
          // Delete invite doc if no propertyIds remain
          await deleteDoc(inviteDoc.ref);
        } else {
          // Update invite doc with remaining propertyIds
          await updateDoc(inviteDoc.ref, { propertyIds: updatedPropertyIds });
        }
      }
    }
    console.log(`✅ Invites cleaned up for deleted property: ${propertyId}`);
  } catch (error) {
    console.error(`❌ Error cleaning up invites for property ${propertyId}:`, error);
  }
}
import { db } from "./firebase";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";

/**
 * Test Firestore connection
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    console.log("🔥 Testing Firestore connection...");
    const testRef = doc(db, "test", "connection");
    await setDoc(testRef, { test: true, timestamp: serverTimestamp() });
    console.log("✅ Firestore connection successful");
    return true;
  } catch (error) {
    console.error("❌ Firestore connection failed:", error);
    return false;
  }
}

export interface UserProfile {
  uid: string;
  email: string;
  display: boolean;
  householdName: string;
  country: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  inside_managerAdded: boolean;
  inside_overdue: boolean;
  inside_taskAdded: boolean;
  inside_taskCompleted: boolean;
  insideLeaseEnd: boolean;
  email_managerAdded: boolean;
  email_overdue: boolean;
  email_taskAdded: boolean;
  email_taskCompleted: boolean;
  emailLeaseEnd: boolean;
  push_managerAdded: boolean;
  push_overdue: boolean;
  push_taskAdded: boolean;
  push_taskCompleted: boolean;
  pushLeaseEnd: boolean;
  timezone: string;
  displayName?: string;
  photoURL?: string;
  role: 'owner' | 'co-owner' | 'manager' | 'pm'; // Default role
  planState?: 'free' | 'basic' | 'plus' | "basic_annual" | "plus_annual"; // Subscription plan
  provider: string; // 'google', 'email', 'apple'
  createdAt?: any;
  lastLoginAt?: any; // Renamed from lastLogin for consistency
  isActive: boolean;
  hasCompletedOnboarding?: boolean;
}

export interface UserProfileResult {
  profile: UserProfile;
  isNewUser: boolean;
}

export interface UserInput {
  email: string;
  displayName?: string;
  photoURL?: string;
  provider: string;
}

/**
 * Handle user sign-in - ONLY for existing users
 * Will throw error if user doesn't exist in database
 */
export async function handleUserSignIn(user: User, provider: string): Promise<UserProfile> {
  console.log(`🔍 handleUserSignIn called for user: ${user.email} (${user.uid})`);
  console.log(`🔑 Provider: ${provider}`);
  
  const userRef = doc(db, "users", user.uid);
  
  try {
    console.log(`📥 Fetching user document from Firestore...`);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.log(`❌ User ${user.uid} does not exist in database`);
      throw new Error(`Account not found. Please sign up first.`);
    }
    
    console.log(`✅ User ${user.uid} found in database - proceeding with sign-in`);
    
    // Update existing user's last login
    await updateDoc(userRef, {
      lastLoginAt: serverTimestamp(),
      provider: provider, // Update provider in case they switch
      isActive: true,
    });
    
    console.log(`🔄 User sign-in successful - profile updated`);
    
    return userSnap.data() as UserProfile;
    
  } catch (error) {
    console.error(`❌ Sign-in failed for user ${user.uid}:`, error);
    throw error;
  }
}

/**
 * Handle user sign-up - ONLY for new users
 * Will create new user profile in database
 */
export async function handleUserSignUp(user: User, provider: string): Promise<UserProfile> {
  console.log(`🆕 handleUserSignUp called for user: ${user.email} (${user.uid})`);
  console.log(`🔑 Provider: ${provider}`);
  
  const userRef = doc(db, "users", user.uid);
  
  try {
    console.log(`📥 Checking if user already exists in Firestore...`);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      console.log(`⚠️ User ${user.uid} already exists - this should be a sign-in`);
      // For sign-up, we still proceed but log the situation
    }
    
    const userData: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || '',
      photoURL: user.photoURL || '',
      role: 'owner', // Default role for new users
      provider: provider,
      lastLoginAt: serverTimestamp(),
      isActive: true,
      display: true,
      householdName: '',
      country: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      inside_managerAdded: true,
      inside_overdue: true,
      inside_taskAdded: true,
      inside_taskCompleted: true,
      insideLeaseEnd: true,
      email_managerAdded: true,
      email_overdue: true,
      email_taskAdded: true,
      email_taskCompleted: true,
      emailLeaseEnd: true,
      push_managerAdded: true,
      push_overdue: true,
      push_taskAdded: true,
      push_taskCompleted: true,
      pushLeaseEnd: true,
    };

    // Create new user profile
    console.log(`📝 Creating user document in Firestore...`);
    console.log(`📄 User data:`, userData);
    
    await setDoc(userRef, {
      ...userData,
      createdAt: serverTimestamp(),
    });
    
    console.log(`✅ New ${provider} user profile created:`, user.uid);
    
    // Verify the document was created
    console.log(`🔍 Verifying document creation...`);
    const verifySnap = await getDoc(userRef);
    if (verifySnap.exists()) {
      console.log(`✅ Document verification successful`);
    } else {
      console.log(`❌ Document verification failed - document not found`);
    }
    
    return userData;
    
  } catch (error) {
    console.error(`❌ Sign-up failed for user ${user.uid}:`, error);
    throw new Error(`Failed to create user profile: ${error}`);
  }
}

/**
 * Universal function that handles both new and existing users
 * Checks if user exists and either creates or updates profile accordingly
 * Returns both the profile and whether the user is new
 */
export async function createOrUpdateUserProfile(user: User, provider: string = 'email'): Promise<UserProfileResult> {
  console.log(`🔄 createOrUpdateUserProfile called for: ${user.email} (${user.uid})`);
  console.log(`🔑 Provider: ${provider}`);
  
  const userRef = doc(db, "users", user.uid);
  
  try {
    console.log(`📥 Checking if user exists in Firestore...`);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      console.log(`✅ Existing user found - updating profile`);
      // Existing user - update last login
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
        provider: provider,
        isActive: true,
      });
      console.log(`🔄 Existing user profile updated successfully`);
      const profile = userSnap.data() as UserProfile;
      return { profile, isNewUser: false };
    } else {
      console.log(`🆕 New user detected - creating profile`);
      // New user - create profile
      const userData: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        role: 'owner', // Default role for new users
        provider: provider,
        lastLoginAt: serverTimestamp(),
        isActive: true,
        hasCompletedOnboarding: false, // New users haven't completed onboarding

        display: true,
        householdName: '',
        country: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        inside_managerAdded: true,
        inside_overdue: true,
        inside_taskAdded: true,
        inside_taskCompleted: true,
        insideLeaseEnd: true,
        email_managerAdded: true,
        email_overdue: true,
        email_taskAdded: true,
        email_taskCompleted: true,
        emailLeaseEnd: true,
        push_managerAdded: true,
        push_overdue: true,
        push_taskAdded: true,
        push_taskCompleted: true,
        pushLeaseEnd: true,
      };

      await setDoc(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
      });
      
      console.log(`✅ New user profile created successfully`);
      return { profile: userData, isNewUser: true };
    }
  } catch (error) {
    console.error(`❌ Error in createOrUpdateUserProfile:`, error);
    throw new Error(`Failed to sync user profile: ${error}`);
  }
}

/**
 * Create user profile specifically for new sign-ups
 */
export async function createNewUserProfile(user: User, provider: string = 'email'): Promise<UserProfile> {
  return handleUserSignUp(user, provider);
}

/**
 * Check if user exists in Firestore database
 */
export async function checkUserExists(uid: string): Promise<boolean> {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists();
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  
  return null;
}

/**
 * Update user profile
 */
export async function updateUserProfile(uid: string, data: Partial<UserInput>): Promise<void> {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    ...data,
    lastLoginAt: serverTimestamp(),
  });
}

/**
 * Mark user onboarding as completed
 */
export async function completeUserOnboarding(uid: string): Promise<void> {
  console.log(`🎉 Marking onboarding as completed for user: ${uid}`);
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    hasCompletedOnboarding: true,
    lastLoginAt: serverTimestamp(),
  });
  console.log(`✅ Onboarding marked as completed`);
}

/**
 * Deactivate user (soft delete)
 */
export async function deactivateUser(uid: string): Promise<void> {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    isActive: false,
    lastLoginAt: serverTimestamp(),
  });
}
