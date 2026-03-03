import { onSnapshot, query, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { addDoc, getDoc, doc, Timestamp } from 'firebase/firestore';
import { format, toZonedTime } from 'date-fns-tz';

export type NotificationType = 'task_assigned' | 'task_completed' | 'task_overdue' | 'property_update';

interface Notification {
  userId: string;
  type: NotificationType;
  message: string;
  taskId?: string;
  propertyId?: string;
  createdAt?: any;
  read?: boolean;
}

export async function sendNotification({ userId, type, message, taskId, propertyId }: Notification) {
  try {
    // Get current time in US Central Time (America/Chicago) as UTC Date
  const timeZone = 'America/Chicago';
  const now = new Date();
  const zonedDate = toZonedTime(now, timeZone);
  const centralIso = format(zonedDate, "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone });
  const centralDate = new Date(centralIso);
  const centralTimestamp = Timestamp.fromDate(centralDate);
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      message,
      taskId: taskId || null,
      propertyId: propertyId || null,
      createdAt: centralTimestamp,
      read: false,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

/**
 * Send 'task_completed' notifications to all property owners/shared members except the completer.
 * @param propertyId - The property ID
 * @param taskId - The completed task ID
 * @param taskTitle - The completed task title
 * @param completedBy - UID of the user who completed the task
 * @param completerName - Display name of the completer
 */
export async function sendTaskCompletedNotification({ propertyId, taskId, taskTitle, completedBy, completerName }: {
  propertyId: string;
  taskId: string;
  taskTitle: string;
  completedBy: string;
  completerName: string;
}) {
  try {
    const propertySnapshot = await getDoc(doc(collection(db, 'properties'), propertyId));
    if (!propertySnapshot.exists()) return;
    const propertyData = propertySnapshot.data();
    // ownerId: string, sharedWith: array of { userId: string }
    const owners: string[] = propertyData.ownerId ? [propertyData.ownerId] : [];
    const sharedMembers: string[] = Array.isArray(propertyData.sharedWith)
      ? propertyData.sharedWith.map((sw: any) => sw.userId).filter(Boolean)
      : [];
    // Combine and deduplicate
    const recipients = Array.from(new Set([...owners, ...sharedMembers])).filter(uid => uid !== completedBy);
    for (const userId of recipients) {
      await sendNotification({
        userId,
        type: 'task_completed',
        message: `${taskTitle} was marked done by ${completerName}.`,
        taskId,
        propertyId,
      });
    }
  } catch (error) {
    console.error('Error sending task completed notifications:', error);
  }
}

export function listenForTaskEvents(userId: string) {
  // Listen for all tasks
  console.log("Listening for task events for user:", userId);
  // Listen for all tasks
  const q = query(collection(db, 'tasks'));
  let previousTasks: Record<string, any> = {};
  return onSnapshot(q, async (snapshot) => {
    console.log('listenForTaskEvents snapshot received:', snapshot.docChanges().length, 'changes');
    for (const change of snapshot.docChanges()) {
      const data = change.doc.data();
      const taskId = change.doc.id;
      const prev = previousTasks[taskId];
      console.log('[Task Change]', {
        type: change.type,
        taskId,
        prev,
        data
      });
      // Detect assignment: assigned_user changes from null/unassigned to current user
      if (change.type === 'modified') {
        // Check if dueDate is overdue and update status if needed
        if (data.dueDate) {
          const now = new Date();
          console.log('[DEBUG] Current time:', now);
          let dueDate;
          if (data.dueDate instanceof Date) {
            dueDate = data.dueDate;
          } else if (data.dueDate.seconds) {
            dueDate = new Date(data.dueDate.seconds * 1000);
          } else {
            dueDate = new Date(data.dueDate);
          }
          console.log('[DEBUG] Task dueDate:', dueDate);
          console.log('[DEBUG] Previous status:', prev ? prev.status : null);
          console.log('[DEBUG] Current status:', data.status);
          if (dueDate < now && prev && prev.status !== 'overdue' && data.status == 'overdue') {
            console.log('[DEBUG] Task just became overdue:', { taskId, title: data.title });
            // Update status to 'overdue' and send notifications immediately
            try {
              // Update previousTasks immediately to prevent duplicate notification
              previousTasks[taskId] = { ...data, status: 'overdue' };
              // Send overdue notifications to property owner and shared members
              console.log('[DEBUG] Fetching property by document ID:', data.propertyId);
              const propertyRef = doc(db, 'properties', data.propertyId);
              const propertySnap = await getDoc(propertyRef);
              console.log('[DEBUG] Property exists:', propertySnap.exists());
              if (propertySnap.exists()) {
                const propertyData = propertySnap.data();
                console.log('[DEBUG] Property data:', propertyData);
                const owners = propertyData.ownerId ? [propertyData.ownerId] : [];
                const sharedMembers = Array.isArray(propertyData.sharedWith)
                  ? propertyData.sharedWith.map((sw) => sw.userId).filter(Boolean)
                  : [];
                console.log('[DEBUG] Owners:', owners);
                console.log('[DEBUG] Shared members:', sharedMembers);
                const recipients = Array.from(new Set([...owners, ...sharedMembers]));
                console.log('[DEBUG] Notification recipients:', recipients);
                for (const notifyUserId of recipients) {
                  console.log('[DEBUG] Sending overdue notification to:', notifyUserId);
                  await sendNotification({
                    userId: notifyUserId,
                    type: 'task_overdue',
                    message: `Task overdue: ${data.title} is past its due date. Please update or complete it.`,
                    taskId,
                    propertyId: data.propertyId,
                  });
                }
              }
            } catch (err) {
              console.error('Error updating task status to overdue or sending notifications:', err);
            }
            return; // Prevent further logic for this change
          }
        }

        // Check if assignment changed using assigned_user_id (more reliable than displayName)
        const assignedUserId = data.assigned_user_id || null;
        const prevAssignedUserId = prev?.assigned_user_id || null;
        
        if (
          prev &&
          assignedUserId !== prevAssignedUserId &&
          assignedUserId
        ) {
          console.log('[Assignment Detection]', {
            assignedUserId,
            currentUserId: userId,
            assigned_user: data.assigned_user
          });
          // Notify assigned user
          if (assignedUserId === userId) {
            console.log('[Notification Triggered] Task Assigned', { taskId, title: data.title });
            sendNotification({
              userId,
              type: 'task_assigned',
              message: `New task assigned: ${data.title} has been assigned to you.`,
              taskId,
              propertyId: data.propertyId,
            });
          }
          // Notify task owner (if not the same as assigned user)
          if (data.ownerId && data.ownerId !== assignedUserId) {
            sendNotification({
              userId: data.ownerId,
              type: 'task_assigned',
              message: `New task assigned: ${data.title} has been assigned to ${data.assigned_user || 'someone'}.`,
              taskId,
              propertyId: data.propertyId,
            });
          }
        }

      }
      // Update previous state
      previousTasks[taskId] = data;
    }
  })
};