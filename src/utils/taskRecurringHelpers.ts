// Shared helpers for recurring task instance logic (used by onboarding and dashboard)
export type TaskTemplate = {
  title: string;
  type: string;
  description: string;
  startDate: string;
  dueDate: string;
  frequency?: string;
  interval?: string;
  propertyId?: string | null;
  assigned_user?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  inventory?: string;
};

// Helper: Parse '1-Mar' to 'YYYY-03-01' for this year
export function parseDayMonth(str: string): string {
  if (!str) return '';
  const [day, mon] = str.split('-');
  const months: { [key: string]: string } = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };
  const month: string | undefined = months[mon];
  if (!month) return '';
  const year = new Date().getFullYear();
  const dayPadded = day.padStart(2, '0');
  return `${year}-${month}-${dayPadded}`;
}

// Generate recurring instances for a template (same as onboarding logic)
export function getRecurringInstances(template: TaskTemplate, today: Date = new Date()): TaskTemplate[] {
  const results: TaskTemplate[] = [];
  let freq = (template.frequency || '').toLowerCase();
  // Use US Central Time (America/Chicago) for 'today'
  function getUsToday() {
    const now = new Date();
    // Convert to US Central Time (UTC-6 or UTC-5 DST)
    const usDateStr = now.toLocaleString('en-US', { timeZone: 'America/Chicago' });
    return new Date(usDateStr);
  }
  function addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
  function addMonths(date: Date, months: number) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }
  let usToday = getUsToday();
  if (freq === 'weekly') {
    // startDate = yesterday (US), dueDate = yesterday + 7 days
    const startDate = addDays(usToday, 0);
    const dueDate = addDays(startDate, 7);
    results.push({
      ...template,
      startDate: startDate.toISOString().slice(0,10),
      dueDate: dueDate.toISOString().slice(0,10)
    });
  } else if (freq === 'monthly') {
    // startDate = yesterday (US), dueDate = yesterday + 1 month
    const startDate = addDays(usToday, 0);
    const dueDate = addMonths(startDate, 1);
    results.push({
      ...template,
      startDate: startDate.toISOString().slice(0,10),
      dueDate: dueDate.toISOString().slice(0,10)
    });
  } else if (freq === 'quarterly') {
    // Generate 5 future quarterly instances from template's startDate
    const [startDay, startMon] = (template.startDate || '').split('-');
    const [dueDay, dueMon] = (template.dueDate || '').split('-');
    const months: { [key: string]: number } = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    let baseMonth = months[startMon as keyof typeof months];
    let baseDay = parseInt(startDay, 10);
    let baseDueMonth = months[dueMon as keyof typeof months];
    let baseDueDay = parseInt(dueDay, 10);
    let startYear = today.getFullYear();
    for (let i = 0; i < 5; i++) {
      let instMonth = baseMonth + i * 3;
      let instYear = startYear + Math.floor(instMonth / 12);
      instMonth = instMonth % 12;
      let startDate = new Date(instYear, instMonth, baseDay);
      let dueDateDay = baseDueDay;
      let lastDay = new Date(instYear, baseDueMonth + i * 3 + 1, 0).getDate();
      if (dueDateDay > lastDay) dueDateDay = lastDay;
      let dueMonth = baseDueMonth + i * 3;
      let dueYear = startYear + Math.floor(dueMonth / 12);
      dueMonth = dueMonth % 12;
      let dueDate = new Date(dueYear, dueMonth, dueDateDay);
      results.push({
        ...template,
        startDate: startDate.toISOString().slice(0,10),
        dueDate: dueDate.toISOString().slice(0,10)
      });
    }
  } else if (freq === 'yearly') {
    // Generate 2 future yearly instances from template's startDate
    const [startDay, startMon] = (template.startDate || '').split('-');
    const [dueDay, dueMon] = (template.dueDate || '').split('-');
    const months: { [key: string]: number } = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    let baseMonth = months[startMon as keyof typeof months];
    let baseDay = parseInt(startDay, 10);
    let baseDueMonth = months[dueMon as keyof typeof months];
    let baseDueDay = parseInt(dueDay, 10);
    let startYear = today.getFullYear();
    for (let i = 0; i < 2; i++) {
      let instYear = startYear + i;
      let startDate = new Date(instYear, baseMonth, baseDay);
      let dueDate = new Date(instYear, baseDueMonth, baseDueDay);
      results.push({
        ...template,
        startDate: startDate.toISOString().slice(0,10),
        dueDate: dueDate.toISOString().slice(0,10)
      });
    }
  } else {
    // Non-recurring: just one instance, parse as before
    return [{
      ...template,
      startDate: parseDayMonth(template.startDate),
      dueDate: parseDayMonth(template.dueDate)
    }];
  }
  return results;
}

// For a list of templates, return the next instance for each unique (title|type)
export function getNextUniqueTasks(templates: TaskTemplate[], today: Date = new Date()): TaskTemplate[] {
  const nextTasks: TaskTemplate[] = [];
  const seen = new Set();
  function toMidnight(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  // Use yesterday's date at midnight to avoid timezone/UTC issues
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 3);
  const yesterdayMidnight = toMidnight(yesterday);
  for (const template of templates) {
    const key = template.title + '|' + template.type;
    if (seen.has(key)) continue;
    seen.add(key);
    const instances = getRecurringInstances(template, today).filter(inst => {
      const instDate = toMidnight(new Date(inst.dueDate));
      return instDate > yesterdayMidnight;
    });
    if (instances.length > 0) {
      instances.sort((a, b) => (new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
      // Add +1 day to startDate and dueDate
      const task = { ...instances[0] };
      const start = new Date(task.startDate);
      start.setDate(start.getDate() + 1);
      task.startDate = start.toISOString().slice(0, 10);
      const due = new Date(task.dueDate);
      due.setDate(due.getDate() + 1);
      task.dueDate = due.toISOString().slice(0, 10);
      nextTasks.push(task);
    }
  }
  return nextTasks;
}