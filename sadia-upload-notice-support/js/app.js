/* ============================================================================
   Notes Portal — plain HTML/CSS/JS frontend (NO React, NO framework,
   NO build step, NO backend).
   Vanilla-JS port of react-frontend-connected/src/app.js. All data lives
   in localStorage (key notesPortalPlainV1); the session (logged-in user
   id) lives in notesPortalPlainSessionV1. Seed data comes from js/data.js
   (window.PLAIN). Demo passwords are plain text in the seed ONLY for this
   standalone demo — the real backend stores bcrypt hashes, never
   plain-text passwords.
   ========================================================================== */
"use strict";

/* ---------------- Constants & seed ---------------- */


/* ---------------- This mini-app: Sadia Afrin Ifti's pages only ----------------
   Only Sadia Afrin Ifti's assigned pages are in this file (Upload, Notice Board, Support), plus
   the shared shell (header, footer, login, localStorage data, styles,
   images). Buttons that would lead to another member's page are
   removed by stripOtherViews() in render() — or shown as plain text
   where they label content (a note title, a row title, an author name).
   ------------------------------------------------------------------------ */
var MEMBER_NAME = "Sadia Afrin Ifti";
var MEMBER_PAGES = "Upload, Notice Board, Support";
var MEMBER_VIEWS = ["upload", "notices", "support"];
var MEMBER_HOME = "upload";
var SHELL_VIEWS = ["login", "verify"];
var MEMBER_NAV = [{ view: "upload", label: "Upload" }, { view: "notices", label: "Notice Board" }, { view: "support", label: "Support" }];
function stripOtherViews(html){
  var allowed = {};
  MEMBER_VIEWS.concat(SHELL_VIEWS).forEach(function(v){ allowed[v] = true; });
  function fix(m, view, inner){
    if(allowed[view]) return m;
    var cls = /class="([^"]*)"/.exec(m);
    var c = cls ? cls[1] : "";
    if(c.indexOf("row-main") >= 0 || c.indexOf("uploader") >= 0 || c.indexOf("author-link") >= 0 ||
       inner.indexOf("<h3") >= 0 || inner.indexOf("<img") >= 0){
      return '<span' + (c ? ' class="' + c + '"' : "") + ">" + inner + "</span>";
    }
    return "";
  }
  html = html.replace(/<button\b[^>]*\bdata-view="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g, fix);
  if(!allowed["notices"]){
    html = html.replace(/<button\b[^>]*\bdata-act="notif-notice"[^>]*>([\s\S]*?)<\/button>/g, "");
  }
  return html;
}
function notInAppHTML(){
  var btns = MEMBER_NAV.map(function(n){
    return '<button class="btn-ghost" data-act="go" data-view="' + n.view + '">' + esc(n.label) + "</button>";
  }).join("");
  return '<div class="view"><div class="wrap"><div class="page">' +
    emptyStateHTML("Not part of this mini-app", "This mini-app contains only " + MEMBER_NAME + "'s pages: " + MEMBER_PAGES + ". The page you asked for belongs to another team member.", btns) +
    "</div></div></div>";
}

var DB_KEY = "notesPortalPlainV1";

var SESSION_KEY = "notesPortalPlainSessionV1";

var THEME_KEY = "notesPortalThemeV1";

var UPLOAD_FILE_MAX = 10 * 1024 * 1024;      /* 10 MB */

var UPLOAD_VIEW_MAX = 5 * 1024 * 1024;       /* PDF/image stored as data URL up to 5 MB */

var PHOTO_MAX = 8 * 1024 * 1024;             /* 8 MB profile photo */

var IMAGE_TYPES = ["png", "jpg", "jpeg", "gif", "webp"];

var PAGE_STEP = 9;

var SUPPORT_TYPES = ["Login/Account", "Upload", "Download/File", "Note approval", "Report", "Other"];

var REDUCED_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

/* ---------------- Helpers ---------------- */

function esc(v){
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function semNum(s){ var m = /(\d+)/.exec(String(s || "")); return m ? Number(m[1]) : 0; }

function semStr(n){ return "Semester " + n; }
/* Space-insensitive compare only: a typed "CSE1101" must match the
   catalogue's "CSE 1101". Codes are STORED exactly as typed (only
   auto-capitalised) — see cleanCode below. */

function normCode(v){ return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }

function cleanCode(v){ return String(v || "").trim().toUpperCase().slice(0, 30); }

function fmtDate(ts){ return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }

function fmtSize(bytes){
  if(!bytes) return "0 B";
  if(bytes < 1024) return bytes + " B";
  if(bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function initials(name){
  return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map(function(w){ return w[0].toUpperCase(); }).join("");
}

function isAdminUser(u){ return !!u && u.role === "admin"; }

function isStaffUser(u){ return !!u && (u.role === "admin" || u.role === "moderator"); }

function roleLabelOf(u){ return !u ? "" : u.role === "admin" ? "Admin" : u.role === "moderator" ? "Moderator" : "Student"; }

function fileTypeOf(note){
  var m = /\.([a-z0-9]+)$/i.exec(note.fileName || "");
  return m ? m[1].toLowerCase() : "pdf";
}

function noteFileKind(note){
  var t = fileTypeOf(note);
  if(IMAGE_TYPES.indexOf(t) >= 0) return "image";
  if(t === "pdf") return "pdf";
  return "other";
}

function avgRating(noteId){
  var rs = db.ratings.filter(function(r){ return r.noteId === noteId; });
  if(!rs.length) return { avg: 0, count: 0 };
  return { avg: rs.reduce(function(a, r){ return a + r.value; }, 0) / rs.length, count: rs.length };
}

function myRatingOf(noteId){
  if(!me) return 0;
  var r = db.ratings.find(function(x){ return x.noteId === noteId && x.userId === me.id; });
  return r ? r.value : 0;
}

function courseOfNote(n){ return db.courses.find(function(c){ return c.id === n.courseId; }) || null; }

function userById(id){ return db.users.find(function(u){ return u.id === id; }) || null; }

function noteById(id){ return db.notes.find(function(n){ return n.id === id; }) || null; }

function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }

function genCode(){ return String(Math.floor(100000 + Math.random() * 900000)); }

function now(){ return Date.now(); }

/* ---------------- Icons (Lucide-style line icons, same set as React) ---------------- */

var PATHS = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  eyeOff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-4.493 4.223"/><path d="M6.97 6.97C4.606 8.325 2.71 10.428 2.062 12.348a1 1 0 0 0 0 .696 10.752 10.752 0 0 0 3.545 3.65"/><path d="m2 2 20 20"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  bookmark: '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  chevronR: '<path d="m9 18 6-6-6-6"/>',
  chevronD: '<path d="m6 9 6 6 6-6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  menu: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 20v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'
};

function icon(name, size, sw){
  return '<svg class="ic" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || "") + "</svg>";
}

/* ---------------- Store (localStorage) ---------------- */

var db = null;

var me = null;

function seedDb(){
  var P = window.PLAIN || {};
  var courses = (P.COURSES || []).map(function(c){
    return { id: c.id, dept: c.dept, sem: semNum(c.sem), code: c.code, title: c.title };
  });
  var notes = (P.SEED_NOTES || []).map(function(n){
    var size = 0;
    if(n.fileData){ var comma = n.fileData.indexOf(","); size = Math.round((n.fileData.length - (comma >= 0 ? comma + 1 : 0)) * 3 / 4); }
    return { id: n.id, userId: n.userId, courseId: n.courseId, title: n.title, desc: n.desc || "",
      fileName: n.fileName, fileType: n.fileType || fileTypeOf(n), fileData: n.fileData || null,
      fileSize: size, status: n.status, downloads: n.downloads || 0, created: n.created };
  });
  var maxId = function(arr, dflt){ return arr.length ? Math.max.apply(null, arr.map(function(x){ return x.id; })) + 1 : dflt; };
  return {
    users: deepCopy(P.SEED_USERS || []),
    courses: courses,
    notes: notes,
    ratings: deepCopy(P.SEED_RATINGS || []),
    comments: deepCopy(P.SEED_COMMENTS || []),
    bookmarks: deepCopy(P.SEED_BOOKMARKS || []),
    notices: deepCopy(P.SEED_NOTICES || []),
    departments: (P.DEPARTMENTS || []).slice(),
    tickets: [],
    replies: [],
    dismissals: [],
    verifications: [],
    resets: [],
    nextIds: {
      user: maxId(P.SEED_USERS || [], 1),
      note: maxId(P.SEED_NOTES || [], 1),
      comment: maxId(P.SEED_COMMENTS || [], 1),
      notice: maxId(P.SEED_NOTICES || [], 1),
      ticket: 1,
      reply: 1,
      course: courses.length ? Math.max.apply(null, courses.map(function(c){ return c.id; })) + 1 : 1
    }
  };
}

function loadDb(){
  try{
    var raw = localStorage.getItem(DB_KEY);
    if(raw){ db = JSON.parse(raw); }
  }catch(e){ db = null; }
  if(!db || !db.users || !db.courses){ db = seedDb(); saveDb(); }
  /* Fill any missing collections (older saved state) */
  ["tickets", "replies", "dismissals", "verifications", "resets"].forEach(function(k){ if(!Array.isArray(db[k])) db[k] = []; });
  if(!db.nextIds) db.nextIds = seedDb().nextIds;
  ["user", "note", "comment", "notice", "ticket", "reply", "course"].forEach(function(k){
    if(typeof db.nextIds[k] !== "number") db.nextIds[k] = 1;
  });
}

function saveDb(){
  try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }catch(e){}
}

function loadSession(){
  try{
    var id = Number(localStorage.getItem(SESSION_KEY) || 0);
    me = id ? userById(id) : null;
    if(me && me.suspended){ /* keep session; the suspended screen handles it */ }
  }catch(e){ me = null; }
}

function setSession(user){
  me = user || null;
  try{
    if(me) localStorage.setItem(SESSION_KEY, String(me.id));
    else localStorage.removeItem(SESSION_KEY);
  }catch(e){}
}

/* ---------------- Transient UI state (in memory only) ---------------- */

function freshUpload(){ return { dept: "", sem: "", code: "", title: "", noteTitle: "", desc: "", fileName: "", fileSize: 0, fileData: null, fileReading: false, err: "" }; }

function freshCourseDraft(){ return { dept: "", sem: "", code: "", title: "" }; }

var ui = {
  view: "upload",
  noteId: null,
  contributorId: null,
  browse: { q: "", dept: "", sem: "", courseId: "", sort: "newest", shown: PAGE_STEP },
  focusNotice: null,
  supportTicketId: null,
  adminTab: "pending",
  openDrop: null,          /* "acct" | "notif" | null */
  mobileOpen: false,
  theme: "light",
  toastMsg: "",
  toastTimer: null,
  drafts: {},              /* form input values by element id (kept across re-renders) */
  upload: freshUpload(),
  editNote: null,          /* {id, dept, sem, code, title, noteTitle, desc, err} */
  editCourse: null,        /* {id, dept, sem, code, title, err} */
  courseAdd: freshCourseDraft(),
  courseAddMsg: null,
  admin: { noticeTitle: "", noticeBody: "", noticePin: "normal", editingNoticeId: null, noticeMsg: null,
           staffName: "", staffEmail: "", staffDept: "CSE", staffPw: "", staffRole: "moderator", staffMsg: null,
           deptName: "", deptMsg: null, renamingId: null, renameVal: "", supportSel: null },
  modal: null,             /* {kind, id, name, title, ...} */
  loginErr: "", loginNote: "", verifyFromLogin: false,
  verify: { email: "", codeShown: "", cooldownUntil: 0, err: "", info: "", done: false, heading: "", sub: "" },
  registerErr: "",
  authDone: false,
  forgot: { email: "", codeShown: "", requested: false, err: "" },
  profileMsg: null, passMsg: null,
  supportMsg: null,
  commentText: ""
};

function fv(id){ return ui.drafts[id] == null ? "" : ui.drafts[id]; }

function themeNow(){
  try{ return localStorage.getItem(THEME_KEY) || "light"; }catch(e){ return "light"; }
}

function applyTheme(t){
  ui.theme = t === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", ui.theme);
  try{ localStorage.setItem(THEME_KEY, ui.theme); }catch(e){}
}

function toggleTheme(){
  applyTheme(ui.theme === "dark" ? "light" : "dark");
  render();
}

function toast(msg){
  ui.toastMsg = msg || "";
  if(ui.toastTimer) clearTimeout(ui.toastTimer);
  if(msg) ui.toastTimer = setTimeout(function(){ ui.toastMsg = ""; render(); }, 3400);
  renderToast();
}

function renderToast(){
  var el = document.getElementById("toast-slot");
  if(!el) return;
  el.innerHTML = ui.toastMsg ? '<div class="toast" role="status">' + esc(ui.toastMsg) + "</div>" : "";
}

/* Animated number — counts up with an ease-out when it renders.
   The clock starts on the FIRST animation frame (never performance.now()
   mixed with the frame timestamp), and progress is clamped to [0,1]
   so the number always settles on the real value. */

