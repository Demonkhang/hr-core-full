import { useState } from 'react';
import { Tag, message, Button, Popconfirm } from 'antd';
import { UndoOutlined } from '@ant-design/icons';
import { employeeService } from '@/services/employeeService';
import { EmployeeTable } from '@/components/Employees/EmployeeTable';
import type { Employee } from '@/types/employee';
import { LABELS } from '@/utils/constants';
import type { ColumnsType } from 'antd/es/table';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  resigned: { label: 'Nghỉ việc', color: 'red' },
  retired: { label: 'Nghỉ hưu', color: 'orange' },
  terminated: { label: 'Sa thải', color: 'volcano' },
  contract_expired: { label: 'Hết hợp đồng', color: 'gold' },
};

export function EmployeeInactiveList() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRestore = async (id: string) => {
    try {
      await employeeService.restore(id);
      message.success('Đã khôi phục nhân viên');
      setRefreshKey((k) => k + 1);
    } catch {
      message.error('Không thể khôi phục nhân viên');
    }
  };

  const extraColumns: ColumnsType<Employee> = [
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 140,
      render: (v: string | null) => {
        const s = STATUS_MAP[v || ''];
        return s ? <Tag color={s.color}>{s.label}</Tag> : <Tag color="default">{LABELS.INACTIVE}</Tag>;
      },
    },
    {
      title: 'Hành động', key: 'actions', width: 120,
      render: (_: any, record: Employee) => (
        <Popconfirm title="Khôi phục nhân viên này?" onConfirm={() => handleRestore(record.id)}>
          <Button type="link" size="small" icon={<UndoOutlined />}>Khôi phục</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <EmployeeTable
      key={refreshKey}
      activeOnly={false}
      title="Nhân sự đã nghỉ"
      extraColumns={extraColumns}
      clientFilter={(emps) => emps.filter((e) => e.status && e.status !== 'active')}
    />
  );
}
