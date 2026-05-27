import { FC } from 'react';
import AdminDashboard from '../pages/dashboard/AdminDashboard';
import SuperAdminDashboard from '../pages/dashboard/SuperAdminDashboard';
import GuestDashboard from '../pages/dashboard/GuestDashboard';
import InsuranceDashboard from '../pages/dashboard/InsuranceDashboard';
import AgentLawyerDashboard from '../pages/dashboard/AgentLawyerDashboard';
import EmployerDashboard from '../pages/dashboard/EmployerDashboard';
import DeputyRegistrarDashboard from '../pages/dashboard/DeputyRegistrarDashboard';
import RegistrarDashboard from '../pages/dashboard/RegistrarDashboard';
import DataEntryDashboard from '../pages/dashboard/DataEntryDashboard';
import ProvincialClaimsOfficerDashboard from '../pages/dashboard/ProvincialClaimsOfficerDashboard';
import OWCAdminDashboard from '../pages/dashboard/OWCAdminDashboard';
import TribunalDashboard from '../pages/dashboard/TribunalDashboard';
import CommissionerDashboard from '../pages/dashboard/CommissionerDashboard';
import PaymentSectionDashboard from '../pages/dashboard/PaymentSectionDashboard';
import ChiefCommissionerDashboard from '../pages/dashboard/ChiefCommissionerDashboard';
import FosDashboard from '../pages/dashboard/FosDashboard';
import StateSolicitorDashboard from '../pages/dashboard/StateSolicitorDashboard';
import ClaimsManagerDashboard from '../pages/dashboard/ClaimsManagerDashboard';
import FinanceDepartmentDashboard from '../pages/dashboard/FinanceDepartmentDashboard';
import StatisticalDepartmentDashboard from '../pages/dashboard/StatisticalDepartmentDashboard';
import PaymentsManagerDashboard from '../pages/dashboard/PaymentsManagerDashboard';

interface GroupConfig {
  [key: number]: {
    dashboard: FC;
    permissions: string[];
  };
}

export const groupConfig: GroupConfig = {
  // Content Management
  3: { dashboard: AdminDashboard, permissions: ['manage_content'] }, // Author
  4: { dashboard: AdminDashboard, permissions: ['manage_content'] }, // Editor
  5: { dashboard: AdminDashboard, permissions: ['manage_content'] }, // Publisher
  6: { dashboard: AdminDashboard, permissions: ['manage_content'] }, // Manager
  
  // Administration
  7: { dashboard: AdminDashboard, permissions: ['manage_system'] }, // Administrator
  8: { dashboard: SuperAdminDashboard, permissions: ['manage_system', 'manage_users'] }, // Super Users
  9: { dashboard: GuestDashboard, permissions: ['view_content'] }, // Guest
  
  // Insurance and Employers
  13: { dashboard: InsuranceDashboard, permissions: ['manage_claims'] }, // Insurance Company
  14: { dashboard: AgentLawyerDashboard, permissions: ['process_claims'] }, // AgentLawyer
  15: { dashboard: EmployerDashboard, permissions: ['manage_claims'] }, // Employer
  
  // Registration
  16: { dashboard: DeputyRegistrarDashboard, permissions: ['manage_registration'] }, // Deputy Registrar
  17: { dashboard: RegistrarDashboard, permissions: ['manage_registration'] }, // Registrar
  
  // Claims Processing
  18: { dashboard: DataEntryDashboard, permissions: ['enter_claims'] }, // DataEntry
  19: { dashboard: ProvincialClaimsOfficerDashboard, permissions: ['process_claims'] }, // ProvincialClaimsOfficer
  20: { dashboard: OWCAdminDashboard, permissions: ['manage_system'] }, // OWCAdmin
  
  // Tribunal and Commissioner
  21: { dashboard: TribunalDashboard, permissions: ['manage_tribunal'] }, // TribunalClerk
  22: { dashboard: CommissionerDashboard, permissions: ['approve_claims'] }, // Commissioner
  23: { dashboard: PaymentSectionDashboard, permissions: ['process_payments'] }, // PaymentSection
  24: { dashboard: ChiefCommissionerDashboard, permissions: ['approve_claims', 'manage_commission'] }, // Chief Commissioner
  25: { dashboard: FosDashboard, permissions: ['process_claims'] }, // Fos
  26: { dashboard: StateSolicitorDashboard, permissions: ['review_claims'] }, // StateSolicitor
  27: { dashboard: ClaimsManagerDashboard, permissions: ['manage_claims'] }, // Claims Manager
  28: { dashboard: FinanceDepartmentDashboard, permissions: ['manage_finance'] }, // FinanceDepartment
  29: { dashboard: StatisticalDepartmentDashboard, permissions: ['view_statistics'] }, // StatisticalDepartment
  30: { dashboard: PaymentsManagerDashboard, permissions: ['manage_payments'] }, // PaymentsManager
};

export const getGroupDashboard = (groupId: number) => {
  return groupConfig[groupId]?.dashboard;
};
