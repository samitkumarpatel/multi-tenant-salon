-- Default chat/website palette now matches the "Chat Window Design" reset state: a light neutral
-- page/chat background, a slate accent, and a pink avatar. Existing rows keep whatever the admin
-- chose; this only sets the fallback for columns inserted without an explicit value.
ALTER TABLE salon_website_theme ALTER COLUMN hero_bg       SET DEFAULT '#EEF2F4';
ALTER TABLE salon_website_theme ALTER COLUMN accent_color  SET DEFAULT '#4B5563';
ALTER TABLE salon_website_theme ALTER COLUMN logo_bg_color SET DEFAULT '#DB2777';
ALTER TABLE salon_website_theme ALTER COLUMN chat_bg       SET DEFAULT '#EEF2F4';
