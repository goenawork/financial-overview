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
