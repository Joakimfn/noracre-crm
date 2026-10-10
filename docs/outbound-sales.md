# Outbound sales in Noracre

Outbound is optional for each customer organization. The owner or partner chooses it during customer creation; an organization administrator can change it under Ringelister → Outbound-salg → Innstillinger. The existing Ringelister license and agreed prices still apply. Enabling the layout does not purchase seats or change invoices.

## Daily work

Create or import a saved list using the existing country registers or file import. The outbound workspace shows one prospect, company information, phone/contact fields, notes, Google contact search, call outcomes and the next callback. A temporary reservation prevents simultaneous calling across tabs and duplicate imported companies. Calls are saved atomically and a repeated request does not create a second attempt.

Missed calls, switchboard conversations and positive conversations receive a 48-hour callback when no date is selected. Callbacks use the chosen organization time zone; overdue callbacks are prioritized before new prospects and are selected before pagination. The full dated history records seller, outcome, note and next action. Reassigned prospects keep their earlier company history.

Administrators distribute a chosen number of companies evenly among active licensed sellers, or reassign individual companies. A country and canonical registered company ID have one owner across lists. French SIRET establishments resolve to SIREN company identity. Without a registered ID, ownership and reservation apply to the individual entry; names alone do not establish legal company identity.

The pipeline supports Prospect, Demo booked, Demo completed, Trial, Proposal, Customer and Lost. Customer creation is available from the pipeline and the standard list. Creating a customer or choosing a stage does not confirm subscription activation or receipt of money.

## Results and commission

Reports use database aggregates for attempts, decision-maker conversations, booked meetings and meeting conversion over seven days. Completed demos and activated trials retain their milestones after later stage changes. Paying customers come from net confirmed receipts, with refunds applied. Organization administrators see the whole team, including historical sellers; sellers see their own results.

Only administrators may confirm a linked customer, subscription activation/cancellation, agreed commission rate and duration, received subscription amounts excluding tax, and refunds. The default commission is zero until an agreement is configured. A deal keeps its original seller and currency when a prospect is reassigned or organization defaults change. Payment references are case-normalized and unique within the organization.

Commission is calculated on received subscription cash within the agreed calendar-month period, including time-zone and month-end handling. Refunds retain the original seller, customer and currency and reverse the original earned commission exactly. Database constraints reject excessive or simultaneous refunds. Recorded payment history is immutable; changes are separate refund entries.

Receipt confirmation is an administrator attestation. There is no automatic bank verification or commission payout.

## Countries and access

Local currency and representative IANA time-zone defaults are available for every selectable home country. These are editable defaults, not exchange rates or automatic repricing. Norwegian, English and French scripts, email drafts and approved product information can be adapted per market. The product kit includes the isolated demo and guidance for common questions and objections.

Administrator rules can restrict countries, industries, regions, contact hours and documented contact permission. Opt-out always takes precedence and applies across canonical duplicate companies, standard lists, immediate email and scheduled email at dispatch time. These controls do not certify compliance with a country's contact or privacy laws.

Sellers see their assigned leads and customer records, contacts, activities, attachments, exports and results. Canonical lead ownership overrides stale customer assignments. Organization boundaries remain enforced; external partners receive no automatic access to customer CRM data. Explicitly consented support access to the existing CRM is preserved.

Lists with call history, deals or receipts cannot be deleted, preserving attribution and audit history. The original whole-list delegation and standard list layout remain available.

## Demo and validation

The portfolio demo stores fictional data in memory for the current session. It supports call reservations, logging, history, callbacks, distribution, market rules and pipeline stages. It cannot send email, record actual payments, issue refunds or change production records.

Run the production build and `node --test --test-concurrency=2 tests/*.test.mjs`. Outbound tests exercise actual SQLite routes and atomic batches, tenant and seller access, concurrent reservations and retries, register identity, pagination, market restrictions, daylight-saving transitions, commission policy, refunds, demo isolation and frontend workflows.
