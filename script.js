const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby0mrd94SdBnHXn54bU-ZsQmjRSJmo0UoSiSmexiAWUl6XjmRH2RE51-weN-JwnEfus/exec';

document.getElementById('transaction-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit');
  btn.innerText = 'Saving...';
  btn.disabled = true;

  // Key tetap menggunakan bahasa Indonesia agar sesuai dengan Apps Script
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
    alert('Data successfully sent to Spreadsheet!');
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

document.getElementById('btn-load').addEventListener('click', function() {
  const divResult = document.getElementById('dashboard-result');
  divResult.innerHTML = '<i>Loading data from Google Sheets...</i>';
  
  fetch(SCRIPT_URL)
    .then(response => response.json())
    .then(res => {
      if(res.status === 'sukses') {
        let html = '<table>';
        res.data.forEach((row, index) => {
          html += '<tr>';
          row.forEach(cell => {
            html += index === 0 ? `<th>${cell}</th>` : `<td>${cell}</td>`;
          });
          html += '</tr>';
        });
        html += '</table>';
        divResult.innerHTML = html;
      }
    })
    .catch(err => {
      divResult.innerHTML = '<b style="color:red;">Failed to load data from Spreadsheet.</b>';
    });
});
