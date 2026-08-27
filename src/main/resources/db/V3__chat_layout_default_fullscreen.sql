-- The Generative-UI chat now opens fullscreen by default. Salon admins can still choose the
-- windowed layout ("windowed") in the Chat Window Design panel. The historical value 'app' is
-- treated as "not chosen" by the frontend and renders fullscreen, so no data backfill is needed.
ALTER TABLE salon_website_theme ALTER COLUMN chat_layout SET DEFAULT 'fullscreen';

-- Default website/chat font is now "Noto Sans KR" (a Google Fonts family). Existing rows keep
-- whatever the admin chose; this only affects rows created without an explicit font_family.
ALTER TABLE salon_website_theme ALTER COLUMN font_family SET DEFAULT 'Noto Sans KR';
