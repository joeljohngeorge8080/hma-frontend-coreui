import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser } from '@coreui/icons'

import { loginApi } from '../../../services/auth'

const Login = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgotMsg, setShowForgotMsg] = useState(false)

  const from = location.state?.from?.pathname || '/dashboard'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await loginApi(employeeId, password)
      localStorage.setItem('hma_token', data.access_token)
      dispatch({ type: 'set', user: data.user, token: data.access_token })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={5} lg={4}>
            <CCard className="p-4">
              <CCardBody>
                <CForm onSubmit={handleSubmit}>
                  <h2 className="fw-bold mb-0">HMA IEMS</h2>
                  <p className="text-body-secondary mb-4">Internal Enterprise Management System</p>

                  {error && (
                    <CAlert color="danger" dismissible onClose={() => setError('')}>
                      {error}
                    </CAlert>
                  )}

                  {showForgotMsg && (
                    <CAlert color="info" dismissible onClose={() => setShowForgotMsg(false)}>
                      Contact your HR administrator to reset your password.
                    </CAlert>
                  )}

                  <CInputGroup className="mb-3">
                    <CInputGroupText>
                      <CIcon icon={cilUser} />
                    </CInputGroupText>
                    <CFormInput
                      id="employee_id"
                      placeholder="Employee ID"
                      autoComplete="username"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      required
                    />
                  </CInputGroup>

                  <CInputGroup className="mb-4">
                    <CInputGroupText>
                      <CIcon icon={cilLockLocked} />
                    </CInputGroupText>
                    <CFormInput
                      type="password"
                      placeholder="Password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </CInputGroup>

                  <CRow className="align-items-center">
                    <CCol xs={6}>
                      <CButton color="primary" type="submit" className="px-4" disabled={loading}>
                        {loading && <CSpinner size="sm" className="me-2" />}
                        Login
                      </CButton>
                    </CCol>
                    <CCol xs={6} className="text-end">
                      <CButton
                        color="link"
                        className="px-0"
                        type="button"
                        onClick={() => setShowForgotMsg(true)}
                      >
                        Forgot password?
                      </CButton>
                    </CCol>
                  </CRow>
                </CForm>

                {import.meta.env.DEV && (
                  <>
                    <hr />
                    <CButton
                      color="secondary"
                      variant="outline"
                      size="sm"
                      className="w-100"
                      type="button"
                      onClick={() => {
                        dispatch({
                          type: 'set',
                          user: { employee_id: 'DEV001', full_name: 'Dev User', role: 'CEO' },
                          token: 'dev-token',
                        })
                        navigate('/dashboard')
                      }}
                    >
                      Dev Login (CEO)
                    </CButton>
                  </>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login
