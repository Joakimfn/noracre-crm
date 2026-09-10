// Datetime-local values use the same local clock as the followup input.
export function reminderIsDue(activity: { dueAt: string; completedAt: string }, now: number) {
  if (activity.completedAt || activity.dueAt.length < 16) return false;
  const due = new Date(activity.dueAt).getTime();
  return Number.isFinite(due) && now >= due - 15 * 60_000 && now < due;
}
