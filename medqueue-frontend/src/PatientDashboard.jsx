
import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api.js'

import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import StatCard from './components/StatCard.jsx'
import StatusBadge from './components/StatusBadge.jsx'
import StarRating from './components/StarRating.jsx'
import PrescriptionCard from './components/PrescriptionCard.jsx'
import QueueTracker from './components/QueueTracker.jsx'


const pad2 = (value) => String(value).padStart(2, '0')

// "Today", "Tomorrow" or "Thu, 23 Oct"
const friendlyDay = (date) => {
  const today = new Date()
  const target = new Date(`${date}T00:00:00`)
  const days = Math.round(
    (target - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000
  )

  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'

  return target.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Builds an .ics file so the visit can be added to any calendar app
const downloadCalendarFile = (appointment, minutes) => {
  const start = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`)
  const end = new Date(start.getTime() + minutes * 60000)

  const local = (date) =>
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}T${pad2(date.getHours())}${pad2(date.getMinutes())}00`

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MedQueue//Appointments//EN',
    'BEGIN:VEVENT',
    `UID:medqueue-appointment-${appointment.id}@medqueue`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(end)}`,
    `SUMMARY:Appointment with ${appointment.doctorName}`,
    `DESCRIPTION:Token #${appointment.tokenNumber} · ${appointment.specialization || ''}. Track your live queue in MedQueue.`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Doctor appointment in 1 hour',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ]

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `medqueue-appointment-${appointment.appointmentDate}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}


// An unfinished appointment counts as missed this long after its slot
const STALE_AFTER_MS = 12 * 60 * 60 * 1000


function PatientDashboard() {

  const [user, setUser] = useState(null)

  const [doctors, setDoctors] = useState([])

  const [appointments, setAppointments] =
    useState([])

  const [activePage, setActivePage] =
    useState('Dashboard')


  const [doctorSearch, setDoctorSearch] =
    useState('')

  const [specializationFilter, setSpecializationFilter] =
    useState('ALL')


  const [selectedDoctor, setSelectedDoctor] =
    useState(null)

  const [appointmentDate, setAppointmentDate] =
    useState('')

  const [appointmentTime, setAppointmentTime] =
    useState('')

  // Appointment being moved (null = new booking)
  const [rescheduleTarget, setRescheduleTarget] =
    useState(null)

  // Shown after a successful booking or reschedule
  const [bookingConfirmation, setBookingConfirmation] =
    useState(null)

  // doctorId -> { date, time } of that doctor's earliest free slot
  const [nextFree, setNextFree] =
    useState({})

  const [checkInBusy, setCheckInBusy] =
    useState(false)

  // Slots plus the doctor/date they were loaded for
  const [slotData, setSlotData] =
    useState({ key: '', slots: [] })

  // Bumped to force a reload (e.g. after a slot was taken)
  const [slotReload, setSlotReload] =
    useState(0)

  const slotKey =
    selectedDoctor && appointmentDate
      ? `${selectedDoctor.id}|${appointmentDate}|${slotReload}`
      : ''

  const slots =
    slotData.key === slotKey
      ? slotData.slots
      : []

  const slotsLoading =
    Boolean(slotKey) &&
    slotData.key !== slotKey


  // Load the doctor's bookable slots whenever the doctor or date changes
  useEffect(() => {

    if (!selectedDoctor || !appointmentDate) {
      return
    }

    let active = true

    const token =
      localStorage.getItem('token')

    apiFetch(
      `/api/appointments/slots?doctorId=${selectedDoctor.id}&date=${appointmentDate}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`
        }
      }
    )
      .then(response => (response.ok ? response.json() : []))
      .then(data => {
        if (active) {
          setSlotData({ key: slotKey, slots: data })
        }
      })
      .catch(() => {
        if (active) {
          setSlotData({ key: slotKey, slots: [] })
        }
      })

    return () => {
      active = false
    }

  }, [selectedDoctor, appointmentDate, slotKey])


  const [selectedAppointment, setSelectedAppointment] =
    useState(null)

  const [queueStatus, setQueueStatus] =
    useState(null)

  const [queueLastUpdated, setQueueLastUpdated] =
    useState(null)


  const [message, setMessage] =
    useState('')

  const [success, setSuccess] =
    useState(false)

  const [loading, setLoading] =
    useState(false)


  // Rating a completed visit
  const [ratingAppointment, setRatingAppointment] =
    useState(null)

  const [ratingStars, setRatingStars] =
    useState(0)

  const [ratingComment, setRatingComment] =
    useState('')

  const [ratingSaving, setRatingSaving] =
    useState(false)

  const [ratingError, setRatingError] =
    useState('')


  // History filters
  const [historyFilter, setHistoryFilter] =
    useState('ALL')

  const [expandedVisitId, setExpandedVisitId] =
    useState(null)


  // Ticks every second so the queue countdown is live
  const [now, setNow] =
    useState(() => Date.now())

  useEffect(() => {

    const interval =
      setInterval(
        () => setNow(Date.now()),
        1000
      )

    return () => clearInterval(interval)

  }, [])


  /* =====================================================
     AUTH
     ===================================================== */

  const getToken = () => {

    const storedUser =
      localStorage.getItem('user')

    if (storedUser) {

      try {

        const userData =
          JSON.parse(storedUser)

        if (userData.token) {
          return userData.token
        }

      } catch {
        // Ignore invalid user data
      }
    }

    return localStorage.getItem('token')
  }


  /* =====================================================
     INITIAL LOAD
     ===================================================== */

  useEffect(() => {

    const storedUser =
      localStorage.getItem('user')

    if (!storedUser) {
      return
    }

    try {

      const userData =
        JSON.parse(storedUser)

      setUser(userData)

    } catch {

      localStorage.removeItem('user')
      localStorage.removeItem('token')

      return
    }

    loadDoctors()
    loadAppointments()
    loadNextFree()

  }, [])


  /* =====================================================
     DOCTORS
     ===================================================== */

  const loadNextFree = async () => {

    try {

      const response =
        await apiFetch('/api/appointments/next-free')

      if (!response.ok) {
        return
      }

      const data =
        await response.json()

      const byDoctor = {}

      data.forEach(slot => {
        byDoctor[slot.doctorId] = {
          date: slot.date,
          time: slot.time.slice(0, 5)
        }
      })

      setNextFree(byDoctor)

    } catch (error) {

      console.error(
        'Next free slot error:',
        error
      )

    }

  }


  // Open the booking popup; preset jumps straight to a date/slot
  const openBooking =
    (doctor, preset = null) => {

      setRescheduleTarget(null)
      setSelectedDoctor(doctor)
      setAppointmentDate(
        preset?.date ||
        nextFree[doctor.id]?.date ||
        ''
      )
      setAppointmentTime(preset?.time || '')
      setMessage('')

    }


  const openReschedule =
    appointment => {

      const doctor =
        doctors.find(item => item.id === appointment.doctorId) || {
          id: appointment.doctorId,
          name: appointment.doctorName,
          specialization: appointment.specialization
        }

      setSelectedDoctor(doctor)
      setRescheduleTarget(appointment)
      setAppointmentDate(appointment.appointmentDate)
      setAppointmentTime('')
      setMessage('')

    }


  const closeBooking =
    () => {

      setSelectedDoctor(null)
      setRescheduleTarget(null)

    }


  // "I've arrived" or "Running late"
  const checkIn =
    async (appointment, arrival, lateMinutes) => {

      setCheckInBusy(true)

      try {

        const query =
          arrival === 'LATE'
            ? `arrival=LATE&lateMinutes=${lateMinutes}`
            : 'arrival=ARRIVED'

        const response =
          await apiFetch(
            `/api/appointments/${appointment.id}/check-in?${query}`,
            { method: 'PUT' }
          )

        if (!response.ok) {

          let errorMessage =
            'Unable to update your arrival status'

          try {
            errorMessage =
              (await response.json()).message || errorMessage
          } catch {
            // Use default message
          }

          throw new Error(errorMessage)
        }

        const updated =
          await response.json()

        setAppointments(previous =>
          previous.map(item =>
            item.id === updated.id
              ? {
                  ...item,
                  arrivalStatus: updated.arrivalStatus,
                  checkedInAt: updated.checkedInAt,
                  lateMinutes: updated.lateMinutes
                }
              : item
          )
        )

        setSelectedAppointment(previous =>
          previous && previous.id === updated.id
            ? {
                ...previous,
                arrivalStatus: updated.arrivalStatus,
                checkedInAt: updated.checkedInAt,
                lateMinutes: updated.lateMinutes
              }
            : previous
        )

        setSuccess(true)

        setMessage(
          arrival === 'LATE'
            ? `The clinic knows you'll be about ${lateMinutes} min late.`
            : "You're checked in. The doctor can see you've arrived."
        )

      } catch (error) {

        setSuccess(false)
        setMessage(error.message)

      } finally {

        setCheckInBusy(false)

      }

    }


  const loadDoctors = async () => {

    try {

      const response =
        await apiFetch(
          '/api/doctors'
        )

      if (!response.ok) {
        throw new Error(
          'Unable to load doctors'
        )
      }

      const data =
        await response.json()

      setDoctors(data)

    } catch (error) {

      console.error(
        'Doctor loading error:',
        error
      )

      setMessage(error.message)
      setSuccess(false)

    }

  }


  /* =====================================================
     APPOINTMENTS
     ===================================================== */

  const loadAppointments = async () => {

    const token =
      getToken()

    const storedUser =
      localStorage.getItem('user')

    if (!token || !storedUser) {
      return
    }

    try {

      const userData =
        JSON.parse(storedUser)

      const response =
        await apiFetch(
          `/api/appointments/patient/${userData.id}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        )

      if (!response.ok) {
        throw new Error(
          'Unable to load appointments'
        )
      }

      const data =
        await response.json()

      setAppointments(data)

    } catch (error) {

      console.error(
        'Appointment loading error:',
        error
      )

      setMessage(error.message)
      setSuccess(false)

    }

  }


  /* =====================================================
     LIVE QUEUE AUTO REFRESH
     ===================================================== */

  useEffect(() => {

    if (!nextAppointment) {
      return
    }

    const isActiveAppointment =
      nextAppointment.status === 'BOOKED' ||
      nextAppointment.status === 'CALLED'

    if (!isActiveAppointment) {
      return
    }

    let cancelled = false

    const refreshQueue = async () => {

      const token =
        getToken()

      if (!token || cancelled) {
        return
      }

      try {

        const response =
          await apiFetch(
            `/api/appointments/${nextAppointment.id}/queue-status`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          )

        if (!response.ok) {
          return
        }

        const data =
          await response.json()

        if (!cancelled) {

          setQueueStatus(data)

          setQueueLastUpdated(
            new Date()
          )

          if (
            data.status !==
            nextAppointment.status
          ) {
            loadAppointments()
          }

        }

      } catch (error) {

        console.error(
          'Live queue refresh error:',
          error
        )

      }

    }

    // Load immediately
    refreshQueue()

    // Refresh every 5 seconds
    const interval =
      setInterval(
        refreshQueue,
        5000
      )

    return () => {

      cancelled = true

      clearInterval(interval)

    }

  }, [
    appointments
  ])


  /* =====================================================
     SEARCH / FILTER
     ===================================================== */

  const specializations =
    useMemo(() => {

      return [
        ...new Set(
          doctors
            .map(
              doctor =>
                doctor.specialization
            )
            .filter(Boolean)
        )
      ]

    }, [doctors])


  const filteredDoctors =
    useMemo(() => {

      const searchText =
        doctorSearch
          .toLowerCase()
          .trim()

      return doctors.filter(doctor => {

        const doctorName =
          (doctor.name || '')
            .toLowerCase()

        const specialization =
          (doctor.specialization || '')
            .toLowerCase()

        const matchesSearch =
          doctorName.includes(searchText) ||
          specialization.includes(searchText)

        const matchesSpecialization =
          specializationFilter === 'ALL' ||
          doctor.specialization ===
            specializationFilter

        return (
          matchesSearch &&
          matchesSpecialization
        )

      })

    }, [
      doctors,
      doctorSearch,
      specializationFilter
    ])


  /* =====================================================
     APPOINTMENT DATA
     ===================================================== */

  const todayDate = (() => {
    const date = new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })()

  // Booked/called but its slot was more than 12 hours ago: the doctor never
  // finished it. Uses real time so night-shift slots after midnight still count.
  const isStale =
    appointment =>
      (appointment.status === 'BOOKED' ||
        appointment.status === 'CALLED') &&
      new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`).getTime() +
        STALE_AFTER_MS < now

  const displayStatus =
    appointment =>
      isStale(appointment)
        ? 'EXPIRED'
        : appointment.status

  const upcomingAppointments =
    appointments
      .filter(
        appointment =>
          (appointment.status === 'BOOKED' ||
            appointment.status === 'CALLED') &&
          !isStale(appointment)
      )
      .sort((a, b) =>
        `${a.appointmentDate}T${a.appointmentTime}`
          .localeCompare(
            `${b.appointmentDate}T${b.appointmentTime}`
          )
      )

  const pastVisits =
    appointments.filter(
      appointment =>
        appointment.status === 'COMPLETED' ||
        appointment.status === 'SKIPPED' ||
        appointment.status === 'CANCELLED' ||
        isStale(appointment)
    )

  const prescriptions =
    appointments
      .filter(
        appointment =>
          appointment.prescription
      )
      .map(
        appointment =>
          appointment.prescription
      )

  const unratedVisits =
    appointments.filter(
      appointment =>
        appointment.status === 'COMPLETED' &&
        !appointment.rating
    )

  const completedAppointments =
    appointments.filter(
      appointment =>
        appointment.status ===
        'COMPLETED'
    )

  const nextAppointment =
    upcomingAppointments[0]


  /* =====================================================
     BOOK APPOINTMENT
     ===================================================== */

  const bookAppointment =
    async () => {

      if (
        !selectedDoctor ||
        !appointmentDate ||
        !appointmentTime
      ) {

        setSuccess(false)

        setMessage(
          'Please select doctor, date and time.'
        )

        return
      }

      const token =
        getToken()

      if (!token || !user) {

        setSuccess(false)

        setMessage(
          'Login session expired. Please login again.'
        )

        return
      }

      setLoading(true)
      setMessage('')

      try {

        const isReschedule =
          Boolean(rescheduleTarget)

        const response =
          await apiFetch(
            isReschedule
              ? `/api/appointments/${rescheduleTarget.id}/reschedule`
              : `/api/appointments/book?doctorId=${selectedDoctor.id}`,
            {
              method: isReschedule ? 'PUT' : 'POST',

              headers: {
                'Content-Type':
                  'application/json',

                Authorization:
                  `Bearer ${token}`
              },

              body: JSON.stringify({
                appointmentDate,
                appointmentTime
              })
            }
          )

        if (!response.ok) {

          const errorText =
            await response.text()

          let errorMessage =
            'Unable to book appointment'

          try {
            errorMessage =
              JSON.parse(errorText).message || errorMessage
          } catch {
            errorMessage = errorText || errorMessage
          }

          // Slot may have just been taken: refresh the list
          if (response.status === 409 || response.status === 400) {
            setAppointmentTime('')
            setSlotReload(previous => previous + 1)
          }

          throw new Error(errorMessage)
        }

        const data =
          await response.json()

        setBookingConfirmation({
          ...data,
          rescheduled: isReschedule,
          consultationMinutes:
            selectedDoctor.consultationTime || 15
        })

        closeBooking()

        setAppointmentDate('')

        setAppointmentTime('')

        await loadAppointments()

        loadNextFree()

      } catch (error) {

        console.error(
          'Booking error:',
          error
        )

        setSuccess(false)

        setMessage(
          error.message
        )

      } finally {

        setLoading(false)

      }

    }


  /* =====================================================
     CANCEL APPOINTMENT
     ===================================================== */

  const cancelAppointment =
    async appointmentId => {

      const token =
        getToken()

      if (!token) {

        setSuccess(false)

        setMessage(
          'Login session expired. Please login again.'
        )

        return
      }

      try {

        const response =
          await apiFetch(
            `/api/appointments/${appointmentId}/cancel`,
            {
              method: 'PUT',

              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          )

        if (!response.ok) {

          const errorText =
            await response.text()

          throw new Error(
            errorText ||
            'Unable to cancel appointment'
          )
        }

        setSuccess(true)

        setMessage(
          'Appointment cancelled successfully.'
        )

        loadNextFree()

        setQueueStatus(null)

        await loadAppointments()

      } catch (error) {

        console.error(
          'Cancellation error:',
          error
        )

        setSuccess(false)

        setMessage(
          error.message
        )

      }

    }


  /* =====================================================
     QUEUE
     ===================================================== */

  const loadQueueStatus =
    async appointment => {

      const token =
        getToken()

      if (!token) {

        setSuccess(false)

        setMessage(
          'Login session expired. Please login again.'
        )

        return
      }

      try {

        const response =
          await apiFetch(
            `/api/appointments/${appointment.id}/queue-status`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          )

        if (!response.ok) {

          throw new Error(
            'Unable to load queue status'
          )
        }

        const data =
          await response.json()

        setSelectedAppointment(
          appointment
        )

        setQueueStatus(data)

        setQueueLastUpdated(
          new Date()
        )

      } catch (error) {

        console.error(
          'Queue status error:',
          error
        )

        setSuccess(false)

        setMessage(
          error.message
        )

      }

    }


  /* =====================================================
     LOGOUT
     ===================================================== */

  const logout = () => {

    localStorage.removeItem(
      'token'
    )

    localStorage.removeItem(
      'user'
    )

    window.location.reload()

  }


  /* =====================================================
     HELPERS
     ===================================================== */

  const formatDate =
    date => {

      if (!date) {
        return '-'
      }

      return new Date(
        `${date}T00:00:00`
      ).toLocaleDateString(
        'en-IN',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }
      )

    }


  const formatTime =
    time => {

      if (!time) {
        return '-'
      }

      const [
        hour,
        minute
      ] =
        time.split(':')

      const date =
        new Date()

      date.setHours(
        Number(hour)
      )

      date.setMinutes(
        Number(minute)
      )

      return date.toLocaleTimeString(
        'en-IN',
        {
          hour: 'numeric',
          minute: '2-digit'
        }
      )

    }


  /* =====================================================
     RATING
     ===================================================== */

  const openRating =
    appointment => {

      setRatingAppointment(appointment)
      setRatingStars(0)
      setRatingComment('')
      setRatingError('')

    }


  const submitRating =
    async () => {

      if (ratingStars < 1) {
        setRatingError('Please select a star rating.')
        return
      }

      const token =
        getToken()

      try {

        setRatingSaving(true)
        setRatingError('')

        const response =
          await apiFetch(
            `/api/ratings/appointment/${ratingAppointment.id}`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',

                Authorization:
                  `Bearer ${token}`
              },

              body: JSON.stringify({
                stars: ratingStars,
                comment: ratingComment
              })
            }
          )

        if (!response.ok) {

          let errorMessage =
            'Unable to submit rating'

          try {
            const data = await response.json()
            errorMessage = data.message || errorMessage
          } catch {
            // Use default message
          }

          throw new Error(errorMessage)
        }

        const rating =
          await response.json()

        setAppointments(previous =>
          previous.map(item =>
            item.id === ratingAppointment.id
              ? { ...item, rating }
              : item
          )
        )

        setRatingAppointment(null)

        setSuccess(true)

        setMessage(
          `Thanks! You rated ${rating.doctorName} ${rating.stars} star${rating.stars === 1 ? '' : 's'}.`
        )

        loadDoctors()

      } catch (error) {

        setRatingError(error.message)

      } finally {

        setRatingSaving(false)

      }

    }


  const getAvailabilityDays =
    doctor => {

      if (!doctor.availableDays) {

        return 'Availability not configured'

      }

      return doctor.availableDays
        .split(',')
        .map(day => day.trim())
        .join(' · ')

    }


  /* =====================================================
     NAVIGATION
     ===================================================== */

  const handleNavigation =
    page => {

      setActivePage(page)

      setMessage('')

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })

    }


  /* =====================================================
     PROFILE PAGE
     ===================================================== */

  const renderProfile =
    () => {

      return (

        <section className="mq-section">

          <div className="mq-section-heading">

            <div>

              <div className="mq-section-kicker">
                ACCOUNT
              </div>

              <h3>
                My Profile
              </h3>

              <p>
                View your registered account information.
              </p>

            </div>

          </div>


          <div className="mq-queue-card">

            <div
              style={{
                padding: '30px'
              }}
            >

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  marginBottom: '25px'
                }}
              >

                <div className="mq-doctor-avatar large">

                  {user?.name
                    ?.charAt(0)
                    .toUpperCase() || 'U'}

                </div>

                <div>

                  <h3
                    style={{
                      margin: 0,
                      fontSize: '18px'
                    }}
                  >
                    {user?.name}
                  </h3>

                  <p
                    style={{
                      margin: '4px 0 0',
                      color: '#718096',
                      fontSize: '12px'
                    }}
                  >
                    Patient Account
                  </p>

                </div>

              </div>


              <div className="mq-queue-meta">

                <div>

                  <span>
                    Full Name
                  </span>

                  <strong>
                    {user?.name || '-'}
                  </strong>

                </div>


                <div>

                  <span>
                    Email
                  </span>

                  <strong>
                    {user?.email || '-'}
                  </strong>

                </div>


                <div>

                  <span>
                    Phone
                  </span>

                  <strong>
                    {user?.phone || '-'}
                  </strong>

                </div>

              </div>

            </div>

          </div>

        </section>

      )

    }


  /* =====================================================
     SETTINGS PAGE
     ===================================================== */

  const renderSettings =
    () => {

      return (

        <section className="mq-section">

          <div className="mq-section-heading">

            <div>

              <div className="mq-section-kicker">
                ACCOUNT
              </div>

              <h3>
                Settings
              </h3>

              <p>
                Manage your MedQueue preferences.
              </p>

            </div>

          </div>


          <div className="mq-queue-card">

            <div
              style={{
                padding: '25px'
              }}
            >

              <div
                style={{
                  padding: '15px 0',
                  borderBottom:
                    '1px solid #edf0f4'
                }}
              >

                <strong
                  style={{
                    display: 'block',
                    fontSize: '12px'
                  }}
                >
                  Appointment Notifications
                </strong>

                <span
                  style={{
                    display: 'block',
                    marginTop: '4px',
                    color: '#718096',
                    fontSize: '12px'
                  }}
                >
                  Queue and appointment updates
                  will appear in your dashboard.
                </span>

              </div>


              <div
                style={{
                  padding: '15px 0'
                }}
              >

                <strong
                  style={{
                    display: 'block',
                    fontSize: '12px'
                  }}
                >
                  Account Security
                </strong>

                <span
                  style={{
                    display: 'block',
                    marginTop: '4px',
                    color: '#718096',
                    fontSize: '12px'
                  }}
                >
                  Your account is protected by
                  JWT authentication.
                </span>

              </div>

            </div>

          </div>

        </section>

      )

    }


  /* =====================================================
     PRESCRIPTIONS PAGE
     ===================================================== */

  const renderPrescriptions =
    () => {

      return (

        <section className="mq-section">

          <div className="mq-section-heading">

            <div>

              <div className="mq-section-kicker">
                HEALTH RECORDS
              </div>

              <h3>
                Prescriptions
              </h3>

              <p>
                Prescriptions written by your doctors for each visit.
              </p>

            </div>

            <span className="mq-count-pill">
              {prescriptions.length} total
            </span>

          </div>


          {prescriptions.length === 0 ? (

            <div className="mq-empty-state">

              <div className="mq-empty-icon">
                ⌁
              </div>

              <h4>
                No prescriptions yet
              </h4>

              <p>
                Prescriptions will appear here
                after your doctor completes a consultation.
              </p>

            </div>

          ) : (

            prescriptions.map(
              prescription => (

                <div
                  key={prescription.id}
                  className="mq-queue-card"
                  style={{
                    padding: '6px 18px 18px',
                    marginBottom: '14px'
                  }}
                >

                  <PrescriptionCard
                    prescription={prescription}
                  />



                </div>

              )
            )

          )}

        </section>

      )

    }

  /* =====================================================
     DASHBOARD
     ===================================================== */

  const renderDashboard =
    () => {

      return (

        <>

          {/* WELCOME */}

          <section className="mq-welcome-section">

            <div>

              <div className="mq-eyebrow">
                PATIENT PORTAL
              </div>

              <h2 className="mq-welcome-title">
                Good day,{' '}
                {user?.name?.split(' ')[0] ||
                  'Patient'}{' '}
                👋
              </h2>

              <p className="mq-welcome-text">
                Find the right doctor, book an
                appointment, and stay updated
                with your queue.
              </p>

            </div>


            <div className="mq-welcome-date">

              <div className="mq-date-icon">
                ▣
              </div>

              <div>

                <span>
                  Today
                </span>

                <strong>
                  {new Date()
                    .toLocaleDateString(
                      'en-IN',
                      {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                      }
                    )}
                </strong>

              </div>

            </div>

          </section>


          {/* ALERT */}

          {message && (

            <div
              className={
                success
                  ? 'mq-alert success'
                  : 'mq-alert danger'
              }
            >

              <span>
                {success ? '✓' : '!'}
              </span>

              <div>
                {message}
              </div>

              <button
                type="button"
                onClick={() =>
                  setMessage('')
                }
              >
                ×
              </button>

            </div>

          )}


          {/* RATE RECENT VISIT */}

          {unratedVisits.length > 0 && (

            <div className="mq-alert success">

              <span>
                ★
              </span>

              <div>
                How was your visit with{' '}
                <strong>{unratedVisits[0].doctorName}</strong>
                {' on '}
                {formatDate(unratedVisits[0].appointmentDate)}?
              </div>

              <button
                type="button"
                style={{
                  width: 'auto',
                  padding: '0 10px',
                  fontWeight: 700
                }}
                onClick={() =>
                  openRating(unratedVisits[0])
                }
              >
                Rate now
              </button>

            </div>

          )}


          {/* STATS */}

          <section className="mq-stats-grid">

            <StatCard
              title="Upcoming"
              value={
                upcomingAppointments.length
              }
              subtitle="Active appointments"
              icon="◷"
              type="blue"
            />

            <StatCard
              title="Next Token"
              value={
                nextAppointment
                  ? `#${nextAppointment.tokenNumber}`
                  : '—'
              }
              subtitle={
                nextAppointment
                  ? nextAppointment.doctorName
                  : 'No appointment'
              }
              icon="#"
              type="purple"
            />

            <StatCard
              title="Completed"
              value={
                completedAppointments.length
              }
              subtitle="Past consultations"
              icon="✓"
              type="green"
            />

            <StatCard
              title="Doctors"
              value={doctors.length}
              subtitle="Available doctors"
              icon="♙"
              type="orange"
            />

          </section>


          {/* ACTIVE QUEUE */}

          {nextAppointment && (

            <section className="mq-section">

              <div className="mq-section-heading">

                <div>

                  <div className="mq-section-kicker">
                    LIVE QUEUE
                  </div>

                  <h3>
                    Your active appointment
                  </h3>

                </div>


                <button
                  type="button"
                  className="mq-outline-button"
                  onClick={() =>
                    loadQueueStatus(
                      nextAppointment
                    )
                  }
                >
                  Refresh Queue
                </button>

              </div>


              <div className="mq-queue-card">

                <div className="mq-queue-main">

                  <div className="mq-token-panel">

                    <span>
                      Your token
                    </span>

                    <strong>
                      #{nextAppointment.tokenNumber}
                    </strong>

                    <small>
                      {nextAppointment.doctorName}
                    </small>

                  </div>


                  <div className="mq-queue-details">

                    <div className="mq-queue-doctor">

                      <div className="mq-doctor-avatar large">

                        {nextAppointment.doctorName
                          ?.replace('Dr. ', '')
                          .charAt(0)
                          .toUpperCase()}

                      </div>

                      <div>

                        <strong>
                          {nextAppointment.doctorName}
                        </strong>

                        <span>
                          {nextAppointment.specialization}
                        </span>

                      </div>

                    </div>


                    <div className="mq-queue-meta">

                      <div>

                        <span>
                          Appointment
                        </span>

                        <strong>
                          {formatDate(
                            nextAppointment.appointmentDate
                          )}
                        </strong>

                      </div>


                      <div>

                        <span>
                          Time
                        </span>

                        <strong>
                          {formatTime(
                            nextAppointment.appointmentTime
                          )}
                        </strong>

                      </div>


                      <div>

                        <span>
                          Status
                        </span>

                        <StatusBadge
                          status={
                            nextAppointment.status
                          }
                        />

                      </div>

                    </div>

                  </div>

                </div>


                {queueStatus &&
                  queueStatus.appointmentId === nextAppointment.id && (

                  <QueueTracker
                    queueStatus={queueStatus}
                    appointment={nextAppointment}
                    lastUpdated={queueLastUpdated}
                    now={now}
                    onCheckIn={(arrival, minutes) =>
                      checkIn(nextAppointment, arrival, minutes)
                    }
                    checkInBusy={checkInBusy}
                  />

                )}

              </div>

            </section>

          )}


          {/* FIND DOCTOR */}

          <section className="mq-section">

            <div className="mq-section-heading">

              <div>

                <div className="mq-section-kicker">
                  FIND CARE
                </div>

                <h3>
                  Find a doctor
                </h3>

                <p>
                  Search by doctor name or
                  medical specialty.
                </p>

              </div>

            </div>


            <div className="mq-search-panel">

              <div className="mq-search-box">

                <span>
                  ⌕
                </span>

                <input
                  type="text"
                  placeholder="Search doctors or specialties..."
                  value={doctorSearch}
                  onChange={e =>
                    setDoctorSearch(
                      e.target.value
                    )
                  }
                />

              </div>


              <select
                className="mq-filter-select"
                value={
                  specializationFilter
                }
                onChange={e =>
                  setSpecializationFilter(
                    e.target.value
                  )
                }
              >

                <option value="ALL">
                  All Specializations
                </option>

                {specializations.map(
                  specialization => (

                    <option
                      key={specialization}
                      value={specialization}
                    >
                      {specialization}
                    </option>

                  )
                )}

              </select>

            </div>


            <div className="mq-doctor-grid">

              {filteredDoctors.length === 0 ? (

                <div className="mq-empty-state">

                  <div className="mq-empty-icon">
                    ♙
                  </div>

                  <h4>
                    No doctors found
                  </h4>

                  <p>
                    Try another search
                    or specialization.
                  </p>

                </div>

              ) : (

                filteredDoctors.map(
                  doctor => (

                    <div
                      className="mq-doctor-card"
                      key={doctor.id}
                    >

                      <div className="mq-doctor-card-top">

                        <div className="mq-doctor-avatar">

                          {doctor.name
                            ?.replace('Dr. ', '')
                            .charAt(0)
                            .toUpperCase()}

                        </div>


                        <div className="mq-doctor-rating">

                          <span style={{ color: '#f59e0b' }}>
                            ★
                          </span>

                          <span>
                            {doctor.ratingCount
                              ? `${doctor.averageRating.toFixed(1)} (${doctor.ratingCount})`
                              : 'New'}
                          </span>

                        </div>

                      </div>


                      <div className="mq-doctor-card-body">

                        <h4>
                          {doctor.name}
                        </h4>

                        <p className="mq-doctor-specialty">
                          {doctor.specialization}
                        </p>


                        <div className="mq-doctor-info">

                          <div>

                            <span>
                              Consultation
                            </span>

                            <strong>
                              {doctor.consultationTime || 15}
                              {' min'}
                            </strong>

                          </div>


                          <div>

                            <span>
                              Hours
                            </span>

                            <strong>
                              {doctor.availableTime || '—'}
                            </strong>

                          </div>

                        </div>


                        <div className="mq-doctor-availability">

                          <span className="availability-dot"></span>

                          <span>
                            {getAvailabilityDays(
                              doctor
                            )}
                          </span>

                        </div>


                        {nextFree[doctor.id] && (

                          <button
                            type="button"
                            className="mq-next-free"
                            onClick={() =>
                              openBooking(doctor, nextFree[doctor.id])
                            }
                          >
                            ⚡ Next free: {friendlyDay(nextFree[doctor.id].date)},{' '}
                            {formatTime(nextFree[doctor.id].time)}
                          </button>

                        )}

                      </div>


                      <button
                        type="button"
                        className="mq-primary-button full"
                        onClick={() =>
                          openBooking(doctor)
                        }
                      >
                        Book Appointment
                        <span>
                          →
                        </span>
                      </button>

                    </div>

                  )
                )

              )}

            </div>

          </section>

        </>

      )

    }


  /* =====================================================
     APPOINTMENTS PAGE
     ===================================================== */

  const renderAppointments =
    () => {

      return (

        <section className="mq-section">

          <div className="mq-section-heading">

            <div>

              <div className="mq-section-kicker">
                APPOINTMENTS
              </div>

              <h3>
                My appointments
              </h3>

              <p>
                Track your upcoming and active
                appointments.
              </p>

            </div>

            <span className="mq-count-pill">
              {appointments.length} total
            </span>

          </div>


          <div className="mq-appointment-list">

            {appointments.length === 0 ? (

              <div className="mq-empty-state compact">

                <div className="mq-empty-icon">
                  ◷
                </div>

                <h4>
                  No appointments
                </h4>

                <p>
                  You have no appointments yet.
                </p>

              </div>

            ) : (

              appointments.map(
                appointment => (

                  <div
                    className="mq-appointment-row"
                    key={appointment.id}
                  >

                    <div className="mq-appointment-date">

                      <strong>
                        {new Date(
                          `${appointment.appointmentDate}T00:00:00`
                        ).getDate()}
                      </strong>

                      <span>
                        {new Date(
                          `${appointment.appointmentDate}T00:00:00`
                        ).toLocaleDateString(
                          'en-IN',
                          {
                            month: 'short'
                          }
                        )}
                      </span>

                    </div>


                    <div className="mq-appointment-doctor">

                      <div className="mq-doctor-avatar small">

                        {appointment.doctorName
                          ?.replace('Dr. ', '')
                          .charAt(0)
                          .toUpperCase()}

                      </div>

                      <div>

                        <strong>
                          {appointment.doctorName}
                        </strong>

                        <span>
                          {appointment.specialization}
                        </span>

                      </div>

                    </div>


                    <div className="mq-appointment-time">

                      <span>
                        Time
                      </span>

                      <strong>
                        {formatTime(
                          appointment.appointmentTime
                        )}
                      </strong>

                    </div>


                    <div className="mq-token-badge">

                      <span>
                        Token
                      </span>

                      <strong>
                        #{appointment.tokenNumber}
                      </strong>

                    </div>


                    <StatusBadge
                      status={
                        displayStatus(appointment)
                      }
                    />


                    <div className="mq-appointment-actions">

                      {!isStale(appointment) &&
                        appointment.status !==
                        'COMPLETED' &&
                        appointment.status !==
                          'CANCELLED' &&
                        appointment.status !==
                          'SKIPPED' && (

                          <button
                            type="button"
                            className="mq-small-button primary"
                            onClick={() =>
                              loadQueueStatus(
                                appointment
                              )
                            }
                          >
                            Queue
                          </button>

                        )}


                      {appointment.status ===
                        'BOOKED' &&
                        !isStale(appointment) && (

                        <button
                          type="button"
                          className="mq-small-button"
                          onClick={() =>
                            openReschedule(appointment)
                          }
                        >
                          Reschedule
                        </button>

                      )}


                      {appointment.status ===
                        'BOOKED' &&
                        !isStale(appointment) && (

                        <button
                          type="button"
                          className="mq-small-button danger"
                          onClick={() =>
                            cancelAppointment(
                              appointment.id
                            )
                          }
                        >
                          Cancel
                        </button>

                      )}

                    </div>

                  </div>

                )
              )

            )}

          </div>

        </section>

      )

    }


  /* =====================================================
     DOCTORS PAGE
     ===================================================== */

  const renderDoctors =
    () => {

      return (

        <section className="mq-section">

          <div className="mq-section-heading">

            <div>

              <div className="mq-section-kicker">
                FIND CARE
              </div>

              <h3>
                Doctors
              </h3>

              <p>
                Browse doctors and book an
                appointment.
              </p>

            </div>

          </div>


          <div className="mq-search-panel">

            <div className="mq-search-box">

              <span>
                ⌕
              </span>

              <input
                type="text"
                placeholder="Search doctors or specialties..."
                value={doctorSearch}
                onChange={e =>
                  setDoctorSearch(
                    e.target.value
                  )
                }
              />

            </div>


            <select
              className="mq-filter-select"
              value={
                specializationFilter
              }
              onChange={e =>
                setSpecializationFilter(
                  e.target.value
                )
              }
            >

              <option value="ALL">
                All Specializations
              </option>

              {specializations.map(
                specialization => (

                  <option
                    key={specialization}
                    value={specialization}
                  >
                    {specialization}
                  </option>

                )
              )}

            </select>

          </div>


          <div className="mq-doctor-grid">

            {filteredDoctors.map(
              doctor => (

                <div
                  className="mq-doctor-card"
                  key={doctor.id}
                >

                  <div className="mq-doctor-card-top">

                    <div className="mq-doctor-avatar">
                      {doctor.name
                        ?.replace('Dr. ', '')
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="mq-doctor-rating">

                      <span style={{ color: '#f59e0b' }}>
                        ★
                      </span>

                      <span>
                        {doctor.ratingCount
                          ? `${doctor.averageRating.toFixed(1)} (${doctor.ratingCount})`
                          : 'New'}
                      </span>

                    </div>

                  </div>


                  <div className="mq-doctor-card-body">

                    <h4>
                      {doctor.name}
                    </h4>

                    <p className="mq-doctor-specialty">
                      {doctor.specialization}
                    </p>


                    <div className="mq-doctor-info">

                      <div>

                        <span>
                          Consultation
                        </span>

                        <strong>
                          {doctor.consultationTime || 15}
                          {' min'}
                        </strong>

                      </div>


                      <div>

                        <span>
                          Hours
                        </span>

                        <strong>
                          {doctor.availableTime || '—'}
                        </strong>

                      </div>

                    </div>


                    <div className="mq-doctor-availability">

                      <span className="availability-dot"></span>

                      <span>
                        {getAvailabilityDays(
                          doctor
                        )}
                      </span>

                    </div>


                    {nextFree[doctor.id] && (

                      <button
                        type="button"
                        className="mq-next-free"
                        onClick={() =>
                          openBooking(doctor, nextFree[doctor.id])
                        }
                      >
                        ⚡ Next free: {friendlyDay(nextFree[doctor.id].date)},{' '}
                        {formatTime(nextFree[doctor.id].time)}
                      </button>

                    )}

                  </div>


                  <button
                    type="button"
                    className="mq-primary-button full"
                    onClick={() =>
                      openBooking(doctor)
                    }
                  >
                    Book Appointment
                    <span>
                      →
                    </span>
                  </button>

                </div>

              )
            )}

          </div>

        </section>

      )

    }


  /* =====================================================
     HISTORY PAGE
     ===================================================== */

  const renderHistory =
    () => {

      const visits =
        historyFilter === 'ALL'
          ? pastVisits
          : pastVisits.filter(
              visit =>
                displayStatus(visit) === historyFilter
            )

      return (

        <section className="mq-section">

          <div className="mq-section-heading">

            <div>

              <div className="mq-section-kicker">
                HISTORY
              </div>

              <h3>
                Visit history
              </h3>

              <p>
                All your past visits with prescriptions and ratings.
              </p>

            </div>


            <select
              className="mq-filter-select"
              value={historyFilter}
              onChange={e =>
                setHistoryFilter(
                  e.target.value
                )
              }
            >
              <option value="ALL">All visits</option>
              <option value="COMPLETED">Completed</option>
              <option value="SKIPPED">Skipped</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="EXPIRED">Not completed</option>
            </select>

          </div>


          <div className="mq-history-list">

            {visits.length === 0 ? (

              <div className="mq-empty-state compact">

                <div className="mq-empty-icon">
                  ✓
                </div>

                <h4>
                  No visits yet
                </h4>

                <p>
                  Your past appointments
                  will appear here.
                </p>

              </div>

            ) : (

              visits.map(
                visit => (

                  <div key={visit.id}>

                    <div className="mq-history-row">

                      <div className="mq-history-icon">
                        {visit.status === 'COMPLETED' ? '✓' : '–'}
                      </div>


                      <div className="mq-history-main">

                        <strong>
                          {visit.doctorName}
                        </strong>

                        <span>
                          {visit.specialization}
                          {' · Token #'}
                          {visit.tokenNumber}
                          {visit.autoClosed
                            ? ' · closed automatically'
                            : ''}
                          {visit.consultationMinutes
                            ? ` · ${visit.consultationMinutes} min`
                            : ''}
                        </span>

                      </div>


                      <div className="mq-history-date">

                        {formatDate(
                          visit.appointmentDate
                        )}
                        {' · '}
                        {formatTime(
                          visit.appointmentTime
                        )}

                      </div>


                      <StatusBadge
                        status={
                          displayStatus(visit)
                        }
                      />


                      <div
                        className="mq-appointment-actions"
                        style={{
                          alignItems: 'center'
                        }}
                      >

                        {visit.prescription && (

                          <button
                            type="button"
                            className="mq-small-button primary"
                            onClick={() =>
                              setExpandedVisitId(
                                expandedVisitId === visit.id
                                  ? null
                                  : visit.id
                              )
                            }
                          >
                            {expandedVisitId === visit.id
                              ? 'Hide ℞'
                              : 'View ℞'}
                          </button>

                        )}


                        {visit.rating ? (

                          <StarRating
                            value={visit.rating.stars}
                            size={14}
                          />

                        ) : visit.status === 'COMPLETED' && (

                          <button
                            type="button"
                            className="mq-small-button"
                            onClick={() =>
                              openRating(visit)
                            }
                          >
                            ★ Rate
                          </button>

                        )}

                      </div>

                    </div>


                    {expandedVisitId === visit.id && (

                      <div
                        style={{
                          padding: '0 16px 16px'
                        }}
                      >

                        <PrescriptionCard
                          prescription={visit.prescription}
                        />

                      </div>

                    )}

                  </div>

                )
              )

            )}

          </div>

        </section>

      )

    }

  /* =====================================================
     MAIN CONTENT SWITCH
     ===================================================== */

  const renderPage =
    () => {

      if (
        activePage ===
        'Doctors'
      ) {
        return renderDoctors()
      }

      if (
        activePage ===
        'Appointments'
      ) {
        return renderAppointments()
      }

      if (
        activePage ===
        'Prescriptions'
      ) {
        return renderPrescriptions()
      }

      if (
        activePage ===
        'History'
      ) {
        return renderHistory()
      }

      if (
        activePage ===
        'Profile'
      ) {
        return renderProfile()
      }

      if (
        activePage ===
        'Settings'
      ) {
        return renderSettings()
      }

      return renderDashboard()

    }


  /* =====================================================
     RENDER
     ===================================================== */

  return (

    <div className="mq-app-shell">

      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigation}
        user={user}
      />


      <main className="mq-main">

        <Topbar
          title={
            activePage === 'Dashboard'
              ? 'Patient Dashboard'
              : activePage
          }
          subtitle={
            activePage === 'Dashboard'
              ? 'Manage your appointments and track your queue'
              : `Manage your ${activePage.toLowerCase()}`
          }
          user={user}
          onLogout={logout}
        />


        <div className="mq-content">

          {renderPage()}

        </div>

      </main>


      {/* =================================================
          BOOKING MODAL
          ================================================= */}

      {selectedDoctor && (

        <div className="mq-modal-backdrop">

          <div className="mq-modal">

            <div className="mq-modal-header">

              <div>

                <span className="mq-section-kicker">
                  {rescheduleTarget ? 'RESCHEDULE' : 'NEW APPOINTMENT'}
                </span>

                <h3>
                  {rescheduleTarget ? 'Move your appointment' : `Book with ${selectedDoctor.name}`}
                </h3>

                {rescheduleTarget && (
                  <p className="mq-reschedule-note">
                    Currently {friendlyDay(rescheduleTarget.appointmentDate)},{' '}
                    {formatTime(rescheduleTarget.appointmentTime)} with {rescheduleTarget.doctorName}.
                    Pick a new slot below.
                  </p>
                )}

              </div>


              <button
                type="button"
                className="mq-modal-close"
                onClick={closeBooking}
              >
                ×
              </button>

            </div>


            <div className="mq-modal-doctor">

              <div className="mq-doctor-avatar">

                {selectedDoctor.name
                  ?.replace('Dr. ', '')
                  .charAt(0)
                  .toUpperCase()}

              </div>


              <div>

                <strong>
                  {selectedDoctor.name}
                </strong>

                <span>
                  {selectedDoctor.specialization}
                </span>

                <small>
                  Available:
                  {' '}
                  {selectedDoctor.availableDays ||
                    'Not configured'}
                  {' · '}
                  {selectedDoctor.availableTime ||
                    'Not configured'}
                </small>

              </div>

            </div>


            <div className="mq-form-grid">

              <div className="mq-form-group">

                <label>
                  Appointment Date
                </label>

                <input
                  type="date"
                  value={appointmentDate}
                  min={todayDate}
                  onChange={e => {

                    setAppointmentDate(
                      e.target.value
                    )

                    setAppointmentTime('')

                  }}
                />

              </div>


              <div
                className="mq-form-group"
                style={{
                  gridColumn: '1 / -1'
                }}
              >

                <label>
                  Appointment Time
                </label>

                {!appointmentDate ? (

                  <p style={{ fontSize: '12px', color: '#718096', margin: '8px 0 0' }}>
                    Choose a date to see free slots.
                  </p>

                ) : slotsLoading ? (

                  <p style={{ fontSize: '12px', color: '#718096', margin: '8px 0 0' }}>
                    Loading slots...
                  </p>

                ) : slots.length === 0 ? (

                  <p style={{ fontSize: '12px', color: '#b45309', margin: '8px 0 0' }}>
                    The doctor is not available on this day.
                  </p>

                ) : !slots.some(slot => slot.available) ? (

                  <p style={{ fontSize: '12px', color: '#b45309', margin: '8px 0 0' }}>
                    All slots are booked for this day. Please pick another date.
                  </p>

                ) : (

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
                      gap: '6px',
                      marginTop: '6px',
                      maxHeight: '180px',
                      overflowY: 'auto'
                    }}
                  >

                    {slots.map(slot => {

                      const value =
                        slot.time.slice(0, 5)

                      const selected =
                        appointmentTime === value

                      return (

                        <button
                          key={value}
                          type="button"
                          disabled={!slot.available}
                          onClick={() =>
                            setAppointmentTime(value)
                          }
                          title={
                            slot.available
                              ? 'Available'
                              : 'Already booked or past'
                          }
                          style={{
                            padding: '7px 4px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: slot.available ? 'pointer' : 'not-allowed',
                            border: selected
                              ? '1px solid #0f766e'
                              : '1px solid #dbe3ea',
                            background: selected
                              ? '#0f766e'
                              : slot.available ? '#fff' : '#f1f5f9',
                            color: selected
                              ? '#fff'
                              : slot.available ? '#172033' : '#a0aec0',
                            textDecoration: slot.available ? 'none' : 'line-through'
                          }}
                        >
                          {formatTime(value)}
                        </button>

                      )
                    })}

                  </div>

                )}

              </div>

            </div>


            <div className="mq-modal-note">

              <span>
                i
              </span>

              <p>
                Appointment availability is
                verified using the doctor's
                configured schedule.
              </p>

            </div>


            <div className="mq-modal-actions">

              <button
                type="button"
                className="mq-outline-button"
                onClick={closeBooking}
              >
                Cancel
              </button>


              <button
                type="button"
                className="mq-primary-button"
                disabled={loading || !appointmentTime}
                onClick={bookAppointment}
              >
                {loading
                  ? (rescheduleTarget ? 'Moving...' : 'Booking...')
                  : (rescheduleTarget ? 'Move appointment' : 'Confirm Appointment')}
              </button>

            </div>

          </div>

        </div>

      )}


      {/* =================================================
          BOOKING CONFIRMATION
          ================================================= */}

      {bookingConfirmation && (

        <div className="mq-modal-backdrop">

          <div className="mq-modal mq-confirm-modal">

            <div className="mq-confirm-icon">
              ✓
            </div>

            <h3>
              {bookingConfirmation.rescheduled
                ? 'Appointment moved'
                : "You're booked!"}
            </h3>

            <div className="mq-confirm-token">
              <span>Your token</span>
              <strong>#{bookingConfirmation.tokenNumber}</strong>
            </div>

            <div className="mq-confirm-details">

              <div>
                <span>Doctor</span>
                <strong>{bookingConfirmation.doctorName}</strong>
                <small>{bookingConfirmation.specialization}</small>
              </div>

              <div>
                <span>When</span>
                <strong>
                  {friendlyDay(bookingConfirmation.appointmentDate)},{' '}
                  {formatTime(bookingConfirmation.appointmentTime)}
                </strong>
                <small>{formatDate(bookingConfirmation.appointmentDate)}</small>
              </div>

            </div>

            <p className="mq-confirm-hint">
              On the day, tap <strong>I've arrived</strong> when you reach the clinic
              so the doctor knows you're there.
            </p>

            <div className="mq-modal-actions">

              <button
                type="button"
                className="mq-outline-button"
                onClick={() =>
                  downloadCalendarFile(
                    bookingConfirmation,
                    bookingConfirmation.consultationMinutes
                  )
                }
              >
                📅 Add to calendar
              </button>

              <button
                type="button"
                className="mq-primary-button"
                onClick={() => {
                  setBookingConfirmation(null)
                  setActivePage('Appointments')
                }}
              >
                View my appointments
              </button>

            </div>

          </div>

        </div>

      )}


      {/* =================================================
          RATING MODAL
          ================================================= */}

      {ratingAppointment && (

        <div className="mq-modal-backdrop">

          <div className="mq-modal">

            <div className="mq-modal-header">

              <div>

                <span className="mq-section-kicker">
                  RATE YOUR VISIT
                </span>

                <h3>
                  {ratingAppointment.doctorName}
                </h3>

              </div>


              <button
                type="button"
                className="mq-modal-close"
                onClick={() =>
                  setRatingAppointment(null)
                }
              >
                ×
              </button>

            </div>


            <p
              style={{
                fontSize: '12px',
                color: '#718096'
              }}
            >
              {ratingAppointment.specialization}
              {' · '}
              {formatDate(ratingAppointment.appointmentDate)}
            </p>


            <div
              style={{
                textAlign: 'center',
                margin: '18px 0'
              }}
            >

              <StarRating
                value={ratingStars}
                onChange={setRatingStars}
                size={34}
              />

              <div
                style={{
                  marginTop: '6px',
                  fontSize: '12px',
                  color: '#718096'
                }}
              >
                {['Tap a star to rate', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][ratingStars]}
              </div>

            </div>


            <div className="mq-form-group">

              <label>
                Review (optional)
              </label>

              <textarea
                rows={3}
                maxLength={1000}
                value={ratingComment}
                placeholder="Share your experience with this doctor"
                onChange={e =>
                  setRatingComment(
                    e.target.value
                  )
                }
                style={{
                  width: '100%',
                  border: '1px solid #dbe3ea',
                  borderRadius: '9px',
                  padding: '10px',
                  fontFamily: 'inherit',
                  fontSize: '12px'
                }}
              />

            </div>


            {ratingError && (

              <div
                className="mq-alert danger"
                style={{
                  marginTop: '12px'
                }}
              >
                <span>!</span>
                <div>{ratingError}</div>
              </div>

            )}


            <div className="mq-modal-actions">

              <button
                type="button"
                className="mq-outline-button"
                onClick={() =>
                  setRatingAppointment(null)
                }
              >
                Cancel
              </button>


              <button
                type="button"
                className="mq-primary-button"
                disabled={ratingSaving}
                onClick={submitRating}
              >
                {ratingSaving
                  ? 'Submitting...'
                  : 'Submit Rating'}
              </button>

            </div>

          </div>

        </div>

      )}


      {/* =================================================
          QUEUE MODAL
          ================================================= */}

      {selectedAppointment &&
        queueStatus && (

          <div className="mq-modal-backdrop">

            <div className="mq-modal queue-modal">

              <div className="mq-modal-header">

                <div>

                  <span className="mq-section-kicker">
                    QUEUE STATUS
                  </span>

                  <h3>
                    Live appointment queue
                  </h3>

                </div>


                <button
                  type="button"
                  className="mq-modal-close"
                  onClick={() => {

                    setSelectedAppointment(
                      null
                    )

                    setQueueStatus(
                      null
                    )

                    setQueueLastUpdated(
                      null
                    )

                  }}
                >
                  ×
                </button>

              </div>


              <QueueTracker
                queueStatus={queueStatus}
                appointment={selectedAppointment}
                lastUpdated={queueLastUpdated}
                now={now}
                onCheckIn={(arrival, minutes) =>
                  checkIn(selectedAppointment, arrival, minutes)
                }
                checkInBusy={checkInBusy}
              />


              <div className="mq-modal-actions">

                <button
                  type="button"
                  className="mq-outline-button"
                  onClick={() =>
                    loadQueueStatus(
                      selectedAppointment
                    )
                  }
                >
                  Refresh Now
                </button>


                <button
                  type="button"
                  className="mq-primary-button"
                  onClick={() => {

                    setSelectedAppointment(
                      null
                    )

                    setQueueStatus(
                      null
                    )

                    setQueueLastUpdated(
                      null
                    )

                  }}
                >
                  Done
                </button>

              </div>

            </div>

          </div>

        )}

    </div>

  )

}


export default PatientDashboard

