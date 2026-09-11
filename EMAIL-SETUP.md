# Personal mailbox sending

Customer email and offers use the current organization membership's connected Google or Microsoft mailbox. There is no Resend fallback and users cannot supply a From address. Existing invitation mail remains separate.

## Required production setup

Configure secrets on the existing Cloudflare Worker `noracre-crm` (never commit them):
- `MAIL_TOKEN_KEY`: a random secret of at least 32 characters. Keep stable; rotating it requires users to reconnect.
- `GOOGLE_MAIL_CLIENT_ID`, `GOOGLE_MAIL_CLIENT_SECRET`: Web application OAuth client with Gmail API enabled; scopes `openid email https://www.googleapis.com/auth/gmail.send`.
- `MICROSOFT_MAIL_CLIENT_ID`, `MICROSOFT_MAIL_CLIENT_SECRET`: Web application supporting the intended account types, delegated `User.Read`, `Mail.Send`, and `offline_access`.

For BOTH providers register exactly:
`https://crm.noracre.no/api/email/callback`

Configure consent audience/test users in Google and consent policy in Microsoft. Complete required provider verification before broad customer rollout. No customer mail works until at least one provider is configured AND each user explicitly connects their mailbox.

Apply `drizzle/0018_user_mail.sql` through the existing migrations-before-deploy pipeline.

## Behavior

Settings and the email composer expose personal account connection and disconnection. OAuth uses a ten-minute one-time state bound to a secure HttpOnly browser cookie, PKCE, and an active membership check at callback. Tokens are encrypted with AES-GCM and bound to organization/membership. Disconnect removes tokens and pending flows in CRM; users may additionally revoke application consent at the provider.

Sending uses Gmail `users/me/messages/send` or Graph `/me/sendMail` with MIME attachments, preserving Sent items and the actual connected mailbox sender. Ten attachments/10 MB total and 49 bulk recipients; recipient ownership is checked on the server. The providers' own limits still apply. A durable attempt reservation prevents automatic retries after ambiguous outcomes; check Sent items before creating another send attempt.

Production consent and actual delivery must be validated after provider setup. Tests use mocked providers and never send real mail.
