import React from 'react';
import { BarChart2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface Props {
  className?: string;
}

const GoToReportsButton: React.FC<Props> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const go = () =>
    navigate('/reports', {
      // so the Reports page can send users back to where they came from
      state: { from: location.pathname },
      replace: false,
    });

  return (
    <button
      onClick={go}
      className={`inline-flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors ${className}`}
      title="Open Reports"
    >
      <BarChart2 className="h-4 w-4" />
      <span>Reports</span>
    </button>
  );
};

export default GoToReportsButton;
