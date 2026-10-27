import { firebaseConfig } from './firebase-config.js';

/* ============ DATA ============ */
const ICONS = ['compass', 'map', 'backpack', 'boot', 'flashlight', 'lighter', 'binoculars', 'knife', 'tent'];
const ICON_NAMES = ['Kompas', 'Peta', 'Ransel', 'Sepatu', 'Senter', 'Korek api', 'Teropong', 'Pisau lipat', 'Tenda'];
const DIFFS = {
  easy:   { label: 'Mudah',  clues: 38 },
  medium: { label: 'Sedang', clues: 32 },
  hard:   { label: 'Sulit',  clues: 27 }
};
const $ = (s) => document.querySelector(s);
const iconSrc = (d) => `icons/${ICONS[d - 1]}.svg`;

/* ============ RNG & SOLVER ============ */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function popcount(m) { let n = 0; while (m) { m &= m - 1; n++; } return n; }
function candMask(g, i) {
  const r = (i / 9) | 0, c = i % 9; let m = 0;
  for (let k = 0; k < 9; k++) { m |= 1 << g[r * 9 + k]; m |= 1 << g[k * 9 + c]; }
  const br = r - (r % 3), bc = c - (c % 3);
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) m |= 1 << g[(br + a) * 9 + bc + b];
  return ~m & 0x3FE;
}
function pickCell(g) { // sel MRV; -1 = penuh, -2 = buntu
  let best = -1, bestN = 10, bestM = 0;
  for (let i = 0; i < 81; i++) {
    if (g[i] !== 0) continue;
    const m = candMask(g, i), n = popcount(m);
    if (n === 0) return { i: -2 };
    if (n < bestN) { best = i; bestN = n; bestM = m; if (n === 1) break; }
  }
  return { i: best, m: bestM };
}
function countSolutions(g, limit) {
  let count = 0;
  (function rec() {
    const { i, m } = pickCell(g);
    if (i === -2) return;
    if (i === -1) { count++; return; }
    for (let d = 1; d <= 9; d++) {
      if (!(m & (1 << d))) continue;
      g[i] = d; rec(); g[i] = 0;
      if (count >= limit) return;
    }
  })();
  return count;
}
function randomSolution(rng) {
  const g = new Array(81).fill(0);
  (function rec() {
    const { i, m } = pickCell(g);
    if (i === -2) return false;
    if (i === -1) return true;
    const ds = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => m & (1 << d)), rng);
    for (const d of ds) { g[i] = d; if (rec()) return true; g[i] = 0; }
    return false;
  })();
  return g;
}
function makePuzzle(seed, clues) {
  const rng = mulberry32(hashStr(seed));
  const solution = randomSolution(rng);
  const puzzle = solution.slice();
  const order = shuffle([...Array(81).keys()], rng);
  let left = 81;
  for (const i of order) {
    if (left <= clues) break;
    const bak = puzzle[i]; puzzle[i] = 0;
    if (countSolutions(puzzle.slice(), 2) !== 1) puzzle[i] = bak; else left--;
  }
  return { puzzle, solution };
}

/* ============ REKOR (lokal + Firebase bila ada) ============ */
const configured = firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('ISI');
let fb = null;
async function initBackend() {
  if (!configured) return;
  try {
    const V = '10.14.1';
    const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
    const fs = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
    fb = { fs, db: fs.getFirestore(initializeApp(firebaseConfig)) };
  } catch (e) { console.warn('Firebase gagal dimuat, pakai penyimpanan lokal', e); fb = null; }
}
const PID = (() => {
  let p = localStorage.getItem('sp_pid');
  if (!p) { p = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)); localStorage.setItem('sp_pid', p); }
  return p;
})();
const REC_KEY = 'sp_records';
let records = (() => { try { return JSON.parse(localStorage.getItem(REC_KEY)) || {}; } catch { return {}; } })();
const saveLocal = () => localStorage.setItem(REC_KEY, JSON.stringify(records));

async function syncRecords() {
  if (!fb) return;
  try {
    const { doc, getDoc } = fb.fs;
    const snap = await getDoc(doc(fb.db, 'records', PID));
    if (snap.exists()) {
      const r = snap.data();
      for (const k of Object.keys(DIFFS)) if (r[k] && (!records[k] || r[k] < records[k])) records[k] = r[k];
      saveLocal(); renderRecords();
    }
  } catch (e) { console.warn(e); }
}
async function pushRecords(name) {
  if (!fb) return;
  try {
    const { doc, setDoc, serverTimestamp } = fb.fs;
    await setDoc(doc(fb.db, 'records', PID), { name, easy: records.easy || null, medium: records.medium || null, hard: records.hard || null, pid: PID, updatedAt: serverTimestamp() });
  } catch (e) { console.warn(e); }
}

