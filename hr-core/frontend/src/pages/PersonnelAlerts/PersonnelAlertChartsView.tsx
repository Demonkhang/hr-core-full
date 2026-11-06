import { useMemo, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Select,
  Space,
  Tag,
  Button,
  Progress,
  Table,
  Switch,
  Tooltip,
  Empty,
  message,
} from 'antd';
import {
  PieChartOutlined,
  BarChartOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  DownloadOutlined,
  FilterOutlined,
  ArrowUpOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ComposedChart,
  Line,
} from 'recharts';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import type { PersonnelAlertItem, PersonnelAlertKpiSummary } from '@/types/personnelAlert';
import { useTheme } from '@/context/ThemeContext';

const { Text, Title } = Typography;

// Mức lương cơ sở nhà nước theo Nghị định 73/2024/NĐ-CP (2.340.000 VNĐ/tháng)
const BASE_SALARY_VND = 2340000;

const CATEGORY_COLORS: Record<string, string> = {
  SALARY_REGULAR: '#3b82f6',
  SALARY_EXCEED: '#8b5cf6',
  SALARY_EARLY: '#06b6d4',
  REAPPOINTMENT: '#4f46e5',
  EXTEND_TO_RETIREMENT: '#f97316',
};

const WORKFLOW_COLORS: Record<string, string> = {
  WAITING: '#10b981',
  IN_PROGRESS: '#3b82f6',
  PENDING_DECISION: '#ef4444',
  EXTENDED: '#a855f7',
  ON_HOLD: '#f59e0b',
  REJECTED: '#64748b',
  COMPLETED: '#14b8a6',
};

interface PersonnelAlertChartsViewProps {
  items: PersonnelAlertItem[];
  summary: PersonnelAlertKpiSummary | null;
  onDrillDown: (filters: {
    category?: string;
    status?: string;
    dept?: string;
    milestone?: string;
  }) => void;
}

