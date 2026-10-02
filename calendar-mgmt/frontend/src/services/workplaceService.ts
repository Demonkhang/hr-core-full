import { hrClientService } from './hrClientService';
import type { Workplace } from '@/types/workplace';

export const workplaceService = {
  async list(params?: { active_only?: boolean }): Promise<Workplace[]> {
    return hrClientService.getWorkplaces(params);
  },
};
