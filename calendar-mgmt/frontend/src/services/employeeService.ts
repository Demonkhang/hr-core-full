import { hrClientService } from './hrClientService';
import type { Employee } from '@/types/employee';

export const employeeService = {
  async list(params?: Record<string, any>): Promise<Employee[]> {
    return hrClientService.getEmployees(params);
  },
};
