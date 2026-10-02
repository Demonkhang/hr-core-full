import { useState, useRef, useCallback, useEffect } from 'react';
import dayjs from 'dayjs';
import { Button, Input, InputRef, Select, Tag, message, Space, Tooltip, Checkbox, DatePicker, Modal, Form } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined, CheckOutlined, CloseOutlined, UserOutlined, KeyOutlined } from '@ant-design/icons';
import { employeeService } from '@/services/employeeService';
import { departmentService } from '@/services/departmentService';
import { positionService } from '@/services/positionService';
import { jobPositionService } from '@/services/jobPositionService';
import { EmployeeTable } from '@/components/Employees/EmployeeTable';
import type { Employee } from '@/types/employee';
import type { Department } from '@/types/department';
import type { Position } from '@/types/position';
import type { JobPosition } from '@/types/jobPosition';
import { PermGate } from '@/components/Common/PermGate';
import { PERMISSIONS, SCOPE_LABELS } from '@/utils/constants';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import type { ColumnsType } from 'antd/es/table';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import { useNavigate } from 'react-router-dom';
import { AccountModal } from '@/components/Employees/AccountModal';
import { ImportModal } from '@/components/Employees/ImportModal';
import { useSetPageTitle } from '@/components/Layout/AppLayout';
import apiClient from '@/services/apiClient';
import { API_ENDPOINTS } from '@/utils/apiEndpoints';

