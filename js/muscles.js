// Which muscles each exercise trains, and matching the names people actually type
// ("Overhead extensions (Cable)", "DB rows", "Pull-ups") to them.

export const MUSCLES = [
  ['chest', 'Chest'], ['front_delts', 'Front delts'], ['side_delts', 'Side delts'], ['rear_delts', 'Rear delts'],
  ['lats', 'Lats'], ['upper_back', 'Upper back'], ['biceps', 'Biceps'], ['triceps', 'Triceps'],
  ['forearms', 'Forearms'], ['quads', 'Quads'], ['hamstrings', 'Hamstrings'], ['glutes', 'Glutes'],
  ['calves', 'Calves'], ['abs', 'Abs'],
].map(([id, label]) => ({ id, label }));
export const MUSCLE_LABEL = Object.fromEntries(MUSCLES.map(m => [m.id, m.label]));

// [names (first is the display name), primary muscles (1 set credit), secondary muscles (0.5)]
const DEFAULTS = [
  // Chest
  [['Bench Press', 'Barbell Bench Press', 'Flat Bench', 'Flat Bench Press', 'BB Bench'], ['chest'], ['triceps', 'front_delts']],
  [['Incline Bench Press', 'Incline Barbell Press', 'Incline Press'], ['chest'], ['front_delts', 'triceps']],
  [['Incline Dumbbell Press', 'Incline DB Bench', 'Incline Dumbbell Bench Press'], ['chest'], ['front_delts', 'triceps']],
  [['Dumbbell Bench Press', 'DB Bench', 'Dumbbell Press', 'Flat Dumbbell Press'], ['chest'], ['triceps', 'front_delts']],
  [['Decline Bench Press', 'Decline Press'], ['chest'], ['triceps']],
  [['Chest Press', 'Machine Chest Press', 'Hammer Strength Press'], ['chest'], ['triceps', 'front_delts']],
  [['Cable Crossover', 'Cable Fly', 'Pec Deck', 'Machine Fly', 'Dumbbell Fly', 'Chest Fly', 'Fly'], ['chest'], ['front_delts']],
  [['Push Up', 'Pushups'], ['chest'], ['triceps', 'front_delts']],
  [['Dips', 'Chest Dip', 'Weighted Dips'], ['triceps'], ['chest', 'front_delts']],
  // Shoulders
  [['Overhead Press', 'OHP', 'Military Press', 'Shoulder Press', 'Barbell Overhead Press'], ['front_delts'], ['triceps', 'side_delts']],
  [['Dumbbell Shoulder Press', 'Seated Dumbbell Press', 'DB Shoulder Press', 'Arnold Press', 'Machine Shoulder Press'], ['front_delts'], ['triceps', 'side_delts']],
  [['Lateral Raise', 'Cable Lateral Raise', 'Dumbbell Lateral Raise', 'Side Lateral Raise', 'Machine Lateral Raise', 'Lateral Raises'], ['side_delts'], []],
  [['Front Raise'], ['front_delts'], []],
  [['Rear Delt Fly', 'Reverse Fly', 'Reverse Pec Deck', 'Rear Delt Raise', 'Rear Delt Row'], ['rear_delts'], ['upper_back']],
  [['Face Pull'], ['rear_delts'], ['upper_back']],
  [['Upright Row'], ['side_delts'], ['upper_back']],
  [['Shrug', 'Barbell Shrug', 'Dumbbell Shrug'], ['upper_back'], ['forearms']],
  // Back
  [['Barbell Row', 'Bent Over Row', 'Pendlay Row', 'BB Row'], ['lats', 'upper_back'], ['biceps', 'rear_delts']],
  [['Dumbbell Row', 'One Arm Dumbbell Row', 'DB Row', 'Row'], ['lats'], ['upper_back', 'biceps']],
  [['Seated Cable Row', 'Cable Row', 'Seated Row'], ['upper_back', 'lats'], ['biceps']],
  [['T Bar Row', 'Chest Supported Row', 'Machine Row', 'Seal Row'], ['upper_back', 'lats'], ['biceps', 'rear_delts']],
  [['Lat Pulldown', 'Pulldown', 'Wide Grip Pulldown', 'Close Grip Pulldown'], ['lats'], ['biceps', 'upper_back']],
  [['Pull Up', 'Pull-ups', 'Weighted Pull Up', 'Chin Up', 'Chin-ups'], ['lats'], ['biceps', 'upper_back']],
  [['Straight Arm Pulldown', 'Pullover', 'Dumbbell Pullover'], ['lats'], []],
  [['Deadlift', 'Conventional Deadlift', 'Sumo Deadlift', 'Trap Bar Deadlift'], ['glutes', 'hamstrings'], ['upper_back', 'quads', 'forearms']],
  [['Back Extension', 'Hyperextension'], ['glutes'], ['hamstrings']],
  // Arms
  [['Barbell Curl', 'Curl', 'Dumbbell Curl', 'EZ Bar Curl', 'Cable Curl', 'Preacher Curl', 'Incline Curl', 'Concentration Curl', 'Spider Curl', 'Bicep Curl'], ['biceps'], ['forearms']],
  [['Hammer Curl', 'Rope Hammer Curl'], ['biceps'], ['forearms']],
  [['Tricep Pushdown', 'Pushdown', 'Rope Pushdown', 'Cable Pushdown', 'Tricep Extension', 'Kickback'], ['triceps'], []],
  [['Overhead Tricep Extension', 'Overhead Extension', 'Cable Overhead Extension', 'Overhead Extensions (Cable)', 'French Press'], ['triceps'], []],
  [['Skull Crusher', 'Lying Tricep Extension'], ['triceps'], []],
  [['JM Press'], ['triceps'], ['chest']],
  [['Close Grip Bench Press', 'CGBP', 'Close Grip Bench'], ['triceps'], ['chest', 'front_delts']],
  [['Wrist Curl', 'Reverse Wrist Curl', 'Reverse Curl'], ['forearms'], []],
  [['Farmer Carry', 'Farmers Walk'], ['forearms'], ['upper_back']],
  // Legs
  [['Squat', 'Back Squat', 'Barbell Squat', 'High Bar Squat', 'Low Bar Squat'], ['quads'], ['glutes']],
  [['Front Squat'], ['quads'], ['glutes', 'abs']],
  [['Hack Squat', 'Leg Press', 'Smith Squat', 'Goblet Squat', 'Pendulum Squat', 'Belt Squat'], ['quads'], ['glutes']],
  [['Bulgarian Split Squat', 'Split Squat', 'Lunge', 'Walking Lunge', 'Reverse Lunge', 'Step Up'], ['quads'], ['glutes']],
  [['Leg Extension'], ['quads'], []],
  [['Romanian Deadlift', 'RDL', 'Stiff Leg Deadlift', 'SLDL', 'Good Morning'], ['hamstrings'], ['glutes']],
  [['Leg Curl', 'Lying Leg Curl', 'Seated Leg Curl', 'Hamstring Curl', 'Nordic Curl'], ['hamstrings'], []],
  [['Hip Thrust', 'Glute Bridge', 'Barbell Hip Thrust'], ['glutes'], ['hamstrings']],
  [['Hip Abduction', 'Abductor', 'Cable Kickback'], ['glutes'], []],
  [['Calf Raise', 'Standing Calf Raise', 'Seated Calf Raise', 'Calf Press'], ['calves'], []],
  // Abs
  [['Hanging Leg Raise', 'Leg Raise', 'Hanging Knee Raise', 'Crunch', 'Cable Crunch', 'Ab Wheel', 'Plank', 'Sit Up', 'Decline Sit Up', 'Russian Twist', 'Ab Crunch Machine'], ['abs'], []],
];

