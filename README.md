# Gym Spotter

A workout log and progress tracker for the crew. Paste your RepCount workouts, log your morning weigh-in, and see how everyone's squat and bench are moving.

- **Home:** your estimated squat/bench 1RMs, body weight trend, weekly volume, charts for any exercise, and personal records
- **Log:** paste one workout or a whole history straight from RepCount
- **History:** every workout, with edit and delete
- **Buddies:** everyone's last workout, squat, bench and weight. Tap anyone to see their full dashboard (view only)
- **Pics:** private progress photos stamped with date and weight. Only you can see yours.

**Try the demo:** add `?demo` to the app link and sign in with `lifter` / `0000`.

Setup instructions: [SETUP.md](SETUP.md).

## How it's built

Plain HTML/CSS/JavaScript hosted on GitHub Pages, with [Supabase](https://supabase.com) for logins, the database and photo storage. Charts by [Chart.js](https://www.chartjs.org). There's no build step: edit a file, push, done.

| File | What it does |
| --- | --- |
| `js/app.js` | All screens and navigation |
| `js/parser.js` | Reads pasted RepCount text |
| `js/stats.js` | 1RM estimates, PRs, weight trend, weekly volume |
| `js/api.js` | Talks to Supabase |
| `js/mock-api.js` | Fake data for `?demo` mode |
| `js/config.js` | Your Supabase URL and public key |
| `supabase/schema.sql` | Database tables and security rules |

To run it locally: `python -m http.server 8137`, then open http://localhost:8137/?demo
