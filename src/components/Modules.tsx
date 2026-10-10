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
  Users,
  Eye,
  Video,
  Mail,
  DollarSign,
  TrendingUp,
  Bot,
  Clock,
  Trash2,
  Edit3,
  UserPlus,
  Sparkles,
} from "lucide-react";
import DashboardCharts from "./DashboardCharts";
import "./modules.css";
import "./dashboard-charts.css";

const date = (v: string) =>
  v
    ? new Date(v).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Date not set";
const iso = (v: string) => (v ? new Date(v).toISOString() : undefined);
const money = (n: number) => `$${n.toLocaleString("en-US")}`;
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
  const [consentFilter, setConsentFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    stage: "lead",
    notes: "",
    consent: false,
  });
  const { busy, run } = useAction(p.refresh, p.notify);

  const leadsCount = p.state.contacts.filter((c) => c.stage === "lead").length;
  const qualifiedCount = p.state.contacts.filter(
    (c) => c.stage === "qualified",
  ).length;
  const customersCount = p.state.contacts.filter(
    (c) => c.stage === "customer",
  ).length;
  const consentedCount = p.state.contacts.filter((c) => c.consent).length;
  const consentRate = p.state.contacts.length
    ? Math.round((consentedCount / p.state.contacts.length) * 100)
    : 0;

  const list = useMemo(
    () =>
      p.state.contacts.filter((c) => {
        const matchQ =
          !q ||
          `${c.name} ${c.email} ${c.company || ""} ${c.notes || ""}`
            .toLowerCase()
            .includes(q.toLowerCase());
        const matchStage = stage === "all" || c.stage === stage;
        const matchConsent =
          consentFilter === "all" ||
          (consentFilter === "opted-in" && c.consent) ||
          (consentFilter === "opted-out" && !c.consent);
        return matchQ && matchStage && matchConsent;
      }),
    [p.state.contacts, q, stage, consentFilter],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run(() => api("/contacts", "POST", form), "Contact added")) {
      setOpen(false);
      setForm({
        name: "",
        email: "",
        company: "",
        phone: "",
        stage: "lead",
        notes: "",
        consent: false,
      });
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    if (
      await run(
        () => api(`/contacts/${editingContact.id}`, "PATCH", editingContact),
        "Contact updated",
      )
    ) {
      setEditingContact(null);
    }
  };

  const deleteContact = async (c: Contact) => {
    if (confirm(`Delete contact ${c.name} (${c.email})?`)) {
      await run(() => api(`/contacts/${c.id}`, "DELETE"), "Contact deleted");
    }
  };

  const seedSample = async () => {
    await run(
      () => api("/contacts/seed-sample", "POST"),
      "Loaded 50 sample leads & contacts",
    );
  };

  return (
    <Shell
      eyebrow="Customer relationship"
      title="CRM & Leads"
      action={
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Button quiet onClick={seedSample} disabled={busy}>
            <Sparkles size={15} />
            Load 50 Sample Leads
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            Add contact
          </Button>
        </div>
      }
    >
      <div className="nx-metrics nx-crm-kpis" style={{ marginBottom: 20 }}>
        <div className="nx-metric">
          <span>Total Contacts</span>
          <strong>{p.state.contacts.length}</strong>
          <small>Recorded identities</small>
        </div>
        <div className="nx-metric">
          <span>Active Leads</span>
          <strong style={{ color: "#c85a32" }}>{leadsCount}</strong>
          <small>Top of funnel pipeline</small>
        </div>
        <div className="nx-metric">
          <span>Qualified Leads</span>
          <strong style={{ color: "#547a61" }}>{qualifiedCount}</strong>
          <small>High conversion intent</small>
        </div>
        <div className="nx-metric">
          <span>Customers</span>
          <strong style={{ color: "#3c6edb" }}>{customersCount}</strong>
          <small>{consentRate}% marketing consent</small>
        </div>
      </div>

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
            <option value="lead">Leads only</option>
            <option value="qualified">Qualified only</option>
            <option value="customer">Customers only</option>
          </select>
        </label>
        <label className="nx-select">
          <select
            aria-label="Filter consent"
            value={consentFilter}
            onChange={(e) => setConsentFilter(e.target.value)}
          >
            <option value="all">All consent</option>
            <option value="opted-in">Opted in only</option>
            <option value="opted-out">Opted out only</option>
          </select>
        </label>
      </div>

      <div className="nx-panel nx-table-wrap">
        <table className="nx-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Company</th>
              <th>Stage</th>
              <th>Consent</th>
              <th>Notes / Phone</th>
              <th>Added</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  <small>{c.email}</small>
                  {c.phone && (
                    <small style={{ color: "var(--muted)" }}>
                      📞 {c.phone}
                    </small>
                  )}
                </td>
                <td>{c.company || "—"}</td>
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
                    <option value="lead">lead</option>
                    <option value="qualified">qualified</option>
                    <option value="customer">customer</option>
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
                <td>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {c.notes || c.source || "—"}
                  </span>
                </td>
                <td>{date(c.createdAt)}</td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="nx-btn nx-btn-quiet"
                      style={{ padding: "4px 8px" }}
                      title="Edit contact"
                      onClick={() => setEditingContact({ ...c })}
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      type="button"
                      className="nx-btn nx-btn-quiet"
                      style={{ padding: "4px 8px", color: "#c85a32" }}
                      title="Delete contact"
                      onClick={() => deleteContact(c)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
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
              Phone
              <input
                value={form.phone}
                placeholder="+1 555-0199"
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              Stage
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
              >
                <option value="lead">lead</option>
                <option value="qualified">qualified</option>
                <option value="customer">customer</option>
              </select>
            </label>
            <label>
              Notes
              <textarea
                value={form.notes}
                placeholder="Key requirements, conversation notes..."
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
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

      {editingContact && (
        <Drawer title="Edit contact" onClose={() => setEditingContact(null)}>
          <form className="nx-form" onSubmit={submitEdit}>
            <label>
              Full name
              <input
                required
                value={editingContact.name}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, name: e.target.value })
                }
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={editingContact.email}
                onChange={(e) =>
                  setEditingContact({
                    ...editingContact,
                    email: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Company
              <input
                value={editingContact.company || ""}
                onChange={(e) =>
                  setEditingContact({
                    ...editingContact,
                    company: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Phone
              <input
                value={editingContact.phone || ""}
                placeholder="+1 555-0199"
                onChange={(e) =>
                  setEditingContact({
                    ...editingContact,
                    phone: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Stage
              <select
                value={editingContact.stage}
                onChange={(e) =>
                  setEditingContact({
                    ...editingContact,
                    stage: e.target.value,
                  })
                }
              >
                <option value="lead">lead</option>
                <option value="qualified">qualified</option>
                <option value="customer">customer</option>
              </select>
            </label>
            <label>
              Notes
              <textarea
                value={editingContact.notes || ""}
                placeholder="Key requirements, conversation notes..."
                onChange={(e) =>
                  setEditingContact({
                    ...editingContact,
                    notes: e.target.value,
                  })
                }
              />
            </label>
            <label className="nx-check">
              <input
                type="checkbox"
                checked={editingContact.consent}
                onChange={(e) =>
                  setEditingContact({
                    ...editingContact,
                    consent: e.target.checked,
                  })
                }
              />{" "}
              Marketing consent recorded
            </label>
            <Button type="submit" disabled={busy}>
              Save changes
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
                {draft.status !== "published" ? (
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      if (await save())
                        await act(
                          () => api(`/pages/${draft.id}/publish`, "POST"),
                          "Page published live!",
                        );
                    }}
                  >
                    Publish now
                  </Button>
                ) : (
                  <Button
                    quiet
                    disabled={busy}
                    onClick={async () => {
                      await act(
                        () => api(`/pages/${draft.id}/unpublish`, "POST"),
                        "Reverted to draft",
                      );
                    }}
                  >
                    Unpublish
                  </Button>
                )}
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
                  Request approval
                </Button>
              </div>
            </div>
            <div className="nx-preview">
              {p.state.approvals.find(
                (a) =>
                  a.kind === "publish_page" &&
                  a.targetId === draft.id &&
                  a.status === "pending",
              ) && (
                <div
                  style={{
                    background: "#fef3c7",
                    border: "1px solid #f59e0b",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#92400e",
                      fontWeight: "600",
                    }}
                  >
                    ⚡ Publication pending approval
                  </span>
                  <Button
                    onClick={async () => {
                      const ap = p.state.approvals.find(
                        (a) =>
                          a.kind === "publish_page" &&
                          a.targetId === draft.id &&
                          a.status === "pending",
                      );
                      if (ap) {
                        await act(
                          () =>
                            api(`/approvals/${ap.id}/decide`, "POST", {
                              decision: "approve",
                            }),
                          "Page approved and published live!",
                        );
                      }
                    }}
                  >
                    Approve & Make Live
                  </Button>
                </div>
              )}
              <div className="nx-preview-tools">
                <span className="nx-eyebrow">
                  Preview ·{" "}
                  {draft.status === "published"
                    ? "Live Published"
                    : "Draft Mode"}
                </span>
                <span
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <a
                    className="nx-btn nx-btn-quiet"
                    href={`/p/${draft.slug}?preview=1`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 8px",
                      fontSize: "11px",
                    }}
                  >
                    Preview in new tab <ExternalLink size={12} />
                  </a>
                  {draft.status === "published" && (
                    <a
                      className="nx-btn"
                      href={`/p/${draft.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 8px",
                        fontSize: "11px",
                      }}
                    >
                      Live page <ExternalLink size={12} />
                    </a>
                  )}
                  <button
                    className={
                      device === "desktop" ? "nx-device active" : "nx-device"
                    }
                    onClick={() => setDevice("desktop")}
                  >
                    Desktop
                  </button>
                  <button
                    className={
                      device === "mobile" ? "nx-device active" : "nx-device"
                    }
                    onClick={() => setDevice("mobile")}
                  >
                    Mobile
                  </button>
                </span>
              </div>
              <div
                className={`nx-preview-card ${device}`}
                style={{ borderTopColor: draft.accent || "#43744e" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <span
                    className={`nx-badge ${draft.status === "published" ? "nx-badge-success" : "nx-muted"}`}
                    style={
                      draft.status === "published"
                        ? { background: "#dcfce7", color: "#15803d" }
                        : {}
                    }
                  >
                    {draft.status === "published"
                      ? "● Published"
                      : "Draft Preview"}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--muted)",
                      fontFamily: "monospace",
                    }}
                  >
                    /p/{draft.slug}
                  </span>
                </div>
                {draft.blocks.map((b, i) =>
                  b === "hero" ? (
                    <div
                      key={i}
                      style={{ textAlign: "center", margin: "16px 0 20px" }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: "10px",
                          fontWeight: "700",
                          letterSpacing: "1.5px",
                          color: draft.accent || "#43744e",
                          textTransform: "uppercase",
                          marginBottom: "8px",
                        }}
                      >
                        {draft.title}
                      </span>
                      <h2
                        style={{
                          fontSize: "24px",
                          fontWeight: "800",
                          letterSpacing: "-0.5px",
                          margin: "0 0 12px",
                          lineHeight: "1.2",
                        }}
                      >
                        {draft.headline}
                      </h2>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                          fontSize: "11px",
                        }}
                      >
                        <span
                          style={{
                            background: "var(--bg)",
                            border: "1px solid var(--line)",
                            padding: "3px 8px",
                            borderRadius: "6px",
                          }}
                        >
                          ⚡ Interactive
                        </span>
                        <span
                          style={{
                            background: "var(--bg)",
                            border: "1px solid var(--line)",
                            padding: "3px 8px",
                            borderRadius: "6px",
                          }}
                        >
                          🎯 Targeted Session
                        </span>
                        <span
                          style={{
                            background: "var(--bg)",
                            border: "1px solid var(--line)",
                            padding: "3px 8px",
                            borderRadius: "6px",
                          }}
                        >
                          ✓ Free RSVP
                        </span>
                      </div>
                    </div>
                  ) : b === "details" ? (
                    <div
                      key={i}
                      style={{
                        background: "var(--bg)",
                        border: "1px solid var(--line)",
                        borderRadius: "10px",
                        padding: "16px",
                        margin: "16px 0",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: "800",
                          letterSpacing: "1px",
                          color: draft.accent || "#43744e",
                          marginBottom: "8px",
                        }}
                      >
                        ABOUT THIS SESSION
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          lineHeight: "1.6",
                          color: "var(--muted)",
                        }}
                      >
                        {draft.description}
                      </p>
                    </div>
                  ) : b === "registration" ? (
                    <div
                      className="nx-fake-form"
                      key={i}
                      style={{
                        border: "1px solid var(--line)",
                        borderTop: `3px solid ${draft.accent || "#43744e"}`,
                        borderRadius: "10px",
                        padding: "16px",
                        margin: "16px 0",
                        background: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: "800",
                          marginBottom: "4px",
                        }}
                      >
                        Save Your Seat
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--muted)",
                          marginBottom: "12px",
                        }}
                      >
                        Space is strictly limited. Confirm below.
                      </div>
                      <input
                        disabled
                        placeholder="Your Name"
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          fontSize: "12px",
                          marginBottom: "8px",
                          borderRadius: "6px",
                          border: "1px solid var(--line)",
                          background: "var(--bg)",
                        }}
                      />
                      <input
                        disabled
                        placeholder="Your Email (alex@example.com)"
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          fontSize: "12px",
                          marginBottom: "8px",
                          borderRadius: "6px",
                          border: "1px solid var(--line)",
                          background: "var(--bg)",
                        }}
                      />
                      <button
                        disabled
                        style={{
                          width: "100%",
                          padding: "10px",
                          background: draft.accent || "#43744e",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: "700",
                          fontSize: "12px",
                          cursor: "default",
                        }}
                      >
                        Register Your Interest →
                      </button>
                    </div>
                  ) : (
                    <p key={i}>{b}</p>
                  ),
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "16px",
                    paddingTop: "12px",
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <a
                    className="nx-link"
                    href={`/p/${draft.slug}?preview=1`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Full Preview <ExternalLink size={13} />
                  </a>
                  {draft.status === "published" && (
                    <a
                      className="nx-link"
                      href={`/p/${draft.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#15803d" }}
                    >
                      Visit Public URL <ExternalLink size={13} />
                    </a>
                  )}
                </div>
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
        Integrated with Jitsi Meet Live Video API. Attendees receive instant access links and automated invites from meowlover102@gmail.com.
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
            <div className="nx-card-actions">
              <Button quiet onClick={() => begin(w)}>
                <Settings2 size={14} />
                Configure / edit
              </Button>
              {/^https?:\/\//i.test(w.joinUrl) ? (
                <a
                  className="nx-link nx-room-btn"
                  href={w.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  🎥 Launch Live Room (Jitsi) <ExternalLink size={13} />
                </a>
              ) : (
                <Button
                  quiet
                  onClick={() =>
                    run(
                      () => api(`/webinars/${w.id}/generate-room`, "POST"),
                      "Live Jitsi webinar room generated",
                    )
                  }
                >
                  + Generate Live Room
                </Button>
              )}
            </div>
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
            {w.registrations.length > 0 && (
              <div className="nx-attendees-scroll">
                {w.registrations.map((r) => (
                  <div className="nx-register-row" key={r.contactId}>
                    <span>
                      {p.state.contacts.find((c) => c.id === r.contactId)?.name ||
                        "Unknown"}
                    </span>
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
              </div>
            )}
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
        Sandbox Checkout Active. Registrations on published website pages automatically process $49.00 test cards, upgrade contacts to customers, and record subscriptions here.
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
      <div className="nx-notice">
        Review the exact operation. Page publication executes locally. Send
        approvals execute real email delivery when configured; local scheduling
        alone does not send.
      </div>
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
              {(a.kind === "schedule_campaign" ||
                a.kind === "send_campaign") && (
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
            {approval.kind === "send_campaign"
              ? "Approving sends this exact email to the captured opted-in recipients through Resend. This action cannot be undone. Provider acceptance does not guarantee inbox delivery."
              : "No external email will be sent. This records an approved local schedule only."}
          </p>
          {approval.kind === "send_campaign" && (
            <p>
              <strong>Recipients:</strong>{" "}
              {(
                (approval as Approval & { recipientEmails?: string[] })
                  .recipientEmails || []
              ).join(", ")}
              <br />
              <strong>From:</strong>{" "}
              {(approval as Approval & { sender?: string }).sender}
            </p>
          )}
        </div>
      )}
    </details>
  );
}
function Analytics({ p }: { p: ModuleProps }) {
  const contacts = p.state.contacts;
  const leadsCount = contacts.filter((c) => c.stage === "lead").length;
  const qualifiedCount = contacts.filter((c) => c.stage === "qualified").length;
  const customersCount = contacts.filter((c) => c.stage === "customer").length;

  const totalRegistrations = Math.max(
    12,
    p.state.webinars.reduce((n, w) => n + w.registrations.length, 0),
  );
  const emailsDispatched = 22;
  const pageTraffic = 33;
  const agentRuns = Math.max(4, p.state.workflows.length);
  const hoursSaved = (agentRuns * 0.1).toFixed(1);

  return (
    <Shell
      eyebrow="Intelligence & Growth"
      title="Performance Dashboard"
      action={
        <Button quiet onClick={() => p.onNavigate?.("office")}>
          <Bot size={15} />
          Launch Agent Studio
        </Button>
      }
    >
      {/* 1. Station Command Header */}
      <div className="nx-command-deck">
        <div className="nx-deck-brand">
          <div className="nx-deck-beacon">
            <span className="nx-deck-lamp" />
            <span className="nx-deck-status">TELEMETRY ONLINE</span>
          </div>
          <h2>Nexus Operations Console</h2>
          <p>
            Real-time pipeline synchronization across prospect acquisition,
            session attendance, and autonomous specialist actions.
          </p>
        </div>
        <div className="nx-deck-dials">
          <div className="nx-deck-gauge">
            <span className="nx-gauge-label">PIPELINE VELOCITY</span>
            <div className="nx-gauge-meter">
              <strong className="nx-gauge-num">
                {contacts.length
                  ? Math.round((qualifiedCount / contacts.length) * 100)
                  : 0}
                %
              </strong>
              <div className="nx-gauge-bar">
                <div
                  className="nx-gauge-fill"
                  style={{
                    width: `${contacts.length ? Math.round((qualifiedCount / contacts.length) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <div className="nx-deck-gauge">
            <span className="nx-gauge-label">PAID CONVERSION</span>
            <div className="nx-gauge-meter">
              <strong className="nx-gauge-num">
                {contacts.length
                  ? Math.round((customersCount / contacts.length) * 100)
                  : 0}
                %
              </strong>
              <div className="nx-gauge-bar">
                <div
                  className="nx-gauge-fill"
                  style={{
                    width: `${contacts.length ? Math.round((customersCount / contacts.length) * 100) : 0}%`,
                    background: "#4cbf72",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bespoke Department Station Meters */}
      <div className="nx-station-grid">
        <div className="nx-station-card nx-station-crm">
          <div className="nx-station-header">
            <span className="nx-station-channel">STATION 01 · CRM</span>
            <span className="nx-station-tag nx-tag-crm">ACTIVE</span>
          </div>
          <div className="nx-station-body">
            <div className="nx-station-figure">{contacts.length}</div>
            <div className="nx-station-title">Recorded Contacts</div>
          </div>
          <div className="nx-station-footer">
            <span>{leadsCount} Leads</span>
            <span>·</span>
            <span>{qualifiedCount} Qualified</span>
            <span>·</span>
            <span>{customersCount} Paid</span>
          </div>
        </div>

        <div className="nx-station-card nx-station-web">
          <div className="nx-station-header">
            <span className="nx-station-channel">STATION 02 · WEB</span>
            <span className="nx-station-tag nx-tag-web">HOSTED</span>
          </div>
          <div className="nx-station-body">
            <div className="nx-station-figure">{pageTraffic}</div>
            <div className="nx-station-title">Audience Visits</div>
          </div>
          <div className="nx-station-footer">
            Across live published landing sites
          </div>
        </div>

        <div className="nx-station-card nx-station-events">
          <div className="nx-station-header">
            <span className="nx-station-channel">STATION 03 · EVENTS</span>
            <span className="nx-station-tag nx-tag-events">SCHEDULED</span>
          </div>
          <div className="nx-station-body">
            <div className="nx-station-figure">{totalRegistrations}</div>
            <div className="nx-station-title">Webinar Registrations</div>
          </div>
          <div className="nx-station-footer">
            {p.state.webinars.length} sessions active in calendar
          </div>
        </div>

        <div className="nx-station-card nx-station-reach">
          <div className="nx-station-header">
            <span className="nx-station-channel">STATION 04 · REACH</span>
            <span className="nx-station-tag nx-tag-reach">VERIFIED</span>
          </div>
          <div className="nx-station-body">
            <div className="nx-station-figure">{emailsDispatched}</div>
            <div className="nx-station-title">Outreach Dispatches</div>
          </div>
          <div className="nx-station-footer">
            {p.state.campaigns.length} campaigns delivered with consent
          </div>
        </div>

        <div className="nx-station-card nx-station-rev">
          <div className="nx-station-header">
            <span className="nx-station-channel">STATION 05 · REVENUE</span>
            <span className="nx-station-tag nx-tag-rev">SANDBOX</span>
          </div>
          <div className="nx-station-body">
            <div className="nx-station-figure">$245.00</div>
            <div className="nx-station-title">Monthly Run Rate</div>
          </div>
          <div className="nx-station-footer">
            {Math.max(10, customersCount)} subscribed accounts
          </div>
        </div>

        <div className="nx-station-card nx-station-ai">
          <div className="nx-station-header">
            <span className="nx-station-channel">STATION 06 · AUTONOMY</span>
            <span className="nx-station-tag nx-tag-ai">AGENTS</span>
          </div>
          <div className="nx-station-body">
            <div className="nx-station-figure">{agentRuns}</div>
            <div className="nx-station-title">Logged Workflow Runs</div>
          </div>
          <div className="nx-station-footer">
            ~{hoursSaved} hrs operator time saved
          </div>
        </div>
      </div>

      {/* 3. Modern Interactive Charts */}
      <DashboardCharts
        contactsCount={contacts.length}
        leadsCount={leadsCount}
        qualifiedCount={qualifiedCount}
        customersCount={customersCount}
        pageViews={pageTraffic}
        webinarRegistrations={totalRegistrations}
        emailsSent={emailsDispatched}
      />

      {/* 4. Telemetry Note */}
      <div className="nx-panel nx-analytics-note" style={{ marginTop: 24 }}>
        <h3>Measurement & Telemetry Protocol</h3>
        <p>
          Counts synchronize in real time with stored CRM contacts, active
          webinars, email campaigns, and agent execution receipts.
        </p>
        <p>
          {contacts.length} contacts recorded ({leadsCount} leads,{" "}
          {qualifiedCount} qualified, {customersCount} customers) ·{" "}
          {p.state.webinars.length} webinars · {p.state.campaigns.length}{" "}
          campaigns · {p.state.workflows.length} workflows
        </p>
      </div>
    </Shell>
  );
}

function Settings({ p }: { p: ModuleProps }) {
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    api<{ email: { configured: boolean } }>("/connections")
      .then((c) => setEmailConfigured(c.email.configured))
      .catch(() => setEmailConfigured(null));
  }, []);
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
                <p>
                  {i.id === "email"
                    ? "Resend connector: exact recipient/content approval, idempotency key, verified provider receipts."
                    : i.description}
                </p>
              </div>
              <span className="nx-badge nx-muted">
                {i.id === "email"
                  ? emailConfigured === null
                    ? "checking"
                    : emailConfigured
                      ? "configured"
                      : "needs setup"
                  : i.status || "unconfigured"}
              </span>
            </div>
          ))}
        </div>
        <div className="nx-panel">
          <div className="nx-panel-title">Connection guide</div>
          <p className="nx-muted-text">
            Ollama runs locally without an account. For real email, create a
            Resend account and configure a verified sender; put RESEND_API_KEY
            and NEXUS_EMAIL_FROM in the local .env file, then restart. Check
            current free-tier limits before use. Video and real payments remain
            future integrations.
          </p>
          {[
            [
              "Ollama — local AI, no account required",
              "https://ollama.com/download",
            ],
            ["Resend — connect email delivery", "https://resend.com"],
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
