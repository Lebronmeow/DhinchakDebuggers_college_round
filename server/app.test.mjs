import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { createApp } from "./app.mjs";
import { createStore } from "./store.mjs";

async function setup() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-"));
  const server = http.createServer(await createApp({ dataDir: dir }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    server,
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}
const req = (base, route, options = {}) =>
  fetch(base + route, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
test("state and local origin enforcement", async () => {
  const x = await setup();
  try {
    const state = await (await req(x.base, "/api/state")).json();
    assert.equal(state.contacts.length, 2);
    const blocked = await req(x.base, "/api/contacts", {
      method: "POST",
      headers: { origin: "https://evil.test" },
      body: JSON.stringify({ name: "X", email: "x@example.test" }),
    });
    assert.equal(blocked.status, 403);
  } finally {
    await x.close();
  }
});
test("page approval snapshot, publish, escaped public page and registration", async () => {
  const x = await setup();
  try {
    const p = await (
      await req(x.base, "/api/pages", {
        method: "POST",
        body: JSON.stringify({
          title: "Safe <script>",
          headline: "Hello",
          description: "D",
          accent: "#fff",
          blocks: ["hero"],
        }),
      })
    ).json();
    const a = await (
      await req(x.base, `/api/pages/${p.id}/request-publish`, {
        method: "POST",
        body: "{}",
      })
    ).json();
    const ok = await req(x.base, `/api/approvals/${a.id}/decide`, {
      method: "POST",
      body: JSON.stringify({ decision: "approve" }),
    });
    assert.equal(ok.status, 200);
    const page = await (await req(x.base, `/p/${p.slug}`)).text();
    assert.match(page, /&lt;script&gt;/);
    const c = await (
      await req(x.base, `/p/${p.slug}/register`, {
        method: "POST",
        body: JSON.stringify({
          name: "New",
          email: "new@example.test",
          consent: true,
        }),
      })
    ).json();
    assert.equal(c.source, `page:${p.slug}`);
  } finally {
    await x.close();
  }
});
test("workflow creates linked drafts and idempotent usage", async () => {
  const x = await setup();
  try {
    const w = await (
      await req(x.base, "/api/workflows", {
        method: "POST",
        body: JSON.stringify({ prompt: "host a launch" }),
      })
    ).json();
    assert.ok(w.pageId && w.campaignId);
    const sub = await (
      await req(x.base, "/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          contactId: "ct_demo_001",
          planId: "plan_starter",
        }),
      })
    ).json();
    const one = await (
      await req(x.base, `/api/subscriptions/${sub.id}/usage`, {
        method: "POST",
        body: JSON.stringify({ quantity: 3, eventId: "evt1" }),
      })
    ).json();
    const two = await (
      await req(x.base, `/api/subscriptions/${sub.id}/usage`, {
        method: "POST",
        body: JSON.stringify({ quantity: 3, eventId: "evt1" }),
      })
    ).json();
    assert.equal(one.usage, 3);
    assert.equal(two.usage, 3);
  } finally {
    await x.close();
  }
});
test("store rolls back rejected mutations, serializes concurrent writes, and rejects malformed files", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-store-"));
  const store = createStore(dir);
  await store.init();
  await assert.rejects(
    store.update((s) => {
      s.contacts.push({ bad: true });
      throw new Error("no commit");
    }),
  );
  assert.equal(store.get().contacts.length, 2);
  await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      store.update((s) => {
        s.activities.push({
          id: `a${i}`,
          type: "test",
          message: "ok",
          createdAt: new Date().toISOString(),
        });
      }),
    ),
  );
  const reloaded = createStore(dir);
  await reloaded.init();
  assert.equal(
    reloaded.get().activities.filter((x) => x.type === "test").length,
    8,
  );
  await fs.writeFile(path.join(dir, "broken.json"), "{");
  const broken = createStore(path.join(dir, "broken"));
  await fs.mkdir(path.join(dir, "broken"));
  await fs.writeFile(path.join(dir, "broken", "state.json"), "{");
  await assert.rejects(broken.init(), /persistence is invalid/);
});
test("validation, stale approval rejection, workflow webinar, and canceled usage boundaries", async () => {
  const x = await setup();
  try {
    let r = await req(x.base, "/api/webinars", {
      method: "POST",
      body: JSON.stringify({
        title: "Bad",
        description: "x",
        startsAt: "tomorrow",
        capacity: 2,
        joinUrl: "javascript:alert(1)",
      }),
    });
    assert.equal(r.status, 400);
    const p = await (
      await req(x.base, "/api/pages", {
        method: "POST",
        body: JSON.stringify({
          title: "Stale",
          headline: "h",
          description: "d",
          accent: "#abc",
          blocks: [],
        }),
      })
    ).json();
    const a = await (
      await req(x.base, `/api/pages/${p.id}/request-publish`, {
        method: "POST",
        body: "{}",
      })
    ).json();
    await req(x.base, `/api/pages/${p.id}`, {
      method: "PATCH",
      body: JSON.stringify({ description: "changed" }),
    });
    r = await req(x.base, `/api/approvals/${a.id}/decide`, {
      method: "POST",
      body: JSON.stringify({ decision: "approve" }),
    });
    assert.equal(r.status, 409);
    r = await req(x.base, `/api/approvals/${a.id}/decide`, {
      method: "POST",
      body: JSON.stringify({ decision: "reject" }),
    });
    assert.equal(r.status, 200);
    const sub = await (
      await req(x.base, "/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          contactId: "ct_demo_001",
          planId: "plan_starter",
        }),
      })
    ).json();
    await req(x.base, `/api/subscriptions/${sub.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "canceled" }),
    });
    r = await req(x.base, `/api/subscriptions/${sub.id}/usage`, {
      method: "POST",
      body: JSON.stringify({ quantity: 1, eventId: "cancelled" }),
    });
    assert.equal(r.status, 409);
    const w = await (
      await req(x.base, "/api/workflows", {
        method: "POST",
        body: JSON.stringify({ prompt: "event" }),
      })
    ).json();
    assert.ok(w.webinarId);
    const state = await (await req(x.base, "/api/state")).json();
    assert.equal(state.webinars.find((x) => x.id === w.webinarId).startsAt, "");
  } finally {
    await x.close();
  }
});
