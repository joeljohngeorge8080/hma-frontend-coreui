// Parses Pace Attendance Software Excel exports.
// Expects columns (any order, case-insensitive):
//   Employee ID, Employee Name, Date, Status,
//   In Time, Out Time, Work Duration, Late By, Early By, Overtime, Shift
//
// Returns { rows, errors, warnings } where rows are ready for localAttendance.saveImport

import * as XLSX from 'xlsx'

// Map of normalized header → internal field name
const HEADER_MAP = {
  'employee id': 'employee_id',
  employeeid: 'employee_id',
  'emp id': 'employee_id',
  empid: 'employee_id',
  'employee name': 'employee_name',
  name: 'employee_name',
  date: 'date',
  'attendance date': 'date',
  status: 'status',
  'in time': 'in_time',
  intime: 'in_time',
  'out time': 'out_time',
  outtime: 'out_time',
  'work duration': 'work_duration',
  workduration: 'work_duration',
  duration: 'work_duration',
  'late by': 'late_by',
  lateby: 'late_by',
  'early by': 'early_by',
  earlyby: 'early_by',
  overtime: 'overtime',
  ot: 'overtime',
  shift: 'shift',
}

const VALID_STATUSES = [
  'Present',
  'Absent',
  'Half Day',
  'On Leave',
  'Holiday',
  'Weekly Off',
  'WO',
  'P',
  'A',
  'HD',
  'L',
]

const STATUS_NORMALIZE = {
  P: 'Present',
  A: 'Absent',
  HD: 'Half Day',
  WO: 'Weekly Off',
  L: 'On Leave',
  LEAVE: 'On Leave',
  'ON LEAVE': 'On Leave',
  'WEEKLY OFF': 'Weekly Off',
  HOLIDAY: 'Holiday',
  PRESENT: 'Present',
  ABSENT: 'Absent',
  'HALF DAY': 'Half Day',
}

// Excel serial date → YYYY-MM-DD
const excelDateToISO = (serial) => {
  if (!serial) return null
  if (typeof serial === 'string') {
    // Already a string date — normalise to YYYY-MM-DD
    const d = new Date(serial)
    if (!isNaN(d)) return d.toISOString().split('T')[0]
    return serial
  }
  // Excel epoch: Dec 30, 1899
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
  return date.toISOString().split('T')[0]
}

// Normalise time values: may come as "08:30:00", "08:30", or Excel fraction
const normalizeTime = (val) => {
  if (val == null || val === '') return null
  if (typeof val === 'number') {
    // Excel time fraction (0–1)
    const totalMin = Math.round(val * 24 * 60)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const s = String(val).trim()
  // Keep HH:MM (drop seconds)
  const match = s.match(/^(\d{1,2}):(\d{2})/)
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : s
}

const normalizeStatus = (raw) => {
  if (!raw) return null
  const up = String(raw).trim().toUpperCase()
  return STATUS_NORMALIZE[up] || (VALID_STATUSES.includes(raw) ? raw : null)
}

export const parseAttendanceExcel = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false })
        const sheetName = wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })

        if (raw.length === 0) {
          return resolve({ rows: [], errors: ['The Excel file is empty.'], warnings: [] })
        }

        // Map column headers
        const firstRow = raw[0]
        const colMap = {}
        for (const col of Object.keys(firstRow)) {
          const norm = col.trim().toLowerCase()
          if (HEADER_MAP[norm]) colMap[col] = HEADER_MAP[norm]
        }

        const missing = ['employee_id', 'date', 'status'].filter(
          (f) => !Object.values(colMap).includes(f),
        )
        if (missing.length > 0) {
          return resolve({
            rows: [],
            errors: [
              `Missing required columns: ${missing.join(', ')}. ` +
                `Found columns: ${Object.keys(firstRow).join(', ')}`,
            ],
            warnings: [],
          })
        }

        const rows = []
        const errors = []
        const warnings = []
        const seen = new Set()

        raw.forEach((rawRow, i) => {
          const lineNo = i + 2 // 1-indexed + header
          const get = (field) => {
            const col = Object.keys(colMap).find((c) => colMap[c] === field)
            return col ? rawRow[col] : undefined
          }

          const employeeId = String(get('employee_id') || '').trim()
          const dateRaw = get('date')
          const statusRaw = get('status')

          if (!employeeId) {
            warnings.push(`Row ${lineNo}: empty Employee ID — skipped`)
            return
          }

          const date = excelDateToISO(dateRaw)
          if (!date) {
            errors.push(`Row ${lineNo} (${employeeId}): invalid or empty date`)
            return
          }

          const status = normalizeStatus(statusRaw)
          if (!status) {
            errors.push(`Row ${lineNo} (${employeeId} ${date}): unknown status "${statusRaw}"`)
            return
          }

          const key = `${employeeId}__${date}`
          if (seen.has(key)) {
            warnings.push(`Row ${lineNo}: duplicate record for ${employeeId} on ${date} — skipped`)
            return
          }
          seen.add(key)

          rows.push({
            employee_id: employeeId,
            employee_name: String(get('employee_name') || '').trim(),
            date,
            status,
            in_time: normalizeTime(get('in_time')),
            out_time: normalizeTime(get('out_time')),
            work_duration: normalizeTime(get('work_duration')),
            late_by: normalizeTime(get('late_by')),
            early_by: normalizeTime(get('early_by')),
            overtime: normalizeTime(get('overtime')),
            shift: String(get('shift') || '').trim(),
          })
        })

        resolve({ rows, errors, warnings })
      } catch (err) {
        reject(new Error(`Failed to parse Excel: ${err.message}`))
      }
    }
    reader.readAsArrayBuffer(file)
  })
