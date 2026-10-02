import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Table, Button, Tag, message, Typography, Modal, Input, Spin, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { scheduleService } from '@/services/scheduleService';
import type { Schedule } from '@/types/schedule';
import { SCHEDULE_STATUS, QUERY_PARAMS, ERROR_MESSAGES, FIELD_NAMES, DATE_FORMATS } from '@/utils/constants';
export function ScheduleApproval() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState<dayjs.Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { [QUERY_PARAMS.STATUS]: SCHEDULE_STATUS.PENDING };
      if (dateFrom) params.date_from = dateFrom.format(DATE_FORMATS.ISO_DATE);
      if (dateTo) params.date_to = dateTo.format(DATE_FORMATS.ISO_DATE);
      const result = await scheduleService.list(params);
      if (!mountedRef.current) return;
      setSchedules(result);
    } catch {
      if (!mountedRef.current) return;
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBatchApprove = useCallback(async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchLoading(true);
    try {
      const result = await scheduleService.bulkApprove(selectedRowKeys);
      if (!mountedRef.current) return;
      message.success(`Đã duyệt ${result.success_count}/${result.total} lịch trực`);
      if (result.errors.length > 0) {
        message.warning(`${result.errors.length} lịch không thể duyệt`);
      }
      setSelectedRowKeys([]);
      fetchData();
    } catch (err: any) {
      if (!mountedRef.current) return;
      message.error(err?.response?.data?.detail || 'Lỗi khi duyệt hàng loạt');
    } finally {
      if (mountedRef.current) setBatchLoading(false);
    }
  }, [selectedRowKeys, fetchData]);

  const handleBatchReject = useCallback(async () => {
    if (selectedRowKeys.length === 0 || !batchRejectReason.trim()) return;
    setBatchLoading(true);
    try {
      const result = await scheduleService.bulkReject(selectedRowKeys, batchRejectReason.trim());
      if (!mountedRef.current) return;
      message.success(`Đã từ chối ${result.success_count}/${result.total} lịch trực`);
      if (result.errors.length > 0) {
        message.warning(`${result.errors.length} lịch không thể từ chối`);
      }
      setSelectedRowKeys([]);
      setBatchRejectOpen(false);
      setBatchRejectReason('');
      fetchData();
    } catch (err: any) {
      if (!mountedRef.current) return;
      message.error(err?.response?.data?.detail || 'Lỗi khi từ chối hàng loạt');
    } finally {
      if (mountedRef.current) setBatchLoading(false);
    }
  }, [selectedRowKeys, batchRejectReason, fetchData]);

  const deptFilterOptions = useMemo(() => {
    const names = new Set(schedules.map((s) => s.department_name).filter(Boolean) as string[]);
    return Array.from(names).map((name) => ({ text: name, value: name }));
  }, [schedules]);

  const workplaceFilterOptions = useMemo(() => {
    const names = new Set(schedules.map((s) => s.workplace_name).filter(Boolean) as string[]);
    return Array.from(names).map((name) => ({ text: name, value: name }));
  }, [schedules]);

  const employeeFilterOptions = useMemo(() => {
    const names = new Set(schedules.map((s) => s.employee_name).filter(Boolean) as string[]);
    return Array.from(names).map((name) => ({ text: name, value: name }));
  }, [schedules]);

  const columns = useMemo(() => [
    {
      title: 'Ngày', dataIndex: 'date', key: 'date', width: 120,
      sorter: (a: Schedule, b: Schedule) => (a.date || '').localeCompare(b.date || ''),
      filtered: !!dateFrom || !!dateTo,
      filterDropdown: ({ confirm }: { confirm: () => void }) => (
        <div style={{ padding: 8 }}>
          <DatePicker.RangePicker
            value={dateFrom && dateTo ? [dateFrom, dateTo] as [dayjs.Dayjs, dayjs.Dayjs] : null}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateFrom(dates[0]);
                setDateTo(dates[1]);
              } else {
                setDateFrom(null);
                setDateTo(null);
              }
              confirm();
            }}
            format="DD/MM/YYYY"
            size="small"
          />
        </div>
      ),
      render: (d: string) => d?.slice(0, 10),
    },
    {
      title: 'Nhân viên', dataIndex: FIELD_NAMES.EMPLOYEE_NAME, key: 'employee', width: 180,
      sorter: (a: Schedule, b: Schedule) => (a.employee_name || '').localeCompare(b.employee_name || ''),
      filters: employeeFilterOptions,
      onFilter: (value: any, record: Schedule) => record.employee_name === value,
    },
    {
      title: 'Phòng ban', dataIndex: 'department_name', key: 'department', width: 150,
      sorter: (a: Schedule, b: Schedule) => (a.department_name || '').localeCompare(b.department_name || ''),
      filters: deptFilterOptions,
      onFilter: (value: any, record: Schedule) => record.department_name === value,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Nơi làm việc', dataIndex: 'workplace_name', key: 'workplace', width: 150,
      sorter: (a: Schedule, b: Schedule) => (a.workplace_name || '').localeCompare(b.workplace_name || ''),
      filters: workplaceFilterOptions,
      onFilter: (value: any, record: Schedule) => record.workplace_name === value,
      render: (v: string | null) => v || '-',
    },
    { title: 'Ca trực', dataIndex: FIELD_NAMES.SHIFT_NAME, key: 'shift', width: 150, sorter: (a: Schedule, b: Schedule) => (a.shift_name || '').localeCompare(b.shift_name || '') },
    { title: 'Giờ', dataIndex: FIELD_NAMES.TOTAL_HOURS, key: 'hours', width: 80, sorter: (a: Schedule, b: Schedule) => (a.total_hours || 0) - (b.total_hours || 0), render: (v: number) => v ? `${v}h` : '-' },
    {
      title: 'Tăng ca', dataIndex: FIELD_NAMES.IS_OVERTIME, key: 'ot', width: 60,
      render: (v: boolean) => v ? <Tag color="red">TG</Tag> : null,
    },
  ], [deptFilterOptions, workplaceFilterOptions, employeeFilterOptions]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      <Table
        rowSelection={{ selectedRowKeys, onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]) }}
        dataSource={schedules}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: 'Không có lịch trực chờ duyệt' }}
      />

      {selectedRowKeys.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 5,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(255,255,255,0.5)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.6)',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <Typography.Text strong>Đã chọn {selectedRowKeys.length} lịch trực</Typography.Text>
          <Button icon={<CheckOutlined />} type="primary" onClick={handleBatchApprove} loading={batchLoading}>
            Duyệt
          </Button>
          <Button icon={<CloseOutlined />} danger onClick={() => setBatchRejectOpen(true)} loading={batchLoading}>
            Từ chối
          </Button>
          <Button size="small" onClick={() => setSelectedRowKeys([])}>Bỏ chọn</Button>
        </div>
      )}

      <Modal
        title={`Từ chối hàng loạt (${selectedRowKeys.length} lịch trực)`}
        open={batchRejectOpen}
        onCancel={() => { setBatchRejectOpen(false); setBatchRejectReason(''); }}
        onOk={handleBatchReject}
        confirmLoading={batchLoading}
        okText="Từ chối"
        okButtonProps={{ danger: true, disabled: !batchRejectReason.trim() }}
      >
        <Input.TextArea
          placeholder="Nhập lý do từ chối (dùng chung cho tất cả)"
          rows={3}
          value={batchRejectReason}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBatchRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
