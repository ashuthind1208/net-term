# Net Term Solutions

React and Express reconstruction of the Net Term Solutions workspace, backed by PostgreSQL and Google OAuth.

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `SESSION_SECRET`.
2. Create the PostgreSQL database named in `DATABASE_URL`.
3. Run `npm run db:migrate`.
4. Run `npm run dev`.
5. Open `http://localhost:5173`.

If port `3001` is already occupied, change `PORT`, `VITE_API_URL`, and the Google callback URL to the same available API port.

## Google OAuth

Create an OAuth 2.0 web client in Google Cloud Console. Add `GOOGLE_CALLBACK_URL` as an authorized redirect URI, then set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in `.env`. Set `VITE_REQUIRE_AUTH=true` to gate the frontend behind Google sign-in.

For visual development without OAuth, keep `VITE_REQUIRE_AUTH=false`. To exercise protected APIs locally, set `DEV_AUTH_BYPASS=true` only outside production and seed a user matching `DEV_USER_ID`.

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
