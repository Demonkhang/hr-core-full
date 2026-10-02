import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/store/authStore';
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';
import { useEffect, useState } from 'react';
import { ROUTES } from '@/utils/constants';

interface Props {
  children: React.ReactNode;
  permissions?: string[];
  fallbackPath?: string;
}

export function PermissionRoute({ children, permissions, fallbackPath = ROUTES.HOME }: Props) {
  const { user, isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      loadUser().finally(() => setChecked(true));
    } else {
      setChecked(true);
    }
  }, [isAuthenticated, isLoading, loadUser]);

  if (isLoading || !checked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (permissions && permissions.length > 0 && !user?.is_super_admin) {
    const p = user?.permissions ?? {} as any;
    const hasPermission = permissions.some((perm) => p[perm] === true);
    if (!hasPermission) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <ErrorBoundary>{children}</ErrorBoundary>;
}
