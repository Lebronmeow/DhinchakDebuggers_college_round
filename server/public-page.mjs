const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

export function renderPublicPage(page) {
  const p = page._published;
  const registration = `<section class="registration"><span class="eyebrow">SAVE YOUR SPOT</span><h2>Start something good.</h2><p>Register your interest below. Event details will be confirmed by the organizer.</p><form method="post" action="/p/${escape(page.slug)}/register"><label for="name">Your name</label><input id="name" name="name" maxlength="120" autocomplete="name" required placeholder="Alex Taylor"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" required placeholder="alex@example.com"><label class="consent"><input type="checkbox" name="consent"> I'd also like to receive marketing updates. Optional.</label><button>Register your interest <span>↗</span></button></form><small>This is a local Nexus preview. No confirmation email will be sent.</small></section>`;
  const content = p.blocks
    .map((block) => {
      if (block === "hero")
        return `<section class="hero"><span class="eyebrow">${escape(p.title)}</span><h1>${escape(p.headline)}</h1><div class="hero-line"></div></section>`;
      if (block === "details")
        return `<section class="details"><p>${escape(p.description)}</p></section>`;
      if (block === "registration") return registration;
      return `<section class="details"><h2>${escape(block)}</h2></section>`;
    })
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(p.title)}</title><style>
    :root{color-scheme:light;--accent:${escape(p.accent)}}*{box-sizing:border-box}body{margin:0;font:16px/1.7 system-ui,sans-serif;background:#f6f7f0;color:#27382d}nav{border-bottom:1px solid #dde5d7;padding:18px max(24px,calc((100vw - 820px)/2));display:flex;justify-content:space-between;align-items:center;background:white}nav b{letter-spacing:-1px;font-size:23px}nav span{font-size:10px;letter-spacing:2px;color:#8b9d7d}main{max-width:820px;margin:auto;padding:50px 24px}.eyebrow{font-size:10px;letter-spacing:2px;color:#72886a;text-transform:uppercase}h1{font-size:clamp(35px,7vw,64px);letter-spacing:-2px;line-height:1.15;margin:22px 0 28px;max-width:720px}h2{font-size:26px;letter-spacing:-1px;margin:12px 0}p{color:#7b8b71;white-space:pre-wrap}.hero-line{width:70px;height:5px;background:var(--accent);margin:25px 0}.details{margin:30px 0}.details p{font-size:19px}.registration{padding:clamp(24px,5vw,45px);background:white;border:1px solid #dfe6d7;border-top:5px solid var(--accent);border-radius:14px;margin-top:45px}.registration>p{font-size:13px}.registration small{display:block;font-size:10px;color:#98a58e;margin-top:18px}form{margin-top:26px;max-width:500px}form>label{font-size:12px;display:block;margin-top:16px}input:not([type=checkbox]){display:block;width:100%;padding:13px 15px;border:1px solid #dce4d4;background:#fcfdf9;border-radius:7px;margin-top:7px;font:inherit;font-size:13px;color:#35472e}.consent{display:flex;align-items:flex-start;gap:8px;color:#7f8e73;font-size:11px}input[type=checkbox]{margin-top:5px;accent-color:#426a44}button{margin-top:23px;padding:13px 17px;border:0;border-radius:7px;background:#355d40;color:white;width:100%;font:600 12px system-ui;display:flex;justify-content:space-between;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #95b97b;outline-offset:3px}footer{padding:35px;text-align:center;font-size:11px;color:#98a38c}
  </style></head><body><nav><b>nexus.</b><span>IN GOOD COMPANY</span></nav><main>${content}</main><footer>Built with Nexus · local-first workspace</footer></body></html>`;
}
