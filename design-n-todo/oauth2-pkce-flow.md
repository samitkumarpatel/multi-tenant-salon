# Frontend OAuth2 PKCE Login & Silent Token Renewal

This document covers how the three staff/owner-facing frontend apps —
`salon-staff`, `salon-admin`, and `salon-super-admin` — authenticate against
the auth server and keep the user signed in without a refresh token. The
`salon-staff` app is the reference implementation; `salon-admin` and
`salon-super-admin` mirror it exactly (same function names, same message
protocol, same timing), differing only in their client ID, storage key
prefixes, and what they do with the identity once it's resolved.

Not covered here: the customer-facing apps (`salon-booking`,
`salon-public-website`, `salon-onboarding`), which don't authenticate a user
at all.

---

## Two modes: `mock` vs `oauth2`

Each app picks its auth mode once, at module load, in `app/lib/auth.ts`:

```ts
export const AUTH_MODE: "mock" | "oauth2" =
  (import.meta.env.VITE_AUTH_MODE as "mock" | "oauth2" | undefined) ??
  (import.meta.env.DEV ? "mock" : "oauth2");
```

- **`mock`** — the default under `react-router dev` (local, unbuilt). A
  fake email + dummy-OTP (`123456`) flow so the app works offline without a
  running auth server.
- **`oauth2`** — the default for any real build (`react-router build`,
  deployed anywhere). Real Authorization Code + PKCE against the auth
  server.

Either can be forced with `VITE_AUTH_MODE=mock` or `VITE_AUTH_MODE=oauth2`
regardless of dev/build. Everything below describes `oauth2` mode; `mock`
mode never touches the auth server or `localStorage` token storage.

---

## Per-app identity

| | `salon-staff` | `salon-admin` | `salon-super-admin` |
|---|---|---|---|
| `client_id` | `salon-staff` | `salon-admin` | `salon-super-admin` |
| `redirect_uri` | `{STAFF_APP_URL}/login` | `{ADMIN_APP_URL}/login` | `{SUPER_ADMIN_APP_URL}/login` |
| `sessionStorage` session key | `staff-session` | `admin-session` | `super-admin-session` |
| `localStorage` token key | `staff-oauth2-token` | `admin-oauth2-token` | `super-admin-oauth2-token` |
| `sessionStorage` PKCE verifier key | `staff-pkce-verifier` | `admin-pkce-verifier` | `super-admin-pkce-verifier` |
| Identity resolution after token exchange | `GET /api/salon-staff/me` (bearer-authenticated, no email on the wire) — one or more staff accounts | `GET /api/salon-admin/my-salons` (bearer-authenticated) — one or more salons | Just the `sub` claim from `/userinfo`, gated to a single hardcoded `SUPER_ADMIN_EMAIL` |
| Multi-result UX | Account picker if the person has staff rows at >1 salon | Salon picker if the owner has >1 salon | N/A — single fixed account |

All three redirect to the auth server's `/oauth2/authorize`, exchange at
`/oauth2/token`, and resolve identity via `/userinfo` — same endpoints,
same request shapes, only `client_id`/`redirect_uri`/`scope` differ.

`scope` defaults to `openid profile` for all three, and the auth server base
(`VITE_AUTH_SERVER_URL`, default `https://auth.salonsaas.org`) is shared
across apps.

---

## Fresh login: Authorization Code + PKCE

1. **User clicks "Sign In"** on `/login`. The app calls `startOAuth2Login()`:
   - Generates a PKCE `verifier` (two concatenated random UUIDs, dashes
     stripped) and its `challenge` (`base64url(SHA-256(verifier))`).
   - Stores the verifier in `sessionStorage` (per-app key above) — it's
     needed again in step 4 but must never leave the browser.
   - Redirects the whole tab to:
     ```
     {AUTH_SERVER}/oauth2/authorize
       ?response_type=code
       &client_id={CLIENT_ID}
       &redirect_uri={APP_URL}/login
       &scope=openid profile
       &code_challenge={challenge}
       &code_challenge_method=S256
     ```
2. **User authenticates** at the auth server (whatever it presents — its
   own login form, an OTT/passwordless flow, etc. — this repo doesn't
   control that UI).
3. **Auth server redirects back** to `{APP_URL}/login?code=...` (or
   `?error=...&error_description=...` on failure).
