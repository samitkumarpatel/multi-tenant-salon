CREATE TABLE IF NOT EXISTS salon_language_settings (
    salon_id UUID NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
    app VARCHAR(16) NOT NULL CHECK (app IN ('website', 'booking', 'dashboard')),
    enabled_languages VARCHAR(32) NOT NULL,
    default_language VARCHAR(2) NOT NULL CHECK (default_language IN ('en', 'da', 'sv', 'nb', 'fr', 'de')),
    PRIMARY KEY (salon_id, app)
);
