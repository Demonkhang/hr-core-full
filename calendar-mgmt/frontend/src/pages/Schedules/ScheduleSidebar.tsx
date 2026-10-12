import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Empty, Select, Modal, Button, Space, message, Collapse, Tag, Typography, DatePicker, Segmented } from 'antd';
import dayjs from 'dayjs';
import { getSchedulesForDate } from '@/utils/scheduleHelpers';
import { DATE_FORMATS, MEETING_TYPE_LABELS, MEETING_TYPE_COLORS, SCOPE } from '@/utils/constants';
import { scheduleService } from '@/services/scheduleService';
import { employeeService } from '@/services/employeeService';
import { useAuthStore } from '@/store/authStore';
import type { Employee } from '@/types/employee';
import type { Schedule, CalendarCell, ShiftTemplate } from '@/types/schedule';
import type { Workplace } from '@/types/workplace';
import type { MeetingSchedule } from '@/types/meetingSchedule';

interface ScheduleSidebarProps {
  selectedDateSidebar: string;
  employees: Employee[];
  shiftTemplates: ShiftTemplate[];
  workplaces: Workplace[];
  calendarData: CalendarCell[];
  meetingData: MeetingSchedule[];
  onRefresh?: () => Promise<void>;
  selectedDept: string[];
  setSelectedDept: (depts: string[]) => void;
  onDateChange: (date: string) => void;
  departments: { id: string; name: string }[];
  deptLocked?: boolean;
}

const MIN = 1440;

function toMin(t: string) {
  const p = t.split(':');
  return +p[0] * 60 + (+p[1] || 0);
}

function pct(minutes: number) {
  return (minutes / MIN) * 100;
}

