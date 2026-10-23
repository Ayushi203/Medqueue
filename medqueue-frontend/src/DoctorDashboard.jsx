
import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api.js'

import PrescriptionCard from './components/PrescriptionCard.jsx'
import StatusBadge from './components/StatusBadge.jsx'
import StarRating from './components/StarRating.jsx'


function getToken() {
  return localStorage.getItem('token')
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    return null
  }
}

function toDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function minutesOf(time) {
  const [hours, minutes] = (time || '0:0').split(':').map(Number)
  return hours * 60 + minutes
}

// [startMinute, endMinute]; an end at or before the start runs past midnight
function shiftMinutes(doctor) {
  const parts = (doctor?.availableTime || '').split(/\s*[-–—]\s*/)
  if (parts.length !== 2) return null

  const start = minutesOf(parts[0])
  let end = minutesOf(parts[1])
  if (end <= start) end += 24 * 60

  return [start, end]
}

// The date whose shift is running now: during the early-morning part of a
// night shift that is still yesterday
function getShiftDate(doctor) {
  const now = new Date()
  const shift = shiftMinutes(doctor)

  if (shift && shift[1] > 24 * 60) {
    const minuteNow = now.getHours() * 60 + now.getMinutes()

    if (minuteNow < shift[1] - 24 * 60) {
      now.setDate(now.getDate() - 1)
    }
  }

  return toDateString(now)
}

function getToday() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatDate(value) {
  if (!value) return ''

  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function formatTime(value) {
  if (!value) return ''

  const [hours, minutes] = value.split(':')
  const date = new Date()
  date.setHours(Number(hours), Number(minutes), 0, 0)

  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit'
  })
}

// Walk-ins have a placeholder login address; show their phone instead
function patientContact(appointment) {
  const email = appointment.patientEmail || ''

  if (email.endsWith('@walkin.medqueue.local')) {
    return appointment.patientPhone ? `Walk-in · ${appointment.patientPhone}` : 'Walk-in patient'
  }

  return email
}

