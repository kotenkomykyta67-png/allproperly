const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

// Daily email: every day at UTC 04:00
exports.sendDailyEmail = onSchedule({
  schedule: '0 4 * * *',
  timeZone: 'UTC',
}, async (event) => {
  // Daily email HTML template
  const dailyEmailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AllProperly Task Digest</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" type="text/css">
  <style>
    @media only screen and (max-width:600px) {
      .container { width: 100% !important; }
      .stack-column, .stack-column td { display: block !important; width: 100% !important; text-align: center !important; padding: 10px 0px !important; }
      img { max-width: 100% !important; height: auto !important; }
    }
  </style>
</head>
<body style="background:#475567; margin:0; padding:20px; font-family:Nunito,Arial, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr><td align="center">
      <table role="presentation" width="650" class="container" cellpadding="0" cellspacing="0" border="0" style="max-width:650px; background:#ffffff; border:1px solid #e4e9f0; border-radius:10px; padding:20px;">
        <tr><td align="center" style="padding:20px;">
          <a href="https://app.allproperly.com/" target="_blank">
            <img src="https://app.allproperly.com/daily/logo.png" alt="AllProperly Logo" width="200" style="display:block; border:0; outline:none; text-decoration:none;">
          </a>
        </td></tr>
        <tr><td align="center" style="color:#475567; font-size:26px; font-weight:bold; padding:10px 20px 10px;">
          {{emailTitle}}
        </td></tr>
        <tr><td align="center" style="padding:20px 20px 25px 20px;">
          <img src="https://app.allproperly.com/daily/bell.png" alt="Task Digest Reminder" width="100" style="max-width:100%; display:block; border:0; outline:none; text-decoration:none;">
        </td></tr>
        <tr><td align="center" style="color:#475567; font-size:16px; line-height:24px; padding:10px 30px 20px;">
          Hi <strong>{{displayName}}</strong>,<br>
          {{emailMessage}}
        </td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f8f6; border:1px solid #e4e9f0; border-radius:10px;">
            {{taskRows}}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px;">
          <a href="https://app.allproperly.com/tasks" target="_blank" style="background:#89AE99; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600; padding:12px 28px; border-radius:8px; display:inline-block;">View All Tasks →</a>
        </td></tr>
        <tr><td style="background:#eef4f2; border-radius:10px; padding:25px; text-align:center; color:#475567; font-size:15px; line-height:22px;">
          <table align="center"><tr><td style="font-weight: bold; font-size: 15px; padding-bottom: 12px;">Did you know?</td></tr></table>
          AllProperly not only reminds you of tasks but also helps you <strong>plan ahead</strong> with savings calculators and <strong>forecast when big systems (like your roof or HVAC)</strong> may need replacing.
        </td></tr>
        <tr><td align="center" style="color:#475567; font-size:14px; line-height:22px; padding:25px 30px 0px;">Keep your property in proper order — everything’s easier when it’s AllProperly.</td></tr>
        <tr><td align="center" style="color:#475567; font-size:13px; line-height:20px; padding:20px;">You're receiving this daily digest from AllProperly.<br>© 2025 All Properly LLC.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `;

  // Custom logic to build user-specific email content
  const db = admin.firestore();
  const usersSnapshot = await db.collection('users').get();
  const sendPromises = [];

  for (const doc of usersSnapshot.docs) {
    const user = doc.data();
    const userId = doc.id;
    console.log(`Processing user: ${user.email}, displayName: ${user.displayName}, userId: ${userId}`);
    
    if (user.email) {
      // Fetch tasks for this user: assigned tasks OR owned tasks
      let tasks = [];
      try {
        // Query 1: Tasks assigned to user by userId
        let assignedByIdSnapshot = await db.collection('tasks').where('assigned_user_id', '==', userId).get();
        console.log(`Found ${assignedByIdSnapshot.docs.length} tasks assigned by userId for ${user.email}`);
        
        // Query 2: Tasks assigned to user by displayName (fallback)
        let assignedByNameSnapshot = { docs: [] };
        if (user.displayName) {
          assignedByNameSnapshot = await db.collection('tasks').where('assigned_user', '==', user.displayName).get();
          console.log(`Found ${assignedByNameSnapshot.docs.length} tasks assigned by displayName for ${user.email}`);
        }
        
        // Query 3: Tasks owned by user
        let ownedSnapshot = await db.collection('tasks').where('ownerId', '==', userId).get();
        console.log(`Found ${ownedSnapshot.docs.length} tasks owned by ${user.email}`);
        
        // Combine all results (deduplicate by task ID)
        const taskMap = new Map();
        [...assignedByIdSnapshot.docs, ...assignedByNameSnapshot.docs, ...ownedSnapshot.docs].forEach(taskDoc => {
          taskMap.set(taskDoc.id, taskDoc.data());
        });
        
        const allTasks = Array.from(taskMap.values());
        console.log(`Found ${allTasks.length} unique total tasks for user ${user.email}`);
        
        const now = new Date();
        const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        // Helper function to parse Firestore timestamp or date string
        function parseTimestamp(ts) {
          if (!ts) return null;
          if (ts.toDate && typeof ts.toDate === 'function') {
            // Firestore Timestamp object
            return ts.toDate();
          } else if (ts._seconds !== undefined) {
            // Firestore Timestamp in raw format
            return new Date(ts._seconds * 1000);
          } else if (typeof ts === 'string') {
            // ISO string
            return new Date(ts);
          } else if (ts instanceof Date) {
            return ts;
          }
          return null;
        }
        
        tasks = allTasks.filter(task => {
          // Check both createdAt and updatedAt - task is relevant if EITHER is in last 24h
          const createdAt = parseTimestamp(task.createdAt);
          const updatedAt = parseTimestamp(task.updatedAt);
          
          const createdRecently = createdAt && createdAt >= past24h && createdAt <= now;
          const updatedRecently = updatedAt && updatedAt >= past24h && updatedAt <= now;
          
          const isRecent = createdRecently || updatedRecently;
          
          console.log(`Task "${task.title}" createdAt: ${createdAt?.toISOString() || 'null'}, updatedAt: ${updatedAt?.toISOString() || 'null'}, isRecent: ${isRecent}`);
          return isRecent;
        });
        console.log(`Found ${tasks.length} tasks created/updated in last 24h for user ${user.email}`);
      } catch (err) {
        console.error(`Error fetching tasks for user ${user.email}:`, err);
        tasks = [];
      }

      // Build task rows HTML with formatted dueDate
      function formatDueDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }

      // Fetch property names for all unique propertyIds
      const propertyIds = [...new Set(tasks.map(t => t.propertyId).filter(Boolean))];
      const propertyNameMap = {};
      for (const propId of propertyIds) {
        try {
          const propDoc = await db.collection('properties').doc(propId).get();
          if (propDoc.exists) {
            const propData = propDoc.data();
            propertyNameMap[propId] = propData.propertyName || propData.address1 || propId;
          } else {
            propertyNameMap[propId] = propId;
          }
        } catch (err) {
          console.error(`Error fetching property ${propId}:`, err);
          propertyNameMap[propId] = propId;
        }
      }

      const taskRows = tasks.map(task => {
        const propertyName = propertyNameMap[task.propertyId] || task.propertyId || 'Unknown';
        return `
        <tr>
          <td style="padding:15px 20px; font-size:15px; color:#475567; border-top:1px solid #e4e9f0;">
            <strong>${task.title}</strong><br>
            Property: ${propertyName}<br>
            Due: <strong>${formatDueDate(task.dueDate)}</strong>
          </td>
        </tr>
      `;
      }).join('');

      // Replace placeholders in template
      const personalizedHtml = dailyEmailHtml
        .replace('{{displayName}}', user.displayName || '')
        .replace('{{emailTitle}}', 'Your Daily AllProperly Update')
        .replace('{{emailMessage}}', "Here's your daily update from AllProperly:")
        .replace('{{taskRows}}', taskRows);

      // Check email preferences before sending
      const emailPrefs = user.emailPreferences || {};
      const dailyEmailsEnabled = emailPrefs.dailyEmails !== false;
      
      console.log(`User ${user.email} preferences: dailyEmails=${dailyEmailsEnabled}`);
      console.log(`Tasks count: ${tasks.length}`);
      
      // Send email only if daily emails are enabled AND there are tasks
      if (dailyEmailsEnabled && tasks.length > 0) {
        console.log(`Sending daily email to ${user.email} with ${tasks.length} tasks`);
        await admin.firestore().collection('mail').add({
          to: user.email,
          subject: 'AllProperly Daily Task Update',
          text: 'You have been assigned new tasks today on AllProperly',
          html: personalizedHtml,
          from: 'AllProperly Notifications <notify@allproperly.com>',
          headers: {
            'X-PM-Message-Stream': 'outbound'
          }
        });
        console.log(`Email queued successfully for ${user.email}`);
      } else {
        console.log(`Skipping email for ${user.email}: tasks=${tasks.length}, dailyEmailsEnabled=${dailyEmailsEnabled}`);
      }
    }
  }
  console.log('Daily emails processed for sending at UTC 04:00');
  return null;
});


