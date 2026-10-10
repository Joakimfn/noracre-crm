-- Match the exact canonical registry expression used by outbound queries.
-- Keeps SIREN/SIRET deduplication and company-state lookups bounded per company.
CREATE INDEX IF NOT EXISTS outbound_entry_canonical_lookup
ON call_list_entries(organization_id, country, case when country = 'FR' and length(replace(replace(replace(replace(replace(replace(replace(replace(replace(upper(org_number), char(32), ''), char(9), ''), char(10), ''), char(13), ''), char(160), ''), char(8239), ''), char(8199), ''), '.', ''), '-', '')) in (9, 14) and replace(replace(replace(replace(replace(replace(replace(replace(replace(upper(org_number), char(32), ''), char(9), ''), char(10), ''), char(13), ''), char(160), ''), char(8239), ''), char(8199), ''), '.', ''), '-', '') not glob '*[^0-9]*' then substr(replace(replace(replace(replace(replace(replace(replace(replace(replace(upper(org_number), char(32), ''), char(9), ''), char(10), ''), char(13), ''), char(160), ''), char(8239), ''), char(8199), ''), '.', ''), '-', ''), 1, 9) else replace(replace(replace(replace(replace(replace(replace(upper(org_number), char(32), ''), char(9), ''), char(10), ''), char(13), ''), char(160), ''), char(8239), ''), char(8199), '') end);

CREATE INDEX IF NOT EXISTS outbound_lead_entry_updated
ON outbound_lead_state(organization_id, entry_id, updated_at DESC, id);
