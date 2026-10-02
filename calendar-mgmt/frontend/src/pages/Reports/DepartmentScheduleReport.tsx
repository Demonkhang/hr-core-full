import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Table, Select, DatePicker, Button, Tag, message, Typography, Spin, Space } from 'antd';
import { SearchOutlined, PrinterOutlined, DownloadOutlined } from '@ant-design/icons';
import { departmentService } from '@/services/departmentService';
import { reportService } from '@/services/reportService';
import type { Department } from '@/types/department';
import type { DepartmentScheduleReport, ScheduleDetail } from '@/types/report';
import dayjs from 'dayjs';
import { QUERY_PARAMS, DATE_FORMATS, COLORS, ERROR_MESSAGES } from '@/utils/constants';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  pending: '#f59e0b',
  approved: '#10b981',
  confirmed: '#6366f1',
  rejected: '#ef4444',
  cancelled: '#64748b',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  confirmed: 'Đã xác nhận',
  rejected: 'Từ chối',
  cancelled: 'Đã xoá',
};

interface WorkplaceGroup {
  workplace_name: string;
  schedules: (ScheduleDetail & { employee_name: string })[];
}

interface DateGroup {
  date: string;
  workplaceGroups: WorkplaceGroup[];
  schedules: (ScheduleDetail & { employee_name: string })[];
}

interface DeptWithDates {
  department_id: string;
  department_name: string;
  total_employees: number;
  total_shifts: number;
  total_hours: number;
  overtime_hours: number;
  dateGroups: DateGroup[];
}

