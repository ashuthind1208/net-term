# Net Term Solutions

React and Express reconstruction of the Net Term Solutions workspace, backed by PostgreSQL and Google OAuth.

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `SESSION_SECRET`.
2. Create the PostgreSQL database named in `DATABASE_URL`.
3. Run `npm run db:migrate`.
4. Run `npm run dev`.
5. Open `http://localhost:5175`.

For Supabase, use the Postgres connection string from the Supabase Connect dialog as `DATABASE_URL`. Supabase hosts and URLs containing `sslmode=require` automatically use TLS; `DATABASE_SSL=true` remains available for other hosted PostgreSQL providers.

Vite uses port `5175` with `strictPort` enabled so a development tunnel keeps the same public hostname. The Vite proxy automatically uses the API `PORT` from `.env`.

## Google OAuth

Create an OAuth 2.0 web client in Google Cloud Console and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The callback defaults to the first `CLIENT_URL` plus `/auth/google/callback`, so `GOOGLE_CALLBACK_URL` can normally remain blank.

For local development, authorize `http://localhost:5175/auth/google/callback`. When using a tunnel, put its URL first in `CLIENT_URL` and authorize that exact tunnel callback, for example `https://your-tunnel-5175.use.devtunnels.ms/auth/google/callback`. Google does not allow wildcard redirect URIs, so keep the Vite port fixed and use a persistent tunnel name.

In production, supply production `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CLIENT_URL`, and `SESSION_SECRET` through the hosting environment. Authorize `<production CLIENT_URL>/auth/google/callback` in the production OAuth client. Set `GOOGLE_CALLBACK_URL` only when the public callback origin differs from `CLIENT_URL`.

Set `VITE_REQUIRE_AUTH=true` to gate the frontend behind sign-in.

For visual development without OAuth, keep `VITE_REQUIRE_AUTH=false`. To exercise protected APIs locally, set `DEV_AUTH_BYPASS=true` only outside production and seed a user matching `DEV_USER_ID`.

## Persistent uploads

Set `UPLOADS_DIR` to an absolute writable directory outside the deployed application. Files are served through authenticated `/api/v1/uploads/*` URLs, so redeploying application source does not remove them. `UPLOAD_MAX_FILE_SIZE_MB` defaults to `25`.

For Hostinger account `u266483472`, use a directory under the account home rather than `public_html`, for example:

```env
UPLOADS_DIR=/home/u266483472/net-term-uploads
UPLOAD_MAX_FILE_SIZE_MB=25
```

Do not commit the production path or other production environment values to Git.

## Email relay

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_APP_PASSWORD` in `.env`. For Gmail, use `smtp.gmail.com` with port `465` and `SMTP_SECURE=true`, or port `587` with `SMTP_SECURE=false`. Use a Google app password rather than the account password.

Set `EMAIL_FROM_NAME` and optionally `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO`, and `EMAIL_AUDIT_TO`. Task creation, assignment, edits, status changes, completion, and deletion send branded HTML emails to current and previous assignees, the task creator, and the optional audit address. Task writes continue normally when SMTP is not configured.

## Commands

- `npm run dev`: start the React and Express development servers.
- `npm run build`: create the frontend production build.
- `npm test`: run API boundary tests.
- `npm run lint`: lint client and server code.
- `npm run check:server`: check server syntax.
- `npm run db:migrate`: apply the PostgreSQL schema.
- `npm run db:import-base44 -- <export-file>`: idempotently import an authorized Base44 entity export into PostgreSQL JSONB source records.

Imported source records preserve every source field in `source_records.payload`. Re-running an import updates records by entity type and source ID without creating duplicates.

The implementation backlog and acceptance criteria are in `PLAN.md`.
