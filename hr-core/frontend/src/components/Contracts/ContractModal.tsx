import { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Row,
  Col,
  Upload,
  Button,
  Alert,
  Space,
  message,
  Divider,
} from 'antd';
import {
  UploadOutlined,
  FilePdfOutlined,
  WarningOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { contractService } from '@/services/contractService';
import { employeeService } from '@/services/employeeService';
import { departmentService } from '@/services/departmentService';
import { workplaceService } from '@/services/workplaceService';
import type { Employee } from '@/types/employee';
import type { Department } from '@/types/department';
import type { Workplace } from '@/types/workplace';
import type { Contract, ContractCreate, ContractRenewRequest } from '@/types/contract';
import { CONTRACT_TYPE_LABELS } from '@/types/contract';

interface ContractModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  contract?: Contract | null;
  renewingContract?: Contract | null;
  presetEmployeeId?: string;
}

export function ContractModal({
  open,
  onCancel,
  onSuccess,
  contract,
  renewingContract,
  presetEmployeeId,
}: ContractModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [contractType, setContractType] = useState<string>('definite_term');

  const isEditing = Boolean(contract);
  const isRenewing = Boolean(renewingContract);

  useEffect(() => {
    if (open) {
      Promise.all([
        employeeService.list({ active_only: true }),
        departmentService.list(true),
        workplaceService.list(),
      ])
        .then(([emps, depts, wps]) => {
          setEmployees(emps);
          setDepartments(depts);
          setWorkplaces(wps);
        })
        .catch(() => message.error('Không thể tải danh mục liên quan'));
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setFileUrl(null);
      return;
    }

    if (isRenewing && renewingContract) {
      // Chuẩn bị form ký tiếp nối tiếp HĐ cũ
      const nextSeq = (renewingContract.contract_sequence || 1) + 1;
      const nextType = nextSeq > 2 ? 'indefinite_term' : 'definite_term';
      setContractType(nextType);

      const oldEnd = renewingContract.end_date ? dayjs(renewingContract.end_date) : dayjs();
      const newStart = oldEnd.add(1, 'day');
      const newEnd = nextType === 'indefinite_term' ? undefined : newStart.add(1, 'year').subtract(1, 'day');

      const year = dayjs().year();
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const generatedNumber = `HDLD-${year}/${randomCode}`;

      form.setFieldsValue({
        employee_id: renewingContract.employee_id,
        contract_number: generatedNumber,
        contract_type: nextType,
        signing_date: dayjs(),
        start_date: newStart,
        end_date: newEnd,
        job_title: renewingContract.job_title,
        department_id: renewingContract.department_id,
        workplace_id: renewingContract.workplace_id,
        basic_salary: renewingContract.basic_salary,
        salary_rate: 100,
        allowance_amount: renewingContract.allowance_amount || 0,
        signatory_name: renewingContract.signatory_name || 'Ban Giám đốc',
        signatory_title: renewingContract.signatory_title || 'Giám đốc',
      });
      setFileUrl(null);
    } else if (isEditing && contract) {
      setContractType(contract.contract_type);
      form.setFieldsValue({
        employee_id: contract.employee_id,
        contract_number: contract.contract_number,
        contract_type: contract.contract_type,
        signing_date: contract.signing_date ? dayjs(contract.signing_date) : dayjs(),
        start_date: contract.start_date ? dayjs(contract.start_date) : dayjs(),
        end_date: contract.end_date ? dayjs(contract.end_date) : undefined,
        job_title: contract.job_title,
        department_id: contract.department_id,
        workplace_id: contract.workplace_id,
        basic_salary: contract.basic_salary,
        salary_rate: contract.salary_rate ?? 100,
        allowance_amount: contract.allowance_amount ?? 0,
        signatory_name: contract.signatory_name,
        signatory_title: contract.signatory_title,
        working_hours_description: contract.working_hours_description,
        notes: contract.notes,
      });
      setFileUrl(contract.file_attachment_url);
    } else {
      // Tạo mới hoàn toàn
      const year = dayjs().year();
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const generatedNumber = `HDLD-${year}/${randomCode}`;

      const defaultType = 'definite_term';
      setContractType(defaultType);

      form.setFieldsValue({
        employee_id: presetEmployeeId,
        contract_number: generatedNumber,
        contract_type: defaultType,
        signing_date: dayjs(),
        start_date: dayjs(),
        end_date: dayjs().add(1, 'year').subtract(1, 'day'),
        salary_rate: 100,
        allowance_amount: 0,
        signatory_name: 'Ban Giám đốc',
        signatory_title: 'Giám đốc',
      });
      setFileUrl(null);

      if (presetEmployeeId && employees.length > 0) {
        handleEmployeeSelect(presetEmployeeId);
      }
    }
  }, [open, contract, renewingContract, presetEmployeeId, employees]);

  const handleEmployeeSelect = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;

    form.setFieldsValue({
      department_id: emp.department_id,
      workplace_id: emp.workplace_id,
      job_title: emp.position_name || emp.position,
    });
  };

  const handleQuickAddDuration = (months: number) => {
    const start = form.getFieldValue('start_date') || dayjs();
    const newEnd = dayjs(start).add(months, 'month').subtract(1, 'day');
    form.setFieldsValue({ end_date: newEnd });
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      const res = await contractService.uploadAttachment(file);
      setFileUrl(res.file_url);
      message.success('Đã tải lên tệp đính kèm hợp đồng');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi khi tải file');
    } finally {
      setUploading(false);
    }
    return false; // Chặn upload mặc định của Antd
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload: any = {
        employee_id: values.employee_id,
        contract_number: values.contract_number.trim(),
        contract_type: values.contract_type,
        start_date: dayjs(values.start_date).format('YYYY-MM-DD'),
        end_date: values.contract_type === 'indefinite_term' || !values.end_date ? null : dayjs(values.end_date).format('YYYY-MM-DD'),
        signing_date: dayjs(values.signing_date).format('YYYY-MM-DD'),
        signatory_name: values.signatory_name?.trim() || null,
        signatory_title: values.signatory_title?.trim() || null,
        job_title: values.job_title?.trim() || null,
        department_id: values.department_id || null,
        workplace_id: values.workplace_id || null,
        basic_salary: values.basic_salary,
        salary_rate: values.salary_rate || 100,
        allowance_amount: values.allowance_amount || 0,
        working_hours_description: values.working_hours_description?.trim() || null,
        notes: values.notes?.trim() || null,
        file_attachment_url: fileUrl,
      };

      if (isRenewing && renewingContract) {
        const renewPayload: ContractRenewRequest = {
          contract_number: payload.contract_number,
          contract_type: payload.contract_type,
          start_date: payload.start_date,
          end_date: payload.end_date,
          signing_date: payload.signing_date,
          signatory_name: payload.signatory_name,
          signatory_title: payload.signatory_title,
          job_title: payload.job_title,
          basic_salary: payload.basic_salary,
          salary_rate: payload.salary_rate,
          allowance_amount: payload.allowance_amount,
          notes: payload.notes,
          file_attachment_url: fileUrl || undefined,
        };
        await contractService.renew(renewingContract.id, renewPayload);
        message.success('Gia hạn / Ký tiếp hợp đồng thành công!');
      } else if (isEditing && contract) {
        await contractService.update(contract.id, payload);
        message.success('Cập nhật hợp đồng thành công!');
      } else {
        await contractService.create(payload as ContractCreate);
        message.success('Tạo hợp đồng lao động mới thành công!');
      }

      onSuccess();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi khi lưu hợp đồng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
          <FilePdfOutlined style={{ color: '#7c3aed' }} />
          <span>
            {isRenewing
              ? `Gia hạn / Tái ký hợp đồng (tiếp nối ${renewingContract?.contract_number})`
              : isEditing
              ? `Chỉnh sửa hợp đồng: ${contract?.contract_number}`
              : 'Thêm mới hợp đồng lao động'}
          </span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={760}
      okText={isRenewing ? 'Xác nhận tái ký' : isEditing ? 'Lưu thay đổi' : 'Tạo hợp đồng'}
      cancelText="Hủy"
      destroyOnClose
    >
      {contractType === 'definite_term' && (
        <Alert
          type="info"
          showIcon
          icon={<ThunderboltOutlined />}
          message="Quy định Bộ luật Lao động 2019 về HĐ xác định thời hạn"
          description="Doanh nghiệp chỉ được ký tối đa 02 lần hợp đồng xác định thời hạn. Lần tiếp theo bắt buộc phải ký hợp đồng không xác định thời hạn."
          style={{ marginBottom: 16, marginTop: 8 }}
        />
      )}

      {contractType === 'probation' && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="Thời gian thử việc tối đa"
          description="Tối đa 60 ngày đối với công việc có trình độ CĐ/ĐH trở lên; 30 ngày với công việc trung cấp, kỹ thuật; 180 ngày với vị trí quản lý."
          style={{ marginBottom: 16, marginTop: 8 }}
        />
      )}

      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="employee_id"
              label="Nhân viên ký hợp đồng"
              rules={[{ required: true, message: 'Vui lòng chọn nhân viên' }]}
            >
              <Select
                showSearch
                placeholder="Tìm theo tên hoặc mã nhân viên"
                disabled={isRenewing || Boolean(presetEmployeeId)}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                onChange={handleEmployeeSelect}
                options={employees.map((e) => ({
                  label: `${e.full_name} (${e.employee_code || e.department_name || 'NV'})`,
                  value: e.id,
                }))}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="contract_number"
              label="Số hiệu hợp đồng"
              rules={[{ required: true, message: 'Vui lòng nhập số hiệu hợp đồng' }]}
            >
              <Input placeholder="Vd: HDLD-2026/001" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item
              name="contract_type"
              label="Loại hợp đồng"
              rules={[{ required: true, message: 'Chọn loại hợp đồng' }]}
            >
              <Select
                onChange={(val) => {
                  setContractType(val);
                  if (val === 'probation') form.setFieldsValue({ salary_rate: 85 });
                  else if (val === 'indefinite_term') form.setFieldsValue({ end_date: null, salary_rate: 100 });
                  else form.setFieldsValue({ salary_rate: 100 });
                }}
                options={Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => ({
                  label: v,
                  value: k,
                }))}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              name="signing_date"
              label="Ngày ký kết"
              rules={[{ required: true, message: 'Chọn ngày ký kết' }]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              name="start_date"
              label="Ngày có hiệu lực"
              rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        {contractType !== 'indefinite_term' && (
          <Row gutter={16} align="middle">
            <Col xs={24} md={12}>
              <Form.Item
                name="end_date"
                label="Ngày hết hạn hợp đồng"
                rules={[{ required: true, message: 'Chọn ngày hết hạn' }]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>
                  Chọn nhanh thời hạn hợp đồng:
                </span>
                <Space wrap size={6}>
                  <Button size="small" onClick={() => handleQuickAddDuration(2)}>
                    2 tháng (Thử việc)
                  </Button>
                  <Button size="small" onClick={() => handleQuickAddDuration(12)}>
                    1 năm (12T)
                  </Button>
                  <Button size="small" onClick={() => handleQuickAddDuration(24)}>
                    2 năm (24T)
                  </Button>
                  <Button size="small" onClick={() => handleQuickAddDuration(36)}>
                    3 năm (36T)
                  </Button>
                </Space>
              </div>
            </Col>
          </Row>
        )}

        <Divider style={{ margin: '8px 0 16px 0' }} />

        {/* Tiền lương & Chế độ đãi ngộ */}
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item
              name="basic_salary"
              label="Mức lương chính thức (VNĐ)"
              rules={[{ required: true, message: 'Nhập mức lương' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(val) => val!.replace(/\$\s?|(,*)/g, '') as any}
                placeholder="Vd: 15,000,000"
                min={0}
                addonAfter="đ"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              name="salary_rate"
              label="Tỷ lệ hưởng lương (%)"
              tooltip="Mặc định 100% đối với HĐ chính thức, 85% đối với HĐ thử việc theo BLLĐ"
            >
              <InputNumber style={{ width: '100%' }} min={50} max={100} addonAfter="%" />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name="allowance_amount" label="Phụ cấp theo HĐ (VNĐ)">
              <InputNumber
                style={{ width: '100%' }}
                formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(val) => val!.replace(/\$\s?|(,*)/g, '') as any}
                min={0}
                addonAfter="đ"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Công việc & Địa điểm */}
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="job_title" label="Chức danh công việc">
              <Input placeholder="Vd: Chuyên viên Marketing" />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name="department_id" label="Phòng ban">
              <Select
                placeholder="Chọn phòng ban"
                options={departments.map((d) => ({ label: d.name, value: d.id }))}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name="workplace_id" label="Nơi làm việc">
              <Select
                placeholder="Chọn nơi làm việc"
                options={workplaces.map((w) => ({ label: w.name, value: w.id }))}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Đại diện công ty ký kết */}
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="signatory_name" label="Đại diện công ty ký">
              <Input placeholder="Vd: Nguyễn Văn A" />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="signatory_title" label="Chức vụ người đại diện ký">
              <Input placeholder="Vd: Tổng Giám đốc" />
            </Form.Item>
          </Col>
        </Row>

        {/* Tệp đính kèm */}
        <Form.Item label="Tệp đính kèm hợp đồng có chữ ký (PDF hoặc hình ảnh scan)">
          <Space align="center">
            <Upload beforeUpload={handleFileUpload} showUploadList={false} accept=".pdf,.png,.jpg,.jpeg">
              <Button icon={<UploadOutlined />} loading={uploading}>
                Tải lên bản scan HĐ
              </Button>
            </Upload>
            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: '#7c3aed' }}>
                <FilePdfOutlined style={{ marginRight: 4 }} />
                Xem tệp đã tải lên
              </a>
            )}
          </Space>
        </Form.Item>

        <Form.Item name="notes" label="Ghi chú thêm">
          <Input.TextArea rows={2} placeholder="Nội dung ghi chú điều khoản đặc biệt nếu có..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
