import { useState } from 'react';
import { Modal, Upload, Button, Alert, Table, Typography, Space, message } from 'antd';
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload';
import apiClient from '@/services/apiClient';
import { API_ENDPOINTS } from '@/utils/constants';

const { Dragger } = Upload;

interface ImportResult {
  imported: { row: number; full_name: string; employee_code: string | null; id: string }[];
  errors: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/** Modal import nhân viên từ file Excel, hiển thị kết quả import */
export function ImportModal({ open, onClose, onSuccess }: Props) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  /** Upload file Excel lên server và xử lý kết quả import */
  const handleUpload = async () => {
    const file = fileList[0]?.originFileObj;
    if (!file) return;

    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post(API_ENDPOINTS.EMPLOYEES_IMPORT, formData);
      setResult(res.data);
      if (res.data.imported?.length > 0) {
        message.success(`Đã import ${res.data.imported.length} nhân viên`);
        onSuccess();
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi import file');
    } finally {
      setLoading(false);
    }
  };

  /** Tải file mẫu về máy qua API đã xác thực */
  const handleDownloadTemplate = async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.EMPLOYEES_IMPORT_TEMPLATE, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'import_employee_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Không thể tải file mẫu');
    }
  };

  /** Reset state và đóng modal */
  const handleClose = () => {
    setFileList([]);
    setResult(null);
    onClose();
  };

  return (
    <Modal
      title="Import nhân viên từ Excel"
      open={open}
      onCancel={handleClose}
      footer={
        result ? (
          <Button onClick={handleClose}>Đóng</Button>
        ) : (
          <Space>
            <Button onClick={handleClose}>Hủy</Button>
            <Button type="primary" loading={loading} disabled={fileList.length === 0} onClick={handleUpload}>
              Import
            </Button>
          </Space>
        )
      }
      width={640}
    >
      {!result ? (
        <>
          <Typography.Paragraph type="secondary">
            File Excel cần có các cột: <strong>Họ tên</strong>, <strong>Phòng ban</strong> (mã),{' '}
            <strong>Nơi làm việc</strong> (mã, không bắt buộc), <strong>Chức vụ</strong>,{' '}
            <strong>Số điện thoại</strong>, <strong>Email</strong>, <strong>Mã nhân viên</strong>,{' '}
            <strong>Ngày vào làm</strong> (DD/MM/YYYY).
            <br />
            <Button type="link" icon={<DownloadOutlined />} style={{ padding: 0, marginTop: 4 }}
              onClick={handleDownloadTemplate}>
              Tải file mẫu
            </Button>
          </Typography.Paragraph>
          <Dragger
            accept=".xlsx,.xls"
            multiple={false}
            fileList={fileList}
            beforeUpload={(file) => { setFileList([file]); return false; }}
            onRemove={() => setFileList([])}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Click hoặc kéo thả file Excel vào đây</p>
          </Dragger>
        </>
      ) : (
        <>
          {result.imported?.length > 0 && (
            <Alert
              type="success"
              showIcon
              message={`Đã import ${result.imported.length} nhân viên thành công`}
              style={{ marginBottom: 16 }}
            />
          )}
          {result.errors?.length > 0 && (
            <Alert
              type="error"
              showIcon
              message={`Có ${result.errors.length} lỗi`}
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              }
              style={{ marginBottom: 16 }}
            />
          )}
          {result.imported?.length > 0 && (
            <Table
              dataSource={result.imported}
              columns={[
                { title: 'Dòng', dataIndex: 'row', width: 60 },
                { title: 'Họ tên', dataIndex: 'full_name' },
                { title: 'Mã NV', dataIndex: 'employee_code' },
              ]}
              rowKey="row"
              size="small"
              pagination={false}
            />
          )}
        </>
      )}
    </Modal>
  );
}
