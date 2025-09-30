/* Torneo Fútbol 7 — MVP (mobile + Supabase + read-only por URL)
   - NO hay await en top-level.
   - Para vista pública: agregar ?view=public a la URL (oculta edición).
*/

/* ====== Helpers DOM ====== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => crypto.randomUUID();

/* ====== Solo lectura por URL ====== */
const READ_ONLY = new URLSearchParams(location.search).get('view') === 'public';
function renderReadOnly(){
  if (!READ_ONLY) return;
  const aside = document.querySelector('aside');
  if (aside) aside.style.display = 'none';

  ['genFixture','exportJSON','exportCSVs'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Desactivar inputs y ocultar "Guardar" en fixture
  $$('#matchesList input[type="number"]').forEach(inp=>{
    inp.disabled = true; inp.style.opacity = 0.6;
  });
  $$('#matchesList button').forEach(btn=>{
    if (btn.textContent.trim().toLowerCase().includes('guardar')){
      btn.style.display = 'none';
    }
  });

  // Ocultar administración de jugadores
  const playersAdmin = document.getElementById('playersAdmin');
  if (playersAdmin) playersAdmin.style.display = 'none';
}

/* ====== Mobile helpers ====== */
function smoothGoto(sel){
  const el = document.querySelector(sel);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 10;
  window.scrollTo({ top:y, behavior:'smooth' });
}
function bindQuickNav(){
  const qn = document.getElementById('quickNav');
  if (!qn) return;
  qn.addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-go]');
    if (!b) return;
    smoothGoto(b.getAttribute('data-go'));
  });
}
function bindToTop(){
  const btn = document.getElementById('toTopBtn');
  if (!btn) return;
  window.addEventListener('scroll', ()=>{
    btn.style.display = (window.scrollY > 400) ? 'block' : 'none';
  });
  btn.onclick = ()=> window.scrollTo({top:0, behavior:'smooth'});
}

/* ====== Adapter ====== */
/* Cambiá esta línea con tus credenciales reales (Settings → API) */
const adapter = SupabaseAdapter({
  url: 'https://dqrxmphozgymkhaqhrui.supabase.co', // <- reemplazar
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxcnhtcGhvemd5bWtoYXFocnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNjk4NjMsImV4cCI6MjA3NDc0NTg2M30.RLc48fHaDdJTDxSDl9vMrAWZjN80Aaee7H3useW2Msg',                         // <- reemplazar
  bucket: 'f7-media',
  tournamentId: '0aaab3f2-49a9-4148-86a2-a14a96f9b78f', // null: crea/usa un torneo y guarda su id en localStorage
});
// Si querés usar localStorage: const adapter = LocalAdapter();

/* ====== Estado ====== */
const state = {
  tournament: { id: uid(), name: "Copa", mode: "league", startDate: "", defaultTime: "20:00" },
  teams: [], players: [], matches: [], photos: [],
};

/* ====== Inicio (sin top-level await) ====== */
async function init(){
  // Cargar remoto si existe torneo guardado en adapter
  try{
    const remote = await adapter.load();
    if (remote) Object.assign(state, remote);
  }catch(e){ console.warn("Load adapter:", e); }

  bindTournament();
  bindTeams();
  bindPlayers();
  bindCSV();
  bindPhotos();
  bindFixture();
  bindExports();
  bindQuickNav();
  bindToTop();
  bindSync();

  renderAll();
  if (READ_ONLY) renderReadOnly();
}
init();

/* ====== Persistencia ====== */
function persist(){ adapter.save(state).catch(e=>console.error(e)); }

/* ====== Tournament ====== */
function bindTournament(){
  const name = $("#tournamentName"), mode = $("#tournamentMode");
  const start = $("#startDate"), dtime = $("#defaultTime");
  const saveBtn = $("#saveTournament"), resetBtn = $("#resetAll"), badge=$("#tournamentBadge");

  name.value = state.tournament.name || "";
  mode.value = state.tournament.mode || "league";
  start.value = state.tournament.startDate || "";
  dtime.value = state.tournament.defaultTime || "20:00";
  badge.textContent = `${state.tournament.name} · ${mode.options[mode.selectedIndex]?.text || ''}`;

  saveBtn.onclick = () => {
    state.tournament.name = name.value.trim() || "Copa";
    state.tournament.mode = mode.value;
    state.tournament.startDate = start.value;
    state.tournament.defaultTime = dtime.value || "20:00";
    toast("Torneo guardado.");
    persist(); renderAll();
  };

  resetBtn.onclick = () => {
    if (!confirm("¿Reiniciar todo? Se borrarán datos locales.")) return;
    try{ localStorage.clear(); }catch{}
    location.reload();
  };
}