function fmt(ms) {
  const t = Math.floor(ms / 100), d = t % 10, s = Math.floor(t / 10) % 60, m = Math.floor(t / 600);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${d}`;
}

/* ============ BERANDA ============ */
let selDiff = 'medium';
const nameInput = $('#nameInput');
nameInput.value = localStorage.getItem('sp_name') || '';

function renderRecords() {
  const ul = $('#records'); ul.innerHTML = '';
  for (const [k, v] of Object.entries(DIFFS)) {
    const li = document.createElement('li');
    const a = document.createElement('span'); a.textContent = v.label;
    const b = document.createElement('span'); b.textContent = records[k] ? fmt(records[k]) : '-';
    li.append(a, b); ul.appendChild(li);
  }
}
document.querySelectorAll('#diffSeg button').forEach((b) => b.addEventListener('click', () => {
  selDiff = b.dataset.diff;
  document.querySelectorAll('#diffSeg button').forEach((x) => x.classList.toggle('on', x === b));
}));

function showScreen(id) {
  $('#home').classList.toggle('hidden', id !== 'home');
  $('#game').classList.toggle('hidden', id !== 'game');
  window.scrollTo(0, 0);
}
$('#btnPlay').addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (name.length < 2) { $('#formMsg').textContent = 'Isi nama dulu.'; nameInput.focus(); return; }
  $('#formMsg').textContent = '';
  localStorage.setItem('sp_name', name);
  startGame(selDiff);
});

/* ============ PERMAINAN ============ */
let G = null, timerHandle = null;
const boardEl = $('#board');
const cells = new Array(81);
const BOX_ORDER = [];
(function buildBoard() {
  for (let b = 0; b < 9; b++) {
    const box = document.createElement('div'); box.className = 'box';
    const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3;
    for (let k = 0; k < 9; k++) {
      const r = br + Math.floor(k / 3), c = bc + (k % 3), i = r * 9 + c;
      const el = document.createElement('button'); el.className = 'cell'; el.type = 'button';
      el.addEventListener('click', () => select(i));
      cells[i] = el; box.appendChild(el);
    }
    boardEl.appendChild(box);
  }
})();
const pal = $('#palette');
for (let d = 1; d <= 9; d++) {
  const b = document.createElement('button'); b.className = 'pal'; b.type = 'button'; b.title = ICON_NAMES[d - 1];
  b.innerHTML = `<img src="${iconSrc(d)}" alt="${ICON_NAMES[d - 1]}"><span class="cnt"></span>`;
  b.addEventListener('click', () => place(d));
  pal.appendChild(b);
}

function startGame(diff) {
  const board = `${Date.now()}-${Math.random()}`;
  $('#gameTag').textContent = DIFFS[diff].label;
  $('#timer').textContent = '00:00.0';
  showScreen('game');
  // beri kesempatan browser menggambar layar sebelum menghitung teka-teki
  requestAnimationFrame(() => setTimeout(() => {
    const { puzzle, solution } = makePuzzle(board, DIFFS[diff].clues);
    G = {
      diff, board, solution, given: puzzle.map((v) => v !== 0),
      vals: puzzle.slice(), notes: new Array(81).fill(0), sel: -1, notesMode: false,
      start: Date.now(), done: false
    };
    $('#btnNotes').classList.remove('on'); $('#btnNotes').textContent = 'Catatan: mati';
    const first = G.vals.findIndex((v) => v === 0); if (first >= 0) G.sel = first;
    clearInterval(timerHandle);
    G.start = Date.now();
    timerHandle = setInterval(() => { if (G && !G.done) $('#timer').textContent = fmt(Date.now() - G.start); }, 100);
    render();
  }, 30));
}

function peers(i) {
  const r = (i / 9) | 0, c = i % 9, br = r - (r % 3), bc = c - (c % 3), s = new Set();
  for (let k = 0; k < 9; k++) { s.add(r * 9 + k); s.add(k * 9 + c); }
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s.add((br + a) * 9 + bc + b);
  s.delete(i); return s;
}
const PEERS = [...Array(81).keys()].map(peers);

function select(i) { if (!G || G.done) return; G.sel = i; render(); }

function place(d) {
  if (!G || G.done || G.sel < 0 || G.given[G.sel]) return;
  const i = G.sel;
  if (G.notesMode) {
    if (G.vals[i] !== 0) return;
    G.notes[i] ^= 1 << d;
  } else {
    G.vals[i] = G.vals[i] === d ? 0 : d;
    G.notes[i] = 0;
    if (G.vals[i]) PEERS[i].forEach((p) => { G.notes[p] &= ~(1 << d); });
  }
  render(); checkWin();
}
function erase() {
  if (!G || G.done || G.sel < 0 || G.given[G.sel]) return;
  G.vals[G.sel] = 0; G.notes[G.sel] = 0; render();
}

function render() {
  if (!G) return;
  const sv = G.sel >= 0 ? G.vals[G.sel] : 0;
  const rel = G.sel >= 0 ? PEERS[G.sel] : new Set();
  const counts = new Array(10).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = G.vals[i], el = cells[i];
    if (v) counts[v]++;
    let bad = false;
    if (v) for (const p of PEERS[i]) if (G.vals[p] === v) { bad = true; break; }
    el.className = 'cell' + (G.given[i] ? ' given' : '') + (rel.has(i) ? ' rel' : '') +
      (sv && v === sv && i !== G.sel ? ' same' : '') + (bad ? ' bad' : '') + (i === G.sel ? ' sel' : '');
    el.setAttribute('aria-label', v ? ICON_NAMES[v - 1] : 'kosong');
    if (v) el.innerHTML = `<img class="v" src="${iconSrc(v)}" alt="">`;
    else if (G.notes[i]) {
      let h = '<div class="notes">';
      for (let d = 1; d <= 9; d++) h += G.notes[i] & (1 << d) ? `<img src="${iconSrc(d)}" alt="">` : '<span></span>';
      el.innerHTML = h + '</div>';
    } else el.innerHTML = '';
  }
  pal.querySelectorAll('.pal').forEach((b, k) => {
    const left = 9 - counts[k + 1];
    b.querySelector('.cnt').textContent = Math.max(left, 0);
    b.classList.toggle('done', left <= 0);
  });
}

function checkWin() {
  if (G.vals.some((v, i) => v !== G.solution[i])) return;
  G.done = true; clearInterval(timerHandle);
  finish(Date.now() - G.start);
}
function finish(ms) {
  ms = Math.round(ms);
  $('#timer').textContent = fmt(ms);
  $('#resTime').textContent = fmt(ms);
  const prev = records[G.diff];
  const isNew = !prev || ms < prev;
  if (isNew) { records[G.diff] = ms; saveLocal(); pushRecords(nameInput.value.trim()); renderRecords(); }
  $('#resRank').textContent = isNew ? (prev ? 'Rekor baru!' : 'Rekor pertamamu!') : `Rekor terbaikmu ${fmt(prev)}`;
  $('#result').classList.remove('hidden');
}

$('#btnNotes').addEventListener('click', () => {
  if (!G) return; G.notesMode = !G.notesMode;
  $('#btnNotes').classList.toggle('on', G.notesMode);
  $('#btnNotes').textContent = `Catatan: ${G.notesMode ? 'nyala' : 'mati'}`;
});
$('#btnErase').addEventListener('click', erase);
$('#btnBack').addEventListener('click', () => {
  if (G && !G.done && !confirm('Keluar dari permainan? Waktu akan hilang.')) return;
  clearInterval(timerHandle); G = null; showScreen('home');
});
$('#btnHome').addEventListener('click', () => { $('#result').classList.add('hidden'); G = null; showScreen('home'); });
$('#btnAgain').addEventListener('click', () => { const d = G ? G.diff : selDiff; $('#result').classList.add('hidden'); startGame(d); });

document.addEventListener('keydown', (e) => {
  if (!G || G.done || $('#game').classList.contains('hidden')) return;
  if (e.key >= '1' && e.key <= '9') place(+e.key);
  else if (['Backspace', 'Delete', '0'].includes(e.key)) erase();
  else if (e.key.toLowerCase() === 'n') $('#btnNotes').click();
  else if (e.key.startsWith('Arrow') && G.sel >= 0) {
    e.preventDefault();
    const r = (G.sel / 9) | 0, c = G.sel % 9;
    const nr = Math.min(8, Math.max(0, r + (e.key === 'ArrowDown') - (e.key === 'ArrowUp')));
    const nc = Math.min(8, Math.max(0, c + (e.key === 'ArrowRight') - (e.key === 'ArrowLeft')));
    select(nr * 9 + nc);
  }
});

/* ============ MULAI ============ */
(async function init() {
  renderRecords();
  await initBackend();
  syncRecords();
})();
