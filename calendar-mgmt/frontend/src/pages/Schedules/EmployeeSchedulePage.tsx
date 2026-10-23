import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, Input, Select, Button, Spin, Tag, Typography, Avatar, Empty, Space, Breadcrumb, Tabs } from 'antd';
import {
  SearchOutlined,
  CalendarOutlined,
  UserOutlined,
  ArrowLeftOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { employeeService } from '@/services/employeeService';
import { workplaceService } from '@/services/workplaceService';
import { departmentService } from '@/services/departmentService';
import { scheduleService } from '@/services/scheduleService';
import { meetingScheduleService } from '@/services/meetingScheduleService';
import { shiftTemplateService } from '@/services/shiftTemplateService';
import { PersonalTimelineCalendar } from './PersonalTimelineCalendar';
import { useAuthStore } from '@/store/authStore';
import type { Employee } from '@/types/employee';
import type { Workplace } from '@/types/workplace';
import type { Department } from '@/types/department';
import type { Schedule, ShiftTemplate } from '@/types/schedule';
import type { MeetingSchedule } from '@/types/meetingSchedule';

const AVATAR_COLORS = [
  '#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#1890ff',
  '#52c41a', '#eb2f96', '#722ed1', '#fa8c16', '#13c2c2',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function EmployeeSchedulePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected employee for personal calendar view
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeSchedules, setEmployeeSchedules] = useState<Schedule[]>([]);
  const [employeeMeetings, setEmployeeMeetings] = useState<MeetingSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWpFilter, setSelectedWpFilter] = useState<string>('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  const user = useAuthStore((s) => s.user);

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, wps, depts, templates] = await Promise.all([
        employeeService.list({ active_only: true }),
        workplaceService.list({ active_only: true }),
        departmentService.list(),
        shiftTemplateService.list(),
      ]);
      setEmployees(emps);
      setWorkplaces(wps);
      setDepartments(depts);
      setShiftTemplates(templates);
    } catch (err) {
      console.error('Error loading employee schedule data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load schedules when an employee is selected
  const loadEmployeeSchedules = useCallback(async (emp: Employee) => {
    setLoadingSchedules(true);
    try {
      const [schedules, meetings] = await Promise.all([
        scheduleService.list({ employee_id: emp.id, include_cancelled: false }),
        meetingScheduleService.getAll({ active_only: true }),
      ]);
      setEmployeeSchedules(schedules);
      // Filter meetings where this employee is a participant or creator
      const myMeetings = meetings.filter((m) =>
        m.participants?.some((p: any) => p.employee_id === emp.id) || m.created_by_id === emp.user_id
      );
      setEmployeeMeetings(myMeetings);
    } catch (err) {
      console.error('Error loading schedules for employee:', err);
    } finally {
      setLoadingSchedules(false);
    }
  }, []);

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    loadEmployeeSchedules(emp);
  };

  // Group employees by workplace ("danh sách của từng người theo từng chỗ")
  const groupedEmployees = useMemo(() => {
    // Filter employees by search & department
    const filtered = employees.filter((emp) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = emp.full_name?.toLowerCase().includes(term);
        const matchCode = emp.employee_code?.toLowerCase().includes(term);
        const matchDept = emp.department_name?.toLowerCase().includes(term);
        const matchPos = emp.position_name?.toLowerCase().includes(term);
        if (!matchName && !matchCode && !matchDept && !matchPos) return false;
      }
      if (selectedDeptFilter !== 'all' && emp.department_id !== selectedDeptFilter) {
        return false;
      }
      return true;
    });

    // Map each employee to a workplace
    // 1. If emp.workplace_id -> that workplace
    // 2. If not, check if any template matching emp.department_id has workplace_id
    // 3. Fallback to first workplace or 'other'
    const groups = new Map<string, { workplace: Workplace | null; employees: Employee[] }>();

    for (const wp of workplaces) {
      groups.set(wp.id, { workplace: wp, employees: [] });
    }
    groups.set('unassigned', { workplace: null, employees: [] });

    for (const emp of filtered) {
      let targetWpId = emp.workplace_id;
      if (!targetWpId || !groups.has(targetWpId)) {
        // Try finding template with employee department
        const matchingTemplate = shiftTemplates.find(
          (t) => t.department_ids && t.department_ids.includes(emp.department_id)
        );
        if (matchingTemplate && groups.has(matchingTemplate.workplace_id)) {
          targetWpId = matchingTemplate.workplace_id;
        } else if (workplaces.length > 0) {
          // Default to the first office workplace e.g. Trụ sở chính
          const officeWp = workplaces.find((w) => w.is_office_hours) || workplaces[0];
          targetWpId = officeWp.id;
        } else {
          targetWpId = 'unassigned';
        }
      }

      const group = groups.get(targetWpId) || groups.get('unassigned')!;
      group.employees.push(emp);
    }

    // Filter by selected workplace if set
    const result: { wpId: string; workplaceName: string; isOffice: boolean; employees: Employee[] }[] = [];
    for (const [wpId, g] of groups.entries()) {
      if (selectedWpFilter !== 'all' && wpId !== selectedWpFilter) continue;
      if (g.employees.length === 0) continue;

      result.push({
        wpId,
        workplaceName: g.workplace ? g.workplace.name : 'Khác / Chưa phân nơi làm việc',
        isOffice: g.workplace?.is_office_hours ?? false,
        employees: g.employees,
      });
    }

    return result;
  }, [employees, workplaces, shiftTemplates, searchTerm, selectedDeptFilter, selectedWpFilter]);

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  // If an employee is selected, show their personal calendar!
  if (selectedEmployee) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)', gap: 12 }}>
        {/* Navigation & Employee Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fff',
            padding: '10px 18px',
            borderRadius: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => setSelectedEmployee(null)}
              style={{ borderRadius: 6, fontWeight: 500 }}
            >
              Danh sách theo chỗ
            </Button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar
                size={38}
                style={{
                  backgroundColor: getAvatarColor(selectedEmployee.full_name),
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {selectedEmployee.full_name?.charAt(0)?.toUpperCase()}
              </Avatar>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {selectedEmployee.full_name}
                  </Typography.Text>
                  {selectedEmployee.employee_code && (
                    <Tag color="cyan" style={{ margin: 0, fontSize: 11 }}>
                      {selectedEmployee.employee_code}
                    </Tag>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {selectedEmployee.department_name || 'Phòng ban'}
                  {selectedEmployee.position_name && ` • ${selectedEmployee.position_name}`}
                  {selectedEmployee.workplace_name && ` • 📍 ${selectedEmployee.workplace_name}`}
                </div>
              </div>
            </div>
          </div>

          {/* Quick switcher to another employee */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Đổi nhân viên:</span>
            <Select
              showSearch
              placeholder="Chọn nhân viên khác"
              value={selectedEmployee.id}
              onChange={(empId) => {
                const target = employees.find((e) => e.id === empId);
                if (target) handleSelectEmployee(target);
              }}
              style={{ width: 220 }}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.full_name} (${e.employee_code || e.department_name || ''})`,
              }))}
            />
          </div>
        </div>

        {/* Timeline Calendar matching Image 2 */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {loadingSchedules ? (
            <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
          ) : (
            <PersonalTimelineCalendar
              employee={selectedEmployee}
              schedules={employeeSchedules}
              meetings={employeeMeetings}
              shiftTemplates={shiftTemplates}
              onRefresh={() => loadEmployeeSchedules(selectedEmployee)}
            />
          )}
        </div>
      </div>
    );
  }

  // Otherwise, show employee list grouped by workplace ("theo từng chỗ")
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Header & Filter Controls */}
      <Card
        size="small"
        styles={{ body: { padding: '16px 20px' } }}
        style={{ borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>
              Trực ca • Xem theo người
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Danh sách nhân sự phân theo từng nơi làm việc. Bấm vào nhân viên để xem lịch cá nhân chi tiết.
            </Typography.Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Tìm theo tên, mã NV, phòng ban..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              allowClear
              style={{ width: 260, borderRadius: 6 }}
            />

            <Select
              value={selectedWpFilter}
              onChange={setSelectedWpFilter}
              style={{ width: 180 }}
              options={[
                { value: 'all', label: 'Tất cả nơi làm việc' },
                ...workplaces.map((w) => ({ value: w.id, label: w.name })),
              ]}
            />

            <Select
              value={selectedDeptFilter}
              onChange={setSelectedDeptFilter}
              style={{ width: 180 }}
              options={[
                { value: 'all', label: 'Tất cả phòng ban' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Workplace Sections List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {groupedEmployees.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '60px 0', borderRadius: 10 }}>
            <Empty description="Không tìm thấy nhân viên nào phù hợp với điều kiện lọc." />
          </Card>
        ) : (
          groupedEmployees.map((group) => (
            <Card
              key={group.wpId}
              size="small"
              style={{
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                overflow: 'hidden',
              }}
              styles={{
                header: {
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  padding: '10px 16px',
                },
                body: { padding: 16 },
              }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <EnvironmentOutlined style={{ color: '#3b82f6', fontSize: 16 }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                      {group.workplaceName}
                    </span>
                    <Tag color={group.isOffice ? 'blue' : 'orange'} style={{ margin: 0, fontSize: 11 }}>
                      {group.isOffice ? 'Văn phòng / Giờ hành chính' : 'Ca trực / Hiện trường'}
                    </Tag>
                  </div>
                  <Tag color="purple" style={{ margin: 0, fontWeight: 600 }}>
                    {group.employees.length} nhân viên
                  </Tag>
                </div>
              }
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 14,
                }}
              >
                {group.employees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => handleSelectEmployee(emp)}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '14px 16px',
                      background: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 120,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.12)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div>
                      {/* Top Row: Avatar + Name + Code */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar
                          size={40}
                          style={{
                            backgroundColor: getAvatarColor(emp.full_name),
                            fontWeight: 700,
                            fontSize: 16,
                            flexShrink: 0,
                          }}
                        >
                          {emp.full_name?.charAt(0)?.toUpperCase()}
                        </Avatar>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Typography.Text
                            strong
                            style={{
                              fontSize: 14,
                              color: '#1e293b',
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {emp.full_name}
                          </Typography.Text>
                          <span style={{ fontSize: 12, color: '#64748b' }}>
                            {emp.employee_code ? `Mã: ${emp.employee_code}` : 'Chưa có mã'}
                          </span>
                        </div>
                      </div>

                      {/* Middle: Department & Position */}
                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {emp.department_name && (
                          <Tag color="geekblue" style={{ margin: 0, fontSize: 11 }}>
                            {emp.department_name}
                          </Tag>
                        )}
                        {emp.position_name && (
                          <Tag style={{ margin: 0, fontSize: 11, background: '#f1f5f9', color: '#475569', border: 'none' }}>
                            {emp.position_name}
                          </Tag>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Button */}
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>
                        Xem lịch cá nhân →
                      </span>
                      <Button
                        type="primary"
                        size="small"
                        icon={<CalendarOutlined />}
                        style={{
                          borderRadius: 6,
                          background: '#3b82f6',
                          fontSize: 12,
                        }}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleSelectEmployee(emp);
                        }}
                      >
                        Lịch trực
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
