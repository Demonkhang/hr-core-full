import { useEffect, useState } from 'react';
import { Spin, Typography, Row, Col, Select, message, Tag, Avatar, Space } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { departmentService } from '@/services/departmentService';
import { dashboardService } from '@/services/dashboardService';
import { StatsCardGrid } from '@/components/Dashboard/StatsCardGrid';
import { QuickActionsBar } from '@/components/Dashboard/QuickActionsBar';
import { DepartmentPieChart } from '@/components/Dashboard/DepartmentPieChart';
import { WorkplaceBarChart } from '@/components/Dashboard/WorkplaceBarChart';
import { QualificationPieChart } from '@/components/Dashboard/QualificationPieChart';
import { HeadcountCapacityCard } from '@/components/Dashboard/HeadcountCapacityCard';
import { RecentActivitiesCard } from '@/components/Dashboard/RecentActivitiesCard';
import { RecentHiresCard } from '@/components/Dashboard/RecentHiresCard';
import { ExpiringContractsCard } from '@/components/Dashboard/ExpiringContractsCard';
import { ImportModal } from '@/components/Employees/ImportModal';

import type { DashboardData } from '@/types/dashboard';
import type { Department } from '@/types/department';

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string[]>([]);
  const [qualSource, setQualSource] = useState<string>('auto');
  const [importOpen, setImportOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await dashboardService.getDashboardData({
        department_id: selectedDept.length > 0 ? selectedDept : undefined,
        qual_source: qualSource,
      });
      setData(result);
    } catch {
      message.error('Không thể tải dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    departmentService.list(true).then(setDepartments).catch(() => console.warn('Failed to load departments for filter'));
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedDept, qualSource]);

  if (loading && !data) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div>
      {/* Top Banner & Filter */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space size={12} align="center">
            <Avatar size={42} icon={<UserOutlined />} style={{ backgroundColor: '#7c3aed' }} />
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                Xin chào, {user?.full_name || 'Quản trị viên'}! 👋
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Tổng quan tình hình nhân sự và hoạt động quản trị hệ thống HR-Core
              </Typography.Text>
            </div>
            {user?.is_super_admin && <Tag color="purple">Super Admin</Tag>}
          </Space>
        </Col>

        <Col>
          <Select
            mode="multiple"
            allowClear
            placeholder="Lọc theo Phòng ban"
            style={{ minWidth: 240 }}
            value={selectedDept.length > 0 ? selectedDept : undefined}
            onChange={setSelectedDept}
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
          />
        </Col>
      </Row>

      {/* Quick Actions Shortcuts */}
      <QuickActionsBar onOpenImport={() => setImportOpen(true)} />

      {/* KPI Cards Grid */}
      {data && <StatsCardGrid stats={data.stats} />}

      {/* Row 1: Department Distribution & Workplace Distribution */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={12}>
          <DepartmentPieChart data={data?.department_distribution ?? []} />
        </Col>
        <Col xs={24} lg={12}>
          <WorkplaceBarChart data={data?.workplace_distribution ?? []} />
        </Col>
      </Row>

      {/* Row 2: Headcount Capacity & Qualification Distribution */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={14}>
          <HeadcountCapacityCard data={data?.headcount_capacity ?? []} />
        </Col>
        <Col xs={24} lg={10}>
          <QualificationPieChart
            data={data?.qualification_distribution ?? []}
            onSourceChange={setQualSource}
          />
        </Col>
      </Row>

      {/* Expiring Contracts Alert Card */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        <Col xs={24}>
          <ExpiringContractsCard />
        </Col>
      </Row>

      {/* Row 3: Recent New Hires & Recent Audit Activity */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={12}>
          <RecentHiresCard data={data?.recent_hires ?? []} />
        </Col>
        <Col xs={24} lg={12}>
          <RecentActivitiesCard data={data?.recent_activities ?? []} />
        </Col>
      </Row>


      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
