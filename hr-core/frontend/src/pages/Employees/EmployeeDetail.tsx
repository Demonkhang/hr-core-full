import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Button, message, Tabs, Tag, Descriptions, Spin, Space,
} from 'antd';
import {
  ArrowLeftOutlined, DollarOutlined, ReadOutlined, SolutionOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { employeeService } from '@/services/employeeService';
import { jobPositionService } from '@/services/jobPositionService';
import type { Employee } from '@/types/employee';
import type { JobPosition } from '@/types/jobPosition';
import { ERROR_MESSAGES } from '@/utils/constants';
import { useSetPageTitle } from '@/components/Layout/AppLayout';
import { SalaryTab } from './SalaryTab';
import { QualificationsTab } from './QualificationsTab';
import { ContractsTab } from './ContractsTab';

export function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [jobPosition, setJobPosition] = useState<JobPosition | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEmployee = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const emp = await employeeService.get(id);
      setEmployee(emp);
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  useEffect(() => {
    if (employee?.job_position_id) {
      jobPositionService.get(employee.job_position_id)
        .then(setJobPosition)
        .catch(() => setJobPosition(null));
    } else {
      setJobPosition(null);
    }
  }, [employee]);

  useSetPageTitle(employee ? `${employee.full_name} - ${employee.position_name || employee.position || 'Nhân viên'}` : 'Đang tải...');

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/employees')}>Quay lại</Button>
      </div>

      {employee && (
        <Descriptions
          bordered
          size="small"
          style={{ marginBottom: 24 }}
          column={3}
        >
          <Descriptions.Item label="Phòng ban">{employee.department_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Chức vụ">{employee.position_name || employee.position || '-'}</Descriptions.Item>
          <Descriptions.Item label="Vị trí việc làm">
            {jobPosition ? (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space size={6} wrap>
                  <SolutionOutlined style={{ color: '#7c3aed' }} />
                  <span style={{ fontWeight: 500 }}>{jobPosition.name}</span>
                  <Tag color="blue">Bậc {jobPosition.professional_level}</Tag>
                </Space>
                <Space size={4} wrap>
                  {jobPosition.required_qualification_level && <Tag color="purple">{jobPosition.required_qualification_level}</Tag>}
                  {jobPosition.required_specialty && <Tag>{jobPosition.required_specialty}</Tag>}
                </Space>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Quy hoạch biên chế: {jobPosition.current_headcount}/{jobPosition.max_headcount} người
                </span>
              </Space>
            ) : employee.job_position_name ? (
              employee.job_position_name
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Nơi làm việc">{employee.workplace_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Ngày vào làm">{employee.hire_date ? dayjs(employee.hire_date).format('DD/MM/YYYY') : '-'}</Descriptions.Item>
          <Descriptions.Item label="SĐT">{employee.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="Email">{employee.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            {employee.is_active ? <Tag color="green">Hoạt động</Tag> : <Tag color="red">Ngừng</Tag>}
          </Descriptions.Item>
        </Descriptions>
      )}

      <Tabs
        defaultActiveKey="salary"
        items={[
          {
            key: 'contracts',
            label: <span><FileTextOutlined /> Hợp đồng lao động</span>,
            children: <ContractsTab employeeId={id!} />,
          },
          {
            key: 'salary',
            label: <span><DollarOutlined /> Quá trình lương</span>,
            children: <SalaryTab employeeId={id!} />,
          },
          {
            key: 'qualifications',
            label: <span><ReadOutlined /> Trình độ chuyên môn</span>,
            children: <QualificationsTab employeeId={id!} />,
          },
        ]}

      />
    </div>
  );
}
