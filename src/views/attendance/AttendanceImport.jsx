import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CProgress,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilCheckCircle, cilCloudUpload, cilWarning, cilX } from '@coreui/icons'
import { useSelector } from 'react-redux'

import { usePermission } from '../../hooks/usePermission'
import { MODULE } from '../../constants/modules'
import { parseAttendanceExcel } from '../../services/attendanceParser'
import { localAttendance } from '../../services/localAttendance'
import api from '../../services/api'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const thisYear = new Date().getFullYear()
const thisMonth = new Date().getMonth() + 1
const YEARS = [thisYear - 1, thisYear, thisYear + 1]

const STATUS_COLORS = {
  Present: 'success',
  Absent: 'danger',
  'Half Day': 'warning',
  'Weekly Off': 'secondary',
  Holiday: 'info',
  'On Leave': 'primary',
}

// Step indicator
const Step = ({ n, label, active, done }) => (
  <div className="d-flex align-items-center gap-2">
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: done
          ? 'var(--cui-success)'
          : active
            ? 'var(--cui-primary)'
            : 'var(--cui-border-color)',
        color: done || active ? '#fff' : 'var(--cui-body-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {done ? '✓' : n}
    </div>
    <span className={`small ${active ? 'fw-semibold' : 'text-body-secondary'}`}>{label}</span>
  </div>
)

const STEPS = ['Select Period', 'Upload & Validate', 'Preview', 'Confirm Import']

