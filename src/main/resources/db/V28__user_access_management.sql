-- Read-only directory across identity grants and salon customer relationships.
CREATE OR REPLACE VIEW managed_user_grant AS
 SELECT lower(btrim(email)) AS email, NULL::uuid AS salon_id, 'SUPER_ADMIN'::text AS role,
   NULL::text AS staff_role, active, NULL::bigint AS source_id FROM super_admin
 UNION ALL
 SELECT lower(btrim(owner_email)), id, 'OWNER', NULL, status = 'ACTIVE', NULL FROM salon WHERE owner_email IS NOT NULL
 UNION ALL
 SELECT lower(btrim(sm.email)), sm.salon_id, 'STAFF', sm.role, sm.status = 'ACTIVE' AND s.status = 'ACTIVE', sm.id
 FROM staff_member sm JOIN salon s ON s.id = sm.salon_id WHERE sm.email IS NOT NULL
 UNION ALL
 SELECT lower(btrim(c.email)), c.salon_id, 'CUSTOMER', NULL, s.status = 'ACTIVE', c.id
 FROM salon_customer c JOIN salon s ON s.id = c.salon_id
 UNION ALL
 SELECT h.email,h.salon_id,'CUSTOMER',NULL,s.status='ACTIVE',NULL
 FROM (SELECT DISTINCT lower(btrim(customer_email)) email,salon_id FROM booking
       UNION SELECT DISTINCT lower(btrim(customer_email)),salon_id FROM shop_order
       UNION SELECT DISTINCT lower(btrim(customer_email)),salon_id FROM membership_subscription
       UNION SELECT DISTINCT lower(btrim(customer_email)),salon_id FROM payment
       UNION SELECT DISTINCT lower(btrim(email)),salon_id FROM customer_session) h
 JOIN salon s ON s.id=h.salon_id
 WHERE h.email IS NOT NULL AND h.email<>'' AND h.email NOT LIKE '%@anonymized.invalid'
 AND NOT EXISTS (SELECT 1 FROM salon_customer c WHERE lower(btrim(c.email))=h.email AND c.salon_id=h.salon_id);

