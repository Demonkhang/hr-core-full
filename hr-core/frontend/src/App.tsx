import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/Layout/AppLayout';
import { ProtectedRoute } from '@/components/Common/ProtectedRoute';
import { PermissionRoute } from '@/components/Common/PermissionRoute';
import { LoginPage } from '@/pages/LoginPage';
import { Dashboard } from '@/pages/Dashboard';
import { EmployeeList } from '@/pages/Employees/EmployeeList';
import { EmployeeInactiveList } from '@/pages/Employees/EmployeeInactiveList';
import { EmployeeDetail } from '@/pages/Employees/EmployeeDetail';

import { BaseSalaryConfigPage } from '@/pages/Settings/BaseSalaryConfigPage';
import { DepartmentList } from '@/pages/Departments/DepartmentList';
import { WorkplaceList } from '@/pages/Workplaces/WorkplaceList';
import { PositionList } from '@/pages/Positions/PositionList';
import { JobPositionList } from '@/pages/JobPositions/JobPositionList';
import { UserList } from '@/pages/Users/UserList';

import { WorkplaceDetail } from '@/pages/Workplaces/WorkplaceDetail';
import { AuditLogList } from '@/pages/Audit/AuditLogList';
import { ROUTES } from '@/utils/constants';

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleLogout = () => navigate(ROUTES.LOGIN, { replace: true });
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [navigate]);

  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route
        path={ROUTES.HOME}
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.EMPLOYEES}
        element={
          <PermissionRoute permissions={['can_manage_employees']}>
            <AppLayout>
              <EmployeeList />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.EMPLOYEES_INACTIVE}
        element={
          <PermissionRoute permissions={['can_manage_employees']}>
            <AppLayout>
              <EmployeeInactiveList />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.EMPLOYEE_DETAIL(':id')}
        element={
          <PermissionRoute permissions={['can_manage_employees']}>
            <AppLayout>
              <EmployeeDetail />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.BASE_SALARY_CONFIG}
        element={
          <PermissionRoute permissions={['can_manage_settings']}>
            <AppLayout>
              <BaseSalaryConfigPage />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.DEPARTMENTS}
        element={
          <PermissionRoute permissions={['can_manage_settings']}>
            <AppLayout>
              <DepartmentList />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.POSITIONS}
        element={
          <PermissionRoute permissions={['can_manage_settings']}>
            <AppLayout>
              <PositionList />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.JOB_POSITIONS}
        element={
          <PermissionRoute permissions={['can_manage_settings']}>
            <AppLayout>
              <JobPositionList />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.WORKPLACES}
        element={
          <PermissionRoute permissions={['can_manage_settings']}>
            <AppLayout>
              <WorkplaceList />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.WORKPLACE_DETAIL(':id')}
        element={
          <PermissionRoute permissions={['can_manage_settings']}>
            <AppLayout>
              <WorkplaceDetail />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.USERS}
        element={
          <PermissionRoute permissions={['can_manage_users']}>
            <AppLayout>
              <UserList />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.AUDIT_LOGS}
        element={
          <PermissionRoute permissions={['can_manage_users']}>
            <AppLayout>
              <AuditLogList />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  );
}

export default App;
