import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Simulation-Based Interview report page is disabled — redirects to dashboard.
// The faulty 0/100 scoring display has been removed to avoid misleading users.
// Other interview modes (Resume-Based, General, Mock Panel, Company-Specific) are unaffected.
export default function SimulationReportPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  return null;
}
