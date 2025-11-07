const SHEET_URL = "https://script.google.com/macros/s/AKfycbyV2YCK6qVc60A-ktS33beE5T7wupJXadiyn_hHPtsXIrP5tq5aIIjHCacLq_LE8yryig/exec";

// Fill kart dropdowns
for (let i = 1; i <= 40; i++) {
  document.querySelector("#kart").innerHTML += `<option>${i}</option>`;
  document.querySelector("#filterKart").innerHTML += `<option>${i}</option>`;
}

let all = [];
const syncStatus = document.getElementById("syncStatus");

// Format ISO → DD-MM-YYYY HH:MM
function formatIsoToDDMMYYYY_HHMM(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const opts = {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  const parts = new Intl.DateTimeFormat("nl-NL", opts).formatToParts(date);
  const d = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${d.day}-${d.month}-${d.year} ${d.hour}:${d.minute}`;
}

// Load all data
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

// Render cards
function render(list) {
  const cont = document.getElementById("cardsContainer");
  if (!cont) return;
  cont.innerHTML = "";

  list.forEach(r => {
    const c = document.createElement("div");
    c.className = "card" + (r.status && r.status.toLowerCase() === "resolved" ? " resolved" : "");
    c.dataset.kart = r.kart;

    c.innerHTML = `
      <div class="card-header">
        <div class="kart">🏎️ Kart ${r.kart}</div>
        <div class="time">${formatIsoToDDMMYYYY_HHMM(r.datum)}</div>
      </div>
      <div class="card-body">
        <div class="probleem">${r.probleem || ""}</div>
        <div class="melder">👤 ${r.melder || ""}</div>
      </div>
      <div class="card-footer">
        ${r.status && r.status.toLowerCase() === "resolved"
          ? `<span class="status-label">✅ Opgelost</span>`
          : `<button class="resolveBtn">✅ Markeer als opgelost</button>`
        }
      </div>
    `;

    cont.appendChild(c);

    // Handle "Opgelost"
    const btn = c.querySelector(".resolveBtn");
    if (btn) {
      btn.onclick = async () => {
        const kart = r.kart;
        // Visual feedback
        c.classList.add("resolved");
        btn.disabled = true;
        btn.textContent = "⏳ Wordt opgelost...";

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
  });
}

// Add new kart problem
document.getElementById("addForm").onsubmit = async (e) => {
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

// Filter (Kart only for now)
document.getElementById("filterKart").onchange = (e) => {
  const val = e.target.value;
  if (!val) render(all);
  else render(all.filter(r => r.kart == val));
};

// Initial load
loadData();
setInterval(loadData, 60000);
