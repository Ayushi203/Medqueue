import { printPrescription } from './printPrescription.js'

function formatDate(value) {
  if (!value) return '-'

  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

// Read-only view of a prescription, shared by doctor and patient dashboards
function PrescriptionCard({ prescription, showPatient = false, showDoctor = true, showPrint = true }) {

  if (!prescription) return null

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>℞ PRESCRIPTION</div>
          <div style={styles.title}>{prescription.diagnosis}</div>
          <div style={styles.meta}>
            {formatDate(prescription.appointmentDate)}
            {showDoctor && prescription.doctorName && ` · ${prescription.doctorName}`}
            {showDoctor && prescription.specialization && ` (${prescription.specialization})`}
            {showPatient && prescription.patientName && ` · ${prescription.patientName}`}
          </div>
        </div>

        <div style={styles.headerRight}>
          {prescription.followUpDate && (
            <div style={styles.followUp}>
              <span>Follow-up</span>
              <strong>{formatDate(prescription.followUpDate)}</strong>
            </div>
          )}

          {showPrint && (
            <button
              type="button"
              onClick={() => printPrescription(prescription)}
              style={styles.printButton}
            >
              🖨 Print / Save as PDF
            </button>
          )}
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Medicine</th>
              <th style={styles.th}>Dosage</th>
              <th style={styles.th}>Frequency</th>
              <th style={styles.th}>Duration</th>
              <th style={styles.th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {(prescription.medicines || []).map((medicine, index) => (
              <tr key={index}>
                <td style={{ ...styles.td, fontWeight: 700, color: '#172033' }}>{medicine.name}</td>
                <td style={styles.td}>{medicine.dosage || '—'}</td>
                <td style={styles.td}>{medicine.frequency || '—'}</td>
                <td style={styles.td}>{medicine.duration || '—'}</td>
                <td style={styles.td}>{medicine.instructions || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {prescription.instructions && (
        <div style={styles.instructions}>
          <strong>Advice: </strong>
          {prescription.instructions}
        </div>
      )}
    </div>
  )
}

const styles = {
  card: {
    border: '1px solid #e2ece9',
    background: '#fbfefd',
    borderRadius: 12,
    padding: 16,
    marginTop: 12
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12
  },
  eyebrow: { fontSize: 12, fontWeight: 800, letterSpacing: 1, color: 'var(--mq-primary)' },
  title: { fontSize: 15, fontWeight: 800, color: '#172033', marginTop: 4 },
  meta: { fontSize: 12, color: '#7b8794', marginTop: 3 },
  followUp: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--mq-primary-light)',
    color: 'var(--mq-primary-dark)',
    borderRadius: 9,
    padding: '7px 11px',
    fontSize: 12
  },
  headerRight: { display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' },
  printButton: {
    border: '1px solid var(--mq-primary-border)',
    background: '#fff',
    color: 'var(--mq-primary)',
    borderRadius: 9,
    padding: '7px 11px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer'
  },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    fontSize: 12,
    color: '#8a95a5',
    borderBottom: '1px solid #e6ebf1',
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '8px 10px',
    borderBottom: '1px solid #f0f2f5',
    color: '#455264'
  },
  instructions: {
    marginTop: 12,
    fontSize: 12,
    color: '#455264',
    background: '#f6f8fb',
    borderRadius: 9,
    padding: '9px 11px'
  }
}

export default PrescriptionCard
