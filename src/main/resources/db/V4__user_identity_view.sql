-- One row per (email, saloon_id) pair.
-- OWNER takes precedence over STAFF when the same email appears in both for the same saloon.
-- A multi-saloon owner gets one OWNER row per saloon.
-- A person who is OWNER of saloon A and STAFF of saloon B gets both rows.
-- Staff active = both the saloon and the staff member must be ACTIVE.
CREATE OR REPLACE VIEW user_identity AS
SELECT DISTINCT ON (email, saloon_id)
    email,
    role,
    saloon_id,
    active
FROM (
    SELECT
        owner_email          AS email,
        'OWNER'              AS role,
        id                   AS saloon_id,
        status = 'ACTIVE'    AS active,
        1                    AS priority
    FROM saloon
    WHERE owner_email IS NOT NULL

    UNION ALL

    SELECT
        sm.email,
        'STAFF'                                                   AS role,
        sm.saloon_id,
        s.status = 'ACTIVE' AND sm.status = 'ACTIVE'             AS active,
        2                                                         AS priority
    FROM staff_member sm
    JOIN saloon s ON s.id = sm.saloon_id
    WHERE sm.email IS NOT NULL
) combined
ORDER BY email, saloon_id, priority;
