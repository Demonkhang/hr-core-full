import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/store/authStore';
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';
import { useEffect, useState } from 'react';
import { ROUTES } from '@/utils/constants';

/** Route guard: kiểm tra xác thực, redirect về login nếu chưa đăng nhập */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [checked, setChecked] = useState(false);

  /** Khi chưa xác thực, gọi loadUser để kiểm tra token còn hạn không */
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

  return <ErrorBoundary>{children}</ErrorBoundary>;
}
