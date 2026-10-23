// "How did today compare?" — each exercise in a workout vs the last time it was done.
import { e1rm, key } from './stats.js';

const summarize = sets => {
  const weighted = sets.some(s => s.weight > 0);
  let best = null, bestSet = null;
  for (const s of sets) {
    const v = e1rm(s.weight, s.reps);
    if (v != null && (best == null || v > best)) { best = v; bestSet = s; }
  }
  const top = Math.max(...sets.map(s => s.weight));
  return {
    sets,
    weighted,
    best,
    bestSet,
    top,
    topReps: Math.max(...sets.filter(s => s.weight === top).map(s => s.reps)),
    maxReps: Math.max(...sets.map(s => s.reps)),
    totalReps: sets.reduce((n, s) => n + s.reps, 0),
    volume: sets.reduce((n, s) => n + s.weight * s.reps, 0),
  };
};

const pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);

// Verdict for one exercise: 'pr' | 'up' | 'same' | 'down', plus the main line explaining why.
function judge(now, prev, priorBest) {
  if (now.weighted && now.best != null && prev.best != null) {
    const diff = now.best - prev.best;
    if (priorBest != null && now.best > priorBest + 0.5) return { verdict: 'pr', diff };
    if (diff >= 1) return { verdict: 'up', diff };
    if (diff <= -1) return { verdict: 'down', diff };
    const v = pct(now.volume, prev.volume);
    return { verdict: v > 5 ? 'up' : v < -5 ? 'down' : 'same', diff, byVolume: true };
  }
  if (now.weighted) {
    // Every set was high-rep: compare the heaviest weight, then reps at it.
    if (now.top !== prev.top) return { verdict: now.top > prev.top ? 'up' : 'down', byTop: true };
    const r = now.topReps - prev.topReps;
    return { verdict: r > 0 ? 'up' : r < 0 ? 'down' : 'same', byTop: true };
  }
  // Bodyweight: best set's reps, then total reps.
  const r = now.maxReps - prev.maxReps;
  if (r) return { verdict: r > 0 ? 'up' : 'down', byReps: true };
  const t = now.totalReps - prev.totalReps;
  return { verdict: t > 0 ? 'up' : t < 0 ? 'down' : 'same', byReps: true };
}

export function compareWorkout(workout, allWorkouts) {
  const earlier = allWorkouts.filter(w => w.date < workout.date).sort((a, b) => b.date.localeCompare(a.date));
  const exercises = workout.exercises.map(ex => {
    const k = key(ex.name);
    const now = summarize(ex.sets);
    const last = earlier.find(w => w.exercises.some(e => key(e.name) === k));
    if (!last) return { name: ex.name, verdict: 'new', now };
    const prev = summarize(last.exercises.filter(e => key(e.name) === k).flatMap(e => e.sets));
    let priorBest = null;
    for (const w of earlier) {
      for (const e of w.exercises) {
        if (key(e.name) !== k) continue;
        for (const s of e.sets) { const v = e1rm(s.weight, s.reps); if (v != null && (priorBest == null || v > priorBest)) priorBest = v; }
      }
    }
    return { name: ex.name, lastDate: last.date, now, prev, priorBest, ...judge(now, prev, priorBest) };
  });
  const count = v => exercises.filter(e => e.verdict === v).length;
  return { date: workout.date, exercises, up: count('up') + count('pr'), prs: count('pr'), down: count('down'), same: count('same'), fresh: count('new') };
}
