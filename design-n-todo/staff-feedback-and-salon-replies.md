# Staff feedback, salon replies, and customer review entry points

Status: planning and repository audit only; no feature implementation in this change.
Date: 2026-10-27.
Confirmed product choice: written customer feedback and salon replies are PRIVATE. Only the customer, authorized salon administrators, and the reviewed staff member may read them. Public pages continue to show aggregate stars and counts.

## What already exists

| Area | Current behavior | Evidence |
| --- | --- | --- |
| Completion trigger | A transition to `COMPLETED` issues a review invitation when the booking has a nonblank customer email. Repeating the same status returns without another event. | `booking/internal/BookingService.updateStatus` |
| Completion notification | The completion event is handled after commit and the email contains “Rate the salon and your stylist.” The link is `{bookingAppUrl}/review/{token}`. | `notification/internal/BookingNotificationListener`, `NotificationService.notifyBookingStatusChanged` |
| Delivery limits | Mailjet must be configured. Missing configuration logs/skips the send; blocked recipients and erased addresses are suppressed. Temporary provider failures use the event retry mechanism. This code audit does not establish production delivery of any particular email. | `NotificationService.dispatch` and recipient policy checks |
| Review credential | A random 32-byte token is issued; the rating table stores its SHA-256 hash and a 30-day expiry. One invitation row is kept per booking. | `rating/internal/RatingService.issueInvitation`, `db/V14__ratings.sql` |
| Customer form | `salon-booking` has `/review/:token`. It asks for salon and stylist stars, both 1–5. | `frontend/apps/salon-booking/app/routes/review.tsx` |
| Review storage | One row per booking contains salon ID, staff ID, salon stars, staff stars, and submission time. No comment or reply field exists. | `booking_review` |
| Eligibility | Token lookups/submission require a currently completed booking, unexpired invitation, and an unblocked customer identity. Duplicate inserts cannot create another row. | `RatingService.findReviewTarget/submitReview` |
| Public presentation | The public website loads aggregate salon and staff averages/counts. Its stylist cards already show stars or “No reviews yet.” | Public `website-shell.tsx`, shared `SalonWebsite.tsx` |
| Admin and staff apps | Neither app has a review inbox/detail route or review/reply APIs. | Existing admin/staff route configurations and rating controller |

Marking a booking paid, reaching its appointment end time, or recording a POS sale does not by itself trigger this invitation. The booking must actually be marked Completed. Staff profiles without a completed booking are not independently reviewable.

Existing tests check that completion publishes a status event and that notification handlers complete. The completion notification test constructs an event without a review token. Dedicated tests proving token creation, the real email URL/body, and successful end-to-end review submission are missing.

## Proposed customer experience

1. Keep verified-visit reviews: one review per completed booking, tied to the stylist who actually served that booking. A public profile is an entry point, not permission to review an arbitrary employee.
2. Add a shared review form to `@salon/ui-website`, used by both the public website and the existing booking-app review route. Keep all previously emailed links working.
3. On the public website, add a tenant-scoped `/review/:token` route and a completed-booking “Leave feedback” action in My account. The form identifies the salon, service/visit, and stylist; allows separate salon/stylist stars; and accepts an optional private comment about the visit/stylist.
4. Label the comment explicitly: “Private feedback — visible to the salon and your stylist.” Do not place comment text, replies, reviewer identity, or review lists in public aggregate/profile APIs.
5. A stylist-profile “Leave feedback” action takes the customer through sign-in and selects an eligible completed appointment with that stylist. If none exists, explain that feedback is available after a completed visit. Never accept a staff ID from the browser as proof of a visit.
6. Existing invite links remain valid for 30 days. Account-based submission uses the same eligibility window; propose measuring it from a stored completion time for new bookings. Do not silently reopen review eligibility indefinitely through an account endpoint.
7. After submission, My account shows the submitted stars/comment and any salon reply. Submitted reviews remain readable there after the invitation expires. For already-submitted/expired/invalid/revoked links, show the appropriate state without offering a second vote.
8. MVP submissions are final: no customer edit/delete button. If later editing is required, add explicit revision history and rules rather than overwriting reviews invisibly. Existing star-only reviews show “No written feedback” and keep their original scores.
9. Network failures offer retry and preserve form input; do not label every network/server error as an expired link as the current booking review loader does.

