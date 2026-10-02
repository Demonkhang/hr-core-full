import { hrClientService } from './hrClientService';
import type { Department } from '@/types/department';

export const departmentService = {
  async list(activeOnly = true): Promise<Department[]> {
    return hrClientService.getDepartments({ active_only: activeOnly });
  },
};
