# Dev-labs News

Telegram Mini App MVP for a Habr-like engineering news feed, built with React, Vite, TypeScript, Tailwind CSS, shadcn-style UI primitives, Framer Motion, Supabase Auth, Supabase Storage, and markdown content editing.

## Current Scope

Implemented now:

- React + Vite + TypeScript scaffold
- Telegram WebApp bootstrap helpers
- Dark mode toggle with Telegram theme sync
- Header, topic drawer, adaptive feed cards, motion, skeletons, empty state
- Supabase-backed topics loading
- Supabase-backed posts feed with `limit=12` and `Load more`
- Client-side search by post title over the already loaded list
- Post detail route rendered from markdown
- Unified `AuthProvider` for Supabase Auth + `profiles`
- Email/Password auth for local development
- Telegram auth exchange flow via Supabase Edge Function
- Profile page and admin route guard
- Bottom bar for Telegram-style mobile navigation
- Feed scroll restoration between the list and post detail pages
- Reading preferences stored locally for post typography and motion
- Favorites and reading history cleanup from profile settings
- Full admin CRUD for posts
- MDXEditor-based rich markdown editor
- Supabase Storage uploads for cover images and inline article images
- SQL files for schema, RLS policies, and seed data

Still pending:

- Vercel deployment section
- Final Telegram bot launch wiring

## Local Run

```bash
npm install
npm run dev
```

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Environment Variables

Create `.env.local` from `.env.example`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Frontend rules:

- Use only the public `anon` key on the frontend.
- Never put `service_role` into the web app.
- `.env.local` stays local and is already ignored by git.

Local storage keys used by the app:

- `dev-labs-news-theme`
- `dev-labs:reading:text-size`
- `dev-labs:reading:reduce-motion`
- `dev-labs:reading:text-width`
- `dev-labs:feed-state`

## Supabase Setup

### 1. Create project

1. Create a new Supabase project.
2. Open `Project Settings -> API`.
3. Copy `Project URL` into `VITE_SUPABASE_URL`.
4. Copy the public `anon` key into `VITE_SUPABASE_ANON_KEY`.

### 2. Enable Email auth

1. Open `Authentication -> Providers`.
2. Enable `Email`.
3. For local MVP, disable mandatory email confirmation if you want instant sign-in after registration.
4. If you keep confirmation enabled, the app still works, but the user must confirm email before logging in.

### 3. Apply database SQL

1. Open `SQL Editor`.
2. Run [supabase/schema.sql](./supabase/schema.sql).
3. Run [supabase/rls_policies.sql](./supabase/rls_policies.sql).
4. Run [supabase/seed.sql](./supabase/seed.sql) if you want starter content.

What this creates:

- `topics`
- `posts`
- `profiles`
- indexes
- `updated_at` trigger for posts
- `storage` bucket `posts`
- RLS for public read on feed data and protected writes for admins
- self-service profile read/update rules
- storage policies for public image reads and admin-only uploads/deletes

### 4. Configure Storage bucket

This MVP uses a public Storage bucket for post media:

- Bucket name: `posts`
- Read access: public
- Write access: admin only through storage policies

If the bucket was not created by SQL for any reason:

1. Open `Storage`.
2. Create bucket `posts`.
3. Mark it as `Public`.
4. Re-run [supabase/rls_policies.sql](./supabase/rls_policies.sql).

Why public read was chosen:

- simplest MVP flow for feed cards, cover images, and inline content images
- no signed URL refresh logic on the frontend
- storage writes still remain admin-only

### 5. Deploy Telegram auth Edge Function

Deploy the function from the project root:

```bash
supabase functions deploy telegram-auth
```

Set required secrets:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=your_bot_token_here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Notes:

- `TELEGRAM_BOT_TOKEN` is used only inside the Edge Function to verify Telegram `initData`.
- `SUPABASE_SERVICE_ROLE_KEY` is used only inside the Edge Function to create/update auth users and upsert `profiles`.
- `SUPABASE_URL` is available to Supabase Edge Functions automatically in hosted environments.

### 6. Assign admin role

After the target user signs in once and a matching `profiles` row exists, run:

```sql
update public.profiles
set role = 'admin'
where id = 'USER_UUID_HERE';
```

If the `profiles` row does not exist yet, insert it manually:

```sql
insert into public.profiles (id, role)
values ('USER_UUID_HERE', 'admin')
on conflict (id) do update
set role = excluded.role;
```

## Auth Architecture

Current auth flow:

- `AuthProvider` owns Supabase session, user, profile, loading state, and role checks.
- Email/Password uses standard Supabase Auth.
- After successful sign-in, the app fetches `profiles` by `auth.uid()`.
- If the profile row does not exist, the app creates it with role `user`.
- Telegram login uses `window.Telegram.WebApp.initData` and calls the `telegram-auth` Edge Function.
- The Edge Function verifies the payload, creates or updates a Supabase Auth user, upserts `public.profiles`, and returns technical credentials for MVP sign-in.

## Admin CRUD

Routes:

- `/admin/new` creates a post
- `/admin/edit/:id` edits and deletes a post

Form behavior:

- `title`, `topic_id`, and `content` are required
- `excerpt` is optional
- `cover_url` is populated automatically after cover upload
- editor content is stored in `posts.content` as markdown

Editor behavior:

- headings
- lists
- quotes
- links
- code blocks
- image insertion
- preview/source toggle

Storage behavior:

- cover image upload saves to `posts/covers/*`
- inline editor images save to `posts/inline/*`
- resulting public URLs are inserted into markdown or saved to `cover_url`

## Current UI Behavior

- Header shows `Sign in` when logged out.
- Header shows avatar menu when logged in.
- Avatar menu includes `Profile`, `Sign out`, and `New post` when the user is admin.
- Mobile layout includes a persistent bottom navigation bar for `Лента`, `Избранное`, and `Профиль`.
- Feed restores `topic/search` from the URL and `scrollY` from session storage after returning from a post.
- `/profile` includes tabs for profile, favorites, reading history, and local reading preferences.
- Profile settings can clear favorites and reading history for the current user.
- `/admin/new` and `/admin/edit/:id` are blocked in UI unless `profile.role = 'admin'`.
- Feed cards show cover, title, excerpt, topic, and date.
- Feed cards also show approximate reading time.
- Admin users get edit shortcuts in feed cards and on the post detail page.
- Post detail pages render markdown with `react-markdown` and `remark-gfm`, show breadcrumbs to the feed topic, and include a scroll-to-top action.

## Telegram Auth Notes

Current MVP behavior:

- The app shows `Sign in with Telegram` in the auth dialog.
- In a normal browser without Telegram `initData`, the app explains that Telegram sign-in requires opening the Mini App inside Telegram.
- Inside Telegram, the button posts `initData` to `telegram-auth`.
- The Edge Function verifies the payload and returns a technical email/password pair for sign-in.

This keeps the frontend architecture ready for a future production migration to direct token/session issuance if needed.