const SYNONYMS = {
  db: 'dumbbell', dumbell: 'dumbbell', dumbells: 'dumbbell', dumbbells: 'dumbbell', bb: 'barbell',
  ohp: 'overhead press', rdl: 'romanian deadlift', rdls: 'romanian deadlift', sldl: 'stiff leg deadlift',
  pullup: 'pull up', pullups: 'pull up', chinup: 'chin up', chinups: 'chin up', pushup: 'push up', pushups: 'push up',
  situp: 'sit up', situps: 'sit up', ups: 'up', ext: 'extension', exts: 'extension', tri: 'tricep', tris: 'tricep',
  flye: 'fly', flyes: 'fly', flys: 'fly', flies: 'fly', skullcrusher: 'skull crusher', skullcrushers: 'skull crusher',
  hammy: 'hamstring', hammies: 'hamstring', lats: 'lat', delt: 'delt', delts: 'delt', ez: 'ez', cgbp: 'close grip bench press',
  tbar: 't bar', farmers: 'farmer', calves: 'calf',
};
// Words that change the feel of a lift but not which muscles it trains.
const MODIFIERS = new Set(['pause', 'paused', 'tempo', 'heavy', 'light', 'slow', 'banded', 'deficit', 'single', 'alternating',
  'alt', 'wide', 'narrow', 'neutral', 'seated', 'standing', 'weighted', 'assisted', 'smith', 'machine', 'cable', 'dumbbell',
  'barbell', 'ez', 'bar', 'one', 'arm', '1', 'to', 'the', 'a', 'with', 'and', 'on', 'top', 'set', 'back', 'off', 'plate', 'loaded']);

