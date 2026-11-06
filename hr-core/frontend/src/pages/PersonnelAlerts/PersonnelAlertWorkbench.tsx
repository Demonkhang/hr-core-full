import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PersonnelAlertChartsView } from './PersonnelAlertChartsView';
import { PersonnelPersonalMapView } from './PersonnelPersonalMapView';

import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Avatar,
  Typography,
  Row,
  Col,
  Tabs,
  Modal,
  Form,
  DatePicker,
  InputNumber,
  Upload,
  Tooltip,
  Badge,
  Alert,
  Drawer,
  Descriptions,
  Divider,
  Radio,
  Timeline,
  Dropdown,
  message,
} from 'antd';
import {
  BellOutlined,
  SearchOutlined,
  SyncOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileProtectOutlined,
  UploadOutlined,
  UserOutlined,
  BookOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  RiseOutlined,
  WarningOutlined,
  ArrowRightOutlined,
  EyeOutlined,
  FilePdfOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  PauseCircleOutlined,
  HistoryOutlined,
  MoreOutlined,
  CalendarOutlined,
  BarChartOutlined,
  UnorderedListOutlined,
  FilterOutlined,
  ClearOutlined,
  SortAscendingOutlined,
  ThunderboltOutlined,
  IdcardOutlined,
} from '@ant-design/icons';

import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { personnelAlertService } from '@/services/personnelAlertService';
import type {
  PersonnelAlertItem,
  PersonnelAlertKpiSummary,
  AlertWorkflowStatusType,
} from '@/types/personnelAlert';
import { useSetPageTitle } from '@/components/Layout/AppLayout';
import { useTheme } from '@/context/ThemeContext';
import { ROUTES } from '@/utils/constants';

const { Text, Title } = Typography;

const EXTENSION_REASON_TEMPLATES = [
  'Chờ lịch họp Hội đồng xét nâng bậc lương / Tập thể Lãnh đạo đơn vị',
  'Chờ viên chức bổ sung Bản tự nhận xét đánh giá nhiệm kỳ / Kê khai tài sản',
  'Đang chờ xác minh văn bằng, chứng chỉ hoặc thẩm định tiêu chuẩn chính trị',
  'Trả lại chuyên viên rà soát lại thời gian giữ bậc và hệ số lương',
];

const REJECTION_REASON_TEMPLATES = [
  'Xếp loại Không hoàn thành nhiệm vụ trong năm công tác (Kéo dài thêm 06 tháng theo TT 08/2013/TT-BNV)',
  'Phát sinh quyết định kỷ luật Khiển trách trong chu kỳ xét (Kéo dài thêm 03 tháng)',
  'Phát sinh quyết định kỷ luật Cảnh cáo trong chu kỳ xét (Kéo dài thêm 06 tháng)',
  'Không đạt trên 50% phiếu tín nhiệm tại Hội nghị lấy phiếu bổ nhiệm lại',
  'Viên chức có đơn xin thôi giữ chức vụ lãnh đạo, quản lý / Chờ bố trí công tác khác',
];

/**
 * Chuẩn hóa chuỗi tiếng Việt (bỏ dấu + lowercase) để hỗ trợ tìm kiếm có dấu & không dấu
 */
