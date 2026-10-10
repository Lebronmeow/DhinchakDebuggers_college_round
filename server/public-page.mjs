const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

export function renderPublicPage(page, options = {}) {
  const p = page._published || page;
  const isDraft = !page._published || options.isDraft;
  const accent = p.accent || "#43744e";

  const draftBanner = isDraft
    ? `<div class="nx-draft-banner"><div class="nx-draft-banner-content"><span>⚡ <strong>DRAFT PREVIEW</strong> · This page is currently unpublished.</span><span class="nx-draft-badge">Local Preview</span></div></div>`
    : "";

  const registration = `
    <section class="registration-card" id="register">
      <div class="card-glow"></div>
      <div class="card-inner">
        <span class="eyebrow-pill">RESERVE YOUR SPOT</span>
        <h2>Join this exclusive session.</h2>
        <p class="card-subhead">Register your interest below to secure your place. Space is strictly limited.</p>
        <form method="post" action="/p/${escape(page.slug)}/register" class="reg-form">
          <div class="field-group">
            <label for="name">Full Name</label>
            <div class="input-wrap">
              <input id="name" name="name" maxlength="120" autocomplete="name" required placeholder="Alex Taylor">
            </div>
          </div>
          <div class="field-group">
            <label for="email">Work or Personal Email</label>
            <div class="input-wrap">
              <input id="email" name="email" type="email" autocomplete="email" required placeholder="alex@example.com">
            </div>
          </div>
          <label class="consent-label">
            <input type="checkbox" name="consent">
            <span>I agree to receive event updates, relevant materials, and schedule announcements.</span>
          </label>
          <button type="submit" class="submit-btn">
            <span>Confirm Registration</span>
            <span class="btn-arrow">→</span>
          </button>
        </form>
        <div class="trust-footer">
          <span>🔒 Verified by Nexus Local Engine</span>
          <span>•</span>
          <span>Instant RSVP Confirmation</span>
        </div>
      </div>
    </section>
  `;

  const blocks = (p.blocks || ["hero", "details", "registration"])
    .map((block) => {
      if (block === "hero") {
        return `
          <header class="hero">
            <div class="hero-badge">
              <span class="pulse-dot"></span>
              <span>${escape(p.title || "Featured Event")}</span>
            </div>
            <h1 class="hero-title">${escape(p.headline || p.title || "Welcome")}</h1>
            <div class="hero-meta-row">
              <span class="meta-tag">⚡ Live Interactive</span>
              <span class="meta-tag">🎯 Targeted Session</span>
              <span class="meta-tag">✓ Free RSVP</span>
            </div>
          </header>
        `;
      }
      if (block === "details") {
        return `
          <section class="details-section">
            <div class="details-card">
              <div class="section-tag">OVERVIEW & DETAILS</div>
              <div class="details-body">
                <p>${escape(p.description || "")}</p>
              </div>
              <div class="feature-grid">
                <div class="feature-item">
                  <div class="feature-icon">✨</div>
                  <div class="feature-title">Actionable Insights</div>
                  <div class="feature-desc">Concrete takeaways tailored to your workflow and goals.</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">💬</div>
                  <div class="feature-title">Direct Q&amp;A</div>
                  <div class="feature-desc">Engage live with session organizers and get direct answers.</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">📦</div>
                  <div class="feature-title">Resource Access</div>
                  <div class="feature-desc">Access linked documents, workshop notes, and live recordings.</div>
                </div>
              </div>
            </div>
          </section>
        `;
      }
      if (block === "registration") return registration;
      return `<section class="custom-block"><h2>${escape(block)}</h2></section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escape(p.title || "Landing Page")}</title>
  <style>
    :root {
      color-scheme: light;
      --accent: ${escape(accent)};
      --accent-glow: ${escape(accent)}25;
      --bg: #f8faf7;
      --surface: #ffffff;
      --surface-border: #e3ebd9;
      --text-main: #142218;
      --text-muted: #576d5e;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text-main);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .nx-draft-banner {
      background: #18261e;
      color: #9fe2b2;
      padding: 10px 24px;
      font-size: 13px;
      font-weight: 500;
      border-bottom: 1px solid rgba(159,226,178,0.2);
    }
    .nx-draft-banner-content {
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .nx-draft-badge {
      background: rgba(159,226,178,0.15);
      padding: 3px 10px;
      border-radius: 99px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    nav.top-nav {
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--surface-border);
      position: sticky;
      top: 0;
      z-index: 50;
      padding: 14px 24px;
    }
    .nav-inner {
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 800;
      font-size: 20px;
      letter-spacing: -0.5px;
      color: var(--text-main);
    }
    .nav-brand-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 10px var(--accent);
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .nav-status {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--accent);
      background: var(--accent-glow);
      padding: 5px 12px;
      border-radius: 99px;
      border: 1px solid rgba(0,0,0,0.06);
    }
    .nav-cta {
      background: var(--accent);
      color: #ffffff;
      padding: 7px 16px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      transition: opacity 0.2s;
    }
    .nav-cta:hover { opacity: 0.9; }

    main.page-main {
      max-width: 960px;
      width: 100%;
      margin: 0 auto;
      padding: 50px 24px 80px;
      flex: 1;
    }
    header.hero {
      text-align: center;
      padding: 30px 0 50px;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      padding: 6px 16px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    }
    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent);
    }
    h1.hero-title {
      font-size: clamp(34px, 6vw, 62px);
      font-weight: 800;
      letter-spacing: -1.5px;
      line-height: 1.15;
      color: var(--text-main);
      max-width: 820px;
      margin: 0 auto 24px;
    }
    .hero-meta-row {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .meta-tag {
      background: #ffffff;
      border: 1px solid var(--surface-border);
      font-size: 12px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 8px;
      color: var(--text-muted);
    }

    .details-section {
      margin: 30px 0 50px;
    }
    .details-card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.02);
    }
    .section-tag {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: var(--accent);
      margin-bottom: 16px;
    }
    .details-body p {
      font-size: 19px;
      color: var(--text-muted);
      line-height: 1.7;
      white-space: pre-wrap;
    }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
      margin-top: 36px;
      padding-top: 32px;
      border-top: 1px solid var(--surface-border);
    }
    .feature-item {
      padding: 20px;
      background: var(--bg);
      border-radius: 14px;
      border: 1px solid rgba(0,0,0,0.04);
    }
    .feature-icon {
      font-size: 24px;
      margin-bottom: 10px;
    }
    .feature-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 6px;
    }
    .feature-desc {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .registration-card {
      position: relative;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      border-top: 6px solid var(--accent);
      border-radius: 20px;
      padding: clamp(30px, 6vw, 56px);
      box-shadow: 0 12px 36px rgba(0,0,0,0.04);
      margin-top: 40px;
    }
    .eyebrow-pill {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: var(--accent);
      margin-bottom: 10px;
    }
    .registration-card h2 {
      font-size: clamp(24px, 4vw, 36px);
      font-weight: 800;
      letter-spacing: -0.8px;
      color: var(--text-main);
      margin-bottom: 10px;
    }
    .card-subhead {
      font-size: 15px;
      color: var(--text-muted);
      margin-bottom: 30px;
    }
    .reg-form {
      max-width: 540px;
    }
    .field-group {
      margin-bottom: 20px;
    }
    .field-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 8px;
    }
    .input-wrap input {
      width: 100%;
      padding: 14px 18px;
      background: var(--bg);
      border: 1px solid var(--surface-border);
      border-radius: 10px;
      font-size: 15px;
      font-family: inherit;
      color: var(--text-main);
      outline: none;
      transition: all 0.2s;
    }
    .input-wrap input:focus {
      background: #ffffff;
      border-color: var(--accent);
      box-shadow: 0 0 0 4px var(--accent-glow);
    }
    .consent-label {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 13px;
      color: var(--text-muted);
      margin: 22px 0 28px;
      cursor: pointer;
      user-select: none;
    }
    .consent-label input[type="checkbox"] {
      margin-top: 3px;
      width: 17px;
      height: 17px;
      accent-color: var(--accent);
    }
    .submit-btn {
      width: 100%;
      background: var(--accent);
      color: #ffffff;
      border: none;
      padding: 16px 24px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      box-shadow: 0 4px 14px var(--accent-glow);
      transition: all 0.2s;
    }
    .submit-btn:hover {
      filter: brightness(1.08);
      transform: translateY(-1px);
    }
    .btn-arrow {
      font-size: 18px;
      transition: transform 0.2s;
    }
    .submit-btn:hover .btn-arrow {
      transform: translateX(4px);
    }
    .trust-footer {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid var(--surface-border);
    }

    footer.page-footer {
      text-align: center;
      padding: 40px 24px;
      border-top: 1px solid var(--surface-border);
      background: #ffffff;
      font-size: 13px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  ${draftBanner}
  <nav class="top-nav">
    <div class="nav-inner">
      <div class="nav-brand">
        <span class="nav-brand-dot"></span>
        <span>nexus.</span>
      </div>
      <div class="nav-actions">
        <span class="nav-status">${isDraft ? "Draft Mode" : "Official Event"}</span>
        <a href="#register" class="nav-cta">Register Now</a>
      </div>
    </div>
  </nav>

  <main class="page-main">
    ${blocks}
  </main>

  <footer class="page-footer">
    <p>Powered by Nexus AI Business Operating System · Local-first runtime</p>
  </footer>
</body>
</html>`;
}
