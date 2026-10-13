-- The custom "Open in Maps" link is a location fact, so it moves from the website theme
-- (design panel) to the salon's location (Edit salon → Location).
-- These scripts re-run on every startup (spring.sql.init), so this is written to be idempotent:
-- copy any theme link onto the salon, then blank the theme column so a later run copies nothing
-- (and can't resurrect a link the owner has since cleared). salon_website_theme.maps_url is kept
-- as an unused legacy column — dropping it would break the UPDATE on the next run.
ALTER TABLE salon ADD COLUMN IF NOT EXISTS maps_url TEXT;

UPDATE salon s
SET maps_url = t.maps_url
FROM salon_website_theme t
WHERE t.salon_id = s.id
  AND NULLIF(TRIM(t.maps_url), '') IS NOT NULL
  AND s.maps_url IS NULL;

UPDATE salon_website_theme SET maps_url = NULL WHERE maps_url IS NOT NULL;
