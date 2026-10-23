// Feedback on weigh-ins for the body composition goal picked on the Plan tab.
// Rates are % of body weight per week, the standard way to pace a bulk or cut so
// you keep (or build) as much muscle as possible.
import { weekStart, toTime } from './stats.js';

export const GOALS = {
  bulk: {
    label: 'Bulk',
    blurb: 'Build muscle while keeping fat gain low.',
    min: 0.25, max: 0.5,
    target: 'gain 0.25–0.5% of body weight per week',
  },
  cut: {
    label: 'Cut',
    blurb: 'Lose fat while holding on to muscle.',
    min: -1.0, max: -0.5,
    target: 'lose 0.5–1% of body weight per week',
  },
  recomp: {
    label: 'Recomp',
    blurb: 'Hold weight steady while trading fat for muscle.',
    min: -0.25, max: 0.25,
    target: 'stay within ±0.25% of body weight per week',
  },
};

const DAY = 86400000;
const BIG_SWING = 1.5; // lb in a day; beyond this it's almost all water, salt and food
const r1 = n => Math.round(n * 10) / 10;
const signed = n => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${r1(Math.abs(n))}`;

function addDays(ms, n) {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

const byDate = bws => [...bws].map(b => ({ date: b.logged_on, weight: Number(b.weight) })).sort((a, b) => a.date.localeCompare(b.date));
const avg = list => list.reduce((s, b) => s + b.weight, 0) / list.length;

// Target change in lb/week for someone at `weight`, e.g. "+0.5 to +1.0 lb".
export function targetRange(goal, weight) {
  const g = GOALS[goal];
  const lo = (g.min * weight) / 100, hi = (g.max * weight) / 100;
  if (goal === 'recomp') return `within ±${r1(hi)} lb`;
  return goal === 'cut' ? `${signed(hi)} to ${signed(lo)} lb` : `${signed(lo)} to ${signed(hi)} lb`;
}

// One or two sentences after a weigh-in, comparing it to the previous one.
export function dailyRemark(goal, bodyweights, date) {
  const list = byDate(bodyweights);
  const i = list.findIndex(b => b.date === date);
  if (i < 0) return null;
  if (!goal) return { tone: 'neutral', text: 'Pick a goal on the Plan tab and you\'ll get feedback on every weigh-in.' };
  if (i === 0) return { tone: 'neutral', text: 'First weigh-in logged. Feedback starts with your next one.' };

  const today = list[i], prev = list[i - 1];
  const diff = r1(today.weight - prev.weight);
  const gap = Math.round((toTime(today.date) - toTime(prev.date)) / DAY);
  const since = gap === 1 ? 'from yesterday' : `since ${gap} days ago`;
  const change = diff === 0 ? `Same as ${gap === 1 ? 'yesterday' : 'last time'}.` : `${diff > 0 ? 'Up' : 'Down'} ${r1(Math.abs(diff))} lb ${since}.`;
  const big = Math.abs(diff) >= BIG_SWING;
  let tone = 'neutral', note;

  if (big) {
    note = `A swing that big is mostly water, salt and food — not ${diff > 0 ? 'fat or muscle' : 'real fat loss'}. Don't react to one day; Monday's weekly average tells the real story.`;
  } else if (goal === 'bulk') {
    if (diff > 0) { tone = 'good'; note = 'Moving the right way for your bulk.'; }
    else if (diff === 0) note = 'Holding steady. One flat day is fine — watch the weekly average.';
    else note = 'Normal day-to-day dip. Keep eating; the weekly average is what counts.';
  } else if (goal === 'cut') {
    if (diff < 0) { tone = 'good'; note = 'Moving the right way for your cut.'; }
    else if (diff === 0) note = 'Holding steady. One flat day is fine — watch the weekly average.';
    else note = 'Normal day-to-day bump (water and food). Stay the course.';
  } else {
    if (Math.abs(diff) <= 0.6) { tone = 'good'; note = 'Right around maintenance — exactly where a recomp should sit.'; }
    else note = 'A small drift — fine as long as the weekly average stays steady.';
  }

  // Smoothed trend: today's 7-day average vs the 7-day average a week ago.
  const weekAvg = end => {
    const from = addDays(toTime(end), -6);
    const w = list.filter(b => toTime(b.date) >= from && b.date <= end);
    return w.length >= 3 ? avg(w) : null;
  };
  const weekAgo = new Date(addDays(toTime(today.date), -7));
  const weekAgoIso = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
  const nowAvg = weekAvg(today.date), thenAvg = weekAvg(weekAgoIso);
  let trend = '';
  if (nowAvg != null && thenAvg != null) {
    const pct = ((nowAvg - thenAvg) / thenAvg) * 100;
    const g = GOALS[goal];
    // Above the range means "gaining more" — too fast on a bulk, too slow on a cut.
    const above = { bulk: 'faster than your target', cut: 'slower than your target', recomp: 'drifting up' }[goal];
    const below = { bulk: 'slower than your target', cut: 'faster than your target', recomp: 'drifting down' }[goal];
    const wrongWay = (goal === 'bulk' && pct <= 0) || (goal === 'cut' && pct >= 0);
    const where = wrongWay ? 'moving the wrong way for your goal' : pct > g.max ? above : pct < g.min ? below : 'right on target';
    trend = ` Your 7-day average is ${signed(nowAvg - thenAvg)} lb over the past week — ${where}.`;
  }
  return { tone, text: `${change} ${note}${trend}` };
}

function judge(goal, pct) {
  if (goal === 'bulk') {
    if (pct > 0.5) return { status: 'warn', headline: 'Gaining too fast', advice: 'More than ~0.5% a week is mostly extra fat, not extra muscle. Trim about 200–300 calories a day.' };
    if (pct >= 0.25) return { status: 'good', headline: 'Right on track', advice: 'This is the sweet spot for building muscle with minimal fat. Keep eating and keep pushing your lifts.' };
    if (pct > 0) return { status: 'warn', headline: 'Gaining a bit slowly', advice: 'You\'re gaining, but slower than ideal for building muscle. Add about 200 calories a day if next week looks the same.' };
    return { status: 'bad', headline: 'Not gaining', advice: 'Your weight went down or stayed flat, so you\'re not in a surplus. Add about 300 calories a day — an extra snack or a shake.' };
  }
  if (goal === 'cut') {
    if (pct < -1.0) return { status: 'warn', headline: 'Losing too fast', advice: 'Dropping more than ~1% a week raises the risk of losing muscle. Add about 200 calories a day, keep protein high (~1 g per lb) and keep lifting heavy.' };
    if (pct <= -0.5) return { status: 'good', headline: 'Right on track', advice: 'Losing at a pace that protects your muscle. Keep protein high and keep lifting heavy.' };
    if (pct < 0) return { status: 'warn', headline: 'Losing a bit slowly', advice: 'You\'re losing, but slower than the target. Cut about 200 calories a day or add some daily walking.' };
    return { status: 'bad', headline: 'Not losing', advice: 'Your weight went up or stayed flat, so you\'re not in a deficit. Cut about 300 calories a day.' };
  }
  if (pct > 0.25) return { status: 'warn', headline: 'Drifting up', advice: 'A recomp works best at maintenance. Trim about 150–200 calories a day.' };
  if (pct < -0.25) return { status: 'warn', headline: 'Drifting down', advice: 'Dropping weight makes building muscle harder. Add about 150–200 calories a day.' };
  return { status: 'good', headline: 'Right on track', advice: 'Weight is holding steady — exactly what a recomp needs. Keep protein high and keep pushing your lifts.' };
}

// Report for the Monday–Sunday week starting at `start` (ms), compared with the week before.
export function weeklyReport(goal, bodyweights, start) {
  const list = byDate(bodyweights);
  const prevStart = addDays(start, -7);
  const cur = list.filter(b => weekStart(b.date) === start);
  const prev = list.filter(b => weekStart(b.date) === prevStart);
  if (!goal || !cur.length || !prev.length) return null;
  const curAvg = avg(cur), prevAvg = avg(prev);
  const change = curAvg - prevAvg;
  const pct = (change / prevAvg) * 100;
  return {
    start, curAvg, prevAvg, change, pct,
    curCount: cur.length, prevCount: prev.length,
    target: targetRange(goal, prevAvg),
    thin: cur.length < 3 || prev.length < 3,
    ...judge(goal, pct),
  };
}

// The most recent completed week first, going back `weeks` weeks.
export function recentReports(goal, bodyweights, today, weeks = 8) {
  const thisWeek = weekStart(today);
  const out = [];
  for (let k = 1; k <= weeks; k++) {
    const r = weeklyReport(goal, bodyweights, addDays(thisWeek, -7 * k));
    if (r) out.push(r);
  }
  return out;
}

export const lastWeekStart = today => addDays(weekStart(today), -7);