export function DepartmentScheduleReport() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [data, setData] = useState<DepartmentScheduleReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDeptKeys, setExpandedDeptKeys] = useState<string[]>([]);
  const [expandedDateKeys, setExpandedDateKeys] = useState<string[]>([]);
  const [expandedWorkplaceKeys, setExpandedWorkplaceKeys] = useState<string[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);
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

  const deptWithDates: DeptWithDates[] = useMemo(() => {
    return data.map((dept) => {
      const dateMap: Record<string, (ScheduleDetail & { employee_name: string })[]> = {};
      for (const emp of dept.employees) {
        for (const s of emp.schedules) {
          if (!dateMap[s.date]) dateMap[s.date] = [];
          dateMap[s.date].push({ ...s, employee_name: emp.employee_name });
        }
      }
      const dateGroups: DateGroup[] = Object.entries(dateMap)
        .map(([date, schedules]) => {
          const workplaceMap: Record<string, (ScheduleDetail & { employee_name: string })[]> = {};
          for (const s of schedules) {
            const wpName = s.workplace_name || 'Khác';
            if (!workplaceMap[wpName]) workplaceMap[wpName] = [];
            workplaceMap[wpName].push(s);
          }
          const workplaceGroups: WorkplaceGroup[] = Object.entries(workplaceMap).map(([workplace_name, schedules]) => ({
            workplace_name,
            schedules
          }));
          return { date, workplaceGroups, schedules };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
      return {
        ...dept,
        dateGroups,
      };
    });
  }, [data]);

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

  const scheduleColumns: any[] = useMemo(() => [
    { title: 'Nhân viên', dataIndex: 'employee_name', key: 'employee_name', width: 180 },
    { title: 'Ca', dataIndex: 'shift_name', key: 'shift_name', width: 120 },
    { title: 'Giờ', key: 'time', width: 120, render: (_: any, r: any) => `${r.start_time} - ${r.end_time}` },
    { title: 'Giờ', dataIndex: 'total_hours', key: 'total_hours', width: 60, align: 'center' as const, render: (v: number) => `${v}h` },
    { title: 'OT', dataIndex: 'is_overtime', key: 'is_overtime', width: 50, align: 'center' as const, render: (v: boolean) => v ? <Tag color="red">TG</Tag> : null },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={STATUS_COLORS[v] || 'default'}>{STATUS_LABELS[v] || v}</Tag> },
  ], []);

  const dateColumns: any[] = useMemo(() => [
    { title: 'Ngày', dataIndex: 'date', key: 'date', width: 120, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Số ca', dataIndex: 'shiftCount', key: 'shiftCount', width: 80, align: 'center' as const },
  ], []);

  const workplaceColumns: any[] = useMemo(() => [
    { title: 'Nơi làm việc', dataIndex: 'workplace_name', key: 'workplace_name' },
  ], []);

  const deptColumns: any[] = useMemo(() => [
    { title: 'Phòng ban', dataIndex: 'department_name', key: 'department_name', width: 200 },
    { title: 'NV', dataIndex: 'total_employees', key: 'total_employees', width: 60, align: 'center' as const },
    { title: 'Ca', dataIndex: 'total_shifts', key: 'total_shifts', width: 60, align: 'center' as const },
    { title: 'Tổng giờ', dataIndex: 'total_hours', key: 'total_hours', width: 100, align: 'center' as const, render: (v: number) => `${v}h` },
    { title: 'Giờ OT', dataIndex: 'overtime_hours', key: 'overtime_hours', width: 100, align: 'center' as const, render: (v: number) => v > 0 ? <span style={{ color: COLORS.ERROR_RED }}>{v}h</span> : '0h' },
  ], []);

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

      const detailRows: any[] = [];
      for (const dept of data) {
        const dateMap: Record<string, any[]> = {};
        for (const emp of dept.employees) {
          for (const s of emp.schedules) {
            if (!dateMap[s.date]) dateMap[s.date] = [];
            dateMap[s.date].push({ ...s, employee_name: emp.employee_name });
          }
        }
        const sortedDates = Object.keys(dateMap).sort();
        for (const date of sortedDates) {
          for (const s of dateMap[date]) {
            detailRows.push({
              'Phòng ban': dept.department_name,
              'Ngày': dayjs(date).format('DD/MM/YYYY'),
              'Nhân viên': s.employee_name,
              'Ca': s.shift_name,
              'Giờ BĐ': s.start_time,
              'Giờ KT': s.end_time,
              'Nơi LV': s.workplace_name,
              'Giờ': s.total_hours,
              'OT': s.is_overtime ? 'Có' : 'Không',
              'Trạng thái': STATUS_LABELS[s.status] || s.status,
            });
          }
        }
      }
      const detailWs = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, detailWs, 'Chi tiết');

      XLSX.writeFile(wb, `Bao_cao_lich_cong_tac_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);
      message.success('Xuất Excel thành công');
    } catch {
      message.error('Lỗi khi xuất Excel');
    }
  };

  useEffect(() => {
    if (deptWithDates.length > 0) {
      setExpandedDeptKeys(deptWithDates.map((d) => d.department_id));
      const dateKeys: string[] = [];
      const wpKeys: string[] = [];
      for (const dept of deptWithDates) {
        for (const dg of dept.dateGroups) {
          dateKeys.push(`date_${dept.department_id}_${dg.date}`);
          for (const wg of dg.workplaceGroups) {
            wpKeys.push(`wp_${dept.department_id}_${dg.date}_${wg.workplace_name}`);
          }
        }
      }
      setExpandedDateKeys(dateKeys);
      setExpandedWorkplaceKeys(wpKeys);
    }
  }, [deptWithDates]);

  const dateStr = dateRange?.[0] && dateRange?.[1]
    ? `${dateRange[0].format('DD/MM/YYYY')} - ${dateRange[1].format('DD/MM/YYYY')}`
    : '';

  if (loading && !loadedRef.current) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div>
      <div className="screen-report-area">
        {loadedRef.current && (
          <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
            <div><strong>Tổng phòng ban:</strong> {totals.departments}</div>
            <div><strong>Tổng nhân viên:</strong> {totals.employees}</div>
            <div><strong>Tổng ca:</strong> {totals.shifts}</div>
            <div><strong>Tổng giờ:</strong> {totals.hours}h</div>
            <div><strong>Tổng OT:</strong> <span style={{ color: totals.otHours > 0 ? COLORS.ERROR_RED : undefined }}>{totals.otHours}h</span></div>
          </div>
        )}

            <Table
              title={() => (
                <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <Space>
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
              )}
              dataSource={deptWithDates}
              columns={deptColumns}
              rowKey="department_id"
              pagination={false}
              loading={loading}
              size="small"
              bordered
              style={{ border: '1px solid #e8e8e8', borderRadius: 6 }}
              locale={{ emptyText: 'Không có dữ liệu' }}
              expandable={{
                expandedRowKeys: expandedDeptKeys,
                onExpandedRowsChange: (keys: readonly React.Key[]) => {
                  setExpandedDeptKeys(keys as string[]);
                  if (keys.length === 0) setExpandedDateKeys([]);
                },
                expandedRowRender: (deptRecord: DeptWithDates) => (
                  <Table
                    dataSource={deptRecord.dateGroups.map((dg) => ({ ...dg, shiftCount: dg.schedules.length }))}
                    columns={dateColumns}
                    rowKey={(r: DateGroup) => `date_${deptRecord.department_id}_${r.date}`}
                    pagination={false}
                    size="small"
                    showHeader={false}
                    style={{ margin: 0 }}
                    expandable={{
                      expandedRowKeys: expandedDateKeys,
                      onExpandedRowsChange: (keys: readonly React.Key[]) => setExpandedDateKeys(keys as string[]),
                      expandedRowRender: (dateGroup: DateGroup) => (
                        <Table
                          dataSource={dateGroup.workplaceGroups}
                          columns={workplaceColumns}
                          rowKey={(r: WorkplaceGroup) => `wp_${deptRecord.department_id}_${dateGroup.date}_${r.workplace_name}`}
                          pagination={false}
                          size="small"
                          showHeader={false}
                          style={{ margin: 0 }}
                          expandable={{
                            expandedRowKeys: expandedWorkplaceKeys,
                            onExpandedRowsChange: (keys: readonly React.Key[]) => setExpandedWorkplaceKeys(keys as string[]),
                            expandedRowRender: (workplaceGroup: WorkplaceGroup) => (
                              <Table
                                dataSource={workplaceGroup.schedules}
                                columns={scheduleColumns}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                showHeader={false}
                                style={{ margin: 0 }}
                              />
                            ),
                            rowExpandable: (r: WorkplaceGroup) => r.schedules.length > 0,
                          }}
                        />
                      ),
                      rowExpandable: (r: DateGroup) => r.workplaceGroups.length > 0,
                    }}
                  />
                ),
              }}
            />
      </div>

      {loadedRef.current && (
        <div className="print-only A4-print-container">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Typography.Title level={3} style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '20px' }}>
              LỊCH CÔNG TÁC
            </Typography.Title>
            {dateStr && <div style={{ fontSize: 13, color: '#333', marginTop: 8, fontStyle: 'italic' }}>Thời gian: {dateStr}</div>}
          </div>

          <div style={{ marginBottom: 24 }}>
            <Typography.Title level={5} style={{ marginBottom: 8, fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: 4 }}>
              I. BẢNG TỔNG HỢP PHÒNG BAN
            </Typography.Title>
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Phòng ban</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Số nhân viên</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Số ca trực</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Tổng giờ</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.department_id}>
                    <td>{d.department_name}</td>
                    <td style={{ textAlign: 'center' }}>{d.total_employees}</td>
                    <td style={{ textAlign: 'center' }}>{d.total_shifts}</td>
                    <td style={{ textAlign: 'center' }}>{d.total_hours}h</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 'bold', background: '#f5f5f5' }}>
                  <td>TỔNG CỘNG</td>
                  <td style={{ textAlign: 'center' }}>{totals.employees}</td>
                  <td style={{ textAlign: 'center' }}>{totals.shifts}</td>
                  <td style={{ textAlign: 'center' }}>{totals.hours}h</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <Typography.Title level={5} style={{ marginBottom: 12, fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: 4 }}>
              II. CHI TIẾT LỊCH CÔNG TÁC
            </Typography.Title>
            {deptWithDates.map((dept) => {
              const hasSchedules = dept.dateGroups.some((dg) => dg.workplaceGroups.some((wg) => wg.schedules.length > 0));
              if (!hasSchedules) return null;

              return (
                <div key={dept.department_id} style={{ marginBottom: 24, pageBreakInside: 'avoid' as any }}>
                  <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 8, borderBottom: '1.5px solid #333', paddingBottom: 2, color: '#000', textTransform: 'uppercase' }}>
                    Phòng ban: {dept.department_name}
                  </div>

                  {dept.dateGroups.map((dg) => {
                    if (dg.workplaceGroups.length === 0) return null;

                    return (
                      <div key={dg.date} style={{ marginLeft: 8, marginBottom: 16, pageBreakInside: 'avoid' as any }}>
                        <div style={{ fontWeight: 'bold', fontSize: 13, color: '#333', marginBottom: 6 }}>
                          Ngày {dayjs(dg.date).format('DD/MM/YYYY')}
                        </div>

                        {dg.workplaceGroups.map((wg) => {
                          if (wg.schedules.length === 0) return null;

                          return (
                            <div key={wg.workplace_name} style={{ marginLeft: 12, marginBottom: 10, pageBreakInside: 'avoid' as any }}>
                              <div style={{ fontWeight: 600, fontSize: 12, color: '#555', marginBottom: 4, fontStyle: 'italic' }}>
                                Nơi làm việc: {wg.workplace_name}
                              </div>
                              <table className="print-table" style={{ margin: '0 0 8px 0' }}>
                                <thead>
                                  <tr>
                                    <th style={{ width: '40%' }}>Nhân viên</th>
                                    <th style={{ width: '30%' }}>Ca trực</th>
                                    <th style={{ width: '20%' }}>Thời gian</th>
                                    <th style={{ width: '10%', textAlign: 'center' }}>Số giờ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {wg.schedules.map((s) => (
                                    <tr key={s.id}>
                                      <td>{s.employee_name}</td>
                                      <td>{s.shift_name}</td>
                                      <td>{s.start_time} - {s.end_time}</td>
                                      <td style={{ textAlign: 'center' }}>{s.total_hours}h</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          html, body, #root, .ant-layout, .ant-layout-content, .screen-report-area, .print-only, .A4-print-container {
            width: 100% !important;
            height: auto !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            flex: none !important;
            float: none !important;
          }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body {
            background: #fff !important;
            color: #000 !important;
            font-family: "Times New Roman", Times, serif !important;
            font-size: 11pt !important;
          }
          .A4-print-container {
            padding: 10mm !important;
            box-sizing: border-box !important;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 16px !important;
            font-size: 10pt !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #000 !important;
            padding: 6px 8px !important;
            text-align: left !important;
            color: #000 !important;
          }
          .print-table th {
            background-color: #f2f2f2 !important;
            font-weight: bold !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4;
            margin: 15mm 10mm 15mm 10mm;
          }
        }
      `}</style>
    </div>
  );
}
