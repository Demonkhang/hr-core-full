/** Key lưu trữ trong localStorage */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  AUTH_STORAGE: 'mbs-auth-storage',
};

/** Định tuyến (route) của frontend */
export const ROUTES = {
  LOGIN: '/login',
  HOME: '/',
  DASHBOARD: '/',
  EMPLOYEES: '/employees',
  EMPLOYEES_INACTIVE: '/employees/inactive',
  EMPLOYEE_DETAIL: (id: string) => `/employees/${id}`,
  DEPARTMENTS: '/departments',
  POSITIONS: '/positions',
  JOB_POSITIONS: '/job-positions',
  WORKPLACES: '/workplaces',
  WORKPLACE_DETAIL: (id: string) => `/workplaces/${id}`,
  USERS: '/users',
  PROFILE: '/profile',
  AUDIT_LOGS: '/audit-logs',
  BASE_SALARY_CONFIG: '/base-salary-config',
};
