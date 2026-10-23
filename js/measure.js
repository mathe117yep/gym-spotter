// Body measurements: what to measure, how, what the proportions say, and a size-for-height
// rating. Men and women get different measurements, standards and level names; `sex` is
// 'male' | 'female' (anything else is treated as male, the original version).

const isFemale = sex => sex === 'female';

const MALE_FIELDS = [
  { id: 'neck', label: 'Neck', how: "Just below the Adam's apple, tape level all the way around. Look straight ahead and stay relaxed — don't flex or shrug." },
  { id: 'chest', label: 'Chest', how: 'Arms relaxed at your sides. Tape around the fullest part of your chest, under the armpits and across the nipples, after a normal breath out.' },
  { id: 'waist', label: 'Waist', how: "At your belly button, standing relaxed. Breathe out normally and don't suck in. Keep the tape level front to back." },
  { id: 'biceps', label: 'Biceps', how: 'Right arm, flexed hard with your fist up by your shoulder. Tape around the peak of the biceps.' },
  { id: 'thigh', label: 'Thigh', how: 'Right leg, standing with weight on both feet. Tape around the thickest part, just below the glute.' },
  { id: 'calves', label: 'Calves', how: 'Right leg, standing with weight on both feet. Tape around the widest part of the calf.' },
];

const FEMALE_FIELDS = [
  { id: 'chest', label: 'Bust', how: 'Arms relaxed at your sides, in a non-padded bra. Tape level around the fullest part of your chest, after a normal breath out.' },
  { id: 'waist', label: 'Waist', how: "The narrowest part of your waist (usually just above the belly button), standing relaxed. Breathe out normally and don't suck in." },
  { id: 'hips', label: 'Hips / glutes', how: 'Feet together. Tape level around the fullest part of your glutes — check it in a mirror from the side.' },
  { id: 'thigh', label: 'Thigh', how: 'Right leg, standing with weight on both feet. Tape around the thickest part, just below the glute.' },
  { id: 'biceps', label: 'Arm (flexed)', how: 'Right arm, flexed with your fist up by your shoulder. Tape around the peak of the biceps.' },
  { id: 'calves', label: 'Calves', how: 'Right leg, standing with weight on both feet. Tape around the widest part of the calf.' },
];

export const fieldsFor = sex => (isFemale(sex) ? FEMALE_FIELDS : MALE_FIELDS);
// Every measurement that can exist, for showing old check-ins.
export const ALL_FIELDS = [...MALE_FIELDS, FEMALE_FIELDS.find(f => f.id === 'hips')];

export const TIPS = [
  'Measure in the morning before eating, same as your weigh-in.',
  'Tape snug against the skin, not digging in.',
  'Keep the tape level and take each one twice — use the average.',
  'Inches, right side only, so every check is comparable.',
];

export const REMIND_DAYS = 90;

const r1 = n => Math.round(n * 10) / 10;

function waistToHeight(m, heightIn) {
  const r = m.waist / heightIn;
  const [status, text] = r < 0.4 ? ['good', 'very lean']
    : r < 0.5 ? ['good', 'in the healthy range (under 0.50)']
    : r < 0.6 ? ['warn', 'above the healthy range of under 0.50 — bringing your waist down would help']
    : ['bad', 'well above the healthy range of under 0.50 — trimming your waist is the priority'];
  return { title: 'Waist-to-height', value: r.toFixed(2), status, text: `Your waist is ${text}.` };
}

// Feedback on proportions. Only waist-to-height has real health research behind it;
// the rest are classic physique guidelines.
export function proportions(m, heightIn, sex) {
  const out = [];
  if (m.waist && heightIn) out.push(waistToHeight(m, heightIn));
  return isFemale(sex) ? out.concat(femaleProportions(m)) : out.concat(maleProportions(m));
}

