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
  const accent = p.accent || "#76e4c2";

  const draftBanner = isDraft
    ? `<div class="nx-draft-banner">
        <div class="nx-draft-banner-content">
          <span class="draft-pill">DRAFT PREVIEW</span>
          <span>This page is currently unpublished. Changes are local until approved.</span>
        </div>
      </div>`
    : "";

  const registration = `
    <section class="registration-section" id="register">
      <div class="reg-ambient-glow"></div>
      <div class="reg-card">
        <div class="reg-header">
          <div class="reg-badge-row">
            <span class="reg-pill">OFFICIAL ADMISSION</span>
            <span class="reg-scarcity">🔥 Limited spots remaining</span>
          </div>
          <h2>Secure Your Access Pass</h2>
          <p class="reg-subtitle">Instant registration with live room credentials, calendar invite, and verified sandbox receipt.</p>
        </div>

        <form method="post" action="/p/${escape(page.slug)}/register" class="reg-form" id="checkout-form">
          <div class="form-grid">
            <div class="field-group">
              <label for="name">Full Name <span class="req">*</span></label>
              <div class="input-wrap">
                <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input id="name" name="name" maxlength="120" autocomplete="name" required placeholder="Alex Mercer">
              </div>
            </div>
            <div class="field-group">
              <label for="email">Email Address <span class="req">*</span></label>
              <div class="input-wrap">
                <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <input id="email" name="email" type="email" autocomplete="email" required placeholder="alex@company.com">
              </div>
            </div>
          </div>

          <div class="payment-terminal">
            <div class="terminal-top">
              <div class="terminal-tier">
                <span class="terminal-label">PASS TIER</span>
                <strong>Live All-Access Pass</strong>
              </div>
              <div class="terminal-price">
                <span class="price-val">$49<small>.00</small></span>
                <span class="price-badge">SANDBOX</span>
              </div>
            </div>

            <div class="card-display">
              <div class="card-chip-row">
                <div class="emv-chip"></div>
                <span class="network-brand">VISA</span>
              </div>
              <div class="card-number-display">
                <span>4242</span><span>••••</span><span>••••</span><span>4242</span>
              </div>
              <div class="card-details-row">
                <div>
                  <small>HOLDER</small>
                  <span>TEST ATTENDEE</span>
                </div>
                <div>
                  <small>EXPIRES</small>
                  <span>12/28</span>
                </div>
                <div>
                  <small>CVC</small>
                  <span>123</span>
                </div>
              </div>
            </div>

            <input type="hidden" name="cardNumber" value="4242 •••• •••• 4242">
            <input type="hidden" name="cardExp" value="12/28">
            <input type="hidden" name="cardCvc" value="123">
            <input type="hidden" name="amount" value="49">
            <input type="hidden" name="paymentMethod" value="sandbox_card_4242">
          </div>

          <label class="consent-container">
            <input type="checkbox" name="consent" checked>
            <span class="checkmark"></span>
            <span class="consent-text">I consent to receive webinar room links, calendar invitations from <strong>meowlover102@gmail.com</strong>, and event announcements.</span>
          </label>

          <button type="submit" class="cta-submit-btn" id="pay-btn">
            <span class="btn-shine"></span>
            <span class="btn-text">Confirm Registration &amp; Enter Room</span>
            <svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
        </form>

        <div class="trust-strip">
          <div class="trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>256-Bit SSL Encrypted</span>
          </div>
          <div class="trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            <span>Dispatched via Gmail SMTP</span>
          </div>
          <div class="trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect width="15" height="14" x="1" y="5" rx="2" ry="2"/></svg>
            <span>Instant Jitsi Live Room</span>
          </div>
        </div>
      </div>
    </section>
  `;

  const blocks = (p.blocks || ["hero", "details", "registration"])
    .map((block) => {
      if (block === "hero") {
        return `
          <header class="hero-section">
            <div class="hero-glow"></div>
            <div class="hero-badge">
              <span class="pulse-indicator"></span>
              <span class="hero-badge-text">${escape(p.title || "Featured Event")}</span>
            </div>
            <h1 class="hero-headline">${escape(p.headline || p.title || "Build without Limits")}</h1>
            <p class="hero-subhead">${escape(p.description || "Join industry leaders and builders for an immersive live workshop.")}</p>
            
            <div class="hero-action-row">
              <a href="#register" class="hero-primary-cta">
                <span>Reserve Your Seat</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </a>
              <a href="#overview" class="hero-secondary-cta">Explore Agenda</a>
            </div>

            <div class="social-proof-bar">
              <div class="avatar-stack">
                <span class="av av-1">AM</span>
                <span class="av av-2">RS</span>
                <span class="av av-3">TK</span>
                <span class="av av-4">+2.4k</span>
              </div>
              <div class="proof-details">
                <div class="stars">★★★★★</div>
                <span class="proof-text"><strong>4.9 / 5</strong> from 380+ participants</span>
              </div>
              <div class="proof-divider"></div>
              <div class="proof-badge">
                <span class="verified-check">✓</span>
                <span>Verified Live Room Access</span>
              </div>
            </div>
          </header>
        `;
      }
      if (block === "details") {
        return `
          <section class="overview-section" id="overview">
            <div class="section-heading">
              <span class="eyebrow">CURRICULUM &amp; OVERVIEW</span>
              <h2>Engineered for High-Velocity Execution</h2>
              <p>Everything you need to master this topic, delivered directly by experienced practitioners.</p>
            </div>

            <div class="bento-grid">
              <div class="bento-card bento-hero-card">
                <div class="bento-icon-box">⚡</div>
                <div class="bento-content">
                  <h3>Comprehensive Walkthrough</h3>
                  <p>${escape(p.description || "Deep dive into real-world architecture, execution blueprints, and verified workflows designed to produce concrete business outcomes.")}</p>
                </div>
              </div>

              <div class="bento-card">
                <div class="bento-icon-box">🎥</div>
                <div class="bento-content">
                  <h3>Interactive Live Room</h3>
                  <p>Stream directly via Jitsi Meet in HD with zero app downloads or accounts required. Live screen share, chat, and breakout Q&amp;A.</p>
                </div>
              </div>

              <div class="bento-card">
                <div class="bento-icon-box">📦</div>
                <div class="bento-content">
                  <h3>Production Templates &amp; Assets</h3>
                  <p>Download the exact templates, source code repositories, and slide deck assets after the keynote session.</p>
                </div>
              </div>

              <div class="bento-card">
                <div class="bento-icon-box">🛡️</div>
                <div class="bento-content">
                  <h3>Verified Certification</h3>
                  <p>Verified attendance credentials and sandbox transaction receipt sent to your inbox upon registration.</p>
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
  <title>${escape(p.title || "Nexus Event")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --accent: ${escape(accent)};
      --accent-glow: rgba(118, 228, 194, 0.25);
      --bg-deep: #080d0a;
      --bg-card: rgba(16, 24, 19, 0.72);
      --bg-card-hover: rgba(22, 34, 27, 0.85);
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-accent: rgba(118, 228, 194, 0.35);
      --text-main: #f3f7f4;
      --text-muted: #8ea394;
      --text-dim: #5c7263;
      --font-body: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-display: "Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font-body);
      background-color: var(--bg-deep);
      color: var(--text-main);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(118, 228, 194, 0.12) 0%, transparent 55%),
        radial-gradient(circle at 85% 35%, rgba(60, 110, 219, 0.08) 0%, transparent 45%),
        radial-gradient(circle at 15% 75%, rgba(118, 228, 194, 0.06) 0%, transparent 50%);
      background-attachment: fixed;
    }

    /* Draft Banner */
    .nx-draft-banner {
      background: linear-gradient(90deg, #1b2820 0%, #152219 100%);
      border-bottom: 1px solid rgba(118, 228, 194, 0.25);
      padding: 10px 24px;
      font-size: 13px;
      color: #bbf0d6;
    }
    .nx-draft-banner-content {
      max-width: 1120px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .draft-pill {
      background: rgba(118, 228, 194, 0.2);
      color: #76e4c2;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid rgba(118, 228, 194, 0.3);
    }

    /* Top Navigation */
    nav.top-nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(8, 13, 10, 0.75);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border-subtle);
      padding: 16px 24px;
    }
    .nav-inner {
      max-width: 1120px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand-link {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: var(--text-main);
    }
    .brand-svg {
      height: 22px;
      width: auto;
      fill: currentColor;
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .live-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(118, 228, 194, 0.1);
      border: 1px solid rgba(118, 228, 194, 0.25);
      padding: 5px 12px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      color: var(--accent);
      text-transform: uppercase;
    }
    .nav-cta-btn {
      background: #76e4c2;
      color: #08120c;
      font-weight: 700;
      font-size: 13px;
      padding: 8px 18px;
      border-radius: 8px;
      text-decoration: none;
      box-shadow: 0 0 16px rgba(118, 228, 194, 0.2);
      transition: all 0.2s ease;
    }
    .nav-cta-btn:hover {
      background: #8bfcd8;
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(118, 228, 194, 0.35);
    }

    /* Main Container */
    main.page-main {
      max-width: 1120px;
      width: 100%;
      margin: 0 auto;
      padding: 60px 24px 100px;
      flex: 1;
    }

    /* Hero Section */
    .hero-section {
      text-align: center;
      padding: 40px 0 70px;
      position: relative;
    }
    .hero-glow {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 300px;
      background: radial-gradient(circle, rgba(118, 228, 194, 0.18) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }
    .hero-badge {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      padding: 6px 16px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 28px;
      backdrop-filter: blur(8px);
    }
    .pulse-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 10px var(--accent);
    }
    .hero-headline {
      position: relative;
      z-index: 1;
      font-family: var(--font-display);
      font-size: clamp(38px, 6vw, 68px);
      font-weight: 700;
      letter-spacing: -1.5px;
      line-height: 1.1;
      max-width: 920px;
      margin: 0 auto 24px;
      background: linear-gradient(180deg, #ffffff 0%, #cbd9d0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-subhead {
      position: relative;
      z-index: 1;
      font-size: clamp(16px, 2.2vw, 20px);
      color: var(--text-muted);
      max-width: 680px;
      margin: 0 auto 36px;
      line-height: 1.6;
    }
    .hero-action-row {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 56px;
    }
    .hero-primary-cta {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #76e4c2;
      color: #08120c;
      font-weight: 700;
      font-size: 16px;
      padding: 16px 32px;
      border-radius: 12px;
      text-decoration: none;
      box-shadow: 0 0 24px rgba(118, 228, 194, 0.3);
      transition: all 0.2s ease;
    }
    .hero-primary-cta svg {
      width: 18px;
      height: 18px;
      transition: transform 0.2s;
    }
    .hero-primary-cta:hover {
      background: #8cfcd9;
      transform: translateY(-2px);
      box-shadow: 0 6px 30px rgba(118, 228, 194, 0.45);
    }
    .hero-primary-cta:hover svg {
      transform: translateX(4px);
    }
    .hero-secondary-cta {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      font-weight: 600;
      font-size: 16px;
      padding: 16px 28px;
      border-radius: 12px;
      text-decoration: none;
      backdrop-filter: blur(8px);
      transition: all 0.2s ease;
    }
    .hero-secondary-cta:hover {
      background: rgba(255, 255, 255, 0.09);
      border-color: rgba(255, 255, 255, 0.15);
    }

    /* Social Proof Bar */
    .social-proof-bar {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      gap: 20px;
      padding: 12px 24px;
      background: rgba(16, 24, 19, 0.6);
      border: 1px solid var(--border-subtle);
      border-radius: 99px;
      backdrop-filter: blur(12px);
      flex-wrap: wrap;
      justify-content: center;
    }
    .avatar-stack {
      display: flex;
      align-items: center;
    }
    .av {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid #080d0a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      margin-left: -8px;
    }
    .av:first-child { margin-left: 0; }
    .av-1 { background: linear-gradient(135deg, #10b981, #047857); color: white; }
    .av-2 { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; }
    .av-3 { background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: white; }
    .av-4 { background: #233429; color: #76e4c2; font-size: 10px; }
    .proof-details {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }
    .stars {
      color: #fbbf24;
      font-size: 12px;
      letter-spacing: 2px;
    }
    .proof-text {
      font-size: 12px;
      color: var(--text-muted);
    }
    .proof-divider {
      width: 1px;
      height: 24px;
      background: var(--border-subtle);
    }
    .proof-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #9fe3c1;
    }
    .verified-check {
      background: rgba(118, 228, 194, 0.2);
      color: #76e4c2;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 800;
    }

    /* Bento Grid (Details Block) */
    .overview-section {
      margin: 80px 0;
    }
    .section-heading {
      text-align: center;
      max-width: 680px;
      margin: 0 auto 48px;
    }
    .eyebrow {
      font-family: var(--font-display);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: var(--accent);
      display: block;
      margin-bottom: 12px;
    }
    .section-heading h2 {
      font-family: var(--font-display);
      font-size: clamp(28px, 4vw, 42px);
      letter-spacing: -0.8px;
      margin-bottom: 12px;
      color: #ffffff;
    }
    .section-heading p {
      color: var(--text-muted);
      font-size: 16px;
    }
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    @media (max-width: 860px) {
      .bento-grid { grid-template-columns: 1fr; }
    }
    .bento-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 20px;
      padding: 32px;
      backdrop-filter: blur(16px);
      transition: all 0.25s ease;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .bento-card:hover {
      background: var(--bg-card-hover);
      border-color: var(--border-accent);
      transform: translateY(-3px);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
    }
    .bento-hero-card {
      grid-column: span 3;
    }
    @media (max-width: 860px) {
      .bento-hero-card { grid-column: span 1; }
    }
    .bento-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: rgba(118, 228, 194, 0.1);
      border: 1px solid rgba(118, 228, 194, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }
    .bento-content h3 {
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 8px;
    }
    .bento-content p {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
      white-space: pre-wrap;
    }

    /* Registration & Checkout Card */
    .registration-section {
      position: relative;
      margin: 80px auto;
      max-width: 760px;
    }
    .reg-ambient-glow {
      position: absolute;
      inset: -20px;
      background: radial-gradient(circle, rgba(118, 228, 194, 0.15) 0%, transparent 70%);
      filter: blur(40px);
      z-index: 0;
      pointer-events: none;
    }
    .reg-card {
      position: relative;
      z-index: 1;
      background: rgba(15, 23, 18, 0.85);
      border: 1px solid rgba(118, 228, 194, 0.3);
      border-radius: 24px;
      padding: clamp(28px, 5vw, 48px);
      backdrop-filter: blur(24px);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    }
    .reg-header {
      margin-bottom: 32px;
      text-align: center;
    }
    .reg-badge-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .reg-pill {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1px;
      color: var(--accent);
      background: rgba(118, 228, 194, 0.12);
      padding: 4px 12px;
      border-radius: 99px;
      border: 1px solid rgba(118, 228, 194, 0.25);
    }
    .reg-scarcity {
      font-size: 12px;
      color: #fca5a5;
      font-weight: 600;
    }
    .reg-header h2 {
      font-family: var(--font-display);
      font-size: clamp(26px, 4vw, 36px);
      color: #ffffff;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    .reg-subtitle {
      font-size: 15px;
      color: var(--text-muted);
      max-width: 520px;
      margin: 0 auto;
    }

    /* Form Styles */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    @media (max-width: 640px) {
      .form-grid { grid-template-columns: 1fr; }
    }
    .field-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #cbdad0;
      margin-bottom: 8px;
    }
    .field-group label .req { color: #f87171; }
    .input-wrap {
      position: relative;
    }
    .input-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      width: 17px;
      height: 17px;
      color: var(--text-dim);
      pointer-events: none;
    }
    .input-wrap input {
      width: 100%;
      padding: 14px 16px 14px 42px;
      background: rgba(9, 14, 11, 0.8);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      font-size: 15px;
      font-family: inherit;
      color: #ffffff;
      outline: none;
      transition: all 0.2s ease;
    }
    .input-wrap input:focus {
      border-color: var(--accent);
      background: rgba(12, 19, 15, 0.95);
      box-shadow: 0 0 0 4px rgba(118, 228, 194, 0.15);
    }

    /* Payment Terminal & Card */
    .payment-terminal {
      background: linear-gradient(180deg, rgba(12, 18, 14, 0.9) 0%, rgba(9, 14, 11, 0.95) 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 22px;
      margin-bottom: 24px;
    }
    .terminal-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .terminal-label {
      display: block;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      color: var(--accent);
      margin-bottom: 2px;
    }
    .terminal-tier strong {
      font-size: 15px;
      color: #ffffff;
    }
    .terminal-price {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .price-val {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      font-family: var(--font-display);
    }
    .price-val small { font-size: 15px; color: var(--text-muted); }
    .price-badge {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.8px;
      color: #76e4c2;
      background: rgba(118, 228, 194, 0.12);
      border: 1px solid rgba(118, 228, 194, 0.25);
      padding: 3px 8px;
      border-radius: 4px;
    }

    /* Virtual Card Graphic */
    .card-display {
      background: linear-gradient(135deg, #18281e 0%, #0d1a12 100%);
      border: 1px solid rgba(118, 228, 194, 0.2);
      border-radius: 14px;
      padding: 20px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.3);
    }
    .card-chip-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .emv-chip {
      width: 36px;
      height: 26px;
      background: linear-gradient(135deg, #ffd700 0%, #b8860b 100%);
      border-radius: 5px;
      box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.4);
    }
    .network-brand {
      font-size: 16px;
      font-weight: 800;
      font-style: italic;
      color: #ffffff;
      letter-spacing: 1px;
    }
    .card-number-display {
      font-family: "Space Grotesk", monospace;
      font-size: 18px;
      letter-spacing: 3px;
      color: #ffffff;
      margin-bottom: 16px;
      display: flex;
      gap: 12px;
    }
    .card-details-row {
      display: flex;
      gap: 32px;
    }
    .card-details-row small {
      display: block;
      font-size: 9px;
      color: #76e4c2;
      font-weight: 700;
      letter-spacing: 0.8px;
      margin-bottom: 2px;
    }
    .card-details-row span {
      font-size: 13px;
      color: #e2ede6;
      font-weight: 600;
    }

    /* Consent Checkbox */
    .consent-container {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin: 22px 0 28px;
      cursor: pointer;
      user-select: none;
    }
    .consent-container input[type="checkbox"] {
      margin-top: 3px;
      width: 18px;
      height: 18px;
      accent-color: #76e4c2;
      border-radius: 4px;
    }
    .consent-text {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .consent-text strong { color: #d6e8dc; }

    /* Submit Button */
    .cta-submit-btn {
      width: 100%;
      background: #76e4c2;
      color: #08120c;
      border: none;
      border-radius: 14px;
      padding: 18px 28px;
      font-size: 16px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      cursor: pointer;
      box-shadow: 0 0 28px rgba(118, 228, 194, 0.35);
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }
    .cta-submit-btn:hover {
      background: #8dfcdb;
      transform: translateY(-2px);
      box-shadow: 0 6px 36px rgba(118, 228, 194, 0.5);
    }
    .btn-svg {
      width: 18px;
      height: 18px;
      transition: transform 0.2s;
    }
    .cta-submit-btn:hover .btn-svg {
      transform: translateX(4px);
    }

    /* Trust Strip */
    .trust-strip {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid var(--border-subtle);
      flex-wrap: wrap;
    }
    .trust-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-dim);
    }
    .trust-item svg {
      width: 15px;
      height: 15px;
      color: var(--accent);
    }

    /* Footer */
    footer.page-footer {
      border-top: 1px solid var(--border-subtle);
      padding: 40px 24px;
      background: rgba(6, 10, 8, 0.85);
      text-align: center;
    }
    .footer-inner {
      max-width: 1120px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .footer-brand {
      height: 18px;
      width: auto;
      fill: rgba(255, 255, 255, 0.4);
    }
    .footer-text {
      font-size: 13px;
      color: var(--text-dim);
    }
  </style>
</head>
<body>
  ${draftBanner}
  <nav class="top-nav">
    <div class="nav-inner">
      <a href="/" class="brand-link">
        <svg class="brand-svg" viewBox="0 0 160 32" xmlns="http://www.w3.org/2000/svg">
          <!-- N -->
          <path d="M4 27V5h4.5l11 16.5V5H24v22h-4.5L8.5 10.5V27H4z"/>
          <!-- E (geometric 3 parallel bars) -->
          <rect x="36" y="5" width="18" height="4"/>
          <rect x="36" y="14" width="18" height="4"/>
          <rect x="36" y="23" width="18" height="4"/>
          <!-- X -->
          <path d="M66 5l7.5 11L66 27h5l5-7.5 5 7.5h5l-7.5-11L86 5h-5l-5 7.5L71 5h-5z"/>
          <!-- U -->
          <path d="M98 5v15c0 4.5 3 7 7.5 7s7.5-2.5 7.5-7V5h-4.5v15c0 2-1.5 3-3 3s-3-1-3-3V5H98z"/>
          <!-- S -->
          <path d="M126 10c0-3 2.5-5 6.5-5s6.5 2 6.5 5c0 6-13 4-13 11 0 3.5 3 6 7 6s7-2.5 7-5.5h-4.5c0 1-1 1.5-2.5 1.5s-2.5-1-2.5-2c0-6 13-4 13-11 0-3.5-3-6-7-6s-7 2.5-7 5h4.5z"/>
        </svg>
      </a>
      <div class="nav-actions">
        <span class="live-badge">
          <span class="pulse-indicator"></span>
          <span>Official Event</span>
        </span>
        <a href="#register" class="nav-cta-btn">Register Pass</a>
      </div>
    </div>
  </nav>

  <main class="page-main">
    ${blocks}
  </main>

  <footer class="page-footer">
    <div class="footer-inner">
      <svg class="footer-brand" viewBox="0 0 160 32" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 27V5h4.5l11 16.5V5H24v22h-4.5L8.5 10.5V27H4z"/>
        <rect x="36" y="5" width="18" height="4"/>
        <rect x="36" y="14" width="18" height="4"/>
        <rect x="36" y="23" width="18" height="4"/>
        <path d="M66 5l7.5 11L66 27h5l5-7.5 5 7.5h5l-7.5-11L86 5h-5l-5 7.5L71 5h-5z"/>
        <path d="M98 5v15c0 4.5 3 7 7.5 7s7.5-2.5 7.5-7V5h-4.5v15c0 2-1.5 3-3 3s-3-1-3-3V5H98z"/>
        <path d="M126 10c0-3 2.5-5 6.5-5s6.5 2 6.5 5c0 6-13 4-13 11 0 3.5 3 6 7 6s7-2.5 7-5.5h-4.5c0 1-1 1.5-2.5 1.5s-2.5-1-2.5-2c0-6 13-4 13-11 0-3.5-3-6-7-6s-7 2.5-7 5h4.5z"/>
      </svg>
      <p class="footer-text">Powered by Nexus · Verified Live-Interactive Event Architecture</p>
    </div>
  </footer>
</body>
</html>`;
}
