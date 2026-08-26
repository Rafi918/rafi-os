# Rafi OS — a personal desktop on the web

A modern, **Windows-inspired personal portfolio** that behaves like a tiny operating
system: a boot sequence, a desktop with draggable windows, a taskbar, a Start menu,
a simulated terminal, and a full‑track music player.

It is **100% static** — plain HTML, CSS and vanilla JavaScript. No build step, no
framework, no bundler. Drop it on GitHub Pages and you're done. The only external dependency
is the **Firebase SDK** used by the private **Ideas Box** (see below); everything else runs
entirely in the browser.

- **Responsive** — a real desktop environment on large screens; full‑screen,
  touch‑friendly sheets on phones (down to 320 px).
- **Accessible** — semantic HTML, keyboard navigation, focus states, `aria` roles,
  live status announcements, and `prefers-reduced-motion` support.
- **Resilient** — missing images become generated art, missing audio shows a friendly
  message, and empty links hide themselves. Nothing renders as a broken icon.
- **Themeable** — Modern Dark, Modern Light, and High Contrast, plus a UI‑size control.
- **Bilingual** — full **English / العربية** interface with instant switching and proper
  right‑to‑left (RTL) layout. No page reload; open windows keep their place.
- **Playable** — two original, dependency‑free mini‑games (Snake and Tic‑Tac‑Toe) with
  keyboard *and* touch controls.
- **A private Ideas Box** — a submission form that saves ideas to your own **Cloud
  Firestore** database. Visitors can only submit; only you can read them.

> The design is an **original** interpretation of a modern desktop OS. It intentionally
> avoids Microsoft branding, logos, and proprietary assets.

---

## File tree

```
/
├── index.html          # App shell + all meta/SEO/OpenGraph tags
├── styles.css          # Design tokens, 3 themes, full responsive rules
├── app.js              # Window manager, terminal, music player, games, taskbar, boot
├── data.js             # ← EDIT THIS: all personal content + Ideas validation config
├── translations.js     # ← EDIT THIS: every interface string, in English + Arabic
├── firebase-ideas.js   # Cloud Firestore bridge for the Ideas Box (Firebase Web config)
├── firestore.rules     # Firestore security rules — create-only, no read/edit/delete
├── favicon.svg         # Original SVG icon (no external requests)
├── .nojekyll           # Tells GitHub Pages to serve files as-is
├── README.md
└── assets/
    ├── avatar.webp     # (optional) your photo — falls back to generated art
    ├── wallpaper.webp  # (optional) desktop wallpaper — falls back to a gradient
    ├── og.png          # (optional) social preview image, ~1200×630
    ├── icons/          # (optional) custom icons
    ├── covers/         # album/cover art for the music player
    ├── music/          # your licensed audio files
    └── downloads/      # files offered in the Downloads window
```

Everything uses **relative paths**, so the site works at a root domain
(`https://you.github.io/`) *and* inside a repo subpath (`https://you.github.io/rafi-os/`).

---

## Quick start — customize

All personal content is in **`data.js`**, clearly sectioned. Nothing personal is
hard‑coded anywhere else.

### 1. Name, avatar, wallpaper, bio, links
Edit the `profile` object at the top of `data.js`:

```js
const profile = {
  displayName: "𝙳𝙴𝚅 ⌯ 𝚁𝙰𝙵𝙸",
  shortName:   "Rafi",
  username:    "rafiraad",
  tagline:     "My energy speaks louder than my words",
  location:    "IRAQ / BAGHDAD",
  uid:         "1,155,713",         // shown with a "local" badge — not a live metric
  bio:         "Developer, creator, and curious mind.",
  avatar:      "assets/avatar.webp",     // add this file, or a generated avatar is used
  wallpaper:   "assets/wallpaper.webp",  // add this file, or a gradient is used
  email:       "you@example.com",
  links: {
    youtube:  "https://…",   // leave "" to hide a social button
    x:        "https://…",
    telegram: "https://…",
    github:   "https://…",
    steam:    "https://…",
    discord:  "https://…"
  }
};
```

- **Avatar / wallpaper**: add real files at those paths for the best look. If a file is
  missing, the site shows a generated fallback automatically — it never breaks.
- **Empty link (`""`)**: that social button is hidden gracefully.
- Other windows are just as editable: `interests`, `meText` (Me.txt), `ideasText`
  (ideas.txt), `downloads`, `games`, `recycleBin`, and the boot `system` messages.

### 2. Add or remove music tracks
Adding a full‑length track requires **one object** in the `playlist` array plus the
files — no code changes:

