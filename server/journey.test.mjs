import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createApp } from "./app.mjs";

async function fixture(t, options = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-journey-"));
  const app = await createApp({ dataDir: dir, ...options });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });
  const request = (route, method = "GET", body, headers = {}) =>
    fetch(base + route, {
      method,
      headers: { "content-type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const json = async (route, method = "GET", body) => {
    const r = await request(route, method, body);
    const data = await r.json();
    assert.equal(r.status, 200, JSON.stringify(data));
    return data;
  };
  return { dir, base, request, json };
}

test("journey: plan → approve → public registration → webinar → sandbox usage → reload", async (t) => {
  const { json, request, dir } = await fixture(t);
  const workflow = await json("/api/workflows", "POST", {
    prompt: "Prepare a gardening workshop invitation",
  });
  await json(`/api/webinars/${workflow.webinarId}`, "PATCH", {
    startsAt: "2027-01-15T12:30:00Z",
    capacity: 1,
    joinUrl: "https://example.test/room",
  });
  let state = await json("/api/state");
  const page = state.pages.find((p) => p.id === workflow.pageId);
  assert.equal((await request(`/p/${page.slug}`)).status, 404);
  for (const a of state.approvals.filter((a) => a.workflowId === workflow.id))
    await json(`/api/approvals/${a.id}/decide`, "POST", {
      decision: "approve",
    });
  state = await json("/api/state");
  assert.equal(
    state.workflows.find((w) => w.id === workflow.id).status,
    "drafts_ready",
  );
  assert.equal(
    state.workflows
      .find((w) => w.id === workflow.id)
      .steps.find((s) => s.agent === "Website").status,
    "completed",
  );
  const contact = await json(`/p/${page.slug}/register`, "POST", {
    name: "Garden Guest",
    email: "GUEST@example.test",
    consent: true,
  });
  const duplicate = await json(`/p/${page.slug}/register`, "POST", {
    name: "Garden Guest",
    email: "guest@example.test",
    consent: true,
  });
  assert.equal(duplicate.id, contact.id);
  assert.equal(
    (
      await request(`/p/${page.slug}/register`, "POST", {
        name: "Overflow",
        email: "overflow@example.test",
      })
    ).status,
    409,
  );
  state = await json("/api/state");
  assert.equal(
    state.contacts.some((c) => c.email === "overflow@example.test"),
    false,
    "capacity failure rolls back new contact",
  );
  assert.equal(
    state.webinars.find((w) => w.id === workflow.webinarId).registrations
      .length,
    1,
  );
  await json(`/api/webinars/${workflow.webinarId}/attendance`, "POST", {
    contactId: contact.id,
    attended: true,
  });
  const subscription = await json("/api/subscriptions", "POST", {
    contactId: contact.id,
    planId: "plan_starter",
  });
  assert.equal(subscription.sandbox, true);
  for (let i = 0; i < 2; i++)
    await json(`/api/subscriptions/${subscription.id}/usage`, "POST", {
      eventId: "__proto__",
      quantity: 4,
    });
  assert.equal(
    (await json("/api/state")).subscriptions.find(
      (s) => s.id === subscription.id,
    ).usage,
    4,
  );
  assert.equal(
    (
      await request(`/api/subscriptions/${subscription.id}/usage`, "POST", {
        eventId: "__proto__",
        quantity: 5,
      })
    ).status,
    409,
  );
  const persisted = JSON.parse(
    await fs.readFile(path.join(dir, "state.json"), "utf8"),
  );
  assert.equal(
    persisted.webinars.find((w) => w.id === workflow.webinarId).registrations[0]
      .attended,
    true,
  );
  assert.equal(
    persisted.subscriptions.find((s) => s.id === subscription.id)._usageEvents
      .__proto__,
    4,
  );
});

test("audience snapshots honor stages and opt-outs invalidate pending authorization", async (t) => {
  const { json, request } = await fixture(t);
  await json("/api/contacts/ct_demo_002", "PATCH", { stage: "qualified" });
  const campaign = await json("/api/campaigns", "POST", {
    name: "Qualified launch",
    subject: "Hello",
    body: "Review me",
    audience: "qualified",
  });
  const approval = await json(
    `/api/campaigns/${campaign.id}/request-schedule`,
    "POST",
  );
  assert.deepEqual(approval.audienceIds, ["ct_demo_002"]);
  const again = await json(
    `/api/campaigns/${campaign.id}/request-schedule`,
    "POST",
  );
  assert.equal(again.id, approval.id);
  await json("/api/contacts/ct_demo_002", "PATCH", { consent: false });
  assert.equal(
    (
      await request(`/api/approvals/${approval.id}/decide`, "POST", {
        decision: "approve",
      })
    ).status,
    409,
  );
  const fresh = await json(
    `/api/campaigns/${campaign.id}/request-schedule`,
    "POST",
  );
  assert.notEqual(fresh.id, approval.id);
  assert.deepEqual(fresh.audienceIds, []);
  await json(`/api/approvals/${fresh.id}/decide`, "POST", {
    decision: "approve",
  });
  assert.equal(
    (await json("/api/state")).campaigns.find((c) => c.id === campaign.id)
      .status,
    "scheduled_local",
  );
});

test("draft editing never changes published snapshot; rejection preserves live page", async (t) => {
  const { json, request } = await fixture(t);
  const workflow = await json("/api/workflows", "POST", {
    prompt: "Demo workshop",
  });
  let state = await json("/api/state");
  const page = state.pages.find((p) => p.id === workflow.pageId);
  const approval = state.approvals.find((a) => a.targetId === page.id);
  await json(`/api/approvals/${approval.id}/decide`, "POST", {
    decision: "approve",
  });
  await json(`/api/pages/${page.id}`, "PATCH", {
    headline: "Unreviewed <script>alert(1)</script>",
  });
  assert.doesNotMatch(
    await (await request(`/p/${page.slug}`)).text(),
    /Unreviewed/,
  );
  let revision = await json(`/api/pages/${page.id}/request-publish`, "POST");
  await json(`/api/approvals/${revision.id}/decide`, "POST", {
    decision: "reject",
  });
  assert.equal((await request(`/p/${page.slug}`)).status, 200);
  revision = await json(`/api/pages/${page.id}/request-publish`, "POST");
  await json(`/api/approvals/${revision.id}/decide`, "POST", {
    decision: "approve",
  });
  const html = await (await request(`/p/${page.slug}`)).text();
  assert.match(html, /Unreviewed &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  state = await json("/api/state");
  assert.equal(
    state.pages.find((p) => p.id === page.id)._published._published,
    undefined,
  );
  const campaignApproval = state.approvals.find(
    (a) => a.targetId === workflow.campaignId && a.status === "pending",
  );
  await json(`/api/approvals/${campaignApproval.id}/decide`, "POST", {
    decision: "approve",
  });
  assert.equal(
    (await json("/api/state")).workflows.find((w) => w.id === workflow.id)
      .status,
    "drafts_ready",
  );
});

test("local model structured output uses fixed URL, validates lengths, and cannot mutate records", async (t) => {
  const calls = [];
  const plan = {
    title: "Garden workshop",
    headline: "Grow together",
    description: "A gardening introduction",
    emailSubject: "You are invited",
    emailBody: "Join the workshop. Details will be announced.",
  };
  const fake = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify(
        url.endsWith("/tags")
          ? { models: [{ name: "test/model:8b" }] }
          : { response: JSON.stringify(plan) },
      ),
      { headers: { "content-type": "application/json" } },
    );
  };
  const { json, request } = await fixture(t, { ollamaFetch: fake });
  assert.equal((await json("/api/ai/status")).available, true);
  const result = await json("/api/ai/plan", "POST", {
    prompt: "Draft a workshop",
    model: "test/model:8b",
  });
  assert.equal(result.source, "ollama");
  assert.equal(result.title, plan.title);
  assert.equal((await json("/api/state")).workflows.length, 0);
  assert.ok(
    calls.every((c) => c.url.startsWith("http://127.0.0.1:11434/api/")),
  );
  plan.title = "x".repeat(161);
  assert.equal(
    (
      await request("/api/ai/plan", "POST", {
        prompt: "x",
        model: "test/model:8b",
      })
    ).status,
    503,
  );
});

test("web boundary rejects foreign Host, unsafe URL and bad schedules", async (t) => {
  const { request, json, base } = await fixture(t);
  // Node fetch normalizes Host; use a raw HTTP client to test DNS-rebinding defense.
  const status = await new Promise((resolve, reject) => {
    http
      .get(
        base + "/api/state",
        { headers: { Host: "attacker.example" } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      )
      .on("error", reject);
  });
  assert.equal(status, 421);
  assert.equal(
    (
      await request("/api/webinars", "POST", {
        title: "X",
        description: "Y",
        startsAt: "2027-01-15T12:30:00Z",
        capacity: 2,
        joinUrl: "javascript:alert(1)",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/campaigns", "POST", {
        name: "X",
        subject: "Y",
        body: "Z",
        audience: "all",
        scheduledAt: "nonsense",
      })
    ).status,
    400,
  );
  const state = await json("/api/state");
  assert.equal(state.webinars.length, 1);
  assert.equal(state.campaigns.length, 1);
});
