const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyxQ3yV4ADGlTJGL7SOdkFVRdkKXTC4CpnWM0c8ZbjX-duAuYftZHnHiqcTXHsvSUnO/exec';
const ACCOUNT_NAME = 'Aang Gunawan';
const MONTHS = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
const SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const TOK = {JAN:0,FEB:1,MAR:2,APR:3,MEI:4,MAY:4,JUN:5,JUL:6,AGU:7,AGT:7,AUG:7,SEP:8,SEPT:8,OKT:9,OCT:9,NOV:10,NOP:10,DES:11,DEC:11};
const DEFAULT_CATS = ['BBM','JAJAN','MAKAN','MONTHLY NEED','KUOTA','KEPERLUAN'];
const RESERVED = ['month','bulan','year','tahun','budget','total','difference','selisih','sisa'];
const COLORS = ['#F93976','#FF5A5F','#FF7E67','#FF9F70','#FFBC7A','#FFD884','#F48C8C','#FF8A1F'];
const TIP = { tooltip: { callbacks: { label: c => ' ' + (c.dataset.label || c.label) + ': ' + rp(c.raw) } } };

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rp = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const pick = (o, names) => { const k = Object.keys(o).find(k => names.includes(norm(k))); return k === undefined ? undefined : o[k]; };
const num = v => typeof v === 'number' ? v : (parseFloat(String(v || '0').replace(/[^0-9,-]+/g, '')) || 0);
const sum = a => a.reduce((x, y) => x + y, 0);

let globalData = [], globalBudget = [], backendCats = null;
const now = new Date();
const state = { view: 'home', year: now.getFullYear(), month: now.getMonth() };
const charts = {};

/* ---------- Helper tanggal & data ---------- */
function monthIdx(v) {
  if (v == null) return -1;
  const s = String(v).trim().toUpperCase();
  if (/^\d{1,2}$/.test(s)) { const n = +s - 1; return n >= 0 && n < 12 ? n : -1; }
  const i = MONTHS.indexOf(s); if (i >= 0) return i;
  const t = TOK[s.slice(0, 4)] ?? TOK[s.slice(0, 3)];
  return t === undefined ? -1 : t;
}
function parseDate(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim(); let m;
  const loc = d => isNaN(d) ? null : { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
  if (/T.*(Z|[+-]\d\d:?\d\d)$/.test(s)) return loc(new Date(s));
  if (m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)) return { y: +m[1], m: m[2] - 1, d: +m[3] };
  if (m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/)) return { y: m[3].length == 2 ? 2000 + +m[3] : +m[3], m: m[2] - 1, d: +m[1] };
  const w = (s.match(/[A-Za-z]+/g) || []).map(monthIdx).find(i => i >= 0), n = (s.match(/\d+/g) || []).map(Number);
  if (w !== undefined) { const y = n.find(x => x >= 100), d = n.find(x => x >= 1 && x <= 31); if (d) return { y: y || null, m: w, d }; }
  return loc(new Date(s));
}
function txs() {
  return globalData.map(r => {
    const dt = parseDate(pick(r, ['tanggal', 'date'])) || { y: null, m: -1, d: 0 };
    const c = String(pick(r, ['category', 'kategori']) || '').toUpperCase();
    return { ...dt, needs: String(pick(r, ['needs']) || 'LAINNYA').toUpperCase(), desc: pick(r, ['keterangan', 'description', 'deskripsi']) || '',
      amt: num(pick(r, ['nominal', 'amount'])), type: /SAVING|TABUNGAN/.test(c) ? 'SAVING' : (/EXPENSES|PENGELUARAN/.test(c) ? 'EXPENSES' : '') };
  });
}
const inPeriod = t => t.m === state.month && (t.y === null || t.y === state.year);

function budgetFor(y, m) {
  let rows = globalBudget.filter(r => monthIdx(pick(r, ['month', 'bulan'])) === m);
  if (rows.some(r => { const v = pick(r, ['year', 'tahun']); return v !== undefined && v !== ''; })) rows = rows.filter(r => +pick(r, ['year', 'tahun']) === y);
  const r = rows[0]; if (!r) return { found: false, total: 0, cats: {} };
  const cats = {};
  Object.keys(r).forEach(k => { if (!RESERVED.includes(norm(k)) && num(r[k]) > 0) cats[norm(k)] = num(r[k]); });
  return { found: true, total: num(pick(r, ['budget', 'total'])) || sum(Object.values(cats)), cats };
}
function categories() {
  if (backendCats) return backendCats;
  const l = [...DEFAULT_CATS];
  globalBudget.forEach(r => Object.keys(r).forEach(k => { if (!RESERVED.includes(norm(k)) && !l.some(c => norm(c) === norm(k))) l.push(k.toUpperCase()); }));
  return l;
}