export function EmployeeList() {
  useSetPageTitle('Nhân sự hiện có');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingKey, setEditingKey] = useState<string>('');
  const [addingNew, setAddingNew] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [filterDept, setFilterDept] = useState<string[]>([]);
  const [filterPosition, setFilterPosition] = useState<string | undefined>(undefined);
  const [filterSearch, setFilterSearch] = useState('');
  const [form] = Form.useForm();
  const inputRef = useRef<InputRef>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([departmentService.list(), positionService.list(), jobPositionService.list()]).then(([depts, poss, jps]) => {
      setDepartments(depts);
      setPositions(poss);
      setJobPositions(jps);
    });
  }, []);

  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchDeactivateModal, setBatchDeactivateModal] = useState<{ open: boolean }>({ open: false });
  const [batchDeactivateStatus, setBatchDeactivateStatus] = useState<string>('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [accountModal, setAccountModal] = useState<{ open: boolean; employeeName: string; username: string; password?: string; isReset?: boolean }>({ open: false, employeeName: '', username: '' });
  const [deactivateModal, setDeactivateModal] = useState<{ open: boolean; employeeId: string | null; employeeName: string }>({ open: false, employeeId: null, employeeName: '' });
  const [deactivateStatus, setDeactivateStatus] = useState<string>('');

  const LEAVE_REASONS = [
    { value: 'resigned', label: 'Tự nguyện nghỉ việc' },
    { value: 'retired', label: 'Nghỉ hưu' },
    { value: 'terminated', label: 'Sa thải' },
    { value: 'contract_expired', label: 'Hết hợp đồng' },
  ];

  const isEditing = (record: Employee) => record.id === editingKey;

  const edit = (record: Employee) => {
    form.setFieldsValue({
      employee_code: record.employee_code,
      full_name: record.full_name,
      department_id: record.department_id,
      position_id: record.position_id,
      job_position_id: record.job_position_id,
      workplace_id: record.workplace_id || null,
      phone: record.phone,
      email: record.email,
      hire_date: record.hire_date ? dayjs(record.hire_date) : null,
    });
    setEditingKey(record.id);
  };

  const cancel = () => {
    setEditingKey('');
    setAddingNew(false);
    form.resetFields();
  };

  const save = async (key: string) => {
    try {
      const row = await form.validateFields();
      const payload = {
        ...row,
        hire_date: row.hire_date ? dayjs(row.hire_date).format('YYYY-MM-DD') : null,
      };
      if (key === '__new__') {
        const { create_account, ...empData } = payload;
        await employeeService.create({ ...empData, create_account });
        message.success('Thêm nhân sự thành công');
      } else {
        await employeeService.update(key, payload);
        message.success('Cập nhật nhân viên thành công');
      }
      setEditingKey('');
      setAddingNew(false);
      form.resetFields();
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      if (err?.errorFields) {
        message.warning('Vui lòng kiểm tra lại các trường thông tin');
      } else if (err?.response?.data?.detail) {
        const detail = err.response.data.detail;
        message.error(Array.isArray(detail) ? detail.map((d: any) => d.msg || d).join('; ') : detail);
      } else {
        message.error(err?.message || 'Không thể lưu thông tin');
      }
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateModal.employeeId || !deactivateStatus) return;
    try {
      await employeeService.deactivate(deactivateModal.employeeId, deactivateStatus);
      message.success('Đã ngưng nhân viên');
      setDeactivateModal({ open: false, employeeId: null, employeeName: '' });
      setDeactivateStatus('');
      setRefreshKey((k) => k + 1);
    } catch {
      message.error('Không thể ngưng nhân viên');
    }
  };

  const handleCreateAccount = async (emp: Employee) => {
    try {
      const result = await employeeService.createAccount(emp.id);
      setAccountModal({ open: true, employeeName: emp.full_name, username: result.username, password: result.password });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể tạo tài khoản');
    }
  };

  const handleResetPassword = async (emp: Employee) => {
    try {
      const result = await employeeService.resetPassword(emp.id);
      setAccountModal({ open: true, employeeName: emp.full_name, username: result.username, password: result.new_password, isReset: true });
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể reset mật khẩu');
    }
  };

  const addNew = useCallback(() => {
    if (addingNew) return;
    setAddingNew(true);
    setEditingKey('__new__');
    form.resetFields();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [addingNew, form]);

  useKeyboardShortcut('n', addNew, editingKey === '');

  const handleBatchCreateAccounts = async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchLoading(true);
    try {
      const response = await apiClient.post(API_ENDPOINTS.EMPLOYEE_BATCH_CREATE_ACCOUNTS, { employee_ids: selectedRowKeys }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `taikhoan_nhanvien_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success(`Đã tạo tài khoản cho ${selectedRowKeys.length} nhân viên`);
      setSelectedRowKeys([]);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể tạo tài khoản hàng loạt');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchDeactivate = async () => {
    if (selectedRowKeys.length === 0 || !batchDeactivateStatus) return;
    setBatchLoading(true);
    try {
      const response = await apiClient.post(API_ENDPOINTS.EMPLOYEE_BATCH_DEACTIVATE, {
        employee_ids: selectedRowKeys,
        status: batchDeactivateStatus,
      });
      message.success(response.data.message || `Đã ngưng ${selectedRowKeys.length} nhân viên`);
      setBatchDeactivateModal({ open: false });
      setBatchDeactivateStatus('');
      setSelectedRowKeys([]);
      setRefreshKey((k) => k + 1);
    } catch {
      message.error('Không thể ngưng nhân viên hàng loạt');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleExport = async (selectedOnly = false) => {
    try {
      const params: Record<string, any> = { active_only: true };
      if (selectedOnly && selectedRowKeys.length > 0) {
        params.employee_ids = selectedRowKeys;
      }
      const response = await apiClient.get(API_ENDPOINTS.EMPLOYEES_EXPORT, { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `nhanvien_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Xuất file thành công');
    } catch {
      message.error('Không thể xuất file');
    }
  };

  const searchDropdown = useCallback(({ setSelectedKeys, confirm }: FilterDropdownProps) => (
    <div style={{ padding: 8 }}>
      <Input.Search
        allowClear
        placeholder="Tìm tên, mã NV, SĐT..."
        defaultValue={filterSearch}
        onSearch={(v) => {
          setFilterSearch(v);
          setSelectedKeys(v ? [v] : []);
          confirm();
        }}
      />
    </div>
  ), [filterSearch]);

  const deptDropdown = useCallback(({ setSelectedKeys, confirm }: FilterDropdownProps) => (
    <div style={{ padding: 8 }}>
      <Select
        mode="multiple"
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder="Lọc phòng ban"
        value={filterDept}
        onChange={(value) => {
          setFilterDept(value);
          setSelectedKeys(value.length > 0 ? value : []);
          confirm();
        }}
        options={departments.map((d) => ({ label: d.name, value: d.id }))}
        style={{ width: 200 }}
        notFoundContent="Không tìm thấy"
      />
    </div>
  ), [filterDept, departments]);

  const posDropdown = useCallback(({ setSelectedKeys, confirm }: FilterDropdownProps) => (
    <div style={{ padding: 8 }}>
      <Select
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder="Lọc chức vụ"
        value={filterPosition}
        onChange={(value) => {
          setFilterPosition(value);
          setSelectedKeys(value ? [value] : []);
          confirm();
        }}
        options={positions.filter((p) => p.is_active).map((p) => ({ label: p.name, value: p.id }))}
        style={{ width: 200 }}
        notFoundContent="Không tìm thấy"
      />
    </div>
  ), [filterPosition, positions]);

  const columns: ColumnsType<Employee> = [
    {
      title: 'Mã NV', dataIndex: 'employee_code', key: 'code', width: 100,
      render: (_: any, record: Employee) => {
        if (!isEditing(record)) return <span>{record.employee_code || '-'}</span>;
        return (
          <Form.Item name="employee_code" className="table-form-item">
            <Input ref={editingKey === '__new__' ? inputRef : undefined} placeholder="Tự động" />
          </Form.Item>
        );
      },
    },
    {
      title: 'Họ tên', dataIndex: 'full_name', key: 'name', width: 180,
      filterDropdown: searchDropdown,
      filteredValue: filterSearch ? [filterSearch] : undefined,
      render: (_: any, record: Employee) => {
        if (!isEditing(record)) return (
          <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/employees/${record.id}`)}>
            {record.full_name}
          </Button>
        );
        return (
          <Form.Item name="full_name" rules={[{ required: true, message: 'Nhập họ tên' }]} className="table-form-item">
            <Input />
          </Form.Item>
        );
      },
    },
    {
      title: 'Phòng ban', dataIndex: 'department_name', key: 'dept', width: 220,
      filterDropdown: deptDropdown,
      filteredValue: filterDept.length > 0 ? filterDept : undefined,
      render: (_: any, record: Employee) => {
        if (!isEditing(record)) return <span>{record.department_name}</span>;
        return (
          <Form.Item name="department_id" rules={[{ required: true, message: 'Chọn phòng ban' }]} className="table-form-item">
            <Select options={departments.map((d) => ({ label: d.name, value: d.id }))} />
          </Form.Item>
        );
      },
    },
    {
      title: 'Chức vụ', dataIndex: 'position_name', key: 'position_name', width: 160,
      filterDropdown: posDropdown,
      filteredValue: filterPosition ? [filterPosition] : undefined,
      render: (v: string | null, record: Employee) => {
        if (!isEditing(record)) return <span>{v || record.position || '-'}</span>;
        return (
          <Form.Item name="position_id" className="table-form-item">
            <Select allowClear placeholder="Chọn chức vụ" options={positions.filter((p) => p.is_active).map((p) => ({ label: `${p.name} (${SCOPE_LABELS[p.scope] || p.scope})`, value: p.id }))} />
          </Form.Item>
        );
      },
    },
    {
      title: 'Vị trí việc làm', dataIndex: 'job_position_name', key: 'job_position_name', width: 180,
      render: (_: any, record: Employee) => {
        if (!isEditing(record)) return <span>{record.job_position_name || '-'}</span>;
        return (
          <Form.Item name="job_position_id" className="table-form-item">
            <Select allowClear placeholder="Chọn vị trí việc làm" options={jobPositions.filter((j) => j.is_active).map((j) => ({ label: `${j.name} (Bậc ${j.professional_level})`, value: j.id }))} />
          </Form.Item>
        );
      },
    },
    {
      title: 'Ngày vào làm', dataIndex: 'hire_date', key: 'hire_date', width: 130,
      render: (_: any, record: Employee) => {
        if (!isEditing(record)) return <span>{record.hire_date ? dayjs(record.hire_date).format('DD/MM/YYYY') : '-'}</span>;
        return (
          <Form.Item name="hire_date" className="table-form-item">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
        );
      },
    },
    {
      title: 'Tài khoản', key: 'account', width: 180,
      render: (_: any, record: Employee) => {
        if (isEditing(record)) {
          if (record.id !== '__new__') return null;
          return (
            <Form.Item name="create_account" valuePropName="checked" className="table-form-item">
              <Checkbox>Tạo tài khoản</Checkbox>
            </Form.Item>
          );
        }
        if (!record.is_active) return <Tag color="default">Đã khoá</Tag>;
        if (record.has_account) return <Tag color="green" icon={<UserOutlined />}>{record.username}</Tag>;
        return <Tag color="orange">Chưa có</Tag>;
      },
    },
    {
      title: 'SĐT', dataIndex: 'phone', key: 'phone', width: 120,
      render: (_: any, record: Employee) => {
        if (!isEditing(record)) return <span>{record.phone || '-'}</span>;
        return (
          <Form.Item name="phone" className="table-form-item">
            <Input />
          </Form.Item>
        );
      },
    },
    {
      title: 'Email', dataIndex: 'email', key: 'email', width: 160,
      render: (_: any, record: Employee) => {
        if (!isEditing(record)) return <span>{record.email || '-'}</span>;
        return (
          <Form.Item name="email" className="table-form-item">
            <Input type="email" />
          </Form.Item>
        );
      },
    },
    {
      title: 'Hành động', key: 'actions', width: 140,
      render: (_: any, record: Employee) => {
        if (isEditing(record)) {
          return (
            <Space>
              <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => save(record.id)} />
              <Button size="small" icon={<CloseOutlined />} onClick={cancel} />
            </Space>
          );
        }
        return (
          <PermGate perms={[PERMISSIONS.CAN_MANAGE_EMPLOYEES]}>
            <Space>
              <Button type="link" size="small" icon={<EditOutlined />} disabled={editingKey !== ''} onClick={() => edit(record)} />
              {record.is_active && !record.has_account && (
                <Tooltip title="Tạo tài khoản">
                  <Button type="link" size="small" icon={<UserOutlined />} disabled={editingKey !== ''} onClick={() => handleCreateAccount(record)} />
                </Tooltip>
              )}
              {record.is_active && record.has_account && (
                <Tooltip title="Reset mật khẩu">
                  <Button type="link" size="small" icon={<KeyOutlined />} disabled={editingKey !== ''} onClick={() => handleResetPassword(record)} />
                </Tooltip>
              )}
              {record.is_active && (
                <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={editingKey !== ''} onClick={() => setDeactivateModal({ open: true, employeeId: record.id, employeeName: record.full_name })} />
              )}
            </Space>
          </PermGate>
        );
      },
    },
  ];

  return (
    <div>
      <EmployeeTable
        activeOnly
        title="Nhân sự hiện có"
        columns={columns}
        refreshKey={refreshKey}
        formRef={form}
        filterSearch={filterSearch}
        onFilterSearchChange={setFilterSearch}
        filterDept={filterDept}
        onFilterDeptChange={setFilterDept}
        filterPosition={filterPosition}
        onFilterPositionChange={setFilterPosition}
        editingKey={editingKey}
        selectedRowKeys={selectedRowKeys}
        onSelectionChange={setSelectedRowKeys}
        headerActions={
          <PermGate perms={[PERMISSIONS.CAN_MANAGE_EMPLOYEES]}>
            <Space>
              <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>Nhập</Button>
              <Tooltip title="Alt+N">
                <Button type="primary" icon={<PlusOutlined />} onClick={addNew} disabled={editingKey !== ''}>
                  Thêm
                </Button>
              </Tooltip>
            </Space>
          </PermGate>
        }
      />

      <AccountModal
        open={accountModal.open}
        employeeName={accountModal.employeeName}
        username={accountModal.username}
        password={accountModal.password}
        isReset={accountModal.isReset}
        onClose={() => setAccountModal((prev) => ({ ...prev, open: false }))}
      />

      {selectedRowKeys.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 5, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 50%, rgba(240,248,255,0.2) 100%)',
          backdropFilter: 'blur(48px) saturate(300%)',
          WebkitBackdropFilter: 'blur(48px) saturate(300%)',
          border: '1px solid rgba(255,255,255,0.65)',
          borderRadius: 14,
          padding: '10px 28px', width: 'fit-content',
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}>
          <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>Đã chọn <b>{selectedRowKeys.length}</b> nhân sự</span>
          <Button type="primary" icon={<UserOutlined />} loading={batchLoading} onClick={handleBatchCreateAccounts}>
            Tạo tài khoản
          </Button>
          <Button danger icon={<DeleteOutlined />} loading={batchLoading} onClick={() => setBatchDeactivateModal({ open: true })}>
            Xóa mềm
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => handleExport(true)}>
            Xuất
          </Button>
          <Button onClick={() => setSelectedRowKeys([])}>Bỏ chọn</Button>
        </div>
      )}

      <Modal
        title={`Ngưng ${selectedRowKeys.length} nhân viên`}
        open={batchDeactivateModal.open}
        onOk={handleBatchDeactivate}
        onCancel={() => { setBatchDeactivateModal({ open: false }); setBatchDeactivateStatus(''); }}
        okButtonProps={{ disabled: !batchDeactivateStatus, loading: batchLoading }}
        okText="Xác nhận"
        cancelText="Hủy"
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>Chọn trạng thái chuyển sang:</div>
          <Select
            placeholder="Chọn lý do"
            style={{ width: '100%' }}
            value={batchDeactivateStatus || undefined}
            onChange={setBatchDeactivateStatus}
            options={LEAVE_REASONS}
          />
        </div>
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onSuccess={() => setRefreshKey((k) => k + 1)} />

      <Modal
        title={`Ngưng nhân viên: ${deactivateModal.employeeName}`}
        open={deactivateModal.open}
        onOk={handleDeactivate}
        onCancel={() => { setDeactivateModal({ open: false, employeeId: null, employeeName: '' }); setDeactivateStatus(''); }}
        okButtonProps={{ disabled: !deactivateStatus }}
        okText="Xác nhận"
        cancelText="Hủy"
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>Chọn trạng thái chuyển sang:</div>
          <Select
            placeholder="Chọn lý do"
            style={{ width: '100%' }}
            value={deactivateStatus || undefined}
            onChange={setDeactivateStatus}
            options={LEAVE_REASONS}
          />
        </div>
      </Modal>
    </div>
  );
}
