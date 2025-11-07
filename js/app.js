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
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
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
function renderDashboard(){
  const total=all.length;
  const openKarts=new Set(all.filter(p=>p.status==="open").map(p=>p.kart)).size;
  document.getElementById("totalProblems").textContent=total;
  document.getElementById("openProblems").textContent=openKarts;
  document.getElementById("workingKarts").textContent=40-openKarts;
}

function renderCards(){
  const kartF=document.getElementById("filterKart").value;
  const statF=document.getElementById("filterStatus").value;
  const groupBy=document.getElementById('groupBy').value;
  const container=document.getElementById('cardsContainer'); container.innerHTML='';

  const filtered = all.filter(p=>(!kartF||p.kart==kartF)&&(!statF||p.status==statF)).slice().reverse();

  if(groupBy==='none'){
    const wrapper = document.createElement('div'); wrapper.className='group';
    const content = document.createElement('div'); content.className='groupContent';
    wrapper.appendChild(content);
    container.appendChild(wrapper);
    appendCardsToContainer(filtered, content, '__nogroup__');
  } else {
    const groups = {};
    filtered.forEach(p=>{
      let key = groupBy==='date' ? extractDateKey(p.datum) : (p.status || 'onbekend');
      if(!groups[key]) groups[key]=[];
      groups[key].push(p);
    });
    // sort groups by date desc or by status name
    const keys = Object.keys(groups).sort((a,b)=>{
      if(groupBy==='date'){
        // parse date dd-mm-yyyy
        const pa=a.split('-').reverse().join('-');
        const pb=b.split('-').reverse().join('-');
        return pb.localeCompare(pa);
      }
      return a.localeCompare(b);
    });

    keys.forEach(key=>{
      const wrapper = document.createElement('div'); wrapper.className='group';
      const header = document.createElement('div'); header.className='groupHeader';
      header.innerHTML = `<div>${key}</div><div class="meta">${groups[key].length} items</div>`;
      wrapper.appendChild(header);
      const content = document.createElement('div'); content.className='groupContent';
      wrapper.appendChild(content);
      container.appendChild(wrapper);
      appendCardsToContainer(groups[key], content, key);
    });
  }
  
}

function makeCardElement(p){
  const id = (p.kart + '|' + p.datum).replace(/\s+/g,'');
  const div=document.createElement("div");
  div.className=`card ${p.status}`;
  div.setAttribute('draggable','true');
  div.dataset.id = id;
  div.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <h3>Kart ${p.kart}</h3>
      
    </div>
    <div class="problem">${p.probleem}</div>
    <div class="meta">${formatIsoToDDMMYYYY_HHMM(p.datum)} – ${p.melder}</div>
    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between">
      <div class="status">${p.status}</div>
      <button class="solveBtn" ${p.status==="opgelost"?"disabled":""} data-kart="${p.kart}" data-probleem="${p.probleem}">✅ Markeer als opgelost</button>
    </div>
  `;
  return div;
}

function appendCardsToContainer(items, contentEl, groupKey){
  // Build elements
  const elems = items.map(makeCardElement);
  contentEl.innerHTML = '';
  elems.forEach(e=>contentEl.appendChild(e));

  // load local saved order + ts
  // simplified: just append cards
elems.forEach(e=>contentEl.appendChild(e));
}




function getDragAfterElement(container, y){
  const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];
  return draggableElements.reduce((closest, child)=>{
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height/2;
    if(offset < 0 && offset > closest.offset){
      return { offset: offset, element: child };
    } else return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element || null;
}

function saveOrderForThisContainer(container){
  // determine group key by walking DOM: the parent .group element's header text
  const groupEl = container.closest('.group');
  let key = '__nogroup__';
  if(groupEl){
    const header = groupEl.querySelector('.groupHeader');
    if(header) key = header.firstElementChild ? header.firstElementChild.textContent.trim() : key;
  }
  const ids = [...container.querySelectorAll('.card')].map(c=>c.dataset.id);
  
}

/* -----------------------
   Data load + actions
   ----------------------- */
async function load(){
  syncStatus.textContent = "🔄 Data verversen...";
  const cbName = '__gs_cb_' + Date.now();
  window[cbName] = function(d){
    try {
      const rows = Array.isArray(d.rows) ? d.rows : [];
      all = rows.slice(1).map(r => ({ datum: r[0], kart: r[1], probleem: r[2], melder: r[3], status: r[4] || "open" }));
      renderDashboard();
      renderCards();
      syncStatus.textContent = "✅ Gesynchroniseerd (" + new Date().toLocaleTimeString("nl-NL") + ")";
    } finally {
      try{ delete window[cbName]; }catch(e){}
      try{ script.remove(); }catch(e){}
    }
  };
  const script = document.createElement('script');
  script.src = SHEET_URL + '?callback=' + cbName + '&t=' + Date.now();
  script.onerror = function(){
    syncStatus.textContent = "⚠️ Kon niet verbinden (offline?)";
    try{ delete window[cbName]; }catch(e){}
    try{ script.remove(); }catch(e){}
  };
  document.head.appendChild(script);
} 

async function syncOrderToServer(groupKey, ids){
  try{
    const body = { action: 'reorder', groupKey, order: ids };
    const r = await fetch(SHEET_URL, { method: 'POST', body: new URLSearchParams({ payload: JSON.stringify(body) }) });
    if(!r.ok) throw new Error('Server gaf fout: ' + r.status);
    // read JSON response (server returns updatedAt in our patched Apps Script)
    const json = await r.json();
    if (json && json.updatedAt) {
      localStorage.setItem('kart-order-ts:' + groupKey, json.updatedAt);
    } else {
      // fallback: stamp with client time if server didn't return ts
      localStorage.setItem('kart-order-ts:' + groupKey, new Date().toISOString());
    }
    showToast('Volgorde opgeslagen');
  }catch(err){
    console.warn('Kon volgorde niet syncen',err);
    showToast('Kon volgorde niet opslaan (offline)');
  }
}


// Form submit
document.getElementById("addForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const body={ action:"add", datum: new Date().toISOString(), kart:document.getElementById("kart").value, probleem:document.getElementById("probleem").value, melder:document.getElementById("melder").value, status:"open" };
  await fetch(SHEET_URL, { method: 'POST', body: new URLSearchParams({ payload: JSON.stringify(body) }) });
  e.target.reset(); load();
});

// Delegated solve click
document.addEventListener('click', async (ev)=>{
  const btn = ev.target.closest('.solveBtn');
  if(!btn) return;
  const kart = btn.dataset.kart; const probleem = btn.dataset.probleem;
  await fetch(SHEET_URL, { method: 'POST', body: new URLSearchParams({ payload: JSON.stringify({ action: 'solve', kart, probleem }) }) });
  load();
});

// Filters
document.getElementById("filterKart").addEventListener("change",renderCards);
document.getElementById("filterStatus").addEventListener("change",renderCards);
document.getElementById("groupBy").addEventListener("change",renderCards);
document.getElementById("clearFilters").addEventListener("click",()=>{document.getElementById("filterKart").value="";document.getElementById("filterStatus").value="";renderCards();});

// Auto refresh every 60s
setInterval(load,60000);

// Dark/light mode
const body=document.body, toggle=document.getElementById("modeToggle");
toggle.addEventListener("click",()=>{body.classList.toggle("light");toggle.textContent=body.classList.contains("light")?"🌙":"☀️";});

// Service worker reg (kept)
if('serviceWorker' in navigator){ navigator.serviceWorker.register('service-worker.js?v=20251106-1').then(()=>console.log("Service Worker ready")).catch(console.error); }

load();
