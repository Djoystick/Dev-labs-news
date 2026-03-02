# Dev-labs News

Telegram Mini App MVP for a Habr-like news feed, built with React, Vite, TypeScript, Tailwind CSS, shadcn-style UI primitives, Framer Motion, and Supabase.

## Status

Stage 1 is complete.

Included now:

- Vite + React + TypeScript scaffold
- React Router routes for `/`, `/post/:id`, `/admin/new`, `/admin/edit/:id`
- Tailwind CSS + typography + animation foundation
- shadcn-style local UI primitives (`button`, `card`, `input`, `sheet`, `skeleton`)
- Telegram WebApp bootstrap helpers with safe `ready()` / `expand()` calls
- Theme provider with manual dark mode toggle and Telegram theme variable sync
- Temporary seeded feed data marked with `TODO` until Stage 3 switches to Supabase queries
- Browser and Telegram environment badge in the footer

Not included yet:

- Real Supabase data queries
- SQL schema and RLS policies
- Admin CRUD
- Markdown editor
- Vercel deployment guide

## Assumptions Made In Stage 1

- The target folder was empty and had no `.git`, so the project was initialized locally with `git init -b main`.
- The provided remote was attached as `origin`: `https://github.com/Djoystick/Dev-labs-news.git`.
- A nearby local Telegram React/Vite project was used only as a bootstrap source for generic config shape. Product code was replaced for this project.
- Temporary seeded posts are acceptable for Stage 1 as long as they are clearly marked `TODO` and scheduled for replacement in Stage 3.

## Local Run

```bash
npm install
npm run dev
```

Open the local Vite URL in a browser.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Environment Variables

Create `.env` from `.env.example` when Stage 3 begins:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Current UI Result

- Sticky header with burger button, project title, search field, and theme toggle
- Left drawer for topic filtering
- Habr-like feed cards with motion and adaptive grid
- Post details route with editorial typography
- Scaffolded admin routes for create/edit

## Next Stage

Stage 2 will turn the scaffold into the full interactive layout layer:

- connect feed search and topic drawer to the finalized shared state shape
- add skeleton loading states and proper load-more behavior
- add polished empty states and responsive refinements
- expose the admin add button in the header flow
