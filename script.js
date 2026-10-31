const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw3biUBzG4Mh5f0Qt_Fv5b5GHCG4DN0_5J-rIJYT5XDnz2YYXHI4p6yog9qtxpuJ-Gi/exec';

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

    globalData.forEach(row => {
        let tgl = row.tanggal || "";
        let isMatchMonth = false;

        // Mencocokkan format "1 Jan 2026" dengan pilihan dropdown (misal: "JANUARI" -> "JAN")
        if (tgl.toUpperCase().includes(selectedMonthName.substring(0, 3))) {
            isMatchMonth = true; 
        }

        if (isMatchMonth) {
            let nominalStr = String(row.nominal || '0').replace(/[^0-9,-]+/g,"");
            let nominal = parseFloat(nominalStr) || 0;

            // Mengecek kolom "category" (apakah "EXPENSES")
            let categoryType = (row.category || "").toUpperCase();
            
            if (categoryType === 'EXPENSES' || categoryType === 'PENGELUARAN') {
                totalExpenses += nominal;

                // Mengelompokkan grafik berdasarkan kolom "needs" (BBM, JAJAN, dll)
                let needsKategori = (row.needs || 'Lainnya').toUpperCase();
                
                categoryMap[needsKategori] = (categoryMap[needsKategori] || 0) + nominal;
                dateMap[tgl] = (dateMap[tgl] || 0) + nominal;
            }
        }
    });

    const catLabels = Object.keys(categoryMap);
    const catData = Object.values(categoryMap);
    const catColors = catLabels.map((_, i) => `hsl(${i * 360 / Math.max(catLabels.length, 1)}, 70%, 60%)`);

    const dateLabels = Object.keys(dateMap).sort(); 
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
    needs: document.getElementById('needs').value.toUpperCase(),
    nominal: document.getElementById('amount').value,
    keterangan: document.getElementById('description').value,
    category: document.getElementById('category').value
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
