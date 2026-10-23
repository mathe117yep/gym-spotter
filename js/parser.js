// Turns pasted RepCount-style text into workouts, and back again.
//
//   Oct 22, 2026            <- date line starts a workout
//   Bench Press             <- exercise name
//   300 x 1 NEW MAX         <- weight x reps, then an optional note
//   Logged using RepCount   <- ignored

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const WEEKDAY = '(?:(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*,?\\s+)?';
const NAMED_DATE = new RegExp(`^${WEEKDAY}([a-z]{3,9})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})$`, 'i');
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SET_LINE = /^(\d+(?:\.\d+)?)\s*(?:lbs?)?\s*[x×*]\s*(\d+)(?![\d.])\s*(.*)$/i;
const IGNORED = /^logged (using|with)\b/i;

function pad(n) { return String(n).padStart(2, '0'); }

function validDate(y, m, d) {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function parseDateLine(line) {
  let m = line.match(NAMED_DATE);
  if (m) {
    const month = MONTHS[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith('sept') ? 4 : 3)];
    const y = +m[3], d = +m[2];
    if (month && validDate(y, month, d)) return `${y}-${pad(month)}-${pad(d)}`;
    return null;
  }
  m = line.match(SLASH_DATE);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    if (validDate(y, +m[1], +m[2])) return `${y}-${pad(+m[1])}-${pad(+m[2])}`;
    return null;
  }
  m = line.match(ISO_DATE);
  if (m && validDate(+m[1], +m[2], +m[3])) return line;
  return null;
}

export function parseWorkouts(text) {
  const workouts = [];
  const warnings = [];
  let workout = null;
  let exercise = null;

  const lines = text.replace(/\r/g, '').split('\n');
  lines.forEach((raw, i) => {
    const line = raw.replace(/ /g, ' ').trim();
    const lineNo = i + 1;
    if (!line || IGNORED.test(line)) return;

    const date = parseDateLine(line);
    if (date) {
      workout = { date, exercises: [] };
      workouts.push(workout);
      exercise = null;
      return;
    }

    const set = line.match(SET_LINE);
    if (set) {
      if (!workout) {
        warnings.push(`Line ${lineNo}: "${line}" comes before any date, so it was skipped.`);
        return;
      }
      if (!exercise) {
        warnings.push(`Line ${lineNo}: "${line}" has no exercise name above it, so it was skipped.`);
        return;
      }
      exercise.sets.push({ weight: +set[1], reps: +set[2], note: set[3].trim() || null });
      return;
    }

    if (!workout) {
      warnings.push(`Line ${lineNo}: "${line}" comes before any date, so it was skipped.`);
      return;
    }
    exercise = { name: line.replace(/\s+/g, ' '), sets: [] };
    workout.exercises.push(exercise);
  });

  for (const w of workouts) {
    const empty = w.exercises.filter(e => e.sets.length === 0);
    for (const e of empty) warnings.push(`${formatDate(w.date)}: "${e.name}" has no sets, so it was skipped.`);
    w.exercises = w.exercises.filter(e => e.sets.length > 0);
  }
  const kept = workouts.filter(w => w.exercises.length > 0);
  if (kept.length < workouts.length) {
    warnings.push(`${workouts.length - kept.length} date line(s) had no sets under them and were skipped.`);
  }
  return { workouts: kept, warnings };
}

// Workout (with exercises) -> the same text format, used by the editor.
export function workoutToText(workout) {
  const out = [formatDate(workout.date), ''];
  for (const ex of workout.exercises) {
    out.push(ex.name);
    for (const s of ex.sets) out.push(`${s.weight} x ${s.reps}${s.note ? ' ' + s.note : ''}`);
    out.push('');
  }
  return out.join('\n').trim() + '\n';
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}