```js
const playlist = [
  {
    title:  "Song title",
    artist: "Artist name",
    src:    "assets/music/song.mp3",     // your licensed audio
    cover:  "assets/covers/song.webp"    // cover art (optional; fallback generated)
  },
  // …add more here
];
```

Then drop `song.mp3` into `assets/music/` and `song.webp` into `assets/covers/`.
The player supports **complete full‑length files** — it does not clip or preview.
If an audio file is missing, that track shows **“Audio file not found …”** and the rest
of the site keeps working.

### 3. Add licensed cover images
Put cover art in `assets/covers/` and reference it via the track's `cover` field.
Square images (e.g. 500×500 `.webp`/`.jpg`/`.png`) look best. Missing covers are
replaced by generated gradient art with the track's initials.

### 4. Downloads
Edit the `downloads` array in `data.js`. Set `available: true` and drop the real file
into `assets/downloads/` to turn a “Coming soon” badge into a working download button.

### 5. Change an app or window icon
Icons are **inline SVG line-art**, not emoji or an icon font, so they render identically
on every device and recolor themselves for each theme. They live in two maps near the top
of `app.js`:

- **`SVG`** — keyed by app id (`about`, `me`, `terminal`, `games`, `music`, `downloads`,
  `ideas`, `contact`, `recycle`, `settings`) plus the player/tray glyphs (`play`, `pause`,
  `prev`, `next`, `shuffle`, `repeat`, `repeatOne`, `volume`, `mute`, `note`, `spark`).
- **`SOCIAL_SVG`** — the YouTube / X / Telegram / GitHub / Steam / Discord marks.

To swap one, replace its SVG string. Use a `0 0 24 24` viewBox and keep
`width="1em" height="1em"` with `stroke="currentColor"` (or `fill="currentColor"`) — that
is what lets the icon inherit the text color in all three themes and scale with the
interface-size control. No re-wiring is needed.

### 6. Add or replace mini‑games
Two original games — **Snake** and **Tic‑Tac‑Toe** — are built in and need no setup. They
live in `app.js` (the `GamesApp` module) and use only the `<canvas>` and DOM — **no
external libraries**. Each has start/restart, a live score or status, keyboard controls on
desktop, on‑screen touch controls on mobile, pause, and game‑over feedback.

You have two ways to extend the Games window:

- **Link an extra game** (no code): add an object to the `games` array in `data.js`. It
  appears as an extra tab that opens your game (a new same‑origin page or an external URL):

  ```js
  const games = [
    { name: "Reaction Test", desc: "How fast are you?", href: "games/reaction.html", emoji: "⚡" }
  ];
  ```

  Keep `href` a **relative** path for your own pages, or a full `https://` URL for an
  external one. Leave the array `[]` to show only the two built‑ins.

- **Replace / add a built‑in game** (code): in `app.js`, copy the pattern of
  `mountTicTacToe(mount)` — a function that builds its UI into the given `mount` element and
  **returns a teardown function** that stops any timers/loops and removes listeners. Register
  it in `GamesApp` next to `snake`/`ttt` (add a tab entry + a `case` in `selectTab`). The
  teardown is what lets language switching and window‑closing stop a running game cleanly, so
  always return one. Add any new labels to `translations.js` under `games.*`.

### 7. Edit or translate interface text
Every **interface** string (buttons, menus, messages, game labels, the terminal, the Ideas
form) lives in **`translations.js`** as a flat dictionary with two locales:

```js
window.RAFI_I18N = {
  en: { "welcome.enter": "Enter", "games.snake.title": "Snake", /* … */ },
  ar: { "welcome.enter": "ابدأ",  "games.snake.title": "الأفعى", /* … */ }
};
```

- To change wording, edit the value for that key in **both** `en` and `ar`.
- To add a string, add the **same key** to both locales, then reference it in `app.js` with
  `t("your.key")`. Placeholders use braces and are filled in order, e.g.
  `t("ideas.counter", { n: 12, max: 1000 })` against `"{n} / {max}"`.
- If an Arabic key is missing, the **English** value is shown automatically — nothing breaks.
- **Personal prose** (your bio, Me.txt, tagline) is *not* here — it stays in `data.js`. To
  translate those, add a matching `*_ar` field there (e.g. `tagline_ar`).

The visible **language button** sits in the taskbar tray (globe icon) and in **Settings →
Language**; the choice is saved to `localStorage` and applied instantly by flipping
`<html lang>` / `dir` and re‑rendering open windows in place.

### 8. Ideas Box backend (private submissions — Cloud Firestore)
The Ideas Box is a **private submission form** wired to **Cloud Firestore** (Firebase). Each
submission is saved to the `ideas` collection over HTTPS using the Firebase **browser SDK**
(loaded as an ES module — see `firebase-ideas.js`). Submissions are **create‑only**: visitors
can add an idea but **cannot read, list, edit, or delete** any — only you can, in the Firebase
console.

