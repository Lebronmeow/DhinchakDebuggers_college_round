import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import type {
  Approval,
  Campaign,
  Contact,
  ModuleProps,
  Page,
  Subscription,
  Webinar,
} from "../types";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Loader2,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import "./modules.css";

const date = (v: string) =>
  v
    ? new Date(v).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Date not set";
const iso = (v: string) => (v ? new Date(v).toISOString() : undefined);
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
function Button({
  children,
  onClick,
  disabled,
  quiet,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  quiet?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={quiet ? "nx-btn nx-btn-quiet" : "nx-btn"}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Shell({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="nx-page">
      <div className="nx-page-head">
        <div>
          <span className="nx-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="nx-empty">{text}</div>;
}
function useAction(
  refresh: () => Promise<void>,
  notify: ModuleProps["notify"],
) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      notify(msg);
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Something went wrong", true);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input,select,textarea")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const controls = [
          ...(ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
          ) || []),
        ];
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, []);
  return (
    <div
      className="nx-overlay"
      onMouseDown={(e) => e.currentTarget === e.target && onClose()}
    >
      <aside
        className="nx-drawer"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nx-drawer-title"
      >
        <header>
          <h2 id="nx-drawer-title">{title}</h2>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        {children}
      </aside>
    </div>
  );
}

function Crm({ p }: { p: ModuleProps }) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    stage: "lead",
    consent: false,
  });
  const { busy, run } = useAction(p.refresh, p.notify);
  const list = useMemo(
    () =>
      p.state.contacts.filter(
        (c) =>
          (!q ||
            `${c.name} ${c.email} ${c.company}`
              .toLowerCase()
              .includes(q.toLowerCase())) &&
          (stage === "all" || c.stage === stage),
      ),
    [p.state.contacts, q, stage],
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run(() => api("/contacts", "POST", form), "Contact added")) {
      setOpen(false);
      setForm({
        name: "",
        email: "",
        company: "",
        stage: "lead",
        consent: false,
      });
    }
  };
  return (
    <Shell
      eyebrow="Customer relationship"
      title="Contacts"
      action={
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} />
          Add contact
        </Button>
      }
    >
      <div className="nx-toolbar">
        <label className="nx-search">
          <Search size={16} />
          <input
            aria-label="Search contacts"
            placeholder="Search people, companies, email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="nx-select">
          <Filter size={15} />
          <select
            aria-label="Filter stage"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="all">All stages</option>
            <option>lead</option>
            <option>qualified</option>
            <option>customer</option>
          </select>
        </label>
      </div>
      <div className="nx-panel nx-table-wrap">
        <table className="nx-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Company</th>
              <th>Source</th>
              <th>Stage</th>
              <th>Consent</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  <small>{c.email}</small>
                </td>
                <td>{c.company || "—"}</td>
                <td>{c.source || "—"}</td>
                <td>
                  <select
                    aria-label={`Stage for ${c.name}`}
                    className="nx-stage"
                    value={c.stage}
                    disabled={busy}
                    onChange={(e) =>
                      run(
                        () =>
                          api(`/contacts/${c.id}`, "PATCH", {
                            stage: e.target.value,
                          }),
                        "Stage updated",
                      )
                    }
                  >
                    <option>lead</option>
                    <option>qualified</option>
                    <option>customer</option>
                  </select>
                </td>
                <td>
                  <button
                    className={`nx-badge ${c.consent ? "nx-good" : "nx-muted"}`}
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          api(`/contacts/${c.id}`, "PATCH", {
                            consent: !c.consent,
                          }),
                        c.consent ? "Opted out" : "Opted in",
                      )
                    }
                  >
                    {c.consent ? "Opted in" : "Opted out"}
                  </button>
                </td>
                <td>{date(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <Empty text="No contacts match this view." />}
      </div>
      {open && (
        <Drawer title="Add contact" onClose={() => setOpen(false)}>
          <form className="nx-form" onSubmit={submit}>
            <label>
              Full name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Company
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </label>
            <label>
              Stage
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
              >
                <option>lead</option>
                <option>qualified</option>
                <option>customer</option>
              </select>
            </label>
            <label className="nx-check">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) =>
                  setForm({ ...form, consent: e.target.checked })
                }
              />{" "}
              Marketing consent recorded
            </label>
            <Button type="submit" disabled={busy}>
              Create contact
            </Button>
          </form>
        </Drawer>
      )}
    </Shell>
  );
}

