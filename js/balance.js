// Training balance: hard sets per muscle per week, and whether each muscle is
// undertrained, on track or overreaching (adjusted for bulk / cut / recomp).
import { e1rm, key as exKey, todayIso, weekStart, toTime } from './stats.js';
import { MUSCLES } from './muscles.js';

const DAY = 86400000;
const WEEKS = 8;
const WARMUP = 0.6;     // sets under 60% of the exercise's recent best e1RM are warm-ups
const MAX_REPS = 30;    // beyond this it's not a hard set
const HEAVY = 0.85;     // a top set at 85%+ of e1RM counts as a heavy session
const JUMP = 1.3;       // weekly sets up 30% on the prior 4-week average

// Baseline weekly set targets (recomp). Front delts get lots of pressing work already;
// forearms get trained by every pull, so they're counted but not rated.
const BASE = { front_delts: [6, 14], abs: [8, 16], calves: [8, 16], forearms: null };
const DEFAULT_RANGE = [10, 20];
// Bulking supports more volume; cutting recovers worse, so less.
const SKEW = { bulk: [2, 2], recomp: [0, 0], cut: [-2, -4] };

function addDays(ms, n) {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function targetsFor(muscle, goal, overrides) {
  let lo, hi, custom = false;
  if (overrides?.[muscle]) { [lo, hi] = overrides[muscle]; custom = true; }
  else {
    const base = muscle in BASE ? BASE[muscle] : DEFAULT_RANGE;
    if (!base) return null;
    const [dl, dh] = SKEW[goal] ?? [0, 0];
    lo = Math.max(2, base[0] + dl);
    hi = Math.max(lo + 2, base[1] + dh);
  }
  return { lo, hi, under: lo - 2, high: hi + 2, custom };
}

const r1 = n => Math.round(n * 10) / 10;

export function analyzeBalance({ workouts, goal, overrides, match, deloads = [], today = todayIso() }) {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const thisWeek = weekStart(today);
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(thisWeek, -7 * (WEEKS - 1 - i)));
  const weekIdx = new Map(weeks.map((w, i) => [w, i]));
  const cutting = goal === 'cut';

  // Best e1RM per exercise per session, to spot warm-ups and heavy sets.
  const history = new Map(); // exercise key -> [{ t, best }]
  for (const w of sorted) {
    for (const ex of w.exercises) {
      const best = Math.max(0, ...ex.sets.map(s => e1rm(s.weight, s.reps) ?? 0));
      if (!best) continue;
      const k = exKey(ex.name);
      if (!history.has(k)) history.set(k, []);
      history.get(k).push({ t: toTime(w.date), best });
    }
  }
  const best90 = (k, date) => {
    const t = toTime(date);
    let best = 0;
    for (const h of history.get(k) ?? []) if (h.t <= t && h.t > t - 90 * DAY) best = Math.max(best, h.best);
    return best || null;
  };

  const stats = Object.fromEntries(MUSCLES.map(m => [m.id, {
    sets: Array(WEEKS).fill(0), sessions: Array(WEEKS).fill(0), heavy: [], exercises: new Map(),
  }]));
  const workoutsPerWeek = Array(WEEKS).fill(0);
  const unmapped = new Map(); // name -> times seen

  for (const w of sorted) {
    const wi = weekIdx.get(weekStart(w.date));
    if (wi == null) continue;
    workoutsPerWeek[wi]++;
    const hit = {};
    const heavyHit = new Set();
    for (const ex of w.exercises) {
      const m = match(ex.name);
      if (!m) { unmapped.set(ex.name, (unmapped.get(ex.name) ?? 0) + 1); continue; }
      const best = best90(exKey(ex.name), w.date);
      const hard = ex.sets.filter(s => s.reps <= MAX_REPS && !(s.weight > 0 && best && s.weight < WARMUP * best));
      if (!hard.length) continue;
      const isHeavy = best && hard.some(s => s.weight >= HEAVY * best);
      const credit = (id, per) => {
        hit[id] = (hit[id] ?? 0) + hard.length * per;
        const e = stats[id].exercises;
        if (wi >= WEEKS - 2) e.set(ex.name, (e.get(ex.name) ?? 0) + hard.length * per);
      };
      for (const id of m.primary) { credit(id, 1); if (isHeavy) heavyHit.add(id); }
      for (const id of m.secondary) credit(id, 0.5);
    }
    for (const [id, v] of Object.entries(hit)) {
      const st = stats[id];
      if (!st) continue;
      st.sets[wi] += v;
      if (v >= 1) st.sessions[wi]++;
    }
    for (const id of heavyHit) stats[id]?.heavy.push(w.date);
  }

  // Completed weeks with 2+ workouts; break weeks (travel, time off) and deload weeks are skipped.
  const deloadWeeks = new Set(deloads.map(d => weekStart(d.started_on)));
  const valid = i => workoutsPerWeek[i] >= 2 && !deloadWeeks.has(weeks[i]);
  const lastIdx = [...Array(WEEKS - 1).keys()].reverse().find(valid);
  const prevIdx = lastIdx != null && lastIdx > 0 && valid(lastIdx - 1) ? lastIdx - 1 : null;

  const muscles = MUSCLES.map(({ id, label }) => {
    const st = stats[id];
    const t = targetsFor(id, goal, overrides);
    const flags = [];
    const out = { id, label, targets: t, sets: st.sets.map(r1), sessions: st.sessions, flags,
      exercises: [...st.exercises].sort((a, b) => b[1] - a[1]).map(([name, sets]) => ({ name, sets: r1(sets) })) };

    // Stacked: two heavy sessions for this muscle less than 48 hours apart, in the last two weeks.
    // Workouts only carry a date, so that means back-to-back days (Mon/Wed is a normal split).
    const recentHeavy = [...new Set(st.heavy)].filter(d => toTime(d) >= addDays(thisWeek, -7)).sort();
    for (let i = 1; i < recentHeavy.length; i++) {
      if (Math.round((toTime(recentHeavy[i]) - toTime(recentHeavy[i - 1])) / DAY) <= 1) {
        flags.push({ kind: 'stacked', text: `Heavy sessions on ${shortDay(recentHeavy[i - 1])} and ${shortDay(recentHeavy[i])} — back-to-back days` });
        break;
      }
    }

    if (lastIdx == null) return { ...out, status: 'none', reason: 'Needs a full week with 2+ workouts before rating.' };
    const last = st.sets[lastIdx], prev = prevIdx != null ? st.sets[prevIdx] : null;

    if (prevIdx != null && st.sessions[lastIdx] === 1 && st.sessions[prevIdx] === 1) {
      flags.push({ kind: 'frequency', text: 'Only hit once a week for 2 weeks — splitting it over 2 sessions usually works better.' });
    }
    if (!t) return { ...out, status: 'info', reason: `${r1(last)} sets last week. Not rated — forearms get plenty from pulling and grip work.` };

    const range = `${t.lo}–${t.hi}`;
    const main = mainLift(sorted, id, match, today);
    const trend = main ? liftTrend(main.series, cutting) : null;

    if (last > t.high) {
      const avg4 = average([1, 2, 3, 4].map(k => lastIdx - k).filter(i => i >= 0 && valid(i)).map(i => st.sets[i]));
      const reasons = [];
      if (trend?.declining) reasons.push(`${main.name} est. 1RM is down vs its 4-week best`);
      if (trend?.repsDropping) reasons.push(`reps at ${trend.repsWeight} lb on ${main.name} keep dropping`);
      if (avg4 && last > JUMP * avg4) reasons.push(`sets jumped ${Math.round((last / avg4 - 1) * 100)}% over your 4-week average`);
      if (reasons.length) {
        return { ...out, status: 'over', reason: `${r1(last)} sets last week (target ${range}) and ${reasons.join('; ')}.${cutting ? ' On a cut, pull volume back a bit.' : ' Consider a lighter week.'}` };
      }
      return { ...out, status: 'ok', reason: `High volume — ${r1(last)} sets last week (target ${range}) — but ${trend?.improving ? `${main.name} is still climbing` : 'performance is holding'}.` };
    }
    if (prev != null && last < t.under && prev < t.under) {
      const none = prev === 0 && last === 0;
      return { ...out, status: 'under', reason: none
        ? `No direct work the last 2 weeks — aim for ${range} sets a week.`
        : `Only ${r1(prev)} and ${r1(last)} sets the last 2 weeks — aim for ${range}.` };
    }
    if (last < t.lo) return { ...out, status: 'low', reason: `${r1(last)} sets last week — a bit under the ${range} target.` };
    if (last > t.hi) return { ...out, status: 'ok', reason: `${r1(last)} sets last week — upper end of the ${range} target.` };
    return { ...out, status: 'ok', reason: `${r1(last)} sets last week — right in the ${range} target.` };
  });

  return { weeks, workoutsPerWeek, lastIdx, muscles, unmapped: [...unmapped.keys()] };
}

