import React from 'react';
import { useAuth } from '../../context/AuthContext';
import GoToReportsButton from '../../components/forms/GoToReportsButton';

const GuestDashboard: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Guest Dashboard</h1>
        <p className="text-gray-600">Welcome back, {profile?.full_name || 'Guest'}</p>
      </div>
      <div className="card">
        <p>You have limited access to view content.</p>
      </div>
    </div>
  );
};

export default GuestDashboard;