function maleProportions(m) {
  const out = [];
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

function femaleProportions(m) {
  const out = [];
  if (m.waist && m.hips) {
    const r = m.waist / m.hips;
    const [status, text] = r <= 0.72 ? ['good', 'Snatched waist, big glutes — that\'s the hourglass. 🔥']
      : r <= 0.8 ? ['ok', 'Nice curves. More glute work (hip thrusts, RDLs, Bulgarian split squats) and a tight waist sharpen it even more.']
      : ['warn', 'Straighter shape right now. Glutes are the fastest way to build the curve — hip thrusts, RDLs and Bulgarians 2–3× a week, and keep the waist tight.'];
    out.push({ title: 'Waist-to-hip', value: r.toFixed(2), status, text });
  }
  if (m.chest && m.hips && m.waist) {
    const balanced = Math.abs(m.chest - m.hips) / m.hips <= 0.1;
    const cinched = m.waist / Math.min(m.chest, m.hips) <= 0.78;
    if (balanced && cinched) {
      out.push({ title: 'Shape', value: 'Hourglass', status: 'good', text: 'Bust and hips are balanced with a cinched waist — classic hourglass. ✨' });
    } else if (m.hips > m.chest * 1.1) {
      out.push({ title: 'Shape', value: 'Pear', status: 'ok', text: 'Glutes lead the way. Some shoulder and back work (lateral raises, rows) balances the top half.' });
    }
  }
  if (m.hips && m.thigh) {
    const r = m.hips / m.thigh;
    if (r < 1.6) out.push({ title: 'Glutes vs thighs', value: r.toFixed(2), status: 'ok', text: 'Thighs are doing a lot of the work — lean on hip thrusts and glute bridges to grow the glutes on top.' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Size-for-height ratings. Each measurement is compared with height, so a 16" arm means
// more at 5'6" than at 6'2". Thresholds are the share of height needed for each level
// above the first. Rough benchmarks, not an official standard. The men's scale is tough
// (Elite is rare); the women's is deliberately generous — fit women should land in the
// top two levels.
// ---------------------------------------------------------------------------

const SCALES = {
  male: {
    levels: ['Beginner', 'Intermediate', 'Advanced', 'Elite'],
    size: { neck: [0.22, 0.235, 0.25], chest: [0.59, 0.635, 0.68], biceps: [0.21, 0.23, 0.25], thigh: [0.33, 0.355, 0.385], calves: [0.215, 0.23, 0.245] },
    waist: [0.48, 0.45, 0.42],          // waist ÷ height; smaller is better
    waistLabel: 'Waist (leanness)',
  },
  female: {
    levels: ['Beginner', 'Okay Girl I See You! 👀', 'Snatched Status ✨', 'MEGA GYM BADDIE 💅'],
    size: { hips: [0.56, 0.58, 0.6], thigh: [0.3, 0.32, 0.34], biceps: [0.165, 0.175, 0.19], calves: [0.2, 0.21, 0.22] },
    waist: [0.47, 0.44, 0.415],
    waistLabel: 'Waist (snatched)',
  },
};
const CHEST_TO_WAIST = [1.2, 1.3, 1.4];  // men: V-taper, bigger is better
const WAIST_TO_HIP = [0.82, 0.77, 0.72]; // women: hourglass, smaller is better

export const levelsFor = sex => SCALES[isFemale(sex) ? 'female' : 'male'].levels;

const levelUp = (value, steps) => steps.filter(s => value >= s).length;
const levelDown = (value, steps) => steps.filter(s => value <= s).length;

export function ratings(m, heightIn, sex) {
  if (!heightIn) return null;
  const scale = SCALES[isFemale(sex) ? 'female' : 'male'];
  const L = scale.levels;
  const next = (level, text) => (level < 3 ? `${L[level + 1].replace(/ [^\w!]+$/u, '')} at ${text}` : 'Top tier');
  const items = [];
  // Body fat makes every size measurement bigger, so size can only rate one level above
  // the waist (leanness) rating. Big *and* lean is what earns the top tiers.
  const waistLevel = m.waist ? levelDown(m.waist / heightIn, scale.waist) : null;
  for (const f of fieldsFor(sex)) {
    if (m[f.id] == null) continue;
    if (f.id === 'waist') {
      items.push({ id: 'waist', label: scale.waistLabel, value: `${r1(m.waist)}"`, level: waistLevel, next: next(waistLevel, `${r1(scale.waist[waistLevel] * heightIn)}" or less`) });
      continue;
    }
    const steps = scale.size[f.id];
    if (!steps) continue; // e.g. bust isn't rated
    const sizeLevel = levelUp(m[f.id] / heightIn, steps);
    const cap = waistLevel == null ? 3 : waistLevel + 1;
    if (sizeLevel > cap) {
      items.push({ id: f.id, label: f.label, value: `${r1(m[f.id])}"`, level: cap, next: `Size is ${L[sizeLevel].replace(/ [^\w!]+$/u, '')} — a tighter waist unlocks it` });
    } else {
      items.push({ id: f.id, label: f.label, value: `${r1(m[f.id])}"`, level: sizeLevel, next: next(sizeLevel, `${r1(steps[sizeLevel] * heightIn)}"`) });
    }
  }
  if (isFemale(sex) && m.waist && m.hips) {
    const ratio = m.waist / m.hips;
    const level = levelDown(ratio, WAIST_TO_HIP);
    items.push({ id: 'whr', label: 'Hourglass (waist ÷ hips)', value: ratio.toFixed(2), level, next: next(level, `${WAIST_TO_HIP[level]?.toFixed(2)} or less`) });
  }
  if (!isFemale(sex) && m.chest && m.waist) {
    const ratio = m.chest / m.waist;
    const level = levelUp(ratio, CHEST_TO_WAIST);
    items.push({ id: 'taper', label: 'V-taper (chest ÷ waist)', value: ratio.toFixed(2), level, next: next(level, CHEST_TO_WAIST[level]?.toFixed(1)) });
  }
  if (!items.length) return null;
  // Overall = the middle rating, so one standout (or weak spot) doesn't swing it.
  const sorted = items.map(i => i.level).sort((a, b) => a - b);
  return { items, overall: sorted[Math.floor((sorted.length - 1) / 2)], levels: L };
}