Three fields are written per submission, and nothing else:

| field       | type              | value                                            |
|-------------|-------------------|--------------------------------------------------|
| `name`      | string, 1–80      | the visitor's name (trimmed)                     |
| `idea`      | string, 1–2000    | the idea/message (trimmed)                        |
| `createdAt` | timestamp         | `serverTimestamp()` — set by Firestore, not the client |

**a) Create the project + database.** In the [Firebase console](https://console.firebase.google.com/):
create a project → **Build → Firestore Database → Create database** → **Production mode** →
pick a region. The `ideas` collection is created automatically on the first submission — you
don't need to add it by hand. (Firebase **Analytics is not used** by this site, so you can
skip Google Analytics when creating the project.)

**b) Lock it down with security rules (this is what keeps it private).** In **Firestore
Database → Rules**, paste the contents of [`firestore.rules`](./firestore.rules) and
**Publish** (or run `firebase deploy --only firestore:rules`). The rules:

```
match /ideas/{docId} {
  allow create: if
    request.resource.data.keys().hasOnly(['name', 'idea', 'createdAt']) &&
    request.resource.data.name is string &&
    request.resource.data.name.size() >= 1  && request.resource.data.name.size() <= 80  &&
    request.resource.data.idea is string &&
    request.resource.data.idea.size() >= 1  && request.resource.data.idea.size() <= 2000 &&
    request.resource.data.createdAt == request.time;   // forces serverTimestamp()
  allow read, update, delete: if false;                // nobody can read/list/edit/delete
}
```

Because there is **no** `read`/`list` allowance, the public config literally cannot read the
collection. You read submissions in the **Firebase console → Firestore Database → Data**
(that view is authenticated as you and is not governed by these rules).

**c) Point the site at your project.** The Firebase Web config lives in **`firebase-ideas.js`**
(the only file that talks to Firebase). Replace the `firebaseConfig` object with the one from
your project (**Project settings → General → Your apps → Web app → SDK setup: Config**):

```js
const firebaseConfig = {
  apiKey: "…", authDomain: "…", projectId: "…",
  storageBucket: "…", messagingSenderId: "…", appId: "…"
};
```

The client‑side validation limits (name 80, idea 2000, 60‑second cooldown) live in `data.js`
→ `ideasBackend`; keep them in sync with the rules above.

> 🔐 **The Firebase Web config is meant to be public** — Google designs the `apiKey`/`appId`
> to ship in frontend code. It is **not** a secret and grants no privileged access on its own;
> the **security rules** are what protect the data.
> **NEVER put the Firebase Admin SDK, a service‑account JSON, a private key, a password, or any
> server credential** in `firebase-ideas.js`, `data.js`, or anywhere in the frontend. None are
> needed. If something is labeled *service account*, *private key*, or *secret*, it does not
> belong here.

> 🌐 **One deliberate exception to "fully self‑contained":** `firebase-ideas.js` imports the
> Firebase SDK from `https://www.gstatic.com/firebasejs/…`. This is the only external resource
> the site loads, and it is required to use Cloud Firestore from a static page. Everything else
> still runs with zero third‑party requests.

**d) Anti‑spam.** The form validates lengths, requires a name, enforces a per‑browser
**one‑minute cooldown**, and includes a hidden **honeypot** field that silently drops bot
submissions. The security rules reject any document that isn't exactly the three expected
fields. For stronger protection you can add **App Check** (reCAPTCHA) in the console — optional.

**e) Get notified by email (no secrets in the frontend).** Do **not** put SMTP or email API
keys in the site. Keep them server‑side: add a **Cloud Function** with a Firestore
`onDocumentCreated('ideas/{id}')` trigger that emails you — the email provider's key lives in
the function's environment/secrets, **never** in the browser. Or simply check the Firestore
**Data** tab in the console yourself.



---

## Test locally

Because paths are relative, any static server works. From the project folder:

```bash
# Python 3
python3 -m http.server 8000
# then open http://localhost:8000

# …or Node
npx serve .
```

Open the browser and check:

- **Shell**: boot → Skip, Welcome → Start, opening every window, minimize / maximize /
  restore / close, the taskbar and Start menu, theme switching, and the music player
  (add an MP3 to hear full playback).
- **Language (EN/AR/RTL)**: click the globe in the tray (or **Settings → Language**).
  The whole interface should switch instantly with **no reload**, the page should flip to
  right‑to‑left in Arabic (`<html dir="rtl">`), and **already‑open windows should keep their
  position** and re‑render in the new language. Numbers, the terminal, and the game board
  stay left‑to‑right on purpose. Reload — your choice should persist.
