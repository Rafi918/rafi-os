/* =============================================================================
 *  data.js — RAFI OS
 *  -----------------------------------------------------------------------------
 *  ▓▓▓  THIS IS THE ONLY FILE YOU NEED TO EDIT FOR PERSONAL CONTENT.  ▓▓▓
 *
 *  Everything the interface shows about you lives here. Nothing personal is
 *  hard-coded elsewhere. Edit the values below, save, and refresh the page.
 *
 *  Rules of thumb:
 *   • A missing image never breaks the site — a generated fallback is shown.
 *   • An empty link ("") hides that social button automatically.
 *   • Adding a song = add ONE object to `playlist` + drop the files in /assets.
 *
 *  BILINGUAL CONTENT (English / العربية):
 *   • INTERFACE strings (buttons, labels, messages) live in translations.js.
 *   • PERSONAL prose lives here. For anything you want translated, add a matching
 *     `*_ar` field (e.g. tagline → tagline_ar). If an `*_ar` field is missing or
 *     empty, the English value is shown in Arabic mode too — nothing breaks.
 * ========================================================================== */

/* -----------------------------------------------------------------------------
 * 1) PROFILE — who you are
 * -------------------------------------------------------------------------- */
const profile = {
  displayName: "𝙳𝙴𝚅 ⌯ 𝚁𝙰𝙵𝙸",
  shortName: "Rafi",
  username: "rafiraad",
  age: "15 years old",
  age_ar: "١٥ سنة",
  // Your tagline — short, memorable, yours. Nods to the circuit-board portrait:
  // the code isn't just something you write, it's what you're made of.
  tagline: "Some people write code — I'm built from it.",
  tagline_ar: "بعض الناس يكتبون الشيفرة — أمّا أنا فمصنوع منها.",
  location: "IRAQ / BAGHDAD",
  location_ar: "العراق / بغداد",
  uid: "1,155,713",
  bio: "15-year-old developer, creator, and curious mind from Baghdad — building interfaces that feel as good as they look.",
  bio_ar: "مطوّر ومبدع فضولي عمره ١٥ عامًا من بغداد — أبني واجهات تُحسّ بجودتها كما تُرى.",
  avatar: "assets/avatar.webp",   // your circuit-board portrait (PNG fallback: assets/avatar.png)
  wallpaper: "",                  // "" = use the built-in animated circuit background (recommended)
  email: "rafe.rafeey@gmail.com",
  links: {
    youtube: "https://www.youtube.com/@secrettechhub",
    x: "https://x.com/rafi7136",
    telegram: "https://t.me/x_hxb",
    github: "https://github.com/Rafi918",
    steam: "https://steamcommunity.com/id/76561199172357217",
    discord: "https://discord.com/users/1282995808270155840"
  }
};

/* -----------------------------------------------------------------------------
 * 2) INTERESTS — shown as chips inside the "About Me" window.
 *    `interests_ar` is the Arabic parallel list (same order). If it's empty or a
 *    different length, the English list is used in Arabic mode too.
 * -------------------------------------------------------------------------- */
const interests = [
  "Coding", "UI / UX", "Music", "Gaming", "Content creation",
  "Tech tinkering", "Design systems", "Open source"
];
const interests_ar = [
  "البرمجة", "تصميم الواجهات", "الموسيقى", "الألعاب", "صناعة المحتوى",
  "العبث بالتقنية", "أنظمة التصميم", "المصادر المفتوحة"
];

/* -----------------------------------------------------------------------------
 * 3) Me.txt — a real personal note (plain text, editable, no lorem ipsum)
 *    Written as a template literal so line breaks are preserved exactly.
 * -------------------------------------------------------------------------- */
const meText = `# Me.txt
--------------------------------------------------

Hey, I'm ${profile.shortName}.

I build things for the web, mess around with design, and chase whatever
idea has hijacked my brain that week. Most days that's code; some days it's
a playlist, a game, or a half-finished experiment I swear I'll come back to.

What I care about:
  • Making interfaces that feel good to touch, not just look at.
  • Learning in public and sharing what actually worked.
  • Keeping things simple enough that future-me isn't cursing past-me.

Currently:
  • Age ......... ${profile.age}
  • Location .... ${profile.location}
  • Mood ........ curious, caffeinated, building.
  • Motto ....... "${profile.tagline}"

If you're reading this, thanks for poking around my little OS. Open the
Terminal and type "help" — there's more to find.

— ${profile.shortName}
`;

