// GANTI DENGAN URL WEB APP KAMU YANG BARU
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxicjbjaoKjvVCAKZp_rOSs-tCO0iaUrP0YmD4ULB7q-fbiC_zeRhk79-LxlWjGuEbg/exec';

let globalData = [];
let globalBudget = [];
let donutChartInstance = null;
let lineChartInstance = null;

const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
};

const monthMap = {
    'JANUARI': '01', 'FEBRUARI': '02', 'MARET': '03', 'APRIL': '04',
    'MEI': '05', 'JUNI': '06', 'JULI': '07', 'AGUSTUS': '08',
    'SEPTEMBER': '09', 'OKTOBER': '10', 'NOVEMBER': '11', 'DESEMBER': '12'
};

// 1. Mengambil data dari Spreadsheet (Transaksi & Budget)
function loadDashboardData() {
    fetch(SCRIPT_URL)
        .then(response => response.json())
        .then(res => {
            if(res.status === 'sukses') {
                globalData = res.data;
                globalBudget = res.budgetData || []; // Menangkap data budget
                
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

    // --- 1. Memproses Data Transaksi ---
    globalData.forEach(row => {
        let tgl = row.tanggal || "";
        let isMatchMonth = false;

        // Cek kecocokan bulan
        if (tgl.toUpperCase().includes(selectedMonthName.substring(0, 3))) {
            isMatchMonth = true; 
        }

        if (isMatchMonth) {
            let nominalStr = String(row.nominal || '0').replace(/[^0-9,-]+/g,"");
            let nominal = parseFloat(nominalStr) || 0;

            let categoryType = (row.category || "").toUpperCase();
            
            if (categoryType === 'EXPENSES' || categoryType === 'PENGELUARAN') {
                totalExpenses += nominal;

                let needsKategori = (row.needs || 'Lainnya').toUpperCase();
                categoryMap[needsKategori] = (categoryMap[needsKategori] || 0) + nominal;
                dateMap[tgl] = (dateMap[tgl] || 0) + nominal;
            }
        }
    });

    // --- 2. Memproses Data Budget (Format Crosstab) ---
    let totalBudget = 0;
    let categoryBudgetMap = {}; 
    
    // Cari baris bulan yang sesuai di data Table1
    const bulanDipilih = selectedMonthName.toUpperCase();
    
    // Kita cari baris yang kolom pertamanya (month) cocok dengan bulan yang dipilih
    let rowBudget = globalBudget.find(row => {
        let monthDiSheet = (row.month || "").toUpperCase();
        return monthDiSheet === bulanDipilih;
    });

    if (rowBudget) {
        // Ambil Total Budget dari kolom "budget"
        let budgTotalStr = String(rowBudget.budget || '0').replace(/[^0-9,-]+/g,"");
        totalBudget = parseFloat(budgTotalStr) || 0;

        // Ambil budget untuk masing-masing kategori (BBM, JAJAN, MAKAN, dll)
        const kategoriSpesifik = ['BBM', 'JAJAN', 'MAKAN', 'MONTHLY NEED', 'KUOTA', 'KEPERLUAN'];
        
        kategoriSpesifik.forEach(kat => {
            // Karena di JSON key-nya otomatis huruf kecil dari Apps Script, kita ubah huruf kecil dulu
            let key = kat.toLowerCase().replace(' ', ' '); 
            // Namun, jika ada spasi, Apps Script mungkin memangkasnya, kita cek manual
            
            // Cara paling aman membaca properti:
            let val = rowBudget[kat.toLowerCase()] || rowBudget[kat.toLowerCase().replace(' ', '')] || 0;
            
            let valStr = String(val).replace(/[^0-9,-]+/g,"");
            let nominalBudg = parseFloat(valStr) || 0;
            
            if(nominalBudg > 0) {
                 categoryBudgetMap[kat] = nominalBudg;
            }
        });
    }

    // Menyiapkan Data untuk Chart
    const catLabels = Object.keys(categoryMap);
    const catData = Object.values(categoryMap);
    
    // Palet warna khusus sesuai gambar
    const customColors = ['#F93976', '#FF5A5F', '#FF7E67', '#FF9F70', '#FFBC7A', '#FFD884', '#F48C8C'];
    const catColors = catLabels.map((_, i) => customColors[i % customColors.length]);

    const dateLabels = Object.keys(dateMap).sort(); 
    const dateData = dateLabels.map(d => dateMap[d]);

    renderDashboard(totalExpenses, totalBudget, catLabels, catData, catColors, dateLabels, dateData, categoryMap, dateMap, categoryBudgetMap);
}

// 3. Menampilkan ke Antarmuka
function renderDashboard(totalExpenses, totalBudget, catLabels, catData, catColors, dateLabels, dateData, categoryMap, dateMap, categoryBudgetMap) {
    
    // Update Top Stats
    document.getElementById('total-expenses').innerText = formatRupiah(totalExpenses);
    document.getElementById('month-budget').innerText = formatRupiah(totalBudget);
    
    let recentBudget = totalBudget - totalExpenses;
    document.getElementById('recent-budget').innerText = formatRupiah(recentBudget);
    
    let persentaseTotal = totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0;
    
    document.getElementById('budget-progress').style.width = Math.min(persentaseTotal, 100) + '%';
    document.getElementById('progress-percentage').innerText = persentaseTotal + '%';

    // Update Donut Chart dengan warna baru
    const ctxDonut = document.getElementById('donutChart').getContext('2d');
    if(donutChartInstance) donutChartInstance.destroy();
    
    if (catLabels.length > 0) {
        donutChartInstance = new Chart(ctxDonut, {
            type: 'doughnut',
            data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: catColors, borderWidth: 0 }] },
            options: { cutout: '60%', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });
    }

    // Update Line Chart
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    if(lineChartInstance) lineChartInstance.destroy();
    
    if (dateLabels.length > 0) {
        lineChartInstance = new Chart(ctxLine, {
            type: 'line',
            data: { labels: dateLabels, datasets: [{ label: 'EXPENSES', data: dateData, borderColor: '#F93976', backgroundColor: 'rgba(249, 57, 118, 0.2)', fill: true, tension: 0.1 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Update Tabel Kategori dengan perhitungan Budget, Saldo, dan Persentase
    const catTbody = document.querySelector('#category-table tbody');
    catTbody.innerHTML = '';
    
    // Gabungkan kategori yang ada di transaksi maupun di budget
    const allCategories = new Set([...Object.keys(categoryMap), ...Object.keys(categoryBudgetMap)]);

    allCategories.forEach(cat => {
        if(cat === "LAINNYA" && !categoryMap[cat]) return; // Skip "Lainnya" jika kosong
        
        let exp = categoryMap[cat] || 0;
        let bud = categoryBudgetMap[cat] || 0;
        let sal = bud - exp;
        let pct = bud > 0 ? Math.round((exp / bud) * 100) : 0;

        catTbody.innerHTML += `
          <tr>
            <td>${cat}</td>
            <td>${formatRupiah(exp)}</td>
            <td>${bud > 0 ? formatRupiah(bud) : '-'}</td>
            <td>${bud > 0 ? formatRupiah(sal) : '-'}</td>
            <td>${bud > 0 ? pct + '%' : '-'}</td>
          </tr>`;
    });

    // Update Tabel Tanggal
    const dateTbody = document.querySelector('#date-table tbody');
    dateTbody.innerHTML = '';
    for (let date of dateLabels) {
        dateTbody.innerHTML += `<tr><td>${date}</td><td>${formatRupiah(dateMap[date])}</td></tr>`;
    }
}

// Event Listeners untuk Form (Sesuai dengan ID pada HTML yang baru)
document.getElementById('transaction-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit');
  const originalText = btn.innerText;
  btn.innerText = 'Saving...'; 
  btn.disabled = true;

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
    btn.innerText = originalText; 
    btn.disabled = false;
    loadDashboardData(); 
  }).catch(err => {
    alert('Failed to save. Please try again.');
    btn.innerText = originalText; 
    btn.disabled = false;
  });
});

document.addEventListener('DOMContentLoaded', loadDashboardData);

document.getElementById('month-selector').addEventListener('change', (e) => {
    processAndRenderData(e.target.value);
});
