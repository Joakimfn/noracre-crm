-- Preserve official employee ranges separately from exact headcounts.
ALTER TABLE companies ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE companies ADD COLUMN postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE companies ADD COLUMN employee_range TEXT NOT NULL DEFAULT '';
ALTER TABLE companies ADD COLUMN employee_range_year TEXT NOT NULL DEFAULT '';
ALTER TABLE call_list_entries ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE call_list_entries ADD COLUMN postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE call_list_entries ADD COLUMN employee_range TEXT NOT NULL DEFAULT '';
ALTER TABLE call_list_entries ADD COLUMN employee_range_year TEXT NOT NULL DEFAULT '';