const meText_ar = `# Me.txt
--------------------------------------------------

أهلًا، أنا ${profile.shortName}.

أبني أشياءَ للويب، وأعبث بالتصميم، وأطارد أيّ فكرة اختطفت عقلي هذا الأسبوع.
غالبًا تكون شيفرةً؛ وأحيانًا قائمة تشغيل، أو لعبة، أو تجربة نصف منتهية
أعِد نفسي دائمًا بالعودة إليها.

ما يهمّني:
  • صناعة واجهات ممتعة للّمس، لا للنظر فقط.
  • التعلّم علنًا ومشاركة ما نجح فعلًا.
  • إبقاء الأمور بسيطة كي لا يلعن أنا-المستقبلُ أنا-الماضي.

حاليًا:
  • العمر ....... ${profile.age_ar}
  • الموقع ...... ${profile.location_ar}
  • المزاج ...... فضولي، مشحون بالقهوة، وأبني.
  • الشعار ...... "${profile.tagline_ar}"

إن كنت تقرأ هذا، فشكرًا لتجوّلك في نظامي الصغير. افتح الطرفية واكتب
"help" — هناك المزيد لتكتشفه.

— ${profile.shortName}
`;

/* -----------------------------------------------------------------------------
 * 4) ideas.txt → IDEAS BOX
 *    The Ideas window is now a PRIVATE submission form (see app.js → buildIdeas
 *    and the ideasBackend config in section 9b). It intentionally starts EMPTY —
 *    there is no sample/placeholder idea content to display.
 * -------------------------------------------------------------------------- */
const ideasText = ""; // intentionally empty — the Ideas Box is a form, not a text file.

/* -----------------------------------------------------------------------------
 * 5) DOWNLOADS — files/resources to offer. Editable placeholders.
 *    `href` uses relative paths. If a file is missing the link still renders
 *    but is flagged as "not available yet".
 * -------------------------------------------------------------------------- */
const downloads = [
  {
    name: "Résumé / CV",
    desc: "One-page summary (add your own PDF).",
    href: "assets/downloads/resume.pdf",
    size: "PDF",
    available: false
  },
  {
    name: "Wallpaper pack",
    desc: "Desktop wallpapers used in Rafi OS.",
    href: "assets/downloads/wallpapers.zip",
    size: "ZIP",
    available: false
  },
  {
    name: "Press kit",
    desc: "Avatar, logos and bio for collaborations.",
    href: "assets/downloads/press-kit.zip",
    size: "ZIP",
    available: false
  }
];

/* -----------------------------------------------------------------------------
 * 6) GAMES — the two built-in mini-games (Snake, Tic-Tac-Toe) are implemented
 *    in app.js and need no data here. This array is for OPTIONAL extra games you
 *    want to link (external URL or same-tab experiment); leave it [] otherwise.
 *    See README → "Adding or replacing games".
 * -------------------------------------------------------------------------- */
const games = [
  // Example (remove the leading "//" and edit to enable an extra tab/link):
  // { name: "Reaction Test", desc: "How fast are you?", href: "https://example.com", emoji: "⚡" }
];

/* -----------------------------------------------------------------------------
 * 7) RECYCLE BIN — playful, harmless sample items. Nothing is really deleted.
 * -------------------------------------------------------------------------- */
const recycleBin = [
  { name: "old_portfolio_v1.html", note: "we don't talk about this one" },
  { name: "regret.mp3", note: "a song I wrote at 3am" },
  { name: "todo_list_2019.txt", note: "still relevant, somehow" },
  { name: "screenshot_final_FINAL_v2.png", note: "the naming says it all" },
  { name: "bug.js", note: "it's a feature now" }
];

/* -----------------------------------------------------------------------------
 * 8) PLAYLIST — "My Love Music".
 *    These map to the real audio files in assets/music/. Titles & artists were
 *    verified from each file's source, so nothing here is mislabeled.
 *    Add a track = add one object here + drop the audio/cover in /assets.
 *
 *    ⚠️ LICENSING: these are commercial recordings, fine for a personal/local
 *    build. Before publishing this on a PUBLIC site, replace them with music you
 *    own or are licensed to distribute (see README).
 *    Missing files show a friendly message and never break the player.
 * -------------------------------------------------------------------------- */