/* ---------- UI umum ---------- */
function chart(id, cfg) {
  charts[id]?.destroy();
  cfg.options = { responsive: true, maintainAspectRatio: false, ...cfg.options };
  charts[id] = new Chart($('#' + id), cfg);
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2800); }
const post = body => fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });

function buildPeriod() {
  const ys = [2026, 2027, state.year, now.getFullYear() + 1, ...txs().map(t => t.y).filter(Boolean)];
  const years = []; for (let y = Math.min(...ys); y <= Math.max(...ys); y++) years.push(y);
  $$('[data-period]').forEach(el => {
    el.innerHTML = `<div class="filter-group"><label>Tahun</label><select class="year-selector">${years.map(y => `<option>${y}</option>`).join('')}</select></div>` +
      (el.dataset.period === 'ym' ? `<div class="filter-group"><label>Bulan</label><select class="month-selector">${MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('')}</select></div>` : '');
  });
  syncPeriod();
}
function syncPeriod() { $$('.year-selector').forEach(s => s.value = state.year); $$('.month-selector').forEach(s => s.value = state.month); }
document.addEventListener('change', e => {
  if (e.target.matches('.year-selector')) state.year = +e.target.value;
  else if (e.target.matches('.month-selector')) state.month = +e.target.value;
  else return;
  syncPeriod(); render();
});

