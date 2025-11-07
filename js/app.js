const SHEET_URL = "https://script.google.com/macros/s/AKfycbyV2YCK6qVc60A-ktS33beE5T7wupJXadiyn_hHPtsXIrP5tq5aIIjHCacLq_LE8yryig/exec";

for (let i = 1; i <= 40; i++) {
  document.querySelector("#kart").innerHTML += `<option>${i}</option>`;
  document.querySelector("#filterKart").innerHTML += `<option>${i}</option>`;
}

let all = [];
const syncStatus = document.getElementById("syncStatus");

function formatIsoToDDMMYYYY_HHMM(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const opts = {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  };
  const parts = new Intl.DateTimeFormat('en-GB', opts).formatToParts(date);
  const map = {};
  parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });
  if (!map.day || !map.month || !map.year) return iso;
  return `${map.day}-${map.month}-${map.year} ${map.hour}:${map.minute}`;
}

function extractDateKey(iso) {
  const pretty = formatIsoToDDMMYYYY_HHMM(iso);
  const m = pretty.match(/^(\d{2}-\d{2}-\d{4})/);
  return m ? m[1] : pretty;
}

/* -----------------------
   Render + grouping
   ----------------------- */
function renderDashboard() {
  const total = all.length;
  const openKarts = new Set(all.filter(p => p.status === "open").map(p => p.kart)).size;
  document.getElementById("totalProblems").textContent = total;
  document.getElementById("openProblems").textContent = openKarts;
  document.getElementById("workingKarts").textContent = 40 - openKarts;
}

function renderCards() {
  const kartF = document.getElementById("filterKart").value;
  const statF = document.getElementById("filterStatus").value;
  const groupBy = document.getElementById("groupBy").value;
  const container = document.getElementById("cardsContainer");
  container.innerHTML = '';

  const filtered = all.filter(p => (!kartF || p.kart == kartF) && (!statF || p.status == statF)).slice().reverse();

  if (groupBy === 'none') {
    const wrapper = document.createElement('div');
    wrapper.className = 'group';
    const content = document.createElement('div');
    content.className = 'groupContent';
    wrapper.appendChild(content);
    container.appendChild(wrapper);
    appendCardsToContainer(filtered, content, '__nogroup__');
  } else {
    const groups = {};
    filtered.forEach(p => {
      let key = groupBy === 'date' ? extractDateKey(p.datum) : (p.status || 'onbekend');
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    const keys = Object.keys(groups).sort((a, b) => {
      if (groupBy === 'date') {
        const pa = a.split('-').reverse().join('-');
        const pb = b.split('-').reverse().join('-');
        return pb.localeCompare(pa);
      }
      return a.localeCompare(b);
    });

    keys.forEach(key => {
      const wrapper = document.createElement('div');
      wrapper.className = 'group';
      const header = document.createElement('div');
      header.className = 'groupHeader';
      header.innerHTML = `<div>${key}</div><div class="meta">${groups[key].length} items</div>`;
      wrapper.appendChild(header);
      const content = document.createElement('div');
      content.className = 'groupContent';
      wrapper.appendChild(content);
      container.appendChild(wrapper);
      appendCardsToContainer(groups[key], content, key);
    });
  }
}

function makeCardElement(p) {
  const id = (p.kart + '|' + p.datum).replace(/\s+/g, '');
  const div = document.createElement("div");
  div.className = `card ${p.status}`;
  div.dataset.id = id;
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <h3>Kart ${p.kart}</h3>
    </div>
    <div class="problem">${p.probleem}</div>
    <div class="meta">${formatIsoToDDMMYYYY_HHMM(p.datum)} – ${p.melder}</div>
    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between">
      <div class="status">${p.status}</div>
      <button class="solveBtn" ${p.status === "opgelost" ? "disabled" : ""} data-kart="${p.kart}" data-probleem="${p.probleem}">✅ Markeer als opgelost</button>
    </div>
  `;
  return div;
}

function appendCardsToContainer(items, contentEl) {
  const elems = items.map(makeCardElement);
  contentEl.innerHTML = '';
  elems.forEach(e => contentEl.appendChild(e));
}

/* -----------------------
   Data load + actions
   ----------------------- */
async function load() {
  syncStatus.textContent = "🔄 Data verversen...";
  const cbName = '__gs_cb_' + Date.now();
  window[cbName] = function (d) {
    try {
      const rows = Array.isArray(d.rows) ? d.rows : [];
      all = rows.slice(1).map(r => ({
        datum: r[0], kart: r[1], probleem: r[2], melder: r[3], status: r[4] || "open"
      }));
      renderDashboard();
      renderCards();
      syncStatus.textContent = "✅ Gesynchroniseerd (" + new Date().toLocaleTimeString("nl-NL") + ")";
    } finally {
      try { delete window[cbName]; } catch (e) { }
      try { script.remove(); } catch (e) { }
    }
  };
  const script = document.createElement('script');
  script.src = SHEET_URL + '?callback=' + cbName + '&t=' + Date.now();
  script.onerror = function () {
    syncStatus.textContent = "⚠️ Kon niet verbinden (offline?)";
    try { delete window[cbName]; } catch (e) { }
    try { script.remove(); } catch (e) { }
  };
  document.head.appendChild(script);
}

document.getElementById("addForm").addEventListener("submit", async e => {
  e.preventDefault();

  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = `${originalText} <span class="spinner"></span>`;

  // Verzamel form-gegevens in JSON
  const formData = new FormData(e.target);
  const payload = {
    action: "add",
    datum: formData.get("datum"),
    kart: formData.get("kart"),
    probleem: formData.get("probleem"),
    melder: formData.get("melder"),
    status: "open"
  };

  try {
    const res = await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Server error");

    btn.innerHTML = "✔ Toegevoegd";
    btn.classList.add("btn-success");

    setTimeout(() => {
      btn.classList.remove("btn-success");
      btn.textContent = originalText;
      btn.disabled = false;
    }, 1500);

    // Optioneel: herlaad direct nieuwe data
    load();

  } catch (err) {
    console.error(err);
    btn.textContent = "❌ Fout";
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
  }
});



document.addEventListener("click", async e => {
  if (e.target.classList.contains("solveBtn")) {
    const btn = e.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = `${originalText} <span class="spinner"></span>`;

    const payload = {
      action: "solve",
      kart: btn.dataset.kart,
      probleem: btn.dataset.probleem
    };

    try {
      const res = await fetch(SHEET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Server error");

      btn.innerHTML = "✔ Opgelost";
      btn.classList.add("btn-success");

      setTimeout(() => {
        btn.classList.remove("btn-success");
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);

    } catch (err) {
      console.error(err);
      btn.textContent = "❌ Fout";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
    }
  }
});

// Filters
document.getElementById("filterKart").addEventListener("change", renderCards);
document.getElementById("filterStatus").addEventListener("change", renderCards);
document.getElementById("groupBy").addEventListener("change", renderCards);
document.getElementById("clearFilters").addEventListener("click", () => {
  document.getElementById("filterKart").value = "";
  document.getElementById("filterStatus").value = "";
  renderCards();
});

// Auto refresh every 60s
setInterval(load, 60000);

// Dark/light mode
const body = document.body, toggle = document.getElementById("modeToggle");
toggle.addEventListener("click", () => {
  body.classList.toggle("light");
  toggle.textContent = body.classList.contains("light") ? "🌙" : "☀️";
});

// Service worker reg (kept)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js?v=20251106-1')
    .then(() => console.log("Service Worker ready"))
    .catch(console.error);
}

load();
