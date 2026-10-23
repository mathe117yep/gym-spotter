import { parseWorkouts, workoutToText, formatDate } from './parser.js';
import {
  SQUAT, BENCH, key, e1rm, round, todayIso, daysAgo, sortByDate,
  exerciseSeries, liftSummary, personalRecords, weeklySummary, weightSummary,
} from './stats.js';
import { GOALS, targetRange, dailyRemark, recentReports, lastWeekStart, goalProgress, planSummary } from './coach.js';
import * as charts from './charts.js';

const demo = new URLSearchParams(location.search).has('demo');
const api = demo ? await import('./mock-api.js') : await import('./api.js');

const view = document.getElementById('view');
const nav = document.getElementById('nav');
const header = document.getElementById('header');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const me = () => api.currentUser();
const go = path => { location.hash = '#/' + path; };
const lb = n => (n == null ? '—' : `${round(n)}`);
const fmtWeight = n => (Math.round(Number(n) * 10) / 10).toString();

function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function relDay(iso) {
  const n = daysAgo(iso);
  if (n <= 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.round(n / 7)} weeks ago`;
  return formatDate(iso);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const GOAL_WORD = { bulk: 'Bulking', cut: 'Cutting', recomp: 'Recomping' };
const signedLb = n => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtWeight(Math.abs(n))}`;
const setText = s => `${s.weight === 0 ? 'BW' : fmtWeight(s.weight)} × ${s.reps}`;

// Workouts are cached per user so switching tabs is instant. Own data is dropped after any change.
const workoutCache = new Map();
function workoutsFor(userId) {
  if (!workoutCache.has(userId)) workoutCache.set(userId, api.getWorkouts(userId).catch(e => { workoutCache.delete(userId); throw e; }));
  return workoutCache.get(userId);
}
const dropMyCache = () => workoutCache.delete(me().id);

async function profileFor(username) {
  if (username === me().username) return me();
  const p = await api.getProfile(username);
  if (!p) throw new Error(`No one called "${username}" here.`);
  return p;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

// ---------------------------------------------------------------------------
// Router: each view returns { html, mount? } so a slow load can't paint over a newer page.
// ---------------------------------------------------------------------------

let routeToken = 0;

async function route() {
  const token = ++routeToken;
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);

  if (!me()) return paint(token, loginView(), false);
  if (!me().onboarded && parts[0] !== 'welcome') return go('welcome');

  const tab = { '': 'home', history: 'log', weight: 'home', u: parts[1] === me().username ? (parts[2] ? 'log' : 'home') : 'buddies' }[parts[0] ?? ''] ?? parts[0];
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  view.innerHTML = '<div class="loading">Loading…</div>';

  let result;
  try {
    const [page, a, b, c] = parts;
    if (!page) result = await dashboardView(me());
    else if (page === 'welcome') result = welcomeView();
    else if (page === 'log') result = await logView();
    else if (page === 'history') result = await historyView(me());
    else if (page === 'buddies') result = await buddiesView();
    else if (page === 'pics') result = await picsView();
    else if (page === 'weight') result = await weightView();
    else if (page === 'plan') result = await planView();
    else if (page === 'u' && b === 'w' && parts[4] === 'edit') result = await editView(await profileFor(a), c);
    else if (page === 'u' && b === 'w') result = await workoutView(await profileFor(a), c);
    else if (page === 'u' && b === 'history') result = await historyView(await profileFor(a));
    else if (page === 'u') result = await dashboardView(await profileFor(a));
    else result = { html: '<p class="empty">Page not found.</p>' };
  } catch (e) {
    console.error(e);
    result = { html: `<div class="card error">Something went wrong: ${esc(e.message)}<br><button class="btn small" onclick="location.reload()">Reload</button></div>` };
  }
  paint(token, result, me()?.onboarded);
}

function paint(token, { html, mount }, showChrome) {
  if (token !== routeToken) return;
  charts.destroyAll();
  nav.hidden = !showChrome;
  header.hidden = !showChrome;
  view.innerHTML = html;
  window.scrollTo(0, 0);
  mount?.();
}

// ---------------------------------------------------------------------------
// Login + first-time setup
// ---------------------------------------------------------------------------

function loginView() {
  return {
    html: `
      <form class="login" id="login">
        <div class="brand-big"><img src="icons/logo.png" alt=""><h1>Gym Spotter</h1><p>Log it. Track it. Get roasted.</p></div>
        ${demo ? '<p class="hint center">Demo mode — try <b>lifter</b> / <b>0000</b>, or <b>demo1</b> / <b>1111</b> to see first-time setup.</p>' : ''}
        <label>User ID<input name="userid" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
        <label>PIN<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="current-password" required></label>
        <p class="error-text" id="login-error"></p>
        <button class="btn primary" type="submit">Sign in</button>
      </form>`,
    mount() {
      const form = document.getElementById('login');
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const btn = form.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Signing in…';
        try {
          await api.signIn(form.elements.userid.value, form.elements.pin.value);
          location.hash = me().onboarded ? '#/' : '#/welcome';
          route();
        } catch (e) {
          document.getElementById('login-error').textContent = e.message;
          btn.disabled = false;
          btn.textContent = 'Sign in';
        }
      });
    },
  };
}

