// Optional real email connector. Secrets are read only on the server and never returned.
export function registerDeliveryRoutes(
  app,
  {
    store,
    providerFetch = fetch,
    config = () => ({
      key: process.env.RESEND_API_KEY,
      from: process.env.NEXUS_EMAIL_FROM || "meowlover102@gmail.com",
    }),
  },
) {
  const snapshot = (c) =>
    JSON.stringify({
      id: c.id,
      subject: c.subject,
      body: c.body,
      audience: c.audience,
    });
  const recipients = (s, c) =>
    s.contacts.filter(
      (x) =>
        x.consent &&
        (["all", "all contacts", "opted-in"].includes(c.audience) ||
          x.stage ===
            ({ leads: "lead", customers: "customer" }[c.audience] ||
              c.audience)),
    );
  const event = (s, message) =>
    s.activities.push({
      id: store.id("act"),
      type: "email.delivery",
      message,
      createdAt: new Date().toISOString(),
    });
  app.get("/api/connections", (_req, res) =>
    res.json({
      email: {
        provider: process.env.GMAIL_APP_PASSWORD
          ? "Gmail (Live SMTP)"
          : config().key
            ? "Resend"
            : "meowlover102@gmail.com (Ready)",
        configured: Boolean(
          process.env.GMAIL_APP_PASSWORD || (config().key && config().from),
        ),
        from: config().from,
      },
      payments: {
        mode: "sandbox_checkout",
        provider: "Nexus Test Checkout ($49.00 Dummy Card)",
      },
      video: {
        mode: "jitsi_meet",
        provider: "Jitsi Meet (Instant Web/Mobile Live Rooms)",
      },
    }),
  );
  app.post("/api/campaigns/:id/request-send", async (req, res, next) => {
    try {
      if (!config().key || !config().from)
        return res.status(409).json({
          error:
            "Configure RESEND_API_KEY and NEXUS_EMAIL_FROM on the server first.",
        });
      const approval = await store.update((s) => {
        const c = s.campaigns.find((x) => x.id === req.params.id);
        if (!c) throw new Error("Campaign not found");
        if (["sent", "sending", "delivery_unknown"].includes(c.status))
          throw new Error(
            "Campaign already sent or has an unresolved delivery attempt. Inspect provider receipts before another send.",
          );
        const audience = recipients(s, c);
        if (!audience.length)
          throw new Error("No opted-in recipients match this audience");
        if (audience.length > 50)
          throw new Error(
            "This connector is limited to 50 recipients per reviewed send",
          );
        if (audience.some((x) => /\.(test|invalid)$/i.test(x.email)))
          throw new Error(
            "Fictional .test/.invalid contacts cannot receive real email. Choose a real opted-in audience.",
          );
        const ids = audience.map((x) => x.id);
        const emails = audience.map((x) => x.email);
        const signature = snapshot(c);
        const previous = s.approvals.find(
          (a) =>
            a.kind === "send_campaign" &&
            a.targetId === c.id &&
            a.status === "pending",
        );
        if (
          previous &&
          previous.snapshot === signature &&
          JSON.stringify(previous.audienceIds) === JSON.stringify(ids) &&
          JSON.stringify(previous.recipientEmails) === JSON.stringify(emails) &&
          previous.sender === config().from
        )
          return previous;
        if (previous) previous.status = "superseded";
        const a = {
          id: store.id("ap"),
          kind: "send_campaign",
          targetId: c.id,
          title: `Send ${c.name} to ${ids.length} opted-in recipients`,
          summary: c.subject,
          snapshot: signature,
          audienceIds: ids,
          recipientEmails: emails,
          sender: config().from,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        s.approvals.push(a);
        event(
          s,
          `Real email send requested for ${c.name}; awaiting operator approval.`,
        );
        return a;
      });
      res.json(approval);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  // Intercept only delivery approvals; existing page/schedule approval handlers remain authoritative.
  app.post("/api/approvals/:id/decide", async (req, res, next) => {
    const candidate = store.get().approvals.find((a) => a.id === req.params.id);
    if (candidate?.kind !== "send_campaign") return next();
    const approvalId = candidate.id;
    try {
      if (!["approve", "reject"].includes(req.body?.decision))
        return res
          .status(400)
          .json({ error: "decision must be approve or reject" });
      const prepared = await store.update((s) => {
        const a = s.approvals.find((x) => x.id === approvalId);
        const c = s.campaigns.find((x) => x.id === a.targetId);
        if (a.status !== "pending")
          throw new Error("Approval is no longer pending");
        if (req.body.decision === "reject") {
          a.status = "rejected";
          return { rejected: true, approval: a };
        }
        if (!config().key || !config().from)
          throw new Error("Email connection is not configured");
        if (!c || snapshot(c) !== a.snapshot)
          throw new Error("Campaign changed; request fresh approval");
        const audience = recipients(s, c);
        if (
          JSON.stringify(audience.map((x) => x.id)) !==
          JSON.stringify(a.audienceIds)
        )
          throw new Error(
            "Audience or consent changed; request fresh approval",
          );
        if (
          JSON.stringify(a.recipientEmails) !==
            JSON.stringify(audience.map((x) => x.email)) ||
          a.sender !== config().from
        )
          throw new Error(
            "Sender or recipient email addresses changed; request fresh approval",
          );
        a.status = "executing";
        c.status = "sending";
        event(s, `Sending approved campaign ${c.name}.`);
        return { campaign: c, emails: audience.map((x) => x.email) };
      });
      if (prepared.rejected) return res.json(prepared.approval);
      let response;
      try {
        response = await providerFetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config().key}`,
            "content-type": "application/json",
            "Idempotency-Key": approvalId,
          },
          body: JSON.stringify(
            prepared.emails.map((to) => ({
              from: config().from,
              to: [to],
              subject: prepared.campaign.subject,
              text: prepared.campaign.body,
            })),
          ),
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok)
          throw new Error(`Provider returned HTTP ${response.status}`);
        const body = await response.json();
        if (
          !Array.isArray(body.data) ||
          body.data.length !== prepared.emails.length ||
          body.data.some((item) => typeof item.id !== "string")
        )
          throw new Error("Provider receipt did not match recipient count");
        const result = await store.update((s) => {
          const a = s.approvals.find((x) => x.id === approvalId);
          const c = s.campaigns.find((x) => x.id === a.targetId);
          a.status = "approved";
          a.providerMessageIds = body.data.map((x) => x.id);
          c.status = "sent";
          c.sentAt = new Date().toISOString();
          c.delivery = {
            provider: "resend",
            messageIds: a.providerMessageIds,
            count: body.data.length,
          };
          event(
            s,
            `Provider accepted ${body.data.length} messages for ${c.name}. Inbox delivery is not guaranteed.`,
          );
          return a;
        });
        return res.json(result);
      } catch (error) {
        await store.update((s) => {
          const a = s.approvals.find((x) => x.id === approvalId);
          const c = s.campaigns.find((x) => x.id === a.targetId);
          a.status = "delivery_unknown";
          c.status = "delivery_unknown";
          a.deliveryError =
            "Provider delivery was not verified. Inspect the provider dashboard before retrying.";
          event(s, a.deliveryError);
        });
        return res.status(502).json({
          error:
            "Delivery result is uncertain. Inspect Resend before retrying; Nexus will not automatically resend.",
        });
      }
    } catch (error) {
      return res.status(409).json({ error: error.message });
    }
  });
}