function normalizeSearchText(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function PersonnelAlertWorkbench() {
  useSetPageTitle('Bàn làm việc Cán bộ - Cảnh báo Đến hạn');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDark } = useTheme();

  const activeViewTab =
    searchParams.get('tab') === 'charts'
      ? 'charts'
      : searchParams.get('tab') === 'profiles'
      ? 'profiles'
      : 'list';

  const [items, setItems] = useState<PersonnelAlertItem[]>([]);
  const [summary, setSummary] = useState<PersonnelAlertKpiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // Bộ lọc đa chiều (Cơ bản & Nâng cao)
  const [categoryTab, setCategoryTab] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE_ONLY');
  const [deptFilter, setDeptFilter] = useState<string | undefined>(undefined);
  const [milestoneFilter, setMilestoneFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState<string>('');
  const [searchScope, setSearchScope] = useState<string>('ALL');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(true);
  const [specialConditionFilter, setSpecialConditionFilter] = useState<string | undefined>(undefined);
  const [rankTierFilter, setRankTierFilter] = useState<string | undefined>(undefined);
  const [cycleMonthsFilter, setCycleMonthsFilter] = useState<number | undefined>(undefined);
  const [evalFilter, setEvalFilter] = useState<string | undefined>(undefined);
  const [genderFilter, setGenderFilter] = useState<string | undefined>(undefined);
  const [dueDateRange, setDueDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(
    null
  );
  const [sortBy, setSortBy] = useState<string>('DUE_ASC');

  const resetAllFilters = () => {
    setCategoryTab('ALL');
    setStatusFilter('ACTIVE_ONLY');
    setDeptFilter(undefined);
    setMilestoneFilter(undefined);
    setSearch('');
    setSearchScope('ALL');
    setSpecialConditionFilter(undefined);
    setRankTierFilter(undefined);
    setCycleMonthsFilter(undefined);
    setEvalFilter(undefined);
    setGenderFilter(undefined);
    setDueDateRange(null);
    setSortBy('DUE_ASC');
  };

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (specialConditionFilter) count++;
    if (rankTierFilter) count++;
    if (cycleMonthsFilter !== undefined) count++;
    if (evalFilter) count++;
    if (genderFilter) count++;
    if (dueDateRange && (dueDateRange[0] || dueDateRange[1])) count++;
    return count;
  }, [
    specialConditionFilter,
    rankTierFilter,
    cycleMonthsFilter,
    evalFilter,
    genderFilter,
    dueDateRange,
  ]);

  const hasAnyActiveFilter = useMemo(() => {
    return (
      categoryTab !== 'ALL' ||
      statusFilter !== 'ACTIVE_ONLY' ||
      Boolean(deptFilter) ||
      Boolean(milestoneFilter) ||
      Boolean(search.trim()) ||
      activeAdvancedFilterCount > 0 ||
      sortBy !== 'DUE_ASC'
    );
  }, [
    categoryTab,
    statusFilter,
    deptFilter,
    milestoneFilter,
    search,
    activeAdvancedFilterCount,
    sortBy,
  ]);

  // Chọn dòng để thao tác hàng loạt & Xuất danh sách họp Hội đồng
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 1: Duyệt & Ban hành Quyết định sang Bước 4 (COMPLETED)
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState<PersonnelAlertItem | null>(null);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ file_url: string; file_name: string } | null>(null);
  const [decisionForm] = Form.useForm();

  // Modal 2: Gia hạn thời gian xử lý hồ sơ (Administrative Extension)
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [submittingExtend, setSubmittingExtend] = useState(false);
  const [extendForm] = Form.useForm();

  // Modal 3: Từ chối ban hành / Lùi kỳ xét (Rejection Flow)
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [submittingReject, setSubmittingReject] = useState(false);
  const [rejectForm] = Form.useForm();

  // Modal 4: Trả lại Bước trước (Rollback) hoặc Tạm hoãn (ON_HOLD)
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [submittingRollback, setSubmittingRollback] = useState(false);
  const [rollbackForm] = Form.useForm();

  // Drawer 5: Nhật ký Vết Xử lý Hồ sơ (Audit Timeline) & Sổ tay Nghiệp vụ
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const data = await personnelAlertService.getDashboard();
      setItems(data.items);
      setSummary(data.summary);
    } catch {
      message.error('Không thể tải dữ liệu cảnh báo nghiệp vụ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleManualScan = async () => {
    setScanning(true);
    try {
      const data = await personnelAlertService.manualScan();
      setItems(data.items);
      setSummary(data.summary);
      message.success('Đã rà soát toàn bộ hồ sơ viên chức và cập nhật cảnh báo mới nhất!');
    } catch {
      message.error('Lỗi khi rà soát hồ sơ');
    } finally {
      setScanning(false);
    }
  };

  const departments = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((i) => {
      if (i.department_name && i.workflow_status !== 'COMPLETED' && i.workflow_status !== 'REJECTED') {
        map.set(i.department_name, (map.get(i.department_name) || 0) + 1);
      }
    });
    const allDepts = Array.from(new Set(items.map((i) => i.department_name).filter(Boolean) as string[]));
    return allDepts.map((name) => ({ name, count: map.get(name) || 0 }));
  }, [items]);

  // Bộ đếm cho các nút Lọc nhanh 1 chạm (Quick Filter Chips)
  const quickCounts = useMemo(() => {
    const activeList = items.filter(
      (i) => i.workflow_status !== 'COMPLETED' && i.workflow_status !== 'REJECTED'
    );
    return {
      overdueNow: activeList.filter((i) => i.days_remaining <= 0 && !i.is_extended_active).length,
      dueWithin30d: activeList.filter((i) => i.days_remaining > 0 && i.days_remaining <= 30).length,
      hasDiscipline: activeList.filter(
        (i) => (i.discipline_delay_months || 0) + (i.penalty_delay_months || 0) > 0
      ).length,
      maxStepExceed: activeList.filter(
        (i) =>
          i.alert_category === 'SALARY_EXCEED' ||
          (i.current_step && i.max_step && i.current_step >= i.max_step)
      ).length,
      earlyReward: activeList.filter(
        (i) => (i.early_bonus_months || 0) > 0 || i.alert_category === 'SALARY_EARLY'
      ).length,
      retireUnder18m: activeList.filter((i) => i.alert_category === 'EXTEND_TO_RETIREMENT').length,
      extendedActive: activeList.filter((i) => i.is_extended_active).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const matched = items.filter((item) => {
      if (categoryTab !== 'ALL') {
        if (item.alert_category !== categoryTab) return false;
      }

      if (statusFilter === 'ACTIVE_ONLY') {
        if (item.workflow_status === 'COMPLETED' || item.workflow_status === 'REJECTED') {
          return false;
        }
      } else if (statusFilter === 'WAITING') {
        if (
          item.workflow_status !== 'WAITING' ||
          (item.days_remaining <= 0 && !item.is_extended_active)
        ) {
          return false;
        }
      } else if (statusFilter === 'IN_PROGRESS') {
        if (item.workflow_status !== 'IN_PROGRESS') return false;
      } else if (statusFilter === 'OVERDUE_OR_PENDING') {
        if (
          item.workflow_status === 'COMPLETED' ||
          item.workflow_status === 'REJECTED' ||
          item.workflow_status === 'ON_HOLD' ||
          ((item.days_remaining > 0 || item.is_extended_active) &&
            item.workflow_status !== 'PENDING_DECISION')
        ) {
          return false;
        }
      } else if (statusFilter === 'EXTENDED_ONLY') {
        if (!item.is_extended_active && (item.extension_count || 0) === 0) return false;
      } else if (statusFilter === 'ON_HOLD_OR_REJECTED') {
        if (item.workflow_status !== 'ON_HOLD' && item.workflow_status !== 'REJECTED') {
          return false;
        }
      } else if (statusFilter === 'COMPLETED') {
        if (item.workflow_status !== 'COMPLETED') return false;
      }

      if (deptFilter && item.department_name !== deptFilter) {
        return false;
      }

      if (milestoneFilter && item.milestone_code !== milestoneFilter) {
        return false;
      }

      // Lọc theo Tình trạng / Yếu tố đối soát đặc biệt
      if (specialConditionFilter) {
        const totalDelay = (item.discipline_delay_months || 0) + (item.penalty_delay_months || 0);
        if (specialConditionFilter === 'HAS_DISCIPLINE' && totalDelay <= 0) return false;
        if (specialConditionFilter === 'CLEAN_RECORD' && totalDelay > 0) return false;
        if (
          specialConditionFilter === 'MAX_STEP_EXCEED' &&
          item.alert_category !== 'SALARY_EXCEED' &&
          !(item.current_step && item.max_step && item.current_step >= item.max_step)
        ) {
          return false;
        }
        if (
          specialConditionFilter === 'HAS_REWARD_EARLY' &&
          (item.early_bonus_months || 0) <= 0 &&
          item.alert_category !== 'SALARY_EARLY'
        ) {
          return false;
        }
        if (
          specialConditionFilter === 'OVERDUE_NOW' &&
          !(item.days_remaining <= 0 && !item.is_extended_active)
        ) {
          return false;
        }
        if (
          specialConditionFilter === 'DUE_WITHIN_30D' &&
          !(item.days_remaining > 0 && item.days_remaining <= 30)
        ) {
          return false;
        }
        if (specialConditionFilter === 'EXTENDED_ACTIVE' && !item.is_extended_active) {
          return false;
        }
        if (
          specialConditionFilter === 'UNDER_18M_RETIRE' &&
          item.alert_category !== 'EXTEND_TO_RETIREMENT'
        ) {
          return false;
        }
      }

      // Lọc theo Hạng chức danh nghề nghiệp
      if (rankTierFilter) {
        if (rankTierFilter === 'LEADERSHIP') {
          if (
            item.alert_category !== 'REAPPOINTMENT' &&
            item.alert_category !== 'EXTEND_TO_RETIREMENT' &&
            !item.leadership_position
          ) {
            return false;
          }
        } else if ((item.rank_tier || '') !== rankTierFilter) {
          return false;
        }
      }

      // Lọc theo Chu kỳ giữ bậc / Nhiệm kỳ (tháng)
      if (cycleMonthsFilter !== undefined) {
        if (item.standard_cycle_months !== cycleMonthsFilter) return false;
      }

      // Lọc theo Kết quả đánh giá viên chức
      if (evalFilter) {
        const evalNorm = normalizeSearchText(item.evaluation_summary);
        if (evalFilter === 'XUAT_SAC' && !evalNorm.includes('xuat sac')) return false;
        if (evalFilter === 'TOT' && !evalNorm.includes('hoan thanh tot')) return false;
        if (
          evalFilter === 'HOAN_THANH' &&
          (!evalNorm.includes('hoan thanh nhiem vu') || evalNorm.includes('khong hoan thanh'))
        ) {
          return false;
        }
        if (evalFilter === 'KHONG_HOAN_THANH' && !evalNorm.includes('khong hoan thanh')) {
          return false;
        }
      }

      // Lọc theo Giới tính
      if (genderFilter && item.gender !== genderFilter) {
        return false;
      }

      // Lọc theo Khoảng Ngày đến hạn
      if (dueDateRange && (dueDateRange[0] || dueDateRange[1])) {
        const dueDay = dayjs(item.due_date).startOf('day');
        if (dueDateRange[0] && dueDay.isBefore(dueDateRange[0].startOf('day'))) {
          return false;
        }
        if (dueDateRange[1] && dueDay.isAfter(dueDateRange[1].endOf('day'))) {
          return false;
        }
      }

      // Tìm kiếm từ khóa thông minh (Hỗ trợ có dấu & không dấu tiếng Việt, theo phạm vi)
      if (search.trim()) {
        const qNorm = normalizeSearchText(search);
        const qRaw = search.toLowerCase().trim();

        const checkField = (val?: string | number | null) => {
          if (val === undefined || val === null) return false;
          const s = String(val);
          return s.toLowerCase().includes(qRaw) || normalizeSearchText(s).includes(qNorm);
        };

        if (searchScope === 'EMPLOYEE') {
          if (!checkField(item.full_name) && !checkField(item.employee_code)) return false;
        } else if (searchScope === 'POSITION') {
          if (
            !checkField(item.professional_title_name) &&
            !checkField(item.professional_title_code) &&
            !checkField(item.leadership_position) &&
            !checkField(item.department_name) &&
            !checkField(item.rank_tier)
          ) {
            return false;
          }
        } else if (searchScope === 'DECISION') {
          if (
            !checkField(item.decision_number) &&
            !checkField(item.process_notes) &&
            !checkField(item.extension_reason) &&
            !checkField(item.rejection_reason)
          ) {
            return false;
          }
        } else if (searchScope === 'DISCIPLINE_REWARD') {
          if (
            !checkField(item.discipline_details) &&
            !checkField(item.reward_details) &&
            !checkField(item.evaluation_summary)
          ) {
            return false;
          }
        } else {
          // ALL fields
          const match =
            checkField(item.full_name) ||
            checkField(item.employee_code) ||
            checkField(item.department_name) ||
            checkField(item.professional_title_name) ||
            checkField(item.professional_title_code) ||
            checkField(item.rank_tier) ||
            checkField(item.leadership_position) ||
            checkField(item.decision_number) ||
            checkField(item.process_notes) ||
            checkField(item.discipline_details) ||
            checkField(item.reward_details) ||
            checkField(item.evaluation_summary) ||
            checkField(item.alert_category_label) ||
            checkField(item.current_coefficient) ||
            checkField(item.proposed_coefficient);
          if (!match) return false;
        }
      }

      return true;
    });

    // Sắp xếp danh sách sau khi lọc
    return [...matched].sort((a, b) => {
      if (sortBy === 'DUE_ASC') {
        return a.days_remaining - b.days_remaining;
      }
      if (sortBy === 'DUE_DESC') {
        return b.days_remaining - a.days_remaining;
      }
      if (sortBy === 'COEFF_DESC') {
        return Number(b.current_coefficient || 0) - Number(a.current_coefficient || 0);
      }
      if (sortBy === 'COEFF_ASC') {
        return Number(a.current_coefficient || 0) - Number(b.current_coefficient || 0);
      }
      if (sortBy === 'NAME_ASC') {
        return (a.full_name || '').localeCompare(b.full_name || '', 'vi');
      }
      if (sortBy === 'DELAY_DESC') {
        const delayA = (a.discipline_delay_months || 0) + (a.penalty_delay_months || 0);
        const delayB = (b.discipline_delay_months || 0) + (b.penalty_delay_months || 0);
        return delayB - delayA;
      }
      return 0;
    });
  }, [
    items,
    categoryTab,
    statusFilter,
    deptFilter,
    milestoneFilter,
    specialConditionFilter,
    rankTierFilter,
    cycleMonthsFilter,
    evalFilter,
    genderFilter,
    dueDateRange,
    search,
    searchScope,
    sortBy,
  ]);

  const handleBatchStatusChange = async (
    newStatus: AlertWorkflowStatusType,
    defaultNote: string
  ) => {
    if (!selectedRowKeys.length) {
      message.warning('Vui lòng tích chọn ít nhất 1 viên chức trong danh sách');
      return;
    }
    try {
      const data = await personnelAlertService.batchUpdateStatus(
        selectedRowKeys.map(String),
        newStatus,
        defaultNote
      );
      setItems(data.items);
      setSummary(data.summary);
      setSelectedRowKeys([]);
      message.success(`Đã cập nhật trạng thái cho ${selectedRowKeys.length} hồ sơ cảnh báo!`);
    } catch {
      message.error('Không thể cập nhật trạng thái');
    }
  };

  /**
   * Xuất dữ liệu họp Hội đồng (.xlsx)
   */
  const handleExportCouncilList = async () => {
    const targetRecords =
      selectedRowKeys.length > 0
        ? filteredItems.filter((i) => selectedRowKeys.includes(i.id))
        : filteredItems.filter((i) => i.workflow_status !== 'COMPLETED');

    if (!targetRecords.length) {
      message.warning('Không có dữ liệu cảnh báo để xuất biểu mẫu');
      return;
    }

    const exportRows = targetRecords.map((item, idx) => {
      const isApp =
        item.alert_category === 'REAPPOINTMENT' ||
        item.alert_category === 'EXTEND_TO_RETIREMENT';

      return {
        STT: idx + 1,
        'Họ và tên': item.full_name,
        'Mã viên chức': item.employee_code || '—',
        'Ngày sinh': item.date_of_birth ? dayjs(item.date_of_birth).format('DD/MM/YYYY') : '—',
        'Giới tính': item.gender || '—',
        'Phòng ban / Đơn vị': item.department_name || '—',
        'Loại nghiệp vụ xét duyệt': item.alert_category_label,
        'Chức danh nghề nghiệp / Chức vụ': isApp
          ? item.leadership_position || '—'
          : `${item.professional_title_name || '—'} (${item.rank_tier || ''})`,
        'Bậc lương hiện tại': item.current_step ? `Bậc ${item.current_step}/${item.max_step || ''}` : '—',
        'Hệ số lương hiện hưởng': item.current_coefficient ? Number(item.current_coefficient).toFixed(2) : '—',
        'PC vượt khung hiện hưởng (%)': item.current_exceed_percent
          ? `${Number(item.current_exceed_percent)}%`
          : '0%',
        'Ngày hưởng bậc / Ngày bổ nhiệm cũ': dayjs(item.cycle_start_date).format('DD/MM/YYYY'),
        'Thời gian giữ bậc / Nhiệm kỳ (tháng)': `${item.standard_cycle_months} tháng`,
        'Kỷ luật / Lùi kỳ xét (tháng)':
          item.discipline_delay_months + (item.penalty_delay_months || 0) > 0
            ? `+${item.discipline_delay_months + (item.penalty_delay_months || 0)} tháng`
            : 'Không',
        'Ngày đến hạn hưởng chế độ': dayjs(item.due_date).format('DD/MM/YYYY'),
        'Hạn gia hạn xử lý (nếu có)': item.extended_deadline
          ? dayjs(item.extended_deadline).format('DD/MM/YYYY')
          : '—',
        'Bậc lương mới đề xuất': isApp
          ? '—'
          : item.proposed_step
          ? `Bậc ${item.proposed_step}/${item.max_step || ''}`
          : '—',
        'Hệ số lương mới đề xuất': isApp
          ? '—'
          : item.proposed_coefficient
          ? Number(item.proposed_coefficient).toFixed(2)
          : '—',
        'PC vượt khung mới đề xuất (%)':
          item.alert_category === 'SALARY_EXCEED' && item.proposed_exceed_percent
            ? `${Number(item.proposed_exceed_percent)}%`
            : '0%',
        'Kết quả đánh giá các năm': item.evaluation_summary || 'Hoàn thành tốt nhiệm vụ',
        'Trạng thái hồ sơ': item.workflow_status,
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_De_Xuat_Hoi_Dong');
    const fileName = `Bieu_Mau_Hoi_Dong_Luong_Bo_Nhiem_${dayjs().format('DDMMYYYY_HHmm')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    const waitingIds = targetRecords
      .filter((r) => r.workflow_status === 'WAITING' && selectedRowKeys.includes(r.id))
      .map((r) => r.id);

    if (waitingIds.length > 0) {
      try {
        const updated = await personnelAlertService.batchUpdateStatus(
          waitingIds,
          'IN_PROGRESS',
          `Đã trích xuất danh sách trình Hội đồng ngày ${dayjs().format('DD/MM/YYYY')}`
        );
        setItems(updated.items);
        setSummary(updated.summary);
        setSelectedRowKeys([]);
      } catch {
        // ignore
      }
    }

    message.success(`Đã xuất biểu mẫu tổng hợp (${targetRecords.length} viên chức) phục vụ họp Hội đồng!`);
  };

  /**
   * 1. Mở Modal DUYỆT & BAN HÀNH QUYẾT ĐỊNH (Chuyển sang Bước 4: Hoàn thành)
   */
  const openDecisionModal = (record: PersonnelAlertItem) => {
    setActiveAlert(record);
    setUploadedFile(
      record.decision_file_url
        ? { file_url: record.decision_file_url, file_name: record.decision_file_name || 'Quyet_dinh.pdf' }
        : null
    );
    const isApp =
      record.alert_category === 'REAPPOINTMENT' ||
      record.alert_category === 'EXTEND_TO_RETIREMENT';

    decisionForm.setFieldsValue({
      decision_number: record.decision_number || `QĐ-${dayjs().format('YYYY')}/TCCB`,
      decision_date: record.decision_date ? dayjs(record.decision_date) : dayjs(),
      // Bảo toàn Ngày đến hạn hưởng chế độ gốc (due_date) để tính truy lĩnh cho viên chức!
      effective_date: record.effective_date ? dayjs(record.effective_date) : dayjs(record.due_date),
      new_step: record.proposed_step ?? record.current_step,
      new_coefficient: record.proposed_coefficient
        ? Number(record.proposed_coefficient)
        : record.current_coefficient
        ? Number(record.current_coefficient)
        : undefined,
      new_exceed_percent: record.proposed_exceed_percent
        ? Number(record.proposed_exceed_percent)
        : 0,
      new_leadership_position: record.leadership_position || '',
      appointment_term: isApp
        ? record.alert_category === 'EXTEND_TO_RETIREMENT'
          ? 'Kéo dài đến tuổi nghỉ hưu'
          : '05 năm (60 tháng)'
        : undefined,
      process_notes:
        record.workflow_status === 'COMPLETED'
          ? record.process_notes
          : `Đã duyệt ban hành Quyết định ngày ${dayjs().format('DD/MM/YYYY')}, đồng bộ vào Hồ sơ gốc BNV.`,
    });
    setDecisionModalOpen(true);
  };

  const handleUploadDecisionPdf = async (file: File) => {
    setUploadingPdf(true);
    try {
      const res = await personnelAlertService.uploadDecisionFile(file);
      setUploadedFile(res);
      message.success(`Đã tải lên bản scan Quyết định: ${res.file_name}`);
    } catch {
      message.error('Chỉ hỗ trợ định dạng PDF, Word hoặc ảnh scan');
    } finally {
      setUploadingPdf(false);
    }
    return false;
  };

  const handleSaveDecision = async () => {
    if (!activeAlert) return;
    try {
      const values = await decisionForm.validateFields();
      setSubmittingDecision(true);
      const payload = {
        decision_number: values.decision_number,
        decision_date: values.decision_date.format('YYYY-MM-DD'),
        effective_date: values.effective_date.format('YYYY-MM-DD'),
        new_step: values.new_step,
        new_coefficient: values.new_coefficient,
        new_exceed_percent: values.new_exceed_percent,
        new_leadership_position: values.new_leadership_position,
        appointment_term: values.appointment_term,
        decision_file_url: uploadedFile?.file_url || null,
        decision_file_name: uploadedFile?.file_name || null,
        process_notes: values.process_notes,
      };
      const updated = await personnelAlertService.completeAlertDecision(activeAlert.id, payload);
      setItems(updated.items);
      setSummary(updated.summary);
      setDecisionModalOpen(false);
      setActiveAlert(null);
      message.success(
        'Đã Duyệt & Ban hành Quyết định! Hồ sơ đã chuyển sang Bước 4 [Hoàn thành] và đồng bộ vào Hồ sơ gốc BNV.'
      );
    } catch {
      // validation error
    } finally {
      setSubmittingDecision(false);
    }
  };

  /**
   * 2. Mở Modal GIA HẠN XỬ LÝ HỒ SƠ (Extend Processing Deadline)
   */
  const openExtendModal = (record: PersonnelAlertItem) => {
    setActiveAlert(record);
    extendForm.setFieldsValue({
      extended_deadline: record.extended_deadline
        ? dayjs(record.extended_deadline).add(7, 'day')
        : dayjs().add(15, 'day'),
      target_status:
        record.workflow_status === 'COMPLETED' || record.workflow_status === 'REJECTED'
          ? 'PENDING_DECISION'
          : record.workflow_status,
      extension_reason:
        record.extension_reason ||
        'Chờ lịch họp Hội đồng xét nâng bậc lương / Tập thể Lãnh đạo đơn vị',
    });
    setExtendModalOpen(true);
  };

  const handleSaveExtend = async () => {
    if (!activeAlert) return;
    try {
      const values = await extendForm.validateFields();
      setSubmittingExtend(true);
      const updated = await personnelAlertService.extendAlert(activeAlert.id, {
        extended_deadline: values.extended_deadline.format('YYYY-MM-DD'),
        extension_reason: values.extension_reason,
        target_status: values.target_status,
      });
      setItems(updated.items);
      setSummary(updated.summary);
      setExtendModalOpen(false);
      setActiveAlert(null);
      message.success(
        `Đã gia hạn xử lý hồ sơ cho đồng chí ${activeAlert.full_name} đến ngày ${values.extended_deadline.format(
          'DD/MM/YYYY'
        )} (Bảo lưu ngày hưởng gốc ${dayjs(activeAlert.due_date).format('DD/MM/YYYY')}).`
      );
    } catch {
      // validation error
    } finally {
      setSubmittingExtend(false);
    }
  };

  /**
   * 3. Mở Modal TỪ CHỐI BAN HÀNH / LÙI KỲ XÉT (Reject Flow)
   */
  const openRejectModal = (record: PersonnelAlertItem) => {
    setActiveAlert(record);
    const isApp =
      record.alert_category === 'REAPPOINTMENT' ||
      record.alert_category === 'EXTEND_TO_RETIREMENT';

    rejectForm.setFieldsValue({
      rejection_mode: isApp ? 'CLOSE_REJECTED' : 'DELAY_CYCLE',
      penalty_delay_months: record.rank_tier === 'Hạng IV' ? 3 : 6,
      rejection_reason: isApp
        ? 'Không đạt trên 50% phiếu tín nhiệm tại Hội nghị lấy phiếu bổ nhiệm lại'
        : 'Xếp loại Không hoàn thành nhiệm vụ trong năm công tác (Kéo dài thêm 06 tháng theo TT 08/2013/TT-BNV)',
      decision_number: '',
    });
    setRejectModalOpen(true);
  };

  const handleSaveReject = async () => {
    if (!activeAlert) return;
    try {
      const values = await rejectForm.validateFields();
      setSubmittingReject(true);
      const updated = await personnelAlertService.rejectAlert(activeAlert.id, {
        rejection_mode: values.rejection_mode,
        penalty_delay_months: values.penalty_delay_months,
        rejection_reason: values.rejection_reason,
        decision_number: values.decision_number || null,
      });
      setItems(updated.items);
      setSummary(updated.summary);
      setRejectModalOpen(false);
      setActiveAlert(null);
      if (values.rejection_mode === 'DELAY_CYCLE') {
        message.success(
          `Đã ghi nhận Từ chối đợt này & tự động lùi kỳ xét thêm +${values.penalty_delay_months} tháng cho đồng chí ${activeAlert.full_name}!`
        );
      } else {
        message.success(`Đã ghi nhận Từ chối ban hành và đóng cảnh báo của đồng chí ${activeAlert.full_name}.`);
      }
    } catch {
      // validation error
    } finally {
      setSubmittingReject(false);
    }
  };

  /**
   * 4. Mở Modal TRẢ LẠI BƯỚC TRƯỚC (Rollback) hoặc TẠM HOÃN (ON_HOLD)
   */
  const openRollbackModal = (
    record: PersonnelAlertItem,
    defaultTarget: AlertWorkflowStatusType
  ) => {
    setActiveAlert(record);
    rollbackForm.setFieldsValue({
      target_status: defaultTarget,
      reason:
        defaultTarget === 'ON_HOLD'
          ? 'Tạm hoãn xét duyệt do viên chức đang trong thời gian nghỉ thai sản / đi học / chờ kết luận thẩm tra.'
          : 'Trả lại Bước 2 (Đang lập hồ sơ) để rà soát, bổ sung biên bản họp Hội đồng trước khi trình ký lại.',
    });
    setRollbackModalOpen(true);
  };

  const handleSaveRollback = async () => {
    if (!activeAlert) return;
    try {
      const values = await rollbackForm.validateFields();
      setSubmittingRollback(true);
      const updated = await personnelAlertService.rollbackOrHoldAlert(activeAlert.id, {
        target_status: values.target_status,
        reason: values.reason,
      });
      setItems(updated.items);
      setSummary(updated.summary);
      setRollbackModalOpen(false);
      setActiveAlert(null);
      message.success('Đã cập nhật bước xử lý hồ sơ thành công!');
    } catch {
      // validation error
    } finally {
      setSubmittingRollback(false);
    }
  };

  const renderWorkflowStatusTag = (record: PersonnelAlertItem) => {
    if (record.workflow_status === 'COMPLETED') {
      return (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          4. Hoàn thành (Đã ban hành QĐ)
        </Tag>
      );
    }
    if (record.workflow_status === 'REJECTED') {
      return (
        <Tag color="default" icon={<CloseCircleOutlined />}>
          Đã từ chối ban hành
        </Tag>
      );
    }
    if (record.workflow_status === 'ON_HOLD') {
      return (
        <Tag color="purple" icon={<PauseCircleOutlined />}>
          ⏸️ Đang tạm hoãn xét duyệt
        </Tag>
      );
    }
    if (record.is_extended_active && record.extended_deadline) {
      return (
        <div>
          <Tag color="purple" icon={<CalendarOutlined />}>
            ⏳ Đang gia hạn (Lần {record.extension_count})
          </Tag>
          <div style={{ fontSize: 11.5, color: '#a855f7', marginTop: 2, fontWeight: 500 }}>
            Hẹn mới: {dayjs(record.extended_deadline).format('DD/MM/YYYY')}
          </div>
        </div>
      );
    }
    if (record.days_remaining <= 0 || record.workflow_status === 'PENDING_DECISION') {
      return (
        <Tag color="error" icon={<ExclamationCircleOutlined />}>
          {record.days_remaining <= 0
            ? '3. Quá hạn / Chờ cập nhật QĐ'
            : '3. Chờ ban hành QĐ (Đã họp HĐ)'}
        </Tag>
      );
    }
    if (record.workflow_status === 'IN_PROGRESS') {
      return (
        <Tag color="processing" icon={<SyncOutlined spin />}>
          2. Đang lập hồ sơ (Đã vào DS)
        </Tag>
      );
    }
    return (
      <Tag color={record.milestone_code === 'T-90' ? 'success' : 'warning'} icon={<ClockCircleOutlined />}>
        1. Chờ xử lý (Hệ thống báo)
      </Tag>
    );
  };

  const columns = [
    {
      title: 'Viên chức & Đơn vị',
      key: 'employee',
      width: 225,
      render: (_: any, r: PersonnelAlertItem) => (
        <Space align="start">
          <Avatar
            size={40}
            src={r.portrait_url}
            icon={<UserOutlined />}
            style={{
              background:
                r.badge_color === 'red'
                  ? '#ef4444'
                  : r.badge_color === 'purple'
                  ? '#8b5cf6'
                  : r.badge_color === 'gold' || r.badge_color === 'orange'
                  ? '#f59e0b'
                  : '#10b981',
              flexShrink: 0,
            }}
          />
          <div>
            <Text strong style={{ fontSize: 14, display: 'block' }}>
              {r.full_name}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              {r.department_name || 'Đơn vị chuyên môn'}
            </Text>
            <Space size={4} wrap style={{ marginTop: 4 }}>
              {r.employee_code && <Tag style={{ fontSize: 11, margin: 0 }}>{r.employee_code}</Tag>}
              {r.date_of_birth && (
                <Tag color="cyan" style={{ fontSize: 11, margin: 0 }}>
                  NS: {dayjs(r.date_of_birth).format('DD/MM/YYYY')} ({r.gender || '—'})
                </Tag>
              )}
            </Space>
          </div>
        </Space>
      ),
    },
    {
      title: 'Nghiệp vụ & Đối soát Quy tắc',
      key: 'category',
      width: 245,
      render: (_: any, r: PersonnelAlertItem) => {
        const isApp =
          r.alert_category === 'REAPPOINTMENT' ||
          r.alert_category === 'EXTEND_TO_RETIREMENT';
        return (
          <div>
            <Space size={4} wrap>
              {r.alert_category === 'SALARY_REGULAR' && (
                <Tag color="blue" icon={<RiseOutlined />}>
                  Nâng bậc lương thường xuyên
                </Tag>
              )}
              {r.alert_category === 'SALARY_EXCEED' && (
                <Tag color="purple" icon={<SafetyCertificateOutlined />}>
                  Phụ cấp Thâm niên Vượt khung
                </Tag>
              )}
              {r.alert_category === 'SALARY_EARLY' && (
                <Tag color="cyan" icon={<RiseOutlined />}>
                  Nâng lương trước thời hạn
                </Tag>
              )}
              {r.alert_category === 'REAPPOINTMENT' && (
                <Tag color="geekblue" icon={<AuditOutlined />}>
                  Bổ nhiệm lại (Quy trình 5 bước)
                </Tag>
              )}
              {r.alert_category === 'EXTEND_TO_RETIREMENT' && (
                <Tag color="volcano" icon={<WarningOutlined />}>
                  Kéo dài giữ chức vụ đến tuổi nghỉ hưu
                </Tag>
              )}
            </Space>

            <div style={{ marginTop: 6, fontSize: 12 }}>
              {!isApp ? (
                <>
                  <div>
                    <Text type="secondary">Chức danh:</Text>{' '}
                    <Text strong>{r.professional_title_name || 'Viên chức'}</Text>{' '}
                    {r.rank_tier && <Tag style={{ fontSize: 11 }}>{r.rank_tier}</Tag>}
                  </div>
                  <div>
                    <Text type="secondary">Chu kỳ chuẩn:</Text>{' '}
                    <Text strong>{r.standard_cycle_months} tháng</Text> (Hưởng từ:{' '}
                    {dayjs(r.cycle_start_date).format('DD/MM/YYYY')})
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Text type="secondary">Chức vụ:</Text>{' '}
                    <Text strong>{r.leadership_position}</Text>
                  </div>
                  <div>
                    <Text type="secondary">Nhiệm kỳ 5 năm (60 tháng):</Text> Từ{' '}
                    <Text strong>{dayjs(r.cycle_start_date).format('DD/MM/YYYY')}</Text>
                  </div>
                </>
              )}

              {r.discipline_delay_months > 0 && (
                <div style={{ marginTop: 4 }}>
                  <Tag color="red" style={{ whiteSpace: 'normal', lineHeight: 1.35 }}>
                    ⚠️ Bị kỷ luật lùi +{r.discipline_delay_months} tháng: {r.discipline_details}
                  </Tag>
                </div>
              )}

              {r.penalty_delay_months > 0 && (
                <div style={{ marginTop: 4 }}>
                  <Tag color="volcano" style={{ whiteSpace: 'normal', lineHeight: 1.35 }}>
                    🔄 Đã lùi kỳ xét +{r.penalty_delay_months} tháng (do từ chối đợt trước)
                  </Tag>
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Hiện hưởng ➔ Đề xuất Mới',
      key: 'proposal',
      width: 245,
      render: (_: any, r: PersonnelAlertItem) => {
        const isApp =
          r.alert_category === 'REAPPOINTMENT' ||
          r.alert_category === 'EXTEND_TO_RETIREMENT';

        if (!isApp) {
          const isMaxStep = r.alert_category === 'SALARY_EXCEED';
          return (
            <div style={{ fontSize: 12.5 }}>
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary">Hiện tại:</Text>{' '}
                <Tag style={{ margin: 0 }}>
                  Bậc {r.current_step}/{r.max_step} (HS: {Number(r.current_coefficient || 0).toFixed(2)})
                </Tag>
                {Number(r.current_exceed_percent || 0) > 0 && (
                  <Tag color="purple" style={{ marginLeft: 4 }}>
                    VK: {Number(r.current_exceed_percent)}%
                  </Tag>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <ArrowRightOutlined style={{ color: '#10b981' }} />
                {isMaxStep ? (
                  <Tag color="purple" style={{ fontWeight: 600, fontSize: 12.5 }}>
                    Đã kịch khung Bậc {r.current_step}/{r.max_step} ➔ Xét {Number(r.proposed_exceed_percent)}% vượt khung
                  </Tag>
                ) : (
                  <Tag color="green" style={{ fontWeight: 600, fontSize: 12.5 }}>
                    Đề xuất: Bậc {r.proposed_step}/{r.max_step} (HS: {Number(r.proposed_coefficient || 0).toFixed(2)})
                  </Tag>
                )}
              </div>

              {r.evaluation_summary && (
                <div style={{ marginTop: 6, fontSize: 11.5, color: '#64748b' }}>
                  📋 Đánh giá: {r.evaluation_summary}
                </div>
              )}
            </div>
          );
        }

        return (
          <div style={{ fontSize: 12.5 }}>
            <div>
              <Text type="secondary">Nghỉ hưu dự kiến:</Text>{' '}
              <Text strong>
                {r.retirement_date ? dayjs(r.retirement_date).format('DD/MM/YYYY') : '—'}
              </Text>
            </div>
            <div style={{ marginTop: 3 }}>
              <Text type="secondary">TG công tác còn lại:</Text>{' '}
              <Tag color={(r.remaining_work_months || 0) >= 18 ? 'blue' : 'volcano'}>
                {r.remaining_work_months} tháng{' '}
                {(r.remaining_work_months || 0) >= 18 ? '(≥ 18 tháng)' : '(< 18 tháng)'}
              </Tag>
            </div>
            <div style={{ marginTop: 6 }}>
              {r.alert_category === 'EXTEND_TO_RETIREMENT' ? (
                <Tag color="volcano" style={{ whiteSpace: 'normal', lineHeight: 1.35 }}>
                  ➔ Không làm quy trình 5 bước. Dùng <b>Mẫu Tờ trình kéo dài chức vụ đến tuổi nghỉ hưu</b>.
                </Tag>
              ) : (
                <Tag color="geekblue" style={{ whiteSpace: 'normal', lineHeight: 1.35 }}>
                  ➔ Thực hiện quy trình <b>Bổ nhiệm lại (Lấy phiếu tín nhiệm 5 bước)</b>.
                </Tag>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Chặng Cảnh báo & Việc cần thực hiện',
      key: 'milestone',
      width: 300,
      render: (_: any, r: PersonnelAlertItem) => (
        <div>
          <div style={{ marginBottom: 4 }}>
            <Tag
              color={
                r.badge_color === 'red'
                  ? 'error'
                  : r.badge_color === 'purple'
                  ? 'purple'
                  : r.badge_color === 'gold' || r.badge_color === 'orange'
                  ? 'warning'
                  : r.badge_color === 'green'
                  ? 'success'
                  : 'default'
              }
              style={{
                fontWeight: 600,
                whiteSpace: 'normal',
                lineHeight: 1.35,
                padding: '3px 8px',
              }}
            >
              {r.badge_text}
            </Tag>
          </div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <Text type="secondary">Ngày đến hạn hưởng chế độ:</Text>{' '}
            <Text
              strong
              style={{
                color: r.days_remaining <= 0 && !r.is_extended_active ? '#ef4444' : undefined,
              }}
            >
              {dayjs(r.due_date).format('DD/MM/YYYY')}
            </Text>
          </div>
          <div
            style={{
              fontSize: 12,
              background: isDark ? 'rgba(30,41,59,0.7)' : '#f8fafc',
              borderLeft: `3px solid ${
                r.badge_color === 'red'
                  ? '#ef4444'
                  : r.badge_color === 'purple'
                  ? '#8b5cf6'
                  : r.badge_color === 'gold' || r.badge_color === 'orange'
                  ? '#f59e0b'
                  : '#10b981'
              }`,
              padding: '6px 8px',
              borderRadius: 4,
            }}
          >
            <Text style={{ fontSize: 11.5 }}>{r.action_guidance}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái Xử lý',
      key: 'status',
      width: 195,
      render: (_: any, r: PersonnelAlertItem) => (
        <div>
          {renderWorkflowStatusTag(r)}
          {r.process_notes && (
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>
              📝 {r.process_notes}
            </div>
          )}
          {r.workflow_status === 'COMPLETED' && r.decision_number && (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <Tag color="success">Số QĐ: {r.decision_number}</Tag>
              {r.decision_file_url && (
                <a
                  href={r.decision_file_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-block', marginTop: 4, fontSize: 12 }}
                >
                  <FilePdfOutlined /> Xem PDF Quyết định
                </a>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Thao tác Duyệt / Gia hạn / Từ chối',
      key: 'actions',
      width: 215,
      fixed: 'right' as const,
      render: (_: any, r: PersonnelAlertItem) => (
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          {r.workflow_status !== 'COMPLETED' ? (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              block
              onClick={() => openDecisionModal(r)}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                borderColor: 'transparent',
                fontWeight: 600,
              }}
            >
              Duyệt & Ban hành QĐ (B4)
            </Button>
          ) : (
            <Button
              size="small"
              icon={<FileProtectOutlined />}
              block
              onClick={() => openDecisionModal(r)}
            >
              Xem / Đính chính QĐ
            </Button>
          )}

          {r.workflow_status !== 'COMPLETED' && r.workflow_status !== 'REJECTED' && (
            <div style={{ display: 'flex', gap: 6, width: '100%' }}>
              <Tooltip title="Gia hạn thời gian xử lý hành chính (chờ họp Hội đồng / chờ bổ sung hồ sơ) nhưng vẫn bảo lưu ngày hưởng gốc">
                <Button
                  size="small"
                  icon={<CalendarOutlined />}
                  style={{ flex: 1, fontSize: 12 }}
                  onClick={() => openExtendModal(r)}
                >
                  Gia hạn
                </Button>
              </Tooltip>
              <Tooltip title="Từ chối ban hành đợt này (Lùi kỳ xét thêm +3/+6/+12 tháng hoặc Đóng từ chối)">
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  style={{ flex: 1, fontSize: 12 }}
                  onClick={() => openRejectModal(r)}
                >
                  Từ chối
                </Button>
              </Tooltip>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, width: '100%' }}>
            <Button
              size="small"
              icon={<HistoryOutlined />}
              style={{ flex: 1, fontSize: 12 }}
              onClick={() => {
                setActiveAlert(r);
                setHistoryDrawerOpen(true);
              }}
            >
              Lịch sử ({r.action_history?.length || 0})
            </Button>

            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  ...(r.workflow_status === 'PENDING_DECISION' || r.days_remaining <= 0
                    ? [
                        {
                          key: 'rollback_step2',
                          icon: <RollbackOutlined />,
                          label: 'Trả lại Bước 2 (Đang lập hồ sơ)',
                          onClick: () => openRollbackModal(r, 'IN_PROGRESS'),
                        },
                      ]
                    : []),
                  ...(r.workflow_status === 'WAITING'
                    ? [
                        {
                          key: 'to_step2',
                          icon: <AuditOutlined />,
                          label: 'Chuyển sang Bước 2 (Đang lập hồ sơ)',
                          onClick: () =>
                            personnelAlertService
                              .batchUpdateStatus(
                                [r.id],
                                'IN_PROGRESS',
                                'Chuyển sang Bước 2: Đang lập hồ sơ trình Hội đồng'
                              )
                              .then((d) => {
                                setItems(d.items);
                                setSummary(d.summary);
                                message.success('Đã chuyển sang Bước 2 (Đang lập hồ sơ)');
                              }),
                        },
                      ]
                    : []),
                  ...(r.workflow_status === 'IN_PROGRESS'
                    ? [
                        {
                          key: 'to_step3',
                          icon: <FileProtectOutlined />,
                          label: 'Chuyển sang Bước 3 (Chờ ban hành QĐ)',
                          onClick: () =>
                            personnelAlertService
                              .batchUpdateStatus(
                                [r.id],
                                'PENDING_DECISION',
                                'Đã họp Hội đồng xong, chuyển sang Bước 3 chờ ký Quyết định'
                              )
                              .then((d) => {
                                setItems(d.items);
                                setSummary(d.summary);
                                message.success('Đã chuyển sang Bước 3 (Chờ ban hành QĐ)');
                              }),
                        },
                      ]
                    : []),
                  {
                    key: 'hold',
                    icon: <PauseCircleOutlined />,
                    label:
                      r.workflow_status === 'ON_HOLD'
                        ? 'Tiếp tục xử lý (Mở khóa Tạm hoãn)'
                        : 'Tạm hoãn xét duyệt (Đang thanh tra / Thai sản)',
                    onClick: () =>
                      openRollbackModal(
                        r,
                        r.workflow_status === 'ON_HOLD' ? 'IN_PROGRESS' : 'ON_HOLD'
                      ),
                  },
                  ...(r.user_id
                    ? [
                        { type: 'divider' as const },
                        {
                          key: 'profile',
                          icon: <EyeOutlined />,
                          label: 'Xem Hồ sơ gốc BNV',
                          onClick: () => navigate(ROUTES.PERSONNEL_PROFILE_DETAIL(r.user_id!)),
                        },
                      ]
                    : []),
                ],
              }}
            >
              <Button size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </div>
        </Space>
      ),
    },
  ];

  const isEditingAppointment =
    activeAlert?.alert_category === 'REAPPOINTMENT' ||
    activeAlert?.alert_category === 'EXTEND_TO_RETIREMENT';

  const handleChartDrillDown = (filters: {
    category?: string;
    status?: string;
    dept?: string;
    milestone?: string;
  }) => {
    if (filters.category) setCategoryTab(filters.category);
    else setCategoryTab('ALL');

    if (filters.status) setStatusFilter(filters.status);
    else setStatusFilter('ACTIVE_ONLY');

    setDeptFilter(filters.dept);
    setMilestoneFilter(filters.milestone);
    setSearchParams({});
    message.info('Đã lọc danh sách cảnh báo theo mục bạn chọn trên biểu đồ!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Banner */}
      <Card
        bodyStyle={{ padding: '16px 20px' }}
        style={{
          borderRadius: 14,
          background: isDark
            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)',
          border: isDark ? '1px solid #334155' : '1px solid #e0e7ff',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 12]}>
          <Col xs={24} lg={13}>
            <Space align="center" size={12}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 22,
                  boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                }}
              >
                <BellOutlined />
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Trợ lý Số Tổ chức Cán bộ — Cảnh báo Tự động Nâng bậc Lương & Bổ nhiệm lại
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Tự động quét hồ sơ lúc <b>00:01 hằng đêm</b> • Hỗ trợ{' '}
                  <b>Duyệt sang Bước 4, Gia hạn xử lý (bảo lưu ngày hưởng), Từ chối & Thống kê Sơ đồ</b>.
                </Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} lg={11} style={{ textAlign: 'right' }}>
            <Space wrap>
              <Button.Group>
                <Button
                  type={activeViewTab === 'list' ? 'primary' : 'default'}
                  icon={<UnorderedListOutlined />}
                  onClick={() => {
                    setSearchParams({});
                    setCategoryTab('ALL');
                    setStatusFilter('ACTIVE_ONLY');
                    setDeptFilter(undefined);
                    setMilestoneFilter(undefined);
                  }}
                >
                  Danh sách cảnh báo
                </Button>
                <Button
                  type={activeViewTab === 'charts' ? 'primary' : 'default'}
                  icon={<BarChartOutlined />}
                  onClick={() => setSearchParams({ tab: 'charts' })}
                >
                  Thống kê & Sơ đồ
                </Button>
                <Button
                  type={activeViewTab === 'profiles' ? 'primary' : 'default'}
                  icon={<IdcardOutlined />}
                  onClick={() => setSearchParams({ tab: 'profiles' })}
                >
                  Sơ đồ Cá nhân (360°)
                </Button>
              </Button.Group>

              <Button icon={<BookOutlined />} onClick={() => setGuideOpen(true)}>
                Sổ tay Nghiệp vụ
              </Button>
              <Button
                icon={<SyncOutlined spin={scanning} />}
                onClick={handleManualScan}
                loading={scanning}
              >
                Rà soát ngay
              </Button>
              {activeViewTab === 'list' && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExportCouncilList}
                  style={{ background: '#10b981', borderColor: '#10b981' }}
                >
                  Xuất biểu mẫu ({selectedRowKeys.length || 'Tất cả'})
                </Button>
              )}
            </Space>
            {summary?.last_scanned_at && (
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                Lần quét đối soát gần nhất: {summary.last_scanned_at}
              </div>
            )}
          </Col>
        </Row>
      </Card>

      {activeViewTab === 'charts' ? (
        <PersonnelAlertChartsView
          items={items}
          summary={summary}
          onDrillDown={handleChartDrillDown}
        />
      ) : activeViewTab === 'profiles' ? (
        <PersonnelPersonalMapView
          isDark={isDark}
          fallbackAlerts={items}
          onDrillDownToPersonAlerts={(personName) => {
            resetAllFilters();
            setSearch(personName);
            setSearchParams({});
            message.info(`Đã lọc danh sách cảnh báo của viên chức: ${personName}`);
          }}
          onOpenBnvProfile={(userId) => {
            if (userId) {
              navigate(`${ROUTES.PERSONNEL_PROFILES}?userId=${userId}`);
            } else {
              navigate(ROUTES.PERSONNEL_PROFILES);
            }
          }}
        />
      ) : (
        <>
          {/* 4 Thẻ Trạng thái Xử lý Cảnh báo (Mục 4) */}

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() =>
              setStatusFilter(statusFilter === 'WAITING' ? 'ACTIVE_ONLY' : 'WAITING')
            }
            bodyStyle={{ padding: '14px 16px' }}
            style={{
              borderRadius: 12,
              borderLeft: '4px solid #10b981',
              outline: statusFilter === 'WAITING' ? '2px solid #10b981' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  1. [Chờ xử lý] (Hệ thống báo)
                </Text>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>
                  {summary?.waiting_count ?? 0}
                </div>
                <Text type="secondary" style={{ fontSize: 11.5 }}>
                  Mới đến hạn (Xanh / Vàng), chưa thao tác
                </Text>
              </div>
              <ClockCircleOutlined style={{ fontSize: 28, color: '#10b981', opacity: 0.8 }} />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() =>
              setStatusFilter(statusFilter === 'IN_PROGRESS' ? 'ACTIVE_ONLY' : 'IN_PROGRESS')
            }
            bodyStyle={{ padding: '14px 16px' }}
            style={{
              borderRadius: 12,
              borderLeft: '4px solid #3b82f6',
              outline: statusFilter === 'IN_PROGRESS' ? '2px solid #3b82f6' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  2. [Đang lập hồ sơ] (Xanh dương)
                </Text>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>
                  {summary?.in_progress_count ?? 0}
                </div>
                <Text type="secondary" style={{ fontSize: 11.5 }}>
                  Đã đưa vào DS Hội đồng / Phát thông báo
                </Text>
              </div>
              <AuditOutlined style={{ fontSize: 28, color: '#3b82f6', opacity: 0.8 }} />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() =>
              setStatusFilter(
                statusFilter === 'OVERDUE_OR_PENDING' ? 'ACTIVE_ONLY' : 'OVERDUE_OR_PENDING'
              )
            }
            bodyStyle={{ padding: '14px 16px' }}
            style={{
              borderRadius: 12,
              borderLeft: '4px solid #ef4444',
              outline: statusFilter === 'OVERDUE_OR_PENDING' ? '2px solid #ef4444' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  3. [Chờ ban hành QĐ / Quá hạn] (Đỏ)
                </Text>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>
                  {summary?.overdue_or_pending_decision_count ?? 0}
                </div>
                <Text type="secondary" style={{ fontSize: 11.5 }}>
                  Đã họp HĐ xong hoặc quá hạn (Đang gia hạn: {summary?.extended_count ?? 0})
                </Text>
              </div>
              <ExclamationCircleOutlined style={{ fontSize: 28, color: '#ef4444', opacity: 0.8 }} />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() =>
              setStatusFilter(statusFilter === 'COMPLETED' ? 'ACTIVE_ONLY' : 'COMPLETED')
            }
            bodyStyle={{ padding: '14px 16px' }}
            style={{
              borderRadius: 12,
              borderLeft: '4px solid #64748b',
              outline: statusFilter === 'COMPLETED' ? '2px solid #64748b' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  4. [Hoàn thành] (Màu xám / Lưu LS)
                </Text>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#64748b' }}>
                  {summary?.completed_count ?? 0}
                </div>
                <Text type="secondary" style={{ fontSize: 11.5 }}>
                  Đã duyệt số QĐ mới & đóng cảnh báo
                </Text>
              </div>
              <CheckCircleOutlined style={{ fontSize: 28, color: '#64748b', opacity: 0.8 }} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Bảng Danh sách & Bộ lọc */}
      <Card bodyStyle={{ padding: '12px 20px 20px' }} style={{ borderRadius: 14 }}>
        <Tabs
          activeKey={categoryTab}
          onTabClick={(k) => {
            setCategoryTab(k);
            if (statusFilter !== 'ACTIVE_ONLY') {
              setStatusFilter('ACTIVE_ONLY');
            }
            if (milestoneFilter) {
              setMilestoneFilter(undefined);
            }
          }}
          items={[
            {
              key: 'ALL',
              label: (
                <span>
                  Tất cả cảnh báo{' '}
                  <Badge
                    count={summary?.total_active_alerts ?? 0}
                    style={{ backgroundColor: '#6366f1', marginLeft: 4 }}
                  />
                </span>
              ),
            },
            {
              key: 'SALARY_REGULAR',
              label: `Nâng lương thường xuyên (${summary?.salary_regular_count ?? 0})`,
            },
            {
              key: 'SALARY_EXCEED',
              label: `Phụ cấp vượt khung (${summary?.salary_exceed_count ?? 0})`,
            },
            {
              key: 'SALARY_EARLY',
              label: `Nâng lương trước thời hạn (${summary?.salary_early_count ?? 0})`,
            },
            {
              key: 'REAPPOINTMENT',
              label: `Bổ nhiệm lại ≥ 18 tháng (${summary?.reappointment_count ?? 0})`,
            },
            {
              key: 'EXTEND_TO_RETIREMENT',
              label: `Kéo dài chức vụ đến nghỉ hưu < 18 tháng (${
                summary?.extend_retirement_count ?? 0
              })`,
            },
          ]}
        />

        {/* Thanh Tìm kiếm Thông minh & Bộ lọc Chính */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            marginBottom: 14,
            background: isDark ? 'rgba(30, 41, 59, 0.55)' : '#f8fafc',
            border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
          }}
        >
          <Row gutter={[10, 10]} justify="space-between" align="middle">
            <Col xs={24} xl={17}>
              <Space wrap size={[8, 8]}>
                <Space.Compact>
                  <Select
                    value={searchScope}
                    onChange={setSearchScope}
                    style={{ width: 135 }}
                    options={[
                      { label: '🔍 Tất cả trường', value: 'ALL' },
                      { label: '👤 Họ tên / Mã VC', value: 'EMPLOYEE' },
                      { label: '💼 Chức danh / ĐV', value: 'POSITION' },
                      { label: '📄 Số QĐ / Ghi chú', value: 'DECISION' },
                      { label: '⚖️ Kỷ luật / ĐG', value: 'DISCIPLINE_REWARD' },
                    ]}
                  />
                  <Input
                    placeholder="Gõ tên, mã VC, chức danh, hệ số (hỗ trợ không dấu)..."
                    prefix={<SearchOutlined style={{ color: '#6366f1' }} />}
                    allowClear
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: 280 }}
                  />
                </Space.Compact>

                <Select
                  placeholder="🏢 Phòng ban / Đơn vị"
                  allowClear
                  value={deptFilter}
                  onChange={setDeptFilter}
                  style={{ width: 195 }}
                  options={departments.map((d) => ({
                    label: `${d.name} (${d.count})`,
                    value: d.name,
                  }))}
                />

                <Select
                  placeholder="⏱️ Chặng cảnh báo (T-90 → T-0)"
                  allowClear
                  value={milestoneFilter}
                  onChange={setMilestoneFilter}
                  style={{ width: 215 }}
                  options={[
                    { label: '🟢 T-90 (Trước 90 ngày)', value: 'T-90' },
                    { label: '🟡 T-60 (Trước 60 ngày - Bổ nhiệm)', value: 'T-60' },
                    { label: '🟠 T-30 (Trước 30 ngày - Lập HS)', value: 'T-30' },
                    { label: '🔴 T-0 / Quá hạn (Chờ QĐ mới)', value: 'T-0' },
                    { label: '🟣 Đang trong thời gian Gia hạn', value: 'EXTENDED' },
                  ]}
                />

                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: 215 }}
                  options={[
                    { label: '📋 Đang cảnh báo (Bước 1, 2, 3)', value: 'ACTIVE_ONLY' },
                    { label: '1. Chờ xử lý (Hệ thống báo)', value: 'WAITING' },
                    { label: '2. Đang lập hồ sơ (Hội đồng)', value: 'IN_PROGRESS' },
                    { label: '3. Quá hạn / Chờ ban hành QĐ', value: 'OVERDUE_OR_PENDING' },
                    { label: '⏳ Hồ sơ đang Gia hạn xử lý', value: 'EXTENDED_ONLY' },
                    {
                      label: `⏸️ Tạm hoãn / ❌ Đã từ chối (${summary?.on_hold_or_rejected_count ?? 0})`,
                      value: 'ON_HOLD_OR_REJECTED',
                    },
                    {
                      label: `4. Hoàn thành - Đã duyệt QĐ (${summary?.completed_count ?? 0})`,
                      value: 'COMPLETED',
                    },
                  ]}
                />

                <Select
                  value={sortBy}
                  onChange={setSortBy}
                  style={{ width: 205 }}
                  suffixIcon={<SortAscendingOutlined />}
                  options={[
                    { label: '📅 Hạn gần nhất / Quá hạn trước', value: 'DUE_ASC' },
                    { label: '📅 Hạn xa nhất xếp trước', value: 'DUE_DESC' },
                    { label: '💰 Hệ số lương: Cao → Thấp', value: 'COEFF_DESC' },
                    { label: '💰 Hệ số lương: Thấp → Cao', value: 'COEFF_ASC' },
                    { label: '⚠️ Bị lùi kỳ nhiều nhất trước', value: 'DELAY_DESC' },
                    { label: '🔤 Họ tên Viên chức (A → Z)', value: 'NAME_ASC' },
                  ]}
                />
              </Space>
            </Col>

            <Col xs={24} xl={7} style={{ textAlign: 'right' }}>
              <Space wrap>
                <Badge count={activeAdvancedFilterCount} size="small" offset={[-4, 2]}>
                  <Button
                    type={showAdvancedFilters ? 'primary' : 'default'}
                    ghost={showAdvancedFilters}
                    icon={<FilterOutlined />}
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  >
                    Bộ lọc nâng cao
                  </Button>
                </Badge>
                {hasAnyActiveFilter && (
                  <Button danger icon={<ClearOutlined />} onClick={resetAllFilters}>
                    Đặt lại
                  </Button>
                )}
              </Space>
            </Col>
          </Row>

          {/* Hàng Nút Lọc Nhanh 1 Chạm (Quick Filter Chips) */}
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: isDark ? '1px dashed #334155' : '1px dashed #cbd5e1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <Space wrap size={[6, 6]}>
              <Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>
                <ThunderboltOutlined style={{ color: '#f59e0b' }} /> Lọc nhanh tình huống:
              </Text>
              <Tag
                color={specialConditionFilter === 'OVERDUE_NOW' ? 'red' : undefined}
                style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 10px' }}
                onClick={() =>
                  setSpecialConditionFilter(
                    specialConditionFilter === 'OVERDUE_NOW' ? undefined : 'OVERDUE_NOW'
                  )
                }
              >
                🔥 Đang quá hạn ({quickCounts.overdueNow})
              </Tag>
              <Tag
                color={specialConditionFilter === 'DUE_WITHIN_30D' ? 'gold' : undefined}
                style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 10px' }}
                onClick={() =>
                  setSpecialConditionFilter(
                    specialConditionFilter === 'DUE_WITHIN_30D' ? undefined : 'DUE_WITHIN_30D'
                  )
                }
              >
                📅 Đến hạn ≤ 30 ngày ({quickCounts.dueWithin30d})
              </Tag>
              <Tag
                color={specialConditionFilter === 'HAS_DISCIPLINE' ? 'volcano' : undefined}
                style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 10px' }}
                onClick={() =>
                  setSpecialConditionFilter(
                    specialConditionFilter === 'HAS_DISCIPLINE' ? undefined : 'HAS_DISCIPLINE'
                  )
                }
              >
                ⚠️ Bị kỷ luật / Lùi kỳ ({quickCounts.hasDiscipline})
              </Tag>
              <Tag
                color={specialConditionFilter === 'MAX_STEP_EXCEED' ? 'purple' : undefined}
                style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 10px' }}
                onClick={() =>
                  setSpecialConditionFilter(
                    specialConditionFilter === 'MAX_STEP_EXCEED' ? undefined : 'MAX_STEP_EXCEED'
                  )
                }
              >
                🟣 Kịch khung vượt khung ({quickCounts.maxStepExceed})
              </Tag>
              <Tag
                color={specialConditionFilter === 'HAS_REWARD_EARLY' ? 'cyan' : undefined}
                style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 10px' }}
                onClick={() =>
                  setSpecialConditionFilter(
                    specialConditionFilter === 'HAS_REWARD_EARLY' ? undefined : 'HAS_REWARD_EARLY'
                  )
                }
              >
                🏆 Nâng lương trước hạn ({quickCounts.earlyReward})
              </Tag>
              <Tag
                color={specialConditionFilter === 'UNDER_18M_RETIRE' ? 'orange' : undefined}
                style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 10px' }}
                onClick={() =>
                  setSpecialConditionFilter(
                    specialConditionFilter === 'UNDER_18M_RETIRE' ? undefined : 'UNDER_18M_RETIRE'
                  )
                }
              >
                🟠 Sắp nghỉ hưu &lt; 18 tháng ({quickCounts.retireUnder18m})
              </Tag>
              {quickCounts.extendedActive > 0 && (
                <Tag
                  color={specialConditionFilter === 'EXTENDED_ACTIVE' ? 'magenta' : undefined}
                  style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 10px' }}
                  onClick={() =>
                    setSpecialConditionFilter(
                      specialConditionFilter === 'EXTENDED_ACTIVE' ? undefined : 'EXTENDED_ACTIVE'
                    )
                  }
                >
                  ⏳ Đang gia hạn ({quickCounts.extendedActive})
                </Tag>
              )}
            </Space>

            {/* Nút Thao tác Hàng loạt */}
            <Space wrap>
              <Button
                size="small"
                disabled={!selectedRowKeys.length}
                onClick={() =>
                  handleBatchStatusChange(
                    'IN_PROGRESS',
                    `Đã đưa vào danh sách họp Hội đồng / Phát thông báo ngày ${dayjs().format('DD/MM/YYYY')}`
                  )
                }
              >
                Chuyển Bước 2: Đang lập HS ({selectedRowKeys.length})
              </Button>
              <Button
                size="small"
                disabled={!selectedRowKeys.length}
                onClick={() =>
                  handleBatchStatusChange(
                    'PENDING_DECISION',
                    `Đã họp Hội đồng xong ngày ${dayjs().format('DD/MM/YYYY')}, chuyển Bước 3 chờ ký Quyết định`
                  )
                }
              >
                Chuyển Bước 3: Chờ ban hành QĐ
              </Button>
            </Space>
          </div>

          {/* Khung Bộ lọc Nghiệp vụ Nâng cao (6 tiêu chí chuyên sâu) */}
          {showAdvancedFilters && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              }}
            >
              <Row gutter={[10, 10]} align="middle">
                <Col xs={24} sm={12} md={8} lg={4}>
                  <Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 3 }}>
                    Yếu tố đối soát đặc biệt:
                  </Text>
                  <Select
                    placeholder="Tất cả tình trạng"
                    allowClear
                    value={specialConditionFilter}
                    onChange={setSpecialConditionFilter}
                    style={{ width: '100%' }}
                    size="small"
                    options={[
                      { label: '🔥 Đang quá hạn ban hành QĐ', value: 'OVERDUE_NOW' },
                      { label: '📅 Đến hạn trong vòng 30 ngày', value: 'DUE_WITHIN_30D' },
                      { label: '⚠️ Có kỷ luật / Bị lùi kỳ xét', value: 'HAS_DISCIPLINE' },
                      { label: '✅ Hồ sơ sạch (Không kỷ luật)', value: 'CLEAN_RECORD' },
                      { label: '🟣 Đã kịch khung bậc lương', value: 'MAX_STEP_EXCEED' },
                      { label: '🏆 Có thành tích xét trước hạn', value: 'HAS_REWARD_EARLY' },
                      { label: '🟠 Công tác còn < 18 tháng (Nghỉ hưu)', value: 'UNDER_18M_RETIRE' },
                      { label: '⏳ Đang trong thời gian Gia hạn', value: 'EXTENDED_ACTIVE' },
                    ]}
                  />
                </Col>

                <Col xs={24} sm={12} md={8} lg={4}>
                  <Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 3 }}>
                    Hạng chức danh / Ngạch:
                  </Text>
                  <Select
                    placeholder="Tất cả Hạng CDNN"
                    allowClear
                    value={rankTierFilter}
                    onChange={setRankTierFilter}
                    style={{ width: '100%' }}
                    size="small"
                    options={[
                      { label: '🏅 Hạng I (Cao cấp - 36 tháng)', value: 'Hạng I' },
                      { label: '🥈 Hạng II (Chính - 36 tháng)', value: 'Hạng II' },
                      { label: '🥉 Hạng III (ĐH - 36 tháng)', value: 'Hạng III' },
                      { label: '📋 Hạng IV (CĐ/TC - 24 tháng)', value: 'Hạng IV' },
                      { label: '🏛️ Chức vụ Lãnh đạo / Quản lý', value: 'LEADERSHIP' },
                    ]}
                  />
                </Col>

                <Col xs={24} sm={12} md={8} lg={3}>
                  <Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 3 }}>
                    Chu kỳ xét duyệt:
                  </Text>
                  <Select
                    placeholder="Tất cả chu kỳ"
                    allowClear
                    value={cycleMonthsFilter}
                    onChange={setCycleMonthsFilter}
                    style={{ width: '100%' }}
                    size="small"
                    options={[
                      { label: '36 tháng (3 năm)', value: 36 },
                      { label: '24 tháng (2 năm)', value: 24 },
                      { label: '12 tháng (Vượt khung)', value: 12 },
                      { label: '60 tháng (5 năm - BN)', value: 60 },
                    ]}
                  />
                </Col>

                <Col xs={24} sm={12} md={8} lg={4}>
                  <Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 3 }}>
                    Xếp loại đánh giá năm:
                  </Text>
                  <Select
                    placeholder="Tất cả mức đánh giá"
                    allowClear
                    value={evalFilter}
                    onChange={setEvalFilter}
                    style={{ width: '100%' }}
                    size="small"
                    options={[
                      { label: '🌟 Hoàn thành xuất sắc NV', value: 'XUAT_SAC' },
                      { label: '👍 Hoàn thành tốt nhiệm vụ', value: 'TOT' },
                      { label: '✔️ Hoàn thành nhiệm vụ', value: 'HOAN_THANH' },
                      { label: '⚠️ Không hoàn thành nhiệm vụ', value: 'KHONG_HOAN_THANH' },
                    ]}
                  />
                </Col>

                <Col xs={24} sm={12} md={8} lg={3}>
                  <Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 3 }}>
                    Giới tính:
                  </Text>
                  <Select
                    placeholder="Tất cả"
                    allowClear
                    value={genderFilter}
                    onChange={setGenderFilter}
                    style={{ width: '100%' }}
                    size="small"
                    options={[
                      { label: '👨 Nam', value: 'Nam' },
                      { label: '👩 Nữ', value: 'Nữ' },
                    ]}
                  />
                </Col>

                <Col xs={24} sm={12} md={8} lg={6}>
                  <Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 3 }}>
                    Khoảng Ngày đến hạn hưởng chế độ:
                  </Text>
                  <DatePicker.RangePicker
                    size="small"
                    style={{ width: '100%' }}
                    format="DD/MM/YYYY"
                    placeholder={['Từ ngày', 'Đến ngày']}
                    value={dueDateRange}
                    onChange={(dates) => setDueDateRange(dates)}
                    presets={[
                      {
                        label: 'Đã quá hạn (Đến hôm nay)',
                        value: [dayjs().subtract(5, 'year'), dayjs()],
                      },
                      {
                        label: 'Trong 30 ngày tới',
                        value: [dayjs(), dayjs().add(30, 'day')],
                      },
                      {
                        label: 'Trong 60 ngày tới',
                        value: [dayjs(), dayjs().add(60, 'day')],
                      },
                      {
                        label: 'Trong 90 ngày tới',
                        value: [dayjs(), dayjs().add(90, 'day')],
                      },
                      {
                        label: 'Tháng này',
                        value: [dayjs().startOf('month'), dayjs().endOf('month')],
                      },
                      {
                        label: 'Quý này',
                        value: [
                          dayjs().startOf('month'),
                          dayjs().add(2, 'month').endOf('month'),
                        ],
                      },
                      {
                        label: 'Cả năm nay',
                        value: [dayjs().startOf('year'), dayjs().endOf('year')],
                      },
                    ]}
                  />
                </Col>
              </Row>
            </div>
          )}
        </div>

        {/* Thanh Hiển thị Các Điều kiện Đang lọc (Active Filter Tags) */}
        {hasAnyActiveFilter && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12, padding: '8px 14px' }}
            message={
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <Space wrap size={[6, 6]}>
                  <span>
                    Kết quả lọc: Hiển thị <b>{filteredItems.length}</b> /{' '}
                    <b>{summary?.total_active_alerts ?? 0}</b> hồ sơ cảnh báo
                  </span>
                  {categoryTab !== 'ALL' && (
                    <Tag closable onClose={() => setCategoryTab('ALL')} color="geekblue">
                      Nhóm: {categoryTab}
                    </Tag>
                  )}
                  {statusFilter !== 'ACTIVE_ONLY' && (
                    <Tag closable onClose={() => setStatusFilter('ACTIVE_ONLY')} color="blue">
                      Trạng thái: {statusFilter}
                    </Tag>
                  )}
                  {deptFilter && (
                    <Tag closable onClose={() => setDeptFilter(undefined)} color="cyan">
                      Đơn vị: {deptFilter}
                    </Tag>
                  )}
                  {milestoneFilter && (
                    <Tag closable onClose={() => setMilestoneFilter(undefined)} color="gold">
                      Chặng: {milestoneFilter}
                    </Tag>
                  )}
                  {specialConditionFilter && (
                    <Tag
                      closable
                      onClose={() => setSpecialConditionFilter(undefined)}
                      color="volcano"
                    >
                      Đối soát: {specialConditionFilter}
                    </Tag>
                  )}
                  {rankTierFilter && (
                    <Tag closable onClose={() => setRankTierFilter(undefined)} color="purple">
                      Hạng: {rankTierFilter}
                    </Tag>
                  )}
                  {cycleMonthsFilter !== undefined && (
                    <Tag closable onClose={() => setCycleMonthsFilter(undefined)} color="magenta">
                      Chu kỳ: {cycleMonthsFilter} tháng
                    </Tag>
                  )}
                  {evalFilter && (
                    <Tag closable onClose={() => setEvalFilter(undefined)} color="green">
                      Đánh giá: {evalFilter}
                    </Tag>
                  )}
                  {genderFilter && (
                    <Tag closable onClose={() => setGenderFilter(undefined)} color=" lime">
                      Giới tính: {genderFilter}
                    </Tag>
                  )}
                  {dueDateRange && (dueDateRange[0] || dueDateRange[1]) && (
                    <Tag closable onClose={() => setDueDateRange(null)} color="orange">
                      Hạn: {dueDateRange[0]?.format('DD/MM/YYYY') || '...'} →{' '}
                      {dueDateRange[1]?.format('DD/MM/YYYY') || '...'}
                    </Tag>
                  )}
                  {search.trim() && (
                    <Tag closable onClose={() => setSearch('')} color="blue">
                      Từ khóa: &ldquo;{search}&rdquo;
                    </Tag>
                  )}
                </Space>

                <Button type="link" size="small" onClick={resetAllFilters}>
                  ✕ Xóa tất cả bộ lọc — Xem toàn bộ {summary?.total_active_alerts ?? 0} hồ sơ
                </Button>
              </div>
            }
          />
        )}

        <Table
          rowKey="id"
          loading={loading}
          dataSource={filteredItems}
          columns={columns}
          scroll={{ x: 1420 }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>
      </>
      )}

      {/* ===================================================================================
          MODAL 1: DUYỆT & BAN HÀNH QUYẾT ĐỊNH CHÍNH THỨC (CHUYỂN TỪ BƯỚC 3 SANG BƯỚC 4)

         =================================================================================== */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#10b981' }} />
            <span>
              Duyệt & Ban hành Quyết định (Chuyển sang Bước 4: Hoàn thành) — {activeAlert?.full_name}
            </span>
          </Space>
        }
        open={decisionModalOpen}
        onCancel={() => setDecisionModalOpen(false)}
        onOk={handleSaveDecision}
        confirmLoading={submittingDecision}
        okText="Xác nhận Duyệt & Chuyển sang Bước 4 (Hoàn thành)"
        cancelText="Huỷ"
        width={700}
      >
        {activeAlert && (
          <>
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
              message={
                isEditingAppointment
                  ? `Phê duyệt kết quả quy trình: ${activeAlert.alert_category_label} (${activeAlert.leadership_position})`
                  : `Phê duyệt chế độ mới: ${activeAlert.professional_title_name || ''} (${
                      activeAlert.rank_tier || ''
                    }) — Từ Bậc ${activeAlert.current_step}/${activeAlert.max_step} (${
                      activeAlert.current_coefficient
                    })`
              }
              description={
                <span>
                  • <b>Bảo toàn ngày hưởng chế độ:</b> Hệ thống tự động điền mặc định Ngày hưởng mới theo{' '}
                  <b>Ngày đến hạn gốc ({dayjs(activeAlert.due_date).format('DD/MM/YYYY')})</b> để viên chức
                  được hưởng truy lĩnh dù Quyết định ký muộn hơn.<br />• Sau khi nhấn Duyệt, hồ sơ sẽ chuyển sang{' '}
                  <b>Bước 4 [Hoàn thành]</b> và tự động ghi vào Hồ sơ gốc BNV + Quá trình lương/công tác.
                </span>
              }
            />

            <Form form={decisionForm} layout="vertical">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="decision_number"
                    label="Số Quyết định ban hành"
                    rules={[{ required: true, message: 'Vui lòng nhập số Quyết định' }]}
                  >
                    <Input placeholder="VD: 158/QĐ-ĐV" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="decision_date"
                    label="Ngày ký Quyết định"
                    rules={[{ required: true, message: 'Chọn ngày ký' }]}
                  >
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="effective_date"
                    label={
                      isEditingAppointment
                        ? 'Ngày hiệu lực nhiệm kỳ mới'
                        : 'Ngày hưởng lương mới (Tính truy lĩnh)'
                    }
                    rules={[{ required: true, message: 'Chọn ngày hưởng' }]}
                  >
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              {!isEditingAppointment ? (
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="new_step"
                      label={`Bậc lương mới (Tối đa ${activeAlert.max_step})`}
                      rules={[{ required: true, message: 'Nhập bậc lương mới' }]}
                    >
                      <InputNumber min={1} max={12} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="new_coefficient"
                      label="Hệ số lương mới"
                      rules={[{ required: true, message: 'Nhập hệ số lương mới' }]}
                    >
                      <InputNumber step={0.01} min={1} max={15} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="new_exceed_percent" label="Phụ cấp vượt khung mới (%)">
                      <InputNumber min={0} max={50} addonAfter="%" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              ) : (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="new_leadership_position"
                      label="Chức vụ bổ nhiệm lại / kéo dài"
                      rules={[{ required: true, message: 'Nhập chức vụ' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="appointment_term" label="Thời hạn giữ chức vụ">
                      <Select
                        options={[
                          { label: '05 năm (60 tháng) - Bổ nhiệm lại', value: '05 năm (60 tháng)' },
                          {
                            label: 'Kéo dài thời gian giữ chức vụ đến tuổi nghỉ hưu',
                            value: 'Kéo dài đến tuổi nghỉ hưu',
                          },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              )}

              <Form.Item label="Đính kèm bản scan Quyết định có dấu đỏ (PDF / Word / Ảnh)">
                <Space align="center">
                  <Upload
                    beforeUpload={handleUploadDecisionPdf}
                    showUploadList={false}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  >
                    <Button icon={<UploadOutlined />} loading={uploadingPdf}>
                      Tải lên bản scan Quyết định (PDF)
                    </Button>
                  </Upload>
                  {uploadedFile && (
                    <Tag color="green" icon={<FilePdfOutlined />}>
                      <a href={uploadedFile.file_url} target="_blank" rel="noreferrer">
                        {uploadedFile.file_name}
                      </a>
                    </Tag>
                  )}
                </Space>
              </Form.Item>

              <Form.Item name="process_notes" label="Ghi chú phê duyệt & lưu hồ sơ">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* ===================================================================================
          MODAL 2: GIA HẠN THỜI GIAN XỬ LÝ HỒ SƠ (ADMINISTRATIVE EXTENSION)
         =================================================================================== */}
      <Modal
        title={
          <Space>
            <CalendarOutlined style={{ color: '#8b5cf6' }} />
            <span>Gia hạn Thời gian Xử lý Hồ sơ — {activeAlert?.full_name}</span>
          </Space>
        }
        open={extendModalOpen}
        onCancel={() => setExtendModalOpen(false)}
        onOk={handleSaveExtend}
        confirmLoading={submittingExtend}
        okText="Xác nhận Gia hạn Xử lý"
        cancelText="Huỷ"
        width={640}
      >
        {activeAlert && (
          <>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`Ngày đến hạn hưởng chế độ gốc của viên chức: ${dayjs(
                activeAlert.due_date
              ).format('DD/MM/YYYY')} (Đã gia hạn: ${activeAlert.extension_count || 0} lần)`}
              description="Nguyên tắc nghiệp vụ BA: Gia hạn xử lý hành chính chỉ dời hạn chót nhắc việc của bộ phận Nhân sự (để tạm gỡ cảnh báo đỏ Quá hạn trong thời gian chờ họp Hội đồng / chờ bổ sung hồ sơ), TUYỆT ĐỐI KHÔNG làm mất ngày hưởng lương gốc của viên chức."
            />

            <Form form={extendForm} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="extended_deadline"
                    label="Ngày hẹn hoàn tất xử lý mới"
                    rules={[{ required: true, message: 'Chọn ngày hẹn gia hạn' }]}
                  >
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                  <Space size={6} style={{ marginTop: -12, marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Chọn nhanh:
                    </Text>
                    <Button
                      size="small"
                      onClick={() =>
                        extendForm.setFieldValue('extended_deadline', dayjs().add(7, 'day'))
                      }
                    >
                      +7 ngày
                    </Button>
                    <Button
                      size="small"
                      onClick={() =>
                        extendForm.setFieldValue('extended_deadline', dayjs().add(15, 'day'))
                      }
                    >
                      +15 ngày
                    </Button>
                    <Button
                      size="small"
                      onClick={() =>
                        extendForm.setFieldValue('extended_deadline', dayjs().add(30, 'day'))
                      }
                    >
                      +30 ngày
                    </Button>
                  </Space>
                </Col>

                <Col span={12}>
                  <Form.Item name="target_status" label="Bước quy trình sau khi gia hạn">
                    <Select
                      options={[
                        {
                          label: 'Giữ ở Bước 3 (Chờ ban hành QĐ - Đang gia hạn)',
                          value: 'PENDING_DECISION',
                        },
                        {
                          label: 'Chuyển về Bước 2 (Đang lập / Bổ sung hồ sơ)',
                          value: 'IN_PROGRESS',
                        },
                        {
                          label: 'Tạm hoãn xét duyệt (ON_HOLD)',
                          value: 'ON_HOLD',
                        },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Chọn nhanh mẫu lý do gia hạn phổ biến">
                <Select
                  placeholder="Chọn mẫu lý do để điền nhanh..."
                  onChange={(val) => extendForm.setFieldValue('extension_reason', val)}
                  options={EXTENSION_REASON_TEMPLATES.map((t) => ({ label: t, value: t }))}
                />
              </Form.Item>

              <Form.Item
                name="extension_reason"
                label="Lý do gia hạn / Nội dung cần bổ sung hồ sơ (Bắt buộc)"
                rules={[
                  { required: true, message: 'Vui lòng nhập lý do gia hạn' },
                  { min: 5, message: 'Lý do tối thiểu 5 ký tự' },
                ]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Nhập rõ lý do chưa thể ban hành Quyết định đúng hạn và công việc cần hoàn thiện..."
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* ===================================================================================
          MODAL 3: TỪ CHỐI BAN HÀNH / LÙI KỲ XÉT (REJECTION FLOW)
         =================================================================================== */}
      <Modal
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#ef4444' }} />
            <span>Từ chối Ban hành Quyết định / Lùi kỳ xét — {activeAlert?.full_name}</span>
          </Space>
        }
        open={rejectModalOpen}
        onCancel={() => setRejectModalOpen(false)}
        onOk={handleSaveReject}
        confirmLoading={submittingReject}
        okButtonProps={{ danger: true }}
        okText="Xác nhận Từ chối"
        cancelText="Huỷ"
        width={660}
      >
        {activeAlert && (
          <>
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message={`Xử lý Từ chối đối với: ${activeAlert.alert_category_label} (Hạn hiện tại: ${dayjs(
                activeAlert.due_date
              ).format('DD/MM/YYYY')})`}
              description="Theo Thông tư 08/2013/TT-BNV & TT 03/2021/TT-BNV: Trường hợp viên chức không hoàn thành nhiệm vụ hoặc phát sinh kỷ luật mới, Hội đồng từ chối nâng lương đợt này và kéo dài thêm thời gian giữ bậc (+03, +06 hoặc +12 tháng) sang kỳ xét tiếp theo."
            />

            <Form form={rejectForm} layout="vertical">
              <Form.Item
                name="rejection_mode"
                label="Chọn Phương thức Xử lý Nghiệp vụ khi Từ chối"
                rules={[{ required: true }]}
              >
                <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Radio value="DELAY_CYCLE">
                    <b>Phương án 1 — Từ chối xét đợt này & Tự động Lùi kỳ xét (+3 / +6 / +12 tháng):</b>{' '}
                    Hệ thống tự động cộng thêm số tháng bị kéo dài vào Ngày đến hạn và đưa hồ sơ về lại
                    trạng thái theo dõi cho kỳ xét sau.
                  </Radio>
                  <Radio value="CLOSE_REJECTED">
                    <b>Phương án 2 — Từ chối hẳn & Đóng cảnh báo (Lưu hồ sơ từ chối):</b> Áp dụng khi
                    Quyết định không bổ nhiệm lại chức vụ quản lý (thôi giữ chức vụ) hoặc viên chức
                    không còn thuộc diện xét.
                  </Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) => prev.rejection_mode !== curr.rejection_mode}
              >
                {({ getFieldValue }) =>
                  getFieldValue('rejection_mode') === 'DELAY_CYCLE' ? (
                    <Form.Item
                      name="penalty_delay_months"
                      label="Số tháng bị kéo dài / lùi kỳ xét thêm"
                      rules={[{ required: true, message: 'Chọn số tháng lùi kỳ xét' }]}
                    >
                      <Select
                        options={[
                          {
                            label: '+03 tháng (Không hoàn thành NV đối với Hạng IV / Kỷ luật Khiển trách)',
                            value: 3,
                          },
                          {
                            label: '+06 tháng (Không hoàn thành NV đối với Hạng I, II, III / Kỷ luật Cảnh cáo)',
                            value: 6,
                          },
                          {
                            label: '+12 tháng (Kỷ luật Cách chức / 2 năm liên tiếp không hoàn thành NV)',
                            value: 12,
                          },
                        ]}
                      />
                    </Form.Item>
                  ) : (
                    <Form.Item
                      name="decision_number"
                      label="Số Thông báo / Quyết định thôi giữ chức vụ (Nếu có)"
                    >
                      <Input placeholder="VD: TB-88/TCCB về việc không thực hiện bổ nhiệm lại..." />
                    </Form.Item>
                  )
                }
              </Form.Item>

              <Form.Item label="Chọn nhanh mẫu lý do từ chối">
                <Select
                  placeholder="Chọn mẫu lý do từ chối theo quy định..."
                  onChange={(val) => rejectForm.setFieldValue('rejection_reason', val)}
                  options={REJECTION_REASON_TEMPLATES.map((t) => ({ label: t, value: t }))}
                />
              </Form.Item>

              <Form.Item
                name="rejection_reason"
                label="Lý do Từ chối / Căn cứ Biên bản họp Hội đồng (Bắt buộc)"
                rules={[
                  { required: true, message: 'Vui lòng nhập rõ lý do từ chối ban hành' },
                  { min: 5, message: 'Lý do tối thiểu 5 ký tự' },
                ]}
              >
                <Input.TextArea rows={3} placeholder="Nhập rõ căn cứ từ chối..." />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* ===================================================================================
          MODAL 4: TRẢ LẠI BƯỚC TRƯỚC (ROLLBACK) HOẶC TẠM HOÃN (ON_HOLD)
         =================================================================================== */}
      <Modal
        title={
          <Space>
            <RollbackOutlined style={{ color: '#3b82f6' }} />
            <span>Chuyển trả Bước xử lý / Tạm hoãn Hồ sơ — {activeAlert?.full_name}</span>
          </Space>
        }
        open={rollbackModalOpen}
        onCancel={() => setRollbackModalOpen(false)}
        onOk={handleSaveRollback}
        confirmLoading={submittingRollback}
        okText="Xác nhận Chuyển trạng thái"
        cancelText="Huỷ"
      >
        <Form form={rollbackForm} layout="vertical">
          <Form.Item
            name="target_status"
            label="Chọn trạng thái đích"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: '↩️ Trả về Bước 2: Đang lập hồ sơ (Yêu cầu chỉnh sửa/bổ sung)', value: 'IN_PROGRESS' },
                { label: '↩️ Trả về Bước 1: Chờ xử lý', value: 'WAITING' },
                { label: '⏸️ Tạm hoãn xét duyệt (ON_HOLD: Đang thanh tra / Thai sản / Đi học)', value: 'ON_HOLD' },
                { label: '➡️ Chuyển sang Bước 3: Chờ ban hành Quyết định', value: 'PENDING_DECISION' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Lý do chuyển bước / Yêu cầu xử lý"
            rules={[{ required: true, message: 'Vui lòng nhập lý do' }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===================================================================================
          DRAWER 5: NHẬT KÝ VẾT XỬ LÝ HỒ SƠ (AUDIT TIMELINE LOG)
         =================================================================================== */}
      <Drawer
        title={`📜 Nhật ký Vết Xử lý Hồ sơ Cảnh báo — ${activeAlert?.full_name || ''}`}
        width={520}
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
      >
        {activeAlert && (
          <>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Viên chức">{activeAlert.full_name}</Descriptions.Item>
              <Descriptions.Item label="Loại nghiệp vụ">
                {activeAlert.alert_category_label}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày đến hạn hưởng chế độ">
                <b>{dayjs(activeAlert.due_date).format('DD/MM/YYYY')}</b>
              </Descriptions.Item>
              {activeAlert.extended_deadline && (
                <Descriptions.Item label="Hạn gia hạn xử lý hành chính">
                  <Tag color="purple">
                    {dayjs(activeAlert.extended_deadline).format('DD/MM/YYYY')} (Lần{' '}
                    {activeAlert.extension_count})
                  </Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Trạng thái hiện tại">
                {renderWorkflowStatusTag(activeAlert)}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>Lịch sử Thao tác & Luân chuyển Bước (Audit Trail)</Title>
            {activeAlert.action_history && activeAlert.action_history.length > 0 ? (
              <Timeline
                style={{ marginTop: 16 }}
                items={activeAlert.action_history.map((h) => ({
                  color:
                    h.action_type === 'APPROVE_COMPLETE'
                      ? 'green'
                      : h.action_type.startsWith('REJECT')
                      ? 'red'
                      : h.action_type === 'EXTEND_DEADLINE'
                      ? 'purple'
                      : 'blue',
                  children: (
                    <div>
                      <Text strong>{h.action_label}</Text>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        🕒 {h.timestamp} • Thực hiện bởi: <b>{h.actor_name}</b>
                      </div>
                      {h.reason && (
                        <div
                          style={{
                            marginTop: 4,
                            padding: '4px 8px',
                            background: isDark ? '#1e293b' : '#f1f5f9',
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          Lý do / Ghi chú: {h.reason}
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            ) : (
              <Text type="secondary">Chưa có lịch sử thao tác thủ công trên bản ghi này.</Text>
            )}
          </>
        )}
      </Drawer>

      {/* Drawer Sổ tay Hướng dẫn Nghiệp vụ Hệ thống */}
      <Drawer
        title="📖 Tài liệu Hướng dẫn Nghiệp vụ: Cảnh báo Nâng bậc Lương & Bổ nhiệm lại"
        width={640}
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      >
        <Typography>
          <Title level={5}>1. Nghiệp vụ Cảnh báo Nâng bậc Lương Viên chức</Title>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Chu kỳ 36 tháng (3 năm)">
              Áp dụng cho viên chức giữ chức danh nghề nghiệp <b>Hạng I, Hạng II, Hạng III</b> (yêu cầu trình độ từ Đại học trở lên).
            </Descriptions.Item>
            <Descriptions.Item label="Chu kỳ 24 tháng (2 năm)">
              Áp dụng cho viên chức giữ chức danh nghề nghiệp <b>Hạng IV</b> (yêu cầu trình độ Cao đẳng trở xuống).
            </Descriptions.Item>
            <Descriptions.Item label="Cộng dồn thời gian kéo dài do Kỷ luật">
              • <b>Khiển trách:</b> Kéo dài thêm 03 tháng.<br />
              • <b>Cảnh cáo:</b> Kéo dài thêm 06 tháng.<br />
              • <b>Cách chức:</b> Kéo dài thêm 12 tháng.
            </Descriptions.Item>
            <Descriptions.Item label="Xử lý khi đã Kịch khung lương (Hết bậc trong ngạch)">
              Khi viên chức đã ở bậc cao nhất (VD: Chuyên viên Hạng III ở Bậc 9/9), hệ thống tự động chuyển sang luồng <b>Phụ cấp Thâm niên Vượt khung</b>:<br />
              • <b>Đủ 36 tháng ở bậc cuối:</b> Cảnh báo xét hưởng <b>5% vượt khung lần đầu</b>.<br />
              • <b>Cứ đủ 12 tháng tiếp theo:</b> Cảnh báo tăng thêm <b>+1% vượt khung</b>.
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          <Title level={5}>2. Quy tắc Duyệt sang Bước 4, Gia hạn xử lý & Từ chối ban hành</Title>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Duyệt sang Bước 4 (Hoàn thành)">
              Khi bấm <b>"Duyệt & Ban hành QĐ (B4)"</b>, hệ thống mặc định bảo lưu <b>Ngày đến hạn gốc</b> làm Ngày hưởng lương mới để tính truy lĩnh cho viên chức, đồng bộ thẳng vào Hồ sơ gốc BNV và đóng cảnh báo sang thẻ <b>4. [Hoàn thành]</b>.
            </Descriptions.Item>
            <Descriptions.Item label="Gia hạn xử lý hành chính">
              Cho phép dời hạn xử lý (+7, +15, +30 ngày) khi chờ họp Hội đồng hoặc chờ bổ sung hồ sơ. Hệ thống tạm gỡ báo động đỏ Quá hạn nhưng <b>không làm thay đổi Ngày hưởng chế độ gốc</b> của viên chức.
            </Descriptions.Item>
            <Descriptions.Item label="Từ chối ban hành / Lùi kỳ xét">
              Hỗ trợ 2 phương án: (1) <b>Lùi kỳ xét thêm +3/+6/+12 tháng</b> (do xếp loại Không hoàn thành nhiệm vụ hoặc kỷ luật mới) và tự động theo dõi kỳ sau; hoặc (2) <b>Đóng cảnh báo từ chối</b> (khi thôi giữ chức vụ quản lý / không bổ nhiệm lại).
            </Descriptions.Item>
          </Descriptions>
        </Typography>
      </Drawer>
    </div>
  );
}
