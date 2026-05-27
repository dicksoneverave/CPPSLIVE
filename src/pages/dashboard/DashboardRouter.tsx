import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingScreen from '../../components/common/LoadingScreen';
import { getGroupDashboard } from '../../config/groups';

// Pre-load all dashboard components
import AdminDashboard from './AdminDashboard';
import SuperAdminDashboard from './SuperAdminDashboard';
import GuestDashboard from './GuestDashboard';
import InsuranceDashboard from './InsuranceDashboard';
import AgentLawyerDashboard from './AgentLawyerDashboard';
import EmployerDashboard from './EmployerDashboard';
import DeputyRegistrarDashboard from './DeputyRegistrarDashboard';
import RegistrarDashboard from './RegistrarDashboard';
import DataEntryDashboard from './DataEntryDashboard';
import ProvincialClaimsOfficerDashboard from './ProvincialClaimsOfficerDashboard';
import OWCAdminDashboard from './OWCAdminDashboard';
import TribunalDashboard from './TribunalDashboard';
import CommissionerDashboard from './CommissionerDashboard';
import PaymentSectionDashboard from './PaymentSectionDashboard';
import ChiefCommissionerDashboard from './ChiefCommissionerDashboard';
import FosDashboard from './FosDashboard';
import StateSolicitorDashboard from './StateSolicitorDashboard';
import ClaimsManagerDashboard from './ClaimsManagerDashboard';
import FinanceDepartmentDashboard from './FinanceDepartmentDashboard';
import StatisticalDepartmentDashboard from './StatisticalDepartmentDashboard';
import PaymentsManagerDashboard from './PaymentsManagerDashboard';

// Create a mapping of components
const dashboardComponents = {
  AdminDashboard,
  SuperAdminDashboard,
  GuestDashboard,
  InsuranceDashboard,
  AgentLawyerDashboard,
  EmployerDashboard,
  DeputyRegistrarDashboard,
  RegistrarDashboard,
  DataEntryDashboard,
  ProvincialClaimsOfficerDashboard,
  OWCAdminDashboard,
  TribunalDashboard,
  CommissionerDashboard,
  PaymentSectionDashboard,
  ChiefCommissionerDashboard,
  FosDashboard,
  StateSolicitorDashboard,
  ClaimsManagerDashboard,
  FinanceDepartmentDashboard,
  StatisticalDepartmentDashboard,
  PaymentsManagerDashboard
};

const DashboardRouter: React.FC = () => {
  const { group, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!group) {
    console.log('No group found, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('Routing to dashboard for group:', {
    id: group.id,
    title: group.title
  });

  const Dashboard = getGroupDashboard(group.id);

  if (!Dashboard) {
    console.warn(`No dashboard configured for group ID: ${group.id} (${group.title})`);
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default DashboardRouter;
