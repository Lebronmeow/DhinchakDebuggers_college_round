# Nexus — local business workspace

A runnable local-first prototype with an original pixel-art AI office, connected business records, approval-controlled page publishing, and optional Ollama-generated draft content. This is not a Claw-Empire fork: no code, sprites, or assets from that project were copied.

## Run

Requires Node.js 22+ and npm. From this `nexus` folder:

```sh
npm install
npm run build
npm start
```

Open **http://127.0.0.1:3100**. The server deliberately binds to loopback only. Run only one backend instance against a data directory.

For frontend development:

```sh
npm run dev
```

This runs the API on 3100 and Vite on **http://127.0.0.1:5173** with `/api` and `/p` proxies. Do not simultaneously run `npm start` on the same port.

## What works

| Area                | Implemented behavior                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Pixel office        | Six selectable specialist roles, original SVG/CSS art, workflow-derived status, reduced-motion support         |
| Command desk        | Guided template or Ollama content generation; generated content is editable before creating records            |
| CRM                 | Create/search/filter contacts, stages, source, opt-in/opt-out, normalized-email deduplication                  |
| Website studio      | Editable blocks, block reorder, color, desktop/mobile preview, draft saves, publish approval, local public URL |
| Public registration | Form creates/reuses a contact; workflow-linked page also registers the contact for the linked webinar          |
| Campaigns           | Compose drafts, audience selection, schedule metadata, approval snapshots; no actual sends                     |
| Webinars            | Create/configure events, room URL, capacity enforcement, registrations, explicitly manual attendance           |
| Billing             | Sandbox subscription creation/cancellation, idempotent usage events, plan/overage estimates; no real charges   |
| Approvals           | Pending/history, review captured content, approve/reject, stale snapshot protection, opt-out invalidation      |
| Analytics           | Stored record counts and sandbox totals; no fabricated payment or email metrics                                |
| Persistence         | Serialized clone-based mutations and atomic JSON-file replacement; rollback on validation failures             |

Initial records are fictional examples using `example.test` email addresses. No paid subscriptions are seeded.

## Try the connected journey

1. Click **New workflow** on Overview, or use Ctrl/Cmd+K.
2. Choose **Guided workflow** (a fixed template, not AI) or **Local AI**.
3. For Local AI, pick an installed Ollama model, generate content, review/edit it, then create drafts.
4. In **Webinars**, configure the generated event's date/capacity. No date is guessed by the guided template.
5. In **Approvals**, expand the content preview and approve page publication. Approving the campaign records a local schedule only.
6. In **Website studio**, open the published page and register a fictional contact.
7. Check **Contacts** and **Webinars**: the same identity appears in both.
8. Mark attendance manually. Create a sandbox subscription in **Billing**, then record a usage event.
9. Repeat the same event ID/quantity: usage does not increase again. A conflicting quantity is rejected.
10. Reload the app: the records remain. Edit a published page draft: the live page remains unchanged until a new approval.

## Ollama and a 12 GB GPU

The backend only contacts **http://127.0.0.1:11434**. No cloud fallback, model download, automatic installation, or account sign-in happens.

1. Start your existing Ollama application/server.
2. Check **Connections → Check Ollama**.
3. Open the command desk and choose an installed model.

A quantized 7–8B instruction model is a practical starting point for a 12 GB RTX 3060. Actual VRAM use depends on quantization, context, and other running applications. Nexus requests a 4096-token context and bounded structured output, with a 120-second timeout for generation. CPU offload or competing GPU workloads may increase latency.

If no model is installed, choose a model yourself from the official Ollama library before pulling it. Downloads can be several GB. Prefer a standard instruction-tuned model for business use. Existing third-party/abliterated models can be selected, but do not rely on their safety behavior.

The model receives only your entered brief, not the CRM database. It returns five text fields. It has no shell tools, customer-data access, provider credentials, or direct mutation authority. All text still needs review: even schema-valid local models can invent facts. Structured JSON validation is not a truthfulness guarantee.

## External services: not connected yet

No external account is required to try this version. The Connections screen links to possible next integrations:

- Email: Resend or another mail delivery service; account and verified sender/domain generally needed.
- Video: LiveKit or an existing webinar provider; this version stores an organizer-supplied room URL only.
- Payments: Stripe test mode or a region-supported processor; this version is a local sandbox ledger, not provider test checkout.

Current free/trial allowances and regional eligibility must be checked at sign-up. No hosted-tier limits or pricing are guaranteed here. Do not paste passwords, API keys, or tokens into workflow prompts. Future credentials belong in server-side local environment configuration, not the frontend.

## Security and limitations

- **Single trusted local operator**, not multi-tenant SaaS. There is no user login, role-based access, member invite system, or remote-access security model.
- Host/origin checks, loopback binding, public-page escaping/CSP, bounded inputs, immutable published snapshots, and idempotent usage are implemented. Local processes can access the API. Do not expose it via tunnels, LAN bind, or a reverse proxy without redesigning authentication and authorization.
- Runtime data is plain JSON at `data/state.json`, ignored by Git. It can contain PII; use synthetic data for evaluation and protect/back up this folder. It is not encrypted, a financial ledger, or a production database.
- Atomic persistence is intended for a single backend process. Multiple writers, crash-consistency across hardware failures, large datasets, and production load have not been validated.
- Campaign schedules are metadata, not a durable delivery service. No recurring worker sends email. Attendance is manual, not video-provider telemetry. Billing never collects payments, issues compliant invoices, or bills recurring usage.
- Agent roles visualize recorded workflow steps. They are **not six independently running autonomous agents**. Guided orchestration is deterministic; optional Ollama generates reviewable copy.
- Approval history is local application state, not an immutable compliance-grade audit log.
- The website builder is intentionally a small block editor, not a full Webflow/GrapesJS clone. Local page URLs are not internet-hosted sites. Historical editable versions/custom domains are not implemented.

## Verification

```sh
npm test              # HTTP API/persistence tests + React DOM interaction tests
npm run build        # TypeScript + production Vite build
npm run format:check
npm audit --omit=dev
```

Tests use temporary synthetic data and a mocked Ollama transport for deterministic AI-contract testing. A real installed Ollama model was separately exercised during initial implementation; this does not guarantee performance/quality for every model.

## Structure

- `src/main.tsx`: navigation, overview, workflow command desk, Ollama review UI.
- `src/components/PixelOffice.tsx`: original office illustration and workflow status mapping.
- `src/components/Modules.tsx`: business screens and API interactions.
- `server/app.mjs`: API validation, workflows, approvals, local model adapter.
- `server/store.mjs`: seed data and serialized atomic persistence.
- `server/public-page.mjs`: escaped public page renderer.
- `server/*.test.mjs`, `src/components/Modules.test.tsx`: verification.
- `CONTRACT.md`: initial development interface contract; running implementation and tests take precedence where evolved.