function Websites({ p }: { p: ModuleProps }) {
  const [selected, setSelected] = useState<Page | null>(
    p.state.pages[0] || null,
  );
  const [draft, setDraft] = useState<Page | null>(selected);
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (selected && !dirty) {
      const fresh = p.state.pages.find((x) => x.id === selected.id);
      if (fresh) {
        setSelected(fresh);
        setDraft(fresh);
      }
    }
  }, [p.state.pages, selected?.id, dirty]);
  const edit = (x: Partial<Page>) => {
    setDraft((d) => (d ? { ...d, ...x } : d));
    setDirty(true);
  };
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      setDirty(false);
      await p.refresh();
      p.notify(msg);
      return true;
    } catch (e) {
      p.notify(e instanceof Error ? e.message : "Unable to save", true);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    draft
      ? act(
          () =>
            api(`/pages/${draft.id}`, "PATCH", {
              title: draft.title,
              headline: draft.headline,
              description: draft.description,
              accent: draft.accent,
              blocks: draft.blocks,
            }),
          "Draft saved",
        )
      : Promise.resolve(false);
  const create = async () => {
    try {
      const x = await api<Page>("/pages", "POST", {
        title: "New page",
        headline: "Your next chapter starts here",
        description: "A clear introduction for your audience.",
        accent: "#4d7c55",
        blocks: ["hero", "details", "registration"],
      });
      await p.refresh();
      setSelected(x);
      setDraft(x);
      setDirty(false);
      p.notify("Page created");
    } catch (e) {
      p.notify(e instanceof Error ? e.message : "Unable to create page", true);
    }
  };
  const move = (i: number, b: number) => {
    if (!draft) return;
    const blocks = [...draft.blocks];
    const n = i + b;
    if (n >= 0 && n < blocks.length) {
      [blocks[i], blocks[n]] = [blocks[n], blocks[i]];
      edit({ blocks });
    }
  };
  return (
    <Shell
      eyebrow="Public presence"
      title="Website studio"
      action={
        <Button onClick={create}>
          <Plus size={16} />
          New page
        </Button>
      }
    >
      <div className="nx-studio">
        <div className="nx-panel nx-page-list">
          <div className="nx-panel-title">Pages</div>
          {p.state.pages.map((x) => (
            <button
              className={
                selected?.id === x.id ? "nx-list-item active" : "nx-list-item"
              }
              key={x.id}
              onClick={() => {
                setSelected(x);
                setDraft(x);
                setDirty(false);
              }}
            >
              <strong>{x.title}</strong>
              <span className="nx-badge nx-muted">{x.status}</span>
            </button>
          ))}
        </div>
        {draft ? (
          <div className="nx-studio-main">
            <div className="nx-editor nx-panel">
              <div className="nx-panel-title">
                Block editor{" "}
                <button
                  className="nx-btn nx-btn-quiet"
                  onClick={() => {
                    if (selected) {
                      const x =
                        p.state.pages.find((y) => y.id === selected.id) ||
                        selected;
                      setSelected(x);
                      setDraft(x);
                      setDirty(false);
                    }
                  }}
                >
                  <Settings2 size={14} />
                  Reset selected
                </button>
              </div>
              <label>
                Title
                <input
                  value={draft.title}
                  onChange={(e) => edit({ title: e.target.value })}
                />
              </label>
              <label>
                Headline
                <input
                  value={draft.headline}
                  onChange={(e) => edit({ headline: e.target.value })}
                />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => edit({ description: e.target.value })}
                />
              </label>
              <label>
                Accent color
                <input
                  type="color"
                  value={draft.accent || "#4d7c55"}
                  onChange={(e) => edit({ accent: e.target.value })}
                />
              </label>
              <div className="nx-blocks">
                <strong className="nx-field-title">
                  Blocks · rendered in this order
                </strong>
                {draft.blocks.map((b, i) => (
                  <div className="nx-block" key={`${b}-${i}`}>
                    <span>{b}</span>
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label="Move block up"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === draft.blocks.length - 1}
                      aria-label="Move block down"
                    >
                      <ChevronDown size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="nx-actions">
                <Button disabled={busy} onClick={save}>
                  Save draft
                </Button>
                <Button
                  quiet
                  disabled={busy}
                  onClick={async () => {
                    if (await save())
                      await act(
                        () => api(`/pages/${draft.id}/request-publish`, "POST"),
                        "Publish requested",
                      );
                  }}
                >
                  Save & request publish
                </Button>
              </div>
            </div>
            <div className="nx-preview">
              <div className="nx-preview-tools">
                <span className="nx-eyebrow">
                  Preview · form does not submit
                </span>
                <span>
                  <button
                    className="nx-device active"
                    onClick={() => setDevice("desktop")}
                  >
                    Desktop
                  </button>
                  <button
                    className="nx-device"
                    onClick={() => setDevice("mobile")}
                  >
                    Mobile
                  </button>
                </span>
              </div>
              <div
                className={`nx-preview-card ${device}`}
                style={{ borderTopColor: draft.accent }}
              >
                <span className="nx-badge nx-muted">Unpublished preview</span>
                {draft.blocks.map((b, i) =>
                  b === "hero" ? (
                    <h2 key={i}>{draft.headline}</h2>
                  ) : b === "details" ? (
                    <p key={i}>{draft.description}</p>
                  ) : b === "registration" ? (
                    <div className="nx-fake-form" key={i}>
                      <input disabled placeholder="Name" />
                      <input disabled placeholder="Email" />
                      <Button disabled>Register preview only</Button>
                    </div>
                  ) : (
                    <p key={i}>{b}</p>
                  ),
                )}
                {draft.status === "published" && (
                  <a
                    className="nx-link"
                    href={`/p/${draft.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open published page <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          <Empty text="Create a page to start editing." />
        )}
      </div>
    </Shell>
  );
}

function Webinars({ p }: { p: ModuleProps }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Webinar | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    startsAt: "",
    capacity: 25,
    joinUrl: "",
  });
  const [reg, setReg] = useState<Record<string, string>>({});
  const { busy, run } = useAction(p.refresh, p.notify);
  const begin = (w?: Webinar) => {
    setEditing(w || null);
    setForm(
      w
        ? {
            title: w.title,
            description: w.description,
            startsAt: w.startsAt
              ? new Date(w.startsAt).toLocaleString("sv-SE").slice(0, 16)
              : "",
            capacity: w.capacity,
            joinUrl: w.joinUrl,
          }
        : {
            title: "",
            description: "",
            startsAt: "",
            capacity: 25,
            joinUrl: "",
          },
    );
    setOpen(true);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.startsAt) {
      p.notify("Description and date are required", true);
      return;
    }
    const ok = await run(
      () =>
        editing
          ? api(`/webinars/${editing.id}`, "PATCH", {
              ...form,
              startsAt: iso(form.startsAt),
            })
          : api("/webinars", "POST", { ...form, startsAt: iso(form.startsAt) }),
      editing ? "Webinar updated" : "Webinar created",
    );
    if (ok) setOpen(false);
  };
  return (
    <Shell
      eyebrow="Events"
      title="Webinars"
      action={
        <Button onClick={() => begin()}>
          <Plus size={16} />
          Create webinar
        </Button>
      }
    >
      <div className="nx-notice">
        Live room is not configured here. Attendance is always manual.
      </div>
      <div className="nx-cards">
        {p.state.webinars.map((w) => (
          <article className="nx-panel nx-card" key={w.id}>
            <div className="nx-card-top">
              <span className="nx-badge nx-good">{w.status}</span>
              <span>
                {w.registrations.length}/{w.capacity}
              </span>
            </div>
            <h3>{w.title}</h3>
            <p>{w.description}</p>
            <small>{date(w.startsAt)}</small>
            <Button quiet onClick={() => begin(w)}>
              <Settings2 size={14} />
              Configure / edit
            </Button>
            {/^https?:\/\//i.test(w.joinUrl) && (
              <a
                className="nx-link"
                href={w.joinUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open room <ExternalLink size={13} />
              </a>
            )}
            <div className="nx-register">
              <label>
                Register existing contact
                <select
                  aria-label="Register existing contact"
                  value={reg[w.id] || ""}
                  onChange={(e) => setReg({ ...reg, [w.id]: e.target.value })}
                >
                  <option value="">Choose contact</option>
                  {p.state.contacts
                    .filter(
                      (c) => !w.registrations.some((r) => r.contactId === c.id),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                quiet
                disabled={!reg[w.id] || busy}
                onClick={() =>
                  run(
                    () =>
                      api(`/webinars/${w.id}/register`, "POST", {
                        contactId: reg[w.id],
                      }),
                    "Contact registered",
                  )
                }
              >
                Register
              </Button>
            </div>
            {w.registrations.map((r) => (
              <div className="nx-register-row" key={r.contactId}>
                {p.state.contacts.find((c) => c.id === r.contactId)?.name ||
                  "Unknown"}
                <button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        api(`/webinars/${w.id}/attendance`, "POST", {
                          contactId: r.contactId,
                          attended: !r.attended,
                        }),
                      r.attended ? "Marked absent" : "Attendance marked",
                    )
                  }
                >
                  {r.attended ? "Attended" : "Mark attendance"}
                </button>
              </div>
            ))}
          </article>
        ))}
      </div>
      {open && (
        <Drawer
          title={editing ? "Configure webinar" : "Create webinar"}
          onClose={() => setOpen(false)}
        >
          <form className="nx-form" onSubmit={submit}>
            <label>
              Title
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Description
              <input
                required
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label>
              Date
              <input
                required
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </label>
            <label>
              Capacity
              <input
                required
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) =>
                  setForm({ ...form, capacity: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Join URL
              <input
                value={form.joinUrl}
                onChange={(e) => setForm({ ...form, joinUrl: e.target.value })}
              />
            </label>
            <Button type="submit" disabled={busy}>
              Save webinar
            </Button>
          </form>
        </Drawer>
      )}
    </Shell>
  );
}

function Campaigns({ p }: { p: ModuleProps }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    subject: "",
    body: "",
    audience: "all",
    scheduledAt: "",
  });
  const { busy, run } = useAction(p.refresh, p.notify);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      await run(
        () =>
          api("/campaigns", "POST", { ...f, scheduledAt: iso(f.scheduledAt) }),
        "Campaign draft created",
      )
    )
      setOpen(false);
  };
  return (
    <Shell
      eyebrow="Outbound"
      title="Campaigns"
      action={
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} />
          Compose campaign
        </Button>
      }
    >
      <div className="nx-notice">
        Drafts only. No email is sent without an integration.
      </div>
      <div className="nx-cards">
        {p.state.campaigns.map((c) => (
          <article className="nx-panel nx-card" key={c.id}>
            <span className="nx-badge nx-warn">{c.status}</span>
            <h3>{c.name}</h3>
            <p>
              <strong>{c.subject}</strong>
            </p>
            <p>{c.body}</p>
            <small>
              Audience: {c.audience || "Not defined"} · {date(c.scheduledAt)}
            </small>
            {c.status === "draft" && (
              <Button
                quiet
                disabled={busy}
                onClick={() =>
                  run(
                    () => api(`/campaigns/${c.id}/request-schedule`, "POST"),
                    "Approval requested",
                  )
                }
              >
                Request approval
              </Button>
            )}
          </article>
        ))}
      </div>
      {open && (
        <Drawer title="Compose campaign" onClose={() => setOpen(false)}>
          <form className="nx-form" onSubmit={submit}>
            <label>
              Name
              <input
                required
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </label>
            <label>
              Subject
              <input
                required
                value={f.subject}
                onChange={(e) => setF({ ...f, subject: e.target.value })}
              />
            </label>
            <label>
              Body
              <textarea
                required
                rows={5}
                value={f.body}
                onChange={(e) => setF({ ...f, body: e.target.value })}
              />
            </label>
            <label>
              Audience
              <select
                value={f.audience}
                onChange={(e) => setF({ ...f, audience: e.target.value })}
              >
                <option>all</option>
                <option>lead</option>
                <option>qualified</option>
                <option>customer</option>
              </select>
            </label>
            <label>
              Schedule
              <input
                type="datetime-local"
                value={f.scheduledAt}
                onChange={(e) => setF({ ...f, scheduledAt: e.target.value })}
              />
            </label>
            <Button type="submit" disabled={busy}>
              Save draft
            </Button>
          </form>
        </Drawer>
      )}
    </Shell>
  );
}
function Billing({ p }: { p: ModuleProps }) {
  const { busy, run } = useAction(p.refresh, p.notify);
  const [contactId, setContactId] = useState(p.state.contacts[0]?.id || "");
  const [planId, setPlanId] = useState(p.state.plans[0]?.id || "");
  return (
    <Shell eyebrow="Sandbox commerce" title="Billing">
      <div className="nx-notice">
        Sandbox records only. No payment is collected.
      </div>
      <div className="nx-plan-grid">
        {p.state.plans.map((x) => (
          <div className="nx-panel nx-plan" key={x.id}>
            <span className="nx-badge nx-good">Sandbox plan</span>
            <h3>{x.name}</h3>
            <strong>
              {money(x.amount)} <small>/{x.interval}</small>
            </strong>
            <p>
              {x.includedUsage} included units · {money(x.overageRate)} per
              additional unit
            </p>
          </div>
        ))}
      </div>
      <div className="nx-panel nx-subscribe">
        <h3>Create sandbox subscription</h3>
        <label>
          Contact
          <select
            aria-label="Subscriber contact"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="">Choose contact</option>
            {p.state.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Plan
          <select
            aria-label="Subscription plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
          >
            {p.state.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={busy || !contactId || !planId}
          onClick={() =>
            run(
              () => api("/subscriptions", "POST", { contactId, planId }),
              "Sandbox subscription created. No payment collected.",
            )
          }
        >
          Create sandbox subscription
        </Button>
      </div>
      <div className="nx-panel nx-table-wrap">
        <table className="nx-table">
          <thead>
            <tr>
              <th>Subscriber</th>
              <th>Usage</th>
              <th>Sandbox estimate</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {p.state.subscriptions.map((s) => (
              <tr key={s.id}>
                <td>
                  {p.state.contacts.find((c) => c.id === s.contactId)?.name ||
                    "Unknown"}
                </td>
                <td>
                  <UsageInput subscription={s} busy={busy} run={run} />
                </td>
                <td>
                  {(() => {
                    const plan = p.state.plans.find((x) => x.id === s.planId);
                    return plan
                      ? money(
                          plan.amount +
                            Math.max(0, s.usage - plan.includedUsage) *
                              plan.overageRate,
                        )
                      : "—";
                  })()}
                  <small>Not an invoice or payment</small>
                </td>
                <td>
                  <span className="nx-badge nx-muted">{s.status}</span>
                </td>
                <td>
                  <Button
                    quiet
                    disabled={busy || s.status === "canceled"}
                    onClick={() =>
                      run(
                        () =>
                          api(`/subscriptions/${s.id}`, "PATCH", {
                            status: "canceled",
                          }),
                        "Sandbox subscription canceled",
                      )
                    }
                  >
                    Cancel sandbox
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!p.state.subscriptions.length && (
          <Empty text="No sandbox subscriptions." />
        )}
      </div>
    </Shell>
  );
}
function UsageInput({
  subscription,
  busy,
  run,
}: {
  subscription: Subscription;
  busy: boolean;
  run: (fn: () => Promise<unknown>, message: string) => Promise<boolean>;
}) {
  const [quantity, setQuantity] = useState(1);
  const [eventId, setEventId] = useState("");
  return (
    <div className="nx-usage">
      <strong>{subscription.usage} units</strong>
      <input
        aria-label="Usage quantity"
        type="number"
        min={1}
        max={100000}
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      />
      <input
        aria-label="Usage event ID"
        placeholder="Unique event ID"
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
      />
      <Button
        quiet
        disabled={
          busy ||
          subscription.status === "canceled" ||
          !eventId.trim() ||
          quantity < 1
        }
        onClick={() =>
          run(
            () =>
              api(`/subscriptions/${subscription.id}/usage`, "POST", {
                quantity,
                eventId,
              }),
            "Usage recorded. Repeating this event ID does not double count.",
          )
        }
      >
        Record usage
      </Button>
    </div>
  );
}
function Approvals({ p }: { p: ModuleProps }) {
  const { busy, run } = useAction(p.refresh, p.notify);
  const eligible = (a: Approval) => {
    const snap = (a as Approval & { audienceIds?: string[] }).audienceIds;
    if (snap) return snap.length;
    const c = p.state.campaigns.find((x) => x.id === a.targetId);
    return c
      ? p.state.contacts.filter(
          (x) =>
            x.consent &&
            (!c.audience || c.audience === "all" || x.stage === c.audience),
        ).length
      : 0;
  };
  return (
    <Shell eyebrow="Review queue" title="Approvals">
      <div className="nx-notice">Local decisions only; no external sends.</div>
      <div className="nx-cards">
        {p.state.approvals.map((a) => (
          <article className="nx-panel nx-approval" key={a.id}>
            <div>
              <span
                className={`nx-badge ${a.status === "pending" ? "nx-warn" : "nx-muted"}`}
              >
                {a.status}
              </span>
              <h3>{a.title}</h3>
              <p>{a.summary}</p>
              <ApprovalPreview approval={a} state={p.state} />
              {a.kind === "schedule_campaign" && (
                <small>Eligible opted-in contacts: {eligible(a)}</small>
              )}
            </div>
            {a.status === "pending" && (
              <div className="nx-actions">
                <Button
                  quiet
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        api(`/approvals/${a.id}/decide`, "POST", {
                          decision: "reject",
                        }),
                      "Rejected",
                    )
                  }
                >
                  <X size={15} />
                  Reject
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        api(`/approvals/${a.id}/decide`, "POST", {
                          decision: "approve",
                        }),
                      "Approved",
                    )
                  }
                >
                  <Check size={15} />
                  Approve
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!p.state.approvals.length && (
        <Empty text="No requests yet. Create a workflow or request publication from Website studio." />
      )}
    </Shell>
  );
}
function ApprovalPreview({
  approval,
  state,
}: {
  approval: Approval;
  state: ModuleProps["state"];
}) {
  let snapshot: Record<string, unknown> = {};
  try {
    snapshot = JSON.parse(
      (approval as Approval & { snapshot?: string }).snapshot || "{}",
    );
  } catch {
    /* Legacy snapshots show the record summary. */
  }
  const page = state.pages.find((p) => p.id === approval.targetId);
  const campaign = state.campaigns.find((c) => c.id === approval.targetId);
  const field = (key: string, fallback = "") =>
    typeof snapshot[key] === "string" ? (snapshot[key] as string) : fallback;
  return (
    <details className="nx-approval-preview">
      <summary>Review exact content</summary>
      {approval.kind === "publish_page" ? (
        <div>
          <h3>{field("headline", page?.headline)}</h3>
          <p>{field("description", page?.description)}</p>
          <small>
            Page path: /p/{field("slug", page?.slug)} · Publishing exposes this
            page on this machine only.
          </small>
        </div>
      ) : (
        <div>
          <h3>{field("subject", campaign?.subject)}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {field("body", campaign?.body)}
          </p>
          <small>
            Audience: {field("audience", campaign?.audience)} · Schedule:{" "}
            {date(field("scheduledAt", campaign?.scheduledAt))}
          </small>
          <p>
            No external email will be sent. This records an approved local
            schedule only.
          </p>
        </div>
      )}
    </details>
  );
}
function Analytics({ p }: { p: ModuleProps }) {
  const total = p.state.subscriptions
    .filter((s) => s.sandbox && s.status !== "canceled")
    .reduce(
      (n, s) => n + (p.state.plans.find((x) => x.id === s.planId)?.amount || 0),
      0,
    );
  return (
    <Shell eyebrow="Recorded locally" title="Analytics">
      <div className="nx-metrics">
        <div className="nx-metric">
          <span>Contacts</span>
          <strong>{p.state.contacts.length}</strong>
        </div>
        <div className="nx-metric">
          <span>Webinar registrations</span>
          <strong>
            {p.state.webinars.reduce((n, w) => n + w.registrations.length, 0)}
          </strong>
          <small>
            {p.state.webinars.reduce(
              (n, w) => n + w.registrations.filter((r) => r.attended).length,
              0,
            )}{" "}
            manually marked attended
          </small>
        </div>
        <div className="nx-metric">
          <span>Campaigns</span>
          <strong>{p.state.campaigns.length}</strong>
        </div>
        <div className="nx-metric">
          <span>Sandbox plan total</span>
          <strong>{money(total)}</strong>
          <small>Not collected revenue</small>
        </div>
      </div>
      <div className="nx-panel nx-analytics-note">
        <h3>Measurement, not guesswork</h3>
        <p>
          Counts use stored records, including fictional starter data. Campaign
          sends and collected revenue are zero: no delivery or payment provider
          is connected. Sandbox plan totals exclude overages and are not real
          MRR.
        </p>
        <p>
          {p.state.workflows.length} workflows ·{" "}
          {p.state.approvals.filter((a) => a.status === "pending").length}{" "}
          pending approvals ·{" "}
          {p.state.pages.filter((page) => page.status === "published").length}{" "}
          published pages
        </p>
      </div>
    </Shell>
  );
}
function Settings({ p }: { p: ModuleProps }) {
  const [ai, setAi] = useState<{
    available?: boolean;
    models?: string[];
    error?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Shell eyebrow="Workspace controls" title="Settings">
      <div className="nx-settings-grid">
        <div className="nx-panel">
          <div className="nx-panel-title">Integrations</div>
          {p.state.integrations.map((i) => (
            <div className="nx-integration" key={i.id}>
              <div>
                <strong>{i.name}</strong>
                <p>{i.description}</p>
              </div>
              <span className="nx-badge nx-muted">
                {i.status || "unconfigured"}
              </span>
            </div>
          ))}
        </div>
        <div className="nx-panel">
          <div className="nx-panel-title">Connection guide</div>
          <p className="nx-muted-text">
            No paid service is required for this local version. These are setup
            candidates, not connected integrations; current free/trial terms
            must be checked with each provider.
          </p>
          {[
            [
              "Ollama — local AI, no account required",
              "https://ollama.com/download",
            ],
            ["Resend — future email delivery", "https://resend.com"],
            ["LiveKit — future live webinar integration", "https://livekit.io"],
            [
              "Stripe — future payment test mode",
              "https://dashboard.stripe.com/test/dashboard",
            ],
          ].map(([label, href]) => (
            <a
              className="nx-link"
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              {label}
              <ExternalLink size={13} />
            </a>
          ))}
          <p className="nx-muted-text">
            Never paste passwords or API keys into workflow prompts. The present
            app is single-operator and localhost-only, not a multi-user SaaS
            deployment.
          </p>
        </div>
        <div className="nx-panel">
          <div className="nx-panel-title">Local AI status</div>
          <Button
            quiet
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setAi(await api("/ai/status"));
              } catch (e) {
                p.notify(e instanceof Error ? e.message : "Unavailable", true);
              } finally {
                setBusy(false);
              }
            }}
          >
            Check Ollama
          </Button>
          {ai && (
            <p>
              {ai.available ? "Available" : "Unavailable"}
              {ai.models?.length ? ` · ${ai.models.join(", ")}` : ""}
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}
export default function Modules(p: ModuleProps) {
  switch (p.view) {
    case "crm":
      return <Crm p={p} />;
    case "websites":
      return <Websites p={p} />;
    case "campaigns":
      return <Campaigns p={p} />;
    case "webinars":
      return <Webinars p={p} />;
    case "billing":
      return <Billing p={p} />;
    case "approvals":
      return <Approvals p={p} />;
    case "analytics":
      return <Analytics p={p} />;
    case "settings":
      return <Settings p={p} />;
    default:
      return null;
  }
}
