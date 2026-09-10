# Noracre security review — 10 September 2026

## Scope and boundaries

Reviewed the Cloudflare production application's source, authentication, tenant checks, role checks, consent-based support access, module licensing, uploads, API request handling, browser token forwarding, spreadsheet handling and dependency advisories. Tests use synthetic records in an isolated SQLite database and mocked external services. No customer records, credentials, mail or production database contents were read, modified or deleted by these tests.

This is a code-level security review and regression test suite, not an independent penetration-test certification or forensic investigation. The attempted additional live HTTP header check did not complete because network approval was cancelled; no alternate access path was used. Production deployment status is checked separately through GitHub's Cloudflare build result. Provider dashboard configuration has not been independently verified in this pass.

## Fixes in this pass

- Ordinary users and consented support users can no longer enable, revoke or renew support sessions. Approval requires a pending request belonging to the current organization.
- Unknown roles are rejected; non-owner administrators cannot grant Superadmin.
- Profile and marketing image uploads allow PNG/JPEG/GIF/WebP only and check file signatures before storage. Previously stored active formats are not served inline. Existing objects are not bulk-deleted.
- Old avatars are retained until the new profile has been stored successfully.
- API bodies are bounded even without Content-Length: 1 MiB for ordinary requests, 24 MiB for multipart requests. Marketing images additionally have a 20 MiB aggregate limit. Individual file limits remain enforced.
- Cross-origin API writes are rejected; API responses are private/no-store. Public auth configuration remains accessible, while other APIs require authentication.
- Unused public image optimization endpoints and non-API write requests (including unused Server Actions) are disabled.
- Security headers prevent framing, disable plugin objects and constrain base URLs and form targets. This is intentionally not a full nonce-based script CSP.
- Browser API helpers refuse external destinations and redirects before forwarding session tokens.
- Excel import is bounded to 5 MiB and 501 parsed rows (header plus 500 records). Formula-like values remain text on export.
- Supabase identity verification requests have a ten-second timeout.

The previous pass also removed legacy identity-header authentication on Cloudflare, required verified Supabase email, blocked cross-tenant parent references, required active organization modules plus personal licenses, and corrected owner bootstrap and inactive-superadmin directory access.

## Dependency changes and remaining findings

Updated Next.js to 16.3.4; React, React DOM and React Server DOM to 19.2.8; Vite to 8.3.0; Cloudflare Vite plugin to 1.54.7; Wrangler to 4.131.0; SheetJS to the official 0.20.3 distribution, with integrity-pinned lockfile. Updated compatible transitive dependencies. No automatic audit downgrade or forced major-version change was applied.

The production-only npm audit reports zero known findings. This alone does not certify the deployed bundle: some development dependencies participate in building runtime code.

The full dependency audit still reports six affected package entries (two high, four moderate), representing two underlying areas:

1. `image-size` 2.0.2, inherited through vinext: malformed ICNS/JXL/HEIF parsers can loop. The reviewed calls concern build-time image metadata. Noracre rejects these uploaded image types and disables unused public image proxies. The audit proposes migrating vinext to a new major/beta; that migration needs separate compatibility validation. Do not import untrusted artwork into the build source.
2. Old esbuild inherited through drizzle-kit/esbuild-kit: a development-server cross-origin data exposure advisory. No such server is published by Noracre. The audit's proposed drizzle-kit downgrade is not applied because it could disrupt migration tooling. Do not expose local development servers publicly; validate a supported migration-tool upgrade separately.

Sources: [SheetJS installation and official distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), [image-size ICNS advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), [image-size JXL/HEIF advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), [esbuild development-server advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99). Counts are a dated audit snapshot, not a permanent guarantee.

## Verification

Run `node --test tests/access-control.test.mjs tests/spreadsheet-security.test.mjs` on Node 24. Tests exercise authentication rejection, tenant-header forgery, customer/contact identifiers, file isolation, module assignment, role escalation, disabled accounts/organizations, support expiry/revocation, SQL injection strings, image validation, oversized requests, origin restrictions, token destinations, response headers and spreadsheet handling.

A targeted pattern scan of current application source and public assets found no matching Resend, Supabase-secret, GitHub token or private-key patterns. This is not a full Git history secret audit. The public Supabase publishable key is intentionally public.

## Follow-up with the owner

- Verify MFA and recovery methods for GitHub, Cloudflare, Supabase and the owner's mailbox.
- Review Supabase authentication rate limits, bot protection, sign-up policy, redirect allowlist and session revocation. No brute-force testing against real accounts was performed.
- Review Cloudflare edge rate limits and abuse alerts. Request-size limits are not a distributed denial-of-service defence.
- Verify D1/R2 backup and restore procedures with a separate restore target, not the live customer database.
- Plan the remaining build-tool upgrades above and consider nonce-based CSP / HttpOnly session architecture. Current browser token storage remains exposed if a future same-origin script injection is introduced.
- Validate the normal login, password recovery, image upload and Excel import flows with the owner after deployment. Existing account/password/SMTP configuration was not changed by this review.
