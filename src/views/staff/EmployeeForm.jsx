import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import {
  CAccordion,
  CAccordionBody,
  CAccordionHeader,
  CAccordionItem,
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormCheck,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilPlus, cilTrash } from '@coreui/icons'

import { usePermission } from '../../hooks/usePermission'
import { MODULE } from '../../constants/modules'
import api from '../../services/api'

// ─── constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ['Permanent', 'FTC', 'TPC']
const GENDERS = ['Male', 'Female', 'Other']
const STATUSES = ['Active', 'Inactive', 'Resigned', 'Retired']
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed']
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
const RELATIONSHIPS = [
  'Father',
  'Mother',
  'Spouse',
  'Son',
  'Daughter',
  'Brother',
  'Sister',
  'Other',
]

const EMPTY_ADDR = {
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  resident_location: '',
}
const EMPTY_BANK = { bank_name: '', account_number: '', ifsc_code: '', is_primary: true }
const EMPTY_FAMILY = {
  name: '',
  relationship: '',
  contact_number: '',
  date_of_birth: '',
  aadhar_number: '',
  pan_number: '',
}

const DEFAULT_VALUES = {
  employee_id: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  state_for_pt: '',
  designation: '',
  department: '',
  employee_category: '',
  gender: '',
  current_salary: '',
  status: 'Active',
  exit_date: '',
  date_of_birth: '',
  marital_status: '',
  blood_group: '',
  joining_date: '',
  reporting_to: '',
  contact: {
    personal_email: '',
    working_email: '',
    mobile_number: '',
    phone_number: '',
    emergency_contact_number: '',
  },
  present_address: { ...EMPTY_ADDR },
  permanent_address: { ...EMPTY_ADDR },
  identification: {
    pan_number: '',
    aadhar_number: '',
    uan_number: '',
    esi_number: '',
    pf_number: '',
    passport_number: '',
  },
  bank_accounts: [{ ...EMPTY_BANK }],
  family_members: [],
}

// ─── sub-components ──────────────────────────────────────────────────────────

const Field = ({ label, error, children, required, hint }) => (
  <div>
    <CFormLabel className={required ? 'fw-semibold' : ''}>
      {label}
      {required && <span className="text-danger ms-1">*</span>}
    </CFormLabel>
    {children}
    {error && (
      <CFormFeedback invalid className="d-block">
        {error.message}
      </CFormFeedback>
    )}
    {hint && !error && <div className="form-text">{hint}</div>}
  </div>
)

// ─── AddressBlock ─────────────────────────────────────────────────────────────

const AddressBlock = ({ prefix, label, register, errors }) => {
  const e = errors?.[prefix] || {}
  return (
    <div>
      <h6 className="fw-semibold border-bottom pb-2 mb-3">{label}</h6>
      <CRow className="g-3">
        <CCol md={12}>
          <Field label="Address Line 1" error={e.address_line1}>
            <CFormInput
              {...register(`${prefix}.address_line1`)}
              className={e.address_line1 ? 'is-invalid' : ''}
            />
          </Field>
        </CCol>
        <CCol md={12}>
          <Field label="Address Line 2" error={e.address_line2}>
            <CFormInput
              {...register(`${prefix}.address_line2`)}
              className={e.address_line2 ? 'is-invalid' : ''}
            />
          </Field>
        </CCol>
        <CCol md={4}>
          <Field label="City" error={e.city}>
            <CFormInput {...register(`${prefix}.city`)} className={e.city ? 'is-invalid' : ''} />
          </Field>
        </CCol>
        <CCol md={4}>
          <Field label="State" error={e.state}>
            <CFormInput {...register(`${prefix}.state`)} className={e.state ? 'is-invalid' : ''} />
          </Field>
        </CCol>
        <CCol md={4}>
          <Field label="Pincode" error={e.pincode}>
            <CFormInput
              {...register(`${prefix}.pincode`)}
              className={e.pincode ? 'is-invalid' : ''}
            />
          </Field>
        </CCol>
        <CCol md={6}>
          <Field label="Resident Location" error={e.resident_location}>
            <CFormInput
              {...register(`${prefix}.resident_location`)}
              className={e.resident_location ? 'is-invalid' : ''}
            />
          </Field>
        </CCol>
        <CCol md={6}>
          <Field label="Country" error={e.country}>
            <CFormInput
              {...register(`${prefix}.country`)}
              className={e.country ? 'is-invalid' : ''}
            />
          </Field>
        </CCol>
      </CRow>
    </div>
  )
}

