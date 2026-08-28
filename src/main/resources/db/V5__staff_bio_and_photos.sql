-- Staff members gain an "About me" blurb and a gallery of work media (images and video).
-- `bio` is a free-text column on the aggregate; `staff_member_photo` is a child table of
-- URLs (same shape as staff_member_specialization — the *_key column preserves list order).
ALTER TABLE staff_member ADD COLUMN IF NOT EXISTS bio TEXT;

CREATE TABLE IF NOT EXISTS staff_member_photo (
  staff_member_id  BIGINT        NOT NULL REFERENCES staff_member(id) ON DELETE CASCADE,
  staff_member_key INTEGER,
  value            VARCHAR(1000) NOT NULL
);
