import { useEffect } from 'react'

import Login from './Login.jsx'
import { isTokenExpired, logout, scheduleExpiryLogout } from './api.js'
import PatientDashboard from './PatientDashboard.jsx'
import DoctorDashboard from './DoctorDashboard.jsx'
import AdminDashboard from './AdminDashboard.jsx'

// Saved user, or null if missing or unreadable (bad data is cleared)
function readStoredUser() {

  try {
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    return null
  }
}

function App() {

  const token = localStorage.getItem('token')
  const user = readStoredUser()

  const expired = Boolean(token) && isTokenExpired(token)

  // Send the user back to login as soon as their session runs out
  useEffect(() => {
    if (expired) {
      logout(true)
      return undefined
    }

    return scheduleExpiryLogout()
  }, [expired])

  if (!token || !user || expired) {
    return <Login />
  }

  if (user.role === 'PATIENT') {
    return <PatientDashboard />
  }

  if (user.role === 'DOCTOR') {
    return <DoctorDashboard />
  }

  if (user.role === 'ADMIN') {
    return <AdminDashboard />
  }

  return (
    <div className="container mt-5">
      <div className="alert alert-danger">
        Unknown user role: {user.role}
      </div>
    </div>
  )
}

export default App