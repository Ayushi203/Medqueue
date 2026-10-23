import { useEffect, useMemo, useState } from 'react'
import { apiFetch, API_URL } from './api.js'

const WEEK_DAYS = [
  { value: 'MON', label: 'Mon' },
  { value: 'TUE', label: 'Tue' },
  { value: 'WED', label: 'Wed' },
  { value: 'THU', label: 'Thu' },
  { value: 'FRI', label: 'Fri' },
  { value: 'SAT', label: 'Sat' },
  { value: 'SUN', label: 'Sun' }
]

const CONSULTATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60]

const toMinutes = (time) => {
  const [hours, minutes] = (time || '0:0').split(':').map(Number)
  return hours * 60 + minutes
}

const toLabel = (time) => {
  if (!time) return '—'
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

// Same rule as the backend: an end at or before the start runs past midnight
const isOvernight = (start, end) => toMinutes(end) <= toMinutes(start)

const endMinutes = (start, end) =>
  isOvernight(start, end) ? toMinutes(end) + 24 * 60 : toMinutes(end)

// Slots one consultation apart; the last one ends by closing time
const countSlots = (start, end, length) => {
  const span = endMinutes(start, end) - toMinutes(start)
  return length > 0 && span > 0 ? Math.floor(span / length) : 0
}

const fromMinutes = (minutes) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

// "10:00-14:00" -> ['10:00', '14:00']
const splitHours = (value) => {
  const parts = (value || '').split(/\s*[-–—]\s*/)
  const pad = (time) => (time && time.length === 4 ? `0${time}` : time)
  return parts.length === 2 ? [pad(parts[0]), pad(parts[1])] : ['10:00', '14:00']
}

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const values = new Uint32Array(10)
  crypto.getRandomValues(values)
  return 'Dr-' + Array.from(values, (value) => chars[value % chars.length]).join('')
}

