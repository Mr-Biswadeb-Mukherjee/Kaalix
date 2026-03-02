import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ServerRouteError from '../Components/Features/ServerRouteError';
import { useAuth } from '../Context/AuthContext';

const normalizeStatusCode = (rawStatusCode) => {
  const parsed = Number.parseInt(rawStatusCode, 10);
  if (!Number.isInteger(parsed) || parsed < 400 || parsed > 599) {
    return 500;
  }
  return parsed;
};

const RouteErrorPage = () => {
  const navigate = useNavigate();
  const { statusCode } = useParams();
  const { isAuthenticated, onboardingRequired } = useAuth();

  const status = useMemo(
    () => normalizeStatusCode(statusCode),
    [statusCode]
  );

  const { actionLabel, targetPath } = useMemo(() => {
    if (!isAuthenticated) {
      return { actionLabel: 'Back to Login', targetPath: '/' };
    }

    if (onboardingRequired) {
      return { actionLabel: 'Complete Setup', targetPath: '/profile' };
    }

    return { actionLabel: 'Go to Dashboard', targetPath: '/dashboard' };
  }, [isAuthenticated, onboardingRequired]);

  return (
    <ServerRouteError
      status={status}
      actionLabel={actionLabel}
      onAction={() => navigate(targetPath, { replace: true })}
    />
  );
};

export default RouteErrorPage;