const singular = t => (t.endsWith('sses') ? t.slice(0, -2) : t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);

function tokens(name) {
  const raw = name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  return raw.flatMap(t => (SYNONYMS[t] ?? SYNONYMS[singular(t)] ?? singular(t)).split(' '))
    .join(' ').replace(/\bpull down\b/g, 'pulldown').replace(/\bpush down\b/g, 'pushdown').split(' ').filter(Boolean);
}

// The key exercise names are stored and matched under: order and plurals don't matter.
export const keyOf = name => [...tokens(name)].sort().join(' ');
const coreOf = toks => toks.filter(t => !MODIFIERS.has(t)).sort().join(' ');

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let both = 0;
  for (const x of A) if (B.has(x)) both++;
  return both / (A.size + B.size - both);
}

function editRatio(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length, 1);
}

// Returns name -> { primary, secondary, label, custom } or null when the exercise isn't known.
// customRows (from the shared exercise_map table) win over the built-in list.
export function buildMatcher(customRows = []) {
  const exact = new Map();
  const core = new Map();
  const add = (k, m, override) => {
    if (override || !exact.has(k)) exact.set(k, m);
    const c = coreOf(k.split(' '));
    if (c && (override || !core.has(c))) core.set(c, m);
  };
  for (const [names, primary, secondary] of DEFAULTS) {
    const m = { primary, secondary, label: names[0] };
    for (const n of names) add(keyOf(n), m, false);
  }
  for (const r of customRows) {
    add(r.name, { primary: r.primary_muscles, secondary: r.secondary_muscles ?? [], label: r.display_name, custom: true }, true);
  }
  const entries = [...exact].map(([k, m]) => ({ toks: k.split(' '), k, m }));
  const cache = new Map();

  return name => {
    if (cache.has(name)) return cache.get(name);
    const toks = tokens(name);
    const k = [...toks].sort().join(' ');
    let m = exact.get(k) ?? core.get(coreOf(toks)) ?? null;
    if (!m && toks.length) {
      let best = 0;
      const have = new Set(toks);
      for (const e of entries) {
        // Every word of a 2+ word known exercise appears in the name ("Tricep rope pushdowns" -> Rope Pushdown).
        const contained = e.toks.length >= 2 && e.toks.every(t => have.has(t)) ? 0.76 + 0.01 * e.toks.length : 0;
        const score = Math.max(jaccard(toks, e.toks), editRatio(k, e.k) >= 0.88 ? 0.9 : 0, contained);
        if (score > best) { best = score; m = e.m; }
      }
      if (best < 0.75) m = null;
    }
    cache.set(name, m);
    return m;
  };
}
