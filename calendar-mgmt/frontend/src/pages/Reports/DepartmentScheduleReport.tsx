import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Table, Select, DatePicker, Button, Tag, message, Typography, Spin, Space, Card, Segmented, Avatar } from 'antd';
import {
  SearchOutlined,
  PrinterOutlined,
  DownloadOutlined,
  UserOutlined,
  ApartmentOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  TableOutlined,
  UsergroupAddOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { departmentService } from '@/services/departmentService';
import { reportService } from '@/services/reportService';
import type { Department } from '@/types/department';
import type { DepartmentScheduleReport } from '@/types/report';
import dayjs from 'dayjs';
import { DATE_FORMATS, COLORS, ERROR_MESSAGES } from '@/utils/constants';

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  pending: 'warning',
  approved: 'success',
  confirmed: 'processing',
  rejected: 'error',
  cancelled: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  confirmed: 'Đã xác nhận',
  rejected: 'Từ chối',
  cancelled: 'Đã xoá',
};

const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

interface WorkdayShift {
  id: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  is_overtime: boolean;
  status: string;
  workplace_name?: string;
}

interface WorkdayRecord {
  id: string;
  department_id: string;
  department_name: string;
  employee_id: string;
  employee_name: string;
  date: string;
  dayName: string;
  formattedDate: string;
  shifts: WorkdayShift[];
  shift_count: number;
  total_hours: number;
  has_overtime: boolean;
  status: string;
}