A token form can work without an existing customer login. An account submission must validate `X-Customer-Session` server-side against the booking's salon and normalized customer email. Both paths call the same rating service and enforce the same unique-booking rule.

## Salon-admin experience

- Add `/:salonId/reviews` with a navigation item, overall salon/stylist summaries, a five-star distribution, and a paginated review inbox. Summaries reflect the full filtered dataset, not only the visible page.
- Filter by stylist, star score, submission date, and reply status. Each item shows its visit/service, reviewed staff member, salon/staff stars, private feedback, and response state. Provide a direct link to the related booking where permitted.
- Add a reviews shortcut to each staff detail/card so administrators can open that stylist's feedback directly.
- Reply as the salon, with clear attribution such as “Reply from Nordic Salon, on behalf of [stylist].” The reviewed stylist is fixed by the review. The actual signed-in administrator is recorded in an internal audit trail; never pretend the stylist personally authored it.
- MVP: one official salon reply per review, including reviews with stars but no comment. Allow an authorized administrator to correct that reply with version checking and an audit trail. Show updated time to the customer. No conversation thread or staff replies in this phase.
- Administrators cannot change customer stars/comments, fabricate feedback, delete unfavorable scores, or alter review attribution through the reply feature. Moderation/dispute handling is a separate policy/workflow if needed.
- Notify the customer once when the first reply is published. A wording correction should not repeatedly email them. The notification links to authenticated My account, not to an unlimited-life submission token, and should avoid putting the private comment into notification previews.

Current owner authorization maps to OWNER, with live super-admin oversight. A staff record whose operational role is MANAGER does not automatically gain owner privileges. Do not broaden the desk allowlist to permit reading all feedback or writing replies.

## Staff experience

- Add `/portal/reviews` to `salon-staff`, scoped to the currently selected staff membership/salon.
- Show their own average, count, star distribution, private feedback, visit/service date, and the salon's reply. A staff member must not see colleagues' reviews or salon-wide written feedback.
- Return a dedicated DTO with a limited customer display label. Do not include customer email, phone, payment details, internal booking notes, invitation credentials, or administrator identity data.
- This screen has no reply, edit, delete, moderation, resend, or customer impersonation controls. The API is read-only as well.
- The backend derives ownership from the validated JWT and current staff membership. Changing `staffId`, salon ID, query parameters, or browser storage must not grant access to somebody else's feedback. Inactive/removed staff lose access immediately, including with old JWTs.
- An owner using their own staff portal still sees this read-only presentation; their separate owner API permissions are not changed by the client they opened.

## Data model and module boundaries

1. Extend `booking_review` with an optional bounded private feedback field. Proposed maximum: 2,000 characters. Keep existing star checks and the booking primary key; preserve old rows unchanged.
2. Introduce a review reply table keyed by booking/review ID, with salon ID, reply body (proposed 2,000 characters), actual author identity, creation/update timestamps, and an optimistic version. Bind its salon/staff attribution to the existing review, not client-supplied identity fields.
3. Record reply revisions/audit entries and notification attempt/outcome data with restricted access. Do not expose internal author emails to customers or staff.
4. Add completion/invitation timestamps and invitation delivery state/attempt metadata where needed. Proposed states distinguish Pending, Provider accepted, Failed, Suppressed, Expired, and Submitted. Only report Delivered/Bounced if a verified provider callback actually establishes it.
5. Retain the existing public aggregate contract. Add separate explicit DTOs for admin review detail, own-staff reviews, customer-owned reviews, and anonymous token target/form state.
6. Add indexes for salon/staff/submission ordering and reply-status filtering. Use bounded page sizes and deterministic ordering (`submitted_at`, booking ID); avoid loading every review/comment for a summary.
7. Keep review storage and reply logic inside the rating module. Booking, customer-account, staff-portal, and notification modules should use public module APIs/events, never another module's internal repositories. Avoid adding a rating↔booking or rating↔customer dependency cycle.
8. Add the migration after the current V28 and register it in `application.yaml`. Schema scripts and any backfill must remain safe when reapplied. Use invitation creation time for existing eligibility rather than inventing historical completion timestamps or requesting reviews from all old bookings automatically.

