import { useState } from 'react'
import { API_URL, takeSessionExpiredNotice } from './api.js'

function Login() {

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  // Explain an automatic logout once, then clear it
  const [message, setMessage] = useState(() =>
    takeSessionExpiredNotice()
      ? 'Your session has expired. Please sign in again.'
      : ''
  )
  const [loading, setLoading] = useState(false)

  // 'login' or 'register'
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const isRegister = mode === 'register'

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setMessage('')
    setPassword('')
    setConfirmPassword('')
  }

  const readError = (responseText, fallback) => {
    try {
      const errorData = JSON.parse(responseText)
      return errorData.message || fallback
    } catch {
      return fallback
    }
  }

  const login = async (e) => {

    e.preventDefault()

    setMessage('')
    setLoading(true)

    try {

      // Create the patient account first, then sign in with it
      if (isRegister) {

        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.')
        }

        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.')
        }

        const registerResponse = await fetch(
          `${API_URL}/api/auth/register`,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json'
            },

            body: JSON.stringify({
              name: name.trim(),
              email: email.trim(),
              phone: phone.trim(),
              password: password
            })
          }
        )

        if (!registerResponse.ok) {
          throw new Error(
            readError(
              await registerResponse.text(),
              'Registration failed. Please try again.'
            )
          )
        }
      }

      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            email: email.trim(),
            password: password
          })
        }
      )

      const responseText = await response.text()

      if (!response.ok) {

        let errorMessage =
          'Invalid email or password.'

        try {

          const errorData =
            JSON.parse(responseText)

          if (errorData.message) {
            errorMessage = errorData.message
          }

        } catch {
          // Response was not JSON
        }

        throw new Error(errorMessage)
      }

      const data = JSON.parse(responseText)

      // Store JWT separately
      localStorage.setItem(
        'token',
        data.token
      )

      // Store complete user information
      localStorage.setItem(
        'user',
        JSON.stringify(data)
      )

      // Reload so App.jsx selects the correct dashboard
      window.location.reload()

    } catch (error) {

      console.error(error)

      setMessage(
        error.message ||
        'Unable to login. Please try again.'
      )

    } finally {

      setLoading(false)

    }

  }


  return (

    <div className="mq-login-page">

      {/* =====================================================
          LEFT BRAND PANEL
      ====================================================== */}

      <div className="mq-login-brand">

        <div className="mq-brand-content">

          <div className="mq-brand-logo">

            <div className="mq-logo-symbol">
              +
            </div>

            <div>
              <div className="mq-brand-name">
                MedQueue
              </div>

              <div className="mq-brand-tagline">
                Smart healthcare. Simple queues.
              </div>
            </div>

          </div>


          <div className="mq-brand-main">

            <span className="mq-eyebrow">
              SMART CLINIC MANAGEMENT
            </span>

            <h1>
              Healthcare
              <br />
              without the
              <br />
              waiting room.
            </h1>

            <p>
              Manage appointments, tokens and
              patient queues from one simple
              healthcare platform.
            </p>

          </div>


          <div className="mq-brand-features">

            <div className="mq-feature">

              <div className="mq-feature-icon">
                ✓
              </div>

              <div>
                <strong>
                  Smart appointments
                </strong>

                <span>
                  Book and manage appointments easily
                </span>
              </div>

            </div>


            <div className="mq-feature">

              <div className="mq-feature-icon">
                #
              </div>

              <div>
                <strong>
                  Live queue tracking
                </strong>

                <span>
                  Know your position before you arrive
                </span>
              </div>

            </div>


            <div className="mq-feature">

              <div className="mq-feature-icon">
                +
              </div>

              <div>
                <strong>
                  Connected care
                </strong>

                <span>
                  Patients and doctors in one system
                </span>

              </div>

            </div>

          </div>

        </div>

      </div>


      {/* =====================================================
          RIGHT LOGIN PANEL
      ====================================================== */}

      <div className="mq-login-panel">

        <div className="mq-login-card">


          <div className="mq-mobile-logo">

            <div className="mq-logo-symbol">
              +
            </div>

            <span>
              MedQueue
            </span>

          </div>


          <div className="mq-login-heading">

            <span className="mq-small-label">
              {isRegister ? 'NEW PATIENT' : 'WELCOME BACK'}
            </span>

            <h2>
              {isRegister
                ? 'Create your account'
                : 'Sign in to MedQueue'}
            </h2>

            <p>
              {isRegister
                ? 'Register as a patient to book appointments and track your queue.'
                : 'Access your healthcare dashboard securely.'}
            </p>

          </div>


          {message && (

            <div className="mq-login-error">

              <span className="mq-error-icon">
                !
              </span>

              <span>
                {message}
              </span>

            </div>

          )}


          <form onSubmit={login}>


            {/* NAME (register only) */}

            {isRegister && (

              <div className="mq-form-group">

                <label>
                  Full name
                </label>

                <div className="mq-input-wrapper">

                  <span className="mq-input-icon">
                    ◉
                  </span>

                  <input
                    type="text"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    placeholder="Your full name"
                    autoComplete="name"
                    required
                  />

                </div>

              </div>

            )}


            {/* EMAIL */}

            <div className="mq-form-group">

              <label>
                Email address
              </label>

              <div className="mq-input-wrapper">

                <span className="mq-input-icon">
                  @
                </span>

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />

              </div>

            </div>


            {/* PHONE (register only) */}

            {isRegister && (

              <div className="mq-form-group">

                <label>
                  Phone number
                </label>

                <div className="mq-input-wrapper">

                  <span className="mq-input-icon">
                    ☎
                  </span>

                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value)
                    }
                    placeholder="10-digit mobile number"
                    autoComplete="tel"
                    required
                  />

                </div>

              </div>

            )}


            {/* PASSWORD */}

            <div className="mq-form-group">

              <div className="mq-password-label">

                <label>
                  Password
                </label>

              </div>


              <div className="mq-input-wrapper">

                <span className="mq-input-icon">
                  •
                </span>

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  placeholder={
                    isRegister
                      ? 'At least 6 characters'
                      : 'Enter your password'
                  }
                  autoComplete={
                    isRegister
                      ? 'new-password'
                      : 'current-password'
                  }
                  required
                />

                <button
                  type="button"
                  className="mq-password-toggle"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword
                    ? 'Hide'
                    : 'Show'}
                </button>

              </div>

            </div>


            {/* CONFIRM PASSWORD (register only) */}

            {isRegister && (

              <div className="mq-form-group">

                <label>
                  Confirm password
                </label>

                <div className="mq-input-wrapper">

                  <span className="mq-input-icon">
                    •
                  </span>

                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                  />

                </div>

              </div>

            )}


            {/* LOGIN */}

            <button
              type="submit"
              className="mq-login-button"
              disabled={loading}
            >

              {loading ? (

                <>

                  <span className="mq-spinner"></span>

                  {isRegister
                    ? 'Creating account...'
                    : 'Signing in...'}

                </>

              ) : (

                <>
                  {isRegister
                    ? 'Create account'
                    : 'Sign in'}
                  <span className="mq-button-arrow">
                    →
                  </span>
                </>

              )}

            </button>


          </form>


          {/* SWITCH BETWEEN SIGN IN AND REGISTER */}

          <div
            style={{
              marginTop: '18px',
              textAlign: 'center',
              fontSize: '13px',
              color: '#64748b'
            }}
          >

            {isRegister
              ? 'Already have an account? '
              : 'New patient? '}

            <button
              type="button"
              onClick={() =>
                switchMode(
                  isRegister
                    ? 'login'
                    : 'register'
                )
              }
              style={{
                border: 0,
                background: 'none',
                padding: 0,
                color: '#0f766e',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {isRegister
                ? 'Sign in'
                : 'Create an account'}
            </button>

          </div>


          <div className="mq-security-note">

            <span>
              🔒
            </span>

            <span>
              Your connection is secured with
              encrypted authentication.
            </span>

          </div>


          <div className="mq-login-footer">

            <span>
              MedQueue
            </span>

            <span>
              •
            </span>

            <span>
              Clinic Queue Management System
            </span>

          </div>


        </div>

      </div>


      {/* =====================================================
          STYLES
      ====================================================== */}

      <style>{`

        * {
          box-sizing: border-box;
        }

        .mq-login-page {
          min-height: 100vh;
          display: flex;
          background: #f5f8fa;
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        /* -----------------------------------------------
           BRAND PANEL
        ------------------------------------------------ */

        .mq-login-brand {
          width: 52%;
          min-height: 100vh;
          background:
            linear-gradient(
              145deg,
              #063b3f 0%,
              #07565a 55%,
              #08747a 100%
            );
          color: white;
          position: relative;
          overflow: hidden;
        }

        .mq-login-brand::before {
          content: "";
          position: absolute;
          width: 500px;
          height: 500px;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 50%;
          right: -220px;
          top: -180px;
        }

        .mq-login-brand::after {
          content: "";
          position: absolute;
          width: 380px;
          height: 380px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 50%;
          left: -180px;
          bottom: -160px;
        }

        .mq-brand-content {
          position: relative;
          z-index: 2;
          max-width: 680px;
          margin: 0 auto;
          padding: 55px 70px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .mq-brand-logo {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .mq-logo-symbol {
          width: 42px;
          height: 42px;
          background: #ffffff;
          color: #08747a;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
          box-shadow:
            0 8px 25px rgba(0,0,0,0.15);
        }

        .mq-brand-name {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        /* Light text on the dark brand panel (the shared stylesheet colours
           these classes for the light sidebar) */
        .mq-login-brand .mq-brand-name {
          color: #ffffff;
        }

        .mq-login-brand .mq-eyebrow {
          color: #a7f3d0;
          opacity: 1;
        }

        .mq-brand-tagline {
          font-size: 12px;
          opacity: 0.65;
          margin-top: 2px;
          letter-spacing: 0.3px;
        }

        .mq-brand-main {
          margin-top: auto;
          margin-bottom: 55px;
        }

        .mq-eyebrow {
          display: inline-block;
          font-size: 12px;
          letter-spacing: 2px;
          font-weight: 700;
          opacity: 0.65;
          margin-bottom: 20px;
        }

        .mq-brand-main h1 {
          font-size: clamp(42px, 4vw, 64px);
          line-height: 1.04;
          letter-spacing: -2.5px;
          margin: 0 0 24px;
          font-weight: 700;
        }

        .mq-brand-main p {
          font-size: 16px;
          line-height: 1.7;
          max-width: 470px;
          opacity: 0.76;
          margin: 0;
        }

        .mq-brand-features {
          display: flex;
          flex-direction: column;
          gap: 18px;
          margin-bottom: 10px;
        }

        .mq-feature {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .mq-feature-icon {
          width: 35px;
          height: 35px;
          border-radius: 10px;
          background: rgba(255,255,255,0.11);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
        }

        .mq-feature strong {
          display: block;
          font-size: 13px;
          margin-bottom: 2px;
        }

        .mq-feature span {
          display: block;
          font-size: 12px;
          opacity: 0.55;
        }

        /* -----------------------------------------------
           LOGIN PANEL
        ------------------------------------------------ */

        .mq-login-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 45px;
        }

        .mq-login-card {
          width: 100%;
          max-width: 440px;
        }

        .mq-mobile-logo {
          display: none;
        }

        .mq-login-heading {
          margin-bottom: 30px;
        }

        .mq-small-label {
          display: block;
          color: #08747a;
          font-size: 12px;
          letter-spacing: 1.7px;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .mq-login-heading h2 {
          color: #172b30;
          font-size: 31px;
          letter-spacing: -1px;
          margin: 0 0 8px;
          font-weight: 700;
        }

        .mq-login-heading p {
          color: #75858a;
          margin: 0;
          font-size: 14px;
        }

        /* -----------------------------------------------
           ERROR
        ------------------------------------------------ */

        .mq-login-error {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          margin-bottom: 20px;
          border-radius: 10px;
          background: #fff1f1;
          border: 1px solid #ffd5d5;
          color: #b42318;
          font-size: 13px;
        }

        .mq-error-icon {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #b42318;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 12px;
          flex-shrink: 0;
        }

        /* -----------------------------------------------
           FORM
        ------------------------------------------------ */

        .mq-form-group {
          margin-bottom: 20px;
        }

        .mq-form-group label {
          display: block;
          color: #34484d;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .mq-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .mq-input-icon {
          position: absolute;
          left: 15px;
          color: #8b9a9e;
          font-size: 15px;
          z-index: 2;
        }

        .mq-input-wrapper input {
          width: 100%;
          height: 50px;
          border: 1px solid #dce5e7;
          border-radius: 10px;
          background: white;
          color: #1c3035;
          padding: 0 15px 0 43px;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
        }

        .mq-input-wrapper input::placeholder {
          color: #aab5b8;
        }

        .mq-input-wrapper input:focus {
          border-color: #08747a;
          box-shadow:
            0 0 0 3px rgba(8,116,122,0.10);
        }

        .mq-password-toggle {
          position: absolute;
          right: 12px;
          border: none;
          background: transparent;
          color: #08747a;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        /* -----------------------------------------------
           BUTTON
        ------------------------------------------------ */

        .mq-login-button {
          width: 100%;
          height: 51px;
          border: none;
          border-radius: 10px;
          background: #08747a;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s ease;
          box-shadow:
            0 8px 20px rgba(8,116,122,0.18);
        }

        .mq-login-button:hover:not(:disabled) {
          background: #066166;
          transform: translateY(-1px);
          box-shadow:
            0 10px 24px rgba(8,116,122,0.23);
        }

        .mq-login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .mq-button-arrow {
          font-size: 19px;
          line-height: 0;
        }

        .mq-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: white;
          border-radius: 50%;
          animation: mq-spin 0.7s linear infinite;
        }

        @keyframes mq-spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* -----------------------------------------------
           SECURITY
        ------------------------------------------------ */

        .mq-security-note {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: 25px;
          color: #87979b;
          font-size: 12px;
          text-align: center;
        }

        .mq-login-footer {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 45px;
          color: #a0abad;
          font-size: 12px;
        }

        /* -----------------------------------------------
           RESPONSIVE
        ------------------------------------------------ */

        @media (max-width: 900px) {

          .mq-login-brand {
            width: 44%;
          }

          .mq-brand-content {
            padding: 40px;
          }

          .mq-brand-main h1 {
            font-size: 42px;
          }

          .mq-login-panel {
            padding: 35px;
          }

        }


        @media (max-width: 700px) {

          .mq-login-page {
            display: block;
            background: white;
          }

          .mq-login-brand {
            display: none;
          }

          .mq-login-panel {
            min-height: 100vh;
            padding: 30px 22px;
            align-items: flex-start;
          }

          .mq-login-card {
            max-width: 480px;
            margin: 0 auto;
            padding-top: 15px;
          }

          .mq-mobile-logo {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #173438;
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 55px;
          }

          .mq-mobile-logo .mq-logo-symbol {
            width: 38px;
            height: 38px;
            font-size: 24px;
            background: #08747a;
            color: white;
          }

          .mq-login-heading h2 {
            font-size: 27px;
          }

          .mq-login-footer {
            margin-top: 35px;
          }

        }

      `}</style>

    </div>

  )
}

export default Login