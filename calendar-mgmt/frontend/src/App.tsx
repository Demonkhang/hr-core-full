import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/Layout/AppLayout';
import { ProtectedRoute } from '@/components/Common/ProtectedRoute';
import { PermissionRoute } from '@/components/Common/PermissionRoute';
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';
import { LoginPage } from '@/pages/LoginPage';
import { Dashboard } from '@/pages/Dashboard';
import { SchedulePage } from '@/pages/Schedules/SchedulePage';
import { EmployeeSchedulePage } from '@/pages/Schedules/EmployeeSchedulePage';
import { ScheduleApproval } from '@/pages/Schedules/ScheduleApproval';
import { ShiftTemplateList } from '@/pages/ShiftTemplates/ShiftTemplateList';
import { LeaveRegistrationList } from '@/pages/LeaveRegistrations/LeaveRegistrationList';
import { OvertimeRegistrationList } from '@/pages/OvertimeRegistrations/OvertimeRegistrationList';
import { OvertimeHistory } from '@/pages/OvertimeRegistrations/OvertimeHistory';
import { MeetingList } from '@/pages/Meetings/MeetingList';
import { MeetingHistory } from '@/pages/Meetings/MeetingHistory';
import { LeaveHistory } from '@/pages/LeaveRegistrations/LeaveHistory';
import { MonthlyReport } from '@/pages/Reports/MonthlyReport';
import { DepartmentScheduleReport } from '@/pages/Reports/DepartmentScheduleReport';
import { PermissionManagement } from '@/pages/Permissions/PermissionManagement';
import { ROUTES } from '@/utils/constants';

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ssoToken = urlParams.get('token');
    if (ssoToken) {
      localStorage.setItem('access_token', ssoToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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
        path={ROUTES.SCHEDULES}
        element={
          <PermissionRoute permissions={['can_read_schedule']}>
            <AppLayout>
              <SchedulePage />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.SCHEDULES_BY_EMPLOYEE}
        element={
          <PermissionRoute permissions={['can_read_schedule']}>
            <AppLayout>
              <EmployeeSchedulePage />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.SCHEDULES_APPROVAL}
        element={
          <PermissionRoute permissions={['can_approve_schedule']}>
            <AppLayout>
              <ScheduleApproval />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.SHIFT_TEMPLATES}
        element={
          <PermissionRoute permissions={['can_manage_settings']}>
            <AppLayout>
              <ShiftTemplateList />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.OVERTIME_REGISTRATIONS}
        element={
          <PermissionRoute permissions={['can_manage_overtime', 'can_approve_overtime']}>
            <AppLayout>
              <OvertimeRegistrationList />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.OVERTIME_REGISTRATIONS_HISTORY}
        element={
          <PermissionRoute permissions={['can_manage_overtime', 'can_approve_overtime']}>
            <AppLayout>
              <OvertimeHistory />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.LEAVE_REGISTRATIONS}
        element={
          <PermissionRoute permissions={['can_manage_leave', 'can_approve_leave']}>
            <AppLayout>
              <LeaveRegistrationList />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.LEAVE_REGISTRATIONS_HISTORY}
        element={
          <PermissionRoute permissions={['can_manage_leave', 'can_approve_leave']}>
            <AppLayout>
              <LeaveHistory />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.MEETING_SCHEDULES}
        element={
          <PermissionRoute permissions={['can_manage_meetings', 'can_approve_meetings']}>
            <AppLayout>
              <MeetingList />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.MEETING_SCHEDULES_HISTORY}
        element={
          <PermissionRoute permissions={['can_manage_meetings', 'can_approve_meetings']}>
            <AppLayout>
              <MeetingHistory />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.REPORTS}
        element={
          <PermissionRoute permissions={['can_view_reports']}>
            <AppLayout>
              <MonthlyReport />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.REPORTS_DEPT_SCHEDULE}
        element={
          <PermissionRoute permissions={['can_read_schedule']}>
            <AppLayout>
              <DepartmentScheduleReport />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route
        path={ROUTES.PERMISSIONS}
        element={
          <PermissionRoute requireSuperAdmin={true}>
            <AppLayout>
              <PermissionManagement />
            </AppLayout>
          </PermissionRoute>
        }
      />
      <Route path="*" element={<Navigate to={ROUTES.HOME} />} />
    </Routes>
  );
}

export default App;
