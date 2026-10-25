// /admin/ editor: Google sign-in, forms for gigs, links, bio and texts.
// Content is read and committed by the getContent/saveContent Cloud Functions
// (functions/index.js); the commit triggers the usual build + deploy.
// The Firebase config comes from Hosting's reserved /__/firebase/init.json,
// so nothing project-specific lives in this file.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const $ = (id) => document.getElementById(id);
const PARTS = ["band", "gigs", "i18n", "bio"];
const LANGS = ["it", "en"];

let content = null; // what the forms edit: { band, gigs, i18n, bio }
let saved = {}; // JSON of each part as last loaded, to spot unsaved edits
let baseSha = null; // commit the edits are based on

// ---- Firebase ------------------------------------------------------------

const app = initializeApp(await (await fetch("/__/firebase/init.json")).json());
const auth = getAuth(app);
const functions = getFunctions(app, "europe-west1");
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
const getContent = httpsCallable(functions, "getContent");
const saveContent = httpsCallable(functions, "saveContent");

// ---- DOM helpers ---------------------------------------------------------

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  el.append(...children.flat());
  return el;
}

// A labelled input; `set` receives the new value on every keystroke.
function field(label, value, set, { type = "text", multiline = false, ...attrs } = {}) {
  const input = multiline
    ? h("textarea", { rows: 18, ...attrs })
    : h("input", { type, ...attrs });
  input.value = value ?? "";
  input.addEventListener("input", () => {
    set(input.value);
    onEdit();
  });
  return h("label", { class: "adm-field" }, h("span", {}, label), input);
}

function check(label, value, set) {
  const input = h("input", { type: "checkbox", checked: !!value });
  input.addEventListener("change", () => {
    set(input.checked);
    onEdit();
  });
  return h("label", { class: "adm-check" }, input, h("span", {}, label));
}

const button = (label, onclick, attrs = {}) => h("button", { type: "button", class: "adm-btn adm-btn--small", onclick, ...attrs }, label);

// Set or remove an optional key, so a cleared field doesn't leave "".
const setOpt = (obj, key) => (v) => (v ? (obj[key] = v) : delete obj[key]);

// ---- Sections ------------------------------------------------------------

function renderGigs() {
  const today = new Date().toISOString().slice(0, 10);
  $("gigs").replaceChildren(
    ...content.gigs.map((g, i) =>
      h(
        "div",
        { class: `adm-row${g.date && g.date < today ? " adm-row--past" : ""}` },
        h(
          "div",
          { class: "adm-grid4" },
          field("Date", g.date, (v) => (g.date = v), { type: "date", required: true }),
          field("City", g.city, (v) => (g.city = v), { required: true }),
          field("Venue", g.venue, (v) => (g.venue = v), { required: true }),
          field("Link", g.url, setOpt(g, "url"), { type: "url", placeholder: "https://…" }),
        ),
        h("div", { class: "adm-actions" }, button("Delete", () => remove(content.gigs, i, renderGigs))),
      ),
    ),
  );
}

function renderLinks() {
  const { links } = content.band;
  $("links").replaceChildren(
    ...links.map((l, i) => {
      const kind = l.page != null ? "page" : "url";
      const select = h(
        "select",
        {
          onchange: (e) => {
            const target = l.url ?? l.page ?? "";
            delete l.url;
            delete l.page;
            l[e.target.value] = target;
            renderLinks();
            onEdit();
          },
        },
        h("option", { value: "url", selected: kind === "url" }, "External URL"),
        h("option", { value: "page", selected: kind === "page" }, "Page of the site"),
      );
      return h(
        "div",
        { class: "adm-row" },
        h(
          "div",
          { class: "adm-grid4" },
          field("Id (icon)", l.id, (v) => (l.id = v), { required: true, list: "link-ids" }),
          field("Label it", l.label.it, (v) => (l.label.it = v), { required: true }),
          field("Label en", l.label.en, (v) => (l.label.en = v), { required: true }),
          h("label", { class: "adm-field" }, h("span", {}, "Type"), select),
        ),
        field(kind === "url" ? "URL" : "Page", l[kind], (v) => (l[kind] = v), {
          placeholder: kind === "url" ? "https://… or /assets/…" : "/bio/",
        }),
        h(
          "div",
          { class: "adm-actions" },
          check("Highlighted", l.featured, setOpt(l, "featured")),
          check("New tab", l.newTab, setOpt(l, "newTab")),
          h("span", { class: "adm-spacer" }),
          button("↑", () => move(links, i, -1, renderLinks), { disabled: i === 0, "aria-label": "Move up" }),
          button("↓", () => move(links, i, 1, renderLinks), { disabled: i === links.length - 1, "aria-label": "Move down" }),
          button("Delete", () => remove(links, i, renderLinks)),
        ),
      );
    }),
    h("datalist", { id: "link-ids" }, ...["instagram", "bandcamp", "presskit", "bio", "rider"].map((v) => h("option", { value: v }))),
  );
}

