# Saved call lists and operating countries

Customer organizations store their operating countries as an array of ISO country codes. Existing organizations default to NO. Owners and partner administrators choose countries when creating customers; administrators can change them in the large saved-list manager, even without a personal call-list license. Partners always become the referrer of customers they create, cannot create new partner organizations, and gain no access to the customer's CRM.

New generated/imported lists are automatically saved with a supplied name or a dated default. Lists have a country; entries and resulting customers preserve that country and alphanumeric register identifiers. Users see their own lists, assigned lists, and the shared migrated legacy list. Administrators manage all lists in their own tenant. Delegation requires an active same-tenant member with a call-list license. Assignments retain the delegator's display-name snapshot and a durable acknowledgment; re-delegation produces a fresh notice. Deleting a list deletes its entries/history and assignments, but keeps CRM customers. A new search never deletes earlier lists.

## Sources and configuration

Credentials must be Worker secrets, never browser input or Git. Missing credentials return explicit unavailable status; no fallback to Brreg occurs.

| Country | Source | Required Worker configuration | Filters |
| --- | --- | --- | --- |
| NO | Brønnøysundregistrene | None | Existing Norwegian filters |
| GB | Companies House advanced company search | `COMPANIES_HOUSE_API_KEY` | Name, locality, SIC; active companies |
| IE | CRO CKAN datastore | None | Name, address/locality, NACE; normal status variants |
| AU | ABN Lookup JSON name service | `ABN_LOOKUP_GUID` | Name keyword, exact state/postcode; active current names |
| NZ | NZBN v5 entity search | `NZBN_API_KEY`, plus `NZBN_CALL_LISTS_APPROVED=true` only after this use is approved | Name; registered entities |
| NG | OpenCorporates Nigeria index, licensed only; manual CSV/XLSX import always available | `OPENCORPORATES_API_TOKEN` plus `OPENCORPORATES_COMMERCIAL_APPROVED=true` after appropriate commercial rights granted | Name keyword and count; only when configured |

Foreign sources do not promise phones, emails or employee counts. They never inherit hidden Norwegian employee/location/form filters. Ireland's attribution appears in the UI. NZ bulk data is not used: its agreement prohibits direct-marketing usage. Do not enable the NZ API prospecting gate merely because a key exists; obtain an explicit usage clearance first.

Official references:
- https://developer.company-information.service.gov.uk/overview
- https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/advanced-company-search/search
- https://opendata.cro.ie/dataset/companies
- https://opendata.cro.ie/api/3/action/help_show?name=datastore_search_sql
- https://abr.business.gov.au/json/
- https://abr.business.gov.au/Documentation/WebServiceRegistration
- https://portal.api.business.govt.nz/api/nzbn
- https://portal.api.business.govt.nz/content/NZBN%20reference%20data%20-%20March%202023.xlsx
- https://www.companiesoffice.govt.nz/data-services/ways-to-get-our-data/bulk-data-access-agreement/

## Migration and verification

Apply `drizzle/0027_saved_call_lists.sql` before deploying the new Worker. The migration is additive and preserves existing queue/history in a named shared list. UK, AU and NZ production calls require credentials and therefore cannot be live-verified until configured. Tests cover their documented payloads, country validation, tenant/user isolation, assignment acknowledgment/reassignment, partner creation, list deletion, preservation of customers, and exclusion of foreign customers from nightly Brreg refresh.

## Employee-count filtering

The queue now supports optional min/max employee-count filtering across all countries, operating on **known values** in saved lists, including imported files. Unknown counts are excluded from bounded filters by default; the user may opt in to showing unknowns. Filter visibility does not imply an upstream data source can search companies by headcount. Brreg remains the only registry in this integration with native employee-count search filtering. Country-specific search controls do not inherit hidden Norwegian employee fields.

Number inputs normalise unintended leading zeros. Explicit text identifiers (company numbers and telephone strings) and properly zero-padded dates and clock times are deliberately unchanged.

## Nigerian customer organizations

Nigeria can be selected as an operating country, with saved/imported lists, assignments, history and existing CRM workflow. This **does not** require CAC/OpenCorporates access. The automatic company-search button stays disabled until the commercial API token and licence-approval gate have both been configured as Worker secrets/settings. Do not enable the approval flag without appropriate subscription and permission to use the data in a proprietary sales CRM. The API key stays server-side. Search results with marketing-restriction flags are excluded. Additional Nigerian contact and employee data would require licensed enrichment rather than guessing from the company registry.

OpenCorporates documentation: https://knowledge.opencorporates.com/knowledge-base/api-authentication-authorisation/
