// The crew side of the app: weekly leaderboard and the activity timeline.
import { key, weekStart, todayIso, toTime, SQUAT, BENCH } from './stats.js';
import { compareWorkout } from './compare.js';
import { MUSCLE_LABEL } from './muscles.js';
import { GOALS, planSummary } from './coach.js';

const DAY = 86400000;
const PUSH = ['chest', 'front_delts', 'side_delts', 'triceps'];
const PULL = ['lats', 'upper_back', 'rear_delts', 'biceps'];
const LEGS = ['quads', 'hamstrings', 'glutes', 'calves'];

function addDays(ms, n) {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}
const isoOf = ms => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// "Push" / "Pull" / "Legs" / "Upper" / "Full body", from the muscles the workout hit.
export function workoutType(workout, match) {
  const sets = {};
  for (const ex of workout.exercises) {
    const m = match(ex.name);
    if (!m) continue;
    for (const id of m.primary) sets[id] = (sets[id] ?? 0) + ex.sets.length;
    for (const id of m.secondary) sets[id] = (sets[id] ?? 0) + ex.sets.length * 0.5;
  }
  const sum = ids => ids.reduce((a, id) => a + (sets[id] ?? 0), 0);
  const push = sum(PUSH), pull = sum(PULL), legs = sum(LEGS), upper = push + pull, total = upper + legs;
  const top = Object.entries(sets).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => MUSCLE_LABEL[id].toLowerCase());
  let type;
  if (!total) type = sets.abs ? 'Core' : '';
  else if (legs / total >= 0.7) type = 'Legs';
  else if (legs / total >= 0.25) type = 'Full body';
  else if (push / upper >= 0.7) type = 'Push';
  else if (pull / upper >= 0.7) type = 'Pull';
  else type = 'Upper';
  return { type, top };
}

// One exercise's change vs last time, as a fraction. Reps changes are turned into the same
// scale as an estimated max (Epley's 1 + reps/30) so +2 reps doesn't swamp +5 lb on bench.
const repFactor = r => 1 + r / 30;
function exerciseGrowth(e) {
  if (e.verdict === 'new') return null;
  const { now, prev } = e;
  let g = null;
  if (now.best != null && prev.best != null) g = (now.best - prev.best) / prev.best;
  else if (now.weighted && prev.weighted) {
    g = now.top !== prev.top ? (now.top - prev.top) / prev.top : repFactor(now.topReps) / repFactor(prev.topReps) - 1;
  } else if (!now.weighted && !prev.weighted) g = repFactor(now.maxReps) / repFactor(prev.maxReps) - 1;
  return g == null ? null : Math.max(-0.25, Math.min(0.25, g));
}

// Volume and growth for every profile for the Monday–Sunday week starting at `start`.
export function weekBoard(profiles, allWorkouts, start) {
  const end = addDays(start, 7);
  return profiles.map(p => {
    const mine = allWorkouts.filter(w => w.user_id === p.id);
    const week = mine.filter(w => toTime(w.date) >= start && toTime(w.date) < end);
    let volume = 0;
    const changes = [];
    for (const w of week) {
      for (const ex of w.exercises) for (const s of ex.sets) volume += s.weight * s.reps;
      for (const e of compareWorkout(w, mine).exercises) {
        const g = exerciseGrowth(e);
        if (g != null) changes.push(g);
      }
    }
    const growth = changes.length ? (changes.reduce((a, b) => a + b, 0) / changes.length) * 100 : null;
    return { profile: p, workouts: week.length, volume, growth, compared: changes.length };
  });
}

export function leaderboard(profiles, allWorkouts, today = todayIso()) {
  const thisWeek = weekStart(today);
  const rank = (rows, field) => rows.filter(r => r[field] != null && (field !== 'volume' || r.volume > 0))
    .sort((a, b) => b[field] - a[field]);
  const now = weekBoard(profiles, allWorkouts, thisWeek);
  const last = weekBoard(profiles, allWorkouts, addDays(thisWeek, -7));
  return {
    volume: rank(now, 'volume'), growth: rank(now, 'growth'), all: now,
    lastVolume: rank(last, 'volume')[0] ?? null, lastGrowth: rank(last, 'growth')[0] ?? null,
  };
}