function setView(v) {
  state.view = v;
  $$('.view').forEach(e => e.hidden = e.id !== 'view-' + v);
  $$('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  render(); scrollTo(0, 0);
}
function render() { ({ home: renderHome, transaction: renderTx, budget: renderBudget, akun: renderAkun })[state.view](); }

/* ---------- HOME ---------- */
function renderHome() {
  const T = txs().filter(t => inPeriod(t) && t.type === 'EXPENSES'), b = budgetFor(state.year, state.month);
  const cm = {}, dm = {};
  T.forEach(t => { cm[t.needs] = (cm[t.needs] || 0) + t.amt; dm[t.d] = (dm[t.d] || 0) + t.amt; });
  const total = sum(T.map(t => t.amt)), pct = b.total > 0 ? Math.round(total / b.total * 100) : 0;
  $('#total-expenses').textContent = rp(total);
  $('#month-budget').textContent = rp(b.total);
  $('#recent-budget').textContent = rp(b.total - total);
  $('#progress-percentage').textContent = pct + '%';
  $('#budget-progress').style.width = Math.min(pct, 100) + '%';
  $('#budget-note').hidden = b.found;

  const ce = Object.entries(cm).sort((a, b) => b[1] - a[1]); // urut nominal terbesar
  chart('donutChart', { type: 'doughnut', data: { labels: ce.map(e => e[0]), datasets: [{ data: ce.map(e => e[1]), backgroundColor: ce.map((_, i) => COLORS[i % COLORS.length]), borderWidth: 0 }] },
    options: { cutout: '60%', plugins: { ...TIP, legend: { position: 'right' } } } });
  const days = Object.keys(dm).map(Number).sort((a, b) => a - b), lab = days.map(d => pad(d) + ' ' + SHORT[state.month]);
  chart('lineChart', { type: 'line', data: { labels: lab, datasets: [{ label: 'EXPENSES', data: days.map(d => dm[d]), borderColor: '#F93976', backgroundColor: 'rgba(249,57,118,.2)', fill: true, tension: .1 }] }, options: { plugins: TIP } });

  const names = new Set([...Object.keys(cm), ...categories().filter(c => b.cats[norm(c)])]);
  const rows = [...names].filter(c => c !== 'LAINNYA' || cm[c]).map(c => ({ c, e: cm[c] || 0, bg: b.cats[norm(c)] || 0 })).sort((x, y) => y.e - x.e || y.bg - x.bg);
  $('#category-table tbody').innerHTML = rows.map(({ c, e, bg }) => {
    const p = bg ? Math.round(e / bg * 100) : 0;
    return `<tr><td>${esc(c)}</td><td data-label="Expenses">${rp(e)}</td><td data-label="Budget">${bg ? rp(bg) : '-'}</td>
      <td data-label="Saldo" class="${bg && e > bg ? 'neg' : ''}">${bg ? rp(bg - e) : '-'}</td>
      <td data-label="Persentase">${bg ? `<span class="mini"><i style="width:${Math.min(p, 100)}%"></i></span>${p}%` : '-'}</td></tr>`;
  }).join('');
  $('#date-table tbody').innerHTML = days.map((d, i) => `<tr><td>${lab[i]}</td><td data-label="Total">${rp(dm[d])}</td></tr>`).join('');
}

/* ---------- TRANSACTION ---------- */
function renderTx() {
  const T = txs().filter(inPeriod).reverse().sort((a, b) => b.d - a.d);
  const ex = sum(T.filter(t => t.type === 'EXPENSES').map(t => t.amt)), sv = sum(T.filter(t => t.type === 'SAVING').map(t => t.amt));
  $('#tx-summary').innerHTML = `<div class="stat-card primary-card"><h3>Expenses</h3><h2>${rp(ex)}</h2></div><div class="stat-card"><h3>Saving</h3><h2>${rp(sv)}</h2></div><div class="stat-card"><h3>Jumlah Transaksi</h3><h2>${T.length}</h2></div>`;
  let html = '', last = null;
  T.forEach(t => {
    if (t.d !== last) { last = t.d; html += `<div class="tx-day">${new Date(t.y || state.year, t.m, t.d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>`; }
    const s = t.type === 'SAVING';
    html += `<div class="tx"><div><b>${esc(t.desc)}</b><small>${esc(t.needs)} · ${t.type || '-'}</small></div><span class="${s ? 'pos' : 'neg'}">${s ? '+' : '-'}${rp(t.amt)}</span></div>`;
  });
  $('#tx-list').innerHTML = html || '<p class="note">Belum ada transaksi di bulan ini.</p>';
}

/* ---------- BUDGET ---------- */
function renderBudget() {
  const b = budgetFor(state.year, state.month);
  $('#budget-card').innerHTML = `<h3>Budget ${MONTHS[state.month]} ${state.year}</h3>
    <div class="input-group"><label>Total budget bulan ini</label><input type="number" id="b-total" inputmode="numeric" value="${b.total || ''}" placeholder="0"></div>
    <h3 class="sub">Budget per kategori</h3>
    ${categories().map(c => `<div class="cat-row"><span>${esc(c)}</span><input type="number" inputmode="numeric" data-cat="${esc(c)}" value="${b.cats[norm(c)] || ''}" placeholder="0">
      <button class="icon-btn" data-edit="${esc(c)}" aria-label="Ubah">✎</button><button class="icon-btn" data-del="${esc(c)}" aria-label="Hapus">🗑</button></div>`).join('')}
    <div class="cat-row"><input id="new-cat" placeholder="Kategori baru"><button class="btn-sm" id="add-cat">Tambah</button></div>
    <button class="btn-submit" id="save-budget">Simpan Budget</button>`;
}
function ready() { if (!backendCats) { toast('Apps Script belum diperbarui (pakai Code.gs terbaru)'); return false; } return true; }
function afterChange(msg) { toast(msg); renderBudget(); setTimeout(loadDashboardData, 1500); }

$('#budget-card').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t || !ready()) return;
  if (t.id === 'add-cat') {
    const name = $('#new-cat').value.trim().toUpperCase();
    if (!name || categories().some(c => norm(c) === norm(name))) return toast('Nama kosong atau sudah ada');
    post({ action: 'addCategory', name }); backendCats.push(name); afterChange('Kategori ditambahkan');
  } else if (t.dataset.edit) {
    const old = t.dataset.edit, nn = (prompt('Nama baru untuk kategori ' + old, old) || '').trim().toUpperCase();
    if (!nn || nn === old) return;
    post({ action: 'renameCategory', oldName: old, newName: nn }); backendCats = backendCats.map(c => c === old ? nn : c); afterChange('Kategori diubah');
  } else if (t.dataset.del) {
    const c = t.dataset.del; if (!confirm(`Hapus kategori ${c}? Budget kategori ini ikut terhapus (transaksi lama tetap ada).`)) return;
    post({ action: 'deleteCategory', name: c }); backendCats = backendCats.filter(x => x !== c); afterChange('Kategori dihapus');
  } else if (t.id === 'save-budget') {
    const cats = {}; $$('#budget-card [data-cat]').forEach(i => cats[i.dataset.cat] = +i.value || 0);
    const total = +$('#b-total').value || sum(Object.values(cats));
    post({ action: 'saveBudget', month: MONTHS[state.month], year: state.year, budget: total, categories: cats });
    const row = { month: MONTHS[state.month], year: state.year, budget: total }; Object.keys(cats).forEach(k => row[k.toLowerCase()] = cats[k]);
    globalBudget = globalBudget.filter(r => monthIdx(pick(r, ['month', 'bulan'])) !== state.month).concat(row);
    afterChange('Budget disimpan');
  }
});

