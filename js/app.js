// === CONFIG ===
const SHEET_URL = "https://script.google.com/macros/s/AKfycbyV2YCK6qVc60A-ktS33beE5T7wupJXadiyn_hHPtsXIrP5tq5aIIjHCacLq_LE8yryig/exec";

for (let i = 1; i <= 40; i++) {
  document.querySelector("#kart").innerHTML += `<option>${i}</option>`;
  document.querySelector("#filterKart").innerHTML += `<option>${i}</option>`;
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
   Load Data
----------------------- */
async function loadData() {
  try {
    syncStatus.textContent = "🔄 Data verversen...";
    const res = await fetch(SHEET_URL);
    const json = await res.json();
    all = json.data || [];
    render(all);
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

  // Open cards
  open.forEach(r => cont.appendChild(createCard(r, false)));

  // Resolved section
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
   Create Card
----------------------- */
function createCard(r, isResolved = false) {
  const c = document.createElement("div");
  c.className = `card ${isResolved ? "resolved" : "open"}`;
  c.dataset.kart = r.kart;
  const date = formatIsoToDDMMYYYY_HHMM(r.datum);

  c.innerHTML = `
    <div class="card-top">
      <h3>Kart: ${r.kart}</h3>
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

  // Solve action
  const btn = c.querySelector(".solveBtn");
  if (btn) {
    btn.onclick = async () => {
      const kart = r.kart;
      btn.disabled = true;
      btn.textContent = "⏳...";

      // Visual pulse animation
      c.classList.add("solving");
      setTimeout(() => c.classList.remove("solving"), 700);

      const form = new FormData();
      form.append("action", "resolve");
      form.append("kart", kart);

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
  if (addBtn) {
    addBtn.disabled = true;
    addBtn.textContent = "✅ Toegevoegd!";
    setTimeout(() => {
      addBtn.disabled = false;
      addBtn.textContent = "➕ Toevoegen";
    }, 1500);
  }

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
   Filter
----------------------- */
document.getElementById("filterKart").onchange = e => {
  const val = e.target.value;
  if (!val) render(all);
  else render(all.filter(r => r.kart == val));
};

/* -----------------------
   Dark/Light Mode Toggle
----------------------- */
const toggle = document.getElementById("modeToggle");
toggle.addEventListener("click", () => {
  document.body.classList.toggle("light");
  toggle.textContent = document.body.classList.contains("light") ? "🌙" : "☀️";
});

/* -----------------------
   Initial Load + Auto Refresh
----------------------- */
loadData();
setInterval(loadData, 60000);