const AttendanceImport = () => {
  const navigate = useNavigate()
  const canEdit = usePermission(MODULE.ATTENDANCE, 'edit')
  const currentUser = useSelector((s) => s.user)

  const [step, setStep] = useState(0)
  const [year, setYear] = useState(thisYear)
  const [month, setMonth] = useState(thisMonth)

  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parseErrors, setParseErrors] = useState([])
  const [parseWarnings, setParseWarnings] = useState([])
  const [parsedRows, setParsedRows] = useState([])
  const [periodMismatch, setPeriodMismatch] = useState(null) // { detectedYear, detectedMonth }

  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)

  const fileInputRef = useRef(null)

  if (!canEdit) {
    return (
      <CAlert color="danger">
        <strong>Access Denied.</strong> Only HR may import attendance.
      </CAlert>
    )
  }

  const handleFileDrop = (e) => {
    e.preventDefault()
    const dropped = e.dataTransfer?.files[0] || e.target.files[0]
    if (!dropped) return
    if (!dropped.name.match(/\.(xlsx|xls)$/i)) {
      setParseErrors(['Only .xlsx or .xls files are accepted.'])
      return
    }
    setFile(dropped)
    setParseErrors([])
    setParseWarnings([])
  }

  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    setParseErrors([])
    setParsedRows([])
    setPeriodMismatch(null)
    try {
      const { rows, errors, warnings, detectedYear, detectedMonth } =
        await parseAttendanceExcel(file)
      setParseErrors(errors)
      setParseWarnings(warnings)
      setParsedRows(rows)

      if (errors.length === 0 && rows.length > 0) {
        // Auto-fill period from file; warn if it doesn't match user selection
        if (detectedYear && detectedMonth) {
          if (detectedYear !== year || detectedMonth !== month) {
            setPeriodMismatch({ detectedYear, detectedMonth })
          }
          setYear(detectedYear)
          setMonth(detectedMonth)
        }
        setStep(2)
      }
    } catch (err) {
      setParseErrors([err.message])
    } finally {
      setParsing(false)
    }
  }

  const handleConfirmImport = async () => {
    setSaving(true)
    try {
      try {
        await api.post('/attendance/import', {
          file_name: file.name,
          year,
          month,
          rows: parsedRows,
        })
      } catch {
        localAttendance.saveImport({
          fileName: file.name,
          year,
          month,
          uploadedBy: currentUser?.full_name || currentUser?.employee_id || 'HR',
          parsedRows,
        })
      }
      setSaveResult({ success: true, count: parsedRows.length })
      setStep(3)
    } catch (err) {
      setSaveResult({ success: false, message: err.message })
    } finally {
      setSaving(false)
    }
  }

  // Summary counts for preview
  const statusCounts = parsedRows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})
  const uniqueEmployees = [...new Set(parsedRows.map((r) => r.employee_id))].length

  return (
    <>
      <CRow className="mb-3 align-items-center">
        <CCol>
          <CButton
            color="link"
            className="ps-0 text-decoration-none"
            onClick={() => navigate('/attendance')}
          >
            <CIcon icon={cilArrowLeft} className="me-1" />
            Back to Attendance
          </CButton>
        </CCol>
      </CRow>

      <h4 className="mb-3">Import Attendance Excel</h4>

      {/* Step indicator */}
      <CCard className="mb-4">
        <CCardBody className="py-3">
          <div className="d-flex gap-4 flex-wrap">
            {STEPS.map((label, i) => (
              <Step key={label} n={i + 1} label={label} active={step === i} done={step > i} />
            ))}
          </div>
          <CProgress
            value={((step + 1) / STEPS.length) * 100}
            className="mt-3"
            style={{ height: 4 }}
          />
        </CCardBody>
      </CCard>

      {/* Step 0: Select Period */}
      {step === 0 && (
        <CCard>
          <CCardHeader>
            <strong>Step 1 — Select Month &amp; Year</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className="g-3 mb-4">
              <CCol md={3}>
                <label className="fw-semibold small mb-1 d-block">Month</label>
                <CFormSelect value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <label className="fw-semibold small mb-1 d-block">Year</label>
                <CFormSelect value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
            </CRow>
            <CButton color="primary" onClick={() => setStep(1)}>
              Continue →
            </CButton>
          </CCardBody>
        </CCard>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <CCard>
          <CCardHeader>
            <strong>
              Step 2 — Upload Pace Excel File ({MONTHS[month - 1]} {year})
            </strong>
          </CCardHeader>
          <CCardBody>
            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--cui-border-color)',
                borderRadius: 8,
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--cui-tertiary-bg, #f8f9fa)',
              }}
            >
              <CIcon icon={cilCloudUpload} style={{ width: 40, height: 40, opacity: 0.4 }} />
              <div className="mt-2 fw-semibold">
                {file ? file.name : 'Drop your Excel file here, or click to browse'}
              </div>
              <div className="text-body-secondary small mt-1">Accepts .xlsx and .xls</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileDrop}
              />
            </div>

            {parseErrors.length > 0 && (
              <CAlert color="danger" className="mt-3">
                <CIcon icon={cilX} className="me-2" />
                <strong>Validation errors:</strong>
                <ul className="mb-0 mt-1">
                  {parseErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </CAlert>
            )}

            {parseWarnings.length > 0 && (
              <CAlert color="warning" className="mt-3 small">
                <CIcon icon={cilWarning} className="me-2" />
                <strong>Warnings ({parseWarnings.length}):</strong>
                <ul className="mb-0 mt-1">
                  {parseWarnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {parseWarnings.length > 5 && <li>…and {parseWarnings.length - 5} more</li>}
                </ul>
              </CAlert>
            )}

            <div className="d-flex gap-2 mt-3">
              <CButton color="secondary" variant="outline" onClick={() => setStep(0)}>
                ← Back
              </CButton>
              <CButton color="primary" onClick={handleParse} disabled={!file || parsing}>
                {parsing && <CSpinner size="sm" className="me-2" />}
                Validate &amp; Parse
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <CCard>
          <CCardHeader>
            <strong>
              Step 3 — Preview ({parsedRows.length} records, {uniqueEmployees} employees)
            </strong>
          </CCardHeader>
          <CCardBody>
            {/* Period auto-detected banner */}
            {periodMismatch ? (
              <CAlert color="warning" className="small mb-3 py-2">
                <CIcon icon={cilWarning} className="me-1" />
                Period mismatch: you selected{' '}
                <strong>
                  {MONTHS[month - 1]} {year}
                </strong>{' '}
                but the file contains data for{' '}
                <strong>
                  {MONTHS[periodMismatch.detectedMonth - 1]} {periodMismatch.detectedYear}
                </strong>
                . Period has been auto-corrected to match the file.
              </CAlert>
            ) : (
              <CAlert color="success" className="small mb-3 py-2">
                Period auto-detected from file:{' '}
                <strong>
                  {MONTHS[month - 1]} {year}
                </strong>
              </CAlert>
            )}

            {/* Quick summary */}
            <div className="d-flex flex-wrap gap-2 mb-3">
              {Object.entries(statusCounts).map(([status, count]) => (
                <CBadge
                  key={status}
                  color={STATUS_COLORS[status] || 'secondary'}
                  className="fs-6 px-3 py-1"
                >
                  {status}: {count}
                </CBadge>
              ))}
            </div>

            {parseWarnings.length > 0 && (
              <CAlert color="warning" className="small mb-3 py-2">
                <CIcon icon={cilWarning} className="me-1" />
                {parseWarnings.length} rows were skipped (duplicates or empty IDs).
              </CAlert>
            )}

            {/* Preview table — first 50 rows */}
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <CTable hover responsive bordered small>
                <CTableHead color="light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <CTableRow>
                    <CTableHeaderCell>Emp ID</CTableHeaderCell>
                    <CTableHeaderCell>Name</CTableHeaderCell>
                    <CTableHeaderCell>Date</CTableHeaderCell>
                    <CTableHeaderCell>Status</CTableHeaderCell>
                    <CTableHeaderCell>In</CTableHeaderCell>
                    <CTableHeaderCell>Out</CTableHeaderCell>
                    <CTableHeaderCell>Duration</CTableHeaderCell>
                    <CTableHeaderCell>Late By</CTableHeaderCell>
                    <CTableHeaderCell>Overtime</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {parsedRows.slice(0, 50).map((r, i) => (
                    <CTableRow key={i}>
                      <CTableDataCell className="fw-semibold">{r.employee_id}</CTableDataCell>
                      <CTableDataCell>{r.employee_name || '—'}</CTableDataCell>
                      <CTableDataCell>{r.date}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={STATUS_COLORS[r.status] || 'secondary'}>{r.status}</CBadge>
                      </CTableDataCell>
                      <CTableDataCell>{r.in_time || '—'}</CTableDataCell>
                      <CTableDataCell>{r.out_time || '—'}</CTableDataCell>
                      <CTableDataCell>{r.work_duration || '—'}</CTableDataCell>
                      <CTableDataCell>
                        {r.late_by ? <CBadge color="warning">{r.late_by}</CBadge> : '—'}
                      </CTableDataCell>
                      <CTableDataCell>{r.overtime || '—'}</CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </div>
            {parsedRows.length > 50 && (
              <p className="text-body-secondary small mt-2">
                Showing first 50 of {parsedRows.length} records.
              </p>
            )}

            <div className="d-flex gap-2 mt-3">
              <CButton color="secondary" variant="outline" onClick={() => setStep(1)}>
                ← Back
              </CButton>
              <CButton color="success" onClick={handleConfirmImport} disabled={saving}>
                {saving && <CSpinner size="sm" className="me-2" />}
                <CIcon icon={cilCheckCircle} className="me-1" />
                Confirm Import
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      )}

      {/* Step 3: Done */}
      {step === 3 && (
        <CCard>
          <CCardBody className="text-center py-5">
            {saveResult?.success ? (
              <>
                <CIcon
                  icon={cilCheckCircle}
                  style={{ width: 56, height: 56, color: 'var(--cui-success)' }}
                />
                <h5 className="mt-3">Import Successful</h5>
                <p className="text-body-secondary">
                  {saveResult.count} attendance records imported for {MONTHS[month - 1]} {year}.
                </p>
                <div className="d-flex gap-2 justify-content-center mt-3">
                  <CButton color="primary" onClick={() => navigate('/attendance')}>
                    View Attendance
                  </CButton>
                  <CButton
                    color="secondary"
                    variant="outline"
                    onClick={() => {
                      setStep(0)
                      setFile(null)
                      setParsedRows([])
                      setParseErrors([])
                      setParseWarnings([])
                      setSaveResult(null)
                    }}
                  >
                    Import Another
                  </CButton>
                </div>
              </>
            ) : (
              <>
                <CIcon icon={cilX} style={{ width: 56, height: 56, color: 'var(--cui-danger)' }} />
                <h5 className="mt-3">Import Failed</h5>
                <p className="text-body-secondary">{saveResult?.message}</p>
                <CButton color="secondary" onClick={() => setStep(2)}>
                  ← Back
                </CButton>
              </>
            )}
          </CCardBody>
        </CCard>
      )}
    </>
  )
}

export default AttendanceImport
