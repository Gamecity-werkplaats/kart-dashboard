// === CONFIG ===
const SHEET_URL = "https://script.google.com/macros/s/AKfycbyV2YCK6qVc60A-ktS33beE5T7wupJXadiyn_hHPtsXIrP5tq5aIIjHCacLq_LE8yryig/exec";

let all = [];
let showResolved = false;
const syncStatus = document.getElementById("syncStatus");

/* -----------------------
   Format ISO to DD-MM-YYYY HH:MM
----------------------- */
function formatIsoToDDMMYYYY_HHMM(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).replace(",", "");
}

/* -----------------------
   Load Data from Google Sheet
----------------------- */
async function loadData() {
  try {
    syncStatus.textContent = "🔄 Data verversen...";
    const res = await fetch(SHEET_URL);
    const json = await res.json();
    all = json.data || [];

    render(all);
    updateStats(all);
    syncStatus.textContent = "✅ Gesynchroniseerd";
  } catch (err) {
    console.error(err);
    syncStatus.textContent = "⚠️ Kon data niet laden";
  }
}

/* -----------------------
   Render Cards
----------------------- */
function render(list) {
  const cont = document.getElementById("cardsContainer");
  if (!cont) return;
  cont.innerHTML = "";

  const open = list.filter(r => (r.status || "").toLowerCase() === "open");
  const resolved = list.filter(r => (r.status || "").toLowerCase() === "resolved");

  open.forEach(r => cont.appendChild(createCard(r, false)));

  if (resolved.length) {
    const toggle = document.createElement("button");
    toggle.className = "resolved-toggle";
    toggle.textContent = showResolved
      ? "▲ Verberg opgeloste meldingen"
      : `▼ Toon opgeloste meldingen (${resolved.length})`;
    toggle.onclick = () => {
      showResolved = !showResolved;
      render(list);
    };
    cont.appendChild(toggle);

    if (showResolved) resolved.forEach(r => cont.appendChild(createCard(r, true)));
  }
}

/* -----------------------
   Create Individual Card
----------------------- */
function createCard(r, isResolved = false) {
  const c = document.createElement("div");
  const kartNum = Number(r.kart);

  // Determine kart type (for title text color)
  const isAdult = kartNum >= 1 && kartNum <= 30;
  const kartTypeClass = isAdult ? "adultKart" : "kidKart";
  c.className = `card ${isResolved ? "resolved" : "open"}`;

  const date = formatIsoToDDMMYYYY_HHMM(r.datum);

  c.innerHTML = `
    <div class="card-top">
      <h3 class="${kartTypeClass}">Kart: ${r.kart}</h3>
      <div class="melder">${r.melder || "-"}</div>
    </div>

    <div class="card-body">${r.probleem || ""}</div>

    ${
      r.fotourl
        ? `<img src="${r.fotourl}" alt="Schade foto" class="damage-photo">`
        : ""
    }

    <div class="card-bottom">
      <div class="time">${date}</div>
      ${
        isResolved
          ? `<span class="status">✅ Opgelost</span>`
          : `<button class="solveBtn">✅ Opgelost</button>`
      }
    </div>
  `;


  const btn = c.querySelector(".solveBtn");
  if (btn) {
    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = "⏳...";
      c.classList.add("solving");
      setTimeout(() => c.classList.remove("solving"), 700);

      const form = new FormData();
      form.append("action", "resolve");
      form.append("kart", r.kart);
      try {
        await fetch(SHEET_URL, { method: "POST", body: form, mode: "no-cors" });
      } catch (err) {
        console.error(err);
      } finally {
        loadData();
      }
    };
  }

  return c;
}

/* -----------------------
   Add New Problem
----------------------- */
document.getElementById("addForm").onsubmit = async e => {
  e.preventDefault();

  const kart = document.getElementById("addKartDropdown").dataset.selected;
  const problem = document.getElementById("probleem").value;
  const name = document.getElementById("melder").value;
  const file = document.getElementById("foto")?.files[0];

  if (!kart || !problem) return alert("Vul een kart en probleem in!");

  const addBtn = document.querySelector("#addBtn");
  addBtn.disabled = true;
  addBtn.textContent = "⏳ Uploaden...";

  let fotoURL = "";

  try {
    // Upload photo first (if one is selected)
    if (file) {
      const uploadForm = new FormData();
      uploadForm.append("file", file);

      const uploadRes = await fetch(SHEET_URL, { method: "POST", body: uploadForm });
      const uploadJson = await uploadRes.json();
      fotoURL = uploadJson.url || "";
      console.log("Foto upload response:", uploadJson);
    }

    // Now add the issue to the Sheet
    const form = new FormData();
    form.append("action", "add");
    form.append("kart", kart);
    form.append("problem", problem);
    form.append("name", name);
    if (fotoURL) form.append("fotourl", fotoURL);

    const res = await fetch(SHEET_URL, { method: "POST", body: form });
    const text = await res.text();
    console.log("Sheet response:", text);

    addBtn.textContent = "✅ Toegevoegd!";
  } catch (err) {
    console.error("Fout bij toevoegen:", err);
    alert("Er ging iets mis bij het toevoegen!");
  } finally {
    setTimeout(() => {
      addBtn.disabled = false;
      addBtn.textContent = "➕ Toevoegen";
    }, 1500);

    document.getElementById("probleem").value = "";
    document.getElementById("melder").value = "";
    if (document.getElementById("foto")) document.getElementById("foto").value = "";
    document.querySelector("#addKartDropdown .filter-label").textContent = "Kies kart";
    loadData();
  }
};



