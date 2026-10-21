import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  DatePicker,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  Checkbox,
  Input,
  Card,
  Spin,
  message,
  Tabs,
  Empty,
  Badge,
  Alert,
  Tooltip,
} from 'antd';
import {
  CalendarOutlined,
  TeamOutlined,
  UserOutlined,
  SearchOutlined,
  DeleteOutlined,
  LeftOutlined,
  RightOutlined,
  EnvironmentOutlined,
  CheckCircleOutlined,
  EditOutlined,
  LockOutlined,
  InfoCircleOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Employee } from '@/types/employee';
import type { ShiftTemplate, Schedule } from '@/types/schedule';
import type { Workplace } from '@/types/workplace';
import { scheduleService } from '@/services/scheduleService';
import { employeeService } from '@/services/employeeService';
import { useAuthStore } from '@/store/authStore';
import { SCOPE, DATE_FORMATS } from '@/utils/constants';

interface BatchScheduleModalProps {
  open: boolean;
  onClose: () => void;
  assigning: {
    wpId: string;
    stId: string;
    stName: string;
    deptIds: string[];
  } | null;
  selectedDate: string;
  departments: { id: string; name: string }[];
  workplaces: Workplace[];
  shiftTemplates: ShiftTemplate[];
  currentSchedules: Schedule[];
  selectedDeptSidebar?: string[];
  onRefresh?: () => Promise<void>;
  onDeleteSchedule?: (scheduleId: string) => Promise<void>;
}

