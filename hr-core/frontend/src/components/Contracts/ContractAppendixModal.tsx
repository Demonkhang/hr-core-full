import { useEffect, useState } from 'react';
import { Modal, Form, Input, DatePicker, InputNumber, Select, Upload, Button, message, Space } from 'antd';
import { PaperClipOutlined, UploadOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { contractService } from '@/services/contractService';
import type { Contract, ContractAppendixCreate } from '@/types/contract';
import { APPENDIX_CHANGE_TYPE_LABELS } from '@/types/contract';

interface ContractAppendixModalProps {
  open: boolean;
  contract: Contract | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export function ContractAppendixModal({
  open,
  contract,
  onCancel,
  onSuccess,
}: ContractAppendixModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [changeType, setChangeType] = useState<string>('salary');

  useEffect(() => {
    if (open && contract) {
      const year = dayjs().year();
      const count = (contract.appendices?.length || 0) + 1;
      const appNumber = `PL0${count}-${contract.contract_number}`;

      form.setFieldsValue({
        appendix_number: appNumber,
        signing_date: dayjs(),
        effective_date: dayjs(),
        change_type: 'salary',
        new_basic_salary: contract.basic_salary,
        content: 'Điều chỉnh mức lương cơ bản và chế độ phụ cấp theo quyết định mới.',
      });
      setChangeType('salary');
      setFileUrl(null);
    } else {
      form.resetFields();
      setFileUrl(null);
    }
  }, [open, contract]);

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      const res = await contractService.uploadAttachment(file);
      setFileUrl(res.file_url);
      message.success('Đã tải lên tệp đính kèm phụ lục');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi khi tải file');
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleSubmit = async () => {
    if (!contract) return;
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload: ContractAppendixCreate = {
        appendix_number: values.appendix_number.trim(),
        effective_date: dayjs(values.effective_date).format('YYYY-MM-DD'),
        signing_date: dayjs(values.signing_date).format('YYYY-MM-DD'),
        change_type: values.change_type,
        content: values.content.trim(),
        new_basic_salary: values.new_basic_salary,
        new_end_date: values.new_end_date ? dayjs(values.new_end_date).format('YYYY-MM-DD') : undefined,
        file_attachment_url: fileUrl || undefined,
      };

      await contractService.createAppendix(contract.id, payload);
      message.success('Thêm phụ lục hợp đồng thành công!');
      onSuccess();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi khi tạo phụ lục');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PaperClipOutlined style={{ color: '#2563eb' }} />
          <span>Thêm phụ lục hợp đồng ({contract?.contract_number})</span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="Lưu phụ lục"
      cancelText="Hủy"
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item
          name="appendix_number"
          label="Số hiệu phụ lục"
          rules={[{ required: true, message: 'Nhập số phụ lục' }]}
        >
          <Input placeholder="Vd: PL01-HDLD-2026/001" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item
            name="signing_date"
            label="Ngày ký kết phụ lục"
            rules={[{ required: true, message: 'Chọn ngày ký' }]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="effective_date"
            label="Ngày có hiệu lực"
            rules={[{ required: true, message: 'Chọn ngày hiệu lực' }]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <Form.Item
          name="change_type"
          label="Nội dung điều chỉnh chính"
          rules={[{ required: true, message: 'Chọn loại điều chỉnh' }]}
        >
          <Select
            onChange={(val) => setChangeType(val)}
            options={Object.entries(APPENDIX_CHANGE_TYPE_LABELS).map(([k, v]) => ({
              label: v,
              value: k,
            }))}
          />
        </Form.Item>

        {changeType === 'salary' && (
          <Form.Item
            name="new_basic_salary"
            label="Mức lương mới áp dụng theo phụ lục (VNĐ)"
            rules={[{ required: true, message: 'Nhập mức lương mới' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(val) => val!.replace(/\$\s?|(,*)/g, '') as any}
              addonAfter="đ"
            />
          </Form.Item>
        )}

        {changeType === 'term_extension' && (
          <Form.Item
            name="new_end_date"
            label="Thời hạn hợp đồng mới gia hạn đến ngày"
            rules={[{ required: true, message: 'Chọn ngày hết hạn mới' }]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
        )}

        <Form.Item
          name="content"
          label="Nội dung chi tiết thỏa thuận sửa đổi"
          rules={[{ required: true, message: 'Nhập nội dung thỏa thuận' }]}
        >
          <Input.TextArea rows={3} placeholder="Mô tả cụ thể các điều khoản được sửa đổi bổ sung..." />
        </Form.Item>

        <Form.Item label="Tệp đính kèm bản scan phụ lục có chữ ký">
          <Space align="center">
            <Upload beforeUpload={handleFileUpload} showUploadList={false} accept=".pdf,.png,.jpg,.jpeg">
              <Button icon={<UploadOutlined />} loading={uploading}>
                Tải lên bản scan phụ lục
              </Button>
            </Upload>
            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: '#2563eb' }}>
                <FilePdfOutlined style={{ marginRight: 4 }} />
                Xem file phụ lục đã tải lên
              </a>
            )}
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
