import { doc, getDoc, updateDoc, collection, getDocs, query, where, deleteDoc, arrayRemove, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Shared delete/remove logic for a property.
 *
 * Owner removing a property:
 *   - Friends are removed (they lose the property).
 *   - If a Co-owner exists, the Co-owner is promoted to owner.
 *   - If a PM exists (but no Co-owner), the property becomes ownerless and the PM keeps it.
 *   - If there are no PMs or Co-owners, the property and all its tasks are fully deleted.
 *
 * Shared member (PM, Co-owner, Friend) leaving:
 *   - Removes themselves from sharedWith and reassigns their tasks back to the owner.
 *   - If it's the last member of an ownerless property, the property is fully deleted.
 *
 * Returns { wasOwner: boolean } so the caller can update local UI state accordingly.
 */
export async function deleteProperty(propertyId: string, userId: string): Promise<{ wasOwner: boolean }> {
  const propertyDocRef = doc(db, "properties", propertyId);
  const propertyDocSnap = await getDoc(propertyDocRef);
  if (!propertyDocSnap.exists()) throw new Error('Property not found');

  const propertyData = propertyDocSnap.data();
  const isOwner = propertyData.ownerId === userId;
  const hasRealOwner = !!propertyData.ownerId && propertyData.ownerId !== '';
  const sharedWithArray: any[] = propertyData.sharedWith || [];
  const userSharedEntry = sharedWithArray.find((sw: any) =>
    typeof sw === 'object' && sw.userId === userId
  );

  // Categorise shared members by role
  const pmMembers = sharedWithArray.filter((sw: any) =>
    typeof sw === 'object' && (sw.role === 'PM' || sw.role === 'Property Manager')
  );
  const coOwnerMembers = sharedWithArray.filter((sw: any) =>
    typeof sw === 'object' &&
    sw.userId !== userId &&
    !['PM', 'Property Manager', 'Friend', 'Friend Manager'].includes(sw.role)
  );

  // ── OWNER removing the property ──────────────────────────────────────
  if (isOwner) {
    // If a PM or Co-owner exists the property survives; otherwise full-delete.
    if (pmMembers.length > 0 || coOwnerMembers.length > 0) {
      // Keep PMs and co-owners, remove all friends
      const survivingMembers = sharedWithArray.filter((sw: any) =>
        typeof sw === 'object' &&
        sw.role !== 'Friend' && sw.role !== 'Friend Manager'
      );

      const updatePayload: Record<string, any> = {};

      if (coOwnerMembers.length > 0) {
        // Promote the first co-owner to owner
        const newOwner = coOwnerMembers[0];
        updatePayload.ownerId = newOwner.userId;
        // Remove promoted co-owner from sharedWith (they are now the owner)
        updatePayload.sharedWith = survivingMembers.filter(
          (sw: any) => sw.userId !== newOwner.userId
        );
      } else {
        // No co-owner — property becomes ownerless; PM retains access
        updatePayload.ownerId = '';
        updatePayload.sharedWith = survivingMembers;
      }

      await updateDoc(propertyDocRef, updatePayload);

      // Reassign tasks that were assigned to the departing owner
      try {
        const ownerTasksQuery = query(
          collection(db, "tasks"),
          where("propertyId", "==", propertyId),
          where("assigned_user_id", "==", userId)
        );
        const ownerTasksSnap = await getDocs(ownerTasksQuery);
        if (ownerTasksSnap.size > 0) {
          if (coOwnerMembers.length > 0) {
            // Reassign to the new owner (promoted co-owner)
            const newOwnerId = coOwnerMembers[0].userId;
            const newOwnerDoc = await getDoc(doc(db, "users", newOwnerId));
            const newOwnerName = newOwnerDoc.exists() ? (newOwnerDoc.data().displayName || '') : '';
            for (const td of ownerTasksSnap.docs) {
              await updateDoc(td.ref, { assigned_user_id: newOwnerId, assigned_user: newOwnerName });
            }
          } else {
            // No co-owner — reassign owner's tasks to the first PM
            const firstPmId = pmMembers[0].userId;
            const firstPmDoc = await getDoc(doc(db, "users", firstPmId));
            const firstPmName = firstPmDoc.exists() ? (firstPmDoc.data().displayName || '') : '';
            for (const td of ownerTasksSnap.docs) {
              await updateDoc(td.ref, { assigned_user_id: firstPmId, assigned_user: firstPmName });
            }
          }
        }
      } catch (err) {
        console.error('Failed to reassign tasks for departing owner:', err);
      }

      // Reset onboarding if the departing owner has no remaining properties
      try {
        const ownedQ = query(collection(db, "properties"), where("ownerId", "==", userId));
        const ownedSnap = await getDocs(ownedQ);
        const allPropsSnap = await getDocs(collection(db, "properties"));
        const hasShared = allPropsSnap.docs.some(d => {
          const data = d.data();
          return Array.isArray(data.sharedWith) && data.sharedWith.some((sw: any) => sw.userId === userId);
        });
        if (ownedSnap.empty && !hasShared) {
          await updateDoc(doc(db, "users", userId), { hasCompletedOnboarding: false });
        }
      } catch (err) {
        console.error('Failed to check/reset onboarding:', err);
      }

      return { wasOwner: true };
    }

    // No PM or Co-owner → fall through to full property deletion below
  }

  // ── SHARED MEMBER leaving (non-owner, property survives) ─────────────
  if (!isOwner) {
    // Check if this is the last member of an ownerless property
    const otherMembers = sharedWithArray.filter((sw: any) =>
      typeof sw === 'object' && sw.userId !== userId
    );
    const isLastMember = !hasRealOwner && otherMembers.length === 0;

    if (!isLastMember) {
      // Normal shared member leaving — property survives
      if (userSharedEntry) {
        await updateDoc(propertyDocRef, { sharedWith: arrayRemove(userSharedEntry) });
      }

      // Handle tasks assigned to this user
      try {
        const tasksAssignedToUser = query(
          collection(db, "tasks"),
          where("propertyId", "==", propertyId),
          where("assigned_user_id", "==", userId)
        );
        const assignedTasksSnap = await getDocs(tasksAssignedToUser);
        if (assignedTasksSnap.size > 0) {
          if (hasRealOwner) {
            // Reassign tasks to the real owner
            const ownerDoc = await getDoc(doc(db, "users", propertyData.ownerId));
            const ownerDisplayName = ownerDoc.exists() ? (ownerDoc.data().displayName || '') : '';
            for (const taskDoc of assignedTasksSnap.docs) {
              await updateDoc(taskDoc.ref, {
                assigned_user_id: propertyData.ownerId,
                assigned_user: ownerDisplayName,
              });
            }
          } else {
            // No real owner — unassign tasks so remaining shared members can see them
            for (const taskDoc of assignedTasksSnap.docs) {
              await updateDoc(taskDoc.ref, {
                assigned_user_id: null,
                assigned_user: '',
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to handle tasks for leaving member:', err);
      }

      return { wasOwner: false };
    }
    // Last member of ownerless property → fall through to full deletion
  }

  // ── FULL PROPERTY DELETION ───────────────────────────────────────────
  // (Owner with no PM/Co-owner, OR last member of an ownerless property)

  // Delete ALL tasks for this property
  const tasksQuery = query(
    collection(db, "tasks"),
    where("propertyId", "==", propertyId)
  );
  const tasksSnap = await getDocs(tasksQuery);
  if (tasksSnap.size > 0) {
    const batch = writeBatch(db);
    for (const taskDoc of tasksSnap.docs) { batch.delete(taskDoc.ref); }
    try { await batch.commit(); } catch (err) { console.error('Batch delete tasks failed:', err); }
  }

  // Delete the property document
  await deleteDoc(propertyDocRef);

  // Clean up invites
  try {
    const { cleanupInvitesForDeletedProperty } = await import("./UserService");
    await cleanupInvitesForDeletedProperty(propertyId);
  } catch (err) {
    console.error('Failed to clean up invites:', err);
  }

  // If no properties left, reset onboarding flag
  try {
    const ownedQ = query(collection(db, "properties"), where("ownerId", "==", userId));
    const ownedSnap = await getDocs(ownedQ);
    const allPropsSnap = await getDocs(collection(db, "properties"));
    const hasShared = allPropsSnap.docs.some(d => {
      const data = d.data();
      return Array.isArray(data.sharedWith) && data.sharedWith.some((sw: any) => sw.userId === userId);
    });
    if (ownedSnap.empty && !hasShared) {
      await updateDoc(doc(db, "users", userId), { hasCompletedOnboarding: false });
    }
  } catch (err) {
    console.error('Failed to check/reset onboarding:', err);
  }

  return { wasOwner: true };
}

export async function addUserToPropertySharedWith(propertyId: string, userId: string, options?: { expired?: any, role?: string, alias?: string }) {
  const propertyRef = doc(db, "properties", propertyId);
  const propertySnap = await getDoc(propertyRef);
  if (!propertySnap.exists()) return;
  const propertyData = propertySnap.data();
  let sharedWith = Array.isArray(propertyData.sharedWith) ? propertyData.sharedWith : [];
  // Prevent duplicate userId
  if (sharedWith.some((sw: any) => sw.userId === userId)) return;
  const aliasValue = options?.alias ?? propertyData.type ?? "Shared Property";
  sharedWith = [...sharedWith, {
    userId,
    expired: options?.expired ?? null,
    role: options?.role ?? "Friend",
    alias: aliasValue
  }];
  await updateDoc(propertyRef, { sharedWith });
}

// Get all owned and shared properties for a user
export async function getAllPropertiesForUser(userId: string): Promise<Array<{ id: string, name: string, sharedBy?: string, image?: string }>> {
  const propertiesRef = collection(db, "properties");
  const propertiesSnap = await getDocs(propertiesRef);
  const result: Array<{ id: string, name: string, sharedBy?: string, image?: string }> = [];
  propertiesSnap.forEach(doc => {
    const data = doc.data();
    const isOwner = data.ownerId === userId;
    const isShared = Array.isArray(data.sharedWith) && data.sharedWith.some((sw: any) => sw.userId === userId);
    if (isOwner || isShared) {
      let sharedBy = undefined;
      if (isShared && !isOwner && Array.isArray(data.sharedWith)) {
        const entry = data.sharedWith.find((sw: any) => sw.userId === userId);
        sharedBy = entry?.sharedBy || data.ownerName || undefined;
      }
      result.push({
        id: doc.id,
        name: data.type || data.propertyName || data.address1 || "Unnamed Property",
        sharedBy,
        image: data.photoUrl || ""
      });
    }
  });
  return result;
}

export async function getSharedPropertyCountForUser(userId: string): Promise<number> {
  const propertiesRef = collection(db, "properties");
  const propertiesSnap = await getDocs(propertiesRef);
  let count = 0;
  propertiesSnap.forEach(doc => {
    const data = doc.data();
    // Count if user is owner
    if (data.ownerId === userId) {
      count++;
      return;
    }
    // Count if user is in sharedWith
    if (Array.isArray(data.sharedWith) && data.sharedWith.some((sw: any) => sw.userId === userId)) {
      count++;
    }
  });
  return count;
}
