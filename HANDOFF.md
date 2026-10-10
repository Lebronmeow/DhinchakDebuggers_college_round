# Nexus continuation handoff

## Goal

Continue Nexus as a local-first AI business orchestra, not a task-board demo. The acceptance flow is: a user gives one business request; a local Ollama Coordinator delegates to real specialist agents; specialists communicate through public messages, call bounded business tools, produce verified record receipts, pause sensitive work for exact approval, resume without duplicate writes, and finish with a Review agent verification. The pixel office must show the real run state and conversations in a detailed 2D workspace.

## Repository state

- Repository: `https://github.com/Lebronmeow/dadaadfafadf.git`
- Baseline: `main` at `a6ab410`.
- Active upgraded branch: `feat/ai-office-orchestra` at `81124aa` (already pushed).
- Local app: `http://127.0.0.1:3100`; current backend process is intentionally left running by the agent session.
- Local runtime data is `data/state.json` and is ignored. It contains synthetic demo data plus local smoke-test records; do not commit it.
- `.env` is ignored. `.env.example` documents optional Resend configuration.

## Done in the upgraded branch

### Actual AI execution

- Added `server/orchestra/engine.mjs`, `ollama.mjs`, `prompts.mjs`, and `routes.mjs`.
- Added `/api/orchestra`, run creation, cancel, resume, and persisted public execution traces.
- Ollama calls use fixed localhost `http://127.0.0.1:11434/api/chat`, structured JSON, bounded output/context, `think:false`, low temperature, and 120-second timeouts.
- One inference/run is serialized for a 12 GB GPU.
- Coordinator plans at most six specialist tasks.
- Specialist roles have separate prompts and per-role tool allowlists.
- Model prose cannot mark a task complete without a verified successful receipt.
- Duplicate create attempts are blocked after a verified create receipt.
- Restart marks planning/running jobs interrupted but preserves approval-waiting jobs.
- Cancel protects the operator’s canceled state from late inference persistence.

### Bounded verified business tools

- `server/agent-tools.mjs` exposes validated tools for Website, CRM, Growth, Events, Billing, and Review.
- Tool calls use existing API validation and read back records before writing receipts.
- No shell, arbitrary URL, filesystem, direct provider, or payment access is available to the model.
- `server/delivery.mjs` adds an optional Resend connector with exact campaign/content/recipient/sender snapshots, consent checks, provider receipts, idempotency key, `.test` recipient protection, 50-recipient cap, and no automatic retry after uncertain delivery.
- Page publication remains an exact approval gate; resume verifies the approval target before continuing.

### UI and office

- `src/main.tsx` now presents `Nexus World` with a reference-matched office-first shell.
- `src/office-shell.css` adds sidebar, department status, live connection state, command area, and responsive layout.
- `src/components/PixelOffice.tsx` and `pixel-office.css` contain the original 1500×900 detailed pixel-art office: CEO room, six tinted rooms, corridors, lounge, desks, monitors, plants, noticeboards, clocks, sprite characters, message bubbles, and real role statuses.
- `src/components/OrchestraConsole.tsx` and `orchestra-console.css` provide installed-model selection, command input, run history, public agent messages, task state, tool receipts, approval navigation, resume, cancel, and errors.
- Existing CRM, Website, Campaign, Webinar, Billing, Analytics, Approvals, and Settings screens remain available.

## Checks already passed

Run from `C:\Users\Rony\omnirush.ai\nexus`:

- `npm test` — **passed**: 21 API/orchestra tests and 8 UI tests.
- `npm run test:api` — **passed**: 21 tests.
- `npm run test:ui` — **passed**: 2 UI files, 8 tests.
- `npm run build` — **passed**: TypeScript and Vite production build.
- `npm run format:check` — **passed**.
- `npm audit --omit=dev` — **0 reported vulnerabilities**.
- `node --check server/agent-tools.mjs` — passed during implementation.

Manual smoke evidence:

