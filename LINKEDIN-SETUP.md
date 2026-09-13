# LinkedIn company-page publishing

The marketing module supports connecting one LinkedIn company page per CRM organization and publishing explicitly confirmed text or image posts. Personal-profile publishing, inbound post synchronization, analytics and automatic scheduled publication are not implemented.

## Provider setup

1. Register **Noracre CRM** at https://www.linkedin.com/developers/apps/new, associated with Noracre's LinkedIn company page. Use https://crm.noracre.no/personvern as the privacy-policy URL.
2. Verify the app's association with the company page as its administrator.
3. In Auth, add this exact authorized redirect URL:
   `https://crm.noracre.no/api/social/linkedin/callback`
4. Request the **Community Management API** product. The application requests `rw_organization_admin` to find administered pages and `w_organization_social` to publish. The self-service Share on LinkedIn product alone does not grant company-page publishing. Follow LinkedIn's Development-tier review, then obtain Standard-tier approval for production use with customers.
5. Configure `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` in the production Cloudflare Worker, with the secret stored as a secret. Never put credentials in source control, screenshots or chat. `LINKEDIN_API_VERSION` is optional and defaults to `202608`; keep it on a supported monthly version.
6. In CRM → Markedsføring → Kanaler → LinkedIn, connect as an administrator, consent, choose the company's page and confirm.

The credentials and provider API approval are both required; supplying credentials alone does not grant API access. Changing the client secret invalidates the encrypted stored LinkedIn connections, which must then be reconnected. Tokens expire according to LinkedIn's response and require reconnection; automatic token refresh is not implemented.

## Validation

- `npm run build`
- `node --test tests/*.test.mjs`
- Verify LinkedIn's disconnected and connected states in light and dark mode.
- Once API access is approved, complete the real OAuth flow and verify the selected page name. Obtain the owner's approval before publishing a real test post. Test text and an image post, checking the company page and CRM delivery status.
- A timeout after an external publish is recorded as uncertain and cannot be automatically retried. Check the company page before creating a replacement to avoid duplicates.

Images support JPEG, PNG and GIF, up to the CRM's six-image limit. LinkedIn requests reject unsupported image formats before any channel is published. Instagram's existing JPEG preparation is also used when the same post targets Instagram and LinkedIn. Text punctuation is escaped for LinkedIn's little-text format so it is displayed literally.

## References

- https://learn.microsoft.com/en-us/linkedin/marketing/quick-start?view=li-lms-2026-08
- https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-08
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-08
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format?view=li-lms-2026-08