/* ====== Teams ====== */
function bindTeams(){
  const teamName=$("#teamName"), teamLogo=$("#teamLogo"), formation=$("#formation"), addBtn=$("#addTeam"), list=$("#teamsList");
  const playerTeam = $("#playerTeam");

  addBtn.onclick = async () => {
    const name = teamName.value.trim();
    if (!name) return toast("Nombre de equipo requerido.", true);

    const id = uid();
    const logoUrl = await fileToObjectURL(teamLogo.files?.[0]);
    const team = { id, name, logoUrl, formation: formation.value, stats: baseTeamStats() };
    state.teams.push(team);
    teamName.value=""; teamLogo.value=""; formation.value="1-3-2-1";
    persist(); renderTeams(); renderPlayerTeamSelect(); renderFormations(); renderPlayersAdmin();
  };

  function renderTeams(){
    list.innerHTML = "";
    state.teams.forEach(t=>{
      const div = document.createElement("div");
      div.className="item";
      div.innerHTML = `
        <img class="logo" src="${t.logoUrl||''}" alt="" loading="lazy" decoding="async">
        <div style="flex:1">
          <div><strong>${t.name}</strong></div>
          <div class="flex"><span class="tag">${t.formation}</span>
            <span class="pill">Ptos ${t.stats.points}</span>
            <span class="pill">GF ${t.stats.gf}</span>
            <span class="pill">GC ${t.stats.ga}</span>
          </div>
        </div>
        <button class="ghost" data-id="${t.id}">Borrar</button>
      `;
      div.querySelector("button").onclick = ()=>{
        if (!confirm(`Eliminar ${t.name}?`)) return;
        state.players = state.players.filter(p=>p.teamId!==t.id);
        state.matches = state.matches.filter(m=>m.homeId!==t.id && m.awayId!==t.id);
        state.teams = state.teams.filter(x=>x.id!==t.id);
        persist(); renderTeams(); renderPlayerTeamSelect(); renderMatches(); renderFormations(); renderTables(); renderPlayersAdmin();
      };
      list.appendChild(div);
    });
  }

  function renderPlayerTeamSelect(){
    playerTeam.innerHTML = `<option value="">—</option>` + state.teams.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");
  }

  renderTeams(); renderPlayerTeamSelect();
}

/* ====== Players ====== */
function bindPlayers(){
  const teamSel=$("#playerTeam"), name=$("#playerName"), num=$("#playerNumber"),
        pos=$("#playerPosition"), photo=$("#playerPhoto"), addBtn=$("#addPlayer");

  addBtn.onclick = async ()=>{
    const teamId = teamSel.value; if(!teamId) return toast("Seleccioná equipo.", true);
    const playerName = name.value.trim(); if(!playerName) return toast("Nombre requerido.", true);

    const p = {
      id: uid(), teamId, name: playerName, number: +num.value||0, position: pos.value,
      photoUrl: await fileToObjectURL(photo.files?.[0]),
      stats: { goals:0, mvp:0 }
    };
    state.players.push(p);
    name.value=""; num.value="10"; pos.value="FWD"; photo.value="";
    persist(); renderFormations(); renderStats(); renderPlayersAdmin();
  };
}

/* ====== CSV ====== */
function bindCSV(){
  $("#csvTeams").onchange = e => importCSV(e.target.files[0], parseTeamsCSV);
  $("#csvPlayers").onchange = e => importCSV(e.target.files[0], parsePlayersCSV);
  $("#csvMatches").onchange = e => importCSV(e.target.files[0], parseMatchesCSV);
}

/* ====== Gallery ====== */
function bindPhotos(){
  const file = $("#matchPhotos"), btn=$("#addPhotos"), gal=$("#photosGallery");
  btn.onclick = async ()=>{
    if (!file.files?.length) return toast("Seleccioná imágenes.", true);
    for (const f of file.files){
      state.photos.push({ id: uid(), url: await fileToObjectURL(f) });
    }
    file.value=""; persist(); renderGallery();
  };
  function renderGallery(){
    gal.innerHTML = state.photos.map(p=>`<img src="${p.url}" alt="foto partido" loading="lazy" decoding="async">`).join("");
  }
  renderGallery();
}

/* ====== Fixture ====== */
function bindFixture(){
  $("#genFixture").onclick = ()=>{
    if (state.tournament.mode==="league"){
      state.matches = genLeague(state.teams, state.tournament.startDate, state.tournament.defaultTime);
    } else {
      state.matches = genKnockout_QSF(state.teams, state.tournament.startDate, state.tournament.defaultTime);
    }
    persist(); renderMatches(); renderTables();
  };
}

/* ====== Export / Sync ====== */
function bindExports(){
  $("#exportJSON").onclick = ()=>{
    downloadText("torneo.json", JSON.stringify(state, null, 2));
  };
  $("#exportCSVs").onclick = ()=>{
    const csvs = exportCSVs(state);
    Object.entries(csvs).forEach(([name, text]) => downloadText(name, text));
  };
}
function bindSync(){
  const btn = document.getElementById('syncFromSupabase');
  if (!btn || typeof adapter.load !== 'function') return;
  btn.onclick = async ()=>{
    try{
      btn.disabled = true; btn.textContent = "Sincronizando...";
      const remote = await adapter.load();
      if (!remote){ toast("No hay torneo remoto aún.", true); return; }
      state.tournament = remote.tournament || state.tournament;
      state.teams      = remote.teams      || [];
      state.players    = remote.players    || [];
      state.matches    = remote.matches    || [];
      state.photos     = remote.photos     || [];
      recalcStats();
      persist();
      renderAll();
      toast("Sincronizado desde Supabase.");
    }catch(e){
      console.error(e);
      toast("Error al sincronizar.", true);
    }finally{
      btn.disabled = false; btn.textContent = "🔄 Sincronizar";
    }
  };
}

/* ====== Render global ====== */
function renderAll(){
  $("#tournamentBadge").textContent = `${state.tournament.name} · ${state.tournament.mode==="league"?"Liga":"Eliminación"}`;
  renderFormations();
  renderMatches();
  renderTables();
  renderStats();
  renderPlayersAdmin();

  if (READ_ONLY) renderReadOnly();
}

