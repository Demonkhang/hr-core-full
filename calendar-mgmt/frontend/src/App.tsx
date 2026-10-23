import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/Layout/AppLayout';
import { ProtectedRoute } from '@/components/Common/ProtectedRoute';
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
          <ProtectedRoute>
            <AppLayout>
              <SchedulePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.SCHEDULES_BY_EMPLOYEE}
        element={
          <ProtectedRoute>
            <AppLayout>
              <EmployeeSchedulePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.SCHEDULES_APPROVAL}
        element={
          <ProtectedRoute>
            <AppLayout>
              <ScheduleApproval />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.SHIFT_TEMPLATES}
        element={
          <ProtectedRoute>
            <AppLayout>
              <ShiftTemplateList />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.OVERTIME_REGISTRATIONS}
        element={
          <ProtectedRoute>
            <AppLayout>
              <OvertimeRegistrationList />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.OVERTIME_REGISTRATIONS_HISTORY}
        element={
          <ProtectedRoute>
            <AppLayout>
              <OvertimeHistory />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.LEAVE_REGISTRATIONS}
        element={
          <ProtectedRoute>
            <AppLayout>
              <LeaveRegistrationList />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.LEAVE_REGISTRATIONS_HISTORY}
        element={
          <ProtectedRoute>
            <AppLayout>
              <LeaveHistory />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.MEETING_SCHEDULES}
        element={
          <ProtectedRoute>
            <AppLayout>
              <MeetingList />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.MEETING_SCHEDULES_HISTORY}
        element={
          <ProtectedRoute>
            <AppLayout>
              <MeetingHistory />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.REPORTS}
        element={
          <ProtectedRoute>
            <AppLayout>
              <MonthlyReport />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.REPORTS_DEPT_SCHEDULE}
        element={
          <ProtectedRoute>
            <AppLayout>
              <DepartmentScheduleReport />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.PERMISSIONS}
        element={
          <ProtectedRoute>
            <AppLayout>
              <PermissionManagement />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={ROUTES.HOME} />} />
    </Routes>
  );
}

export default App;
