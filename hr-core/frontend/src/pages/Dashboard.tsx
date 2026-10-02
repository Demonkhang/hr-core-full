import { useEffect, useState } from 'react';
import { Spin, Typography, Row, Col, Select, Empty, message } from 'antd';
import { useAuthStore } from '@/store/authStore';
import { departmentService } from '@/services/departmentService';
import { dashboardService } from '@/services/dashboardService';
import { StatsCardGrid } from '@/components/Dashboard/StatsCardGrid';
import { DepartmentPieChart } from '@/components/Dashboard/DepartmentPieChart';
import { QualificationPieChart } from '@/components/Dashboard/QualificationPieChart';
import type { DepartmentDistribution, QualificationDistribution } from '@/types/dashboard';
import type { Department } from '@/types/department';

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string[]>([]);

  useEffect(() => {
    departmentService.list(true).then(setDepartments).catch(() => console.warn('Failed to load departments for filter'));
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const result = await dashboardService.getDashboardData({
          department_id: selectedDept.length > 0 ? selectedDept : undefined,
        });
        setData(result);
      } catch {
        message.error('Không thể tải dữ liệu dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedDept]);

  if (loading && !data) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  const deptDist: DepartmentDistribution[] = data?.department_distribution ?? [];
  const qualDist: QualificationDistribution[] = data?.qualification_distribution ?? [];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Typography.Text type="secondary">
            Chào mừng trở lại, {user?.full_name || 'bạn'}!
          </Typography.Text>
        </Col>
        <Col>
          <Select
            mode="multiple"
            allowClear
            placeholder="Tất cả phòng ban"
            style={{ minWidth: 220 }}
            value={selectedDept.length > 0 ? selectedDept : undefined}
            onChange={setSelectedDept}
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
          />
        </Col>
      </Row>

      {data && <StatsCardGrid stats={data.stats} />}

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          {deptDist.length > 0 ? <DepartmentPieChart data={deptDist} /> : <Empty description="Không có dữ liệu phòng ban" />}
        </Col>
        <Col xs={24} lg={12}>
          {qualDist.length > 0 ? <QualificationPieChart data={qualDist} /> : <Empty description="Không có dữ liệu trình độ" />}
        </Col>
      </Row>
    </div>
  );
}
