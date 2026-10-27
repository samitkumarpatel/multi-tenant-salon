# Per-user login audit history

Status: partial implementation. Customer code attempts and the Super Admin history view are implemented; trusted OAuth coverage remains planned.

## Outcome

Customers and Users detail pages in Super Admin show a read-only Login history table, newest first. Columns: date/time (with timezone), application, method, result, and salon when known. Use small result/method pills, pagination, and optional application/result/date filters. Keep raw diagnostics out of the default view. Show an explicit recording start date; do not imply historical coverage before collection begins.

## Current code and coverage

- Customer email-code verification and session creation live in `src/main/java/net/samitkumar/multi_tenant_salon/customer/internal/CustomerAuthService.java`. Existing code/session tables are in `src/main/resources/db/V24__customer_accounts.sql`; these operational records are not a complete audit history.
- `frontend/apps/salon-admin`, `salon-staff`, `salon-dashboard`, and `salon-super-admin` use OAuth2 through an external auth server. Their `app/lib/auth.ts` implementations include silent renewal. The auth server implementation is outside this repository; confirm its event/export capabilities before promising complete OAuth authentication history.
- `superadmin/internal/UserManagementController.java` and `UserManagementService.java` supply the user directory and detail endpoint. Identity currently joins on normalized email.
- `frontend/apps/salon-super-admin/app/routes/user-detail.tsx` is the shared entry point for viewing an individual's history from Customers or Users.

## Event model

Add a migration using the next available version and a shared backend audit writer. Store append-only events with:

- UUID event ID; source system and source event ID, with a unique constraint for ingestion deduplication.
- Occurrence and receipt timestamps in UTC.
- Verified issuer/subject when available, plus normalized email snapshot for current directory lookup. Treat an attempted email on a failed login as unverified; never present it as a verified action by the account owner. Define account/email-change mapping before moving beyond the current email identity model.
- Application/client ID, authentication method, event type, result, and a short controlled reason code.
- Nullable salon ID and role snapshot when actually known. Authentication at the provider can occur before salon selection; do not infer the selected salon or current role retrospectively.
- Optional correlation ID. Keep IP/user-agent collection out of the first version unless there is a defined administrative need, retention period, and trusted proxy policy.

Event types: LOGIN_SUCCEEDED, LOGIN_FAILED, APP_ACCESS_DENIED, SESSION_RENEWED, LOGOUT. Methods: CUSTOMER_EMAIL_CODE, OAUTH2, UNKNOWN. Record a more specific OAuth method only if the auth server supplies it. Roles such as CUSTOMER/SALON_OWNER/STAFF/SUPER_ADMIN describe access, not authentication methods.

Default history shows login attempts and application access denials. Renewal and logout can be exposed through an event-type filter. Browser mock login must not generate production audit events.

Index by identity/email and descending occurrence time plus event ID; support application/result/date filters without scanning the entire audit table.

## Implementation phases

1. **Storage and customer login.** Add the event model/writer and instrument customer verification success, wrong/expired code, throttling, and explicit session revocation. Preserve existing generic public error messages. Verify transaction boundaries so failed attempts remain recorded even when authentication throws, and successful audit events cannot survive a rolled-back session creation. Define durable retry/outbox behavior and monitoring for audit-write failures; do not silently drop events.
2. **Trusted OAuth event collection.** Integrate authenticated, replay-protected auth-server delivery or a checkpointed export. Collect success/failure with client ID, verified identity where available, and explicit renewal/SSO semantics. Deduplicate retries. Auth-server authentication success and application authorization success are separate outcomes. Record app access denials at trusted backend authorization boundaries, correlated where possible. Browser callbacks alone cannot provide complete or authoritative failed-login history. If provider integration is unavailable, label coverage as customer-only rather than claiming full login auditing.
3. **Read API.** Add a paginated `GET /api/salon-super-admin/users/login-history?email=...` with bounded page size, stable newest-first ordering, validated filters, and the existing live SUPER_ADMIN authorization policy. Return display fields and coverage metadata only. Do not expose this endpoint to salon owners or customers. Keep history lookup independent of active grants so retained events remain available when access is removed; the UI must support that case without requiring a successful current-user-detail response.
4. **Admin UI.** Add Login history beneath account details, using the same compact table/pills as the directory. Include loading, retry, empty, partial-coverage, and pagination states. Distinguish "No events recorded since [date]" from "Never logged in". Keep directory rows simple; optionally add Last successful login later through a batched backend query.

## Data handling and validation

Never record OTPs, magic links, authorization codes, PKCE verifiers, tokens, cookies, or raw authentication payloads. Use parameterized queries, server-derived identity/client metadata, and bounded controlled reason codes. Restrict runtime event updates/deletes except through a dedicated retention mechanism. Decide retention and account deletion/anonymization behavior before rollout; append-only history must not bypass those policies.

Required checks: customer success/failure/expiry/throttle persistence; rollback semantics; no secret leakage; OAuth delivery authentication, replay protection and deduplication; renewal excluded from login counts; identity/salon isolation; super-admin-only reads including inactive/deleted users; stable pagination/filtering; UI states and timezone rendering. Run focused backend integration tests plus Super Admin typecheck/build.

## Implemented customer slice

Migration `V29__login_audit.sql` stores customer code verification results. Customer successes are recorded after the session transaction commits; failed code checks are recorded in a separate transaction. The Super Admin user detail page reads paginated customer history and labels failed attempts as unverified. No OAuth events are recorded yet.

## Next starting point

Confirm access to the auth server event interface. Implement phase 1 and the read/UI path as a clearly labeled customer-login slice, then enable OAuth coverage only after trusted ingestion is verified. Existing sessions cannot reconstruct complete past login attempts; any historical import must be labeled with its source and coverage limits.
