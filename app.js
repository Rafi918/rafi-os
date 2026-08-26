/* =============================================================================
 *  app.js — RAFI OS
 *  Zero-build vanilla JS. No frameworks, no external requests, relative paths.
 *
 *  Modules (top → bottom):
 *    0. Utilities & safe storage
 *    1. Fallback art (avatar / cover / wallpaper) — generated, never broken
 *    2. Theme + UI scale
 *    3. Window manager (open/close/min/max/drag/focus/taskbar)
 *    4. Window content builders (About, Me.txt, Terminal, Games, Music, …)
 *    5. Terminal engine
 *    6. Music player ("My Love Music")
 *    7. Desktop, taskbar, Start menu, popovers, clock
 *    8. Boot + Welcome flow, keyboard, wiring, init
 * ========================================================================== */
(function () {
  "use strict";

  const DATA = window.RAFI_DATA;
  const { profile, interests, interests_ar, meText, meText_ar, ideasText, downloads, games, recycleBin, playlist, system, ideasBackend } = DATA;

  /* ======================================================================= *
   * i18n — centralized dictionary (translations.js) + t()/tArr() + Lang
   *   • t("key", {vars})  → interface string for the active language
   *   • tArr("key")       → array string (boot messages, help lines)
   *   • L(obj,"field")    → personal-content picker (field_ar in Arabic mode)
   *   • Lang.set("ar")    → switch instantly, persist, re-render everything
   * ======================================================================= */
  const I18N = window.RAFI_I18N || { en: {}, ar: {} };
  const RTL_LANGS = ["ar"];
  const LANG_LABEL = { en: "EN", ar: "عربي" };  // short label shown on the switcher

  function t(key, vars) {
    const dict = I18N[Lang.code] || I18N.en || {};
    let s = dict[key];
    if (s == null) s = (I18N.en || {})[key];
    if (s == null) return key;                 // last resort: show the key
    if (Array.isArray(s)) return s;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }
  function tArr(key, fallback) {
    const dict = I18N[Lang.code] || I18N.en || {};
    let s = dict[key];
    if (!Array.isArray(s)) s = (I18N.en || {})[key];
    if (Array.isArray(s)) return s;
    return Array.isArray(fallback) ? fallback : [];
  }
  /** Personal-content picker: returns obj[field+"_ar"] in Arabic when present. */
  function L(obj, field) {
    if (!obj) return "";
    if (Lang.code === "ar" && obj[field + "_ar"]) return obj[field + "_ar"];
    return obj[field] != null ? obj[field] : "";
  }

  const Lang = {
    code: "en",
    init() {
      const saved = store.get("rafi.lang", null);
      this.code = (saved && I18N[saved]) ? saved : "en";
      this._applyDoc();
    },
    isRTL() { return RTL_LANGS.includes(this.code); },
    _applyDoc() {
      const html = document.documentElement;
      html.setAttribute("lang", this.code);
      html.setAttribute("dir", this.isRTL() ? "rtl" : "ltr");
    },
    set(code) {
      if (!I18N[code] || code === this.code) return;
      this.code = code;
      store.set("rafi.lang", code);
      this._applyDoc();
      Sfx.play("theme");
      WM.retranslate();
      announce(t("lang.name"));
    },
    toggle() { this.set(this.code === "en" ? "ar" : "en"); }
  };

  /* ======================================================================= *
   * 0) UTILITIES
   * ======================================================================= */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Create an element with props + children. Safe (no innerHTML for user data). */
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;          // only used with trusted, code-authored strings
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (k in node && k !== "list") { try { node[k] = v; } catch { node.setAttribute(k, v); } }
      else node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => window.matchMedia("(max-width: 640px)").matches;

  /** localStorage that never throws (private mode, quota, disabled). */
  const store = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } },
    del(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
  };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  /** Screen-reader announcement + optional visible toast. */
  const liveRegion = $("#live-region");
  function announce(msg) { if (liveRegion) { liveRegion.textContent = ""; requestAnimationFrame(() => liveRegion.textContent = msg); } }
  function toast(msg) {
    const box = $("#toasts");
    if (!box) return;
    const t = el("div", { class: "toast", role: "status", text: msg });
    box.appendChild(t);
    announce(msg);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 250); }, 2200);
  }

  /* ======================================================================= *
   * 0b) INTERACTIVE SOUND ENGINE  (Web Audio — short, synthesized, no assets)
   *  • Nothing plays until a user gesture creates/resumes the AudioContext,
   *    so browser autoplay restrictions are respected (music is never forced).
   *  • A visible master mute in the tray silences these cues AND the music.
   *  • Every call is guarded: if Web Audio is missing it all becomes a no-op.
   * ======================================================================= */
  const Sfx = {
    ctx: null, master: null, muted: false,

    init() { this.muted = !!store.get("rafi.muted", false); },

    _ensure() {
      if (this.ctx) return this.ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch { this.ctx = null; }
      return this.ctx;
    },

    /** Must be called from a user gesture to satisfy autoplay policies. */
    unlock() {
      const ctx = this._ensure();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    },

    _blip({ freq = 440, to = null, type = "sine", dur = 0.12, gain = 0.14, delay = 0 }) {
      const ctx = this.ctx; if (!ctx || !this.master) return;
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    },

    play(name) {
      if (this.muted) return;
      if (!this.ctx || this.ctx.state !== "running") return;  // no gesture yet → stay silent
      switch (name) {
        case "startup":  this._blip({ freq: 392, to: 523, type: "sine", dur: 0.5, gain: 0.13 });
                         this._blip({ freq: 587, to: 784, type: "sine", dur: 0.55, gain: 0.09, delay: 0.13 }); break;
        case "ready":    this._blip({ freq: 660, type: "triangle", dur: 0.16, gain: 0.10 });
                         this._blip({ freq: 988, type: "triangle", dur: 0.22, gain: 0.08, delay: 0.10 }); break;
        case "click":    this._blip({ freq: 330, to: 250, type: "triangle", dur: 0.06, gain: 0.045 }); break;
        case "open":     this._blip({ freq: 460, to: 690, type: "sine", dur: 0.16, gain: 0.085 }); break;
        case "close":    this._blip({ freq: 520, to: 300, type: "sine", dur: 0.16, gain: 0.085 }); break;
        case "minimize": this._blip({ freq: 540, to: 300, type: "triangle", dur: 0.12, gain: 0.075 }); break;
        case "maximize": this._blip({ freq: 400, to: 640, type: "triangle", dur: 0.14, gain: 0.075 }); break;
        case "menu":     this._blip({ freq: 560, to: 740, type: "sine", dur: 0.10, gain: 0.07 }); break;
        case "theme":    this._blip({ freq: 494, type: "sine", dur: 0.14, gain: 0.09 });
                         this._blip({ freq: 740, type: "sine", dur: 0.18, gain: 0.07, delay: 0.09 }); break;
        case "track":    this._blip({ freq: 588, to: 784, type: "sine", dur: 0.14, gain: 0.06 }); break;
        case "toggle":   this._blip({ freq: 430, type: "triangle", dur: 0.07, gain: 0.06 }); break;
        case "error":    this._blip({ freq: 200, to: 130, type: "sawtooth", dur: 0.22, gain: 0.05 }); break;
      }
    },

    setMuted(m) {
      this.muted = !!m;
      store.set("rafi.muted", this.muted);
      try { Player.audio.muted = this.muted; } catch {}   // true "global" mute
      if (!this.muted) this.unlock();
      renderMuteBtn();
    },
    toggle() { const next = !this.muted; this.setMuted(next); if (!next) this.play("click"); }
  };

  /* ======================================================================= *
   * 1) GENERATED FALLBACK ART — nothing ever renders a broken image
   * ======================================================================= */
  const PALETTES = [
    ["#3fbfd4", "#1c6f88"], ["#7c5cff", "#3a2b8c"], ["#ff7a90", "#8c2b3f"],
    ["#ffd479", "#8c6a1f"], ["#5fd68a", "#1f6f45"], ["#4f8cff", "#243a8c"],
    ["#ff9f68", "#8c451f"], ["#c07cff", "#5c2b8c"]
  ];
  function hashInt(str) {
    let h = 0;
    for (let i = 0; i < String(str).length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function initialsOf(name) {
    const parts = String(name || "?").replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "♪";
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }
  /** Data-URI SVG placeholder (square). Used for covers & avatars. */
  function svgArt(seedText, { rounded = 12, glyph } = {}) {
    const [a, b] = PALETTES[hashInt(seedText) % PALETTES.length];
    const label = glyph || initialsOf(seedText);
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'>
        <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/>
        </linearGradient></defs>
        <rect width='240' height='240' rx='${rounded}' fill='url(#g)'/>
        <circle cx='190' cy='54' r='60' fill='rgba(255,255,255,.10)'/>
        <text x='50%' y='54%' text-anchor='middle' dominant-baseline='middle'
          font-family='Segoe UI, system-ui, sans-serif' font-size='96' font-weight='800'
          fill='rgba(255,255,255,.92)'>${label}</text>
      </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  /**
   * Wire an <img> so that if its real src fails, it swaps to generated art.
   * Returns the same img for convenience.
   */
  function resilientImg(img, { src, seed, rounded, glyph, alt = "" } = {}) {
    const fallback = svgArt(seed, { rounded, glyph });
    img.alt = alt;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", function onErr() {
      img.removeEventListener("error", onErr);
      img.src = fallback;
    });
    // If no real src given, go straight to fallback.
    img.src = src || fallback;
    return img;
  }

  /* ======================================================================= *
   * 1b) SVG ICON SET — original line icons, theme-aware (currentColor),
   *     font-independent (no emoji), scale with container font-size (1em).
   * ======================================================================= */
  const SVG = {
    about:    `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/></svg>`,
    me:       `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h7l5 5V20.5H6z"/><path d="M13 3.5V9h5"/><path d="M9 13h6M9 16.5h6"/></svg>`,
    terminal: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2.2"/><path d="M7 10l3 2.5-3 2.5"/><path d="M12.5 15.5h4.5"/></svg>`,
    games:    `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8.5h8a4.5 4.5 0 0 1 4.4 5.4l-.7 3.2A2.4 2.4 0 0 1 15.4 19L13.5 16.5h-3L8.6 19a2.4 2.4 0 0 1-4.3-1L3.6 13.9A4.5 4.5 0 0 1 8 8.5z"/><path d="M8 12v3M6.5 13.5h3"/><circle cx="15.6" cy="12.4" r="1" fill="currentColor" stroke="none"/><circle cx="17.6" cy="14.4" r="1" fill="currentColor" stroke="none"/></svg>`,
    music:    `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17.5V6l9-2v11"/><circle cx="6.5" cy="17.5" r="2.6"/><circle cx="15.5" cy="15.5" r="2.6"/></svg>`,
    downloads:`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v10.5M8 10.5l4 4 4-4"/><path d="M5 20.5h14"/></svg>`,
    ideas:    `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 18.5h5M10.5 21h3"/><path d="M12 3a6 6 0 0 1 3.8 10.6c-.6.5-.8 1-.8 1.9H9c0-.9-.2-1.4-.8-1.9A6 6 0 0 1 12 3z"/></svg>`,
    contact:  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.2"/><path d="M4 7.5l8 5.5 8-5.5"/></svg>`,
    recycle:  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l1 12.5h9L17.5 7"/><path d="M10 11v5.5M14 11v5.5"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/></svg>`,
    // ---- player transport & tray ----
    play:     `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" stroke="none"><path d="M7 4.8v14.4l12-7.2z"/></svg>`,
    pause:    `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" stroke="none"><rect x="6" y="4.6" width="4.2" height="14.8" rx="1.2"/><rect x="13.8" y="4.6" width="4.2" height="14.8" rx="1.2"/></svg>`,
    prev:     `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" stroke="none"><rect x="6" y="5" width="2.4" height="14" rx="1"/><path d="M20 5L9.5 12 20 19z"/></svg>`,
    next:     `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" stroke="none"><rect x="15.6" y="5" width="2.4" height="14" rx="1"/><path d="M4 5l10.5 7L4 19z"/></svg>`,
    shuffle:  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3.4c1.2 0 2.3.6 3 1.6l4.6 6.8c.7 1 1.8 1.6 3 1.6H21"/><path d="M3 17h3.4c1.2 0 2.3-.6 3-1.6M14.6 8.6c.7-1 1.8-1.6 3-1.6H21"/><path d="M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5"/></svg>`,
    repeat:   `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3.5L20 6.5 17 9.5"/><path d="M4 12v-1a4.5 4.5 0 0 1 4.5-4.5H20"/><path d="M7 20.5L4 17.5 7 14.5"/><path d="M20 12v1a4.5 4.5 0 0 1-4.5 4.5H4"/></svg>`,
    repeatOne:`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3.5L20 6.5 17 9.5"/><path d="M4 12v-1a4.5 4.5 0 0 1 4.5-4.5H20"/><path d="M7 20.5L4 17.5 7 14.5"/><path d="M20 12v1a4.5 4.5 0 0 1-4.5 4.5H4"/><text x="12" y="14.4" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" font-family="sans-serif">1</text></svg>`,
    volume:   `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3L11 6v12l-4-3.5H4z" fill="currentColor" stroke="none"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>`,
    mute:     `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3L11 6v12l-4-3.5H4z" fill="currentColor" stroke="none"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/></svg>`,
    note:     `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17V6l9-2v11"/><circle cx="6.5" cy="17" r="2.4"/><circle cx="15.5" cy="15" r="2.4"/></svg>`,
    spark:    `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" stroke="none"><path d="M12 2.2l1.9 6.4a2 2 0 0 0 1.3 1.3l6.4 1.9-6.4 1.9a2 2 0 0 0-1.3 1.3L12 21.8l-1.9-6.4a2 2 0 0 0-1.3-1.3L2.4 12l6.4-1.9a2 2 0 0 0 1.3-1.3z"/></svg>`,
    // ---- chrome / tray ----
    power:    `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2v7.2"/><path d="M6.8 6.6a7.5 7.5 0 1 0 10.4 0"/></svg>`,
    textSize: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" stroke="none" font-family="Segoe UI, system-ui, sans-serif"><text x="1.5" y="19" font-size="15" font-weight="800">A</text><text x="12.5" y="19" font-size="10" font-weight="800">A</text></svg>`,
    theme:    `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8.4"/><path d="M12 3.6a8.4 8.4 0 0 0 0 16.8z" fill="currentColor" stroke="none"/></svg>`,
    moon:     `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" stroke="none"><path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5 7.3 7.3 0 1 0 20.5 14.8z"/></svg>`,
    sun:      `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3.9" fill="currentColor" stroke="none"/><path d="M12 2.4v2.6M12 19v2.6M2.4 12h2.6M19 12h2.6M4.9 4.9l1.85 1.85M17.25 17.25 19.1 19.1M19.1 4.9l-1.85 1.85M6.75 17.25 4.9 19.1"/></svg>`,
    contrast: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8.4"/><path d="M12 3.6v16.8a8.4 8.4 0 0 0 0-16.8z" fill="currentColor" stroke="none"/></svg>`,
    globe:    `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.4 2.3 3.7 5.4 3.7 8.6s-1.3 6.3-3.7 8.6c-2.4-2.3-3.7-5.4-3.7-8.6S9.6 5.7 12 3.4z"/></svg>`
  };
  function setIcon(elm, name) { if (elm) elm.innerHTML = SVG[name] || ""; }

  /* ======================================================================= *
   * 2) THEME + UI SCALE
   * ======================================================================= */
  const THEMES = ["dark", "light", "contrast"];
  function applyTheme(theme, userInitiated = false) {
    if (!THEMES.includes(theme)) theme = "dark";
    const changed = document.documentElement.dataset.theme !== theme;
    document.documentElement.dataset.theme = theme;
    store.set("rafi.theme", theme);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", getComputedStyle(document.body).getPropertyValue("--bg-1").trim() || "#071c12");
    $$("#theme-pop .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.theme === theme));
    $$('[data-setting="theme"] button').forEach((b) => b.classList.toggle("is-active", b.dataset.value === theme));
    if (userInitiated && changed) { flashTheme(); Sfx.play("theme"); }
  }
  function applyScale(scale) {
    scale = clamp(parseFloat(scale) || 1, 0.8, 1.4);
    document.documentElement.style.setProperty("--ui-scale", String(scale));
    store.set("rafi.scale", scale);
    $$("#scale-pop .chip").forEach((c) => c.classList.toggle("is-active", parseFloat(c.dataset.scale) === scale));
    $$('[data-setting="scale"] button').forEach((b) => b.classList.toggle("is-active", parseFloat(b.dataset.value) === scale));
  }

  /* ======================================================================= *
   * 3) WINDOW MANAGER
   * ======================================================================= */
  /** Translated window/app title. All app ids have an "app.<id>" translation. */
  function appTitle(idOrDef) {
    const def = typeof idOrDef === "string" ? WM.apps[idOrDef] : idOrDef;
    if (!def) return "";
    return t(def.titleKey || ("app." + def.id));
  }

  const WM = {
    layer: $("#windows"),
    taskArea: $("#taskbar-tasks"),
    open: new Map(),      // id -> { win, taskBtn, def, restore }
    z: 100,
    cascade: 0,

    /** Register app definitions so both desktop icons and Start menu share them. */
    apps: {}, // id -> { title, glyph, build(bodyEl), width, height, flush }

    define(id, def) { this.apps[id] = def; },

    focus(id) {
      const rec = this.open.get(id);
      if (!rec) return;
      this.z += 1;
      rec.win.style.zIndex = String(this.z);
      this.open.forEach((r, key) => {
        const active = key === id;
        r.win.classList.toggle("is-active", active);
        r.win.setAttribute("aria-hidden", "false");
        if (r.taskBtn) r.taskBtn.classList.toggle("is-active", active && !r.win.classList.contains("is-min"));
      });
    },

    launch(id) {
      const def = this.apps[id];
      if (!def) return;
      // Already open? restore + focus.
      if (this.open.has(id)) {
        const rec = this.open.get(id);
        if (rec.win.classList.contains("is-min")) this.restore(id);
        this.focus(id);
        return;
      }
      const win = this._buildWindow(id, def);
      this.layer.appendChild(win);
      this._addTaskButton(id, def);
      this.focus(id);

      // Focus first control for keyboard users.
      const firstFocusable = win.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) firstFocusable.focus();

      if (typeof def.onOpen === "function") def.onOpen(win);
      Sfx.play("open");
      announce(t("a11y.opened", { title: appTitle(def) }));
    },

    _buildWindow(id, def) {
      const title = appTitle(def);
      const win = el("section", {
        class: "window",
        role: "dialog",
        "aria-modal": "false",
        "aria-label": title,
        tabindex: "-1",
        dataset: { id }
      });

      const titleId = `wt-${id}`;
      win.setAttribute("aria-labelledby", titleId);

      const btnMin = el("button", { class: "win-btn win-btn--min", type: "button", title: t("win.minimize", { title }), "aria-label": t("win.minimize", { title }), html: "&#8211;", onclick: () => this.minimize(id) });
      const btnMax = el("button", { class: "win-btn win-btn--max", type: "button", title: t("win.maximize", { title }), "aria-label": t("win.maximize", { title }), html: "&#9633;", onclick: () => this.toggleMax(id) });
      const btnClose = el("button", { class: "win-btn win-btn--close", type: "button", title: t("win.close", { title }), "aria-label": t("win.close", { title }), html: "&#10005;", onclick: () => this.close(id) });

      const titlebar = el("div", { class: "titlebar" }, [
        el("span", { class: "titlebar__icon", "aria-hidden": "true", html: SVG[id] || "▣" }),
        el("span", { class: "titlebar__title", id: titleId, text: title }),
        el("div", { class: "titlebar__btns" }, [btnMin, btnMax, btnClose])
      ]);

      const body = el("div", { class: "window__body" + (def.flush ? " window__body--flush" : "") });
      def.build(body, { id, win });

      win.appendChild(titlebar);
      win.appendChild(body);

      // Focus this window when clicked anywhere inside.
      win.addEventListener("mousedown", () => this.focus(id), true);
      win.addEventListener("touchstart", () => this.focus(id), { capture: true, passive: true });

      // Double-click title to maximize (desktop only).
      titlebar.addEventListener("dblclick", (e) => {
        if (e.target.closest(".win-btn")) return;
        if (!isMobile()) this.toggleMax(id);
      });

      // Size & position (desktop). Mobile is handled by CSS (full-screen sheet).
      if (!isMobile()) {
        const w = Math.min(def.width || 560, window.innerWidth - 40);
        const h = Math.min(def.height || 460, window.innerHeight - 40 - 52);
        win.style.width = w + "px";
        win.style.height = h + "px";
        const offset = (this.cascade % 6) * 28;
        this.cascade++;
        win.style.left = clamp(60 + offset, 0, window.innerWidth - w) + "px";
        win.style.top = clamp(40 + offset, 0, window.innerHeight - h - 60) + "px";
        this._makeDraggable(win, titlebar, id);
      }

      return win;
    },

    _makeDraggable(win, handle, id) {
      let startX, startY, origX, origY, dragging = false;

      const onDown = (e) => {
        if (e.target.closest(".win-btn")) return;
        if (win.classList.contains("is-max")) return;   // don't drag when maximized
        dragging = true;
        win.classList.add("dragging");
        const p = e.touches ? e.touches[0] : e;
        startX = p.clientX; startY = p.clientY;
        const r = win.getBoundingClientRect();
        origX = r.left; origY = r.top;
        this.focus(id);
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        document.addEventListener("touchmove", onMove, { passive: false });
        document.addEventListener("touchend", onUp);
      };
      const onMove = (e) => {
        if (!dragging) return;
        if (e.cancelable) e.preventDefault();
        const p = e.touches ? e.touches[0] : e;
        const w = win.offsetWidth, h = win.offsetHeight;
        // Keep the window inside the viewport (leave room for the taskbar).
        const nx = clamp(origX + (p.clientX - startX), 0, window.innerWidth - w);
        const ny = clamp(origY + (p.clientY - startY), 0, window.innerHeight - 52 - 20);
        win.style.left = nx + "px";
        win.style.top = ny + "px";
      };
      const onUp = () => {
        dragging = false;
        win.classList.remove("dragging");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
      };
      handle.addEventListener("mousedown", onDown);
      handle.addEventListener("touchstart", onDown, { passive: true });
    },

    _addTaskButton(id, def) {
      const title = appTitle(def);
      const btn = el("button", {
        class: "task-btn", type: "button",
        title: title, "aria-label": t("win.taskAria", { title }),
        onclick: () => {
          const rec = this.open.get(id);
          if (!rec) return;
          if (rec.win.classList.contains("is-min")) { this.restore(id); this.focus(id); }
          else if (rec.win.classList.contains("is-active")) { this.minimize(id); }
          else { this.focus(id); }
        }
      }, [
        el("span", { class: "task-btn__glyph", "aria-hidden": "true", html: SVG[id] || "▣" }),
        el("span", { class: "task-btn__label", text: title })
      ]);
      this.taskArea.appendChild(btn);
      const rec = this.open.get(id) || {};
      rec.win = this.layer.querySelector(`.window[data-id="${id}"]`);
      rec.taskBtn = btn;
      rec.def = def;
      this.open.set(id, rec);
    },

    minimize(id) {
      const rec = this.open.get(id);
      if (!rec) return;
      Sfx.play("minimize");
      rec.win.setAttribute("aria-hidden", "true");
      rec.taskBtn.classList.remove("is-active");
      const hide = () => { rec.win.classList.add("is-min"); rec.win.classList.remove("is-minimizing"); };
      if (prefersReducedMotion()) hide();
      else {
        rec.win.classList.add("is-minimizing");
        let done = false; const go = () => { if (done) return; done = true; hide(); };
        rec.win.addEventListener("animationend", go, { once: true });
        setTimeout(go, 260);
      }
      announce(t("a11y.minimized", { title: appTitle(rec.def) }));
      // Move focus somewhere sensible.
      rec.taskBtn.focus();
    },
    restore(id) {
      const rec = this.open.get(id);
      if (!rec) return;
      rec.win.classList.remove("is-min", "is-minimizing");
      rec.win.setAttribute("aria-hidden", "false");
      if (!prefersReducedMotion()) {
        rec.win.classList.add("is-restoring");
        rec.win.addEventListener("animationend", () => rec.win.classList.remove("is-restoring"), { once: true });
      }
      Sfx.play("open");
      this.focus(id);
    },
    toggleMax(id) {
      const rec = this.open.get(id);
      if (!rec) return;
      const maximizing = !rec.win.classList.contains("is-max");
      rec.win.classList.toggle("is-max");
      Sfx.play(maximizing ? "maximize" : "minimize");
      this.focus(id);
    },
    close(id) {
      const rec = this.open.get(id);
      if (!rec) return;
      Sfx.play("close");
      const finalize = () => {
        if (!this.open.has(id)) return;                    // idempotent
        if (typeof rec.def.onClose === "function") rec.def.onClose();
        rec.win.remove();
        rec.taskBtn.remove();
        this.open.delete(id);
        announce(t("a11y.closed", { title: appTitle(rec.def) }));
        // Focus the most-recently-focused remaining window.
        const remaining = Array.from(this.open.keys());
        if (remaining.length) this.focus(remaining[remaining.length - 1]);
        else $("#start-button")?.focus();
      };
      if (prefersReducedMotion()) { finalize(); return; }
      rec.win.classList.add("is-closing");
      let done = false; const go = () => { if (done) return; done = true; finalize(); };
      rec.win.addEventListener("animationend", go, { once: true });
      setTimeout(go, 280);
    },
    /** Re-render the entire UI in the current language, keeping windows open.
     *  Rebuilds each open window's body in place (geometry preserved). Builders
     *  read t()/L() so they come back translated. onClose() runs first so games
     *  stop their loops and the player releases its UI refs before the rebuild. */
    retranslate() {
      renderDesktopIcons();
      renderStartMenu();
      retranslateChrome();
      this.open.forEach((rec, id) => {
        const def = rec.def;
        const title = appTitle(def);
        const isMax = rec.win.classList.contains("is-max");
        rec.win.setAttribute("aria-label", title);
        const q = (s) => rec.win.querySelector(s);
        const tb = q(".titlebar__title"); if (tb) tb.textContent = title;
        const mn = q(".win-btn--min");   if (mn) { mn.title = t("win.minimize", { title }); mn.setAttribute("aria-label", t("win.minimize", { title })); }
        const mx = q(".win-btn--max");   if (mx) { const k = isMax ? "win.restore" : "win.maximize"; mx.title = t(k, { title }); mx.setAttribute("aria-label", t(k, { title })); }
        const cl = q(".win-btn--close"); if (cl) { cl.title = t("win.close", { title }); cl.setAttribute("aria-label", t("win.close", { title })); }
        if (rec.taskBtn) {
          rec.taskBtn.title = title;
          rec.taskBtn.setAttribute("aria-label", t("win.taskAria", { title }));
          const lbl = rec.taskBtn.querySelector(".task-btn__label"); if (lbl) lbl.textContent = title;
        }
        const body = q(".window__body");
        if (body) {
          if (typeof def.onClose === "function") def.onClose();  // stop timers / release refs
          body.textContent = "";
          def.build(body, { id, win: rec.win });
        }
      });
    },
    activeId() {
      let top = null, topZ = -1;
      this.open.forEach((rec, id) => {
        if (rec.win.classList.contains("is-min")) return;
        const z = parseInt(rec.win.style.zIndex || "0", 10);
        if (z >= topZ) { topZ = z; top = id; }
      });
      return top;
    }
  };

  /* ======================================================================= *
   * 4) WINDOW CONTENT BUILDERS
   * ======================================================================= */

  // ---- helper: social links present in profile (empty links hidden) --------
  const SOCIAL_META = {
    youtube:  { name: "YouTube",  glyph: "▶" },
    x:        { name: "X",        glyph: "𝕏" },
    telegram: { name: "Telegram", glyph: "✈" },
    github:   { name: "GitHub",   glyph: "❮❯" },
    steam:    { name: "Steam",    glyph: "⛭" },
    discord:  { name: "Discord",  glyph: "◇" }
  };
  // Simplified, original monochrome social marks — evocative, NOT exact brand
  // logos — drawn in the same line-icon language as the app icons so the whole
  // system stays coherent. They inherit currentColor and size to 1em.
  const SOCIAL_SVG = {
    youtube:  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="3.2"/><path d="M10.2 9.3l5 2.7-5 2.7z" fill="currentColor" stroke="none"/></svg>`,
    x:        `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" stroke="none"><path d="M17.5 3.2h3.1l-6.8 7.8 8 10.6h-6.3l-4.9-6.4-5.6 6.4H1.8l7.3-8.3L1.6 3.2h6.4l4.4 5.9 4.9-5.9zm-1.1 16.4h1.7L7.7 4.9H5.9l10.5 14.7z"/></svg>`,
    telegram: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" stroke="none"><path d="M21.7 4.3c.3-.8-.5-1.5-1.3-1.2L2.9 9.9c-.9.3-.8 1.6.1 1.8l4.5 1.1 1.6 5.2c.2.6 1 .8 1.5.3l2.4-2.4 4.4 3.2c.6.4 1.4.1 1.6-.6l3.2-14.2zM7.9 12.1l8.7-5.4-6 6.4-.2 3-2.5-4z"/></svg>`,
    github:   `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="5.5" r="2.3"/><circle cx="6.5" cy="18.5" r="2.3"/><circle cx="17.5" cy="7.5" r="2.3"/><path d="M6.5 7.8v8.4M17.5 9.8c0 3.4-2.4 4.6-5 5.1-1.8.3-2.9 1-3 2.6"/></svg>`,
    steam:    `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="15.2" cy="9" r="2.4"/><circle cx="8" cy="14.8" r="1.9" fill="currentColor" stroke="none"/><path d="M13.3 10.9 9.4 13.6"/></svg>`,
    discord:  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.5h12A2.5 2.5 0 0 1 20.5 7v7A2.5 2.5 0 0 1 18 16.5h-3.5L10 20v-3.5H6A2.5 2.5 0 0 1 3.5 14V7A2.5 2.5 0 0 1 6 4.5z"/><circle cx="9.3" cy="10.5" r="1.15" fill="currentColor" stroke="none"/><circle cx="14.7" cy="10.5" r="1.15" fill="currentColor" stroke="none"/></svg>`
  };
  function socialEntries() {
    return Object.entries(profile.links || {})
      .filter(([key, url]) => url && SOCIAL_META[key])
      .map(([key, url]) => ({ key, url, ...SOCIAL_META[key] }));
  }
  function buildSocials(includeEmail = true) {
    const wrap = el("div", { class: "socials" });
    socialEntries().forEach(({ key, url, name, glyph }) => {
      wrap.appendChild(el("a", {
        class: "social", href: url, target: "_blank", rel: "noopener noreferrer",
        "aria-label": t("social.newTab", { name })
      }, [
        el("span", { class: "social__glyph", "aria-hidden": "true", html: SOCIAL_SVG[key] || glyph }),
        el("span", { class: "social__name", text: name })
      ]));
    });
    if (includeEmail && profile.email) {
      wrap.appendChild(el("a", {
        class: "social", href: `mailto:${profile.email}`, "aria-label": t("social.emailAria", { name: profile.shortName })
      }, [
        el("span", { class: "social__glyph", "aria-hidden": "true", html: SVG.contact }),
        el("span", { class: "social__name", text: t("social.email") })
      ]));
    }
    return wrap;
  }

  // ---- About Me -------------------------------------------------------------
  function buildAbout(body) {
    const avatar = resilientImg(el("img", { class: "about-hero__avatar", width: 84, height: 84 }),
      { src: profile.avatar, seed: profile.shortName, rounded: 22, alt: `${profile.shortName}'s avatar` });

    const chipList = (Lang.code === "ar" && Array.isArray(interests_ar) && interests_ar.length === (interests || []).length)
      ? interests_ar : (interests || []);

    body.appendChild(el("div", { class: "stack" }, [
      el("div", { class: "about-hero" }, [
        avatar,
        el("div", {}, [
          el("div", { class: "about-hero__name", text: profile.displayName }),
          el("div", { class: "about-hero__tag", text: `“${L(profile, "tagline")}”` }),
          el("div", { class: "muted", text: `@${profile.username}` })
        ])
      ]),
      el("p", { text: L(profile, "bio") }),
      el("div", {}, [
        el("div", { class: "field" }, [ el("span", { class: "field__k", text: t("about.location") }), el("span", { class: "field__v", text: L(profile, "location") }) ]),
        profile.age && el("div", { class: "field" }, [ el("span", { class: "field__k", text: t("about.age") }), el("span", { class: "field__v", text: L(profile, "age") }) ]),
        el("div", { class: "field" }, [
          el("span", { class: "field__k", text: t("about.uid") }),
          el("span", { class: "field__v" }, [ profile.uid, " ", el("span", { class: "badge", title: "This is a local/decorative value, not a live metric.", text: t("common.local") }) ])
        ]),
        el("div", { class: "field" }, [ el("span", { class: "field__k", text: t("about.username") }), el("span", { class: "field__v", text: `@${profile.username}` }) ])
      ]),
      el("hr", { class: "divider" }),
      el("h3", { text: t("about.interests") }),
      el("div", { class: "chips" }, chipList.map((tag) => el("span", { class: "chip-tag", text: tag }))),
      el("hr", { class: "divider" }),
      el("h3", { text: t("about.findMe") }),
      buildSocials(true)
    ]));
  }

  // ---- Plain-text file window (Me.txt) --------------------------------------
  function buildTextFile(storageKey, defaultText) {
    return function (body) {
      const def = (typeof defaultText === "function") ? defaultText() : defaultText;
      const saved = store.get(storageKey, null);
      const ta = el("textarea", {
        spellcheck: false,
        "aria-label": t("txt.editAria"),
        value: (saved != null ? saved : def)
      });
      const status = el("span", { class: "dim", "aria-live": "polite" });
      const save = el("button", { class: "btn", type: "button", text: t("common.save"), onclick: () => {
        store.set(storageKey, ta.value); status.textContent = t("common.savedToDevice"); toast(t("common.savedLocally"));
      }});
      const reset = el("button", { class: "btn", type: "button", text: t("common.reset"), onclick: () => {
        ta.value = def; store.del(storageKey); status.textContent = t("common.resetToDefault");
      }});
      body.appendChild(el("div", { class: "txtfile" }, [
        el("div", { class: "txtfile__bar" }, [ save, reset, status ]),
        ta,
        el("p", { class: "dim", style: "margin-top:10px;font-size:.74rem", text: t("txt.localNote") })
      ]));
    };
  }

  // ---- Ideas Box ------------------------------------------------------------
  //  A PRIVATE submission form. Visitors can only CREATE (send) a submission;
  //  they can never read, list, edit, or delete ideas. Each submission is saved
  //  to Cloud Firestore via firebase-ideas.js (window.RafiIdeas.submit), which
  //  writes exactly { name, idea, createdAt: serverTimestamp() } to the `ideas`
  //  collection. Anti-abuse is layered (client validation + honeypot + per-browser
  //  60s cooldown); the real gate is the Firestore create-only security rules
  //  (see README + firestore.rules). NOTE: no encryption is claimed or performed
  //  here — only HTTPS-in-transit + a private, create-only collection. Do not add
  //  fake "encrypted" wording.
  function buildIdeas(body) {
    const cfg = ideasBackend || {};
    const maxName = cfg.nameMax || 80;    // name is required, 1..maxName chars
    const maxLen = cfg.ideaMax || 2000;   // idea is required, 1..maxLen chars
    const cooldownMs = (cfg.cooldownSeconds || 60) * 1000;
    const cooldownKey = "rafi.ideas.last";

    const wrap = el("div", { class: "ideas stack" });
    wrap.appendChild(el("div", { class: "content-head" }, [
      el("span", { class: "content-head__ic", "aria-hidden": "true", html: SVG.ideas }),
      el("h2", { text: t("ideas.title") })
    ]));
    wrap.appendChild(el("p", { class: "muted", text: t("ideas.intro", { name: profile.shortName }) }));

    const nameInput = el("input", { class: "field__input", type: "text", maxlength: String(maxName), autocomplete: "name", required: "", "aria-required": "true", placeholder: t("ideas.namePlaceholder") });
    const idea = el("textarea", { class: "field__input field__area", maxlength: String(maxLen), rows: 5, required: "", "aria-required": "true", placeholder: t("ideas.ideaPlaceholder") });
    const counter = el("span", { class: "field__counter", "aria-live": "polite", text: t("ideas.counter", { n: 0, max: maxLen }) });
    idea.addEventListener("input", () => { counter.textContent = t("ideas.counter", { n: idea.value.length, max: maxLen }); });

    // Honeypot: a field hidden from humans; if a bot fills it we drop the submission.
    const honey = el("input", { class: "ideas__hp", type: "text", tabindex: "-1", autocomplete: "off", name: "website" });
    const honeyWrap = el("div", { class: "ideas__hp-wrap", "aria-hidden": "true" }, [
      el("label", {}, ["Website"]), honey
    ]);

    const status = el("div", { class: "ideas__status", role: "status", "aria-live": "polite" });
    const sendBtn = el("button", { class: "btn btn--primary", type: "submit", text: t("ideas.send") });

    const form = el("form", { class: "ideas__form", novalidate: "" }, [
      el("label", { class: "field" }, [ el("span", { class: "field__label", text: t("ideas.nameLabel") }), nameInput ]),
      el("label", { class: "field" }, [
        el("span", { class: "field__label", text: t("ideas.ideaLabel") }),
        idea,
        el("div", { class: "field__meta" }, [ counter ])
      ]),
      honeyWrap,
      el("div", { class: "ideas__actions" }, [ sendBtn, status ]),
      el("p", { class: "dim ideas__privacy", text: t("ideas.privacy", { name: profile.shortName }) })
    ]);
    wrap.appendChild(form);
    body.appendChild(wrap);

    const setStatus = (msg, kind) => { status.textContent = msg; status.className = "ideas__status" + (kind ? " is-" + kind : ""); };

    function showSuccess() {
      wrap.textContent = "";
      wrap.appendChild(el("div", { class: "ideas__success" }, [
        el("div", { class: "ideas__success-glyph", "aria-hidden": "true", html: SVG.ideas }),
        el("h3", { text: t("ideas.title") }),
        el("p", { class: "muted", text: t("ideas.sent") }),
        el("button", { class: "btn", type: "button", text: t("ideas.sendAnother"), onclick: () => { body.textContent = ""; buildIdeas(body); } })
      ]));
      Sfx.play("ready");
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (honey.value) { showSuccess(); return; }   // bot: fake success, store nothing

      const nameVal = nameInput.value.trim();
      const ideaVal = idea.value.trim();
      if (!nameVal) { setStatus(t("ideas.err.nameEmpty"), "error"); nameInput.focus(); return; }
      if (nameVal.length > maxName) { setStatus(t("ideas.err.nameLong", { max: maxName }), "error"); nameInput.focus(); return; }
      if (!ideaVal) { setStatus(t("ideas.err.empty"), "error"); idea.focus(); return; }
      if (ideaVal.length > maxLen) { setStatus(t("ideas.err.long", { max: maxLen }), "error"); idea.focus(); return; }

      const last = Number(store.get(cooldownKey, 0)) || 0;
      const now = Date.now();
      if (last && (now - last) < cooldownMs) {
        setStatus(t("ideas.err.cooldown", { sec: Math.ceil((cooldownMs - (now - last)) / 1000) }), "error");
        return;
      }

      // Send to Cloud Firestore via the type="module" bridge (firebase-ideas.js).
      // It writes exactly { name, idea, createdAt: serverTimestamp() } to the
      // `ideas` collection. The security rules allow create only — never read.
      const api = window.RafiIdeas;
      if (!api || !api.ready || typeof api.submit !== "function") {
        setStatus(t("ideas.err.network"), "error"); Sfx.play("error"); return;
      }

      sendBtn.disabled = true;
      setStatus(t("ideas.sending"), "loading");

      api.submit(nameVal, ideaVal).then(() => {
        store.set(cooldownKey, Date.now()); showSuccess();
      }).catch(() => {
        sendBtn.disabled = false; setStatus(t("ideas.err.network"), "error"); Sfx.play("error");
      });
    });
  }

  // ---- Downloads ------------------------------------------------------------
  function buildDownloads(body) {
    if (!downloads || !downloads.length) {
      body.appendChild(emptyState(SVG.downloads, t("downloads.empty"), t("downloads.emptySub")));
      return;
    }
    const list = el("div", { class: "list" });
    downloads.forEach((d) => {
      const action = d.available
        ? el("a", { class: "btn", href: d.href, download: "", "aria-label": t("downloads.dlAria", { name: d.name }) }, [t("common.download")])
        : el("span", { class: "badge", title: "Add this file to the assets/downloads folder to enable it.", text: t("common.comingSoon") });
      list.appendChild(el("div", { class: "list-item" }, [
        el("div", { class: "list-item__glyph", "aria-hidden": "true", html: SVG.downloads }),
        el("div", { class: "list-item__body" }, [
          el("div", { class: "list-item__name", text: d.name }),
          el("div", { class: "list-item__desc", text: `${d.desc}  ·  ${d.size || ""}` })
        ]),
        el("div", { class: "list-item__action" }, [action])
      ]));
    });
    body.appendChild(el("div", { class: "stack" }, [
      el("p", { class: "muted", text: t("downloads.intro") }),
      list
    ]));
  }

  // ---- Games ----------------------------------------------------------------
  //  Two original, dependency-free browser games: Snake (canvas) and
  //  Tic-Tac-Toe (DOM grid, with an unbeatable minimax "Hard" AI). A tabbed
  //  shell hosts them; each game returns a teardown() that stops its timers and
  //  removes its listeners so switching tabs / language / closing never leaks.
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  const GamesApp = {
    active: "snake",
    _teardown: null,
    _cleanup() { if (this._teardown) { try { this._teardown(); } catch {} this._teardown = null; } },
    onClose() { this._cleanup(); },

    build(body) {
      this._cleanup();
      const tabs = el("div", { class: "games__tabs", role: "tablist", "aria-label": t("games.pick") });
      const mount = el("div", { class: "games__mount" });
      const TAB_DEFS = [
        { key: "snake", label: t("games.snake"), mount: mountSnake },
        { key: "ttt",   label: t("games.ttt"),   mount: mountTicTacToe }
      ];
      const extras = (games || []).filter((g) => g && g.name);

      const renderExtra = (key) => {
        const g = extras[parseInt(key.slice(1), 10)];
        if (!g) return;
        mount.appendChild(el("div", { class: "game-extra" }, [
          el("div", { class: "game-extra__glyph", "aria-hidden": "true", ...(g.emoji ? { text: g.emoji } : { html: SVG.games }) }),
          el("h3", { text: g.name }),
          el("p", { class: "muted", text: g.desc || "" }),
          el("a", { class: "btn btn--primary", href: g.href || "#", target: (g.href && g.href.startsWith("http")) ? "_blank" : null, rel: "noopener noreferrer", text: t("common.play") })
        ]));
      };

      const selectTab = (key) => {
        this.active = key;
        $$(".games__tab", tabs).forEach((b) => {
          const on = b.dataset.key === key;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
          b.tabIndex = on ? 0 : -1;
        });
        this._cleanup();
        mount.textContent = "";
        const def = TAB_DEFS.find((d) => d.key === key);
        if (def) this._teardown = def.mount(mount) || null;
        else renderExtra(key);
      };

      TAB_DEFS.forEach((d) => tabs.appendChild(el("button", {
        class: "games__tab", type: "button", role: "tab", dataset: { key: d.key }, text: d.label,
        onclick: () => { selectTab(d.key); Sfx.play("click"); }
      })));
      extras.forEach((g, i) => tabs.appendChild(el("button", {
        class: "games__tab", type: "button", role: "tab", dataset: { key: "x" + i }, text: g.name,
        onclick: () => { selectTab("x" + i); Sfx.play("click"); }
      })));

      body.appendChild(el("div", { class: "games" }, [tabs, mount]));
      const start = (TAB_DEFS.some((d) => d.key === this.active) || /^x\d+$/.test(this.active)) ? this.active : "snake";
      selectTab(start);
    }
  };
  function buildGames(body) { GamesApp.build(body); }

  // ---- shared on-screen D-pad (touch) ---------------------------------------
  function buildDpad(cb) {
    const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const mk = (d, label, glyph) => el("button", {
      class: "dpad__btn dpad__btn--" + d, type: "button", "aria-label": label, text: glyph,
      onclick: () => cb(DIRS[d])
    });
    return el("div", { class: "dpad", "aria-hidden": "false" }, [
      mk("up", t("games.snake.up"), "▲"),
      el("div", { class: "dpad__mid" }, [ mk("left", t("games.snake.left"), "◀"), mk("right", t("games.snake.right"), "▶") ]),
      mk("down", t("games.snake.down"), "▼")
    ]);
  }

  // ---- Snake (canvas) -------------------------------------------------------
  function mountSnake(mount) {
    const N = 15, bestKey = "rafi.snake.best";
    let best = store.get(bestKey, 0) | 0;
    let snake, dir, pendingDir, food, score, timer = null, running = false, paused = false, over = false, speed;

    const scoreEl = el("span", { class: "game-stat__v", text: "0" });
    const bestEl  = el("span", { class: "game-stat__v", text: String(best) });
    const statusEl = el("div", { class: "game-status", role: "status", "aria-live": "polite", text: t("games.snake.ready") });
    const startBtn = el("button", { class: "btn btn--primary", type: "button", text: t("games.start") });
    const pauseBtn = el("button", { class: "btn", type: "button", text: t("games.pause"), disabled: true });
    const canvas = el("canvas", { class: "game-canvas", width: 360, height: 360, tabindex: "0", "aria-label": t("games.snake") });
    const ctx = canvas.getContext("2d");
    const hint = el("p", { class: "dim game-hint", text: t("games.snake.how") });

    const bar = el("div", { class: "game-bar" }, [
      el("div", { class: "game-stat" }, [ el("span", { class: "game-stat__k", text: t("games.score") }), scoreEl ]),
      el("div", { class: "game-stat" }, [ el("span", { class: "game-stat__k", text: t("games.best") }), bestEl ]),
      el("span", { class: "game-bar__spacer" }),
      pauseBtn, startBtn
    ]);
    mount.appendChild(el("div", { class: "game game--snake" }, [ bar, canvas, statusEl, buildDpad(setDir), hint ]));

    function roundRect(x, y, w, h, r, fill) {
      ctx.fillStyle = fill; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
      ctx.fill();
    }
    function draw() {
      const W = canvas.width, cell = W / N;
      ctx.fillStyle = cssVar("--surface-solid") || "#0c2418";
      ctx.fillRect(0, 0, W, W);
      ctx.strokeStyle = "rgba(127,127,127,0.10)"; ctx.lineWidth = 1;
      for (let i = 1; i < N; i++) {
        ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, W); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(W, i * cell); ctx.stroke();
      }
      if (food) roundRect(food.x * cell + 3, food.y * cell + 3, cell - 6, cell - 6, 5, cssVar("--copper-strong") || "#f2c088");
      const head = cssVar("--accent-strong") || "#55e3a8", bodyc = cssVar("--accent") || "#23c98a";
      (snake || []).forEach((s, i) => roundRect(s.x * cell + 1.5, s.y * cell + 1.5, cell - 3, cell - 3, 5, i === 0 ? head : bodyc));
    }
    function placeFood() {
      let p; do { p = { x: (Math.random() * N) | 0, y: (Math.random() * N) | 0 }; }
      while (snake && snake.some((s) => s.x === p.x && s.y === p.y));
      food = p;
    }
    function reset() {
      snake = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }];
      dir = { x: 1, y: 0 }; pendingDir = dir;
      score = 0; speed = 150; over = false; paused = false;
      scoreEl.textContent = "0"; placeFood(); draw();
    }
    function setDir(d) {
      if (!running || paused || over) return;
      if (d.x === -dir.x && d.y === -dir.y) return;   // no 180° reversal
      pendingDir = d;
    }
    function restartTimer() { clearInterval(timer); timer = setInterval(tick, speed); }
    function tick() {
      dir = pendingDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N) return end(t("games.snake.hitWall"));
      if (snake.some((s, i) => i > 0 && s.x === head.x && s.y === head.y)) return end(t("games.snake.hitSelf"));
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score++; scoreEl.textContent = String(score);
        if (score > best) { best = score; bestEl.textContent = String(best); store.set(bestKey, best); }
        placeFood();
        if (speed > 70 && score % 3 === 0) { speed -= 6; restartTimer(); }
        Sfx.play("track");
      } else snake.pop();
      draw();
    }
    function end(reason) {
      over = true; running = false; clearInterval(timer);
      pauseBtn.disabled = true; startBtn.textContent = t("games.restart");
      const nb = (score > 0 && score >= best) ? "  " + t("games.newBest") : "";
      statusEl.textContent = t("games.gameOver") + " — " + reason + nb;
      Sfx.play("error"); draw();
    }
    function startGame() {
      reset(); running = true; statusEl.textContent = "";
      startBtn.textContent = t("games.restart");
      pauseBtn.disabled = false; pauseBtn.textContent = t("games.pause");
      restartTimer(); canvas.focus(); Sfx.play("open");
    }
    function togglePause() {
      if (!running || over) return;
      paused = !paused;
      if (paused) { clearInterval(timer); statusEl.textContent = t("games.paused"); pauseBtn.textContent = t("games.resume"); }
      else { restartTimer(); statusEl.textContent = ""; pauseBtn.textContent = t("games.pause"); }
    }
    startBtn.addEventListener("click", startGame);
    pauseBtn.addEventListener("click", togglePause);

    // Keyboard (only when the Games window is the active one).
    const KEYMAP = {
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 }
    };
    const onKey = (e) => {
      if (WM.activeId() !== "games" || !canvas.isConnected) return;
      if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); if (running && !over) togglePause(); else startGame(); return; }
      if (e.key === "Enter" && (!running || over)) { e.preventDefault(); startGame(); return; }
      const d = KEYMAP[e.key] || KEYMAP[(e.key || "").toLowerCase()];
      if (d) { e.preventDefault(); if (!running && !over) startGame(); setDir(d); }
    };
    document.addEventListener("keydown", onKey);

    // Swipe (touch) on the canvas.
    let sx = 0, sy = 0;
    const onTS = (e) => { const p = e.touches[0]; sx = p.clientX; sy = p.clientY; };
    const onTE = (e) => {
      const p = e.changedTouches[0]; const dx = p.clientX - sx, dy = p.clientY - sy;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (!running && !over) startGame();
      if (Math.abs(dx) > Math.abs(dy)) setDir({ x: dx > 0 ? 1 : -1, y: 0 });
      else setDir({ x: 0, y: dy > 0 ? 1 : -1 });
    };
    canvas.addEventListener("touchstart", onTS, { passive: true });
    canvas.addEventListener("touchend", onTE, { passive: true });

    reset();
    return () => {
      clearInterval(timer);
      document.removeEventListener("keydown", onKey);
      canvas.removeEventListener("touchstart", onTS);
      canvas.removeEventListener("touchend", onTE);
    };
  }

  // ---- Tic-Tac-Toe (DOM grid + minimax) -------------------------------------
  function mountTicTacToe(mount) {
    const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let board, current, over, cpuTimer = null;
    let mode = "cpu", diff = "hard";
    const scores = { X: 0, O: 0, draw: 0 };

    const statusEl = el("div", { class: "game-status", role: "status", "aria-live": "polite" });
    const grid = el("div", { class: "ttt", role: "grid", "aria-label": t("games.ttt") });
    const cells = [];
    for (let i = 0; i < 9; i++) {
      const c = el("button", { class: "ttt__cell", type: "button", role: "gridcell", onclick: () => humanPlay(i) });
      cells.push(c); grid.appendChild(c);
    }
    const sX = el("span", { class: "game-stat__v", text: "0" });
    const sO = el("span", { class: "game-stat__v", text: "0" });
    const sD = el("span", { class: "game-stat__v", text: "0" });

    function seg(opts, val, cb) {
      const box = el("div", { class: "seg seg--sm" });
      opts.forEach(([v, label]) => {
        const b = el("button", { type: "button", dataset: { value: v }, text: label, onclick: () => {
          $$("button", box).forEach((x) => x.classList.toggle("is-active", x.dataset.value === v));
          cb(v); Sfx.play("click");
        }});
        if (v === val) b.classList.add("is-active");
        box.appendChild(b);
      });
      return box;
    }
    const modeSeg = seg([["cpu", t("games.ttt.vsCpu")], ["2p", t("games.ttt.twoP")]], mode, (v) => { mode = v; updateDiff(); reset(); });
    const diffSeg = seg([["easy", t("games.ttt.easy")], ["hard", t("games.ttt.hard")]], diff, (v) => { diff = v; });
    const diffWrap = el("div", { class: "game-ctrl" }, [ el("span", { class: "game-ctrl__k", text: t("games.ttt.difficulty") }), diffSeg ]);
    function updateDiff() { diffWrap.style.display = (mode === "cpu") ? "" : "none"; }
    const restart = el("button", { class: "btn", type: "button", text: t("games.restart"), onclick: () => reset() });

    mount.appendChild(el("div", { class: "game game--ttt" }, [
      el("div", { class: "ttt__ctrls" }, [ el("div", { class: "game-ctrl" }, [ el("span", { class: "game-ctrl__k", text: t("games.ttt.mode") }), modeSeg ]), diffWrap ]),
      el("p", { class: "dim game-hint", text: t("games.ttt.how") }),
      statusEl, grid,
      el("div", { class: "ttt__scores" }, [
        el("div", { class: "game-stat" }, [ el("span", { class: "game-stat__k", text: "X" }), sX ]),
        el("div", { class: "game-stat" }, [ el("span", { class: "game-stat__k", text: "=" }), sD ]),
        el("div", { class: "game-stat" }, [ el("span", { class: "game-stat__k", text: "O" }), sO ])
      ]),
      el("div", { class: "game-bar" }, [ restart ])
    ]));

    const winnerOf = (b) => { for (const L of LINES) { const [a, x, c] = L; if (b[a] && b[a] === b[x] && b[a] === b[c]) return b[a]; } return null; };
    const winLine = () => { for (const L of LINES) { const [a, x, c] = L; if (board[a] && board[a] === board[x] && board[a] === board[c]) return L; } return null; };
    function cellAria(i) {
      const state = board[i] ? t("games.ttt.cellTaken", { mark: board[i] }) : t("games.ttt.cellEmpty");
      return t("games.ttt.cellAria", { r: ((i / 3) | 0) + 1, c: (i % 3) + 1, state });
    }
    function renderTurn() {
      if (over) return;
      if (mode === "cpu") statusEl.textContent = current === "X" ? t("games.ttt.turnYou") : t("games.ttt.turnCpu");
      else statusEl.textContent = t("games.ttt.turn", { who: current === "X" ? t("games.ttt.p1") : t("games.ttt.p2") });
      cells.forEach((c, i) => c.setAttribute("aria-label", cellAria(i)));
    }
    function reset() {
      clearTimeout(cpuTimer);
      board = Array(9).fill(""); current = "X"; over = false;
      cells.forEach((c) => { c.textContent = ""; c.classList.remove("is-x", "is-o", "is-win"); c.disabled = false; });
      renderTurn();
    }
    function humanPlay(i) {
      if (over || board[i]) return;
      if (mode === "cpu" && current !== "X") return;
      play(i);
      if (!over && mode === "cpu" && current === "O") cpuTimer = setTimeout(cpuMove, 420);
    }
    function play(i) {
      board[i] = current;
      const c = cells[i]; c.textContent = current; c.classList.add(current === "X" ? "is-x" : "is-o"); c.disabled = true;
      c.setAttribute("aria-label", cellAria(i)); Sfx.play("click");
      const w = winnerOf(board);
      if (w) return endGame(w);
      if (board.every(Boolean)) return endGame("draw");
      current = current === "X" ? "O" : "X"; renderTurn();
    }
    function cpuMove() { if (over) return; const i = (diff === "hard") ? bestMove() : randMove(); if (i != null) play(i); }
    function randMove() { const e = board.map((v, i) => (v ? null : i)).filter((v) => v != null); return e.length ? e[(Math.random() * e.length) | 0] : null; }
    function bestMove() {
      let bs = -Infinity, mv = null;
      for (let i = 0; i < 9; i++) if (!board[i]) { board[i] = "O"; const s = minimax(board, 0, false); board[i] = ""; if (s > bs) { bs = s; mv = i; } }
      return mv;
    }
    function minimax(b, depth, isMax) {
      const w = winnerOf(b);
      if (w === "O") return 10 - depth;
      if (w === "X") return depth - 10;
      if (b.every(Boolean)) return 0;
      if (isMax) { let best = -Infinity; for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = "O"; best = Math.max(best, minimax(b, depth + 1, false)); b[i] = ""; } return best; }
      let best = Infinity; for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = "X"; best = Math.min(best, minimax(b, depth + 1, true)); b[i] = ""; } return best;
    }
    function endGame(res) {
      over = true; clearTimeout(cpuTimer); cells.forEach((c) => (c.disabled = true));
      if (res === "draw") { scores.draw++; sD.textContent = String(scores.draw); statusEl.textContent = t("games.ttt.draw"); Sfx.play("toggle"); return; }
      scores[res]++; (res === "X" ? sX : sO).textContent = String(scores[res]);
      const line = winLine(); if (line) line.forEach((i) => cells[i].classList.add("is-win"));
      if (mode === "cpu") { statusEl.textContent = res === "X" ? t("games.ttt.youWin") : t("games.ttt.youLose"); Sfx.play(res === "X" ? "ready" : "error"); }
      else { statusEl.textContent = t("games.ttt.win", { who: res === "X" ? t("games.ttt.p1") : t("games.ttt.p2") }); Sfx.play("ready"); }
    }

    updateDiff(); reset();
    return () => { clearTimeout(cpuTimer); };
  }

  // ---- Recycle Bin ----------------------------------------------------------
  function buildRecycle(body) {
    body.appendChild(el("p", { class: "muted", text: t("recycle.intro") }));
    const list = el("div", { class: "list", style: "margin-top:12px" });
    recycleBin.forEach((item) => {
      const row = el("div", { class: "list-item" }, [
        el("div", { class: "list-item__glyph", "aria-hidden": "true", html: SVG.me }),
        el("div", { class: "list-item__body" }, [
          el("div", { class: "list-item__name", text: item.name }),
          el("div", { class: "list-item__desc", text: item.note })
        ]),
        el("button", { class: "btn", type: "button", text: t("recycle.restore"), onclick: () => toast(t("recycle.restored", { name: item.name })) })
      ]);
      list.appendChild(row);
    });
    body.appendChild(list);
    body.appendChild(el("div", { style: "margin-top:16px" }, [
      el("button", { class: "btn", type: "button", text: t("recycle.empty"), onclick: () => toast(t("recycle.emptied")) })
    ]));
  }

  // ---- Contact --------------------------------------------------------------
  function buildContact(body) {
    const emailRow = el("div", { class: "list-item" }, [
      el("div", { class: "list-item__glyph", "aria-hidden": "true", html: SVG.contact }),
      el("div", { class: "list-item__body" }, [
        el("div", { class: "list-item__name", text: t("contact.email") }),
        el("div", { class: "list-item__desc", text: profile.email || "—" })
      ]),
      el("div", { style: "display:flex;gap:8px" }, [
        profile.email && el("a", { class: "btn btn--primary", href: `mailto:${profile.email}`, text: t("contact.write") }),
        profile.email && el("button", { class: "btn", type: "button", text: t("contact.copy"), onclick: (e) => copyEmail(e.currentTarget) })
      ].filter(Boolean))
    ]);

    body.appendChild(el("div", { class: "stack" }, [
      el("div", { class: "content-head" }, [
        el("span", { class: "content-head__ic", "aria-hidden": "true", html: SVG.spark }),
        el("h2", { text: t("contact.title") })
      ]),
      el("p", { class: "muted", text: t("contact.intro") }),
      emailRow,
      el("hr", { class: "divider" }),
      buildSocials(false)
    ]));
  }
  function copyEmail(btn) {
    const email = profile.email;
    const done = () => { toast(t("contact.copied")); if (btn) { const prev = btn.textContent; btn.textContent = t("contact.copiedBtn"); setTimeout(() => btn.textContent = prev, 1500); } };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(email).then(done).catch(() => legacyCopy(email, done));
    } else legacyCopy(email, done);
  }
  function legacyCopy(text, done) {
    try {
      const ta = el("textarea", { value: text, style: "position:fixed;opacity:0" });
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); done();
    } catch { toast(t("contact.copyFail")); }
  }

  // ---- shared empty state ---------------------------------------------------
  function emptyState(glyph, title, sub) {
    return el("div", { class: "empty" }, [
      el("div", { class: "empty__glyph", "aria-hidden": "true", html: glyph }),
      el("h3", { text: title }),
      el("p", { class: "muted", text: sub })
    ]);
  }

  /* ======================================================================= *
   * 5) TERMINAL ENGINE
   * ======================================================================= */
  function buildTerminal(body) {
    const out = el("div", { class: "term__out", role: "log", "aria-live": "polite", "aria-label": "Terminal output" });
    const input = el("input", {
      class: "term__input", type: "text", autocomplete: "off", autocapitalize: "off",
      spellcheck: false, "aria-label": "Terminal input"
    });
    const inputLine = el("div", { class: "term__inputline" }, [
      el("span", { class: "term__prompt", "aria-hidden": "true", text: `${profile.username}@rafi-os:~$` }),
      input
    ]);
    const term = el("div", { class: "term" }, [out, inputLine]);
    body.appendChild(term);

    const history = [];
    let hIdx = -1;

    const print = (text, cls) => {
      const line = el("div", { class: "term__line" + (cls ? ` ${cls}` : "") });
      line.textContent = text;
      out.appendChild(line);
      out.scrollTop = out.scrollHeight;
    };
    const printHTML = (html) => { const line = el("div", { class: "term__line", html }); out.appendChild(line); out.scrollTop = out.scrollHeight; };

    const COMMANDS = {
      help() {
        const line = (cmd, desc) => `  <span class="k">${cmd}</span> — ${desc}`;
        printHTML([
          t("term.help.head"),
          line("help", t("term.help.help")),
          line("about", t("term.help.about", { name: profile.shortName })),
          line("whoami", t("term.help.whoami")),
          line("music", t("term.help.music")),
          line("play", t("term.help.play")),
          line("next / prev", t("term.help.nextprev")),
          line("games", t("term.help.games")),
          line("ideas", t("term.help.ideas")),
          line("contact", t("term.help.contact")),
          line("links", t("term.help.links")),
          line("lang [en|ar]", t("term.help.lang")),
          line("theme [dark|light|contrast]", t("term.help.theme")),
          line("open [about|me|music|downloads|ideas|contact|games|bin]", t("term.help.open")),
          line("date", t("term.help.date")),
          line("clear", t("term.help.clear"))
        ].join("\n"));
      },
      about() {
        print(`${profile.displayName} — @${profile.username}`);
        print(L(profile, "bio"));
        print(`“${L(profile, "tagline")}”`);
        print(`${t("about.location")}: ${L(profile, "location")}`);
      },
      whoami() { print(profile.username); },
      music() { WM.launch("music"); print(t("term.opening", { name: "My Love Music" })); },
      play() { Player.toggle(); print(Player.audio.paused ? t("term.paused") : t("term.playing", { title: Player.current()?.title || "—" })); },
      next() { Player.next(true); print(`▶ ${Player.current()?.title || "—"}`); },
      prev() { Player.prev(); print(`▶ ${Player.current()?.title || "—"}`); },
      contact() {
        print(`${t("contact.email")}: ${profile.email || "—"}`);
        socialEntries().forEach(({ name, url }) => print(`${name}: ${url}`));
      },
      links() { socialEntries().forEach(({ name, url }) => printHTML(`<span class="k">${name}</span>: ${url}`)); if (!socialEntries().length) print(t("term.noLinks")); },
      theme(arg) {
        if (!arg) { print(t("term.themeCurrent", { theme: document.documentElement.dataset.theme })); return; }
        if (THEMES.includes(arg)) { applyTheme(arg, true); print(t("term.themeSet", { theme: arg })); }
        else print(t("term.themeUnknown", { arg, list: THEMES.join(", ") }), "err");
      },
      lang(arg) {
        if (!arg) { print(t("term.langCurrent", { lang: LANG_LABEL[Lang.code] || Lang.code })); return; }
        const a = String(arg).toLowerCase();
        if (I18N[a]) { Lang.set(a); /* window retranslates instantly; new terminal shows its banner */ }
        else print(t("term.langUnknown", { arg }), "err");
      },
      open(arg) {
        const map = { about: "about", me: "me", "me.txt": "me", music: "music", downloads: "downloads", ideas: "ideas", "ideas.txt": "ideas", contact: "contact", games: "games", bin: "recycle", recycle: "recycle", terminal: "terminal" };
        const id = map[(arg || "").toLowerCase()];
        if (id) { WM.launch(id); print(t("term.opening", { name: arg })); }
        else print(t("term.openUsage"), "err");
      },
      date() { print(new Date().toString()); },
      echo(arg, raw) { print(raw); },
      clear() { out.textContent = ""; },
      exit() { print(t("term.exit")); }
    };

    function run(raw) {
      const trimmed = raw.trim();
      printHTML(`<span class="u">${profile.username}@rafi-os</span>:~$ ${escapeHTML(raw)}`);
      if (!trimmed) return;
      history.unshift(raw); hIdx = -1;
      const [cmd, ...rest] = trimmed.split(/\s+/);
      const fn = COMMANDS[cmd.toLowerCase()];
      if (fn) { try { fn(rest[0], rest.join(" ")); } catch (e) { print(t("term.err", { msg: e.message }), "err"); } }
      else print(t("term.notFound", { cmd }), "err");
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { run(input.value); input.value = ""; }
      else if (e.key === "ArrowUp") { if (hIdx < history.length - 1) { hIdx++; input.value = history[hIdx]; e.preventDefault(); } }
      else if (e.key === "ArrowDown") { if (hIdx > 0) { hIdx--; input.value = history[hIdx]; } else { hIdx = -1; input.value = ""; } }
      else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); COMMANDS.clear(); }
    });

    // Focus input when clicking anywhere in the terminal.
    term.addEventListener("click", (e) => { if (!e.target.closest("a")) input.focus(); });

    // Welcome banner — typed on, for a little life (instant if reduced-motion).
    const typeLine = (text, cls, cb) => {
      if (prefersReducedMotion()) { print(text, cls); cb && cb(); return; }
      const line = el("div", { class: "term__line" + (cls ? ` ${cls}` : "") });
      const span = document.createTextNode("");
      const caret = el("span", { class: "term__caret", "aria-hidden": "true" });
      line.appendChild(span); line.appendChild(caret);
      out.appendChild(line);
      let i = 0;
      const tick = () => {
        span.textContent = text.slice(0, i);
        out.scrollTop = out.scrollHeight;
        if (i++ < text.length) setTimeout(tick, 16);
        else { caret.remove(); cb && cb(); }
      };
      tick();
    };
    typeLine(t("term.banner", { os: system.osName, version: system.version }), "", () => {
      printHTML(t("term.getStarted", { help: `<span class="k">help</span>` }));
      print("");
    });
    return { focusInput: () => input.focus() };
  }
  function escapeHTML(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  /* ======================================================================= *
   * 6) MUSIC PLAYER — "My Love Music"
   * ======================================================================= */
  const Player = {
    audio: $("#audio"),
    idx: 0,
    mode: "normal",         // normal | one | all
    shuffle: false,
    volume: 1,
    ui: null,               // set when window is open
    _order: [],             // shuffle order
    _wantsPlay: false,      // did the user ask to play? (drives autoplay-after-load)

    current() { return playlist[this.idx] || null; },

    init() {
      const saved = store.get("rafi.player", {});
      this.idx = clamp(saved.idx ?? 0, 0, Math.max(0, playlist.length - 1));
      this.mode = ["normal", "one", "all"].includes(saved.mode) ? saved.mode : "all";
      this.shuffle = !!saved.shuffle;
      this.volume = clamp(saved.volume ?? 1, 0, 1);
      this.audio.volume = this.volume;

      // Load metadata for the saved track (but never autoplay).
      this._loadTrack(this.idx, { autoplay: false, seekTo: saved.position || 0 });

      // Audio element events → UI + persistence + advance logic.
      const a = this.audio;
      a.addEventListener("timeupdate", () => { this._renderProgress(); this._persist(); });
      a.addEventListener("loadedmetadata", () => this._renderProgress());
      a.addEventListener("durationchange", () => this._renderProgress());
      a.addEventListener("play", () => { this._renderPlayState(); this._syncTray(); });
      a.addEventListener("pause", () => { this._renderPlayState(); this._syncTray(); });
      a.addEventListener("ended", () => this._onEnded());
      a.addEventListener("error", () => this._onError());
      a.addEventListener("volumechange", () => { this.volume = a.volume; this._renderVolume(); this._persist(); });
    },

    _persist() {
      store.set("rafi.player", {
        idx: this.idx, mode: this.mode, shuffle: this.shuffle,
        volume: this.audio.volume,
        position: isFinite(this.audio.currentTime) ? this.audio.currentTime : 0
      });
    },

    _loadTrack(i, { autoplay = true, seekTo = 0 } = {}) {
      if (!playlist.length) return;
      this.idx = (i + playlist.length) % playlist.length;
      const track = playlist[this.idx];
      this._wantsPlay = autoplay;
      this.audio.src = track.src || "";
      this.audio.load();
      if (seekTo > 0) {
        const onMeta = () => { try { this.audio.currentTime = seekTo; } catch {} this.audio.removeEventListener("loadedmetadata", onMeta); };
        this.audio.addEventListener("loadedmetadata", onMeta);
      }
      if (autoplay) {
        const p = this.audio.play();
        if (p && p.catch) p.catch(() => {/* blocked or missing — error handler covers it */});
      }
      this._renderNowPlaying();
      this._renderTrackList();
      this._syncTray();
      this._clearStatus();
      if (autoplay) {
        Sfx.play("track");
        // Crossfade the "now playing" panel on a real track change.
        if (this.ui && this.ui.now && !prefersReducedMotion()) {
          this.ui.now.classList.remove("is-changing");
          void this.ui.now.offsetWidth;   // restart the animation
          this.ui.now.classList.add("is-changing");
        }
      }
    },

    playIndex(i) { this._loadTrack(i, { autoplay: true }); },
    toggle() {
      if (!this.current()) return;
      Sfx.play("toggle");
      if (this.audio.paused) {
        this._wantsPlay = true;
        const p = this.audio.play();
        if (p && p.catch) p.catch(() => this._onError());
      } else this.audio.pause();
    },
    next(userInitiated = false) {
      if (this.shuffle) return this._playShuffled();
      const atEnd = this.idx >= playlist.length - 1;
      if (atEnd && this.mode === "normal" && !userInitiated) { return; }
      this._loadTrack(this.idx + 1, { autoplay: true });
    },
    prev() {
      if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
      if (this.shuffle) return this._playShuffled();
      this._loadTrack(this.idx - 1, { autoplay: true });
    },
    _playShuffled() {
      if (playlist.length <= 1) return this._loadTrack(this.idx, { autoplay: true });
      let n = this.idx;
      while (n === this.idx) n = Math.floor(Math.random() * playlist.length);
      this._loadTrack(n, { autoplay: true });
    },
    _onEnded() {
      if (this.mode === "one") { this._loadTrack(this.idx, { autoplay: true }); return; }
      if (this.shuffle) return this._playShuffled();
      if (this.idx >= playlist.length - 1) {
        if (this.mode === "all") this._loadTrack(0, { autoplay: true });
        else { this._renderPlayState(); } // normal: stop at end
      } else {
        this._loadTrack(this.idx + 1, { autoplay: true });
      }
    },
    _onError() {
      const tk = this.current();
      const msg = tk ? t("player.notFound", { title: tk.title, src: tk.src }) : t("player.unavailable");
      this._setStatus(msg, true);
      Sfx.play("error");
      this._renderPlayState();
      this._syncTray();
    },

    setMode(mode) { this.mode = mode; this._renderModes(); this._persist(); },
    toggleShuffle() { this.shuffle = !this.shuffle; this._renderModes(); this._persist(); toast(this.shuffle ? t("player.shuffleOn") : t("player.shuffleOff")); },

    /* ---- rendering (guards for when the window is closed) ---- */
    _renderNowPlaying() {
      const t = this.current(); if (!this.ui || !t) return;
      this.ui.title.textContent = t.title;
      this.ui.artist.textContent = t.artist || "";
      resilientImg(this.ui.cover, { src: t.cover, seed: t.title, rounded: 12, alt: `${t.title} cover art` });
    },
    _renderTrackList() {
      if (!this.ui) return;
      $$(".track", this.ui.list).forEach((btn, i) => {
        const active = i === this.idx;
        btn.classList.toggle("is-current", active);
        btn.setAttribute("aria-current", active ? "true" : "false");
        const eq = $(".track__eq", btn);
        if (eq) eq.innerHTML = (active && !this.audio.paused) ? "<i></i><i></i><i></i>" : "";
      });
    },
    _renderProgress() {
      if (!this.ui) return;
      const cur = this.audio.currentTime || 0;
      const dur = this.audio.duration || 0;
      this.ui.seek.max = isFinite(dur) && dur > 0 ? dur : 0;
      this.ui.seek.value = cur;
      this.ui.seek.style.setProperty("--_p", (dur ? (cur / dur) * 100 : 0) + "%");
      this.ui.cur.textContent = fmtTime(cur);
      this.ui.dur.textContent = isFinite(dur) && dur > 0 ? fmtTime(dur) : "--:--";
    },
    _renderPlayState() {
      if (!this.ui) return;
      const playing = !this.audio.paused;
      setIcon(this.ui.play, playing ? "pause" : "play");
      this.ui.play.setAttribute("aria-label", playing ? t("player.pause") : t("player.play"));
      this._renderTrackList();
    },
    _renderVolume() {
      if (!this.ui) return;
      this.ui.vol.value = this.audio.muted ? 0 : this.audio.volume;
      this.ui.vol.style.setProperty("--_p", (this.audio.muted ? 0 : this.audio.volume * 100) + "%");
      setIcon(this.ui.mute, (this.audio.muted || this.audio.volume === 0) ? "mute" : "volume");
    },
    _renderModes() {
      if (!this.ui) return;
      this.ui.shuffle.classList.toggle("is-active", this.shuffle);
      this.ui.repeat.classList.toggle("is-active", this.mode !== "normal");
      setIcon(this.ui.repeat, this.mode === "one" ? "repeatOne" : "repeat");
      const modeWord = this.mode === "one" ? t("player.repeat.one") : this.mode === "all" ? t("player.repeat.all") : t("player.repeat.off");
      this.ui.repeat.setAttribute("aria-label", t("player.repeatState", { mode: modeWord }));
    },
    _setStatus(msg, isError = false) { if (this.ui) { this.ui.status.textContent = msg; this.ui.status.classList.toggle("is-error", isError); } },
    _clearStatus() { if (this.ui) { this.ui.status.textContent = ""; this.ui.status.classList.remove("is-error"); } },

    _syncTray() {
      const tk = this.current();
      const title = $("#tray-music-title"), state = $("#tray-music-state"), toggle = $("#tray-music-toggle"), btn = $("#tray-music");
      if (title) title.textContent = tk ? tk.title : t("tray.musicIdle");
      const playing = tk && !this.audio.paused;
      const stateWord = playing ? t("tray.state.playing") : t("tray.state.paused");
      if (state) state.textContent = stateWord;
      if (toggle) setIcon(toggle, playing ? "pause" : "play");
      if (btn) btn.setAttribute("aria-label", tk ? t("tray.musicNow", { title: tk.title, state: stateWord }) : t("tray.musicAria"));
    },

    /* ---- build the player window ---- */
    build(body) {
      if (!playlist.length) { body.appendChild(emptyState(SVG.note, t("player.noTracks"), t("player.noTracksSub"))); return; }

      const cover = resilientImg(el("img", { class: "player__cover", width: 96, height: 96 }), { src: this.current().cover, seed: this.current().title, alt: "" });
      const title = el("div", { class: "player__title", text: this.current().title });
      const artist = el("div", { class: "player__artist", text: this.current().artist || "" });
      const status = el("div", { class: "player__status", role: "status", "aria-live": "polite" });

      const now = el("div", { class: "player__now" }, [ cover, el("div", { class: "player__meta" }, [title, artist, status]) ]);

      // Seek
      const cur = el("span", { class: "seek__time", text: "0:00" });
      const dur = el("span", { class: "seek__time", text: "--:--" });
      const seek = el("input", { class: "range", type: "range", min: 0, max: 0, value: 0, step: "any", "aria-label": t("player.seek") });
      seek.addEventListener("input", () => { if (this.audio.duration) { this.audio.currentTime = Number(seek.value); this._renderProgress(); } });
      const seekRow = el("div", { class: "seek" }, [cur, seek, dur]);

      // Transport
      const mkBtn = (cls, label, glyph, onClick) => el("button", { class: `tbtn ${cls}`, type: "button", "aria-label": label, title: label, onclick: onClick, html: glyph });
      const shuffle = mkBtn("", t("player.shuffle"), SVG.shuffle, () => this.toggleShuffle());
      const prev = mkBtn("", t("player.prev"), SVG.prev, () => this.prev());
      const play = mkBtn("tbtn--play", t("player.play"), SVG.play, () => this.toggle());
      const next = mkBtn("", t("player.next"), SVG.next, () => this.next(true));
      const repeat = mkBtn("", t("player.repeat"), SVG.repeat, () => this.setMode(this.mode === "normal" ? "all" : this.mode === "all" ? "one" : "normal"));
      const transport = el("div", { class: "transport" }, [shuffle, prev, play, next, repeat]);

      // Volume
      const mute = el("button", { class: "tbtn", type: "button", "aria-label": t("player.mute"), title: t("player.mute"), html: SVG.volume, onclick: () => { this.audio.muted = !this.audio.muted; this._renderVolume(); } });
      const vol = el("input", { class: "range", type: "range", min: 0, max: 1, step: 0.01, value: this.volume, "aria-label": t("player.volume") });
      vol.addEventListener("input", () => { this.audio.muted = false; this.audio.volume = Number(vol.value); });
      const volume = el("div", { class: "volume" }, [mute, vol]);

      const controls = el("div", { class: "player__controls" }, [seekRow, transport, volume]);

      // Playlist
      const list = el("div", { class: "playlist", role: "listbox", "aria-label": t("app.music") });
      list.appendChild(el("div", { class: "playlist__head", text: t("player.trackCount", { count: playlist.length }) }));
      playlist.forEach((track, i) => {
        const tcover = resilientImg(el("img", { class: "track__cover", width: 40, height: 40 }), { src: track.cover, seed: track.title, rounded: 8, alt: "" });
        const btn = el("button", {
          class: "track", type: "button", role: "option",
          "aria-label": t("player.playAria", { title: track.title, artist: track.artist || t("player.unknownArtist") }),
          onclick: () => this.playIndex(i)
        }, [
          tcover,
          el("div", { class: "track__body" }, [
            el("div", { class: "track__title", text: track.title }),
            el("div", { class: "track__artist", text: track.artist || "" })
          ]),
          el("span", { class: "track__eq", "aria-hidden": "true" })
        ]);
        list.appendChild(btn);
      });

      body.appendChild(el("div", { class: "player" }, [now, controls, list]));

      // Bind UI refs & paint current state.
      this.ui = { now, cover, title, artist, status, seek, cur, dur, play, shuffle, repeat, vol, mute, list };
      this._renderNowPlaying();
      this._renderProgress();
      this._renderPlayState();
      this._renderVolume();
      this._renderModes();
      this._renderTrackList();
      if (!this.current().src) this._setStatus(t("player.tipNoAudio"), false);
    },
    onClose() { this.ui = null; }   // stop rendering into a destroyed DOM; audio keeps playing
  };

  /* ======================================================================= *
   *  Settings window
   * ======================================================================= */
  function buildSettings(body) {
    const themeRow = el("div", { class: "setting-row", dataset: { setting: "theme" } }, [
      el("div", {}, [ el("div", { class: "setting-row__label", text: t("settings.theme") }), el("div", { class: "setting-row__desc", text: t("settings.themeDesc") }) ]),
      el("div", { class: "seg" }, THEMES.map((th) =>
        el("button", { type: "button", dataset: { value: th }, text: t("theme." + th), onclick: () => applyTheme(th, true) })
      ))
    ]);
    const scaleRow = el("div", { class: "setting-row", dataset: { setting: "scale" } }, [
      el("div", {}, [ el("div", { class: "setting-row__label", text: t("settings.size") }), el("div", { class: "setting-row__desc", text: t("settings.sizeDesc") }) ]),
      el("div", { class: "seg" }, [["0.9","S"],["1","M"],["1.1","L"],["1.25","XL"]].map(([v, lbl]) =>
        el("button", { type: "button", dataset: { value: v }, text: lbl, onclick: () => applyScale(v) })
      ))
    ]);
    const langRow = el("div", { class: "setting-row", dataset: { setting: "lang" } }, [
      el("div", {}, [ el("div", { class: "setting-row__label", text: t("settings.language") }), el("div", { class: "setting-row__desc", text: t("settings.languageDesc") }) ]),
      el("div", { class: "seg" }, Object.keys(I18N).map((code) =>
        el("button", { type: "button", dataset: { value: code }, text: LANG_LABEL[code] || code, class: code === Lang.code ? "is-active" : "", "aria-pressed": code === Lang.code ? "true" : "false", onclick: () => Lang.set(code) })
      ))
    ]);
    const resetRow = el("div", { class: "setting-row" }, [
      el("div", {}, [ el("div", { class: "setting-row__label", text: t("settings.reset") }), el("div", { class: "setting-row__desc", text: t("settings.resetDesc") }) ]),
      el("button", { class: "btn", type: "button", text: t("common.reset"), onclick: () => {
        ["rafi.theme","rafi.scale","rafi.player","rafi.skipBoot","rafi.me","rafi.ideas","rafi.muted","rafi.lang","rafi.ideas.last","rafi.snake.best"].forEach(store.del);
        toast(t("settings.resetDone")); setTimeout(() => location.reload(), 700);
      }})
    ]);

    body.appendChild(el("div", { class: "stack" }, [
      el("div", { class: "content-head" }, [ el("span", { class: "content-head__ic", "aria-hidden": "true", html: SVG.settings }), el("h2", { text: t("settings.title") }) ]),
      themeRow, scaleRow, langRow, resetRow,
      el("p", { class: "dim", style: "font-size:.74rem", text: t("settings.footer", { os: system.osName, version: system.version }) })
    ]));
    // reflect current state
    applyTheme(document.documentElement.dataset.theme);
    applyScale(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale") || 1);
  }

  /* ======================================================================= *
   *  APP REGISTRY  (icons + start menu are generated from this)
   * ======================================================================= */
  const APP_DEFS = [
    { id: "about",    title: "About Me",      glyph: "👤", build: buildAbout, width: 560, height: 560, startMenu: true },
    { id: "me",       title: "Me.txt",        glyph: "📝", build: buildTextFile("rafi.me", () => (Lang.code === "ar" ? meText_ar : meText)), width: 620, height: 520, startMenu: true },
    { id: "terminal", title: "Terminal",      glyph: "⌨", build: buildTerminal, width: 620, height: 420, flush: true, startMenu: true, onOpen: (win) => { const inp = win.querySelector(".term__input"); if (inp) setTimeout(() => inp.focus(), 30); } },
    { id: "games",    title: "Games",         glyph: "🎮", build: (b) => GamesApp.build(b), onClose: () => GamesApp.onClose(), width: 580, height: 640, startMenu: true },
    { id: "music",    title: "My Love Music", glyph: "🎵", build: (b) => Player.build(b), onClose: () => Player.onClose(), width: 460, height: 620, flush: true, startMenu: true },
    { id: "downloads",title: "Downloads",     glyph: "⬇", build: buildDownloads, width: 520, height: 440, startMenu: true },
    { id: "ideas",    title: "Ideas Box",     glyph: "💡", build: buildIdeas, width: 560, height: 600, startMenu: true },
    { id: "contact",  title: "Contact Me",    glyph: "✉", build: buildContact, width: 520, height: 520, startMenu: true },
    { id: "recycle",  title: "Recycle Bin",   glyph: "🗑", build: buildRecycle, width: 480, height: 420, startMenu: false },
    { id: "settings", title: "Settings",      glyph: "⚙", build: buildSettings, width: 520, height: 500, startMenu: false }
  ];
  APP_DEFS.forEach((def) => WM.define(def.id, def));

  // Desktop icon order (excludes Settings — reachable via Start).
  const DESKTOP_ORDER = ["about", "me", "terminal", "games", "music", "downloads", "ideas", "contact", "recycle"];

  /* ======================================================================= *
   * 7) DESKTOP / TASKBAR / START MENU / POPOVERS / CLOCK
   * ======================================================================= */
  function renderDesktopIcons() {
    const grid = $("#desktop-icons");
    grid.textContent = "";
    let i = 0; // running index → drives the entrance stagger (CSS reads --i)
    DESKTOP_ORDER.forEach((id) => {
      const def = WM.apps[id];
      if (!def) return;
      const title = appTitle(def);
      const btn = el("button", {
        class: "icon", type: "button", "aria-label": t("win.openAria", { title }),
        // Single click/tap opens — discoverable on web and touch. Enter/Space too.
        onclick: () => WM.launch(id),
        onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); WM.launch(id); } }
      }, [
        el("span", { class: "icon__glyph", "aria-hidden": "true", html: SVG[id] || def.glyph }),
        el("span", { class: "icon__label", text: title })
      ]);
      grid.appendChild(el("li", { style: `--i:${i++}` }, [btn]));
    });
  }

  function renderStartMenu() {
    const grid = $("#start-grid");
    grid.textContent = "";
    APP_DEFS.filter((d) => d.startMenu).forEach((def) => {
      const title = appTitle(def);
      grid.appendChild(el("button", {
        class: "start-item", type: "button", role: "menuitem", "aria-label": t("win.openAria", { title }),
        onclick: () => { WM.launch(def.id); closeStartMenu(); }
      }, [
        el("span", { class: "start-item__glyph", "aria-hidden": "true", html: SVG[def.id] || def.glyph }),
        el("span", { class: "start-item__label", text: title })
      ]));
    });
    // header identity
    resilientImg($("#start-avatar"), { src: profile.avatar, seed: profile.shortName, rounded: 20, alt: "" });
    $("#start-name").textContent = profile.shortName;
    $("#start-username").textContent = `@${profile.username}`;
    // footer icons
    setIcon($("#start-settings .foot-ic"), "settings");
    setIcon($("#start-lock .foot-ic"), "power");
  }

  // Start menu open/close
  const startMenu = $("#start-menu");
  const startBtn = $("#start-button");
  function openStartMenu() {
    startMenu.hidden = false;
    startBtn.setAttribute("aria-expanded", "true");
    Sfx.play("menu");
    if (!prefersReducedMotion()) {
      startMenu.classList.remove("is-opening");
      void startMenu.offsetWidth;
      startMenu.classList.add("is-opening");
    }
    const first = startMenu.querySelector("button");
    if (first) first.focus();
  }
  function closeStartMenu() {
    if (startMenu.hidden) return;
    startMenu.hidden = true;
    startBtn.setAttribute("aria-expanded", "false");
  }
  function toggleStartMenu() { startMenu.hidden ? openStartMenu() : closeStartMenu(); }

  // Popovers (scale + theme)
  function togglePopover(pop) {
    const isOpen = !pop.hidden;
    closeAllPopovers();
    if (!isOpen) { pop.hidden = false; const b = pop.querySelector("button"); if (b) b.focus(); }
  }
  function closeAllPopovers() { $("#scale-pop").hidden = true; $("#theme-pop").hidden = true; }

  // Clock
  function tickClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const date = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    const t = $("#tray-time"), d = $("#tray-date");
    if (t) t.textContent = time;
    if (d) d.textContent = date;
    const clockBtn = $("#tray-clock");
    if (clockBtn) clockBtn.setAttribute("aria-label", now.toLocaleString());
  }

  /* ======================================================================= *
   * 8) BOOT + WELCOME + KEYBOARD + WIRING + INIT
   * ======================================================================= */

  function startDesktop() {
    const welcome = $("#welcome");
    const reveal = () => {
      welcome.hidden = true;
      welcome.classList.remove("welcome--out");
      $("#desktop").hidden = false;
      $("#taskbar").hidden = false;
      // Make sure clock/tray reflect state.
      setIcon($("#tray-music-icon"), "note");
      Player._syncTray();
      // Stagger the desktop icons in (CSS uses --i on each <li>).
      if (!prefersReducedMotion()) {
        $("#desktop").classList.remove("is-entering");
        void $("#desktop").offsetWidth;
        $("#desktop").classList.add("is-entering");
      }
      setTimeout(() => Sfx.play("ready"), 380);
      // Focus the first desktop icon for keyboard users.
      const firstIcon = $(".icon");
      if (firstIcon) firstIcon.focus();
    };
    if (prefersReducedMotion()) { reveal(); return; }
    welcome.classList.add("welcome--out");
    let done = false;
    const go = () => { if (done) return; done = true; reveal(); };
    welcome.addEventListener("transitionend", go, { once: true });
    setTimeout(go, 420);
  }

  function showWelcome() {
    const w = $("#welcome");
    w.hidden = false;
    resilientImg($("#welcome-avatar"), { src: profile.avatar, seed: profile.shortName, rounded: 48, alt: "" });
    $("#welcome-name").textContent = profile.shortName;
    $("#welcome-headline").textContent = t("welcome.headline", { name: profile.shortName });
    $("#welcome-tagline").textContent = `“${L(profile, "tagline")}”`;
    $("#welcome-start").focus();
  }

  function runBoot() {
    const boot = $("#boot");
    const log = $("#boot-log");
    const fill = $("#boot-bar-fill");
    const msgs = tArr("boot.messages", system.bootMessages || []);

    let done = false;
    // The Skip button was removed by design — the boot animation now always
    // finishes naturally and then fades into the Welcome screen.
    const finish = () => {
      if (done) return; done = true;
      store.set("rafi.skipBoot", true);
      if (prefersReducedMotion()) { boot.hidden = true; showWelcome(); return; }
      boot.classList.add("boot--out");
      let faded = false;
      const go = () => {
        if (faded) return; faded = true;
        boot.hidden = true; boot.classList.remove("boot--out");
        showWelcome();
      };
      boot.addEventListener("transitionend", go, { once: true });
      setTimeout(go, 620);   // fallback if transitionend never fires
    };

    // Respect reduced motion → jump quickly.
    const skipAnimation = prefersReducedMotion();
    let i = 0;
    const total = msgs.length;
    const step = () => {
      if (done) return;
      if (i < total) {
        const isLast = i === total - 1;
        const line = el("div", isLast ? { class: "ok" } : {});
        line.textContent = msgs[i];
        log.appendChild(line);
        fill.style.width = Math.round(((i + 1) / total) * 100) + "%";
        i++;
        setTimeout(step, skipAnimation ? 60 : 520);
      } else {
        setTimeout(finish, skipAnimation ? 120 : 650);
      }
    };
    step();
  }

  // Global keyboard shortcuts
  function wireKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!startMenu.hidden) { closeStartMenu(); startBtn.focus(); return; }
        if (!$("#scale-pop").hidden || !$("#theme-pop").hidden) { closeAllPopovers(); return; }
        const active = WM.activeId();
        if (active) { WM.close(active); return; }
      }
      // Ctrl/Cmd+Space toggles the Start menu.
      if ((e.ctrlKey || e.metaKey) && e.code === "Space") { e.preventDefault(); toggleStartMenu(); }
    });

    // Click outside closes Start menu / popovers.
    document.addEventListener("mousedown", (e) => {
      if (!startMenu.hidden && !e.target.closest("#start-menu") && !e.target.closest("#start-button")) closeStartMenu();
      if (!e.target.closest(".popover") && !e.target.closest("#tray-scale") && !e.target.closest("#tray-theme")) closeAllPopovers();
    });
  }

  function wireTaskbar() {
    startBtn.addEventListener("click", toggleStartMenu);
    $("#start-settings").addEventListener("click", () => { WM.launch("settings"); closeStartMenu(); });
    $("#start-lock").addEventListener("click", () => {
      closeStartMenu();
      $("#desktop").hidden = true; $("#taskbar").hidden = true;
      showWelcome();
    });

    $("#tray-music").addEventListener("click", (e) => {
      // If the toggle glyph was tapped, just toggle; otherwise open the player.
      if (e.target.closest(".tray__music-toggle")) { Player.toggle(); }
      else WM.launch("music");
    });
    $("#tray-mute").addEventListener("click", () => Sfx.toggle());
    $("#tray-scale").addEventListener("click", () => togglePopover($("#scale-pop")));
    $("#tray-theme").addEventListener("click", () => togglePopover($("#theme-pop")));
    $("#tray-clock").addEventListener("click", () => toast(new Date().toLocaleString()));
    const langBtn = $("#tray-lang");
    if (langBtn) langBtn.addEventListener("click", () => Lang.toggle());

    // Static tray glyphs.
    setIcon($("#tray-scale .tray__ic"), "textSize");
    setIcon($("#tray-theme .tray__ic"), "theme");
    if (langBtn) setIcon($("#tray-lang .tray__ic"), "globe");
    renderLangBtn();

    // Theme popover chip icons (dark→moon, light→sun, contrast→contrast).
    const CHIP_ICON = { dark: "moon", light: "sun", contrast: "contrast" };
    $$("#theme-pop .chip").forEach((c) => setIcon($(".chip__ic", c), CHIP_ICON[c.dataset.theme] || "theme"));

    $$("#scale-pop .chip").forEach((c) => c.addEventListener("click", () => { applyScale(c.dataset.scale); Sfx.play("click"); }));
    $$("#theme-pop .chip").forEach((c) => c.addEventListener("click", () => { applyTheme(c.dataset.theme, true); }));
  }

  function wireWallpaper() {
    // Try to load the configured wallpaper; if it fails, the CSS gradient stays.
    if (!profile.wallpaper) return;
    const img = new Image();
    img.onload = () => {
      document.documentElement.style.setProperty("--wallpaper-image", `url("${profile.wallpaper}")`);
      $("#desktop").classList.add("has-wallpaper");
      $("#welcome").style.backgroundImage = `var(--wallpaper-image), var(--wallpaper)`;
      $("#welcome").style.backgroundSize = "cover";
      $("#welcome").style.backgroundPosition = "center";
    };
    img.onerror = () => {/* keep gradient fallback */};
    img.src = profile.wallpaper;
  }

  /* ---- small UI helpers used across wiring ---- */

  // Brief full-screen shimmer when the theme changes (skipped for reduced motion).
  function flashTheme() {
    if (prefersReducedMotion()) return;
    const f = el("div", { class: "theme-flash", "aria-hidden": "true" });
    document.body.appendChild(f);
    let gone = false; const rm = () => { if (gone) return; gone = true; f.remove(); };
    f.addEventListener("animationend", rm, { once: true });
    setTimeout(rm, 700);
  }

  // Reflect the global mute state on the tray button (icon + a11y + styling).
  function renderMuteBtn() {
    const btn = $("#tray-mute");
    if (!btn) return;
    const muted = Sfx.muted;
    setIcon($(".tray__ic", btn), muted ? "mute" : "volume");
    btn.classList.toggle("is-muted", muted);
    btn.setAttribute("aria-pressed", String(muted));
    btn.setAttribute("aria-label", muted ? t("tray.soundOff") : t("tray.soundOn"));
    btn.title = muted ? t("tray.soundTitleOff") : t("tray.soundTitleOn");
  }

  // Reflect current language on the taskbar language button.
  function renderLangBtn() {
    const btn = $("#tray-lang");
    if (!btn) return;
    const lbl = $(".tray__lang-label", btn);
    if (lbl) lbl.textContent = LANG_LABEL[Lang.code] || Lang.code;
    btn.setAttribute("aria-label", t("lang.toggleAria"));
    btn.title = t("lang.switchTo");
  }

  // Re-translate the *static* chrome (everything outside window bodies). Called
  // by WM.retranslate() on language change and once at startup so a persisted
  // Arabic preference paints correctly. Icons are preserved by re-appending them.
  function retranslateChrome() {
    const setText = (sel, val) => { const n = $(sel); if (n) n.textContent = val; };
    const setAttr = (sel, attr, val) => { const n = $(sel); if (n) n.setAttribute(attr, val); };
    const relabel = (btnSel, iconSel, label) => {
      const b = $(btnSel); if (!b) return;
      const ic = iconSel ? $(iconSel) : null;
      b.textContent = ""; if (ic) b.appendChild(ic);
      b.appendChild(document.createTextNode((ic ? " " : "") + label));
    };

    setText(".skip-link", t("a11y.skip"));

    // Welcome screen
    setText(".welcome__hi", t("welcome.hi"));
    setText("#welcome-headline", t("welcome.headline", { name: profile.shortName }));
    const wt = $("#welcome-tagline"); if (wt) wt.textContent = `“${L(profile, "tagline")}”`;
    relabel("#welcome-start", "#welcome-start-icon", t("welcome.enter"));
    setText(".welcome__hint", t("welcome.hint"));

    // Start menu
    setText(".start-menu__section", t("start.pinned"));
    relabel("#start-settings", "#start-settings .foot-ic", t("start.settings"));
    relabel("#start-lock", "#start-lock .foot-ic", t("start.lock"));

    // Taskbar
    setText(".taskbar__start-label", t("taskbar.start"));
    setAttr("#start-button", "aria-label", t("taskbar.startAria"));

    // Tray buttons (tooltip + aria)
    setAttr("#tray-scale", "aria-label", t("tray.size")); setAttr("#tray-scale", "title", t("tray.size"));
    setAttr("#tray-theme", "aria-label", t("tray.theme")); setAttr("#tray-theme", "title", t("tray.theme"));
    setAttr("#tray-clock", "aria-label", t("tray.clock"));
    renderMuteBtn();

    // Popovers
    setText("#scale-pop .popover__title", t("tray.size"));
    const scaleMap = { "0.9": "size.small", "1": "size.default", "1.1": "size.large", "1.25": "size.larger" };
    $$("#scale-pop .chip").forEach((c) => { const k = scaleMap[c.dataset.scale]; if (k) c.textContent = t(k); });
    setText("#theme-pop .popover__title", t("tray.theme"));
    const themeMap = { dark: "theme.dark", light: "theme.light", contrast: "theme.contrast" };
    $$("#theme-pop .chip").forEach((c) => relabelChip(c, themeMap[c.dataset.theme]));

    Player._syncTray();
    renderLangBtn();
  }
  function relabelChip(c, key) {
    const ic = $(".chip__ic", c);
    c.textContent = ""; if (ic) c.appendChild(ic);
    if (key) c.appendChild(document.createTextNode((ic ? " " : "") + t(key)));
  }

  // A soft, subtle click on generic controls that have no other dedicated cue.
  // (Windows, the player transport, theme and startup all play their own sounds.)
  function wireSounds() {
    const CLICKY = ".btn, .social, .tray__clock, .tbtn:not(.tbtn--play)";
    document.addEventListener("pointerdown", (e) => {
      const t = e.target.closest(CLICKY);
      if (!t || t.classList.contains("welcome__start")) return;
      Sfx.play("click");
    }, true);
  }

  function init() {
    // Sound engine: load persisted mute now; it stays silent until a gesture.
    Sfx.init();

    // Language: restore persisted choice and set <html lang/dir> before first paint.
    Lang.init();

    // Restore theme + scale early (before paint of desktop).
    applyTheme(store.get("rafi.theme", "dark"));
    applyScale(store.get("rafi.scale", 1));

    Player.init();
    try { Player.audio.muted = Sfx.muted; } catch {}   // honor global mute on load
    renderDesktopIcons();
    renderStartMenu();
    wireTaskbar();
    wireKeyboard();
    wireWallpaper();
    wireSounds();

    // Static chrome icons.
    setIcon($("#welcome-start-icon"), "play");
    setIcon($("#tray-music-icon"), "note");
    setIcon($("#tray-music-toggle"), "play");
    renderMuteBtn();

    // Translate all static chrome now (covers a persisted Arabic preference).
    retranslateChrome();

    tickClock();
    setInterval(tickClock, 15000);

    // Unlock the AudioContext on the very first user gesture (autoplay policy).
    const unlockOnce = () => {
      Sfx.unlock();
      window.removeEventListener("pointerdown", unlockOnce);
      window.removeEventListener("keydown", unlockOnce);
    };
    window.addEventListener("pointerdown", unlockOnce);
    window.addEventListener("keydown", unlockOnce);

    // Enter → unlock audio, play the startup cue, reveal the desktop.
    $("#welcome-start").addEventListener("click", () => {
      Sfx.unlock(); Sfx.play("startup"); startDesktop();
    });

    // Re-layout icons if crossing the mobile/desktop breakpoint.
    let wasMobile = isMobile();
    window.addEventListener("resize", () => {
      const nowM = isMobile();
      if (nowM !== wasMobile) { wasMobile = nowM; renderDesktopIcons(); }
    });

    // Boot: if the user skipped before, still show a very short boot for polish
    // unless reduced-motion — then go straight to welcome.
    if (store.get("rafi.skipBoot", false) || prefersReducedMotion()) {
      $("#boot").hidden = true;
      showWelcome();
    } else {
      runBoot();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // Expose a tiny API for the terminal & debugging (no secrets).
  window.RafiOS = { launch: (id) => WM.launch(id), Player, applyTheme, applyScale };
})();