/* ---------- AKUN ---------- */
function renderAkun() {
  const T = txs(), E = T.filter(t => t.type === 'EXPENSES'), sv = sum(T.filter(t => t.type === 'SAVING').map(t => t.amt));
  $('#akun-info').innerHTML = `<div class="avatar">${esc(ACCOUNT_NAME[0])}</div><h2 class="acc">${esc(ACCOUNT_NAME)}</h2>
    <div class="acc-stats"><div><small>Total Expenses</small><b>${rp(sum(E.map(t => t.amt)))}</b></div><div><small>Total Saving</small><b>${rp(sv)}</b></div><div><small>Jumlah Transaksi</small><b>${T.length}</b></div></div>`;
  const cm = {}; E.forEach(t => cm[t.needs] = (cm[t.needs] || 0) + t.amt);
  const ce = Object.entries(cm).sort((a, b) => b[1] - a[1]);
  chart('akunCat', { type: 'bar', data: { labels: ce.map(e => e[0]), datasets: [{ label: 'Pengeluaran', data: ce.map(e => e[1]), backgroundColor: ce.map((_, i) => COLORS[i % COLORS.length]) }] },
    options: { indexAxis: 'y', plugins: { ...TIP, legend: { display: false } } } });
  const mm = Array(12).fill(0); E.filter(t => t.m >= 0 && (t.y === null || t.y === state.year)).forEach(t => mm[t.m] += t.amt);
  chart('akunMonth', { type: 'bar', data: { labels: SHORT, datasets: [{ label: 'Pengeluaran', data: mm, backgroundColor: '#FF8A1F' },
    { type: 'line', label: 'Budget', data: MONTHS.map((_, i) => budgetFor(state.year, i).total), borderColor: '#F93976', tension: .2 }] }, options: { plugins: TIP } });
}

/* ---------- Modal input ---------- */
function openModal() {
  $('#needs').innerHTML = '<option value="" disabled selected>Pilih Kategori...</option>' + [...new Set([...categories(), 'LAINNYA'])].map(c => `<option>${esc(c)}</option>`).join('');
  $('#date').value = new Date(Date.now() - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  $('#modal').hidden = false; $('#nav-input').classList.add('active');
}
function closeModal() { $('#modal').hidden = true; $('#nav-input').classList.remove('active'); }
$('#nav-input').addEventListener('click', openModal);
$('#close-modal').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
$$('.nav-item[data-view]').forEach(b => b.addEventListener('click', () => { closeModal(); setView(b.dataset.view); }));

$('#transaction-form').addEventListener('submit', e => {
  e.preventDefault();
  const btn = $('#btn-submit'); btn.disabled = true; btn.textContent = 'Saving...';
  const d = { action: 'addTransaction', tanggal: $('#date').value, needs: $('#needs').value.toUpperCase(), nominal: $('#amount').value, keterangan: $('#description').value, category: $('#category').value };
  post(d).then(() => { globalData.push(d); e.target.reset(); closeModal(); toast('Transaksi tersimpan'); render(); setTimeout(loadDashboardData, 1500); })
    .catch(() => toast('Gagal menyimpan, coba lagi'))
    .finally(() => { btn.disabled = false; btn.textContent = 'Save Transaction'; });
});

/* ---------- Ambil data ---------- */
function loadDashboardData() {
  fetch(SCRIPT_URL).then(r => r.json()).then(res => {
    if (res.status !== 'sukses') throw res;
    if (!res.budgetData) console.warn('Apps Script tidak mengirim budgetData: deploy ulang sebagai versi baru.');
    globalData = res.data || []; globalBudget = res.budgetData || [];
    backendCats = Array.isArray(res.categories) ? res.categories.map(c => String(c).toUpperCase()) : null;
    console.log('[Budget]', globalBudget, backendCats);
    buildPeriod(); render();
  }).catch(err => { console.error('Gagal mengambil data:', err); toast('Gagal memuat data'); });
}

$('#acc-name').textContent = ACCOUNT_NAME;
buildPeriod(); setView('home'); loadDashboardData();
