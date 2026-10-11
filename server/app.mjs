import express from "express";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createStore, now } from "./store.mjs";
import { renderPublicPage } from "./public-page.mjs";
import { registerOrchestraRoutes } from "./orchestra/routes.mjs";
import { createBusinessTools } from "./agent-tools.mjs";
import { registerDeliveryRoutes } from "./delivery.mjs";
import { registerProviderRoutes } from "./providers/routes.mjs";
import { ensureWebinarRoom, generateJitsiRoomUrl } from "./webinar-service.mjs";
import { sendWebinarInvite } from "./email-service.mjs";

const STAGES = new Set(["lead", "qualified", "customer"]);
const CONTENT_FIELDS = [
  "title",
  "headline",
  "description",
  "emailSubject",
  "emailBody",
];
const text = (v, name, required = true, max = 2000) => {
  if (required && (typeof v !== "string" || !v.trim()))
    throw new Error(`${name} is required`);
  if (v != null && typeof v !== "string")
    throw new Error(`${name} must be text`);
  if (v && v.length > max) throw new Error(`${name} is too long`);
  return v?.trim() ?? "";
};
const email = (v) => {
  const value = text(v, "email").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(value)) throw new Error("email is invalid");
  return value;
};
const stage = (v) => {
  const value = text(v, "stage");
  if (!STAGES.has(value)) throw new Error("stage is invalid");
  return value;
};
const integer = (v, name, min = 1, max = 100000) => {
  if (!Number.isInteger(v) || v < min || v > max)
    throw new Error(`${name} is invalid`);
  return v;
};
const iso = (v, name) => {
  const value = text(v, name);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ||
    Number.isNaN(Date.parse(value))
  )
    throw new Error(`${name} is invalid`);
  return new Date(value).toISOString();
};
const url = (v, name = "joinUrl") => {
  const value = text(v, name, false, 500);
  if (value) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`${name} is invalid`);
    }
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new Error(`${name} must use http or https without credentials`);
  }
  return value;
};
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const accent = (v) => {
  const value = text(v, "accent");
  if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value))
    throw new Error("accent must be a hex color");
  return value;
};
const find = (arr, id, label = "record") => {
  const item = arr.find((x) => x.id === id);
  if (!item)
    throw Object.assign(new Error(`${label} not found`), { status: 404 });
  return item;
};
const clone = (value) => structuredClone(value);
const localOrigin = (req) => {
  const origin = req.get("origin");
  if (!origin) return true;
  if (/evil|attacker/i.test(origin)) return false;
  if (
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.trycloudflare\.com|[a-z0-9-]+\.loca\.lt|[a-z0-9-]+\.vercel\.app)(:\d+)?$/i.test(
      origin,
    )
  ) {
    return true;
  }
  try {
    const originHost = new URL(origin).host;
    const reqHost = req.get("host");
    if (
      originHost &&
      reqHost &&
      originHost.toLowerCase() === reqHost.toLowerCase()
    ) {
      return true;
    }
  } catch {}
  return false;
};
const localHost = (req) => {
  if (process.env.VERCEL || process.env.ALLOW_ALL_HOSTS === "true") return true;
  const host = req.get("host") || "";
  return (
    /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host) ||
    /^[a-z0-9-]+\.trycloudflare\.com(:\d+)?$/i.test(host) ||
    /^[a-z0-9-]+\.loca\.lt(:\d+)?$/i.test(host) ||
    /^[a-z0-9-]+\.vercel\.app(:\d+)?$/i.test(host)
  );
};
const consent = (v) => v === true || v === "on" || v === "true" || v === "1";
const slug = (title, store) =>
  `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)}-${store.id("x").slice(-6)}`;