4. **App exchanges the code for a token set.** Back on `/login`, a `useEffect`
   picks up `?code=` from the URL and calls the app's login-completion
   function (`fetchOAuth2StaffOptions` / `completeOAuth2Login`), which:
   - Reads the verifier back out of `sessionStorage`.
   - `POST {AUTH_SERVER}/oauth2/token` with
     `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`,
     `code_verifier` (form-encoded).
   - Persists the returned `{ access_token, id_token, expires_in, ... }` to
     `localStorage` under the app's token key.
   - Clears the now-spent PKCE verifier from `sessionStorage`.
5. **App resolves identity.** `GET {AUTH_SERVER}/userinfo` with
   `Authorization: Bearer {access_token}` returns `{ sub: email }`. Each app
   then does its own thing with that email:
   - **staff**: calls `GET /api/salon-staff/me` (the access token — not the
     email — authenticates the call; the server derives identity from the
     bearer token). Zero results → error. One result → sign straight in.
     Multiple → render an account picker.
   - **admin**: calls `GET /api/salon-admin/my-salons`. A 404 is caught and
     rethrown as `NoSalonFoundError`, which the login screen turns into a
     "create your salon" prompt instead of a generic error. One salon →
     go straight to it. Multiple → salon picker (`/salons`).
   - **super-admin**: compares `sub` against a hardcoded
     `SUPER_ADMIN_EMAIL`. Any other value throws — the token is **not**
     persisted in that case, so a non-super-admin token never lands in
     `localStorage` even transiently.
6. **App writes its session** to `sessionStorage` (`buildStaffSession` /
   `setAdminSession` / `setSession`) and navigates into the authenticated
   area, replacing the `?code=...` URL with a clean one
   (`window.history.replaceState`) so a reload can't replay a spent code.

`getXSession()` (the session reader every route relies on) treats a session
as absent unless a **still-valid** access token also exists — so an expired
token silently logs the user out from the app's point of view even if the
`sessionStorage` blob is technically still there.

---

## Keeping the access token alive: silent renew via hidden iframe

These are public clients (SPAs, no client secret), so the auth server issues
**no refresh token**. Instead, the access token is kept alive by quietly
repeating the *same* Authorization Code + PKCE dance in a hidden `<iframe>`,
relying on the session cookie the auth server set during the visible login
in step 2 above. As long as that cookie is alive, the iframe round-trip
succeeds with no UI and no user interaction. All of this lives in
`startSilentRenewLoop` / `silentRenew` / `handleSilentRenewCallback` /
`isSilentRenewFrame` in each app's `lib/auth.ts`.

### Where the loop runs

`startSilentRenewLoop(onRenewed, onRenewFailed)` is called once, in a
`useEffect`, from every top-level authenticated screen — the shell that's
mounted for as long as the user is signed in:

- **staff**: `/portal` layout (`routes/layout.tsx`) — the single shell all
  portal routes nest under.
- **admin**: both `routes/salons.tsx` (the pre-pick salon picker) and
  `routes/layout.tsx` (the per-salon `:salonId` shell), since admin has two
  separate top-level authenticated screens rather than one shared shell.
- **super-admin**: both `routes/home.tsx` (the all-salons dashboard) and
  `routes/salon-layout.tsx` (the per-salon `:salonId` shell), for the same
  reason.

It's a no-op in `mock` mode and returns a cleanup function that cancels the
pending timer on unmount.

### The loop, step by step

8. **Schedule.** `scheduleNext()` reads the current access token's `exp`
   claim (`getAccessTokenExpiry()`, epoch ms) and sets a `setTimeout` for
   `expiry - now - RENEW_MARGIN_MS` (60s margin — fires a minute before the
   token would actually expire). No valid token → nothing scheduled (signed
   out, or mock mode).
9. **Fire.** When the timer elapses, `silentRenew()` runs:
   - Generates a **new** PKCE verifier/challenge pair (independent from the
     one used at fresh login) and stashes the verifier in `sessionStorage`.
   - Creates a `display:none` `<iframe>` and points its `src` at
     `{AUTH_SERVER}/oauth2/authorize?...&prompt=none` — same params as fresh
     login, plus `prompt=none` to signal "don't show any UI, just use the
     existing session."
10. **Iframe loads `/oauth2/authorize` inside the auth server's own origin.**
    Because the AS session cookie from the original login is still valid,
    the auth server 302s straight back to `redirect_uri` with a fresh
    `?code=...` — no login form rendered. (If the cookie has died, Spring's
    authorization server doesn't reliably honor `prompt=none`/
    `login_required` the way the spec suggests, so it may render its login
    page inside the iframe instead of erroring cleanly — see the timeout
    fallback in step 13.)
