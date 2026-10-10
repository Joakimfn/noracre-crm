# Outbound sales in Noracre

The outbound workspace is an **opt-in layout for client organizations**. Existing customer management and the original Ringelister workflow are preserved.

## Activation
- When the owner/partner creates a new customer organization under Drift, the checkbox **Denne kunden driver med outbound sales** sets `organizations.outbound_enabled`.
- An existing organization administrator can enable or disable outbound in **Ringelister > Outbound sales > Innstillinger**.
- The user needs an active Ringelister seat to work with the prospecting list. Admins must provision the Ringelister module/seats under existing pricing; outbound does not automatically create or silently charge for new licenses.
- Users can switch back to **Vanlig ringeliste** at any time.

## Core daily workflow
1. Open Ringelister and create/import a list, using the current authorized country source.
2. Use the **Outbound sales** single-prospect workspace. See industry, municipality, employee count/range and a direct Google search link for a company contact. Noracre does **not** scrape personal contacts or auto-dial phones.
3. Choose call outcome, notes, decision-maker contact and optional callback date. Each call is an append-only event attributable to a membership. Missed calls and reached decision-makers get a 48-hour callback automatically if no date is entered.
4. Calls with booked meetings enter **Demo booket** pipeline automatically. Other deal stages are available: Demo completed, trial, proposal, won/lost.
5. Admins can reassign a prospect. A country + registered company number can have only one owner per tenant, even if imported into different lists. Company names alone are not a reliable legal identifier and are **not** used for globally locking leads without registered numbers.
6. **Reservert mot kontakt** suppresses the registered company across all lists for that tenant. Users cannot accidentally log normal calls to a suppressed company. This is not a substitute for compliance with national DNC/TPS/Bloctel or data-protection rules.
7. Reports show 7-day attempts, decision-maker conversations, meetings, funnel stages, per-rep performance and manually confirmed cash received. Company name and legal registration number from a won lead are matched with a newly created customer organization for attribution.
8. Only managers can record **confirmed received payments**. Payment references are unique within each tenant; repeat receipts can be registered with a new reference. Commission is calculated on **confirmed received cash**, not on deals marked won or projected monthly recurring revenue. This feature is not an accounting ledger, billing integration, Stripe verification or authorization to pay salary/commission automatically.

## Tenant safety / security
- All server calls authenticate via `requireTenant`, use organization ID server-side and validate selected list access.
- Non-management users need the Ringelister license and cannot see another salesperson's assigned company. Managers can reassign within their organization.
- Organization IDs, country codes, registration numbers and source IDs remain distinct to prevent cross-country mixups.
- Manager-controlled pitch, currency, time zone and commission percentage are scoped to each organization.
- Raw invoices and private payment credentials are never uploaded or retrieved.

## First release limitations
- Outbound depends on the existing Ringelister module and licenced user seats.
- Contact lookup is a Google search link; there is no VOIP/power dialer integration, automatic call recording or contact data purchase.
- Payment confirmation is a manual manager attestation, not an automated bank/Stripe invoice verification.
- The lead view is paginated at 150 entries per request. Metrics use aggregated database queries, not estimated browser-visible totals.
- Non-native language default playbooks are editable, and laws governing lawful B2B contact are country-specific. Respect consent, suppression and employee privacy; do not use prohibited public bulk company datasets.
- Customers newly selecting outbound still need to create/import leads and activate Ringelister seats before using outbound. No automatic charge is made by this opt-in flag.

## Tests
`node --test tests/outbound-sales-workspace.test.mjs` exercises SQLite schema migrations, organizational separation, unique lead ownership, repeat call history, do-not-contact uniqueness, payment deduplication and source-code wiring.
