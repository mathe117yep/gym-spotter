// When to suggest a deload week: enough weeks of hard training since the last one,
// plus signs of a plateau — or simply a long stretch without one.
import { exerciseSeries, toTime, todayIso, SQUAT, BENCH } from './stats.js';

const DAY = 86400000;
export const DELOAD_DAYS = 7;

const daysBetween = (a, b) => Math.round((toTime(b) - toTime(a)) / DAY);

export function deloadCheck({ workouts, deloads, goal, balance, joined, today = todayIso() }) {
  if (!workouts.length) return null;
  const last = [...deloads].sort((a, b) => a.started_on.localeCompare(b.started_on)).pop()?.started_on ?? null;
  if (last && daysBetween(last, today) < DELOAD_DAYS && last <= today) {
    return { active: true, day: daysBetween(last, today) + 1, last };
  }

  // The clock starts at the last deload, or when they started using the app — not the oldest
  // workout in a pasted history.
  const first = workouts.reduce((m, w) => (w.date < m ? w.date : m), workouts[0].date);
  const since = last ?? (joined && joined > first ? joined : first);
  const weeks = Math.floor(daysBetween(since, today) / 7);
  const minWeeks = goal === 'cut' ? 4 : 6;  // recovery is worse in a deficit
  const maxWeeks = goal === 'cut' ? 8 : 10;

  const reasons = [];
  for (const [k, name] of [[SQUAT, 'Squat'], [BENCH, 'Bench']]) {
    const s = exerciseSeries(workouts, k).filter(p => p.e1rm != null);
    const recent = s.filter(p => daysBetween(p.date, today) <= 21);
    const before = s.filter(p => daysBetween(p.date, today) > 21 && daysBetween(p.date, today) <= 63);
    if (recent.length >= 2 && before.length) {
      const now = Math.max(...recent.map(p => p.e1rm)), then = Math.max(...before.map(p => p.e1rm));
      if (now <= then) reasons.push(`${name} estimated max hasn't gone up in 3+ weeks`);
    }
  }
  const over = (balance?.muscles ?? []).filter(m => m.status === 'over').map(m => m.label.toLowerCase());
  if (over.length) reasons.push(`Training balance shows overreaching (${over.join(', ')})`);

  const due = weeks >= maxWeeks || (weeks >= minWeeks && reasons.length > 0);
  if (weeks >= maxWeeks) reasons.unshift(`${weeks} weeks of training since your ${last ? 'last deload' : 'first week on Gym Spotter'}`);
  return { active: false, due, weeks, since, last, reasons, minWeeks, maxWeeks };
}
