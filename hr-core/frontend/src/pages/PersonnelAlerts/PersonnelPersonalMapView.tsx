import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Space,
  Select,
  Input,
  Button,
  Progress,
  Avatar,
  Badge,
  Table,
  Drawer,
  Descriptions,
  Segmented,
  Empty,
  Alert,
  Spin,
  Divider,
  message,
} from 'antd';
import {
  UserOutlined,
  SafetyCertificateOutlined,
  FlagOutlined,
  BellOutlined,
  SearchOutlined,
  DownloadOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  TableOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  EyeOutlined,
  ArrowRightOutlined,
  TrophyOutlined,
  FileProtectOutlined,
  ClearOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { personnelAlertService } from '@/services/personnelAlertService';
import { personnelProfileService } from '@/services/personnelProfileService';
import type {
  PersonalProfileMapItem,
  PersonalProfileMapSummary,
  PersonnelAlertItem,
  OfficialStatusType,
  PartyStatusType,
} from '@/types/personnelAlert';
import type { VcProfileDetail } from '@/types/personnelProfile';

const { Text, Title } = Typography;

interface PersonnelPersonalMapViewProps {
  isDark: boolean;
  fallbackAlerts: PersonnelAlertItem[];
  onDrillDownToPersonAlerts: (personName: string) => void;
  onOpenBnvProfile: (userId?: string | null) => void;
}

function normalizeText(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function detectRankTierAndCycleFromRealProfile(prof?: Partial<VcProfileDetail> | null): {
  rankTier: string | null;
  cycleMonths: number;
  maxStep: number;
} {
  const titleText = `${prof?.professional_title_name || ''} ${
    prof?.professional_title_code || ''
  }`.toLowerCase();
  if (!titleText.trim()) {
    return { rankTier: null, cycleMonths: 36, maxStep: 9 };
  }
  if (titleText.includes('hạng iv') || titleText.includes('hang iv') || titleText.includes('01.004')) {
    return { rankTier: 'Hạng IV', cycleMonths: 24, maxStep: 10 };
  }
  if (titleText.includes('hạng i ') || titleText.endsWith('hạng i') || titleText.includes('01.001')) {
    return { rankTier: 'Hạng I', cycleMonths: 36, maxStep: 6 };
  }
  if (titleText.includes('hạng ii') || titleText.includes('hang ii') || titleText.includes('01.002')) {
    return { rankTier: 'Hạng II', cycleMonths: 36, maxStep: 8 };
  }
  return { rankTier: 'Hạng III', cycleMonths: 36, maxStep: 9 };
}

export function PersonnelPersonalMapView({
  isDark,
  fallbackAlerts,
  onDrillDownToPersonAlerts,
  onOpenBnvProfile,
}: PersonnelPersonalMapViewProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [items, setItems] = useState<PersonalProfileMapItem[]>([]);
  const [summary, setSummary] = useState<PersonalProfileMapSummary | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonalProfileMapItem | null>(null);
  const [mindmapDrawerOpen, setMindmapDrawerOpen] = useState<boolean>(false);

  // Bộ lọc đa chiều cho Sơ đồ Cá nhân
  const [search, setSearch] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string | undefined>(undefined);
  const [officialFilter, setOfficialFilter] = useState<string | undefined>(undefined);
  const [partyFilter, setPartyFilter] = useState<string | undefined>(undefined);
  const [alertStatusFilter, setAlertStatusFilter] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [showOverviewCharts, setShowOverviewCharts] = useState<boolean>(true);

  const loadPersonalMap = async () => {
    setLoading(true);
    try {
      const data = await personnelAlertService.getPersonalProfileMap();
      setItems(data.items);
      setSummary(data.summary);
    } catch {
      // Nếu backend chưa kịp reload route /personal-profiles, đọc trực tiếp từ API thực tế /api/v1/personnel-profiles
      try {
        const listRes = await personnelProfileService.list();
        const detailList = await Promise.all(
          listRes.map(async (row) => {
            if (!row.profile_id) return { row, detail: null as VcProfileDetail | null };
            try {
              const det = await personnelProfileService.getByUser(row.user_id);
              return { row, detail: det };
            } catch {
              return { row, detail: null as VcProfileDetail | null };
            }
          })
        );

        const alertsByProfile = new Map<string, PersonnelAlertItem[]>();
        const alertsByUser = new Map<string, PersonnelAlertItem[]>();
        fallbackAlerts.forEach((a) => {
          if (a.workflow_status === 'COMPLETED' || a.workflow_status === 'REJECTED') return;
          if (a.profile_id) {
            const arr = alertsByProfile.get(a.profile_id) || [];
            arr.push(a);
            alertsByProfile.set(a.profile_id, arr);
          }
          if (a.user_id) {
            const arrU = alertsByUser.get(a.user_id) || [];
            arrU.push(a);
            alertsByUser.set(a.user_id, arrU);
          }
        });

        const today = dayjs().startOf('day');
        const realItems: PersonalProfileMapItem[] = detailList.map(({ row, detail }) => {
          const personAlerts =
            (row.profile_id && alertsByProfile.get(row.profile_id)) ||
            alertsByUser.get(row.user_id) ||
            [];
          const hasOverdue = personAlerts.some(
            (x) => x.days_remaining <= 0 && !x.is_extended_active
          );
          const hasUpcoming = personAlerts.length > 0 && !hasOverdue;

          // 1. Tư cách Viên chức dựa trên dữ liệu thực tế
          let officialStatus: OfficialStatusType = 'NO_VC_PROFILE';
          let officialLabel = 'Chưa lập Hồ sơ Viên chức (HS02-BNV)';
          let probDaysRem: number | null = null;

          if (detail || row.profile_id) {
            if (detail?.probation_end_date && dayjs(detail.probation_end_date).isAfter(today)) {
              officialStatus = 'PROBATION_VC';
              officialLabel = 'Viên chức Đang tập sự';
              probDaysRem = dayjs(detail.probation_end_date).diff(today, 'day');
            } else if (
              row.professional_title_code ||
              row.professional_title_name ||
              detail?.first_recruitment_date ||
              row.salary_step
            ) {
              officialStatus = 'OFFICIAL_VC';
              officialLabel = 'Đã là Viên chức Chính thức';
            } else {
              officialStatus = 'CONTRACT_STAFF';
              officialLabel = 'Chưa cập nhật ngạch Viên chức';
            }
          }

          // 2. Tư cách Đảng viên CSVN dựa trên dữ liệu thực tế trong hồ sơ
          let partyStatus: PartyStatusType = 'NON_PARTY';
          let partyLabel = 'Chưa vào Đảng (Quần chúng)';
          let partySeniority: number | null = null;
          let partyOfficialDue: string | null = null;
          let partyOfficialDaysRem: number | null = null;

          if (
            (detail?.cpv_official_date &&
              !dayjs(detail.cpv_official_date).isAfter(today)) ||
            detail?.cpv_card_number
          ) {
            partyStatus = 'PARTY_OFFICIAL';
            partyLabel = 'Đảng viên Chính thức';
            const baseDate = detail?.cpv_probationary_date || detail?.cpv_official_date;
            if (baseDate) {
              partySeniority = Math.max(1, today.year() - dayjs(baseDate).year());
            }
          } else if (detail?.cpv_probationary_date || row.is_cpv_member) {
            partyStatus = 'PARTY_PROBATION';
            partyLabel = 'Đảng viên Dự bị';
            if (detail?.cpv_probationary_date) {
              const due = dayjs(detail.cpv_probationary_date).add(12, 'month');
              partyOfficialDue = due.format('YYYY-MM-DD');
              partyOfficialDaysRem = due.diff(today, 'day');
            }
          }

          // 3. Chu kỳ Lương & Bổ nhiệm dựa trên dữ liệu thực tế
          const { rankTier, cycleMonths, maxStep } = detectRankTierAndCycleFromRealProfile(
            detail || row
          );
          let discDelay = 0;
          if (detail?.disciplines?.length) {
            detail.disciplines.forEach((d) => {
              const f = (d.discipline_form || '').toLowerCase();
              if (f.includes('cách chức')) discDelay += 12;
              else if (f.includes('cảnh cáo')) discDelay += 6;
              else if (f.includes('khiển trách')) discDelay += 3;
            });
          }

          const totalSalaryMonths = cycleMonths + discDelay;
          let salaryNextDue: string | null = null;
          let salaryDaysRem: number | null = null;
          let salaryProgPct = 0;

          if (detail?.salary_effective_date) {
            const startD = dayjs(detail.salary_effective_date);
            const dueD = startD.add(totalSalaryMonths, 'month');
            salaryNextDue = dueD.format('YYYY-MM-DD');
            salaryDaysRem = dueD.diff(today, 'day');
            const totalD = Math.max(1, dueD.diff(startD, 'day'));
            const elapsedD = Math.max(0, today.diff(startD, 'day'));
            salaryProgPct = Math.min(100, Math.round((elapsedD / totalD) * 100));
          }

          const effAppoint = detail?.reappointment_date || detail?.appointment_date || null;
          let reappointDue: string | null = null;
          let reappointDaysRem: number | null = null;
          let reappointProgPct = 0;
          if (detail?.leadership_position && effAppoint) {
            const appStart = dayjs(effAppoint);
            const appDue = appStart.add(60, 'month');
            reappointDue = appDue.format('YYYY-MM-DD');
            reappointDaysRem = appDue.diff(today, 'day');
            const totalAppD = Math.max(1, appDue.diff(appStart, 'day'));
            const elapsedAppD = Math.max(0, today.diff(appStart, 'day'));
            reappointProgPct = Math.min(100, Math.round((elapsedAppD / totalAppD) * 100));
          }

          const evalSummary = detail?.annual_evaluations?.length
            ? detail.annual_evaluations
                .slice(0, 3)
                .map((e) => `${e.evaluation_year}: ${e.rating}`)
                .join(' | ')
            : null;

          return {
            id: row.profile_id || row.user_id,
            profile_id: row.profile_id,
            user_id: row.user_id,
            employee_id: row.employee_id,
            full_name: row.full_name,
            employee_code: row.employee_code,
            department_name: row.department_name,
            date_of_birth: detail?.date_of_birth || null,
            gender: row.gender || detail?.gender || null,
            portrait_url: row.portrait_url || detail?.portrait_url || null,
            highest_professional_degree:
              row.highest_professional_degree || detail?.highest_professional_degree || null,
            political_theory_level:
              row.political_theory_level || detail?.political_theory_level || null,
            official_status: officialStatus,
            official_status_label: officialLabel,
            first_recruitment_date: detail?.first_recruitment_date || null,
            current_agency_join_date: detail?.current_agency_join_date || null,
            probation_end_date: detail?.probation_end_date || null,
            probation_days_remaining: probDaysRem,
            professional_title_name:
              row.professional_title_name || detail?.professional_title_name || null,
            professional_title_code:
              row.professional_title_code || detail?.professional_title_code || null,
            rank_tier: rankTier,
            party_status: partyStatus,
            party_status_label: partyLabel,
            cpv_probationary_date: detail?.cpv_probationary_date || null,
            cpv_official_date: detail?.cpv_official_date || null,
            cpv_card_number: detail?.cpv_card_number || null,
            cpv_current_position: detail?.cpv_current_position || null,
            cpv_admission_place: detail?.cpv_admission_place || null,
            party_seniority_years: partySeniority,
            party_official_due_date: partyOfficialDue,
            party_official_days_remaining: partyOfficialDaysRem,
            youth_union_date: detail?.youth_union_date || null,
            trade_union_date: detail?.trade_union_date || null,
            salary_step: row.salary_step ?? detail?.salary_step ?? null,
            max_step: (row.salary_step ?? detail?.salary_step) ? maxStep : null,
            salary_coefficient: row.salary_coefficient ?? detail?.salary_coefficient ?? null,
            seniority_exceed_percent: detail?.seniority_exceed_percent ?? null,
            salary_effective_date: detail?.salary_effective_date || null,
            salary_cycle_months: totalSalaryMonths,
            discipline_delay_months: discDelay,
            salary_next_due_date: salaryNextDue,
            salary_days_remaining: salaryDaysRem,
            salary_progress_percent: salaryProgPct,
            leadership_position: detail?.leadership_position || row.position_name || null,
            appointment_date: effAppoint,
            reappointment_due_date: reappointDue,
            reappointment_days_remaining: reappointDaysRem,
            reappointment_progress_percent: reappointProgPct,
            retirement_date: personAlerts[0]?.retirement_date || null,
            remaining_work_months: personAlerts[0]?.remaining_work_months ?? null,
            evaluation_summary: evalSummary,
            has_overdue_alert: hasOverdue,
            has_upcoming_alert: hasUpcoming,
            active_alerts_count: personAlerts.length,
            active_alerts: personAlerts,
          };
        });

        setItems(realItems);
        setSummary({
          total_personnel: realItems.length,
          official_vc_count: realItems.filter((i) => i.official_status === 'OFFICIAL_VC').length,
          probation_vc_count: realItems.filter((i) => i.official_status === 'PROBATION_VC').length,
          non_vc_or_no_profile_count: realItems.filter(
            (i) => i.official_status === 'CONTRACT_STAFF' || i.official_status === 'NO_VC_PROFILE'
          ).length,
          party_official_count: realItems.filter((i) => i.party_status === 'PARTY_OFFICIAL').length,
          party_probation_count: realItems.filter((i) => i.party_status === 'PARTY_PROBATION')
            .length,
          non_party_count: realItems.filter((i) => i.party_status === 'NON_PARTY').length,
          with_overdue_alert_count: realItems.filter((i) => i.has_overdue_alert).length,
          with_upcoming_alert_count: realItems.filter((i) => i.has_upcoming_alert).length,
          safe_cycle_count: realItems.filter(
            (i) => !i.has_overdue_alert && !i.has_upcoming_alert
          ).length,
        });
      } catch {
        message.error('Không thể tải dữ liệu hồ sơ thực tế');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersonalMap();
  }, [fallbackAlerts]);

  const departments = useMemo(() => {
    const s = new Set(items.map((i) => i.department_name).filter(Boolean) as string[]);
    return Array.from(s);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (deptFilter && item.department_name !== deptFilter) return false;
      if (officialFilter && item.official_status !== officialFilter) return false;
      if (partyFilter && item.party_status !== partyFilter) return false;

      if (alertStatusFilter === 'OVERDUE' && !item.has_overdue_alert) return false;
      if (alertStatusFilter === 'UPCOMING' && !item.has_upcoming_alert) return false;
      if (
        alertStatusFilter === 'ANY_ALERT' &&
        !item.has_overdue_alert &&
        !item.has_upcoming_alert
      ) {
        return false;
      }
      if (
        alertStatusFilter === 'SAFE_CYCLE' &&
        (item.has_overdue_alert || item.has_upcoming_alert)
      ) {
        return false;
      }
      if (alertStatusFilter === 'HAS_DISCIPLINE' && (item.discipline_delay_months || 0) <= 0) {
        return false;
      }

      if (search.trim()) {
        const qNorm = normalizeText(search);
        const qRaw = search.toLowerCase().trim();
        const check = (val?: string | number | null) => {
          if (val === undefined || val === null) return false;
          const s = String(val);
          return s.toLowerCase().includes(qRaw) || normalizeText(s).includes(qNorm);
        };
        const match =
          check(item.full_name) ||
          check(item.employee_code) ||
          check(item.department_name) ||
          check(item.professional_title_name) ||
          check(item.professional_title_code) ||
          check(item.leadership_position) ||
          check(item.cpv_card_number) ||
          check(item.cpv_current_position) ||
          check(item.official_status_label) ||
          check(item.party_status_label);
        if (!match) return false;
      }

      return true;
    });
  }, [items, deptFilter, officialFilter, partyFilter, alertStatusFilter, search]);

  const resetFilters = () => {
    setSearch('');
    setDeptFilter(undefined);
    setOfficialFilter(undefined);
    setPartyFilter(undefined);
    setAlertStatusFilter(undefined);
  };

  // Dữ liệu Biểu đồ Cơ cấu Viên chức & Đảng viên theo Phòng ban (từ dữ liệu thực tế)
  const deptMatrixChartData = useMemo(() => {
    const map = new Map<
      string,
      {
        department: string;
        officialVc: number;
        partyMember: number;
        hasAlert: number;
      }
    >();

    filteredItems.forEach((item) => {
      const dept = item.department_name || 'Chưa phân phòng';
      const cur = map.get(dept) || {
        department: dept,
        officialVc: 0,
        partyMember: 0,
        hasAlert: 0,
      };
      if (item.official_status === 'OFFICIAL_VC') cur.officialVc += 1;
      if (item.party_status === 'PARTY_OFFICIAL' || item.party_status === 'PARTY_PROBATION') {
        cur.partyMember += 1;
      }
      if (item.active_alerts_count > 0) cur.hasAlert += 1;
      map.set(dept, cur);
    });

    return Array.from(map.values());
  }, [filteredItems]);

  const partyDonutData = useMemo(() => {
    const official = filteredItems.filter((i) => i.party_status === 'PARTY_OFFICIAL').length;
    const probation = filteredItems.filter((i) => i.party_status === 'PARTY_PROBATION').length;
    const nonParty = filteredItems.filter((i) => i.party_status === 'NON_PARTY').length;
    return [
      { name: 'Đảng viên Chính thức', value: official, color: '#ef4444' },
      { name: 'Đảng viên Dự bị', value: probation, color: '#f59e0b' },
      { name: 'Chưa vào Đảng (Quần chúng)', value: nonParty, color: '#64748b' },
    ].filter((x) => x.value > 0);
  }, [filteredItems]);

  const handleExportPersonalMapExcel = () => {
    if (!filteredItems.length) {
      message.warning('Không có dữ liệu nhân sự để xuất báo cáo');
      return;
    }

    const rows = filteredItems.map((item, idx) => ({
      STT: idx + 1,
      'Họ và tên': item.full_name,
      'Mã viên chức': item.employee_code || '—',
      'Phòng ban / Đơn vị': item.department_name || '—',
      'Ngày sinh': item.date_of_birth ? dayjs(item.date_of_birth).format('DD/MM/YYYY') : '—',
      'Giới tính': item.gender || '—',
      'Tư cách Viên chức': item.official_status_label,
      'Ngạch / Chức danh nghề nghiệp': item.professional_title_name
        ? `${item.professional_title_name} (${item.rank_tier || ''})`
        : '—',
      'Ngày tuyển dụng': item.first_recruitment_date
        ? dayjs(item.first_recruitment_date).format('DD/MM/YYYY')
        : '—',
      'Tư cách Đảng viên CSVN': item.party_status_label,
      'Ngày vào Đảng (Dự bị)': item.cpv_probationary_date
        ? dayjs(item.cpv_probationary_date).format('DD/MM/YYYY')
        : '—',
      'Ngày chuyển Đảng chính thức': item.cpv_official_date
        ? dayjs(item.cpv_official_date).format('DD/MM/YYYY')
        : '—',
      'Số thẻ Đảng viên': item.cpv_card_number || '—',
      'Chức vụ Đảng': item.cpv_current_position || '—',
      'Bậc lương / Hệ số hiện hưởng': item.salary_step
        ? `Bậc ${item.salary_step}/${item.max_step || ''} (HS: ${Number(
            item.salary_coefficient || 0
          ).toFixed(2)})`
        : '—',
      'Ngày đến hạn nâng lương dự kiến': item.salary_next_due_date
        ? dayjs(item.salary_next_due_date).format('DD/MM/YYYY')
        : '—',
      'Tiến trình chu kỳ lương (%)': `${item.salary_progress_percent}%`,
      'Chức vụ quản lý': item.leadership_position || 'Không',
      'Số hồ sơ cảnh báo đến hạn': item.active_alerts_count,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'So_Do_Ho_So_Ca_Nhan');
    XLSX.writeFile(wb, `So_Do_Ca_Nhan_Vien_Chuc_Dang_Vien_${dayjs().format('DDMMYYYY_HHmm')}.xlsx`);
    message.success(`Đã xuất danh sách Sơ đồ Cá nhân (${filteredItems.length} nhân sự)!`);
  };

  const renderOfficialBadge = (item: PersonalProfileMapItem) => {
    if (item.official_status === 'OFFICIAL_VC') {
      return (
        <Tag color="success" icon={<SafetyCertificateOutlined />} style={{ fontWeight: 600 }}>
          🟢 Đã là Viên chức Chính thức
        </Tag>
      );
    }
    if (item.official_status === 'PROBATION_VC') {
      return (
        <Tag color="warning" icon={<ClockCircleOutlined />} style={{ fontWeight: 600 }}>
          🟡 Viên chức Đang tập sự
        </Tag>
      );
    }
    if (item.official_status === 'CONTRACT_STAFF') {
      return (
        <Tag color="processing" icon={<UserOutlined />} style={{ fontWeight: 600 }}>
          🔵 Chưa cập nhật ngạch Viên chức
        </Tag>
      );
    }
    return (
      <Tag color="default" icon={<WarningOutlined />} style={{ fontWeight: 600 }}>
        ⚪ Chưa lập Hồ sơ Viên chức (BNV)
      </Tag>
    );
  };

  const renderPartyBadge = (item: PersonalProfileMapItem) => {
    if (item.party_status === 'PARTY_OFFICIAL') {
      return (
        <Tag color="red" icon={<FlagOutlined />} style={{ fontWeight: 600 }}>
          🚩 Đảng viên Chính thức
          {item.party_seniority_years ? ` (${item.party_seniority_years} năm tuổi Đảng)` : ''}
        </Tag>
      );
    }
    if (item.party_status === 'PARTY_PROBATION') {
      return (
        <Tag color="orange" icon={<FlagOutlined />} style={{ fontWeight: 600 }}>
          🟠 Đảng viên Dự bị (Chờ xét chính thức)
        </Tag>
      );
    }
    return (
      <Tag color="default" icon={<TeamOutlined />}>
        ⚪ Chưa vào Đảng (Quần chúng)
      </Tag>
    );
  };

  if (loading) {
    return (
      <Card style={{ borderRadius: 14, textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
        <div style={{ marginTop: 12 }}>
          <Text type="secondary">
            Đang tải dữ liệu thực tế từ Hồ sơ lý lịch Viên chức (BNV) & Danh sách Nhân sự...
          </Text>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* KHU VỰC 1: 4 THẺ KPI TỔNG QUAN CƠ CẤU VIÊN CHỨC - ĐẢNG VIÊN - HỒ SƠ ĐẾN HẠN */}
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={resetFilters}
            bodyStyle={{ padding: '14px 18px' }}
            style={{
              borderRadius: 14,
              borderLeft: '4px solid #6366f1',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                  👥 TỔNG NHÂN SỰ TRONG ĐƠN VỊ
                </Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#6366f1', margin: '4px 0' }}>
                  {summary?.total_personnel ?? items.length}{' '}
                  <span style={{ fontSize: 14, fontWeight: 500 }}>nhân sự</span>
                </div>
                <Text type="secondary" style={{ fontSize: 11.5 }}>
                  Đối soát trực tiếp từ dữ liệu thực tế hiện có
                </Text>
              </div>
              <TeamOutlined style={{ fontSize: 30, color: '#6366f1', opacity: 0.85 }} />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={() =>
              setOfficialFilter(officialFilter === 'OFFICIAL_VC' ? undefined : 'OFFICIAL_VC')
            }
            bodyStyle={{ padding: '14px 18px' }}
            style={{
              borderRadius: 14,
              borderLeft: '4px solid #10b981',
              outline: officialFilter === 'OFFICIAL_VC' ? '2px solid #10b981' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                  🏛️ TƯ CÁCH VIÊN CHỨC
                </Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981', margin: '4px 0' }}>
                  {summary?.official_vc_count ?? 0}{' '}
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Chính thức</span>
                </div>
                <Space size={4} wrap>
                  <Tag color="gold" style={{ margin: 0, fontSize: 11 }}>
                    Tập sự: {summary?.probation_vc_count ?? 0}
                  </Tag>
                  <Tag style={{ margin: 0, fontSize: 11 }}>
                    Chưa bổ nhiệm/Lập HS: {summary?.non_vc_or_no_profile_count ?? 0}
                  </Tag>
                </Space>
              </div>
              <SafetyCertificateOutlined style={{ fontSize: 30, color: '#10b981', opacity: 0.85 }} />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={() =>
              setPartyFilter(partyFilter === 'PARTY_OFFICIAL' ? undefined : 'PARTY_OFFICIAL')
            }
            bodyStyle={{ padding: '14px 18px' }}
            style={{
              borderRadius: 14,
              borderLeft: '4px solid #ef4444',
              outline: partyFilter === 'PARTY_OFFICIAL' ? '2px solid #ef4444' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                  🚩 TỔ CHỨC ĐẢNG CỘNG SẢN VIỆT NAM
                </Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444', margin: '4px 0' }}>
                  {(summary?.party_official_count ?? 0) + (summary?.party_probation_count ?? 0)}{' '}
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Đảng viên</span>
                </div>
                <Space size={4} wrap>
                  <Tag color="red" style={{ margin: 0, fontSize: 11 }}>
                    Chính thức: {summary?.party_official_count ?? 0}
                  </Tag>
                  <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>
                    Dự bị: {summary?.party_probation_count ?? 0}
                  </Tag>
                  <Tag style={{ margin: 0, fontSize: 11 }}>
                    Chưa vào Đảng: {summary?.non_party_count ?? 0}
                  </Tag>
                </Space>
              </div>
              <FlagOutlined style={{ fontSize: 30, color: '#ef4444', opacity: 0.85 }} />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={() =>
              setAlertStatusFilter(alertStatusFilter === 'ANY_ALERT' ? undefined : 'ANY_ALERT')
            }
            bodyStyle={{ padding: '14px 18px' }}
            style={{
              borderRadius: 14,
              borderLeft: '4px solid #f59e0b',
              outline: alertStatusFilter === 'ANY_ALERT' ? '2px solid #f59e0b' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                  🔔 NHÂN SỰ CÓ HỒ SƠ GẦN TỚI HẠN
                </Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', margin: '4px 0' }}>
                  {(summary?.with_overdue_alert_count ?? 0) +
                    (summary?.with_upcoming_alert_count ?? 0)}{' '}
                  <span style={{ fontSize: 14, fontWeight: 500 }}>người cần lưu ý</span>
                </div>
                <Space size={4} wrap>
                  <Tag color="error" style={{ margin: 0, fontSize: 11 }}>
                    🔥 Quá hạn: {summary?.with_overdue_alert_count ?? 0}
                  </Tag>
                  <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>
                    ⏰ Sắp tới hạn: {summary?.with_upcoming_alert_count ?? 0}
                  </Tag>
                  <Tag color="success" style={{ margin: 0, fontSize: 11 }}>
                    Ổn định: {summary?.safe_cycle_count ?? 0}
                  </Tag>
                </Space>
              </div>
              <BellOutlined style={{ fontSize: 30, color: '#f59e0b', opacity: 0.85 }} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 2 BIỂU ĐỒ TỔNG HỢP VIÊN CHỨC & ĐẢNG VIÊN (CÓ THỂ THU GỌN) */}
      {showOverviewCharts && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={15}>
            <Card
              size="small"
              style={{ borderRadius: 14, height: '100%' }}
              title={
                <Space>
                  <ApartmentOutlined style={{ color: '#6366f1' }} />
                  <Text strong>
                    Sơ đồ Phân bố Viên chức Chính thức • Đảng viên • Hồ sơ tới hạn theo Đơn vị
                  </Text>
                </Space>
              }
              extra={
                <Button type="link" size="small" onClick={() => setShowOverviewCharts(false)}>
                  Thu gọn sơ đồ tổng quan
                </Button>
              }
            >
              <div style={{ width: '100%', height: 225 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={deptMatrixChartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDark ? '#334155' : '#e2e8f0'}
                    />
                    <XAxis
                      dataKey="department"
                      tick={{ fill: isDark ? '#cbd5e1' : '#475569', fontSize: 12 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: isDark ? '#cbd5e1' : '#475569', fontSize: 12 }}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        borderColor: isDark ? '#334155' : '#cbd5e1',
                        borderRadius: 10,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="officialVc"
                      name="Viên chức Chính thức"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="partyMember"
                      name="Đảng viên (Chính thức & Dự bị)"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="hasAlert"
                      name="Có hồ sơ gần tới hạn / quá hạn"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={9}>
            <Card
              size="small"
              style={{ borderRadius: 14, height: '100%' }}
              title={
                <Space>
                  <FlagOutlined style={{ color: '#ef4444' }} />
                  <Text strong>Sơ đồ Cơ cấu Đảng viên CSVN & Quần chúng</Text>
                </Space>
              }
            >
              <div style={{ width: '100%', height: 225 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={partyDonutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={4}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {partyDonutData.map((entry, idx) => (
                        <Cell
                          key={`party-cell-${idx}`}
                          fill={entry.color}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: 11.5 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* KHU VỰC 2: THANH TÌM KIẾM & BỘ LỌC CHUYÊN BIỆT CHO HỒ SƠ CÁ NHÂN */}
      <Card
        bodyStyle={{ padding: '12px 16px' }}
        style={{
          borderRadius: 14,
          marginBottom: 16,
          border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
        }}
      >
        <Row gutter={[10, 10]} justify="space-between" align="middle">
          <Col xs={24} xl={18}>
            <Space wrap size={[8, 8]}>
              <Input
                placeholder="Tìm họ tên, mã VC, số thẻ Đảng, chức danh (hỗ trợ không dấu)..."
                prefix={<SearchOutlined style={{ color: '#6366f1' }} />}
                allowClear
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 265 }}
              />

              <Select
                placeholder="🏢 Phòng ban / Đơn vị"
                allowClear
                value={deptFilter}
                onChange={setDeptFilter}
                style={{ width: 175 }}
                options={departments.map((d) => ({ label: d, value: d }))}
              />

              <Select
                placeholder="🏛️ Tư cách Viên chức"
                allowClear
                value={officialFilter}
                onChange={setOfficialFilter}
                style={{ width: 205 }}
                options={[
                  { label: '🟢 Đã là Viên chức Chính thức', value: 'OFFICIAL_VC' },
                  { label: '🟡 Viên chức Đang tập sự', value: 'PROBATION_VC' },
                  { label: '🔵 Chưa cập nhật ngạch VC', value: 'CONTRACT_STAFF' },
                  { label: '⚪ Chưa lập Hồ sơ HS02-BNV', value: 'NO_VC_PROFILE' },
                ]}
              />

              <Select
                placeholder="🚩 Tư cách Đảng viên"
                allowClear
                value={partyFilter}
                onChange={setPartyFilter}
                style={{ width: 205 }}
                options={[
                  { label: '🔴 Đảng viên Chính thức', value: 'PARTY_OFFICIAL' },
                  { label: '🟠 Đảng viên Dự bị (Chờ chuyển CT)', value: 'PARTY_PROBATION' },
                  { label: '⚪ Chưa vào Đảng (Quần chúng)', value: 'NON_PARTY' },
                ]}
              />

              <Select
                placeholder="🔔 Tình trạng Hồ sơ tới hạn"
                allowClear
                value={alertStatusFilter}
                onChange={setAlertStatusFilter}
                style={{ width: 215 }}
                options={[
                  { label: '🔔 Có hồ sơ gần tới hạn / quá hạn', value: 'ANY_ALERT' },
                  { label: '🔥 Đang có hồ sơ Quá hạn (T-0)', value: 'OVERDUE' },
                  { label: '⏰ Sắp tới hạn (T-90 / T-60 / T-30)', value: 'UPCOMING' },
                  { label: '⚠️ Có bị kỷ luật lùi kỳ xét', value: 'HAS_DISCIPLINE' },
                  { label: '✅ Đang trong chu kỳ ổn định (> 90 ngày)', value: 'SAFE_CYCLE' },
                ]}
              />

              {(search.trim() ||
                deptFilter ||
                officialFilter ||
                partyFilter ||
                alertStatusFilter) && (
                <Button danger size="small" icon={<ClearOutlined />} onClick={resetFilters}>
                  Đặt lại
                </Button>
              )}
            </Space>
          </Col>

          <Col xs={24} xl={6} style={{ textAlign: 'right' }}>
            <Space wrap>
              {!showOverviewCharts && (
                <Button size="small" onClick={() => setShowOverviewCharts(true)}>
                  Hiện sơ đồ tổng quan
                </Button>
              )}
              <Segmented
                value={viewMode}
                onChange={(val) => setViewMode(val as 'CARDS' | 'TABLE')}
                options={[
                  { label: 'Sơ đồ Thẻ 360°', value: 'CARDS', icon: <AppstoreOutlined /> },
                  { label: 'Bảng Ma trận', value: 'TABLE', icon: <TableOutlined /> },
                ]}
              />
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExportPersonalMapExcel}
              >
                Xuất Excel
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KHU VỰC 3: HIỂN THỊ SƠ ĐỒ CÁ NHÂN CỦA TỪNG NGƯỜI (DẠNG LƯỚI THẺ 360° HOẶC BẢNG MA TRẬN) */}
      {filteredItems.length === 0 ? (
        <Card style={{ borderRadius: 14 }}>
          <Empty description="Không tìm thấy nhân sự nào khớp với điều kiện lọc hiện tại" />
        </Card>
      ) : viewMode === 'CARDS' ? (
        <Row gutter={[16, 16]}>
          {filteredItems.map((person) => {
            const borderColor = person.has_overdue_alert
              ? '#ef4444'
              : person.has_upcoming_alert
              ? '#f59e0b'
              : '#10b981';

            return (
              <Col xs={24} xl={12} key={person.id}>
                <Card
                  hoverable
                  bodyStyle={{ padding: '16px 20px' }}
                  style={{
                    borderRadius: 14,
                    borderLeft: `5px solid ${borderColor}`,
                    height: '100%',
                  }}
                >
                  {/* Header của Thẻ Cá nhân: Định danh + Huy hiệu Cảnh báo */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      flexWrap: 'wrap',
                      marginBottom: 12,
                    }}
                  >
                    <Space align="center" size={12}>
                      <Badge dot color={borderColor} offset={[-4, 38]}>
                        <Avatar
                          size={48}
                          src={person.portrait_url}
                          icon={<UserOutlined />}
                          style={{
                            backgroundColor: person.has_overdue_alert
                              ? '#ef4444'
                              : person.party_status === 'PARTY_OFFICIAL'
                              ? '#dc2626'
                              : '#6366f1',
                          }}
                        />
                      </Badge>
                      <div>
                        <Space size={6} wrap>
                          <Text strong style={{ fontSize: 16 }}>
                            {person.full_name}
                          </Text>
                          {person.employee_code && (
                            <Tag color="blue" style={{ margin: 0 }}>
                              {person.employee_code}
                            </Tag>
                          )}
                          {person.leadership_position && (
                            <Tag color="purple" style={{ margin: 0 }}>
                              🏛️ {person.leadership_position}
                            </Tag>
                          )}
                        </Space>
                        <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>
                          {person.department_name || 'Chưa phân phòng'}
                          {person.date_of_birth &&
                            ` • NS: ${dayjs(person.date_of_birth).format('DD/MM/YYYY')}`}
                          {person.gender && ` (${person.gender})`}
                          {person.highest_professional_degree &&
                            ` • ${person.highest_professional_degree}`}
                        </div>
                      </div>
                    </Space>

                    {/* Nhãn báo hiệu Có hồ sơ gần tới hạn hay chưa */}
                    <div>
                      {person.has_overdue_alert ? (
                        <Tag
                          color="error"
                          icon={<ExclamationCircleOutlined />}
                          style={{ fontWeight: 700, padding: '3px 10px', borderRadius: 12 }}
                        >
                          🔥 CÓ {person.active_alerts_count} HỒ SƠ QUÁ HẠN CẦN XỬ LÝ
                        </Tag>
                      ) : person.has_upcoming_alert ? (
                        <Tag
                          color="warning"
                          icon={<ClockCircleOutlined />}
                          style={{ fontWeight: 700, padding: '3px 10px', borderRadius: 12 }}
                        >
                          ⏰ CÓ {person.active_alerts_count} HỒ SƠ GẦN TỚI HẠN
                        </Tag>
                      ) : (
                        <Tag
                          color="success"
                          icon={<CheckCircleOutlined />}
                          style={{ padding: '3px 10px', borderRadius: 12 }}
                        >
                          ✅ CHƯA CÓ HỒ SƠ ĐẾN HẠN (&gt; 90 NGÀY)
                        </Tag>
                      )}
                    </div>
                  </div>

                  {/* 2 Khối Trụ cột song song: (1) ĐÃ LÀ VIÊN CHỨC CHƯA & (2) ĐÃ THUỘC ĐẢNG CHƯA */}
                  <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
                    <Col xs={24} sm={12}>
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          height: '100%',
                          background: isDark ? 'rgba(16, 185, 129, 0.08)' : '#f0fdf4',
                          border: isDark
                            ? '1px solid rgba(16, 185, 129, 0.25)'
                            : '1px solid #bbf7d0',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#10b981',
                            textTransform: 'uppercase',
                            marginBottom: 6,
                          }}
                        >
                          1. Tư cách Viên chức (Thực tế)
                        </div>
                        <div style={{ marginBottom: 6 }}>{renderOfficialBadge(person)}</div>
                        <div style={{ fontSize: 12 }}>
                          <div>
                            <Text type="secondary">Chức danh / Ngạch: </Text>
                            <Text strong>
                              {person.professional_title_name || 'Chưa cập nhật trong HS02'}
                            </Text>{' '}
                            {person.rank_tier && (
                              <Tag style={{ margin: 0 }}>{person.rank_tier}</Tag>
                            )}
                          </div>
                          <div style={{ marginTop: 2 }}>
                            <Text type="secondary">Ngày tuyển dụng: </Text>
                            <Text>
                              {person.first_recruitment_date
                                ? dayjs(person.first_recruitment_date).format('DD/MM/YYYY')
                                : 'Chưa cập nhật'}
                            </Text>
                          </div>
                          {person.official_status === 'PROBATION_VC' &&
                            person.probation_end_date && (
                              <div style={{ marginTop: 4, color: '#f59e0b', fontWeight: 600 }}>
                                ⏳ Hết tập sự:{' '}
                                {dayjs(person.probation_end_date).format('DD/MM/YYYY')} (Còn{' '}
                                {person.probation_days_remaining} ngày)
                              </div>
                            )}
                        </div>
                      </div>
                    </Col>

                    <Col xs={24} sm={12}>
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          height: '100%',
                          background:
                            person.party_status === 'PARTY_OFFICIAL'
                              ? isDark
                                ? 'rgba(239, 68, 68, 0.09)'
                                : '#fef2f2'
                              : person.party_status === 'PARTY_PROBATION'
                              ? isDark
                                ? 'rgba(245, 158, 11, 0.09)'
                                : '#fffbeb'
                              : isDark
                              ? 'rgba(100, 116, 139, 0.12)'
                              : '#f8fafc',
                          border:
                            person.party_status === 'PARTY_OFFICIAL'
                              ? isDark
                                ? '1px solid rgba(239, 68, 68, 0.3)'
                                : '1px solid #fecaca'
                              : person.party_status === 'PARTY_PROBATION'
                              ? isDark
                                ? '1px solid rgba(245, 158, 11, 0.3)'
                                : '1px solid #fde68a'
                              : isDark
                              ? '1px solid #334155'
                              : '1px solid #e2e8f0',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color:
                              person.party_status === 'PARTY_OFFICIAL'
                                ? '#ef4444'
                                : person.party_status === 'PARTY_PROBATION'
                                ? '#f59e0b'
                                : '#64748b',
                            textTransform: 'uppercase',
                            marginBottom: 6,
                          }}
                        >
                          2. Tư cách Đảng viên CSVN (Thực tế)
                        </div>
                        <div style={{ marginBottom: 6 }}>{renderPartyBadge(person)}</div>
                        <div style={{ fontSize: 12 }}>
                          {person.party_status === 'PARTY_OFFICIAL' ? (
                            <>
                              <div>
                                <Text type="secondary">Vào Đảng: </Text>
                                <Text>
                                  {person.cpv_probationary_date
                                    ? dayjs(person.cpv_probationary_date).format('DD/MM/YYYY')
                                    : '—'}
                                </Text>
                                {' • '}
                                <Text type="secondary">Chính thức: </Text>
                                <Text strong>
                                  {person.cpv_official_date
                                    ? dayjs(person.cpv_official_date).format('DD/MM/YYYY')
                                    : '—'}
                                </Text>
                              </div>
                              <div style={{ marginTop: 2 }}>
                                <Text type="secondary">Số thẻ Đảng: </Text>
                                <Text code>{person.cpv_card_number || 'Chưa cập nhật'}</Text>
                                {person.cpv_current_position && (
                                  <span> • {person.cpv_current_position}</span>
                                )}
                              </div>
                            </>
                          ) : person.party_status === 'PARTY_PROBATION' ? (
                            <>
                              <div>
                                <Text type="secondary">Ngày kết nạp (Dự bị): </Text>
                                <Text strong>
                                  {person.cpv_probationary_date
                                    ? dayjs(person.cpv_probationary_date).format('DD/MM/YYYY')
                                    : '—'}
                                </Text>
                              </div>
                              {person.party_official_due_date && (
                                <div style={{ marginTop: 3, color: '#f59e0b', fontWeight: 600 }}>
                                  🔔 Hạn xét chuyển Đảng chính thức (12th):{' '}
                                  {dayjs(person.party_official_due_date).format('DD/MM/YYYY')} (Còn{' '}
                                  {person.party_official_days_remaining} ngày)
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div>
                                <Text type="secondary">Đoàn thể: </Text>
                                <Text>
                                  {person.trade_union_date
                                    ? `Công đoàn (${dayjs(person.trade_union_date).format('DD/MM/YYYY')})`
                                    : person.youth_union_date
                                    ? `Đoàn TNCS (${dayjs(person.youth_union_date).format('DD/MM/YYYY')})`
                                    : 'Chưa cập nhật ngày vào Đảng trong HS02'}
                                </Text>
                              </div>
                              <div style={{ marginTop: 2 }}>
                                <Text type="secondary">Đánh giá: </Text>
                                <Text>{person.evaluation_summary || 'Chưa cập nhật đánh giá'}</Text>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Col>
                  </Row>

                  {/* Khối Trụ cột 3: SƠ ĐỒ TIẾN TRÌNH CHU KỲ & CÁC HỒ SƠ ĐẾN HẠN CỦA CÁ NHÂN */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: isDark ? 'rgba(30, 41, 59, 0.65)' : '#f8fafc',
                      border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#6366f1',
                        textTransform: 'uppercase',
                        marginBottom: 8,
                      }}
                    >
                      3. Sơ đồ Tiến trình Chu kỳ Lương • Nhiệm kỳ & Hồ sơ Tới hạn
                    </div>

                    {/* Thanh Tiến trình 1: Chu kỳ Nâng bậc lương / Vượt khung */}
                    {person.salary_step ? (
                      <div style={{ marginBottom: person.leadership_position ? 10 : 4 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 12,
                            marginBottom: 2,
                          }}
                        >
                          <span>
                            💰 <b>Chu kỳ Lương:</b> Bậc {person.salary_step}/{person.max_step || 9}{' '}
                            (HS: <b>{Number(person.salary_coefficient || 0).toFixed(2)}</b>
                            {Number(person.seniority_exceed_percent || 0) > 0 &&
                              ` • VK: ${person.seniority_exceed_percent}%`}
                            ) • Chu kỳ {person.salary_cycle_months} tháng
                            {person.discipline_delay_months > 0 && (
                              <Tag color="error" style={{ marginLeft: 6, fontSize: 10.5 }}>
                                ⚠️ Kỷ luật lùi +{person.discipline_delay_months}th
                              </Tag>
                            )}
                          </span>
                          <span>
                            {person.salary_next_due_date && (
                              <Text
                                strong
                                style={{
                                  color:
                                    (person.salary_days_remaining ?? 999) <= 0
                                      ? '#ef4444'
                                      : (person.salary_days_remaining ?? 999) <= 90
                                      ? '#f59e0b'
                                      : '#10b981',
                                }}
                              >
                                Hạn: {dayjs(person.salary_next_due_date).format('DD/MM/YYYY')} (
                                {(person.salary_days_remaining ?? 0) <= 0
                                  ? `Quá hạn ${Math.abs(person.salary_days_remaining || 0)} ngày`
                                  : `Còn ${person.salary_days_remaining} ngày`}
                                )
                              </Text>
                            )}
                          </span>
                        </div>
                        <Progress
                          percent={person.salary_progress_percent}
                          size="small"
                          strokeColor={
                            (person.salary_days_remaining ?? 999) <= 0
                              ? '#ef4444'
                              : (person.salary_days_remaining ?? 999) <= 90
                              ? '#f59e0b'
                              : '#10b981'
                          }
                        />
                      </div>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Chưa cập nhật thông tin bậc lương và ngày hưởng lương hiện tại trong HS02.
                      </Text>
                    )}

                    {/* Thanh Tiến trình 2: Nhiệm kỳ Bổ nhiệm Chức vụ Quản lý (nếu có) */}
                    {person.leadership_position && person.reappointment_due_date && (
                      <div style={{ marginTop: 6 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 12,
                            marginBottom: 2,
                          }}
                        >
                          <span>
                            🏛️ <b>Nhiệm kỳ Quản lý (60 tháng):</b> {person.leadership_position}
                            {person.remaining_work_months !== null &&
                              person.remaining_work_months !== undefined && (
                                <Tag
                                  color={person.remaining_work_months < 18 ? 'orange' : 'geekblue'}
                                  style={{ marginLeft: 6, fontSize: 10.5 }}
                                >
                                  {person.remaining_work_months < 18
                                    ? `Còn ${person.remaining_work_months}th đến tuổi hưu (<18th)`
                                    : `Bổ nhiệm lại 5 bước (≥18th)`}
                                </Tag>
                              )}
                          </span>
                          <Text
                            strong
                            style={{
                              color:
                                (person.reappointment_days_remaining ?? 999) <= 90
                                  ? '#f59e0b'
                                  : '#3b82f6',
                            }}
                          >
                            Hạn NK: {dayjs(person.reappointment_due_date).format('DD/MM/YYYY')} (Còn{' '}
                            {person.reappointment_days_remaining} ngày)
                          </Text>
                        </div>
                        <Progress
                          percent={person.reappointment_progress_percent}
                          size="small"
                          strokeColor={
                            (person.reappointment_days_remaining ?? 999) <= 90
                              ? '#f59e0b'
                              : '#3b82f6'
                          }
                        />
                      </div>
                    )}

                    {/* Danh sách các Hồ sơ Cảnh báo Đang mở của Cá nhân */}
                    {person.active_alerts.length > 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          paddingTop: 8,
                          borderTop: isDark ? '1px dashed #334155' : '1px dashed #cbd5e1',
                        }}
                      >
                        <Space wrap size={[6, 6]}>
                          <Text style={{ fontSize: 11.5 }} type="secondary">
                            📌 Hồ sơ đến hạn đang mở ({person.active_alerts.length}):
                          </Text>
                          {person.active_alerts.map((al) => (
                            <Tag
                              key={al.id}
                              color={
                                al.days_remaining <= 0 && !al.is_extended_active
                                  ? 'red'
                                  : al.milestone_code === 'T-30'
                                  ? 'orange'
                                  : 'gold'
                              }
                              style={{ cursor: 'pointer', margin: 0 }}
                              onClick={() => onDrillDownToPersonAlerts(person.full_name)}
                            >
                              {al.alert_category_label} • Hạn:{' '}
                              {dayjs(al.due_date).format('DD/MM/YYYY')} ({al.milestone_code})
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    )}
                  </div>

                  {/* Footer của Thẻ Cá nhân: Các nút thao tác nhanh */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<ApartmentOutlined />}
                      onClick={() => {
                        setSelectedPerson(person);
                        setMindmapDrawerOpen(true);
                      }}
                    >
                      Xem Sơ đồ Cây Cá nhân 360°
                    </Button>

                    <Space size={8}>
                      {person.active_alerts_count > 0 && (
                        <Button
                          size="small"
                          type="primary"
                          danger={person.has_overdue_alert}
                          icon={<ArrowRightOutlined />}
                          onClick={() => onDrillDownToPersonAlerts(person.full_name)}
                        >
                          Xử lý Cảnh báo ({person.active_alerts_count})
                        </Button>
                      )}
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => onOpenBnvProfile(person.user_id)}
                      >
                        Cập nhật Hồ sơ gốc BNV
                      </Button>
                    </Space>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        /* CHẾ ĐỘ 2: BẢNG MA TRẬN TỔNG HỢP VIÊN CHỨC - ĐẢNG VIÊN - HẠN ĐỊNH */
        <Card bodyStyle={{ padding: '12px 16px' }} style={{ borderRadius: 14 }}>
          <Table
            rowKey="id"
            dataSource={filteredItems}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1200 }}
            columns={[
              {
                title: 'Nhân sự & Đơn vị',
                key: 'person',
                width: 230,
                render: (_, r) => (
                  <Space>
                    <Avatar src={r.portrait_url} icon={<UserOutlined />} />
                    <div>
                      <Text strong>{r.full_name}</Text>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        {r.employee_code || '—'} • {r.department_name}
                      </div>
                    </div>
                  </Space>
                ),
              },
              {
                title: '1. Tư cách Viên chức',
                key: 'official',
                width: 240,
                render: (_, r) => (
                  <div>
                    {renderOfficialBadge(r)}
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      {r.professional_title_name || '—'} {r.rank_tier ? `(${r.rank_tier})` : ''}
                    </div>
                  </div>
                ),
              },
              {
                title: '2. Tư cách Đảng viên CSVN',
                key: 'party',
                width: 240,
                render: (_, r) => (
                  <div>
                    {renderPartyBadge(r)}
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      {r.party_status === 'PARTY_OFFICIAL'
                        ? `Thẻ Đảng: ${r.cpv_card_number || '—'} • ${
                            r.cpv_current_position || 'Đảng viên'
                          }`
                        : r.party_status === 'PARTY_PROBATION'
                        ? `Hạn chuyển CT: ${
                            r.party_official_due_date
                              ? dayjs(r.party_official_due_date).format('DD/MM/YYYY')
                              : '—'
                          }`
                        : 'Chưa cập nhật ngày vào Đảng'}
                    </div>
                  </div>
                ),
              },
              {
                title: '3. Tiến trình Chu kỳ Lương & Hạn định',
                key: 'cycle',
                width: 280,
                render: (_, r) => (
                  <div>
                    {r.salary_step ? (
                      <>
                        <div style={{ fontSize: 12 }}>
                          Bậc {r.salary_step}/{r.max_step || 9} (HS:{' '}
                          <b>{Number(r.salary_coefficient || 0).toFixed(2)}</b>) → Hạn:{' '}
                          <b>
                            {r.salary_next_due_date
                              ? dayjs(r.salary_next_due_date).format('DD/MM/YYYY')
                              : '—'}
                          </b>
                        </div>
                        <Progress
                          percent={r.salary_progress_percent}
                          size="small"
                          strokeColor={
                            r.has_overdue_alert
                              ? '#ef4444'
                              : r.has_upcoming_alert
                              ? '#f59e0b'
                              : '#10b981'
                          }
                        />
                      </>
                    ) : (
                      <Text type="secondary">Chưa có dữ liệu bậc lương</Text>
                    )}
                  </div>
                ),
              },
              {
                title: 'Hồ sơ Gần tới hạn',
                key: 'alerts',
                width: 190,
                render: (_, r) =>
                  r.active_alerts_count > 0 ? (
                    <Space direction="vertical" size={2}>
                      <Tag color={r.has_overdue_alert ? 'error' : 'warning'}>
                        {r.has_overdue_alert ? '🔥 Quá hạn' : '⏰ Sắp tới hạn'} (
                        {r.active_alerts_count} HS)
                      </Tag>
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0 }}
                        onClick={() => onDrillDownToPersonAlerts(r.full_name)}
                      >
                        Đi tới xử lý →
                      </Button>
                    </Space>
                  ) : (
                    <Tag color="success">✅ Trong hạn an toàn</Tag>
                  ),
              },
              {
                title: 'Sơ đồ 360°',
                key: 'action',
                width: 130,
                render: (_, r) => (
                  <Button
                    size="small"
                    icon={<ApartmentOutlined />}
                    onClick={() => {
                      setSelectedPerson(r);
                      setMindmapDrawerOpen(true);
                    }}
                  >
                    Sơ đồ Cây
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* DRAWER SƠ ĐỒ CÂY CÁ NHÂN 360° (VISUAL MINDMAP 4 NHÁNH CỦA TỪNG VIÊN CHỨC) */}
      <Drawer
        title={
          <Space>
            <ApartmentOutlined style={{ color: '#6366f1', fontSize: 20 }} />
            <span>
              Sơ đồ Cây Hồ sơ Cá nhân 360° — <b>{selectedPerson?.full_name}</b>
            </span>
          </Space>
        }
        width={780}
        open={mindmapDrawerOpen}
        onClose={() => setMindmapDrawerOpen(false)}
      >
        {selectedPerson && (
          <div>
            {/* Nút Trung tâm (Center Node): Định danh Viên chức */}
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 14,
                background: isDark
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(139,92,246,0.15))'
                  : 'linear-gradient(135deg, #eef2ff, #f5f3ff)',
                border: '2px solid #6366f1',
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              <Avatar
                size={60}
                src={selectedPerson.portrait_url}
                icon={<UserOutlined />}
                style={{ backgroundColor: '#6366f1', marginBottom: 8 }}
              />
              <Title level={4} style={{ margin: 0 }}>
                {selectedPerson.full_name}{' '}
                {selectedPerson.employee_code && (
                  <Tag color="geekblue">{selectedPerson.employee_code}</Tag>
                )}
              </Title>
              <Text type="secondary">
                {selectedPerson.department_name} •{' '}
                {selectedPerson.leadership_position ||
                  selectedPerson.professional_title_name ||
                  'Nhân sự'}
              </Text>
              <div style={{ marginTop: 10 }}>
                <Space wrap style={{ justifyContent: 'center' }}>
                  {renderOfficialBadge(selectedPerson)}
                  {renderPartyBadge(selectedPerson)}
                  {selectedPerson.active_alerts_count > 0 ? (
                    <Tag color="error">
                      🔔 Đang có {selectedPerson.active_alerts_count} hồ sơ cảnh báo đến hạn
                    </Tag>
                  ) : (
                    <Tag color="success">✅ Không có hồ sơ quá hạn</Tag>
                  )}
                </Space>
              </div>
            </div>

            {/* 4 NHÁNH SƠ ĐỒ TƯ DUY CÁ NHÂN */}
            <Row gutter={[14, 14]}>
              {/* Nhánh 1: Tư cách Viên chức & Tuyển dụng */}
              <Col xs={24} md={12}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 12,
                    borderTop: '4px solid #10b981',
                    height: '100%',
                  }}
                  title={
                    <Space>
                      <SafetyCertificateOutlined style={{ color: '#10b981' }} />
                      <Text strong>Nhánh 1: Tư cách Viên chức & Tuyển dụng</Text>
                    </Space>
                  }
                >
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Trạng thái Viên chức">
                      {renderOfficialBadge(selectedPerson)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Chức danh nghề nghiệp">
                      {selectedPerson.professional_title_name || 'Chưa cập nhật'}{' '}
                      {selectedPerson.professional_title_code &&
                        `(${selectedPerson.professional_title_code})`}
                    </Descriptions.Item>
                    <Descriptions.Item label="Hạng CDNN & Chu kỳ">
                      {selectedPerson.rank_tier || 'Chưa phân hạng'} (Chu kỳ:{' '}
                      {selectedPerson.salary_cycle_months} tháng)
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày tuyển dụng lần đầu">
                      {selectedPerson.first_recruitment_date
                        ? dayjs(selectedPerson.first_recruitment_date).format('DD/MM/YYYY')
                        : 'Chưa cập nhật'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Trình độ chuyên môn">
                      {selectedPerson.highest_professional_degree || 'Chưa cập nhật'}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>

              {/* Nhánh 2: Tổ chức Đảng CSVN & Chính trị */}
              <Col xs={24} md={12}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 12,
                    borderTop: '4px solid #ef4444',
                    height: '100%',
                  }}
                  title={
                    <Space>
                      <FlagOutlined style={{ color: '#ef4444' }} />
                      <Text strong>Nhánh 2: Tổ chức Đảng CSVN & Chính trị</Text>
                    </Space>
                  }
                >
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Tư cách Đảng viên">
                      {renderPartyBadge(selectedPerson)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày vào Đảng (Dự bị)">
                      {selectedPerson.cpv_probationary_date
                        ? dayjs(selectedPerson.cpv_probationary_date).format('DD/MM/YYYY')
                        : 'Chưa kết nạp'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày chuyển chính thức">
                      {selectedPerson.cpv_official_date
                        ? dayjs(selectedPerson.cpv_official_date).format('DD/MM/YYYY')
                        : selectedPerson.party_official_due_date
                        ? `Dự kiến: ${dayjs(selectedPerson.party_official_due_date).format(
                            'DD/MM/YYYY'
                          )}`
                        : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Số thẻ Đảng & Chức vụ">
                      {selectedPerson.cpv_card_number || '—'}{' '}
                      {selectedPerson.cpv_current_position &&
                        `• ${selectedPerson.cpv_current_position}`}
                    </Descriptions.Item>
                    <Descriptions.Item label="Lý luận chính trị">
                      {selectedPerson.political_theory_level || 'Chưa cập nhật'}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>

              {/* Nhánh 3: Diễn biến Lương & Chức vụ Quản lý */}
              <Col xs={24} md={12}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 12,
                    borderTop: '4px solid #3b82f6',
                    height: '100%',
                  }}
                  title={
                    <Space>
                      <TrophyOutlined style={{ color: '#3b82f6' }} />
                      <Text strong>Nhánh 3: Lương, Chức vụ & Lộ trình Nghỉ hưu</Text>
                    </Space>
                  }
                >
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Bậc lương & Hệ số">
                      {selectedPerson.salary_step
                        ? `Bậc ${selectedPerson.salary_step}/${selectedPerson.max_step || 9} — Hệ số: ${Number(
                            selectedPerson.salary_coefficient || 0
                          ).toFixed(2)}`
                        : 'Chưa cập nhật'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày hưởng bậc hiện tại">
                      {selectedPerson.salary_effective_date
                        ? dayjs(selectedPerson.salary_effective_date).format('DD/MM/YYYY')
                        : 'Chưa cập nhật'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày đến hạn nâng lương">
                      <Text strong style={{ color: '#ef4444' }}>
                        {selectedPerson.salary_next_due_date
                          ? dayjs(selectedPerson.salary_next_due_date).format('DD/MM/YYYY')
                          : '—'}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Chức vụ lãnh đạo">
                      {selectedPerson.leadership_position || 'Không giữ chức vụ quản lý'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Dự kiến nghỉ hưu">
                      {selectedPerson.retirement_date
                        ? `${dayjs(selectedPerson.retirement_date).format('DD/MM/YYYY')} (Còn ${
                            selectedPerson.remaining_work_months
                          } tháng công tác)`
                        : 'Chưa cập nhật ngày sinh'}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>

              {/* Nhánh 4: Hồ sơ Cảnh báo Đến hạn & Đánh giá */}
              <Col xs={24} md={12}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 12,
                    borderTop: '4px solid #f59e0b',
                    height: '100%',
                  }}
                  title={
                    <Space>
                      <BellOutlined style={{ color: '#f59e0b' }} />
                      <Text strong>
                        Nhánh 4: Hồ sơ Gần tới hạn ({selectedPerson.active_alerts_count})
                      </Text>
                    </Space>
                  }
                >
                  {selectedPerson.active_alerts.length === 0 ? (
                    <Alert
                      type="success"
                      showIcon
                      message="Nhân sự hiện không có hồ sơ cảnh báo nào đến hạn trong 90 ngày tới."
                    />
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      {selectedPerson.active_alerts.map((al) => (
                        <Alert
                          key={al.id}
                          type={al.days_remaining <= 0 ? 'error' : 'warning'}
                          showIcon
                          message={
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <Text strong>{al.alert_category_label}</Text>
                              <Tag color={al.badge_color}>{al.milestone_code}</Tag>
                            </div>
                          }
                          description={
                            <div style={{ fontSize: 12 }}>
                              <div>
                                Hạn hưởng chế độ:{' '}
                                <b>{dayjs(al.due_date).format('DD/MM/YYYY')}</b> • Trạng thái:{' '}
                                <b>{al.workflow_status}</b>
                              </div>
                              <Button
                                type="link"
                                size="small"
                                style={{ padding: 0, marginTop: 4 }}
                                onClick={() => {
                                  setMindmapDrawerOpen(false);
                                  onDrillDownToPersonAlerts(selectedPerson.full_name);
                                }}
                              >
                                Mở bàn làm việc để Duyệt / Gia hạn / Xử lý ngay →
                              </Button>
                            </div>
                          }
                        />
                      ))}
                    </Space>
                  )}
                </Card>
              </Col>
            </Row>

            <Divider />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button
                icon={<FileProtectOutlined />}
                onClick={() => {
                  setMindmapDrawerOpen(false);
                  onOpenBnvProfile(selectedPerson.user_id);
                }}
              >
                Mở & Cập nhật Hồ sơ Lý lịch Gốc (Mẫu HS02-VC/BNV)
              </Button>
              {selectedPerson.active_alerts_count > 0 && (
                <Button
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  onClick={() => {
                    setMindmapDrawerOpen(false);
                    onDrillDownToPersonAlerts(selectedPerson.full_name);
                  }}
                >
                  Đi tới Xử lý Cảnh báo của {selectedPerson.full_name}
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

