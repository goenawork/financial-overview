const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby0mrd94SdBnHXn54bU-ZsQmjRSJmo0UoSiSmexiAWUl6XjmRH2RE51-weN-JwnEfus/exec';

let globalData = [];
let donutChartInstance = null;
let lineChartInstance = null;

const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
};

// 1. Mengambil semua data transaksi dari Spreadsheet
function loadDashboardData() {
    fetch(SCRIPT_URL)
        .then(response => response.json())
        .then(res => {
            if(res.status === 'sukses') {
                globalData = res.data;
                // Asumsi: dropdown bulan memiliki value format angka bulan seperti "10" atau kata "OKTOBER"
                // Untuk kesederhanaan awal, kita proses semua data pengeluaran yang ditarik
                processAndRenderData();
            }
        })
        .catch(err => console.error('Gagal mengambil data:', err));
}

// 2. Menghitung data mentah menjadi format grafik
function processAndRenderData() {
    let totalExpenses = 0;
    let categoryMap = {};
    let dateMap = {};

    globalData.forEach(row => {
        // Membersihkan format angka (misal: "Rp 25.000" menjadi 25000)
        let nominal = parseFloat(row.nominal.toString().replace(/[^0-9,-]+/g,""));
        if(isNaN(nominal)) nominal = 0;

        // Hanya hitung jika tipenya "Pengeluaran"
        if(row.tipe && row.tipe.toLowerCase() === 'pengeluaran') {
            totalExpenses += nominal;

            // Kelompokkan by Kategori (Keterangan)
            let kategori = row.keterangan || 'Lainnya';
            categoryMap[kategori] = (categoryMap[kategori] || 0) + nominal;

            // Kelompokkan by Tanggal
            let tgl = row.tanggal;
            dateMap[tgl] = (dateMap[tgl] || 0) + nominal;
        }
    });

    // Menyiapkan array untuk Chart.js
    const catLabels = Object.keys(categoryMap);
    const catData = Object.values(categoryMap);
    // Generate warna acak/tetap untuk setiap kategori
    const catColors = catLabels.map((_, i) => `hsl(${i * 360 / catLabels.length}, 70%, 60%)`);

    const dateLabels = Object.keys(dateMap).sort(); // Urutkan tanggal
    const dateData = dateLabels.map(d => dateMap[d]);

    renderDashboard(totalExpenses, catLabels, catData, catColors, dateLabels, dateData, categoryMap, dateMap);
}

// 3. Menampilkan ke HTML
function renderDashboard(totalExpenses, catLabels, catData, catColors, dateLabels, dateData, categoryMap, dateMap) {
    document.getElementById('total-expenses').innerText = formatRupiah(totalExpenses);
    
    // Angka Budget diset statis sementara, kamu bisa menambahkan logika JS untuk ini
    const asumsiBudget = 1000000;
    document.getElementById('month-budget').innerText = formatRupiah(asumsiBudget);
    let persentase = Math.round((totalExpenses / asumsiBudget) * 100) || 0;
    document.getElementById('budget-progress').style.width = Math.min(persentase, 100) + '%';
    document.getElementById('progress-percentage').innerText = persentase + '%';

    // Update Donut Chart
    const ctxDonut = document.getElementById('donutChart').getContext('2d');
    if(donutChartInstance) donutChartInstance.destroy(); // Hapus grafik lama sebelum render ulang
    donutChartInstance = new Chart(ctxDonut, {
        type: 'doughnut',
        data: {
            labels: catLabels,
            datasets: [{ data: catData, backgroundColor: catColors, borderWidth: 0 }]
        },
        options: { cutout: '60%', responsive: true, plugins: { legend: { position: 'right' } } }
    });

    // Update Line Chart
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    if(lineChartInstance) lineChartInstance.destroy();
    lineChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: dateLabels,
            datasets: [{
                label: 'EXPENSES', data: dateData, borderColor: '#ff4081', backgroundColor: 'rgba(255, 64, 129, 0.2)', fill: true, tension: 0.1
            }]
        }
    });

    // Update Tabel Kategori
    const catTbody = document.querySelector('#category-table tbody');
    catTbody.innerHTML = '';
    for (let cat in categoryMap) {
        catTbody.innerHTML += `<tr><td>${cat}</td><td>${formatRupiah(categoryMap[cat])}</td><td>-</td><td>-</td><td>-</td></tr>`;
    }

    // Update Tabel Tanggal
    const dateTbody = document.querySelector('#date-table tbody');
    dateTbody.innerHTML = '';
    for (let date of dateLabels) {
        dateTbody.innerHTML += `<tr><td>${date}</td><td>${formatRupiah(dateMap[date])}</td></tr>`;
    }
}

// Logika Input Form Tetap Sama
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
    loadDashboardData(); // Otomatis refresh data setelah input
  });
});

// Load data saat halaman dibuka
document.addEventListener('DOMContentLoaded', loadDashboardData);
