# Social integrations: Meta implementation and activation

## Current implementation

Facebook Pages and linked professional Instagram accounts now have an OAuth authorization flow, explicit account selection, connection listing/testing/removal, and confirmed immediate publishing of saved drafts. Support for LinkedIn, X and Snapchat is still unimplemented; these channels remain draft-only. Google Ads is excluded.

Facebook supports text and up to six photos. Instagram supports one JPEG image or a carousel of up to six JPEGs. This initial implementation conservatively accepts 320–1440px width, 4:5–1.91:1 ratio, 8 MB per JPEG and 2200 caption characters. It does not publish video, Stories or Reels. Stored dates remain planning metadata, not automatic scheduled delivery. Analytics is explicitly unavailable rather than fake zeroes.

## Production setup required (not completed by a code deployment)

Create or select the Noracre application in Meta for Developers. Configure Facebook Login / Facebook Login for Business for the chosen app type, enable the relevant Pages and Instagram products/use case, and use the exact OAuth redirect:

`https://crm.noracre.no/api/social/meta/callback`

Domain: `crm.noracre.no` (and `noracre.no` if requested by Meta).
Existing policy pages: `https://crm.noracre.no/personvern` and `https://crm.noracre.no/vilkar`. Complete any required data-deletion instructions and business/app verification in the Meta dashboard before opening access to customer accounts. Provider documentation and account capabilities must be checked when activating; main Meta documentation was rate-limited during implementation. The official Meta Postman Instagram collection was available and confirms Page token discovery and the container/status/media_publish flow:
https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

Set **runtime** configuration on the Cloudflare Worker `noracre-crm` (not build variables):

| Key | Type | Value |
| --- | --- | --- |
| META_APP_ID | Text | Noracre's Meta application ID |
| META_APP_SECRET | Secret | Its app secret; enter directly in Cloudflare, never chat or GitHub |
| META_GRAPH_VERSION | Text | An explicitly supported Graph API version selected for the Meta app, in vNN.0 format |
| META_LOGIN_CONFIG_ID | Text, optional | Facebook Login for Business configuration ID, if using a configuration-based login |

Without the three required values, the connect controls remain disabled and the API returns a clear setup message. No example secret is usable in production. A config-based login must include the requested permissions. Without a config ID the authorization URL requests `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`. App review/advanced access may be needed for accounts outside app roles; no claim of approval is made by this code. Facebook requires a Page, and this integration's Instagram account must be professional and linked to a Page.

## Security and failure behavior

- Start, select, disconnect and test require a direct Administrator/Superadmin membership and an active personal module license. Publication requires an active module license and current tenant membership. Support sessions do not inherit social account administration.
- Random OAuth state is stored hashed, has a ten-minute lifetime, is single-use and is bound to a Secure/HttpOnly/SameSite=Lax browser cookie. The callback rechecks membership, organization and license. Account selection is restricted to the original member and organization.
- Page credentials and temporary choices use AES-256-GCM with organization/account-specific associated data. HKDF derives separate encryption and media-signing keys from the app secret. Rotating META_APP_SECRET requires reconnecting accounts; never change it casually.
- Tokens stay out of browser responses and error messages. Provider calls use a fixed Graph origin, bounded pagination, no redirects, timeouts and appsecret_proof. No provider-supplied pagination URL is followed.
- Tokens are conservatively marked expired after the long-lived token lifetime (maximum 60 days). Reauthorization is explicit. Meta revocation/error 190 prompts reconnect; there is no fictitious automatic refresh-token mechanism.
- Signed image URLs expire in less than one hour and bind the organization, image and draft. Image serving checks an active organization and a delivery linked to a current connection. The R2 bucket stays private. Such signed URLs are bearer capabilities: avoid logging full query strings in external observability systems.
- The public callback/media exceptions are GET-only; their own state/signature checks remain mandatory. All other social endpoints require bearer authentication.
- Publication validates that the confirmed target still matches the stored connection. An atomic draft claim and unique delivery records block duplicate/retried sends. Unknown results are not automatically retried, because a timeout can occur after Meta has published. Partial results are displayed separately per channel. A Worker interrupted after claiming leaves an explicit in-progress status requiring inspection, never an automatic duplicate send.
- Disconnect deletes the organization's stored Page token. It does not delete published posts or revoke the entire Meta app grant across other organizational connections. The admin can additionally revoke the app in Meta's Business Integrations.
- Temporary authorization payloads expire after ten minutes and are removed after selection or when a new authorization starts. The startup cleanup also removes expired attempts.

## Verification completed

Automated tests exercise actual route handlers against in-memory SQLite, use the real new migration, and mock Meta/Supabase responses. They cover role/tenant boundaries, missing configuration, browser-bound OAuth and replay, encrypted credentials, callback role revocation, account selection, public endpoint guards, explicit publish consent, changed targets, parallel publication, signed-media integrity/expiry, Instagram container flow, ambiguous provider failures and disconnection. Existing access-control tests continue to run. These tests do **not** establish that a real Meta app has the right permissions or that real account publishing works.

Run `node --test tests/social-meta.test.mjs tests/access-control.test.mjs` and `npm run build`.

## Live acceptance still required

1. Configure the Meta app and runtime values above; connect an account with an app role first.
2. Choose the intended Page and linked Instagram account. Test the read-only account access from the CRM; no post is sent by that test.
3. With the account owner's explicit consent, confirm a concrete test draft for Facebook and a valid JPEG draft for Instagram. Check actual posts on both platforms; verify partial failure and permission revocation in a test account.
4. Confirm browser cookie behavior/popups on the production custom domain, then test with a second synthetic organization. Do not use real customer organizations for boundary testing.
5. Complete Meta's required review before offering connection to unrelated customer accounts.

No actual social-media post was published as part of development. No Meta developer account or app configuration was available to inspect in this session.