- Ollama is available with installed model `huihui_ai/qwen3-abliterated:8b`.
- A real model-driven Cedar Studio run created a page, requested publication, paused at `awaiting_approval`, approved the exact page, and resumed.
- A Review run showed a model can loop or claim completion incorrectly; the engine now sends corrective feedback, requires `inspect_workspace` for Review, blocks duplicates, and never fabricates completion.
- An earlier smoke process hit a Windows `EPERM` rename lock before the store retry improvement was added. Current store persistence has bounded `EPERM/EACCES/EBUSY` rename retries. Old failed run records remain in local ignored data and are not code evidence.

## Important decisions

- Keep JavaScript/TypeScript/React/Express/Vite. Do not replace it with Python based only on the other team’s folder screenshot.
- Keep the feature branch separate from `main` until friends review it.
- No cloud AI fallback. Ollama must be locally installed and selected.
- Local model receives bounded business context and user prompt, not arbitrary filesystem or provider credentials.
- Local publication is allowed after approval. Real email requires Resend setup and approval. Payments remain sandbox-only. Live video remains organizer-room-url/manual-attendance only.
- Do not expose port 3100 remotely without adding authentication, tenant isolation, RBAC, CSRF/replay policy, secret management, and production persistence.

## Remaining work for the next team

### Priority 1 — stabilize real multi-agent execution

1. Run a fresh smoke test using a clean temporary `data/state.json` rather than existing demo state.
2. Test the prompt in the acceptance flow below end to end after the latest restart.
3. Improve Coordinator dependency planning so Review never runs before required mutation tasks and Website receives the Event record ID in its input/handoff.
4. Add an explicit handoff object to `AgentTask` (`dependsOn`, `inputReceipts`) instead of relying only on prior public messages.
5. Add active-cancellation and successful-resume tests; current suite covers queued cancellation, exact unrelated approval rejection, receipt execution, and restart preservation, but not every active signal race.
6. Add a real `inspect_workspace` receipt to the Review task and a structured verification result rather than allowing a generic text summary.

### Priority 2 — real provider integrations

1. Email: use a real Resend account only after configuring `.env` locally. Add unsubscribe/suppression, bounce webhooks, delivery status polling, and a tested operator confirmation screen before broad use.
2. Video: integrate LiveKit or another chosen provider; replace manual attendance with signed room access and verified attendance webhooks.
3. Billing: add Stripe test-mode checkout/webhooks only after defining a separate provider customer/subscription model; keep sandbox ledger data separate from real charges.

### Priority 3 — product hardening

- Add workspaces/users/RBAC and protect approvals by user identity.
- Move JSON runtime data to SQLite/Postgres with migrations and durable audit events.
- Add a real agent run detail URL and retry/recovery policy that never repeats uncertain writes.
- Add model selection policy, prompt-injection defenses for imported record text, and configurable tool permissions.
- Add accessibility review at desktop and mobile widths.
- Review stale local smoke data or delete `data/state.json` only when the next person explicitly wants a clean demo; never commit it.

## Acceptance smoke command

Start clean (backup/delete only ignored local data if desired), then:

```sh
npm start
```

Open `http://127.0.0.1:3100`, choose the installed model, and run:

> Create a draft webinar called Fern Studio Intro with capacity 15 and no date yet. Then have Website create a draft registration page linked to the new webinar. Write concise gardening workshop copy. Do not publish, send email, or create contacts. Review must inspect the actual webinar and page records and report their real IDs.

Expected results: Coordinator delegates Events → Website → Review; Events creates exactly one webinar; Website creates exactly one page with the real webinar ID; Review calls `inspect_workspace`; no campaign/contact/payment/email side effects; final run is `completed` with successful receipts and no duplicate creates.

## First next action

Create a clean temporary-data smoke fixture for the acceptance command, run it against the installed Ollama model, and fix the first real model/planning failure without weakening receipt verification or approval safety.