## API outline

| Consumer | Proposed endpoint shape | Authorization |
| --- | --- | --- |
| Existing review links | Existing GET/POST `/api/public/rating/{token}`, extended compatibly for optional private feedback | Valid booking-bound token, expiry/eligibility checks, identity restriction checks |
| Public tenant review page | Tenant-scoped review target/submission, or equivalent shared handler with an enforced resolved salon ID | Token's booking salon must match the actual tenant; a client-supplied salon ID is not sufficient |
| Customer account | GET/POST `/api/salon/{salonId}/account/bookings/{bookingId}/review` | Current customer session plus booking ownership and submission-window checks |
| Salon admin | GET `/api/salon-admin/{salonId}/reviews`, detail, and summary | Live OWNER or permitted live SUPER_ADMIN, restricted to salon |
| Salon reply | PUT `/api/salon-admin/{salonId}/reviews/{bookingId}/reply` | Same owner authorization; request version required for updates |
| Invitation delivery/resend | Owner-only booking review-invitation status and explicit resend action | Same salon, completed/unreviewed/eligible booking, rate limit and reason/audit |
| Staff portal | GET `/api/salon-staff/{staffId}/reviews` and summary | Live caller owns that active staff record in its salon; no writes |

Exact route names should follow repository conventions during implementation. Do not add comments/replies to `/api/salon/{salonId}/ratings`, staff listing responses, chat/MCP tools, analytics payloads, or any endpoint under a broad permit-all rule.

For duplicate submissions, the same already-accepted payload can return a successful “already submitted” result; a conflicting payload must not replace it. Return explicit validation/eligibility states. A public host/token mismatch must not reveal private target data.

## Invitation and delivery gaps to close

- **Delivery visibility:** current completion sends have no booking-level review delivery status visible to an owner. Add attempts/status and an owner resend action; distinguish application queuing, provider acceptance, and actual delivery. No provider configuration currently means no real email.
- **Stable retries:** retry a committed invitation using its existing event/token generation. Re-completing a reopened booking can currently rotate the invitation hash. Specify generation/version rules so a delayed older email cannot silently invalidate the latest invitation or send a known-invalid link.
- **Resends:** explicit and rate-limited, never triggered on every page load. They must not create another vote or reopen an already-submitted review. If a token is rotated, invalidate old credentials deliberately and suppress outdated queued sends. Automated reminders are optional follow-up work, not required for the MVP.
- **No-email bookings:** current code issues no invitation. Allow a verified email captured through an authorized contact-correction flow; do not assume a phone number proves an email identity. SMS-only review delivery is not currently implemented.
- **Completion semantics:** define which workflows mark the visit completed; payment alone is not completion. Do not automatically mark visits completed merely to obtain reviews. Cancelled/no-show/pending bookings are ineligible.
- **Wrong completion/reassignment:** an unsubmitted invitation must be revalidated if completion or served-staff attribution is corrected. Submitted scores remain associated with the originally reviewed visit/staff snapshot; do not transfer them silently to another employee or let status toggling remove negative feedback.
- **Domain routing:** use the verified salon custom domain/platform subdomain when the public website is available. Keep the booking-app review route as a compatibility/fallback path for old links and salons without STATIC_WEBSITE. Review availability must not depend on unrelated staff/services/theme/language fetches all succeeding.
- **Customer reply access:** expired submission links must not prevent authenticated customers from reading their own review/reply. Use account login for reply notifications; do not extend the submission credential simply to permit reading a reply.

## Privacy, access and edge-case rules