function AdminDashboard() {

  const userData = localStorage.getItem('user')
  const user = userData ? JSON.parse(userData) : null

  const getToken = () => {
    return localStorage.getItem('token') || user?.token || ''
  }

  const [activeMenu, setActiveMenu] = useState('Dashboard')

  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [appointments, setAppointments] = useState([])
  const [stats, setStats] = useState(null)

  const [loadingDoctors, setLoadingDoctors] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)

  const [search, setSearch] = useState('')

  const [showAddDoctor, setShowAddDoctor] = useState(false)
  const [addingDoctor, setAddingDoctor] = useState(false)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [doctorName, setDoctorName] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [doctorPhone, setDoctorPhone] = useState('')
  const [doctorEmail, setDoctorEmail] = useState('')
  const [doctorPassword, setDoctorPassword] = useState('')
  const [consultationTime, setConsultationTime] = useState(15)
  const [workingDays, setWorkingDays] =
    useState(['MON', 'TUE', 'WED', 'THU', 'FRI'])
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('14:00')
  const [showPassword, setShowPassword] = useState(false)

  // Doctor being edited (null = adding a new one)
  const [editingDoctor, setEditingDoctor] = useState(null)
  const [doctorActionId, setDoctorActionId] = useState(null)

  const slotCount =
    countSlots(startTime, endTime, Number(consultationTime))

  const scheduleError =
    workingDays.length === 0
      ? 'Select at least one working day.'
      : startTime === endTime && startTime !== '00:00'
        ? 'Start and end time cannot be the same.'
        : slotCount === 0
          ? 'Working hours are shorter than one consultation.'
          : ''

  const toggleDay = (day) => {
    setWorkingDays((previous) =>
      previous.includes(day)
        ? previous.filter((item) => item !== day)
        : WEEK_DAYS.map((item) => item.value)
            .filter((item) => item === day || previous.includes(item))
    )
  }


  useEffect(() => {
    loadDoctors()
    loadStats()
  }, [])


  const loadDoctors = async () => {

    setLoadingDoctors(true)

    try {

      const response = await apiFetch(
        '/api/doctors?includeInactive=true',
        {
          headers: {
            Authorization: `Bearer ${getToken()}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Unable to load doctors')
      }

      const data = await response.json()

      setDoctors(data)

    } catch (err) {

      console.error(err)

      setError(
        'Unable to load doctors. Make sure the backend is running.'
      )

    } finally {

      setLoadingDoctors(false)

    }
  }


  const loadStats = async () => {

    setLoadingStats(true)

    try {

      const token = getToken()

      const response = await apiFetch(
        '/api/admin/statistics',
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Unable to load statistics')
      }

      const data = await response.json()

      setStats(data)

    } catch (err) {

      console.error(err)

    } finally {

      setLoadingStats(false)

    }
  }


  const loadPatients = async () => {

    /*
     * Patient endpoint is not available in the current backend.
     *
     * We intentionally do not make a fake API request.
     *
     * Patients will be connected after the patient-admin
     * backend endpoint is added.
     */

    setPatients([])
  }


  const loadAppointments = async () => {

    /*
     * Appointment-admin endpoint is not available yet.
     *
     * We intentionally keep this empty instead of making
     * an invalid API request.
     */

    setAppointments([])
  }


  const navigate = (menu) => {

    setActiveMenu(menu)

    setMessage('')
    setError('')

    if (menu === 'Patients') {
      loadPatients()
    }

    if (menu === 'Appointments') {
      loadAppointments()
    }

  }


  const refreshDashboard = async () => {

    setMessage('')
    setError('')

    await loadDoctors()
    await loadStats()

    if (activeMenu === 'Patients') {
      await loadPatients()
    }

    if (activeMenu === 'Appointments') {
      await loadAppointments()
    }

    setMessage('Dashboard refreshed successfully.')
  }


  const resetDoctorForm = () => {

    setDoctorName('')
    setSpecialization('')
    setDoctorPhone('')
    setDoctorEmail('')
    setDoctorPassword('')
    setConsultationTime(15)
    setWorkingDays(['MON', 'TUE', 'WED', 'THU', 'FRI'])
    setStartTime('10:00')
    setEndTime('14:00')
    setShowPassword(false)
    setEditingDoctor(null)

  }


  const addDoctor = async (e) => {

    e.preventDefault()

    setMessage('')
    setError('')

    if (scheduleError) {
      setError(scheduleError)
      return
    }

    setAddingDoctor(true)

    const isEdit = Boolean(editingDoctor)

    try {

      const token = getToken()

      const response = await apiFetch(
        isEdit
          ? `/api/doctors/${editingDoctor.id}`
          : '/api/doctors',
        {
          method: isEdit ? 'PUT' : 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },

          body: JSON.stringify({
            name: doctorName.trim(),
            email: doctorEmail.trim(),
            // When editing, an empty password keeps the current one
            password: doctorPassword,
            phone: doctorPhone.trim(),
            specialization: specialization.trim(),
            consultationTime: Number(consultationTime),
            availableDays: workingDays.join(','),
            availableTime: `${startTime}-${endTime}`
          })
        }
      )

      const text = await response.text()

      if (!response.ok) {

        let errorMessage = 'Unable to create doctor.'

        try {

          const data = JSON.parse(text)

          if (data.message) {
            errorMessage = data.message
          }

        } catch {
          // not JSON
        }

        throw new Error(errorMessage)
      }

      resetDoctorForm()

      setShowAddDoctor(false)

      setMessage(
        isEdit
          ? `${doctorName.trim()} updated successfully.`
          : 'Doctor account created successfully.'
      )

      await loadDoctors()
      await loadStats()

    } catch (err) {

      console.error(err)

      setError(
        err.message ||
        (isEdit ? 'Unable to update doctor.' : 'Unable to create doctor.')
      )

    } finally {

      setAddingDoctor(false)

    }
  }


  // Deactivate keeps history, prescriptions and ratings; the doctor just
  // can't log in or be booked until reactivated
  const toggleDoctorActive = async (doctor) => {

    const deactivating = doctor.active !== false

    if (deactivating) {

      const confirmed = window.confirm(
        `Deactivate ${doctor.name}?\n\nThey will not be able to log in and patients will not be able to book them. Their history is kept and you can reactivate them at any time.`
      )

      if (!confirmed) {
        return
      }
    }

    setMessage('')
    setError('')
    setDoctorActionId(doctor.id)

    try {

      const token = getToken()

      const response = await apiFetch(
        `/api/doctors/${doctor.id}/${deactivating ? 'deactivate' : 'activate'}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      const text = await response.text()

      if (!response.ok) {

        let errorMessage = 'Unable to update doctor status.'

        try {

          const data = JSON.parse(text)

          if (data.message) {
            errorMessage = data.message
          }

        } catch {
          // not JSON
        }

        throw new Error(errorMessage)
      }

      setMessage(
        `${doctor.name} ${deactivating ? 'deactivated' : 'reactivated'}.`
      )

      await loadDoctors()
      await loadStats()

    } catch (err) {

      console.error(err)

      setError(
        err.message ||
        'Unable to update doctor status.'
      )

    } finally {

      setDoctorActionId(null)

    }
  }


  const filteredDoctors = useMemo(() => {

    const value = search.trim().toLowerCase()

    if (!value) {
      return doctors
    }

    return doctors.filter((doctor) => {

      return (
        doctor.name?.toLowerCase().includes(value) ||
        doctor.specialization
          ?.toLowerCase()
          .includes(value) ||
        doctor.email
          ?.toLowerCase()
          .includes(value)
      )

    })

  }, [doctors, search])


  const logout = () => {

    localStorage.removeItem('token')
    localStorage.removeItem('user')

    window.location.reload()

  }


  const openAddDoctor = () => {

    setMessage('')
    setError('')
    resetDoctorForm()
    setDoctorPassword(generatePassword())
    setShowPassword(true)
    setShowAddDoctor(true)

  }


  const openEditDoctor = (doctor) => {

    const [start, end] = splitHours(doctor.availableTime)

    setMessage('')
    setError('')
    setEditingDoctor(doctor)
    setDoctorName(doctor.name || '')
    setSpecialization(doctor.specialization || '')
    setDoctorPhone(doctor.phone || '')
    setDoctorEmail(doctor.email || '')
    setDoctorPassword('')
    setShowPassword(false)
    setConsultationTime(doctor.consultationTime || 15)
    setWorkingDays(
      (doctor.availableDays || '')
        .toUpperCase()
        .split(',')
        .map((day) => day.trim().slice(0, 3))
        .filter((day) => WEEK_DAYS.some((item) => item.value === day))
    )
    setStartTime(start)
    setEndTime(end)
    setShowAddDoctor(true)

  }


  // Existing specializations, offered as suggestions to keep them consistent
  const specializationOptions = useMemo(
    () => [...new Set(doctors.map((doctor) => doctor.specialization).filter(Boolean))].sort(),
    [doctors]
  )


  const statCards = [

    {
      label: 'Total Doctors',
      value: stats?.totalDoctors ?? doctors.length,
      icon: 'DR',
      className: 'teal'
    },

    {
      label: 'Total Patients',
      value: stats?.totalPatients ?? 0,
      icon: 'PT',
      className: 'blue'
    },

    {
      label: 'Appointments',
      value: stats?.totalAppointments ?? 0,
      icon: 'AP',
      className: 'purple'
    },

    {
      label: 'Completed',
      value: stats?.completedAppointments ?? 0,
      icon: '✓',
      className: 'green'
    }

  ]


  return (

    <div className="mq-admin-page">


      {/* ================= SIDEBAR ================= */}

      <aside className="mq-sidebar">


        <div className="mq-sidebar-brand">

          <div className="mq-sidebar-logo">
            +
          </div>

          <div>

            <strong>
              MedQueue
            </strong>

            <span>
              ADMIN CONSOLE
            </span>

          </div>

        </div>


        <div className="mq-nav">


          <div className="mq-nav-title">
            MAIN
          </div>


          <button
            type="button"
            className={
              activeMenu === 'Dashboard'
                ? 'mq-nav-item active'
                : 'mq-nav-item'
            }
            onClick={() => navigate('Dashboard')}
          >

            <span className="mq-nav-icon">
              ▦
            </span>

            <span>
              Dashboard
            </span>

          </button>


          <button
            type="button"
            className={
              activeMenu === 'Doctors'
                ? 'mq-nav-item active'
                : 'mq-nav-item'
            }
            onClick={() => navigate('Doctors')}
          >

            <span className="mq-nav-icon">
              +
            </span>

            <span>
              Doctors
            </span>

            <b>
              {doctors.length}
            </b>

          </button>


          <button
            type="button"
            className={
              activeMenu === 'Patients'
                ? 'mq-nav-item active'
                : 'mq-nav-item'
            }
            onClick={() => navigate('Patients')}
          >

            <span className="mq-nav-icon">
              ◉
            </span>

            <span>
              Patients
            </span>

          </button>


          <button
            type="button"
            className={
              activeMenu === 'Appointments'
                ? 'mq-nav-item active'
                : 'mq-nav-item'
            }
            onClick={() => navigate('Appointments')}
          >

            <span className="mq-nav-icon">
              □
            </span>

            <span>
              Appointments
            </span>

          </button>



          <div className="mq-nav-title management">
            MANAGEMENT
          </div>


          <button
            type="button"
            className={
              activeMenu === 'Reports'
                ? 'mq-nav-item active'
                : 'mq-nav-item'
            }
            onClick={() => navigate('Reports')}
          >

            <span className="mq-nav-icon">
              ▤
            </span>

            <span>
              Reports
            </span>

          </button>


          <button
            type="button"
            className={
              activeMenu === 'Settings'
                ? 'mq-nav-item active'
                : 'mq-nav-item'
            }
            onClick={() => navigate('Settings')}
          >

            <span className="mq-nav-icon">
              ⚙
            </span>

            <span>
              Settings
            </span>

          </button>


        </div>


        <div className="mq-sidebar-bottom">

          <div className="mq-sidebar-user">

            <div className="mq-user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>

            <div>

              <strong>
                {user?.name || 'Administrator'}
              </strong>

              <span>
                Administrator
              </span>

            </div>

          </div>


          <button
            type="button"
            className="mq-signout"
            onClick={logout}
          >

            <span>
              ↪
            </span>

            Sign out

          </button>

        </div>

      </aside>



      {/* ================= MAIN ================= */}

      <main className="mq-main">


        {/* TOP BAR */}

        <header className="mq-topbar">

          <div>

            <span className="mq-top-label">
              ADMINISTRATION
            </span>

            <h1>
              {activeMenu}
            </h1>

          </div>


          <div className="mq-top-actions">

            <button
              type="button"
              className="mq-refresh"
              onClick={refreshDashboard}
              title="Refresh"
            >
              ↻
            </button>


            <div className="mq-top-separator"></div>


            <div className="mq-top-user">

              <div className="mq-user-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>

              <div>

                <strong>
                  {user?.name || 'Admin'}
                </strong>

                <span>
                  ADMIN
                </span>

              </div>

            </div>

          </div>

        </header>



        {/* CONTENT */}

        <div className="mq-content">


          {/* ALERT */}

          {message && (

            <div className="mq-alert success">

              <span>
                ✓
              </span>

              <p>
                {message}
              </p>

              <button
                type="button"
                onClick={() => setMessage('')}
              >
                ×
              </button>

            </div>

          )}


          {error && (

            <div className="mq-alert error">

              <span>
                !
              </span>

              <p>
                {error}
              </p>

              <button
                type="button"
                onClick={() => setError('')}
              >
                ×
              </button>

            </div>

          )}



          {/* ================= DASHBOARD ================= */}

          {activeMenu === 'Dashboard' && (

            <DashboardView
              user={user}
              stats={stats}
              doctors={doctors}
              statCards={statCards}
              loadingStats={loadingStats}
              openAddDoctor={openAddDoctor}
              navigate={navigate}
            />

          )}



          {/* ================= DOCTORS ================= */}

          {activeMenu === 'Doctors' && (

            <DoctorsView
              doctors={filteredDoctors}
              loading={loadingDoctors}
              search={search}
              setSearch={setSearch}
              openAddDoctor={openAddDoctor}
              openEditDoctor={openEditDoctor}
              toggleDoctorActive={toggleDoctorActive}
              doctorActionId={doctorActionId}
            />

          )}



          {/* ================= PATIENTS ================= */}

          {activeMenu === 'Patients' && (

            <PatientsView
              stats={stats}
            />

          )}



          {/* ================= APPOINTMENTS ================= */}

          {activeMenu === 'Appointments' && (

            <AppointmentsView
              stats={stats}
            />

          )}



          {/* ================= REPORTS ================= */}

          {activeMenu === 'Reports' && (

            <ReportsView
              stats={stats}
            />

          )}



          {/* ================= SETTINGS ================= */}

          {activeMenu === 'Settings' && (

            <SettingsView
              user={user}
            />

          )}

        </div>

      </main>



      {/* ================= ADD DOCTOR MODAL ================= */}

      {showAddDoctor && (

        <div
          className="mq-modal-overlay"
          onMouseDown={(e) => {

            if (
              e.target === e.currentTarget &&
              !addingDoctor
            ) {
              setShowAddDoctor(false)
            }

          }}
        >

          <div className="mq-modal">


            <div className="mq-modal-head">

              <div>

                <span>
                  CLINIC STAFF
                </span>

                <h2>
                  {editingDoctor ? `Edit ${editingDoctor.name}` : 'Add new doctor'}
                </h2>

                <p>
                  {editingDoctor
                    ? 'Changes apply to the profile and the login account.'
                    : 'Create the doctor profile and login account.'}
                </p>

              </div>


              <button
                type="button"
                className="mq-close"
                disabled={addingDoctor}
                onClick={() =>
                  setShowAddDoctor(false)
                }
              >
                ×
              </button>

            </div>


            <form
              onSubmit={addDoctor}
              className="mq-doctor-form"
            >

              <div className="mq-form-section">
                BASIC INFORMATION
              </div>


              <div className="mq-form-grid">


                <FormField
                  label="Doctor name"
                  value={doctorName}
                  onChange={setDoctorName}
                  placeholder="Dr. Priya Sharma"
                  required
                />


                <FormField
                  label="Specialization"
                  value={specialization}
                  onChange={setSpecialization}
                  placeholder="Pick or type, e.g. Cardiology"
                  list="mq-specialization-options"
                  required
                />

                <datalist id="mq-specialization-options">
                  {specializationOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>


                <FormField
                  label="Phone"
                  type="tel"
                  value={doctorPhone}
                  onChange={setDoctorPhone}
                  placeholder="10-digit mobile number"
                  pattern="\+?[0-9\s-]{10,15}"
                  title="10-digit phone number"
                />


                <FormField
                  label="Email"
                  type="email"
                  value={doctorEmail}
                  onChange={setDoctorEmail}
                  placeholder="doctor@clinic.com"
                  required
                />

              </div>


              <div className="mq-form-section second">
                LOGIN & AVAILABILITY
              </div>


              <div className="mq-form-grid">


                <div className="mq-field">

                  <label>
                    {editingDoctor ? 'Reset password (optional)' : 'Login password'}
                  </label>

                  <div className="mq-password-row">

                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={doctorPassword}
                      onChange={(e) => setDoctorPassword(e.target.value)}
                      placeholder={editingDoctor ? 'Leave blank to keep current' : 'At least 6 characters'}
                      required={!editingDoctor}
                      minLength={6}
                    />

                    <button
                      type="button"
                      className="mq-secondary-button small"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>

                    <button
                      type="button"
                      className="mq-secondary-button small"
                      onClick={() => {
                        setDoctorPassword(generatePassword())
                        setShowPassword(true)
                      }}
                    >
                      Generate
                    </button>

                  </div>

                  <small className="mq-field-hint">
                    {editingDoctor
                      ? 'Only fill this to give the doctor a new password.'
                      : 'Share this with the doctor securely.'}
                  </small>

                </div>


                <div className="mq-field">

                  <label>
                    Consultation time
                  </label>

                  <select
                    value={consultationTime}
                    onChange={(e) => setConsultationTime(Number(e.target.value))}
                    required
                  >
                    {CONSULTATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes per patient
                      </option>
                    ))}
                  </select>

                </div>

              </div>


              <div className="mq-field mq-field-full">

                <label>
                  Working days
                </label>

                <div className="mq-day-chips">

                  {WEEK_DAYS.map((day) => (

                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={workingDays.includes(day.value)}
                      className={
                        workingDays.includes(day.value)
                          ? 'mq-day-chip selected'
                          : 'mq-day-chip'
                      }
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </button>

                  ))}

                  <button
                    type="button"
                    className="mq-day-preset"
                    onClick={() => setWorkingDays(['MON', 'TUE', 'WED', 'THU', 'FRI'])}
                  >
                    Mon–Fri
                  </button>

                  <button
                    type="button"
                    className="mq-day-preset"
                    onClick={() => setWorkingDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'])}
                  >
                    Mon–Sat
                  </button>

                </div>

              </div>


              <div className="mq-form-grid">

                <div className="mq-field">

                  <label>
                    Start time
                  </label>

                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />

                </div>


                <div className="mq-field">

                  <label>
                    End time
                  </label>

                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />

                </div>

              </div>


              <div className={scheduleError ? 'mq-slot-preview error' : 'mq-slot-preview'}>

                {scheduleError ? (

                  <span>{scheduleError}</span>

                ) : (

                  <span>
                    <strong>
                      {WEEK_DAYS.filter((day) => workingDays.includes(day.value))
                        .map((day) => day.label)
                        .join(', ')}
                    </strong>
                    {' · '}
                    {toLabel(startTime)} – {toLabel(endTime)}
                    {isOvernight(startTime, endTime) && toMinutes(endTime) !== 0 && ' next day'}
                    {toMinutes(endTime) === 0 && ' (midnight)'}
                    {' · '}
                    {consultationTime} min each
                    {' → '}
                    <strong>{slotCount} slots per day</strong>
                    {' · last slot '}
                    {toLabel(fromMinutes(toMinutes(startTime) + (slotCount - 1) * Number(consultationTime)))}
                    {isOvernight(startTime, endTime) && toMinutes(endTime) !== 0 && (
                      <>
                        <br />
                        Night shift: slots after midnight belong to the selected
                        day's shift (e.g. Mon night runs into early Tue).
                      </>
                    )}
                  </span>

                )}

              </div>


              <div className="mq-form-info">

                <span>
                  ✓
                </span>

                <p>
                  The doctor's MedQueue login account
                  will be created automatically.
                </p>

              </div>


              <div className="mq-modal-footer">

                <button
                  type="button"
                  className="mq-secondary-button"
                  disabled={addingDoctor}
                  onClick={() =>
                    setShowAddDoctor(false)
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="mq-primary-button"
                  disabled={addingDoctor || Boolean(scheduleError)}
                >

                  {addingDoctor ? (
                    <>
                      <span className="mq-spinner"></span>
                      {editingDoctor ? 'Saving...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingDoctor ? 'Save changes' : 'Create doctor'}
                      <span>→</span>
                    </>
                  )}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}



      <style>{`

        * {
          box-sizing: border-box;
        }


        .mq-admin-page {
          min-height: 100vh;
          background: #f5f8fa;
          color: #20373c;
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }


        /* SIDEBAR */

        .mq-sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: 250px;
          background: #063b3f;
          color: white;
          z-index: 50;
          display: flex;
          flex-direction: column;
        }


        .mq-sidebar-brand {
          height: 88px;
          padding: 0 25px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom:
            1px solid rgba(255,255,255,0.08);
        }


        .mq-sidebar-logo {
          width: 39px;
          height: 39px;
          border-radius: 11px;
          background: white;
          color: var(--mq-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
          font-weight: 700;
        }


        .mq-sidebar-brand strong {
          display: block;
          font-size: 20px;
          letter-spacing: -0.5px;
        }


        .mq-sidebar-brand span {
          display: block;
          font-size: 12px;
          letter-spacing: 1.6px;
          opacity: 0.45;
          margin-top: 3px;
        }


        .mq-nav {
          padding: 28px 14px;
        }


        .mq-nav-title {
          padding: 0 12px 9px;
          font-size: 12px;
          letter-spacing: 1.5px;
          font-weight: 700;
          opacity: 0.38;
        }


        .mq-nav-title.management {
          margin-top: 27px;
        }


        .mq-nav-item {
          width: 100%;
          height: 45px;
          border: none;
          border-radius: 9px;
          background: transparent;
          color: rgba(255,255,255,0.58);
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 12px;
          margin-bottom: 4px;
          cursor: pointer;
          font-size: 12px;
          text-align: left;
          transition:
            background 0.2s,
            color 0.2s,
            transform 0.2s;
        }


        .mq-nav-item:hover {
          background: rgba(255,255,255,0.07);
          color: white;
          transform: translateX(2px);
        }


        .mq-nav-item.active {
          background: rgba(255,255,255,0.13);
          color: white;
          box-shadow:
            inset 3px 0 #58d5d2;
        }


        .mq-nav-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
        }


        .mq-nav-item b {
          margin-left: auto;
          min-width: 21px;
          height: 20px;
          padding: 0 5px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.09);
          font-size: 12px;
          font-weight: 500;
        }


        .mq-sidebar-bottom {
          margin-top: auto;
          padding: 18px;
          border-top:
            1px solid rgba(255,255,255,0.08);
        }


        .mq-sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 4px 15px;
        }


        .mq-user-avatar {
          width: 35px;
          height: 35px;
          border-radius: 10px;
          background: #d9eeee;
          color: var(--mq-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }


        .mq-sidebar-user strong {
          display: block;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
        }


        .mq-sidebar-user span {
          display: block;
          margin-top: 3px;
          font-size: 12px;
          opacity: 0.4;
        }


        .mq-signout {
          width: 100%;
          height: 36px;
          border: none;
          border-radius: 8px;
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.55);
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }


        .mq-signout:hover {
          background: rgba(255,255,255,0.1);
          color: white;
        }



        /* MAIN */

        .mq-main {
          margin-left: 250px;
          min-height: 100vh;
        }


        .mq-topbar {
          height: 88px;
          background: white;
          border-bottom: 1px solid #e6edef;
          padding: 0 42px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }


        .mq-top-label {
          color: var(--mq-primary);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.7px;
        }


        .mq-topbar h1 {
          margin: 5px 0 0;
          color: #20373c;
          font-size: 24px;
          letter-spacing: -0.7px;
        }


        .mq-top-actions {
          display: flex;
          align-items: center;
          gap: 15px;
        }


        .mq-refresh {
          width: 37px;
          height: 37px;
          border: 1px solid #dfe8e9;
          border-radius: 9px;
          background: white;
          color: #62767a;
          cursor: pointer;
          font-size: 18px;
        }


        .mq-refresh:hover {
          border-color: var(--mq-primary);
          color: var(--mq-primary);
          transform: rotate(30deg);
        }


        .mq-top-separator {
          width: 1px;
          height: 31px;
          background: #e5ebed;
        }


        .mq-top-user {
          display: flex;
          align-items: center;
          gap: 9px;
        }


        .mq-top-user strong {
          display: block;
          font-size: 12px;
        }


        .mq-top-user span {
          display: block;
          font-size: 12px;
          color: #9aa7aa;
          letter-spacing: 1px;
          margin-top: 3px;
        }



        /* CONTENT */

        .mq-content {
          padding: 35px 42px 50px;
          max-width: 1600px;
        }


        .mq-alert {
          min-height: 43px;
          border-radius: 9px;
          padding: 9px 12px;
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 20px;
          font-size: 12px;
        }


        .mq-alert.success {
          background: #edf9f5;
          color: #16735f;
          border: 1px solid #d0eee4;
        }


        .mq-alert.error {
          background: #fff2f2;
          color: #b42318;
          border: 1px solid #ffd8d8;
        }


        .mq-alert > span {
          width: 21px;
          height: 21px;
          border-radius: 50%;
          background: currentColor;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }


        .mq-alert p {
          margin: 0;
        }


        .mq-alert button {
          margin-left: auto;
          border: none;
          background: transparent;
          color: currentColor;
          font-size: 18px;
          cursor: pointer;
        }



        /* COMMON */

        .mq-page-intro {
          margin-bottom: 25px;
        }


        .mq-page-intro span {
          color: var(--mq-primary);
          font-size: 12px;
          letter-spacing: 1.5px;
          font-weight: 700;
        }


        .mq-page-intro h2 {
          margin: 7px 0 5px;
          font-size: 24px;
          letter-spacing: -0.7px;
        }


        .mq-page-intro p {
          margin: 0;
          color: #829195;
          font-size: 12px;
        }



        /* DASHBOARD */

        .mq-welcome {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 27px;
        }


        .mq-welcome h2 {
          margin: 7px 0;
          font-size: 25px;
          letter-spacing: -0.8px;
        }


        .mq-welcome p {
          margin: 0;
          color: #829195;
          font-size: 12px;
        }


        .mq-primary-button {
          height: 43px;
          border: none;
          border-radius: 9px;
          background: var(--mq-primary);
          color: white;
          padding: 0 16px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          box-shadow:
            0 7px 18px rgba(8,116,122,0.17);
        }


        .mq-primary-button:hover:not(:disabled) {
          background: #066166;
          transform: translateY(-1px);
        }


        .mq-primary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }


        .mq-stat-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }


        .mq-stat {
          background: white;
          border: 1px solid #e5edef;
          border-radius: 13px;
          padding: 19px;
          min-height: 140px;
        }


        .mq-stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }


        .mq-stat-icon {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
        }


        .mq-stat-icon.teal {
          background: #e7f7f6;
          color: var(--mq-primary);
        }


        .mq-stat-icon.blue {
          background: #edf3fb;
          color: #386ba5;
        }


        .mq-stat-icon.purple {
          background: #f2eef9;
          color: #7957a8;
        }


        .mq-stat-icon.green {
          background: #eaf7ef;
          color: #2c8a5d;
          font-size: 16px;
        }


        .mq-stat-number {
          margin-top: 17px;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -1px;
        }


        .mq-stat-label {
          color: #849296;
          font-size: 12px;
          margin-top: 2px;
        }


        .mq-dashboard-panels {
          display: grid;
          grid-template-columns:
            minmax(0, 1.8fr)
            minmax(280px, 0.75fr);
          gap: 20px;
        }


        .mq-card {
          background: white;
          border: 1px solid #e5edef;
          border-radius: 13px;
          overflow: hidden;
        }


        .mq-card-header {
          min-height: 73px;
          padding: 17px 20px;
          border-bottom: 1px solid #edf1f2;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }


        .mq-card-header span {
          color: var(--mq-primary);
          font-size: 12px;
          letter-spacing: 1.5px;
          font-weight: 700;
        }


        .mq-card-header h3 {
          margin: 4px 0 0;
          font-size: 17px;
        }


        .mq-link-button {
          border: none;
          background: transparent;
          color: var(--mq-primary);
          font-size: 12px;
          cursor: pointer;
          font-weight: 600;
        }


        .mq-mini-doctor-list {
          padding: 5px 20px;
        }


        .mq-mini-doctor {
          min-height: 59px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid #f0f3f4;
        }


        .mq-mini-doctor:last-child {
          border-bottom: none;
        }


        .mq-mini-avatar {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: #e8f5f4;
          color: var(--mq-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }


        .mq-mini-doctor div:nth-child(2) {
          flex: 1;
        }


        .mq-mini-doctor strong {
          display: block;
          font-size: 12px;
        }


        .mq-mini-doctor small {
          display: block;
          color: #9ba8ab;
          font-size: 12px;
          margin-top: 3px;
        }


        .mq-doctor-form .mq-form-grid {
          padding: 0;
        }

        .mq-doctor-form .mq-form-grid + .mq-field-full,
        .mq-doctor-form .mq-field-full + .mq-form-grid {
          margin-top: 14px;
        }

        .mq-field select {
          width: 100%;
          height: 42px;
          border: 1px solid #dfe5ec;
          border-radius: 9px;
          padding: 0 10px;
          background: #fff;
          font: inherit;
          font-size: 12px;
          color: #1f2937;
        }

        .mq-field-full {
          margin-top: 14px;
        }

        .mq-field-hint {
          display: block;
          margin-top: 5px;
          font-size: 12px;
          color: #8a95a5;
        }

        .mq-password-row {
          display: flex;
          gap: 6px;
        }

        .mq-password-row input {
          flex: 1;
          min-width: 0;
        }

        .mq-secondary-button.small {
          padding: 0 10px;
          height: 42px;
          font-size: 12px;
          white-space: nowrap;
        }

        .mq-day-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }

        .mq-day-chip {
          min-width: 46px;
          height: 34px;
          border-radius: 999px;
          border: 1px solid #dfe5ec;
          background: #fff;
          color: #526070;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .mq-day-chip.selected {
          background: #0f766e;
          border-color: #0f766e;
          color: #fff;
        }

        .mq-day-preset {
          border: 0;
          background: none;
          color: #0f766e;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          padding: 0 4px;
        }

        .mq-slot-preview {
          margin-top: 14px;
          padding: 10px 12px;
          border-radius: 9px;
          background: #effaf8;
          color: #1f4f4a;
          font-size: 12px;
          line-height: 1.5;
        }

        .mq-slot-preview.error {
          background: #fef2f2;
          color: #b91c1c;
        }

        .mq-status.inactive {
          color: #b45309;
        }

        .mq-row-inactive td {
          opacity: 0.6;
        }

        .mq-row-actions {
          display: flex;
          gap: 6px;
        }

        .mq-edit {
          border: 1px solid #dfe5ec;
          background: #fff;
          color: #334155;
          border-radius: 7px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .mq-activate {
          border: 1px solid #a7f3d0;
          background: #ecfdf5;
          color: #047857;
          border-radius: 7px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .mq-active-dot.inactive {
          color: #b45309;
        }

        .mq-active-dot {
          color: #2d8c60;
          font-size: 12px;
        }


        .mq-activity {
          padding: 6px 20px 15px;
        }


        .mq-activity-row {
          min-height: 58px;
          border-bottom: 1px solid #f0f3f4;
          display: flex;
          align-items: center;
          gap: 10px;
        }


        .mq-activity-row:last-child {
          border-bottom: none;
        }


        .mq-activity-icon {
          width: 31px;
          height: 31px;
          border-radius: 8px;
          background: #e9f6f5;
          color: var(--mq-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
        }


        .mq-activity-row div:nth-child(2) {
          flex: 1;
        }


        .mq-activity-row strong {
          display: block;
          font-size: 12px;
        }


        .mq-activity-row small {
          display: block;
          color: #9ba8ab;
          font-size: 12px;
          margin-top: 3px;
        }


        .mq-activity-row > strong {
          font-size: 14px;
        }



        /* DOCTORS */

        .mq-doctors-toolbar {
          background: white;
          border: 1px solid #e5edef;
          border-radius: 13px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 15px;
        }


        .mq-search {
          height: 39px;
          width: 300px;
          border: 1px solid #dfe8e9;
          border-radius: 8px;
          background: #fbfcfc;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
        }


        .mq-search span {
          color: #87979b;
        }


        .mq-search input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          font-size: 12px;
        }


        .mq-doctors-card {
          background: white;
          border: 1px solid #e5edef;
          border-radius: 13px;
          overflow: hidden;
        }


        .mq-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }


        .mq-table-wrap {
          overflow-x: auto;
        }


        .mq-table th {
          background: #fbfcfc;
          padding: 12px 16px;
          color: #9aa7aa;
          font-size: 12px;
          letter-spacing: 1px;
          text-align: left;
          border-bottom: 1px solid #edf1f2;
        }


        .mq-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #f0f3f4;
          font-size: 12px;
        }


        .mq-table tr:last-child td {
          border-bottom: none;
        }


        .mq-table tr:hover {
          background: #fcfefe;
        }


        .mq-doctor-name {
          display: flex;
          align-items: center;
          gap: 9px;
        }


        .mq-doctor-avatar {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: #e7f5f4;
          color: var(--mq-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }


        .mq-doctor-name strong {
          display: block;
          font-size: 12px;
        }


        .mq-doctor-name small {
          display: block;
          color: #9aa8ab;
          font-size: 12px;
          margin-top: 3px;
        }


        .mq-specialization {
          background: #f1f6f6;
          color: #5c7074;
          padding: 5px 8px;
          border-radius: 6px;
          font-size: 12px;
        }


        .mq-status {
          color: #2d8b5d;
          font-size: 12px;
          font-weight: 600;
        }


        .mq-status::before {
          content: "";
          display: inline-block;
          width: 6px;
          height: 6px;
          background: #3caf76;
          border-radius: 50%;
          margin-right: 5px;
        }


        .mq-delete {
          height: 28px;
          border: 1px solid #f0dada;
          border-radius: 6px;
          background: #fff8f8;
          color: #b64c4c;
          padding: 0 9px;
          font-size: 12px;
          cursor: pointer;
        }


        .mq-delete:hover {
          background: #fff0f0;
        }



        /* OTHER PAGES */

        .mq-placeholder {
          background: white;
          border: 1px solid #e5edef;
          border-radius: 14px;
          min-height: 430px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px;
        }


        .mq-placeholder-icon {
          width: 62px;
          height: 62px;
          border-radius: 17px;
          background: #e8f6f5;
          color: var(--mq-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin-bottom: 16px;
        }


        .mq-placeholder h2 {
          margin: 0 0 7px;
          font-size: 21px;
        }


        .mq-placeholder p {
          max-width: 440px;
          margin: 0;
          color: #89979b;
          font-size: 12px;
          line-height: 1.7;
        }


        .mq-coming {
          margin-top: 17px;
          padding: 7px 11px;
          border-radius: 20px;
          background: #f1f7f7;
          color: var(--mq-primary);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
        }



        /* REPORT */

        .mq-report-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
        }


        .mq-report-card {
          background: white;
          border: 1px solid #e5edef;
          border-radius: 13px;
          padding: 20px;
        }


        .mq-report-card span {
          color: #89979b;
          font-size: 12px;
        }


        .mq-report-card strong {
          display: block;
          margin-top: 12px;
          font-size: 27px;
        }


        .mq-report-card p {
          color: #9aa7aa;
          font-size: 12px;
          margin: 5px 0 0;
        }



        /* SETTINGS */

        .mq-settings-card {
          max-width: 720px;
          background: white;
          border: 1px solid #e5edef;
          border-radius: 14px;
          padding: 25px;
        }


        .mq-settings-row {
          min-height: 65px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #edf1f2;
        }


        .mq-settings-row:last-child {
          border-bottom: none;
        }


        .mq-settings-row strong {
          display: block;
          font-size: 12px;
        }


        .mq-settings-row span {
          display: block;
          color: #9aa7aa;
          font-size: 12px;
          margin-top: 4px;
        }


        .mq-settings-value {
          color: var(--mq-primary) !important;
          font-weight: 600;
        }



        /* MODAL */

        .mq-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(14,40,44,0.6);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }


        .mq-modal {
          width: 100%;
          max-width: 680px;
          max-height: 94vh;
          overflow-y: auto;
          background: white;
          border-radius: 15px;
          box-shadow:
            0 25px 80px rgba(0,0,0,0.22);
        }


        .mq-modal-head {
          padding: 23px 26px 19px;
          border-bottom: 1px solid #edf1f2;
          display: flex;
          justify-content: space-between;
        }


        .mq-modal-head > div > span {
          color: var(--mq-primary);
          font-size: 12px;
          letter-spacing: 1.5px;
          font-weight: 700;
        }


        .mq-modal-head h2 {
          margin: 7px 0 4px;
          font-size: 21px;
        }


        .mq-modal-head p {
          margin: 0;
          color: #89979b;
          font-size: 12px;
        }


        .mq-close {
          width: 31px;
          height: 31px;
          border: 1px solid #dfe7e8;
          border-radius: 8px;
          background: white;
          color: #75878b;
          font-size: 19px;
          cursor: pointer;
        }


        .mq-doctor-form {
          padding: 23px 26px 26px;
        }


        .mq-form-section {
          color: #87979b;
          font-size: 12px;
          letter-spacing: 1.5px;
          font-weight: 700;
          margin-bottom: 13px;
        }


        .mq-form-section.second {
          margin-top: 23px;
        }


        .mq-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }


        .mq-field label {
          display: block;
          color: #43595e;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 6px;
        }


        .mq-field input {
          width: 100%;
          height: 42px;
          border: 1px solid #dfe8e9;
          border-radius: 8px;
          background: #fbfcfc;
          outline: none;
          padding: 0 11px;
          font-size: 12px;
        }


        .mq-field input:focus {
          border-color: var(--mq-primary);
          background: white;
          box-shadow:
            0 0 0 3px rgba(8,116,122,0.08);
        }


        .mq-form-info {
          margin-top: 21px;
          background: #f1f8f8;
          border: 1px solid #deeeee;
          border-radius: 8px;
          padding: 10px;
          display: flex;
          gap: 8px;
          align-items: center;
        }


        .mq-form-info > span {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #d7eeee;
          color: var(--mq-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }


        .mq-form-info p {
          margin: 0;
          color: #637c80;
          font-size: 12px;
        }


        .mq-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 23px;
          padding-top: 18px;
          border-top: 1px solid #edf1f2;
        }


        .mq-secondary-button {
          height: 42px;
          padding: 0 16px;
          border: 1px solid #dfe7e8;
          border-radius: 8px;
          background: white;
          color: #687b7f;
          font-size: 12px;
          cursor: pointer;
        }


        .mq-spinner {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: white;
          animation: mqspin 0.7s linear infinite;
        }


        @keyframes mqspin {
          to {
            transform: rotate(360deg);
          }
        }



        /* RESPONSIVE */

        @media (max-width: 1100px) {

          .mq-content {
            padding-left: 28px;
            padding-right: 28px;
          }

          .mq-topbar {
            padding-left: 28px;
            padding-right: 28px;
          }

          .mq-dashboard-panels {
            grid-template-columns: 1fr;
          }

        }


        @media (max-width: 850px) {

          .mq-sidebar {
            width: 72px;
          }

          .mq-sidebar-brand {
            justify-content: center;
            padding: 0;
          }

          .mq-sidebar-brand > div:last-child {
            display: none;
          }

          .mq-nav {
            padding-left: 10px;
            padding-right: 10px;
          }

          .mq-nav-title,
          .mq-nav-item > span:not(.mq-nav-icon),
          .mq-nav-item b {
            display: none;
          }

          .mq-nav-item {
            justify-content: center;
            padding: 0;
          }

          .mq-nav-title.management {
            display: block;
            height: 15px;
            font-size: 0;
            margin-top: 20px;
          }

          .mq-sidebar-user > div:last-child {
            display: none;
          }

          .mq-sidebar-user {
            justify-content: center;
          }

          .mq-main {
            margin-left: 72px;
          }

          .mq-stat-grid {
            grid-template-columns: 1fr 1fr;
          }

          .mq-report-grid {
            grid-template-columns: 1fr 1fr;
          }

        }


        @media (max-width: 600px) {

          .mq-topbar {
            height: 74px;
            padding: 0 17px;
          }

          .mq-topbar h1 {
            font-size: 20px;
          }

          .mq-top-user,
          .mq-top-separator {
            display: none;
          }

          .mq-content {
            padding: 24px 15px 35px;
          }

          .mq-welcome {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
          }

          .mq-welcome h2 {
            font-size: 21px;
          }

          .mq-primary-button {
            width: 100%;
          }

          .mq-stat-grid {
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .mq-stat {
            padding: 14px;
            min-height: 120px;
          }

          .mq-stat-number {
            font-size: 23px;
          }

          .mq-doctors-toolbar {
            flex-direction: column;
          }

          .mq-search {
            width: 100%;
          }

          .mq-report-grid {
            grid-template-columns: 1fr;
          }

          .mq-form-grid {
            grid-template-columns: 1fr;
          }

          .mq-modal-overlay {
            padding: 9px;
          }

          .mq-doctor-form,
          .mq-modal-head {
            padding-left: 19px;
            padding-right: 19px;
          }

          .mq-modal-footer {
            flex-direction: column-reverse;
          }

          .mq-secondary-button,
          .mq-modal-footer .mq-primary-button {
            width: 100%;
          }

        }

      `}</style>

    </div>
  )
}


/* =========================================================
   DASHBOARD VIEW
========================================================= */

function DashboardView({
  user,
  stats,
  doctors,
  statCards,
  loadingStats,
  openAddDoctor,
  navigate
}) {

  return (

    <>

      <div className="mq-welcome">

        <div>

          <span className="mq-top-label">
            OVERVIEW
          </span>

          <h2>
            Good to see you,{' '}
            {user?.name?.split(' ')[0] || 'Admin'}.
          </h2>

          <p>
            Here's what's happening across your
            MedQueue clinic.
          </p>

        </div>


        <button
          type="button"
          className="mq-primary-button"
          onClick={openAddDoctor}
        >
          +
          Add doctor
        </button>

      </div>


      <div className="mq-stat-grid">

        {statCards.map((card) => (

          <div
            className="mq-stat"
            key={card.label}
          >

            <div className="mq-stat-top">

              <div
                className={`mq-stat-icon ${card.className}`}
              >
                {card.icon}
              </div>

            </div>


            <div className="mq-stat-number">

              {loadingStats
                ? '—'
                : card.value}

            </div>


            <div className="mq-stat-label">
              {card.label}
            </div>

          </div>

        ))}

      </div>


      <div className="mq-dashboard-panels">


        <div className="mq-card">

          <div className="mq-card-header">

            <div>

              <span>
                CLINIC STAFF
              </span>

              <h3>
                Doctors
              </h3>

            </div>

            <button
              type="button"
              className="mq-link-button"
              onClick={() => navigate('Doctors')}
            >
              View all →
            </button>

          </div>


          <div className="mq-mini-doctor-list">

            {doctors.length === 0 ? (

              <div className="mq-placeholder">
                <div className="mq-placeholder-icon">
                  +
                </div>

                <h2>
                  No doctors yet
                </h2>

                <p>
                  Add a doctor to start managing
                  your clinic staff.
                </p>
              </div>

            ) : (

              doctors.slice(0, 6).map((doctor) => (

                <div
                  className="mq-mini-doctor"
                  key={doctor.id}
                >

                  <div className="mq-mini-avatar">
                    {doctor.name
                      ?.replace('Dr. ', '')
                      ?.charAt(0)
                      ?.toUpperCase() || 'D'}
                  </div>


                  <div>

                    <strong>
                      {doctor.name}
                    </strong>

                    <small>
                      {doctor.specialization}
                    </small>

                  </div>


                  <span
                    className={
                      doctor.active === false
                        ? 'mq-active-dot inactive'
                        : 'mq-active-dot'
                    }
                  >
                    {doctor.active === false ? '● Inactive' : '● Active'}
                  </span>

                </div>

              ))

            )}

          </div>

        </div>



        <div className="mq-card">

          <div className="mq-card-header">

            <div>

              <span>
                APPOINTMENTS
              </span>

              <h3>
                Activity
              </h3>

            </div>

          </div>


          <div className="mq-activity">

            <ActivityRow
              icon="+"
              title="Booked"
              subtitle="Active appointments"
              value={stats?.bookedAppointments ?? 0}
            />

            <ActivityRow
              icon="#"
              title="Called"
              subtitle="Patients called"
              value={stats?.calledAppointments ?? 0}
            />

            <ActivityRow
              icon="✓"
              title="Completed"
              subtitle="Completed consultations"
              value={stats?.completedAppointments ?? 0}
            />

            <ActivityRow
              icon="×"
              title="Cancelled"
              subtitle="Cancelled appointments"
              value={stats?.cancelledAppointments ?? 0}
            />

          </div>

        </div>

      </div>

    </>

  )
}


/* =========================================================
   DOCTORS VIEW
========================================================= */

function DoctorsView({
  doctors,
  loading,
  search,
  setSearch,
  openAddDoctor,
  openEditDoctor,
  toggleDoctorActive,
  doctorActionId
}) {

  return (

    <>

      <div className="mq-page-intro">

        <span>
          CLINIC STAFF
        </span>

        <h2>
          Doctor management
        </h2>

        <p>
          Create and manage doctor profiles and
          their MedQueue login accounts.
        </p>

      </div>


      <div className="mq-doctors-toolbar">

        <div className="mq-search">

          <span>
            ⌕
          </span>

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search doctors..."
          />

        </div>


        <button
          type="button"
          className="mq-primary-button"
          onClick={openAddDoctor}
        >
          +
          Add doctor
        </button>

      </div>


      <div className="mq-doctors-card">

        <div className="mq-table-wrap">

          {loading ? (

            <div className="mq-placeholder">

              <div className="mq-spinner"></div>

              <h2>
                Loading doctors...
              </h2>

            </div>

          ) : doctors.length === 0 ? (

            <div className="mq-placeholder">

              <div className="mq-placeholder-icon">
                +
              </div>

              <h2>
                No doctors found
              </h2>

              <p>
                Add your first doctor to begin
                managing clinic staff.
              </p>

            </div>

          ) : (

            <table className="mq-table">

              <thead>

                <tr>

                  <th>
                    DOCTOR
                  </th>

                  <th>
                    SPECIALIZATION
                  </th>

                  <th>
                    EMAIL
                  </th>

                  <th>
                    PHONE
                  </th>

                  <th>
                    SCHEDULE
                  </th>

                  <th>
                    STATUS
                  </th>

                  <th>
                    ACTION
                  </th>

                </tr>

              </thead>


              <tbody>

                {doctors.map((doctor) => (

                  <tr
                    key={doctor.id}
                    className={doctor.active === false ? 'mq-row-inactive' : ''}
                  >

                    <td>

                      <div className="mq-doctor-name">

                        <div className="mq-doctor-avatar">
                          {doctor.name
                            ?.replace('Dr. ', '')
                            ?.charAt(0)
                            ?.toUpperCase() || 'D'}
                        </div>

                        <div>

                          <strong>
                            {doctor.name}
                          </strong>

                          <small>
                            ID #{doctor.id}
                          </small>

                        </div>

                      </div>

                    </td>


                    <td>

                      <span className="mq-specialization">
                        {doctor.specialization}
                      </span>

                    </td>


                    <td>
                      {doctor.email || '—'}
                    </td>


                    <td>
                      {doctor.phone || '—'}
                    </td>


                    <td>
                      {doctor.availableDays || '—'}
                      <br />
                      <small>
                        {doctor.availableTime || '—'} · {doctor.consultationTime || 15} min
                        {doctor.ratingCount ? ` · ★ ${doctor.averageRating.toFixed(1)}` : ''}
                      </small>
                    </td>


                    <td>

                      <span
                        className={
                          doctor.active === false
                            ? 'mq-status inactive'
                            : 'mq-status'
                        }
                      >
                        {doctor.active === false ? 'Inactive' : 'Active'}
                      </span>

                    </td>


                    <td>

                      <div className="mq-row-actions">

                        <button
                          type="button"
                          className="mq-edit"
                          onClick={() =>
                            openEditDoctor(doctor)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className={
                            doctor.active === false
                              ? 'mq-activate'
                              : 'mq-delete'
                          }
                          disabled={doctorActionId === doctor.id}
                          onClick={() =>
                            toggleDoctorActive(doctor)
                          }
                        >
                          {doctorActionId === doctor.id
                            ? '...'
                            : doctor.active === false
                              ? 'Activate'
                              : 'Deactivate'}
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          )}

        </div>

      </div>

    </>

  )
}


/* =========================================================
   PATIENTS VIEW
========================================================= */

function PatientsView({ stats }) {

  return (

    <>

      <div className="mq-page-intro">

        <span>
          PATIENT MANAGEMENT
        </span>

        <h2>
          Patients
        </h2>

        <p>
          Overview of registered MedQueue patients.
        </p>

      </div>


      <div className="mq-report-grid">

        <div className="mq-report-card">

          <span>
            REGISTERED PATIENTS
          </span>

          <strong>
            {stats?.totalPatients ?? 0}
          </strong>

          <p>
            Total patient accounts
          </p>

        </div>


        <div className="mq-report-card">

          <span>
            TOTAL APPOINTMENTS
          </span>

          <strong>
            {stats?.totalAppointments ?? 0}
          </strong>

          <p>
            Appointments in the system
          </p>

        </div>


        <div className="mq-report-card">

          <span>
            COMPLETED VISITS
          </span>

          <strong>
            {stats?.completedAppointments ?? 0}
          </strong>

          <p>
            Completed consultations
          </p>

        </div>

      </div>


      <div
        className="mq-placeholder"
        style={{ marginTop: '20px' }}
      >

        <div className="mq-placeholder-icon">
          ◉
        </div>

        <h2>
          Patient directory
        </h2>

        <p>
          The full patient directory will connect
          here once the admin patient API is added
          to the Spring Boot backend.
        </p>

        <div className="mq-coming">
          BACKEND ENDPOINT NEEDED
        </div>

      </div>

    </>

  )
}


/* =========================================================
   APPOINTMENTS VIEW
========================================================= */

function AppointmentsView({ stats }) {

  return (

    <>

      <div className="mq-page-intro">

        <span>
          APPOINTMENT MANAGEMENT
        </span>

        <h2>
          Appointments
        </h2>

        <p>
          Monitor appointment activity across the
          clinic.
        </p>

      </div>


      <div className="mq-report-grid">

        <div className="mq-report-card">

          <span>
            TOTAL
          </span>

          <strong>
            {stats?.totalAppointments ?? 0}
          </strong>

          <p>
            All appointments
          </p>

        </div>


        <div className="mq-report-card">

          <span>
            BOOKED
          </span>

          <strong>
            {stats?.bookedAppointments ?? 0}
          </strong>

          <p>
            Active bookings
          </p>

        </div>


        <div className="mq-report-card">

          <span>
            COMPLETED
          </span>

          <strong>
            {stats?.completedAppointments ?? 0}
          </strong>

          <p>
            Completed consultations
          </p>

        </div>


        <div className="mq-report-card">

          <span>
            CALLED
          </span>

          <strong>
            {stats?.calledAppointments ?? 0}
          </strong>

          <p>
            Patients called
          </p>

        </div>


        <div className="mq-report-card">

          <span>
            CANCELLED
          </span>

          <strong>
            {stats?.cancelledAppointments ?? 0}
          </strong>

          <p>
            Cancelled appointments
          </p>

        </div>


        <div className="mq-report-card">

          <span>
            SKIPPED
          </span>

          <strong>
            {stats?.skippedAppointments ?? 0}
          </strong>

          <p>
            Skipped appointments
          </p>

        </div>

      </div>


      <div
        className="mq-placeholder"
        style={{ marginTop: '20px' }}
      >

        <div className="mq-placeholder-icon">
          □
        </div>

        <h2>
          Appointment directory
        </h2>

        <p>
          Detailed appointment filtering and
          management will connect here after adding
          the admin appointment endpoint.
        </p>

        <div className="mq-coming">
          BACKEND ENDPOINT NEEDED
        </div>

      </div>

    </>

  )
}


/* =========================================================
   REPORTS VIEW
========================================================= */

function ReportsView({ stats }) {

  return (

    <>

      <div className="mq-page-intro">

        <span>
          CLINIC ANALYTICS
        </span>

        <h2>
          Reports
        </h2>

        <p>
          A summary of MedQueue activity and
          appointment outcomes.
        </p>

      </div>


      <div className="mq-report-grid">


        <ReportCard
          title="Total doctors"
          value={stats?.totalDoctors ?? 0}
          text="Registered doctors"
        />


        <ReportCard
          title="Total patients"
          value={stats?.totalPatients ?? 0}
          text="Registered patients"
        />


        <ReportCard
          title="Appointments"
          value={stats?.totalAppointments ?? 0}
          text="Total appointments"
        />


        <ReportCard
          title="Completed"
          value={stats?.completedAppointments ?? 0}
          text="Completed consultations"
        />


        <ReportCard
          title="Cancelled"
          value={stats?.cancelledAppointments ?? 0}
          text="Cancelled appointments"
        />


        <ReportCard
          title="Skipped"
          value={stats?.skippedAppointments ?? 0}
          text="Skipped appointments"
        />

      </div>


      <div
        className="mq-placeholder"
        style={{ marginTop: '20px' }}
      >

        <div className="mq-placeholder-icon">
          ▤
        </div>

        <h2>
          Reporting centre
        </h2>

        <p>
          Charts and downloadable reports can be
          added here later without changing the
          dashboard navigation.
        </p>

        <div className="mq-coming">
          REPORTING MODULE
        </div>

      </div>

    </>

  )
}


/* =========================================================
   SETTINGS VIEW
========================================================= */

function SettingsView({ user }) {

  return (

    <>

      <div className="mq-page-intro">

        <span>
          SYSTEM SETTINGS
        </span>

        <h2>
          Settings
        </h2>

        <p>
          Current administrator and application
          configuration.
        </p>

      </div>


      <div className="mq-settings-card">


        <div className="mq-settings-row">

          <div>

            <strong>
              Administrator
            </strong>

            <span>
              Current signed-in administrator
            </span>

          </div>

          <span className="mq-settings-value">
            {user?.name || 'Admin'}
          </span>

        </div>


        <div className="mq-settings-row">

          <div>

            <strong>
              Email
            </strong>

            <span>
              Administrator login email
            </span>

          </div>

          <span className="mq-settings-value">
            {user?.email || '—'}
          </span>

        </div>


        <div className="mq-settings-row">

          <div>

            <strong>
              Role
            </strong>

            <span>
              Access level for this account
            </span>

          </div>

          <span className="mq-settings-value">
            {user?.role || 'ADMIN'}
          </span>

        </div>


        <div className="mq-settings-row">

          <div>

            <strong>
              Backend
            </strong>

            <span>
              MedQueue Spring Boot API
            </span>

          </div>

          <span className="mq-settings-value">
            {API_URL.replace(/^https?:\/\//, '')}
          </span>

        </div>


        <div className="mq-settings-row">

          <div>

            <strong>
              Authentication
            </strong>

            <span>
              API authentication mechanism
            </span>

          </div>

          <span className="mq-settings-value">
            JWT
          </span>

        </div>


      </div>

    </>

  )
}


/* =========================================================
   SMALL COMPONENTS
========================================================= */

function ActivityRow({
  icon,
  title,
  subtitle,
  value
}) {

  return (

    <div className="mq-activity-row">

      <div className="mq-activity-icon">
        {icon}
      </div>

      <div>

        <strong>
          {title}
        </strong>

        <small>
          {subtitle}
        </small>

      </div>

      <strong>
        {value}
      </strong>

    </div>

  )
}


function ReportCard({
  title,
  value,
  text
}) {

  return (

    <div className="mq-report-card">

      <span>
        {title.toUpperCase()}
      </span>

      <strong>
        {value}
      </strong>

      <p>
        {text}
      </p>

    </div>

  )
}


function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  list,
  pattern,
  title
}) {

  return (

    <div className="mq-field">

      <label>
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        required={required}
        list={list}
        pattern={pattern}
        title={title}
        minLength={
          type === 'password'
            ? 6
            : undefined
        }
      />

    </div>

  )
}


export default AdminDashboard