function formatElapsed(fromDateTime, now) {
  if (!fromDateTime) return '0:00'

  const seconds = Math.max(0, Math.floor((now - new Date(fromDateTime)) / 1000))
  const minutes = Math.floor(seconds / 60)

  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function DoctorDashboard() {
  const user = getUser()
  const token = getToken()

  const [doctor, setDoctor] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [selectedDate, setSelectedDate] = useState(getToday())

  const [loading, setLoading] = useState(true)
  const [doctorLoading, setDoctorLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [processingId, setProcessingId] = useState(null)

  // Prescription state
  const [prescriptionAppointment, setPrescriptionAppointment] = useState(null)
  const [diagnosis, setDiagnosis] = useState('')
  const [medicines, setMedicines] = useState([
    {
      name: '',
      dosage: '',
      frequency: '',
      duration: '',
      instructions: ''
    }
  ])
  const [prescriptionInstructions, setPrescriptionInstructions] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [prescriptionSaving, setPrescriptionSaving] = useState(false)
  const [prescriptionError, setPrescriptionError] = useState('')
  const [editingPrescription, setEditingPrescription] = useState(false)
  const [viewPrescription, setViewPrescription] = useState(null)

  // Views, ratings and history
  const [activeView, setActiveView] = useState('Dashboard')
  const [ratingSummary, setRatingSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [patientHistory, setPatientHistory] = useState(null)

  // Most recent earlier visit of the patient being seen (with prescription)
  const [lastVisit, setLastVisit] = useState(null)

  // Walk-in form
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [walkInName, setWalkInName] = useState('')
  const [walkInPhone, setWalkInPhone] = useState('')
  const [walkInSaving, setWalkInSaving] = useState(false)
  const [walkInError, setWalkInError] = useState('')

  // Prescription helpers
  const [previousPrescription, setPreviousPrescription] = useState(null)
  const [templates, setTemplates] = useState([])
  const [knownMedicines, setKnownMedicines] = useState({})
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [showTemplateSave, setShowTemplateSave] = useState(false)

  const calledAppointmentsForEffect = appointments.filter(item => item.status === 'CALLED')
  const calledIdForEffect = calledAppointmentsForEffect[0]?.id || null

  // Ticks every second so the consultation timer is live
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Date of the shift running now (yesterday's, after midnight on a night shift)
  const today = doctor ? getShiftDate(doctor) : getToday()
  const isNightShift = (shiftMinutes(doctor)?.[1] || 0) > 24 * 60

  // Once the doctor is known, open on the shift that is running now
  const [initialDateSet, setInitialDateSet] = useState(false)

  if (doctor && !initialDateSet) {
    setInitialDateSet(true)
    setSelectedDate(getShiftDate(doctor))
  }

  // Load doctor profile
  useEffect(() => {
    let active = true

    async function loadDoctor() {
      if (!user?.id || !token) {
        setError('Please log in again to access the doctor dashboard.')
        setDoctorLoading(false)
        return
      }

      try {
        setDoctorLoading(true)
        setError('')

        const response = await apiFetch(`/api/doctors/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })

        if (response.ok) {
          const doctorData = await response.json()
          if (active) setDoctor(doctorData)
        } else {
          const fallback = await apiFetch(`/api/doctors`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })

          if (!fallback.ok) {
            throw new Error('Unable to load doctor profile.')
          }

          const doctors = await fallback.json()

          const currentDoctor = doctors.find(
            item => Number(item.userId) === Number(user.id)
          )

          if (!currentDoctor) {
            throw new Error('Doctor profile not found for this account.')
          }

          if (active) setDoctor(currentDoctor)
        }
      } catch (err) {
        console.error(err)
        if (active) setError(err.message || 'Unable to load doctor profile.')
      } finally {
        if (active) setDoctorLoading(false)
      }
    }

    loadDoctor()

    return () => {
      active = false
    }
  }, [user?.id, token])

  // Load appointments for the selected date
  async function fetchAppointments(showLoading = false) {
    if (!doctor?.id || !token) return

    try {
      if (showLoading) setLoading(true)

      const response = await apiFetch(
        `/api/appointments/doctor/${doctor.id}?date=${selectedDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Unable to load appointments.')
      }

      const data = await response.json()

      setAppointments(
        // The backend returns the whole shift, which may run into the next date
        data
      )
      setError('')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to load appointments.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    if (!doctor?.id || !token) return

    fetchAppointments(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor?.id, selectedDate, token])

  // Automatically refresh today's queue
  useEffect(() => {
    if (!doctor?.id || !token || selectedDate !== today) return

    const interval = setInterval(() => {
      fetchAppointments(false)
    }, 5000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor?.id, selectedDate, today, token])

  // Ratings received by this doctor
  useEffect(() => {
    if (!doctor?.id || !token) return

    apiFetch(`/api/ratings/doctor/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(response => (response.ok ? response.json() : null))
      .then(data => data && setRatingSummary(data))
      .catch(err => console.error('Rating load error:', err))
  }, [doctor?.id, token])

  // Past consultations, loaded when the History view opens
  useEffect(() => {
    if (activeView !== 'History' || !doctor?.id || !token) return

    let active = true
    setHistoryLoading(true)

    apiFetch(`/api/appointments/history/doctor/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(response => {
        if (!response.ok) throw new Error('Unable to load consultation history.')
        return response.json()
      })
      .then(data => active && setHistory(data))
      .catch(err => active && setError(err.message))
      .finally(() => active && setHistoryLoading(false))

    return () => {
      active = false
    }
  }, [activeView, doctor?.id, token])

  // Latest earlier completed visit (any doctor) for a patient, or null
  async function fetchLastVisit(appointment) {
    const response = await apiFetch(
      `/api/appointments/history/patient/${appointment.patientId}`
    )

    if (!response.ok) return null

    const visits = await response.json()

    return (
      visits.find(
        visit => visit.id !== appointment.id && visit.status === 'COMPLETED'
      ) || null
    )
  }

  // Show the last visit as soon as a patient is called in
  useEffect(() => {
    const appointment = calledAppointmentsForEffect[0]

    if (!appointment) return

    let active = true

    fetchLastVisit(appointment)
      .then(visit => active && setLastVisit({ forId: appointment.id, visit }))
      .catch(err => console.error('Last visit error:', err))

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calledIdForEffect])

  // Templates and the doctor's own medicine history, loaded once
  useEffect(() => {
    if (!doctor?.id) return

    apiFetch('/api/prescription-templates')
      .then(response => (response.ok ? response.json() : []))
      .then(setTemplates)
      .catch(err => console.error('Template load error:', err))

    apiFetch('/api/prescriptions/doctor/me')
      .then(response => (response.ok ? response.json() : []))
      .then(prescriptions => {
        // name (lower case) -> most recent way it was prescribed
        const byName = {}

        prescriptions.forEach(prescription => {
          (prescription.medicines || []).forEach(medicine => {
            const key = (medicine.name || '').trim().toLowerCase()

            if (key && !byName[key]) {
              byName[key] = medicine
            }
          })
        })

        setKnownMedicines(byName)
      })
      .catch(err => console.error('Medicine history error:', err))
  }, [doctor?.id])

  async function addWalkIn(event) {
    event.preventDefault()

    if (!walkInName.trim()) {
      setWalkInError('Enter the patient\'s name.')
      return
    }

    try {
      setWalkInSaving(true)
      setWalkInError('')

      const response = await apiFetch('/api/appointments/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: walkInName.trim(),
          phone: walkInPhone.trim()
        })
      })

      if (!response.ok) {
        let message = 'Unable to add walk-in patient.'

        try {
          message = (await response.json()).message || message
        } catch {
          // Use default message
        }

        throw new Error(message)
      }

      const added = await response.json()

      setShowWalkIn(false)
      setWalkInName('')
      setWalkInPhone('')
      setSuccess(`${added.patientName} added to the queue as token #${added.tokenNumber}.`)
      setTimeout(() => setSuccess(''), 4000)

      fetchAppointments(false)
    } catch (err) {
      setWalkInError(err.message)
    } finally {
      setWalkInSaving(false)
    }
  }

  async function openPatientHistory(appointment) {
    setPatientHistory({ patientName: appointment.patientName, visits: null })

    try {
      const response = await apiFetch(
        `/api/appointments/history/patient/${appointment.patientId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (!response.ok) throw new Error('Unable to load patient history.')

      const visits = await response.json()

      setPatientHistory({
        patientName: appointment.patientName,
        visits: visits.filter(item => item.status === 'COMPLETED' || item.status === 'SKIPPED')
      })
    } catch (err) {
      setPatientHistory(null)
      setError(err.message)
    }
  }

  const filteredHistory = useMemo(() => {
    const text = historySearch.trim().toLowerCase()
    if (!text) return history

    return history.filter(item =>
      (item.patientName || '').toLowerCase().includes(text) ||
      (item.prescription?.diagnosis || '').toLowerCase().includes(text)
    )
  }, [history, historySearch])

  const bookedAppointments = useMemo(
    () => appointments.filter(item => item.status === 'BOOKED'),
    [appointments]
  )

  const calledAppointments = useMemo(
    () => appointments.filter(item => item.status === 'CALLED'),
    [appointments]
  )

  const completedAppointments = useMemo(
    () => appointments.filter(item => item.status === 'COMPLETED'),
    [appointments]
  )

  const currentPatient = calledAppointments[0] || null
  // Call Next takes the first patient who has checked in, so someone who
  // hasn't arrived yet is passed over without losing their place
  const nextPatient =
    bookedAppointments.find(item => item.arrivalStatus === 'ARRIVED') ||
    bookedAppointments[0] ||
    null

  const arrivedCount = bookedAppointments.filter(
    item => item.arrivalStatus === 'ARRIVED'
  ).length

  // Same learned average the patients' wait estimates use
  const usualMinutes =
    doctor?.learnedConsultationMinutes || doctor?.consultationTime || 15

  const consultationOverrun = Boolean(
    currentPatient?.calledAt &&
      now - new Date(currentPatient.calledAt).getTime() > usualMinutes * 60 * 1000
  )

  const pendingPrescriptions = useMemo(
    () => completedAppointments.filter(item => !item.prescription),
    [completedAppointments]
  )

  // Update appointment status
  async function updateStatus(appointmentId, status) {
    try {
      setProcessingId(appointmentId)
      setError('')
      setSuccess('')

      const response = await apiFetch(
        `/api/appointments/${appointmentId}/status?status=${status}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        let message = 'Unable to update appointment.'

        try {
          const data = await response.json()
          message = data.message || message
        } catch {
          // Use default message
        }

        throw new Error(message)
      }

      const updatedAppointment = await response.json()
      const previousAppointment = appointments.find(item => item.id === appointmentId)

      // The status endpoint does not include prescription or rating, so keep them
      const mergedAppointment = {
        ...updatedAppointment,
        prescription: previousAppointment?.prescription || null,
        rating: previousAppointment?.rating || null
      }

      setAppointments(previous =>
        previous.map(item =>
          item.id === mergedAppointment.id ? mergedAppointment : item
        )
      )

      // Every completed visit needs a prescription
      if (status === 'COMPLETED' && !mergedAppointment.prescription) {
        openPrescription(mergedAppointment)
      }

      if (status === 'CALLED') {
        setSuccess(`Token ${updatedAppointment.tokenNumber} called successfully.`)
      } else if (status === 'COMPLETED') {
        setSuccess(`Token ${updatedAppointment.tokenNumber} completed.`)
      } else if (status === 'SKIPPED') {
        setSuccess(`Token ${updatedAppointment.tokenNumber} skipped.`)
      }

      setTimeout(() => setSuccess(''), 3500)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to update appointment.')
    } finally {
      setProcessingId(null)
    }
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.reload()
  }

  // Open a fresh prescription form
  function openPrescription(appointment) {
    const existing = appointment.prescription

    setPrescriptionAppointment(appointment)
    setEditingPrescription(Boolean(existing))
    setDiagnosis(existing?.diagnosis || '')
    setMedicines(
      existing?.medicines?.length
        ? existing.medicines.map(item => ({
            name: item.name || '',
            dosage: item.dosage || '',
            frequency: item.frequency || '',
            duration: item.duration || '',
            instructions: item.instructions || ''
          }))
        : [
            {
              name: '',
              dosage: '',
              frequency: '',
              duration: '',
              instructions: ''
            }
          ]
    )
    setPrescriptionInstructions(existing?.instructions || '')
    setFollowUpDate(existing?.followUpDate || '')
    setPrescriptionError('')
    setViewPrescription(null)
    setShowTemplateSave(false)
    setTemplateName('')
    setPreviousPrescription(null)

    // For "Repeat last prescription"
    fetchLastVisit(appointment)
      .then(visit => setPreviousPrescription(visit?.prescription || null))
      .catch(() => setPreviousPrescription(null))
  }

  // Fill the form from a template or an earlier prescription
  function fillPrescription(source) {
    setDiagnosis(source.diagnosis || '')
    setMedicines(
      (source.medicines || []).length
        ? source.medicines.map(item => ({
            name: item.name || '',
            dosage: item.dosage || '',
            frequency: item.frequency || '',
            duration: item.duration || '',
            instructions: item.instructions || ''
          }))
        : [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
    )
    setPrescriptionInstructions(source.instructions || '')
    setPrescriptionError('')
  }

  // Medicine name picked from suggestions: fill the rest the way it was last prescribed
  function chooseMedicineName(index, value) {
    const known = knownMedicines[value.trim().toLowerCase()]

    setMedicines(previous =>
      previous.map((medicine, i) => {
        if (i !== index) return medicine

        if (!known) return { ...medicine, name: value }

        return {
          name: value,
          dosage: medicine.dosage || known.dosage || '',
          frequency: medicine.frequency || known.frequency || '',
          duration: medicine.duration || known.duration || '',
          instructions: medicine.instructions || known.instructions || ''
        }
      })
    )
  }

  async function saveAsTemplate() {
    const name = templateName.trim()

    if (!name) {
      setPrescriptionError('Give the template a name, e.g. "Viral fever".')
      return
    }

    try {
      setSavingTemplate(true)

      const response = await apiFetch('/api/prescription-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          diagnosis: diagnosis.trim(),
          medicines: medicines.filter(item => item.name.trim()),
          instructions: prescriptionInstructions.trim()
        })
      })

      if (!response.ok) {
        let message = 'Unable to save template.'

        try {
          message = (await response.json()).message || message
        } catch {
          // Use default message
        }

        throw new Error(message)
      }

      const saved = await response.json()

      setTemplates(previous =>
        [...previous.filter(item => item.id !== saved.id), saved]
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setShowTemplateSave(false)
      setTemplateName('')
      setSuccess(`Template "${saved.name}" saved.`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setPrescriptionError(err.message)
    } finally {
      setSavingTemplate(false)
    }
  }

  async function deleteTemplate(template) {
    const response = await apiFetch(`/api/prescription-templates/${template.id}`, {
      method: 'DELETE'
    })

    if (response.ok) {
      setTemplates(previous => previous.filter(item => item.id !== template.id))
    }
  }

  function closePrescription() {
    if (prescriptionSaving) return

    setPrescriptionAppointment(null)
    setPrescriptionError('')
  }

  function updateMedicine(index, field, value) {
    setMedicines(previous =>
      previous.map((medicine, i) =>
        i === index ? { ...medicine, [field]: value } : medicine
      )
    )
  }

  function addMedicine() {
    setMedicines(previous => [
      ...previous,
      {
        name: '',
        dosage: '',
        frequency: '',
        duration: '',
        instructions: ''
      }
    ])
  }

  function removeMedicine(index) {
    setMedicines(previous =>
      previous.length === 1
        ? previous
        : previous.filter((_, i) => i !== index)
    )
  }

  // Save prescription to Spring Boot backend
  async function savePrescription(event) {
    event.preventDefault()

    if (!prescriptionAppointment || !doctor?.id || !token) {
      setPrescriptionError('Doctor or appointment information is missing.')
      return
    }

    if (!diagnosis.trim()) {
      setPrescriptionError('Please enter a diagnosis.')
      return
    }

    const validMedicines = medicines.filter(item => item.name.trim())

    if (validMedicines.length === 0) {
      setPrescriptionError('Please enter at least one medicine name.')
      return
    }

    const appointmentBeingSaved = prescriptionAppointment

    const payload = {
      diagnosis: diagnosis.trim(),
      medicines: validMedicines.map(item => ({
        name: item.name.trim(),
        dosage: item.dosage.trim(),
        frequency: item.frequency.trim(),
        duration: item.duration.trim(),
        instructions: item.instructions.trim()
      })),
      instructions: prescriptionInstructions.trim(),
      followUpDate: followUpDate || null
    }

    try {
      setPrescriptionSaving(true)
      setPrescriptionError('')

      const response = await apiFetch(
        `/api/prescriptions/appointment/${appointmentBeingSaved.id}`,
        {
          method: editingPrescription ? 'PUT' : 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      )

      if (!response.ok) {
        let message = 'Unable to save prescription.'

        try {
          const data = await response.json()
          message = data.message || data.error || message
        } catch {
          // Use default message
        }

        throw new Error(message)
      }

      const savedPrescription = await response.json()

      const attach = item =>
        item.id === appointmentBeingSaved.id
          ? { ...item, prescription: savedPrescription, hasPrescription: true }
          : item

      setAppointments(previous => previous.map(attach))
      setHistory(previous => previous.map(attach))

      setPrescriptionAppointment(null)
      setSuccess(
        `Prescription ${editingPrescription ? 'updated' : 'saved'} for ${appointmentBeingSaved.patientName || 'the patient'}.`
      )
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      console.error('Prescription save error:', err)
      setPrescriptionError(err.message || 'Unable to save prescription.')
    } finally {
      setPrescriptionSaving(false)
    }
  }

  if (doctorLoading) {
    return (
      <div style={styles.centerPage}>
        <div style={styles.spinner} />
        <p>Loading doctor dashboard...</p>
      </div>
    )
  }

  if (!doctor) {
    return (
      <div style={styles.centerPage}>
        <div style={styles.errorCard}>
          <h2>Doctor profile not found</h2>
          <p>{error || 'The logged-in account is not connected to a doctor profile.'}</p>
          <button onClick={logout} style={styles.primaryButton}>Logout</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <div style={styles.logoIcon}>+</div>
          <div>
            <div style={styles.logoText}>MedQueue</div>
            <div style={styles.logoSubtext}>Doctor Portal</div>
          </div>
        </div>

        <div style={styles.doctorCard}>
          <div style={styles.avatar}>
            {doctor.name?.charAt(0)?.toUpperCase() || 'D'}
          </div>
          <div>
            <div style={styles.doctorName}>{doctor.name}</div>
            <div style={styles.specialization}>
              {doctor.specialization || 'Doctor'}
            </div>
          </div>
        </div>

        <nav style={styles.nav}>
          <div style={styles.navTitle}>WORKSPACE</div>
          {[
            { name: 'Dashboard', label: '▦ Queue' },
            { name: 'History', label: '▤ Patient History' },
            { name: 'Reviews', label: '★ Ratings & Reviews' }
          ].map(item => (
            <button
              key={item.name}
              type="button"
              onClick={() => setActiveView(item.name)}
              style={{
                ...styles.navItem,
                ...styles.navButton,
                ...(activeView === item.name ? styles.navItemActive : {})
              }}
            >
              {item.label}
              {item.name === 'Dashboard' && pendingPrescriptions.length > 0 && (
                <span style={styles.navCount}>{pendingPrescriptions.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={styles.sidebarBottom}>
          <button onClick={logout} style={styles.logoutButton}>↪ Logout</button>
        </div>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <div style={styles.breadcrumb}>Doctor Portal / Dashboard</div>
            <h1 style={styles.heading}>
              Good day, Dr. {doctor.name?.replace(/^Dr\.?\s*/i, '')}
            </h1>
            <p style={styles.subtitle}>Manage your clinic queue and appointments.</p>
          </div>

          <div style={styles.headerRight}>
            <span style={styles.liveBadge}>
              <span style={styles.liveDot} /> Live Queue
            </span>
            <span style={styles.dateBadge}>{formatDate(selectedDate)}</span>
          </div>
        </header>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {activeView === 'History' && (
          <section>
            <div style={styles.queueHeader}>
              <div>
                <h2 style={styles.sectionHeading}>Patient History</h2>
                <p style={styles.sectionSubheading}>
                  All past consultations with their prescriptions and patient ratings.
                </p>
              </div>
              <input
                type="search"
                placeholder="Search patient or diagnosis..."
                value={historySearch}
                onChange={event => setHistorySearch(event.target.value)}
                style={{ ...styles.dateInput, minWidth: 240 }}
              />
            </div>

            <div style={styles.tableCard}>
              {historyLoading ? (
                <div style={styles.emptyState}>Loading history...</div>
              ) : filteredHistory.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>▤</div>
                  <h3>No past consultations</h3>
                  <p>Completed visits will appear here.</p>
                </div>
              ) : (
                filteredHistory.map(visit => (
                  <HistoryVisit
                    key={visit.id}
                    visit={visit}
                    onWrite={() => openPrescription(visit)}
                    onPatientHistory={() => openPatientHistory(visit)}
                  />
                ))
              )}
            </div>
          </section>
        )}

        {activeView === 'Reviews' && (
          <section>
            <div style={styles.ratingHero}>
              <div style={styles.ratingBig}>
                {ratingSummary?.ratingCount ? ratingSummary.averageRating.toFixed(1) : '—'}
              </div>
              <div>
                <StarRating value={ratingSummary?.averageRating || 0} size={22} />
                <div style={styles.sectionSubheading}>
                  {ratingSummary?.ratingCount || 0} patient rating{ratingSummary?.ratingCount === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            <div style={styles.tableCard}>
              {!ratingSummary?.reviews?.length ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>★</div>
                  <h3>No ratings yet</h3>
                  <p>Patients can rate you after a completed consultation.</p>
                </div>
              ) : (
                ratingSummary.reviews.map(review => (
                  <div key={review.id} style={styles.reviewRow}>
                    <div style={styles.smallAvatar}>
                      {review.patientName?.charAt(0)?.toUpperCase() || 'P'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.reviewTop}>
                        <strong style={styles.tablePatientName}>{review.patientName}</strong>
                        <StarRating value={review.stars} size={14} />
                      </div>
                      <div style={styles.tableEmail}>Visit on {formatDate(review.appointmentDate)}</div>
                      {review.comment && <p style={styles.reviewComment}>{review.comment}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeView === 'Dashboard' && (
        <>
        {pendingPrescriptions.length > 0 && (
          <div style={styles.pendingBanner}>
            <strong>
              {pendingPrescriptions.length} completed visit{pendingPrescriptions.length === 1 ? '' : 's'} without a prescription.
            </strong>
            <button
              type="button"
              onClick={() => openPrescription(pendingPrescriptions[0])}
              style={styles.prescriptionButton}
            >
              Write for Token #{pendingPrescriptions[0].tokenNumber}
            </button>
          </div>
        )}

        <section style={styles.dateSection}>
          <div>
            <div style={styles.sectionLabel}>QUEUE DATE</div>
            <div style={styles.dateDescription}>
              Select a date to view that day's appointments.
            </div>
          </div>

          <div style={styles.dateControls}>
            <button
              onClick={() => setSelectedDate(today)}
              style={{
                ...styles.todayButton,
                ...(selectedDate === today ? styles.todayButtonActive : {})
              }}
            >
              Today
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={event => setSelectedDate(event.target.value)}
              style={styles.dateInput}
            />
          </div>
        </section>

        <section style={styles.statsGrid}>
          <StatCard
            title="Waiting"
            value={bookedAppointments.length}
            description={`${arrivedCount} checked in at the clinic`}
            icon="◉"
          />
          <StatCard title="In Consultation" value={calledAppointments.length} description="Currently consulting" icon="◌" />
          <StatCard title="Completed" value={completedAppointments.length} description="Completed appointments" icon="✓" />
          <StatCard
            title="Your Rating"
            value={ratingSummary?.ratingCount ? `${ratingSummary.averageRating.toFixed(1)} ★` : '—'}
            description={`${ratingSummary?.ratingCount || 0} patient ratings · ${appointments.length} visits today`}
            icon="★"
          />
        </section>

        {currentPatient && (
          <section style={styles.consultationCard}>
            <div>
              <div style={styles.consultationLabel}>CURRENT CONSULTATION</div>
              <div style={styles.currentPatientRow}>
                <div style={styles.bigToken}>{currentPatient.tokenNumber}</div>
                <div>
                  <h2 style={styles.patientName}>{currentPatient.patientName}</h2>
                  <p style={styles.patientDetails}>{patientContact(currentPatient)}</p>
                  <p style={styles.patientDetails}>
                    Appointment: {formatTime(currentPatient.appointmentTime)}
                    {' · '}
                    In consultation for{' '}
                    <strong style={consultationOverrun ? styles.timerLate : styles.timer}>
                      {formatElapsed(currentPatient.calledAt, now)}
                    </strong>
                    {consultationOverrun && (
                      <span style={styles.timerLateNote}>
                        {' '}· longer than your usual ~{usualMinutes} min
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {lastVisit?.forId === currentPatient.id && (
                <div style={styles.lastVisit}>
                  {lastVisit.visit ? (
                    <>
                      <div style={styles.lastVisitTitle}>
                        Last visit · {formatDate(lastVisit.visit.appointmentDate)} · {lastVisit.visit.doctorName}
                      </div>
                      {lastVisit.visit.prescription ? (
                        <>
                          <div>
                            <strong>Diagnosis:</strong> {lastVisit.visit.prescription.diagnosis}
                          </div>
                          <div>
                            <strong>Medicines:</strong>{' '}
                            {(lastVisit.visit.prescription.medicines || [])
                              .map(item => [item.name, item.dosage].filter(Boolean).join(' '))
                              .join(', ')}
                          </div>
                        </>
                      ) : (
                        <div>No prescription was recorded for that visit.</div>
                      )}
                    </>
                  ) : (
                    <div>First visit — no earlier consultations on record.</div>
                  )}
                </div>
              )}
            </div>

            <div style={styles.actionGroup}>
              <button
                type="button"
                onClick={() => openPatientHistory(currentPatient)}
                style={styles.cancelPrescriptionButton}
              >
                Past Visits
              </button>

              <button
                type="button"
                onClick={() => openPrescription(currentPatient)}
                style={styles.cancelPrescriptionButton}
              >
                {currentPatient.prescription ? '✎ Edit Prescription' : '℞ Write Prescription'}
              </button>

              <button
                disabled={processingId === currentPatient.id}
                onClick={() => updateStatus(currentPatient.id, 'COMPLETED')}
                style={styles.completeButton}
              >
                {processingId === currentPatient.id ? 'Updating...' : '✓ Complete Consultation'}
              </button>
            </div>
          </section>
        )}

        <section style={styles.queueHeader}>
          <div>
            <h2 style={styles.sectionHeading}>
              {selectedDate === today ? "Today's Queue" : `Queue — ${formatDate(selectedDate)}`}
            </h2>
            <p style={styles.sectionSubheading}>
              {loading
                ? 'Loading appointments...'
                : `${appointments.length} appointment${appointments.length === 1 ? '' : 's'} for this date`}
              {isNightShift && ` · Night shift ${formatTime(doctor.availableTime.split(/\s*[-–—]\s*/)[0])} – ${formatTime(doctor.availableTime.split(/\s*[-–—]\s*/)[1])} (next day)`}
            </p>
          </div>

          {selectedDate === today && (
            <div style={styles.actionGroup}>
            <button
              type="button"
              onClick={() => {
                setWalkInError('')
                setShowWalkIn(true)
              }}
              style={styles.walkInButton}
            >
              + Walk-in
            </button>
            <button
              onClick={() => nextPatient && updateStatus(nextPatient.id, 'CALLED')}
              disabled={!nextPatient || processingId !== null}
              style={{
                ...styles.callNextButton,
                ...(!nextPatient || processingId !== null ? styles.disabledButton : {})
              }}
            >
              ▶ Call Next
            </button>
            </div>
          )}
        </section>

        <section style={styles.tableCard}>
          {loading ? (
            <div style={styles.emptyState}>
              <div style={styles.spinner} />
              <p>Loading queue...</p>
            </div>
          ) : appointments.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>✓</div>
              <h3>No appointments</h3>
              <p>There are no appointments scheduled for {formatDate(selectedDate)}.</p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>TOKEN</th>
                    <th style={styles.th}>PATIENT</th>
                    <th style={styles.th}>TIME</th>
                    <th style={styles.th}>STATUS</th>
                    <th style={styles.th}>ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {appointments.map(appointment => (
                    <tr key={appointment.id}>
                      <td style={styles.td}>
                        <span style={styles.tokenBadge}>#{appointment.tokenNumber}</span>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.patientCell}>
                          <div style={styles.smallAvatar}>
                            {appointment.patientName?.charAt(0)?.toUpperCase() || 'P'}
                          </div>
                          <div>
                            <div style={styles.tablePatientName}>
                              {appointment.patientName}
                              {appointment.walkIn && <span style={styles.walkInTag}>Walk-in</span>}
                            </div>
                            <div style={styles.tableEmail}>{patientContact(appointment)}</div>
                          </div>
                        </div>
                      </td>

                      <td style={styles.td}>
                        {formatTime(appointment.appointmentTime)}
                        {appointment.appointmentDate !== selectedDate && (
                          <div style={styles.tableEmail}>{formatDate(appointment.appointmentDate)}</div>
                        )}
                      </td>

                      <td style={styles.td}>
                        <StatusBadge status={appointment.status} />
                        {appointment.status === 'BOOKED' && selectedDate === today && (
                          <ArrivalBadge appointment={appointment} />
                        )}
                      </td>

                      <td style={styles.td}>
                        {appointment.status === 'BOOKED' && selectedDate === today && (
                          <div style={styles.actionGroup}>
                            <button
                              disabled={processingId === appointment.id}
                              onClick={() => updateStatus(appointment.id, 'CALLED')}
                              style={styles.actionPrimary}
                            >
                              {processingId === appointment.id ? '...' : 'Call'}
                            </button>

                            <button
                              disabled={processingId === appointment.id}
                              onClick={() => updateStatus(appointment.id, 'SKIPPED')}
                              style={styles.actionSecondary}
                            >
                              Skip
                            </button>
                          </div>
                        )}

                        {appointment.status === 'CALLED' && selectedDate === today && (
                          <button
                            disabled={processingId === appointment.id}
                            onClick={() => updateStatus(appointment.id, 'COMPLETED')}
                            style={styles.actionComplete}
                          >
                            {processingId === appointment.id ? '...' : 'Complete'}
                          </button>
                        )}

                        {appointment.status === 'COMPLETED' && (
                          appointment.prescription ? (
                            <div style={styles.actionGroup}>
                              <button
                                type="button"
                                onClick={() => setViewPrescription(appointment.prescription)}
                                style={styles.prescriptionSavedBadge}
                              >
                                ✓ View ℞
                              </button>
                              <button
                                type="button"
                                onClick={() => openPrescription(appointment)}
                                style={styles.actionSecondary}
                              >
                                Edit
                              </button>
                              {appointment.rating && (
                                <StarRating value={appointment.rating.stars} size={12} />
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openPrescription(appointment)}
                              style={styles.prescriptionButton}
                            >
                              + Write Prescription
                            </button>
                          )
                        )}

                        {appointment.status === 'SKIPPED' && (
                          <span style={styles.muted}>Skipped</span>
                        )}

                        {appointment.status === 'CANCELLED' && (
                          <span style={styles.muted}>Cancelled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div style={styles.footerInfo}>
          <span>Queue refreshes automatically every 5 seconds.</span>
          <span>Selected date: {formatDate(selectedDate)}</span>
        </div>
        </>
        )}
      </main>

      {/* WALK-IN MODAL */}
      {showWalkIn && (
        <div style={styles.modalOverlay} onClick={() => !walkInSaving && setShowWalkIn(false)}>
          <div
            style={{ ...styles.prescriptionModal, maxWidth: 440 }}
            onClick={event => event.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalEyebrow}>MEDQUEUE · WALK-IN</div>
                <h2 style={styles.modalTitle}>Add walk-in patient</h2>
                <p style={styles.modalSubtitle}>
                  Joins today's queue now, marked as arrived. No account needed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWalkIn(false)}
                disabled={walkInSaving}
                style={styles.modalCloseButton}
              >
                ×
              </button>
            </div>

            <form onSubmit={addWalkIn}>
              {walkInError && <div style={styles.prescriptionError}>{walkInError}</div>}

              <label style={styles.formLabel}>
                Patient name <span style={styles.requiredMark}>*</span>
                <input
                  value={walkInName}
                  onChange={event => setWalkInName(event.target.value)}
                  placeholder="Full name"
                  maxLength={100}
                  required
                  autoFocus
                  style={styles.formInput}
                />
              </label>

              <label style={{ ...styles.formLabel, marginTop: 12 }}>
                Phone (optional)
                <input
                  type="tel"
                  value={walkInPhone}
                  onChange={event => setWalkInPhone(event.target.value)}
                  placeholder="10-digit mobile — links to their earlier visits"
                  style={styles.formInput}
                />
              </label>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowWalkIn(false)}
                  disabled={walkInSaving}
                  style={styles.cancelPrescriptionButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={walkInSaving}
                  style={styles.savePrescriptionButton}
                >
                  {walkInSaving ? 'Adding…' : 'Add to queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PRESCRIPTION MODAL */}
      {viewPrescription && (
        <div style={styles.modalOverlay} onClick={() => setViewPrescription(null)}>
          <div style={styles.prescriptionModal} onClick={event => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalEyebrow}>MEDQUEUE · PRESCRIPTION</div>
                <h2 style={styles.modalTitle}>{viewPrescription.patientName}</h2>
                <p style={styles.modalSubtitle}>Token #{viewPrescription.tokenNumber}</p>
              </div>
              <button type="button" onClick={() => setViewPrescription(null)} style={styles.modalCloseButton}>×</button>
            </div>
            <PrescriptionCard prescription={viewPrescription} showDoctor={false} />
          </div>
        </div>
      )}

      {/* PATIENT HISTORY MODAL */}
      {patientHistory && (
        <div style={styles.modalOverlay} onClick={() => setPatientHistory(null)}>
          <div style={styles.prescriptionModal} onClick={event => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalEyebrow}>MEDQUEUE · PATIENT HISTORY</div>
                <h2 style={styles.modalTitle}>{patientHistory.patientName}</h2>
                <p style={styles.modalSubtitle}>Previous visits across all doctors</p>
              </div>
              <button type="button" onClick={() => setPatientHistory(null)} style={styles.modalCloseButton}>×</button>
            </div>

            {patientHistory.visits === null ? (
              <div style={styles.emptyState}>Loading...</div>
            ) : patientHistory.visits.length === 0 ? (
              <div style={styles.emptyState}>No previous visits for this patient.</div>
            ) : (
              patientHistory.visits.map(visit => (
                <div key={visit.id} style={styles.historyBlock}>
                  <div style={styles.reviewTop}>
                    <strong>{formatDate(visit.appointmentDate)} · {visit.doctorName}</strong>
                    <StatusBadge status={visit.status} />
                  </div>
                  {visit.prescription ? (
                    <PrescriptionCard prescription={visit.prescription} />
                  ) : (
                    <p style={styles.muted}>No prescription recorded.</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* PRESCRIPTION MODAL */}
      {prescriptionAppointment && (
        <div style={styles.modalOverlay}>
          <div style={styles.prescriptionModal}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalEyebrow}>MEDQUEUE · PRESCRIPTION</div>
                <h2 style={styles.modalTitle}>
                  {editingPrescription ? 'Edit Prescription' : 'Write Prescription'}
                </h2>
                <p style={styles.modalSubtitle}>
                  Patient: {prescriptionAppointment.patientName || 'Patient'} · Token #{prescriptionAppointment.tokenNumber}
                </p>
              </div>

              <button
                type="button"
                onClick={closePrescription}
                disabled={prescriptionSaving}
                style={styles.modalCloseButton}
              >
                ×
              </button>
            </div>

            <form onSubmit={savePrescription}>
              {prescriptionError && (
                <div style={styles.prescriptionError}>{prescriptionError}</div>
              )}

              {/* Quick fill: earlier prescription or a saved template */}
              <div style={styles.quickFill}>
                {previousPrescription && (
                  <button
                    type="button"
                    onClick={() => fillPrescription(previousPrescription)}
                    style={styles.quickFillButton}
                    title={previousPrescription.diagnosis}
                  >
                    ↻ Repeat last prescription
                    <span style={styles.quickFillHint}>
                      {' '}({formatDate(previousPrescription.appointmentDate)}, {previousPrescription.doctorName})
                    </span>
                  </button>
                )}

                {templates.length > 0 && (
                  <select
                    value=""
                    onChange={event => {
                      const template = templates.find(item => String(item.id) === event.target.value)
                      if (template) fillPrescription(template)
                    }}
                    style={styles.templateSelect}
                    aria-label="Use a saved template"
                  >
                    <option value="">Use a template…</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                )}

                {!previousPrescription && templates.length === 0 && (
                  <span style={styles.quickFillHint}>
                    Tip: save a prescription as a template to reuse it in one click.
                  </span>
                )}
              </div>

              <datalist id="mq-known-medicines">
                {Object.values(knownMedicines).map(medicine => (
                  <option key={medicine.name} value={medicine.name}>
                    {[medicine.dosage, medicine.frequency].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </datalist>

              <label style={styles.formLabel}>
                <span>
                  Diagnosis <span style={styles.requiredMark}>*</span>
                </span>
                <textarea
                  value={diagnosis}
                  onChange={event => setDiagnosis(event.target.value)}
                  placeholder="Enter diagnosis"
                  required
                  rows={2}
                  style={styles.formTextarea}
                />
              </label>

              <div style={styles.medicineSectionHeader}>
                <div>
                  <h3 style={styles.medicineSectionTitle}>Medicines</h3>
                  <p style={styles.medicineSectionHint}>Add the prescribed medicines.</p>
                </div>

                <button type="button" onClick={addMedicine} style={styles.addMedicineButton}>
                  + Add Medicine
                </button>
              </div>

              {medicines.map((medicine, index) => (
                <div style={styles.medicineCard} key={index}>
                  <div style={styles.medicineCardHeader}>
                    <strong>Medicine {index + 1}</strong>

                    {medicines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicine(index)}
                        style={styles.removeMedicineButton}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div style={styles.medicineGrid}>
                    <label style={styles.formLabel}>
                      Medicine Name *
                      <input
                        value={medicine.name}
                        onChange={event => chooseMedicineName(index, event.target.value)}
                        placeholder="Start typing for suggestions"
                        list="mq-known-medicines"
                        required
                        style={styles.formInput}
                      />
                    </label>

                    <label style={styles.formLabel}>
                      Dosage
                      <input
                        value={medicine.dosage}
                        onChange={event => updateMedicine(index, 'dosage', event.target.value)}
                        placeholder="e.g. 500 mg"
                        style={styles.formInput}
                      />
                    </label>

                    <label style={styles.formLabel}>
                      Frequency
                      <input
                        value={medicine.frequency}
                        onChange={event => updateMedicine(index, 'frequency', event.target.value)}
                        placeholder="e.g. Twice daily"
                        style={styles.formInput}
                      />
                    </label>

                    <label style={styles.formLabel}>
                      Duration
                      <input
                        value={medicine.duration}
                        onChange={event => updateMedicine(index, 'duration', event.target.value)}
                        placeholder="e.g. 5 days"
                        style={styles.formInput}
                      />
                    </label>

                    <label style={{ ...styles.formLabel, ...styles.medicineInstructionsField }}>
                      Medicine Instructions
                      <input
                        value={medicine.instructions}
                        onChange={event => updateMedicine(index, 'instructions', event.target.value)}
                        placeholder="e.g. After food"
                        style={styles.formInput}
                      />
                    </label>
                  </div>
                </div>
              ))}

              <div style={styles.modalBottomGrid}>
                <label style={styles.formLabel}>
                  Follow-up Date
                  <input
                    type="date"
                    value={followUpDate}
                    min={today}
                    onChange={event => setFollowUpDate(event.target.value)}
                    style={styles.formInput}
                  />
                </label>

                <label style={styles.formLabel}>
                  Additional Instructions
                  <textarea
                    value={prescriptionInstructions}
                    onChange={event => setPrescriptionInstructions(event.target.value)}
                    placeholder="General advice or follow-up instructions"
                    rows={3}
                    style={styles.formTextarea}
                  />
                </label>
              </div>

              <div style={styles.modalActions}>
                <div style={styles.templateSaveArea}>
                  {showTemplateSave ? (
                    <>
                      <input
                        value={templateName}
                        onChange={event => setTemplateName(event.target.value)}
                        placeholder='Template name, e.g. "Viral fever"'
                        maxLength={80}
                        style={{ ...styles.formInput, maxWidth: 220 }}
                        aria-label="Template name"
                      />
                      <button
                        type="button"
                        onClick={saveAsTemplate}
                        disabled={savingTemplate}
                        style={styles.addMedicineButton}
                      >
                        {savingTemplate ? 'Saving…' : 'Save template'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTemplateSave(false)}
                        style={styles.removeMedicineButton}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTemplateSave(true)}
                      style={styles.removeTemplateLink}
                    >
                      ☆ Save as template
                    </button>
                  )}

                  {!showTemplateSave && templates.length > 0 && (
                    <details style={styles.templateManage}>
                      <summary>Manage templates</summary>
                      {templates.map(template => (
                        <div key={template.id} style={styles.templateRow}>
                          <span>{template.name}</span>
                          <button
                            type="button"
                            onClick={() => deleteTemplate(template)}
                            style={styles.removeMedicineButton}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </details>
                  )}
                </div>

                <button
                  type="button"
                  onClick={closePrescription}
                  disabled={prescriptionSaving}
                  style={styles.cancelPrescriptionButton}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={prescriptionSaving}
                  style={{
                    ...styles.savePrescriptionButton,
                    ...(prescriptionSaving ? styles.disabledButton : {})
                  }}
                >
                  {prescriptionSaving
                    ? 'Saving...'
                    : editingPrescription ? 'Update Prescription' : 'Save Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ArrivalBadge({ appointment }) {
  if (appointment.arrivalStatus === 'ARRIVED') {
    return (
      <div style={{ ...styles.arrivalBadge, ...styles.arrivalHere }}>
        📍 Here
        {appointment.checkedInAt && ` since ${new Date(appointment.checkedInAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`}
      </div>
    )
  }

  if (appointment.arrivalStatus === 'LATE') {
    return (
      <div style={{ ...styles.arrivalBadge, ...styles.arrivalLate }}>
        ⏱ ~{appointment.lateMinutes} min late
      </div>
    )
  }

  return (
    <div style={{ ...styles.arrivalBadge, ...styles.arrivalUnknown }}>
      Not checked in
    </div>
  )
}

function HistoryVisit({ visit, onWrite, onPatientHistory }) {
  return (
    <div style={styles.historyBlock}>
      <div style={styles.reviewTop}>
        <div style={styles.patientCell}>
          <div style={styles.smallAvatar}>
            {visit.patientName?.charAt(0)?.toUpperCase() || 'P'}
          </div>
          <div>
            <div style={styles.tablePatientName}>{visit.patientName}</div>
            <div style={styles.tableEmail}>
              {formatDate(visit.appointmentDate)} · {formatTime(visit.appointmentTime)} · Token #{visit.tokenNumber}
              {visit.consultationMinutes ? ` · ${visit.consultationMinutes} min consultation` : ''}
              {visit.walkIn ? ' · walk-in' : ''}
              {visit.autoClosed ? ' · closed automatically (never finished)' : ''}
            </div>
          </div>
        </div>

        <div style={styles.actionGroup}>
          {visit.rating && <StarRating value={visit.rating.stars} size={14} />}
          <StatusBadge status={visit.status} />
          <button type="button" onClick={onPatientHistory} style={styles.actionSecondary}>
            All visits
          </button>
          {visit.status === 'COMPLETED' && (
            <button type="button" onClick={onWrite} style={styles.actionPrimary}>
              {visit.prescription ? 'Edit ℞' : '+ Prescription'}
            </button>
          )}
        </div>
      </div>

      {visit.prescription && <PrescriptionCard prescription={visit.prescription} showDoctor={false} />}

      {visit.rating?.comment && (
        <p style={styles.reviewComment}>“{visit.rating.comment}”</p>
      )}
    </div>
  )
}

function StatCard({ title, value, icon, description }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTop}>
        <div>
          <div style={styles.statTitle}>{title}</div>
          <div style={styles.statValue}>{value}</div>
        </div>
        <div style={styles.statIcon}>{icon}</div>
      </div>
      <div style={styles.statDescription}>{description}</div>
    </div>
  )
}


const styles = {
  page: {
    minHeight: '100vh',
    background: '#f6f8fb',
    color: '#172033',
    display: 'flex',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  sidebar: {
    width: 250,
    flexShrink: 0,
    background: '#fff',
    borderRight: '1px solid #e7ebf1',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh'
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '26px 22px',
    borderBottom: '1px solid #eef1f5'
  },
  logoIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    background: 'var(--mq-primary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700
  },
  logoText: { fontSize: 19, fontWeight: 800, color: '#123c3a' },
  logoSubtext: { fontSize: 12, color: '#7b8794', marginTop: 2 },
  doctorCard: {
    margin: 18,
    padding: 14,
    background: '#f4f8f8',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 11
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    background: '#d9efed',
    color: 'var(--mq-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800
  },
  doctorName: { fontSize: 13, fontWeight: 700, color: '#1f2937' },
  specialization: { fontSize: 12, color: '#7b8794', marginTop: 3 },
  nav: { padding: '8px 12px' },
  navTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: '#9aa4b2',
    letterSpacing: 1,
    padding: '10px 12px'
  },
  navItem: {
    padding: '12px 13px',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: '#657182',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 4
  },
  navItemActive: { background: '#e9f6f4', color: 'var(--mq-primary)' },
  navButton: {
    width: '100%',
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit'
  },
  navCount: {
    marginLeft: 'auto',
    background: '#f97316',
    color: '#fff',
    borderRadius: 999,
    fontSize: 12,
    padding: '2px 7px'
  },
  timer: { color: 'var(--mq-primary)', fontVariantNumeric: 'tabular-nums' },
  walkInButton: {
    border: '1px solid var(--mq-primary)',
    background: '#fff',
    color: 'var(--mq-primary)',
    padding: '11px 15px',
    borderRadius: 10,
    fontWeight: 700,
    cursor: 'pointer'
  },
  walkInTag: {
    marginLeft: 6,
    background: '#f5f3ff',
    color: '#6d28d9',
    borderRadius: 999,
    padding: '2px 7px',
    fontSize: 12,
    fontWeight: 700,
    verticalAlign: 'middle'
  },
  lastVisit: {
    marginTop: 12,
    background: '#ffffff',
    border: '1px solid #ccebe6',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12,
    color: '#334155',
    lineHeight: 1.6,
    maxWidth: 560
  },
  lastVisitTitle: { fontWeight: 800, color: 'var(--mq-primary)', marginBottom: 2 },
  arrivalBadge: {
    marginTop: 5,
    display: 'inline-flex',
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 12,
    fontWeight: 700
  },
  arrivalHere: { background: '#ecfdf5', color: '#047857' },
  arrivalLate: { background: '#fff7ed', color: '#c2410c' },
  arrivalUnknown: { background: '#f1f5f9', color: '#64748b' },
  quickFill: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14
  },
  quickFillButton: {
    border: '1px solid #b7e2dc',
    background: '#effaf8',
    color: 'var(--mq-primary)',
    padding: '8px 12px',
    borderRadius: 9,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 800
  },
  quickFillHint: { fontSize: 12, fontWeight: 500, color: '#64748b' },
  templateSelect: {
    border: '1px solid #dbe3ea',
    borderRadius: 9,
    padding: '8px 10px',
    fontSize: 12,
    fontFamily: 'inherit',
    background: '#fff',
    color: '#172033'
  },
  templateSaveArea: {
    marginRight: 'auto',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8
  },
  removeTemplateLink: {
    border: 0,
    background: 'transparent',
    color: 'var(--mq-primary)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0
  },
  templateManage: { fontSize: 12, color: '#64748b' },
  templateRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    padding: '3px 0',
    color: '#334155'
  },
  timerLate: {
    color: '#c2410c',
    background: '#fff7ed',
    borderRadius: 6,
    padding: '1px 6px',
    fontVariantNumeric: 'tabular-nums'
  },
  timerLateNote: { color: '#c2410c', fontWeight: 600 },
  pendingBanner: {
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    color: '#9a3412',
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    fontSize: 13
  },
  historyBlock: {
    padding: '16px 18px',
    borderBottom: '1px solid #f0f2f5'
  },
  reviewRow: {
    display: 'flex',
    gap: 12,
    padding: '16px 18px',
    borderBottom: '1px solid #f0f2f5'
  },
  reviewTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap'
  },
  reviewComment: { margin: '8px 0 0', color: '#455264', fontSize: 13 },
  ratingHero: {
    background: '#fff',
    border: '1px solid #e6ebf1',
    borderRadius: 15,
    padding: 20,
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 18
  },
  ratingBig: { fontSize: 42, fontWeight: 800, color: '#172033' },
  sidebarBottom: {
    marginTop: 'auto',
    padding: 18,
    borderTop: '1px solid #eef1f5'
  },
  logoutButton: {
    width: '100%',
    border: 0,
    background: 'transparent',
    color: '#7b8794',
    padding: 11,
    borderRadius: 9,
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 13
  },
  main: { flex: 1, minWidth: 0, padding: '30px 38px 40px' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 20,
    marginBottom: 26,
    flexWrap: 'wrap'
  },
  breadcrumb: { color: '#8a95a5', fontSize: 12, marginBottom: 9 },
  heading: { margin: 0, fontSize: 28, fontWeight: 800, color: '#182230' },
  subtitle: { margin: '7px 0 0', color: '#7a8696', fontSize: 14 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  liveBadge: {
    background: '#ecfdf5',
    color: '#047857',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 7
  },
  liveDot: { width: 7, height: 7, borderRadius: '50%', background: '#10b981' },
  dateBadge: {
    background: '#fff',
    border: '1px solid #e4e9ef',
    borderRadius: 9,
    padding: '8px 12px',
    fontSize: 12,
    color: '#536172',
    fontWeight: 600
  },
  dateSection: {
    background: '#fff',
    border: '1px solid #e6ebf1',
    borderRadius: 15,
    padding: '16px 19px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    marginBottom: 18,
    flexWrap: 'wrap'
  },
  sectionLabel: { fontSize: 12, color: '#8a95a5', fontWeight: 800, letterSpacing: 1 },
  dateDescription: { marginTop: 4, color: '#657182', fontSize: 12 },
  dateControls: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  todayButton: {
    border: '1px solid #dbe3ea',
    background: '#fff',
    color: '#526070',
    borderRadius: 9,
    padding: '9px 13px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  todayButtonActive: { background: 'var(--mq-primary)', color: '#fff', borderColor: 'var(--mq-primary)' },
  dateInput: {
    border: '1px solid #dbe3ea',
    borderRadius: 9,
    padding: '8px 10px',
    color: '#334155',
    background: '#fff',
    fontFamily: 'inherit'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 15,
    marginBottom: 20
  },
  statCard: { background: '#fff', border: '1px solid #e6ebf1', borderRadius: 15, padding: 18 },
  statTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  statTitle: { color: '#7d8897', fontSize: 12, fontWeight: 600 },
  statValue: { marginTop: 6, fontSize: 27, fontWeight: 800, color: '#172033' },
  statIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    background: '#edf7f6',
    color: 'var(--mq-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800
  },
  statDescription: { marginTop: 11, color: '#9aa4b2', fontSize: 12 },
  consultationCard: {
    background: '#effaf8',
    border: '1px solid #ccebe6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 22,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap'
  },
  consultationLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--mq-primary)',
    letterSpacing: 1,
    marginBottom: 11
  },
  currentPatientRow: { display: 'flex', alignItems: 'center', gap: 14 },
  bigToken: {
    width: 58,
    height: 58,
    flexShrink: 0,
    borderRadius: 14,
    background: 'var(--mq-primary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 800
  },
  patientName: { margin: 0, fontSize: 18, fontWeight: 800 },
  patientDetails: { margin: '4px 0 0', color: '#657182', fontSize: 12 },
  completeButton: {
    border: 0,
    background: 'var(--mq-primary)',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 700
  },
  queueHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
    marginBottom: 13,
    flexWrap: 'wrap'
  },
  sectionHeading: { margin: 0, fontSize: 18, fontWeight: 800 },
  sectionSubheading: { margin: '5px 0 0', color: '#8a95a5', fontSize: 12 },
  callNextButton: {
    border: 0,
    background: 'var(--mq-primary)',
    color: '#fff',
    padding: '11px 17px',
    borderRadius: 10,
    fontWeight: 700,
    cursor: 'pointer'
  },
  disabledButton: { opacity: 0.45, cursor: 'not-allowed' },
  tableCard: {
    background: '#fff',
    border: '1px solid #e6ebf1',
    borderRadius: 15,
    overflow: 'hidden'
  },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '13px 17px',
    fontSize: 12,
    color: '#8a95a5',
    letterSpacing: 0.8,
    borderBottom: '1px solid #eef1f5',
    background: '#fafbfc',
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '15px 17px',
    borderBottom: '1px solid #f0f2f5',
    fontSize: 13,
    color: '#455264',
    verticalAlign: 'middle'
  },
  tokenBadge: {
    display: 'inline-flex',
    padding: '7px 9px',
    borderRadius: 8,
    background: '#f0f7f6',
    color: 'var(--mq-primary)',
    fontWeight: 800,
    fontSize: 12
  },
  patientCell: { display: 'flex', alignItems: 'center', gap: 10 },
  smallAvatar: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: '50%',
    background: '#edf1f5',
    color: '#566273',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 12
  },
  tablePatientName: { fontWeight: 700, color: '#273244' },
  tableEmail: { color: '#9aa4b2', fontSize: 12, marginTop: 2 },
  statusBadge: {
    display: 'inline-flex',
    borderRadius: 999,
    padding: '6px 9px',
    fontSize: 12,
    fontWeight: 800
  },
  actionGroup: { display: 'flex', gap: 7 },
  actionPrimary: {
    border: 0,
    background: 'var(--mq-primary)',
    color: '#fff',
    padding: '7px 11px',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700
  },
  actionSecondary: {
    border: '1px solid #e2e7ed',
    background: '#fff',
    color: '#687586',
    padding: '7px 11px',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700
  },
  actionComplete: {
    border: 0,
    background: '#047857',
    color: '#fff',
    padding: '7px 11px',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700
  },
  prescriptionButton: {
    border: 0,
    background: 'var(--mq-primary)',
    color: '#fff',
    padding: '8px 11px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap'
  },
  prescriptionSavedBadge: {
    display: 'inline-flex',
    border: 0,
    cursor: 'pointer',
    background: '#ecfdf5',
    color: '#047857',
    padding: '7px 9px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap'
  },
  muted: { color: '#9aa4b2', fontSize: 12 },
  emptyState: { padding: '55px 20px', textAlign: 'center', color: '#8994a3' },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: '50%',
    background: '#ecfdf5',
    color: '#059669',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
    fontSize: 22,
    fontWeight: 800
  },
  error: {
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    borderRadius: 10,
    padding: '11px 14px',
    marginBottom: 16,
    fontSize: 13
  },
  success: {
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #bbf7d0',
    borderRadius: 10,
    padding: '11px 14px',
    marginBottom: 16,
    fontSize: 13
  },
  footerInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 20,
    flexWrap: 'wrap',
    marginTop: 14,
    color: '#9aa4b2',
    fontSize: 12
  },
  centerPage: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f6f8fb',
    color: '#687586',
    padding: 20
  },
  spinner: {
    width: 30,
    height: 30,
    border: '3px solid #dbe5e4',
    borderTop: '3px solid var(--mq-primary)',
    borderRadius: '50%'
  },
  errorCard: {
    background: '#fff',
    border: '1px solid #e6ebf1',
    borderRadius: 16,
    padding: 30,
    maxWidth: 500,
    textAlign: 'center'
  },
  primaryButton: {
    border: 0,
    background: 'var(--mq-primary)',
    color: '#fff',
    padding: '11px 18px',
    borderRadius: 9,
    cursor: 'pointer',
    fontWeight: 700
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.58)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 1000,
    overflowY: 'auto'
  },
  prescriptionModal: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '92vh',
    overflowY: 'auto',
    background: '#fff',
    borderRadius: 18,
    padding: 26,
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.25)',
    boxSizing: 'border-box'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    paddingBottom: 18,
    marginBottom: 18,
    borderBottom: '1px solid #eef1f5'
  },
  modalEyebrow: {
    color: 'var(--mq-primary)',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.2,
    marginBottom: 7
  },
  modalTitle: { margin: 0, color: '#172033', fontSize: 23, fontWeight: 800 },
  modalSubtitle: { margin: '7px 0 0', color: '#7b8794', fontSize: 12 },
  modalCloseButton: {
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#64748b',
    width: 34,
    height: 34,
    borderRadius: 9,
    cursor: 'pointer',
    fontSize: 24,
    lineHeight: 1
  },
  formLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    color: '#334155',
    fontSize: 12,
    fontWeight: 700,
    minWidth: 0
  },
  requiredMark: { color: '#dc2626' },
  formInput: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    border: '1px solid #dbe3ea',
    background: '#fff',
    color: '#172033',
    borderRadius: 9,
    padding: '10px 11px',
    fontFamily: 'inherit',
    fontSize: 12
  },
  formTextarea: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    border: '1px solid #dbe3ea',
    background: '#fff',
    color: '#172033',
    borderRadius: 9,
    padding: '10px 11px',
    fontFamily: 'inherit',
    fontSize: 12,
    resize: 'vertical'
  },
  medicineSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    margin: '22px 0 12px',
    flexWrap: 'wrap'
  },
  medicineSectionTitle: { margin: 0, fontSize: 15, fontWeight: 800, color: '#172033' },
  medicineSectionHint: { margin: '4px 0 0', fontSize: 12, color: '#8a95a5' },
  addMedicineButton: {
    border: '1px solid #b7e2dc',
    background: '#effaf8',
    color: 'var(--mq-primary)',
    padding: '9px 12px',
    borderRadius: 9,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 800
  },
  medicineCard: {
    border: '1px solid #e6ebf1',
    background: '#fbfcfd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12
  },
  medicineCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    fontSize: 12,
    color: '#334155'
  },
  removeMedicineButton: {
    border: 0,
    background: 'transparent',
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer'
  },
  medicineGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12
  },
  medicineInstructionsField: { gridColumn: '1 / -1' },
  modalBottomGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)',
    gap: 14,
    marginTop: 18
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 20,
    marginTop: 20,
    borderTop: '1px solid #eef1f5'
  },
  cancelPrescriptionButton: {
    border: '1px solid #dbe3ea',
    background: '#fff',
    color: '#526070',
    padding: '11px 15px',
    borderRadius: 9,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12
  },
  savePrescriptionButton: {
    border: 0,
    background: 'var(--mq-primary)',
    color: '#fff',
    padding: '11px 16px',
    borderRadius: 9,
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 12
  },
  prescriptionError: {
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    borderRadius: 9,
    padding: '10px 12px',
    marginBottom: 14,
    fontSize: 12
  }
}

export default DoctorDashboard
