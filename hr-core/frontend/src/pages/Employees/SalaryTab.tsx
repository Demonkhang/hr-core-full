import { useEffect, useState } from 'react';
import {
  Table, Button, message, Space, Tag, Form, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import { employeeProcessService } from '@/services/employeeProcessService';
import type { SalaryHistory, SalaryHistoryCreate } from '@/types/employeeProcess';
import { PermGate } from '@/components/Common/PermGate';
import { ERROR_MESSAGES, PERMISSIONS } from '@/utils/constants';
import dayjs from 'dayjs';
import { EditableTableCell } from '@/components/Common/EditableTableCell';

const SALARY_NEW_ID = '__salary_new__';

export function SalaryTab({ employeeId }: { employeeId: string }) {
  const [data, setData] = useState<SalaryHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [editingKey, setEditingKey] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditing = (record: SalaryHistory) => record.id === editingKey;

  const fetchData = async () => {
    setLoading(true);
    try {
      const d = await employeeProcessService.getSalaryHistory(employeeId);
      setData(d);
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [employeeId]);

  const openEdit = (record: SalaryHistory) => {
    form.setFieldsValue({ ...record });
    setEditingKey(record.id);
  };

  const cancelEdit = () => {
    if (editingKey === SALARY_NEW_ID) {
      setData(data.filter(r => r.id !== SALARY_NEW_ID));
    }
    setEditingKey('');
  };

  const openAdd = () => {
    const newRecord: SalaryHistory = {
      id: SALARY_NEW_ID, employee_id: employeeId,
      coefficient: 0, allowance_coefficient: 0,
      effective_date: dayjs().format('YYYY-MM-DD'),
      decision_number: '', notes: '',
      employee_name: null, created_at: null, updated_at: null,
    };
    setData([newRecord, ...data]);
    form.resetFields();
    form.setFieldsValue({ coefficient: 0, allowance_coefficient: 0, effective_date: dayjs().format('YYYY-MM-DD') });
    setEditingKey(SALARY_NEW_ID);
  };

  const saveEdit = async (record: SalaryHistory) => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: SalaryHistoryCreate = {
        coefficient: values.coefficient,
        allowance_coefficient: values.allowance_coefficient || 0,
        effective_date: values.effective_date || dayjs().format('YYYY-MM-DD'),
        decision_number: values.decision_number || undefined,
        notes: values.notes || undefined,
      };
      if (record.id === SALARY_NEW_ID) {
        await employeeProcessService.createSalaryHistory(employeeId, payload);
        message.success('Thêm quá trình lương thành công');
      } else {
        await employeeProcessService.updateSalaryHistory(employeeId, record.id, payload);
        message.success('Cập nhật quá trình lương thành công');
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
      await employeeProcessService.deleteSalaryHistory(employeeId, recordId);
      message.success('Đã xoá bản ghi');
      fetchData();
    } catch {
      message.error('Không thể xoá bản ghi');
    }
  };

  const defaultColumns = [
    {
      title: 'Ngày hiệu lực', dataIndex: 'effective_date', key: 'effective_date', width: 160,
      editable: true, inputType: 'date',
      defaultSortOrder: 'descend' as const,
      sorter: (a: SalaryHistory, b: SalaryHistory) => dayjs(a.effective_date).unix() - dayjs(b.effective_date).unix(),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Hệ số lương', dataIndex: 'coefficient', key: 'coefficient', width: 130,
      sorter: (a: SalaryHistory, b: SalaryHistory) => (a.coefficient || 0) - (b.coefficient || 0),
      editable: true, inputType: 'number',
      render: (v: any) => <Tag color="blue">{Number(v).toFixed(2)}</Tag>,
    },
    {
      title: 'Hệ số phụ cấp', dataIndex: 'allowance_coefficient', key: 'allowance_coefficient', width: 140,
      sorter: (a: SalaryHistory, b: SalaryHistory) => (a.allowance_coefficient || 0) - (b.allowance_coefficient || 0),
      editable: true, inputType: 'number',
      render: (v: any) => v && Number(v) ? <Tag color="orange">{Number(v).toFixed(2)}</Tag> : '-',
    },
    {
      title: 'Số quyết định', dataIndex: 'decision_number', key: 'decision_number', width: 150,
      sorter: (a: SalaryHistory, b: SalaryHistory) => (a.decision_number || '').localeCompare(b.decision_number || ''),
      editable: true, inputType: 'text',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Ghi chú', dataIndex: 'notes', key: 'notes', ellipsis: true,
      sorter: (a: SalaryHistory, b: SalaryHistory) => (a.notes || '').localeCompare(b.notes || ''),
      editable: true, inputType: 'text',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Hành động', key: 'actions', width: 110,
      render: (_: any, record: SalaryHistory) => {
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
      onCell: (record: SalaryHistory) => ({
        record,
        inputType: (col as any).inputType,
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
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Chưa có quá trình lương nào' }}
        />
      </Form>
    </div>
  );
}
