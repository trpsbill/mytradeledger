import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Persistent, non-dismissible banner shown across the authenticated app while
 * the signed-in user is a temporary "Try Live Demo" account.
 */
export function DemoBanner() {
  const { user } = useAuth();

  if (!user?.isDemo) {
    return null;
  }

  return (
    <div className="alert alert-info rounded-none justify-center text-sm">
      <span>Demo Mode: This is sample data. Create a free account to track your own trades.</span>
      <Link to="/signup" className="btn btn-sm btn-primary">
        Sign up free
      </Link>
    </div>
  );
}
