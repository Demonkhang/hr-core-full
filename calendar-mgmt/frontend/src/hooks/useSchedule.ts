import { useEffect, useState, useCallback, useRef } from 'react';
import { message, Form } from 'antd';
import { useAuthStore } from '@/store/authStore';
import { departmentService } from '@/services/departmentService';
import { employeeService } from '@/services/employeeService';
import { scheduleService } from '@/services/scheduleService';
import { workplaceService } from '@/services/workplaceService';
import { shiftTemplateService } from '@/services/shiftTemplateService';
import { meetingScheduleService } from '@/services/meetingScheduleService';
import dayjs from 'dayjs';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { SCHEDULE_STATUS, DATE_FORMATS, QUERY_PARAMS, SUCCESS_MESSAGES, SCOPE } from '@/utils/constants';
import { getShiftTime } from '@/utils/scheduleHelpers';
import type { Department } from '@/types/department';
import type { Employee } from '@/types/employee';
import type { Schedule, CalendarCell, ShiftTemplate, CoverageReport } from '@/types/schedule';
import type { Workplace } from '@/types/workplace';
import type { MeetingSchedule } from '@/types/meetingSchedule';

export function useSchedule() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarCell[]>([]);
  const [coverage, setCoverage] = useState<CoverageReport | null>(null);
  const [meetingData, setMeetingData] = useState<MeetingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedDateSidebar, setSelectedDateSidebar] = useState(dayjs().format(DATE_FORMATS.ISO_DATE));
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [modalSchedules, setModalSchedules] = useState<Schedule[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [form] = Form.useForm();
  const selectedWorkplaceId = Form.useWatch('workplace_id', form);
  const user = useAuthStore((s) => s.user);
  const autoFiltered = useRef(false);

  const deptLocked = !!user && user.permissions.scope !== SCOPE.ORGANIZATION && !!user.department_id;

  useEffect(() => {
    if (!user || autoFiltered.current) return;
    if (!deptLocked) { autoFiltered.current = true; return; }
    setSelectedDept([user.department_id!]);
    autoFiltered.current = true;
  }, [user, deptLocked]);

  const handleSetSelectedDept = useCallback((depts: string[]) => {
    if (deptLocked) return;
    setSelectedDept(depts);
  }, [deptLocked]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const depts = await departmentService.list();
      setDepartments(depts);
      const [temps, wps] = await Promise.all([
        shiftTemplateService.list(),
        workplaceService.list({ [QUERY_PARAMS.ACTIVE_ONLY]: true }),
      ]);
      setShiftTemplates(temps);
      setWorkplaces(wps);
    } catch (err) {
      console.error('SchedulePage fetchData error:', err);
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const month = currentMonth.format(DATE_FORMATS.ISO_MONTH);
      const deptParam = selectedDept.length > 0 ? selectedDept : [];
      const dateFrom = currentMonth.startOf('month').format(DATE_FORMATS.ISO_DATE);
      const dateTo = currentMonth.endOf('month').format(DATE_FORMATS.ISO_DATE);

      const [cal, emps, meets] = await Promise.all([
        scheduleService.getCalendar(month, deptParam),
        employeeService.list({ [QUERY_PARAMS.DEPARTMENT_ID]: deptParam, [QUERY_PARAMS.ACTIVE_ONLY]: true }),
        meetingScheduleService.getAll({ date_from: dateFrom, date_to: dateTo, active_only: true }),
      ]);
      setCalendarData(cal.cells);
      const filteredEmps = user && user.employee_id && user.permissions.scope === SCOPE.SELF
        ? emps.filter((e) => e.id === user.employee_id)
        : emps;
      setEmployees(filteredEmps);
      setMeetingData(meets);

      const today = dayjs().format(DATE_FORMATS.ISO_DATE);
      if (currentMonth.isSame(dayjs(), 'month')) {
        const cov = await scheduleService.getCoverage(today, deptParam);
        setCoverage(cov);
      }
    } catch {
      message.error('Không thể tải lịch');
    } finally {
      setLoading(false);
    }
  }, [selectedDept, currentMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  const openAdd = useCallback(() => {
    form.resetFields();
    setEditingSchedule(null);
    setShowForm(true);
  }, []);

  useKeyboardShortcut('n', openAdd, !showForm);

  const handleCreateSchedule = async (values: any) => {
    try {
      if (editingSchedule) {
        await scheduleService.update(editingSchedule.id, {
          shift_template_id: values.shift_template_id,
          workplace_id: values.workplace_id,
          notes: values.notes,
        });
        message.success(SUCCESS_MESSAGES.SCHEDULE_UPDATED);
      } else {
        const employeeIds = Array.isArray(values.employee_id) ? values.employee_id : [values.employee_id];
        const existingAll = await scheduleService.list({
          date_from: selectedDate,
          date_to: selectedDate,
          include_cancelled: true,
        });
        const existingKeys = new Set<string>();
        const existingByEmp = new Map<string, Schedule>();
        for (const s of existingAll) {
          if (s.status !== SCHEDULE_STATUS.CANCELLED) {
            const key = `${s.employee_id}:${s.date}`;
            existingKeys.add(key);
            existingByEmp.set(s.employee_id, s);
          }
        }
        const conflictIds = employeeIds.filter((id: string) => existingKeys.has(`${id}:${selectedDate}`));
        if (conflictIds.length > 0) {
          const details = conflictIds.map((id: string) => {
            const emp = employees.find((e) => e.id === id);
            const s = existingByEmp.get(id)!;
            return `${emp?.full_name || 'Unknown'} (${s.shift_name || ''} ${getShiftTime(s.shift_template_id, shiftTemplates)})`;
          });
          message.warning(`Nhân viên đã có lịch trực: ${details.join(', ')}`);
          return;
        }
        for (const empId of employeeIds) {
          await scheduleService.create({
            employee_id: empId,
            shift_template_id: values.shift_template_id,
            workplace_id: values.workplace_id,
            date: selectedDate,
            notes: values.notes,
          });
        }
        message.success(`Đã thêm ${employeeIds.length} lịch trực`);
      }
      setModalOpen(false);
      form.resetFields();
      setEditingSchedule(null);
      setSelectedDateSidebar(selectedDate);
      await fetchCalendar();
    } catch (err: any) {
      console.error('handleCreateSchedule error:', err);
      const detail = err?.response?.data?.detail;
      message.error(typeof detail === 'string' ? detail : `Lỗi khi lưu lịch: ${err.message || ''}`);
    }
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    form.setFieldsValue({
      workplace_id: schedule.workplace_id || undefined,
      shift_template_id: schedule.shift_template_id,
      employee_id: [schedule.employee_id],
      notes: schedule.notes,
    });
    setShowForm(true);
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await scheduleService.delete(scheduleId);
      message.success(SUCCESS_MESSAGES.SCHEDULE_DELETED);
      await fetchCalendar();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi khi xoá lịch');
    }
  };

  const handleSubmitSchedule = async (scheduleId: string) => {
    try {
      await scheduleService.submit(scheduleId);
      message.success(SUCCESS_MESSAGES.SCHEDULE_SUBMITTED);
      await fetchCalendar();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi khi gửi phê duyệt');
    }
  };

  const openScheduleModal = async (date: string) => {
    setSelectedDate(date);
    form.resetFields();
    setShowForm(false);
    setEditingSchedule(null);
    setModalOpen(true);
    setLoadingModal(true);
    try {
      const all = await scheduleService.list({ date_from: date, date_to: date, include_cancelled: true });
      setModalSchedules(all);
    } catch {
      setModalSchedules([]);
    } finally {
      setLoadingModal(false);
    }
  };

  const handleCellClick = (dateStr: string) => {
    if (selectedDateSidebar === dateStr) {
      openScheduleModal(dateStr);
    } else {
      setSelectedDateSidebar(dateStr);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setShowForm(false);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingSchedule(null);
  };

  return {
    departments,
    employees,
    shiftTemplates,
    workplaces,
    calendarData,
    coverage,
    meetingData,
    loading,
    selectedDept,
    currentMonth,
    modalOpen,
    selectedDate,
    selectedDateSidebar,
    showForm,
    editingSchedule,
    modalSchedules,
    loadingModal,
    form,
    selectedWorkplaceId,
    user,
    setSelectedDept: handleSetSelectedDept,
    deptLocked,
    setCurrentMonth,
    fetchCalendar,
    openAdd,
    handleCellClick,
    openScheduleModal,
    handleCreateSchedule,
    handleEditSchedule,
    handleDeleteSchedule,
    handleSubmitSchedule,
    handleCloseModal,
    handleCancelForm,
  };
}
