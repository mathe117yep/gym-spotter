// Demo mode (open the app with ?demo): same functions as api.js, backed by fake data in
// this browser only. Logins: demo1 / 1111 (onboarding), lifter / 0000, buddy / 0000.
import { todayIso, toTime } from './stats.js';

const STORE = 'gymspotter-demo-v2';
let state;
let me = null;

const uid = () => crypto.randomUUID();
const pins = { lifter: '0000', buddy: '0000', demo1: '1111' };

function shiftDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function seed() {
  const s = { profiles: [], workouts: [], sets: [], bodyweights: [], photos: [] };
  const people = [
    { username: 'lifter', display_name: 'Demo Lifter', bench: 255, squat: 335, bw: 196, onboarded: true, goal: 'cut' },
    { username: 'buddy', display_name: 'Demo Buddy', bench: 205, squat: 285, bw: 178, onboarded: true },
    { username: 'demo1', display_name: 'demo1', onboarded: false },
  ];
  let rand = 7;
  const rnd = () => (rand = (rand * 16807) % 2147483647) / 2147483647;
  const r5 = n => Math.round(n / 5) * 5;
  const today = todayIso();

  for (const p of people) {
    const id = uid();
    s.profiles.push({ id, username: p.username, display_name: p.display_name, onboarded: p.onboarded, goal: p.goal ?? null });
    if (!p.bench) continue;
    const days = 150;
    for (let d = days; d >= 1; d--) {
      const date = shiftDays(today, -d + (p.username === 'buddy' ? -3 : 0));
      const progress = 1 + (days - d) / days * 0.08;
      if (rnd() < 0.85) s.bodyweights.push({ id: uid(), user_id: id, logged_on: date, weight: Math.round((p.bw - (days - d) * 0.02 + (rnd() - 0.5) * 3) * 10) / 10 });
      const dow = new Date(toTime(date)).getDay();
      if (![1, 3, 5].includes(dow) || rnd() < 0.15) continue;
      const wid = uid();
      s.workouts.push({ id: wid, user_id: id, workout_date: date });
      const plan = dow === 1
        ? [['Bench Press', p.bench * 0.85 * progress, 5], ['Incline Dumbbell Press', 140 * progress, 8], ['Cable Crossovers', 47.5, 12], ['Hanging leg raises', 0, 10]]
        : dow === 3
          ? [['Squat', p.squat * 0.85 * progress, 5], ['Romanian Deadlift', 225 * progress, 8], ['Leg Extension', 150, 12]]
          : [['Bench Press', p.bench * 0.9 * progress, 3], ['Squat', p.squat * 0.8 * progress, 6], ['Pull-ups', 25, 8]];
      plan.forEach(([name, w, reps], position) => {
        for (let k = 0; k < 3; k++) {
          s.sets.push({ id: uid(), workout_id: wid, user_id: id, exercise: name, position, set_number: k,
            weight: w ? r5(w) : 0, reps: Math.max(1, reps - k + Math.round(rnd() * 2 - 1)), note: k === 0 && rnd() < 0.2 ? 'Felt strong' : null });
        }
      });
    }
  }
  return s;
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ ...state, photos: [] })); } catch { /* demo only */ }
}

function mine(row) {
  if (!me || row.user_id !== me.id) throw new Error('You can only change your own records.');
}

const wait = () => new Promise(r => setTimeout(r, 120));

export const isDemo = true;

export async function init() {
  try { state = JSON.parse(localStorage.getItem(STORE)); } catch { state = null; }
  if (!state) { state = seed(); save(); }
  let saved = null;
  try { saved = sessionStorage.getItem(STORE + '-me'); } catch { /* ignore */ }
  me = state.profiles.find(p => p.id === saved) || null;
}

export const currentUser = () => me;

