-- Per-menu footer links on the public website: JSON map keyed by feature
-- ({"WEBSHOP":{"visible":false,"label":"Our shop"}, ...}). NULL = defaults (every enabled menu shown).
ALTER TABLE salon_website_theme ADD COLUMN IF NOT EXISTS footer_links TEXT;