/* ====== Formations ====== */
function renderFormations(){
  const wrap = $("#formationsBoard"); wrap.innerHTML="";
  const groups = state.teams.map(t=>({team:t, players: state.players.filter(p=>p.teamId===t.id)}));
  for (const g of groups){
    const sec = document.createElement("div");
    sec.innerHTML = `<h3>${g.team.name}</h3>`;
    const formationEl = document.createElement("div");
    formationEl.className="formation";
    const lanes = formationToLanes(g.team.formation);
    lanes.forEach(roleRow=>{
      const lane = document.createElement("div"); lane.className="lane";
      const candidates = pickPlayersForRoles(g.players, roleRow);
      roleRow.forEach((role, i)=>{
        const pl = candidates[i] || null;
        lane.appendChild(playerCard(pl, role));
      });
      formationEl.appendChild(lane);
    });
    const subs = g.players.filter(p=>p.position==="SUB");
    if (subs.length){
      const lane = document.createElement("div"); lane.className="lane";
      subs.forEach(s => lane.appendChild(playerCard(s, "SUB")));
      formationEl.appendChild(lane);
    }
    sec.appendChild(formationEl);
    wrap.appendChild(sec);
  }
}

function playerCard(player, role){
  const el = document.createElement("div");
  el.className="player-card";
  if (player){
    el.innerHTML = `
      <img class="avatar" src="${player.photoUrl||''}" alt="" loading="lazy" decoding="async">
      <small>#${player.number} ${player.name}</small>
      <small>${mapRole(player.position)}</small>
    `;
  } else {
    el.innerHTML = `
      <div class="avatar" style="display:flex;align-items:center;justify-content:center;font-size:18px">?</div>
      <small>Vacante</small>
      <small>${mapRole(role)}</small>
    `;
  }
  el.style.cursor = "pointer";
  el.title = player ? "Editar jugador" : "Vacante";
  el.onclick = ()=>{
    if (player) openPlayerModal(player.id);
  };
  return el;
}

/* ====== Matches ====== */
function renderMatches(){
  const list = $("#matchesList"); list.innerHTML="";
  state.matches.forEach((m)=>{
    const home = state.teams.find(t=>t.id===m.homeId)?.name || "—";
    const away = state.teams.find(t=>t.id===m.awayId)?.name || "—";
    const row = document.createElement("div");
    row.className="item";
    row.innerHTML = `
      <div style="flex:1">
        <div><strong>J${m.round}</strong> — ${fmtDateTime(m.date)} — <span class="pill">${m.stage}</span></div>
        <div>${home} vs ${away}</div>
      </div>
      <div class="flex">
        <input type="number" inputmode="numeric" min="0" value="${m.scoreHome??''}" placeholder="H" style="width:70px">
        <input type="number" inputmode="numeric" min="0" value="${m.scoreAway??''}" placeholder="A" style="width:70px">
        <button class="ghost">Guardar</button>
      </div>
    `;
    const [inH, inA, btn] = row.querySelectorAll("input,button");
    btn.onclick = ()=>{
      const sh = inH.value===""?null:Math.max(0, +inH.value);
      const sa = inA.value===""?null:Math.max(0, +inA.value);
      m.scoreHome = sh; m.scoreAway = sa;

      if (sh==null || sa==null){
        recalcStats(); persist(); renderTables(); renderStats();
        toast("Resultado guardado.");
        return;
      }
      if (!READ_ONLY) openMatchModal(m);
    };
    list.appendChild(row);
  });
}

/* ====== Tables / Bracket ====== */
function renderTables(){
  const wrap = $("#standingsWrap"), bracket = $("#bracketWrap");
  wrap.innerHTML=""; bracket.innerHTML="";

  if (state.tournament.mode==="league"){
    const table = computeStandings(state);
    wrap.appendChild(renderStandingsTable(table));
  } else {
    const tree = computeBracketView(state.matches);
    bracket.appendChild(tree);
  }
}

