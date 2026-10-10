import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const id = (prefix) =>
  `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
const now = () => new Date().toISOString();

export function seedState() {
  const createdAt = now();
  return {
    contacts: [
      {
        id: "ct_demo_001",
        name: "Asha Mehta",
        email: "asha@example.test",
        company: "Fictional Labs",
        stage: "lead",
        source: "demo",
        consent: true,
        createdAt,
      },
      {
        id: "ct_demo_002",
        name: "Ravi Shah",
        email: "ravi@example.test",
        company: "Sample Works",
        stage: "qualified",
        source: "demo",
        consent: true,
        createdAt,
      },
    ],
    pages: [
      {
        id: "pg_demo_001",
        title: "Product briefing",
        slug: "product-briefing",
        headline: "Build with clarity",
        description: "A fictional event for exploring the Nexus workspace.",
        accent: "#76e4c2",
        blocks: ["hero", "details", "registration"],
        status: "draft",
        createdAt,
      },
    ],
    campaigns: [
      {
        id: "ca_demo_001",
        name: "Welcome note",
        subject: "Welcome to the demo",
        body: "This is a fictional local campaign.",
        status: "draft",
        audience: "leads",
        scheduledAt: "",
        createdAt,
      },
    ],
    webinars: [
      {
        id: "wb_demo_001",
        title: "Nexus orientation",
        description: "A fictional orientation session.",
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        capacity: 50,
        joinUrl: "",
        status: "draft",
        registrations: [],
        createdAt,
      },
    ],
    plans: [
      {
        id: "plan_starter",
        name: "Starter",
        amount: 999,
        interval: "month",
        includedUsage: 100,
        overageRate: 10,
      },
      {
        id: "plan_growth",
        name: "Growth",
        amount: 2499,
        interval: "month",
        includedUsage: 500,
        overageRate: 6,
      },
    ],
    subscriptions: [],
    approvals: [],
    workflows: [],
    activities: [
      {
        id: id("act"),
        type: "system",
        message: "Demo workspace initialized",
        createdAt,
      },
    ],
    integrations: [
      {
        id: "email",
        name: "Email",
        status: "unconfigured",
        description: "No email provider configured; campaigns remain local.",
        url: "",
      },
      {
        id: "payments",
        name: "Payments",
        status: "sandbox",
        description: "Subscriptions are sandbox records only.",
        url: "",
      },
      {
        id: "attendance",
        name: "Attendance",
        status: "manual",
        description: "Attendance is entered manually.",
        url: "",
      },
    ],
  };
}

export function createStore(dir) {
  const file = path.join(dir, "state.json");
  let state;
  let queue = Promise.resolve();
  return {
    file,
    async init() {
      await fs.mkdir(dir, { recursive: true });
      try {
        state = JSON.parse(await fs.readFile(file, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") {
          state = seedState();
          await this.save();
        } else throw new Error(`persistence is invalid: ${error.message}`);
      }
      return state;
    },
    get() {
      return state;
    },
    async save(value = state) {
      const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(value, null, 2));
      try {
        // Windows indexing/antivirus can briefly lock the destination. Retry the
        // same atomic rename, never the business mutation and never delete live data.
        for (let attempt = 0; ; attempt++) {
          try {
            await fs.rename(tmp, file);
            break;
          } catch (error) {
            if (
              !["EPERM", "EACCES", "EBUSY"].includes(error.code) ||
              attempt >= 7
            )
              throw error;
            await new Promise((resolve) =>
              setTimeout(resolve, 25 * 2 ** attempt),
            );
          }
        }
      } finally {
        await fs.rm(tmp, { force: true }).catch(() => {});
      }
    },
    async update(fn) {
      const run = queue.then(async () => {
        const candidate = structuredClone(state);
        const result = await fn(candidate);
        await this.save(candidate);
        state = candidate;
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
    id,
  };
}

export { id, now };
