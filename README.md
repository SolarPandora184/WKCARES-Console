# WKCARES Console — Phase 1

Vanilla HTML/CSS/JS + Firebase (Realtime Database + Auth), hosted on GitHub Pages.

## What's built (Phase 1)

- **Project architecture** — modular `css/`, `js/firebase/`, `js/utils/`, `js/components/`, `js/pages/`.
- **Firebase layer** — `config.js`, `auth.js` (login, invitation-only activation, password reset,
  forced reset, 30-min inactivity timeout, role helpers), `db.js` (staff/areas/bands/nets/invitations
  CRUD), `audit.js` (append-only audit log).
- **Login** (`login.html`) with friendly error handling and a timeout notice.
- **Account Activation** (`activate.html`) — validates a one-time invitation code + email, creates
  the Firebase Auth account, assigns the invited role, and permanently marks the invitation used.
- **Password reset** (`reset-password.html`) — self-service email reset and admin-forced reset flow.
- **Dashboard** (`index.html`) — live clock/date, quick stats, current-net-in-progress card,
  Chart.js attendance trend, recent nets, open emergency-traffic alerts, recent activity feed.
- **Weekly Net Form** (`new-net.html`) — the centerpiece page. Captures every field from the
  original paper form: Net Controller, Callsign, Date, Comments, Staff Check-ins (from the live
  roster), Alternate Bands (dynamic rows), Mountain & Metro Area grids (Green/Yellow/Red/Black
  with live row/column/grand totals), Guest Check-ins (unlimited dynamic rows), and Emergency
  Traffic (dynamic rows, gated by a "No emergency" checkbox). Every total updates live — nothing
  is calculated by hand. Autosaves to Firebase 800ms after any change, with a save-status indicator.
- **Firebase security rules** (`firebase-rules.json`) — role-based read/write, append-only audit log.
- **PWA shell** — `manifest.json` + `sw.js` (network-first with cache fallback for offline shell).
- **Admin Panel** (`admin.html`, admin role only) — tabbed console covering:
  - **Users** — spreadsheet-style table (Name/Callsign/Email/Role/Status/Last Login) with inline
    role changes, force-password-reset, and disable/re-enable per user.
  - **Invitations** — create, copy activation link/code, email (via `mailto:`), revoke, and
    regenerate a revoked or expired invitation.
  - **Staff / Areas / Bands** — editable rosters (add/edit/remove rows, then Save) that feed the
    Weekly Net Form's Staff Check-ins, Mountain/Metro grids, and Alternate Bands sections.
  - **Roles** — reference cards describing what each role is for.
  - **Audit Log** — searchable table of the last 500 recorded actions.
  - **Backups** — one-click export of every readable node (staff/areas/bands/nets/users/
    invitations/auditLog) as a downloadable JSON snapshot.
- **Settings** (`settings.html`) — per-user preference (synced to their own `/users/{uid}` record)
  for whether the top-right live clock shows on every page; on by default.

## Setup

1. `js/firebase/config.js` is already pointed at this project's Firebase app and Realtime Database
   (`ares-projects-default-rtdb`) — enable **Authentication (Email/Password)** and **Realtime
   Database** on that Firebase project if you haven't already.
2. Publish `firebase-rules.json` as your Realtime Database rules.
3. Seed one admin manually the first time (Firebase Console → Authentication → Add user, then add
   a matching `/users/{uid}` record with `role: "admin"`) — after that, all further accounts go
   through the invitation flow. The `role` value must be exactly the lowercase string `admin` —
   the Admin nav link and the security rules both key off it.
4. Push to a GitHub repo and enable GitHub Pages on the root of the `main` branch.

## Not yet built (next phases)

- **Historical Nets** page (browse/search/edit past nets)
- **Reports** (Weekly/Monthly/Yearly, PDF/CSV/Excel export, print view)
- **Statistics** page (Band Usage, Area Participation, Guests, Emergency Traffic, Staff Attendance charts)
- **Profile** page (the Admin Panel's own Users/Invitations/Staff/Areas/Bands/Roles/Audit
  Log/Backups tabs are done — see above; a self-service profile page for the signed-in user
  is still open)
- Global **search** across nets, staff, users, invitations
- Full offline data sync (Realtime Database's `enablePersistence`), install prompt for the PWA

Tell me which of these to build next and I'll continue in the same architecture.