const average = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const shortDay = iso => new Date(toTime(iso)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// The exercise that trains this muscle directly with the most sets in the last 4 weeks.
function mainLift(workouts, muscle, match, today) {
  const since = toTime(today) - 28 * DAY;
  const counts = new Map();
  for (const w of workouts) {
    if (toTime(w.date) < since) continue;
    for (const ex of w.exercises) {
      const m = match(ex.name);
      if (m?.primary.includes(muscle) && ex.sets.some(s => s.weight > 0)) counts.set(exKey(ex.name), (counts.get(exKey(ex.name)) ?? 0) + ex.sets.length);
    }
  }
  if (!counts.size) return null;
  const [k] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const series = [];
  let name = k;
  for (const w of workouts) {
    if (toTime(w.date) < since) continue;
    const sets = w.exercises.filter(e => exKey(e.name) === k).flatMap(e => { name = e.name; return e.sets; });
    if (!sets.length) continue;
    const best = Math.max(0, ...sets.map(s => e1rm(s.weight, s.reps) ?? 0));
    const topWeight = Math.max(...sets.map(s => s.weight));
    const topReps = Math.max(...sets.filter(s => s.weight === topWeight).map(s => s.reps));
    series.push({ date: w.date, best, topWeight, topReps });
  }
  return { name, series };
}

// Is the main lift slipping? On a cut, one bad session counts; otherwise two in a row.
function liftTrend(series, cutting) {
  const n = cutting ? 1 : 2;
  const s = series.filter(p => p.best > 0);
  const out = { declining: false, repsDropping: false, improving: false };
  if (s.length < n + 1) return out;
  const before = s.slice(0, -n), recent = s.slice(-n);
  const best4 = Math.max(...before.map(p => p.best));
  out.declining = recent.every(p => p.best < best4 * 0.99);
  out.improving = s[s.length - 1].best >= best4;
  const tail = s.slice(-(n + 1));
  if (tail.every(p => p.topWeight === tail[0].topWeight) && tail.every((p, i) => i === 0 || p.topReps < tail[i - 1].topReps)) {
    out.repsDropping = true;
    out.repsWeight = tail[0].topWeight;
  }
  return out;
}
