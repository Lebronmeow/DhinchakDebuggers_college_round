import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerOrchestraRoutes } from "./orchestra/routes.mjs";

function fixture(
  responses,
  execute = async () => ({
    status: "succeeded",
    message: "verified",
    recordId: "rec_1",
  }),
) {
  let state = {};
  const store = {
    get: () => state,
    async update(fn) {
      const copy = structuredClone(state);
      const result = await fn(copy);
      state = copy;
      return result;
    },
  };
  let calls = 0;
  const ollamaFetch = async (url) => {
    if (url.endsWith("/api/tags"))
      return new Response(JSON.stringify({ models: [{ name: "qwen" }] }), {
        status: 200,
      });
    const answer = responses[calls++] ?? responses.at(-1);
    return new Response(
      JSON.stringify({ message: { content: JSON.stringify(answer) } }),
      { status: 200 },
    );
  };
  const createTools = () => ({
    catalog: [
      {
        name: "lookup",
        description: "lookup",
        agents: ["CRM"],
        parameters: { type: "object" },
      },
    ],
    execute,
    context: () => ({ contacts: [{ id: "ct_1" }] }),
  });
  return { store, ollamaFetch, createTools };
}

async function start(fixtureValue) {
  const app = express();
  app.use(express.json());
  await registerOrchestraRoutes(app, fixtureValue);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}
async function waitFor(base) {
  for (let i = 0; i < 100; i++) {
    const value = await (await fetch(`${base}/api/orchestra`)).json();
    if (
      value.runs[0]?.status !== "queued" &&
      value.runs[0]?.status !== "planning" &&
      value.runs[0]?.status !== "running"
    )
      return value.runs[0];
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("timed out");
}

test("coordinator delegates and specialist feeds a real receipt", async () => {
  const f = fixture([
    {
      title: "CRM work",
      tasks: [{ agent: "CRM", instruction: "look up contact" }],
    },
    {
      message: "Found contact",
      tool: "lookup",
      args: { id: "ct_1" },
      done: false,
    },
    { message: "Verified contact", tool: "", args: {}, done: true },
  ]);
  const server = await start(f);
  try {
    const created = await (
      await fetch(`${server.base}/api/orchestra/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "find contact", model: "qwen" }),
      })
    ).json();
    const run = await waitFor(server.base);
    assert.equal(run.id, created.id);
    assert.equal(run.status, "completed");
    assert.equal(run.receipts[0].recordId, "rec_1");
    assert.ok(
      run.messages.some((m) => m.from === "CRM" && m.to === "Coordinator"),
    );
  } finally {
    await server.close();
  }
});

test("model failure fails the run without a scripted fallback", async () => {
  const f = fixture([
    { title: "bad", tasks: [{ agent: "CRM", instruction: "x" }] },
    { message: "", tool: "lookup", args: {}, done: false },
  ]);
  f.ollamaFetch = async (url) =>
    url.endsWith("/api/tags")
      ? new Response(JSON.stringify({ models: [{ name: "qwen" }] }))
      : new Response(JSON.stringify({ message: { content: "not json" } }));
  const server = await start(f);
  try {
    await fetch(`${server.base}/api/orchestra/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "x", model: "qwen" }),
    });
    const run = await waitFor(server.base);
    assert.equal(run.status, "failed");
    assert.match(run.error, /JSON/);
  } finally {
    await server.close();
  }
});

test("unknown models are rejected before inference", async () => {
  const server = await start(fixture([]));
  try {
    const response = await fetch(`${server.base}/api/orchestra/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "x", model: "missing" }),
    });
    assert.equal(response.status, 400);
  } finally {
    await server.close();
  }
});

test("completion prose without a receipt is blocked", async () => {
  const f = fixture([
    { title: "review", tasks: [{ agent: "CRM", instruction: "verify" }] },
    { message: "Done", tool: "", args: {}, done: true },
  ]);
  const server = await start(f);
  try {
    await fetch(`${server.base}/api/orchestra/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "verify", model: "qwen" }),
    });
    const run = await waitFor(server.base);
    assert.equal(run.status, "failed");
    assert.match(run.error, /receipt/);
  } finally {
    await server.close();
  }
});