// Everything the crew did recently, newest first.
export function timeline({ profiles, allWorkouts, plans, bodyweights, deloads, match, today = todayIso(), days = 30 }) {
  const since = isoOf(toTime(today) - days * DAY);
  const byId = new Map(profiles.map(p => [p.id, p]));
  const events = [];
  const add = (p, date, kind, text, extra = {}) => { if (p && date >= since && date <= today) events.push({ profile: p, date, kind, text, ...extra }); };

  for (const p of profiles) {
    const mine = allWorkouts.filter(w => w.user_id === p.id).sort((a, b) => a.date.localeCompare(b.date));
    const bests = { [SQUAT]: 0, [BENCH]: 0 };
    for (const w of mine) {
      // Tested maxes: a single heavier than any single before it.
      const maxes = [];
      for (const k of [SQUAT, BENCH]) {
        const singles = w.exercises.filter(e => key(e.name) === k).flatMap(e => e.sets).filter(s => s.reps === 1 && s.weight > 0);
        const top = Math.max(0, ...singles.map(s => s.weight));
        if (top > bests[k]) { maxes.push({ lift: k === SQUAT ? 'squat' : 'bench', weight: top }); bests[k] = top; }
      }
      if (w.date < since) continue;
      const { type, top } = workoutType(w, match);
      const prs = compareWorkout(w, mine).exercises.filter(e => e.verdict === 'pr').map(e => e.name);
      add(p, w.date, 'workout', `logged ${type ? `a ${type.toLowerCase()} workout` : 'a workout'}`, {
        sub: top.length ? top.join(', ') : `${w.exercises.length} exercises`, prs, at: w.created_at, workoutId: w.id,
      });
      for (const m of maxes) add(p, w.date, 'max', `hit a ${m.weight} lb ${m.lift} max 🏆`, { workoutId: w.id, at: w.created_at });
    }
    if (p.goal && p.goal_started_on) add(p, p.goal_started_on, 'plan', `started a ${GOALS[p.goal].label.toLowerCase()}`);
  }

  for (const plan of plans) {
    const p = byId.get(plan.user_id);
    if (!p) continue;
    const s = planSummary(plan, bodyweights.filter(b => b.user_id === p.id), allWorkouts.filter(w => w.user_id === p.id));
    const weeks = Math.max(1, Math.round(s.weeks));
    const change = s.change != null ? ` (${s.change >= 0 ? '+' : '−'}${Math.round(Math.abs(s.change) * 10) / 10} lb)` : '';
    add(p, plan.ended_on, 'plan', `finished a ${weeks}-week ${GOALS[plan.goal].label.toLowerCase()}${change}`);
    add(p, plan.started_on, 'plan', `started a ${GOALS[plan.goal].label.toLowerCase()}`);
  }
  for (const d of deloads) add(byId.get(d.user_id), d.started_on, 'deload', 'started a deload week');

  // Weekly winners, posted on the Sunday each week ends.
  const thisWeek = weekStart(today);
  for (let k = 1; k <= Math.ceil(days / 7); k++) {
    const start = addDays(thisWeek, -7 * k);
    const sunday = isoOf(addDays(start, 6));
    const board = weekBoard(profiles, allWorkouts, start);
    const vol = board.filter(r => r.volume > 0).sort((a, b) => b.volume - a.volume)[0];
    const gro = board.filter(r => r.growth != null).sort((a, b) => b.growth - a.growth)[0];
    if (vol) add(vol.profile, sunday, 'win', `won the week for volume 🥇`, { sub: `${Math.round(vol.volume).toLocaleString()} lb` });
    if (gro) add(gro.profile, sunday, 'win', `won the week for growth 📈`, { sub: `${gro.growth >= 0 ? '+' : ''}${gro.growth.toFixed(1)}% vs last time` });
  }

  const order = { win: 0, max: 1, plan: 2, deload: 3, workout: 4 };
  return events.sort((a, b) => b.date.localeCompare(a.date) || (b.at ?? '').localeCompare(a.at ?? '') || order[a.kind] - order[b.kind]);
}
