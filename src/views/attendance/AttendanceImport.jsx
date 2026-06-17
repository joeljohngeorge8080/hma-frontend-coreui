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
import {
  cilArrowLeft,
  cilCheckCircle,
  cilCloudUpload,
  cilInfo,
  cilWarning,
  cilX,
} from '@coreui/icons'
import { useSelector } from 'react-redux'

import { usePermission } from '../../hooks/usePermission'
import { MODULE } from '../../constants/modules'
import { parseAttendanceExcel } from '../../services/attendanceParser'
import { localAttendance } from '../../services/localAttendance'
import api from '../../services/api'

// ─── Business Rules (from 03_Business_Rules.md) ───────────────────────────────
const SHIFT_START_MINUTES = 9 * 60 + 15 // 09:15
const FREE_LATE_UNITS = 7 // free late-entry units per month
const LATE_UNIT_MINUTES = 15 // 1 unit = 15 minutes
const HALF_DAY_LATE_THRESHOLD = 60 // >60 min late → must be Half Day

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toMin = (hhmm) => {
  if (!hhmm) return 0
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const fmtHHMM = (totalMin) => {
  if (!totalMin) return '00:00'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Apply business rules to a flat array of daily records and produce per-employee summary
const buildEmployeeSummaries = (rows) => {
  const map = {}

  for (const r of rows) {
    if (!map[r.employee_id]) {
      map[r.employee_id] = {
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        present: 0,
        absent: 0,
        half_day: 0,
        weekly_off: 0,
        holiday: 0,
        on_leave: 0,
        late_days: 0,
        total_late_minutes: 0,
        total_work_minutes: 0,
        work_days_with_duration: 0,
        // Days where Pace marked the employee as Present but late > 60 min
        // → business rule says should be Half Day
        half_day_rule_violations: [],
      }
    }

    const e = map[r.employee_id]

    switch (r.status) {
      case 'Present':
        e.present++
        break
      case 'Absent':
        e.absent++
        break
      case 'Half Day':
        e.half_day++
        break
      case 'Weekly Off':
        e.weekly_off++
        break
      case 'Holiday':
        e.holiday++
        break
      case 'On Leave':
        e.on_leave++
        break
    }

    if (r.late_by) {
      const lateMin = toMin(r.late_by)
      if (lateMin > 0) {
        e.late_days++
        e.total_late_minutes += lateMin

        // Half-day rule: >60 min late should be Half Day
        if (lateMin > HALF_DAY_LATE_THRESHOLD && r.status === 'Present') {
          e.half_day_rule_violations.push({ date: r.date, late_by: r.late_by })
        }
      }
    }

    if (r.work_duration) {
      const wMin = toMin(r.work_duration)
      if (wMin > 0) {
        e.total_work_minutes += wMin
        e.work_days_with_duration++
      }
    }
  }

  return Object.values(map)
    .map((e) => {
      // Late entry analysis per business rules
      const totalLateUnits = Math.ceil(e.total_late_minutes / LATE_UNIT_MINUTES)
      const freeUnitsUsed = Math.min(FREE_LATE_UNITS, totalLateUnits)
      const excessUnits = Math.max(0, totalLateUnits - FREE_LATE_UNITS)
      const excessMinutes = excessUnits * LATE_UNIT_MINUTES
      const avgWorkMin =
        e.work_days_with_duration > 0
          ? Math.round(e.total_work_minutes / e.work_days_with_duration)
          : 0

      return {
        ...e,
        total_late_units: totalLateUnits,
        free_units_used: freeUnitsUsed,
        free_units_remaining: Math.max(0, FREE_LATE_UNITS - totalLateUnits),
        excess_units: excessUnits,
        excess_minutes: excessMinutes,
        avg_work_hhmm: fmtHHMM(avgWorkMin),
        total_late_hhmm: fmtHHMM(e.total_late_minutes),
      }
    })
    .sort((a, b) => a.employee_id.localeCompare(b.employee_id))
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Step indicator ───────────────────────────────────────────────────────────

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

const STEPS = [
  'Select Period',
  'Upload & Validate',
  'Preview',
  'Employee Analysis',
  'Confirm & Import',
]

// ─── Main component ───────────────────────────────────────────────────────────

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
  const [periodMismatch, setPeriodMismatch] = useState(null)

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

  // ── File handling ────────────────────────────────────────────────────────────

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

  // ── Parse ────────────────────────────────────────────────────────────────────

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

  // ── Confirm import ───────────────────────────────────────────────────────────

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
      setStep(4)
    } catch (err) {
      setSaveResult({ success: false, message: err.message })
      setStep(4)
    } finally {
      setSaving(false)
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const statusCounts = parsedRows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})
  const uniqueEmployees = [...new Set(parsedRows.map((r) => r.employee_id))].length

  // Only computed when entering step 3 (employee analysis)
  const employeeSummaries = step >= 3 ? buildEmployeeSummaries(parsedRows) : []
  const excessLateCount = employeeSummaries.filter((e) => e.excess_units > 0).length
  const hdViolationCount = employeeSummaries.filter(
    (e) => e.half_day_rule_violations.length > 0,
  ).length

  // ── Render ────────────────────────────────────────────────────────────────────

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

      {/* ── Step 0: Select Period ─────────────────────────────────────────────── */}
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

      {/* ── Step 1: Upload ────────────────────────────────────────────────────── */}
      {step === 1 && (
        <CCard>
          <CCardHeader>
            <strong>
              Step 2 — Upload Pace Excel File ({MONTHS[month - 1]} {year})
            </strong>
          </CCardHeader>
          <CCardBody>
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

      {/* ── Step 2: Raw Preview ───────────────────────────────────────────────── */}
      {step === 2 && (
        <CCard>
          <CCardHeader>
            <strong>
              Step 3 — Preview ({parsedRows.length} records, {uniqueEmployees} employees)
            </strong>
          </CCardHeader>
          <CCardBody>
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
                    <CTableHeaderCell>OT</CTableHeaderCell>
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
              <CButton color="primary" onClick={() => setStep(3)}>
                Next: Employee Analysis →
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      )}

      {/* ── Step 3: Employee Analysis (Business Rules) ────────────────────────── */}
      {step === 3 && (
        <>
          {/* Business rules reference card */}
          <CCard className="mb-3 border-start border-start-info border-4">
            <CCardBody className="py-2 px-3">
              <div className="d-flex align-items-start gap-2">
                <CIcon icon={cilInfo} className="text-info mt-1 flex-shrink-0" />
                <div className="small">
                  <strong className="d-block mb-1">
                    Attendance Rules Applied (03_Business_Rules.md)
                  </strong>
                  <span className="text-body-secondary">
                    Shift: 09:15–17:45 &nbsp;|&nbsp; Free late-entry units: 7/month (1 unit = 15
                    min) &nbsp;|&nbsp; Excess units: salary deduction at hourly rate &nbsp;|&nbsp;
                    &gt;60 min late = Half Day (4-hr deduction)
                  </span>
                </div>
              </div>
            </CCardBody>
          </CCard>

          {/* Alert banners */}
          {(excessLateCount > 0 || hdViolationCount > 0) && (
            <CRow className="g-2 mb-3">
              {excessLateCount > 0 && (
                <CCol>
                  <CAlert color="danger" className="mb-0 py-2 small">
                    <CIcon icon={cilWarning} className="me-1" />
                    <strong>
                      {excessLateCount} employee{excessLateCount > 1 ? 's' : ''}
                    </strong>{' '}
                    have exceeded the 7 free late-entry units — salary deduction required.
                  </CAlert>
                </CCol>
              )}
              {hdViolationCount > 0 && (
                <CCol>
                  <CAlert color="warning" className="mb-0 py-2 small">
                    <CIcon icon={cilWarning} className="me-1" />
                    <strong>
                      {hdViolationCount} employee{hdViolationCount > 1 ? 's' : ''}
                    </strong>{' '}
                    arrived &gt;60 min late but were not marked Half Day — review before confirming.
                  </CAlert>
                </CCol>
              )}
            </CRow>
          )}

          <CCard>
            <CCardHeader className="d-flex align-items-center justify-content-between">
              <strong>
                Employee Analysis — {MONTHS[month - 1]} {year}
              </strong>
              <span className="text-body-secondary small">
                {employeeSummaries.length} employees
              </span>
            </CCardHeader>
            <CCardBody className="p-0">
              <div style={{ overflowX: 'auto' }}>
                <CTable hover bordered small className="mb-0" style={{ minWidth: 900 }}>
                  <CTableHead color="light">
                    <CTableRow>
                      <CTableHeaderCell rowSpan={2} className="align-middle">
                        Employee
                      </CTableHeaderCell>
                      <CTableHeaderCell colSpan={6} className="text-center border-start">
                        Attendance
                      </CTableHeaderCell>
                      <CTableHeaderCell colSpan={4} className="text-center border-start">
                        Late Entry (Rule: 7 free units × 15 min)
                      </CTableHeaderCell>
                      <CTableHeaderCell rowSpan={2} className="align-middle border-start">
                        Avg Hours
                      </CTableHeaderCell>
                    </CTableRow>
                    <CTableRow>
                      {/* Attendance sub-headers */}
                      <CTableHeaderCell className="border-start text-success">P</CTableHeaderCell>
                      <CTableHeaderCell className="text-danger">A</CTableHeaderCell>
                      <CTableHeaderCell className="text-warning">HD</CTableHeaderCell>
                      <CTableHeaderCell className="text-secondary">W/Off</CTableHeaderCell>
                      <CTableHeaderCell className="text-primary">Leave</CTableHeaderCell>
                      <CTableHeaderCell className="text-info">Holiday</CTableHeaderCell>
                      {/* Late entry sub-headers */}
                      <CTableHeaderCell className="border-start">Days</CTableHeaderCell>
                      <CTableHeaderCell>Total Late</CTableHeaderCell>
                      <CTableHeaderCell>Units (/ 7 free)</CTableHeaderCell>
                      <CTableHeaderCell>Excess / Penalty</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {employeeSummaries.map((e) => {
                      const hasExcess = e.excess_units > 0
                      const hasHdViolation = e.half_day_rule_violations.length > 0
                      return (
                        <CTableRow
                          key={e.employee_id}
                          className={hasExcess || hasHdViolation ? 'table-warning' : ''}
                        >
                          {/* Employee */}
                          <CTableDataCell style={{ minWidth: 180 }}>
                            <div className="fw-semibold">{e.employee_id}</div>
                            <div className="text-body-secondary small">{e.employee_name}</div>
                            {hasHdViolation && (
                              <CBadge color="danger" className="mt-1 small">
                                HD rule: {e.half_day_rule_violations.length} day
                                {e.half_day_rule_violations.length > 1 ? 's' : ''}
                              </CBadge>
                            )}
                          </CTableDataCell>

                          {/* Attendance counts */}
                          <CTableDataCell className="text-center border-start">
                            <CBadge color="success">{e.present}</CBadge>
                          </CTableDataCell>
                          <CTableDataCell className="text-center">
                            {e.absent > 0 ? (
                              <CBadge color="danger">{e.absent}</CBadge>
                            ) : (
                              <span className="text-body-secondary">0</span>
                            )}
                          </CTableDataCell>
                          <CTableDataCell className="text-center">
                            {e.half_day > 0 ? (
                              <CBadge color="warning">{e.half_day}</CBadge>
                            ) : (
                              <span className="text-body-secondary">0</span>
                            )}
                          </CTableDataCell>
                          <CTableDataCell className="text-center text-body-secondary">
                            {e.weekly_off}
                          </CTableDataCell>
                          <CTableDataCell className="text-center">
                            {e.on_leave > 0 ? (
                              <CBadge color="primary">{e.on_leave}</CBadge>
                            ) : (
                              <span className="text-body-secondary">0</span>
                            )}
                          </CTableDataCell>
                          <CTableDataCell className="text-center text-body-secondary">
                            {e.holiday}
                          </CTableDataCell>

                          {/* Late entry */}
                          <CTableDataCell className="text-center border-start">
                            {e.late_days > 0 ? (
                              <CBadge color="warning">{e.late_days}</CBadge>
                            ) : (
                              <span className="text-body-secondary">0</span>
                            )}
                          </CTableDataCell>
                          <CTableDataCell className="text-center small">
                            {e.total_late_minutes > 0 ? e.total_late_hhmm : '—'}
                          </CTableDataCell>
                          <CTableDataCell className="text-center">
                            {e.total_late_units === 0 ? (
                              <span className="text-body-secondary small">—</span>
                            ) : (
                              <div style={{ minWidth: 100 }}>
                                <div className="d-flex justify-content-between small mb-1">
                                  <span>{e.free_units_used} used</span>
                                  <span
                                    className={
                                      hasExcess ? 'text-danger fw-semibold' : 'text-success'
                                    }
                                  >
                                    {hasExcess
                                      ? `+${e.excess_units} over`
                                      : `${e.free_units_remaining} left`}
                                  </span>
                                </div>
                                <CProgress
                                  value={Math.min(
                                    100,
                                    (e.total_late_units / FREE_LATE_UNITS) * 100,
                                  )}
                                  color={
                                    hasExcess
                                      ? 'danger'
                                      : e.free_units_used >= 5
                                        ? 'warning'
                                        : 'success'
                                  }
                                  style={{ height: 6 }}
                                />
                              </div>
                            )}
                          </CTableDataCell>
                          <CTableDataCell className="text-center">
                            {hasExcess ? (
                              <div>
                                <CBadge color="danger" className="d-block mb-1">
                                  {e.excess_units} units
                                </CBadge>
                                <span className="text-body-secondary small">
                                  ≈ {e.excess_minutes} min deductible
                                </span>
                              </div>
                            ) : (
                              <CBadge color="success">Within limit</CBadge>
                            )}
                          </CTableDataCell>

                          {/* Avg hours */}
                          <CTableDataCell className="text-center border-start small">
                            {e.work_days_with_duration > 0 ? e.avg_work_hhmm : '—'}
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>
              </div>
            </CCardBody>
          </CCard>

          {/* Half-day violation detail */}
          {hdViolationCount > 0 && (
            <CCard className="mt-3 border-warning">
              <CCardHeader className="bg-warning-subtle">
                <strong>
                  <CIcon icon={cilWarning} className="me-1" />
                  Half-Day Rule Violations
                </strong>
                <span className="text-body-secondary small ms-2">
                  Business rule: &gt;60 min late = Half Day (4-hr deduction)
                </span>
              </CCardHeader>
              <CCardBody className="p-0">
                <CTable small bordered className="mb-0">
                  <CTableHead color="light">
                    <CTableRow>
                      <CTableHeaderCell>Employee ID</CTableHeaderCell>
                      <CTableHeaderCell>Name</CTableHeaderCell>
                      <CTableHeaderCell>Date</CTableHeaderCell>
                      <CTableHeaderCell>Late By</CTableHeaderCell>
                      <CTableHeaderCell>Pace Status</CTableHeaderCell>
                      <CTableHeaderCell>Required Status</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {employeeSummaries
                      .filter((e) => e.half_day_rule_violations.length > 0)
                      .flatMap((e) =>
                        e.half_day_rule_violations.map((v) => (
                          <CTableRow key={`${e.employee_id}-${v.date}`}>
                            <CTableDataCell className="fw-semibold">{e.employee_id}</CTableDataCell>
                            <CTableDataCell>{e.employee_name}</CTableDataCell>
                            <CTableDataCell>{v.date}</CTableDataCell>
                            <CTableDataCell>
                              <CBadge color="danger">{v.late_by}</CBadge>
                            </CTableDataCell>
                            <CTableDataCell>
                              <CBadge color="success">Present</CBadge>
                            </CTableDataCell>
                            <CTableDataCell>
                              <CBadge color="warning">Half Day</CBadge>
                            </CTableDataCell>
                          </CTableRow>
                        )),
                      )}
                  </CTableBody>
                </CTable>
              </CCardBody>
            </CCard>
          )}

          <div className="d-flex gap-2 mt-3">
            <CButton color="secondary" variant="outline" onClick={() => setStep(2)}>
              ← Back
            </CButton>
            <CButton color="success" onClick={handleConfirmImport} disabled={saving}>
              {saving && <CSpinner size="sm" className="me-2" />}
              <CIcon icon={cilCheckCircle} className="me-1" />
              Confirm Import
            </CButton>
          </div>
        </>
      )}

      {/* ── Step 4: Done ──────────────────────────────────────────────────────── */}
      {step === 4 && (
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
                      setPeriodMismatch(null)
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
                <CButton color="secondary" onClick={() => setStep(3)}>
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