function renderStandingsTable(rows){
  const t = document.createElement("table");
  t.innerHTML = `
    <thead><tr>
      <th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th>
      <th>GF</th><th>GC</th><th>DIF</th><th>Pts</th>
    </tr></thead>
    <tbody></tbody>
  `;
  const tb = t.querySelector("tbody");
  rows.forEach((r,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${r.team.name}</td><td>${r.played}</td>
    <td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td>
    <td>${r.gf}</td><td>${r.ga}</td><td>${r.gf-r.ga}</td><td><strong>${r.points}</strong></td>`;
    tb.appendChild(tr);
  });
  return t;
}

function computeBracketView(matches){
  const wrap = document.createElement("div");
  const stages = ["Cuartos","Semifinal","3º/4º Puesto","Final"];
  stages.forEach(s=>{
    const ms = matches.filter(m=>m.stage===s);
    if (!ms.length) return;
    const block = document.createElement("div");
    block.innerHTML = `<h3>${s}</h3>`;
    ms.forEach(m=>{
      const div = document.createElement("div");
      div.className="item";
      const h = teamNameById(m.homeId), a = teamNameById(m.awayId);
      div.innerHTML = `
        <div style="flex:1">${h} vs ${a}</div>
        <div>${m.scoreHome??"-"} : ${m.scoreAway??"-"}</div>
      `;
      block.appendChild(div);
    });
    wrap.appendChild(block);
  });
  return wrap;
}

/* ====== Stats ====== */
function renderStats(){
  const wrap = $("#statsWrap"); wrap.innerHTML="";
  const all = state.players.map(p=>({player:p, goals:p.stats.goals||0, mvp:p.stats.mvp||0}));
  const topScorers = [...all].sort((a,b)=>b.goals-a.goals).slice(0,10);
  const topMVP = [...all].sort((a,b)=>b.mvp-a.mvp).slice(0,10);

  const sec = document.createElement("div");
  sec.innerHTML = `
    <h3>Goleadores</h3>
    ${renderSimpleTable(["Jugador","Equipo","Goles"], topScorers.map(x=>[
      x.player.name, teamNameById(x.player.teamId), x.goals
    ])).outerHTML}
    <h3>Mejor Jugador (MVP)</h3>
    ${renderSimpleTable(["Jugador","Equipo","MVP"], topMVP.map(x=>[
      x.player.name, teamNameById(x.player.teamId), x.mvp
    ])).outerHTML}
  `;
  wrap.appendChild(sec);
}

/* ====== Players Admin ====== */
function renderPlayersAdmin(){
  const wrap = $("#playersAdmin");
  if (!wrap) return;
  wrap.innerHTML = "";

  const players = [...state.players].sort((a,b)=>{
    if (a.teamId!==b.teamId) return teamNameById(a.teamId).localeCompare(teamNameById(b.teamId));
    return (a.number||0) - (b.number||0);
  });

  players.forEach(p=>{
    const team = teamNameById(p.teamId);
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <img class="avatar" src="${p.photoUrl||''}" alt="" loading="lazy" decoding="async">
      <div style="flex:1">
        <div><strong>#${p.number||""} ${p.name||"(sin nombre)"}</strong></div>
        <div class="flex"><span class="tag">${mapRole(p.position)}</span><span class="pill">${team}</span></div>
      </div>
      <div class="flex">
        <button class="ghost" data-act="edit">Editar</button>
        <button class="ghost" data-act="photo">Cambiar foto</button>
        <button data-act="delete">Borrar</button>
      </div>
    `;
    div.querySelector('[data-act="edit"]').onclick = ()=> openPlayerModal(p.id);
    div.querySelector('[data-act="photo"]').onclick = ()=> changePlayerPhoto(p.id);
    div.querySelector('[data-act="delete"]').onclick = ()=>{
      if (!confirm(`Eliminar ${p.name}?`)) return;
      state.players = state.players.filter(x=>x.id!==p.id);
      persist(); renderFormations(); renderStats(); renderPlayersAdmin();
    };
    wrap.appendChild(div);
  });
}

/* ====== Player Modal ====== */
function openPlayerModal(playerId){
  if (READ_ONLY) return; // no editar en modo público
  const p = state.players.find(x=>x.id===playerId);
  if (!p) return;

  const modal = $("#playerModal");
  const pm_name = $("#pm_name");
  const pm_number = $("#pm_number");
  const pm_position = $("#pm_position");
  const pm_team = $("#pm_team");
  const pm_photo = $("#pm_photo");
  const pm_cancel = $("#pm_cancel");
  const pm_save = $("#pm_save");

  pm_team.innerHTML = state.teams.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");
  pm_name.value = p.name||"";
  pm_number.value = p.number||0;
  pm_position.value = p.position||"FWD";
  pm_team.value = p.teamId||"";
  pm_photo.value = "";

  modal.style.display = "flex";

  pm_cancel.onclick = ()=> { modal.style.display="none"; };

  pm_save.onclick = async ()=>{
    p.name = pm_name.value.trim();
    p.number = +pm_number.value||0;
    p.position = pm_position.value;
    p.teamId = pm_team.value;
    if (pm_photo.files && pm_photo.files[0]){
      p.photoUrl = await fileToObjectURL(pm_photo.files[0]);
    }
    persist();
    modal.style.display="none";
    renderFormations(); renderStats(); renderPlayersAdmin();
    toast("Jugador actualizado.");
  };

  modal.onclick = (e)=> { if (e.target===modal) modal.style.display="none"; };
}

async function changePlayerPhoto(playerId){
  if (READ_ONLY) return;
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*";
  input.onchange = async ()=>{
    const f = input.files?.[0];
    if (!f) return;
    const p = state.players.find(x=>x.id===playerId);
    if (!p) return;
    p.photoUrl = await fileToObjectURL(f);
    persist(); renderFormations(); renderPlayersAdmin();
    toast("Foto actualizada.");
  };
  input.click();
}