export function ScheduleSidebar({ selectedDateSidebar, employees, shiftTemplates, workplaces, calendarData, meetingData, onRefresh, selectedDept, setSelectedDept, onDateChange, departments, deptLocked }: ScheduleSidebarProps) {
  const [assigning, setAssigning] = useState<{ wpId: string; stId: string; stName: string; deptIds: string[] } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState('office');
  const user = useAuthStore((s) => s.user);
  const userScope = user?.permissions?.scope;
  const isScopeOrg = userScope === SCOPE.ORGANIZATION;
  const isScopeDept = userScope === SCOPE.DEPARTMENT || (!!user?.department_id && !isScopeOrg);

  const loadEmployees = useCallback(async () => {
    try {
      const emps = await employeeService.list();
      setAllEmployees(emps);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { setSelectedIds([]); if (assigning) loadEmployees(); }, [assigning, loadEmployees]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const sidebarSch = getSchedulesForDate(selectedDateSidebar, calendarData);
  const prevDate = dayjs(selectedDateSidebar).subtract(1, 'day').format(DATE_FORMATS.ISO_DATE);
  const prevSch = getSchedulesForDate(prevDate, calendarData);
  const officeWps = workplaces.filter((w) => w.is_office_hours);
  const nonOfficeWps = workplaces.filter((w) => !w.is_office_hours);
  const sortedWps = [...officeWps, ...nonOfficeWps];
  const dayMeetings = meetingData.filter((m) => m.date === selectedDateSidebar && m.status !== 'cancelled');

  const handleSave = async () => {
    if (!assigning || selectedIds.length === 0) return;
    try {
      const empIdsToAssign = userScope === SCOPE.SELF
        ? selectedIds.filter((id) => id === user?.employee_id)
        : selectedIds;
      if (empIdsToAssign.length === 0) {
        message.warning('Bạn không thể phân ca cho người khác');
        return;
      }
      const existing = await scheduleService.list({
        date_from: selectedDateSidebar,
        date_to: selectedDateSidebar,
        include_cancelled: true,
      });
      const existingSet = new Set(existing.filter((s) => s.status !== 'cancelled' && s.shift_template_id === assigning.stId).map((s) => s.employee_id));
      const skipIds = empIdsToAssign.filter((id) => existingSet.has(id));
      if (skipIds.length > 0) {
        const names = skipIds.map((id) => allEmployees.find((e) => e.id === id)?.full_name || '').filter(Boolean).join(', ');
        message.warning(`${names} đã được phân ca trực này`);
      }
      const newIds = empIdsToAssign.filter((id) => !existingSet.has(id));
      for (const empId of newIds) {
        await scheduleService.create({
          employee_id: empId,
          shift_template_id: assigning.stId,
          workplace_id: assigning.wpId,
          date: selectedDateSidebar,
        });
      }
      if (newIds.length > 0) {
        message.success(`Đã phân ${newIds.length} nhân viên vào ${assigning.stName}`);
      }
      setAssigning(null);
      await onRefresh?.();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      message.error(typeof detail === 'string' ? detail : 'Lỗi khi phân ca');
    }
  };

  const currentSchedules = useMemo(() => {
    if (!assigning) return [];
    return sidebarSch.filter((s) => s.shift_template_id === assigning.stId && s.status !== 'cancelled');
  }, [assigning, sidebarSch]);

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await scheduleService.delete(scheduleId);
      message.success('Đã xoá người trực');
      setAssigning(null);
      await onRefresh?.();
    } catch {
      message.error('Lỗi khi xoá');
    }
  };

  const renderWorkplaceCollapse = (wpList: Workplace[], tabKey: string) => (
    <Collapse
      key={tabKey}
      defaultActiveKey={wpList.map((w) => w.id)}
      items={wpList.map((wp) => {
        const wpTemplates = shiftTemplates.filter((st) => st.workplace_id === wp.id && st.is_active);
        const wpSchedules = sidebarSch.filter((s) => s.workplace_id === wp.id && s.status !== 'cancelled');
        const scheduleByTemplate = new Map<string, Schedule[]>();
        for (const s of wpSchedules) {
          const list = scheduleByTemplate.get(s.shift_template_id) || [];
          list.push(s);
          scheduleByTemplate.set(s.shift_template_id, list);
        }
        const assignedIds = new Set(wpSchedules.map((s) => s.shift_template_id));

        interface Bar { left: number; w: number; c: string; label: string; filled: boolean; s: number; e: number; stId: string; stName: string; deptIds: string[]; lane: number; isCont: boolean }
        const bars: Bar[] = [];
        for (const st of wpTemplates) {
          const startM = toMin(st.start_time);
          const endM = toMin(st.end_time);
          const schedules = scheduleByTemplate.get(st.id) || [];
          const filled = assignedIds.has(st.id) && schedules.length > 0;
          const name = filled ? schedules.map((s) => allEmployees.find((e) => e.id === s.employee_id)?.full_name || '').filter(Boolean).join(', ') : '';
          const label = filled ? `${st.name}: ${name}` : st.name;

          if (st.is_overnight || endM <= startM) {
            bars.push({ left: pct(startM), w: pct(MIN - startM), c: st.color, label: `${label} →`, filled, s: startM, e: MIN, stId: st.id, stName: st.name, deptIds: st.department_ids, lane: -1, isCont: false });
          } else {
            bars.push({ left: pct(startM), w: pct(endM - startM), c: st.color, label, filled, s: startM, e: endM, stId: st.id, stName: st.name, deptIds: st.department_ids, lane: -1, isCont: false });
          }
        }
        const contBars: Bar[] = [];
        for (const st of wpTemplates) {
          const endM = toMin(st.end_time);
          if (!st.is_overnight && endM > toMin(st.start_time)) continue;
          const prevSchedules = prevSch.filter((s) => s.shift_template_id === st.id && s.workplace_id === wp.id && s.status !== 'cancelled');
          const contFilled = prevSchedules.length > 0;
          const prevName = contFilled ? prevSchedules.map((s) => allEmployees.find((e) => e.id === s.employee_id)?.full_name || '').filter(Boolean).join(', ') : '';
          const contLabel = contFilled ? `${st.name} (tt): ${prevName}` : st.name;
          contBars.push({ left: 0, w: pct(endM), c: st.color, label: contLabel, filled: contFilled, s: 0, e: endM, stId: st.id, stName: st.name, deptIds: st.department_ids, lane: -1, isCont: true });
        }

        const allBars = [...bars, ...contBars];
        const nonCont = allBars.filter((b) => !b.isCont).sort((a, b) => {
          const da = a.deptIds[0] || '';
          const db = b.deptIds[0] || '';
          if (da !== db) return da.localeCompare(db);
          if (a.s !== b.s) return a.s - b.s;
          return a.stId.localeCompare(b.stId);
        });
        const contSorted = allBars.filter((b) => b.isCont);
        const laneEnds: number[] = [];
        const contTargetLane = new Map<string, number>();
        for (const bar of nonCont) {
          let lane = laneEnds.findIndex((end) => end <= bar.s);
          if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
          laneEnds[lane] = bar.e;
          bar.lane = lane;
          contTargetLane.set(bar.stId, lane);
        }
        for (const bar of contSorted) {
          const target = contTargetLane.get(bar.stId);
          if (target !== undefined) {
            bar.lane = target;
          } else {
            let lane = laneEnds.findIndex((end) => end <= bar.s);
            if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
            laneEnds[lane] = bar.e;
            bar.lane = lane;
          }
        }

        const rowH = 28;

        return {
          key: wp.id,
          label: wp.name,
          children: (
            <div>
              <div style={{ position: 'relative', width: '100%', height: rowH * (laneEnds.length || 1), background: '#f5f5f5', borderRadius: 4 }}>
                {allBars.map((bar, i) => (
                  <div
                    key={i}
                    title={`${bar.label}${bar.isCont ? '' : ' — Nhấp đúp để phân ca'}`}
                    onDoubleClick={bar.isCont ? undefined : () => setAssigning({ wpId: wp.id, stId: bar.stId, stName: bar.stName, deptIds: bar.deptIds })}
                    style={{
                      position: 'absolute',
                      left: `${bar.left}%`,
                      width: `${bar.w}%`,
                      top: rowH * bar.lane,
                      height: rowH - 2,
                      background: bar.filled ? bar.c : 'transparent',
                      border: `1px solid ${bar.c}`,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      lineHeight: 1,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      color: bar.filled ? '#fff' : bar.c,
                      cursor: bar.isCont ? 'default' : 'pointer',
                    }}
                  >
                    {bar.label}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', fontSize: 10, color: '#999', marginTop: 2, position: 'relative', height: 14 }}>
                {[0, 6, 12, 18, 24].map((h) => (
                  <span key={h} style={{ position: 'absolute', left: `${(h / 24) * 100}%`, transform: h === 0 ? 'none' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                    {String(h).padStart(2, '0')}:00
                  </span>
                ))}
              </div>
            </div>
          ),
        };
      })}
      style={{ flex: 1, overflow: 'auto' }}
    />
  );

  return (
    <Card
      size="small"
      style={{ height: '100%' }}
      styles={{ body: { height: 'calc(100% - 38px)', padding: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ whiteSpace: 'nowrap', fontSize: 14, fontWeight: 600 }}>Lịch trực ngày</span>
          <DatePicker
            value={dayjs(selectedDateSidebar)}
            onChange={(d: dayjs.Dayjs | null) => d && onDateChange(d.format(DATE_FORMATS.ISO_DATE))}
            allowClear={false}
            size="small"
            style={{ width: 140 }}
          />
          <span style={{ fontSize: 14, fontWeight: 600 }}>của</span>
          <Select
            mode="multiple"
            allowClear={!deptLocked}
            value={selectedDept}
            onChange={setSelectedDept}
            disabled={deptLocked}
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
            style={{ minWidth: 180 }}
            placeholder="Chọn bộ phận"
            size="small"
          />
          {sortedWps.length > 0 && (
            <Segmented
              value={activeTab}
              onChange={(val) => setActiveTab(val as string)}
              size="small"
              style={{ marginLeft: 'auto' }}
              options={[
                { value: 'office', label: 'Giờ hành chính' },
                { value: 'other', label: 'Còn lại' },
              ]}
            />
          )}
        </div>
      }
    >
      {sortedWps.length === 0 ? (
        <Empty description="Không có ca trực" />
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'office' ? renderWorkplaceCollapse(officeWps, 'office') : renderWorkplaceCollapse(nonOfficeWps, 'other')}
        </div>
      )}

      {dayMeetings.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <Typography.Text strong style={{ fontSize: 13, color: '#1890ff', display: 'block', marginBottom: 6 }}>
            Lịch họp ({dayMeetings.length})
          </Typography.Text>
          {dayMeetings.map((m) => (
            <div key={m.id} style={{ padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag color={MEETING_TYPE_COLORS[m.meeting_type] || 'default'} style={{ margin: 0, fontSize: 10 }}>
                  {MEETING_TYPE_LABELS[m.meeting_type] || m.meeting_type}
                </Tag>
                <Typography.Text strong style={{ fontSize: 12 }}>{m.title}</Typography.Text>
              </div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                {m.start_time?.substring(0, 5)}
                {m.location && ` | ${m.location}`}
              </div>
              {m.participants && m.participants.length > 0 && (
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                  {m.participants.length} người tham gia
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={assigning !== null}
        title={`Phân ca: ${assigning?.stName || ''}`}
        onCancel={() => setAssigning(null)}
        footer={
          <Space>
            <Button onClick={() => setAssigning(null)}>Đóng</Button>
            <Button type="primary" onClick={handleSave} disabled={selectedIds.length === 0}>Thêm người trực</Button>
          </Space>
        }
        width={400}
        destroyOnClose
      >
        {currentSchedules.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Typography.Text strong style={{ fontSize: 13 }}>Người trực hiện tại:</Typography.Text>
            {currentSchedules.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span>
                  <Tag color={s.shift_color || 'blue'}>{s.employee_name || 'Unknown'}</Tag>
                </span>
                <Button size="small" danger onClick={() => handleDeleteSchedule(s.id)}>Xoá</Button>
              </div>
            ))}
          </div>
        )}
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>Thêm người trực:</Typography.Text>
          <Select
            mode="multiple"
            showSearch
            autoFocus
            style={{ width: '100%', marginTop: 4 }}
            placeholder="Chọn nhân viên..."
            value={selectedIds}
            onChange={setSelectedIds}
            optionFilterProp="label"
            notFoundContent="Không có nhân viên"
            options={allEmployees
              .filter((e) => {
                if (!e.is_active) return false;
                if (!assigning?.deptIds?.length) {
                  if (isScopeDept && user?.department_id && e.department_id !== user.department_id) return false;
                } else if (e.department_id && !assigning.deptIds.includes(e.department_id)) {
                  return false;
                }
                return true;
              })
              .map((e) => ({ label: e.full_name, value: e.id }))}
          />
        </div>
      </Modal>
    </Card>
  );
}
