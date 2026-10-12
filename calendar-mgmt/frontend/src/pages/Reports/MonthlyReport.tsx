import { useEffect, useState, useMemo } from 'react';
import { Table, Select, DatePicker, message, Typography, Spin, Button } from 'antd';
import { DownloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { departmentService } from '@/services/departmentService';
import { reportService } from '@/services/reportService';
import type { Department } from '@/types/department';
import dayjs from 'dayjs';
import { QUERY_PARAMS, DATE_FORMATS, COLORS, FIELD_NAMES, ERROR_MESSAGES } from '@/utils/constants';

export function MonthlyReport() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const depts = await departmentService.list();
      setDepartments(depts);

      const month = selectedMonth.format(DATE_FORMATS.ISO_MONTH);
      const result = await reportService.getMonthlySummary({
        department_id: selectedDept.length > 0 ? selectedDept : undefined,
        month,
      });
      setData(result);
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedDept, selectedMonth]);

  const totalHours = data.reduce((sum, r) => sum + r.total_hours, 0);
  const totalOT = data.reduce((sum, r) => sum + r.overtime_hours, 0);
  const totalAnnualLeave = data.reduce((sum, r) => sum + (r.annual_leave_days || 0), 0);
  const totalOtherLeave = data.reduce((sum, r) => sum + (r.other_leave_days || 0), 0);

  const handleFinalize = async () => {
    const monthStr = selectedMonth.format(DATE_FORMATS.ISO_MONTH);
    setFinalizing(true);
    try {
      const res = await reportService.finalizeMonthlySummary(monthStr);
      message.success(res.message || 'Chốt bảng công tháng thành công');
      fetchData();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Không thể chốt bảng công';
      message.error(detail);
    } finally {
      setFinalizing(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = data.map((r: any) => ({
        'Nhân viên': r.employee_name || '',
        'Tổng giờ': r.total_hours || 0,
        'Giờ thường': r.normal_hours || 0,
        'Giờ OT': r.overtime_hours || 0,
        'Số ca': r.total_shifts || 0,
        'Nghỉ phép': r.annual_leave_days || 0,
        'Nghỉ khác': r.other_leave_days || 0,
        'Đã chốt': r.is_finalized ? 'Có' : 'Chưa',
      }));
      rows.push({
        'Nhân viên': 'Tổng cộng',
        'Tổng giờ': totalHours,
        'Giờ thường': totalHours - totalOT,
        'Giờ OT': totalOT,
        'Số ca': data.reduce((s: number, r: any) => s + r.total_shifts, 0),
        'Nghỉ phép': totalAnnualLeave,
        'Nghỉ khác': totalOtherLeave,
        'Đã chốt': '',
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tổng hợp');
      XLSX.writeFile(wb, `Bao_cao_tong_hop_gio_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);
      message.success('Xuất Excel thành công');
    } catch {
      message.error('Xuất Excel thất bại');
    }
  };

  const columns = useMemo(() => [
    { title: 'Nhân viên', dataIndex: FIELD_NAMES.EMPLOYEE_NAME, key: 'employee', width: 200, sorter: (a: any, b: any) => (a.employee_name || '').localeCompare(b.employee_name || '') },
    { title: 'Tổng giờ', dataIndex: FIELD_NAMES.TOTAL_HOURS, key: 'total', width: 100, sorter: (a: any, b: any) => (a.total_hours || 0) - (b.total_hours || 0), render: (v: number) => `${v}h` },
    { title: 'Giờ thường', dataIndex: 'normal_hours', key: 'normal', width: 100, sorter: (a: any, b: any) => (a.normal_hours || 0) - (b.normal_hours || 0), render: (v: number) => `${v}h` },
    { title: 'Giờ OT', dataIndex: 'overtime_hours', key: 'ot', width: 100, sorter: (a: any, b: any) => (a.overtime_hours || 0) - (b.overtime_hours || 0), render: (v: number) => v > 0 ? <span style={{ color: COLORS.ERROR_RED }}>{v}h</span> : '0h' },
    { title: 'Số ca', dataIndex: 'total_shifts', key: 'shifts', width: 80, sorter: (a: any, b: any) => (a.total_shifts || 0) - (b.total_shifts || 0) },
    { title: 'Nghỉ phép', dataIndex: 'annual_leave_days', key: 'annual_leave', width: 90, sorter: (a: any, b: any) => (a.annual_leave_days || 0) - (b.annual_leave_days || 0), render: (v: number) => v > 0 ? `${v}` : '—' },
    { title: 'Nghỉ khác', dataIndex: 'other_leave_days', key: 'other_leave', width: 90, sorter: (a: any, b: any) => (a.other_leave_days || 0) - (b.other_leave_days || 0), render: (v: number) => v > 0 ? `${v}` : '—' },
    {
      title: 'Đã chốt', dataIndex: 'is_finalized', key: 'finalized', width: 80,
      sorter: (a: any, b: any) => Number(a.is_finalized) - Number(b.is_finalized),
      render: (v: boolean) => v ? '✅' : '—',
    },
  ], []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const isAllFinalized = data.length > 0 && data.every((r: any) => r.is_finalized);

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        <div><strong>Tổng giờ:</strong> {totalHours}h</div>
        <div><strong>Tổng OT:</strong> <span style={{ color: totalOT > 0 ? COLORS.ERROR_RED : undefined }}>{totalOT}h</span></div>
        <div><strong>Số nhân viên:</strong> {data.length}</div>
        <div><strong>Nghỉ phép:</strong> {totalAnnualLeave} ngày</div>
        <div><strong>Nghỉ khác:</strong> {totalOtherLeave} ngày</div>
      </div>

      <Table
        title={() => (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
            <Select
              mode="multiple"
              allowClear
              value={selectedDept}
              onChange={setSelectedDept}
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
              style={{ minWidth: 200 }}
              placeholder="Chọn bộ phận"
            />
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={(d: dayjs.Dayjs | null) => d && setSelectedMonth(d)}
              format={DATE_FORMATS.DISPLAY_MONTH}
            />
            <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>Xuất Excel</Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={finalizing}
              disabled={isAllFinalized}
              onClick={handleFinalize}
            >
              {isAllFinalized ? 'Đã chốt công' : 'Chốt công tháng'}
            </Button>
          </div>
        )}

        dataSource={data}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}><strong>Tổng cộng</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={1}><strong>{totalHours}h</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={2}><strong>{totalHours - totalOT}h</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={3}><strong style={{ color: totalOT > 0 ? COLORS.ERROR_RED : undefined }}>{totalOT}h</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={4}><strong>{data.reduce((s, r) => s + r.total_shifts, 0)}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={5}><strong>{totalAnnualLeave}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={6}><strong>{totalOtherLeave}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={7}></Table.Summary.Cell>
          </Table.Summary.Row>
        )}
        locale={{ emptyText: 'Không có dữ liệu cho tháng này' }}
      />
    </div>
  );
}