async function uploadImage(file) {
  if (!file) return "";
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(SHEET_URL, { method: "POST", body: formData });
  const data = await res.json();
  return data.url || "";
}

/* -----------------------
   Update Stats (Adults vs Kids)
----------------------- */
function updateStats(list) {
  const brokenAdultsEl = document.getElementById("brokenAdults");
  const brokenKidsEl = document.getElementById("brokenKids");
  const workingAdultsEl = document.getElementById("workingAdults");
  const workingKidsEl = document.getElementById("workingKids");

  const adultBrokenBox = document.getElementById("adultBrokenBox");
  const kidBrokenBox = document.getElementById("kidBrokenBox");
  const adultWorkingBox = document.getElementById("adultWorkingBox");
  const kidWorkingBox = document.getElementById("kidWorkingBox");

  if (!brokenAdultsEl) return;

  const adultRange = { start: 1, end: 30 };
  const kidRange = { start: 31, end: 42 };

  const brokenAdults = list.filter(r =>
    (r.status || "").toLowerCase() === "open" &&
    Number(r.kart) >= adultRange.start &&
    Number(r.kart) <= adultRange.end
  ).length;

  const brokenKids = list.filter(r =>
    (r.status || "").toLowerCase() === "open" &&
    Number(r.kart) >= kidRange.start &&
    Number(r.kart) <= kidRange.end
  ).length;

  const totalAdults = adultRange.end - adultRange.start + 1;
  const totalKids = kidRange.end - kidRange.start + 1;

  const workingAdults = totalAdults - brokenAdults;
  const workingKids = totalKids - brokenKids;

  brokenAdultsEl.textContent = brokenAdults;
  brokenKidsEl.textContent = brokenKids;
  workingAdultsEl.textContent = workingAdults;
  workingKidsEl.textContent = workingKids;

  adultBrokenBox.classList.toggle("broken", brokenAdults > 0);
  adultBrokenBox.classList.toggle("working", brokenAdults === 0);
  kidBrokenBox.classList.toggle("broken", brokenKids > 0);
  kidBrokenBox.classList.toggle("working", brokenKids === 0);
  adultWorkingBox.classList.toggle("working", workingAdults > 0);
  adultWorkingBox.classList.toggle("broken", workingAdults === 0);
  kidWorkingBox.classList.toggle("working", workingKids > 0);
  kidWorkingBox.classList.toggle("broken", workingKids === 0);
}

/* -----------------------
   Dark / Light Mode Toggle
----------------------- */
const toggle = document.getElementById("modeToggle");
toggle.addEventListener("click", () => {
  document.body.classList.toggle("light");
  toggle.textContent = document.body.classList.contains("light") ? "🌙" : "☀️";
});

/* -----------------------
   Custom Dropdown Filters
----------------------- */
const kartContainer = document.getElementById("kartOptions");
for (let i = 1; i <= 42; i++) {
  const opt = document.createElement("div");
  opt.textContent = `Kart ${i}`;
  opt.dataset.value = i;
  kartContainer.appendChild(opt);
}

const kartFilter = document.getElementById("kartFilter");
const statusFilter = document.getElementById("statusFilter");
const kartLabel = kartFilter.querySelector(".filter-label");
const statusLabel = statusFilter.querySelector(".filter-label");

document.querySelectorAll(".filter-options div").forEach(opt => {
  opt.addEventListener("click", e => {
    const parent = e.target.closest(".filter-dropdown");
    const value = e.target.dataset.value;
    const label = parent.querySelector(".filter-label");
    label.textContent = e.target.textContent;
    parent.removeAttribute("open");

    const kartVal = kartLabel.textContent.replace("Kart ", "");
    const statusVal = statusLabel.textContent.toLowerCase();
    render(
      all.filter(r =>
        (!kartVal || kartVal === "Alle" || r.kart == kartVal) &&
        (!statusVal || statusVal === "alle" || (r.status || "").toLowerCase() === statusVal)
      )
    );
  });
});

document.getElementById("clearFilters").addEventListener("click", () => {
  kartLabel.textContent = "Alle";
  statusLabel.textContent = "Alle";
  render(all);
});

/* -----------------------
   Custom Dropdown for Add Form
----------------------- */
const addKartContainer = document.getElementById("addKartOptions");
for (let i = 1; i <= 42; i++) {
  const opt = document.createElement("div");
  opt.textContent = `Kart ${i}`;
  opt.dataset.value = i;
  addKartContainer.appendChild(opt);
}

const addKartDropdown = document.getElementById("addKartDropdown");
const addKartLabel = addKartDropdown.querySelector(".filter-label");

document.querySelectorAll("#addKartOptions div").forEach(opt => {
  opt.addEventListener("click", e => {
    const value = e.target.dataset.value;
    addKartLabel.textContent = e.target.textContent;
    addKartDropdown.removeAttribute("open");
    addKartDropdown.dataset.selected = value; // store selected kart
  });
});

/* -----------------------
   Initial Load + Auto Refresh
----------------------- */
loadData();
setInterval(loadData, 60000);

/* -----------------------
   Close dropdowns when clicking outside
----------------------- */
document.addEventListener("click", e => {
  // Get all open <details> dropdowns
  const allDropdowns = document.querySelectorAll("details[open]");

  allDropdowns.forEach(drop => {
    // If the click is NOT inside the dropdown or its summary, close it
    if (!drop.contains(e.target)) {
      drop.removeAttribute("open");
    }
  });
});