test("tool creation receives the request port", async () => {
  let received;
  const f = fixture([
    { title: "x", tasks: [{ agent: "CRM", instruction: "lookup" }] },
    { message: "ok", tool: "lookup", args: {}, done: false },
    { message: "verified", tool: "", args: {}, done: true },
  ]);
  const original = f.createTools;
  f.createTools = (port) => {
    received = port;
    return original(port);
  };
  const server = await start(f);
  try {
    await fetch(`${server.base}/api/orchestra/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "lookup", model: "qwen" }),
    });
    await waitFor(server.base);
    assert.equal(received, Number(new URL(server.base).port));
  } finally {
    await server.close();
  }
});

test("restart preserves approval waiting runs", async () => {
  const f = fixture([]);
  f.store = {
    get: () => ({
      orchestraRuns: [
        {
          id: "r",
          status: "awaiting_approval",
          tasks: [],
          messages: [],
          receipts: [],
        },
      ],
    }),
    async update() {},
  };
  const server = await start(f);
  try {
    const state = await (await fetch(`${server.base}/api/orchestra`)).json();
    assert.equal(state.runs[0].status, "awaiting_approval");
  } finally {
    await server.close();
  }
});

test("unrelated approved approval cannot release a pending action", async () => {
  const f = fixture(
    [
      { title: "x", tasks: [{ agent: "CRM", instruction: "act" }] },
      { message: "needs approval", tool: "lookup", args: {}, done: false },
    ],
    async () => ({
      status: "awaiting_approval",
      message: "waiting",
      approvalId: "a_pending",
    }),
  );
  f.createTools = () => ({
    catalog: [
      {
        name: "lookup",
        description: "lookup",
        agents: ["CRM"],
        parameters: { type: "object" },
      },
    ],
    execute: async () => ({
      status: "awaiting_approval",
      message: "waiting",
      approvalId: "a_pending",
    }),
    context: () => ({ approvals: [{ id: "a_other", status: "approved" }] }),
  });
  const server = await start(f);
  try {
    await fetch(`${server.base}/api/orchestra/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "act", model: "qwen" }),
    });
    const run = await waitFor(server.base);
    const response = await fetch(
      `${server.base}/api/orchestra/runs/${run.id}/resume`,
      { method: "POST" },
    );
    assert.equal(response.status, 409);
  } finally {
    await server.close();
  }
});

test("queued cancellation does not call the model", async () => {
  let chatCalls = 0;
  const f = fixture([]);
  f.ollamaFetch = async (url, options) => {
    if (url.endsWith("/api/tags"))
      return new Response(JSON.stringify({ models: [{ name: "qwen" }] }));
    chatCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return new Response(JSON.stringify({ message: { content: "{}" } }));
  };
  const server = await start(f);
  try {
    await fetch(`${server.base}/api/orchestra/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "occupy", model: "qwen" }),
    });
    const created = await (
      await fetch(`${server.base}/api/orchestra/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "cancel", model: "qwen" }),
      })
    ).json();
    await fetch(`${server.base}/api/orchestra/runs/${created.id}/cancel`, {
      method: "POST",
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(chatCalls, 1);
  } finally {
    await server.close();
  }
});

test("delete run removes it from history", async () => {
  const f = fixture([]);
  f.ollamaFetch = async (url) => {
    if (String(url).endsWith("/api/tags"))
      return new Response(JSON.stringify({ models: [{ name: "qwen" }] }));
    return new Response(JSON.stringify({ message: { content: "{}" } }));
  };
  const server = await start(f);
  try {
    const created = await (
      await fetch(`${server.base}/api/orchestra/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "delete test", model: "qwen" }),
      })
    ).json();
    const res = await fetch(`${server.base}/api/orchestra/runs/${created.id}`, {
      method: "DELETE",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    const state = await (await fetch(`${server.base}/api/orchestra`)).json();
    assert.equal(state.runs.some((r) => r.id === created.id), false);
  } finally {
    await server.close();
  }
});