export async function signIn(id, pin) {
  await wait();
  const p = state.profiles.find(x => x.username === id.trim().toLowerCase());
  if (!p || pins[p.username] !== pin.trim()) throw new Error('Wrong user ID or PIN.');
  me = p;
  try { sessionStorage.setItem(STORE + '-me', p.id); } catch { /* ignore */ }
  return me;
}

export async function signOut() {
  me = null;
  try { sessionStorage.removeItem(STORE + '-me'); } catch { /* ignore */ }
}

export async function listProfiles() {
  return [...state.profiles].sort((a, b) => a.display_name.localeCompare(b.display_name));
}

export async function getProfile(username) {
  return state.profiles.find(p => p.username === username) || null;
}

export async function updateMyProfile(patch) {
  Object.assign(me, patch);
  save();
  return me;
}

function assemble(workoutRows, setRows) {
  return workoutRows.map(w => {
    const exercises = [];
    setRows.filter(s => s.workout_id === w.id)
      .sort((a, b) => a.position - b.position || a.set_number - b.set_number)
      .forEach(s => {
        let ex = exercises[exercises.length - 1];
        if (!ex || ex.position !== s.position) { ex = { name: s.exercise, position: s.position, sets: [] }; exercises.push(ex); }
        ex.sets.push({ weight: s.weight, reps: s.reps, note: s.note });
      });
    return { id: w.id, user_id: w.user_id, date: w.workout_date, exercises };
  });
}

export async function getWorkouts(userId) {
  await wait();
  return assemble(state.workouts.filter(w => w.user_id === userId), state.sets.filter(s => s.user_id === userId));
}

function insertSets(workoutId, exercises) {
  exercises.forEach((ex, position) => ex.sets.forEach((s, set_number) => state.sets.push({
    id: uid(), workout_id: workoutId, user_id: me.id, exercise: ex.name, position, set_number, weight: s.weight, reps: s.reps, note: s.note,
  })));
}

export async function addWorkouts(parsed) {
  await wait();
  for (const w of parsed) {
    const id = uid();
    state.workouts.push({ id, user_id: me.id, workout_date: w.date });
    insertSets(id, w.exercises);
  }
  save();
}

export async function replaceWorkout(id, parsed) {
  const w = state.workouts.find(x => x.id === id);
  mine(w);
  w.workout_date = parsed.date;
  state.sets = state.sets.filter(s => s.workout_id !== id);
  insertSets(id, parsed.exercises);
  save();
}

export async function deleteWorkout(id) {
  mine(state.workouts.find(x => x.id === id));
  state.workouts = state.workouts.filter(w => w.id !== id);
  state.sets = state.sets.filter(s => s.workout_id !== id);
  save();
}

export async function getBodyweights(userId) {
  return state.bodyweights.filter(b => b.user_id === userId);
}

export async function saveBodyweight(date, weight) {
  const existing = state.bodyweights.find(b => b.user_id === me.id && b.logged_on === date);
  if (existing) existing.weight = weight;
  else state.bodyweights.push({ id: uid(), user_id: me.id, logged_on: date, weight });
  save();
}

export async function deleteBodyweight(id) {
  mine(state.bodyweights.find(b => b.id === id));
  state.bodyweights = state.bodyweights.filter(b => b.id !== id);
  save();
}

export async function getBuddyData() {
  await wait();
  const lifts = state.sets.filter(s => ['squat', 'bench press'].includes(s.exercise.toLowerCase()));
  return { profiles: await listProfiles(), workouts: assemble(state.workouts, lifts), bodyweights: state.bodyweights };
}

export async function listPhotos() {
  return state.photos.filter(p => p.user_id === me.id).sort((a, b) => b.taken_on.localeCompare(a.taken_on));
}

export async function addPhoto(blob, takenOn, weight) {
  state.photos.push({ id: uid(), user_id: me.id, taken_on: takenOn, weight, url: URL.createObjectURL(blob) });
}

export async function deletePhoto(photo) {
  state.photos = state.photos.filter(p => p.id !== photo.id);
}