function runCountUps(){
  var els = document.querySelectorAll("[data-countup]");
  els.forEach(function(el){
    var value = Number(el.getAttribute("data-countup")) || 0;
    if(REDUCED_MOTION){ el.textContent = String(value); return; }
    var t0 = null, dur = 1300;
    var tick = function(t){
      if(t0 === null) t0 = t;
      var p = Math.max(0, Math.min(1, (t - t0) / dur));
      el.textContent = String(Math.round(value * (1 - Math.pow(1 - p, 4))));
      if(p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* ---------------- Navigation ---------------- */

function go(view, id, q, dept){
  ui.openDrop = null; ui.mobileOpen = false; ui.modal = null;
  if(view === "login"){ ui.loginErr = ""; ui.loginNote = ""; ui.verifyFromLogin = false; }
  if(view === "register"){ ui.verify.email = ""; ui.verify.codeShown = ""; ui.verify.err = ""; ui.verify.info = ""; }
  if(view === "forgot"){ ui.forgot = { email: "", codeShown: "", requested: false, err: "" }; }
  if(view === "browse"){
    ui.browse = { q: q || "", dept: dept || "", sem: "", courseId: "", sort: "newest", shown: PAGE_STEP };
  }
  if(view === "note") ui.noteId = id;
  if(view === "contributor") ui.contributorId = id;
  if(view === "notices") ui.focusNotice = id || null;
  if(view === "support") ui.supportTicketId = id || null;
  if(view === "admin") ui.adminTab = (typeof id === "string" && id) ? id : "pending";
  if(view !== "verify"){ ui.verify.done = false; }
  if(view !== "register"){ ui.authDone = false; }
  ui.view = view;
  render();
  if(view === "notices" && ui.focusNotice){
    setTimeout(function(){
      var el = document.getElementById("notice-" + ui.focusNotice);
      if(el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  } else {
    window.scrollTo(0, 0);
  }
}

function logout(){
  setSession(null);
  ui.openDrop = null; ui.mobileOpen = false; ui.modal = null;
  toast("You have been logged out.");
  go(MEMBER_HOME);
}

/* ---------------- Shared components (HTML strings, escaped) ---------------- */

function avatarHTML(user, cls){
  var c = (cls || "avatar") + (user && user.photo ? " has-photo" : "");
  var inner = (user && user.photo)
    ? '<img src="' + esc(user.photo) + '" alt="" />'
    : esc(initials(user ? user.name : "?"));
  return '<span class="' + c + '" aria-hidden="true">' + inner + "</span>";
}

function starsHTML(avg, count){
  var pct = Math.max(0, Math.min(100, (avg / 5) * 100));
  return '<span class="stars-wrap"><span class="stars" style="--v:' + pct + '%">★★★★★</span>' +
    '<span class="val">' + (avg ? avg.toFixed(1) : "—") + '</span>' +
    '<span class="cnt">(' + count + ")</span></span>";
}

function fileBadgeHTML(type){
  var t = String(type || "pdf").toLowerCase();
  return '<span class="file-badge fb-' + esc(t) + '">' + esc(t.toUpperCase()) + "</span>";
}

function statusBadgeHTML(status){
  return '<span class="badge-status ' + esc(status) + '">' + esc(status) + "</span>";
}

function alertHTML(kind, text){
  return '<div class="alert ' + esc(kind) + '" role="' + (kind === "error" ? "alert" : "status") + '">' + text + "</div>";
}

function emptyStateHTML(title, body, buttonsHTML){
  return '<div class="empty">' + icon("fileText", 40) +
    '<p class="t">' + esc(title) + "</p>" +
    '<p class="b">' + esc(body) + "</p>" +
    (buttonsHTML ? '<div class="cta">' + buttonsHTML + "</div>" : "") +
    "</div>";
}

function loginWallButtons(){
  return '<button class="btn-gold" data-act="go" data-view="login">Log in</button>' +
    '<button class="btn-ghost" data-act="go" data-view="register">Create an account</button>';
}

function noteCardHTML(note){
  var course = courseOfNote(note);
  var author = userById(note.userId);
  var r = avgRating(note.id);
  var isPhoto = noteFileKind(note) === "image" && !!me && !!note.fileData;
  var h = '<article class="note-card"><div class="top">' + fileBadgeHTML(fileTypeOf(note));
  if(course) h += '<span class="dept-pill">' + esc(course.dept) + " · Semester " + course.sem + "</span>";
  h += "</div>";
  if(isPhoto){
    h += '<button type="button" style="text-align:left;padding:0" data-act="go" data-view="note" data-id="' + note.id + '" aria-label="Open ' + esc(note.title) + '">' +
      '<img class="note-card-thumb" src="' + esc(note.fileData) + '" alt="Photo of the note &ldquo;' + esc(note.title) + '&rdquo;" /></button>';
  }
  h += '<button type="button" style="text-align:left" data-act="go" data-view="note" data-id="' + note.id + '"><h3>' + esc(note.title) + "</h3></button>";
  if(course) h += '<p class="course-line">' + esc(course.code) + " · " + esc(course.title) + "</p>";
  if(note.desc) h += '<p class="desc">' + esc(note.desc) + "</p>";
  h += '<div class="card-actions"><button type="button" class="pb pb-o" data-act="go" data-view="note" data-id="' + note.id + '">Open note</button></div>';
  h += '<div class="foot">';
  if(author){
    h += '<button type="button" class="uploader" title="View ' + esc(author.name) + '&rsquo;s profile" aria-label="View profile of ' + esc(author.name) + '" data-act="go" data-view="contributor" data-id="' + author.id + '">' +
      avatarHTML(author) + '<span class="nm">' + esc(author.name) + "</span></button>";
  } else {
    h += '<span class="uploader">' + avatarHTML(null) + '<span class="nm">Unknown</span></span>';
  }
  h += '<span style="display:inline-flex;align-items:center;gap:12px">' + starsHTML(r.avg, r.count) +
    '<span class="dl">' + icon("download", 16) + " " + (note.downloads || 0) + "</span></span></div></article>";
  return h;
}

/* The note file itself sits on the note page, no preview step.
   A PDF shows as a PDF and a photo shows as a photo, right there. */

function noteFileViewerHTML(note){
  var kind = noteFileKind(note);
  var typeLabel = kind === "image" ? "Photo" : kind === "pdf" ? "PDF" : String(fileTypeOf(note)).toUpperCase() + " file";
  var h = '<div class="file-shell"><div class="file-bar">' +
    '<span class="fname">' + esc(note.fileName) + "</span>" +
    "<span>" + esc(typeLabel) + (note.fileSize ? " · " + esc(fmtSize(note.fileSize)) : "") + "</span></div>";
  if(!me){
    h += '<div class="file-msg">' + icon("fileText", 36) +
      "<p>Log in to see the file itself — a PDF shows as a PDF and a photo shows as a photo, right on this page.</p>" +
      '<button class="btn-ink" data-act="go" data-view="login">Log in</button></div>';
  } else if(kind === "image" && note.fileData){
    h += '<img class="file-img" src="' + esc(note.fileData) + '" alt="Photo of the note &ldquo;' + esc(note.title) + '&rdquo;" />';
  } else if(kind === "pdf" && note.fileData){
    h += '<iframe class="file-frame" src="' + esc(note.fileData) + '" title="' + esc(note.title + " — " + note.fileName) + '"></iframe>';
  } else if(note.fileData){
    h += '<div class="file-msg">' + icon("fileText", 36) +
      "<p>This note is a " + esc(typeLabel) + " (" + esc(note.fileName) + "), which a web page cannot display directly. Use Download above to get the file itself.</p></div>";
  } else {
    h += '<div class="file-msg">' + icon("fileText", 36) +
      "<p>This file was stored by name only (over 5 MB), so it cannot be shown on the page. Ask the uploader for a smaller copy.</p></div>";
  }
  return h + "</div>";
}

/* Cascading course picker: dept + semester selects, then hand-typed
   code + title with catalogue suggestions (datalist). The code box
   only auto-capitalises — spaces and other characters are kept
   exactly as typed, and matching stays space-insensitive.
   prefix: "up" (upload), "ac" (admin add course), "ec" (admin edit course),
   "en" (edit note modal). draft: {dept, sem, code, title}. */

function coursePool(dept, sem){
  return db.courses.filter(function(c){
    return c.dept === dept && (!sem || c.sem === Number(sem));
  });
}

function courseFieldsHTML(prefix, draft, grid){
  var depts = db.departments.length ? db.departments : (window.PLAIN ? window.PLAIN.DEPARTMENTS : []);
  var pool = (draft.dept && draft.sem) ? coursePool(draft.dept, draft.sem) : [];
  var codeListId = prefix + "-codes", titleListId = prefix + "-titles";
  var deptField = '<div class="field"><span class="lbl">Department</span>' +
    '<select aria-label="Department" class="in" id="' + prefix + '-dept" data-cf="' + prefix + '" data-cf-field="dept">' +
    '<option value="">Choose a department</option>' +
    depts.map(function(d){ return '<option value="' + esc(d) + '"' + (draft.dept === d ? " selected" : "") + ">" + esc(d) + "</option>"; }).join("") +
    "</select></div>";
  var semField = '<div class="field"><span class="lbl">Semester</span>' +
    '<select aria-label="Semester" class="in" id="' + prefix + '-sem" data-cf="' + prefix + '" data-cf-field="sem"' + (draft.dept ? "" : " disabled") + ">" +
    '<option value="">' + (draft.dept ? "Choose a semester" : "Choose a department first") + "</option>" +
    [1,2,3,4,5,6,7,8,9,10,11,12].map(function(s){
      return '<option value="' + s + '"' + (String(draft.sem) === String(s) ? " selected" : "") + ">Semester " + s + "</option>";
    }).join("") + "</select>" +
    (draft.dept ? "" : '<p class="hint">Choose a department first</p>') + "</div>";
  var codeField = '<div class="field"><span class="lbl">Course code</span>' +
    '<input aria-label="Course code" class="in" type="text" list="' + codeListId + '" id="' + prefix + '-code" data-cf="' + prefix + '" data-cf-field="code"' +
    (draft.sem ? "" : " disabled") + ' placeholder="Example: CSE 1101" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(draft.code || "") + '" />' +
    '<datalist id="' + codeListId + '">' +
    pool.slice(0, 60).map(function(c){ return '<option value="' + esc(c.code) + '"></option>'; }).join("") +
    "</datalist>" +
    (draft.dept && draft.sem ? "" : '<p class="hint">Choose a semester first</p>') + "</div>";
  var titleField = '<div class="field"><span class="lbl">Subject title</span>' +
    '<input aria-label="Subject title" class="in" type="text" list="' + titleListId + '" id="' + prefix + '-title" data-cf="' + prefix + '" data-cf-field="title"' +
    (draft.sem ? "" : " disabled") + ' placeholder="Example: Introduction to Programming" autocomplete="off" value="' + esc(draft.title || "") + '" />' +
    '<datalist id="' + titleListId + '">' +
    pool.slice(0, 60).map(function(c){ return '<option value="' + esc(c.title) + '"></option>'; }).join("") +
    "</datalist>" +
    (draft.sem ? "" : '<p class="hint">Choose a semester first</p>') + "</div>";
  if(grid){
    return "<div><div class=\"split2\">" + deptField + semField + "</div><div class=\"split2\">" + codeField + titleField + "</div></div>";
  }
  return "<div>" + deptField + semField + codeField + titleField + "</div>";
}

function draftForPrefix(prefix){
  if(prefix === "up") return ui.upload;
  if(prefix === "ac") return ui.courseAdd;
  if(prefix === "ec") return ui.editCourse;
  if(prefix === "en") return ui.editNote;
  return null;
}

/* Client-side version of the server rule: a listed code must be used
   with its listed title; an unlisted code+title becomes a new course.
   Matching is space-insensitive, but the code is kept exactly as
   typed (only auto-capitalised). */

function resolveCourse(dept, sem, code, title, excludeId){
  var clean = cleanCode(code), t = String(title || "").trim();
  if(!dept || !sem) return { error: "Pick a department and a semester first." };
  if(!clean) return { error: "Type the course code." };
  if(!t) return { error: "Type the subject title." };
  var pool = db.courses.filter(function(c){ return c.dept === dept && c.sem === Number(sem) && c.id !== excludeId; });
  var byCode = pool.find(function(c){ return normCode(c.code) === normCode(clean); });
  if(byCode){
    if(byCode.title.toLowerCase() !== t.toLowerCase())
      return { error: "Course code " + byCode.code + " is listed as \u201c" + byCode.title + "\u201d. The title does not match — fix the title or use a different code." };
    return { course: byCode, created: false };
  }
  var byTitle = pool.find(function(c){ return c.title.toLowerCase() === t.toLowerCase(); });
  if(byTitle)
    return { error: "\u201c" + t + "\u201d is already listed with code " + byTitle.code + ". Use that code." };
  return { course: { id: 0, dept: dept, sem: Number(sem), code: clean, title: t }, created: true };
}

/* Password field with a show/hide (eye) toggle at the right edge.
   Used on every password box: Login, Register, Forgot-password reset,
   Profile Change password and Admin Add staff. */

function passwordFieldHTML(id, label, hint, opts){
  opts = opts || {};
  return '<div class="field"><span class="lbl">' + esc(label) + "</span>" +
    '<span class="pw-wrap">' +
    '<input aria-label="' + esc(label) + '" class="in pw-in" id="' + id + '" type="password" autocomplete="' + esc(opts.autoComplete || "off") + '"' +
    (opts.required ? " required" : "") + (opts.minLength ? ' minlength="' + opts.minLength + '"' : "") +
    (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : "") +
    ' value="' + esc(fv(id)) + '" />' +
    '<button type="button" class="pw-eye" aria-label="Show password" title="Show password" data-act="toggle-pw" data-target="' + id + '">' + icon("eye", 18) + "</button>" +
    "</span>" +
    (hint ? '<p class="hint">' + esc(hint) + "</p>" : "") + "</div>";
}

/* Auth pages: the side panel is a dark welcome card, not a photo.
   It shows what members can do and live catalogue stats
   (courses / departments / semesters) with a counting animation.
   The Log in page uses the hosted site's own list (5 items) and stat
   labels ("courses in the catalogue" / "departments" /
   "semesters covered"); every other auth page uses the shared 4-item
   list and the short "Courses" / "Departments" / "Semesters" labels. */

var AUTH_DO_SHARED = [
  "Upload your own notes and share them with your batch",
  "Download notes, past questions and assignment solutions",
  "Rate notes and bookmark the ones you need",
  "Get help from the Support page when something goes wrong"
];

var AUTH_DO_LOGIN = [
  "Find notes by department, semester, course code or keyword",
  "Read PDFs and photos right on the page, before you download",
  "Rate, comment on and bookmark the notes that help you most",
  "Upload your own notes and help your juniors",
  "Every note is checked by an admin or moderator first"
];

function authShellHTML(heading, sub, inner, opts){
  var o = opts || {};
  var items = o.items || AUTH_DO_SHARED;
  var labels = o.labels || ["Courses", "Departments", "Semesters"];
  var courses = db.courses.length;
  var depts = db.departments.length;
  return '<div class="view"><div class="wrap"><div class="auth-grid">' +
    '<div class="auth-welcome"><div class="txt"><h2>' + esc(heading) + "</h2><p>" + esc(sub) + "</p>" +
    '<ul class="auth-do">' +
    items.map(function(t){ return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
    '<div class="auth-stats">' +
    '<div class="auth-stat"><b><span data-countup="' + courses + '">0</span></b><span>' + esc(labels[0]) + '</span></div>' +
    '<div class="auth-stat"><b><span data-countup="' + depts + '">0</span></b><span>' + esc(labels[1]) + '</span></div>' +
    '<div class="auth-stat"><b><span data-countup="12">0</span></b><span>' + esc(labels[2]) + '</span></div>' +
    "</div></div></div>" +
    '<div class="auth-side"><div class="auth-box">' + inner + "</div></div>" +
    "</div></div></div>";
}

/* ---------------- Header, footer, important-notice banner ---------------- */

function headerStats(){
  if(!me) return null;
  var mine = db.notes.filter(function(n){ return n.userId === me.id; });
  return {
    shared: mine.filter(function(n){ return n.status === "approved"; }).length,
    downloads: mine.reduce(function(s, n){ return s + (n.downloads || 0); }, 0),
    bookmarks: db.bookmarks.filter(function(b){ return b.userId === me.id; }).length
  };
}

function waitingCounts(){
  var pendingAll = db.notes.filter(function(n){ return n.status === "pending"; }).length;
  var pendingAccounts = me && isAdminUser(me) ? db.users.filter(function(u){ return !u.approved; }).length : 0;
  return { pendingAll: pendingAll, pendingAccounts: pendingAccounts, waitingAll: pendingAll + pendingAccounts };
}

function buildNotifs(){
  /* Returns {notifs:[{key,icon,title,sub,view,id}], count} */
  var notifs = [];
  if(!me) return { notifs: notifs, count: 0 };
  var mine = db.notes.filter(function(n){ return n.userId === me.id; });
  if(isStaffUser(me)){
    db.notes.filter(function(n){ return n.status === "pending"; }).forEach(function(n){
      var c = courseOfNote(n);
      var u = userById(n.userId);
      notifs.push({ key: "n" + n.id, icon: "clock", title: n.title,
        sub: "Waiting for approval · " + (u ? u.name : "Unknown") + (c ? " · " + c.code : ""), view: "admin", id: null });
    });
    db.tickets.filter(function(t){ return t.status === "open"; }).slice(0, 3).forEach(function(t){
      var u = userById(t.userId);
      notifs.push({ key: "t" + t.id, icon: "user", title: t.subject,
        sub: "Support ticket · " + (u ? u.name : "a member") + " · " + t.type, view: "admin", id: "support" });
    });
  } else {
    mine.filter(function(n){ return n.status === "pending"; }).forEach(function(n){
      notifs.push({ key: "p" + n.id, icon: "clock", title: n.title,
        sub: "Your note is waiting for admin approval", view: "profile", id: null });
    });
    mine.filter(function(n){ return n.status === "rejected"; }).forEach(function(n){
      notifs.push({ key: "r" + n.id, icon: "x", title: n.title,
        sub: "This note was rejected — open My profile to check it", view: "profile", id: null });
    });
    db.tickets.filter(function(t){ return t.userId === me.id && t.status === "answered"; }).forEach(function(t){
      notifs.push({ key: "ta" + t.id, icon: "check", title: t.subject,
        sub: "Support answered your ticket — open it to read the reply", view: "support", id: t.id });
    });
  }
  if(isAdminUser(me)){
    db.users.filter(function(u){ return !u.approved; }).forEach(function(u){
      notifs.push({ key: "a" + u.id, icon: "user", title: u.name,
        sub: "New account waiting for approval · " + (u.dept || ""), view: "contributor", id: u.id });
    });
    /* Admins hear about accounts first */
    notifs.sort(function(a, b){ return (a.key[0] === "a" ? 0 : 1) - (b.key[0] === "a" ? 0 : 1); });
  }
  return { notifs: notifs, count: notifs.length };
}

function latestNotices(){
  return db.notices.slice().sort(function(a, b){
    return ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || b.created - a.created;
  }).slice(0, 3);
}

function themeButtonHTML(){
  var dark = ui.theme === "dark";
  return '<button type="button" class="theme-btn" aria-label="' + (dark ? "Switch to light mode" : "Switch to dark mode") + '"' +
    ' title="' + (dark ? "Light mode" : "Dark mode") + '" data-act="theme">' + icon(dark ? "sun" : "moon", 18) + "</button>";
}

function headerHTML(){
  var wc = waitingCounts();
  var stats = headerStats();
  var nb = buildNotifs();
  var h = '<header class="site"><div class="wrap bar">' +
    '<button class="brand" aria-label="Notes Portal home" data-act="go" data-view="upload">' +
    '<span class="logo-chip"><img src="assets/logo.png" alt="City University" /></span>' +
    '<span class="brand-txt"><b>Notes Portal</b><small>University Notes Sharing</small></span></button>' +
    '<nav class="main" aria-label="Main">' +
    '<button class="nl" data-act="go" data-view="home">Home</button>' +
    '<button class="nl" data-act="go" data-view="browse">Notes</button>' +
    '<button class="nl" data-act="go" data-view="notices">Notices</button>';
  if(me){
    h += '<button class="nl" data-act="go" data-view="upload">Upload</button>' +
      '<button class="nl" data-act="go" data-view="profile">My profile</button>' +
      '<button class="nl" data-act="go" data-view="support">Support</button>';
    if(isStaffUser(me)){
      h += '<button class="nl" data-act="go" data-view="admin">' + (me.role === "admin" ? "Admin" : "Moderate") +
        (wc.waitingAll > 0 ? '<span class="nav-badge">' + (wc.waitingAll > 9 ? "9+" : wc.waitingAll) + "</span>" : "") + "</button>";
    }
  }
  h += '<span class="nav-actions">';
  if(me){
    /* Notification bell */
    h += '<span class="notif-wrap" data-drop="notif">' +
      '<button class="bell-btn" aria-label="' + (nb.count ? "Notifications, " + nb.count + " waiting" : "Notifications") + '"' +
      ' aria-expanded="' + (ui.openDrop === "notif") + '" aria-haspopup="true" data-act="toggle-notif">' + icon("bell", 19) +
      (nb.count > 0 ? '<span class="bell-badge">' + (nb.count > 9 ? "9+" : nb.count) + "</span>" : "") + "</button>";
    if(ui.openDrop === "notif"){
      h += '<div class="drop-panel" role="menu" aria-label="Notifications"><p class="drop-sec-t">Notifications</p>';
      if(!nb.notifs.length){
        h += '<p class="drop-empty">You\u2019re all caught up — nothing is waiting right now.</p>';
      } else {
        h += '<div class="drop-items">' + nb.notifs.slice(0, 5).map(function(nf){
          return '<button class="drop-note" data-act="notif-go" data-view="' + nf.view + '"' + (nf.id != null ? ' data-id="' + nf.id + '"' : "") + ">" +
            icon(nf.icon, 17) + '<span><b>' + esc(nf.title) + "</b><small>" + esc(nf.sub) + "</small></span></button>";
        }).join("");
        if(isStaffUser(me) && wc.waitingAll > 0){
          h += '<button class="drop-item" data-act="go" data-view="admin">' + icon("shield", 18) +
            '<span>Open the approval queue</span><span class="cnt-badge">' + wc.waitingAll + '</span>' +
            '<span class="chev-r">' + icon("chevronR", 16) + "</span></button>";
        }
        h += "</div>";
      }
      var ln = latestNotices();
      if(ln.length){
        h += '<p class="drop-sec-t">Latest notices</p><div class="drop-items">' + ln.map(function(nc){
          var by = userById(nc.authorId);
          return '<button class="drop-note" data-act="notif-notice" data-id="' + nc.id + '">' + icon("megaphone", 17) +
            "<span><b>" + esc((nc.pinned ? "Pinned: " : "") + (nc.important ? "Important: " : "") + nc.title) + "</b><small>" +
            esc(fmtDate(nc.created) + (by ? " · by " + by.name : "") + " — open the notice board") + "</small></span></button>";
        }).join("") + "</div>";
      }
      h += "</div>";
    }
    h += "</span>";
    /* Account dropdown */
    h += '<span class="acct-wrap" data-drop="acct">' +
      '<button class="acct-btn" aria-expanded="' + (ui.openDrop === "acct") + '" aria-haspopup="true" aria-label="Account menu for ' + esc(me.name) + '" data-act="toggle-acct">' +
      avatarHTML(me) +
      '<span class="acct-txt"><span class="nm">' + esc(me.name) + '</span><span class="sub">' + esc(roleLabelOf(me)) + " · " + esc(me.dept) + "</span></span>" +
      '<span class="chev">' + icon("chevronD", 16) + "</span></button>";
    if(ui.openDrop === "acct"){
      h += '<div class="drop-panel" role="menu" aria-label="Account menu"><div class="drop-head">' +
        avatarHTML(me) + "<div><p class=\"nm\">" + esc(me.name) + "</p><p class=\"em\">" + esc(me.email) + "</p>" +
        '<span class="drop-badges"><span class="badge-role ' + esc(me.role) + '">' + esc(roleLabelOf(me)) + '</span>' +
        '<span class="dept-pill">' + esc(me.dept) + "</span>" +
        (me.suspended ? '<span class="badge-suspended">Suspended</span>' : "") + "</span></div>" +
        themeButtonHTML() + "</div>";
      if(stats){
        h += '<div class="drop-stats">' +
          '<div class="ds"><b>' + stats.shared + "</b><span>Notes shared</span></div>" +
          '<div class="ds"><b>' + stats.downloads + "</b><span>Downloads</span></div>" +
          '<div class="ds"><b>' + stats.bookmarks + "</b><span>Bookmarks</span></div></div>";
      }
      var dropItem = function(view, ic, label, badge, id){
        return '<button class="drop-item" data-act="go" data-view="' + view + '"' + (id != null ? ' data-id="' + id + '"' : "") + ">" +
          icon(ic, 18) + "<span>" + esc(label) + "</span>" +
          (badge ? '<span class="cnt-badge">' + badge + "</span>" : "") +
          '<span class="chev-r">' + icon("chevronR", 16) + "</span></button>";
      };
      h += '<div class="drop-items">' +
        dropItem("profile", "user", "My profile") +
        dropItem("contributor", "eye", "View my public profile", null, me.id) +
        dropItem("upload", "upload", "Upload a note") +
        dropItem("profile", "bookmark", "My bookmarks", stats.bookmarks || null) +
        dropItem("notices", "megaphone", "Notice board") +
        dropItem("support", "user", "Support");
      if(isStaffUser(me)) h += dropItem("admin", "shield", me.role === "admin" ? "Admin panel" : "Moderator panel", wc.waitingAll || null);
      h += '</div><div class="drop-foot"><button class="drop-item" data-act="logout">' + icon("logout", 18) + "<span>Log out</span></button></div></div>";
    }
    h += "</span>";
  } else {
    h += '<button class="btn-ghost" data-act="go" data-view="login">Log in</button>' +
      '<button class="btn-gold" data-act="go" data-view="register">Get started</button>';
  }
  h += '</span></nav>' +
    '<button class="menu-btn" aria-label="' + (ui.mobileOpen ? "Close menu" : "Open menu") + '" aria-expanded="' + ui.mobileOpen + '" data-act="toggle-menu">' + icon(ui.mobileOpen ? "x" : "menu", 20) + "</button>" +
    "</div>";
  if(ui.mobileOpen){
    h += '<nav class="mobile" aria-label="Menu">';
    if(me){
      h += '<div class="m-acct"><div class="row1">' + avatarHTML(me, "avatar lg") +
        "<div><p class=\"nm\">" + esc(me.name) + "</p><p class=\"em\">" + esc(me.email) + "</p>" +
        '<span class="drop-badges"><span class="badge-role ' + esc(me.role) + '">' + esc(roleLabelOf(me)) + '</span>' +
        '<span class="dept-pill">' + esc(me.dept) + "</span></span></div>" + themeButtonHTML() + "</div>";
      if(stats){
        h += '<div class="drop-stats">' +
          '<div class="ds"><b>' + stats.shared + "</b><span>Notes shared</span></div>" +
          '<div class="ds"><b>' + stats.downloads + "</b><span>Downloads</span></div>" +
          '<div class="ds"><b>' + stats.bookmarks + "</b><span>Bookmarks</span></div></div>";
      }
      if(nb.count > 0){
        var pendLine = isStaffUser(me)
          ? ((wc.pendingAll > 0 ? wc.pendingAll + " note" + (wc.pendingAll === 1 ? "" : "s") : "") +
             (wc.pendingAll > 0 && wc.pendingAccounts > 0 ? " · " : "") +
             (wc.pendingAccounts > 0 ? wc.pendingAccounts + " new account" + (wc.pendingAccounts === 1 ? "" : "s") : "") +
             " waiting for your approval")
          : nb.count + " of your notes need attention";
        h += '<button class="pend-line" data-act="go" data-view="' + (isStaffUser(me) ? "admin" : "profile") + '">' + icon("bell", 16) + "<span>" + esc(pendLine) + "</span></button>";
      }
      h += '<div class="quick">' +
        '<button class="pb pb-o" data-act="go" data-view="contributor" data-id="' + me.id + '">' + icon("eye", 15) + " Public profile</button>" +
        '<button class="pb pb-o" data-act="go" data-view="upload">' + icon("upload", 15) + " Upload note</button></div></div>";
    }
    var mlink = function(view, label){
      return '<button class="mlink" data-act="go" data-view="' + view + '">' + esc(label) + "</button>";
    };
    h += mlink("home", "Home") + mlink("browse", "Notes") + mlink("notices", "Notices");
    if(me){
      h += mlink("upload", "Upload") + mlink("profile", "My profile") + mlink("support", "Support");
      if(isStaffUser(me)) h += mlink("admin", me.role === "admin" ? "Admin" : "Moderate");
      h += '<div class="m-actions"><button class="btn-ghost" style="width:100%" data-act="logout">' + icon("logout", 16) + " Log out</button></div>";
    } else {
      h += '<div class="m-actions"><button class="btn-ghost" style="width:100%" data-act="go" data-view="login">Log in</button>' +
        '<button class="btn-gold" style="width:100%" data-act="go" data-view="register">Get started</button></div>';
    }
    h += "</nav>";
  }
  return h + "</header>";
}

function footerHTML(){
  var team = (window.PLAIN && window.PLAIN.TEAM) || [];
  var h = '<footer class="site"><div class="wrap"><div class="foot-grid"><div>' +
    '<span class="logo-chip"><img src="assets/logo.png" alt="City University" /></span>' +
    '<p class="foot-desc">University Notes Sharing Portal. Upload, search and download study notes in one trusted place.</p></div>' +
    '<div><h4>Portal</h4>' +
    '<button class="foot-link" data-act="go" data-view="home">Home</button>' +
    '<button class="foot-link" data-act="go" data-view="browse">Notes</button>' +
    '<button class="foot-link" data-act="go" data-view="notices">Notices</button>' +
    '<button class="foot-link" data-act="go" data-view="register">Create account</button>' +
    (me ? '<button class="foot-link" data-act="go" data-view="upload">Upload a note</button>' : "") +
    (me ? '<button class="foot-link" data-act="go" data-view="support">Support</button>' : "") +
    "</div><div><h4>Project team</h4>" +
    team.map(function(m){
      return '<span class="foot-team">' + esc(m.name) + '<br /><small style="color:var(--dim)">ID: ' + esc(m.id) + " · 66th Batch · Section B</small></span>";
    }).join("") +
    '</div></div><div class="foot-bottom"><span>© 2026 University Notes Sharing Portal · City University</span>' +
    '<button class="top-btn" data-act="back-top">Back to top ↑</button></div></div></footer>';
  return h;
}
/* An important notice shows under the header on every page for a
   logged-in member, until they dismiss it (saved per member). */

function importantBannerHTML(){
  if(!me) return "";
  var dismissed = db.dismissals.filter(function(d){ return d.userId === me.id; }).map(function(d){ return d.noticeId; });
  var imp = db.notices.filter(function(n){ return n.important && dismissed.indexOf(n.id) < 0; })
    .sort(function(a, b){ return b.created - a.created; })[0];
  if(!imp) return "";
  var by = userById(imp.authorId);
  return '<div class="important-banner" role="status">' +
    '<span class="ib-icon">' + icon("megaphone", 20) + "</span>" +
    '<div class="ib-body"><p class="ib-tag">Important notice</p>' +
    '<p class="ib-title">' + esc(imp.title) + "</p>" +
    '<p class="ib-text">' + esc(imp.body) + "</p>" +
    '<p class="ib-meta">' + esc(fmtDate(imp.created) + (by ? " · by " + by.name : "")) + "</p></div>" +
    '<button class="ib-x" aria-label="Dismiss this notice" title="Dismiss" data-act="dismiss-notice" data-id="' + imp.id + '">' + icon("x", 18) + "</button></div>";
}

/* ---------------- Home ---------------- */

function noticeCardHTML(nc){
  var by = userById(nc.authorId);
  var cls = "notice-card" + (nc.pinned ? " pinned" : "") + (nc.id === ui.focusNotice ? " notice-focus" : "");
  return '<article class="' + cls + '" id="notice-' + nc.id + '"><div class="nc-top">' +
    (nc.pinned ? '<span class="badge-pinned">' + icon("pin", 13) + " Pinned</span>" : "") +
    (nc.important ? '<span class="badge-important">Important</span>' : "") +
    '<span class="nc-date">' + esc(fmtDate(nc.created)) + "</span>" +
    (by ? '<span class="nc-by">by ' + esc(by.name) + " · " + esc(roleLabelOf(by)) + "</span>" : "") +
    "</div><h3>" + esc(nc.title) + "</h3><p>" + esc(nc.body) + "</p></article>";
}

function sortedNotices(){
  return db.notices.slice().sort(function(a, b){
    return ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || b.created - a.created;
  });
}

function noticeBoardHTML(){
  var notices = sortedNotices();
  return '<div class="view"><div class="wrap"><div class="page"><div class="page-head">' +
    "<h1>Notice board</h1><p>Announcements from the admins — pinned notices first, then the newest.</p></div>" +
    (notices.length === 0
      ? emptyStateHTML("No notices yet", "Admin announcements will appear here.")
      : '<div class="notice-list">' + notices.map(noticeCardHTML).join("") + "</div>") +
    "</div></div></div>";
}

/* ---------------- Browse (Notes) ---------------- */

function editNoteModalHTML(){
  var d = ui.editNote;
  return '<div class="modal-veil" data-act="close-modal"><div class="modal wide" role="dialog" aria-modal="true" aria-label="Edit note">' +
    '<div class="m-head"><h2>Edit note</h2><button class="x-btn" aria-label="Close edit form" data-act="close-modal">' + icon("x", 20) + "</button></div>" +
    (d.err ? alertHTML("error", esc(d.err)) : "") +
    '<form data-form="edit-note">' + courseFieldsHTML("en", d) +
    '<div class="field"><span class="lbl">Title</span><input aria-label="Title" class="in" id="en-noteTitle" type="text" required minlength="3" maxlength="150" value="' + esc(d.noteTitle) + '" /></div>' +
    '<div class="field"><span class="lbl">Description</span><textarea aria-label="Description" class="in" id="en-desc" rows="4" maxlength="2000">' + esc(d.desc) + "</textarea></div>" +
    '<div style="margin-top:8px;display:flex;justify-content:flex-end;gap:12px">' +
    '<button class="btn-ghost" type="button" data-act="close-modal">Cancel</button>' +
    '<button class="btn-gold" type="submit">Save changes</button></div></form></div></div>';
}

/* ---------------- Upload ---------------- */

function uploadHTML(){
  if(!me){
    return '<div class="view"><div class="wrap"><div class="page">' +
      emptyStateHTML("Log in to upload a note", "You need an account to share notes with other students.",
        '<button class="btn-gold" data-act="go" data-view="login">Log in</button>') + "</div></div></div>";
  }
  var d = ui.upload;
  var isImg = /\.(png|jpe?g|gif|webp)$/i.test(d.fileName || "");
  return '<div class="view"><div class="wrap"><div class="page"><div class="page-head">' +
    "<h1>Upload a note</h1><p>Share your notes with other students. An admin checks every note before it goes live.</p></div>" +
    '<div class="upload-grid"><form class="card p8" data-form="upload">' +
    (d.err ? alertHTML("error", esc(d.err)) : "") +
    courseFieldsHTML("up", d) +
    '<div class="field"><span class="lbl">Title</span><input aria-label="Title" class="in" id="up-noteTitle" type="text" required minlength="3" maxlength="150" placeholder="Example: SQL Joins Cheat Sheet" value="' + esc(d.noteTitle) + '" /></div>' +
    '<div class="field"><span class="lbl">Description</span><textarea aria-label="Description" class="in" id="up-desc" rows="4" maxlength="2000" placeholder="What is in this note?">' + esc(d.desc) + "</textarea></div>" +
    '<div class="field"><span class="lbl">File</span>' +
    '<input aria-label="File" class="file-in" id="up-file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" />' +
    '<p class="hint">PDF, DOC, DOCX, PPT, PPTX, PNG or JPG, up to 10 MB. The real file is stored on the server, so a PDF or photo shows right on the note page.</p>' +
    (d.fileName ? '<p class="file-note" id="up-file-note">' + esc(d.fileName) + " · " + esc(fmtSize(d.fileSize)) + (d.fileData ? " · The file itself will show right on the note page." : " · Stored by name only (over 5 MB).") + "</p>" : "") +
    (d.fileData && isImg ? '<img class="upload-thumb" src="' + esc(d.fileData) + '" alt="The photo you chose for this note" />' : "") +
    "</div>" +
    '<button class="btn-gold" type="submit" style="padding:12px 32px;font-size:16px">' + icon("upload", 18) + " Upload note</button>" +
    '</form><aside class="card aside-card"><h3>Before you upload</h3><ul>' +
    "<li>Upload your own work, or notes you have the right to share.</li>" +
    "<li>Pick the right department and semester, then type the course code and its subject title — both are required, so others can find your note easily. If the course is not listed yet, typing it adds it.</li>" +
    "<li>Your note will show as <b>pending</b> until an admin approves it.</li>" +
    "<li>PDF and photo notes open on the site itself, so classmates can read yours before they download it.</li>" +
    "</ul></aside></div></div></div></div>";
}

/* ---------------- Auth: Login / Register / Verify / Forgot ---------------- */

function loginHTML(){
  /* Email not verified yet: offer the verification step instead of a dead end */
  if(ui.verifyFromLogin && ui.verify.email){
    return verifyHTML(ui.verify.email, "Your email is not verified yet.", "Enter the 6-digit code we sent you, or ask for a new one.", true);
  }
  var inner = "<h1>Log in</h1><p class=\"sub\">Use your email and password.</p>" +
    (ui.loginNote ? alertHTML("info", esc(ui.loginNote)) : "") +
    (ui.loginErr ? alertHTML("error", esc(ui.loginErr)) : "") +
    '<form data-form="login">' +
    '<div class="field"><span class="lbl">Email</span><input aria-label="Email" class="in" id="login-email" type="email" autocomplete="email" required value="' + esc(fv("login-email")) + '" /></div>' +
    passwordFieldHTML("login-pw", "Password", "", { autoComplete: "current-password", required: true }) +
    '<button class="btn-gold btn-lg" type="submit" style="width:100%">Log in</button></form>' +
    '<div class="auth-links"><button class="gold" data-act="go" data-view="forgot">Forgot password?</button>' +
    '<span class="dim">New here? <button class="strong" data-act="go" data-view="register">Create an account</button></span></div>';
  return authShellHTML("Welcome back to your notes library.", "Log in to upload, download, rate and bookmark notes shared by City University students.", inner, { items: AUTH_DO_LOGIN, labels: ["courses in the catalogue", "departments", "semesters covered"] });
}

function verifyHTML(email, heading, sub, fromLogin){
  var v = ui.verify;
  var cd = v.cooldownUntil > now() ? Math.ceil((v.cooldownUntil - now()) / 1000) : 0;
  var inner = "<h1>Check your email</h1>" +
    '<p class="sub">We sent a 6-digit code to <b>' + esc(email) + "</b>. Enter it below to verify your email — the code works for 15 minutes.</p>" +
    (v.err ? alertHTML("error", esc(v.err)) : "") +
    (v.info ? alertHTML("info", esc(v.info)) : "") +
    (v.codeShown ? alertHTML("info", "Your demo verification code is <b class=\"code-big\">" + esc(v.codeShown) + "</b><span style=\"display:block;margin-top:4px;font-size:13px\">This demo has no email server, so the code is shown on the page. On a real site it would be emailed to you.</span>") : "") +
    '<form data-form="verify">' +
    '<div class="field"><span class="lbl">Verification code</span><input aria-label="Verification code" class="in" id="verify-code" type="text" inputmode="numeric" required maxlength="6" placeholder="6-digit code" value="' + esc(fv("verify-code")) + '" /></div>' +
    '<button class="btn-gold btn-lg" type="submit" style="width:100%">Verify email</button></form>' +
    '<p class="auth-foot">Didn\'t get a code? ' + (cd > 0
      ? '<span class="dim">Resend in <span id="resend-countdown">' + cd + "</span>s</span>"
      : '<button class="strong" data-act="resend-code">Resend code</button>') + "</p>" +
    '<p class="auth-foot">Changed your mind? <button class="strong" data-act="go" data-view="login">Back to log in</button></p>';
  return authShellHTML(heading, sub, inner);
}

function ticketStatusLabel(s){ return s === "open" ? "Open" : s === "answered" ? "Answered" : "Closed"; }

function ticketReplies(ticketId){
  return db.replies.filter(function(r){ return r.ticketId === ticketId; }).sort(function(a, b){ return a.created - b.created; });
}

function supportHTML(){
  if(!me){
    return '<div class="view"><div class="wrap"><div class="page">' +
      emptyStateHTML("Log in to contact support", "You need an account to ask the admins or moderators for help.",
        '<button class="btn-gold" data-act="go" data-view="login">Log in</button>') + "</div></div></div>";
  }
  var tickets = db.tickets.filter(function(t){ return t.userId === me.id; }).sort(function(a, b){ return b.updated - a.updated; });
  var h = '<div class="view"><div class="wrap"><div class="page"><div class="page-head">' +
    "<h1>Support</h1><p>Having a problem? Tell the admins or moderators — they will reply to your ticket here.</p></div>";
  var thread = ui.supportTicketId ? db.tickets.find(function(t){ return t.id === ui.supportTicketId && t.userId === me.id; }) : null;
  if(thread){
    var replies = ticketReplies(thread.id);
    h += '<div><button class="back-link" data-act="go" data-view="support">← Back to my tickets</button>' +
      '<section class="card p8"><div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px">' +
      '<h2 class="sec-h2" style="margin:0;flex:1 1 240px">' + esc(thread.subject) + '</h2><span class="badge-status ' + thread.status + '">' + esc(ticketStatusLabel(thread.status)) + "</span></div>" +
      '<p style="color:var(--dim);font-size:14px;margin:8px 0 0">' + esc(thread.type) + " · opened " + esc(fmtDate(thread.created)) + "</p>" +
      '<p style="margin:16px 0 0;white-space:pre-wrap">' + esc(thread.details) + '</p><div class="ticket-thread">' +
      replies.map(function(rp){
        var ru = userById(rp.userId);
        return '<div class="comment-row">' + avatarHTML(ru) + '<div style="min-width:0"><span class="nm">' + esc(ru ? ru.name : "Unknown") + "</span>" +
          '<span class="dt">' + esc(fmtDate(rp.created) + ((ru && (ru.role === "admin" || ru.role === "moderator")) ? " · staff" : "")) + "</span>" +
          '<p class="tx">' + esc(rp.body) + "</p></div></div>";
      }).join("") + "</div>";
    if(thread.status !== "closed"){
      h += '<form data-form="support-reply" style="margin-top:16px">' +
        '<label class="sr" for="ticket-reply">Write a reply</label>' +
        '<textarea id="ticket-reply" class="in" rows="3" required maxlength="5000" placeholder="Write your reply…"></textarea>' +
        '<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:10px">' +
        '<button class="btn-ink" type="submit">Send reply</button>' +
        '<button class="btn-ghost" type="button" data-act="support-close" data-id="' + thread.id + '">Close ticket</button></div></form>';
    } else {
      h += '<div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">' +
        '<p style="color:var(--dim);margin:0">This ticket is closed.</p>' +
        '<button class="btn-ghost" type="button" data-act="support-reopen" data-id="' + thread.id + '">Re-open ticket</button></div>';
    }
    h += "</section></div>";
  } else {
    h += '<div class="support-grid"><section class="card p8"><h2 class="sec-h2">Open a ticket</h2>' +
      (ui.supportMsg ? alertHTML(ui.supportMsg.kind, esc(ui.supportMsg.text)) : "") +
      '<form data-form="support-new">' +
      '<div class="field"><span class="lbl">What is the problem about?</span><select aria-label="Problem type" class="in" id="sup-type">' +
      SUPPORT_TYPES.map(function(t){ return '<option value="' + esc(t) + '">' + esc(t) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><span class="lbl">Subject</span><input aria-label="Subject" class="in" id="sup-subject" type="text" required maxlength="150" placeholder="Example: I cannot download my note" /></div>' +
      '<div class="field"><span class="lbl">Details</span><textarea aria-label="Details" class="in" id="sup-details" rows="5" required maxlength="5000" placeholder="Describe the problem — what happened, and where?"></textarea></div>' +
      '<button class="btn-gold" type="submit">Send ticket</button></form></section>' +
      '<section class="card p8"><h2 class="sec-h2">My tickets (' + tickets.length + ")</h2>";
    if(!tickets.length){
      h += '<p style="color:var(--dim);margin:0">No tickets yet. Open one with the form and staff will reply here.</p>';
    } else {
      h += '<ul class="rows">' + tickets.map(function(t){
        return '<li class="row-item"><span class="file-badge" aria-hidden="true">' + icon("user", 18) + "</span>" +
          '<button class="row-main" data-act="go" data-view="support" data-id="' + t.id + '"><b>' + esc(t.subject) + "</b><small>" +
          esc(t.type + " · " + fmtDate(t.created) + " · " + ticketReplies(t.id).length + (ticketReplies(t.id).length === 1 ? " reply" : " replies")) +
          '</small></button><span class="badge-status ' + t.status + '">' + esc(ticketStatusLabel(t.status)) + "</span></li>";
      }).join("") + "</ul>";
    }
    h += "</section></div>";
  }
  return h + "</div></div></div>";
}

/* ---------------- Admin panel ---------------- */

function adminModalsHTML(){
  var m = ui.modal;
  if(!m) return "";
  var body = "", title = "", confirmAct = "", confirmLabel = "";
  if(m.kind === "delete-note"){
    title = "Delete this note?";
    body = "\u201c" + (m.title || "") + "\u201d will be deleted permanently, along with its ratings and comments.";
    confirmAct = "delete-note-confirm"; confirmLabel = "Delete note";
  } else if(m.kind === "delete-user"){
    title = "Delete this user?";
    body = (m.name || "") + " and everything they uploaded, rated and commented will be deleted permanently.";
    confirmAct = "delete-user-confirm"; confirmLabel = "Delete user";
  } else if(m.kind === "suspend-user"){
    title = "Suspend " + (m.name || "") + "?";
    body = "They will not be able to log in or use the portal until you unsuspend them from the Users tab. Their notes, ratings and comments stay as they are — suspension is not deletion, and you can undo it any time.";
    confirmAct = "suspend-user-confirm"; confirmLabel = "Suspend account";
  } else if(m.kind === "reject-user"){
    title = "Reject this sign-up?";
    body = (m.name || "") + "'s account will be deleted permanently.";
    confirmAct = "reject-user-confirm"; confirmLabel = "Reject sign-up";
  } else if(m.kind === "delete-notice"){
    title = "Delete this notice?";
    body = "\u201c" + (m.title || "") + "\u201d will be removed from the notice board for everyone.";
    confirmAct = "delete-notice-confirm"; confirmLabel = "Delete notice";
  } else if(m.kind === "delete-dept"){
    title = "Remove \u201c" + (m.name || "") + "\u201d?";
    body = "The department will be removed from the lists. If it still has courses or members, the removal will be refused.";
    confirmAct = "delete-dept-confirm"; confirmLabel = "Remove department";
  }
  return '<div class="modal-veil" data-act="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
    "<h2>" + esc(title) + "</h2><p class=\"body\">" + esc(body) + "</p>" +
    '<div class="actions"><button class="btn-ghost" data-act="close-modal">Cancel</button>' +
    '<button class="btn-danger" data-act="' + confirmAct + '" data-id="' + (m.id || "") + '"' + (m.name ? ' data-name="' + esc(m.name) + '"' : "") + ">" + esc(confirmLabel) + "</button></div></div></div>";
}

/* ---------------- Render ---------------- */

var countdownTimer = null;

function startResendCountdown(){
  if(countdownTimer){ clearInterval(countdownTimer); countdownTimer = null; }
  var el = document.getElementById("resend-countdown");
  if(!el) return;
  countdownTimer = setInterval(function(){
    var left = Math.ceil((ui.verify.cooldownUntil - now()) / 1000);
    var span = document.getElementById("resend-countdown");
    if(left <= 0 || !span){ clearInterval(countdownTimer); countdownTimer = null; if(left <= 0) render(); return; }
    span.textContent = String(left);
  }, 1000);
}

/* ---------------- Actions (localStorage instead of the API) ---------------- */

function findUserByEmail(email){
  var e = String(email || "").trim().toLowerCase();
  return db.users.find(function(u){ return u.email.toLowerCase() === e; }) || null;
}

function doLogin(email, pw){
  var u = findUserByEmail(email);
  if(!u || u.password !== pw) return { ok: false, error: "Wrong email or password." };
  if(u.suspended) return { ok: false, error: "Your account has been suspended. Please contact the admin." };
  if(!u.verified){
    ui.verify.email = u.email; ui.verify.codeShown = ""; ui.verify.err = ""; ui.verify.info = "";
    ui.verify.heading = "Your email is not verified yet.";
    ui.verify.sub = "Enter the 6-digit code we sent you, or ask for a new one.";
    ui.verifyFromLogin = true;
    var v = db.verifications.find(function(x){ return x.email.toLowerCase() === u.email.toLowerCase(); });
    if(v) ui.verify.codeShown = v.code;
    ui.view = "login";
    return { ok: false, code: "EMAIL_NOT_VERIFIED", error: "Your email is not verified yet." };
  }
  if(!u.approved){
    return { ok: false, error: "Your account is waiting for admin approval." };
  }
  setSession(u);
  ui.loginErr = ""; ui.loginNote = ""; ui.verifyFromLogin = false;
  toast("Welcome back, " + u.name.split(" ")[0] + ".");
  go("upload");
  return { ok: true, user: u };
}

function doRegister(data){
  if(db.users.some(function(u){ return u.email.toLowerCase() === data.email.toLowerCase(); }))
    return { ok: false, error: "An account with this email already exists. Try logging in instead." };
  if(db.users.some(function(u){ return u.studentId === data.studentId; }))
    return { ok: false, error: "An account with this Student ID already exists." };
  var user = { id: db.nextIds.user++, name: data.name, email: data.email, password: data.password,
    role: "student", dept: data.dept, studentId: data.studentId, phone: data.phone,
    approved: false, verified: false, suspended: false, photo: null, joined: now() };
  db.users.push(user);
  var code = genCode();
  db.verifications = db.verifications.filter(function(v){ return v.email.toLowerCase() !== data.email.toLowerCase(); });
  db.verifications.push({ email: data.email, code: code, expires: now() + 15 * 60 * 1000, attempts: 0 });
  saveDb();
  ui.verify.email = data.email; ui.verify.codeShown = code; ui.verify.err = ""; ui.verify.info = "";
  ui.verify.cooldownUntil = 0; ui.verify.done = false;
  ui.verify.heading = "Almost there — check your email.";
  ui.verify.sub = "A 6-digit code is on its way to your inbox.";
  ui.verifyFromLogin = false;
  ui.view = "register";
  return { ok: true, needsVerification: true, email: data.email };
}

function doVerifyEmail(email, code){
  var v = db.verifications.find(function(x){ return x.email.toLowerCase() === String(email).toLowerCase(); });
  if(!v) return { ok: false, error: "The code is wrong or has expired. Ask for a new code and try again." };
  if(v.expires < now()) return { ok: false, error: "The code is wrong or has expired. Ask for a new code and try again." };
  if(v.attempts >= 5){
    db.verifications = db.verifications.filter(function(x){ return x !== v; }); saveDb();
    return { ok: false, error: "The code is wrong or has expired. Ask for a new code and try again." };
  }
  if(v.code !== code){
    v.attempts += 1; saveDb();
    return { ok: false, error: "The code is wrong or has expired. Ask for a new code and try again." };
  }
  var u = findUserByEmail(email);
  if(u){ u.verified = true; }
  db.verifications = db.verifications.filter(function(x){ return x !== v; });
  saveDb();
  ui.verify.codeShown = ""; ui.verify.err = ""; ui.verify.done = true;
  if(ui.verifyFromLogin){
    /* Verified from the Log in page: back to the login form with a note,
       exactly like the hosted site. */
    ui.verifyFromLogin = false; ui.verify.email = "";
    ui.loginNote = "Your email is verified. Please log in again.";
    ui.view = "login";
  } else {
    ui.authDone = true;
    ui.view = "register";
  }
  return { ok: true };
}

function doResendVerification(email){
  var u = findUserByEmail(email);
  if(!u){ ui.verify.info = "If this email is registered and not yet verified, a new code has been sent."; ui.verify.err = ""; return { ok: true }; }
  var code = genCode();
  db.verifications = db.verifications.filter(function(v){ return v.email.toLowerCase() !== String(email).toLowerCase(); });
  db.verifications.push({ email: email, code: code, expires: now() + 15 * 60 * 1000, attempts: 0 });
  saveDb();
  ui.verify.codeShown = code;
  ui.verify.cooldownUntil = now() + 60000;
  ui.verify.info = "A new code was sent to " + email + ".";
  ui.verify.err = "";
  return { ok: true };
}

function doForgot(email){
  var u = findUserByEmail(email);
  if(!u){ ui.forgot.email = String(email || ""); ui.forgot.codeShown = ""; ui.forgot.requested = true; ui.forgot.err = ""; return { ok: true }; }
  var code = genCode();
  db.resets = db.resets.filter(function(r){ return r.email.toLowerCase() !== String(email).toLowerCase(); });
  db.resets.push({ email: u.email, code: code, expires: now() + 15 * 60 * 1000, attempts: 0 });
  saveDb();
  ui.forgot.email = u.email; ui.forgot.codeShown = code; ui.forgot.requested = true; ui.forgot.err = "";
  return { ok: true, code: code };
}

function doResetPassword(email, code, pw){
  var r = db.resets.find(function(x){ return x.email.toLowerCase() === String(email).toLowerCase(); });
  if(!r) return { ok: false, error: "The code is wrong or has expired." };
  if(r.expires < now()) return { ok: false, error: "The code is wrong or has expired." };
  if(r.attempts >= 5){
    db.resets = db.resets.filter(function(x){ return x !== r; }); saveDb();
    return { ok: false, error: "The code is wrong or has expired." };
  }
  if(r.code !== code){ r.attempts += 1; saveDb(); return { ok: false, error: "The code is wrong or has expired." }; }
  var u = findUserByEmail(email);
  if(!u) return { ok: false, error: "The code is wrong or has expired." };
  u.password = pw;
  db.resets = db.resets.filter(function(x){ return x !== r; });
  saveDb();
  ui.forgot = { email: "", codeShown: "", requested: false, err: "" };
  toast("Password changed. Please log in with your new password.");
  go("login");
  return { ok: true };
}

function deleteNoteCascade(id){
  db.notes = db.notes.filter(function(n){ return n.id !== id; });
  db.ratings = db.ratings.filter(function(r){ return r.noteId !== id; });
  db.comments = db.comments.filter(function(c){ return c.noteId !== id; });
  db.bookmarks = db.bookmarks.filter(function(b){ return b.noteId !== id; });
  saveDb();
}

function deleteUserCascade(id){
  var noteIds = db.notes.filter(function(n){ return n.userId === id; }).map(function(n){ return n.id; });
  noteIds.forEach(deleteNoteCascade);
  db.users = db.users.filter(function(u){ return u.id !== id; });
  db.ratings = db.ratings.filter(function(r){ return r.userId !== id; });
  db.comments = db.comments.filter(function(c){ return c.userId !== id; });
  db.bookmarks = db.bookmarks.filter(function(b){ return b.userId !== id; });
  db.tickets = db.tickets.filter(function(t){ return t.userId !== id; });
  db.replies = db.replies.filter(function(r){ return r.userId !== id; });
  db.dismissals = db.dismissals.filter(function(d){ return d.userId !== id; });
  saveDb();
}

function addCourseRecord(dept, sem, code, title){
  var course = { id: db.nextIds.course++, dept: dept, sem: Number(sem), code: cleanCode(code), title: String(title).trim() };
  db.courses.push(course);
  saveDb();
  return course;
}

/* ---------------- Events: ONE delegated click + ONE delegated submit ---------------- */

function val(id){ var el = document.getElementById(id); return el ? el.value : ""; }

function syncDraftInputs(prefix){
  var d = draftForPrefix(prefix);
  if(!d) return;
  if(prefix === "up"){ d.noteTitle = val("up-noteTitle"); d.desc = val("up-desc"); }
  if(prefix === "en"){ d.noteTitle = val("en-noteTitle"); d.desc = val("en-desc"); }
}

function onAct(act, el, ev){
  var id = el.getAttribute("data-id");
  var numId = id != null && /^\d+$/.test(id) ? Number(id) : null;
  switch(act){
    case "go": {
      var view = el.getAttribute("data-view");
      go(view, numId != null ? numId : (el.getAttribute("data-id") || null));
      break;
    }
    case "chip-search": go("browse", null, el.getAttribute("data-q") || ""); break;
    case "theme": toggleTheme(); break;
    case "toggle-acct":
      ui.openDrop = ui.openDrop === "acct" ? null : "acct"; render(); break;
    case "toggle-notif":
      ui.openDrop = ui.openDrop === "notif" ? null : "notif"; render(); break;
    case "toggle-menu":
      ui.mobileOpen = !ui.mobileOpen; render(); break;
    case "logout": logout(); break;
    case "back-top": window.scrollTo({ top: 0, behavior: "smooth" }); break;
    case "dismiss-notice": {
      if(!me) break;
      var dnc = db.notices.find(function(x){ return x.id === numId; });
      if(!dnc){ toast("Notice not found."); break; }
      db.dismissals.push({ userId: me.id, noticeId: numId });
      saveDb(); render(); break;
    }
    case "notif-go":
      ui.openDrop = null;
      go(el.getAttribute("data-view"), numId != null ? numId : (el.getAttribute("data-id") || null));
      break;
    case "notif-notice":
      ui.openDrop = null; go("notices", numId); break;
    case "close-modal": ui.modal = null; ui.editNote = null; render(); break;
    case "rate": {
      if(!me){ toast("Please log in first."); break; }
      var note = noteById(numId);
      if(!note || note.userId === me.id) break;
      var v = Number(el.getAttribute("data-value"));
      var ex = db.ratings.find(function(r){ return r.noteId === numId && r.userId === me.id; });
      if(ex) ex.value = v; else db.ratings.push({ noteId: numId, userId: me.id, value: v });
      saveDb(); toast("Thanks for rating!"); render(); break;
    }
    case "bookmark": {
      if(!me){ toast("Please log in first."); break; }
      var bi = db.bookmarks.findIndex(function(b){ return b.userId === me.id && b.noteId === numId; });
      if(bi >= 0) db.bookmarks.splice(bi, 1); else db.bookmarks.push({ userId: me.id, noteId: numId });
      saveDb(); render(); break;
    }
    case "download": { if(!me){ toast("Please log in first."); break; } var dn = noteById(numId); if(dn) downloadNote(dn); break; }
    case "delete-comment": {
      db.comments = db.comments.filter(function(c){ return c.id !== numId; });
      saveDb(); render(); break;
    }
    case "delete-note-open": {
      var n = noteById(numId);
      ui.modal = { kind: "delete-note", id: numId, title: n ? n.title : "" };
      render(); break;
    }
    case "delete-note-confirm": {
      deleteNoteCascade(numId); ui.modal = null;
      toast("Note deleted.");
      if(ui.view === "note") go("browse"); else render();
      break;
    }
    case "edit-note-open": {
      var en = noteById(numId);
      if(!en) break;
      var c0 = courseOfNote(en);
      ui.editNote = { id: en.id, dept: c0 ? c0.dept : "", sem: c0 ? String(c0.sem) : "",
        code: c0 ? c0.code : "", title: c0 ? c0.title : "",
        noteTitle: en.title, desc: en.desc || "", err: "" };
      render(); break;
    }
    case "note-status": {
      var sn = noteById(numId);
      if(!sn) break;
      sn.status = el.getAttribute("data-status");
      saveDb();
      toast(sn.status === "approved" ? "Note approved." : sn.status === "rejected" ? "Note rejected." : "Note sent back to pending.");
      render(); break;
    }
    case "approve-user": {
      var au = userById(numId);
      if(!au) break;
      au.approved = true; saveDb();
      toast(au.name + " approved — they can log in now."); render(); break;
    }
    case "reject-user-open": {
      var ru = userById(numId);
      ui.modal = { kind: "reject-user", id: numId, name: ru ? ru.name : "" };
      render(); break;
    }
    case "reject-user-confirm": {
      deleteUserCascade(numId); ui.modal = null;
      toast("Sign-up rejected — the account was removed.");
      if(ui.view === "contributor") go("admin"); else render();
      break;
    }
    case "suspend-user-open": {
      var su = userById(numId);
      ui.modal = { kind: "suspend-user", id: numId, name: su ? su.name : "" };
      render(); break;
    }
    case "suspend-user-confirm": {
      var su2 = userById(numId);
      if(su2){ su2.suspended = true; saveDb(); toast(su2.name + " has been suspended."); }
      ui.modal = null; render(); break;
    }
    case "unsuspend-user": {
      var uu = userById(numId);
      if(uu){ uu.suspended = false; saveDb(); toast(uu.name + " has been unsuspended and can log in again."); }
      render(); break;
    }
    case "delete-user-open": {
      var du = userById(numId);
      ui.modal = { kind: "delete-user", id: numId, name: du ? du.name : "" };
      render(); break;
    }
    case "delete-user-confirm": {
      deleteUserCascade(numId); ui.modal = null;
      toast("User deleted."); render(); break;
    }
    case "notice-edit": {
      var nc = db.notices.find(function(x){ return x.id === numId; });
      if(!nc) break;
      ui.admin.editingNoticeId = nc.id;
      ui.admin.noticeTitle = nc.title; ui.admin.noticeBody = nc.body;
      ui.admin.noticePin = nc.important ? "important" : nc.pinned ? "pinned" : "normal";
      ui.admin.noticeMsg = null; render(); break;
    }
    case "notice-cancel-edit":
      ui.admin.editingNoticeId = null; ui.admin.noticeTitle = ""; ui.admin.noticeBody = "";
      ui.admin.noticePin = "normal"; ui.admin.noticeMsg = null; render(); break;
    case "notice-pin": {
      var np = db.notices.find(function(x){ return x.id === numId; });
      if(np){ np.pinned = !np.pinned; saveDb(); toast(np.pinned ? "Notice pinned to the top." : "Notice unpinned."); }
      render(); break;
    }
    case "notice-important": {
      var ni = db.notices.find(function(x){ return x.id === numId; });
      if(!ni){ toast("Notice not found."); break; }
      ni.important = !ni.important; saveDb(); toast(ni.important ? "Notice marked important — it shows as a banner for logged-in members." : "Notice is no longer important.");
      render(); break;
    }
    case "notice-delete-open": {
      var nd = db.notices.find(function(x){ return x.id === numId; });
      ui.modal = { kind: "delete-notice", id: numId, title: nd ? nd.title : "" };
      render(); break;
    }
    case "delete-notice-confirm": {
      db.notices = db.notices.filter(function(x){ return x.id !== numId; });
      if(ui.admin.editingNoticeId === numId){
        ui.admin.editingNoticeId = null; ui.admin.noticeTitle = ""; ui.admin.noticeBody = ""; ui.admin.noticePin = "normal";
      }
      saveDb(); ui.modal = null; toast("Notice deleted."); render(); break;
    }
    case "admin-tab": ui.adminTab = el.getAttribute("data-tab"); render(); break;
    case "course-edit-open": {
      var ce = db.courses.find(function(x){ return x.id === numId; });
      if(!ce) break;
      ui.editCourse = { id: ce.id, dept: ce.dept, sem: String(ce.sem), code: ce.code, title: ce.title, err: "" };
      render(); break;
    }
    case "course-edit-cancel": ui.editCourse = null; render(); break;
    case "course-delete": {
      var cd = db.courses.find(function(x){ return x.id === numId; });
      if(!cd) break;
      var used = db.notes.filter(function(n){ return n.courseId === cd.id; }).length;
      if(used){ toast("This course still has notes. Delete those notes first."); break; }
      db.courses = db.courses.filter(function(x){ return x.id !== numId; });
      saveDb(); toast("Course deleted."); render(); break;
    }
    case "dept-rename-open":
      ui.admin.renamingId = el.getAttribute("data-name"); ui.admin.renameVal = el.getAttribute("data-name"); render(); break;
    case "dept-rename-cancel": ui.admin.renamingId = null; render(); break;
    case "dept-rename-save": {
      var oldName = el.getAttribute("data-name");
      var newName = (val("dept-rename-val") || "").trim();
      if(newName.length < 2){ toast("Give the department a name."); break; }
      if(db.departments.some(function(d){ return d.toLowerCase() === newName.toLowerCase() && d !== oldName; })){
        toast("A department with that name already exists."); break;
      }
      db.departments = db.departments.map(function(d){ return d === oldName ? newName : d; });
      db.courses.forEach(function(c){ if(c.dept === oldName) c.dept = newName; });
      db.users.forEach(function(u){ if(u.dept === oldName) u.dept = newName; });
      saveDb(); ui.admin.renamingId = null;
      toast("Department renamed — courses and members follow the new name."); render(); break;
    }
    case "dept-delete-open":
      ui.modal = { kind: "delete-dept", name: el.getAttribute("data-name") };
      render(); break;
    case "delete-dept-confirm": {
      var name = el.getAttribute("data-name");
      var deptCourseCount = db.courses.filter(function(c){ return c.dept === name; }).length;
      var deptMemberCount = db.users.filter(function(u){ return u.dept === name; }).length;
      ui.modal = null;
      if(deptCourseCount > 0){
        toast(name + " still has " + deptCourseCount + " course(s) in the catalogue. Delete those courses first, then remove the department.");
        render(); break;
      }
      if(deptMemberCount > 0){
        toast(name + " still has " + deptMemberCount + " member(s). Move those members to another department first, then remove it.");
        render(); break;
      }
      db.departments = db.departments.filter(function(d){ return d !== name; });
      saveDb(); toast("Department removed."); render(); break;
    }
    case "support-close": {
      var tc = db.tickets.find(function(t){ return t.id === numId; });
      if(tc){ tc.status = "closed"; tc.updated = now(); saveDb(); }
      render(); break;
    }
    case "support-reopen": {
      var tr = db.tickets.find(function(t){ return t.id === numId; });
      if(tr){ tr.status = "open"; tr.updated = now(); saveDb(); }
      render(); break;
    }
    case "admin-support-open": ui.admin.supportSel = numId; render(); break;
    case "resend-code": {
      var r = doResendVerification(ui.verify.email);
      if(!r.ok){ ui.verify.err = r.error; ui.verify.info = ""; }
      render(); break;
    }
    case "pick-photo": { var pi = document.getElementById("photo-input"); if(pi) pi.click(); break; }
    case "remove-photo": {
      if(me){ me.photo = null; saveDb(); ui.profileMsg = { kind: "success", text: "Profile photo removed." }; }
      render(); break;
    }
    case "show-more": ui.browse.shown += PAGE_STEP; renderBrowseResults(); break;
    case "clear-filters":
      ui.browse = { q: "", dept: "", sem: "", courseId: "", sort: "newest", shown: PAGE_STEP };
      render(); break;
  }
}

document.addEventListener("click", function(ev){
  var t = ev.target;
  var el = t && t.closest ? t.closest("[data-act]") : null;
  /* Clicks inside a modal must not close it via the veil behind it */
  if(el && el.classList.contains("modal-veil") && t.closest && t.closest(".modal")) return;
  if(el){
    if(el.classList.contains("modal-veil") && t !== el) return;
    onAct(el.getAttribute("data-act"), el, ev);
    return;
  }
  /* Outside click closes the account / notification dropdowns */
  if(ui.openDrop && !(t.closest && t.closest("[data-drop]"))){
    ui.openDrop = null; render();
  }
});

document.addEventListener("keydown", function(ev){
  if(ev.key === "Escape"){
    if(ui.modal || ui.editNote){ ui.modal = null; ui.editNote = null; render(); }
    else if(ui.openDrop || ui.mobileOpen){ ui.openDrop = null; ui.mobileOpen = false; render(); }
  }
});

/* File inputs: upload file + profile photo (FileReader, canvas downscale) */

function handleUploadFile(file){
  var d = ui.upload;
  d.fileName = file ? file.name : ""; d.fileSize = file ? file.size : 0; d.fileData = null; d.fileReading = false;
  if(!file){ render(); return; }
  if(file.size > UPLOAD_FILE_MAX){ d.err = "File is too large (maximum 10 MB)."; render(); return; }
  var kind = noteFileKind({ fileName: file.name });
  if((kind === "pdf" || kind === "image") && file.size <= UPLOAD_VIEW_MAX){
    d.fileReading = true;
    var rd = new FileReader();
    rd.onload = function(){ d.fileData = String(rd.result || ""); d.fileReading = false; d.err = ""; render(); };
    rd.readAsDataURL(file);
  } else {
    /* Larger files, and Word/PowerPoint, are stored by name only */
    d.err = "";
    render();
  }
}

function handlePhotoFile(file){
  if(!file) return;
  if(!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)){
    ui.profileMsg = { kind: "error", text: "Please choose a JPG, PNG, GIF or WebP photo." }; render(); return;
  }
  if(file.size > PHOTO_MAX){
    ui.profileMsg = { kind: "error", text: "Photo is too large (maximum 8 MB)." }; render(); return;
  }
  var rd = new FileReader();
  rd.onload = function(){
    var img = new Image();
    img.onload = function(){
      var url = String(rd.result || "");
      try{
        var size = 256;
        var canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        var ctx = canvas.getContext("2d");
        var side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        url = canvas.toDataURL("image/jpeg", 0.85);
      }catch(err){ /* canvas unavailable — use the file as-is */ }
      if(me){ me.photo = url; saveDb(); ui.profileMsg = { kind: "success", text: "Profile photo saved." }; }
      render();
    };
    img.onerror = function(){ ui.profileMsg = { kind: "error", text: "That photo could not be read." }; render(); };
    img.src = String(rd.result || "");
  };
  rd.readAsDataURL(file);
}

document.addEventListener("change", function(ev){
  var el = ev.target;
  if(!el) return;
  if(el.id === "up-file"){ handleUploadFile(el.files && el.files[0]); return; }
  if(el.id === "photo-input"){ handlePhotoFile(el.files && el.files[0]); el.value = ""; return; }
  if(el.getAttribute("data-cf")){
    var prefix = el.getAttribute("data-cf");
    var field = el.getAttribute("data-cf-field");
    var d = draftForPrefix(prefix);
    if(!d) return;
    syncDraftInputs(prefix);
    if(field === "dept"){ d.dept = el.value; d.sem = ""; d.code = ""; d.title = ""; }
    if(field === "sem"){ d.sem = el.value; d.code = ""; d.title = ""; }
    render();
    return;
  }
  if(el.getAttribute("data-bf")){
    var k = el.getAttribute("data-bf");
    ui.browse[k] = el.value;
    if(k === "dept" || k === "sem") ui.browse.courseId = "";
    ui.browse.shown = PAGE_STEP;
    render();
    return;
  }
  if(el.getAttribute("data-role-user")){
    var uid = Number(el.getAttribute("data-role-user"));
    var u = userById(uid);
    if(u && u.id !== me.id){
      u.role = el.value; saveDb();
      toast(u.name + " is now " + (u.role === "admin" ? "an admin" : u.role === "moderator" ? "a moderator" : "a student") + ".");
    }
    render();
    return;
  }
  if(el.id){
    ui.drafts[el.id] = el.value;
    if(el.id === "notice-pin") ui.admin.noticePin = el.value;
    if(el.id === "staff-dept") ui.admin.staffDept = el.value;
    if(el.id === "staff-role") ui.admin.staffRole = el.value;
  }
});

var searchTimer = null;

document.addEventListener("input", function(ev){
  var el = ev.target;
  if(!el || !el.id && !el.getAttribute("data-cf-field")) return;
  if(el.id) ui.drafts[el.id] = el.value;
  /* Digit-only fields */
  if(el.id === "reg-studentId" || el.id === "prof-studentId"){
    var sd = el.value.replace(/[^0-9]/g, "").slice(0, 12);
    if(el.value !== sd){ el.value = sd; ui.drafts[el.id] = sd; }
    return;
  }
  if(el.id === "reg-phone" || el.id === "prof-phone"){
    var ph = el.value.replace(/[^0-9]/g, "").slice(0, 15);
    if(el.value !== ph){ el.value = ph; ui.drafts[el.id] = ph; }
    return;
  }
  if(el.id === "verify-code" || el.id === "forgot-code"){
    var cd = el.value.replace(/[^0-9]/g, "").slice(0, 6);
    if(el.value !== cd){ el.value = cd; ui.drafts[el.id] = cd; }
    return;
  }
  /* Browse keyword search — update the results only, keep focus */
  if(el.id === "browse-q"){
    ui.browse.q = el.value; ui.browse.shown = PAGE_STEP;
    if(searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(renderBrowseResults, 220);
    return;
  }
  /* Course code / title autofill (upload, admin add/edit, edit note) */
  if(el.getAttribute("data-cf-field")){
    var prefix = el.getAttribute("data-cf");
    var field = el.getAttribute("data-cf-field");
    var d = draftForPrefix(prefix);
    if(!d) return;
    if(field === "code"){
      var clean = cleanCode(el.value);
      if(el.value !== clean) el.value = clean;
      d.code = clean;
      if(d.dept && d.sem){
        var hit = coursePool(d.dept, d.sem).find(function(c){ return normCode(c.code) === normCode(clean); });
        if(hit){
          d.title = hit.title;
          var tEl = document.getElementById(prefix + "-title");
          if(tEl) tEl.value = hit.title;
        }
      }
    }
    if(field === "title"){
      d.title = el.value;
      if(d.dept && d.sem){
        var hit2 = coursePool(d.dept, d.sem).find(function(c){ return c.title.toLowerCase() === el.value.trim().toLowerCase(); });
        if(hit2){
          d.code = hit2.code;
          var cEl = document.getElementById(prefix + "-code");
          if(cEl) cEl.value = hit2.code;
        }
      }
    }
    return;
  }
  /* Draft-backed text fields */
  if(el.id === "up-noteTitle") ui.upload.noteTitle = el.value;
  if(el.id === "up-desc") ui.upload.desc = el.value;
  if(el.id === "en-noteTitle" && ui.editNote) ui.editNote.noteTitle = el.value;
  if(el.id === "en-desc" && ui.editNote) ui.editNote.desc = el.value;
  if(el.id === "notice-title") ui.admin.noticeTitle = el.value;
  if(el.id === "notice-body") ui.admin.noticeBody = el.value;
  if(el.id === "staff-name") ui.admin.staffName = el.value;
  if(el.id === "staff-email") ui.admin.staffEmail = el.value;
  if(el.id === "dept-name") ui.admin.deptName = el.value;
  if(el.id === "dept-rename-val") ui.admin.renameVal = el.value;
});

/* ---------------- Forms: ONE delegated submit ---------------- */

document.addEventListener("submit", function(ev){
  var form = ev.target && ev.target.closest ? ev.target.closest("form[data-form]") : null;
  if(!form) return;
  ev.preventDefault();
  var kind = form.getAttribute("data-form");
  if(kind === "home-search"){ go("browse", null, val("hero-q")); return; }
  if(kind === "browse-filters"){ return; }
  if(kind === "login"){
    ui.loginErr = ""; ui.loginNote = "";
    var r = doLogin(val("login-email"), val("login-pw"));
    if(!r.ok){
      if(r.code === "EMAIL_NOT_VERIFIED"){ render(); return; }
      ui.loginErr = r.error; render();
    }
    return;
  }
  if(kind === "register"){
    ui.registerErr = "";
    var name = val("reg-name").trim(), email = val("reg-email").trim();
    var pw = val("reg-pw"), dept = val("reg-dept");
    var sid = val("reg-studentId").trim(), phone = val("reg-phone").trim();
    if(!name){ ui.registerErr = "Type your full name."; render(); return; }
    if(!/^\S+@\S+\.\S+$/.test(email)){ ui.registerErr = "Enter a valid email address."; render(); return; }
    if(pw.length < 8){ ui.registerErr = "Password must be at least 8 characters."; render(); return; }
    if(!/^\d{12}$/.test(sid)){ ui.registerErr = "Student ID must be exactly 12 numbers — digits only, no letters or spaces."; render(); return; }
    if(!/^\d{10,15}$/.test(phone)){ ui.registerErr = "Phone number must be 10 to 15 digits."; render(); return; }
    if(!dept){ ui.registerErr = "Pick your department."; render(); return; }
    var rr = doRegister({ name: name, email: email, dept: dept, password: pw, studentId: sid, phone: phone });
    if(!rr.ok){ ui.registerErr = rr.error; }
    ["reg-name", "reg-email", "reg-pw", "reg-studentId", "reg-phone", "reg-dept"].forEach(function(k){ delete ui.drafts[k]; });
    render();
    return;
  }
  if(kind === "verify"){
    var code = val("verify-code").trim();
    if(!/^\d{6}$/.test(code)){ ui.verify.err = "Enter the 6-digit code from your email."; render(); return; }
    var vr = doVerifyEmail(ui.verify.email, code);
    if(!vr.ok){ ui.verify.err = vr.error; }
    delete ui.drafts["verify-code"];
    render();
    return;
  }
  if(kind === "forgot-request"){
    var fr = doForgot(val("forgot-email"));
    if(!fr.ok){ ui.forgot.err = fr.error; }
    render();
    return;
  }
  if(kind === "forgot-reset"){
    var typed = val("forgot-code").trim(), npw = val("forgot-pw");
    if(!typed){ ui.forgot.err = "Type the 6-digit code."; render(); return; }
    if(npw.length < 8){ ui.forgot.err = "New password must be at least 8 characters."; render(); return; }
    var rz = doResetPassword(ui.forgot.email, typed, npw);
    if(!rz.ok){ ui.forgot.err = rz.error; }
    delete ui.drafts["forgot-code"]; delete ui.drafts["forgot-pw"];
    render();
    return;
  }
  if(kind === "upload"){
    var d = ui.upload;
    d.noteTitle = val("up-noteTitle"); d.desc = val("up-desc");
    d.err = "";
    var res = resolveCourse(d.dept, d.sem, d.code, d.title);
    if(res.error){ d.err = res.error; render(); return; }
    if(!d.noteTitle.trim()){ d.err = "Please give your note a title."; render(); return; }
    if(!d.fileName){ d.err = "Please choose a file to upload."; render(); return; }
    if(d.fileSize > UPLOAD_FILE_MAX){ d.err = "File is too large (maximum 10 MB)."; render(); return; }
    if(d.fileReading){ d.err = "The file is still being read — please wait a moment and try again."; render(); return; }
    var course = res.created ? addCourseRecord(res.course.dept, res.course.sem, res.course.code, res.course.title) : res.course;
    var note = { id: db.nextIds.note++, userId: me.id, courseId: course.id,
      title: d.noteTitle.trim(), desc: d.desc.trim(), fileName: d.fileName,
      fileType: fileTypeOf({ fileName: d.fileName }), fileData: d.fileData || null,
      fileSize: d.fileSize, status: isAdminUser(me) ? "approved" : "pending",
      downloads: 0, created: now() };
    db.notes.push(note);
    saveDb();
    var createdMsg = res.created;
    ui.upload = freshUpload();
    toast(note.status === "approved" ? "Uploaded and published."
      : createdMsg ? "Uploaded! Your note is pending until an admin approves it — and the new course was added to the catalogue."
      : "Uploaded! Your note is pending until an admin approves it.");
    go("upload");
    return;
  }
  if(kind === "comment"){
    var text = val("cm").trim();
    if(!text || !me) return;
    db.comments.push({ id: db.nextIds.comment++, noteId: ui.noteId, userId: me.id, text: text, created: now() });
    saveDb(); render();
    return;
  }
  if(kind === "support-new"){
    var stype = val("sup-type"), subj = val("sup-subject").trim(), det = val("sup-details").trim();
    if(!subj){ ui.supportMsg = { kind: "error", text: "Please write a subject for your problem." }; render(); return; }
    if(!det){ ui.supportMsg = { kind: "error", text: "Please describe the problem." }; render(); return; }
    db.tickets.push({ id: db.nextIds.ticket++, userId: me.id, type: stype, subject: subj, details: det, status: "open", created: now(), updated: now() });
    saveDb();
    ui.supportMsg = { kind: "success", text: "Your ticket was sent. An admin or moderator will reply here." };
    ["sup-subject", "sup-details"].forEach(function(k){ delete ui.drafts[k]; });
    render();
    return;
  }
  if(kind === "support-reply"){
    var rb = val("ticket-reply").trim();
    if(!rb) return;
    var t = db.tickets.find(function(x){ return x.id === ui.supportTicketId; });
    if(t){
      db.replies.push({ id: db.nextIds.reply++, ticketId: t.id, userId: me.id, body: rb, created: now() });
      t.status = "open"; t.updated = now();
      saveDb();
    }
    render();
    return;
  }
  if(kind === "admin-support-reply"){
    var arb = val("admin-ticket-reply").trim();
    if(!arb) return;
    var at = db.tickets.find(function(x){ return x.id === ui.admin.supportSel; });
    if(at){
      db.replies.push({ id: db.nextIds.reply++, ticketId: at.id, userId: me.id, body: arb, created: now() });
      at.status = "answered"; at.updated = now();
      saveDb();
    }
    render();
    return;
  }
  if(kind === "profile"){
    ui.profileMsg = null;
    var pname = val("prof-name").trim(), pdept = val("prof-dept");
    var psid = val("prof-studentId").trim(), pphone = val("prof-phone").trim();
    if(!pname){ ui.profileMsg = { kind: "error", text: "Your name cannot be empty." }; render(); return; }
    if(!/^\d{12}$/.test(psid)){ ui.profileMsg = { kind: "error", text: "Student ID must be exactly 12 numbers — digits only, no letters or spaces." }; render(); return; }
    if(!/^\d{10,15}$/.test(pphone)){ ui.profileMsg = { kind: "error", text: "Phone number must be 10 to 15 digits." }; render(); return; }
    if(db.users.some(function(u){ return u.id !== me.id && u.studentId === psid; })){
      ui.profileMsg = { kind: "error", text: "An account with this Student ID already exists." }; render(); return;
    }
    me.name = pname; me.dept = pdept; me.studentId = psid; me.phone = pphone;
    saveDb();
    ui.profileMsg = { kind: "success", text: "Profile saved." };
    ["prof-name", "prof-dept", "prof-studentId", "prof-phone"].forEach(function(k){ delete ui.drafts[k]; });
    render();
    return;
  }
  if(kind === "change-password"){
    ui.passMsg = null;
    var cur = val("pw-cur"), npw2 = val("pw-new"), npw3 = val("pw-new2");
    if(npw2.length < 8){ ui.passMsg = { kind: "error", text: "New password must be at least 8 characters." }; render(); return; }
    if(npw2 !== npw3){ ui.passMsg = { kind: "error", text: "The new passwords do not match." }; render(); return; }
    if(me.password !== cur){ ui.passMsg = { kind: "error", text: "Current password is wrong." }; render(); return; }
    me.password = npw2; saveDb();
    ui.passMsg = { kind: "success", text: "Password changed." };
    ["pw-cur", "pw-new", "pw-new2"].forEach(function(k){ delete ui.drafts[k]; });
    render();
    return;
  }
  if(kind === "notice"){
    var a = ui.admin;
    a.noticeTitle = val("notice-title"); a.noticeBody = val("notice-body"); a.noticePin = val("notice-pin");
    a.noticeMsg = null;
    if(!a.noticeTitle.trim()){ a.noticeMsg = { kind: "error", text: "Give the notice a title." }; render(); return; }
    if(!a.noticeBody.trim()){ a.noticeMsg = { kind: "error", text: "Write the notice text." }; render(); return; }
    var pinned = a.noticePin === "pinned", important = a.noticePin === "important";
    if(a.editingNoticeId){
      var en2 = db.notices.find(function(x){ return x.id === a.editingNoticeId; });
      if(en2){ en2.title = a.noticeTitle.trim(); en2.body = a.noticeBody.trim(); en2.pinned = pinned; en2.important = important; }
      saveDb();
      toast("Notice updated — it is live on the notice board.");
    } else {
      db.notices.push({ id: db.nextIds.notice++, authorId: me.id, pinned: pinned, important: important,
        title: a.noticeTitle.trim(), body: a.noticeBody.trim(), created: now() });
      saveDb();
      toast("Notice posted — everyone can see it on the Home notice board.");
    }
    a.editingNoticeId = null; a.noticeTitle = ""; a.noticeBody = ""; a.noticePin = "normal"; a.noticeMsg = null;
    render();
    return;
  }
  if(kind === "staff"){
    var sa = ui.admin;
    sa.staffName = val("staff-name"); sa.staffEmail = val("staff-email");
    sa.staffDept = val("staff-dept"); sa.staffRole = val("staff-role");
    var spw = val("staff-pw");
    sa.staffMsg = null;
    if(sa.staffName.trim().length < 2){ sa.staffMsg = { kind: "error", text: "Please enter the person's full name." }; render(); return; }
    if(!/^\S+@\S+\.\S+$/.test(sa.staffEmail.trim())){ sa.staffMsg = { kind: "error", text: "Enter a valid email address." }; render(); return; }
    if(spw.length < 8){ sa.staffMsg = { kind: "error", text: "Password must be at least 8 characters." }; render(); return; }
    if(db.users.some(function(u){ return u.email.toLowerCase() === sa.staffEmail.trim().toLowerCase(); })){
      sa.staffMsg = { kind: "error", text: "An account with this email already exists — change their role in the list below instead." };
      render(); return;
    }
    db.users.push({ id: db.nextIds.user++, name: sa.staffName.trim(), email: sa.staffEmail.trim(),
      password: spw, role: sa.staffRole, dept: sa.staffDept, studentId: "", phone: "",
      approved: true, verified: true, suspended: false, photo: null, joined: now() });
    saveDb();
    toast(sa.staffName.trim() + " added as " + (sa.staffRole === "admin" ? "an admin" : "a moderator") + ". They can log in right away.");
    sa.staffName = ""; sa.staffEmail = ""; sa.staffDept = "CSE"; sa.staffPw = ""; sa.staffRole = "moderator"; sa.staffMsg = null;
    delete ui.drafts["staff-pw"];
    render();
    return;
  }
  if(kind === "dept-add"){
    var da = ui.admin;
    da.deptName = val("dept-name");
    da.deptMsg = null;
    if(da.deptName.trim().length < 2){ da.deptMsg = { kind: "error", text: "Give the department a name." }; render(); return; }
    if(db.departments.some(function(d){ return d.toLowerCase() === da.deptName.trim().toLowerCase(); })){
      da.deptMsg = { kind: "error", text: "A department with that name already exists." }; render(); return;
    }
    db.departments.push(da.deptName.trim());
    saveDb(); da.deptName = "";
    da.deptMsg = { kind: "success", text: "Department added." };
    render();
    return;
  }
  if(kind === "course-add"){
    var ca = ui.courseAdd;
    ui.courseAddMsg = null;
    var cres = resolveCourse(ca.dept, ca.sem, ca.code, ca.title);
    if(cres.error){ ui.courseAddMsg = { kind: "error", text: cres.error }; render(); return; }
    if(!cres.created){ ui.courseAddMsg = { kind: "error", text: "That course is already in the catalogue (" + cres.course.code + " — " + cres.course.title + ")." }; render(); return; }
    addCourseRecord(ca.dept, ca.sem, ca.code, ca.title);
    ui.courseAdd = freshCourseDraft();
    ui.courseAddMsg = { kind: "success", text: "Course added." };
    render();
    return;
  }
  if(kind === "course-edit"){
    var ce = ui.editCourse;
    if(!ce) return;
    ce.err = "";
    var eres = resolveCourse(ce.dept, ce.sem, ce.code, ce.title, ce.id);
    if(eres.error){ ce.err = eres.error; render(); return; }
    if(!eres.created && eres.course.id !== ce.id){
      ce.err = "That course is already in the catalogue (" + eres.course.code + " — " + eres.course.title + ").";
      render(); return;
    }
    var target = db.courses.find(function(x){ return x.id === ce.id; });
    if(target){
      target.dept = ce.dept; target.sem = Number(ce.sem);
      target.code = cleanCode(ce.code); target.title = ce.title.trim();
      saveDb();
    }
    ui.editCourse = null;
    toast("Course updated — notes linked to it show the corrected code and title.");
    render();
    return;
  }
  if(kind === "edit-note"){
    var en3 = ui.editNote;
    if(!en3) return;
    en3.noteTitle = val("en-noteTitle"); en3.desc = val("en-desc");
    en3.err = "";
    var nres = resolveCourse(en3.dept, en3.sem, en3.code, en3.title, noteById(en3.id) ? noteById(en3.id).courseId : undefined);
    if(nres.error){ en3.err = nres.error; render(); return; }
    if(!en3.noteTitle.trim()){ en3.err = "Please give your note a title."; render(); return; }
    var ncourse = nres.created ? addCourseRecord(nres.course.dept, nres.course.sem, nres.course.code, nres.course.title) : nres.course;
    var targetNote = noteById(en3.id);
    if(targetNote){
      targetNote.courseId = ncourse.id;
      targetNote.title = en3.noteTitle.trim();
      targetNote.desc = en3.desc.trim();
      saveDb();
    }
    ui.editNote = null;
    toast("Note updated.");
    render();
    return;
  }
});

/* ---------------- Init ---------------- */

function init(){
  loadDb();
  loadSession();
  if(!me){ setSession(userById(2)); } /* Always logged in (demo student Rafiq) — Purnima's auth part is the only one without auto-login. */
  ui.theme = themeNow();
  document.documentElement.setAttribute("data-theme", ui.theme);
  render();
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function bodyHTML(){
  if(me && me.suspended){
    /* A suspended account is signed out of everything until an admin unsuspends it */
    return '<div class="view"><div class="wrap"><div class="page">' +
      emptyStateHTML("Your account is suspended", "An admin has suspended this account, so you cannot upload, download or comment right now. If you think this is a mistake, contact the portal admin.",
        '<button class="btn-ink" data-act="logout">Log out</button>') + "</div></div></div>";
  }
  switch(ui.view){
    case "notices": return noticeBoardHTML();
    case "support": return supportHTML();
    case "upload": return uploadHTML();
    case "login": return loginHTML();
    case "verify": return verifyHTML(ui.verify.email, ui.verify.heading || "Check your email", ui.verify.sub || "Enter the 6-digit code.", ui.verifyFromLogin);
    default: return notInAppHTML();
  }
}

function render(){
  var app = document.getElementById("app");
  if(!app) return;
  app.innerHTML = stripOtherViews(headerHTML() + importantBannerHTML() + "<main>" + bodyHTML() + "</main>" + footerHTML() +
    (ui.editNote ? editNoteModalHTML() : "") +
    (ui.modal ? adminModalsHTML() : "") +
    '<div id="toast-slot">' + (ui.toastMsg ? '<div class="toast" role="status">' + esc(ui.toastMsg) + "</div>" : "") + "</div>");
  runCountUps();
  startResendCountdown();
}
