CREATE TABLE IF NOT EXISTS super_admin (
    email  VARCHAR(255) PRIMARY KEY,
    active BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Rebuild view to include SUPER_ADMIN alongside OWNER and STAFF.
-- SUPER_ADMIN rows have salon_id = NULL (platform-wide, no salon affiliation).
-- Priority 0 ensures SUPER_ADMIN wins DISTINCT ON if the same email is also an OWNER or STAFF.
CREATE OR REPLACE VIEW user_identity AS
SELECT DISTINCT ON (email, salon_id)
    email,
    role,
    salon_id,
    active
FROM (
    SELECT
        email,
        'SUPER_ADMIN'  AS role,
        NULL::UUID     AS salon_id,
        active,
        0              AS priority
    FROM super_admin

    UNION ALL

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
        'STAFF'                                               AS role,
        sm.salon_id,
        s.status = 'ACTIVE' AND sm.status = 'ACTIVE'         AS active,
        2                                                     AS priority
    FROM staff_member sm
    JOIN salon s ON s.id = sm.salon_id
    WHERE sm.email IS NOT NULL
) combined
ORDER BY email, salon_id, priority;

INSERT INTO super_admin (email, active) VALUES ('admin@my-salon.online', true)
ON CONFLICT (email) DO NOTHING;
