"use strict";
const byId = id => document.getElementById(id);
const form = byId("recipe-form");
const result = byId("result");
const historyList = byId("history-list");
const historyStatus = byId("history-status");
const message = byId("message");
const presets = {
  protein: {ingredients: "ayam, telur, wortel", goal: "tinggi protein"},
  hemat: {ingredients: "tahu, tempe, kol", goal: "hemat"},
  seimbang: {ingredients: "ikan, tomat, bayam", goal: "sehat dan seimbang"}
};
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function describe(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(describe).filter(Boolean).join(" · ");
  if (typeof value === "object") return Object.entries(value).map(([key, val]) => key + ": " + describe(val)).join(" · ");
  return String(value);
}
function status(node, text, error = false) {
  node.classList.toggle("error", error);
  node.textContent = text;
}
function focusSection(node) {
  node.focus({preventScroll: true});
  node.scrollIntoView({block: "start"});
}
function recipeList(heading, values, ordered) {
  const section = element("section");
  const list = element(ordered ? "ol" : "ul");
  for (const value of values) list.append(element("li", value));
  section.append(element("h3", heading), list);
  return section;
}
function renderRecipe(data, model, latency) {
  if (!data || typeof data.title !== "string" || !data.title.trim() || !Array.isArray(data.ingredients) || !Array.isArray(data.steps)) {
    throw Error("Rincian resep belum lengkap. Coba buat rekomendasi lagi.");
  }
  const header = element("header");
  const source = model === "fallback-local" ? "Rekomendasi lokal" : "Rekomendasi menu";
  header.append(element("small", source, "source"), element("h2", data.title));
  if (data.summary) header.append(element("p", describe(data.summary)));
  const ingredients = data.ingredients.map(item => {
    if (item && typeof item === "object" && "name" in item) return [item.name, item.amount].filter(Boolean).join(" — ");
    return describe(item);
  });
  const body = element("div", "", "recipe-grid");
  body.append(recipeList("Bahan", ingredients, false), recipeList("Langkah memasak", data.steps.map(describe), true));
  const notes = element("div", "", "notes");
  for (const [label, value] of [["Informasi gizi", data.nutrition], ["Catatan memasak", data.tips]]) {
    if (!describe(value)) continue;
    const p = element("p");
    p.append(element("strong", label + ". "), document.createTextNode(describe(value)));
    notes.append(p);
  }
  const meta = [];
  if (model) meta.push(model === "fallback-local" ? "Sumber: resep cadangan dari server" : "Model: " + model);
  if (typeof latency === "number" && latency > 0) meta.push("Waktu proses: " + (latency/1000).toLocaleString("id-ID", {maximumFractionDigits: 2}) + " detik");
  if (meta.length) notes.append(element("p", meta.join(" · "), "source"));
  result.replaceChildren(header, body, notes);
  result.hidden = false;
}
async function requestJSON(route, options) {
  let response;
  try { response = await fetch(route, options); }
  catch { throw Error("Koneksi ke server terputus. Periksa jaringan, lalu coba lagi."); }
  let json;
  try { json = await response.json(); }
  catch { throw Error("Server belum mengirim respons yang bisa ditampilkan. Coba lagi."); }
  if (!response.ok) throw Error(response.status === 400 && typeof json?.error === "string" ? json.error : "Server belum dapat memproses permintaan. Coba lagi.");
  return json;
}
document.querySelectorAll("[data-preset]").forEach(button => {
  button.addEventListener("click", () => {
    const preset = presets[button.dataset.preset];
    byId("ingredients").value = preset.ingredients;
    byId("ingredients").setCustomValidity("");
    byId("goal").value = preset.goal;
    byId("ingredients").focus();
    status(message, "Bahan dan tujuan sudah terisi. Kamu masih bisa mengubahnya.");
  });
});
byId("ingredients").addEventListener("input", event => event.target.setCustomValidity(""));
form.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(form));
  payload.ingredients = payload.ingredients.trim();
  if (payload.ingredients.length < 2) {
    byId("ingredients").setCustomValidity("Tulis bahan yang tersedia, minimal dua karakter.");
    form.reportValidity();
    return;
  }
  const submit = byId("submit");
  if (submit.disabled) return;
  submit.disabled = true;
  submit.setAttribute("aria-busy", "true");
  submit.textContent = "Menyusun resep…";
  status(message, "Permintaan sedang diproses.");
  try {
    const answer = await requestJSON("/api/recommend", {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)
    });
    renderRecipe(answer.data, answer.model, answer.latency);
    status(message, "Resep siap dan tersimpan di riwayat.");
    if (location.hash !== "#riwayat") focusSection(result);
    else await loadHistory();
  } catch (error) { status(message, error.message, true); }
  finally {
    submit.disabled = false;
    submit.removeAttribute("aria-busy");
    submit.textContent = "Buat rekomendasi";
  }
});
function historyButton(record) {
  const button = element("button", "", "history-item");
  button.type = "button";
  const details = element("span");
  const date = new Date(record.created_at);
  const time = Number.isNaN(date.getTime()) ? "" : date.toLocaleString("id-ID", {dateStyle: "medium", timeStyle: "short"});
  details.append(element("small", [record.goal, time].filter(Boolean).join(" · ")), element("strong", record.result?.title || "Resep tersimpan"), element("span", describe(record.ingredients)));
  button.append(details, element("span", "Buka resep", "open"));
  button.addEventListener("click", () => {
    try {
      renderRecipe(record.result, record.model, record.latency_ms);
      location.hash = "hasil";
    } catch (error) { status(historyStatus, error.message, true); }
  });
  return button;
}
let historyVersion = 0;
async function loadHistory() {
  const version = ++historyVersion;
  byId("refresh").disabled = true;
  status(historyStatus, "Memuat riwayat…");
  try {
    const records = await requestJSON("/api/requests", {cache: "no-store"});
    if (version !== historyVersion) return;
    if (!Array.isArray(records)) throw Error("Format riwayat dari server belum sesuai.");
    if (records.length) {
      historyList.replaceChildren(...records.map(historyButton));
      status(historyStatus, records.length + " resep ditampilkan.");
    } else {
      const empty = element("div", "", "history-empty");
      const link = element("a", "Racik menu pertama"); link.href = "#racik";
      empty.append(element("p", "Belum ada resep tersimpan."), link);
      historyList.replaceChildren(empty);
      status(historyStatus, "");
    }
  } catch (error) { if (version === historyVersion) status(historyStatus, error.message, true); }
  finally { if (version === historyVersion) byId("refresh").disabled = false; }
}
function updateView() {
  const inHistory = location.hash === "#riwayat";
  byId("home").hidden = inHistory;
  byId("history").hidden = !inHistory;
  const active = byId("nav-history");
  if (inHistory) active.setAttribute("aria-current", "page");
  else active.removeAttribute("aria-current");
  document.title = "FoodWise AI — " + (inHistory ? "Riwayat resep" : "Dapur saya");
  if (inHistory) {
    window.scrollTo(0,0); loadHistory();
  } else if (location.hash === "#hasil" && !result.hidden) focusSection(result);
  else if (location.hash === "#racik") byId("racik").scrollIntoView();
  else if (location.hash === "#dapur") window.scrollTo(0,0);
}
byId("refresh").addEventListener("click", loadHistory);
window.addEventListener("hashchange", updateView);
updateView();
let deferredInstallPrompt;
const installApp = byId("install-app");
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installApp.hidden = false;
});
installApp.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice.outcome === "accepted") installApp.hidden = true;
  deferredInstallPrompt = null;
});
window.addEventListener("appinstalled", () => { installApp.hidden = true; });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
