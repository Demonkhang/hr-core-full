import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Table, Select, DatePicker, Button, Tag, message, Typography, Spin, Space, Card, Segmented, Avatar } from 'antd';
import { SearchOutlined, PrinterOutlined, DownloadOutlined, UserOutlined, ApartmentOutlined, CalendarOutlined, ClockCircleOutlined, TableOutlined, UsergroupAddOutlined } from '@ant-design/icons';
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

  // Flattened schedules for explicit flat table rendering
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

      const deptRows = data.map((d) => ({
        'Phòng ban': d.department_name,
        'Số NV': d.total_employees,
        'Số ca': d.total_shifts,
        'Tổng giờ': d.total_hours,
        'Giờ OT': d.overtime_hours,
      }));
      const deptWs = XLSX.utils.json_to_sheet(deptRows);
      XLSX.utils.book_append_sheet(wb, deptWs, 'Tổng hợp');

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
      XLSX.utils.book_append_sheet(wb, detailWs, 'Chi tiết');

      XLSX.writeFile(wb, `Bao_cao_lich_cong_tac_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);
      message.success('Xuất Excel thành công');
    } catch {
      message.error('Lỗi khi xuất Excel');
    }
  };

  const dateStr = dateRange?.[0] && dateRange?.[1]
    ? `${dateRange[0].format('DD/MM/YYYY')} - ${dateRange[1].format('DD/MM/YYYY')}`
    : '';

  // Table columns for flat detail view
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
            Tìm thấy <strong>{flatSchedules.length}</strong> lượt ca trực ({dateStr})
          </Typography.Text>
        </div>

        {/* Tab Content 1: Flat Detailed Schedule Table */}
        {viewMode === 'detail' && (
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

        {/* Tab Content 2: Grouped by Department Cards */}
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
                  {dept.employees.map((emp) => (
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
                      extra={<Tag color="green">{emp.total_hours}h</Tag>}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {emp.schedules.map((s) => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '6px 10px', borderRadius: 6 }}>
                            <div>
                              <span style={{ fontWeight: 500, fontSize: 12 }}>{dayjs(s.date).format('DD/MM')}:</span> <Tag color="geekblue">{s.shift_name}</Tag>
                            </div>
                            <div>
                              <Tag color={STATUS_COLORS[s.status] || 'default'}>{STATUS_LABELS[s.status] || s.status}</Tag>
                              <span style={{ fontSize: 12, fontWeight: 'bold' }}>{s.total_hours}h</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            ))}
          </Space>
        )}

        {/* Tab Content 3: Grouped by Employee */}
        {viewMode === 'employee' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {data.flatMap((dept) =>
              dept.employees.map((emp) => (
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
                  extra={<Tag color="purple">{emp.total_hours}h tổng cộng</Tag>}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {emp.schedules.map((s) => (
                      <div key={s.id} style={{ borderLeft: '3px solid #6366f1', paddingLeft: 10, background: '#f8fafc', padding: '8px', borderRadius: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong style={{ fontSize: 13 }}>{dayjs(s.date).format('DD/MM/YYYY')}</strong>
                          <Tag color={STATUS_COLORS[s.status] || 'default'}>{STATUS_LABELS[s.status] || s.status}</Tag>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#475569' }}>
                          <span>{s.shift_name} ({s.start_time} - {s.end_time})</span> • <Tag>{s.workplace_name || 'Trụ sở chính'}</Tag>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Print View Layout */}
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
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>Ngày</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>Ca trực</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>Thời gian</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>Số giờ</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {flatSchedules.map((s) => (
                <tr key={s.id}>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8 }}>{s.department_name}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8, fontWeight: 'bold' }}>{s.employee_name}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{dayjs(s.date).format('DD/MM/YYYY')}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8 }}>{s.shift_name}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{s.start_time} - {s.end_time}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{s.total_hours}h</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{STATUS_LABELS[s.status] || s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
