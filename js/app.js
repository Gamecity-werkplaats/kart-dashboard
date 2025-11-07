// === CONFIG ===
const SHEET_URL = "https://script.google.com/macros/s/AKfycbyV2YCK6qVc60A-ktS33beE5T7wupJXadiyn_hHPtsXIrP5tq5aIIjHCacLq_LE8yryig/exec";

// Fill kart dropdown for Add Form
for (let i = 1; i <= 43; i++) {
  document.querySelector("#kart").innerHTML += `<option>${i}</option>`;
}

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

  // Determine kart type (for styling text)
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
    <div class="card-bottom">
      <div class="time">${date}</div>
      ${
        isResolved
          ? `<span class="status">✅ Opgelost</span>`
          : `<button class="solveBtn">✅ Opgelost</button>`
      }
    </div>
  `;

  // Solve button behavior
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
  const kart = document.getElementById("kart").value;
  const problem = document.getElementById("probleem").value;
  const name = document.getElementById("melder").value;
  if (!kart || !problem) return alert("Vul een kart en probleem in!");

  const addBtn = document.querySelector("#addBtn");
  addBtn.disabled = true;
  addBtn.textContent = "✅ Toegevoegd!";
  setTimeout(() => {
    addBtn.disabled = false;
    addBtn.textContent = "➕ Toevoegen";
  }, 1500);

  const form = new FormData();
  form.append("action", "add");
  form.append("kart", kart);
  form.append("problem", problem);
  form.append("name", name);
  try {
    await fetch(SHEET_URL, { method: "POST", body: form, mode: "no-cors" });
  } catch (err) {
    console.error(err);
  } finally {
    document.getElementById("probleem").value = "";
    document.getElementById("melder").value = "";
    loadData();
  }
};

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
  const kidRange = { start: 31, end: 43 };

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

  // Update text
  brokenAdultsEl.textContent = brokenAdults;
  brokenKidsEl.textContent = brokenKids;
  workingAdultsEl.textContent = workingAdults;
  workingKidsEl.textContent = workingKids;

  // Toggle color classes dynamically
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
for (let i = 1; i <= 43; i++) {
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
   Initial Load + Auto Refresh
----------------------- */
loadData();
setInterval(loadData, 60000);
