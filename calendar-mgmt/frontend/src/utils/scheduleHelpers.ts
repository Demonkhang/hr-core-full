import type { Schedule, CalendarCell, ShiftTemplate } from '@/types/schedule';
import type { Workplace } from '@/types/workplace';

export function getShiftTime(shiftTemplateId: string, shiftTemplates: ShiftTemplate[]): string {
  const t = shiftTemplates.find((st) => st.id === shiftTemplateId);
  if (!t) return '';
  return `${t.start_time.slice(0, 5)}-${t.end_time.slice(0, 5)}`;
}

export function getSchedulesForDate(date: string, calendarData: CalendarCell[]): Schedule[] {
  const cell = calendarData.find((c) => c.date === date);
  return cell?.schedules || [];
}

export function getNonOfficeWorkplaceIds(workplaces: Workplace[]): Set<string> {
  return new Set(workplaces.filter((w) => !w.is_office_hours).map((w) => w.id));
}
