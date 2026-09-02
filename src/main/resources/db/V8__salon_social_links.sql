-- Salons can publish links to their social profiles. Each platform has a URL plus an
-- independent visibility flag: the owner opts a platform into the public website footer
-- per-platform, and a visible platform with no URL yet renders as a disabled icon.
-- Embedded on the salon aggregate alongside the other contact_* columns (nullable, so an
-- otherwise-empty ContactInfo still maps to null).
ALTER TABLE salon
    ADD COLUMN IF NOT EXISTS contact_facebook           VARCHAR(500),
    ADD COLUMN IF NOT EXISTS contact_facebook_visible   BOOLEAN,
    ADD COLUMN IF NOT EXISTS contact_instagram          VARCHAR(500),
    ADD COLUMN IF NOT EXISTS contact_instagram_visible  BOOLEAN,
    ADD COLUMN IF NOT EXISTS contact_tiktok             VARCHAR(500),
    ADD COLUMN IF NOT EXISTS contact_tiktok_visible     BOOLEAN,
    ADD COLUMN IF NOT EXISTS contact_youtube            VARCHAR(500),
    ADD COLUMN IF NOT EXISTS contact_youtube_visible    BOOLEAN,
    ADD COLUMN IF NOT EXISTS contact_x                  VARCHAR(500),
    ADD COLUMN IF NOT EXISTS contact_x_visible          BOOLEAN;