function renderBio() {
  $("bio").replaceChildren(
    ...LANGS.map((lang) => field(`Bio ${lang}`, content.bio[lang], (v) => (content.bio[lang] = v), { multiline: true })),
  );
}

// Genre, tagline and email from band.json, then every key of i18n.json.
function renderTexts() {
  const { band, i18n } = content;
  const pair = (label, get, set, attrs) =>
    h("div", { class: "adm-grid2" }, ...LANGS.map((lang) => field(`${label} ${lang}`, get(lang), (v) => set(lang, v), attrs)));
  $("texts").replaceChildren(
    pair("Genre", (l) => band.genre[l], (l, v) => (band.genre[l] = v)),
    pair("Tagline", (l) => band.tagline[l], (l, v) => (band.tagline[l] = v)),
    field("Booking email", band.email, (v) => (band.email = v), { type: "email", required: true }),
    h("h3", {}, "Page texts"),
    ...Object.keys(i18n[LANGS[0]]).map((key) =>
      pair(key, (l) => i18n[l]?.[key], (l, v) => ((i18n[l] ??= {})[key] = v)),
    ),
  );
}

function remove(list, i, render) {
  list.splice(i, 1);
  render();
  onEdit();
}

function move(list, i, by, render) {
  [list[i], list[i + by]] = [list[i + by], list[i]];
  render();
  onEdit();
}

// ---- State ---------------------------------------------------------------

const dirtyParts = () => (content ? PARTS.filter((p) => JSON.stringify(content[p]) !== saved[p]) : []);

function onEdit() {
  const dirty = dirtyParts();
  $("dirty").textContent = dirty.length ? "Unsaved changes" : "";
  $("save").disabled = !dirty.length;
}

function message(text, kind = "") {
  $("msg").textContent = text;
  $("msg").className = `adm__msg${kind ? ` adm__msg--${kind}` : ""}`;
  $("msg").hidden = !text;
}

async function load() {
  message("Loading…");
  const { data } = await getContent();
  ({ baseSha } = data);
  content = { band: data.band, gigs: data.gigs, i18n: data.i18n, bio: data.bio };
  content.band.links ??= [];
  saved = Object.fromEntries(PARTS.map((p) => [p, JSON.stringify(content[p])]));
  renderGigs();
  renderLinks();
  renderBio();
  renderTexts();
  onEdit();
  $("editor").hidden = false;
}

function showError(err) {
  console.error(err);
  message(err.message || String(err), "error");
}

$("add-gig").addEventListener("click", () => {
  content.gigs.push({ date: "", city: "", venue: "" });
  renderGigs();
  onEdit();
  $("gigs").lastElementChild.querySelector("input").focus();
});

$("add-link").addEventListener("click", () => {
  content.band.links.push({ id: "", label: { it: "", en: "" }, url: "" });
  renderLinks();
  onEdit();
  $("links").querySelector(".adm-row:last-of-type input").focus();
});

$("editor").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dirty = dirtyParts();
  if (!dirty.length) return;
  $("save").disabled = true;
  message("Saving…");
  try {
    const payload = { baseSha, ...Object.fromEntries(dirty.map((p) => [p, content[p]])) };
    const { data } = await saveContent(payload);
    await load(); // re-read what was committed (the server normalizes: trims, sorts gigs)
    message(
      data.changed.length
        ? `Saved (${data.changed.join(", ")}). The site updates in a couple of minutes.`
        : "Nothing to save: the content was already like this.",
      "ok",
    );
  } catch (err) {
    showError(err);
    onEdit();
  }
});

$("sign-in").addEventListener("click", () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  signInWithPopup(auth, provider).catch(showError);
});

$("sign-out").addEventListener("click", () => signOut(auth));

window.addEventListener("beforeunload", (e) => {
  if (dirtyParts().length) e.preventDefault();
});

onAuthStateChanged(auth, async (user) => {
  content = null;
  $("editor").hidden = true;
  $("user").hidden = !user;
  $("sign-in").hidden = !!user;
  if (!user) return message("Sign in to edit the site.");
  $("user-email").textContent = user.email;
  try {
    await load();
    message("");
  } catch (err) {
    showError(err);
  }
});
