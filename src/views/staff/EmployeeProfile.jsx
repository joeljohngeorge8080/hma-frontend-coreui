import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
  CTabContent,
  CTabPane,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilPencil } from '@coreui/icons'

import { usePermission } from '../../hooks/usePermission'
import { MODULE } from '../../constants/modules'
import api from '../../services/api'

import BasicInfoTab from './components/BasicInfoTab'
import ContactTab from './components/ContactTab'
import AddressTab from './components/AddressTab'
import EmploymentTab from './components/EmploymentTab'
import GovernmentIdsTab from './components/GovernmentIdsTab'
import BankAccountTab from './components/BankAccountTab'
import FamilyTab from './components/FamilyTab'
import DocumentsTab from './components/DocumentsTab'
import SalaryTab from './components/SalaryTab'

const STATUS_COLORS = {
  Active: 'success',
  Inactive: 'secondary',
  Resigned: 'danger',
  Retired: 'warning',
}

const TABS = [
  { key: 'basic', label: 'Basic Info' },
  { key: 'contact', label: 'Contact' },
  { key: 'address', label: 'Address' },
  { key: 'employment', label: 'Employment' },
  { key: 'govids', label: 'Gov IDs' },
  { key: 'bank', label: 'Bank' },
  { key: 'family', label: 'Family' },
  { key: 'documents', label: 'Documents' },
  { key: 'salary', label: 'Salary & Payroll' },
]

const EmployeeProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const canEdit = usePermission(MODULE.STAFF_PAYROLL, 'edit')

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('basic')

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await api.get(`/employees/${id}`)
        setProfile(data)
      } catch {
        setError('Failed to load employee profile')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [id])

  const refreshProfile = async () => {
    try {
      const { data } = await api.get(`/employees/${id}`)
      setProfile(data)
    } catch {
      // silent refresh failure — current data stays
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (error || !profile) {
    return <CAlert color="danger">{error || 'Employee not found'}</CAlert>
  }

  const fullName = [profile.first_name, profile.middle_name, profile.last_name]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <CRow className="mb-3 align-items-center">
        <CCol>
          <CButton color="link" className="ps-0" onClick={() => navigate('/staff')}>
            <CIcon icon={cilArrowLeft} className="me-1" />
            Back to Staff List
          </CButton>
        </CCol>
      </CRow>

      <CCard className="mb-4">
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <div>
            <strong className="fs-5">{fullName}</strong>
            <span className="ms-3 text-body-secondary">{profile.employee_id}</span>
            <CBadge color={STATUS_COLORS[profile.status] || 'secondary'} className="ms-2">
              {profile.status}
            </CBadge>
          </div>
          {canEdit && (
            <CButton color="primary" size="sm" onClick={() => navigate(`/staff/${id}/edit`)}>
              <CIcon icon={cilPencil} className="me-1" />
              Edit Employee
            </CButton>
          )}
        </CCardHeader>

        <CCardBody className="p-0">
          <CNav variant="tabs" className="px-3 pt-2">
            {TABS.map((tab) => (
              <CNavItem key={tab.key}>
                <CNavLink
                  active={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{ cursor: 'pointer' }}
                >
                  {tab.label}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>

          <CTabContent className="p-3">
            <CTabPane visible={activeTab === 'basic'}>
              <BasicInfoTab profile={profile} canEdit={canEdit} onSave={refreshProfile} />
            </CTabPane>
            <CTabPane visible={activeTab === 'contact'}>
              <ContactTab
                employeeId={id}
                contact={profile.contact}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'address'}>
              <AddressTab
                employeeId={id}
                addresses={profile.addresses}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'employment'}>
              <EmploymentTab profile={profile} canEdit={canEdit} onSave={refreshProfile} />
            </CTabPane>
            <CTabPane visible={activeTab === 'govids'}>
              <GovernmentIdsTab
                employeeId={id}
                identification={profile.identification}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'bank'}>
              <BankAccountTab
                employeeId={id}
                bankAccounts={profile.bank_accounts}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'family'}>
              <FamilyTab
                employeeId={id}
                familyMembers={profile.family_members}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'documents'}>
              <DocumentsTab employeeId={id} canEdit={canEdit} />
            </CTabPane>
            <CTabPane visible={activeTab === 'salary'}>
              <SalaryTab
                employeeId={id}
                currentSalary={profile.current_salary}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
          </CTabContent>
        </CCardBody>
      </CCard>
    </>
  )
}

export default EmployeeProfile
