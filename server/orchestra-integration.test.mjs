import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import { createApp } from "./app.mjs";
import { createStore } from "./store.mjs";
import { createBusinessTools } from "./agent-tools.mjs";
import { registerDeliveryRoutes } from "./delivery.mjs";

const response = (value) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
async function fixture(t, ollamaFetch) {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "nexus-orchestra-integration-"),
  );
  const app = await createApp({ dataDir: dir, ollamaFetch });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (route, body) => {
    const res = await fetch(base + route, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, data: await res.json() };
  };
  const wait = async (statuses) => {
    for (let i = 0; i < 180; i++) {
      const { data } = await call("/api/orchestra");
      const run = data.runs.at(-1);
      if (statuses.includes(run?.status)) return run;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("run timeout");
  };
  return { call, wait, base };
}

test("real tool adapter: model creates page, pauses, publishes on exact approval, resumes Review without duplicate writes", async (t) => {
  let calls = 0;
  const model = async (url, options) => {
    if (url.endsWith("/tags"))
      return response({ models: [{ name: "test-model" }] });
    const body = JSON.parse(options.body);
    const user = body.messages[1].content;
    let answer;
    if (calls++ === 0)
      answer = {
        title: "A real page",
        tasks: [
          { agent: "Website", instruction: "Create and publish page" },
          { agent: "Review", instruction: "Inspect actual result" },
        ],
      };
    else {
      const ctx = JSON.parse(user);
      const allReceipts = ctx.priorReceipts || ctx.receipts || [];
      const own = allReceipts.filter(
        (r) =>
          r.agent ===
          (body.messages[0].content.includes("Website specialist")
            ? "Website"
            : "Review"),
      );
      if (body.messages[0].content.includes("Website specialist")) {
        const created = own.find((r) => r.tool === "create_page");
        const published = own.find(
          (r) => r.tool === "request_publish_page" && r.status === "succeeded",
        );
        answer = published
          ? {
              message: "Published with verified receipt",
              tool: "",
              args: {},
              done: true,
            }
          : created
            ? {
                message: "Request review",
                tool: "request_publish_page",
                args: { id: created.recordId },
                done: false,
              }
            : {
                message: "Creating",
                tool: "create_page",
                args: {
                  title: "Verified garden",
                  headline: "Learn gardening",
                  description: "Practical workshop skills.",
                  blocks: ["hero", "details", "registration"],
                },
                done: false,
              };
      } else
        answer = own.length
          ? {
              message: "Verified live page in workspace records",
              tool: "",
              args: {},
              done: true,
            }
          : {
              message: "Checking records",
              tool: "inspect_workspace",
              args: {},
              done: false,
            };
    }
    return response({ message: { content: JSON.stringify(answer) } });
  };
  const { call, wait, base } = await fixture(t, model);
  assert.equal(
    (
      await call("/api/orchestra/runs", {
        prompt: "Create and publish",
        model: "test-model",
      })
    ).status,
    202,
  );
  let run = await wait(["awaiting_approval", "failed"]);
  assert.equal(run.status, "awaiting_approval", run.error);
  const receipt = run.receipts.find((r) => r.approvalId);
  assert.equal(
    (await call(`/api/orchestra/runs/${run.id}/resume`, {})).status,
    409,
  );
  await call(`/api/approvals/${receipt.approvalId}/decide`, {
    decision: "approve",
  });
  assert.equal(
    (await call(`/api/orchestra/runs/${run.id}/resume`, {})).status,
    200,
  );
  run = await wait(["completed", "failed", "blocked"]);
  assert.equal(run.status, "completed", run.error);
  assert.equal(run.receipts.filter((r) => r.tool === "create_page").length, 1);
  assert.ok(
    run.receipts.some((r) => r.agent === "Review" && r.status === "succeeded"),
  );
  const state = (await call("/api/state")).data;
  assert.equal(
    state.pages.filter((p) => p.title === "Verified garden").length,
    1,
  );
  const page = state.pages.find((p) => p.title === "Verified garden");
  assert.equal((await fetch(base + `/p/${page.slug}`)).status, 200);
});

test("role policy rejects tools outside assigned specialist before side effects", async () => {
  let called = false;
  const tools = createBusinessTools({
    port: 3100,
    store: { get: () => ({}) },
    apiFetch: async () => {
      called = true;
      return response({});
    },
  });
  await assert.rejects(
    tools.execute(
      "create_contact",
      { name: "A", email: "a@example.test" },
      { agent: "Website" },
    ),
    /not permitted/,
  );
  await assert.rejects(
    tools.execute(
      "create_page",
      { title: "X", headline: "Y", description: "Z", shell: "bad" },
      { agent: "Website" },
    ),
    /Unknown argument/,
  );
  assert.equal(called, false);
});

test("real email connector requires exact approval, executes once, records provider receipts", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-delivery-"));
  const store = createStore(dir);
  await store.init();
  await store.update((s) => {
    s.contacts = [
      {
        id: "real1",
        name: "Synthetic test recipient",
        email: "recipient@example.com",
        consent: true,
        stage: "lead",
      },
    ];
    s.campaigns = [
      {
        id: "campaign1",
        name: "Test campaign",
        subject: "Test",
        body: "Synthetic test content",
        audience: "lead",
        status: "draft",
      },
    ];
  });
  let sent = 0;
  const app = express();
  app.use(express.json());
  registerDeliveryRoutes(app, {
    store,
    config: () => ({ key: "test-key-not-real", from: "sender@example.com" }),
    providerFetch: async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails/batch");
      assert.equal(JSON.parse(options.body)[0].to[0], "recipient@example.com");
      sent++;
      return response({ data: [{ id: "provider-receipt-1" }] });
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });
  const post = async (route, body = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const approval = await (
    await post("/api/campaigns/campaign1/request-send")
  ).json();
  assert.equal(sent, 0);
  assert.equal(
    (
      await post(`/api/approvals/${approval.id}/decide`, {
        decision: "approve",
      })
    ).status,
    200,
  );
  assert.equal(sent, 1);
  assert.equal(store.get().campaigns[0].status, "sent");
  assert.equal(
    (
      await post(`/api/approvals/${approval.id}/decide`, {
        decision: "approve",
      })
    ).status,
    409,
  );
  assert.equal(sent, 1);
});