/* ====== Match Modal (player goals + MVP) ====== */
function openMatchModal(match){
  if (READ_ONLY) return;
  const modal = $("#matchModal");
  const mm_meta = $("#mm_meta");
  const mm_homeName = $("#mm_homeName");
  const mm_awayName = $("#mm_awayName");
  const mm_homeList = $("#mm_homeList");
  const mm_awayList = $("#mm_awayList");
  const mm_homeSum = $("#mm_homeSum");
  const mm_awaySum = $("#mm_awaySum");
  const mm_homeTarget = $("#mm_homeTarget");
  const mm_awayTarget = $("#mm_awayTarget");
  const mm_mvp = $("#mm_mvp");
  const mm_warn = $("#mm_warn");
  const mm_cancel = $("#mm_cancel");
  const mm_save = $("#mm_save");
  const mm_autofill = $("#mm_autofill");

  const homeTeam = state.teams.find(t=>t.id===match.homeId);
  const awayTeam = state.teams.find(t=>t.id===match.awayId);
  const homePlayers = state.players.filter(p=>p.teamId===homeTeam?.id);
  const awayPlayers = state.players.filter(p=>p.teamId===awayTeam?.id);

  const pg = match.playerGoals || {};
  const mvpId = match.mvpId || "";

  mm_meta.innerHTML = `
    <span class="pill">${fmtDateTime(match.date)}</span>
    <span class="pill">${homeTeam?.name || "—"} ${match.scoreHome??"-"} : ${match.scoreAway??"-"} ${awayTeam?.name || "—"}</span>
    <span class="pill">${match.stage} · J${match.round}</span>
  `;

  mm_homeName.textContent = homeTeam?.name || "Local";
  mm_awayName.textContent = awayTeam?.name || "Visitante";
  mm_homeTarget.textContent = match.scoreHome||0;
  mm_awayTarget.textContent = match.scoreAway||0;

  mm_homeList.innerHTML = homePlayers.map(p=>rowGoalInput(p, pg[p.id]||0)).join("");
  mm_awayList.innerHTML = awayPlayers.map(p=>rowGoalInput(p, pg[p.id]||0)).join("");

  mm_mvp.innerHTML = `<option value="">— (sin MVP)</option>` + [...homePlayers, ...awayPlayers]
    .map(p=>`<option value="${p.id}" ${p.id===mvpId?'selected':''}>${p.name} (${teamNameById(p.teamId)})</option>`).join("");

  const onRecalc = ()=>{
    const hSum = sumInputs(mm_homeList);
    const aSum = sumInputs(mm_awayList);
    mm_homeSum.textContent = hSum;
    mm_awaySum.textContent = aSum;
    const ok = (hSum === (match.scoreHome||0)) && (aSum === (match.scoreAway||0));
    mm_warn.style.display = ok ? "none" : "block";
  };
  mm_homeList.oninput = onRecalc;
  mm_awayList.oninput = onRecalc;
  onRecalc();

  mm_autofill.onclick = ()=>{
    autoDistribute(mm_homeList, match.scoreHome||0);
    autoDistribute(mm_awayList, match.scoreAway||0);
    onRecalc();
  };

  mm_cancel.onclick = ()=>{ modal.style.display="none"; };

  mm_save.onclick = ()=>{
    const hSum = sumInputs(mm_homeList);
    const aSum = sumInputs(mm_awayList);
    if (hSum !== (match.scoreHome||0) || aSum !== (match.scoreAway||0)){
      toast("Los totales no coinciden. Usá Autoajustar o corregí manualmente.", true);
      return;
    }
    match.playerGoals = {};
    readInputs(mm_homeList).forEach(({id, goals})=> match.playerGoals[id]=goals);
    readInputs(mm_awayList).forEach(({id, goals})=> match.playerGoals[id]=goals);
    match.mvpId = mm_mvp.value || null;

    recalcStats();
    persist();
    renderTables(); renderStats(); renderPlayersAdmin();
    modal.style.display="none";
    toast("Goles por jugador y MVP guardados.");
  };

  modal.style.display = "flex";
  modal.onclick = (e)=>{ if (e.target===modal) modal.style.display="none"; };

  function rowGoalInput(p, val){
    return `
      <div class="item" data-pid="${p.id}">
        <img class="avatar" src="${p.photoUrl||''}" alt="" loading="lazy" decoding="async">
        <div style="flex:1">
          <div><strong>#${p.number||""} ${p.name}</strong></div>
          <small class="tag">${mapRole(p.position)}</small>
        </div>
        <input type="number" inputmode="numeric" min="0" value="${val||0}" style="width:90px">
      </div>
    `;
  }
  function sumInputs(container){
    return Array.from(container.querySelectorAll('input[type="number"]'))
      .map(i=>+i.value||0).reduce((a,b)=>a+b,0);
  }
  function readInputs(container){
    return Array.from(container.querySelectorAll('.item')).map(div=>{
      const id = div.getAttribute('data-pid');
      const goals = +div.querySelector('input').value || 0;
      return { id, goals };
    });
  }
  function autoDistribute(container, total){
    const items = Array.from(container.querySelectorAll('.item'));
    if (!items.length){ return; }
    const pref = (div)=>{
      const tag = div.querySelector('.tag')?.textContent || "";
      if (tag.includes("Delantero")) return 3;
      if (tag.includes("Mediocampo")) return 2;
      if (tag.includes("Defensa")) return 1;
      return 0;
    };
    items.sort((a,b)=>pref(b)-pref(a));
    items.forEach(div=>div.querySelector('input').value = 0);
    let left = total, i = 0;
    while (left>0){
      const input = items[i % items.length].querySelector('input');
      input.value = (+input.value||0)+1;
      left--; i++;
    }
  }
}

