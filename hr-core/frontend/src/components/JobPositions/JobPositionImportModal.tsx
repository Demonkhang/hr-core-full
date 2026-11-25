import { useState } from 'react';
import { Modal, Upload, Button, Alert, Typography, Space, Table, Tag, Radio, Spin, message } from 'antd';
import {
  InboxOutlined,
  DownloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload';
import { jobPositionService } from '@/services/jobPositionService';

const { Dragger } = Upload;

interface PreviewRow {
  row: number;
  code: string;
  name: string;
  professional_level: number;
  workplace_name: string;
  required_qualification_level: string;
  required_specialty: string;
  max_headcount: number;
  is_active: boolean;
  description: string;
  status: 'valid' | 'duplicate' | 'error';
  is_duplicate: boolean;
  duplicate_type: 'in_db' | 'in_file' | null;
  message: string;
}

interface PreviewData {
  total_rows: number;
  valid_new_count: number;
  duplicate_count: number;
  error_count: number;
  warnings: string[];
  errors: string[];
  rows: PreviewRow[];
}

interface ImportResult {
  imported_count: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  duplicate_count: number;
  warnings: string[];
  errors: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function JobPositionImportModal({ open, onClose, onSuccess }: Props) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'overwrite'>('skip');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleSelectFile = async (file: File) => {
    const uploadFile: UploadFile = {
      uid: (file as any).uid || `${Date.now()}`,
      name: file.name,
      status: 'done',
      size: file.size,
      type: file.type,
      originFileObj: file as any,
    };
    setFileList([uploadFile]);
    setSelectedFile(file);
    setResult(null);
    setPreviewLoading(true);
    try {
      const data = await jobPositionService.previewImport(file);
      setPreview(data);
      if (data.duplicate_count > 0) {
        message.warning(`Phát hiện ${data.duplicate_count} vị trí việc làm bị trùng lặp!`);
      }
    } catch (err: any) {
      setPreview(null);
      message.error(err?.response?.data?.detail || 'Không thể đọc xem trước file Excel');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleUpload = async () => {
    const rawFile = selectedFile || (fileList[0]?.originFileObj as File | undefined) || (fileList[0] as unknown as File | undefined);
    if (!rawFile) {
      message.warning('Vui lòng chọn file Excel trước khi nhập');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await jobPositionService.import(rawFile, duplicateAction);
      setResult(data);
      if (data.duplicate_count > 0) {
        message.warning(
          `Đã xử lý xong! Cảnh báo có ${data.duplicate_count} vị trí bị trùng (Tạo mới: ${data.created_count}, Cập nhật: ${data.updated_count}, Bỏ qua: ${data.skipped_count})`
        );
      } else if (data.imported_count > 0) {
        message.success(
          `Đã nhập thành công ${data.imported_count} vị trí việc làm (Tạo mới: ${data.created_count}, Cập nhật: ${data.updated_count})`
        );
      }
      if (data.imported_count > 0) {
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
      link.setAttribute('download', 'vitrivieclam_mau_export.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Không thể tải file Excel');
    }
  };

  const handleClose = () => {
    setFileList([]);
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setDuplicateAction('skip');
    onClose();
  };

  const previewColumns = [
    {
      title: 'Dòng',
      dataIndex: 'row',
      width: 65,
      align: 'center' as const,
    },
    {
      title: 'Mã',
      dataIndex: 'code',
      width: 85,
      render: (val: string) => <Typography.Text strong>{val || '-'}</Typography.Text>,
    },
    {
      title: 'Tên vị trí việc làm',
      dataIndex: 'name',
      width: 210,
    },
    {
      title: 'Bậc',
      dataIndex: 'professional_level',
      width: 75,
      align: 'center' as const,
      render: (lvl: number) => <Tag color="blue">Bậc {lvl}</Tag>,
    },
    {
      title: 'Nơi làm việc',
      dataIndex: 'workplace_name',
      width: 120,
      render: (val: string) => val || '-',
    },
    {
      title: 'Định biên tối đa',
      dataIndex: 'max_headcount',
      width: 120,
      align: 'center' as const,
      render: (val: number) => <Tag color="purple">{val}</Tag>,
    },
    {
      title: 'Trạng thái kiểm tra',
      key: 'check_status',
      width: 260,
      render: (_: unknown, record: PreviewRow) => {
        if (record.status === 'error') {
          return (
            <Tag icon={<CloseCircleOutlined />} color="error" style={{ whiteSpace: 'normal' }}>
              {record.message}
            </Tag>
          );
        }
        if (record.is_duplicate) {
          return (
            <Tag icon={<WarningOutlined />} color="warning" style={{ whiteSpace: 'normal', padding: '2px 6px' }}>
              <strong>Cảnh báo trùng:</strong> {record.message}
            </Tag>
          );
        }
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Hợp lệ (Vị trí mới)
          </Tag>
        );
      },
    },
  ];

  return (
    <Modal
      title="Nhập / Đồng bộ Vị trí việc làm từ file Xuất Excel"
      open={open}
      onCancel={handleClose}
      footer={
        result ? (
          <Space>
            <Button
              onClick={() => {
                setResult(null);
                if (selectedFile) {
                  handleSelectFile(selectedFile);
                }
              }}
            >
              Quay lại xem trước
            </Button>
            <Button type="primary" onClick={handleClose}>
              Đóng
            </Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={handleClose}>Hủy</Button>
            <Button
              type="primary"
              loading={loading}
              disabled={!selectedFile && fileList.length === 0}
              onClick={handleUpload}
            >
              {preview && preview.duplicate_count > 0
                ? duplicateAction === 'skip'
                  ? `Nhập ${preview.valid_new_count} vị trí mới (Bỏ qua ${preview.duplicate_count} dòng trùng)`
                  : `Nhập & Cập nhật tất cả (${preview.valid_new_count + preview.duplicate_count} dòng)`
                : 'Xác nhận Nhập Excel'}
            </Button>
          </Space>
        )
      }
      width={980}
    >
      {!result ? (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Sử dụng trực tiếp file Xuất Excel làm file Nhập (Import)"
            description={
              <div>
                Bạn có thể bấm nút <strong>Xuất Excel</strong> ở ngoài trang Vị trí việc làm (hoặc tải bên dưới), chỉnh sửa / thêm dòng mới rồi tải trực tiếp file đó lên đây. Hệ thống tự động nhận diện đầy đủ các cột:{' '}
                <strong>Mã vị trí việc làm</strong>, <strong>Tên vị trí việc làm</strong>, <strong>Bậc nghề nghiệp</strong>,{' '}
                <strong>Nơi làm việc</strong>, <strong>Bằng cấp (trình độ)</strong>, <strong>Chuyên môn</strong>,{' '}
                <strong>Số lượng tối đa (Định biên)</strong>, <strong>Trạng thái</strong>, <strong>Mô tả</strong>.
                <div style={{ marginTop: 4 }}>
                  <Button
                    type="link"
                    icon={<DownloadOutlined />}
                    style={{ padding: 0, height: 'auto' }}
                    onClick={handleDownloadTemplate}
                  >
                    Tải file Excel hiện tại (Dùng làm file mẫu Import)
                  </Button>
                </div>
              </div>
            }
          />

          <Dragger
            accept=".xlsx,.xls"
            multiple={false}
            fileList={fileList}
            beforeUpload={(file) => {
              handleSelectFile(file as File);
              return false;
            }}
            onRemove={() => {
              setFileList([]);
              setSelectedFile(null);
              setPreview(null);
              setResult(null);
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click hoặc kéo thả file Excel (file Xuất Excel) vào đây</p>
            <p className="ant-upload-hint">Hệ thống sẽ tự động kiểm tra và cảnh báo nếu có vị trí việc làm bị trùng lặp</p>
          </Dragger>

          {previewLoading && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Spin tip="Đang phân tích file Excel và kiểm tra trùng lặp..." />
            </div>
          )}

          {preview && !previewLoading && (
            <div style={{ marginTop: 16 }}>
              <Space wrap style={{ marginBottom: 12 }}>
                <Tag color="default">Tổng số dòng: {preview.total_rows}</Tag>
                <Tag color="success">Vị trí mới (Hợp lệ): {preview.valid_new_count}</Tag>
                <Tag color={preview.duplicate_count > 0 ? 'warning' : 'default'}>
                  Phát hiện trùng lặp: {preview.duplicate_count}
                </Tag>
                {preview.error_count > 0 && <Tag color="error">Dòng lỗi: {preview.error_count}</Tag>}
              </Space>

              {preview.duplicate_count > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  style={{ marginBottom: 14 }}
                  message={`Cảnh báo: Phát hiện ${preview.duplicate_count} vị trí việc làm bị trùng lặp!`}
                  description={
                    <div>
                      <ul style={{ margin: '4px 0 10px 0', paddingLeft: 20, maxHeight: 130, overflowY: 'auto' }}>
                        {preview.warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                      <div
                        style={{
                          background: '#fffbe6',
                          border: '1px solid #ffe58f',
                          borderRadius: 6,
                          padding: '8px 12px',
                        }}
                      >
                        <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
                          Chọn cách xử lý đối với các vị trí bị trùng trên hệ thống:
                        </Typography.Text>
                        <Radio.Group
                          value={duplicateAction}
                          onChange={(e) => setDuplicateAction(e.target.value)}
                        >
                          <Space direction="vertical" size={4}>
                            <Radio value="skip">
                              <strong>Bỏ qua các vị trí bị trùng</strong> (An toàn — chỉ thêm mới các vị trí chưa tồn tại)
                            </Radio>
                            <Radio value="overwrite">
                              <strong>Cập nhật đè thông tin từ file Excel</strong> (Cập nhật lại định biên tối đa, nơi làm việc, bằng cấp... cho các vị trí trùng)
                            </Radio>
                          </Space>
                        </Radio.Group>
                      </div>
                    </div>
                  }
                />
              )}

              {preview.errors.length > 0 && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={`Có ${preview.errors.length} dòng thiếu thông tin bắt buộc`}
                  description={
                    <ul style={{ margin: 0, paddingLeft: 20, maxHeight: 110, overflowY: 'auto' }}>
                      {preview.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  }
                />
              )}

              <Table
                dataSource={preview.rows}
                columns={previewColumns}
                rowKey="row"
                size="small"
                pagination={{ pageSize: 8, showSizeChanger: false }}
                scroll={{ x: 860, y: 280 }}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <Alert
            type={result.imported_count > 0 ? 'success' : 'info'}
            showIcon
            message="Kết quả xử lý file Excel Vị trí việc làm"
            description={
              <div>
                <div>• Tạo mới: <strong>{result.created_count}</strong> vị trí việc làm</div>
                <div>• Cập nhật đè: <strong>{result.updated_count}</strong> vị trí việc làm</div>
                <div>• Bỏ qua do trùng lặp: <strong>{result.skipped_count}</strong> vị trí việc làm</div>
              </div>
            }
            style={{ marginBottom: 16 }}
          />

          {result.warnings?.length > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              message={`Cảnh báo: Có ${result.warnings.length} vị trí việc làm bị trùng lặp trong file`}
              description={
                <ul style={{ margin: 0, paddingLeft: 20, maxHeight: 180, overflowY: 'auto' }}>
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          {result.errors?.length > 0 && (
            <Alert
              type="error"
              showIcon
              message={`Có ${result.errors.length} lỗi dữ liệu`}
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
