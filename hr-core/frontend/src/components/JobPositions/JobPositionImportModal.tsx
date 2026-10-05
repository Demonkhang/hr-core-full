import { useState } from 'react';
import { Modal, Upload, Button, Alert, Typography, Space, message } from 'antd';
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload';
import { jobPositionService } from '@/services/jobPositionService';

const { Dragger } = Upload;

interface ImportResult {
  imported_count: number;
  created_count: number;
  updated_count: number;
  errors: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function JobPositionImportModal({ open, onClose, onSuccess }: Props) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleUpload = async () => {
    const file = fileList[0]?.originFileObj;
    if (!file) return;

    setLoading(true);
    setResult(null);
    try {
      const data = await jobPositionService.import(file as File);
      setResult(data);
      if (data.imported_count > 0) {
        message.success(`Đã xử lý ${data.imported_count} vị trí việc làm (Tạo mới: ${data.created_count}, Cập nhật: ${data.updated_count})`);
        onSuccess();
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể import file Excel');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await jobPositionService.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'mau_nhap_vitrivieclam.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Không thể tải file mẫu');
    }
  };

  const handleClose = () => {
    setFileList([]);
    setResult(null);
    onClose();
  };

  return (
    <Modal
      title="Nhập danh sách Vị trí việc làm từ Excel"
      open={open}
      onCancel={handleClose}
      footer={
        result ? (
          <Button onClick={handleClose}>Đóng</Button>
        ) : (
          <Space>
            <Button onClick={handleClose}>Hủy</Button>
            <Button type="primary" loading={loading} disabled={fileList.length === 0} onClick={handleUpload}>
              Nhập Excel
            </Button>
          </Space>
        )
      }
      width={600}
    >
      {!result ? (
        <>
          <Typography.Paragraph type="secondary">
            File Excel cần chứa các cột: <strong>Mã vị trí việc làm</strong>, <strong>Tên vị trí việc làm</strong>,{' '}
            <strong>Bậc nghề nghiệp</strong> (1-5), <strong>Bằng cấp (trình độ)</strong>, <strong>Chuyên môn</strong>,{' '}
            <strong>Số lượng tối đa (Định biên)</strong>, <strong>Mô tả</strong>.
            <br />
            <Button
              type="link"
              icon={<DownloadOutlined />}
              style={{ padding: 0, marginTop: 4 }}
              onClick={handleDownloadTemplate}
            >
              Tải file mẫu Excel
            </Button>
          </Typography.Paragraph>
          <Dragger
            accept=".xlsx,.xls"
            multiple={false}
            fileList={fileList}
            beforeUpload={(file) => {
              setFileList([file]);
              return false;
            }}
            onRemove={() => setFileList([])}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click hoặc kéo thả file Excel vào đây</p>
          </Dragger>
        </>
      ) : (
        <>
          {result.imported_count > 0 && (
            <Alert
              type="success"
              showIcon
              message={`Nhập dữ liệu thành công!`}
              description={`Đã tạo mới ${result.created_count} và cập nhật ${result.updated_count} vị trí việc làm.`}
              style={{ marginBottom: 16 }}
            />
          )}
          {result.errors?.length > 0 && (
            <Alert
              type="error"
              showIcon
              message={`Có ${result.errors.length} cảnh báo / lỗi`}
              description={
                <ul style={{ margin: 0, paddingLeft: 20, maxHeight: 180, overflowY: 'auto' }}>
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              }
              style={{ marginBottom: 16 }}
            />
          )}
        </>
      )}
    </Modal>
  );
}