function welcomeView() {
  const name = me().display_name === me().username ? '' : me().display_name;
  return {
    html: `
      <section class="card">
        <h2>Welcome to Gym Spotter 👋</h2>
        <p class="hint">Two quick things and you're in.</p>
        <label>Your name (what your buddies see)<input id="display-name" value="${esc(name)}" placeholder="e.g. Eli Mathew" maxlength="40"></label>
      </section>
      <section class="card">
        <h3>Got past workouts?</h3>
        <p class="hint">Paste your old RepCount logs below — as many workouts as you want at once, each starting with its date — then tap <b>Read & Log</b>. You can always do this later from the Log tab.</p>
        ${pasteBoxHtml('welcome')}
      </section>
      <button class="btn primary wide" id="finish">Let's go</button>`,
    mount() {
      const box = mountPasteBox('welcome', []);
      document.getElementById('finish').addEventListener('click', async ev => {
        const display_name = document.getElementById('display-name').value.trim();
        if (!display_name) return toast('Add your name first.');
        if (box.hasUnsaved()) return toast('Tap "Read & Log" first, or clear the box.');
        ev.target.disabled = true;
        await api.updateMyProfile({ display_name, onboarded: true });
        go('');
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Paste box: Read & Log parses and saves in one tap. Used on Log and first-time setup.
// ---------------------------------------------------------------------------

function pasteBoxHtml(id) {
  return `
    <textarea id="${id}-text" rows="10" placeholder="Oct 22, 2026

Bench Press
300 x 1 NEW MAX
245 x 3 Pause reps

Logged using RepCount"></textarea>
    <button class="btn primary wide" id="${id}-log">Read & Log</button>
    <div id="${id}-result"></div>`;
}

function mountPasteBox(id, existing) {
  const text = document.getElementById(`${id}-text`);
  const out = document.getElementById(`${id}-result`);
  const btn = document.getElementById(`${id}-log`);
  const loggedDates = new Set(existing.map(w => w.date));
  const warningList = warnings => (warnings.length
    ? `<div class="notice warn"><b>Heads up:</b><ul>${warnings.slice(0, 10).map(w => `<li>${esc(w)}</li>`).join('')}${warnings.length > 10 ? `<li>…and ${warnings.length - 10} more</li>` : ''}</ul></div>`
    : '');

  // Reads the pasted text and saves it in one tap. Dates already logged are skipped,
  // so pasting the same history twice doesn't double it.
  btn.addEventListener('click', async () => {
    const { workouts, warnings } = parseWorkouts(text.value);
    if (!workouts.length) {
      out.innerHTML = `<div class="notice warn">No workouts found. Each workout needs a date line (like <b>Oct 22, 2026</b>) and sets written as <b>weight x reps</b>.${warnings.length ? '<ul>' + warnings.slice(0, 8).map(w => `<li>${esc(w)}</li>`).join('') + '</ul>' : ''}</div>`;
      return;
    }
    const toSave = workouts.filter(w => !loggedDates.has(w.date));
    const skipped = workouts.length - toSave.length;
    if (!toSave.length) {
      out.innerHTML = `<div class="notice warn">Already logged — every workout here is on a date you've logged before. To change one, open it in <a href="#/history">History</a> and tap Edit.</div>`;
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Logging…';
    try {
      await api.addWorkouts(toSave);
      dropMyCache();
      toSave.forEach(w => loggedDates.add(w.date));
      const sets = toSave.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
      const sorted = [...toSave].sort((a, b) => a.date.localeCompare(b.date));
      out.innerHTML = `
        <div class="notice ok">
          ✓ Logged <b>${plural(toSave.length, 'workout')}</b> and <b>${plural(sets, 'set')}</b>
          ${toSave.length > 1 ? `from ${formatDate(sorted[0].date)} to ${formatDate(sorted[sorted.length - 1].date)}` : `on ${formatDate(sorted[0].date)}`}.
          ${skipped ? `<br>Skipped ${plural(skipped, 'workout')} on dates you'd already logged.` : ''}
        </div>
        ${warningList(warnings)}
        <div class="preview-list">
          ${sorted.slice(0, 50).map(w => `
            <details class="preview-item">
              <summary>${shortDate(w.date)} <span class="muted">· ${plural(w.exercises.length, 'exercise')}</span></summary>
              ${w.exercises.map(e => `<div class="mini"><b>${esc(e.name)}</b> ${e.sets.map(s => esc(setText(s))).join(', ')}</div>`).join('')}
            </details>`).join('')}
          ${sorted.length > 50 ? `<p class="hint">…and ${sorted.length - 50} more.</p>` : ''}
        </div>
        <p class="hint">Something read wrong? Fix it from <a href="#/history">History</a> → the workout → Edit.</p>`;
      text.value = '';
      toast(`Logged ${plural(toSave.length, 'workout')} 💪`);
    } catch (e) {
      toast(`Couldn't save: ${e.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Read & Log';
    }
  });

  return { hasUnsaved: () => text.value.trim().length > 0 };
}

// ---------------------------------------------------------------------------
// Dashboard (yours or a buddy's)
// ---------------------------------------------------------------------------

function liftTile(label, summary, color) {
  if (!summary) return `<div class="tile"><span class="tile-label">${label} e1RM</span><span class="tile-value muted">—</span><span class="tile-sub">Nothing logged yet</span></div>`;
  const { current, allTime } = summary;
  const shown = current ?? allTime;
  const s = shown.bestSet;
  return `
    <div class="tile" style="--accent:${color}">
      <span class="tile-label">${label} e1RM</span>
      <span class="tile-value">${lb(shown.e1rm)}<small> lb</small></span>
      <span class="tile-sub">${current ? `${esc(setText(s))} · ${relDay(shown.date)}` : `Best ever · ${formatDate(allTime.date)}`}</span>
      ${current && round(allTime.e1rm) > round(current.e1rm) ? `<span class="tile-sub">All-time ${lb(allTime.e1rm)} lb</span>` : ''}
    </div>`;
}

function workoutRow(w, profile) {
  const names = w.exercises.map(e => e.name);
  const sets = w.exercises.reduce((n, e) => n + e.sets.length, 0);
  return `
    <a class="list-row" href="#/u/${encodeURIComponent(profile.username)}/w/${w.id}">
      <div><b>${shortDate(w.date)}</b><div class="muted small">${esc(names.slice(0, 3).join(', '))}${names.length > 3 ? ` +${names.length - 3} more` : ''}</div></div>
      <span class="muted small">${sets} sets ›</span>
    </a>`;
}

async function dashboardView(profile) {
  const own = profile.id === me().id;
  const [workouts, bodyweights] = await Promise.all([workoutsFor(profile.id), api.getBodyweights(profile.id)]);
  const squat = liftSummary(workouts, SQUAT);
  const bench = liftSummary(workouts, BENCH);
  const bw = weightSummary(bodyweights);
  const recent = sortByDate(workouts);
  const last30 = workouts.filter(w => daysAgo(w.date) < 30).length;
  const prs = personalRecords(workouts);
  const weeks = weeklySummary(workouts);
  const today = todayIso();
  const todayBw = bodyweights.find(b => b.logged_on === today);
  const base = `#/u/${encodeURIComponent(profile.username)}`;
  const firstName = profile.display_name.split(' ')[0];
  // Mondays: the report on the week that just ended, shown once the morning weigh-in is in.
  const mondayReport = own && profile.goal && new Date().getDay() === 1
    ? recentReports(profile.goal, bodyweights, today, 1).find(r => r.start === lastWeekStart(today))
    : null;

  const html = `
    <div class="page-title">
      ${own ? `<h2>Hey ${esc(firstName)}</h2>` : `<a class="back" href="#/buddies">‹ Buddies</a><h2>${esc(profile.display_name)}</h2>`}
      <span class="muted small">${recent.length ? `Last workout: ${relDay(recent[0].date)}` : 'No workouts yet'}</span>
      ${profile.goal ? `<span class="muted small">${goalLine(profile, bodyweights)}</span>` : ''}
    </div>

    ${own ? `
      <section class="card weigh-in">
        ${todayBw
          ? `<div class="row between"><div><span class="muted small">This morning</span><div class="big">${fmtWeight(todayBw.weight)} lb ✓</div></div><a class="btn small" href="#/weight">Weight log</a></div>`
          : `<form id="weigh-form" class="row"><label class="grow">Morning weigh-in<input id="weigh-input" type="number" inputmode="decimal" step="0.1" min="50" max="600" placeholder="${bw ? fmtWeight(bw.latest.weight) : 'lbs'}" required></label><button class="btn primary" type="submit">Save</button></form>
             <a class="muted small" href="#/weight">Weight log ›</a>`}
        ${todayBw ? remarkHtml(dailyRemark(profile.goal, bodyweights, today)) : ''}
      </section>
      ${todayBw && mondayReport ? `<section class="card"><div class="row between"><h3>Weekly report</h3><a class="small" href="#/plan">Plan ›</a></div>${reportHtml(mondayReport)}</section>` : ''}` : ''}

    <div class="tiles">
      ${liftTile('Squat', squat, charts.COLORS.squat)}
      ${liftTile('Bench', bench, charts.COLORS.bench)}
      <div class="tile" style="--accent:${charts.COLORS.weight}">
        <span class="tile-label">Body weight</span>
        <span class="tile-value">${bw ? fmtWeight(bw.latest.avg) : '—'}<small>${bw ? ' lb' : ''}</small></span>
        <span class="tile-sub">${bw ? `7-day avg${bw.change30 != null ? ` · ${bw.change30 >= 0 ? '+' : ''}${fmtWeight(bw.change30)} in 30d` : ''}` : 'No weigh-ins yet'}</span>
      </div>
      <div class="tile">
        <span class="tile-label">Workouts</span>
        <span class="tile-value">${last30}</span>
        <span class="tile-sub">last 30 days · ${workouts.length} total</span>
      </div>
    </div>

    ${squat || bench ? `<section class="card"><h3>Squat & bench (est. 1RM)</h3><div class="chart"><canvas id="c-lifts"></canvas></div></section>` : ''}
    ${bw && bw.trend.length > 1 ? `<section class="card"><h3>Body weight</h3><div class="chart"><canvas id="c-weight"></canvas></div></section>` : ''}
    ${workouts.length ? `<section class="card"><h3>Weekly volume</h3><p class="hint">Total pounds moved (weight × reps), last 12 weeks.</p><div class="chart short"><canvas id="c-volume"></canvas></div></section>` : ''}

    ${prs.length ? `
      <section class="card">
        <h3>Any exercise</h3>
        <select id="ex-pick">${prs.slice().sort((a, b) => b.sessions - a.sessions).map(p => `<option value="${esc(key(p.name))}">${esc(p.name)} (${p.sessions})</option>`).join('')}</select>
        <div class="chart"><canvas id="c-ex"></canvas></div>
      </section>
      <section class="card">
        <h3>Personal records</h3>
        <div class="pr-list">${prs.map((p, i) => `
          <div class="pr${i >= 8 ? ' extra' : ''}">
            <span>${esc(p.name)}</span>
            <span class="pr-val">${p.top === 0 ? `${p.maxReps} reps` : p.best != null ? `${lb(p.best)} lb <small class="muted">${esc(setText(p.bestSet))}</small>` : `${fmtWeight(p.top)} lb top set`}</span>
          </div>`).join('')}</div>
        ${prs.length > 8 ? '<button class="btn small" id="pr-more">Show all</button>' : ''}
      </section>` : ''}

    <section class="card">
      <div class="row between"><h3>Recent workouts</h3>${recent.length > 5 ? `<a class="small" href="${base}/history">See all ›</a>` : ''}</div>
      ${recent.length ? recent.slice(0, 5).map(w => workoutRow(w, profile)).join('') : `<p class="empty">${own ? 'Nothing yet — head to the <a href="#/log">Log</a> tab and paste a workout.' : 'No workouts logged yet.'}</p>`}
    </section>`;

  return {
    html,
    mount() {
      if (squat || bench) {
        charts.lineChart(document.getElementById('c-lifts'), [
          squat && { label: 'Squat', color: charts.COLORS.squat, points: squat.series.map(p => ({ date: p.date, value: p.e1rm })) },
          bench && { label: 'Bench', color: charts.COLORS.bench, points: bench.series.map(p => ({ date: p.date, value: p.e1rm })) },
        ].filter(Boolean));
      }
      if (bw && bw.trend.length > 1) {
        charts.lineChart(document.getElementById('c-weight'), [
          { label: 'Weigh-ins', color: charts.COLORS.weight, faint: true, points: bw.trend.map(p => ({ date: p.date, value: p.weight })) },
          { label: '7-day avg', color: charts.COLORS.weight, dots: false, points: bw.trend.map(p => ({ date: p.date, value: p.avg })) },
        ]);
      }
      if (workouts.length) charts.weekBars(document.getElementById('c-volume'), weeks.map(w => ({ start: w.start, value: w.volume })), 'Volume', ' lb');

      const pick = document.getElementById('ex-pick');
      if (pick) {
        let exChart;
        const draw = () => {
          exChart?.destroy();
          const series = exerciseSeries(workouts, pick.value);
          const bodyweightOnly = series.every(p => p.top === 0);
          exChart = bodyweightOnly
            ? charts.lineChart(document.getElementById('c-ex'), [{ label: 'Best reps', color: charts.COLORS.squat, points: series.map(p => ({ date: p.date, value: p.reps })) }], ' reps')
            : charts.lineChart(document.getElementById('c-ex'), [
              { label: 'Est. 1RM', color: charts.COLORS.bench, points: series.filter(p => p.e1rm != null).map(p => ({ date: p.date, value: p.e1rm })) },
              { label: 'Top set', color: charts.COLORS.muted, points: series.map(p => ({ date: p.date, value: p.top })) },
            ]);
        };
        pick.addEventListener('change', draw);
        draw();
      }

      document.getElementById('pr-more')?.addEventListener('click', ev => {
        document.querySelectorAll('.pr.extra').forEach(el => el.classList.remove('extra'));
        ev.target.remove();
      });

      document.getElementById('weigh-form')?.addEventListener('submit', async ev => {
        ev.preventDefault();
        const v = parseFloat(document.getElementById('weigh-input').value);
        if (!(v > 0)) return;
        await api.saveBodyweight(today, v);
        toast('Weigh-in saved');
        route();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Log, history, single workout, edit
// ---------------------------------------------------------------------------

const logSwitch = active => `
  <div class="segment">
    <a href="#/log" class="${active === 'log' ? 'active' : ''}">Log new</a>
    <a href="#/history" class="${active === 'history' ? 'active' : ''}">History</a>
  </div>`;

async function logView() {
  const existing = await workoutsFor(me().id);
  return {
    html: `
      <div class="page-title"><h2>Log a workout</h2></div>
      ${logSwitch('log')}
      <section class="card">
        <p class="hint">Paste straight from RepCount. You can paste one workout or a whole stack of old ones — every date line starts a new workout.</p>
        ${pasteBoxHtml('log')}
      </section>`,
    mount() { mountPasteBox('log', existing); },
  };
}

async function historyView(profile) {
  const own = profile.id === me().id;
  const workouts = sortByDate(await workoutsFor(profile.id));
  const months = new Map();
  for (const w of workouts) {
    const label = new Date(w.date.slice(0, 7) + '-15').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (!months.has(label)) months.set(label, []);
    months.get(label).push(w);
  }
  return {
    html: `
      <div class="page-title">
        ${own ? '' : `<a class="back" href="#/u/${encodeURIComponent(profile.username)}">‹ ${esc(profile.display_name)}</a>`}
        <h2>${own ? 'Your workouts' : `${esc(profile.display_name.split(' ')[0])}'s workouts`}</h2>
        <span class="muted small">${workouts.length} total</span>
      </div>
      ${own ? logSwitch('history') : ''}
      ${workouts.length ? [...months].map(([label, ws]) => `
        <section class="card"><h3>${label} <span class="muted small">· ${ws.length}</span></h3>${ws.map(w => workoutRow(w, profile)).join('')}</section>`).join('')
        : `<p class="empty">No workouts yet.${own ? ' Paste one on the <a href="#/log">Log</a> tab.' : ''}</p>`}`,
  };
}

async function findWorkout(profile, id) {
  const w = (await workoutsFor(profile.id)).find(x => x.id === id);
  if (!w) throw new Error('That workout is gone — it may have been deleted.');
  return w;
}

async function workoutView(profile, id) {
  const own = profile.id === me().id;
  const w = await findWorkout(profile, id);
  const base = `#/u/${encodeURIComponent(profile.username)}`;
  return {
    html: `
      <div class="page-title">
        <a class="back" href="${own ? '#/history' : base}">‹ ${own ? 'Workouts' : esc(profile.display_name)}</a>
        <h2>${formatDate(w.date)}</h2>
        <span class="muted small">${shortDate(w.date).split(',')[0]} · ${plural(w.exercises.length, 'exercise')}</span>
      </div>
      ${w.exercises.map(ex => `
        <section class="card">
          <h3>${esc(ex.name)}</h3>
          ${ex.sets.map((s, i) => {
            const est = e1rm(s.weight, s.reps);
            return `<div class="set"><span class="muted">${i + 1}</span><b>${esc(setText(s))}</b><span class="note">${esc(s.note ?? '')}</span>${est && s.reps > 1 ? `<span class="muted small">~${round(est)}</span>` : ''}</div>`;
          }).join('')}
        </section>`).join('')}
      ${own ? `<div class="row"><a class="btn grow" href="${base}/w/${w.id}/edit">Edit</a><button class="btn danger grow" id="del">Delete</button></div>` : ''}`,
    mount() {
      document.getElementById('del')?.addEventListener('click', async () => {
        if (!confirm(`Delete the ${formatDate(w.date)} workout? This can't be undone.`)) return;
        await api.deleteWorkout(w.id);
        dropMyCache();
        toast('Workout deleted');
        go('history');
      });
    },
  };
}

async function editView(profile, id) {
  if (profile.id !== me().id) throw new Error("You can only edit your own workouts.");
  const w = await findWorkout(profile, id);
  const back = `#/u/${encodeURIComponent(profile.username)}/w/${w.id}`;
  return {
    html: `
      <div class="page-title"><a class="back" href="${back}">‹ Cancel</a><h2>Edit workout</h2></div>
      <section class="card">
        <p class="hint">Change anything — the date, weights, reps, notes. Delete a line to remove a set.</p>
        <textarea id="edit-text" rows="16">${esc(workoutToText(w))}</textarea>
        <p class="error-text" id="edit-error"></p>
        <button class="btn primary wide" id="edit-save">Save changes</button>
      </section>`,
    mount() {
      document.getElementById('edit-save').addEventListener('click', async ev => {
        const err = document.getElementById('edit-error');
        const { workouts, warnings } = parseWorkouts(document.getElementById('edit-text').value);
        if (workouts.length !== 1) {
          err.textContent = workouts.length ? 'Keep it to one date line when editing a single workout.' : `Couldn't read that. ${warnings[0] ?? 'Start with a date line, then exercises and sets.'}`;
          return;
        }
        ev.target.disabled = true;
        await api.replaceWorkout(w.id, workouts[0]);
        dropMyCache();
        toast('Saved');
        location.hash = back;
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Plan: body composition goal, weigh-in feedback and weekly reports
// ---------------------------------------------------------------------------

// "Cutting · down 15 lb total since Sep 1, 2026"
function goalLine(profile, bodyweights) {
  if (!profile.goal) return '';
  const word = `<span class="gold">${GOAL_WORD[profile.goal]}</span>`;
  const prog = goalProgress(profile.goal, profile.goal_started_on, bodyweights);
  if (!prog) return word;
  const since = `since ${formatDate(prog.startedOn)}`;
  if (prog.change == null) return `${word} · started ${formatDate(prog.startedOn)}`;
  if (Math.abs(prog.change) < 0.1) return `${word} · no change yet ${since}`;
  return `${word} · ${prog.change > 0 ? 'up' : 'down'} ${fmtWeight(Math.abs(prog.change))} lb total ${since}`;
}

function remarkHtml(remark) {
  return remark ? `<p class="remark ${remark.tone}">${esc(remark.text)}</p>` : '';
}

const weekLabel = ms => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function reportHtml(r) {
  return `
    <div class="report ${r.status}">
      <div class="row between"><b class="report-head">${esc(r.headline)}</b><span class="muted small">Week of ${weekLabel(r.start)}</span></div>
      <div class="report-nums">
        <div><span class="tile-label">This week</span><b>${fmtWeight(r.curAvg)}</b></div>
        <div><span class="tile-label">Week before</span><b>${fmtWeight(r.prevAvg)}</b></div>
        <div><span class="tile-label">Change</span><b class="delta">${signedLb(r.change)} lb</b><span class="muted small">${r.pct >= 0 ? '+' : '−'}${Math.abs(r.pct).toFixed(2)}%</span></div>
      </div>
      <p>${esc(r.advice)}</p>
      <p class="hint">Weekly averages, Monday–Sunday. Target for you: ${esc(r.target)} a week.${r.thin ? ' Only a few weigh-ins this time — weigh in daily for a sharper read.' : ''}</p>
    </div>`;
}

const monthYear = iso => new Date(iso + 'T12:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

// One finished plan: "Bulk  Mar 2026 – Aug 2026" with weight, pace and lift changes.
function planDoneHtml(plan, s) {
  const liftLine = (name, l) => (l ? `${name} ${lb(l.from)} → ${lb(l.to)} <span class="${l.to >= l.from ? 'gold' : 'muted'}">(${signedLb(round(l.to) - round(l.from))})</span>` : null);
  const lifts = [liftLine('Squat', s.squat), liftLine('Bench', s.bench)].filter(Boolean);
  const weeks = Math.round(s.weeks);
  return `
    <div class="plan-done ${s.pace?.status ?? ''}">
      <div class="row between">
        <b class="plan-title">${GOALS[plan.goal].label} <span class="muted">${monthYear(plan.started_on)} – ${monthYear(plan.ended_on)}</span></b>
        <button class="icon-btn" data-del-plan="${plan.id}" aria-label="Delete">✕</button>
      </div>
      <div class="muted small">${formatDate(plan.started_on)} to ${formatDate(plan.ended_on)} · ${weeks < 1 ? `${s.days} days` : plural(weeks, 'week')} · ${plural(s.workouts, 'workout')}</div>
      ${s.change != null ? `
        <div class="report-nums">
          <div><span class="tile-label">Start</span><b>${fmtWeight(s.startWeight)}</b></div>
          <div><span class="tile-label">End</span><b>${fmtWeight(s.endWeight)}</b></div>
          <div><span class="tile-label">Total</span><b class="delta">${signedLb(s.change)} lb</b></div>
        </div>
        <p class="small"><b class="pace">${esc(s.pace.text)}</b> — averaged ${signedLb(s.perWeek)} lb a week (${s.pctPerWeek >= 0 ? '+' : '−'}${Math.abs(s.pctPerWeek).toFixed(2)}% of body weight). Target: ${esc(GOALS[plan.goal].target)}.</p>`
        : '<p class="hint">Not enough weigh-ins during this plan to measure the weight change.</p>'}
      ${lifts.length ? `<p class="small">Est. 1RM, first vs last 3 weeks: ${lifts.join(' · ')}</p>` : ''}
    </div>`;
}

async function planView() {
  const [bodyweights, plans, workouts] = await Promise.all([api.getBodyweights(me().id), api.listPlans(me().id), workoutsFor(me().id)]);
  const goal = me().goal;
  const today = todayIso();
  const current = weightSummary(bodyweights)?.latest.avg;
  const reports = goal ? recentReports(goal, bodyweights, today) : [];
  const latest = reports[0]?.start === lastWeekStart(today) ? reports[0] : null;
  const past = reports.filter(r => r !== latest);

  return {
    html: `
      <div class="page-title"><h2>Plan</h2></div>
      <section class="card">
        <h3>Body composition</h3>
        <p class="hint">Pick your goal. Every weigh-in gets feedback based on it, and each Monday's weigh-in comes with a weekly report.</p>
        <div class="goal-options">
          ${Object.entries(GOALS).map(([k, g]) => `
            <button class="goal-opt${goal === k ? ' active' : ''}" data-goal="${k}">
              <span class="goal-name">${g.label}${goal === k ? ' <span class="tag">Current</span>' : ''}</span>
              <span>${g.blurb}</span>
              <span class="muted small">Aim to ${g.target}${current ? ` — ${targetRange(k, current)} a week for you` : ''}.</span>
            </button>`).join('')}
        </div>
        ${goal ? `
          <div class="goal-start">
            <label>Started ${GOAL_WORD[goal].toLowerCase()} on<input type="date" id="goal-start" value="${esc(me().goal_started_on ?? today)}" max="${today}"></label>
            <p class="hint">${goalLine(me(), bodyweights)}. Buddies see this on their Buddies tab.</p>
            <button class="btn small" id="end-plan">End ${GOALS[goal].label.toLowerCase()}</button>
          </div>` : ''}
      </section>

      <section class="card">
        <h3>Weekly report</h3>
        ${!goal ? '<p class="empty">Pick a goal above to start getting reports.</p>'
          : latest ? reportHtml(latest)
          : '<p class="empty">Your next report shows up Monday — it needs weigh-ins from two weeks in a row to compare.</p>'}
      </section>

      ${past.length ? `
        <section class="card">
          <h3>Past weeks</h3>
          ${past.map(r => `
            <div class="list-row static">
              <span>Week of ${weekLabel(r.start)}<div class="muted small">${fmtWeight(r.curAvg)} lb avg</div></span>
              <span class="report-chip ${r.status}">${signedLb(r.change)} lb · ${esc(r.headline)}</span>
            </div>`).join('')}
        </section>` : ''}

      ${plans.length ? `
        <section class="card">
          <h3>Plans completed</h3>
          ${plans.map(p => planDoneHtml(p, planSummary(p, bodyweights, workouts))).join('')}
        </section>` : ''}`,
    mount() {
      // Moving off a plan files it under "Plans completed" (skipped if it started today).
      const archiveCurrent = async () => {
        const started = me().goal_started_on;
        if (goal && started && started < today) await api.addPlan(goal, started, today);
      };

      document.getElementById('end-plan')?.addEventListener('click', async ev => {
        if (!confirm(`End your ${GOALS[goal].label.toLowerCase()}?\n\nIt'll be saved under Plans completed.`)) return;
        ev.target.disabled = true;
        try {
          await archiveCurrent();
          await api.updateMyProfile({ goal: null, goal_started_on: null });
          toast(`${GOALS[goal].label} ended`);
          route();
        } catch (e) {
          ev.target.disabled = false;
          toast(`Couldn't save: ${e.message}`);
        }
      });

      document.querySelectorAll('[data-del-plan]').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Delete this completed plan? This can\'t be undone.')) return;
        await api.deletePlan(btn.dataset.delPlan);
        route();
      }));

      document.getElementById('goal-start')?.addEventListener('change', async ev => {
        if (!ev.target.value) return;
        try {
          await api.updateMyProfile({ goal_started_on: ev.target.value });
          toast('Start date saved');
          route();
        } catch (e) {
          toast(`Couldn't save: ${e.message}`);
        }
      });

      document.querySelectorAll('.goal-opt').forEach(btn => btn.addEventListener('click', async () => {
        const next = btn.dataset.goal;
        if (next === goal) return;
        if (goal && !confirm(`Are you sure you want to change your Plan from ${GOALS[goal].label} to ${GOALS[next].label}?\n\nYour ${GOALS[goal].label.toLowerCase()} will be saved under Plans completed, and your progress total restarts from today.`)) return;
        btn.disabled = true;
        try {
          await archiveCurrent();
          await api.updateMyProfile({ goal: next, goal_started_on: today });
          toast(`Plan set: ${GOALS[next].label}`);
          route();
        } catch (e) {
          btn.disabled = false;
          toast(`Couldn't save: ${e.message}`);
        }
      }));
    },
  };
}

// ---------------------------------------------------------------------------
// Buddies
// ---------------------------------------------------------------------------

async function buddiesView() {
  const { profiles, workouts, bodyweights } = await api.getBuddyData();
  const buddies = profiles.filter(p => p.id !== me().id && p.onboarded).map(p => {
    const ws = workouts.filter(w => w.user_id === p.id);
    const last = ws.reduce((m, w) => (w.date > m ? w.date : m), '');
    const bws = bodyweights.filter(b => b.user_id === p.id);
    return { p, last, bws, squat: liftSummary(ws, SQUAT), bench: liftSummary(ws, BENCH), bw: weightSummary(bws) };
  }).sort((a, b) => b.last.localeCompare(a.last) || a.p.display_name.localeCompare(b.p.display_name));

  const lift = s => (s ? lb((s.current ?? s.allTime).e1rm) : '—');
  return {
    html: `
      <div class="page-title"><h2>Buddies</h2><span class="muted small">Tap anyone to see their full dashboard</span></div>
      ${buddies.length ? buddies.map(({ p, last, bws, squat, bench, bw }) => `
        <a class="card buddy" href="#/u/${encodeURIComponent(p.username)}">
          <div class="row between">
            <div class="buddy-name"><span class="avatar">${esc(p.display_name.trim()[0]?.toUpperCase() ?? '?')}</span><b>${esc(p.display_name)}</b></div>
            <span class="small ${last && daysAgo(last) <= 3 ? 'fresh' : 'muted'}">${last ? relDay(last) : 'No workouts yet'}</span>
          </div>
          ${p.goal ? `<div class="buddy-goal">${goalLine(p, bws)}</div>` : ''}
          <div class="buddy-stats">
            <div><span class="tile-label">Squat</span><b style="color:${charts.COLORS.squat}">${lift(squat)}</b></div>
            <div><span class="tile-label">Bench</span><b style="color:${charts.COLORS.bench}">${lift(bench)}</b></div>
            <div><span class="tile-label">Weight</span><b>${bw ? fmtWeight(bw.latest.avg) : '—'}</b></div>
          </div>
        </a>`).join('')
        : '<p class="empty">No buddies yet. Once Eli adds accounts for the crew, they show up here.</p>'}
      <p class="hint center">Squat & bench are estimated 1-rep maxes (best in the last 90 days). Weight is a 7-day average.</p>`,
  };
}

// ---------------------------------------------------------------------------
// Progress pics (private) and weight log
// ---------------------------------------------------------------------------

async function shrinkImage(file, maxSide = 1400) {
  let img;
  try {
    img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    img = await new Promise((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error("Couldn't read that image."));
      el.src = URL.createObjectURL(file);
    });
  }
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.82));
}

async function picsView() {
  const [photos, bodyweights] = await Promise.all([api.listPhotos(), api.getBodyweights(me().id)]);
  const bwOn = date => {
    const exact = bodyweights.find(b => b.logged_on === date);
    if (exact) return Number(exact.weight);
    const before = bodyweights.filter(b => b.logged_on <= date).sort((a, b) => a.logged_on.localeCompare(b.logged_on)).pop();
    return before ? Number(before.weight) : '';
  };
  const today = todayIso();
  return {
    html: `
      <div class="page-title"><h2>Progress pics</h2><span class="muted small">🔒 Only you can see these</span></div>
      <section class="card">
        <form id="pic-form">
          <label class="file-pick"><input type="file" id="pic-file" accept="image/*" required><span id="pic-label">📷 Choose or take a photo</span></label>
          <div class="row">
            <label class="grow">Date<input type="date" id="pic-date" value="${today}" max="${today}" required></label>
            <label class="grow">Weight (lb)<input type="number" id="pic-weight" inputmode="decimal" step="0.1" value="${bwOn(today)}"></label>
          </div>
          <button class="btn primary wide" type="submit">Upload</button>
        </form>
      </section>
      ${photos.length ? `<div class="pics">${photos.map((p, i) => `
        <button class="pic" data-i="${i}"><img src="${esc(p.url)}" alt="Progress photo ${formatDate(p.taken_on)}" loading="lazy">
          <span class="stamp">${formatDate(p.taken_on)}${p.weight ? ` · ${fmtWeight(p.weight)} lb` : ''}</span></button>`).join('')}</div>`
        : '<p class="empty">No pics yet. Future you will thank you for taking one.</p>'}
      <dialog id="pic-dialog"><img id="pic-big" alt=""><p id="pic-stamp"></p>
        <div class="row"><button class="btn grow" id="pic-close">Close</button><button class="btn danger grow" id="pic-del">Delete</button></div></dialog>`,
    mount() {
      const dateIn = document.getElementById('pic-date');
      const weightIn = document.getElementById('pic-weight');
      const fileIn = document.getElementById('pic-file');
      dateIn.addEventListener('change', () => { weightIn.value = bwOn(dateIn.value); });
      fileIn.addEventListener('change', () => {
        document.getElementById('pic-label').textContent = fileIn.files[0] ? `✓ ${fileIn.files[0].name}` : '📷 Choose or take a photo';
      });
      document.getElementById('pic-form').addEventListener('submit', async ev => {
        ev.preventDefault();
        const btn = ev.target.querySelector('button[type=submit]');
        btn.disabled = true;
        btn.textContent = 'Uploading…';
        try {
          const blob = await shrinkImage(fileIn.files[0]);
          await api.addPhoto(blob, dateIn.value, weightIn.value ? parseFloat(weightIn.value) : null);
          toast('Pic saved');
          route();
        } catch (e) {
          toast(`Upload failed: ${e.message}`);
          btn.disabled = false;
          btn.textContent = 'Upload';
        }
      });

      const dialog = document.getElementById('pic-dialog');
      let current;
      document.querySelectorAll('.pic').forEach(el => el.addEventListener('click', () => {
        current = photos[+el.dataset.i];
        document.getElementById('pic-big').src = current.url;
        document.getElementById('pic-stamp').textContent = `${formatDate(current.taken_on)}${current.weight ? ` · ${fmtWeight(current.weight)} lb` : ''}`;
        dialog.showModal();
      }));
      document.getElementById('pic-close').addEventListener('click', () => dialog.close());
      document.getElementById('pic-del').addEventListener('click', async () => {
        if (!confirm('Delete this pic for good?')) return;
        await api.deletePhoto(current);
        dialog.close();
        route();
      });
    },
  };
}

async function weightView() {
  const bodyweights = [...await api.getBodyweights(me().id)].sort((a, b) => b.logged_on.localeCompare(a.logged_on));
  const today = todayIso();
  return {
    html: `
      <div class="page-title"><a class="back" href="#/">‹ Home</a><h2>Weight log</h2></div>
      <section class="card">
        <form id="w-form" class="row wrap">
          <label class="grow">Date<input type="date" id="w-date" value="${today}" max="${today}" required></label>
          <label class="grow">Weight (lb)<input type="number" id="w-val" inputmode="decimal" step="0.1" min="50" max="600" required></label>
          <button class="btn primary" type="submit">Save</button>
        </form>
        <p class="hint">Saving on a date that already has a weight replaces it.</p>
      </section>
      <section class="card">
        ${bodyweights.length ? bodyweights.map(b => `
          <div class="list-row static"><span>${shortDate(b.logged_on)}</span><span><b>${fmtWeight(b.weight)}</b> lb <button class="icon-btn" data-id="${b.id}" aria-label="Delete">✕</button></span></div>`).join('')
          : '<p class="empty">No weigh-ins yet.</p>'}
      </section>`,
    mount() {
      document.getElementById('w-form').addEventListener('submit', async ev => {
        ev.preventDefault();
        await api.saveBodyweight(document.getElementById('w-date').value, parseFloat(document.getElementById('w-val').value));
        toast('Saved');
        route();
      });
      document.querySelectorAll('.icon-btn[data-id]').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Delete this weigh-in?')) return;
        await api.deleteBodyweight(btn.dataset.id);
        route();
      }));
    },
  };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

document.getElementById('sign-out').addEventListener('click', async () => {
  if (!confirm('Sign out?')) return;
  await api.signOut();
  workoutCache.clear();
  location.hash = '#/';
  route();
});
if (demo) document.getElementById('demo-flag').hidden = false;

try {
  await api.init();
  window.addEventListener('hashchange', route);
  route();
} catch (e) {
  header.hidden = true;
  nav.hidden = true;
  view.innerHTML = e.message === 'NOT_CONFIGURED'
    ? `<div class="card"><h2>Almost there</h2><p>Gym Spotter isn't connected to its database yet. Add your Supabase URL and key to <code>js/config.js</code> (see SETUP.md).</p><p><a class="btn" href="?demo">Try the demo instead</a></p></div>`
    : `<div class="card error">Couldn't start: ${esc(e.message)}</div>`;
}