const playlist = [
  {
    title: "Broken Angel",
    artist: "Arash feat. Helena",
    src: "assets/music/broken-angel.m4a",
    cover: "assets/covers/broken-angel.webp"
  },
  {
    title: "ONE DAY",
    artist: "Arash feat. Helena",
    src: "assets/music/one-day.m4a",
    cover: "assets/covers/one-day.webp"
  },
  {
    title: "Skyfall",
    artist: "Adele",
    src: "assets/music/skyfall.m4a",
    cover: "assets/covers/skyfall.webp"
  },
  {
    title: "Set Fire to the Rain",
    artist: "Adele",
    src: "assets/music/set-fire-to-the-rain.m4a",
    cover: "assets/covers/set-fire-to-the-rain.webp"
  },
  {
    title: "Cinnamon Girl",
    artist: "Lana Del Rey",
    src: "assets/music/cinnamon-girl.m4a",
    cover: "assets/covers/cinnamon-girl.webp"
  },
  {
    title: "I'm Still Here",
    artist: "Sia",
    src: "assets/music/im-still-here.m4a",
    cover: "assets/covers/im-still-here.webp"
  },
  {
    title: "Somewhere Only We Know",
    artist: "Keane",
    src: "assets/music/somewhere-only-we-know.m4a",
    cover: "assets/covers/somewhere-only-we-know.webp"
  },
  {
    title: "Ya Helou / يا حلو",
    artist: "Adam",
    src: "assets/music/ya-helou-adam.mp3",
    cover: "assets/covers/ya-helou-adam.webp"
  },
  {
    title: "Ya Helou — The Voice Kids / آه يا حلو",
    artist: "Adam Zain Al-Din",
    src: "assets/music/ya-helou-voicekids.mp3",
    cover: "assets/covers/ya-helou-voicekids.webp"
  },
  {
    title: "Aw'edak / اوعدك",
    artist: "Ayed / عايض",
    src: "assets/music/awedak.mp3",
    cover: "assets/covers/awedak.webp"
  },
  {
    title: "Qalb Ala Al-Waraqa / قلب على الورقة نرسم",
    artist: "Mohammed Abdul Jabbar & Mustafa Al-Rubaie",
    src: "assets/music/qalb-ala-alwaraqa.m4a",
    cover: "assets/covers/qalb-ala-alwaraqa.webp"
  },
  {
    title: "Ala Bab El Seema / على باب السيما",
    artist: "Amir Eid / أمير عيد",
    src: "assets/music/ala-bab-el-seema.m4a",
    cover: "assets/covers/ala-bab-el-seema.webp"
  },
  {
    title: "The Night King (Season 8 Soundtrack)",
    artist: "Ramin Djawadi — Game of Thrones",
    src: "assets/music/got-s8-the-night-king.mp3",
    cover: "assets/covers/got-s8-the-night-king.webp"
  },
  {
    title: "Unsullied vs Army of the Dead (Scene)",
    artist: "Game of Thrones · S8E3",
    src: "assets/music/got-s8e3-unsullied-scene.mp3",
    cover: "assets/covers/got-s8e3-unsullied-scene.webp"
  }
];

/* -----------------------------------------------------------------------------
 * 9) SYSTEM — boot sequence text & small labels.
 *    NOTE: boot messages are ALSO defined (translated) in translations.js under
 *    "boot.messages". The app prefers the translated list; the array below is the
 *    English fallback used only if translations.js fails to load.
 * -------------------------------------------------------------------------- */
const system = {
  osName: "Rafi OS",
  version: "1.0",
  welcomeHeadline: `Welcome to ${profile.shortName}'s World`,
  bootMessages: [
    "Powering on Rafi OS...",
    "Etching copper traces...",
    "Loading personal interface...",
    "Syncing style modules...",
    "Starting desktop services...",
    "System ready ✓"
  ],
  language: "EN"
};

/* -----------------------------------------------------------------------------
 * 9b) IDEAS BACKEND — where private idea submissions are sent.
 * -----------------------------------------------------------------------------
 *  The Ideas Box saves each submission to Cloud Firestore (Firebase) via the
 *  Firebase browser SDK — see firebase-ideas.js (loaded as type="module"). This
 *  object holds only the *client-side* validation knobs; the real Firebase
 *  config lives in firebase-ideas.js. Submissions are PRIVATE: visitors can only
 *  CREATE a document in the `ideas` collection; they cannot read, list, edit, or
 *  delete anything. You (the owner) read them in the Firebase console. See
 *  README → "Ideas Box backend" for the exact Firestore security rules.
 *
 *  ┌──────────────────────────────────────────────────────────────────────────┐
 *  │  SECURITY — READ THIS.                                                     │
 *  │  • The Firebase Web config in firebase-ideas.js (apiKey, appId, …) is a    │
 *  │    PUBLIC client identifier — Google designs it to ship in frontend code.  │
 *  │    It is NOT a secret and grants no privileged access on its own.          │
 *  │  • What protects the data is Firestore SECURITY RULES (server side): only  │
 *  │    CREATE is allowed, with field + length validation; read/update/delete   │
 *  │    are denied to everyone.                                                 │
 *  │  • NEVER put the Firebase Admin SDK, a service-account JSON, a private key, │
 *  │    a password, or any server credential in this file or the frontend.      │
 *  └──────────────────────────────────────────────────────────────────────────┘
 */
const ideasBackend = {
  provider: "firebase",     // informational; the app talks to Cloud Firestore via firebase-ideas.js
  collection: "ideas",      // the Firestore collection submissions are added to

  // Validation / anti-abuse (client-side; the Firestore security rules are the
  // real gate and enforce the same limits — see README).
  nameMax: 80,              // longest allowed name  (name is required, 1–80 chars)
  ideaMax: 2000,            // longest allowed idea  (idea is required, 1–2000 chars)
  cooldownSeconds: 60       // minimum gap between two submissions from this browser (one minute)
};

/* -----------------------------------------------------------------------------
 * Expose to the app. (No build step — these are plain globals; the assignment
 * below just makes the dependency explicit and keeps linters happy.)
 * -------------------------------------------------------------------------- */
window.RAFI_DATA = {
  profile, interests, interests_ar, meText, meText_ar, ideasText,
  downloads, games, recycleBin, playlist, system, ideasBackend
};
