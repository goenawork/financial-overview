// Ganti dengan URL Web App Apps Script milikmu
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby0mrd94SdBnHXn54bU-ZsQmjRSJmo0UoSiSmexiAWUl6XjmRH2RE51-weN-JwnEfus/exec';

// Format angka ke Rupiah
const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
};

// --- LOGIKA MENGAMBIL DAN MENAMPILKAN DATA (SIMULASI) ---
// Dalam skenario nyata, Apps Script harus dimodifikasi untuk mengembalikan JSON terstruktur
// (misal: total pengeluaran, data grafik, data tabel per kategori).
// Kode di bawah ini merender data contoh (mock data) agar grafik terlihat berfungsi.

function loadDashboardData(month) {
    // Simulasi Fetch Data
    // fetch(`${SCRIPT_URL}?month=${month}`).then(...).then(data => { ... render data ... })
    
    // MOCK DATA (Data Contoh)
    const mockData = {
        totalExpenses: 1137000,
        thisMonthBudget: 965000,
        recentBudget: -172000,
        progressPercentage: 118,
        donutData: {
            labels: ['BBM', 'JAJAN', 'MAKAN', 'MONTHLY NEED', 'KUOTA', 'KEPERLUAN'],
            data: [25.9, 21.5, 15.4, 5.4, 6.6, 25.3],
            colors: ['#ff4081', '#ff5252', '#ff6e40', '#ff8a65', '#ffb74d', '#ffd54f']
        },
        lineData: {
            labels: ['1 Okt 2026', '2 Okt 2026', '3 Okt 2026', '4 Okt 2026'],
            data: [107000, 96000, 22000, 21000]
        },
        categoryTable: [
            { cat: 'BBM', exp: 294000, bud: 300000, sal: 6000, pct: 98 },
            { cat: 'JAJAN', exp: 244000, bud: 200000, sal: -44000, pct: 122 }
        ],
        dateTable: [
             { date: '1 Okt 2026', total: 107000 },
             { date: '2 Okt 2026', total: 96000 }
        ]
    };

    renderDashboard(mockData);
}

function renderDashboard(data) {
    // Update Angka
    document.getElementById('total-expenses').innerText = formatRupiah(data.totalExpenses);
    document.getElementById('month-budget').innerText = formatRupiah(data.thisMonthBudget);
    document.getElementById('recent-budget').innerText = formatRupiah(data.recentBudget);
    
    // Update Progress Bar
    document.getElementById('budget-progress').style.width = Math.min(data.progressPercentage, 100) + '%';
    document.getElementById('progress-percentage').innerText = data.progressPercentage + '%';

    // Render Donut Chart
    const ctxDonut = document.getElementById('donutChart').getContext('2d');
    new Chart(ctxDonut, {
        type: 'doughnut',
        data: {
            labels: data.donutData.labels,
            datasets: [{
                data: data.donutData.data,
                backgroundColor: data.donutData.colors,
                borderWidth: 0
            }]
        },
        options: { cutout: '60%', responsive: true, plugins: { legend: { position: 'right' } } }
    });

    // Render Line Chart
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: data.lineData.labels,
            datasets: [{
                label: 'EXPENSES',
                data: data.lineData.data,
                borderColor: '#ff4081',
                backgroundColor: 'rgba(255, 64, 129, 0.2)',
                fill: true,
                tension: 0.1
            }]
        }
    });

    // Render Tables
    const catTbody = document.querySelector('#category-table tbody');
    catTbody.innerHTML = '';
    data.categoryTable.forEach(row => {
        catTbody.innerHTML += `<tr><td>${row.cat}</td><td>${formatRupiah(row.exp)}</td><td>${formatRupiah(row.bud)}</td><td>${formatRupiah(row.sal)}</td><td>${row.pct}%</td></tr>`;
    });

    const dateTbody = document.querySelector('#date-table tbody');
    dateTbody.innerHTML = '';
    data.dateTable.forEach(row => {
        dateTbody.innerHTML += `<tr><td>${row.date}</td><td>${formatRupiah(row.total)}</td></tr>`;
    });
}

// --- LOGIKA MENGIRIM DATA TRANSAKSI ---
document.getElementById('transaction-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit');
  btn.innerText = 'Saving...';
  btn.disabled = true;

  const data = {
    tanggal: document.getElementById('date').value,
    keterangan: document.getElementById('description').value,
    nominal: document.getElementById('amount').value,
    tipe: document.getElementById('type').value
  };

  fetch(SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(() => {
    alert('Transaction successfully saved!');
    document.getElementById('transaction-form').reset();
    btn.innerText = 'Save Transaction';
    btn.disabled = false;
  })
  .catch(error => {
    alert('An error occurred. Please check your connection.');
    btn.innerText = 'Save Transaction';
    btn.disabled = false;
  });
});

// Inisialisasi awal
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData(document.getElementById('month-selector').value);
});

// Listener untuk perubahan bulan
document.getElementById('month-selector').addEventListener('change', (e) => {
    // Akan memanggil fungsi load lagi jika Apps Script mendukung query bulan
    // loadDashboardData(e.target.value);
});
