-- One row per (email, salon_id) pair.
-- OWNER takes precedence over STAFF when the same email appears in both for the same salon.
-- A multi-salon owner gets one OWNER row per salon.
-- A person who is OWNER of salon A and STAFF of salon B gets both rows.
-- Staff active = both the salon and the staff member must be ACTIVE.
CREATE OR REPLACE VIEW user_identity AS
SELECT DISTINCT ON (email, salon_id)
    email,
    role,
    salon_id,
    active
FROM (
    SELECT
        owner_email          AS email,
        'OWNER'              AS role,
        id                   AS salon_id,
        status = 'ACTIVE'    AS active,
        1                    AS priority
    FROM salon
    WHERE owner_email IS NOT NULL

    UNION ALL

    SELECT
        sm.email,
        'STAFF'                                                   AS role,
        sm.salon_id,
        s.status = 'ACTIVE' AND sm.status = 'ACTIVE'             AS active,
        2                                                         AS priority
    FROM staff_member sm
    JOIN salon s ON s.id = sm.salon_id
    WHERE sm.email IS NOT NULL
) combined
ORDER BY email, salon_id, priority;
