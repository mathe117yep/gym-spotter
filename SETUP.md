# Gym Spotter setup guide

About 15 minutes, all free. You'll do three things:

1. **Supabase**: the database that stores logins, workouts, weigh-ins and photos.
2. **GitHub Pages**: hosts the app itself at `https://mathe117yep.github.io/gym-spotter/`.
3. **Your phone**: add the app to your home screen.

---

## Part 1: Supabase

### 1. Create an account and project

1. Go to **https://supabase.com** and click **Start your project**. Signing in with GitHub is easiest.
2. Click **New project**.
   - **Name:** `gym-spotter`
   - **Database password:** click **Generate a password** and save it somewhere safe. Gym Spotter never needs it, but Supabase asks for it.
   - **Region:** the one closest to you (e.g. *East US*).
   - **Plan:** Free.
3. Click **Create new project** and wait about 2 minutes while it sets up.

### 2. Create the tables and security rules

1. In the left sidebar, open **SQL Editor**.
2. Click **+ New query**.
3. Open [`supabase/schema.sql`](supabase/schema.sql) from this repo, copy **everything**, and paste it into the editor.
4. Click **Run** (bottom right). You should see **"Success. No rows returned."**

This creates the tables, makes everyone's workouts *viewable* by the crew but *editable only by their owner*, and creates private photo storage that only the owner can see.

### 3. Turn off public sign-ups

Only people you create can get in.

1. Left sidebar → **Authentication** → **Sign In / Providers** (on some dashboards it's under **Configuration → Sign In / Up**).
2. Turn **off** **Allow new users to sign up**.
3. Click **Save**.

### 4. Create your login

1. Left sidebar → **Authentication** → **Users**.
2. Click **Add user** → **Create new user**.
   - **Email:** `mathe117@gymspotter.app`
   - **Password:** `GymSpotter-1420`
   - Check **Auto Confirm User**.
3. Click **Create user**.

You'll sign in to the app with just **User ID `mathe117`** and **PIN `1420`**. The app fills in the rest behind the scenes. No email is ever sent to that address.

### 5. Copy the two connection values

1. Left sidebar → **Project Settings** (gear icon) → **API** (may be called **Data API** / **API Keys**).
2. Copy:
   - **Project URL**: looks like `https://abcdefghijk.supabase.co`
   - **anon public** key (or **publishable** key): a long string starting with `eyJ...` or `sb_publishable_...`

   ⚠️ Do **not** use the **service_role** / **secret** key. That one bypasses all security rules and must never go in the app.
3. Send both to Claude, or paste them into [`js/config.js`](js/config.js) yourself:

   ```js
   export const SUPABASE_URL = 'https://abcdefghijk.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...';
   ```

The anon key is designed to be public. The security rules from step 2 are what protect the data.

---

## Part 2: GitHub Pages

1. Go to **https://github.com/new**.
   - **Repository name:** `gym-spotter`
   - **Public** (free GitHub Pages needs a public repo; only the *code* is public, never anyone's data)
   - Leave "Add a README" **unchecked**.
   - Click **Create repository**.
2. Tell Claude it's created, and Claude pushes the code.
3. In the repo: **Settings** → **Pages** (left sidebar).
   - **Source:** Deploy from a branch
   - **Branch:** `main`, folder `/ (root)` → **Save**
4. About a minute later the app is live at **https://mathe117yep.github.io/gym-spotter/**.

Try the demo anytime with fake data: **https://mathe117yep.github.io/gym-spotter/?demo**

---

## Part 3: Put it on your phone

- **iPhone:** open the link in **Safari** → tap **Share** → **Add to Home Screen**.
- **Android:** open the link in **Chrome** → tap **⋮** → **Add to Home screen** / **Install app**.

It opens full-screen like a normal app.

---

## Adding a buddy later

1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**.
   - **Email:** `<their user id>@gymspotter.app` (lowercase letters and numbers only, e.g. `jake22@gymspotter.app`)
   - **Password:** `GymSpotter-<their 4-digit PIN>` (e.g. `GymSpotter-5831`)
   - Check **Auto Confirm User** → **Create user**.
2. Text them their **User ID** and **PIN** plus the app link.

The first time they sign in, they'll set their display name and can paste in all their old workouts. They show up on everyone's Buddies tab after that.

## Changing someone's PIN

Supabase → **SQL Editor** → **New query**, edit the two values, then **Run**:

```sql
update auth.users
set encrypted_password = extensions.crypt('GymSpotter-1234', extensions.gen_salt('bf'))
where email = 'jake22@gymspotter.app';
```

## Removing someone

Supabase → **Authentication** → **Users** → click the **⋯** next to them → **Delete user**. This permanently deletes their workouts, weigh-ins and photos too.

## Good to know

- **Free-plan pause:** Supabase pauses free projects after **7 days with no activity**. Regular logging keeps it awake. If it does pause, the app won't load data. Log in to supabase.com and click **Restore project**. Nothing is lost.
- **Limits:** the free plan gives 500 MB of database (millions of sets) and 1 GB of photo storage (about 3,000 pics, since the app shrinks each one to roughly 300 KB).
- **Estimated 1RM** uses the Epley formula: `weight × (1 + reps / 30)`. A single counts as-is, and sets over 12 reps are ignored. Only exercises named exactly **Squat** and **Bench Press** count toward the headline numbers.
- **Bodyweight exercises:** log as `0 x reps`. Weighted ones (like pull-ups with a plate) log the *added* weight, e.g. `45 x 9`.
