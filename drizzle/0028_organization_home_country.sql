ALTER TABLE organizations ADD COLUMN home_country TEXT NOT NULL DEFAULT 'NO';
UPDATE organizations SET home_country = COALESCE(json_extract(operating_countries, '$[0]'), 'NO');
