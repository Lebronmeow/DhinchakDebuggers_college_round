import nodemailer from "nodemailer";

const DEFAULT_SENDER = "meowlover102@gmail.com";

export function getSenderEmail() {
  return process.env.NEXUS_EMAIL_FROM || process.env.GMAIL_USER || DEFAULT_SENDER;
}

export function isGmailConfigured() {
  return Boolean(process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS);
}

/**
 * Send an email using meowlover102@gmail.com.
 * When GMAIL_APP_PASSWORD is set in .env, delivers real email via Gmail SMTP.
 * Otherwise, records a verified simulated dispatch with full payload for sandbox review.
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
  from = getSenderEmail(),
  store = null,
} = {}) {
  const sender = from || DEFAULT_SENDER;
  const recipients = Array.isArray(to) ? to : [to];

  if (isGmailConfigured()) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: sender,
          pass: (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "").trim(),
        },
      });

      const info = await transporter.sendMail({
        from: `"Nexus Workspace" <${sender}>`,
        to: recipients.join(", "),
        subject,
        text,
        html: html || text,
      });

      if (store) {
        store.update((s) => {
          s.activities.push({
            id: store.id("act"),
            type: "email.sent",
            message: `Real email dispatched from ${sender} to ${recipients.join(", ")} (${subject})`,
            createdAt: new Date().toISOString(),
          });
        });
      }

      return {
        status: "sent",
        provider: "gmail-smtp",
        messageId: info.messageId,
        sender,
        recipients,
      };
    } catch (err) {
      console.error("[EmailService] Gmail SMTP error:", err.message);
      if (store) {
        store.update((s) => {
          s.activities.push({
            id: store.id("act"),
            type: "email.error",
            message: `Gmail dispatch failed: ${err.message}. Check GMAIL_APP_PASSWORD in .env`,
            createdAt: new Date().toISOString(),
          });
        });
      }
      throw err;
    }
  }

  // Sandbox / local mode when app password is not yet configured
  if (store) {
    store.update((s) => {
      s.activities.push({
        id: store.id("act"),
        type: "email.queued_sandbox",
        message: `[Sandbox] Email queued from ${sender} to ${recipients.join(", ")}: "${subject}". Add GMAIL_APP_PASSWORD to .env for live inbox delivery.`,
        createdAt: new Date().toISOString(),
      });
    });
  }

  return {
    status: "sandbox_recorded",
    provider: "gmail-mock",
    sender,
    recipients,
    subject,
    note: "Add GMAIL_APP_PASSWORD in .env to deliver real messages directly through Gmail",
  };
}

/**
 * Send an automated webinar invitation & registration receipt.
 */
export async function sendWebinarInvite({
  to,
  name = "Attendee",
  webinarTitle = "Exclusive Session",
  startsAt = "",
  joinUrl = "",
  amount = 49,
  store = null,
} = {}) {
  const sender = getSenderEmail();
  const subject = `Your Access Pass: ${webinarTitle}`;
  const dateFormatted = startsAt
    ? new Date(startsAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" })
    : "Live On-Demand / Room Open";

  const textBody = `
Hi ${name},

You are confirmed for "${webinarTitle}"!

Event Details:
- Date & Time: ${dateFormatted}
- Live Webinar Room: ${joinUrl}
- Payment Status: Paid ($${amount}.00 Sandbox Test Mode)

To join the live session, open this link in any browser:
${joinUrl}

Hosted via Nexus Workspace
Sender: ${sender}
`.trim();

  const htmlBody = `
<!doctype html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f1712; color: #eaf5ee; padding: 32px 16px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #16221a; border-radius: 16px; border: 1px solid #284131; padding: 36px; box-shadow: 0 12px 36px rgba(0,0,0,0.4);">
    <div style="display: inline-block; padding: 4px 12px; background: rgba(118,228,194,0.15); border: 1px solid rgba(118,228,194,0.3); border-radius: 999px; font-size: 12px; color: #76e4c2; font-weight: 600; text-transform: uppercase; margin-bottom: 20px;">
      Confirmed RSVP &amp; Receipt
    </div>
    <h1 style="margin: 0 0 12px; font-size: 24px; color: #ffffff; line-height: 1.3;">${webinarTitle}</h1>
    <p style="color: #9ab3a1; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
      Hi <strong>${name}</strong>, your spot is reserved and your payment has been processed.
    </p>

    <div style="background: #1f3025; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #2d4837;">
      <div style="margin-bottom: 12px;">
        <span style="font-size: 12px; color: #76e4c2; text-transform: uppercase; display: block; font-weight: 600;">Date &amp; Time</span>
        <span style="font-size: 15px; color: #ffffff;">${dateFormatted}</span>
      </div>
      <div style="margin-bottom: 12px;">
        <span style="font-size: 12px; color: #76e4c2; text-transform: uppercase; display: block; font-weight: 600;">Payment Receipt</span>
        <span style="font-size: 15px; color: #ffffff;">$${amount}.00 · Verified Sandbox Transaction</span>
      </div>
      <div>
        <span style="font-size: 12px; color: #76e4c2; text-transform: uppercase; display: block; font-weight: 600;">Organizer Contact</span>
        <span style="font-size: 15px; color: #ffffff;">${sender}</span>
      </div>
    </div>

    ${joinUrl ? `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${joinUrl}" target="_blank" style="display: inline-block; background: #76e4c2; color: #0c1811; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 14px rgba(118,228,194,0.3);">
        🚀 Join Live Webinar Room
      </a>
      <p style="margin-top: 10px; font-size: 12px; color: #6d8874;">
        Direct link: <a href="${joinUrl}" style="color: #76e4c2;">${joinUrl}</a>
      </p>
    </div>
    ` : ""}

    <hr style="border: none; border-top: 1px solid #284131; margin: 24px 0;">
    <p style="font-size: 12px; color: #5a7561; margin: 0; line-height: 1.5;">
      You received this message because you registered on Nexus Workspace.<br>
      Dispatched from <strong>${sender}</strong>.
    </p>
  </div>
</body>
</html>
`.trim();

  return sendEmail({
    to,
    subject,
    text: textBody,
    html: htmlBody,
    from: sender,
    store,
  });
}
