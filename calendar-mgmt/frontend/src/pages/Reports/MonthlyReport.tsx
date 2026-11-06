import { useEffect, useState, useMemo } from 'react';
import { Table, Select, DatePicker, message, Typography, Spin, Button, Popconfirm, Tooltip } from 'antd';
import { DownloadOutlined, CheckCircleOutlined, UnlockOutlined } from '@ant-design/icons';
import { departmentService } from '@/services/departmentService';
import { reportService } from '@/services/reportService';
import type { Department } from '@/types/department';
import dayjs from 'dayjs';
import { DATE_FORMATS, COLORS, FIELD_NAMES, ERROR_MESSAGES } from '@/utils/constants';
import { useAuthStore } from '@/store/authStore';

export function MonthlyReport() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = Boolean(user?.is_super_admin);
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
  const totalPersonalPaid = data.reduce((sum, r) => sum + (r.personal_paid_days || 0), 0);
  const totalSocialInsurance = data.reduce((sum, r) => sum + (r.social_insurance_days || 0), 0);
  const totalUnpaidLeave = data.reduce((sum, r) => sum + (r.unpaid_leave_days || 0), 0);

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

  const handleUnfinalize = async () => {
    const monthStr = selectedMonth.format(DATE_FORMATS.ISO_MONTH);
    setFinalizing(true);
    try {
      const res = await reportService.unfinalizeMonthlySummary(monthStr);
      message.success(res.message || 'Đã mở khoá bảng công tháng');
      fetchData();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Không thể mở khoá bảng công';
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
        'Phòng ban': r.department_name || '',
        'Tổng giờ': r.total_hours || 0,
        'Giờ thường': r.normal_hours || 0,
        'Giờ OT': r.overtime_hours || 0,
        'Số ca': r.total_shifts || 0,
        'Nghỉ phép năm (100% lương)': r.annual_leave_days || 0,
        'Việc riêng có lương (Đ.115)': r.personal_paid_days || 0,
        'Nghỉ hưởng BHXH (Ốm/TS)': r.social_insurance_days || 0,
        'Nghỉ không lương': r.unpaid_leave_days || 0,
        'Đã chốt': r.is_finalized ? 'Có' : 'Chưa',
      }));
      rows.push({
        'Nhân viên': 'Tổng cộng',
        'Phòng ban': '',
        'Tổng giờ': totalHours,
        'Giờ thường': totalHours - totalOT,
        'Giờ OT': totalOT,
        'Số ca': data.reduce((s: number, r: any) => s + r.total_shifts, 0),
        'Nghỉ phép năm (100% lương)': totalAnnualLeave,
        'Việc riêng có lương (Đ.115)': totalPersonalPaid,
        'Nghỉ hưởng BHXH (Ốm/TS)': totalSocialInsurance,
        'Nghỉ không lương': totalUnpaidLeave,
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
    { title: 'Nhân viên', dataIndex: FIELD_NAMES.EMPLOYEE_NAME, key: 'employee', width: 190, sorter: (a: any, b: any) => (a.employee_name || '').localeCompare(b.employee_name || '') },
    { title: 'Tổng giờ', dataIndex: FIELD_NAMES.TOTAL_HOURS, key: 'total', width: 95, sorter: (a: any, b: any) => (a.total_hours || 0) - (b.total_hours || 0), render: (v: number) => `${v}h` },
    { title: 'Giờ thường', dataIndex: 'normal_hours', key: 'normal', width: 95, sorter: (a: any, b: any) => (a.normal_hours || 0) - (b.normal_hours || 0), render: (v: number) => `${v}h` },
    { title: 'Giờ OT', dataIndex: 'overtime_hours', key: 'ot', width: 90, sorter: (a: any, b: any) => (a.overtime_hours || 0) - (b.overtime_hours || 0), render: (v: number) => v > 0 ? <span style={{ color: COLORS.ERROR_RED }}>{v}h</span> : '0h' },
    { title: 'Số ca', dataIndex: 'total_shifts', key: 'shifts', width: 75, sorter: (a: any, b: any) => (a.total_shifts || 0) - (b.total_shifts || 0) },
    {
      title: <Tooltip title="Nghỉ phép hằng năm (Hưởng 100% lương)">Phép năm</Tooltip>,
      dataIndex: 'annual_leave_days', key: 'annual_leave', width: 95,
      sorter: (a: any, b: any) => (a.annual_leave_days || 0) - (b.annual_leave_days || 0),
      render: (v: number) => v > 0 ? <strong style={{ color: '#2563eb' }}>{v}</strong> : '—',
    },
    {
      title: <Tooltip title="Nghỉ việc riêng hưởng nguyên lương (Khoản 1 Điều 115 BLLĐ)">Việc riêng (Đ.115)</Tooltip>,
      dataIndex: 'personal_paid_days', key: 'personal_paid', width: 130,
      sorter: (a: any, b: any) => (a.personal_paid_days || 0) - (b.personal_paid_days || 0),
      render: (v: number) => v > 0 ? <strong style={{ color: '#0ea5e9' }}>{v}</strong> : '—',
    },
    {
      title: <Tooltip title="Nghỉ ốm / Thai sản hưởng trợ cấp BHXH">Nghỉ BHXH</Tooltip>,
      dataIndex: 'social_insurance_days', key: 'social_insurance', width: 100,
      sorter: (a: any, b: any) => (a.social_insurance_days || 0) - (b.social_insurance_days || 0),
      render: (v: number) => v > 0 ? <strong style={{ color: '#7c3aed' }}>{v}</strong> : '—',
    },
    {
      title: <Tooltip title="Nghỉ không hưởng lương (Trừ ngày công)">Không lương</Tooltip>,
      dataIndex: 'unpaid_leave_days', key: 'unpaid_leave', width: 105,
      sorter: (a: any, b: any) => (a.unpaid_leave_days || 0) - (b.unpaid_leave_days || 0),
      render: (v: number) => v > 0 ? <strong style={{ color: '#ef4444' }}>{v}</strong> : '—',
    },
    {
      title: 'Đã chốt', dataIndex: 'is_finalized', key: 'finalized', width: 85,
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
        <div><strong>Phép năm:</strong> {totalAnnualLeave} ngày</div>
        <div><strong>Việc riêng (Đ.115):</strong> {totalPersonalPaid} ngày</div>
        <div><strong>Nghỉ BHXH:</strong> {totalSocialInsurance} ngày</div>
        <div><strong>Không lương:</strong> {totalUnpaidLeave} ngày</div>
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
            {isAllFinalized && isSuperAdmin && (
              <Popconfirm
                title="Mở khoá bảng công tháng này để cho phép chỉnh sửa?"
                onConfirm={handleUnfinalize}
              >
                <Button danger icon={<UnlockOutlined />} loading={finalizing}>
                  Mở khoá sổ
                </Button>
              </Popconfirm>
            )}
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
            <Table.Summary.Cell index={6}><strong>{totalPersonalPaid}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={7}><strong>{totalSocialInsurance}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={8}><strong>{totalUnpaidLeave}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={9}></Table.Summary.Cell>
          </Table.Summary.Row>
        )}
        locale={{ emptyText: 'Không có dữ liệu cho tháng này' }}
      />
    </div>
  );
}
