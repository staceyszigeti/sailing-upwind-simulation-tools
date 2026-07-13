(() => {
const KN = 0.514444;               // knots → m/s
const D2R = Math.PI/180;
const dirVec = deg => ({x: Math.sin(deg*D2R), y: Math.cos(deg*D2R)}); // compass bearing → unit vector (x=east, y=north)
const brgOf = v => (Math.atan2(v.x, v.y)/D2R + 360) % 360;
const norm180 = a => { a = ((a % 360) + 540) % 360 - 180; return a; };
const fmtT = s => {
  if (!isFinite(s)) return '—';
  const m = Math.floor(s/60), ss = Math.round(s%60);
  return String(m).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
};

const $ = id => document.getElementById(id);

// phase input mode: 'offset' (Δ° from mean) or 'twd' (absolute bearing)
let phaseMode = 'offset';
// current direction convention: 'towards' (set) or 'from'
let curDir = 'towards';
function norm360(a){ return ((a % 360) + 360) % 360; }
function setPhaseMode(mode){
  if (mode === phaseMode) return;
  const mean = parseFloat($('windMean').value) || 0;
  const cvt = id => {
    const cur = parseFloat($(id).value) || 0;
    if (mode === 'twd'){          // offset → absolute
      $(id).value = Math.round(norm360(mean + cur));
    } else {                      // absolute → offset
      let d = ((cur - mean + 540) % 360) - 180;
      $(id).value = Math.round(d);
    }
  };
  cvt('windMin'); cvt('windMax');
  phaseMode = mode;
  applyPhaseModeUI(mode);
  compute();
}
function applyPhaseModeUI(mode){
  ['windMin','windMax'].forEach(id => {
    $(id).min = mode === 'twd' ? 0 : -180;
    $(id).max = mode === 'twd' ? 359 : 180;
  });
  $('pmOffset').classList.toggle('active', mode === 'offset');
  $('pmTwd').classList.toggle('active', mode === 'twd');
  $('pmOffset').setAttribute('aria-selected', mode === 'offset');
  $('pmTwd').setAttribute('aria-selected', mode === 'twd');
  $('lblMin').textContent = mode === 'offset' ? 'Left phase (Δ°)' : 'Left phase TWD (°)';
  $('lblMax').textContent = mode === 'offset' ? 'Right phase (Δ°)' : 'Right phase TWD (°)';
  $('phaseHint').innerHTML = mode === 'offset'
    ? 'Left/right phase given as an offset from the mean (e.g. −12 = 12° left of mean). Switch to <em>Absolute TWD</em> to type the two extreme wind directions directly.'
    : 'Left/right phase given as absolute wind directions (TWD), e.g. 348 and 012. Switch to <em>Offset Δ°</em> to enter them relative to the mean instead.';
}
const PARAM_IDS = ['lineLen','markDist','markBrg','windMean','windMin','windMax','tws',
                   'c0d','c0s','c1d','c1s','c2d','c2s','c3d','c3s'];
const inputs = PARAM_IDS.map($);

// ---- persist every input between sessions ----
const LS_PARAMS = 'utsim.params.v1';
function saveParams(){
  try {
    const fields = {};
    PARAM_IDS.forEach(id => fields[id] = $(id).value);
    localStorage.setItem(LS_PARAMS, JSON.stringify({ fields, phaseMode, curDir }));
  } catch(e){}
}
function restoreParams(){
  try {
    const s = JSON.parse(localStorage.getItem(LS_PARAMS));
    if (!s || !s.fields) return;
    PARAM_IDS.forEach(id => { if (id in s.fields) $(id).value = s.fields[id]; });
    if (s.phaseMode === 'twd' || s.phaseMode === 'offset'){
      phaseMode = s.phaseMode; applyPhaseModeUI(phaseMode);
    }
    if (s.curDir === 'towards' || s.curDir === 'from'){
      curDir = s.curDir; applyCurDirUI(curDir);
    }
  } catch(e){}
}

// compass bearing fields: wrap out-of-range values back into 0–359 on blur
// (e.g. 450 → 90, −20 → 340); phase fields wrap to ±180 in offset mode
function wrapOnBlur(id, wrap){
  const el = $(id);
  el.addEventListener('change', () => {
    const v = parseFloat(el.value);
    if (isFinite(v)) el.value = wrap(v);
  });
}
wrapOnBlur('markBrg',  v => Math.round(norm360(v)));
wrapOnBlur('windMean', v => Math.round(norm360(v)));
['windMin','windMax'].forEach(id =>
  wrapOnBlur(id, v => Math.round(phaseMode === 'twd' ? norm360(v) : norm180(v))));

// ---- boat library: a simple local "database" (localStorage + JSON export/import) ----
const LS_BOATS = 'utsim.boats.v1', LS_ACTIVE = 'utsim.activeBoat.v1';
const DEFAULT_BOATS = [
  { id:'ilca7', name:'ILCA 7', polar:[
    {tws:5, twa:46, bsp:3.2},{tws:8, twa:44, bsp:4.3},{tws:12, twa:43, bsp:5.1},{tws:16, twa:42, bsp:5.5},{tws:20, twa:42, bsp:5.7}]},
  { id:'ilca6', name:'ILCA 6', polar:[
    {tws:5, twa:46, bsp:3.0},{tws:8, twa:45, bsp:4.1},{tws:12, twa:43, bsp:4.9},{tws:16, twa:43, bsp:5.3},{tws:20, twa:43, bsp:5.5}]},
  { id:'i470', name:'470', polar:[
    {tws:5, twa:44, bsp:3.7},{tws:8, twa:43, bsp:4.9},{tws:12, twa:42, bsp:5.7},{tws:16, twa:41, bsp:6.1},{tws:20, twa:41, bsp:6.3}]},
  { id:'f49er', name:'49er', polar:[
    {tws:5, twa:45, bsp:4.5},{tws:8, twa:42, bsp:6.5},{tws:12, twa:40, bsp:8.4},{tws:16, twa:39, bsp:9.4},{tws:20, twa:39, bsp:10.0}]},
  { id:'f49fx', name:'49erFX', polar:[
    {tws:5, twa:45, bsp:4.3},{tws:8, twa:43, bsp:6.2},{tws:12, twa:41, bsp:8.0},{tws:16, twa:40, bsp:9.0},{tws:20, twa:40, bsp:9.6}]},
  { id:'keel', name:'Generic keelboat', polar:[
    {tws:6, twa:45, bsp:4.5},{tws:10, twa:42, bsp:5.8},{tws:14, twa:40, bsp:6.4},{tws:20, twa:39, bsp:6.8}]},
];
function loadBoats(){
  try {
    const b = JSON.parse(localStorage.getItem(LS_BOATS));
    if (Array.isArray(b) && b.length && b.every(x => x && x.name && Array.isArray(x.polar))){
      // migration: default boats used to be named "… (example)"
      b.forEach(x => { x.name = x.name.replace(/\s*\(example\)$/, ''); });
      return b;
    }
  } catch(e){}
  return JSON.parse(JSON.stringify(DEFAULT_BOATS));
}
let boats = loadBoats();
// one-time seed merge: add any new default boats missing from an already-stored library
const SEED_KEY = 'utsim.seed.v3';
try {
  if (!localStorage.getItem(SEED_KEY)){
    let added = false;
    DEFAULT_BOATS.forEach(d => {
      if (!boats.some(b => b.id === d.id)){ boats.push(JSON.parse(JSON.stringify(d))); added = true; }
    });
    localStorage.setItem(SEED_KEY, '1');
    if (added) localStorage.setItem(LS_BOATS, JSON.stringify(boats));
  }
} catch(e){}
let activeId = null;
try { activeId = localStorage.getItem(LS_ACTIVE); } catch(e){}
if (!boats.some(b => b.id === activeId)) activeId = boats[0].id;
function persistBoats(){
  try {
    localStorage.setItem(LS_BOATS, JSON.stringify(boats));
    localStorage.setItem(LS_ACTIVE, activeId);
  } catch(e){}
}
const activeBoat = () => boats.find(b => b.id === activeId) || boats[0];

// linear interpolation in the boat's upwind polar; clamps outside the table range
function polarAt(boat, tws){
  const pts = [...boat.polar].sort((a,b) => a.tws - b.tws);
  if (!pts.length) return { twa: 42, bsp: 5 };
  if (tws <= pts[0].tws) return { twa: pts[0].twa, bsp: pts[0].bsp };
  const last = pts[pts.length-1];
  if (tws >= last.tws) return { twa: last.twa, bsp: last.bsp };
  for (let i = 1; i < pts.length; i++){
    if (pts[i].tws >= tws){
      const a = pts[i-1], b = pts[i], f = (tws - a.tws) / (b.tws - a.tws);
      return { twa: a.twa + (b.twa - a.twa)*f, bsp: a.bsp + (b.bsp - a.bsp)*f };
    }
  }
  return { twa: last.twa, bsp: last.bsp };
}

function renderBoatSelect(){
  const sel = $('boatSel');
  sel.innerHTML = '';
  boats.forEach(b => {
    const o = document.createElement('option');
    o.value = b.id; o.textContent = b.name;
    sel.appendChild(o);
  });
  sel.value = activeId;
  renderBoatInfo();
}
function renderBoatInfo(){
  const tws = parseFloat($('tws').value) || 0;
  const b = activeBoat();
  const pol = polarAt(b, tws);
  $('boatInfo').textContent =
    `@ ${tws} kn TWS → TWA ${pol.twa.toFixed(1)}°, ${pol.bsp.toFixed(2)} kn (${b.polar.length}-point polar)`;
}

const MPM = 1/60;   // metres per minute → m/s
function measuredCur(dId, sId){
  const raw = $(sId).value.trim();
  const measured = raw !== '' && isFinite(parseFloat(raw));
  // stored direction is always "towards"; if the user enters "from", flip by 180°
  let d = parseFloat($(dId).value) || 0;
  if (curDir === 'from') d += 180;
  return { d, s: (parseFloat(raw) || 0) * MPM, measured };
}

function readParams(){
  const v = id => parseFloat($(id).value) || 0;
  const mean = v('windMean');
  const tws = Math.max(0.5, v('tws'));
  const pol = polarAt(activeBoat(), tws);
  // explicit phase interpretation: offset from mean, or absolute TWD
  const phase = x => phaseMode === 'offset' ? mean + x : x;
  return {
    lineLen: Math.max(10, v('lineLen')),
    markDist: Math.max(100, v('markDist')),
    markBrg: v('markBrg'),
    windMean: mean,
    windMin: phase(v('windMin')),
    windMax: phase(v('windMax')),
    tws,
    twa: Math.min(80, Math.max(20, pol.twa)),
    bsp: Math.max(0.3, pol.bsp) * KN,
    cur: [
      measuredCur('c0d','c0s'),
      measuredCur('c1d','c1s'),
      measuredCur('c2d','c2s'),
      measuredCur('c3d','c3s'),
    ]
  };
}

// ---- geometry (true compass frame) ----
// The start line is square to the start→mark axis (mark bearing), NOT to the wind.
function geometry(p){
  const m = dirVec(p.markBrg);                        // up the course axis
  const M = { x: m.x*p.markDist, y: m.y*p.markDist };
  const rL = { x: m.y, y: -m.x };                     // along the start line, to the right of the course axis
  const half = p.lineLen/2;
  const rc  = { x:  rL.x*half, y:  rL.y*half };       // committee boat (right end, course-up)
  const pin = { x: -rL.x*half, y: -rL.y*half };       // pin (left end)
  // layline corners: laylines around the COURSE AXIS (not the wind), intersected with the start line's own line.
  // These are fixed physical measurement locations — rotating the wind must not move them or the current field.
  const cross = (a,b) => a.x*b.y - a.y*b.x;
  const cornerFor = deg => {
    const w = dirVec(deg);                            // layline direction, pointing down-course from the mark
    const den = cross(rL, w);
    let t = Math.abs(den) < 1e-6 ? 0 : cross(M, w) / den;
    const lim = 4 * p.markDist;                       // keep extreme angles from blowing up the view
    t = Math.max(-lim, Math.min(lim, t));
    return { x: rL.x*t, y: rL.y*t };
  };
  const cornerR = cornerFor(p.markBrg - p.twa + 180); // starboard-side corner (dashed reference layline endpoint)
  const cornerL = cornerFor(p.markBrg + p.twa + 180); // port-side corner
  // left/right current measurement points: halfway up the course, sitting on the laylines
  const halfUp = p.markDist / 2;
  const lat = Math.tan(p.twa * D2R) * halfUp;
  const mid = { x: m.x*halfUp, y: m.y*halfUp };
  const llR = { x: mid.x + rL.x*lat, y: mid.y + rL.y*lat };
  const llL = { x: mid.x - rL.x*lat, y: mid.y - rL.y*lat };
  return { M, rc, pin, cornerL, cornerR,
           curPts: [ {x:0,y:0}, M, llL, llR ] };
}

// ---- current field: inverse-distance weighting over MEASURED points only ----
function makeCurrentField(p, g){
  const meas = [];
  p.cur.forEach((c, i) => {
    if (c.measured) meas.push({ pt: g.curPts[i], v: { x: dirVec(c.d).x*c.s, y: dirVec(c.d).y*c.s } });
  });
  if (!meas.length) return () => ({ x: 0, y: 0 });   // no data → still water
  return (x, y) => {
    let wx=0, wy=0, wsum=0;
    for (const m of meas){
      const dx = x-m.pt.x, dy = y-m.pt.y;
      const d2 = dx*dx+dy*dy;
      if (d2 < 1) return m.v;
      const w = 1/d2;
      wx += m.v.x*w; wy += m.v.y*w; wsum += w;
    }
    return { x: wx/wsum, y: wy/wsum };
  };
}

// ---- simulation: one run ----
// firstTack: +1 = right side (port tack first), -1 = left side (starboard first)
function simulate(twd, firstTack, p, g, curAt){
  const dt = 2, maxT = 4*3600, closeR = 18, tackLock = 20;
  let pos = {x:0, y:0}, tack = firstTack, t = 0, lastTack = -1e9;
  const path = [{x:0, y:0, t:0}];
  let step = 0;
  while (t < maxT){
    const cur = curAt(pos.x, pos.y);
    const toM = { x: g.M.x - pos.x, y: g.M.y - pos.y };
    const dm = Math.hypot(toM.x, toM.y);
    if (dm < closeR){ path.push({x:pos.x,y:pos.y,t}); return { time: t, path, ok:true }; }

    // --- direct sailing (fetch/reach): if the mark can be reached without beating,
    // steer a current-compensated heading straight at it. This is how the boat closes
    // the final metres, recovers a small overstand, and handles marks that a big shift
    // has turned into a fetch. Solve V_bsp·b + current = k·u (u = unit vector to mark).
    const u = { x: toM.x/dm, y: toM.y/dm };
    const cu = cur.x*u.x + cur.y*u.y;
    const disc = cu*cu - (cur.x*cur.x + cur.y*cur.y) + p.bsp*p.bsp;
    if (disc > 0){
      const k = cu + Math.sqrt(disc);            // closing speed over ground along u
      if (k > 0.05){
        const bx = (k*u.x - cur.x)/p.bsp, by = (k*u.y - cur.y)/p.bsp;
        const hdgDirect = brgOf({ x: bx, y: by });
        if (Math.abs(norm180(hdgDirect - twd)) >= p.twa - 0.5){  // outside the no-go zone
          if (dm <= k*dt + 1){
            t += dm / k;
            path.push({ x: g.M.x, y: g.M.y, t });
            return { time: t, path, ok: true };
          }
          pos = { x: pos.x + u.x*k*dt, y: pos.y + u.y*k*dt };
          t += dt; step++;
          if (step % 2 === 0) path.push({x:pos.x, y:pos.y, t});
          continue;
        }
      }
    }

    // --- beating: tack test — does the opposite tack's course-over-ground already fetch the mark?
    const h2 = twd - tack * p.twa;
    const d2 = dirVec(h2);
    const v2 = { x: d2.x*p.bsp + cur.x, y: d2.y*p.bsp + cur.y };
    const delta = norm180(brgOf(toM) - brgOf(v2));
    if (t - lastTack > tackLock && Math.abs(delta) < 90 && tack*delta <= 0){
      tack = -tack; lastTack = t;
      continue;
    }
    const h = twd + tack * p.twa;
    const dh = dirVec(h);
    const v = { x: dh.x*p.bsp + cur.x, y: dh.y*p.bsp + cur.y };
    pos = { x: pos.x + v.x*dt, y: pos.y + v.y*dt };
    t += dt; step++;
    if (step % 2 === 0) path.push({x:pos.x, y:pos.y, t});
  }
  return { time: Infinity, path, ok:false };
}

// ---- main computation ----
let state = null;
function compute(){
  const p = readParams();
  const g = geometry(p);
  const curAt = makeCurrentField(p, g);
  // course-up rotation: mark bearing becomes straight up on screen
  const b = p.markBrg * D2R, cb = Math.cos(b), sb = Math.sin(b);
  const rot   = q => ({ x: q.x*cb - q.y*sb, y: q.x*sb + q.y*cb });
  const unrot = q => ({ x: q.x*cb + q.y*sb, y: -q.x*sb + q.y*cb });
  const scen = [
    { name:'Left phase',  twd:p.windMin,  color:getCss('--wind-min')  },
    { name:'Mean',        twd:p.windMean, color:getCss('--wind-mean') },
    { name:'Right phase', twd:p.windMax,  color:getCss('--wind-max')  },
  ];
  const runs = scen.map(s => ({
    ...s,
    left:  simulate(s.twd, -1, p, g, curAt),
    right: simulate(s.twd, +1, p, g, curAt),
  }));
  state = { p, g, curAt, runs, rot, unrot };
  renderBoatInfo();
  const nMeas = p.cur.filter(c => c.measured).length;
  $('curStatus').textContent = nMeas === 0
    ? 'No current points measured → running with no current.'
    : `${nMeas} of 4 points measured → field interpolated from those${nMeas < 4 ? '; the rest are ignored.' : '.'}`;
  $('curStatus').style.color = nMeas === 0 ? 'var(--wind-mean)' : 'var(--teal)';
  renderResults();
  stopPlay();
  draw(Infinity);
  saveParams();
}

function getCss(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

// ---- results table ----
function renderResults(){
  const tb = $('resBody'); tb.innerHTML = '';
  let leftWins = 0, rightWins = 0, meanDelta = NaN;
  state.runs.forEach((r, i) => {
    const tl = r.left.time, tr = r.right.time;
    const d = tr - tl;
    if (i === 1) meanDelta = d;
    let winner = '—', diffTxt = '—';
    if (isFinite(tl) && isFinite(tr)){
      if (Math.abs(d) < 3){ winner = 'about equal'; diffTxt = '< 3 s'; }
      else if (d > 0){ winner = 'Left'; leftWins++; diffTxt = Math.round(d) + ' s'; }
      else { winner = 'Right'; rightWins++; diffTxt = Math.round(-d) + ' s'; }
    } else if (isFinite(tl)){ winner = 'Left'; leftWins++; }
    else if (isFinite(tr)){ winner = 'Right'; rightWins++; }
    const row = document.createElement('tr');
    row.innerHTML =
      `<td class="name"><span class="dot" style="background:${r.color}"></span>${r.name} (${((r.twd%360)+360)%360|0}°)</td>` +
      `<td class="${winner==='Left'?'win':''}">${fmtT(tl)}</td>` +
      `<td class="${winner==='Right'?'win':''}">${fmtT(tr)}</td>` +
      `<td>${diffTxt}</td>` +
      `<td>${winner}</td>`;
    tb.appendChild(row);
  });
  const s = $('summary');
  const unreachable = state.runs.some(r => !r.left.ok || !r.right.ok);
  let html = '';
  if (leftWins > rightWins) html = `Overall: the <strong>left side</strong> is favoured (faster in ${leftWins}/3 scenarios).`;
  else if (rightWins > leftWins) html = `Overall: the <strong>right side</strong> is favoured (faster in ${rightWins}/3 scenarios).`;
  else html = `Overall: the two sides are <strong>even</strong> – the call may come down to which phase of the oscillation you start in.`;
  if (isFinite(meanDelta) && Math.abs(meanDelta) >= 3){
    html += ` In mean wind the gap is <strong>${Math.abs(Math.round(meanDelta))} s</strong> in favour of the ${meanDelta>0?'left':'right'} side.`;
  }
  if (unreachable) html += ` <span class="warn">Note: in at least one run the boat never reached the mark (current too strong or an extreme setting).</span>`;
  s.innerHTML = html;
}

// ---- drawing (course-up: everything passes through state.rot) ----
const canvas = $('chart');
const ctx = canvas.getContext('2d');

function computeView(){
  const g = state.g, rot = state.rot;
  // FIXED frame: derived from the course geometry only (line, mark, layline corners).
  // Wind changes move the trajectories but never reframe or rescale the chart.
  const pts = [g.rc, g.pin, g.M, g.cornerL, g.cornerR, {x:0,y:0}].map(rot);
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  pts.forEach(q => { minX=Math.min(minX,q.x); maxX=Math.max(maxX,q.x);
                     minY=Math.min(minY,q.y); maxY=Math.max(maxY,q.y); });
  const padW = (maxX-minX)*0.16 + 40, padH = (maxY-minY)*0.10 + 40;
  minX-=padW; maxX+=padW; minY-=padH; maxY+=padH;
  const wrap = canvas.parentElement;
  const cssW = wrap.clientWidth;
  const worldW = maxX-minX, worldH = maxY-minY;
  // cap the chart height at the space actually free in the stage column,
  // so the whole right side fits on one screen without scrolling
  let capH = Math.max(window.innerHeight*0.62, 380);
  if (window.matchMedia('(min-width: 901px)').matches){
    const stageEl = wrap.parentElement;
    const cs = getComputedStyle(stageEl);
    let free = stageEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
    for (const el of stageEl.children) if (el !== wrap) free -= el.offsetHeight + 12;
    if (free > 200) capH = free;
  }
  const cssH = Math.min(Math.max(cssW * worldH / worldW, 260), capH);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cssW*dpr; canvas.height = cssH*dpr;
  canvas.style.height = cssH+'px';
  const s = Math.min(cssW/worldW, cssH/worldH);
  const ox = (cssW - worldW*s)/2, oy = (cssH - worldH*s)/2;
  const toX = x => (ox + (x-minX)*s)*dpr;
  const toY = y => (cssH - oy - (y-minY)*s)*dpr;
  return {
    toX, toY,
    // world point (true frame) → screen
    px: q => { const w = state.rot(q); return { x: toX(w.x), y: toY(w.y) }; },
    // screen px → world point (true frame)
    world: (sx, sy) => {
      const rx = (sx/dpr - ox)/s + minX;
      const ry = (cssH - oy - sy/dpr)/s + minY;
      return state.unrot({ x: rx, y: ry });
    },
    scale: s*dpr, dpr
  };
}

function arrow(x1,y1,x2,y2, w){
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  const a = Math.atan2(y2-y1, x2-x1), L = 6*w;
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2 - L*Math.cos(a-0.42), y2 - L*Math.sin(a-0.42));
  ctx.lineTo(x2 - L*Math.cos(a+0.42), y2 - L*Math.sin(a+0.42));
  ctx.closePath(); ctx.fill();
}

// rotate a true-frame direction vector into the screen frame (screen y grows downwards)
function dispVec(d){
  const r = state.rot(d);
  return { x: r.x, y: -r.y };
}

function draw(tShow){
  if (!state) return;
  const v = computeView();
  const { p, g, curAt, runs } = state;
  const W = canvas.width, H = canvas.height, dpr = v.dpr;
  ctx.clearRect(0,0,W,H);

  // faint grid
  ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1*dpr;
  const gridStep = niceStep((W/v.scale)/8) * v.scale;
  for (let x = ((v.toX(0)%gridStep)+gridStep)%gridStep; x < W; x += gridStep){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = ((v.toY(0)%gridStep)+gridStep)%gridStep; y < H; y += gridStep){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // interpolated current field arrows on a sparse grid
  ctx.strokeStyle = 'rgba(58,125,93,0.35)'; ctx.fillStyle = 'rgba(58,125,93,0.35)';
  ctx.lineWidth = 1.1*dpr;
  const nGX = 9, nGY = 9;
  for (let i=1;i<nGX;i++) for (let j=1;j<nGY;j++){
    const sx = i/nGX*W, sy = j/nGY*H;
    const wp = v.world(sx, sy);
    const c = curAt(wp.x, wp.y);
    const sp = Math.hypot(c.x, c.y);
    if (sp < 0.01) continue;
    const len = (10 + 26*Math.min(sp/(1.5*KN),1)) * dpr;
    const dv = dispVec({ x: c.x/sp, y: c.y/sp });
    arrow(sx - dv.x*len/2, sy - dv.y*len/2, sx + dv.x*len/2, sy + dv.y*len/2, dpr);
  }

  // 4 measurement points: emphasised current arrows (measured) or dimmed markers (not measured)
  const ptLabels = ['start','mark','left LL','right LL'];
  g.curPts.forEach((q, i) => {
    const c = p.cur[i];
    const s0 = v.px(q);
    if (c.measured){
      ctx.strokeStyle = getCss('--teal'); ctx.fillStyle = getCss('--teal'); ctx.lineWidth = 2*dpr;
      const dv = dispVec(dirVec(c.d));
      const len = (14 + 30*Math.min(c.s/(1.5*KN),1)) * dpr;
      if (c.s > 0.005) arrow(s0.x, s0.y, s0.x + dv.x*len, s0.y + dv.y*len, 1.2*dpr);
      ctx.beginPath(); ctx.arc(s0.x, s0.y, 3*dpr, 0, 7); ctx.fill();
    } else {
      // not measured: hollow faded circle, "no data" tag
      ctx.strokeStyle = 'rgba(92,88,77,0.5)'; ctx.lineWidth = 1.4*dpr;
      ctx.setLineDash([3*dpr,3*dpr]);
      ctx.beginPath(); ctx.arc(s0.x, s0.y, 5*dpr, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `${9*dpr}px 'IBM Plex Mono',monospace`;
      ctx.fillStyle = 'rgba(92,88,77,0.65)'; ctx.textAlign = 'center';
      ctx.fillText('no data', s0.x, s0.y + 16*dpr);
      ctx.fillText(ptLabels[i], s0.x, s0.y - 9*dpr);
    }
  });

  // reference laylines (mean wind, no current)
  ctx.strokeStyle = 'rgba(92,88,77,0.5)'; ctx.lineWidth = 1*dpr;
  ctx.setLineDash([6*dpr,6*dpr]);
  [[g.M, g.cornerL], [g.M, g.cornerR]].forEach(([a,b]) => {
    const A = v.px(a), B = v.px(b);
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  });
  ctx.setLineDash([]);

  // trajectories
  runs.forEach(r => {
    [r.left, r.right].forEach(run => {
      ctx.strokeStyle = r.color; ctx.lineWidth = 2.2*dpr;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      let started = false;
      for (const q of run.path){
        if (q.t > tShow) break;
        const s0 = v.px(q);
        if (!started){ ctx.moveTo(s0.x, s0.y); started = true; } else ctx.lineTo(s0.x, s0.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      // moving boat dot during playback
      if (isFinite(tShow) && tShow < run.time){
        const q = posAt(run.path, tShow);
        if (q){
          const s0 = v.px(q);
          ctx.fillStyle = r.color;
          ctx.beginPath(); ctx.arc(s0.x, s0.y, 4.5*dpr, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.5*dpr; ctx.stroke();
        }
      }
    });
  });

  // start line + mark
  const RC = v.px(g.rc), PIN = v.px(g.pin);
  ctx.strokeStyle = getCss('--cyan'); ctx.lineWidth = 2.5*dpr;
  ctx.beginPath(); ctx.moveTo(PIN.x, PIN.y); ctx.lineTo(RC.x, RC.y); ctx.stroke();
  drawMarker(v, g.rc, getCss('--cyan'), 'RC boat', dpr, 'rect');
  drawMarker(v, g.pin, getCss('--cyan'), 'Pin', dpr, 'tri');
  drawMarker(v, g.M, '#d9822b', 'Mark', dpr, 'circ');

  // wind rose: three wind-direction arrows, top right (rotated into course-up frame)
  const wr = { x: W - 74*dpr, y: 64*dpr };
  ctx.font = `${10*dpr}px 'IBM Plex Mono',monospace`;
  ctx.fillStyle = getCss('--ink-dim');
  ctx.textAlign = 'center';
  ctx.fillText('WIND', wr.x, wr.y - 44*dpr);
  runs.forEach(r => {
    const dv = dispVec(dirVec(r.twd));
    ctx.strokeStyle = r.color; ctx.fillStyle = r.color; ctx.lineWidth = 2*dpr;
    arrow(wr.x + dv.x*34*dpr, wr.y + dv.y*34*dpr, wr.x + dv.x*6*dpr, wr.y + dv.y*6*dpr, 1.3*dpr);
  });

  // scale bar
  const stepM = niceStep((W/v.scale)/6);
  const pxLen = stepM * v.scale;
  ctx.strokeStyle = getCss('--ink-dim'); ctx.lineWidth = 1.5*dpr;
  const bx = 16*dpr, by = H - 46*dpr;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx+pxLen, by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx, by-4*dpr); ctx.lineTo(bx, by+4*dpr); ctx.moveTo(bx+pxLen, by-4*dpr); ctx.lineTo(bx+pxLen, by+4*dpr); ctx.stroke();
  ctx.fillStyle = getCss('--ink-dim'); ctx.textAlign = 'left';
  ctx.fillText(stepM + ' m', bx, by - 8*dpr);
}

function niceStep(raw){
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw/p;
  return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p;
}

function drawMarker(v, q, color, label, dpr, shape){
  const s0 = v.px(q);
  const x = s0.x, y = s0.y;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (shape === 'circ') ctx.arc(x, y, 6*dpr, 0, 7);
  else if (shape === 'rect') ctx.rect(x-5*dpr, y-5*dpr, 10*dpr, 10*dpr);
  else { ctx.moveTo(x, y-6*dpr); ctx.lineTo(x+5.5*dpr, y+4.5*dpr); ctx.lineTo(x-5.5*dpr, y+4.5*dpr); ctx.closePath(); }
  ctx.fill();
  ctx.font = `600 ${11*dpr}px 'STIX Two Text',serif`;
  ctx.fillStyle = '#1c1b18'; ctx.textAlign = 'center';
  ctx.fillText(label.toUpperCase(), x, y - 10*dpr);
}

function posAt(path, t){
  if (!path.length) return null;
  if (t <= path[0].t) return path[0];
  for (let i=1;i<path.length;i++){
    if (path[i].t >= t){
      const a = path[i-1], b = path[i];
      const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return { x: a.x + (b.x-a.x)*f, y: a.y + (b.y-a.y)*f };
    }
  }
  return path[path.length-1];
}

// ---- playback ----
let playing = false, playT = 0, rafId = null, lastTs = 0;
const SPEEDUP = 60; // 1 s real time = 60 s simulated
function stopPlay(){ playing = false; if (rafId) cancelAnimationFrame(rafId); $('playBtn').textContent = 'Play'; $('clock').textContent = '00:00'; }
$('playBtn').addEventListener('click', () => {
  if (playing){ stopPlay(); draw(Infinity); return; }
  playing = true; playT = 0; lastTs = 0;
  $('playBtn').textContent = 'Stop';
  const maxT = Math.max(...state.runs.flatMap(r => [r.left.time, r.right.time].filter(isFinite)), 60);
  const tick = ts => {
    if (!playing) return;
    if (lastTs) playT += (ts - lastTs)/1000 * SPEEDUP;
    lastTs = ts;
    $('clock').textContent = fmtT(playT);
    draw(playT);
    if (playT < maxT + 20) rafId = requestAnimationFrame(tick);
    else { playing = false; $('playBtn').textContent = 'Play'; draw(Infinity); }
  };
  rafId = requestAnimationFrame(tick);
});

// ---- info modals ----
function wireModal(btnId, modalId, closeId){
  const m = $(modalId), b = $(btnId), c = $(closeId);
  b.addEventListener('click', () => { m.hidden = false; c.focus(); });
  c.addEventListener('click', () => { m.hidden = true; b.focus(); });
  m.addEventListener('click', e => { if (e.target === m) m.hidden = true; });
  return m;
}
const modals = [
  wireModal('modelBtn', 'modelModal', 'modelClose'),
  wireModal('physBtn', 'physModal', 'physClose'),
];
const boatModal = $('boatModal');
modals.push(boatModal);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') modals.forEach(m => { if (!m.hidden) m.hidden = true; });
});

// ---- boat library UI ----
$('boatSel').addEventListener('change', e => {
  activeId = e.target.value;
  persistBoats();
  compute();
});

let editingId = null;
function polarRow(pt){
  const tr = document.createElement('tr');
  tr.innerHTML =
    `<td><input type="number" class="p-tws" step="0.5" min="0.5" value="${pt.tws}"></td>` +
    `<td><input type="number" class="p-twa" step="0.5" min="20" max="80" value="${pt.twa}"></td>` +
    `<td><input type="number" class="p-bsp" step="0.1" min="0.1" value="${pt.bsp}"></td>` +
    `<td><button type="button" class="rmrow" aria-label="Remove row">✕</button></td>`;
  tr.querySelector('.rmrow').addEventListener('click', () => tr.remove());
  return tr;
}
function openEditor(boat){
  editingId = boat ? boat.id : null;
  $('boatModalTitle').textContent = boat ? 'Edit boat' : 'New boat';
  $('boatName').value = boat ? boat.name : '';
  const rows = $('polarRows');
  rows.innerHTML = '';
  (boat ? boat.polar : [{tws:10, twa:42, bsp:5.5}]).forEach(pt => rows.appendChild(polarRow(pt)));
  boatModal.hidden = false;
  $('boatName').focus();
}
$('boatNew').addEventListener('click', () => openEditor(null));
$('boatEdit').addEventListener('click', () => openEditor(activeBoat()));
$('polarAdd').addEventListener('click', () => {
  const rows = $('polarRows');
  const last = rows.lastElementChild;
  const base = last
    ? { tws: (parseFloat(last.querySelector('.p-tws').value)||10) + 4,
        twa: parseFloat(last.querySelector('.p-twa').value)||42,
        bsp: parseFloat(last.querySelector('.p-bsp').value)||5.5 }
    : { tws:10, twa:42, bsp:5.5 };
  rows.appendChild(polarRow(base));
});
$('boatCancel').addEventListener('click', () => { boatModal.hidden = true; });
$('boatModalClose').addEventListener('click', () => { boatModal.hidden = true; });
boatModal.addEventListener('click', e => { if (e.target === boatModal) boatModal.hidden = true; });
$('boatSave').addEventListener('click', () => {
  const name = $('boatName').value.trim();
  if (!name){ $('boatName').focus(); return; }
  const polar = [...$('polarRows').querySelectorAll('tr')].map(tr => ({
    tws: parseFloat(tr.querySelector('.p-tws').value),
    twa: parseFloat(tr.querySelector('.p-twa').value),
    bsp: parseFloat(tr.querySelector('.p-bsp').value),
  })).filter(p => isFinite(p.tws) && p.tws > 0 && isFinite(p.twa) && isFinite(p.bsp) && p.bsp > 0)
     .sort((a,b) => a.tws - b.tws);
  if (!polar.length) return;
  if (editingId){
    const b = boats.find(x => x.id === editingId);
    if (b){ b.name = name; b.polar = polar; }
    activeId = editingId;
  } else {
    const id = 'b' + Date.now().toString(36);
    boats.push({ id, name, polar });
    activeId = id;
  }
  persistBoats();
  renderBoatSelect();
  boatModal.hidden = true;
  compute();
});
$('boatDel').addEventListener('click', () => {
  const b = activeBoat();
  if (!confirm(`Delete boat "${b.name}"?`)) return;
  boats = boats.filter(x => x.id !== b.id);
  if (!boats.length) boats = JSON.parse(JSON.stringify(DEFAULT_BOATS));
  activeId = boats[0].id;
  persistBoats();
  renderBoatSelect();
  compute();
});
$('boatExp').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(boats, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'boat-library.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
$('boatImpBtn').addEventListener('click', () => $('boatImp').click());
$('boatImp').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const data = JSON.parse(rd.result);
      const list = Array.isArray(data) ? data : [data];
      let imported = 0;
      list.forEach(b => {
        if (!b || !b.name || !Array.isArray(b.polar)) return;
        const polar = b.polar
          .map(p => ({ tws:+p.tws, twa:+p.twa, bsp:+p.bsp }))
          .filter(p => isFinite(p.tws) && p.tws > 0 && isFinite(p.twa) && isFinite(p.bsp) && p.bsp > 0)
          .sort((a,c) => a.tws - c.tws);
        if (!polar.length) return;
        const existing = boats.find(x => x.name === b.name);
        if (existing) existing.polar = polar;
        else boats.push({ id: 'b' + Date.now().toString(36) + imported, name: b.name, polar });
        imported++;
      });
      if (imported){
        persistBoats();
        renderBoatSelect();
        compute();
      } else {
        alert('No valid boats found in the file. Expected format: [{ "name": "...", "polar": [{ "tws": 10, "twa": 42, "bsp": 5.5 }, ...] }, ...]');
      }
    } catch(err){
      alert('Could not read the file as JSON.');
    }
    e.target.value = '';
  };
  rd.readAsText(file);
});

// ---- events ----
let deb = null;
inputs.forEach(el => el.addEventListener('input', () => {
  clearTimeout(deb); deb = setTimeout(compute, 200);
}));
window.addEventListener('resize', () => { if (state) draw(Infinity); });

$('pmOffset').addEventListener('click', () => setPhaseMode('offset'));
$('pmTwd').addEventListener('click', () => setPhaseMode('twd'));

function setCurDir(mode){
  if (mode === curDir) return;
  // convert the four direction fields so the physical flow stays the same
  ['c0d','c1d','c2d','c3d'].forEach(id => {
    const cur = parseFloat($(id).value);
    if (isFinite(cur)) $(id).value = Math.round(((cur + 180) % 360 + 360) % 360);
  });
  curDir = mode;
  applyCurDirUI(mode);
  compute();
}
function applyCurDirUI(mode){
  $('curTowards').classList.toggle('active', mode === 'towards');
  $('curFrom').classList.toggle('active', mode === 'from');
  $('curTowards').setAttribute('aria-selected', mode === 'towards');
  $('curFrom').setAttribute('aria-selected', mode === 'from');
  $('curDirHd').textContent = mode === 'towards' ? 'Set (°, towards)' : 'Dir (°, from)';
}
$('curTowards').addEventListener('click', () => setCurDir('towards'));
$('curFrom').addEventListener('click', () => setCurDir('from'));

if (window.UTSIM_VERSION){
  $('verTag').textContent = `v0.${window.UTSIM_VERSION.build} · ${window.UTSIM_VERSION.date}`;
}
restoreParams();
renderBoatSelect();
compute();
})();
