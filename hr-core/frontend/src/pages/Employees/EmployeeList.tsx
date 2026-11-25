import { useState, useCallback, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  Button,
  Input,
  Select,
  Tag,
  message,
  Space,
  Tooltip,
  Checkbox,
  DatePicker,
  Modal,
  Form,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  UserOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { employeeService } from '@/services/employeeService';
import { departmentService } from '@/services/departmentService';
import { positionService } from '@/services/positionService';
import { jobPositionService } from '@/services/jobPositionService';
import { workplaceService } from '@/services/workplaceService';
import { EmployeeTable } from '@/components/Employees/EmployeeTable';
import type { Employee } from '@/types/employee';
import type { Department } from '@/types/department';
import type { Position } from '@/types/position';
import type { JobPosition } from '@/types/jobPosition';
import type { Workplace } from '@/types/workplace';
import { PermGate } from '@/components/Common/PermGate';
import { PERMISSIONS, SCOPE_LABELS } from '@/utils/constants';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import type { ColumnsType } from 'antd/es/table';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import { useNavigate } from 'react-router-dom';
import { AccountModal } from '@/components/Employees/AccountModal';
import { ImportModal } from '@/components/Employees/ImportModal';
import { useSetPageTitle } from '@/components/Layout/AppLayout';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/services/apiClient';
import { API_ENDPOINTS } from '@/utils/apiEndpoints';

export function EmployeeList() {
  const user = useAuthStore((s) => s.user);
  const canManage = Boolean(user?.is_super_admin || user?.permissions?.can_manage_employees);

  useSetPageTitle(canManage ? 'Nhân sự hiện có' : 'Danh bạ nhân sự');
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);

  const [filterDept, setFilterDept] = useState<string[]>([]);
  const [filterPosition, setFilterPosition] = useState<string | undefined>(undefined);
  const [filterSearch, setFilterSearch] = useState('');
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const loadLookups = useCallback(async () => {
    try {
      const [depts, poss, jps, wps] = await Promise.all([
        departmentService.list(),
        positionService.list(),
        jobPositionService.list(),
        workplaceService.list(),
      ]);
      setDepartments(depts);
      setPositions(poss);
      setJobPositions(jps);
      setWorkplaces(wps);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups, refreshKey]);

  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchDeactivateModal, setBatchDeactivateModal] = useState<{ open: boolean }>({ open: false });
  const [batchDeactivateStatus, setBatchDeactivateStatus] = useState<string>('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [accountModal, setAccountModal] = useState<{
    open: boolean;
    employeeName: string;
    username: string;
    password?: string;
    isReset?: boolean;
  }>({ open: false, employeeName: '', username: '' });
  const [deactivateModal, setDeactivateModal] = useState<{
    open: boolean;
    employeeId: string | null;
    employeeName: string;
  }>({ open: false, employeeId: null, employeeName: '' });
  const [deactivateStatus, setDeactivateStatus] = useState<string>('');

  const LEAVE_REASONS = [
    { value: 'resigned', label: 'Tự nguyện nghỉ việc' },
    { value: 'retired', label: 'Nghỉ hưu' },
    { value: 'terminated', label: 'Sa thải' },
    { value: 'contract_expired', label: 'Hết hợp đồng' },
  ];

  const openEditModal = async (record: Employee) => {
    await loadLookups();
    setEditingRecord(record);
    form.setFieldsValue({
      employee_code: record.employee_code,
      full_name: record.full_name,
      department_id: record.department_id,
      position_id: record.position_id || undefined,
      job_position_id: record.job_position_id || undefined,
      workplace_id: record.workplace_id || undefined,
      phone: record.phone,
      email: record.email,
      hire_date: record.hire_date ? dayjs(record.hire_date) : null,
    });
    setModalOpen(true);
  };

  const openAddModal = useCallback(async () => {
    await loadLookups();
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  }, [form, loadLookups]);

  useKeyboardShortcut('n', openAddModal, !modalOpen);

  const closeModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const handleSaveModal = async () => {
    try {
      const row = await form.validateFields();
      setSaving(true);
      const selectedPos = positions.find((p) => p.id === row.position_id);
      const payload = {
        ...row,
        position: selectedPos ? selectedPos.name : editingRecord?.position || null,
        workplace_id: row.workplace_id || null,
        position_id: row.position_id || null,
        job_position_id: row.job_position_id || null,
        hire_date: row.hire_date ? dayjs(row.hire_date).format('YYYY-MM-DD') : null,
      };
      if (!editingRecord) {
        const { create_account, ...empData } = payload;
        await employeeService.create({ ...empData, create_account });
        message.success('Thêm nhân sự mới thành công');
      } else {
        await employeeService.update(editingRecord.id, payload);
        message.success('Cập nhật thông tin nhân sự thành công');
      }
      closeModal();
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      if (err?.errorFields) {
        message.warning('Vui lòng kiểm tra lại các trường thông tin bắt buộc');
      } else if (err?.response?.data?.detail) {
        const detail = err.response.data.detail;
        message.error(Array.isArray(detail) ? detail.map((d: any) => d.msg || d).join('; ') : detail);
      } else {
        message.error(err?.message || 'Không thể lưu thông tin nhân sự');
      }
    } finally {
      setSaving(false);
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
      setAccountModal({
        open: true,
        employeeName: emp.full_name,
        username: result.username,
        password: result.password,
      });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể tạo tài khoản');
    }
  };

  const handleResetPassword = async (emp: Employee) => {
    try {
      const result = await employeeService.resetPassword(emp.id);
      setAccountModal({
        open: true,
        employeeName: emp.full_name,
        username: result.username,
        password: result.new_password,
        isReset: true,
      });
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể reset mật khẩu');
    }
  };

  const handleBatchCreateAccounts = async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchLoading(true);
    try {
      const response = await apiClient.post(
        API_ENDPOINTS.EMPLOYEE_BATCH_CREATE_ACCOUNTS,
        { employee_ids: selectedRowKeys },
        { responseType: 'blob' },
      );
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
      setRefreshKey((k) => k + 1);
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

  const searchDropdown = useCallback(
    ({ setSelectedKeys, confirm }: FilterDropdownProps) => (
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
    ),
    [filterSearch],
  );

  const deptDropdown = useCallback(
    ({ setSelectedKeys, confirm }: FilterDropdownProps) => (
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
    ),
    [filterDept, departments],
  );

  const posDropdown = useCallback(
    ({ setSelectedKeys, confirm }: FilterDropdownProps) => (
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
    ),
    [filterPosition, positions],
  );

  const columns: ColumnsType<Employee> = [
    {
      title: 'Mã NV',
      dataIndex: 'employee_code',
      key: 'code',
      width: 110,
      render: (_: any, record: Employee) => <span>{record.employee_code || '-'}</span>,
    },
    {
      title: 'Họ tên',
      dataIndex: 'full_name',
      key: 'name',
      width: 190,
      filterDropdown: searchDropdown,
      filteredValue: filterSearch ? [filterSearch] : undefined,
      render: (_: any, record: Employee) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => navigate(`/employees/${record.id}`)}>
          {record.full_name}
        </Button>
      ),
    },
    {
      title: 'Phòng ban',
      dataIndex: 'department_name',
      key: 'dept',
      width: 220,
      filterDropdown: deptDropdown,
      filteredValue: filterDept.length > 0 ? filterDept : undefined,
      render: (_: any, record: Employee) => <span>{record.department_name}</span>,
    },
    {
      title: 'Chức vụ',
      dataIndex: 'position_name',
      key: 'position_name',
      width: 170,
      filterDropdown: posDropdown,
      filteredValue: filterPosition ? [filterPosition] : undefined,
      render: (v: string | null, record: Employee) => <span>{v || record.position || '-'}</span>,
    },
    {
      title: 'Vị trí việc làm',
      dataIndex: 'job_position_name',
      key: 'job_position_name',
      width: 180,
      render: (_: any, record: Employee) => <span>{record.job_position_name || '-'}</span>,
    },
    {
      title: 'Ngày vào làm',
      dataIndex: 'hire_date',
      key: 'hire_date',
      width: 125,
      render: (_: any, record: Employee) => (
        <span>{record.hire_date ? dayjs(record.hire_date).format('DD/MM/YYYY') : '-'}</span>
      ),
    },
    {
      title: 'Tài khoản',
      key: 'account',
      width: 160,
      render: (_: any, record: Employee) => {
        if (!record.is_active) return <Tag color="default">Đã khoá</Tag>;
        if (record.has_account) {
          return (
            <Tag color="green" icon={<UserOutlined />}>
              {record.username}
            </Tag>
          );
        }
        return <Tag color="orange">Chưa có</Tag>;
      },
    },
    {
      title: 'SĐT',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (_: any, record: Employee) => <span>{record.phone || '-'}</span>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 190,
      render: (_: any, record: Employee) => <span>{record.email || '-'}</span>,
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 140,
      render: (_: any, record: Employee) => (
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_EMPLOYEES]}>
          <Space>
            <Tooltip title="Chỉnh sửa thông tin nhân sự">
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
            </Tooltip>
            {record.is_active && !record.has_account && (
              <Tooltip title="Tạo tài khoản">
                <Button type="link" size="small" icon={<UserOutlined />} onClick={() => handleCreateAccount(record)} />
              </Tooltip>
            )}
            {record.is_active && record.has_account && (
              <Tooltip title="Reset mật khẩu">
                <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => handleResetPassword(record)} />
              </Tooltip>
            )}
            {record.is_active && (
              <Tooltip title="Chuyển trạng thái nghỉ việc">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    setDeactivateModal({ open: true, employeeId: record.id, employeeName: record.full_name })
                  }
                />
              </Tooltip>
            )}
          </Space>
        </PermGate>
      ),
    },
  ];

  const displayColumns = useMemo(() => {
    return canManage ? columns : columns.filter((c) => c.key !== 'actions');
  }, [columns, canManage]);

  return (
    <div>
      <EmployeeTable
        activeOnly
        title={canManage ? 'Nhân sự hiện có' : 'Danh bạ nhân sự'}
        columns={displayColumns}
        refreshKey={refreshKey}
        filterSearch={filterSearch}
        onFilterSearchChange={setFilterSearch}
        filterDept={filterDept}
        onFilterDeptChange={setFilterDept}
        filterPosition={filterPosition}
        onFilterPositionChange={setFilterPosition}
        selectedRowKeys={canManage ? selectedRowKeys : []}
        onSelectionChange={canManage ? setSelectedRowKeys : undefined}
        headerActions={
          <PermGate perms={[PERMISSIONS.CAN_MANAGE_EMPLOYEES]}>
            <Space>
              <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                Nhập
              </Button>
              <Tooltip title="Alt+N">
                <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
                  Thêm
                </Button>
              </Tooltip>
            </Space>
          </PermGate>
        }
      />

      {/* Modal Thêm mới / Chỉnh sửa Nhân sự (Thay cho chỉnh sửa dạng ngang trên dòng) */}
      <Modal
        title={editingRecord ? `Chỉnh sửa nhân sự: ${editingRecord.full_name}` : 'Thêm nhân sự mới'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSaveModal}
        confirmLoading={saving}
        okText={editingRecord ? 'Lưu thay đổi' : 'Thêm nhân sự'}
        cancelText="Hủy"
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 14 }}>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="employee_code" label="Mã nhân viên">
                <Input placeholder="VD: MBS-001 (Để trống tự tạo)" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item
                name="full_name"
                label="Họ và tên nhân sự"
                rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
              >
                <Input placeholder="Nhập đầy đủ họ và tên" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="department_id"
                label="Phòng ban / Đơn vị"
                rules={[{ required: true, message: 'Vui lòng chọn phòng ban' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn phòng ban"
                  options={departments.map((d) => ({ label: d.name, value: d.id }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="position_id" label="Chức vụ">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn chức vụ"
                  options={positions
                    .filter((p) => p.is_active)
                    .map((p) => ({
                      label: `${p.name} (${SCOPE_LABELS[p.scope] || p.scope})`,
                      value: p.id,
                    }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="job_position_id" label="Vị trí việc làm">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn vị trí việc làm"
                  options={jobPositions
                    .filter((j) => j.is_active)
                    .map((j) => ({
                      label: `${j.name} (Bậc ${j.professional_level})`,
                      value: j.id,
                    }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="workplace_id" label="Nơi làm việc">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn nơi làm việc"
                  options={workplaces
                    .filter((w) => w.is_active)
                    .map((w) => ({
                      label: w.name,
                      value: w.id,
                    }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="hire_date" label="Ngày vào làm">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="phone" label="Số điện thoại">
                <Input placeholder="VD: 0908xxxxxx" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="email" label="Email công vụ">
                <Input type="email" placeholder="ten@tphcm.gov.vn" />
              </Form.Item>
            </Col>
          </Row>

          {!editingRecord && (
            <Form.Item name="create_account" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Checkbox>Tự động tạo tài khoản đăng nhập cho nhân sự này</Checkbox>
            </Form.Item>
          )}
        </Form>
      </Modal>

      <AccountModal
        open={accountModal.open}
        employeeName={accountModal.employeeName}
        username={accountModal.username}
        password={accountModal.password}
        isReset={accountModal.isReset}
        onClose={() => setAccountModal((prev) => ({ ...prev, open: false }))}
      />

      {canManage && selectedRowKeys.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 5,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 50%, rgba(240,248,255,0.2) 100%)',
            backdropFilter: 'blur(48px) saturate(300%)',
            WebkitBackdropFilter: 'blur(48px) saturate(300%)',
            border: '1px solid rgba(255,255,255,0.65)',
            borderRadius: 14,
            padding: '10px 28px',
            width: 'fit-content',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }}
        >
          <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
            Đã chọn <b>{selectedRowKeys.length}</b> nhân sự
          </span>
          <Button type="primary" icon={<UserOutlined />} loading={batchLoading} onClick={handleBatchCreateAccounts}>
            Tạo tài khoản
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={batchLoading}
            onClick={() => setBatchDeactivateModal({ open: true })}
          >
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
        onCancel={() => {
          setBatchDeactivateModal({ open: false });
          setBatchDeactivateStatus('');
        }}
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

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />

      <Modal
        title={`Ngưng nhân viên: ${deactivateModal.employeeName}`}
        open={deactivateModal.open}
        onOk={handleDeactivate}
        onCancel={() => {
          setDeactivateModal({ open: false, employeeId: null, employeeName: '' });
          setDeactivateStatus('');
        }}
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
