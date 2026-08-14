ALTER TABLE staff_member DROP CONSTRAINT IF EXISTS staff_member_salon_id_fkey;
ALTER TABLE staff_member ADD CONSTRAINT staff_member_salon_id_fkey
    FOREIGN KEY (salon_id) REFERENCES salon(id) ON DELETE CASCADE;

ALTER TABLE service_item DROP CONSTRAINT IF EXISTS service_item_salon_id_fkey;
ALTER TABLE service_item ADD CONSTRAINT service_item_salon_id_fkey
    FOREIGN KEY (salon_id) REFERENCES salon(id) ON DELETE CASCADE;
