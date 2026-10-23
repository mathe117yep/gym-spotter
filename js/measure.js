// Body measurements: what to measure, how, and what the proportions say.

export const FIELDS = [
  { id: 'neck', label: 'Neck', how: "Just below the Adam's apple, tape level all the way around. Look straight ahead and stay relaxed — don't flex or shrug." },
  { id: 'chest', label: 'Chest', how: 'Arms relaxed at your sides. Tape around the fullest part of your chest, under the armpits and across the nipples, after a normal breath out.' },
  { id: 'waist', label: 'Waist', how: "At your belly button, standing relaxed. Breathe out normally and don't suck in. Keep the tape level front to back." },
  { id: 'biceps', label: 'Biceps', how: 'Right arm, flexed hard with your fist up by your shoulder. Tape around the peak of the biceps.' },
  { id: 'thigh', label: 'Thigh', how: 'Right leg, standing with weight on both feet. Tape around the thickest part, just below the glute.' },
  { id: 'calves', label: 'Calves', how: 'Right leg, standing with weight on both feet. Tape around the widest part of the calf.' },
];

export const TIPS = [
  'Measure in the morning before eating, same as your weigh-in.',
  'Tape snug against the skin, not digging in.',
  'Keep the tape level and take each one twice — use the average.',
  'Inches, right side only, so every check is comparable.',
];

export const REMIND_DAYS = 90;

const r1 = n => Math.round(n * 10) / 10;

// Feedback on proportions. Only waist-to-height has real health research behind it;
// the rest are classic bodybuilding aesthetic guidelines.
export function proportions(m, heightIn) {
  const out = [];
  if (m.waist && heightIn) {
    const r = m.waist / heightIn;
    const [status, text] = r < 0.4 ? ['good', 'very lean']
      : r < 0.5 ? ['good', 'in the healthy range (under 0.50)']
      : r < 0.6 ? ['warn', 'above the healthy range of under 0.50 — bringing your waist down would help']
      : ['bad', 'well above the healthy range of under 0.50 — trimming your waist is the priority'];
    out.push({ title: 'Waist-to-height', value: r.toFixed(2), status, text: `Your waist is ${text}.` });
  }
  if (m.chest && m.waist) {
    const r = m.chest / m.waist;
    const [status, text] = r >= 1.4 ? ['good', 'Classic V-taper (1.4 or more).']
      : r >= 1.3 ? ['ok', 'Good shape. More chest and back width — or a smaller waist — gets you to the classic 1.4.']
      : r >= 1.2 ? ['warn', 'Your waist is wide for your chest. Prioritize chest, lats and upper back, and trim the waist.']
      : ['bad', 'Waist and chest are close in size. Build chest and back width and bring the waist down.'];
    out.push({ title: 'Chest-to-waist', value: r.toFixed(2), status, text });
  }
  if (m.biceps && m.calves) {
    const d = m.biceps - m.calves;
    const [status, text] = Math.abs(d) <= 0.75 ? ['good', 'Arms and calves are balanced — the classic ideal is about equal.']
      : d > 0 ? ['warn', `Calves are ${r1(d)}" behind your arms. The classic ideal is about equal — add calf work 2–3 times a week.`]
      : ['warn', `Arms are ${r1(-d)}" behind your calves. The classic ideal is about equal — more biceps and triceps volume.`];
    out.push({ title: 'Arms vs calves', value: `${r1(m.biceps)}" / ${r1(m.calves)}"`, status, text });
  }
  if (m.biceps && m.neck) {
    const d = m.biceps - m.neck;
    if (Math.abs(d) > 1) {
      out.push({
        title: 'Arms vs neck', value: `${r1(m.biceps)}" / ${r1(m.neck)}"`, status: 'ok',
        text: d > 0 ? 'Arms are bigger than your neck — totally normal; the classic ideal has them about equal.'
          : `Arms are ${r1(-d)}" behind your neck. The classic ideal has them about equal.`,
      });
    }
  }
  if (m.thigh && m.calves) {
    const r = m.thigh / m.calves;
    const [status, text] = r < 1.45 ? ['warn', 'Thighs are small relative to calves — more squats, lunges and leg press.']
      : r > 1.8 ? ['warn', 'Calves are behind your thighs — add direct calf work.']
      : ['good', 'Thighs and calves are in proportion (about 1.5–1.75×).'];
    out.push({ title: 'Thigh-to-calf', value: r.toFixed(2), status, text });
  }
  return out;
}
