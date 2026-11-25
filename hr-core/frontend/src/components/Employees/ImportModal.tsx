import { useState } from 'react';
import { Modal, Upload, Button, Alert, Table, Typography, Space, Tag, message } from 'antd';
import { InboxOutlined, DownloadOutlined, CheckCircleOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload';
import apiClient from '@/services/apiClient';
import { API_ENDPOINTS } from '@/utils/constants';

const { Dragger } = Upload;
const { Text } = Typography;

interface PreviewRow {
  row: number;
  employee_code: string;
  full_name: string;
  department_code: string;
  position: string;
  cccd_number?: string;
  phone: string;
  email: string;
  workplace_code: string;
  hire_date: string;
}

interface PreviewResult {
  total_rows: number;
  records: PreviewRow[];
  errors: string[];
}

interface ImportResult {
  imported: { row: number; full_name: string; employee_code: string | null; id: string }[];
  errors: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/** Modal import nhân viên từ file Excel: Hỗ trợ Xem trước (Preview) danh sách trước khi xác nhận Import */
export function ImportModal({ open, onClose, onSuccess }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  /** Gọi API đọc file Excel để hiển thị bảng Xem trước (Preview) ngay khi chọn file */
  const handlePreviewFile = async (rawFile: File) => {
    setSelectedFile(rawFile);
    setResult(null);
    setPreviewLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', rawFile);
      const res = await apiClient.post(`${API_ENDPOINTS.EMPLOYEES_IMPORT}/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      setPreview(res.data);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể đọc xem trước file Excel này');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  /** Upload file Excel lên server và lưu chính thức vào CSDL */
  const handleUpload = async () => {
    const rawFile = selectedFile || (fileList[0]?.originFileObj as File) || (fileList[0] as unknown as File);
    if (!rawFile) {
      message.warning('Vui lòng chọn file Excel trước khi bấm Import');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', rawFile);
      const res = await apiClient.post(API_ENDPOINTS.EMPLOYEES_IMPORT, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      setResult(res.data);
      if (res.data.imported?.length > 0) {
        message.success(`Đã import thành công ${res.data.imported.length} nhân sự vào hệ thống!`);
        onSuccess();
      } else if (res.data.errors?.length > 0) {
        message.warning(`Có ${res.data.errors.length} dòng cảnh báo khi import`);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi import file Excel');
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
    setSelectedFile(null);
    setFileList([]);
    setPreview(null);
    setResult(null);
    onClose();
  };

  return (
    <Modal
      title="Import & Xem trước danh sách nhân sự từ Excel"
      open={open}
      onCancel={handleClose}
      width={preview || result ? 980 : 640}
      footer={
        result ? (
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setResult(null);
                setPreview(null);
                setSelectedFile(null);
                setFileList([]);
              }}
            >
              Import file khác
            </Button>
            <Button type="primary" onClick={handleClose}>
              Hoàn tất & Đóng
            </Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={handleClose}>Hủy</Button>
            {preview && (
              <Button
                onClick={() => {
                  setPreview(null);
                  setSelectedFile(null);
                  setFileList([]);
                }}
              >
                Chọn lại file khác
              </Button>
            )}
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={loading}
              disabled={!selectedFile && fileList.length === 0}
              onClick={handleUpload}
            >
              {preview ? `Xác nhận Import (${preview.total_rows} nhân sự)` : 'Import vào phần mềm'}
            </Button>
          </Space>
        )
      }
    >
      {!result ? (
        <>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            File Excel hỗ trợ các cột: <strong>Mã NV</strong>, <strong>Họ tên</strong>, <strong>Phòng ban</strong> (mã hoặc tên),{' '}
            <strong>Chức vụ</strong>, <strong>Số Định Danh (CCCD)</strong>, <strong>SĐT</strong>, <strong>Email</strong>,{' '}
            <strong>Nơi làm việc</strong>, <strong>Ngày vào làm</strong> (DD/MM/YYYY).
            <br />
            <Button
              type="link"
              icon={<DownloadOutlined />}
              style={{ padding: 0, marginTop: 4 }}
              onClick={handleDownloadTemplate}
            >
              Tải file mẫu chuẩn
            </Button>
          </Typography.Paragraph>

          <Dragger
            accept=".xlsx,.xls"
            multiple={false}
            fileList={fileList}
            beforeUpload={(file) => {
              const raw = file as unknown as File;
              setFileList([
                {
                  uid: file.uid || '-1',
                  name: file.name,
                  status: 'done',
                  originFileObj: file,
                },
              ]);
              handlePreviewFile(raw);
              return false;
            }}
            onRemove={() => {
              setSelectedFile(null);
              setFileList([]);
              setPreview(null);
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click hoặc kéo thả file Excel vào đây để Xem trước & Import</p>
          </Dragger>

          {previewLoading && (
            <Alert
              type="info"
              showIcon
              message="Đang phân tích và tạo bảng xem trước dữ liệu từ file Excel..."
              style={{ marginTop: 14 }}
            />
          )}

          {preview && (
            <div style={{ marginTop: 16 }}>
              <Alert
                type={preview.errors.length > 0 ? 'warning' : 'success'}
                showIcon
                icon={<EyeOutlined />}
                message={
                  <span>
                    <b>Xem trước dữ liệu từ File Excel:</b> Đã đọc được{' '}
                    <b style={{ color: '#1677ff' }}>{preview.total_rows} nhân sự</b> sẵn sàng nạp vào hệ thống. Bấm nút{' '}
                    <b>"Xác nhận Import ({preview.total_rows} nhân sự)"</b> ở góc dưới bên phải để lưu vào phần mềm.
                  </span>
                }
                style={{ marginBottom: 12 }}
              />

              {preview.errors.length > 0 && (
                <Alert
                  type="error"
                  showIcon
                  message={`Phát hiện ${preview.errors.length} lỗi định dạng cần lưu ý`}
                  description={
                    <ul style={{ margin: 0, paddingLeft: 20, maxHeight: 120, overflowY: 'auto' }}>
                      {preview.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  }
                  style={{ marginBottom: 12 }}
                />
              )}

              <Table
                dataSource={preview.records}
                rowKey="row"
                size="small"
                scroll={{ x: 860, y: 340 }}
                pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ['15', '30', '50', '150'] }}
                columns={[
                  { title: 'Dòng', dataIndex: 'row', width: 60, align: 'center' },
                  {
                    title: 'Mã NV',
                    dataIndex: 'employee_code',
                    width: 100,
                    render: (v: string) => <Tag color="blue">{v || 'Tự động'}</Tag>,
                  },
                  {
                    title: 'Họ và tên',
                    dataIndex: 'full_name',
                    width: 170,
                    render: (v: string) => <Text strong>{v}</Text>,
                  },
                  {
                    title: 'Phòng ban',
                    dataIndex: 'department_code',
                    width: 130,
                    render: (v: string) => <Tag color="purple">{v}</Tag>,
                  },
                  { title: 'Chức vụ', dataIndex: 'position', width: 150 },
                  { title: 'Số CCCD', dataIndex: 'cccd_number', width: 130 },
                  { title: 'Điện thoại', dataIndex: 'phone', width: 115 },
                  { title: 'Email công vụ', dataIndex: 'email', width: 210 },
                ]}
              />
            </div>
          )}
        </>
      ) : (
        <>
          {result.imported?.length > 0 && (
            <Alert
              type="success"
              showIcon
              message={`Đã import thành công ${result.imported.length} nhân sự vào phần mềm (Đồng bộ cả Danh bạ Nhân sự & Hồ sơ Lý lịch BNV)!`}
              style={{ marginBottom: 16 }}
            />
          )}
          {result.errors?.length > 0 && (
            <Alert
              type="error"
              showIcon
              message={`Có ${result.errors.length} dòng lỗi`}
              description={
                <ul style={{ margin: 0, paddingLeft: 20, maxHeight: 140, overflowY: 'auto' }}>
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              }
              style={{ marginBottom: 16 }}
            />
          )}
          {result.imported?.length > 0 && (
            <Table
              dataSource={result.imported}
              columns={[
                { title: 'Dòng Excel', dataIndex: 'row', width: 90, align: 'center' },
                {
                  title: 'Mã NV',
                  dataIndex: 'employee_code',
                  width: 120,
                  render: (v: string) => <Tag color="green">{v}</Tag>,
                },
                {
                  title: 'Họ và tên nhân sự đã nạp',
                  dataIndex: 'full_name',
                  render: (v: string) => <Text strong>{v}</Text>,
                },
              ]}
              rowKey="row"
              size="small"
              scroll={{ y: 340 }}
              pagination={{ pageSize: 20, showSizeChanger: true }}
            />
          )}
        </>
      )}
    </Modal>
  );
}
