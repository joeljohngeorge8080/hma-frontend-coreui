import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CCard,
  CCardBody,
  CCol,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import api from '../../../services/api'

const SUMMARY_CARDS = [
  { key: 'present_days', label: 'Present Days', color: 'success' },
  { key: 'absent_days', label: 'Absent Days', color: 'danger' },
  { key: 'weekly_off', label: 'Weekly Off', color: 'secondary' },
  { key: 'late_entries', label: 'Late Entries', color: 'warning' },
  { key: 'avg_working_hours', label: 'Avg Working Hours', color: 'info', suffix: 'hrs' },
]

const STATUS_COLORS = {
  Present: 'success',
  Absent: 'danger',
  'Half Day': 'warning',
  'Weekly Off': 'secondary',
  Holiday: 'info',
  'On Leave': 'primary',
}

const AttendanceSummaryTab = ({ employeeId }) => {
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      setError('')
      try {
        const [summaryRes, historyRes] = await Promise.all([
          api.get(`/employees/${employeeId}/attendance-summary`),
          api.get(`/attendance?employee_id=${employeeId}&page_size=30`),
        ])
        setSummary(summaryRes.data)
        setHistory(historyRes.data.items || [])
      } catch {
        setError('Failed to load attendance data')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [employeeId])

  if (loading) {
    return (
      <div className="text-center py-4">
        <CSpinner color="primary" size="sm" />
        <span className="ms-2 text-body-secondary">Loading attendance…</span>
      </div>
    )
  }

  if (error) {
    return <CAlert color="warning">{error}</CAlert>
  }

  return (
    <>
      <CAlert color="secondary" className="small mb-3 py-2">
        Attendance records are read-only in this view. Corrections must be submitted through the
        Attendance module.
      </CAlert>

      {/* Summary Cards */}
      <CRow className="g-3 mb-4">
        {SUMMARY_CARDS.map(({ key, label, color, suffix }) => (
          <CCol xs={6} md key={key}>
            <CCard className={`border-top border-top-${color} border-3 h-100`}>
              <CCardBody className="text-center py-3">
                <div className={`fs-3 fw-bold text-${color}`}>
                  {summary?.[key] ?? '—'}
                  {suffix && <span className="fs-6 ms-1 fw-normal">{suffix}</span>}
                </div>
                <div className="small text-body-secondary mt-1">{label}</div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* Attendance History */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <strong>Attendance History</strong>
        <span className="text-body-secondary small">Last 30 records</span>
      </div>

      {history.length === 0 ? (
        <p className="text-body-secondary">No attendance records found.</p>
      ) : (
        <CTable hover responsive bordered small>
          <CTableHead color="light">
            <CTableRow>
              <CTableHeaderCell>Date</CTableHeaderCell>
              <CTableHeaderCell>Status</CTableHeaderCell>
              <CTableHeaderCell>In Time</CTableHeaderCell>
              <CTableHeaderCell>Out Time</CTableHeaderCell>
              <CTableHeaderCell>Working Hours</CTableHeaderCell>
              <CTableHeaderCell>Late Entry</CTableHeaderCell>
              <CTableHeaderCell>Remarks</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {history.map((rec) => (
              <CTableRow key={rec.id}>
                <CTableDataCell className="fw-semibold">{rec.date}</CTableDataCell>
                <CTableDataCell>
                  <CBadge color={STATUS_COLORS[rec.status] || 'secondary'}>{rec.status}</CBadge>
                </CTableDataCell>
                <CTableDataCell>{rec.in_time || '—'}</CTableDataCell>
                <CTableDataCell>{rec.out_time || '—'}</CTableDataCell>
                <CTableDataCell>{rec.working_hours ? `${rec.working_hours}h` : '—'}</CTableDataCell>
                <CTableDataCell>
                  {rec.late_entry_minutes > 0 ? (
                    <CBadge color="warning">{rec.late_entry_minutes} min</CBadge>
                  ) : (
                    '—'
                  )}
                </CTableDataCell>
                <CTableDataCell className="text-body-secondary small">
                  {rec.remarks || '—'}
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      )}
    </>
  )
}

AttendanceSummaryTab.propTypes = {
  employeeId: PropTypes.string.isRequired,
}

export default AttendanceSummaryTab
