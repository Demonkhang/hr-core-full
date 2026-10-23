import { useEffect, useState } from 'react';
import { Modal, Form, DatePicker, Input, Checkbox, message, Typography, Descriptions } from 'antd';
import { StopOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { contractService } from '@/services/contractService';
import type { Contract, ContractTerminateRequest } from '@/types/contract';
import { CONTRACT_TYPE_LABELS } from '@/types/contract';

interface ContractTerminateModalProps {
  open: boolean;
  contract: Contract | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export function ContractTerminateModal({
  open,
  contract,
  onCancel,
  onSuccess,
}: ContractTerminateModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        termination_date: dayjs(),
        termination_reason: 'Hết hạn hợp đồng không tái ký',
        deactivate_employee: true,
      });
    } else {
      form.resetFields();
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!contract) return;
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload: ContractTerminateRequest = {
        termination_date: dayjs(values.termination_date).format('YYYY-MM-DD'),
        termination_reason: values.termination_reason.trim(),
        deactivate_employee: Boolean(values.deactivate_employee),
      };

      await contractService.terminate(contract.id, payload);
      message.success('Đã hoàn tất thủ tục chấm dứt hợp đồng lao động');
      onSuccess();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi khi chấm dứt hợp đồng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
          <StopOutlined />
          <span>Chấm dứt / Thanh lý hợp đồng lao động</span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="Xác nhận chấm dứt"
      cancelText="Hủy"
      okButtonProps={{ danger: true }}
      destroyOnClose
      width={560}
    >
      {contract && (
        <Descriptions bordered size="small" column={2} style={{ marginTop: 12, marginBottom: 16 }}>
          <Descriptions.Item label="Nhân viên" span={2}>
            <strong>{contract.employee_name || '-'}</strong> ({contract.employee_code || '-'})
          </Descriptions.Item>
          <Descriptions.Item label="Số hợp đồng">{contract.contract_number}</Descriptions.Item>
          <Descriptions.Item label="Loại HĐ">
            {CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type}
          </Descriptions.Item>
          <Descriptions.Item label="Thời hạn">
            {contract.start_date ? dayjs(contract.start_date).format('DD/MM/YYYY') : '-'}
            {' → '}
            {contract.end_date ? dayjs(contract.end_date).format('DD/MM/YYYY') : 'Vô thời hạn'}
          </Descriptions.Item>
          <Descriptions.Item label="Phòng ban">{contract.department_name || '-'}</Descriptions.Item>
        </Descriptions>
      )}

      <Form form={form} layout="vertical">
        <Form.Item
          name="termination_date"
          label="Ngày chính thức chấm dứt hiệu lực"
          rules={[{ required: true, message: 'Vui lòng chọn ngày chấm dứt' }]}
        >
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="termination_reason"
          label="Lý do chấm dứt hợp đồng"
          rules={[{ required: true, message: 'Vui lòng nhập lý do chấm dứt' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="Vd: Hết hạn hợp đồng không gia hạn tiếp, Thỏa thuận chấm dứt HĐLĐ, Người lao động xin thôi việc..."
          />
        </Form.Item>

        <Form.Item name="deactivate_employee" valuePropName="checked">
          <Checkbox>
            <span style={{ fontWeight: 500, color: '#dc2626' }}>
              Đồng thời chuyển trạng thái nhân viên sang "Đã nghỉ việc" và vô hiệu hóa lịch trực
            </span>
          </Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
