// Number crunching for dashboards. Workouts look like
// { id, date: 'YYYY-MM-DD', exercises: [{ name, sets: [{ weight, reps, note }] }] }.

export const SQUAT = 'squat';
export const BENCH = 'bench press';
const MAX_REPS_FOR_E1RM = 12;

export const key = name => name.trim().toLowerCase();

// Epley estimate. A single is taken as-is; sets above 12 reps are too noisy to count.
export function e1rm(weight, reps) {
  if (weight <= 0 || reps <= 0 || reps > MAX_REPS_FOR_E1RM) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export function toTime(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysAgo(iso) {
  return Math.round((toTime(todayIso()) - toTime(iso)) / 86400000);
}

export function sortByDate(workouts) {
  return [...workouts].sort((a, b) => b.date.localeCompare(a.date));
}

// One point per workout: the best value from that workout's sets of the exercise.
export function exerciseSeries(workouts, exerciseKey) {
  const points = [];
  for (const w of workouts) {
    const sets = w.exercises.filter(e => key(e.name) === exerciseKey).flatMap(e => e.sets);
    if (!sets.length) continue;
    let best = null, top = 0, reps = 0, bestSet = null;
    for (const s of sets) {
      const v = e1rm(s.weight, s.reps);
      if (v != null && (best == null || v > best)) { best = v; bestSet = s; }
      top = Math.max(top, s.weight);
      reps = Math.max(reps, s.reps);
    }
    points.push({ date: w.date, e1rm: best, top, reps, bestSet });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

// Headline lift number: best estimate in the last 90 days, plus the all-time best.
export function liftSummary(workouts, exerciseKey) {
  const series = exerciseSeries(workouts, exerciseKey).filter(p => p.e1rm != null);
  if (!series.length) return null;
  const allTime = series.reduce((a, b) => (b.e1rm > a.e1rm ? b : a));
  const recent = series.filter(p => daysAgo(p.date) <= 90);
  const current = recent.length ? recent.reduce((a, b) => (b.e1rm > a.e1rm ? b : a)) : null;
  return { current, allTime, series };
}

// Best performance per exercise, most recently trained first.
export function personalRecords(workouts) {
  const map = new Map();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const k = key(ex.name);
      const rec = map.get(k) || { name: ex.name, best: null, bestDate: null, maxReps: 0, repsDate: null, top: 0, last: w.date, sessions: 0 };
      rec.sessions++;
      if (w.date > rec.last) { rec.last = w.date; rec.name = ex.name; }
      for (const s of ex.sets) {
        const v = e1rm(s.weight, s.reps);
        if (v != null && (rec.best == null || v > rec.best)) { rec.best = v; rec.bestDate = w.date; rec.bestSet = s; }
        if (s.reps > rec.maxReps) { rec.maxReps = s.reps; rec.repsDate = w.date; }
        rec.top = Math.max(rec.top, s.weight);
      }
      map.set(k, rec);
    }
  }
  return [...map.values()].sort((a, b) => b.last.localeCompare(a.last) || b.sessions - a.sessions);
}

function weekStart(iso) {
  const d = new Date(toTime(iso));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.getTime();
}

// Last `weeks` weeks of workouts count and total volume (weight x reps).
export function weeklySummary(workouts, weeks = 12) {
  const thisWeek = weekStart(todayIso());
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - i * 7);
    buckets.push({ start: d.getTime(), workouts: 0, volume: 0 });
  }
  const byStart = new Map(buckets.map(b => [b.start, b]));
  for (const w of workouts) {
    const b = byStart.get(weekStart(w.date));
    if (!b) continue;
    b.workouts++;
    for (const ex of w.exercises) for (const s of ex.sets) b.volume += s.weight * s.reps;
  }
  return buckets;
}

// Body weights sorted oldest -> newest, each with a trailing 7-day average.
export function weightTrend(bodyweights) {
  const sorted = [...bodyweights].sort((a, b) => a.logged_on.localeCompare(b.logged_on));
  return sorted.map(bw => {
    const t = toTime(bw.logged_on);
    const window = sorted.filter(o => { const ot = toTime(o.logged_on); return ot <= t && ot > t - 7 * 86400000; });
    const avg = window.reduce((s, o) => s + Number(o.weight), 0) / window.length;
    return { date: bw.logged_on, weight: Number(bw.weight), avg };
  });
}

export function weightSummary(bodyweights) {
  const trend = weightTrend(bodyweights);
  if (!trend.length) return null;
  const latest = trend[trend.length - 1];
  const monthAgo = trend.filter(p => daysAgo(p.date) >= 30).pop();
  return { latest, change30: monthAgo ? latest.avg - monthAgo.avg : null, trend };
}

export function round(n) { return n == null ? null : Math.round(n); }
