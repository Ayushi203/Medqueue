
// Opens a clean, printable prescription in a new window. The browser's print
// dialog can also "Save as PDF". Clinic name comes from VITE_CLINIC_NAME.

const CLINIC_NAME = import.meta.env.VITE_CLINIC_NAME || 'MedQueue Clinic'

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const longDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : ''

export function printPrescription(prescription) {

  const medicineRows = (prescription.medicines || [])
    .map((medicine, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(medicine.name)}</strong></td>
        <td>${escapeHtml(medicine.dosage) || '—'}</td>
        <td>${escapeHtml(medicine.frequency) || '—'}</td>
        <td>${escapeHtml(medicine.duration) || '—'}</td>
        <td>${escapeHtml(medicine.instructions) || '—'}</td>
      </tr>`)
    .join('')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Prescription - ${escapeHtml(prescription.patientName)} - ${escapeHtml(prescription.appointmentDate)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px;
    font-family: Inter, "Segoe UI", Arial, sans-serif;
    color: #172033;
    font-size: 14px;
  }
  .sheet { max-width: 780px; margin: 0 auto; }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #0f766e;
    padding-bottom: 14px;
  }
  .clinic { font-size: 22px; font-weight: 800; color: #0f766e; }
  .doctor { text-align: right; }
  .doctor strong { font-size: 16px; display: block; }
  .muted { color: #64748b; font-size: 13px; }
  .patient {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 32px;
    margin: 18px 0;
    padding: 12px 14px;
    background: #f6f8fb;
    border-radius: 8px;
  }
  .patient span { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .5px; }
  .rx { font-size: 30px; font-weight: 800; color: #0f766e; margin: 8px 0 4px; }
  .diagnosis { font-size: 15px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; background: #f8fafc; }
  .block { margin-top: 18px; }
  .block h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; margin: 0 0 6px; }
  .signature { margin-top: 56px; display: flex; justify-content: flex-end; }
  .signature div { border-top: 1px solid #172033; padding-top: 6px; min-width: 220px; text-align: center; }
  footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; }
  .actions { text-align: center; margin-bottom: 20px; }
  .actions button {
    border: 0; background: #0f766e; color: #fff; padding: 10px 18px;
    border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer;
  }
  @media print {
    body { padding: 0; }
    .actions { display: none; }
    @page { margin: 16mm; }
  }
</style>
</head>
<body>
<div class="sheet">
  <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>

  <header>
    <div>
      <div class="clinic">${escapeHtml(CLINIC_NAME)}</div>
      <div class="muted">Medical prescription</div>
    </div>
    <div class="doctor">
      <strong>${escapeHtml(prescription.doctorName)}</strong>
      <span class="muted">${escapeHtml(prescription.specialization)}</span>
    </div>
  </header>

  <section class="patient">
    <div><span>Patient</span><strong>${escapeHtml(prescription.patientName)}</strong></div>
    <div><span>Date</span><strong>${escapeHtml(longDate(prescription.appointmentDate))}</strong></div>
    <div><span>Token</span><strong>#${escapeHtml(prescription.tokenNumber)}</strong></div>
    ${prescription.followUpDate
      ? `<div><span>Follow-up</span><strong>${escapeHtml(longDate(prescription.followUpDate))}</strong></div>`
      : ''}
  </section>

  <div class="rx">℞</div>
  <div class="diagnosis"><strong>Diagnosis:</strong> ${escapeHtml(prescription.diagnosis)}</div>

  <table>
    <thead>
      <tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Notes</th></tr>
    </thead>
    <tbody>${medicineRows}</tbody>
  </table>

  ${prescription.instructions
    ? `<div class="block"><h3>Advice</h3><div>${escapeHtml(prescription.instructions).replace(/\n/g, '<br>')}</div></div>`
    : ''}

  <div class="signature"><div>${escapeHtml(prescription.doctorName)}<br><span class="muted">Signature</span></div></div>

  <footer>Issued through MedQueue · ${escapeHtml(new Date().toLocaleDateString('en-IN'))}</footer>
</div>
<script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 300) })</script>
</body>
</html>`

  const printWindow = window.open('', '_blank', 'width=900,height=1000')

  if (!printWindow) {
    window.alert('Please allow pop-ups for MedQueue to print the prescription.')
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
