import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    Avatar,
    Badge,
    Button,
    Card,
    Collapse,
    DatePicker,
    Drawer,
    Empty,
    Form,
    Input,
    InputNumber,
    Modal,
    Popconfirm,
    Progress,
    Segmented,
    Select,
    Space,
    Spin,
    Switch,
    Tag,
    Tooltip,
    Typography,
    message,
} from 'antd';
import {
    HomeOutlined,
    CalendarOutlined,
    PlusCircleOutlined,
    IdcardOutlined,
    UserOutlined,
    PlusOutlined,
    ClockCircleOutlined,
    FileWordOutlined,
    PrinterOutlined,
    CheckCircleFilled,
    StarFilled,
    SafetyCertificateFilled,
    EnvironmentOutlined,
    DeleteOutlined,
    ReloadOutlined,
    DesktopOutlined,
    MobileOutlined,
    LogoutOutlined,
    BellOutlined,
    FileTextOutlined,
    DollarOutlined,
    PhoneOutlined,
    MailOutlined,
    BankOutlined,
    ScheduleOutlined,
    ThunderboltOutlined,
    ArrowLeftOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { mobileEssService } from '../../services/mobileEssService';
import { personnelProfileService } from '../../services/personnelProfileService';
import {
    MobileSpecialistSummaryResponse,
    MobileScheduleCreate,
    MobileLeaveRequestCreate,
    MobileOvertimeCreate,
} from '../../types/mobileEss';
import { VcProfileDetail } from '../../types/personnelProfile';
import {
    downloadOfficialWordFile,
    printOfficialProfileTemplate,
} from '../../utils/personnelWordTemplateGenerator';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../context/ThemeContext';
import { ROUTES } from '../../utils/routes';

const { Text } = Typography;
const { TextArea } = Input;

type MobileTabKey = 'home' | 'schedule' | 'requests' | 'profile' | 'account';

const LEAVE_TYPE_MAP: Record<string, { label: string; color: string }> = {
    ANNUAL_LEAVE: { label: 'Nghỉ phép năm (Có hưởng lương)', color: 'blue' },
    PAID_PERSONAL: { label: 'Nghỉ việc riêng hưởng lương (Kết hôn, hiếu hỷ)', color: 'cyan' },
    SICK_LEAVE: { label: 'Nghỉ ốm / Điều trị bệnh (BHXH)', color: 'orange' },
    COMPENSATORY: { label: 'Nghỉ bù làm thêm giờ', color: 'purple' },
    UNPAID_LEAVE: { label: 'Nghỉ không hưởng lương', color: 'default' },
};

const SESSION_TYPE_MAP: Record<string, string> = {
    FULL_DAY: 'Cả ngày (1.0 ngày)',
    MORNING: 'Buổi sáng (0.5 ngày)',
    AFTERNOON: 'Buổi chiều (0.5 ngày)',
};

const OT_DAY_TYPE_MAP: Record<string, { label: string; badgeColor: string }> = {
    WEEKDAY_150: { label: 'Ngày thường (Hệ số 150%)', badgeColor: 'blue' },
    WEEKEND_200: { label: 'Thứ Bảy / Chủ Nhật (Hệ số 200%)', badgeColor: 'purple' },
    HOLIDAY_300: { label: 'Ngày Lễ / Tết (Hệ số 300%)', badgeColor: 'red' },
};

const SCHEDULE_TYPE_MAP: Record<string, { label: string; color: string; bg: string }> = {
    OFFICE_WORK: { label: 'Làm việc tại cơ quan', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
    BUSINESS_TRIP: { label: 'Đi công tác / Thực địa', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
    MEETING: { label: 'Họp chuyên môn / Hội nghị', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
    DUTY_SHIFT: { label: 'Trực cơ quan / Trực chuyên môn', color: '#059669', bg: 'rgba(5,150,105,0.12)' },
};

const STATUS_TAG_MAP: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'Chờ phê duyệt', color: 'warning' },
    APPROVED: { label: 'Đã phê duyệt', color: 'success' },
    REJECTED: { label: 'Từ chối', color: 'error' },
    CANCELLED: { label: 'Đã hủy', color: 'default' },
};

const ALERT_CATEGORY_LABEL: Record<string, string> = {
    SALARY_REGULAR: 'Nâng bậc lương thường xuyên',
    SALARY_EXCEED: 'Phụ cấp thâm niên vượt khung',
    SALARY_EARLY: 'Nâng bậc lương trước thời hạn',
    REAPPOINTMENT: 'Bổ nhiệm lại chức vụ',
    EXTEND_TO_RETIREMENT: 'Kéo dài thời gian giữ chức vụ',
};

const CONTRACT_TYPE_LABEL: Record<string, string> = {
    probation: 'Hợp đồng thử việc',
    definite_term: 'HĐ làm việc xác định thời hạn',
    indefinite_term: 'HĐ làm việc không xác định thời hạn',
    internship: 'Hợp đồng tập sự / đào tạo',
    collaborator: 'Hợp đồng cộng tác viên',
};

export const SpecialistMobilePortal: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { isDark, toggleTheme } = useTheme();

    const [activeTab, setActiveTab] = useState<MobileTabKey>('home');
    const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() => window.innerWidth > 768);
    const [loading, setLoading] = useState<boolean>(true);
    const [summary, setSummary] = useState<MobileSpecialistSummaryResponse | null>(null);
    const [fullProfile, setFullProfile] = useState<VcProfileDetail | null>(null);
    const [loadingProfileDoc, setLoadingProfileDoc] = useState<boolean>(false);

    // Filter states for Schedule & Requests tabs
    const [selectedWeekDate, setSelectedWeekDate] = useState<Dayjs>(dayjs());
    const [scheduleFilter, setScheduleFilter] = useState<string>('ALL');
    const [requestSubTab, setRequestSubTab] = useState<'LEAVE' | 'OT'>('LEAVE');
    const [requestStatusFilter, setRequestStatusFilter] = useState<string>('ALL');

    // Bottom sheet modals
    const [leaveDrawerOpen, setLeaveDrawerOpen] = useState<boolean>(false);
    const [otDrawerOpen, setOtDrawerOpen] = useState<boolean>(false);
    const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState<boolean>(false);
    const [actionPickerOpen, setActionPickerOpen] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);

    const [leaveForm] = Form.useForm();
    const [otForm] = Form.useForm();
    const [scheduleForm] = Form.useForm();

    const fetchMobileData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await mobileEssService.getMySummary();
            setSummary(data);
        } catch (err: any) {
            message.error(err?.response?.data?.detail || 'Không thể tải dữ liệu Cổng Mobile Chuyên viên');
        } finally {
            setLoading(false);
        }
    }, []);

    const ensureFullProfileLoaded = useCallback(async (): Promise<VcProfileDetail | null> => {
        if (fullProfile) return fullProfile;
        if (!user?.id) return null;
        setLoadingProfileDoc(true);
        try {
            const detail = await personnelProfileService.getByUser(user.id);
            setFullProfile(detail);
            return detail;
        } catch {
            message.warning('Chưa thể tải chi tiết 38 mục hồ sơ BNV của tài khoản này');
            return null;
        } finally {
            setLoadingProfileDoc(false);
        }
    }, [fullProfile, user?.id]);

    useEffect(() => {
        const onResize = () => setIsDesktopViewport(window.innerWidth > 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        fetchMobileData();
    }, [fetchMobileData]);

    useEffect(() => {
        if (activeTab === 'profile' && !fullProfile && user?.id) {
            ensureFullProfileLoaded();
        }
    }, [activeTab, fullProfile, user?.id, ensureFullProfileLoaded]);

    // Watch Leave Form to auto-calculate days
    const watchLeaveStart: Dayjs | undefined = Form.useWatch('start_date', leaveForm);
    const watchLeaveEnd: Dayjs | undefined = Form.useWatch('end_date', leaveForm);
    const watchSessionType: string | undefined = Form.useWatch('session_type', leaveForm);

    const previewLeaveDays = useMemo(() => {
        if (!watchLeaveStart || !watchLeaveEnd) return 1.0;
        const diff = watchLeaveEnd.startOf('day').diff(watchLeaveStart.startOf('day'), 'day') + 1;
        if (diff <= 0) return 0;
        if (diff === 1 && (watchSessionType === 'MORNING' || watchSessionType === 'AFTERNOON')) {
            return 0.5;
        }
        return diff;
    }, [watchLeaveStart, watchLeaveEnd, watchSessionType]);

    // Watch OT Form to auto-calculate hours
    const watchOtStart: string | undefined = Form.useWatch('start_time', otForm);
    const watchOtEnd: string | undefined = Form.useWatch('end_time', otForm);

    const previewOtHours = useMemo(() => {
        if (!watchOtStart || !watchOtEnd) return 3.0;
        const [sh, sm] = watchOtStart.split(':').map(Number);
        const [eh, em] = watchOtEnd.split(':').map(Number);
        if (Number.isNaN(sh) || Number.isNaN(eh)) return 2.5;
        const mins = eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
        return mins > 0 ? Math.round((mins / 60) * 10) / 10 : 2.0;
    }, [watchOtStart, watchOtEnd]);

    // Handlers for creating Leave, OT, Schedule
    const handleCreateLeave = async () => {
        try {
            const values = await leaveForm.validateFields();
            setSubmitting(true);
            const payload: MobileLeaveRequestCreate = {
                leave_type: values.leave_type,
                start_date: values.start_date.format('YYYY-MM-DD'),
                end_date: values.end_date.format('YYYY-MM-DD'),
                session_type: values.session_type,
                total_days: previewLeaveDays,
                reason: values.reason,
                handover_person: values.handover_person || null,
                contact_phone: values.contact_phone || summary?.personal_phone || null,
            };
            await mobileEssService.createLeaveRequest(payload);
            message.success('Đã gửi đơn xin nghỉ phép thành công!');
            setLeaveDrawerOpen(false);
            leaveForm.resetFields();
            await fetchMobileData();
            setActiveTab('requests');
            setRequestSubTab('LEAVE');
        } catch (err: any) {
            if (err?.response?.data?.detail) {
                message.error(err.response.data.detail);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateOvertime = async () => {
        try {
            const values = await otForm.validateFields();
            setSubmitting(true);
            const payload: MobileOvertimeCreate = {
                work_date: values.work_date.format('YYYY-MM-DD'),
                start_time: values.start_time,
                end_time: values.end_time,
                total_hours: previewOtHours,
                day_type: values.day_type,
                work_location: values.work_location || 'Tại cơ quan',
                task_description: values.task_description,
            };
            await mobileEssService.createOvertimeRequest(payload);
            message.success('Đã gửi phiếu đăng ký làm thêm giờ (OT) thành công!');
            setOtDrawerOpen(false);
            otForm.resetFields();
            await fetchMobileData();
            setActiveTab('requests');
            setRequestSubTab('OT');
        } catch (err: any) {
            if (err?.response?.data?.detail) {
                message.error(err.response.data.detail);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateSchedule = async () => {
        try {
            const values = await scheduleForm.validateFields();
            setSubmitting(true);
            const payload: MobileScheduleCreate = {
                schedule_date: values.schedule_date.format('YYYY-MM-DD'),
                start_time: values.start_time || '08:00',
                end_time: values.end_time || '17:00',
                schedule_type: values.schedule_type || 'OFFICE_WORK',
                title: values.title,
                location: values.location || null,
                notes: values.notes || null,
            };
            await mobileEssService.createSchedule(payload);
            message.success('Đã thêm lịch công tác / làm việc cá nhân!');
            setScheduleDrawerOpen(false);
            scheduleForm.resetFields();
            await fetchMobileData();
            setActiveTab('schedule');
        } catch (err: any) {
            if (err?.response?.data?.detail) {
                message.error(err.response.data.detail);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDownloadWord = async (templateType: 'tt06' | 'hs01') => {
        const prof = await ensureFullProfileLoaded();
        if (!prof) return;
        downloadOfficialWordFile(prof, templateType);
        message.success(
            templateType === 'tt06'
                ? 'Đang tải Sơ yếu lý lịch (Mẫu TT 06/2023/TT-BNV) .doc'
                : 'Đang tải Lý lịch viên chức (Mẫu HS01-VC/BNV) .doc'
        );
    };

    const handlePrintTemplate = async (templateType: 'tt06' | 'hs01') => {
        const prof = await ensureFullProfileLoaded();
        if (!prof) return;
        printOfficialProfileTemplate(prof, templateType);
    };

    // Unified Personal Timeline for Tab 2 (Schedules + Leave Days + Overtime Sessions)
    const unifiedTimelineItems = useMemo(() => {
        if (!summary) return [];
        const items: Array<{
            id: string;
            date: string;
            timeRange: string;
            category: 'SCHEDULE' | 'LEAVE' | 'OT';
            subType: string;
            title: string;
            subtitle: string;
            status: string;
            rawId: string;
            canDelete: boolean;
        }> = [];

        for (const s of summary.schedules) {
            const st = SCHEDULE_TYPE_MAP[s.schedule_type] || SCHEDULE_TYPE_MAP.OFFICE_WORK;
            items.push({
                id: `sched-${s.id}`,
                rawId: s.id,
                date: s.schedule_date,
                timeRange: `${s.start_time} - ${s.end_time}`,
                category: 'SCHEDULE',
                subType: s.schedule_type,
                title: s.title,
                subtitle: s.location ? `📍 ${s.location}` : st.label,
                status: s.status,
                canDelete: true,
            });
        }

        for (const lv of summary.leave_requests) {
            const lt = LEAVE_TYPE_MAP[lv.leave_type]?.label || lv.leave_type;
            items.push({
                id: `leave-${lv.id}`,
                rawId: lv.id,
                date: lv.start_date,
                timeRange: `${SESSION_TYPE_MAP[lv.session_type] || lv.session_type} (${lv.total_days} ngày)`,
                category: 'LEAVE',
                subType: lv.leave_type,
                title: `[Nghỉ phép] ${lt}`,
                subtitle: `Lý do: ${lv.reason}`,
                status: lv.status,
                canDelete: lv.status === 'PENDING',
            });
        }

        for (const ot of summary.overtime_requests) {
            const dt = OT_DAY_TYPE_MAP[ot.day_type]?.label || ot.day_type;
            items.push({
                id: `ot-${ot.id}`,
                rawId: ot.id,
                date: ot.work_date,
                timeRange: `${ot.start_time} - ${ot.end_time} (${ot.total_hours}h)`,
                category: 'OT',
                subType: ot.day_type,
                title: `[Làm thêm giờ OT] ${ot.task_description}`,
                subtitle: `${dt} • 📍 ${ot.work_location || 'Tại cơ quan'}`,
                status: ot.status,
                canDelete: ot.status === 'PENDING',
            });
        }

        return items
            .filter((it) => {
                if (scheduleFilter === 'ALL') return true;
                return it.category === scheduleFilter;
            })
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    }, [summary, scheduleFilter]);

    // 7-day strip around selectedWeekDate
    const weekDaysStrip = useMemo(() => {
        const startOfWeek = selectedWeekDate.startOf('week');
        return Array.from({ length: 7 }, (_, idx) => startOfWeek.add(idx, 'day'));
    }, [selectedWeekDate]);

    // Color palette for Mobile Shell
    const bgOuter = isDark ? '#060b14' : '#e2e8f0';
    const bgApp = isDark ? '#0f172a' : '#f8fafc';
    const bgCard = isDark ? '#1e293b' : '#ffffff';
    const borderSubtle = isDark ? 'rgba(148, 163, 184, 0.14)' : '#e2e8f0';
    const textPrimary = isDark ? '#f8fafc' : '#0f172a';
    const textSecondary = isDark ? '#94a3b8' : '#64748b';

    const openLeaveDrawer = () => {
        leaveForm.setFieldsValue({
            leave_type: 'ANNUAL_LEAVE',
            session_type: 'FULL_DAY',
            start_date: dayjs().add(1, 'day'),
            end_date: dayjs().add(1, 'day'),
            contact_phone: summary?.personal_phone || '',
        });
        setLeaveDrawerOpen(true);
    };

    const openOtDrawer = () => {
        otForm.setFieldsValue({
            work_date: dayjs(),
            start_time: '17:30',
            end_time: '20:30',
            day_type: 'WEEKDAY_150',
            work_location: 'Tại cơ quan (' + (summary?.department_name || 'Văn phòng') + ')',
        });
        setOtDrawerOpen(true);
    };

    const openScheduleDrawer = () => {
        scheduleForm.setFieldsValue({
            schedule_date: dayjs(),
            start_time: '08:00',
            end_time: '11:30',
            schedule_type: 'OFFICE_WORK',
            location: summary?.department_name || 'Phòng chuyên môn',
        });
        setScheduleDrawerOpen(true);
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                background: bgOuter,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: isDesktopViewport ? 'center' : 'stretch',
                padding: isDesktopViewport ? '12px' : 0,
            }}
        >
            {/* Khung App Mobile Chuyên viên */}
            <div
                style={{
                    width: '100%',
                    maxWidth: isDesktopViewport ? 430 : '100%',
                    minHeight: isDesktopViewport ? 'calc(100vh - 24px)' : '100vh',
                    background: bgApp,
                    borderRadius: isDesktopViewport ? 28 : 0,
                    border: isDesktopViewport ? `4px solid ${isDark ? '#1e293b' : '#cbd5e1'}` : 'none',
                    boxShadow: isDesktopViewport ? '0 20px 50px rgba(0, 0, 0, 0.35)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Sticky Mobile App Header */}
                <div
                    style={{
                        padding: '14px 18px 12px',
                        background: isDark
                            ? 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)'
                            : 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: `1px solid ${borderSubtle}`,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar
                            size={40}
                            src={summary?.portrait_url || undefined}
                            icon={<UserOutlined />}
                            style={{
                                background: '#3b82f6',
                                border: '2px solid rgba(255,255,255,0.75)',
                                flexShrink: 0,
                            }}
                        />
                        <div style={{ lineHeight: 1.25 }}>
                            <div style={{ fontSize: 11, opacity: 0.85 }}>Cổng Chuyên viên Self-Service</div>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>
                                {summary?.full_name || user?.full_name || 'Chuyên viên'}
                            </div>
                        </div>
                    </div>
                    <Space size={8}>
                        <Badge count={(summary?.pending_leave_count || 0) + (summary?.pending_ot_count || 0)} size="small">
                            <Button
                                type="text"
                                shape="circle"
                                icon={<BellOutlined style={{ color: '#fff', fontSize: 17 }} />}
                                onClick={() => setActiveTab('requests')}
                            />
                        </Badge>
                        <Button
                            type="text"
                            shape="circle"
                            icon={<ReloadOutlined spin={loading} style={{ color: '#fff', fontSize: 16 }} />}
                            onClick={fetchMobileData}
                        />
                    </Space>
                </div>

                {/* Scrollable Viewport Content */}
                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '14px 14px 92px 14px',
                    }}
                >
                    {loading && !summary ? (
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                            <Spin size="large" />
                            <div style={{ marginTop: 12, color: textSecondary, fontSize: 13 }}>
                                Đang đồng bộ không gian cá nhân của chuyên viên...
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* ========================================================= */}
                            {/* TAB 1: TRANG CHỦ CÁ NHÂN (PERSONAL HUB)                   */}
                            {/* ========================================================= */}
                            {activeTab === 'home' && summary && (
                                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                                    {/* Thẻ Định danh Chuyên viên Số (Digital Specialist ID Card) */}
                                    <div
                                        style={{
                                            borderRadius: 20,
                                            padding: '16px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #1e3a8a 0%, #312e81 55%, #0f172a 100%)'
                                                : 'linear-gradient(135deg, #2563eb 0%, #4338ca 100%)',
                                            color: '#ffffff',
                                            boxShadow: '0 12px 28px rgba(37, 99, 235, 0.28)',
                                            position: 'relative',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'flex-start',
                                                marginBottom: 12,
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.8 }}>
                                                    {summary.department_name || 'Đơn vị sự nghiệp'}
                                                </div>
                                                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                                                    {summary.birth_full_name || summary.full_name}
                                                </div>
                                                <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 2 }}>
                                                    {summary.professional_title_name || 'Chuyên viên'} ({summary.professional_title_code || '01.003'})
                                                </div>
                                            </div>
                                            <Tag
                                                color="rgba(255,255,255,0.18)"
                                                style={{
                                                    color: '#fff',
                                                    border: '1px solid rgba(255,255,255,0.3)',
                                                    borderRadius: 999,
                                                    margin: 0,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                Mã HS: {summary.official_file_code || 'Chưa cấp'}
                                            </Tag>
                                        </div>

                                        {/* Huy hiệu trạng thái Viên chức & Đảng viên */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                            <span
                                                style={{
                                                    fontSize: 11.5,
                                                    padding: '3px 10px',
                                                    borderRadius: 999,
                                                    background: summary.is_official_civil_servant
                                                        ? 'rgba(16, 185, 129, 0.25)'
                                                        : 'rgba(245, 158, 11, 0.25)',
                                                    border: '1px solid rgba(255,255,255,0.28)',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 5,
                                                }}
                                            >
                                                <SafetyCertificateFilled style={{ color: '#34d399' }} />
                                                {summary.is_official_civil_servant ? 'Đã vào biên chế Viên chức' : 'Chưa vào ngạch Viên chức'}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 11.5,
                                                    padding: '3px 10px',
                                                    borderRadius: 999,
                                                    background: summary.is_cpv_member
                                                        ? 'rgba(239, 68, 68, 0.32)'
                                                        : 'rgba(148, 163, 184, 0.22)',
                                                    border: '1px solid rgba(255,255,255,0.28)',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 5,
                                                }}
                                            >
                                                <StarFilled style={{ color: summary.is_cpv_member ? '#fde047' : '#cbd5e1' }} />
                                                {summary.is_cpv_member ? 'Đảng viên ĐCSVN' : 'Quần chúng'}
                                            </span>
                                        </div>

                                        {/* Thông số Bậc lương & Hoàn thiện hồ sơ */}
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr 1fr',
                                                gap: 8,
                                                paddingTop: 10,
                                                borderTop: '1px solid rgba(255,255,255,0.18)',
                                                fontSize: 12,
                                            }}
                                        >
                                            <div>
                                                <div style={{ opacity: 0.75, fontSize: 11 }}>Bậc / Hệ số lương</div>
                                                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                                                    {summary.salary_step ? `Bậc ${summary.salary_step}` : 'Bậc 1'} (HS: {summary.salary_coefficient ?? '2.34'})
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ opacity: 0.75, fontSize: 11 }}>Nâng lương kế tiếp</div>
                                                <div style={{ fontWeight: 700, fontSize: 13 }}>
                                                    {summary.next_promotion_date
                                                        ? dayjs(summary.next_promotion_date).format('DD/MM/YYYY')
                                                        : 'Đang cập nhật'}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ opacity: 0.75, fontSize: 11 }}>Độ hoàn thiện HS</div>
                                                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                                                    {summary.profile_completion_percent}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4 Nút Thao tác Nhanh (1-Tap Self-Service) */}
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(4, 1fr)',
                                            gap: 8,
                                        }}
                                    >
                                        {[
                                            {
                                                label: 'Xin nghỉ phép',
                                                icon: <CalendarOutlined style={{ fontSize: 20, color: '#2563eb' }} />,
                                                bg: 'rgba(37, 99, 235, 0.12)',
                                                onClick: openLeaveDrawer,
                                            },
                                            {
                                                label: 'Đăng ký OT',
                                                icon: <ThunderboltOutlined style={{ fontSize: 20, color: '#7c3aed' }} />,
                                                bg: 'rgba(124, 58, 237, 0.12)',
                                                onClick: openOtDrawer,
                                            },
                                            {
                                                label: 'Thêm lịch',
                                                icon: <ScheduleOutlined style={{ fontSize: 20, color: '#059669' }} />,
                                                bg: 'rgba(5, 150, 105, 0.12)',
                                                onClick: openScheduleDrawer,
                                            },
                                            {
                                                label: 'Tải HS Word',
                                                icon: <FileWordOutlined style={{ fontSize: 20, color: '#d97706' }} />,
                                                bg: 'rgba(217, 119, 6, 0.12)',
                                                onClick: () => handleDownloadWord('tt06'),
                                            },
                                        ].map((btn, i) => (
                                            <div
                                                key={i}
                                                onClick={btn.onClick}
                                                style={{
                                                    background: bgCard,
                                                    border: `1px solid ${borderSubtle}`,
                                                    borderRadius: 16,
                                                    padding: '12px 6px',
                                                    textAlign: 'center',
                                                    cursor: 'pointer',
                                                    transition: 'transform 0.15s',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: 42,
                                                        height: 42,
                                                        borderRadius: 12,
                                                        background: btn.bg,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        margin: '0 auto 6px',
                                                    }}
                                                >
                                                    {btn.icon}
                                                </div>
                                                <div style={{ fontSize: 11.5, fontWeight: 600, color: textPrimary }}>
                                                    {btn.label}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 2 Thẻ Thống kê Cá nhân: Quỹ phép năm & Giờ làm thêm OT trong tháng */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                        <div
                                            onClick={() => {
                                                setActiveTab('requests');
                                                setRequestSubTab('LEAVE');
                                            }}
                                            style={{
                                                background: bgCard,
                                                border: `1px solid ${borderSubtle}`,
                                                borderRadius: 16,
                                                padding: '14px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={{ fontSize: 12, color: textSecondary }}>Quỹ phép năm {dayjs().year()}</Text>
                                                <Tag color="blue" style={{ margin: 0, fontSize: 10, borderRadius: 999 }}>
                                                    Tổng {summary.annual_leave_total_days} ngày
                                                </Tag>
                                            </div>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb', margin: '6px 0 2px' }}>
                                                {summary.annual_leave_remaining_days} <span style={{ fontSize: 13, fontWeight: 500 }}>ngày còn lại</span>
                                            </div>
                                            <div style={{ fontSize: 11.5, color: textSecondary }}>
                                                Đã nghỉ/đăng ký: <b>{summary.annual_leave_used_days}</b> ngày
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => {
                                                setActiveTab('requests');
                                                setRequestSubTab('OT');
                                            }}
                                            style={{
                                                background: bgCard,
                                                border: `1px solid ${borderSubtle}`,
                                                borderRadius: 16,
                                                padding: '14px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={{ fontSize: 12, color: textSecondary }}>Làm thêm giờ (T{dayjs().month() + 1})</Text>
                                                <Tag color="purple" style={{ margin: 0, fontSize: 10, borderRadius: 999 }}>
                                                    OT Cá nhân
                                                </Tag>
                                            </div>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed', margin: '6px 0 2px' }}>
                                                {summary.current_month_ot_hours} <span style={{ fontSize: 13, fontWeight: 500 }}>giờ trong tháng</span>
                                            </div>
                                            <div style={{ fontSize: 11.5, color: textSecondary }}>
                                                Phiếu chờ duyệt: <b>{summary.pending_ot_count}</b> phiếu
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cảnh báo Hồ sơ Cá nhân sắp đến hạn (Nếu có từ bảng vc_personnel_alerts) */}
                                    {summary.personal_alerts.length > 0 && (
                                        <div
                                            style={{
                                                background: bgCard,
                                                border: `1px solid ${borderSubtle}`,
                                                borderRadius: 16,
                                                padding: '14px',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                <Space size={6}>
                                                    <BellOutlined style={{ color: '#f59e0b' }} />
                                                    <Text strong style={{ fontSize: 13.5, color: textPrimary }}>
                                                        Chế độ & Hồ sơ cá nhân đến hạn ({summary.personal_alerts.length})
                                                    </Text>
                                                </Space>
                                            </div>
                                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                                {summary.personal_alerts.map((al) => {
                                                    const isUrgent = al.days_remaining <= 30;
                                                    return (
                                                        <div
                                                            key={al.id}
                                                            style={{
                                                                padding: '10px 12px',
                                                                borderRadius: 12,
                                                                background: isUrgent
                                                                    ? 'rgba(245, 158, 11, 0.12)'
                                                                    : isDark
                                                                    ? 'rgba(30, 41, 59, 0.7)'
                                                                    : '#f1f5f9',
                                                                borderLeft: `4px solid ${isUrgent ? '#f59e0b' : '#3b82f6'}`,
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <Text strong style={{ fontSize: 13, color: textPrimary }}>
                                                                    {ALERT_CATEGORY_LABEL[al.alert_category] || al.alert_category}
                                                                </Text>
                                                                <Tag color={al.days_remaining < 0 ? 'red' : isUrgent ? 'gold' : 'blue'} style={{ margin: 0 }}>
                                                                    {al.days_remaining < 0
                                                                        ? `Quá hạn ${Math.abs(al.days_remaining)} ngày`
                                                                        : `Còn ${al.days_remaining} ngày`}
                                                                </Tag>
                                                            </div>
                                                            <div style={{ fontSize: 12, color: textSecondary, marginTop: 4 }}>
                                                                Ngày đến hạn hưởng chế độ: <b>{dayjs(al.due_date).format('DD/MM/YYYY')}</b>
                                                                {al.current_step && al.proposed_step
                                                                    ? ` • Bậc ${al.current_step} (${al.current_coefficient}) → Bậc ${al.proposed_step} (${al.proposed_coefficient})`
                                                                    : ''}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </Space>
                                        </div>
                                    )}

                                    {/* Lịch trình & Hoạt động cá nhân gần nhất */}
                                    <div
                                        style={{
                                            background: bgCard,
                                            border: `1px solid ${borderSubtle}`,
                                            borderRadius: 16,
                                            padding: '14px',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <Space size={6}>
                                                <CalendarOutlined style={{ color: '#2563eb' }} />
                                                <Text strong style={{ fontSize: 13.5, color: textPrimary }}>
                                                    Lịch & Hoạt động cá nhân
                                                </Text>
                                            </Space>
                                            <Button type="link" size="small" onClick={() => setActiveTab('schedule')} style={{ padding: 0 }}>
                                                Xem tất cả →
                                            </Button>
                                        </div>

                                        {unifiedTimelineItems.length === 0 ? (
                                            <Empty
                                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                description={
                                                    <span style={{ fontSize: 12, color: textSecondary }}>
                                                        Bạn chưa có lịch công tác, đơn nghỉ phép hay ca OT nào.
                                                    </span>
                                                }
                                            >
                                                <Space>
                                                    <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openScheduleDrawer}>
                                                        Thêm lịch công tác
                                                    </Button>
                                                    <Button size="small" onClick={openOtDrawer}>
                                                        Đăng ký OT
                                                    </Button>
                                                </Space>
                                            </Empty>
                                        ) : (
                                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                                {unifiedTimelineItems.slice(0, 4).map((item) => (
                                                    <div
                                                        key={item.id}
                                                        style={{
                                                            padding: '10px 12px',
                                                            borderRadius: 12,
                                                            background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                                                            border: `1px solid ${borderSubtle}`,
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            gap: 8,
                                                        }}
                                                    >
                                                        <div>
                                                            <div style={{ fontSize: 11.5, color: '#3b82f6', fontWeight: 600 }}>
                                                                {dayjs(item.date).format('DD/MM/YYYY')} • {item.timeRange}
                                                            </div>
                                                            <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary, marginTop: 2 }}>
                                                                {item.title}
                                                            </div>
                                                            <div style={{ fontSize: 11.5, color: textSecondary }}>
                                                                {item.subtitle}
                                                            </div>
                                                        </div>
                                                        <Tag
                                                            color={STATUS_TAG_MAP[item.status]?.color || 'blue'}
                                                            style={{ margin: 0, borderRadius: 999, fontSize: 11 }}
                                                        >
                                                            {STATUS_TAG_MAP[item.status]?.label || 'Đã xác nhận'}
                                                        </Tag>
                                                    </div>
                                                ))}
                                            </Space>
                                        )}
                                    </div>
                                </Space>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 2: LỊCH CỦA TÔI (PERSONAL SCHEDULE & TIMELINE)        */}
                            {/* ========================================================= */}
                            {activeTab === 'schedule' && summary && (
                                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                                    <div
                                        style={{
                                            background: bgCard,
                                            border: `1px solid ${borderSubtle}`,
                                            borderRadius: 16,
                                            padding: '14px',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <div>
                                                <Text strong style={{ fontSize: 15, color: textPrimary }}>
                                                    Lịch làm việc & Công tác của tôi
                                                </Text>
                                                <div style={{ fontSize: 12, color: textSecondary }}>
                                                    Tháng {selectedWeekDate.format('MM/YYYY')}
                                                </div>
                                            </div>
                                            <Button
                                                type="primary"
                                                size="small"
                                                icon={<PlusOutlined />}
                                                onClick={openScheduleDrawer}
                                                style={{ borderRadius: 999 }}
                                            >
                                                Thêm lịch
                                            </Button>
                                        </div>

                                        {/* Thanh chọn 7 ngày trong tuần */}
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(7, 1fr)',
                                                gap: 6,
                                                marginBottom: 12,
                                            }}
                                        >
                                            {weekDaysStrip.map((d) => {
                                                const isSelected = d.isSame(selectedWeekDate, 'day');
                                                const isToday = d.isSame(dayjs(), 'day');
                                                const dateStr = d.format('YYYY-MM-DD');
                                                const hasEvent = unifiedTimelineItems.some((it) => it.date === dateStr);
                                                return (
                                                    <div
                                                        key={dateStr}
                                                        onClick={() => setSelectedWeekDate(d)}
                                                        style={{
                                                            padding: '8px 4px',
                                                            borderRadius: 12,
                                                            textAlign: 'center',
                                                            cursor: 'pointer',
                                                            background: isSelected
                                                                ? '#2563eb'
                                                                : isToday
                                                                ? 'rgba(37, 99, 235, 0.12)'
                                                                : 'transparent',
                                                            color: isSelected ? '#ffffff' : textPrimary,
                                                            border: isToday && !isSelected ? '1px solid #2563eb' : `1px solid ${borderSubtle}`,
                                                        }}
                                                    >
                                                        <div style={{ fontSize: 10.5, opacity: 0.75 }}>
                                                            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.day()]}
                                                        </div>
                                                        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                                                            {d.format('DD')}
                                                        </div>
                                                        {hasEvent && (
                                                            <div
                                                                style={{
                                                                    width: 5,
                                                                    height: 5,
                                                                    borderRadius: '50%',
                                                                    background: isSelected ? '#fff' : '#f59e0b',
                                                                    margin: '3px auto 0',
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <Segmented
                                            block
                                            size="small"
                                            value={scheduleFilter}
                                            onChange={(val) => setScheduleFilter(val as string)}
                                            options={[
                                                { label: 'Tất cả', value: 'ALL' },
                                                { label: 'Công tác', value: 'SCHEDULE' },
                                                { label: 'Nghỉ phép', value: 'LEAVE' },
                                                { label: 'Ca OT', value: 'OT' },
                                            ]}
                                        />
                                    </div>

                                    {/* Danh sách dòng thời gian cá nhân */}
                                    <div
                                        style={{
                                            background: bgCard,
                                            border: `1px solid ${borderSubtle}`,
                                            borderRadius: 16,
                                            padding: '14px',
                                        }}
                                    >
                                        <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text strong style={{ fontSize: 13.5, color: textPrimary }}>
                                                Danh sách lịch trình cá nhân ({unifiedTimelineItems.length})
                                            </Text>
                                        </div>

                                        {unifiedTimelineItems.length === 0 ? (
                                            <Empty
                                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                description="Chưa có lịch làm việc, công tác hay ca OT nào trong mục này"
                                            >
                                                <Button type="primary" icon={<PlusOutlined />} onClick={openScheduleDrawer}>
                                                    Tạo lịch công tác mới
                                                </Button>
                                            </Empty>
                                        ) : (
                                            <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                                {unifiedTimelineItems.map((item) => {
                                                    const badgeColor =
                                                        item.category === 'LEAVE'
                                                            ? '#d97706'
                                                            : item.category === 'OT'
                                                            ? '#7c3aed'
                                                            : '#2563eb';
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            style={{
                                                                padding: '12px',
                                                                borderRadius: 14,
                                                                background: isDark ? 'rgba(15, 23, 42, 0.65)' : '#f8fafc',
                                                                border: `1px solid ${borderSubtle}`,
                                                                borderLeft: `4px solid ${badgeColor}`,
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                <div>
                                                                    <Space size={6}>
                                                                        <Tag color={badgeColor} style={{ margin: 0, fontSize: 11, borderRadius: 6 }}>
                                                                            {dayjs(item.date).format('DD/MM/YYYY')}
                                                                        </Tag>
                                                                        <Text style={{ fontSize: 12, color: textSecondary }}>
                                                                            <ClockCircleOutlined /> {item.timeRange}
                                                                        </Text>
                                                                    </Space>
                                                                    <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary, marginTop: 6 }}>
                                                                        {item.title}
                                                                    </div>
                                                                    <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
                                                                        {item.subtitle}
                                                                    </div>
                                                                </div>
                                                                {item.canDelete && item.category === 'SCHEDULE' && (
                                                                    <Popconfirm
                                                                        title="Xóa lịch cá nhân này?"
                                                                        onConfirm={async () => {
                                                                            await mobileEssService.deleteSchedule(item.rawId);
                                                                            message.success('Đã xóa lịch cá nhân');
                                                                            fetchMobileData();
                                                                        }}
                                                                    >
                                                                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                                                                    </Popconfirm>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </Space>
                                        )}
                                    </div>
                                </Space>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 3: ĐƠN TỪ CÁ NHÂN (NGHỈ PHÉP & ĐĂNG KÝ LÀM THÊM GIỜ) */}
                            {/* ========================================================= */}
                            {activeTab === 'requests' && summary && (
                                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                                    <div
                                        style={{
                                            background: bgCard,
                                            border: `1px solid ${borderSubtle}`,
                                            borderRadius: 16,
                                            padding: '14px',
                                        }}
                                    >
                                        <Segmented
                                            block
                                            value={requestSubTab}
                                            onChange={(val) => setRequestSubTab(val as 'LEAVE' | 'OT')}
                                            options={[
                                                {
                                                    label: `Đơn Nghỉ phép (${summary.leave_requests.length})`,
                                                    value: 'LEAVE',
                                                },
                                                {
                                                    label: `Đăng ký OT (${summary.overtime_requests.length})`,
                                                    value: 'OT',
                                                },
                                            ]}
                                            style={{ marginBottom: 12 }}
                                        />

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                            <Select
                                                size="small"
                                                value={requestStatusFilter}
                                                onChange={setRequestStatusFilter}
                                                style={{ width: 150 }}
                                                options={[
                                                    { value: 'ALL', label: 'Tất cả trạng thái' },
                                                    { value: 'PENDING', label: 'Đang chờ duyệt' },
                                                    { value: 'APPROVED', label: 'Đã phê duyệt' },
                                                ]}
                                            />
                                            {requestSubTab === 'LEAVE' ? (
                                                <Button
                                                    type="primary"
                                                    size="small"
                                                    icon={<PlusOutlined />}
                                                    onClick={openLeaveDrawer}
                                                    style={{ borderRadius: 999 }}
                                                >
                                                    Tạo đơn nghỉ phép
                                                </Button>
                                            ) : (
                                                <Button
                                                    type="primary"
                                                    size="small"
                                                    icon={<PlusOutlined />}
                                                    onClick={openOtDrawer}
                                                    style={{ borderRadius: 999, background: '#7c3aed' }}
                                                >
                                                    Đăng ký làm thêm giờ
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {requestSubTab === 'LEAVE' ? (
                                        <div
                                            style={{
                                                background: bgCard,
                                                border: `1px solid ${borderSubtle}`,
                                                borderRadius: 16,
                                                padding: '14px',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    padding: '10px 12px',
                                                    borderRadius: 12,
                                                    background: 'rgba(37, 99, 235, 0.1)',
                                                    marginBottom: 12,
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <span style={{ fontSize: 12.5, color: textPrimary }}>
                                                    Quỹ phép năm còn lại: <b style={{ color: '#2563eb' }}>{summary.annual_leave_remaining_days} / {summary.annual_leave_total_days} ngày</b>
                                                </span>
                                                <Progress
                                                    type="circle"
                                                    size={34}
                                                    percent={Math.round((summary.annual_leave_remaining_days / summary.annual_leave_total_days) * 100)}
                                                />
                                            </div>

                                            {summary.leave_requests.filter(
                                                (r) => requestStatusFilter === 'ALL' || r.status === requestStatusFilter
                                            ).length === 0 ? (
                                                <Empty
                                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                    description="Chưa có đơn xin nghỉ phép nào"
                                                >
                                                    <Button type="primary" icon={<PlusOutlined />} onClick={openLeaveDrawer}>
                                                        Tạo đơn xin nghỉ phép
                                                    </Button>
                                                </Empty>
                                            ) : (
                                                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                                    {summary.leave_requests
                                                        .filter((r) => requestStatusFilter === 'ALL' || r.status === requestStatusFilter)
                                                        .map((lv) => {
                                                            const lt = LEAVE_TYPE_MAP[lv.leave_type] || {
                                                                label: lv.leave_type,
                                                                color: 'blue',
                                                            };
                                                            const st = STATUS_TAG_MAP[lv.status] || {
                                                                label: lv.status,
                                                                color: 'default',
                                                            };
                                                            return (
                                                                <div
                                                                    key={lv.id}
                                                                    style={{
                                                                        padding: '12px',
                                                                        borderRadius: 14,
                                                                        background: isDark ? 'rgba(15, 23, 42, 0.65)' : '#f8fafc',
                                                                        border: `1px solid ${borderSubtle}`,
                                                                    }}
                                                                >
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <Tag color={lt.color} style={{ margin: 0, borderRadius: 6 }}>
                                                                            {lt.label}
                                                                        </Tag>
                                                                        <Tag color={st.color} style={{ margin: 0, borderRadius: 999 }}>
                                                                            {st.label}
                                                                        </Tag>
                                                                    </div>
                                                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: textPrimary, marginTop: 8 }}>
                                                                        Từ {dayjs(lv.start_date).format('DD/MM/YYYY')} đến {dayjs(lv.end_date).format('DD/MM/YYYY')} ({lv.total_days} ngày)
                                                                    </div>
                                                                    <div style={{ fontSize: 12, color: textSecondary, marginTop: 4 }}>
                                                                        • Buổi nghỉ: {SESSION_TYPE_MAP[lv.session_type] || lv.session_type}
                                                                    </div>
                                                                    <div style={{ fontSize: 12, color: textSecondary }}>
                                                                        • Lý do: {lv.reason}
                                                                    </div>
                                                                    {lv.handover_person && (
                                                                        <div style={{ fontSize: 12, color: textSecondary }}>
                                                                            • Người nhận bàn giao: <b>{lv.handover_person}</b>
                                                                        </div>
                                                                    )}
                                                                    {lv.status === 'PENDING' && (
                                                                        <div style={{ marginTop: 8, textAlign: 'right' }}>
                                                                            <Popconfirm
                                                                                title="Thu hồi đơn xin nghỉ phép này?"
                                                                                onConfirm={async () => {
                                                                                    await mobileEssService.cancelLeaveRequest(lv.id);
                                                                                    message.success('Đã thu hồi đơn xin nghỉ phép');
                                                                                    fetchMobileData();
                                                                                }}
                                                                            >
                                                                                <Button size="small" danger type="link" icon={<DeleteOutlined />}>
                                                                                    Thu hồi đơn
                                                                                </Button>
                                                                            </Popconfirm>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                </Space>
                                            )}
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                background: bgCard,
                                                border: `1px solid ${borderSubtle}`,
                                                borderRadius: 16,
                                                padding: '14px',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    padding: '10px 12px',
                                                    borderRadius: 12,
                                                    background: 'rgba(124, 58, 237, 0.1)',
                                                    marginBottom: 12,
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <span style={{ fontSize: 12.5, color: textPrimary }}>
                                                    Tổng giờ làm thêm (OT) tháng này: <b style={{ color: '#7c3aed' }}>{summary.current_month_ot_hours} giờ</b>
                                                </span>
                                                <Tag color="purple" style={{ margin: 0, borderRadius: 999 }}>
                                                    Chuẩn BLLĐ
                                                </Tag>
                                            </div>

                                            {summary.overtime_requests.filter(
                                                (r) => requestStatusFilter === 'ALL' || r.status === requestStatusFilter
                                            ).length === 0 ? (
                                                <Empty
                                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                    description="Chưa có phiếu đăng ký làm thêm giờ (OT) nào"
                                                >
                                                    <Button
                                                        type="primary"
                                                        icon={<PlusOutlined />}
                                                        onClick={openOtDrawer}
                                                        style={{ background: '#7c3aed' }}
                                                    >
                                                        Đăng ký làm thêm giờ ngay
                                                    </Button>
                                                </Empty>
                                            ) : (
                                                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                                    {summary.overtime_requests
                                                        .filter((r) => requestStatusFilter === 'ALL' || r.status === requestStatusFilter)
                                                        .map((ot) => {
                                                            const dt = OT_DAY_TYPE_MAP[ot.day_type] || {
                                                                label: ot.day_type,
                                                                badgeColor: 'purple',
                                                            };
                                                            const st = STATUS_TAG_MAP[ot.status] || {
                                                                label: ot.status,
                                                                color: 'default',
                                                            };
                                                            return (
                                                                <div
                                                                    key={ot.id}
                                                                    style={{
                                                                        padding: '12px',
                                                                        borderRadius: 14,
                                                                        background: isDark ? 'rgba(15, 23, 42, 0.65)' : '#f8fafc',
                                                                        border: `1px solid ${borderSubtle}`,
                                                                    }}
                                                                >
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <Tag color={dt.badgeColor} style={{ margin: 0, borderRadius: 6 }}>
                                                                            {dt.label}
                                                                        </Tag>
                                                                        <Tag color={st.color} style={{ margin: 0, borderRadius: 999 }}>
                                                                            {st.label}
                                                                        </Tag>
                                                                    </div>
                                                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: textPrimary, marginTop: 8 }}>
                                                                        Ngày {dayjs(ot.work_date).format('DD/MM/YYYY')} • {ot.start_time} → {ot.end_time} ({ot.total_hours} giờ)
                                                                    </div>
                                                                    <div style={{ fontSize: 12, color: textSecondary, marginTop: 4 }}>
                                                                        • Công việc: <b>{ot.task_description}</b>
                                                                    </div>
                                                                    <div style={{ fontSize: 12, color: textSecondary }}>
                                                                        • Địa điểm: {ot.work_location || 'Tại cơ quan'}
                                                                    </div>
                                                                    {ot.status === 'PENDING' && (
                                                                        <div style={{ marginTop: 8, textAlign: 'right' }}>
                                                                            <Popconfirm
                                                                                title="Thu hồi phiếu đăng ký OT này?"
                                                                                onConfirm={async () => {
                                                                                    await mobileEssService.cancelOvertimeRequest(ot.id);
                                                                                    message.success('Đã thu hồi phiếu đăng ký OT');
                                                                                    fetchMobileData();
                                                                                }}
                                                                            >
                                                                                <Button size="small" danger type="link" icon={<DeleteOutlined />}>
                                                                                    Thu hồi phiếu
                                                                                </Button>
                                                                            </Popconfirm>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                </Space>
                                            )}
                                        </div>
                                    )}
                                </Space>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 4: HỒ SƠ CÁ NHÂN CHUẨN BNV (TT06/2023 & HS01-VC/BNV)  */}
                            {/* ========================================================= */}
                            {activeTab === 'profile' && summary && (
                                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                                    {/* Hộp Tải File Word & In Biểu mẫu 1:1 ngay trên Mobile */}
                                    <div
                                        style={{
                                            background: bgCard,
                                            border: `1px solid ${borderSubtle}`,
                                            borderRadius: 16,
                                            padding: '14px',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <IdcardOutlined style={{ color: '#2563eb', fontSize: 18 }} />
                                            <Text strong style={{ fontSize: 14, color: textPrimary }}>
                                                Xuất Biểu mẫu Lý lịch Chuẩn Bộ Nội vụ (1:1)
                                            </Text>
                                        </div>
                                        <div style={{ fontSize: 12, color: textSecondary, marginBottom: 12 }}>
                                            Tải về điện thoại hoặc in trực tiếp 2 mẫu hồ sơ gốc từ dữ liệu cá nhân của bạn:
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            <Button
                                                type="primary"
                                                icon={<FileWordOutlined />}
                                                loading={loadingProfileDoc}
                                                onClick={() => handleDownloadWord('tt06')}
                                                style={{ borderRadius: 10, fontSize: 12, height: 38 }}
                                            >
                                                Tải Word TT06/2023
                                            </Button>
                                            <Button
                                                type="primary"
                                                icon={<FileWordOutlined />}
                                                loading={loadingProfileDoc}
                                                onClick={() => handleDownloadWord('hs01')}
                                                style={{ borderRadius: 10, fontSize: 12, height: 38, background: '#059669' }}
                                            >
                                                Tải Word HS01-VC
                                            </Button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                            <Button
                                                icon={<PrinterOutlined />}
                                                loading={loadingProfileDoc}
                                                onClick={() => handlePrintTemplate('tt06')}
                                                style={{ borderRadius: 10, fontSize: 12 }}
                                            >
                                                In Mẫu TT06/2023
                                            </Button>
                                            <Button
                                                icon={<PrinterOutlined />}
                                                loading={loadingProfileDoc}
                                                onClick={() => handlePrintTemplate('hs01')}
                                                style={{ borderRadius: 10, fontSize: 12 }}
                                            >
                                                In Mẫu HS01-VC
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Accordion Hồ sơ Cá nhân Rút gọn trên Mobile */}
                                    <Collapse
                                        defaultActiveKey={['1', '2', '3']}
                                        style={{
                                            background: bgCard,
                                            borderRadius: 16,
                                            border: `1px solid ${borderSubtle}`,
                                            overflow: 'hidden',
                                        }}
                                        items={[
                                            {
                                                key: '1',
                                                label: (
                                                    <Text strong style={{ fontSize: 13.5 }}>
                                                        1. Định danh, CCCD, BHXH & Liên hệ cá nhân
                                                    </Text>
                                                ),
                                                children: (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12.5 }}>
                                                        <div>
                                                            <div style={{ color: textSecondary, fontSize: 11 }}>Họ và tên khai sinh</div>
                                                            <div style={{ fontWeight: 700, color: textPrimary }}>{summary.birth_full_name}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: textSecondary, fontSize: 11 }}>Ngày sinh & Giới tính</div>
                                                            <div style={{ fontWeight: 600, color: textPrimary }}>
                                                                {summary.date_of_birth ? dayjs(summary.date_of_birth).format('DD/MM/YYYY') : '—'} ({summary.gender || '—'})
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: textSecondary, fontSize: 11 }}>Số CCCD / Định danh</div>
                                                            <div style={{ fontWeight: 600, color: textPrimary }}>{summary.cccd_number || 'Chưa cập nhật'}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: textSecondary, fontSize: 11 }}>Mã số BHXH / BHYT</div>
                                                            <div style={{ fontWeight: 600, color: textPrimary }}>
                                                                {summary.social_insurance_code || '—'} {summary.health_insurance_card_no ? `/ ${summary.health_insurance_card_no}` : ''}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: textSecondary, fontSize: 11 }}>Điện thoại di động</div>
                                                            <div style={{ fontWeight: 600, color: textPrimary }}>{summary.personal_phone || '—'}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: textSecondary, fontSize: 11 }}>Email cá nhân / công vụ</div>
                                                            <div style={{ fontWeight: 600, color: textPrimary }}>{summary.email || '—'}</div>
                                                        </div>
                                                    </div>
                                                ),
                                            },
                                            {
                                                key: '2',
                                                label: (
                                                    <Text strong style={{ fontSize: 13.5 }}>
                                                        2. Ngạch/Hạng Viên chức, Đảng viên & Tiền lương
                                                    </Text>
                                                ),
                                                children: (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12.5 }}>
                                                        <div>
                                                            <div style={{ color: textSecondary, fontSize: 11 }}>Đơn vị công tác</div>
                                                            <div style={{ fontWeight: 700, color: textPrimary }}>{summary.department_name || '—'}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: textSecondary, fontSize: 11 }}>Chức danh nghề nghiệp</div>
                                                            <div style={{ fontWeight: 700, color: '#2563eb' }}>
                                                                {summary.professional_title_name} ({summary.professional_title_code})
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: textSecondary, fontSize: 11 }}>Bậc lương & Hệ số</div>
                                                            <div style={{ fontWeight: 700, color: '#059669' }}>
                                                                Bậc {summary.salary_step || 1} — Hệ số {summary.salary_coefficient || 2.34}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: textSecondary, fontSize: 11 }}>Lương ước tính theo HS</div>
                                                            <div style={{ fontWeight: 700, color: textPrimary }}>
                                                                {summary.estimated_monthly_salary.toLocaleString('vi-VN')} đ/tháng
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: textSecondary, fontSize: 11 }}>Đảng viên ĐCSVN</div>
                                                            <div style={{ fontWeight: 600, color: textPrimary }}>
                                                                {summary.is_cpv_member
                                                                    ? `Đảng viên${summary.cpv_official_date ? ` (CT: ${dayjs(summary.cpv_official_date).format('DD/MM/YYYY')})` : ''}`
                                                                    : 'Quần chúng'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: textSecondary, fontSize: 11 }}>Trình độ chuyên môn</div>
                                                            <div style={{ fontWeight: 600, color: textPrimary }}>
                                                                {summary.highest_professional_degree || fullProfile?.highest_professional_degree || 'Đại học'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ),
                                            },
                                            {
                                                key: '3',
                                                label: (
                                                    <Text strong style={{ fontSize: 13.5 }}>
                                                        3. Quá trình Công tác & Đào tạo ({fullProfile ? (fullProfile.work_experiences.length + fullProfile.training_records.length) : '...'})
                                                    </Text>
                                                ),
                                                children: fullProfile ? (
                                                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                                        {fullProfile.work_experiences.map((w, idx) => (
                                                            <div
                                                                key={idx}
                                                                style={{
                                                                    padding: '8px 10px',
                                                                    borderRadius: 10,
                                                                    background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                                                                    borderLeft: '3px solid #2563eb',
                                                                    fontSize: 12,
                                                                }}
                                                            >
                                                                <div style={{ fontWeight: 700, color: '#2563eb' }}>
                                                                    {w.from_month_year || '—'} → {w.to_month_year || 'Nay'}
                                                                </div>
                                                                <div style={{ color: textPrimary, marginTop: 2 }}>
                                                                    {[w.position_name, w.department_name, w.organization_name].filter(Boolean).join(' - ')}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {fullProfile.training_records.map((t, idx) => (
                                                            <div
                                                                key={`tr-${idx}`}
                                                                style={{
                                                                    padding: '8px 10px',
                                                                    borderRadius: 10,
                                                                    background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                                                                    borderLeft: '3px solid #059669',
                                                                    fontSize: 12,
                                                                }}
                                                            >
                                                                <div style={{ fontWeight: 700, color: '#059669' }}>
                                                                    🎓 {t.school_name} ({t.from_period || '—'} - {t.to_period || '—'})
                                                                </div>
                                                                <div style={{ color: textPrimary, marginTop: 2 }}>
                                                                    Chuyên ngành: {t.major || '—'} • Bằng cấp: {t.degree_certificate || '—'}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {fullProfile.work_experiences.length === 0 && fullProfile.training_records.length === 0 && (
                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                Chưa có dữ liệu quá trình công tác / đào tạo.
                                                            </Text>
                                                        )}
                                                    </Space>
                                                ) : (
                                                    <Spin size="small" />
                                                ),
                                            },
                                            {
                                                key: '4',
                                                label: (
                                                    <Text strong style={{ fontSize: 13.5 }}>
                                                        4. Hợp đồng làm việc cá nhân ({summary.contracts.length})
                                                    </Text>
                                                ),
                                                children:
                                                    summary.contracts.length === 0 ? (
                                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                                            Chưa có bản ghi hợp đồng làm việc.
                                                        </Text>
                                                    ) : (
                                                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                                            {summary.contracts.map((c) => (
                                                                <div
                                                                    key={c.id}
                                                                    style={{
                                                                        padding: '8px 10px',
                                                                        borderRadius: 10,
                                                                        background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                                                                        border: `1px solid ${borderSubtle}`,
                                                                        fontSize: 12,
                                                                    }}
                                                                >
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <Text strong>Số HĐ: {c.contract_number}</Text>
                                                                        <Tag color={c.status === 'active' ? 'green' : 'default'} style={{ margin: 0 }}>
                                                                            {c.status === 'active' ? 'Đang hiệu lực' : c.status}
                                                                        </Tag>
                                                                    </div>
                                                                    <div style={{ color: textSecondary, marginTop: 2 }}>
                                                                        {CONTRACT_TYPE_LABEL[c.contract_type] || c.contract_type} • Hiệu lực từ {dayjs(c.start_date).format('DD/MM/YYYY')}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </Space>
                                                    ),
                                            },
                                        ]}
                                    />
                                </Space>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 5: TÀI KHOẢN & TIỆN ÍCH CÁ NHÂN                        */}
                            {/* ========================================================= */}
                            {activeTab === 'account' && summary && (
                                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                                    <div
                                        style={{
                                            background: bgCard,
                                            border: `1px solid ${borderSubtle}`,
                                            borderRadius: 16,
                                            padding: '16px',
                                            textAlign: 'center',
                                        }}
                                    >
                                        <Avatar
                                            size={68}
                                            src={summary.portrait_url || undefined}
                                            icon={<UserOutlined />}
                                            style={{ background: '#2563eb', marginBottom: 10 }}
                                        />
                                        <div style={{ fontSize: 17, fontWeight: 800, color: textPrimary }}>
                                            {summary.birth_full_name || summary.full_name}
                                        </div>
                                        <div style={{ fontSize: 12.5, color: textSecondary, marginTop: 2 }}>
                                            Tài khoản: <b>{summary.username}</b> • {summary.department_name}
                                        </div>
                                        <div style={{ marginTop: 10 }}>
                                            <Tag color="blue" style={{ borderRadius: 999 }}>
                                                Phân quyền: Cổng Chuyên viên Cá nhân (Self-Service)
                                            </Tag>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            background: bgCard,
                                            border: `1px solid ${borderSubtle}`,
                                            borderRadius: 16,
                                            padding: '14px',
                                        }}
                                    >
                                        <Text strong style={{ fontSize: 13.5, color: textPrimary, display: 'block', marginBottom: 12 }}>
                                            Cài đặt Hiển thị & Trải nghiệm Mobile
                                        </Text>

                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '10px 0',
                                                borderBottom: `1px solid ${borderSubtle}`,
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>Giao diện Tối (Dark Mode)</div>
                                                <div style={{ fontSize: 11.5, color: textSecondary }}>Bảo vệ mắt khi tra cứu ban đêm</div>
                                            </div>
                                            <Switch checked={isDark} onChange={toggleTheme} />
                                        </div>

                                        <div style={{ paddingTop: 12 }}>
                                            <Button
                                                block
                                                danger
                                                icon={<LogoutOutlined />}
                                                onClick={async () => {
                                                    await logout();
                                                    navigate(ROUTES.LOGIN);
                                                }}
                                                style={{ borderRadius: 12, height: 40, fontWeight: 600 }}
                                            >
                                                Đăng xuất khỏi phiên làm việc
                                            </Button>
                                        </div>
                                    </div>
                                </Space>
                            )}
                        </>
                    )}
                </div>

                {/* ========================================================= */}
                {/* BOTTOM NAVIGATION BAR (5 TABS CHUẨN MOBILE ERGONOMICS)    */}
                {/* ========================================================= */}
                <div
                    style={{
                        position: 'sticky',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 68,
                        background: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.96)',
                        backdropFilter: 'blur(12px)',
                        borderTop: `1px solid ${borderSubtle}`,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        alignItems: 'center',
                        padding: '0 6px',
                        zIndex: 20,
                    }}
                >
                    {[
                        { key: 'home', label: 'Trang chủ', icon: <HomeOutlined style={{ fontSize: 20 }} /> },
                        { key: 'schedule', label: 'Lịch của tôi', icon: <CalendarOutlined style={{ fontSize: 20 }} /> },
                        {
                            key: 'center-cta',
                            label: 'Tạo đơn',
                            icon: <PlusCircleOutlined style={{ fontSize: 24, color: '#fff' }} />,
                            isCenter: true,
                        },
                        { key: 'profile', label: 'Hồ sơ BNV', icon: <IdcardOutlined style={{ fontSize: 20 }} /> },
                        { key: 'account', label: 'Cá nhân', icon: <UserOutlined style={{ fontSize: 20 }} /> },
                    ].map((tab) => {
                        if (tab.isCenter) {
                            return (
                                <div
                                    key="center-cta"
                                    onClick={() => setActionPickerOpen(true)}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 6px 16px rgba(37, 99, 235, 0.45)',
                                            marginTop: -14,
                                        }}
                                    >
                                        {tab.icon}
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 10.5,
                                            fontWeight: 600,
                                            color: activeTab === 'requests' ? '#2563eb' : textSecondary,
                                            marginTop: 2,
                                        }}
                                    >
                                        Đơn từ / OT
                                    </span>
                                </div>
                            );
                        }

                        const isSelected = activeTab === tab.key;
                        return (
                            <div
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as MobileTabKey)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: isSelected ? '#2563eb' : textSecondary,
                                    padding: '6px 0',
                                }}
                            >
                                {tab.icon}
                                <span
                                    style={{
                                        fontSize: 10.5,
                                        fontWeight: isSelected ? 700 : 500,
                                        marginTop: 3,
                                    }}
                                >
                                    {tab.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ================================================================= */}
            {/* QUICK ACTION PICKER MODAL (KHI BẤM NÚT ➕ Ở GIỮA THANH BOTTOM NAV) */}
            {/* ================================================================= */}
            <Drawer
                title="Thao tác Cá nhân Nhanh (Chuyên viên)"
                placement="bottom"
                height={290}
                open={actionPickerOpen}
                onClose={() => setActionPickerOpen(false)}
                styles={{ body: { padding: '16px' } }}
            >
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Button
                        block
                        size="large"
                        type="primary"
                        icon={<CalendarOutlined />}
                        onClick={() => {
                            setActionPickerOpen(false);
                            openLeaveDrawer();
                        }}
                        style={{ height: 48, borderRadius: 12, fontWeight: 600, textAlign: 'left' }}
                    >
                        1. Tạo Đơn Xin Nghỉ Phép (Quỹ còn: {summary?.annual_leave_remaining_days ?? 12} ngày)
                    </Button>
                    <Button
                        block
                        size="large"
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        onClick={() => {
                            setActionPickerOpen(false);
                            openOtDrawer();
                        }}
                        style={{ height: 48, borderRadius: 12, fontWeight: 600, background: '#7c3aed', textAlign: 'left' }}
                    >
                        2. Đăng Ký Làm Thêm Giờ (OT Cá nhân)
                    </Button>
                    <Button
                        block
                        size="large"
                        icon={<ScheduleOutlined />}
                        onClick={() => {
                            setActionPickerOpen(false);
                            openScheduleDrawer();
                        }}
                        style={{ height: 46, borderRadius: 12, fontWeight: 600, textAlign: 'left' }}
                    >
                        3. Thêm Lịch Công Tác / Lịch Làm Việc Cá Nhân
                    </Button>
                    <Button
                        block
                        type="link"
                        onClick={() => {
                            setActionPickerOpen(false);
                            setActiveTab('requests');
                        }}
                    >
                        Xem danh sách các đơn đã gửi →
                    </Button>
                </Space>
            </Drawer>

            {/* ================================================================= */}
            {/* BOTTOM SHEET 1: TẠO ĐƠN XIN NGHỈ PHÉP CÁ NHÂN                      */}
            {/* ================================================================= */}
            <Drawer
                title="Tạo Đơn Xin Nghỉ Phép Cá Nhân"
                placement="bottom"
                height="82vh"
                open={leaveDrawerOpen}
                onClose={() => setLeaveDrawerOpen(false)}
                extra={
                    <Button type="primary" loading={submitting} onClick={handleCreateLeave} style={{ borderRadius: 999 }}>
                        Gửi đơn
                    </Button>
                }
            >
                <Form form={leaveForm} layout="vertical" style={{ maxWidth: 500, margin: '0 auto' }}>
                    <div
                        style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: 'rgba(37, 99, 235, 0.1)',
                            marginBottom: 14,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <span>
                            Quỹ phép năm còn lại: <b style={{ color: '#2563eb' }}>{summary?.annual_leave_remaining_days ?? 12} ngày</b>
                        </span>
                        <Tag color="blue" style={{ margin: 0 }}>
                            Đơn này: {previewLeaveDays} ngày
                        </Tag>
                    </div>

                    <Form.Item
                        name="leave_type"
                        label="Loại hình nghỉ phép"
                        rules={[{ required: true, message: 'Vui lòng chọn loại phép' }]}
                    >
                        <Select
                            options={Object.entries(LEAVE_TYPE_MAP).map(([k, v]) => ({
                                value: k,
                                label: v.label,
                            }))}
                        />
                    </Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item
                            name="start_date"
                            label="Từ ngày"
                            rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]}
                        >
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item
                            name="end_date"
                            label="Đến hết ngày"
                            rules={[{ required: true, message: 'Chọn ngày kết thúc' }]}
                        >
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                        </Form.Item>
                    </div>

                    <Form.Item name="session_type" label="Khung thời gian nghỉ">
                        <Segmented
                            block
                            options={[
                                { label: 'Cả ngày (1.0)', value: 'FULL_DAY' },
                                { label: 'Buổi sáng (0.5)', value: 'MORNING' },
                                { label: 'Buổi chiều (0.5)', value: 'AFTERNOON' },
                            ]}
                        />
                    </Form.Item>

                    <Form.Item
                        name="reason"
                        label="Lý do xin nghỉ phép"
                        rules={[{ required: true, message: 'Vui lòng nhập lý do xin nghỉ phép' }]}
                    >
                        <TextArea rows={3} placeholder="Nhập lý do cụ thể (VD: Giải quyết việc gia đình / Khám sức khỏe định kỳ...)" />
                    </Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="handover_person" label="Chuyên viên nhận bàn giao việc">
                            <Input placeholder="VD: Đ/c Trần Trọng Quý" />
                        </Form.Item>
                        <Form.Item name="contact_phone" label="SĐT liên hệ khẩn cấp">
                            <Input placeholder="Số điện thoại của bạn" />
                        </Form.Item>
                    </div>

                    <Button
                        block
                        type="primary"
                        size="large"
                        loading={submitting}
                        onClick={handleCreateLeave}
                        style={{ borderRadius: 12, height: 46, fontWeight: 700, marginTop: 8 }}
                    >
                        Xác nhận Gửi Đơn Xin Nghỉ Phép ({previewLeaveDays} ngày)
                    </Button>
                </Form>
            </Drawer>

            {/* ================================================================= */}
            {/* BOTTOM SHEET 2: ĐĂNG KÝ LÀM THÊM GIỜ (OT CÁ NHÂN)                  */}
            {/* ================================================================= */}
            <Drawer
                title="Đăng Ký Làm Thêm Giờ (OT Cá Nhân)"
                placement="bottom"
                height="82vh"
                open={otDrawerOpen}
                onClose={() => setOtDrawerOpen(false)}
                extra={
                    <Button
                        type="primary"
                        loading={submitting}
                        onClick={handleCreateOvertime}
                        style={{ borderRadius: 999, background: '#7c3aed' }}
                    >
                        Gửi phiếu OT
                    </Button>
                }
            >
                <Form form={otForm} layout="vertical" style={{ maxWidth: 500, margin: '0 auto' }}>
                    <div
                        style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: 'rgba(124, 58, 237, 0.12)',
                            marginBottom: 14,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <span>
                            Thời lượng ca OT đăng ký: <b style={{ color: '#7c3aed' }}>{previewOtHours} giờ</b>
                        </span>
                        <Tag color="purple" style={{ margin: 0 }}>
                            Tháng này: {summary?.current_month_ot_hours ?? 0}h
                        </Tag>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item
                            name="work_date"
                            label="Ngày làm thêm giờ"
                            rules={[{ required: true, message: 'Chọn ngày làm thêm' }]}
                        >
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="day_type" label="Loại ngày & Hệ số hưởng">
                            <Select
                                options={Object.entries(OT_DAY_TYPE_MAP).map(([k, v]) => ({
                                    value: k,
                                    label: v.label,
                                }))}
                            />
                        </Form.Item>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item
                            name="start_time"
                            label="Giờ bắt đầu (HH:mm)"
                            rules={[{ required: true, message: 'Nhập giờ bắt đầu' }]}
                        >
                            <Select
                                options={[
                                    '07:30',
                                    '08:00',
                                    '12:00',
                                    '17:00',
                                    '17:30',
                                    '18:00',
                                    '18:30',
                                    '19:00',
                                ].map((t) => ({ value: t, label: t }))}
                            />
                        </Form.Item>
                        <Form.Item
                            name="end_time"
                            label="Giờ kết thúc (HH:mm)"
                            rules={[{ required: true, message: 'Nhập giờ kết thúc' }]}
                        >
                            <Select
                                options={[
                                    '11:30',
                                    '17:00',
                                    '19:30',
                                    '20:00',
                                    '20:30',
                                    '21:00',
                                    '21:30',
                                    '22:00',
                                ].map((t) => ({ value: t, label: t }))}
                            />
                        </Form.Item>
                    </div>

                    <Form.Item name="work_location" label="Địa điểm thực hiện">
                        <Input placeholder="VD: Tại cơ quan (Văn phòng) / Làm việc từ xa" />
                    </Form.Item>

                    <Form.Item
                        name="task_description"
                        label="Nội dung công việc giải quyết ngoài giờ"
                        rules={[{ required: true, message: 'Vui lòng mô tả công việc thực hiện khi OT' }]}
                    >
                        <TextArea
                            rows={3}
                            placeholder="VD: Hoàn thiện báo cáo tổng hợp hồ sơ viên chức quý IV trình Lãnh đạo Sở..."
                        />
                    </Form.Item>

                    <Button
                        block
                        type="primary"
                        size="large"
                        loading={submitting}
                        onClick={handleCreateOvertime}
                        style={{
                            borderRadius: 12,
                            height: 46,
                            fontWeight: 700,
                            background: '#7c3aed',
                            marginTop: 8,
                        }}
                    >
                        Xác nhận Đăng Ký Làm Thêm Giờ ({previewOtHours} giờ)
                    </Button>
                </Form>
            </Drawer>

            {/* ================================================================= */}
            {/* BOTTOM SHEET 3: THÊM LỊCH CÔNG TÁC / LỊCH LÀM VIỆC CÁ NHÂN        */}
            {/* ================================================================= */}
            <Drawer
                title="Thêm Lịch Công Tác / Lịch Làm Việc Cá Nhân"
                placement="bottom"
                height="78vh"
                open={scheduleDrawerOpen}
                onClose={() => setScheduleDrawerOpen(false)}
                extra={
                    <Button type="primary" loading={submitting} onClick={handleCreateSchedule} style={{ borderRadius: 999 }}>
                        Lưu lịch
                    </Button>
                }
            >
                <Form form={scheduleForm} layout="vertical" style={{ maxWidth: 500, margin: '0 auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item
                            name="schedule_date"
                            label="Ngày thực hiện"
                            rules={[{ required: true, message: 'Chọn ngày' }]}
                        >
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="schedule_type" label="Phân loại lịch">
                            <Select
                                options={Object.entries(SCHEDULE_TYPE_MAP).map(([k, v]) => ({
                                    value: k,
                                    label: v.label,
                                }))}
                            />
                        </Form.Item>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="start_time" label="Từ giờ">
                            <Input placeholder="08:00" />
                        </Form.Item>
                        <Form.Item name="end_time" label="Đến giờ">
                            <Input placeholder="11:30" />
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="title"
                        label="Tiêu đề công việc / Nội dung lịch"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề lịch công tác' }]}
                    >
                        <Input placeholder="VD: Họp rà soát hồ sơ viên chức / Đi công tác cơ sở..." />
                    </Form.Item>

                    <Form.Item name="location" label="Địa điểm / Phòng họp">
                        <Input placeholder="VD: Phòng họp số 1 - Văn phòng Sở" />
                    </Form.Item>

                    <Form.Item name="notes" label="Ghi chú chuẩn bị tài liệu">
                        <TextArea rows={2} placeholder="Ghi chú tài liệu cần mang theo..." />
                    </Form.Item>

                    <Button
                        block
                        type="primary"
                        size="large"
                        loading={submitting}
                        onClick={handleCreateSchedule}
                        style={{ borderRadius: 12, height: 46, fontWeight: 700, marginTop: 8 }}
                    >
                        Lưu Lịch Cá Nhân
                    </Button>
                </Form>
            </Drawer>
        </div>
    );
};
