// Sesuaikan nama sheet. Jika tidak ketemu: transaksi = sheet pertama, budget = sheet yang namanya mengandung "budget".
const SHEET_TRX = 'Transaksi', SHEET_BUDGET = 'Budget';
const RESERVED = ['month', 'bulan', 'year', 'tahun', 'budget', 'total'];
const nk = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const trx = () => SpreadsheetApp.getActive().getSheetByName(SHEET_TRX) || SpreadsheetApp.getActive().getSheets()[0];
const bud = () => SpreadsheetApp.getActive().getSheetByName(SHEET_BUDGET) || SpreadsheetApp.getActive().getSheets().find(s => /budget/i.test(s.getName()));
const hdr = s => s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
const col = (h, names) => h.findIndex(x => names.includes(nk(x))) + 1; // 0 = tidak ada
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

function read(s) {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone(), v = s.getDataRange().getValues();
  const h = v.shift().map(x => String(x).trim().toLowerCase());
  return v.filter(r => r.some(c => c !== '')).map(r => {
    const o = {}; h.forEach((k, i) => o[k] = r[i] instanceof Date ? Utilities.formatDate(r[i], tz, 'yyyy-MM-dd') : r[i]); return o;
  });
}

function doGet() {
  try {
    const b = bud();
    return out({ status: 'sukses', version: 2, data: read(trx()), budgetData: read(b),
      categories: hdr(b).map(x => String(x).trim()).filter(x => x && !RESERVED.includes(nk(x))).map(x => x.toUpperCase()) });
  } catch (err) { return out({ status: 'error', message: String(err) }); }
}

function doPost(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const b = JSON.parse(e.postData.contents), a = b.action || 'addTransaction';
    if (a === 'addTransaction') {
      const s = trx();
      s.appendRow(hdr(s).map(k => {
        const n = nk(k);
        if (['tanggal', 'date'].includes(n)) return new Date(b.tanggal + 'T00:00:00');
        if (n === 'needs') return b.needs;
        if (['nominal', 'amount'].includes(n)) return Number(b.nominal);
        if (['keterangan', 'description', 'deskripsi'].includes(n)) return b.keterangan;
        if (['category', 'kategori'].includes(n)) return b.category;
        return '';
      }));
    } else if (a === 'saveBudget') {
      const s = bud(), h = hdr(s), mc = col(h, ['month', 'bulan']), yc = col(h, ['year', 'tahun']), M = String(b.month).toUpperCase();
      const v = s.getDataRange().getValues();
      let r = v.findIndex((x, i) => i > 0 && String(x[mc - 1]).trim().toUpperCase() === M && (!yc || +x[yc - 1] === +b.year)) + 1;
      if (!r) { r = s.getLastRow() + 1; s.getRange(r, mc).setValue(M); if (yc) s.getRange(r, yc).setValue(b.year); }
      const bc = col(h, ['budget', 'total']); if (bc) s.getRange(r, bc).setValue(b.budget);
      Object.keys(b.categories).forEach(k => { const c = col(h, [nk(k)]); if (c) s.getRange(r, c).setValue(b.categories[k]); });
    } else if (a === 'addCategory') {
      const s = bud(); if (!col(hdr(s), [nk(b.name)])) s.getRange(1, s.getLastColumn() + 1).setValue(String(b.name).toUpperCase());
    } else if (a === 'deleteCategory') {
      const s = bud(), c = col(hdr(s), [nk(b.name)]); if (c) s.deleteColumn(c);
    } else if (a === 'renameCategory') {
      const s = bud(), c = col(hdr(s), [nk(b.oldName)]), nn = String(b.newName).toUpperCase();
      if (c) s.getRange(1, c).setValue(nn);
      const t = trx(), tc = col(hdr(t), ['needs']);
      if (tc && t.getLastRow() > 1) { // ikut ganti nama di riwayat transaksi
        const g = t.getRange(2, tc, t.getLastRow() - 1, 1);
        g.setValues(g.getValues().map(x => [String(x[0]).toUpperCase() === String(b.oldName).toUpperCase() ? nn : x[0]]));
      }
    }
    return out({ status: 'sukses' });
  } catch (err) { return out({ status: 'error', message: String(err) }); }
  finally { lock.release(); }
}
