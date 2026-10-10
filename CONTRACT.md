# Implementation contract

Local single-business prototype. No multitenant or production claims. React/TypeScript frontend, Express backend port 3100, Vite 5173. Currency INR; price values rupees, not paise. All seed/example records must be marked as demo in UI. No API credentials needed for local operations. No external side effect may pretend to succeed.

GET /api/state -> NexusState directly (src/types.ts).
POST /api/contacts {name,email,company?,stage?,consent?}; PATCH /api/contacts/:id {stage,...}.
POST /api/pages {title,headline,description,accent,blocks}; PATCH /api/pages/:id same editable fields; POST /api/pages/:id/request-publish -> approval. Public GET /p/:slug and POST /p/:slug/register {name,email,consent} create contacts.
POST /api/campaigns {name,subject,body,audience?,scheduledAt?}; POST /api/campaigns/:id/request-schedule -> approval; no actual email send without integration.
POST /api/webinars {title,description,startsAt,capacity,joinUrl?}; POST /api/webinars/:id/register {contactId}; POST /api/webinars/:id/attendance {contactId,attended} manual attendance explicitly.
POST /api/subscriptions {contactId,planId} -> sandbox subscription only; POST /api/subscriptions/:id/usage {quantity,eventId} idempotent; PATCH /api/subscriptions/:id {status:'canceled'}.
POST /api/workflows {prompt} -> deterministic local template (NOT live LLM): creates linked draft webinar/page/campaign and approval requests, workflow steps. Do not infer pricing or perform external actions. Mark execution mode.
POST /api/approvals/:id/decide {decision:'approve'|'reject'} verifies target snapshot, only pending approvals; publish approved page, or set campaign 'scheduled_local' (not sent). Refresh workflow statuses based on decisions.
Seed: small clearly fictional contact set, 2 plans, 1 example webinar, draft page/campaign, activity records. No seeded paid customers or fake revenue. Integration status must explicitly indicate unconfigured/local/manual/sandbox. Persist state to SQLite or atomically written JSON under data/; NODE_ENV=test tests use temp directory.
All API errors {error:string}. Validation and reasonable input size limits, public output HTML escaping, block unknown mutation origins, localhost bind. Shared API helper src/api.ts. Agents may not modify types/contract without coordinating via final result. No secrets.

Ollama optional: fixed local URL http://127.0.0.1:11434 (no user-supplied URLs). GET /api/ai/status -> {available:boolean,models:string[],error?:string}; POST /api/ai/plan {prompt,model} -> {title,headline,description,emailSubject,emailBody,source:'ollama',model}. Fixed JSON schema, bounded timeout/output, validate all returned fields. Does NOT mutate business state. Main UI allows reviewing generated content then POST /api/workflows {prompt,plan?}; backend must validate optional plan's content fields, never execute model instructions. No automatic model pulls or install. GET status must work with unavailable Ollama. Guided template remains fallback explicitly chosen, not silently pretending AI.

Ownership: backend agent server/** only; office agent src/components/PixelOffice.tsx + pixel-office.css only; modules agent src/components/Modules.tsx + modules.css only. Main owns shell, global css, docs, config, shared types, integration tests.
