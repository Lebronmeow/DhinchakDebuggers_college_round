# Nexus World — local AI business orchestra

An original pixel-art office backed by actual Ollama coordinator/specialist calls, role-restricted business tools, human approval gates, and persisted execution receipts. Built with React, Vite, Express, and local JSON persistence. The pixel office is inspired by the virtual-company concept; no Claw-Empire code or assets were copied.

## Run

Node.js **22.9+**, npm, and a running Ollama installation with an installed instruction model are recommended.

```sh
npm install
npm run build
npm start
```

Open **http://127.0.0.1:3100**. For development use `npm run dev` and open **http://127.0.0.1:5173**. Do not run two backends against the same data directory. Both servers bind to loopback.

## This is actual model-driven execution

1. The command desk lists models from your local Ollama `/api/tags`.
2. Your selected model acts as **Coordinator** and returns a task plan.
3. Each specialist receives a distinct role prompt, the delegated task, earlier public team messages, relevant record IDs, and real tool receipts.
4. Specialists select allowlisted tools and validated arguments. The tools call the same business APIs as the UI, then independently read back saved records.
5. Results feed the next model call. Subsequent specialists receive handoffs and shared results.
6. Publishing and real email sending pause for an exact human approval. Approving executes the operation; **Resume** verifies that exact approval and target before continuing, without redoing prior writes.
7. Messages, tool calls, record IDs, errors, and outcomes appear in the office and command desk. Completion prose without a tool receipt is not accepted.

Agent roles are **Coordinator, Website, CRM, Growth, Events, Billing, Review**. They can share one local model with different contexts. Inference is serialized to avoid several large models competing for a 12 GB GPU. This is multi-role orchestration, not seven concurrently loaded models.

No scripted transcript or guided-template fallback is used by the new command desk. Model errors are visible. Earlier guided-workflow endpoints remain for compatibility with existing records/tests but are not the primary office experience.

### Try these commands

> Create a draft webinar called Fern Studio Intro with capacity 15 and no date yet. Then have Website create a draft registration page linked to the new webinar. Do not publish or send email.

> Create and publish a landing page for a fictional gardening workshop. Ask me for approval before publication, then have Review inspect the published record.

> Have CRM create Alex Example, alex@example.test, company Example Studio, stage lead. Do not opt the contact into marketing. Then have Review inspect the saved contact.

> Inspect the existing campaign records and report which are drafts. Do not send anything.

Use **Decisions** to review content, approve/reject, then return to the command desk and **Resume**. Local publication provides a working `/p/<slug>` URL on this machine, not an internet deployment.

## Business capabilities

| Module    | Working functionality                                                                | Explicit boundary                                                               |
| --------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Office    | Detailed original pixel rooms, characters, live role status and real-message bubbles | Visual state is driven by persisted runs; idle animation is decorative          |
| Website   | Block content/color editing, reorder, preview, actual approved publication           | Small block editor, not arbitrary generated apps or a full Webflow replacement  |
| CRM       | Create/search/filter/stage/consent controls; normalized-email deduplication          | Single business/operator; no tenant or member access model                      |
| Events    | Real webinar metadata, linked page registrations, capacity, room URL, attendance     | Video must use an organizer-supplied service; attendance is manual              |
| Campaigns | AI-authored saved copy, audience filters, approval snapshots                         | Local schedule metadata alone does not trigger delivery                         |
| Email     | Optional **Resend** delivery after exact human approval; provider IDs recorded       | Requires account/sender setup; provider acceptance is not inbox delivery        |
| Billing   | Sandbox plans, subscriptions, cancellation, idempotent metered usage                 | No payment gateway checkout, real charge, tax calculation, or financial invoice |
| Review    | Real record inspection through a read tool and receipt                               | Model conclusions still require judgment; not a compliance/security audit       |

Starter contacts are fictional `example.test` identities. Real email sending refuses `.test` and `.invalid` recipients.

## Ollama / RTX 3060 12 GB

The backend uses only **http://127.0.0.1:11434**, never a remote fallback. It does not download models, change Ollama configuration, or install runtimes automatically.

A quantized 7–8B instruction model is a practical starting point. Nexus uses `think:false`, a 4096-token context, bounded structured output, low temperature, and a 120-second per-call timeout. Model quality and GPU memory availability matter. The existing installed `huihui_ai/qwen3-abliterated:8b` was used for local tests; a standard instruction-tuned model is preferable for business use if you choose to install one.