11. **Iframe navigates to `{APP_URL}/login?code=...`** — the *same* `/login`
    route the visible tab uses. Its `OAuth2Login` component's `useEffect`
    calls `isSilentRenewFrame()` first thing:
    ```ts
    export function isSilentRenewFrame(): boolean {
      return typeof window !== "undefined" && window.self !== window.top;
    }
    ```
    Because this render is happening inside the hidden iframe, `window.self
    !== window.top` is true, so it hands off to
    `handleSilentRenewCallback()` **before** touching any visible-tab state
    (account picker, salon redirect, etc.) or this frame's own session.
12. **`handleSilentRenewCallback()` exchanges the code for a token** —
    the exact same `exchangeCodeForToken(code, verifier)` call fresh login
    uses — persists it to `localStorage` (overwriting the old token under
    the same key), clears the verifier, and reports back to the parent tab
    via `postMessage`:
    ```ts
    window.parent.postMessage({ type: SILENT_RENEW_MESSAGE, ok: true }, window.location.origin);
    ```
    `SILENT_RENEW_MESSAGE` is a per-app string constant (e.g.
    `"salon-admin-oauth2-silent-renew"`) so messages from one app's iframe
    can't be mistaken for another's if multiple portals are open. Any
    failure (missing code, missing verifier, failed exchange) posts
    `{ ok: false }` instead of throwing into the void.
13. **Parent tab resolves the renew.** Back in the visible tab,
    `silentRenew()`'s `postMessage` listener (origin-checked) resolves its
    promise `true`/`false` and tears down the iframe. There's also an
    `SILENT_RENEW_TIMEOUT_MS` (8s) fallback timer — if nothing comes back
    in time (e.g. the auth server rendered a real login page instead of
    redirecting, per step 10's caveat), it resolves `false` rather than
    hanging forever.
    - **`true`** → `startSilentRenewLoop` re-reads the new expiry, calls
      `onRenewed(newExpiry)` (each screen uses this to update a `tokenExpiry`
      React state driving the header's `SessionBadge` countdown, plus a
      "Session renewed" toast), and calls `scheduleNext()` again — the loop
      repeats indefinitely.
    - **`false`** → the AS session cookie has actually expired.
      `onRenewFailed()` fires: each screen shows an error toast ("Your
      session expired — signing you in again…") and, after a short delay,
      calls `startOAuth2Login()` — a full, visible redirect through the
      real login flow (steps 1–6 above). The loop does **not** retry on its
      own past this point.

### Why a state variable, not a direct `getAccessTokenExpiry()` call

A silent renew rewrites `localStorage` but never touches React state on its
own — nothing re-renders when it happens. Every authenticated screen reads
`getAccessTokenExpiry()` **once** into `useState` on mount and only updates
it from `onRenewed`, specifically so the `SessionBadge` countdown reflects
the renewed expiry instead of counting down to the pre-renewal one and
flashing "Expired" every `RENEW_MARGIN_MS` window.

---

## Logout

`logout(navigate)` is mode-aware:

- **`oauth2`**: reads the `id_token` out of the stored token set, clears the
  local session (`sessionStorage` session + PKCE verifier keys,
  `localStorage` token key), then navigates the whole tab to the auth
  server's RP-initiated logout endpoint:
  ```
  {AUTH_SERVER}/connect/logout?post_logout_redirect_uri={APP_URL}/login&id_token_hint={id_token}
  ```
  This ends the AS session cookie too — which is what makes the *next*
  silent renew attempt (if any tab is still open) fail and fall back to a
  real login, rather than silently signing the user back in.
- **`mock`**: just clears local session state and navigates to `/login`.

---

## API-layer 401 handling

Independent of the renew loop, every authenticated fetch
(`lib/api.ts`'s `apiFetch`) attaches `Authorization: Bearer {access_token}`
when one is available and, on a `401` from an app-owned API prefix (in
`oauth2` mode), clears the session and hard-redirects to `/login` — a safety
net for the case where a request race outpaces the renew loop, or the
access token was invalidated server-side. This is unconditional and doesn't
attempt a silent renew inline; the scheduled loop above is the only thing
that proactively refreshes before expiry.
