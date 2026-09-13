# Social statistics

The marketing dashboard reads results for successful CRM deliveries created in the last 30 days, including publications subsequently removed from the local content plan. It uses each delivery's remote post ID and the currently connected, matching account in the same organization. It does not import unrelated posts from the social account.

- Facebook: lifetime `post_media_view`; engagement = reactions + comments + shares.
- Instagram: media `views` and `total_interactions` (includes saves).
- LinkedIn: per-share/UGC `organizationalEntityShareStatistics`, organic impressions and likes + comments + shares. Clicks and LinkedIn's engagement ratio are not included.

All result pages are consumed. Missing values, revoked access, unsupported metrics and provider failures are distinct from a genuine zero. Available totals are explicitly marked partial when any publication lacks that metric. Requests are authenticated, module-licensed and tenant-scoped; credentials remain encrypted on the server. The API reads six publications per request to bound external calls.

## Meta access

Alongside the existing publishing scopes, enable `read_insights` and `instagram_manage_insights` with the appropriate Meta app access level. If `META_LOGIN_CONFIG_ID` is configured, add these permissions to that **Facebook Login for Business configuration** in Meta as well. A configured login uses that configuration's permissions; adding scopes to source code does not alter it.

An administrator then chooses **Koble til på nytt** in the CRM, grants the requested access and selects the same Facebook Page / Instagram account. Existing connections are retained until the new selection is confirmed. Do not revoke working publishing access to troubleshoot missing analytics. Customer accounts outside app roles may require Meta App Review / advanced access for these permissions.

## Durable Meta connections and customer rollout

On confirmation, CRM validates the selected **Page** token with Meta's `debug_token` and checks its Page identity. Both Facebook and the linked Instagram account use this token. The user token's 60-day lifetime is no longer copied onto these connections. Actual token and data-access deadlines are respected. Only explicit zeroes for both deadlines are stored as no scheduled expiry (the existing non-null column uses `8640000000000000` as a sentinel). Missing or invalid metadata fails closed, leaving previous connections intact. No credentials or debug responses are exposed to the browser.

New customer connections follow this automatically. Existing connections retain their previous deadline until reconnected once; do not blindly extend old credentials. Long-lived Page tokens do not need a scheduled refresh when Meta reports no expiry, but revocation, removed Page roles and Meta security decisions can still require reconnection. This is not a guarantee of permanent access.

The live login configuration requests seven permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `read_insights`, `instagram_manage_insights`. `business_management` is not needed for this Page-token workflow and has been removed from the login configuration. All future customers receive publishing and analytics in the same consent flow.

External customer rollout is still blocked by Meta's app approval, not by customer CRM setup. On 2026-09-13 the app was unpublished and scopes were only ready for testing. Complete the actual business/access verification and App Review requirements shown in the dashboard, obtain the necessary advanced access, and publish the app before onboarding people without app roles. Do not ask every customer to create a developer app or to become a test user as a production workaround. Test with a real consenting non-app-role customer after approval. Customers need suitable Page access and a professional Instagram account linked to their Page.

Meta lifetime reference: https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/get-long-lived

## LinkedIn access

The existing `rw_organization_admin` scope provides organization reporting for page administrators. The Community Management application must be approved and configured as described in LINKEDIN-SETUP.md. A content-only page role may publish without being allowed to read reporting data.

## Verification

`node --test tests/social-insights.test.mjs tests/social-meta.test.mjs tests/social-linkedin.test.mjs tests/access-control.test.mjs`

Live verification must use existing published posts, without publishing test content. Check light/dark presentation, per-channel coverage and actual permission state. A successful build or mocked test is not evidence that a live provider has granted insights access.

Sources:
- https://developers.facebook.com/docs/graph-api/reference/insights/
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/insights/
- https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/insightsresult.py
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/share-statistics?view=li-lms-2026-08