Unlike the old draft-only UI, **specialist agents can now read relevant local business records** to do the requested job. This context goes to local Ollama only. Do not point the endpoint at a remote proxy without a deliberate privacy review.

Models can make factual mistakes or ask for the wrong supported action. Always review publication/email content and captured recipients. Tool/schema validation prevents arbitrary execution, not every business-logic mistake.

## Optional real email setup

1. Create a Resend account and configure an allowed/verified sender. Check current free-tier/trial conditions yourself; this project does not guarantee pricing or limits.
2. Copy `.env.example` to `.env` locally.
3. Set `RESEND_API_KEY` and `NEXUS_EMAIL_FROM`. Do not put keys in chat, prompts, Git, or the frontend.
4. Restart with `npm start` (loads `.env` using Node).
5. Use real consented contacts. Ask Growth to send an existing campaign. The run pauses at a **Send** approval.
6. Review the exact subject/body, recipient emails, and sender in Decisions. Approval dispatches one batch with an idempotency key.

The initial connector caps sends at 50 recipients, rejects stale content/consent/recipient/sender snapshots, and does not automatically retry uncertain delivery. Timeouts, ambiguous responses, and crashes during a send require checking the provider dashboard before further attempts. This is not a complete marketing platform: unsubscribe-link automation, bounce webhooks, suppression synchronization, recurring schedules, and deliverability management remain work before broad production sending.

No live provider email was sent during development verification; delivery tests use a mocked provider transport. Live video and real payments still require separate integration work.

## Reliability and security

- Host/origin checks and localhost binding. **No login, multi-tenant isolation, RBAC, or public deployment hardening.** Local processes can access the API. Do not expose it via tunnels/LAN/reverse proxies without adding proper authentication/authorization.
- Role allowlists and argument validation. Agents cannot execute shell commands, arbitrary URLs, code, filesystem access, or direct billing-provider actions.
- Public messages are short outputs, not private chain-of-thought. Verified tool receipts are distinguished from model assertions.
- Runs are bounded to six specialist tasks and five model turns per specialist. One inference/run executes at a time; queued jobs are visible.
- Restart marks interrupted running jobs instead of automatically replaying writes. Waiting approvals survive restart. Failed/interrupted runs do not silently retry; inspect receipts and issue a targeted new request if needed.
- Cancellation stops new model/tools work. An already-dispatched write or external send may complete; its result must be inspected. Cancellation is not rollback.
- `data/state.json` is ignored by Git, contains potentially sensitive records, and is **not encrypted**. Atomic writes are serialized with bounded Windows rename-lock retries. Use one process only; production database durability/load has not been validated.
- Approval snapshots, escaped public pages/CSP, duplicate-event protection, and read-back verification are implemented. The local audit state is not immutable/compliance-grade storage.

## Verification

```sh
npm test
npm run build
npm run format:check
npm audit --omit=dev
```

API tests cover actual local HTTP records, model contract errors, role policy, approval/resume, deduplication, transactional persistence, and mocked email execution. UI tests cover usable forms and command/approval controls. Deterministic tests mock Ollama; real installed-model checks are separate and do not establish a universal success rate.

## Architecture

- `server/orchestra/engine.mjs`: persisted coordinator/specialist execution and queue.
- `server/orchestra/ollama.mjs`: fixed-localhost bounded structured model calls.
- `server/orchestra/prompts.mjs`: role definitions and coordination rules.
- `server/orchestra/routes.mjs`: start/cancel/resume/status API.
- `server/agent-tools.mjs`: tool catalog, per-role permissions, validated API execution and record verification.
- `server/delivery.mjs`: exact approval and optional real Resend delivery.
- `server/app.mjs`: business APIs and integration wiring.
- `server/store.mjs`: transactional local persistence.
- `src/components/PixelOffice.tsx`: original world illustration and real agent state.
- `src/components/OrchestraConsole.tsx`: commands, conversations, receipts and controls.
- `src/components/Modules.tsx`: business screens.

The other team's screenshot showed a Python folder layout, not code. No implementation from that screenshot is included. These modules provide the analogous planner/tool/permission/workflow separation while preserving this project's existing stack.
