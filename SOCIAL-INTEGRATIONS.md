# Social connection verification

Checked the production source at 9f0c806 and the channel selector update.

| Channel | Connect flow | Token storage / refresh | Publishing / scheduling | Live account test |
| --- | --- | --- | --- | --- |
| Facebook | Missing | Missing | Missing | Blocked |
| Instagram | Missing | Missing | Missing | Blocked |
| LinkedIn | Missing | Missing | Missing | Blocked |
| X | Missing | Missing | Missing | Blocked |
| Snapchat | Missing | Missing | Missing | Blocked |

The old Connect buttons only showed a toast. GET /api/marketing returned a hardcoded empty connections array. POST stored records with a scheduled status, but there was no publisher or scheduled handler. No OAuth callback or provider API client exists in app, lib or worker. This is not evidence of working social integrations.

The UI now explicitly identifies unavailable connections. New records are drafts even when a desired date is supplied. The five social choices are validated server-side; Google Ads is excluded. Existing historical records are retained. Automated route tests verify draft creation for each of the five channels and rejection of Google Ads / unknown / empty choices, alongside tenant and entitlement checks. These are local tests, not live provider tests.

Before a live test: implement provider authorization and callbacks, organization-scoped encrypted token storage, disconnection and refresh, provider-specific media publishing and failure handling. Configure the Noracre developer applications and approved permissions for the intended account types using current provider documentation. Connect test accounts with their owner's consent. Verify account identity, token renewal, isolation between organizations, revocation, media constraints and error reporting. Ask before posting actual test content publicly. A background queue/worker is required for real timed publication; storing a date alone does not schedule delivery.