export function DepartmentScheduleReport() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [data, setData] = useState<DepartmentScheduleReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<string>('detail');
  const [tableGroupingMode, setTableGroupingMode] = useState<'grouped' | 'flat'>('grouped');
  const loadedRef = useRef(false);

  useEffect(() => {
    departmentService.list().then(setDepartments).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!dateRange?.[0] || !dateRange?.[1]) return;
    const dFrom = dateRange[0].format(DATE_FORMATS.ISO_DATE);
    const dTo = dateRange[1].format(DATE_FORMATS.ISO_DATE);
    setLoading(true);
    try {
      const [depts, result] = await Promise.all([
        departmentService.list(),
        reportService.getDepartmentScheduleReport({
          date_from: dFrom,
          date_to: dTo,
          department_id: selectedDept.length > 0 ? selectedDept : undefined,
        }),
      ]);
      setDepartments(depts);
      setData(result);
      loadedRef.current = true;
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  }, [selectedDept, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Flattened schedules for flat table rendering
  const flatSchedules = useMemo(() => {
    const list: any[] = [];
    for (const dept of data) {
      for (const emp of dept.employees) {
        for (const s of emp.schedules) {
          list.push({
            ...s,
            department_id: dept.department_id,
            department_name: dept.department_name || 'Ban Quản lý',
            employee_id: emp.employee_id,
            employee_name: emp.employee_name || 'Nhân viên',
          });
        }
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Grouped workdays: Group multiple shifts on the same day for the same employee into ONE workday record
  const groupedWorkdays = useMemo<WorkdayRecord[]>(() => {
    const records: WorkdayRecord[] = [];
    for (const dept of data) {
      for (const emp of dept.employees) {
        const byDate = new Map<string, WorkdayShift[]>();
        for (const s of emp.schedules) {
          const list = byDate.get(s.date) || [];
          list.push(s);
          byDate.set(s.date, list);
        }

        for (const [dateStr, shifts] of byDate.entries()) {
          const sortedShifts = [...shifts].sort((a, b) => a.start_time.localeCompare(b.start_time));
          const totalHours = Math.round(sortedShifts.reduce((acc, cur) => acc + (cur.total_hours || 0), 0) * 10) / 10;
          const hasOvertime = sortedShifts.some((s) => s.is_overtime);
          const dayIndex = dayjs(dateStr).day();
          const dayName = DAY_NAMES[dayIndex] || '';

          const uniqueStatuses = Array.from(new Set(sortedShifts.map((s) => s.status)));
          const combinedStatus = uniqueStatuses.length === 1 ? uniqueStatuses[0] : 'mixed';

          records.push({
            id: `${emp.employee_id}_${dateStr}`,
            department_id: dept.department_id,
            department_name: dept.department_name || 'Ban Quản lý',
            employee_id: emp.employee_id,
            employee_name: emp.employee_name || 'Nhân viên',
            date: dateStr,
            dayName,
            formattedDate: dayjs(dateStr).format('DD/MM/YYYY'),
            shifts: sortedShifts,
            shift_count: sortedShifts.length,
            total_hours: totalHours,
            has_overtime: hasOvertime,
            status: combinedStatus,
          });
        }
      }
    }

    return records.sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      return a.employee_name.localeCompare(b.employee_name);
    });
  }, [data]);

  // Overall statistics totals
  const totals = useMemo(() => {
    const t = { departments: 0, employees: 0, shifts: 0, hours: 0, otHours: 0 };
    for (const dept of data) {
      t.departments += 1;
      t.employees += dept.total_employees;
      t.shifts += dept.total_shifts;
      t.hours += dept.total_hours;
      t.otHours += dept.overtime_hours;
    }
    return t;
  }, [data]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Sheet 1: Grouped by Workday
      const workdayRows = groupedWorkdays.map((r) => ({
        'Phòng ban': r.department_name,
        'Nhân viên': r.employee_name,
        'Ngày trực': r.formattedDate,
        'Thứ': r.dayName,
        'Số ca': r.shift_count,
        'Tổng giờ ngày': r.total_hours,
        'Có OT': r.has_overtime ? 'Có' : 'Không',
        'Chi tiết các ca': r.shifts
          .map(
            (s) =>
              `${s.shift_name} (${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}, ${s.total_hours}h${
                s.workplace_name ? `, ${s.workplace_name}` : ''
              })`
          )
          .join('; '),
        'Trạng thái': r.status === 'mixed' ? 'Đa trạng thái' : STATUS_LABELS[r.status] || r.status,
      }));
      const workdayWs = XLSX.utils.json_to_sheet(workdayRows);
      XLSX.utils.book_append_sheet(wb, workdayWs, 'Theo ngày làm việc');

      // Sheet 2: Department Summary
      const deptRows = data.map((d) => ({
        'Phòng ban': d.department_name,
        'Số NV': d.total_employees,
        'Số ca': d.total_shifts,
        'Tổng giờ': d.total_hours,
        'Giờ OT': d.overtime_hours,
      }));
      const deptWs = XLSX.utils.json_to_sheet(deptRows);
      XLSX.utils.book_append_sheet(wb, deptWs, 'Tổng hợp phòng ban');

      // Sheet 3: Flat single shift details
      const detailRows = flatSchedules.map((s) => ({
        'Phòng ban': s.department_name,
        'Nhân viên': s.employee_name,
        'Ngày': dayjs(s.date).format('DD/MM/YYYY'),
        'Ca': s.shift_name,
        'Giờ BĐ': s.start_time,
        'Giờ KT': s.end_time,
        'Nơi làm việc': s.workplace_name || 'Trụ sở chính',
        'Tổng giờ': s.total_hours,
        'OT': s.is_overtime ? 'Có' : 'Không',
        'Trạng thái': STATUS_LABELS[s.status] || s.status,
      }));
      const detailWs = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, detailWs, 'Chi tiết từng ca');

      XLSX.writeFile(wb, `Bao_cao_lich_cong_tac_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);
      message.success('Xuất Excel thành công');
    } catch {
      message.error('Lỗi khi xuất Excel');
    }
  };

  const dateStr = dateRange?.[0] && dateRange?.[1]
    ? `${dateRange[0].format('DD/MM/YYYY')} - ${dateRange[1].format('DD/MM/YYYY')}`
    : '';

  // Columns for Grouped Workday Table (1 row per employee per date)
  const groupedColumns = [
    {
      title: 'Phòng ban',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 170,
      render: (text: string) => (
        <Tag color="blue" icon={<ApartmentOutlined />} style={{ fontWeight: 500 }}>
          {text || 'Ban Quản lý'}
        </Tag>
      ),
    },
    {
      title: 'Nhân viên',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 180,
      render: (text: string) => (
        <Space>
          <Avatar style={{ backgroundColor: '#6366f1' }} icon={<UserOutlined />} size="small" />
          <Typography.Text strong>{text || 'Nhân viên'}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Ngày trực',
      dataIndex: 'date',
      key: 'date',
      width: 150,
      render: (_: string, r: WorkdayRecord) => (
        <div>
          <Tag color="purple" icon={<CalendarOutlined />} style={{ fontWeight: 600 }}>
            {r.formattedDate}
          </Tag>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, paddingLeft: 4 }}>
            {r.dayName}
          </div>
        </div>
      ),
    },
    {
      title: 'Các ca trực trong ngày',
      key: 'shifts',
      render: (_: any, r: WorkdayRecord) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {r.shifts.map((s, idx) => (
            <div
              key={s.id || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 10px',
                borderRadius: 6,
                background: idx % 2 === 0 ? '#f8fafc' : '#f1f5f9',
                border: '1px solid #e2e8f0',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <ClockCircleOutlined style={{ color: '#6366f1', fontSize: 12 }} />
                <Typography.Text strong style={{ fontSize: 12 }}>
                  {s.shift_name}
                </Typography.Text>
                <span style={{ fontSize: 12, color: '#475569' }}>
                  ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                </span>
                {s.workplace_name && (
                  <Tag color="cyan" style={{ fontSize: 11, margin: 0, padding: '0 6px', lineHeight: '18px' }}>
                    {s.workplace_name}
                  </Tag>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                  {s.total_hours}h
                </span>
                {s.is_overtime && <Tag color="red" style={{ margin: 0, fontSize: 10 }}>OT</Tag>}
                <Tag color={STATUS_COLORS[s.status] || 'default'} style={{ margin: 0, fontSize: 11, padding: '0 6px' }}>
                  {STATUS_LABELS[s.status] || s.status}
                </Tag>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Số ca',
      dataIndex: 'shift_count',
      key: 'shift_count',
      width: 85,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 1 ? 'gold' : 'default'} style={{ fontWeight: 600 }}>
          {count} ca
        </Tag>
      ),
    },
    {
      title: 'Tổng giờ ngày',
      dataIndex: 'total_hours',
      key: 'total_hours',
      width: 120,
      align: 'center' as const,
      render: (v: number, r: WorkdayRecord) => (
        <div>
          <Typography.Text
            type={r.has_overtime ? 'danger' : undefined}
            strong
            style={{ fontSize: 15 }}
          >
            {v}h
          </Typography.Text>
          {r.has_overtime && (
            <div style={{ marginTop: 2 }}>
              <Tag color="red" style={{ margin: 0, fontSize: 10 }}>Có OT</Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      align: 'center' as const,
      render: (v: string) => {
        if (v === 'mixed') {
          return <Tag color="processing">Nhiều TT</Tag>;
        }
        return (
          <Tag color={STATUS_COLORS[v] || 'default'}>
            {STATUS_LABELS[v] || v}
          </Tag>
        );
      },
    },
  ];

  // Table columns for flat single shift detail view
  const detailColumns = [
    {
      title: 'Phòng ban',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 180,
      render: (text: string) => (
        <Tag color="blue" icon={<ApartmentOutlined />}>
          {text || 'Ban Quản lý'}
        </Tag>
      ),
    },
    {
      title: 'Nhân viên',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 200,
      render: (text: string) => (
        <Space>
          <Avatar style={{ backgroundColor: '#6366f1' }} icon={<UserOutlined />} size="small" />
          <Typography.Text strong>{text || 'Nhân viên'}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Ngày trực',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (v: string) => (
        <Tag color="purple" icon={<CalendarOutlined />}>
          {dayjs(v).format('DD/MM/YYYY')}
        </Tag>
      ),
    },
    {
      title: 'Ca trực',
      dataIndex: 'shift_name',
      key: 'shift_name',
      width: 150,
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: 'Khung giờ',
      key: 'time',
      width: 130,
      render: (_: any, r: any) => (
        <Space size={4}>
          <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
          <span>{r.start_time} - {r.end_time}</span>
        </Space>
      ),
    },
    {
      title: 'Nơi làm việc',
      dataIndex: 'workplace_name',
      key: 'workplace_name',
      width: 160,
      render: (v: string) => <Tag color="cyan">{v || 'Trụ sở chính'}</Tag>,
    },
    {
      title: 'Tổng giờ',
      dataIndex: 'total_hours',
      key: 'total_hours',
      width: 90,
      align: 'center' as const,
      render: (v: number, r: any) => (
        <Typography.Text type={r.is_overtime ? 'danger' : undefined} strong>
          {v}h {r.is_overtime && <Tag color="red" style={{ marginLeft: 4 }}>OT</Tag>}
        </Typography.Text>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: string) => (
        <Tag color={STATUS_COLORS[v] || 'default'}>
          {STATUS_LABELS[v] || v}
        </Tag>
      ),
    },
  ];

  if (loading && !loadedRef.current) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div style={{ padding: '4px' }}>
      <div className="screen-report-area">
        {/* Header Filter Controls */}
        <Card style={{ marginBottom: 16, borderRadius: 8 }} bodyStyle={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              📊 Thống kê Lịch trực & Công tác
            </Typography.Title>
            <Space wrap>
              <Select
                mode="multiple"
                allowClear
                placeholder="Chọn phòng ban"
                style={{ minWidth: 200 }}
                value={selectedDept}
                onChange={setSelectedDept}
                options={departments.map((d) => ({ label: d.name, value: d.id }))}
              />
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                format="DD/MM/YYYY"
              />
              <Button type="primary" icon={<SearchOutlined />} onClick={fetchData} loading={loading}>
                Xem báo cáo
              </Button>
              <Button icon={<PrinterOutlined />} onClick={handlePrint} disabled={!loadedRef.current}>
                In / PDF
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleExportExcel} disabled={!loadedRef.current}>
                Xuất Excel
              </Button>
            </Space>
          </div>
        </Card>

        {/* Top Summary Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 8, background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', border: 'none' }}>
            <div style={{ color: '#0369a1', fontSize: 13, fontWeight: 500 }}>Phòng ban</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#0c4a6e', marginTop: 4 }}>
              <ApartmentOutlined style={{ marginRight: 8 }} />
              {totals.departments}
            </div>
          </Card>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 8, background: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)', border: 'none' }}>
            <div style={{ color: '#15803d', fontSize: 13, fontWeight: 500 }}>Nhân viên trực</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#14532d', marginTop: 4 }}>
              <UsergroupAddOutlined style={{ marginRight: 8 }} />
              {totals.employees}
            </div>
          </Card>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 8, background: 'linear-gradient(135deg, #faf5ff 0%, #e9d5ff 100%)', border: 'none' }}>
            <div style={{ color: '#7e22ce', fontSize: 13, fontWeight: 500 }}>Tổng ca trực</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#581c87', marginTop: 4 }}>
              <CalendarOutlined style={{ marginRight: 8 }} />
              {totals.shifts}
            </div>
          </Card>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 8, background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)', border: 'none' }}>
            <div style={{ color: '#c2410c', fontSize: 13, fontWeight: 500 }}>Tổng giờ trực</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#7c2d12', marginTop: 4 }}>
              <ClockCircleOutlined style={{ marginRight: 8 }} />
              {totals.hours}h
            </div>
          </Card>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 8, background: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)', border: 'none' }}>
            <div style={{ color: '#b91c1c', fontSize: 13, fontWeight: 500 }}>Giờ OT</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: totals.otHours > 0 ? COLORS.ERROR_RED : '#7f1d1d', marginTop: 4 }}>
              {totals.otHours}h
            </div>
          </Card>
        </div>

        {/* View Mode Switcher */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Segmented
            options={[
              { label: '📋 Chi tiết ca trực', value: 'detail', icon: <TableOutlined /> },
              { label: '🏢 Theo phòng ban', value: 'department', icon: <ApartmentOutlined /> },
              { label: '👤 Theo nhân viên', value: 'employee', icon: <UserOutlined /> },
            ]}
            value={viewMode}
            onChange={(val) => setViewMode(val as string)}
            size="large"
          />
          <Typography.Text type="secondary">
            Tìm thấy <strong>{groupedWorkdays.length}</strong> ngày công (<strong>{flatSchedules.length}</strong> lượt ca trực) trong khoảng ({dateStr})
          </Typography.Text>
        </div>

        {/* Tab Content 1: Schedule Table (Default: Grouped by Workday) */}
        {viewMode === 'detail' && (
          <div>
            {/* Table Sub-mode Segmented Toggle */}
            <div
              style={{
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                background: '#f8fafc',
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <Space size="middle">
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
                  <AppstoreOutlined style={{ marginRight: 6, color: '#6366f1' }} />
                  Kiểu hiển thị bảng:
                </span>
                <Segmented
                  size="small"
                  value={tableGroupingMode}
                  onChange={(val) => setTableGroupingMode(val as 'grouped' | 'flat')}
                  options={[
                    { label: `Gom nhóm theo ngày (${groupedWorkdays.length} dòng)`, value: 'grouped' },
                    { label: `Xem từng ca lẻ (${flatSchedules.length} dòng)`, value: 'flat' },
                  ]}
                />
              </Space>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {tableGroupingMode === 'grouped'
                  ? '✨ Đang gộp các ca cùng ngày của nhân viên (sáng + chiều) thành 1 dòng, tính tổng giờ ngày gọn gàng'
                  : '📋 Hiển thị từng ca làm việc rời rạc trên mỗi dòng'}
              </Typography.Text>
            </div>

            {tableGroupingMode === 'grouped' ? (
              <Table
                dataSource={groupedWorkdays}
                columns={groupedColumns}
                rowKey="id"
                pagination={{ pageSize: 15, showSizeChanger: true }}
                loading={loading}
                size="middle"
                bordered
                locale={{ emptyText: 'Không tìm thấy dữ liệu ca trực trong khoảng thời gian này' }}
              />
            ) : (
              <Table
                dataSource={flatSchedules}
                columns={detailColumns}
                rowKey="id"
                pagination={{ pageSize: 15, showSizeChanger: true }}
                loading={loading}
                size="middle"
                bordered
                locale={{ emptyText: 'Không tìm thấy dữ liệu ca trực trong khoảng thời gian này' }}
              />
            )}
          </div>
        )}

        {/* Tab Content 2: Grouped by Department Cards (Each Employee Grouped by Day) */}
        {viewMode === 'department' && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {data.map((dept) => (
              <Card
                key={dept.department_id}
                title={
                  <Space wrap>
                    <ApartmentOutlined style={{ color: '#6366f1' }} />
                    <Typography.Text strong style={{ fontSize: 16 }}>
                      {dept.department_name || 'Ban Quản lý'}
                    </Typography.Text>
                    <Tag color="blue">{dept.total_employees} nhân viên</Tag>
                    <Tag color="purple">{dept.total_shifts} ca trực</Tag>
                    <Tag color="orange">{dept.total_hours} giờ</Tag>
                  </Space>
                }
                bordered
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {dept.employees.map((emp) => {
                    // Group emp.schedules by date
                    const empDateMap = new Map<string, typeof emp.schedules>();
                    for (const s of emp.schedules) {
                      const list = empDateMap.get(s.date) || [];
                      list.push(s);
                      empDateMap.set(s.date, list);
                    }
                    const empWorkdays = Array.from(empDateMap.entries())
                      .map(([date, shifts]) => {
                        const sorted = [...shifts].sort((a, b) => a.start_time.localeCompare(b.start_time));
                        const totalH = Math.round(sorted.reduce((acc, cur) => acc + (cur.total_hours || 0), 0) * 10) / 10;
                        return {
                          date,
                          dayName: DAY_NAMES[dayjs(date).day()] || '',
                          shifts: sorted,
                          totalHours: totalH,
                        };
                      })
                      .sort((a, b) => a.date.localeCompare(b.date));

                    return (
                      <Card
                        key={emp.employee_id}
                        size="small"
                        type="inner"
                        title={
                          <Space>
                            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#4f46e5' }} />
                            <strong>{emp.employee_name}</strong>
                          </Space>
                        }
                        extra={<Tag color="green">{emp.total_hours}h ({empWorkdays.length} ngày)</Tag>}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {empWorkdays.map((day) => (
                            <div
                              key={day.date}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 6,
                                padding: '6px 8px',
                              }}
                            >
                              {/* Day Header with Total Hours */}
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: day.shifts.length > 1 ? 4 : 2,
                                  borderBottom: day.shifts.length > 1 ? '1px dashed #cbd5e1' : 'none',
                                  paddingBottom: day.shifts.length > 1 ? 4 : 0,
                                }}
                              >
                                <span style={{ fontWeight: 600, fontSize: 12, color: '#334155' }}>
                                  <CalendarOutlined style={{ marginRight: 4, color: '#6366f1' }} />
                                  {dayjs(day.date).format('DD/MM')} ({day.dayName})
                                </span>
                                <Tag color={day.shifts.length > 1 ? 'purple' : 'blue'} style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
                                  {day.totalHours}h {day.shifts.length > 1 && `(${day.shifts.length} ca)`}
                                </Tag>
                              </div>

                              {/* Shifts within the day */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {day.shifts.map((s) => (
                                  <div
                                    key={s.id}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: 12,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                      <Tag color="geekblue" style={{ margin: 0, fontSize: 11 }}>
                                        {s.shift_name}
                                      </Tag>
                                      <span style={{ color: '#64748b', fontSize: 11 }}>
                                        ({s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)})
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Tag color={STATUS_COLORS[s.status] || 'default'} style={{ margin: 0, fontSize: 10 }}>
                                        {STATUS_LABELS[s.status] || s.status}
                                      </Tag>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
                                        {s.total_hours}h
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </Card>
            ))}
          </Space>
        )}

        {/* Tab Content 3: Grouped by Employee (Each Employee Grouped by Day) */}
        {viewMode === 'employee' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {data.flatMap((dept) =>
              dept.employees.map((emp) => {
                const empDateMap = new Map<string, typeof emp.schedules>();
                for (const s of emp.schedules) {
                  const list = empDateMap.get(s.date) || [];
                  list.push(s);
                  empDateMap.set(s.date, list);
                }
                const empWorkdays = Array.from(empDateMap.entries())
                  .map(([date, shifts]) => {
                    const sorted = [...shifts].sort((a, b) => a.start_time.localeCompare(b.start_time));
                    const totalH = Math.round(sorted.reduce((acc, cur) => acc + (cur.total_hours || 0), 0) * 10) / 10;
                    return {
                      date,
                      dayName: DAY_NAMES[dayjs(date).day()] || '',
                      shifts: sorted,
                      totalHours: totalH,
                    };
                  })
                  .sort((a, b) => a.date.localeCompare(b.date));

                return (
                  <Card
                    key={emp.employee_id}
                    bordered
                    title={
                      <Space>
                        <Avatar style={{ backgroundColor: '#8b5cf6' }} icon={<UserOutlined />} />
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{emp.employee_name}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{dept.department_name}</div>
                        </div>
                      </Space>
                    }
                    extra={<Tag color="purple">{emp.total_hours}h ({empWorkdays.length} ngày)</Tag>}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {empWorkdays.map((day) => (
                        <div
                          key={day.date}
                          style={{
                            borderLeft: '3px solid #6366f1',
                            background: '#f8fafc',
                            padding: '8px 10px',
                            borderRadius: 4,
                            borderTop: '1px solid #e2e8f0',
                            borderRight: '1px solid #e2e8f0',
                            borderBottom: '1px solid #e2e8f0',
                          }}
                        >
                          {/* Day Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <strong style={{ fontSize: 13, color: '#1e293b' }}>
                              {dayjs(day.date).format('DD/MM/YYYY')} ({day.dayName})
                            </strong>
                            <Tag color={day.shifts.length > 1 ? 'purple' : 'blue'} style={{ margin: 0, fontWeight: 600 }}>
                              {day.totalHours}h {day.shifts.length > 1 && `(${day.shifts.length} ca)`}
                            </Tag>
                          </div>

                          {/* List of Shifts for this Day */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {day.shifts.map((s) => (
                              <div
                                key={s.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: 12,
                                  color: '#475569',
                                  background: '#ffffff',
                                  padding: '4px 6px',
                                  borderRadius: 4,
                                  border: '1px solid #f1f5f9',
                                }}
                              >
                                <div>
                                  <span style={{ fontWeight: 600, color: '#334155' }}>{s.shift_name}</span>
                                  <span style={{ color: '#64748b', marginLeft: 4 }}>
                                    ({s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)})
                                  </span>
                                  {s.workplace_name && (
                                    <Tag color="cyan" style={{ fontSize: 10, margin: '0 0 0 6px', padding: '0 4px', lineHeight: '16px' }}>
                                      {s.workplace_name}
                                    </Tag>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Tag color={STATUS_COLORS[s.status] || 'default'} style={{ margin: 0, fontSize: 10 }}>
                                    {STATUS_LABELS[s.status] || s.status}
                                  </Tag>
                                  <span style={{ fontWeight: 600, fontSize: 11 }}>{s.total_hours}h</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Print View Layout (Grouped by Workday for compact, professional printing) */}
      {loadedRef.current && (
        <div className="print-only A4-print-container">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Typography.Title level={3} style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '20px' }}>
              LỊCH CÔNG TÁC VÀ TRỰC CA
            </Typography.Title>
            {dateStr && <div style={{ fontSize: 13, color: '#333', marginTop: 8, fontStyle: 'italic' }}>Thời gian: {dateStr}</div>}
          </div>

          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>Phòng ban</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>Nhân viên</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>Ngày trực</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>Các ca trực trong ngày</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>Số ca</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>Tổng giờ</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {groupedWorkdays.map((r) => (
                <tr key={r.id}>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8 }}>{r.department_name}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8, fontWeight: 'bold' }}>{r.employee_name}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>
                    {r.formattedDate} ({r.dayName})
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8 }}>
                    {r.shifts.map((s, idx) => (
                      <div key={idx} style={{ margin: '2px 0' }}>
                        • <strong>{s.shift_name}</strong> ({s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)}) - {s.workplace_name || 'Trụ sở chính'}: {s.total_hours}h
                      </div>
                    ))}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{r.shift_count} ca</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center', fontWeight: 'bold' }}>{r.total_hours}h</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>
                    {r.status === 'mixed' ? 'Đa trạng thái' : STATUS_LABELS[r.status] || r.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