/* ====== Render helpers ====== */
function renderSimpleTable(headers, rows){
  const t = document.createElement("table");
  t.innerHTML = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody></tbody>`;
  const tb = t.querySelector("tbody");
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = r.map(c=>`<td>${c}</td>`).join("");
    tb.appendChild(tr);
  });
  return t;
}

/* ====== Core logic ====== */
function baseTeamStats(){ return { played:0, wins:0, draws:0, losses:0, gf:0, ga:0, points:0 }; }

function formationToLanes(f){
  const [g, a, b, c] = f.split("-").map(n=>parseInt(n,10));
  const lanes = [];
  lanes.push(Array(g||1).fill("GK"));
  if (a) lanes.push(Array(a).fill("DEF"));
  if (b) lanes.push(Array(b).fill("MID"));
  if (c) lanes.push(Array(c).fill("FWD"));
  return lanes;
}

function pickPlayersForRoles(players, roleRow){
  const by = {
    GK: players.filter(p=>p.position==="GK"),
    DEF: players.filter(p=>p.position==="DEF"),
    MID: players.filter(p=>p.position==="MID"),
    FWD: players.filter(p=>p.position==="FWD"),
  };
  return roleRow.map(role => by[role].shift() || null);
}

function fmtDateTime(dt){
  if (!dt) return "Sin fecha";
  const d = new Date(dt);
  return d.toLocaleString();
}
function teamNameById(id){ return state.teams.find(t=>t.id===id)?.name || "—"; }

function genLeague(teams, startDate, defaultTime){
  const ids = teams.map(t=>t.id);
  if (ids.length<2) { toast("Se necesitan 2+ equipos para liga.", true); return []; }
  const arr = [...ids];
  if (arr.length%2===1) arr.push(null);
  const rounds = arr.length - 1;
  const half = arr.length/2;

  let home = arr.slice(0, half);
  let away = arr.slice(half).reverse();

  const matches = [];
  let date = startDate ? new Date(`${startDate}T${defaultTime||"20:00"}`) : new Date();

  for (let r=1; r<=rounds; r++){
    for (let i=0;i<half;i++){
      const A = home[i], B = away[i];
      if (A && B){
        matches.push({
          id: uid(), round:r, stage:`Jornada ${r}`,
          homeId:A, awayId:B, date:new Date(date), scoreHome:null, scoreAway:null,
          playerGoals:{}, mvpId:null
        });
      }
    }
    const fixed = home[0];
    const moved = home.pop();
    home = [fixed, away[0], ...home.slice(1)];
    away = [...away.slice(1), moved];
    date.setDate(date.getDate()+7);
  }
  return matches;
}

function genKnockout_QSF(teams, startDate, defaultTime){
  const ids = teams.map(t=>t.id);
  if (ids.length<4) { toast("Se necesitan 4+ equipos para eliminación.", true); return []; }
  const eight = ids.slice(0,8);
  const pairs = [[0,7],[3,4],[1,6],[2,5]];
  const matches = [];
  let date = startDate ? new Date(`${startDate}T${defaultTime||"20:00"}`) : new Date();

  pairs.forEach((p,i)=>{
    matches.push({ id:uid(), round:1, stage:"Cuartos", homeId:eight[p[0]], awayId:eight[p[1]], date:new Date(date), scoreHome:null, scoreAway:null, playerGoals:{}, mvpId:null });
  });
  date.setDate(date.getDate()+7);
  for (let i=0;i<2;i++) matches.push({ id:uid(), round:2, stage:"Semifinal", homeId:null, awayId:null, date:new Date(date), scoreHome:null, scoreAway:null, playerGoals:{}, mvpId:null });
  date.setDate(date.getDate()+7);
  matches.push({ id:uid(), round:3, stage:"3º/4º Puesto", homeId:null, awayId:null, date:new Date(date), scoreHome:null, scoreAway:null, playerGoals:{}, mvpId:null });
  matches.push({ id:uid(), round:3, stage:"Final", homeId:null, awayId:null, date:new Date(date), scoreHome:null, scoreAway:null, playerGoals:{}, mvpId:null });

  return matches;
}

function wireKnockout(){
  const qf = state.matches.filter(m=>m.stage==="Cuartos");
  const sf = state.matches.filter(m=>m.stage==="Semifinal");
  const bronze = state.matches.find(m=>m.stage==="3º/4º Puesto");
  const final = state.matches.find(m=>m.stage==="Final");

  if (qf.length===4 && sf.length===2){
    const winnersQF = qf.map(winnerOf);
    const losersQF = qf.map(loserOf);
    if (winnersQF.every(Boolean)){
      sf[0].homeId = winnersQF[0]; sf[0].awayId = winnersQF[1];
      sf[1].homeId = winnersQF[2]; sf[1].awayId = winnersQF[3];
    }
    if (sf.every(m=>m.scoreHome!=null && m.scoreAway!=null)){
      const winnersSF = sf.map(winnerOf), losersSF = sf.map(loserOf);
      if (winnersSF.every(Boolean)){
        final.homeId = winnersSF[0]; final.awayId = winnersSF[1];
      }
      if (losersSF.every(Boolean)){
        bronze.homeId = losersSF[0]; bronze.awayId = losersSF[1];
      }
    }
  }
}
function winnerOf(m){
  if (m?.scoreHome==null || m?.scoreAway==null) return null;
  if (m.scoreHome>m.scoreAway) return m.homeId;
  if (m.scoreAway>m.scoreHome) return m.awayId;
  return [m.homeId, m.awayId][Math.floor(Math.random()*2)];
}
function loserOf(m){
  const w = winnerOf(m); if (!w) return null;
  return (w===m.homeId)? m.awayId : m.homeId;
}

function recalcStats(){
  state.teams.forEach(t=> t.stats = baseTeamStats());
  state.players.forEach(p=> p.stats = { goals:0, mvp:0 });

  if (state.tournament.mode!=="league") wireKnockout();

  state.matches.forEach(m=>{
    if (m.scoreHome!=null && m.scoreAway!=null){
      const H = state.teams.find(t=>t.id===m.homeId);
      const A = state.teams.find(t=>t.id===m.awayId);
      if (H && A){
        H.stats.played++; A.stats.played++;
        H.stats.gf += m.scoreHome; H.stats.ga += m.scoreAway;
        A.stats.gf += m.scoreAway; A.stats.ga += m.scoreHome;

        if (m.scoreHome>m.scoreAway){ H.stats.wins++; A.stats.losses++; H.stats.points+=3; }
        else if (m.scoreAway>m.scoreHome){ A.stats.wins++; H.stats.losses++; A.stats.points+=3; }
        else { H.stats.draws++; A.stats.draws++; H.stats.points+=1; A.stats.points+=1; }
      }
    }
    if (m.playerGoals){
      Object.entries(m.playerGoals).forEach(([pid, g])=>{
        const pl = state.players.find(p=>p.id===pid);
        if (pl) pl.stats.goals += (+g||0);
      });
    }
    if (m.mvpId){
      const mp = state.players.find(p=>p.id===m.mvpId);
      if (mp) mp.stats.mvp += 1;
    }
  });
}

function computeStandings(state){
  const rows = state.teams.map(t=>({
    team:t, played:t.stats.played, wins:t.stats.wins, draws:t.stats.draws, losses:t.stats.losses,
    gf:t.stats.gf, ga:t.stats.ga, points:t.stats.points
  }));
  rows.sort((a,b)=>{
    if (b.points!==a.points) return b.points-a.points;
    const difA = a.gf-a.ga, difB = b.gf-b.ga;
    if (difB!==difA) return difB-difA;
    if (b.gf!==a.gf) return b.gf-a.gf;
    return a.team.name.localeCompare(b.team.name);
  });
  return rows;
}

/* ====== CSV ====== */
async function importCSV(file, parser){
  const text = await file.text();
  try{
    parser(text);
    persist(); renderAll(); toast("CSV importado.");
  }catch(e){
    console.error(e); toast("Error al importar CSV.", true);
  }
}
function parseTeamsCSV(text){
  const rows = csvToRows(text); const hdr = rows.shift().map(s=>s.toLowerCase());
  const idx = mapIndex(hdr, ["team_id","team_name","formation","logo_url"]);
  rows.forEach(r=>{
    const id = r[idx.team_id] || uid();
    const exists = state.teams.find(t=>t.id===id);
    const team = { id, name:r[idx.team_name], formation:r[idx.formation]||"1-3-2-1", logoUrl:r[idx.logo_url]||"", stats:baseTeamStats()};
    if (exists){ Object.assign(exists, team); } else { state.teams.push(team); }
  });
}
function parsePlayersCSV(text){
  const rows = csvToRows(text); const hdr = rows.shift().map(s=>s.toLowerCase());
  const idx = mapIndex(hdr, ["player_id","team_id","name","number","position","photo_url"]);
  rows.forEach(r=>{
    const id = r[idx.player_id] || uid();
    const exists = state.players.find(p=>p.id===id);
    const p = { id, teamId:r[idx.team_id], name:r[idx.name], number:+(r[idx.number]||0), position:(r[idx.position]||"FWD").toUpperCase(), photoUrl:r[idx.photo_url]||"", stats:{goals:0,mvp:0} };
    if (exists){ Object.assign(exists, p); } else { state.players.push(p); }
  });
}
function parseMatchesCSV(text){
  const rows = csvToRows(text); const hdr = rows.shift().map(s=>s.toLowerCase());
  const idx = mapIndex(hdr, ["match_id","stage","round","date","home_id","away_id","score_home","score_away"]);
  state.matches = rows.map(r=>({
    id: r[idx.match_id] || uid(),
    stage: r[idx.stage] || "Jornada",
    round: +(r[idx.round]||1),
    date: r[idx.date] ? new Date(r[idx.date]) : null,
    homeId: r[idx.home_id] || null,
    awayId: r[idx.away_id] || null,
    scoreHome: r[idx.score_home]===""?null:+r[idx.score_home],
    scoreAway: r[idx.score_away]===""?null:+r[idx.score_away],
    playerGoals: {}, mvpId: null
  }));
}
function exportCSVs(state){
  const teams = [
    ["team_id","team_name","formation","logo_url"],
    ...state.teams.map(t=>[t.id,t.name,t.formation,t.logoUrl||""])
  ];
  const players = [
    ["player_id","team_id","name","number","position","photo_url"],
    ...state.players.map(p=>[p.id,p.teamId,p.name,p.number,p.position,p.photoUrl||""])
  ];
  const matches = [
    ["match_id","stage","round","date","home_id","away_id","score_home","score_away"],
    ...state.matches.map(m=>[m.id,m.stage,m.round,m.date?new Date(m.date).toISOString():"",m.homeId||"",m.awayId||"",nullish(m.scoreHome),nullish(m.scoreAway)])
  ];
  return {
    "teams.csv": rowsToCSV(teams),
    "players.csv": rowsToCSV(players),
    "matches.csv": rowsToCSV(matches),
  };
}

/* ====== Adapters ====== */
function LocalAdapter(){
  const KEY = "f7_tournament_v1";
  return {
    load(){ try{ return JSON.parse(localStorage.getItem(KEY)); }catch{return null} },
    save(obj){ localStorage.setItem(KEY, JSON.stringify(obj)); },
    clear(){ localStorage.removeItem(KEY); },
  };
}

function SupabaseAdapter({url, key, bucket='f7-media', tournamentId=null}){
  const client = supabase.createClient(url, key);
  const TKEY = 'f7_tournament_tid';

  function getTidLocal(){ try{ return localStorage.getItem(TKEY) || null; }catch{return null} }
  function setTidLocal(id){ try{ localStorage.setItem(TKEY, id); }catch{} }

  async function uploadDataURL(dataUrl, folder){
    if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
    const ext = (dataUrl.substring(5).split(';')[0].split('/')[1] || 'png').toLowerCase();
    const file = await (await fetch(dataUrl)).blob();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await client.storage.from(bucket).upload(path, file, { upsert: false });
    if (upErr) { console.error(upErr); return ''; }
    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function ensureTournament(state){
    let tid = tournamentId || getTidLocal() || state?.tournament?.id || crypto.randomUUID();
    const payload = {
      id: tid,
      name: state?.tournament?.name || 'Copa',
      mode: state?.tournament?.mode || 'league',
      start_date: state?.tournament?.startDate || null,
      default_time: state?.tournament?.defaultTime || '20:00'
    };
    const { error } = await client.from('tournaments').upsert(payload);
    if (error) console.error(error);
    setTidLocal(tid);
    return tid;
  }

  return {
    async load(){
      const tid = tournamentId || getTidLocal();
      if (!tid) return null;

      const [{ data: t }, { data: teams }, { data: players }, { data: matches }, { data: photos }] = await Promise.all([
        client.from('tournaments').select('*').eq('id', tid).maybeSingle(),
        client.from('teams').select('*').eq('tournament_id', tid),
        client.from('players').select('*').eq('tournament_id', tid),
        client.from('matches').select('*').eq('tournament_id', tid),
        client.from('photos').select('*').eq('tournament_id', tid),
      ]);

      if (!t) return null;

      return {
        tournament: {
          id: t.id, name: t.name, mode: t.mode, startDate: t.start_date || '', defaultTime: t.default_time || '20:00'
        },
        teams: (teams||[]).map(x=>({
          id:x.id, name:x.name, formation:x.formation, logoUrl:x.logo_url||'', stats: baseTeamStats()
        })),
        players: (players||[]).map(x=>({
          id:x.id, teamId:x.team_id, name:x.name, number:x.number||0, position:x.position||'FWD', photoUrl:x.photo_url||'',
          stats:{goals:x.goals||0, mvp:x.mvp||0}
        })),
        matches: (matches||[]).map(x=>({
          id:x.id, stage:x.stage, round:x.round, date:x.date, homeId:x.home_id, awayId:x.away_id,
          scoreHome:x.score_home, scoreAway:x.score_away, playerGoals:x.player_goals||{}, mvpId:x.mvp_id||null
        })),
        photos: (photos||[]).map(x=>({ id:x.id, url:x.url }))
      };
    },

    async save(state){
      const tid = await ensureTournament(state);

      for (const t of state.teams){
        if (t.logoUrl && t.logoUrl.startsWith('data:')){
          t.logoUrl = await uploadDataURL(t.logoUrl, `teams/${tid}`);
        }
      }
      for (const p of state.players){
        if (p.photoUrl && p.photoUrl.startsWith('data:')){
          p.photoUrl = await uploadDataURL(p.photoUrl, `players/${tid}`);
        }
      }
      for (const ph of state.photos){
        if (ph.url && ph.url.startsWith('data:')){
          ph.url = await uploadDataURL(ph.url, `matches/${tid}`);
        }
      }

      await client.from('tournaments').upsert({
        id: tid,
        name: state.tournament.name,
        mode: state.tournament.mode,
        start_date: state.tournament.startDate || null,
        default_time: state.tournament.defaultTime || '20:00'
      });

      if (state.teams.length){
        const payload = state.teams.map(t=>({
          id: t.id, tournament_id: tid, name: t.name, formation: t.formation, logo_url: t.logoUrl || null
        }));
        await client.from('teams').upsert(payload);
      }
      if (state.players.length){
        const payload = state.players.map(p=>({
          id: p.id, tournament_id: tid, team_id: p.teamId || null, name: p.name, number: p.number||0,
          position: p.position||'FWD', photo_url: p.photoUrl || null,
          goals: p.stats?.goals||0, mvp: p.stats?.mvp||0
        }));
        await client.from('players').upsert(payload);
      }
      if (state.matches.length){
        const payload = state.matches.map(m=>({
          id:m.id, tournament_id: tid, stage:m.stage, round:m.round, date:m.date?new Date(m.date).toISOString():null,
          home_id:m.homeId||null, away_id:m.awayId||null, score_home:m.scoreHome, score_away:m.scoreAway,
          player_goals:m.playerGoals||{}, mvp_id:m.mvpId||null
        }));
        await client.from('matches').upsert(payload);
      }
      if (state.photos.length){
        const payload = state.photos.map(ph=>({
          id: ph.id, tournament_id: tid, url: ph.url
        }));
        await client.from('photos').upsert(payload);
      }
    },

    clear(){ /* opcional: wipe por torneo */ }
  };
}

/* ====== Utils ====== */
function mapRole(r){
  return ({GK:"Arquero", DEF:"Defensa", MID:"Mediocampo", FWD:"Delantero", SUB:"Suplente"})[r] || r;
}
async function fileToObjectURL(file){
  if (!file) return "";
  return new Promise(res=>{
    const fr = new FileReader();
    fr.onload = ()=> res(fr.result);
    fr.readAsDataURL(file);
  });
}
function toast(msg, warn=false){
  const div = $("#toast");
  div.className = warn?"warn":"success";
  div.textContent = msg;
  setTimeout(()=>{ div.textContent=""; div.className=""; }, 2200);
}
function downloadText(name, text){
  const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function nullish(x){ return (x==null?"":x); }
function csvToRows(text){
  return text.replace(/\r/g,"").split("\n").filter(Boolean).map(line=>line.split(",").map(s=>s.trim()));
}
function rowsToCSV(rows){
  return rows.map(r=>r.map(v=>String(v??"").includes(",")?`"${String(v).replace(/"/g,'""')}"`:v).join(",")).join("\n");
}
function mapIndex(hdr, keys){
  const idx = {};
  keys.forEach(k=>{
    const i = hdr.indexOf(k);
    if (i<0) throw new Error(`CSV falta columna: ${k}`);
    idx[k]=i;
  });
  return idx;
}


