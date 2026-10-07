# Noracre CRM

**A personal CRM project built around the practical work of B2B sales: finding prospects, managing conversations and following through.**

I'm Joakim Ferdinand Nygård, a sales leader with experience building and managing full-cycle sales teams. I started Noracre as a side project to explore how software could support the work I know from sales and team leadership.

I developed it with AI-assisted tools, using my sales experience to guide the product requirements, workflows and iterations. It is a practical learning project and an example of my interest in building useful technology.

## The sales problem

A prospecting list is only useful if a seller can act on it. A customer record is only useful if the team can understand the conversation and agree on the next step.

Noracre brings prospecting, contacts, activity history and follow-up into one workspace. The aim is to make everyday sales work easier to organise and easier for a manager to understand.

## What the project includes

| Workflow | What it supports |
| --- | --- |
| Prospecting and call lists | Finding Norwegian companies using business-register search filters, organising calling activity and recording outcomes. |
| AI-assisted search | Translating a natural-language prospecting request into structured filters, with validation and clarification for unsupported criteria. |
| Account and contact management | Company records, multiple contacts, ownership, sales stages and notes. |
| Sales follow-up | Calls, meetings, emails, scheduled tasks and a visible next action. |
| Team administration | Organisation memberships, roles and user access to modules. |
| Data handling | Import and export workflows for working with existing sales data. |
| Additional modules | Email workflows, offer templates, marketing content and partner reporting. |

These describe features represented in the repository. External integrations depend on their configuration, credentials and provider permissions.

## A workflow to explore

1. Define the companies you want to approach.
2. Organise prospects into a call list.
3. Record the conversation and its outcome.
4. Create or update the account and relevant contacts.
5. Set the next action so follow-up remains visible to the team.

The repository also contains an in-memory demo runtime with illustrative company, contact and activity data. That runtime blocks external sending, publishing and account connections, and does not use the production database.

## Why I built it

Leading full-cycle Account Executives means taking responsibility for prospecting as well as closed business. Building Noracre has given me another way to think through those workflows: what information a rep needs, how the next action should be recorded and where software can reduce administration.

The project reflects my commercial background and practical curiosity about technology. It is an ongoing side project, with room to improve the code and product as I learn.

## Technical overview

- **Language and UI:** TypeScript, React and Tailwind CSS.
- **Application:** Next.js-style routes running on Vinext and Vite.
- **Data:** Drizzle ORM and Cloudflare D1.
- **AI-assisted prospecting:** Cloudflare Workers AI, structured filter output and Zod validation.
- **Verification:** Test files cover areas including access control, demo behaviour, prospecting filters and email workflows. This is a description of the test suite, not a claim that every test currently passes.

Useful entry points:

- [CRM interface](app/crm-client.tsx)
- [Data model](db/schema.ts)
- [AI-assisted prospecting](lib/call-list-ai.ts)
- [Demo runtime](lib/demo-crm.ts)
- [Tests](tests)

## Development documentation

The existing setup and hosting instructions are preserved in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Additional documentation covers [internationalisation](I18N.md), [email setup](EMAIL-SETUP.md) and [social integrations](SOCIAL-INTEGRATIONS.md).

This repository is currently private. A recruiter needs repository access to view this page or the source code.