exports.sendWeeklyEmail = onSchedule({
  schedule: '0 4 * * 0',
  timeZone: 'UTC',
}, async (event) => {
  // Weekly email HTML template
  const weeklyEmailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AllProperly Multi-Property Weekly Summary</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" type="text/css">
  <style>
    @media only screen and (max-width:600px) {
      .container { width: 100% !important; }
      .stack-column, .stack-column td { display: block !important; width: 100% !important; text-align: center !important; padding: 10px 0px !important; }
      img { max-width: 100% !important; height: auto !important; }
    }
  </style>
</head>
<body style="background:#475567; margin:0; padding:20px; font-family:Nunito,Arial,sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr><td align="center">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="650" class="container" style="max-width:650px; background:#ffffff; border:1px solid #e4e9f0; border-radius:10px; padding:20px;">
        <tr><td align="center" style="padding:20px;">
          <a href="https://app.allproperly.com/" target="_blank">
            <img src="https://app.allproperly.com/weekly/logo.png" alt="AllProperly Logo" width="200" style="display:block; border:0; outline:none; text-decoration:none;">
          </a>
        </td></tr>
        <tr><td align="center" style="padding:10px 20px;">
          <img src="https://app.allproperly.com/weekly/hero.png" alt="Weekly Property Summary" width="240" style="max-width:100%; display:block; border:0; outline:none; text-decoration:none;">
        </td></tr>
        <tr><td align="center" style="color:#475567; font-size:28px; font-weight:bold; padding:20px 20px 10px;">
          Your Weekly Home Summary
        </td></tr>
        <tr><td align="center" style="color:#475567; font-size:16px; line-height:24px; padding:0px 30px 10px;">
          Here's what's been happening across your properties this week.
        </td></tr>
        <!-- Task Summary Cards -->
        <tr><td style="padding: 20px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            <tr>
              <td style="width: 33.33%; padding: 10px; text-align: center; vertical-align: top;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr><td style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 16px; color: #E5B26B; font-weight: 600;">Completed Tasks</p>
                    <p style="margin: 0; font-size: 32px; font-weight: 700; color: #323C47;">{{completedTasks}}</p>
                  </td></tr>
                </table>
              </td>
              <td style="width: 33.33%; padding: 10px; text-align: center; vertical-align: top;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr><td style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 16px; color: #D36666; font-weight: 600;">Overdue Tasks</p>
                    <p style="margin: 0; font-size: 32px; font-weight: 700; color: #323C47;">{{overdueTasks}}</p>
                  </td></tr>
                </table>
              </td>
              <td style="width: 33.33%; padding: 10px; text-align: center; vertical-align: top;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr><td style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 16px; color: #3c6471; font-weight: 600;">Upcoming Tasks</p>
                    <p style="margin: 0; font-size: 32px; font-weight: 700; color: #323C47;">{{upcomingTasks}}</p>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
        <!-- Property Section (repeat for each property) -->
        {{propertySections}}
        <!-- Encouragement Message -->
        <tr><td style="padding: 10px 20px 20px; text-align: center;">
          <p style="margin: 0; font-size: 15px; color: #475567; line-height: 1.6;">Nice work keeping your homes in proper order this week. You've got this</p>
        </td></tr>
        <!-- CTA Button -->
        <tr><td style="padding: 10px; text-align: center;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
            <tr><td style="background-color: #86BCAA; border-radius: 8px; padding: 14px 32px;">
              <a href="https://app.allproperly.com/" target="_blank" style="display: inline-block; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">Open My Dashboard</a>
            </td></tr>
          </table>
        </td></tr>
        <!-- Tip Section -->
        <tr><td style="background:#eef4f2; border-radius:10px; padding:25px; text-align:center; color:#475567; font-size:15px; line-height:22px;">
          <span style="font-weight: bold;">Pro tip:</span> Regular upkeep helps maintain property value.<br>
          Use AllProperly to track maintenance and forecast long-term repairs with confidence.
        </td></tr>
        <!-- Footer -->
        <tr><td align="center" style="color:#475567; font-size:14px; line-height:22px; padding:20px;">
          You’re receiving this weekly summary from AllProperly.com to help you stay organized and proactive.
        </td></tr>
        <tr><td align="center" style="color:#475567; font-size:14px; line-height:22px; padding:0 20px 20px;">
          © 2025 All Properly LLC.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `;

  // Custom logic to build user-specific weekly email content
  const db = admin.firestore();
  const usersSnapshot = await db.collection('users').get();
  const sendPromises = [];

  for (const doc of usersSnapshot.docs) {
    const user = doc.data();
    if (user.email) {

        // Fetch owned and shared properties for this user
        let properties = [];
        try {
            const ownedSnapshot = await db.collection('properties').where('owner', '==', doc.id).get();
            const sharedSnapshot = await db.collection('properties').where('sharedWith', 'array-contains', doc.id).get();
            properties = [
            ...ownedSnapshot.docs.map(propertyDoc => propertyDoc.data()),
            ...sharedSnapshot.docs.map(propertyDoc => propertyDoc.data())
            ];
        } catch (err) {
            properties = [];
        }

        // For each property, count tasks by status
        let totalCompleted = 0;
        let totalOverdue = 0;
        let totalUpcoming = 0;
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setUTCDate(now.getUTCDate() - now.getUTCDay()); // Sunday
        startOfWeek.setUTCHours(0,0,0,0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6); // Saturday
        endOfWeek.setUTCHours(23,59,59,999);
        const nextWeekStart = new Date(endOfWeek);
        nextWeekStart.setUTCDate(endOfWeek.getUTCDate() + 1); // Next Sunday
        nextWeekStart.setUTCHours(0,0,0,0);
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setUTCDate(nextWeekStart.getUTCDate() + 6); // Next Saturday
        nextWeekEnd.setUTCHours(23,59,59,999);

        function getDayName(dateStr) {
          if (!dateStr) return '';
          const d = new Date(dateStr);
          return d.toLocaleDateString('en-US', { weekday: 'long' });
        }

        const propertySections = await Promise.all(properties.map(async property => {
          let completed = 0;
          let overdue = 0;
          let upcoming = 0;
          let filteredTasks = [];
          try {
            const tasksSnapshot = await db.collection('tasks')
              .where('propertyId', '==', property.id)
              .get();
            const tasks = tasksSnapshot.docs.map(taskDoc => taskDoc.data());
            // Completed: status === 'completed' && updatedAt in last week
            completed = tasks.filter(t => {
              if (t.status !== 'completed' || !t.updatedAt) return false;
              const updated = new Date(t.updatedAt);
              return updated >= startOfWeek && updated <= endOfWeek;
            }).length;
            // Overdue: status === 'overdue' && dueDate in last week
            overdue = tasks.filter(t => {
              if (t.status !== 'overdue' || !t.dueDate) return false;
              const due = new Date(t.dueDate);
              return due >= startOfWeek && due <= endOfWeek;
            }).length;
            // Upcoming: status === 'pending' && dueDate in next week
            upcoming = tasks.filter(t => {
              if (t.status !== 'pending' || !t.dueDate) return false;
              const due = new Date(t.dueDate);
              return due >= nextWeekStart && due <= nextWeekEnd;
            }).length;
            // For display: show only relevant tasks
            filteredTasks = tasks.filter(t => {
              if (t.status === 'completed' && t.updatedAt) {
                const updated = new Date(t.updatedAt);
                return updated >= startOfWeek && updated <= endOfWeek;
              }
              if (t.status === 'overdue' && t.dueDate) {
                const due = new Date(t.dueDate);
                return due >= startOfWeek && due <= endOfWeek;
              }
              if (t.status === 'pending' && t.dueDate) {
                const due = new Date(t.dueDate);
                return due >= nextWeekStart && due <= nextWeekEnd;
              }
              return false;
            });
          } catch (err) {
            filteredTasks = [];
          }
          totalCompleted += completed;
          totalOverdue += overdue;
          totalUpcoming += upcoming;
          return `
          <tr><td style="padding: 0 20px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
              <tr><td><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
                <td style="vertical-align: middle; width: 35px;">
                  <img src="https://app.allproperly.com/weekly/home.png" alt="home" width="28" style="max-width:100%; display:block; border:0; outline:none; text-decoration:none;">
                </td>
                <td style="vertical-align: middle;"><h2 style="margin: 0; font-size: 24px; font-weight: 700; color: #475567;">${property.name || property.address || 'Property'}</h2></td>
              </tr></table></td></tr>
              <tr><td style="padding-bottom: 5px;"><p style="margin: 0; font-size: 16px; color: #475567;">${property.address || ''}</p></td></tr>
              <tr><td style="padding-bottom: 10px; padding-left:15px;"><ul style="margin:8px 0 0 18px; padding:0; color:#475567; font-size:15px; line-height:22px;"><li>${completed} tasks completed this week</li><li>${overdue} overdue task</li><li>${upcoming} upcoming (next 7 days)</li></ul></td></tr>
              ${filteredTasks.map(task => {
                let dueLabel = '';
                if (task.dueDate) {
                  dueLabel = `due ${getDayName(task.dueDate)}`;
                }
                return `<tr><td style=\"padding-bottom: 8px;\"><p style=\"margin: 0; font-size: 15px; color: #475567; font-weight: 500;\">${task.title || task.name || 'Task'}${dueLabel ? ' — ' + dueLabel : ''}</p></td></tr>`;
              }).join('')}
              <tr><td style="text-align: right;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-left: auto;"><tr><td style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 20px;"><a href="https://app.allproperly.com/tasks" target="_blank" style="display: inline-block; color: #475567; text-decoration: none; font-size: 14px; font-weight: 600;">View All Tasks</a></td></tr></table></td></tr>
            </table>
          </td></tr>
          `;
        }));

        // Replace placeholders in template
        const personalizedHtml = weeklyEmailHtml
          .replace('{{completedTasks}}', totalCompleted)
          .replace('{{overdueTasks}}', totalOverdue)
          .replace('{{upcomingTasks}}', totalUpcoming)
          .replace('{{propertySections}}', propertySections.join(''));

        // Check email preferences and if there are relevant tasks before sending
        const emailPrefs = user.emailPreferences || {};
        const weeklyEmailsEnabled = emailPrefs.weeklyEmails !== false;
        const emailOverdue = user.email_overdue !== false;
        const emailTaskAdded = user.email_taskAdded !== false;
        const emailTaskCompleted = user.email_taskCompleted !== false;
        
        // Only send email if there are relevant tasks and email preferences allow it
        if ((totalCompleted > 0 || totalOverdue > 0 || totalUpcoming > 0) && weeklyEmailsEnabled && emailOverdue && emailTaskAdded && emailTaskCompleted) {
          await admin.firestore().collection('mail').add({
            to: user.email,
            subject: 'AllProperly Weekly Property Summary',
            text: 'Here is your weekly summary from AllProperly.',
            html: personalizedHtml,
            from: 'AllProperly Notifications <notify@allproperly.com>',
            headers: {
              'X-PM-Message-Stream': 'outbound'
            }
          });
        }
    }
  }
  console.log('Weekly emails processed for sending at UTC 04:00 (Sunday)');
  return null;
});
