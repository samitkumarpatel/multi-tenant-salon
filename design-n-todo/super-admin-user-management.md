# Customer and user visibility: administration scope

Status: implementation and verification, 2026-10-27.
The user confirmed the earlier V28 migration has only run locally/in tests. Its unreleased definition is simplified directly; no shared/production migration history is being changed.

## Responsibility split

| Capability | Salon admin (current salon owner) | Super-admin |
| --- | --- | --- |
| Customer profiles/history | View and manage within owned salon | Read-only visibility across salons |
| Customer erasure | Existing salon-scoped customer deletion, with dependency safeguards | No customer erasure through platform privileges |
| Staff profiles/roles/status/offboarding | Existing staff controls within owned salon | Read-only staff details and user-identity links |
| User identities and effective roles | No global identity editor | Detailed read-only directory and relationships |
| Generic email-wide revocation/global user erasure | Not delegated | Removed from the product and backend |
| Ownership transfer and salon enable/disable | Existing rules | Remain distinct platform responsibilities |

A super-admin who independently owns a salon can still manage that salon through owner authority. Platform super-admin status alone does not authorize customer/staff writes.

## Implementation

- Super-admin Users API exposes list/detail GET endpoints only. Its user and staff screens have no creation, edit, removal, or permanent-ban controls.
- Super-admin retains raw/effective roles, source statuses, reverse salon links, and customer contact/history.
- Backend authorization enforces owner-only customer/staff writes, including direct requests and encoded paths. Existing desk-staff endpoint exceptions remain bounded to their established capabilities.
- `V28__user_access_management.sql` now creates only the read-only `managed_user_grant` projection. It does not create blocking/audit tables, triggers, or removal functions.
- Removed obsolete blocking calls, removal DTOs, audit/filter UI, and request-lock machinery from the retired workflow. No live authorization depends on a new ban table.
- Live owner/staff/super-admin checks query current `user_identity` grants. Removing/deactivating staff, changing ownership, or disabling a salon therefore invalidates stale privileges even if a JWT remains unexpired.
- Customer erasure continues to anonymize that salon's history and clear current customer sign-in credentials. Review links for anonymized customers cannot be used to submit new ratings.

## Why generic removal is not delegated to owners

An email can simultaneously be a customer, stylist, owner, and platform administrator across several salons. An all-role/global operation would give an owner authority over unrelated identities.

Existing domain controls are narrower: staff offboarding removes the salon's staff grant; customer deletion erases its customer data/current credentials. Neither changes another salon or a platform-admin grant.

Customer erasure is not a permanent ban. A dedicated tenant ban would require a separately designed customer/staff capability restriction and restore/audit rules. It is not included in the current scope.

## Verification criteria

- Read-only cross-salon directory, role details, and customer history remain available to super-admin.
- Retired mutation endpoints fail without changing people records.
- Platform-only super-admins cannot create/update/delete staff or customers through owner API requests.
- Current salon owners retain their scoped controls; unrelated salons and platform grants remain unchanged.
- Removed/inactive staff and replaced owners cannot reuse stale privileges; disabled salons do not remain accessible through encoded staff routes.
- Fresh schema contains the directory view and no removal tables/functions/triggers; schema registration and startup are tested.
- Frontend builds/typechecks, browser checks, full backend tests, and Modulith boundary verification pass.

Private staff-feedback/reply work remains a separate plan in `staff-feedback-and-salon-replies.md`; it has not been implemented.