export function PersonnelAlertChartsView({
  items,
  onDrillDown,
}: PersonnelAlertChartsViewProps) {
  const { isDark } = useTheme();
  const [deptFilter, setDeptFilter] = useState<string | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [includeClosed, setIncludeClosed] = useState<boolean>(true);

  const departments = useMemo(() => {
    const s = new Set(items.map((i) => i.department_name).filter(Boolean) as string[]);
    return Array.from(s);
  }, [items]);

  const scopedItems = useMemo(() => {
    return items.filter((item) => {
      if (!includeClosed && (item.workflow_status === 'COMPLETED' || item.workflow_status === 'REJECTED')) {
        return false;
      }
      if (deptFilter && item.department_name !== deptFilter) return false;
      if (categoryFilter && item.alert_category !== categoryFilter) return false;
      return true;
    });
  }, [items, deptFilter, categoryFilter, includeClosed]);

  // =========================================================================
  // TẦNG 1: TÍNH TOÁN 4 CHỈ SỐ QUẢN TRỊ CẤP CAO (EXECUTIVE KPIs)
  // =========================================================================
  const kpiMetrics = useMemo(() => {
    let totalActive = 0;
    let onTimeCount = 0;
    let overdueUnextendedCount = 0;
    let extendedOrHoldCount = 0;
    let delayedByDisciplineCount = 0;
    let totalDelayedMonths = 0;

    let totalCurrCoeff = 0;
    let totalPropCoeff = 0;
    let totalDeltaEffectiveCoeff = 0;
    let salaryRecordCount = 0;

    for (const item of scopedItems) {
      const isClosed =
        item.workflow_status === 'COMPLETED' || item.workflow_status === 'REJECTED';
      if (!isClosed) {
        totalActive += 1;
        if (item.days_remaining > 0 || item.is_extended_active) {
          onTimeCount += 1;
        } else {
          overdueUnextendedCount += 1;
        }
      }
      if (item.is_extended_active || item.workflow_status === 'ON_HOLD') {
        extendedOrHoldCount += 1;
      }

      const dMonths = (item.discipline_delay_months || 0) + (item.penalty_delay_months || 0);
      if (dMonths > 0) {
        delayedByDisciplineCount += 1;
        totalDelayedMonths += dMonths;
      }

      // Tính toán quỹ hệ số lương tăng thêm
      const isSalary =
        item.alert_category === 'SALARY_REGULAR' ||
        item.alert_category === 'SALARY_EXCEED' ||
        item.alert_category === 'SALARY_EARLY';
      if (isSalary && item.workflow_status !== 'REJECTED') {
        salaryRecordCount += 1;
        const currC = Number(item.current_coefficient || 0);
        const propC = Number(item.proposed_coefficient || currC);
        const currEx = Number(item.current_exceed_percent || 0);
        const propEx = Number(item.proposed_exceed_percent || currEx);

        const currEffective = currC * (1 + currEx / 100);
        const propEffective = propC * (1 + propEx / 100);
        const delta = Math.max(0, propEffective - currEffective);

        totalCurrCoeff += currEffective;
        totalPropCoeff += propEffective;
        totalDeltaEffectiveCoeff += delta;
      }
    }

    const slaRate =
      totalActive > 0 ? Math.round((onTimeCount / totalActive) * 1000) / 10 : 100;
    const estimatedMonthlyBudgetIncrease = Math.round(
      totalDeltaEffectiveCoeff * BASE_SALARY_VND
    );

    return {
      totalActive,
      onTimeCount,
      overdueUnextendedCount,
      slaRate,
      extendedOrHoldCount,
      delayedByDisciplineCount,
      totalDelayedMonths,
      salaryRecordCount,
      totalCurrCoeff: Number(totalCurrCoeff.toFixed(2)),
      totalPropCoeff: Number(totalPropCoeff.toFixed(2)),
      totalDeltaEffectiveCoeff: Number(totalDeltaEffectiveCoeff.toFixed(2)),
      estimatedMonthlyBudgetIncrease,
    };
  }, [scopedItems]);

  // =========================================================================
  // SƠ ĐỒ 1: CƠ CẤU THEO 5 LOẠI NGHIỆP VỤ (DONUT CHART)
  // =========================================================================
  const categoryChartData = useMemo(() => {
    const groups: { key: string; name: string; value: number; color: string }[] = [
      {
        key: 'SALARY_REGULAR',
        name: 'Nâng lương thường xuyên',
        value: 0,
        color: CATEGORY_COLORS.SALARY_REGULAR,
      },
      {
        key: 'SALARY_EXCEED',
        name: 'Phụ cấp vượt khung',
        value: 0,
        color: CATEGORY_COLORS.SALARY_EXCEED,
      },
      {
        key: 'SALARY_EARLY',
        name: 'Nâng lương trước hạn',
        value: 0,
        color: CATEGORY_COLORS.SALARY_EARLY,
      },
      {
        key: 'REAPPOINTMENT',
        name: 'Bổ nhiệm lại (≥ 18 tháng)',
        value: 0,
        color: CATEGORY_COLORS.REAPPOINTMENT,
      },
      {
        key: 'EXTEND_TO_RETIREMENT',
        name: 'Kéo dài CV đến nghỉ hưu (< 18 tháng)',
        value: 0,
        color: CATEGORY_COLORS.EXTEND_TO_RETIREMENT,
      },
    ];
    const map = Object.fromEntries(groups.map((g) => [g.key, g]));
    for (const item of scopedItems) {
      if (map[item.alert_category]) {
        map[item.alert_category].value += 1;
      }
    }
    return groups.filter((g) => g.value > 0);
  }, [scopedItems]);

  // =========================================================================
  // SƠ ĐỒ 2: PHỄU TRẠNG THÁI QUY TRÌNH 4 BƯỚC + GIA HẠN / TỪ CHỐI (PIPELINE)
  // =========================================================================
  const pipelineChartData = useMemo(() => {
    const counts = {
      WAITING: 0,
      IN_PROGRESS: 0,
      OVERDUE_OR_PENDING: 0,
      EXTENDED_ONLY: 0,
      ON_HOLD_OR_REJECTED: 0,
      COMPLETED: 0,
    };

    for (const item of scopedItems) {
      if (item.workflow_status === 'COMPLETED') {
        counts.COMPLETED += 1;
      } else if (
        item.workflow_status === 'ON_HOLD' ||
        item.workflow_status === 'REJECTED'
      ) {
        counts.ON_HOLD_OR_REJECTED += 1;
      } else if (item.is_extended_active) {
        counts.EXTENDED_ONLY += 1;
      } else if (
        item.days_remaining <= 0 ||
        item.workflow_status === 'PENDING_DECISION'
      ) {
        counts.OVERDUE_OR_PENDING += 1;
      } else if (item.workflow_status === 'IN_PROGRESS') {
        counts.IN_PROGRESS += 1;
      } else {
        counts.WAITING += 1;
      }
    }

    return [
      {
        statusKey: 'WAITING',
        name: '1. Chờ xử lý',
        count: counts.WAITING,
        fill: WORKFLOW_COLORS.WAITING,
      },
      {
        statusKey: 'IN_PROGRESS',
        name: '2. Đang lập hồ sơ',
        count: counts.IN_PROGRESS,
        fill: WORKFLOW_COLORS.IN_PROGRESS,
      },
      {
        statusKey: 'OVERDUE_OR_PENDING',
        name: '3. Chờ QĐ / Quá hạn',
        count: counts.OVERDUE_OR_PENDING,
        fill: WORKFLOW_COLORS.PENDING_DECISION,
      },
      {
        statusKey: 'EXTENDED_ONLY',
        name: '⏳ Đang Gia hạn',
        count: counts.EXTENDED_ONLY,
        fill: WORKFLOW_COLORS.EXTENDED,
      },
      {
        statusKey: 'ON_HOLD_OR_REJECTED',
        name: '⏸️ Tạm hoãn / Từ chối',
        count: counts.ON_HOLD_OR_REJECTED,
        fill: WORKFLOW_COLORS.ON_HOLD,
      },
      {
        statusKey: 'COMPLETED',
        name: '4. Đã Hoàn thành',
        count: counts.COMPLETED,
        fill: WORKFLOW_COLORS.COMPLETED,
      },
    ];
  }, [scopedItems]);

  // =========================================================================
  // SƠ ĐỒ 3: PHÂN BỔ THEO PHÒNG BAN & MỨC ĐỘ KHẨN CẤP (STACKED BAR CHART)
  // =========================================================================
  const departmentChartData = useMemo(() => {
    const map: Record<
      string,
      {
        department: string;
        overdueT0: number;
        urgentT30T60: number;
        upcomingT90: number;
        extendedOrHold: number;
        completed: number;
        total: number;
        currCoeff: number;
        propCoeff: number;
        deltaBudget: number;
      }
    > = {};

    for (const item of scopedItems) {
      const dept = item.department_name || 'Đơn vị chuyên môn';
      if (!map[dept]) {
        map[dept] = {
          department: dept,
          overdueT0: 0,
          urgentT30T60: 0,
          upcomingT90: 0,
          extendedOrHold: 0,
          completed: 0,
          total: 0,
          currCoeff: 0,
          propCoeff: 0,
          deltaBudget: 0,
        };
      }
      const row = map[dept];
      row.total += 1;

      if (item.workflow_status === 'COMPLETED') {
        row.completed += 1;
      } else if (
        item.is_extended_active ||
        item.workflow_status === 'ON_HOLD' ||
        item.workflow_status === 'REJECTED'
      ) {
        row.extendedOrHold += 1;
      } else if (item.milestone_code === 'T-0') {
        row.overdueT0 += 1;
      } else if (item.milestone_code === 'T-30' || item.milestone_code === 'T-60') {
        row.urgentT30T60 += 1;
      } else {
        row.upcomingT90 += 1;
      }

      // Quỹ lương theo phòng ban
      const isSalary =
        item.alert_category === 'SALARY_REGULAR' ||
        item.alert_category === 'SALARY_EXCEED' ||
        item.alert_category === 'SALARY_EARLY';
      if (isSalary && item.workflow_status !== 'REJECTED') {
        const c1 = Number(item.current_coefficient || 0) * (1 + Number(item.current_exceed_percent || 0) / 100);
        const c2 = Number(item.proposed_coefficient || c1) * (1 + Number(item.proposed_exceed_percent || 0) / 100);
        row.currCoeff = Number((row.currCoeff + c1).toFixed(2));
        row.propCoeff = Number((row.propCoeff + c2).toFixed(2));
        row.deltaBudget += Math.round(Math.max(0, c2 - c1) * BASE_SALARY_VND);
      }
    }

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [scopedItems]);

  // =========================================================================
  // SƠ ĐỒ 4: PHÂN BỔ ĐẾM NGƯỢC THEO CHẶNG CẢNH BÁO (MILESTONE TIMELINE)
  // =========================================================================
  const milestoneChartData = useMemo(() => {
    const buckets = [
      {
        milestoneKey: 'T-0',
        name: '🔴 T-0 / Quá hạn',
        salaryCount: 0,
        appointmentCount: 0,
        total: 0,
      },
      {
        milestoneKey: 'T-30',
        name: '🟠 T-30 (≤ 30 ngày)',
        salaryCount: 0,
        appointmentCount: 0,
        total: 0,
      },
      {
        milestoneKey: 'T-60',
        name: '🟡 T-60 (31–60 ngày)',
        salaryCount: 0,
        appointmentCount: 0,
        total: 0,
      },
      {
        milestoneKey: 'T-90',
        name: '🟢 T-90 (61–90 ngày)',
        salaryCount: 0,
        appointmentCount: 0,
        total: 0,
      },
      {
        milestoneKey: 'EXTENDED',
        name: '🟣 Đang Gia hạn',
        salaryCount: 0,
        appointmentCount: 0,
        total: 0,
      },
      {
        milestoneKey: 'COMPLETED',
        name: '✅ Đã Hoàn thành',
        salaryCount: 0,
        appointmentCount: 0,
        total: 0,
      },
    ];
    const bMap = Object.fromEntries(buckets.map((b) => [b.milestoneKey, b]));

    for (const item of scopedItems) {
      const b = bMap[item.milestone_code];
      if (!b) continue;
      const isApp =
        item.alert_category === 'REAPPOINTMENT' ||
        item.alert_category === 'EXTEND_TO_RETIREMENT';
      if (isApp) {
        b.appointmentCount += 1;
      } else {
        b.salaryCount += 1;
      }
      b.total += 1;
    }
    return buckets;
  }, [scopedItems]);

  // =========================================================================
  // SƠ ĐỒ 5: SO SÁNH HỆ SỐ LƯƠNG HIỆN TẠI VS ĐỀ XUẤT THEO HẠNG CHỨC DANH
  // =========================================================================
  const rankTierSalaryData = useMemo(() => {
    const tiers = ['Hạng I', 'Hạng II', 'Hạng III', 'Hạng IV'];
    const map: Record<
      string,
      {
        rank: string;
        headcount: number;
        currentCoeffSum: number;
        proposedCoeffSum: number;
        cycleLabel: string;
      }
    > = {};

    for (const t of tiers) {
      map[t] = {
        rank: t,
        headcount: 0,
        currentCoeffSum: 0,
        proposedCoeffSum: 0,
        cycleLabel: t === 'Hạng IV' ? 'Chu kỳ 24 tháng' : 'Chu kỳ 36 tháng',
      };
    }

    for (const item of scopedItems) {
      const isSalary =
        item.alert_category === 'SALARY_REGULAR' ||
        item.alert_category === 'SALARY_EXCEED' ||
        item.alert_category === 'SALARY_EARLY';
      if (!isSalary) continue;
      const tier = item.rank_tier && map[item.rank_tier] ? item.rank_tier : 'Hạng III';
      map[tier].headcount += 1;
      const c1 = Number(item.current_coefficient || 0);
      const c2 = Number(item.proposed_coefficient || c1);
      map[tier].currentCoeffSum = Number((map[tier].currentCoeffSum + c1).toFixed(2));
      map[tier].proposedCoeffSum = Number((map[tier].proposedCoeffSum + c2).toFixed(2));
    }

    return Object.values(map).filter((r) => r.headcount > 0);
  }, [scopedItems]);

  const handleExportSummaryExcel = () => {
    if (!departmentChartData.length) {
      message.warning('Không có dữ liệu thống kê để xuất báo cáo');
      return;
    }
    const rows = departmentChartData.map((d, idx) => ({
      STT: idx + 1,
      'Phòng ban / Đơn vị': d.department,
      'Tổng số cảnh báo': d.total,
      'Quá hạn / T-0 (Đỏ)': d.overdueT0,
      'Đến hạn lập HS T-30/T-60 (Vàng/Cam)': d.urgentT30T60,
      'Dự kiến Quý tới T-90 (Xanh lá)': d.upcomingT90,
      'Đang Gia hạn / Tạm hoãn': d.extendedOrHold,
      'Đã Hoàn thành (Bước 4)': d.completed,
      'Tổng Hệ số lương hiện hưởng': d.currCoeff,
      'Tổng Hệ số lương đề xuất mới': d.propCoeff,
      'Chênh lệch Hệ số tăng thêm (Δ)': Number((d.propCoeff - d.currCoeff).toFixed(2)),
      'Dự toán Quỹ lương tăng thêm/tháng (VNĐ)': d.deltaBudget,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Thong_Ke_Du_Toan_Don_Vi');
    XLSX.writeFile(
      wb,
      `Bao_Cao_Thong_Ke_Canh_Bao_Va_Du_Toan_Quy_Luong_${dayjs().format('DDMMYYYY')}.xlsx`
    );
    message.success('Đã xuất Báo cáo Thống kê & Dự toán Quỹ lương theo đơn vị (.xlsx)!');
  };

  const chartCardStyle = {
    borderRadius: 14,
    height: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Thanh Bộ lọc Thông minh cho Tab Thống kê & Sơ đồ */}
      <Card bodyStyle={{ padding: '12px 18px' }} style={{ borderRadius: 12 }}>
        <Row justify="space-between" align="middle" gutter={[12, 12]}>
          <Col xs={24} md={16}>
            <Space wrap size={12}>
              <Tag color="purple" icon={<FilterOutlined />} style={{ padding: '4px 10px', fontSize: 13 }}>
                Bộ lọc Phân tích Sơ đồ
              </Tag>
              <Select
                placeholder="Tất cả Phòng ban / Đơn vị"
                allowClear
                value={deptFilter}
                onChange={setDeptFilter}
                style={{ width: 210 }}
                options={departments.map((d) => ({ label: d, value: d }))}
              />
              <Select
                placeholder="Tất cả Loại nghiệp vụ"
                allowClear
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: 230 }}
                options={[
                  { label: 'Nâng bậc lương thường xuyên', value: 'SALARY_REGULAR' },
                  { label: 'Phụ cấp thâm niên vượt khung', value: 'SALARY_EXCEED' },
                  { label: 'Nâng bậc lương trước thời hạn', value: 'SALARY_EARLY' },
                  { label: 'Bổ nhiệm lại (≥ 18 tháng)', value: 'REAPPOINTMENT' },
                  { label: 'Kéo dài chức vụ đến nghỉ hưu (< 18 tháng)', value: 'EXTEND_TO_RETIREMENT' },
                ]}
              />
              <Space size={6}>
                <Switch
                  size="small"
                  checked={includeClosed}
                  onChange={setIncludeClosed}
                />
                <Text style={{ fontSize: 12.5 }}>Bao gồm hồ sơ Đã hoàn tất & Từ chối</Text>
              </Space>
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportSummaryExcel}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}
            >
              Xuất Báo cáo Thống kê & Dự toán (.xlsx)
            </Button>
          </Col>
        </Row>
      </Card>

      {/* =========================================================================
          TẦNG 1: 4 THẺ CHỈ SỐ QUẢN TRỊ CẤP CAO (EXECUTIVE KPI CARDS)
         ========================================================================= */}
      <Row gutter={[14, 14]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bodyStyle={{ padding: '16px 18px' }} style={{ borderRadius: 12, borderTop: '3px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12.5 }}>
                  TỶ LỆ HỒ SƠ ĐÚNG TIẾN ĐỘ (SLA)
                </Text>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#10b981', marginTop: 2 }}>
                  {kpiMetrics.slaRate}%
                </div>
              </div>
              <CheckCircleOutlined style={{ fontSize: 26, color: '#10b981' }} />
            </div>
            <Progress
              percent={kpiMetrics.slaRate}
              strokeColor="#10b981"
              size="small"
              showInfo={false}
              style={{ marginTop: 6, marginBottom: 4 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Đúng hạn / Gia hạn hợp lệ: <b>{kpiMetrics.onTimeCount}</b> / {kpiMetrics.totalActive} hồ sơ đang mở
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bodyStyle={{ padding: '16px 18px' }} style={{ borderRadius: 12, borderTop: '3px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12.5 }}>
                  DỰ BÁO QUỸ LƯƠNG TĂNG THÊM / THÁNG
                </Text>
                <div style={{ fontSize: 23, fontWeight: 700, color: '#3b82f6', marginTop: 4 }}>
                  +{kpiMetrics.estimatedMonthlyBudgetIncrease.toLocaleString('vi-VN')} ₫
                </div>
              </div>
              <DollarOutlined style={{ fontSize: 26, color: '#3b82f6' }} />
            </div>
            <div style={{ marginTop: 10 }}>
              <Tag color="blue" icon={<ArrowUpOutlined />}>
                Tổng Δ Hệ số tăng: +{kpiMetrics.totalDeltaEffectiveCoeff}
              </Tag>
              <Text type="secondary" style={{ fontSize: 11.5 }}>
                ({kpiMetrics.salaryRecordCount} HS lương • LCS: 2,34tr)
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={() => onDrillDown({ status: 'EXTENDED_ONLY' })}
            bodyStyle={{ padding: '16px 18px' }}
            style={{ borderRadius: 12, borderTop: '3px solid #a855f7' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12.5 }}>
                  ĐANG GIA HẠN / TẠM HOÃN XỬ LÝ
                </Text>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#a855f7', marginTop: 2 }}>
                  {kpiMetrics.extendedOrHoldCount} <span style={{ fontSize: 14, fontWeight: 500 }}>hồ sơ</span>
                </div>
              </div>
              <ClockCircleOutlined style={{ fontSize: 26, color: '#a855f7' }} />
            </div>
            <div style={{ marginTop: 10 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Bảo lưu 100% <b>Ngày hưởng chế độ gốc</b> để tính truy lĩnh khi ký QĐ
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bodyStyle={{ padding: '16px 18px' }} style={{ borderRadius: 12, borderTop: '3px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12.5 }}>
                  HỒ SƠ BỊ LÙI KỲ DO KỶ LUẬT / TỪ CHỐI
                </Text>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#f59e0b', marginTop: 2 }}>
                  {kpiMetrics.delayedByDisciplineCount} <span style={{ fontSize: 14, fontWeight: 500 }}>hồ sơ</span>
                </div>
              </div>
              <WarningOutlined style={{ fontSize: 26, color: '#f59e0b' }} />
            </div>
            <div style={{ marginTop: 10 }}>
              <Tag color="warning">Tổng thời gian kéo dài: +{kpiMetrics.totalDelayedMonths} tháng</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      {/* =========================================================================
          TẦNG 2: SƠ ĐỒ 1 (CƠ CẤU NGHIỆP VỤ) & SƠ ĐỒ 2 (PHỄU TIẾN ĐỘ 4 BƯỚC)
         ========================================================================= */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={11}>
          <Card
            title={
              <Space>
                <PieChartOutlined style={{ color: '#6366f1' }} />
                <span>Sơ đồ 1: Cơ cấu Cảnh báo theo 5 Nhóm Nghiệp vụ</span>
              </Space>
            }
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Click vào biểu đồ để lọc danh sách</Text>}
            style={chartCardStyle}
          >
            {categoryChartData.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="48%"
                      innerRadius={62}
                      outerRadius={98}
                      paddingAngle={3}
                      label={({ name, value }) => `${name}: ${value}`}
                      onClick={(entry: any) => {
                        if (entry?.key) {
                          onDrillDown({ category: entry.key });
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {categoryChartData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any) => [`${val} hồ sơ`, 'Số lượng']}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty description="Không có dữ liệu cảnh báo" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={13}>
          <Card
            title={
              <Space>
                <BarChartOutlined style={{ color: '#3b82f6' }} />
                <span>Sơ đồ 2: Phễu Tiến độ Xử lý Hồ sơ (4 Bước & Gia hạn / Từ chối)</span>
              </Space>
            }
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Click vào thanh trạng thái để mở DS</Text>}
            style={chartCardStyle}
          >
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart
                  data={pipelineChartData}
                  layout="vertical"
                  margin={{ top: 8, right: 28, left: 20, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={145} tick={{ fontSize: 12 }} />
                  <RechartsTooltip
                    formatter={(val: any) => [`${val} hồ sơ`, 'Số lượng']}
                  />
                  <Bar
                    dataKey="count"
                    name="Số hồ sơ"
                    radius={[0, 6, 6, 0]}
                    onClick={(entry: any) => {
                      if (entry?.statusKey) {
                        onDrillDown({ status: entry.statusKey });
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {pipelineChartData.map((entry) => (
                      <Cell key={entry.statusKey} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* =========================================================================
          TẦNG 3: SƠ ĐỒ 3 (THEO PHÒNG BAN) & SƠ ĐỒ 4 (THEO CHẶNG CẢNH BÁO T-90 -> T-0)
         ========================================================================= */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <AuditOutlined style={{ color: '#10b981' }} />
                <span>Sơ đồ 3: Phân bổ Cảnh báo & Mức độ Khẩn cấp theo Phòng ban</span>
              </Space>
            }
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Click cột để lọc theo Phòng ban</Text>}
            style={chartCardStyle}
          >
            {departmentChartData.length > 0 ? (
              <div style={{ width: '100%', height: 310 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={departmentChartData}
                    margin={{ top: 12, right: 20, left: 4, bottom: 10 }}
                    onClick={(state: any) => {
                      const deptName = state?.activeLabel;
                      if (deptName) {
                        onDrillDown({ dept: deptName });
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="department" tick={{ fontSize: 11.5 }} />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip />
                    <Legend />
                    <Bar
                      dataKey="overdueT0"
                      stackId="a"
                      name="🔴 Quá hạn / T-0"
                      fill="#ef4444"
                    />
                    <Bar
                      dataKey="urgentT30T60"
                      stackId="a"
                      name="🟠 Đến hạn lập HS (T-30 / T-60)"
                      fill="#f59e0b"
                    />
                    <Bar
                      dataKey="upcomingT90"
                      stackId="a"
                      name="🟢 Quý tới (T-90)"
                      fill="#10b981"
                    />
                    <Bar
                      dataKey="extendedOrHold"
                      stackId="a"
                      name="🟣 Đang Gia hạn / Tạm hoãn"
                      fill="#a855f7"
                    />
                    <Bar
                      dataKey="completed"
                      stackId="a"
                      name="✅ Đã Hoàn thành (B4)"
                      fill="#14b8a6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty description="Chưa có dữ liệu theo phòng ban" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#f59e0b' }} />
                <span>Sơ đồ 4: Áp lực Công việc theo Chặng Cảnh báo (T-90 ➔ T-0)</span>
              </Space>
            }
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Tách Nâng lương vs Bổ nhiệm lại</Text>}
            style={chartCardStyle}
          >
            <div style={{ width: '100%', height: 310 }}>
              <ResponsiveContainer>
                <ComposedChart
                  data={milestoneChartData}
                  margin={{ top: 12, right: 20, left: 4, bottom: 10 }}
                  onClick={(state: any) => {
                    const idx = state?.activeTooltipIndex;
                    if (idx !== undefined && milestoneChartData[idx]) {
                      const mKey = milestoneChartData[idx].milestoneKey;
                      if (mKey === 'COMPLETED') {
                        onDrillDown({ status: 'COMPLETED' });
                      } else {
                        onDrillDown({ milestone: mKey });
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 11.5 }} />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar
                    dataKey="salaryCount"
                    name="Nâng bậc lương / Vượt khung"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="appointmentCount"
                    name="Bổ nhiệm lại / Kéo dài chức vụ"
                    fill="#f97316"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Tổng khối lượng hồ sơ"
                    stroke="#10b981"
                    strokeWidth={2.5}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* =========================================================================
          TẦNG 4: SƠ ĐỒ 5 (SO SÁNH HỆ SỐ LƯƠNG THEO HẠNG) & BẢNG TỔNG HỢP DỰ TOÁN
         ========================================================================= */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: '#8b5cf6' }} />
                <span>Sơ đồ 5: Quỹ Hệ số Lương Hiện hưởng vs. Đề xuất theo Hạng</span>
              </Space>
            }
            style={chartCardStyle}
          >
            {rankTierSalaryData.length > 0 ? (
              <div style={{ width: '100%', height: 290 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={rankTierSalaryData}
                    margin={{ top: 12, right: 20, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="rank" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar
                      dataKey="currentCoeffSum"
                      name="Tổng Hệ số hiện hưởng"
                      fill="#64748b"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="proposedCoeffSum"
                      name="Tổng Hệ số đề xuất mới"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty description="Không có dữ liệu bậc lương" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <DollarOutlined style={{ color: '#10b981' }} />
                <span>Bảng Tổng hợp Dự toán Quỹ lương Tăng thêm & Tiến độ theo Đơn vị</span>
              </Space>
            }
            style={chartCardStyle}
          >
            <Table
              rowKey="department"
              size="small"
              pagination={false}
              dataSource={departmentChartData}
              columns={[
                {
                  title: 'Đơn vị / Phòng ban',
                  dataIndex: 'department',
                  key: 'department',
                  render: (dept: string) => (
                    <Tooltip title="Bấm để lọc danh sách theo phòng ban này">
                      <a onClick={() => onDrillDown({ dept })} style={{ fontWeight: 600 }}>
                        {dept}
                      </a>
                    </Tooltip>
                  ),
                },
                {
                  title: 'Tổng HS',
                  dataIndex: 'total',
                  key: 'total',
                  align: 'center' as const,
                  render: (val: number) => <Tag color="blue">{val}</Tag>,
                },
                {
                  title: 'Quá hạn / T-30',
                  key: 'urgent',
                  align: 'center' as const,
                  render: (_: any, r: any) => (
                    <Space size={4}>
                      {r.overdueT0 > 0 && <Tag color="error">{r.overdueT0} Đỏ</Tag>}
                      {r.urgentT30T60 > 0 && <Tag color="warning">{r.urgentT30T60} Vàng</Tag>}
                      {r.overdueT0 === 0 && r.urgentT30T60 === 0 && (
                        <Text type="secondary">0</Text>
                      )}
                    </Space>
                  ),
                },
                {
                  title: 'Hệ số Hiện tại ➔ Mới',
                  key: 'coeff',
                  align: 'center' as const,
                  render: (_: any, r: any) => (
                    <span style={{ fontSize: 12.5 }}>
                      {r.currCoeff.toFixed(2)} ➔{' '}
                      <b style={{ color: '#10b981' }}>{r.propCoeff.toFixed(2)}</b> (
                      <span style={{ color: '#3b82f6' }}>
                        +{(r.propCoeff - r.currCoeff).toFixed(2)}
                      </span>
                      )
                    </span>
                  ),
                },
                {
                  title: 'Quỹ lương tăng thêm/tháng',
                  dataIndex: 'deltaBudget',
                  key: 'deltaBudget',
                  align: 'right' as const,
                  render: (val: number) => (
                    <Text strong style={{ color: isDark ? '#38bdf8' : '#2563eb' }}>
                      +{val.toLocaleString('vi-VN')} ₫
                    </Text>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