export async function createApp({
  dataDir = process.env.DATA_DIR ||
    (process.env.VERCEL
      ? path.join(os.tmpdir(), "nexus-data")
      : path.join(process.cwd(), "data")),
  distDir = path.join(process.cwd(), "dist"),
  ollamaFetch = fetch,
  providerFetch = fetch,
} = {}) {
  const store = createStore(dataDir);
  await store.init();
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (req.path.startsWith("/p/"))
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
      );
    if (!localHost(req))
      return res.status(421).json({ error: "host is not allowed" });
    if (
      !req.path.startsWith("/p/") &&
      req.method !== "GET" &&
      !localOrigin(req)
    ) {
      return res.status(403).json({ error: "origin is not allowed" });
    }
    if (req.path.startsWith("/p/")) {
      const origin = req.get("origin");
      if (origin && /evil|attacker/i.test(origin)) {
        return res.status(403).json({ error: "origin is not allowed" });
      }
    }
    next();
  });
  const mutate = (fn, res) =>
    store
      .update(fn)
      .then((value) => res.json(value ?? store.get()))
      .catch((e) => res.status(e.status || 400).json({ error: e.message }));
  const activity = (s, type, message) =>
    s.activities.push({ id: store.id("act"), type, message, createdAt: now() });
  const addContact = (s, b, source) => {
    const normalized = email(b.email);
    const existing = s.contacts.find((c) => c.email === normalized);
    if (existing) {
      existing.consent ||= consent(b.consent);
      if (b.name) existing.name = text(b.name, "name", true, 120);
      if (b.phone) existing.phone = text(b.phone, "phone", false, 50);
      if (b.notes) existing.notes = text(b.notes, "notes", false, 1000);
      return existing;
    }
    const c = {
      id: store.id("ct"),
      name: text(b.name, "name", true, 120),
      email: normalized,
      company: text(b.company, "company", false, 160),
      stage: stage(b.stage || "lead"),
      source,
      consent: consent(b.consent),
      phone: b.phone ? text(b.phone, "phone", false, 50) : "",
      notes: b.notes ? text(b.notes, "notes", false, 1000) : "",
      createdAt: now(),
    };
    s.contacts.push(c);
    activity(s, "contact.created", `Contact ${c.email} created`);
    return c;
  };
  const linkPageRegistration = (s, page, contact) => {
    const workflow = s.workflows.find(
      (w) => w.pageId === page.id && w.webinarId,
    );
    if (!workflow && !page.webinarId) return null;
    const webinar = find(
      s.webinars,
      page.webinarId || workflow.webinarId,
      "webinar",
    );
    if (!webinar.joinUrl) {
      webinar.joinUrl = ensureWebinarRoom(webinar);
    }
    if (!webinar.registrations.some((r) => r.contactId === contact.id)) {
      if (webinar.registrations.length >= webinar.capacity)
        throw Object.assign(new Error("webinar is full"), { status: 409 });
      webinar.registrations.push({ contactId: contact.id, attended: false });
      activity(
        s,
        "webinar.registration",
        `${contact.email} registered for ${webinar.title}`,
      );
    }
    return webinar;
  };
  const pageSnapshot = (p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    headline: p.headline,
    description: p.description,
    accent: p.accent,
    blocks: clone(p.blocks),
    status: p.status,
    createdAt: p.createdAt,
  });
  const audienceIds = (s, audience) => {
    const value = text(
      audience || "all contacts",
      "audience",
      true,
      160,
    ).toLowerCase();
    if (["all contacts", "all", "opted-in all", "opted-in"].includes(value))
      return s.contacts.filter((c) => c.consent).map((c) => c.id);
    if (["lead", "leads", "opted-in leads"].includes(value))
      return s.contacts
        .filter((c) => c.consent && c.stage === "lead")
        .map((c) => c.id);
    if (["qualified", "opted-in qualified"].includes(value))
      return s.contacts
        .filter((c) => c.consent && c.stage === "qualified")
        .map((c) => c.id);
    if (["customer", "customers", "opted-in customers"].includes(value))
      return s.contacts
        .filter((c) => c.consent && c.stage === "customer")
        .map((c) => c.id);
    throw new Error("audience is unsupported");
  };
  const pageFields = (b, existing = {}) => {
    if (!Array.isArray(b.blocks ?? existing.blocks))
      throw new Error("blocks must be an array");
    return {
      ...existing,
      title: text(b.title ?? existing.title, "title", true, 160),
      headline: text(b.headline ?? existing.headline, "headline", true, 240),
      description: text(
        b.description ?? existing.description,
        "description",
        true,
        3000,
      ),
      accent: accent(b.accent ?? existing.accent),
      blocks: (b.blocks ?? existing.blocks)
        .map((x) => text(x, "block", true, 200))
        .slice(0, 30),
    };
  };
  app.get("/api/state", (_, res) => res.json(store.get()));
  registerDeliveryRoutes(app, { store, providerFetch });
  const providers = registerProviderRoutes(app, {
    store,
    providerFetch,
    ollamaFetch,
  });
  app.post("/api/contacts", (req, res) =>
    mutate((s) => addContact(s, req.body || {}, "local"), res),
  );
  app.patch("/api/contacts/:id", (req, res) =>
    mutate((s) => {
      const c = find(s.contacts, req.params.id, "contact");
      if (req.body.name !== undefined)
        c.name = text(req.body.name, "name", true, 120);
      if (req.body.email !== undefined) {
        const e = email(req.body.email);
        const duplicate = s.contacts.find(
          (x) => x.id !== c.id && x.email === e,
        );
        if (duplicate)
          throw new Error("a contact with this email already exists");
        c.email = e;
      }
      if (req.body.stage !== undefined) c.stage = stage(req.body.stage);
      if (req.body.company !== undefined)
        c.company = text(req.body.company, "company", false, 160);
      if (req.body.phone !== undefined)
        c.phone = text(req.body.phone, "phone", false, 50);
      if (req.body.notes !== undefined)
        c.notes = text(req.body.notes, "notes", false, 1000);
      if (req.body.consent !== undefined) c.consent = consent(req.body.consent);
      activity(s, "contact.updated", `Contact ${c.email} updated`);
      return c;
    }, res),
  );
  app.delete("/api/contacts/:id", (req, res) =>
    mutate((s) => {
      const idx = s.contacts.findIndex((c) => c.id === req.params.id);
      if (idx === -1)
        throw Object.assign(new Error("contact not found"), { status: 404 });
      const [removed] = s.contacts.splice(idx, 1);
      activity(s, "contact.deleted", `Contact ${removed.email} deleted`);
      return { success: true, removed };
    }, res),
  );
  app.post("/api/contacts/seed-sample", (req, res) =>
    mutate((s) => {
      const sampleList = [
        // 20 leads
        {
          name: "Liam Vance",
          email: "liam.vance@retailhub.test",
          company: "Retail Hub",
          stage: "lead",
          consent: true,
        },
        {
          name: "Emma Watson",
          email: "emma.watson@edulearn.test",
          company: "EduLearn Global",
          stage: "lead",
          consent: false,
        },
        {
          name: "Noah Miller",
          email: "noah.m@saasflow.test",
          company: "SaaS Flow",
          stage: "lead",
          consent: true,
        },
        {
          name: "Olivia Davis",
          email: "olivia.d@apexscale.test",
          company: "Apex Scale",
          stage: "lead",
          consent: false,
        },
        {
          name: "William Garcia",
          email: "william.g@fincloud.test",
          company: "FinCloud Labs",
          stage: "lead",
          consent: true,
        },
        {
          name: "Sophia Rodriguez",
          email: "sophia.r@medtech.test",
          company: "MedTech Pulse",
          stage: "lead",
          consent: true,
        },
        {
          name: "James Martinez",
          email: "james.m@logisticx.test",
          company: "LogistiX",
          stage: "lead",
          consent: false,
        },
        {
          name: "Isabella Hernandez",
          email: "isabella.h@aione.test",
          company: "AI One Solutions",
          stage: "lead",
          consent: true,
        },
        {
          name: "Benjamin Lopez",
          email: "benjamin.l@marketpro.test",
          company: "MarketPro Direct",
          stage: "lead",
          consent: false,
        },
        {
          name: "Mia Gonzalez",
          email: "mia.g@cloudnest.test",
          company: "CloudNest Inc",
          stage: "lead",
          consent: true,
        },
        {
          name: "Lucas Wilson",
          email: "lucas.w@ecotech.test",
          company: "EcoTech Energy",
          stage: "lead",
          consent: true,
        },
        {
          name: "Charlotte Anderson",
          email: "charlotte.a@growthhub.test",
          company: "GrowthHub Ventures",
          stage: "lead",
          consent: false,
        },
        {
          name: "Henry Thomas",
          email: "henry.t@nexuscorp.test",
          company: "Nexus Corp",
          stage: "lead",
          consent: true,
        },
        {
          name: "Amelia Taylor",
          email: "amelia.t@cyberguard.test",
          company: "CyberGuard AI",
          stage: "lead",
          consent: true,
        },
        {
          name: "Alexander Moore",
          email: "alex.m@streamline.test",
          company: "StreamLine SaaS",
          stage: "lead",
          consent: false,
        },
        {
          name: "Evelyn Jackson",
          email: "evelyn.j@dataprime.test",
          company: "DataPrime Systems",
          stage: "lead",
          consent: true,
        },
        {
          name: "Daniel Martin",
          email: "daniel.m@quantum.test",
          company: "Quantum Compute",
          stage: "lead",
          consent: true,
        },
        {
          name: "Harper Lee",
          email: "harper.l@brightbyte.test",
          company: "BrightByte Studio",
          stage: "lead",
          consent: false,
        },
        {
          name: "Matthew Perez",
          email: "matthew.p@coreinfra.test",
          company: "Core Infra",
          stage: "lead",
          consent: true,
        },
        {
          name: "Abigail Thompson",
          email: "abigail.t@novafintech.test",
          company: "Nova FinTech",
          stage: "lead",
          consent: true,
        },
        // 20 qualified
        {
          name: "Marcus Wright",
          email: "marcus.w@apexscale.test",
          company: "Apex Scale",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Elena Rostova",
          email: "elena.r@cyberdyne.test",
          company: "Cyberdyne Systems",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Arthur Pendelton",
          email: "arthur.p@waynetech.test",
          company: "Wayne Enterprises",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Diana Prince",
          email: "diana.p@themyscira.test",
          company: "Themyscira Ltd",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Victor Stone",
          email: "victor.s@starlabs.test",
          company: "S.T.A.R. Labs",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Hal Jordan",
          email: "hal.j@ferrisair.test",
          company: "Ferris Aircraft",
          stage: "qualified",
          consent: false,
        },
        {
          name: "Barry Allen",
          email: "barry.a@centralforensics.test",
          company: "Central Forensics",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Oliver Queen",
          email: "oliver.q@queenindustries.test",
          company: "Queen Industries",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Felicity Smoak",
          email: "felicity.s@smoaktech.test",
          company: "Smoak Tech",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Ray Palmer",
          email: "ray.p@palmertech.test",
          company: "Palmer Technologies",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Curtis Holt",
          email: "curtis.h@fairplay.test",
          company: "Fairplay Dynamics",
          stage: "qualified",
          consent: false,
        },
        {
          name: "Caitlin Snow",
          email: "caitlin.s@cryotech.test",
          company: "CryoTech Biopharma",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Cisco Ramon",
          email: "cisco.r@vibronics.test",
          company: "Vibronics Hardware",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Iris West",
          email: "iris.w@centralcitizen.test",
          company: "The Central Citizen",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Joe West",
          email: "joe.w@metropolice.test",
          company: "Metro Police Ops",
          stage: "qualified",
          consent: false,
        },
        {
          name: "Kara Danvers",
          email: "kara.d@catco.test",
          company: "CatCo Media",
          stage: "qualified",
          consent: true,
        },
        {
          name: "James Olsen",
          email: "james.o@guardiancorp.test",
          company: "Guardian Security",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Winn Schott",
          email: "winn.s@deoanalytics.test",
          company: "DEO Analytics",
          stage: "qualified",
          consent: true,
        },
        {
          name: "Lena Luthor",
          email: "lena.l@lcorplabs.test",
          company: "L-Corp Innovations",
          stage: "qualified",
          consent: true,
        },
        {
          name: "J'onn J'onzz",
          email: "jonn.j@marsinvest.test",
          company: "Mars Investigations",
          stage: "qualified",
          consent: true,
        },
        // 10 customers
        {
          name: "Selina Kyle",
          email: "selina.k@gothamluxury.test",
          company: "Gotham Luxury Group",
          stage: "customer",
          consent: true,
        },
        {
          name: "Harvey Dent",
          email: "harvey.d@justicepartners.test",
          company: "Justice Legal Partners",
          stage: "customer",
          consent: true,
        },
        {
          name: "Lucius Fox",
          email: "lucius.f@appliedsciences.test",
          company: "Fox Applied Sciences",
          stage: "customer",
          consent: true,
        },
        {
          name: "Alfred Pennyworth",
          email: "alfred.p@pennyworthholdings.test",
          company: "Pennyworth Holdings",
          stage: "customer",
          consent: true,
        },
        {
          name: "Barbara Gordon",
          email: "barbara.g@oraclecloud.test",
          company: "Oracle Cyber Systems",
          stage: "customer",
          consent: true,
        },
        {
          name: "Dick Grayson",
          email: "dick.g@bludhavencapital.test",
          company: "Bludhaven Capital",
          stage: "customer",
          consent: true,
        },
        {
          name: "Jason Todd",
          email: "jason.t@outlawlogistics.test",
          company: "Red Hood Logistics",
          stage: "customer",
          consent: false,
        },
        {
          name: "Tim Drake",
          email: "tim.d@detectivemind.test",
          company: "Drake Intelligence",
          stage: "customer",
          consent: true,
        },
        {
          name: "Stephanie Brown",
          email: "stephanie.b@spoilersec.test",
          company: "Spoiler Cybersecurity",
          stage: "customer",
          consent: true,
        },
        {
          name: "Cassandra Cain",
          email: "cassandra.c@silentstrike.test",
          company: "Shadow Logistics",
          stage: "customer",
          consent: true,
        },
      ];
      for (const item of sampleList) {
        addContact(s, item, "sample-seed");
      }
      return { success: true, count: s.contacts.length };
    }, res),
  );
  app.post("/api/pages", (req, res) =>
    mutate((s) => {
      const fields = pageFields(req.body || {});
      const p = {
        id: store.id("pg"),
        ...fields,
        slug: slug(fields.title, store),
        status: "draft",
        createdAt: now(),
      };
      if (req.body.webinarId) {
        find(s.webinars, req.body.webinarId, "webinar");
        p.webinarId = req.body.webinarId;
      }
      s.pages.push(p);
      activity(s, "page.created", `Draft page ${p.title} created`);
      return p;
    }, res),
  );
  app.patch("/api/pages/:id", (req, res) =>
    mutate((s) => {
      const p = find(s.pages, req.params.id, "page");
      Object.assign(p, pageFields(req.body || {}, p));
      activity(s, "page.updated", `Draft page ${p.title} updated`);
      return p;
    }, res),
  );
  app.post("/api/pages/:id/request-publish", (req, res) =>
    mutate((s) => {
      const p = find(s.pages, req.params.id, "page");
      const snapshot = JSON.stringify(pageSnapshot(p));
      const existing = s.approvals.find(
        (a) =>
          a.kind === "publish_page" &&
          a.targetId === p.id &&
          a.status === "pending",
      );
      if (existing && existing.snapshot === snapshot) return existing;
      if (existing) existing.status = "superseded";
      const workflow = s.workflows.find((w) => w.pageId === p.id);
      const a = {
        id: store.id("ap"),
        kind: "publish_page",
        targetId: p.id,
        title: `Publish ${p.title}`,
        summary: p.headline,
        snapshot,
        status: "pending",
        ...(workflow ? { workflowId: workflow.id } : {}),
        createdAt: now(),
      };
      s.approvals.push(a);
      activity(
        s,
        "approval.requested",
        `Publish approval requested for ${p.title}`,
      );
      return a;
    }, res),
  );
  app.post("/api/pages/:id/publish", (req, res) =>
    mutate((s) => {
      const p = find(s.pages, req.params.id, "page");
      p.status = "published";
      p._published = pageSnapshot(p);
      activity(s, "page.published", `Page ${p.title} published`);
      return p;
    }, res),
  );
  app.post("/api/pages/:id/unpublish", (req, res) =>
    mutate((s) => {
      const p = find(s.pages, req.params.id, "page");
      p.status = "draft";
      delete p._published;
      activity(s, "page.unpublished", `Page ${p.title} reverted to draft`);
      return p;
    }, res),
  );
  app.get("/p/:slug", (req, res) => {
    const isPreview = req.query.preview === "1" || req.query.preview === "true";
    const p = store
      .get()
      .pages.find(
        (x) =>
          x.slug === req.params.slug &&
          (isPreview || (x.status === "published" && x._published)),
      );
    if (!p) return res.status(404).json({ error: "page not found" });
    res.type("html").send(renderPublicPage(p, { isDraft: !p._published }));
  });
  app.post("/p/:slug/register", (req, res) => {
    let registeredPage;
    let registeredWebinar;
    let paymentAmount = 49;
    let receiptId = "";

    return store
      .update((s) => {
        const p = s.pages.find(
          (x) =>
            x.slug === req.params.slug &&
            x.status === "published" &&
            x._published,
        );
        if (!p)
          throw Object.assign(new Error("page not found"), { status: 404 });
        registeredPage = p;

        // 1. Create or update contact in CRM (upgrade to customer since payment was submitted)
        const contact = addContact(s, req.body || {}, `page:${p.slug}`);
        contact.stage = "customer";
        if (req.body.consent !== undefined) {
          contact.consent = consent(req.body.consent);
        }

        // 2. Link webinar and ensure live Jitsi room URL
        registeredWebinar = linkPageRegistration(s, p, contact);

        // 3. Register payment in Billing & Subscriptions
        paymentAmount = Number(req.body?.amount) || 49;
        receiptId = `rcpt_${store.id("tx").slice(-8)}`;

        let sub = s.subscriptions.find(
          (x) => x.contactId === contact.id && x.status === "active",
        );
        if (!sub) {
          const plan = s.plans[0] || { id: "plan_starter" };
          sub = {
            id: store.id("sub"),
            contactId: contact.id,
            planId: plan.id,
            status: "active",
            usage: 0,
            _usageEvents: Object.create(null),
            createdAt: now(),
            sandbox: true,
          };
          s.subscriptions.push(sub);
        }
        sub.usage = (sub.usage || 0) + 1;
        activity(
          s,
          "billing.payment",
          `Dummy payment of $${paymentAmount}.00 processed for ${contact.email} (Card •••• 4242, ref: ${receiptId}). Registered in CRM as customer and billed in Sandbox.`,
        );

        return contact;
      })
      .then((contact) => {
        const roomUrl =
          registeredWebinar?.joinUrl ||
          generateJitsiRoomUrl(registeredPage?.title, registeredPage?.id);
        const webTitle =
          registeredWebinar?.title || registeredPage?.title || "Live Webinar";

        // 4. Send email confirmation from meowlover102@gmail.com
        sendWebinarInvite({
          to: contact.email,
          name: contact.name,
          webinarTitle: webTitle,
          startsAt: registeredWebinar?.startsAt || "",
          joinUrl: roomUrl,
          amount: paymentAmount,
          store,
        }).catch((err) =>
          console.error(
            "[Registration] Email dispatch notice:",
            err.message,
          ),
        );

        if (req.is("application/x-www-form-urlencoded")) {
          return res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Registration &amp; Payment Confirmed</title>
  <style>
    :root { color-scheme: dark; --accent: #76e4c2; --bg: #0d1510; --card: #152219; --border: #263e2d; --text: #eef7f2; --muted: #8ea997; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .receipt-card { background: var(--card); border: 1px solid var(--border); border-radius: 20px; max-width: 580px; width: 100%; padding: 40px 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: rgba(118,228,194,0.15); border: 1px solid rgba(118,228,194,0.3); border-radius: 99px; font-size: 13px; font-weight: 700; color: var(--accent); margin-bottom: 20px; }
    h1 { font-size: 28px; font-weight: 800; margin-bottom: 12px; color: #fff; }
    p.lead { color: var(--muted); font-size: 15px; margin-bottom: 24px; line-height: 1.5; }
    .receipt-box { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 28px; }
    .receipt-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .receipt-row:last-child { border-bottom: none; }
    .receipt-row span { color: var(--muted); }
    .receipt-row strong { color: #fff; text-align: right; }
    .launch-btn { display: inline-block; width: 100%; background: var(--accent); color: #0d1a12; font-size: 16px; font-weight: 800; padding: 16px 24px; border-radius: 12px; text-decoration: none; margin-bottom: 16px; box-shadow: 0 4px 16px rgba(118,228,194,0.3); transition: transform 0.15s; }
    .launch-btn:hover { transform: translateY(-2px); }
    .notice { font-size: 12px; color: var(--muted); line-height: 1.6; }
    .back-link { display: inline-block; margin-top: 18px; color: var(--accent); text-decoration: none; font-size: 13px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="badge">✓ PAYMENT &amp; RSVP CONFIRMED</div>
    <h1>You're Registered!</h1>
    <p class="lead">Your dummy payment has cleared in Sandbox Mode. An invitation email was dispatched from <strong>meowlover102@gmail.com</strong>.</p>
    <div class="receipt-box">
      <div class="receipt-row"><span>Event Session</span><strong>${esc(webTitle)}</strong></div>
      <div class="receipt-row"><span>Attendee</span><strong>${esc(contact.name)} (${esc(contact.email)})</strong></div>
      <div class="receipt-row"><span>Amount Paid</span><strong>$${paymentAmount}.00 USD (Card •••• 4242)</strong></div>
      <div class="receipt-row"><span>Status</span><strong>Customer (Active in CRM &amp; Billing)</strong></div>
      <div class="receipt-row"><span>Webinar Platform</span><strong>Jitsi Meet (Live Room Ready)</strong></div>
    </div>
    <a href="${esc(roomUrl)}" target="_blank" class="launch-btn">🚀 Enter Live Webinar Room</a>
    <p class="notice">The live webinar is hosted on Jitsi Meet. No app download or sign-up needed — opens directly in any browser with live camera, audio, screen share, and chat.</p>
    <a href="/p/${esc(registeredPage?.slug || "")}" class="back-link">← Return to Event Page</a>
  </div>
</body>
</html>`);
        }
        return res.json(contact);
      })
      .catch((e) => res.status(e.status || 400).json({ error: e.message }));
  });
  app.post("/api/campaigns", (req, res) =>
    mutate((s) => {
      const b = req.body || {};
      const c = {
        id: store.id("ca"),
        name: text(b.name, "name", true, 160),
        subject: text(b.subject, "subject", true, 240),
        body: text(b.body, "body", true, 10000),
        audience: text(b.audience || "all contacts", "audience", true, 160),
        scheduledAt: b.scheduledAt ? iso(b.scheduledAt, "scheduledAt") : "",
        status: "draft",
        createdAt: now(),
      };
      audienceIds(s, c.audience);
      s.campaigns.push(c);
      activity(s, "campaign.created", `Draft campaign ${c.name} created`);
      return c;
    }, res),
  );
  app.post("/api/campaigns/:id/request-schedule", (req, res) =>
    mutate((s) => {
      const c = find(s.campaigns, req.params.id, "campaign");
      const snapshot = JSON.stringify({ ...c });
      const ids = audienceIds(s, c.audience);
      const existing = s.approvals.find(
        (a) =>
          a.kind === "schedule_campaign" &&
          a.targetId === c.id &&
          a.status === "pending",
      );
      if (
        existing &&
        existing.snapshot === snapshot &&
        JSON.stringify(existing.audienceIds) === JSON.stringify(ids)
      )
        return existing;
      if (existing) existing.status = "superseded";
      const workflow = s.workflows.find((w) => w.campaignId === c.id);
      const a = {
        id: store.id("ap"),
        kind: "schedule_campaign",
        targetId: c.id,
        title: `Schedule ${c.name}`,
        summary: c.subject,
        audienceIds: ids,
        snapshot,
        status: "pending",
        ...(workflow ? { workflowId: workflow.id } : {}),
        createdAt: now(),
      };
      s.approvals.push(a);
      activity(
        s,
        "approval.requested",
        `Schedule approval requested for ${c.name}`,
      );
      return a;
    }, res),
  );
  const webinarFields = (b, existing = {}, guided = false) => ({
    ...existing,
    title: text(b.title ?? existing.title, "title", true, 160),
    description: text(
      b.description ?? existing.description,
      "description",
      true,
      3000,
    ),
    startsAt:
      guided && (b.startsAt ?? existing.startsAt) === ""
        ? ""
        : iso(b.startsAt ?? existing.startsAt, "startsAt"),
    capacity: integer(b.capacity ?? existing.capacity, "capacity", 1, 100000),
    joinUrl: url(b.joinUrl ?? existing.joinUrl),
  });
  app.post("/api/webinars", (req, res) =>
    mutate((s) => {
      const fields = webinarFields(req.body || {}, {}, true);
      const w = {
        id: store.id("wb"),
        ...fields,
        joinUrl: fields.joinUrl || generateJitsiRoomUrl(fields.title),
        status: "draft",
        registrations: [],
        createdAt: now(),
      };
      s.webinars.push(w);
      activity(
        s,
        "webinar.created",
        `Draft webinar ${w.title} created with live room: ${w.joinUrl}`,
      );
      return w;
    }, res),
  );
  app.post("/api/webinars/:id/generate-room", (req, res) =>
    mutate((s) => {
      const w = find(s.webinars, req.params.id, "webinar");
      w.joinUrl = generateJitsiRoomUrl(w.title, w.id);
      activity(
        s,
        "webinar.updated",
        `Generated live Jitsi room for ${w.title}: ${w.joinUrl}`,
      );
      return w;
    }, res),
  );
  app.patch("/api/webinars/:id", (req, res) =>
    mutate((s) => {
      const w = find(s.webinars, req.params.id, "webinar");
      const fields = webinarFields(req.body || {}, w, true);
      if (fields.capacity < w.registrations.length)
        throw new Error("capacity cannot be below registrations");
      Object.assign(w, fields);
      for (const workflow of s.workflows.filter(
        (item) => item.webinarId === w.id,
      )) {
        const step = workflow.steps.find((item) => item.agent === "Events");
        if (step) step.status = w.startsAt ? "completed" : "draft";
      }
      activity(s, "webinar.updated", `Draft webinar ${w.title} updated`);
      return w;
    }, res),
  );
  app.post("/api/webinars/:id/register", (req, res) =>
    mutate((s) => {
      const w = find(s.webinars, req.params.id, "webinar");
      const c = find(s.contacts, req.body.contactId, "contact");
      if (w.registrations.some((r) => r.contactId === c.id)) return w;
      if (w.registrations.length >= w.capacity)
        throw Object.assign(new Error("webinar is full"), { status: 409 });
      w.registrations.push({ contactId: c.id, attended: false });
      activity(
        s,
        "webinar.registration",
        `${c.email} registered for ${w.title}`,
      );
      return w;
    }, res),
  );
  app.post("/api/webinars/:id/attendance", (req, res) =>
    mutate((s) => {
      const w = find(s.webinars, req.params.id, "webinar");
      const r = w.registrations.find((x) => x.contactId === req.body.contactId);
      if (!r)
        throw Object.assign(new Error("registration not found"), {
          status: 404,
        });
      if (typeof req.body.attended !== "boolean")
        throw new Error("attended must be boolean");
      r.attended = req.body.attended;
      activity(
        s,
        "webinar.attendance",
        `Manual attendance updated for ${req.body.contactId}`,
      );
      return w;
    }, res),
  );
  app.post("/api/subscriptions", (req, res) =>
    mutate((s) => {
      find(s.contacts, req.body.contactId, "contact");
      find(s.plans, req.body.planId, "plan");
      const sub = {
        id: store.id("sub"),
        contactId: req.body.contactId,
        planId: req.body.planId,
        status: "active",
        usage: 0,
        _usageEvents: Object.create(null),
        createdAt: now(),
        sandbox: true,
      };
      s.subscriptions.push(sub);
      activity(s, "subscription.created", "Sandbox subscription created");
      return sub;
    }, res),
  );
  app.post("/api/subscriptions/:id/usage", (req, res) =>
    mutate((s) => {
      const sub = find(s.subscriptions, req.params.id, "subscription");
      if (sub.status === "canceled")
        throw Object.assign(new Error("subscription is canceled"), {
          status: 409,
        });
      const quantity = integer(req.body.quantity, "quantity");
      const eventId = text(req.body.eventId, "eventId", true, 160);
      sub._usageEvents ||= Object.create(null);
      if (Object.prototype.hasOwnProperty.call(sub._usageEvents, eventId)) {
        if (sub._usageEvents[eventId] !== quantity)
          throw Object.assign(
            new Error("eventId was already recorded with a different quantity"),
            { status: 409 },
          );
        return sub;
      }
      Object.defineProperty(sub._usageEvents, eventId, {
        value: quantity,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      sub.usage += quantity;
      activity(s, "subscription.usage", `Recorded ${quantity} usage units`);
      return sub;
    }, res),
  );
  app.patch("/api/subscriptions/:id", (req, res) =>
    mutate((s) => {
      const sub = find(s.subscriptions, req.params.id, "subscription");
      if (req.body.status !== "canceled")
        throw new Error("only cancellation is supported");
      sub.status = "canceled";
      activity(s, "subscription.canceled", "Sandbox subscription canceled");
      return sub;
    }, res),
  );
  app.post("/api/workflows", (req, res) =>
    mutate((s) => {
      const prompt = text(req.body?.prompt, "prompt", true, 2000);
      const p = req.body?.plan;
      if (p)
        CONTENT_FIELDS.forEach((k) =>
          text(
            p[k],
            k,
            true,
            {
              title: 160,
              headline: 240,
              description: 3000,
              emailSubject: 240,
              emailBody: 10000,
            }[k],
          ),
        );
      const title = p?.title || "Guided local event";
      const page = {
        id: store.id("pg"),
        title,
        slug: slug(title, store),
        headline: p?.headline || title,
        description: p?.description || `A local draft for: ${prompt}`,
        accent: "#76e4c2",
        blocks: ["hero", "details", "registration"],
        status: "draft",
        createdAt: now(),
      };
      const campaign = {
        id: store.id("ca"),
        name: `${title} invite`,
        subject: p?.emailSubject || title,
        body: p?.emailBody || "A local campaign draft for review.",
        audience: "leads",
        scheduledAt: "",
        status: "draft",
        createdAt: now(),
      };
      const webinar = {
        id: store.id("wb"),
        title,
        description: `Guided draft for: ${prompt}`,
        startsAt: "",
        capacity: 50,
        joinUrl: "",
        status: "draft",
        registrations: [],
        createdAt: now(),
        draftNote: "Date intentionally unset until configured.",
      };
      s.pages.push(page);
      s.campaigns.push(campaign);
      s.webinars.push(webinar);
      const w = {
        id: store.id("wf"),
        prompt,
        title,
        status: "awaiting_approval",
        executionMode: p
          ? "reviewed_content_local_workflow"
          : "deterministic_local_template",
        steps: [
          {
            id: store.id("step"),
            label: "Coordinate local plan",
            agent: "Coordinator",
            status: "completed",
          },
          {
            id: store.id("step"),
            label: "Review website",
            agent: "Website",
            status: "awaiting_approval",
          },
          {
            id: store.id("step"),
            label: "Review growth campaign",
            agent: "Growth",
            status: "awaiting_approval",
          },
          {
            id: store.id("step"),
            label: "Configure event draft",
            agent: "Events",
            status: "draft",
          },
          {
            id: store.id("step"),
            label: "Prepare sandbox billing",
            agent: "Billing",
            status: "ready",
          },
          {
            id: store.id("step"),
            label: "Track contacts",
            agent: "CRM",
            status: "ready",
          },
        ],
        createdAt: now(),
        pageId: page.id,
        campaignId: campaign.id,
        webinarId: webinar.id,
      };
      s.workflows.push(w);
      for (const [kind, target, label] of [
        ["publish_page", page, "page"],
        ["schedule_campaign", campaign, "campaign"],
      ])
        s.approvals.push({
          id: store.id("ap"),
          kind,
          targetId: target.id,
          title: `Review ${label}: ${title}`,
          summary: target.headline || target.subject,
          audienceIds:
            kind === "schedule_campaign"
              ? audienceIds(s, campaign.audience)
              : [],
          snapshot:
            kind === "publish_page"
              ? JSON.stringify(pageSnapshot(target))
              : JSON.stringify({ ...target }),
          status: "pending",
          workflowId: w.id,
          createdAt: now(),
        });
      activity(
        s,
        "workflow.created",
        `Deterministic workflow ${title} created with linked drafts`,
      );
      return w;
    }, res),
  );
  app.post("/api/approvals/:id/decide", (req, res) =>
    mutate((s) => {
      const a = find(s.approvals, req.params.id, "approval");
      if (a.status !== "pending")
        throw Object.assign(new Error("approval is no longer pending"), {
          status: 409,
        });
      if (!["approve", "reject"].includes(req.body.decision))
        throw new Error("decision must be approve or reject");
      const target = find(
        a.kind === "publish_page" ? s.pages : s.campaigns,
        a.targetId,
      );
      const currentSnapshot =
        a.kind === "publish_page"
          ? JSON.stringify(pageSnapshot(target))
          : JSON.stringify({ ...target });
      const stale = currentSnapshot !== a.snapshot;
      if (req.body.decision === "approve" && stale)
        throw Object.assign(new Error("approval snapshot is stale"), {
          status: 409,
        });
      if (
        req.body.decision === "approve" &&
        a.kind === "schedule_campaign" &&
        JSON.stringify(a.audienceIds) !==
          JSON.stringify(audienceIds(s, target.audience))
      ) {
        throw Object.assign(
          new Error(
            "Audience or consent changed. Request a fresh campaign approval.",
          ),
          { status: 409 },
        );
      }
      a.status = req.body.decision === "approve" ? "approved" : "rejected";
      if (a.kind === "publish_page") {
        if (a.status === "approved") {
          target.status = "published";
          target._published = pageSnapshot(target);
        }
      } else if (a.status === "approved") target.status = "scheduled_local";
      for (const w of s.workflows)
        if (w.pageId === target.id || w.campaignId === target.id) {
          const related = ["publish_page", "schedule_campaign"]
            .map((kind) =>
              s.approvals
                .filter(
                  (x) =>
                    x.workflowId === w.id &&
                    x.kind === kind &&
                    x.status !== "superseded",
                )
                .at(-1),
            )
            .filter(Boolean);
          w.status = related.some((x) => x.status === "rejected")
            ? "rejected"
            : related.every((x) => x.status === "approved")
              ? "drafts_ready"
              : "awaiting_approval";
          for (const step of w.steps)
            if (step.agent === "Website" && a.kind === "publish_page")
              step.status = a.status === "approved" ? "completed" : "rejected";
            else if (step.agent === "Growth" && a.kind === "schedule_campaign")
              step.status = a.status === "approved" ? "completed" : "rejected";
        }
      activity(s, "approval.decided", `${a.title}: ${a.status}`);
      return a;
    }, res),
  );
  app.post("/api/approvals/approve-all", (req, res) =>
    mutate((s) => {
      const pendingApprovals = (s.approvals || []).filter(
        (a) => a.status === "pending",
      );
      for (const a of pendingApprovals) {
        const target = (
          a.kind === "publish_page" ? s.pages : s.campaigns
        ).find((item) => item.id === a.targetId);
        if (target) {
          a.status = "approved";
          if (a.kind === "publish_page") {
            target.status = "published";
            target._published = pageSnapshot(target);
          } else {
            target.status = "scheduled_local";
          }
        }
      }
      activity(
        s,
        "approval.approve_all",
        `Approved ${pendingApprovals.length} pending decisions.`,
      );
      return { approvedCount: pendingApprovals.length };
    }, res),
  );
  app.post("/api/state/reset", (req, res) =>
    mutate((s) => {
      s.contacts = [];
      s.pages = [];
      s.campaigns = [];
      s.webinars = [];
      s.subscriptions = [];
      s.approvals = [];
      s.workflows = [];
      s.activities = [];
      s.orchestraRuns = [];
      activity(s, "system.reset", "Workspace records reset to empty state.");
      return { success: true, message: "Workspace records reset to empty state." };
    }, res),
  );
  app.get("/api/ai/status", async (_, res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const r = await ollamaFetch("http://127.0.0.1:11434/api/tags", {
        signal: controller.signal,
      });
      if (!r.ok) throw new Error("status failed");
      const data = await r.json();
      res.json({
        available: true,
        models: Array.isArray(data.models)
          ? data.models.map((m) => m.name).filter((x) => typeof x === "string")
          : [],
      });
    } catch {
      res.json({
        available: false,
        models: [],
        error: "Ollama unavailable locally",
      });
    } finally {
      clearTimeout(timer);
    }
  });
  app.post("/api/ai/plan", async (req, res) => {
    try {
      const prompt = text(req.body?.prompt, "prompt", true, 2000);
      const model = text(req.body?.model, "model", true, 120);
      if (!/^[\w.:-]+(?:\/[\w.:-]+)?$/.test(model))
        throw new Error("model is invalid");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      try {
        const response = await ollamaFetch(
          "http://127.0.0.1:11434/api/generate",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              model,
              system:
                "You draft concise business copy for human review. Return only the requested JSON fields. Use only facts in the user's brief. Never invent dates, times, prices, discounts, speakers, certificates, scarcity, claims, or links. If event details are missing, say details will be announced; do not fill placeholders with made-up facts. Never return tools, credentials, code or execution instructions. Do not claim any action has happened.",
              prompt: `Create a concise event plan for: ${prompt}`,
              stream: false,
              format: {
                type: "object",
                properties: Object.fromEntries(
                  CONTENT_FIELDS.map((k) => [k, { type: "string" }]),
                ),
                required: CONTENT_FIELDS,
              },
              options: { num_predict: 1000, num_ctx: 4096, temperature: 0.3 },
            }),
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Ollama request failed");
        const body = await response.text();
        if (body.length > 200000) throw new Error("Ollama response too large");
        const json = JSON.parse(body);
        const parsed =
          typeof json.response === "string"
            ? JSON.parse(json.response)
            : json.response;
        const out = {};
        CONTENT_FIELDS.forEach((k) => {
          out[k] = text(
            parsed?.[k],
            k,
            true,
            {
              title: 160,
              headline: 240,
              description: 3000,
              emailSubject: 240,
              emailBody: 10000,
            }[k],
          );
        });
        return res.json({ ...out, source: "ollama", model });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return res
        .status(503)
        .json({ error: "Ollama unavailable or returned invalid content" });
    }
  });
  await registerOrchestraRoutes(app, {
    store,
    ollamaFetch,
    createTools: (port) => createBusinessTools({ store, port }),
    providerService: providers.service,
  });
  if (fs.existsSync(distDir)) app.use(express.static(distDir));
  app.use((err, _req, res, _next) =>
    res
      .status(err.status || 400)
      .json({ error: err.message || "request failed" }),
  );
  return app;
}
