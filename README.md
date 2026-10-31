# GUTECH Internal LMS

Responsive learning management system for administrators, teachers, and students, built with React, TypeScript, Express, and Supabase.

## Hosted Supabase setup

The LMS API connects to Supabase from the backend. The frontend calls the LMS API and does not need Supabase keys.

1. Create a Supabase project and open its **Connect** dialog for the project URL and publishable key. In **Settings > API Keys**, copy the project's secret key. The secret key is server-only and must never be exposed to the frontend or committed.
2. Copy `Backend/.env.example` to `Backend/.env`. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` to those dashboard values. Keep `CLIENT_ORIGIN=http://localhost:5173` for local development.
3. Apply the schema to a new, empty hosted project from the repository root with `npx supabase login`, `npx supabase link --project-ref <project-ref>`, then `npx supabase db push`. The project reference is shown in the Supabase dashboard URL. This deploys the migrations in `supabase/migrations/` without starting local Docker. Do not run `supabase/seed.sql` against a hosted project; it contains local demo accounts and passwords.
4. Set the Supabase Auth site's URL to `http://localhost:5173` and add `http://localhost:5173/reset-password` to its allowed redirect URLs.
5. Install dependencies from the repository root with `npm install`, then run `npm run dev` and open `http://localhost:5173`.

### Create the checker student

After applying the schema, create the email/password identity in **Authentication > Users** with **Add user > Create new user**. Confirm the email in the dashboard. Copy the user's UUID, then run this in **SQL Editor**, replacing the UUID placeholder:

```sql
insert into public.profiles
  (id, full_name, username, email, role, roll_no, is_active, must_change_password)
values
  ('<AUTH_USER_UUID>'::uuid, 'GUTECH Checker', 'gutechchecker',
   'gutechchecker@gmail.com', 'student', null, true, false);
```

There is no automatic profile trigger in this project: the Auth user must have a matching `public.profiles` row before LMS login will work. The `student` profile has no course enrollments until an administrator enrolls it.

`npm run db:reset` is for the local Supabase stack only. It is not the hosted migration command. For later schema changes, add migration files under `supabase/migrations/` and deploy them with `npx supabase db push`.

For an existing project with legacy keys, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are still accepted. New projects should use the publishable and secret keys. Never commit `.env` files or expose a secret/service-role key to the browser.

## Local Supabase setup

For a local database, install Node.js 20.19+, Docker Desktop, and the Supabase CLI. Copy `Frontend/.env.example` to `Frontend/.env.local` and `Backend/.env.example` to `Backend/.env`, configure the local Supabase URL and keys printed by `npx supabase start`, then run `npm run db:reset` to apply local migrations and demo seed data. The local database persists in its Docker volume between API and machine restarts; `npm run db:reset` explicitly drops and recreates local data.

The development accounts are `sufyanaliganatra@gmail.com` / `12345678` (admin) and `gutechchecker@gmail.com` / `gutechchecker` (student). To repair these two accounts in the same Supabase project configured for the API, run `npm run seed:users` with `NODE_ENV=development`. It updates their Auth password and profile in place, confirms the email, and activates the account. It refuses to run in test or production and never runs automatically when the API starts. Never point a production deployment at a development environment or use these credentials there.

Run `npm run db:apply-attendance` once per database to install attendance storage and access policies, then run `npm run seed:demo` to add six demo students, a demo teacher, three courses, enrollments, graded work, and attendance. Demo student accounts use the password `DemoCampus123!`. The attendance migration helper requires a valid `SUPABASE_DB_URL` from the database connection details; the API URL and service key alone cannot apply schema changes.

## Included workflows

- Username or email login, logout, password recovery, forced password changes, and profile management.
- Admin-managed accounts, courses, teacher assignments, student enrollments, CSV enrollment preview/import, and audit history.
- Course libraries with private, signed resource downloads and upload progress.
- Assignment publishing, student submissions, grading, timed quizzes, and student marks.
- Course announcements, read state, member chat, and complaint submission/status updates.
- Role checks on API requests, Zod request validation, pagination, Supabase RLS, and private storage policies.

## Workspaces

- `Frontend/`: React + Vite single-page app.
- `Backend/`: Express API.
- `supabase/`: local Supabase configuration, migrations, and seed data.
- `docs/ASSUMPTIONS.md`: implementation choices where the spec leaves behavior open.

## Commands

- `npm run dev` — run the web app and API.
- `npm run typecheck` — check both TypeScript workspaces.
- `npm run lint` — lint the API and web app.
- `npm test` — run API and frontend unit/route tests.
- `npm run build` — build both applications.
- `npm run db:reset` — reset local Supabase and seed the demo data.
- `npm run seed:users` — repair the two local development accounts without resetting other data.
- `npm run seed:demo` — add/update demo students, courses, enrollments, marks, and attendance.
- `npm run db:apply-attendance` — apply the attendance schema to the configured development database.
- `npm run bootstrap:admin --workspace Backend` — create the initial admin from the `BOOTSTRAP_ADMIN_*` values in `Backend/.env` after the username migration is applied.

Supabase migrations have not been applied in a hosted project. Configure credentials first, then run local or hosted migration deployment as appropriate.