// ─── EmployeeForm ─────────────────────────────────────────────────────────────

const EmployeeForm = () => {
  const { id } = useParams()
  const isEdit = Boolean(id && id !== 'new')
  const navigate = useNavigate()
  const canEdit = usePermission(MODULE.STAFF_PAYROLL, 'edit')

  const [fetching, setFetching] = useState(isEdit)
  const [fetchError, setFetchError] = useState('')
  const [submitError, setSubmitError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: DEFAULT_VALUES })

  const {
    fields: familyFields,
    append: appendFamily,
    remove: removeFamily,
  } = useFieldArray({ name: 'family_members' })

  const {
    fields: bankFields,
    append: appendBank,
    remove: removeBank,
  } = useFieldArray({ name: 'bank_accounts' })

  const watchedStatus = watch('status')

  useEffect(() => {
    if (!isEdit) return
    const load = async () => {
      setFetching(true)
      setFetchError('')
      try {
        const { data } = await api.get(`/employees/${id}`)
        reset({
          employee_id: data.employee_id || '',
          first_name: data.first_name || '',
          middle_name: data.middle_name || '',
          last_name: data.last_name || '',
          state_for_pt: data.state_for_pt || '',
          designation: data.designation || '',
          department: data.department || '',
          employee_category: data.employee_category || '',
          gender: data.gender || '',
          current_salary: data.current_salary || '',
          status: data.status || 'Active',
          exit_date: data.exit_date || '',
          date_of_birth: data.date_of_birth || '',
          marital_status: data.marital_status || '',
          blood_group: data.blood_group || '',
          joining_date: data.joining_date || '',
          reporting_to: data.reporting_to || '',
          contact: data.contact || DEFAULT_VALUES.contact,
          present_address: data.addresses?.find((a) => a.address_type === 'Present') || {
            ...EMPTY_ADDR,
          },
          permanent_address: data.addresses?.find((a) => a.address_type === 'Permanent') || {
            ...EMPTY_ADDR,
          },
          identification: data.identification || DEFAULT_VALUES.identification,
          bank_accounts: data.bank_accounts?.length ? data.bank_accounts : [{ ...EMPTY_BANK }],
          family_members: data.family_members || [],
        })
      } catch {
        setFetchError('Failed to load employee data. Please try again.')
      } finally {
        setFetching(false)
      }
    }
    load()
  }, [id, isEdit, reset])

  if (!canEdit) {
    return (
      <CAlert color="danger">
        <strong>Access Denied.</strong> This page is restricted to HR users.
      </CAlert>
    )
  }

  if (fetching) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <p className="mt-2 text-body-secondary">Loading employee data…</p>
      </div>
    )
  }

  if (fetchError) {
    return <CAlert color="danger">{fetchError}</CAlert>
  }

  const onSubmit = async (formData) => {
    setSubmitError('')
    try {
      const base = {
        employee_id: formData.employee_id,
        first_name: formData.first_name,
        middle_name: formData.middle_name || undefined,
        last_name: formData.last_name,
        state_for_pt: formData.state_for_pt,
        designation: formData.designation,
        department: formData.department,
        employee_category: formData.employee_category,
        gender: formData.gender,
        current_salary: parseFloat(formData.current_salary),
        status: formData.status,
        exit_date: formData.exit_date || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        marital_status: formData.marital_status || undefined,
        blood_group: formData.blood_group || undefined,
        joining_date: formData.joining_date || undefined,
        reporting_to: formData.reporting_to || undefined,
      }

      if (isEdit) {
        await api.put(`/employees/${id}`, base)
        navigate(`/staff/${id}`)
      } else {
        const { data: created } = await api.post('/employees', {
          ...base,
          contact: formData.contact,
          addresses: [
            { ...formData.present_address, address_type: 'Present' },
            { ...formData.permanent_address, address_type: 'Permanent' },
          ],
          identification: formData.identification,
          bank_accounts: formData.bank_accounts,
          family_members: formData.family_members,
        })
        navigate(`/staff/${created.id}`)
      }
    } catch (err) {
      setSubmitError(
        err.response?.data?.detail || 'Failed to save employee. Please check all fields.',
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <CForm onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* ── Page Header ── */}
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3">
          <CButton
            color="link"
            className="ps-0 text-decoration-none"
            type="button"
            onClick={() => navigate(isEdit ? `/staff/${id}` : '/staff')}
          >
            <CIcon icon={cilArrowLeft} className="me-1" />
            {isEdit ? 'Back to Profile' : 'Back to Staff List'}
          </CButton>
          <h5 className="mb-0">{isEdit ? 'Edit Employee' : 'Add New Employee'}</h5>
        </div>
        <div className="d-flex gap-2">
          <CButton
            color="secondary"
            type="button"
            onClick={() => navigate(isEdit ? `/staff/${id}` : '/staff')}
          >
            Cancel
          </CButton>
          <CButton color="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting && <CSpinner size="sm" className="me-2" />}
            {isEdit ? 'Save Changes' : 'Create Employee'}
          </CButton>
        </div>
      </div>

      {submitError && (
        <CAlert color="danger" className="mb-3" dismissible onClose={() => setSubmitError('')}>
          {submitError}
        </CAlert>
      )}

      {/* ── Master Information ── */}
      <CCard className="mb-3 border-top border-top-primary border-3">
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>Master Information</strong>
          <span className="text-danger small">
            <span className="me-1">*</span>Required fields
          </span>
        </CCardHeader>
        <CCardBody>
          <CRow className="g-3">
            <CCol md={3}>
              <Field
                label="Employee ID"
                required
                error={errors.employee_id}
                hint={
                  isEdit
                    ? 'Employee ID cannot be changed'
                    : 'e.g. HMA001 — 4–20 uppercase alphanumeric'
                }
              >
                <CFormInput
                  {...register('employee_id', {
                    required: 'Employee ID is required',
                    pattern: {
                      value: /^[A-Z0-9]{4,20}$/,
                      message: 'Must be 4–20 uppercase letters and numbers',
                    },
                  })}
                  disabled={isEdit}
                  placeholder="HMA001"
                  className={errors.employee_id ? 'is-invalid' : ''}
                />
              </Field>
            </CCol>

            <CCol md={3}>
              <Field label="First Name" required error={errors.first_name}>
                <CFormInput
                  {...register('first_name', { required: 'First name is required' })}
                  className={errors.first_name ? 'is-invalid' : ''}
                />
              </Field>
            </CCol>

            <CCol md={3}>
              <Field label="Middle Name">
                <CFormInput {...register('middle_name')} />
              </Field>
            </CCol>

            <CCol md={3}>
              <Field label="Last Name" required error={errors.last_name}>
                <CFormInput
                  {...register('last_name', { required: 'Last name is required' })}
                  className={errors.last_name ? 'is-invalid' : ''}
                />
              </Field>
            </CCol>

            <CCol md={3}>
              <Field label="Designation" required error={errors.designation}>
                <CFormInput
                  {...register('designation', { required: 'Designation is required' })}
                  placeholder="e.g. Project Manager"
                  className={errors.designation ? 'is-invalid' : ''}
                />
              </Field>
            </CCol>

            <CCol md={3}>
              <Field label="Department" required error={errors.department}>
                <CFormInput
                  {...register('department', { required: 'Department is required' })}
                  placeholder="e.g. Engineering"
                  className={errors.department ? 'is-invalid' : ''}
                />
              </Field>
            </CCol>

            <CCol md={3}>
              <Field label="State for PT" required error={errors.state_for_pt}>
                <CFormInput
                  {...register('state_for_pt', { required: 'State for PT is required' })}
                  placeholder="e.g. Kerala"
                  className={errors.state_for_pt ? 'is-invalid' : ''}
                />
              </Field>
            </CCol>

            <CCol md={3}>
              <Field label="Employee Category" required error={errors.employee_category}>
                <CFormSelect
                  {...register('employee_category', { required: 'Category is required' })}
                  className={errors.employee_category ? 'is-invalid' : ''}
                >
                  <option value="">Select Category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </CFormSelect>
              </Field>
            </CCol>

            <CCol md={3}>
              <Field label="Gender" required error={errors.gender}>
                <CFormSelect
                  {...register('gender', { required: 'Gender is required' })}
                  className={errors.gender ? 'is-invalid' : ''}
                >
                  <option value="">Select Gender</option>
                  {GENDERS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </CFormSelect>
              </Field>
            </CCol>

            <CCol md={3}>
              <Field
                label="Salary CTC"
                required
                error={errors.current_salary}
                hint={isEdit ? 'Use "Update Salary" button to change salary' : undefined}
              >
                <CFormInput
                  type="number"
                  min="1"
                  step="0.01"
                  {...register('current_salary', {
                    required: 'Salary is required',
                    min: { value: 1, message: 'Salary must be greater than 0' },
                  })}
                  disabled={isEdit}
                  placeholder="e.g. 25000"
                  className={errors.current_salary ? 'is-invalid' : ''}
                />
              </Field>
            </CCol>

            <CCol md={3}>
              <Field label="Employee Status" required error={errors.status}>
                <CFormSelect
                  {...register('status', { required: 'Status is required' })}
                  className={errors.status ? 'is-invalid' : ''}
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </CFormSelect>
              </Field>
            </CCol>

            {(watchedStatus === 'Resigned' || watchedStatus === 'Retired') && (
              <CCol md={3}>
                <Field label="Exit Date" required error={errors.exit_date}>
                  <CFormInput
                    type="date"
                    {...register('exit_date', {
                      required: 'Exit date is required for this status',
                    })}
                    className={errors.exit_date ? 'is-invalid' : ''}
                  />
                </Field>
              </CCol>
            )}
          </CRow>
        </CCardBody>
      </CCard>

      {/* ── Collapsible Sections ── */}
      <CAccordion alwaysOpen>
        {/* 1 — Basic Information */}
        <CAccordionItem itemKey={1}>
          <CAccordionHeader>
            <span className="fw-semibold">Basic Information</span>
          </CAccordionHeader>
          <CAccordionBody>
            <CRow className="g-3">
              <CCol md={4}>
                <Field label="Date of Birth">
                  <CFormInput type="date" {...register('date_of_birth')} />
                </Field>
              </CCol>
              <CCol md={4}>
                <Field label="Marital Status">
                  <CFormSelect {...register('marital_status')}>
                    <option value="">Select</option>
                    {MARITAL.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </CFormSelect>
                </Field>
              </CCol>
              <CCol md={4}>
                <Field label="Blood Group">
                  <CFormSelect {...register('blood_group')}>
                    <option value="">Select</option>
                    {BLOOD.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </CFormSelect>
                </Field>
              </CCol>
            </CRow>
          </CAccordionBody>
        </CAccordionItem>

        {/* 2 — Contact Information */}
        <CAccordionItem itemKey={2}>
          <CAccordionHeader>
            <span className="fw-semibold">Contact Information</span>
          </CAccordionHeader>
          <CAccordionBody>
            <CRow className="g-3">
              <CCol md={4}>
                <Field label="Personal Email" error={errors.contact?.personal_email}>
                  <CFormInput
                    type="email"
                    {...register('contact.personal_email', {
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Invalid email address',
                      },
                    })}
                    className={errors.contact?.personal_email ? 'is-invalid' : ''}
                  />
                </Field>
              </CCol>
              <CCol md={4}>
                <Field label="Working Email" error={errors.contact?.working_email}>
                  <CFormInput
                    type="email"
                    {...register('contact.working_email', {
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Invalid email address',
                      },
                    })}
                    className={errors.contact?.working_email ? 'is-invalid' : ''}
                  />
                </Field>
              </CCol>
              <CCol md={4}>
                <Field label="Mobile Number" error={errors.contact?.mobile_number}>
                  <CFormInput
                    {...register('contact.mobile_number', {
                      pattern: { value: /^[0-9]{10}$/, message: 'Must be exactly 10 digits' },
                    })}
                    placeholder="10-digit number"
                    className={errors.contact?.mobile_number ? 'is-invalid' : ''}
                  />
                </Field>
              </CCol>
              <CCol md={4}>
                <Field label="Phone Number">
                  <CFormInput {...register('contact.phone_number')} />
                </Field>
              </CCol>
              <CCol md={4}>
                <Field label="Emergency Contact Number">
                  <CFormInput {...register('contact.emergency_contact_number')} />
                </Field>
              </CCol>
            </CRow>
          </CAccordionBody>
        </CAccordionItem>

        {/* 3 — Address Information */}
        <CAccordionItem itemKey={3}>
          <CAccordionHeader>
            <span className="fw-semibold">Address Information</span>
          </CAccordionHeader>
          <CAccordionBody>
            <CRow className="g-4">
              <CCol md={6}>
                <AddressBlock
                  prefix="present_address"
                  label="Present Address"
                  register={register}
                  errors={errors}
                />
              </CCol>
              <CCol md={6}>
                <AddressBlock
                  prefix="permanent_address"
                  label="Permanent Address"
                  register={register}
                  errors={errors}
                />
              </CCol>
            </CRow>
          </CAccordionBody>
        </CAccordionItem>

        {/* 4 — Employment Information */}
        <CAccordionItem itemKey={4}>
          <CAccordionHeader>
            <span className="fw-semibold">Employment Information</span>
          </CAccordionHeader>
          <CAccordionBody>
            <CRow className="g-3">
              <CCol md={4}>
                <Field label="Joining Date">
                  <CFormInput type="date" {...register('joining_date')} />
                </Field>
              </CCol>
              <CCol md={4}>
                <Field label="Reporting To">
                  <CFormInput
                    {...register('reporting_to')}
                    placeholder="Employee ID of reporting manager"
                  />
                </Field>
              </CCol>
            </CRow>
          </CAccordionBody>
        </CAccordionItem>

        {/* 5 — Government Information */}
        <CAccordionItem itemKey={5}>
          <CAccordionHeader>
            <span className="fw-semibold">Government Information</span>
          </CAccordionHeader>
          <CAccordionBody>
            <CRow className="g-3">
              {[
                {
                  key: 'pan_number',
                  label: 'PAN Number',
                  placeholder: 'ABCDE1234F',
                  pattern: {
                    value: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
                    message: 'Invalid PAN format (e.g. ABCDE1234F)',
                  },
                },
                {
                  key: 'aadhar_number',
                  label: 'Aadhar Number',
                  placeholder: '12-digit number',
                  pattern: { value: /^[0-9]{12}$/, message: 'Must be exactly 12 digits' },
                },
                { key: 'uan_number', label: 'UAN Number', placeholder: '12-digit UAN' },
                { key: 'esi_number', label: 'ESI Number', placeholder: '17-character ESI' },
                { key: 'pf_number', label: 'PF Number', placeholder: 'PF account number' },
                { key: 'passport_number', label: 'Passport Number', placeholder: 'A1234567' },
              ].map(({ key, label, placeholder, pattern }) => {
                const fieldError = errors.identification?.[key]
                const rules = pattern ? { pattern } : {}
                return (
                  <CCol md={4} key={key}>
                    <Field label={label} error={fieldError}>
                      <CFormInput
                        {...register(`identification.${key}`, rules)}
                        placeholder={placeholder}
                        className={fieldError ? 'is-invalid' : ''}
                      />
                    </Field>
                  </CCol>
                )
              })}
            </CRow>
          </CAccordionBody>
        </CAccordionItem>

        {/* 6 — Bank Information */}
        <CAccordionItem itemKey={6}>
          <CAccordionHeader>
            <span className="fw-semibold">Bank Information</span>
          </CAccordionHeader>
          <CAccordionBody>
            {bankFields.map((field, idx) => (
              <CCard key={field.id} className="mb-3 border">
                <CCardHeader className="d-flex justify-content-between align-items-center py-2">
                  <span className="fw-semibold small">Bank Account {idx + 1}</span>
                  {bankFields.length > 1 && (
                    <CButton
                      color="danger"
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => removeBank(idx)}
                    >
                      <CIcon icon={cilTrash} />
                    </CButton>
                  )}
                </CCardHeader>
                <CCardBody>
                  <CRow className="g-3">
                    <CCol md={4}>
                      <Field label="Bank Name" error={errors.bank_accounts?.[idx]?.bank_name}>
                        <CFormInput
                          {...register(`bank_accounts.${idx}.bank_name`)}
                          className={errors.bank_accounts?.[idx]?.bank_name ? 'is-invalid' : ''}
                        />
                      </Field>
                    </CCol>
                    <CCol md={4}>
                      <Field
                        label="Account Number"
                        error={errors.bank_accounts?.[idx]?.account_number}
                      >
                        <CFormInput
                          {...register(`bank_accounts.${idx}.account_number`)}
                          className={
                            errors.bank_accounts?.[idx]?.account_number ? 'is-invalid' : ''
                          }
                        />
                      </Field>
                    </CCol>
                    <CCol md={4}>
                      <Field label="IFSC Code" error={errors.bank_accounts?.[idx]?.ifsc_code}>
                        <CFormInput
                          {...register(`bank_accounts.${idx}.ifsc_code`, {
                            pattern: {
                              value: /^[A-Z]{4}0[A-Z0-9]{6}$/,
                              message: 'Invalid IFSC format (e.g. SBIN0001234)',
                            },
                          })}
                          placeholder="SBIN0001234"
                          className={errors.bank_accounts?.[idx]?.ifsc_code ? 'is-invalid' : ''}
                        />
                      </Field>
                    </CCol>
                    <CCol md={12}>
                      <CFormCheck
                        label="Set as Primary Account"
                        {...register(`bank_accounts.${idx}.is_primary`)}
                      />
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>
            ))}
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              type="button"
              onClick={() => appendBank({ ...EMPTY_BANK, is_primary: false })}
            >
              <CIcon icon={cilPlus} className="me-1" />
              Add Another Account
            </CButton>
          </CAccordionBody>
        </CAccordionItem>

        {/* 7 — Family Information */}
        <CAccordionItem itemKey={7}>
          <CAccordionHeader>
            <span className="fw-semibold">Family Information</span>
          </CAccordionHeader>
          <CAccordionBody>
            {familyFields.length === 0 && (
              <p className="text-body-secondary mb-3">No family members added yet.</p>
            )}
            {familyFields.map((field, idx) => (
              <CCard key={field.id} className="mb-3 border">
                <CCardHeader className="d-flex justify-content-between align-items-center py-2">
                  <span className="fw-semibold small">Family Member {idx + 1}</span>
                  <CButton
                    color="danger"
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => removeFamily(idx)}
                  >
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CCardHeader>
                <CCardBody>
                  <CRow className="g-3">
                    <CCol md={4}>
                      <Field label="Name" required error={errors.family_members?.[idx]?.name}>
                        <CFormInput
                          {...register(`family_members.${idx}.name`, {
                            required: 'Name is required',
                          })}
                          className={errors.family_members?.[idx]?.name ? 'is-invalid' : ''}
                        />
                      </Field>
                    </CCol>
                    <CCol md={4}>
                      <Field
                        label="Relationship"
                        required
                        error={errors.family_members?.[idx]?.relationship}
                      >
                        <CFormSelect
                          {...register(`family_members.${idx}.relationship`, {
                            required: 'Relationship is required',
                          })}
                          className={errors.family_members?.[idx]?.relationship ? 'is-invalid' : ''}
                        >
                          <option value="">Select</option>
                          {RELATIONSHIPS.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </CFormSelect>
                      </Field>
                    </CCol>
                    <CCol md={4}>
                      <Field label="Contact Number">
                        <CFormInput {...register(`family_members.${idx}.contact_number`)} />
                      </Field>
                    </CCol>
                    <CCol md={4}>
                      <Field label="Date of Birth">
                        <CFormInput
                          type="date"
                          {...register(`family_members.${idx}.date_of_birth`)}
                        />
                      </Field>
                    </CCol>
                    <CCol md={4}>
                      <Field
                        label="Aadhar Number"
                        error={errors.family_members?.[idx]?.aadhar_number}
                      >
                        <CFormInput
                          {...register(`family_members.${idx}.aadhar_number`, {
                            pattern: { value: /^[0-9]{12}$/, message: 'Must be 12 digits' },
                          })}
                          placeholder="12-digit number"
                          className={
                            errors.family_members?.[idx]?.aadhar_number ? 'is-invalid' : ''
                          }
                        />
                      </Field>
                    </CCol>
                    <CCol md={4}>
                      <Field label="PAN Number" error={errors.family_members?.[idx]?.pan_number}>
                        <CFormInput
                          {...register(`family_members.${idx}.pan_number`, {
                            pattern: {
                              value: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
                              message: 'Invalid PAN format',
                            },
                          })}
                          placeholder="ABCDE1234F"
                          className={errors.family_members?.[idx]?.pan_number ? 'is-invalid' : ''}
                        />
                      </Field>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>
            ))}
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              type="button"
              onClick={() => appendFamily({ ...EMPTY_FAMILY })}
            >
              <CIcon icon={cilPlus} className="me-1" />
              Add Family Member
            </CButton>
          </CAccordionBody>
        </CAccordionItem>

        {/* 8 — Documents */}
        <CAccordionItem itemKey={8}>
          <CAccordionHeader>
            <span className="fw-semibold">Documents</span>
          </CAccordionHeader>
          <CAccordionBody>
            {isEdit ? (
              <CAlert color="info" className="mb-0">
                Use the <strong>Documents</strong> tab on the employee profile to upload, view, or
                delete documents.
              </CAlert>
            ) : (
              <CAlert color="secondary" className="mb-0">
                Document uploads are available after the employee record is created. You will be
                redirected to the employee profile where you can upload documents.
              </CAlert>
            )}
          </CAccordionBody>
        </CAccordionItem>
      </CAccordion>

      {/* ── Sticky Save Bar ── */}
      <div className="d-flex justify-content-end gap-2 mt-4 py-3 border-top">
        <CButton
          color="secondary"
          type="button"
          onClick={() => navigate(isEdit ? `/staff/${id}` : '/staff')}
        >
          Cancel
        </CButton>
        <CButton color="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting && <CSpinner size="sm" className="me-2" />}
          {isEdit ? 'Save Changes' : 'Create Employee'}
        </CButton>
      </div>
    </CForm>
  )
}

export default EmployeeForm