| Scenario | Required behavior |
| --- | --- |
| Customer has several completed bookings with one stylist | Select a specific visit; one review per booking, never one lifetime review per person/stylist. |
| Customer switches salon/opens another salon's hostname | No private review/reply data crosses salon boundaries; tenant mismatch rejects token use on that website. |
| Shared email or forwarded invitation | Explain that the invitation is a capability for that appointment. Account access follows the current email-based identity model; do not claim a stronger personal identity check. |
| Simultaneous account and token submissions | Shared service and database uniqueness admit exactly one review; counts remain correct. |
| Revocation/deletion while feedback is being submitted | Use the same canonical identity/scope locking convention as user removal. Recheck current access inside the mutation transaction, not only a token lookup before the write. |
| Disabled salon or revoked customer | Block new submissions/replies under the relevant policy; retain authorized administrative history. Do not send queued invitations/reply notifications to blocked identities. |
| Removed stylist | Preserve historical review attribution/de-identified references; deny their old staff login. Do not cascade-delete historical feedback as a routine staff-removal side effect. |
| Customer erasure | Extend the existing erasure inventory to private comments/replies and identifying reply text/notifications. Define whether anonymous star contributions remain; do not leave identifying free text behind while claiming local erasure. |
| Concurrent administrator replies/edits | One official reply with version checks, clear conflicts, and audit history. |
| Provider timeout/retry | At-least-once email processing may result in duplicate email delivery; keep the credential/result stable and avoid claiming exactly-once delivery. |
| Malicious or very long feedback/reply | Validate server-side, cap size, render as escaped text, and rate-limit anonymous invalid-token traffic and resends. No raw HTML/Markdown execution. |
| Token in public-site URL | Exclude tokens and private content from analytics, error reports, logs, third-party referrers, caches, canonical tags and sitemaps. Use restrictive referrer policy; do not attach the normal page-path analytics tracker to the review route. |
| Existing star-only review | Preserve score/date/count; optional comment is absent, not an error. Admin may still reply; customer can read it in their account. |
| No ratings | Show “No reviews yet” and an empty state; never invent a 0-star average. |

Private feedback is not a public testimonial. No public comment/reply feed or public per-review “read more” API will be built under the confirmed choice.

## Implementation sequence

1. Add dedicated tests for the current completion→invitation→email URL→submission path, and confirm deployed sender configuration/delivery separately if operational access is available. Lock in legacy endpoint/form compatibility.
2. Add private feedback/reply schema, scoped read DTOs, eligibility/invitation state handling, and rating-module APIs. Integrate restrictions and erasure before exposing text endpoints.
3. Implement shared customer form, public tenant review route, authenticated completed-booking entry/action, and account review/reply display. Keep the legacy booking route usable. Make network/expired/used states distinct.
4. Add owner inbox, stylist filters/detail shortcut, official replies with version/audit protection, and customer reply notifications.
5. Add the own-staff read-only screen and strictly scoped GET APIs.
6. Add invitation status/resend controls, stable retry/version handling, translations, documentation, and deployment migration registration.

## Acceptance and verification

- PostgreSQL-backed tests prove a real Completed transition creates one invitation, and captured notification content contains a working review URL for both configured primary/fallback hosts. Confirm/no-show/cancel/no-email/repeated-complete paths do not generate inappropriate new invitations.
- Test both legacy star-only and new comment payloads; malformed/out-of-range/noninteger scores; text limits and escaped rendering; missing/expired/used/revoked credentials; and anonymous rate limits.
- Test private DTO access for owner, super-admin, own staff, another staff member, another salon owner, unauthenticated visitor, customer, and another customer. Staff write attempts must fail at the backend. Public aggregate/catalog/chat responses contain no comments, replies, or customer identity fields.
- Test account/token concurrency, reply update races, invitation rotation vs delayed mail, reopened/reassigned bookings, removal during a write, erasure of free text, disabled salons, and retained historical attribution.
- Browser checks cover admin inbox and reply, staff read-only views across selected memberships, email-token form and account form in both website modes, custom domains/legacy links, mobile layouts, keyboard star selection, validation, and network retry without lost input.
- Build/typecheck affected apps and shared packages; run affected integration tests and Modulith boundary verification. Validate indexes/query costs for review lists and summary counts.

Completion means a customer can review an eligible completed visit from either the website/account or emailed link; the salon can read and officially reply; only the reviewed staff member can read their own feedback; and private text never becomes publicly visible.
