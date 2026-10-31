const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby0mrd94SdBnHXn54bU-ZsQmjRSJmo0UoSiSmexiAWUl6XjmRH2RE51-weN-JwnEfus/exec';

let globalData = [];
let donutChartInstance = null;
let lineChartInstance = null;

// Fungsi format Rupiah
const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
};

// Pemetaan nama bulan ke angka (untuk mencocokkan format tanggal YYYY-MM-DD dari form)
const monthMap = {
    'JANUARI': '01', 'FEBRUARI': '02', 'MARET': '03', 'APRIL': '04',
    'MEI': '05', 'JUNI': '06', 'JULI': '07', 'AGUSTUS': '08',
    'SEPTEMBER': '09', 'OKTOBER': '10', 'NOVEMBER': '11', 'DESEMBER': '12'
};

// 1. Mengambil data dari Spreadsheet
function loadDashboardData() {
    fetch(SCRIPT_URL)
        .then(response => response.json())
        .then(res => {
            if(res.status === 'sukses') {
                globalData = res.data;
                const selectedMonth = document.getElementById('month-selector').value;
                processAndRenderData(selectedMonth);
            }
        })
        .catch(err => console.error('Gagal mengambil data:', err));
}

// 2. Menyaring dan Memproses Data berdasarkan Bulan
function processAndRenderData(selectedMonthName) {
    let totalExpenses = 0;
    let categoryMap = {};
    let dateMap = {};

    const targetMonthStr = monthMap[selectedMonthName.toUpperCase()];

    globalData.forEach(row => {
        // Asumsi format tanggal dari Spreadsheet: "2026-10-01" atau "1 Okt 2026"
        // Kita perlu mengekstrak bulannya.
        let tgl = row.tanggal || "";
        let isMatchMonth = false;

        // Cek kecocokan bulan (tergantung format yang keluar dari Spreadsheet)
        if (tgl.includes('-' + targetMonthStr + '-')) {
            isMatchMonth = true; // Format YYYY-MM-DD
        } else if (tgl.toUpperCase().includes(selectedMonthName.substring(0, 3))) {
            isMatchMonth = true; // Format "1 Okt 2026" (mencari "OKT")
        }

        if (isMatchMonth) {
            let nominalStr = String(row.nominal || '0').replace(/[^0-9,-]+/g,"");
            let nominal = parseFloat(nominalStr) || 0;

            // Pastikan mengecek huruf kecil (sesuai perubahan di Apps Script)
            let tipe = (row.tipe || "").toLowerCase();
            
            if (tipe === 'pengeluaran' || tipe === 'expense') {
                totalExpenses += nominal;

                let kategori = (row.keterangan || row.category || 'Lainnya').toUpperCase();
                categoryMap[kategori] = (categoryMap[kategori] || 0) + nominal;
                dateMap[tgl] = (dateMap[tgl] || 0) + nominal;
            }
        }
    });

    // Siapkan data untuk Chart
    const catLabels = Object.keys(categoryMap);
    const catData = Object.values(categoryMap);
    const catColors = catLabels.map((_, i) => `hsl(${i * 360 / Math.max(catLabels.length, 1)}, 70%, 60%)`);

    const dateLabels = Object.keys(dateMap).sort(); // Urutkan tanggal
    const dateData = dateLabels.map(d => dateMap[d]);

    renderDashboard(totalExpenses, catLabels, catData, catColors, dateLabels, dateData, categoryMap, dateMap);
}

// 3. Menampilkan ke Antarmuka
function renderDashboard(totalExpenses, catLabels, catData, catColors, dateLabels, dateData, categoryMap, dateMap) {
    document.getElementById('total-expenses').innerText = formatRupiah(totalExpenses);
    
    // Budget Sementara
    const asumsiBudget = 1000000;
    document.getElementById('month-budget').innerText = formatRupiah(asumsiBudget);
    let persentase = totalExpenses > 0 ? Math.round((totalExpenses / asumsiBudget) * 100) : 0;
    
    document.getElementById('budget-progress').style.width = Math.min(persentase, 100) + '%';
    document.getElementById('progress-percentage').innerText = persentase + '%';

    // Chart.js - Donut
    const ctxDonut = document.getElementById('donutChart').getContext('2d');
    if(donutChartInstance) donutChartInstance.destroy();
    
    if (catLabels.length > 0) {
        donutChartInstance = new Chart(ctxDonut, {
            type: 'doughnut',
            data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: catColors, borderWidth: 0 }] },
            options: { cutout: '60%', responsive: true, plugins: { legend: { position: 'right' } } }
        });
    }

    // Chart.js - Line
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    if(lineChartInstance) lineChartInstance.destroy();
    
    if (dateLabels.length > 0) {
        lineChartInstance = new Chart(ctxLine, {
            type: 'line',
            data: { labels: dateLabels, datasets: [{ label: 'EXPENSES', data: dateData, borderColor: '#ff4081', backgroundColor: 'rgba(255, 64, 129, 0.2)', fill: true, tension: 0.1 }] }
        });
    }

    // Tabel Kategori
    const catTbody = document.querySelector('#category-table tbody');
    catTbody.innerHTML = '';
    for (let cat in categoryMap) {
        catTbody.innerHTML += `<tr><td>${cat}</td><td>${formatRupiah(categoryMap[cat])}</td><td>-</td><td>-</td><td>-</td></tr>`;
    }

    // Tabel Tanggal
    const dateTbody = document.querySelector('#date-table tbody');
    dateTbody.innerHTML = '';
    for (let date of dateLabels) {
        dateTbody.innerHTML += `<tr><td>${date}</td><td>${formatRupiah(dateMap[date])}</td></tr>`;
    }
}

// Event Listeners
document.getElementById('transaction-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit');
  btn.innerText = 'Saving...'; btn.disabled = true;

  const data = {
    tanggal: document.getElementById('date').value,
    keterangan: document.getElementById('description').value,
    nominal: document.getElementById('amount').value,
    tipe: document.getElementById('type').value
  };

  fetch(SCRIPT_URL, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(() => {
    alert('Transaction successfully saved!');
    document.getElementById('transaction-form').reset();
    btn.innerText = 'Save Transaction'; btn.disabled = false;
    loadDashboardData(); // Refresh data otomatis
  });
});

document.addEventListener('DOMContentLoaded', loadDashboardData);

// Memperbarui dashboard saat bulan diganti
document.getElementById('month-selector').addEventListener('change', (e) => {
    processAndRenderData(e.target.value);
});
