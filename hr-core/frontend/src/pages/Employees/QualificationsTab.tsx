import { useEffect, useState } from 'react';
import {
  Table, Button, message, Space, Tag, Form, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import { employeeProcessService } from '@/services/employeeProcessService';
import type { Qualification, QualificationCreate } from '@/types/employeeProcess';
import { PermGate } from '@/components/Common/PermGate';
import { ERROR_MESSAGES, PERMISSIONS } from '@/utils/constants';
import dayjs from 'dayjs';
import { EditableTableCell } from '@/components/Common/EditableTableCell';

const QUAL_NEW_ID = '__qual_new__';

const CREDENTIAL_TYPE_OPTIONS = [
  { label: 'Bằng cấp', value: 'degree' },
  { label: 'Chứng chỉ', value: 'certificate' },
];

const CLASSIFICATION_OPTIONS = [
  { label: 'Xuất sắc', value: 'Xuất sắc' },
  { label: 'Giỏi', value: 'Giỏi' },
  { label: 'Khá', value: 'Khá' },
  { label: 'Trung bình', value: 'Trung bình' },
];

const TRAINING_FORM_OPTIONS = [
  { label: 'Chính quy', value: 'Chính quy' },
  { label: 'Tại chức', value: 'Tại chức' },
  { label: 'Từ xa', value: 'Từ xa' },
];

export function QualificationsTab({ employeeId }: { employeeId: string }) {
  const [data, setData] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [editingKey, setEditingKey] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditing = (record: Qualification) => record.id === editingKey;

  const fetchData = async () => {
    setLoading(true);
    try {
      const d = await employeeProcessService.getQualifications(employeeId);
      setData(d);
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [employeeId]);

  const openEdit = (record: Qualification) => {
    form.setFieldsValue({ ...record });
    setEditingKey(record.id);
  };

  const cancelEdit = () => {
    if (editingKey === QUAL_NEW_ID) {
      setData(data.filter(r => r.id !== QUAL_NEW_ID));
    }
    setEditingKey('');
  };

  const openAdd = () => {
    const newRecord: Qualification = {
      id: QUAL_NEW_ID, employee_id: employeeId,
      name: '', issuing_body: '', issue_date: dayjs().format('YYYY-MM-DD'),
      expiry_date: '', credential_type: 'degree',
      classification: '', major: '', certificate_number: '',
      training_form: '', notes: '',
      employee_name: null, created_at: null, updated_at: null,
    };
    setData([newRecord, ...data]);
    form.resetFields();
    form.setFieldsValue({ credential_type: 'degree', issue_date: dayjs().format('YYYY-MM-DD') });
    setEditingKey(QUAL_NEW_ID);
  };

  const saveEdit = async (record: Qualification) => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: QualificationCreate = {
        name: values.name,
        issuing_body: values.issuing_body || undefined,
        issue_date: values.issue_date || dayjs().format('YYYY-MM-DD'),
        expiry_date: values.expiry_date || undefined,
        credential_type: values.credential_type,
        classification: values.classification || undefined,
        major: values.major || undefined,
        certificate_number: values.certificate_number || undefined,
        training_form: values.training_form || undefined,
        notes: values.notes || undefined,
      };
      if (record.id === QUAL_NEW_ID) {
        await employeeProcessService.createQualification(employeeId, payload);
        message.success('Thêm trình độ chuyên môn thành công');
      } else {
        await employeeProcessService.updateQualification(employeeId, record.id, payload);
        message.success('Cập nhật trình độ chuyên môn thành công');
      }
      setEditingKey('');
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (recordId: string) => {
    try {
      await employeeProcessService.deleteQualification(employeeId, recordId);
      message.success('Đã xoá bản ghi');
      fetchData();
    } catch {
      message.error('Không thể xoá bản ghi');
    }
  };

  const defaultColumns = [
    {
      title: 'Tên bằng cấp/CC', dataIndex: 'name', key: 'name', width: 200,
      sorter: (a: Qualification, b: Qualification) => (a.name || '').localeCompare(b.name || ''),
      editable: true, inputType: 'text',
      render: (v: string) => v || '-',
    },
    {
      title: 'Loại', dataIndex: 'credential_type', key: 'credential_type', width: 110,
      sorter: (a: Qualification, b: Qualification) => (a.credential_type || '').localeCompare(b.credential_type || ''),
      editable: true, inputType: 'select', inputOptions: CREDENTIAL_TYPE_OPTIONS,
      render: (v: string) => {
        const opt = CREDENTIAL_TYPE_OPTIONS.find(o => o.value === v);
        return opt ? <Tag color={v === 'degree' ? 'blue' : 'green'}>{opt.label}</Tag> : '-';
      },
    },
    {
      title: 'Nơi cấp', dataIndex: 'issuing_body', key: 'issuing_body', width: 180,
      sorter: (a: Qualification, b: Qualification) => (a.issuing_body || '').localeCompare(b.issuing_body || ''),
      editable: true, inputType: 'text',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Ngày cấp', dataIndex: 'issue_date', key: 'issue_date', width: 130,
      editable: true, inputType: 'date',
      defaultSortOrder: 'descend' as const,
      sorter: (a: Qualification, b: Qualification) => dayjs(a.issue_date).unix() - dayjs(b.issue_date).unix(),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Xếp loại', dataIndex: 'classification', key: 'classification', width: 120,
      sorter: (a: Qualification, b: Qualification) => (a.classification || '').localeCompare(b.classification || ''),
      editable: true, inputType: 'select', inputOptions: CLASSIFICATION_OPTIONS,
      render: (v: string | null) => v ? <Tag>{v}</Tag> : '-',
    },
    {
      title: 'Chuyên ngành', dataIndex: 'major', key: 'major', width: 180,
      sorter: (a: Qualification, b: Qualification) => (a.major || '').localeCompare(b.major || ''),
      editable: true, inputType: 'text',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Số hiệu VB', dataIndex: 'certificate_number', key: 'certificate_number', width: 130,
      sorter: (a: Qualification, b: Qualification) => (a.certificate_number || '').localeCompare(b.certificate_number || ''),
      editable: true, inputType: 'text',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Hình thức', dataIndex: 'training_form', key: 'training_form', width: 130,
      sorter: (a: Qualification, b: Qualification) => (a.training_form || '').localeCompare(b.training_form || ''),
      editable: true, inputType: 'select', inputOptions: TRAINING_FORM_OPTIONS,
      render: (v: string | null) => {
        const opt = TRAINING_FORM_OPTIONS.find(o => o.value === v);
        return opt ? opt.label : '-';
      },
    },
    {
      title: 'Hạn SD', dataIndex: 'expiry_date', key: 'expiry_date', width: 130,
      sorter: (a: Qualification, b: Qualification) => (a.expiry_date || '').localeCompare(b.expiry_date || ''),
      editable: true, inputType: 'date',
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Ghi chú', dataIndex: 'notes', key: 'notes', ellipsis: true,
      sorter: (a: Qualification, b: Qualification) => (a.notes || '').localeCompare(b.notes || ''),
      editable: true, inputType: 'text',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Hành động', key: 'actions', width: 110, fixed: 'right' as const,
      render: (_: any, record: Qualification) => {
        if (isEditing(record)) {
          return (
            <Space>
              <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => saveEdit(record)} loading={saving} />
              <Button size="small" icon={<CloseOutlined />} onClick={cancelEdit} disabled={saving} />
            </Space>
          );
        }
        return (
          <PermGate perms={[PERMISSIONS.CAN_MANAGE_EMPLOYEES]}>
            <Space>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} disabled={editingKey !== ''} />
              <Popconfirm title="Xoá bản ghi này?" onConfirm={() => deleteRecord(record.id)}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={editingKey !== ''} />
              </Popconfirm>
            </Space>
          </PermGate>
        );
      },
    },
  ];

  const mergedColumns = defaultColumns.map(col => {
    if (!('editable' in col) || !col.editable) return col;
    return {
      ...col,
      onCell: (record: Qualification) => ({
        record,
        inputType: (col as any).inputType,
        inputOptions: (col as any).inputOptions,
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record),
      }),
    };
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_EMPLOYEES]}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={editingKey !== ''}>
            Thêm
          </Button>
        </PermGate>
      </div>
      <Form form={form} component={false}>
        <Table
          components={{ body: { cell: EditableTableCell } }}
          columns={mergedColumns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Chưa có trình độ chuyên môn nào' }}
        />
      </Form>
    </div>
  );
}
