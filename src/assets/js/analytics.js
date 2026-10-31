// Firebase Analytics, only for bands with "analytics": true in band.json, and
// only after the visitor accepts the consent banner (src/_includes/consent.njk).
// The measurement ID comes from Hosting's reserved /__/firebase/init.json:
// enable Google Analytics on the Firebase project and it shows up there.
const KEY = "bdtree-consent"; // "granted" | "denied"
const SDK = "https://www.gstatic.com/firebasejs/12.19.0";

const banner = document.querySelector(".consent");

const getChoice = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const setChoice = (value) => {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
};

async function load() {
  let config;
  try {
    const res = await fetch("/__/firebase/init.json");
    if (!res.ok) return; // local dev server: no Hosting config
    config = await res.json();
  } catch {
    return;
  }
  if (!config.measurementId) return; // Analytics not enabled on the project
  const { initializeApp } = await import(`${SDK}/firebase-app.js`);
  const { getAnalytics } = await import(`${SDK}/firebase-analytics.js`);
  getAnalytics(initializeApp(config)); // page views are logged automatically
}

// Withdrawing consent: drop the GA cookies (on this host and its parent
// domains) and reload without the SDK.
function forget() {
  const host = location.hostname.split(".");
  const domains = host.map((_, i) => host.slice(i).join("."));
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (!name.startsWith("_ga")) continue;
    for (const d of ["", ...domains.map((x) => `; domain=${x}`)]) {
      document.cookie = `${name}=; max-age=0; path=/${d}`;
    }
  }
}

banner.addEventListener("click", (e) => {
  const value = e.target.closest("[data-consent]")?.dataset.consent;
  if (!value) return;
  const before = getChoice();
  setChoice(value);
  banner.hidden = true;
  if (value === "granted" && before !== "granted") load();
  if (value === "denied" && before === "granted") {
    forget();
    location.reload();
  }
});

for (const btn of document.querySelectorAll("[data-consent-open]")) {
  btn.hidden = false;
  btn.addEventListener("click", () => {
    banner.hidden = false;
  });
}

const choice = getChoice();
if (choice === "granted") load();
else if (choice !== "denied") banner.hidden = false;
