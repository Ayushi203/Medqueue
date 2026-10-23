import { useState } from 'react'
import { API_URL } from './api.js'

function Register() {

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  const handleRegister = async (e) => {

    e.preventDefault()

    try {

      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            name: name,
            email: email,
            password: password,
            phone: phone,
            role: 'PATIENT'
          })
        }
      )

      if (!response.ok) {

        const errorText = await response.text()

        throw new Error(
          errorText || 'Registration failed'
        )
      }

      alert('Registration successful!')

      setName('')
      setEmail('')
      setPhone('')
      setPassword('')

    } catch (error) {

      alert(error.message)

    }
  }

  return (

    <div className="container mt-5">

      <div className="row justify-content-center">

        <div className="col-md-5">

          <div className="card shadow">

            <div className="card-body p-4">

              <h2 className="text-center text-primary mb-4">
                Patient Registration
              </h2>

              <form onSubmit={handleRegister}>

                <div className="mb-3">

                  <label className="form-label">
                    Full Name
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    required
                  />

                </div>

                <div className="mb-3">

                  <label className="form-label">
                    Email
                  </label>

                  <input
                    type="email"
                    className="form-control"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    required
                  />

                </div>

                <div className="mb-3">

                  <label className="form-label">
                    Phone
                  </label>

                  <input
                    type="tel"
                    className="form-control"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value)
                    }
                    required
                  />

                </div>

                <div className="mb-3">

                  <label className="form-label">
                    Password
                  </label>

                  <input
                    type="password"
                    className="form-control"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    required
                  />

                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                >
                  Register
                </button>

              </form>

            </div>

          </div>

        </div>

      </div>

    </div>

  )
}

export default Register