export function BatchScheduleModal({
  open,
  onClose,
  assigning,
  selectedDate,
  departments,
  workplaces,
  shiftTemplates,
  currentSchedules,
  selectedDeptSidebar,
  onRefresh,
  onDeleteSchedule,
}: BatchScheduleModalProps) {
  const user = useAuthStore((s) => s.user);
  const userScope = user?.permissions?.scope;
  const isScopeOrg = userScope === SCOPE.ORGANIZATION;
  const isScopeDept = userScope === SCOPE.DEPARTMENT || (!!user?.department_id && !isScopeOrg);

  // States
  const [activeTab, setActiveTab] = useState<'batch' | 'current'>('batch');
  const [selectedWeekDate, setSelectedWeekDate] = useState<dayjs.Dayjs>(dayjs(selectedDate || undefined));
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | undefined>(undefined);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [existingWeekSchedules, setExistingWeekSchedules] = useState<Schedule[]>([]);

  // Shift & Workplace info
  const shiftInfo = useMemo(() => {
    if (!assigning) return null;
    return shiftTemplates.find((s) => s.id === assigning.stId);
  }, [assigning, shiftTemplates]);

  const workplaceInfo = useMemo(() => {
    if (!assigning) return null;
    return workplaces.find((w) => w.id === assigning.wpId);
  }, [assigning, workplaces]);

  // Allowed department IDs configured strictly in ShiftTemplate for this shift
  const allowedDeptIds = useMemo(() => {
    if (shiftInfo?.department_ids && shiftInfo.department_ids.length > 0) {
      return shiftInfo.department_ids;
    }
    if (assigning?.deptIds && assigning.deptIds.length > 0) {
      return assigning.deptIds;
    }
    return [];
  }, [shiftInfo, assigning]);

  // Available departments: ONLY departments configured for this shift template!
  const availableDepartments = useMemo(() => {
    if (allowedDeptIds.length > 0) {
      return departments.filter((d) => allowedDeptIds.includes(d.id));
    }
    return departments;
  }, [departments, allowedDeptIds]);

  // Check if department is locked to 1 single department (e.g. shift only configured for 1 dept)
  const isSingleDept = useMemo(() => {
    return availableDepartments.length === 1;
  }, [availableDepartments]);

  // Compute 7 days of the selected week (Monday -> Sunday)
  const weekDays = useMemo(() => {
    const cur = selectedWeekDate.isValid() ? selectedWeekDate : dayjs();
    const dayOfWeek = cur.day(); // 0: Sun, 1: Mon, ... 6: Sat
    const monday = dayOfWeek === 0 ? cur.subtract(6, 'day') : cur.subtract(dayOfWeek - 1, 'day');
    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

    return Array.from({ length: 7 }, (_, i) => {
      const d = monday.add(i, 'day');
      return {
        date: d.format(DATE_FORMATS.ISO_DATE),
        dayName: dayNames[i],
        formattedDate: d.format('DD/MM'),
        isWeekend: i >= 5,
        dayjsObj: d,
      };
    });
  }, [selectedWeekDate]);

  // Today reference & Past checks
  const today = useMemo(() => dayjs().startOf('day'), []);

  // Check if this entire week has ended in the past (Sunday < today)
  const isWeekInPast = useMemo(() => {
    const curSunday = weekDays[6]?.dayjsObj?.endOf('day');
    return curSunday ? curSunday.isBefore(today) : false;
  }, [weekDays, today]);

  // Check if a specific date is in the past
  const isDateInPast = useCallback(
    (dateStr: string) => {
      return dayjs(dateStr).endOf('day').isBefore(today);
    },
    [today]
  );

  // Load existing schedules and employees for the week
  const loadWeekData = useCallback(
    async (targetDate: dayjs.Dayjs) => {
      if (!assigning) return;
      setLoadingData(true);
      try {
        const cur = targetDate.isValid() ? targetDate : dayjs();
        const dayOfWeek = cur.day();
        const monday = dayOfWeek === 0 ? cur.subtract(6, 'day') : cur.subtract(dayOfWeek - 1, 'day');
        const sunday = monday.add(6, 'day');
        const mondayStr = monday.format(DATE_FORMATS.ISO_DATE);
        const sundayStr = sunday.format(DATE_FORMATS.ISO_DATE);

        const [emps, weekSchedules] = await Promise.all([
          employeeService.list(),
          scheduleService.list({
            date_from: mondayStr,
            date_to: sundayStr,
            include_cancelled: false,
          }),
        ]);
        setAllEmployees(emps);

        // Filter matching this shift template (and workplace if needed)
        const matching = weekSchedules.filter(
          (s) => s.shift_template_id === assigning.stId && s.status !== 'cancelled'
        );
        setExistingWeekSchedules(matching);

        // Determine default department based STRICTLY on allowedDeptIds
        let targetDeptId: string | undefined = undefined;

        if (isScopeDept && user?.department_id) {
          targetDeptId = user.department_id;
        } else if (allowedDeptIds.length === 1) {
          // Exactly 1 allowed department -> lock to it
          targetDeptId = allowedDeptIds[0];
        } else if (selectedDeptSidebar && selectedDeptSidebar.length > 0) {
          // Priority 1 for multi-dept: department currently filtered on sidebar
          const matchSidebarDept = selectedDeptSidebar.find((dId) => allowedDeptIds.includes(dId));
          if (matchSidebarDept) {
            targetDeptId = matchSidebarDept;
          }
        }

        if (!targetDeptId && matching.length > 0) {
          // If already scheduled, pick department of the scheduled employees
          const activeEmpIds = Array.from(new Set(matching.map((s) => s.employee_id)));
          const firstEmp = emps.find((e) => activeEmpIds.includes(e.id));
          if (firstEmp?.department_id && allowedDeptIds.includes(firstEmp.department_id)) {
            targetDeptId = firstEmp.department_id;
          }
        }

        // Fallback to first available department
        if (!targetDeptId && allowedDeptIds.length > 0) {
          targetDeptId = allowedDeptIds[0];
        } else if (!targetDeptId && departments.length > 0) {
          targetDeptId = departments[0].id;
        }

        setSelectedDeptId(targetDeptId);

        if (matching.length > 0) {
          // 1. Show the EXACT days that currently have this shift
          const activeDays = Array.from(new Set(matching.map((s) => s.date))).sort();
          setSelectedDays(activeDays);

          // 2. Show the EXACT employees who are currently assigned to this shift
          const activeEmpIds = Array.from(new Set(matching.map((s) => s.employee_id)));
          setSelectedEmpIds(activeEmpIds);
        } else {
          // Default to all 7 days of the week
          const allSevenDays = Array.from({ length: 7 }, (_, i) =>
            monday.add(i, 'day').format(DATE_FORMATS.ISO_DATE)
          );
          setSelectedDays(allSevenDays);
          setSelectedEmpIds([]);
        }
      } catch (err) {
        console.error('Failed to load modal data', err);
      } finally {
        setLoadingData(false);
      }
    },
    [assigning, isScopeDept, departments, allowedDeptIds, selectedDeptSidebar, user]
  );

  // Initialize when modal opens or assigning changes
  useEffect(() => {
    if (open && assigning) {
      const baseDate = dayjs(selectedDate || undefined);
      setSelectedWeekDate(baseDate);
      setSearchKeyword('');
      setActiveTab('batch');
      loadWeekData(baseDate);
    }
  }, [open, assigning, selectedDate, loadWeekData]);

  // Handle week navigation
  const handleShiftWeek = (direction: 'prev' | 'next') => {
    const nextDate = direction === 'prev' ? selectedWeekDate.subtract(1, 'week') : selectedWeekDate.add(1, 'week');
    setSelectedWeekDate(nextDate);
    loadWeekData(nextDate);
  };

  const handleDateWeekChange = (d: dayjs.Dayjs | null) => {
    if (!d) return;
    setSelectedWeekDate(d);
    loadWeekData(d);
  };

  // Filter employees: STRICTLY restricted to departments configured for this shift template!
  const filteredEmployees = useMemo(() => {
    return allEmployees.filter((e) => {
      if (!e.is_active) return false;

      // 1. RULE: Employee MUST belong to a department configured for this shift template!
      if (allowedDeptIds.length > 0) {
        if (!e.department_id || !allowedDeptIds.includes(e.department_id)) {
          return false;
        }
      }

      // 2. Scope check: if user is restricted to a department
      if (isScopeDept && user?.department_id && e.department_id !== user.department_id) {
        return false;
      }

      // 3. Current department filter in dropdown (if selecting a specific department)
      if (selectedDeptId && selectedDeptId !== 'ALL' && e.department_id !== selectedDeptId) {
        return false;
      }

      // 4. Keyword search
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase();
        const matchName = e.full_name?.toLowerCase().includes(kw);
        const matchCode = e.employee_code?.toLowerCase().includes(kw);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [allEmployees, allowedDeptIds, isScopeDept, user, selectedDeptId, searchKeyword]);

  // Map employee ID to count of scheduled days in existingWeekSchedules
  const employeeScheduleCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of existingWeekSchedules) {
      map.set(s.employee_id, (map.get(s.employee_id) || 0) + 1);
    }
    return map;
  }, [existingWeekSchedules]);

  // Select all logic
  const isAllSelected = useMemo(() => {
    if (filteredEmployees.length === 0) return false;
    return filteredEmployees.every((e) => selectedEmpIds.includes(e.id));
  }, [filteredEmployees, selectedEmpIds]);

  const isIndeterminate = useMemo(() => {
    if (filteredEmployees.length === 0) return false;
    const count = filteredEmployees.filter((e) => selectedEmpIds.includes(e.id)).length;
    return count > 0 && count < filteredEmployees.length;
  }, [filteredEmployees, selectedEmpIds]);

  const handleToggleSelectAll = (checked: boolean) => {
    if (isWeekInPast) return;
    if (checked) {
      const newIds = new Set(selectedEmpIds);
      filteredEmployees.forEach((e) => newIds.add(e.id));
      setSelectedEmpIds(Array.from(newIds));
    } else {
      const filteredIdSet = new Set(filteredEmployees.map((e) => e.id));
      setSelectedEmpIds(selectedEmpIds.filter((id) => !filteredIdSet.has(id)));
    }
  };

  const handleToggleEmployee = (empId: string, checked: boolean) => {
    if (isWeekInPast) return;
    if (checked) {
      setSelectedEmpIds((prev) => [...prev, empId]);
    } else {
      setSelectedEmpIds((prev) => prev.filter((id) => id !== empId));
    }
  };

  // Day toggle
  const handleToggleDay = (dateStr: string) => {
    if (isWeekInPast || isDateInPast(dateStr)) {
      message.warning('Không thể thay đổi ca trực của các ngày trong quá khứ');
      return;
    }
    setSelectedDays((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  // Preset day selections
  const applyPresetDays = (preset: 'all' | 'workdays' | 'weekend') => {
    if (isWeekInPast) return;
    if (preset === 'all') {
      setSelectedDays(weekDays.map((w) => w.date));
    } else if (preset === 'workdays') {
      setSelectedDays(weekDays.slice(0, 5).map((w) => w.date));
    } else if (preset === 'weekend') {
      setSelectedDays(weekDays.slice(5).map((w) => w.date));
    }
  };

  // Total shifts calculation
  const totalShiftsCount = selectedEmpIds.length * selectedDays.length;
  const isAlreadyScheduled = existingWeekSchedules.length > 0;

  // Handle submit bulk scheduling with FULL SYNC
  const handleBatchSubmit = async () => {
    if (!assigning) return;
    if (isWeekInPast) {
      message.warning('Lịch trực trong quá khứ không thể chỉnh sửa hoặc thay đổi');
      return;
    }
    if (selectedEmpIds.length === 0 && selectedDays.length > 0 && existingWeekSchedules.length === 0) {
      message.warning('Vui lòng chọn ít nhất 1 nhân viên');
      return;
    }
    if (selectedDays.length === 0 && selectedEmpIds.length > 0) {
      message.warning('Vui lòng chọn ít nhất 1 ngày làm việc trong tuần');
      return;
    }

    setSubmitting(true);
    try {
      const empIdsToAssign =
        userScope === SCOPE.SELF
          ? selectedEmpIds.filter((id) => id === user?.employee_id)
          : selectedEmpIds;

      // Desired set: all pairs (empId, date)
      const desiredSet = new Set<string>();
      for (const empId of empIdsToAssign) {
        for (const dateStr of selectedDays) {
          desiredSet.add(`${empId}_${dateStr}`);
        }
      }

      // Existing set: map `${s.employee_id}_${s.date}` -> Schedule
      const existingMap = new Map<string, Schedule>();
      for (const s of existingWeekSchedules) {
        existingMap.set(`${s.employee_id}_${s.date}`, s);
      }

      // 1. Identify schedules to DELETE (previously assigned in this week, but now deselected)
      const toDeleteIds: string[] = [];
      for (const s of existingWeekSchedules) {
        const key = `${s.employee_id}_${s.date}`;
        if (!desiredSet.has(key)) {
          if (!isDateInPast(s.date)) {
            toDeleteIds.push(s.id);
          }
        }
      }

      // 2. Identify schedules to CREATE (desired, but not yet existing)
      const toCreatePayload: {
        employee_id: string;
        shift_template_id: string;
        workplace_id?: string;
        date: string;
      }[] = [];

      for (const empId of empIdsToAssign) {
        for (const dateStr of selectedDays) {
          const key = `${empId}_${dateStr}`;
          if (!existingMap.has(key)) {
            if (!isDateInPast(dateStr)) {
              toCreatePayload.push({
                employee_id: empId,
                shift_template_id: assigning.stId,
                workplace_id: assigning.wpId,
                date: dateStr,
              });
            }
          }
        }
      }

      // Execute Deletions
      let deleteCount = 0;
      if (toDeleteIds.length > 0) {
        for (const sId of toDeleteIds) {
          try {
            await scheduleService.delete(sId);
            deleteCount++;
          } catch (e) {
            console.error(`Failed to delete schedule ${sId}`, e);
          }
        }
      }

      // Execute Creations
      let createdCount = 0;
      let conflictCount = 0;
      if (toCreatePayload.length > 0) {
        const deptIdToUse =
          selectedDeptId && selectedDeptId !== 'ALL'
            ? selectedDeptId
            : availableDepartments[0]?.id || user?.department_id || '';

        const result = await scheduleService.bulkCreate({
          department_id: deptIdToUse,
          schedules: toCreatePayload,
        });
        createdCount = result.created || 0;
        conflictCount = result.errors?.length || 0;
      }

      // Feedback messages
      if (createdCount > 0 && deleteCount > 0) {
        message.success(`Đã cập nhật lịch: thêm ${createdCount} ca mới và xoá ${deleteCount} ca đã bỏ chọn!`);
      } else if (createdCount > 0) {
        message.success(`Đã xếp thành công ${createdCount} ca trực cho tuần!`);
      } else if (deleteCount > 0) {
        message.success(`Đã xoá ${deleteCount} ca trực đã bỏ chọn!`);
      } else {
        message.info('Không có thay đổi nào cần cập nhật.');
      }

      if (conflictCount > 0) {
        message.info(`Bỏ qua ${conflictCount} ca do nhân viên đã có lịch hoặc nghỉ phép.`);
      }

      onClose();
      await onRefresh?.();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      message.error(typeof detail === 'string' ? detail : 'Lỗi khi cập nhật ca trực');
    } finally {
      setSubmitting(false);
    }
  };

  const currentShiftSchedules = useMemo(() => {
    if (!assigning) return [];
    return currentSchedules.filter(
      (s) => s.shift_template_id === assigning.stId && s.status !== 'cancelled'
    );
  }, [assigning, currentSchedules]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={720}
      destroyOnClose
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>
            Phân ca theo tuần: {assigning?.stName}
          </span>
          {shiftInfo?.color && (
            <Tag color={shiftInfo.color} style={{ fontWeight: 600 }}>
              {shiftInfo.start_time?.slice(0, 5)} - {shiftInfo.end_time?.slice(0, 5)}
            </Tag>
          )}
          {workplaceInfo?.name && (
            <Tag icon={<EnvironmentOutlined />} color="cyan">
              {workplaceInfo.name}
            </Tag>
          )}
          {isWeekInPast ? (
            <Tag color="orange" icon={<LockOutlined />} style={{ fontWeight: 600 }}>
              Quá khứ (Chỉ xem - Không thể sửa)
            </Tag>
          ) : isAlreadyScheduled ? (
            <Tag color="processing" icon={<EditOutlined />}>
              Đang chỉnh sửa tuần đã xếp ({existingWeekSchedules.length} ca)
            </Tag>
          ) : null}
        </div>
      }
      footer={
        activeTab === 'batch' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ fontSize: 13, color: '#4b5563' }}>
              Tổng cộng:{' '}
              <strong style={{ color: totalShiftsCount > 0 ? '#4f46e5' : '#9ca3af', fontSize: 15 }}>
                {totalShiftsCount}
              </strong>{' '}
              lượt trực ({selectedEmpIds.length} NV × {selectedDays.length} ngày)
            </div>
            <Space>
              <Button onClick={onClose} disabled={submitting}>
                Đóng
              </Button>
              {isWeekInPast ? (
                <Tooltip title="Lịch trực trong quá khứ không được phép chỉnh sửa">
                  <Button disabled icon={<LockOutlined />} style={{ background: '#f3f4f6' }}>
                    Quá khứ (Không thể sửa)
                  </Button>
                </Tooltip>
              ) : (
                <Button
                  type="primary"
                  onClick={handleBatchSubmit}
                  loading={submitting}
                  disabled={loadingData}
                  style={{ background: '#4f46e5', borderColor: '#4f46e5' }}
                >
                  {isAlreadyScheduled ? `Lưu thay đổi (${totalShiftsCount})` : `Xác nhận xếp ca (${totalShiftsCount})`}
                </Button>
              )}
            </Space>
          </div>
        ) : (
          <Button onClick={onClose}>Đóng</Button>
        )
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'batch' | 'current')}
        items={[
          {
            key: 'batch',
            label: (
              <span style={{ fontWeight: 600 }}>
                <TeamOutlined style={{ marginRight: 6 }} />
                Phân ca & Chỉnh sửa theo tuần
              </span>
            ),
            children: loadingData ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin tip="Đang tải dữ liệu ca trực của tuần..." />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Past Alert if Week is in the past */}
                {isWeekInPast && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<LockOutlined />}
                    message="Lịch trực trong quá khứ - Chế độ chỉ xem"
                    description="Tuần này đã kết thúc trong quá khứ. Dữ liệu lịch trực chỉ ở chế độ xem và được bảo toàn, bạn không thể thêm mới, chỉnh sửa hoặc xoá ca trực."
                    style={{ borderRadius: 6 }}
                  />
                )}

                {/* 1. Mốc thời gian theo tuần */}
                <Card
                  size="small"
                  style={{ background: '#f8fafc', borderColor: '#e2e8f0', borderRadius: 8 }}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                        <CalendarOutlined style={{ marginRight: 6, color: '#4f46e5' }} />
                        1. Mốc thời gian (Tuần đang chọn)
                      </span>
                      <Space size="small">
                        <Button
                          size="small"
                          icon={<LeftOutlined />}
                          onClick={() => handleShiftWeek('prev')}
                          title="Tuần trước"
                        />
                        <DatePicker
                          picker="week"
                          size="small"
                          allowClear={false}
                          value={selectedWeekDate}
                          onChange={handleDateWeekChange}
                          style={{ width: 140 }}
                        />
                        <Button
                          size="small"
                          icon={<RightOutlined />}
                          onClick={() => handleShiftWeek('next')}
                          title="Tuần sau"
                        />
                      </Space>
                    </div>
                  }
                >
                  {/* Preset quick buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Tuần từ{' '}
                      <strong>{weekDays[0]?.formattedDate}</strong> đến{' '}
                      <strong>{weekDays[6]?.formattedDate}</strong>:
                      {isAlreadyScheduled && (
                        <span style={{ color: '#4f46e5', marginLeft: 6, fontWeight: 600 }}>
                          (Đã có {selectedDays.length} ngày được xếp ca)
                        </span>
                      )}
                    </Typography.Text>
                    <Space size={6}>
                      <Button size="small" disabled={isWeekInPast} onClick={() => applyPresetDays('all')}>
                        Cả tuần (7 ngày)
                      </Button>
                      <Button size="small" disabled={isWeekInPast} onClick={() => applyPresetDays('workdays')}>
                        Thứ 2 - Thứ 6
                      </Button>
                      <Button size="small" disabled={isWeekInPast} onClick={() => applyPresetDays('weekend')}>
                        Cuối tuần (T7, CN)
                      </Button>
                    </Space>
                  </div>

                  {/* 7 Days interactive pill tags */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {weekDays.map((item) => {
                      const isChecked = selectedDays.includes(item.date);
                      const hasExistingInDay = existingWeekSchedules.some((s) => s.date === item.date);
                      const itemInPast = isWeekInPast || isDateInPast(item.date);

                      return (
                        <div
                          key={item.date}
                          onClick={itemInPast ? undefined : () => handleToggleDay(item.date)}
                          style={{
                            flex: 1,
                            minWidth: 80,
                            padding: '6px 8px',
                            borderRadius: 6,
                            textAlign: 'center',
                            cursor: itemInPast ? 'default' : 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.2s',
                            border: isChecked ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                            background: isChecked ? (itemInPast ? '#f3f4f6' : '#eef2ff') : '#ffffff',
                            color: isChecked ? (itemInPast ? '#4b5563' : '#4338ca') : '#64748b',
                            fontWeight: isChecked ? 600 : 500,
                            opacity: itemInPast && !isChecked ? 0.6 : 1,
                            position: 'relative',
                          }}
                        >
                          <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                            {item.dayName}
                            {itemInPast && <LockOutlined style={{ fontSize: 9, color: '#9ca3af' }} />}
                          </div>
                          <div style={{ fontSize: 13, marginTop: 2 }}>{item.formattedDate}</div>
                          {hasExistingInDay && (
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: '#10b981',
                                position: 'absolute',
                                top: 4,
                                right: 4,
                              }}
                              title="Ngày này đã có ca trực"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* 2. Chọn Phòng ban & Danh sách nhân viên */}
                <Card
                  size="small"
                  style={{ background: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8 }}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                        <TeamOutlined style={{ marginRight: 6, color: '#4f46e5' }} />
                        2. Bộ phận & Thành viên ({filteredEmployees.length} nhân sự)
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Phòng ban theo ca:</span>
                        {isSingleDept ? (
                          <Tooltip title="Ca trực này được cấu hình cố định cho bộ phận này theo Ca trực mẫu">
                            <Tag
                              color="blue"
                              icon={<ApartmentOutlined />}
                              style={{ fontSize: 12, padding: '2px 8px', fontWeight: 600, margin: 0 }}
                            >
                              {availableDepartments[0]?.name || 'Bộ phận cố định'}
                            </Tag>
                          </Tooltip>
                        ) : (
                          <Select
                            size="small"
                            style={{ minWidth: 220 }}
                            value={selectedDeptId}
                            onChange={(val) => {
                              if (isWeekInPast) return;
                              setSelectedDeptId(val);
                              if (val !== 'ALL') {
                                setSelectedEmpIds((prev) =>
                                  prev.filter((id) => {
                                    const e = allEmployees.find((emp) => emp.id === id);
                                    return e?.department_id === val;
                                  })
                                );
                              }
                            }}
                            disabled={isWeekInPast || isScopeDept}
                            options={[
                              ...(availableDepartments.length > 1
                                ? [{ label: `--- Tất cả các bộ phận của ca (${availableDepartments.length}) ---`, value: 'ALL' }]
                                : []),
                              ...availableDepartments.map((d) => ({ label: d.name, value: d.id })),
                            ]}
                            placeholder="Chọn phòng ban..."
                          />
                        )}
                      </div>
                    </div>
                  }
                >
                  {/* Select All Bar & Search Box */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#f1f5f9',
                      borderRadius: 6,
                      marginBottom: 10,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={isIndeterminate}
                      onChange={(e) => handleToggleSelectAll(e.target.checked)}
                      disabled={isWeekInPast || filteredEmployees.length === 0}
                    >
                      <strong style={{ color: isWeekInPast ? '#64748b' : '#1e293b' }}>
                        Chọn tất cả thành viên ({selectedEmpIds.length}/{filteredEmployees.length} nhân viên)
                      </strong>
                    </Checkbox>

                    <Input
                      size="small"
                      placeholder="Tìm kiếm theo tên hoặc mã NV..."
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      value={searchKeyword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchKeyword(e.target.value)}
                      style={{ width: 220 }}
                      allowClear
                    />
                  </div>

                  {/* Employees List Container */}
                  {filteredEmployees.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <span>
                          Không có nhân viên phù hợp thuộc bộ phận được phân cho ca này.
                          {allowedDeptIds.length > 0 && (
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                              (Ca này chỉ áp dụng cho: {availableDepartments.map((d) => d.name).join(', ')})
                            </div>
                          )}
                        </span>
                      }
                    />
                  ) : (
                    <div
                      style={{
                        maxHeight: 220,
                        overflowY: 'auto',
                        paddingRight: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      {filteredEmployees.map((emp) => {
                        const isChecked = selectedEmpIds.includes(emp.id);
                        const scheduledDaysCount = employeeScheduleCounts.get(emp.id) || 0;

                        return (
                          <div
                            key={emp.id}
                            onClick={isWeekInPast ? undefined : () => handleToggleEmployee(emp.id, !isChecked)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: 6,
                              cursor: isWeekInPast ? 'default' : 'pointer',
                              background: isChecked ? '#f5f3ff' : '#ffffff',
                              border: isChecked ? '1px solid #c4b5fd' : '1px solid #f1f5f9',
                              transition: 'all 0.15s ease',
                              opacity: isWeekInPast && !isChecked ? 0.7 : 1,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Checkbox
                                checked={isChecked}
                                disabled={isWeekInPast}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleToggleEmployee(emp.id, e.target.checked);
                                }}
                              />
                              <div>
                                <span style={{ fontWeight: 600, color: '#1f2937', fontSize: 13 }}>
                                  {emp.full_name}
                                </span>
                                {emp.employee_code && (
                                  <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 6 }}>
                                    ({emp.employee_code})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {scheduledDaysCount > 0 && (
                                <Tag color="green" style={{ margin: 0, fontSize: 11 }}>
                                  Đang trực {scheduledDaysCount} ngày
                                </Tag>
                              )}
                              {emp.position_name && (
                                <span style={{ fontSize: 11, color: '#64748b' }}>
                                  {emp.position_name}
                                </span>
                              )}
                              <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                                {emp.department_name || 'Phòng ban'}
                              </Tag>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            ),
          },
          {
            key: 'current',
            label: (
              <span>
                Người trực ngày {dayjs(selectedDate).format('DD/MM')} ({currentShiftSchedules.length})
              </span>
            ),
            children: (
              <div>
                {currentShiftSchedules.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Chưa có ai trực ca này vào ngày đang xem"
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                    {currentShiftSchedules.map((s) => {
                      const isScheduleInPast = isWeekInPast || isDateInPast(s.date);
                      return (
                        <div
                          key={s.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            background: '#f8fafc',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <UserOutlined style={{ color: '#4f46e5' }} />
                            <span style={{ fontWeight: 600, fontSize: 13 }}>
                              {s.employee_name || 'Nhân viên'}
                            </span>
                            {s.department_name && <Tag color="default">{s.department_name}</Tag>}
                            {isScheduleInPast && (
                              <Tag color="default" icon={<LockOutlined />}>
                                Quá khứ
                              </Tag>
                            )}
                          </div>
                          {onDeleteSchedule && !isScheduleInPast ? (
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => onDeleteSchedule(s.id)}
                            >
                              Xoá
                            </Button>
                          ) : (
                            <Tooltip title="Lịch trực trong quá khứ không thể xoá">
                              <Button size="small" disabled icon={<LockOutlined />}>
                                Đã qua
                              </Button>
                            </Tooltip>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
}
