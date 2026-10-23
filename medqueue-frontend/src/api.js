
// One place for the backend address and login handling.
// Set VITE_API_URL (e.g. in .env.local) to point at another backend.
export const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:8080'
).replace(/\/$/, '')

const EXPIRED_NOTICE_KEY = 'mq-session-expired'

export function getToken() {
  return localStorage.getItem('token')
}

// Reads the "exp" claim from the JWT (seconds since epoch); no verification,
// the backend still checks the token on every request
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    )

    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function isTokenExpired(token) {
  const expiry = getTokenExpiry(token)
  return expiry !== null && expiry <= Date.now()
}

export function logout(expired = false) {
  localStorage.removeItem('token')
  localStorage.removeItem('user')

  if (expired) {
    try {
      sessionStorage.setItem(EXPIRED_NOTICE_KEY, '1')
    } catch {
      // Notice is optional
    }
  }

  window.location.reload()
}

// True once after an automatic logout, so the login page can explain why
export function takeSessionExpiredNotice() {
  try {
    const expired = sessionStorage.getItem(EXPIRED_NOTICE_KEY) === '1'
    sessionStorage.removeItem(EXPIRED_NOTICE_KEY)
    return expired
  } catch {
    return false
  }
}

// Log out automatically the moment the token expires, even if the page is idle
export function scheduleExpiryLogout() {
  const token = getToken()
  const expiry = token ? getTokenExpiry(token) : null

  if (!expiry) return () => {}

  // setTimeout cannot wait longer than ~24.8 days
  const delay = Math.min(Math.max(0, expiry - Date.now()), 2 ** 31 - 1)
  const timer = setTimeout(() => logout(true), delay)

  return () => clearTimeout(timer)
}

// fetch() for the MedQueue API: accepts "/api/..." paths, adds the login
// token, and logs out if the backend says the login is no longer valid
export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`
  const token = getToken()

  const headers = new Headers(options.headers || {})

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, { ...options, headers })

  if (response.status === 401 && token) {
    logout(true)

    // The page is reloading to the login screen; don't let callers show errors
    return new Promise(() => {})
  }

  return response
}
