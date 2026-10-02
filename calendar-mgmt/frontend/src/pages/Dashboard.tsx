import { useEffect, useState } from 'react';
import { Spin, Typography, Row, Select, DatePicker, Empty, message } from 'antd';
import { SafeCol } from '@/components/Common/SafeCol';
import dayjs from 'dayjs';
import { useAuthStore } from '@/store/authStore';
import { departmentService } from '@/services/departmentService';
import { dashboardService } from '@/services/dashboardService';
import { StatsCardGrid } from '@/components/Dashboard/StatsCardGrid';
import { StatusPieChart } from '@/components/Dashboard/StatusPieChart';
import { MonthlyTrendChart } from '@/components/Dashboard/MonthlyTrendChart';
import { OvertimeBarChart } from '@/components/Dashboard/OvertimeBarChart';
import type { DashboardData, OvertimeByDepartment } from '@/types/dashboard';
import type { Department } from '@/types/department';

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'));

  useEffect(() => {
    departmentService.list(true).then(setDepartments).catch(() => console.warn('Failed to load departments for filter'));
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const result = await dashboardService.getDashboardData({
          month: selectedMonth,
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
  }, [selectedMonth, selectedDept]);

  if (loading && !data) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  const otByDept: OvertimeByDepartment[] = data?.overtime_by_department ?? [];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Text type="secondary">
          Chào mừng trở lại, {user?.full_name || 'bạn'}!
        </Typography.Text>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Select
            mode="multiple"
            allowClear
            placeholder="Tất cả phòng ban"
            style={{ minWidth: 220 }}
            value={selectedDept.length > 0 ? selectedDept : undefined}
            onChange={setSelectedDept}
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
          />
          <DatePicker
            picker="month"
            allowClear={false}
            value={dayjs(selectedMonth)}
            onChange={(d: dayjs.Dayjs | null) => d && setSelectedMonth(d.format('YYYY-MM'))}
          />
        </div>
      </div>

      {data && <StatsCardGrid stats={data.stats} />}

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <SafeCol xs={24} lg={12}>
          {data?.schedule_by_status ? <StatusPieChart data={data.schedule_by_status} /> : <Empty description="Không có dữ liệu lịch trực" />}
        </SafeCol>
        <SafeCol xs={24} lg={12}>
          {otByDept.length > 0 ? <OvertimeBarChart data={otByDept} /> : <Empty description="Không có dữ liệu tăng ca" />}
        </SafeCol>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <SafeCol xs={24} lg={24}>
          {data?.monthly_trend && data.monthly_trend.length > 0
            ? <MonthlyTrendChart data={data.monthly_trend} />
            : <Empty description="Không có dữ liệu xu hướng" />}
        </SafeCol>
      </Row>
    </div>
  );
}