- **Games**: open **Games**, play Snake with the arrow keys/WASD and the on‑screen D‑pad,
  pause and restart, then switch to Tic‑Tac‑Toe (vs CPU and 2‑player). Confirm a running
  game stops when you close the window or switch language.
- **Ideas Box validation**: try an empty name (blocked), an empty idea (blocked), a name over
  80 chars or an idea over 2000 chars (blocked with a message), then a valid submission — watch
  the loading → success states and confirm a new document appears in the Firebase console under
  Firestore → Data. Send a second idea immediately to hit the one‑minute cooldown. (If Firebase
  can't be reached, you get a friendly "couldn't send" message and nothing is lost.)
- **Mobile**: resize down to ~320 px (or use device emulation). Windows become full‑screen
  sheets, the games show touch controls, and the language button collapses to just its icon.

> Tip: opening `index.html` directly with `file://` mostly works, but a local server
> avoids browser restrictions on some features. Prefer the server.

---

## Deploy to GitHub Pages (zero‑build)

This is a static site, so **no Actions workflow is needed**.

1. Create a repository and push these files so that **`index.html` is at the repo root**.
2. On GitHub: **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Select branch **`main`** and folder **`/ (root)`**, then **Save**.
5. Wait ~1 minute. Your site is at `https://<username>.github.io/<repo>/`.

The included **`.nojekyll`** file ensures GitHub serves everything as‑is (and doesn't
ignore files/folders that start with an underscore).

> ⚠️ **GitHub Pages is static hosting — it cannot store submissions privately by itself.**
> It only serves files; it has no database and no server code, and everything you deploy is
> world‑readable. That is exactly why the Ideas Box saves submissions to **Cloud Firestore**
> (Firebase, see “Ideas Box backend” above) instead of trying to save them in the repo. Never
> attempt to “store” private submissions in a file on Pages, and never place the Firebase Admin
> SDK, a service‑account JSON, or any secret in these files to work around it — anything
> committed here is public.

### Social preview (optional)
For rich link previews, add `assets/og.png` (~1200×630) and, for perfect results,
set **absolute** URLs in `index.html`:

```html
<meta property="og:url"   content="https://yourname.github.io/rafi-os/" />
<meta property="og:image" content="https://yourname.github.io/rafi-os/assets/og.png" />
```

---

## Troubleshooting

**Blank page or broken styles/images on a repo subpath** (e.g. `/rafi-os/`):
This project already uses **relative paths** (`styles.css`, `app.js`, `assets/…`), which
work in a subpath. If you edited a path, make sure it does **not** start with `/`
(a leading slash points at the domain root and breaks subpath hosting). Use
`assets/music/song.mp3`, not `/assets/music/song.mp3`.

**A song won't play:** confirm the file exists at the exact `src` path (case‑sensitive on
GitHub Pages) and is a browser‑playable format (MP3/AAC/OGG). The player will tell you
“Audio file not found” if the path is wrong.

**Nothing happens on the desktop:** open the browser console. If `data.js` has a syntax
error (e.g. a smart quote pasted into a key), the app can't read your content — fix the
reported line.

**Reset everything:** open **Start → Settings → Reset Rafi OS** (clears saved theme,
language, interface size, notes, player state, and the “skip boot” flag from
`localStorage`).

---

## Accessibility & privacy notes

- Full keyboard support: `Tab` to move, `Enter`/`Space` to activate, `Esc` closes the
  active window / menu, `Ctrl`/`Cmd`+`Space` toggles Start. Windows are `role="dialog"`.
- Respects `prefers-reduced-motion` (animations are minimized and boot is shortened).
- No analytics (Firebase Analytics is **not** used), no external fonts, no icon CDNs, no
  tracking, no cookies. Your **local** preferences (theme, size, notes, language, player
  position) live only in `localStorage` and never leave your device.
- The site loads the **Firebase SDK** from `gstatic.com` (needed for the Ideas Box) on page
  load. The **one** time it sends data to a server is when a visitor submits the **Ideas
  Box**: that write goes to **your** Cloud Firestore over HTTPS and carries exactly the three
  fields `name`, `idea`, and a server‑set `createdAt` — nothing else, and nothing in the
  background. The form never claims to encrypt or privately store anything it doesn't: privacy
  comes from the **create‑only security rules** on your `ideas` collection (visitors can't read
  it), with HTTPS protecting the data in transit — stated plainly in the form's own privacy
  note.
- Any counter or ID shown (e.g. UID) is **decorative/local** and labelled as such — the
  site never claims a live metric it doesn't have.

---

Made as a static, framework‑free personal desktop. Edit `data.js`, add your media, and
make it yours.
