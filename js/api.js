// Talks to Supabase. Every function here has a twin in mock-api.js for demo mode.
import { SUPABASE_URL, SUPABASE_ANON_KEY, LOGIN_EMAIL_DOMAIN } from './config.js';

const PAGE = 1000; // Supabase returns at most 1000 rows per request
let db;
let me = null;

// A login is "<user id>@<domain>" with password "GymSpotter-<pin>" (Supabase needs 6+ characters).
export const loginEmail = id => `${id.trim().toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
export const loginPassword = pin => `GymSpotter-${pin.trim()}`;

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

async function fetchAll(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const page = check(await build().range(from, from + PAGE - 1));
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

export function assemble(workoutRows, setRows) {
  const byWorkout = new Map(workoutRows.map(w => [w.id, { id: w.id, user_id: w.user_id, date: w.workout_date, created_at: w.created_at, exercises: [] }]));
  const sorted = [...setRows].sort((a, b) => a.position - b.position || a.set_number - b.set_number);
  for (const s of sorted) {
    const w = byWorkout.get(s.workout_id);
    if (!w) continue;
    let ex = w.exercises[w.exercises.length - 1];
    if (!ex || ex.position !== s.position) {
      ex = { name: s.exercise, position: s.position, sets: [] };
      w.exercises.push(ex);
    }
    ex.sets.push({ weight: Number(s.weight), reps: s.reps, note: s.note });
  }
  return [...byWorkout.values()];
}

function setRowsFor(workoutId, exercises) {
  return exercises.flatMap((ex, position) =>
    ex.sets.map((s, set_number) => ({
      workout_id: workoutId, exercise: ex.name, position, set_number,
      weight: s.weight, reps: s.reps, note: s.note,
    })));
}

async function insertSets(rows) {
  for (let i = 0; i < rows.length; i += 500) check(await db.from('sets').insert(rows.slice(i, i + 500)));
}

async function loadMe(userId) {
  me = check(await db.from('profiles').select('*').eq('id', userId).single());
  return me;
}

export const isDemo = false;

export async function init() {
  if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR-PROJECT')) throw new Error('NOT_CONFIGURED');
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await db.auth.getSession();
  if (data.session) {
    try { await loadMe(data.session.user.id); } catch { me = null; }
  }
}

export const currentUser = () => me;

export async function signIn(id, pin) {
  const { data, error } = await db.auth.signInWithPassword({ email: loginEmail(id), password: loginPassword(pin) });
  if (error) throw new Error(/invalid/i.test(error.message) ? 'Wrong user ID or PIN.' : error.message);
  return loadMe(data.user.id);
}

export async function signOut() {
  await db.auth.signOut();
  me = null;
}

export async function listProfiles() {
  return check(await db.from('profiles').select('*').order('display_name'));
}

export async function getProfile(username) {
  return check(await db.from('profiles').select('*').eq('username', username).maybeSingle());
}

export async function updateMyProfile(patch) {
  me = check(await db.from('profiles').update(patch).eq('id', me.id).select().single());
  return me;
}

export async function getWorkouts(userId) {
  const [workouts, sets] = await Promise.all([
    fetchAll(() => db.from('workouts').select('id, user_id, workout_date').eq('user_id', userId).order('workout_date')),
    fetchAll(() => db.from('sets').select('workout_id, exercise, position, set_number, weight, reps, note').eq('user_id', userId).order('id')),
  ]);
  return assemble(workouts, sets);
}

// Ids are made here so a big history paste goes up in a few requests instead of one per workout.
export async function addWorkouts(parsed) {
  const rows = parsed.map(w => ({ id: crypto.randomUUID(), workout_date: w.date }));
  for (let i = 0; i < rows.length; i += 500) check(await db.from('workouts').insert(rows.slice(i, i + 500)));
  await insertSets(parsed.flatMap((w, i) => setRowsFor(rows[i].id, w.exercises)));
}

export async function replaceWorkout(id, parsed) {
  check(await db.from('workouts').update({ workout_date: parsed.date }).eq('id', id));
  check(await db.from('sets').delete().eq('workout_id', id));
  await insertSets(setRowsFor(id, parsed.exercises));
}

export async function deleteWorkout(id) {
  check(await db.from('workouts').delete().eq('id', id));
}

export async function getBodyweights(userId) {
  return fetchAll(() => db.from('bodyweights').select('*').eq('user_id', userId).order('logged_on'));
}

export async function saveBodyweight(date, weight) {
  check(await db.from('bodyweights').upsert({ user_id: me.id, logged_on: date, weight }, { onConflict: 'user_id,logged_on' }));
}

export async function deleteBodyweight(id) {
  check(await db.from('bodyweights').delete().eq('id', id));
}

// Everything the Buddies tab needs, in four requests.
export async function getBuddyData() {
  const [profiles, workouts, squat, bench, bodyweights] = await Promise.all([
    listProfiles(),
    fetchAll(() => db.from('workouts').select('id, user_id, workout_date').order('id')),
    fetchAll(() => db.from('sets').select('workout_id, exercise, position, set_number, weight, reps, note').ilike('exercise', 'squat').order('id')),
    fetchAll(() => db.from('sets').select('workout_id, exercise, position, set_number, weight, reps, note').ilike('exercise', 'bench press').order('id')),
    fetchAll(() => db.from('bodyweights').select('user_id, logged_on, weight').order('id')),
  ]);
  return { profiles, workouts: assemble(workouts, [...squat, ...bench]), bodyweights };
}

export async function listPhotos() {
  const rows = check(await db.from('progress_photos').select('*').eq('user_id', me.id).order('taken_on', { ascending: false }));
  if (!rows.length) return [];
  const signed = check(await db.storage.from('progress-photos').createSignedUrls(rows.map(r => r.storage_path), 3600));
  const urls = new Map(signed.map(s => [s.path, s.signedUrl]));
  return rows.map(r => ({ ...r, url: urls.get(r.storage_path) }));
}

export async function addPhoto(blob, takenOn, weight) {
  const path = `${me.id}/${crypto.randomUUID()}.jpg`;
  check(await db.storage.from('progress-photos').upload(path, blob, { contentType: 'image/jpeg' }));
  check(await db.from('progress_photos').insert({ storage_path: path, taken_on: takenOn, weight }));
}

export async function deletePhoto(photo) {
  check(await db.storage.from('progress-photos').remove([photo.storage_path]));
  check(await db.from('progress_photos').delete().eq('id', photo.id));
}

export async function listPlans(userId) {
  return check(await db.from('plan_history').select('*').eq('user_id', userId).order('ended_on', { ascending: false }));
}

export async function addPlan(goal, started_on, ended_on) {
  check(await db.from('plan_history').insert({ goal, started_on, ended_on }));
}

export async function deletePlan(id) {
  check(await db.from('plan_history').delete().eq('id', id));
}

export async function getExerciseMap() {
  return check(await db.from('exercise_map').select('name, display_name, primary_muscles, secondary_muscles'));
}

export async function saveExerciseMapping(name, display_name, primary_muscles, secondary_muscles) {
  check(await db.from('exercise_map').upsert(
    { name, display_name, primary_muscles, secondary_muscles, updated_at: new Date().toISOString() },
    { onConflict: 'name' }));
}

// Profile pics live in the private "avatars" bucket; signed links are reused for an hour.
const avatarLinks = new Map();

export async function avatarUrls(profiles) {
  const need = profiles.map(p => p.avatar_path).filter(p => p && !avatarLinks.has(p));
  if (need.length) {
    const signed = check(await db.storage.from('avatars').createSignedUrls([...new Set(need)], 3600));
    for (const s of signed) if (s.signedUrl) avatarLinks.set(s.path, s.signedUrl);
  }
  return new Map(profiles.filter(p => p.avatar_path).map(p => [p.id, avatarLinks.get(p.avatar_path)]));
}

export async function setAvatar(blob) {
  const old = me.avatar_path;
  const path = `${me.id}/${Date.now()}.jpg`;
  check(await db.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' }));
  await updateMyProfile({ avatar_path: path });
  if (old) await db.storage.from('avatars').remove([old]);
}

// Everyone's full history: for the leaderboard ("vs last time") and the timeline.
export async function getAllWorkouts() {
  const [workouts, sets] = await Promise.all([
    fetchAll(() => db.from('workouts').select('id, user_id, workout_date, created_at').order('id')),
    fetchAll(() => db.from('sets').select('workout_id, exercise, position, set_number, weight, reps, note').order('id')),
  ]);
  return assemble(workouts, sets);
}

export async function listAllPlans() {
  return fetchAll(() => db.from('plan_history').select('*').order('id'));
}

export async function getMeasurements(userId) {
  return check(await db.from('measurements').select('*').eq('user_id', userId).order('taken_on'));
}

export async function getAllMeasurements() {
  return fetchAll(() => db.from('measurements').select('id, user_id, taken_on').order('id'));
}

export async function addMeasurement(row) {
  check(await db.from('measurements').insert(row));
}

export async function deleteMeasurement(id) {
  check(await db.from('measurements').delete().eq('id', id));
}

export async function getDeloads(userId) {
  return check(await db.from('deloads').select('*').eq('user_id', userId).order('started_on'));
}

export async function getAllDeloads() {
  return fetchAll(() => db.from('deloads').select('id, user_id, started_on').order('id'));
}

export async function addDeload(started_on) {
  check(await db.from('deloads').insert({ started_on }));
}

export async function deleteDeload(id) {
  check(await db.from('deloads').delete().eq('id', id));
}
