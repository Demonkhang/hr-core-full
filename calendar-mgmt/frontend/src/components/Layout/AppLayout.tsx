import { ReactNode, useState, useMemo, useEffect } from 'react';
import { Layout, Menu, Typography, Dropdown, Space, Button } from 'antd';

import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ScheduleOutlined,
  DashboardOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  LogoutOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TableOutlined,
  TagsOutlined,
  SafetyOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ROUTES, COLORS, BORDER_RADIUS } from '@/utils/constants';
import { ProfileModal } from '@/components/Common/ProfileModal';
import { NotificationBell } from '@/components/Common/NotificationBell';

const { Sider, Content } = Layout;

const popupClass = 'menu-popup-solid';
const iconStyle = (color: string) => ({ color, fontSize: 16 });

function buildMenuItems(user: any) {
  const isAdmin = Boolean(user?.is_super_admin);
  const perms = (user?.permissions ?? {}) as Record<string, any>;

  // 1. Nhóm Trực ca
  const canReadDuty = isAdmin || Boolean(perms.can_read_schedule);
  let dutyGroup: any = null;
  if (canReadDuty) {
    const dutyChildren: any[] = [
      { key: ROUTES.SCHEDULES, icon: <ScheduleOutlined style={iconStyle('#a78bfa')} />, label: 'Lịch trực' },
      { key: ROUTES.SCHEDULES_BY_EMPLOYEE, icon: <UserOutlined style={iconStyle('#ec4899')} />, label: 'Xem theo người' },
    ];
    if (isAdmin || perms.can_approve_schedule) {
      dutyChildren.push({ key: ROUTES.SCHEDULES_APPROVAL, icon: <CheckCircleOutlined style={iconStyle('#34d399')} />, label: 'Phê duyệt' });
    }
    dutyChildren.push({ key: ROUTES.REPORTS_DEPT_SCHEDULE, icon: <TableOutlined style={iconStyle('#60a5fa')} />, label: 'Thống kê' });
    dutyGroup = {
      key: 'duty',
      icon: <ScheduleOutlined style={iconStyle('#8b5cf6')} />,
      label: 'Trực ca',
      popupClassName: popupClass,
      children: dutyChildren,
    };
  }

  // 2. Nhóm Lịch họp
  const canMeetings = isAdmin || Boolean(perms.can_manage_meetings) || Boolean(perms.can_approve_meetings);
  const meetingsGroup = canMeetings
    ? {
        key: 'meetings',
        icon: <CalendarOutlined style={iconStyle('#0ea5e9')} />,
        label: 'Lịch họp',
        popupClassName: popupClass,
        children: [
          { key: ROUTES.MEETING_SCHEDULES, icon: <CalendarOutlined style={iconStyle('#38bdf8')} />, label: 'Lịch họp / Đột xuất' },
          { key: ROUTES.MEETING_SCHEDULES_HISTORY, icon: <TableOutlined style={iconStyle('#94a3b8')} />, label: 'Lịch sử' },
        ],
      }
    : null;

  // 3. Nhóm Thêm giờ
  const canOvertime = isAdmin || Boolean(perms.can_manage_overtime) || Boolean(perms.can_approve_overtime);
  const overtimeGroup = canOvertime
    ? {
        key: 'overtime',
        icon: <ClockCircleOutlined style={iconStyle('#f97316')} />,
        label: 'Thêm giờ',
        popupClassName: popupClass,
        children: [
          { key: ROUTES.OVERTIME_REGISTRATIONS, icon: <ClockCircleOutlined style={iconStyle('#fb923c')} />, label: 'Đăng ký thêm giờ' },
          { key: ROUTES.OVERTIME_REGISTRATIONS_HISTORY, icon: <TableOutlined style={iconStyle('#94a3b8')} />, label: 'Lịch sử' },
        ],
      }
    : null;

  // 4. Nhóm Nghỉ phép
  const canLeave = isAdmin || Boolean(perms.can_manage_leave) || Boolean(perms.can_approve_leave);
  const leaveGroup = canLeave
    ? {
        key: 'leave',
        icon: <CalendarOutlined style={iconStyle('#10b981')} />,
        label: 'Nghỉ phép',
        popupClassName: popupClass,
        children: [
          { key: ROUTES.LEAVE_REGISTRATIONS, icon: <CalendarOutlined style={iconStyle('#34d399')} />, label: 'Đăng ký phép' },
          { key: ROUTES.LEAVE_REGISTRATIONS_HISTORY, icon: <TableOutlined style={iconStyle('#94a3b8')} />, label: 'Lịch sử' },
        ],
      }
    : null;

  // Gom các nhóm con của Lịch công tác
  const scheduleChildren = [dutyGroup, meetingsGroup, overtimeGroup, leaveGroup].filter(Boolean);
  const scheduleSection = scheduleChildren.length > 0
    ? [{
        key: 'schedules',
        icon: <ScheduleOutlined style={iconStyle('#6366f1')} />,
        label: 'Lịch công tác',
        popupClassName: popupClass,
        children: scheduleChildren,
      }]
    : [];

  // 5. Nhóm Báo cáo
  const reportsSection = (isAdmin || perms.can_view_reports)
    ? [{
        key: 'reports',
        icon: <BarChartOutlined style={iconStyle('#ec4899')} />,
        label: 'Báo cáo',
        popupClassName: popupClass,
        children: [
          { key: ROUTES.REPORTS, icon: <BarChartOutlined style={iconStyle('#f472b6')} />, label: 'Tổng hợp giờ' },
        ],
      }]
    : [];

  // 6. Nhóm Hệ thống
  const systemChildren = [];
  if (isAdmin || perms.can_manage_settings) {
    systemChildren.push({ key: ROUTES.SHIFT_TEMPLATES, icon: <TagsOutlined style={iconStyle('#8b5cf6')} />, label: 'Ca trực mẫu' });
  }
  if (isAdmin) {
    systemChildren.push({ key: ROUTES.PERMISSIONS, icon: <SafetyOutlined style={iconStyle('#f43f5e')} />, label: 'Phân quyền' });
  }

  const systemSection = systemChildren.length > 0
    ? [{
        key: 'system',
        icon: <SettingOutlined style={iconStyle('#64748b')} />,
        label: 'Hệ thống',
        popupClassName: popupClass,
        children: systemChildren,
      }]
    : [];

  return [
    { key: ROUTES.HOME, icon: <DashboardOutlined style={iconStyle('#f59e0b')} />, label: 'Tổng quan' },
    ...scheduleSection,
    ...reportsSection,
    ...systemSection,
  ];
}

const pageTitles: Record<string, string> = {
  [ROUTES.HOME]: 'Tổng quan',
  [ROUTES.SCHEDULES]: 'Lịch trực',
  [ROUTES.SCHEDULES_BY_EMPLOYEE]: 'Lịch trực theo nhân viên',
  [ROUTES.SCHEDULES_APPROVAL]: 'Phê duyệt lịch trực',
  [ROUTES.SHIFT_TEMPLATES]: 'Quản lý ca trực mẫu',
  [ROUTES.OVERTIME_REGISTRATIONS]: 'Đăng ký thêm giờ',
  [ROUTES.OVERTIME_REGISTRATIONS_HISTORY]: 'Lịch sử thêm giờ',
  [ROUTES.LEAVE_REGISTRATIONS]: 'Đăng ký nghỉ phép',
  [ROUTES.LEAVE_REGISTRATIONS_HISTORY]: 'Lịch sử nghỉ phép',
  [ROUTES.MEETING_SCHEDULES]: 'Lịch họp / Đột xuất',
  [ROUTES.MEETING_SCHEDULES_HISTORY]: 'Lịch sử lịch họp',
  [ROUTES.REPORTS]: 'Báo cáo tổng hợp giờ',
  [ROUTES.REPORTS_DEPT_SCHEDULE]: 'Lịch công tác',
  [ROUTES.PERMISSIONS]: 'Phân quyền',
};

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const path = location.pathname;
    const keys: string[] = [];
    if (
      path.startsWith(ROUTES.SCHEDULES) ||
      path.startsWith(ROUTES.OVERTIME_REGISTRATIONS) ||
      path.startsWith(ROUTES.LEAVE_REGISTRATIONS) ||
      path.startsWith(ROUTES.MEETING_SCHEDULES) ||
      path.startsWith(ROUTES.REPORTS)
    ) {
      keys.push('schedules');
    }
    if (path.startsWith(ROUTES.SCHEDULES)) {
      keys.push('duty');
    }
    if (path.startsWith(ROUTES.OVERTIME_REGISTRATIONS)) {
      keys.push('overtime');
    }
    if (path.startsWith(ROUTES.LEAVE_REGISTRATIONS)) {
      keys.push('leave');
    }
    if (path.startsWith(ROUTES.MEETING_SCHEDULES)) {
      keys.push('meetings');
    }
    if (path.startsWith(ROUTES.REPORTS)) {
      keys.push('schedules');
      if (path.startsWith(ROUTES.REPORTS_DEPT_SCHEDULE)) {
        keys.push('duty');
      } else {
        keys.push('reports');
      }
    }
    if (path.startsWith(ROUTES.SHIFT_TEMPLATES) || path.startsWith(ROUTES.PERMISSIONS)) {
      keys.push('system');
    }
    return keys;
  });
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const menuItems = useMemo(() => buildMenuItems(user), [user]);

  useEffect(() => {
    useAuthStore.getState().refreshPermissions().catch(() => {});
    const onFocus = () => {
      useAuthStore.getState().refreshPermissions().catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: 'Thông tin cá nhân' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
  ];

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'profile') setProfileOpen(true);
    if (key === 'logout') handleLogout();
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <style>{`
        body { margin: 0; padding: 0; background: ${COLORS.LAYOUT_BG}; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .ant-table-wrapper .ant-table { border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(99,102,241,0.08); }
        .ant-card {
          border-radius: 16px !important;
          border: none !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04) !important;
          transition: all 0.25s ease !important;
          position: relative;
          overflow: hidden;
        }
        .ant-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa);
          border-radius: 16px 16px 0 0;
        }
        .ant-card:hover { box-shadow: 0 8px 32px rgba(99,102,241,0.12) !important; transform: translateY(-2px); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .ant-layout-content > * { animation: fadeIn 0.3s ease-out; }
        .menu-popup-solid, .menu-popup-solid .ant-menu { background: #1e1b4b; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        .menu-popup-solid .ant-menu-item { color: #cbd5e1; }
        .menu-popup-solid .ant-menu-item:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
        .menu-popup-solid .ant-menu-item-selected { background: rgba(255,255,255,0.12) !important; color: #fff !important; }
        .ant-tag { border: none !important; border-radius: 6px !important; padding: 2px 10px !important; font-weight: 500 !important; }
        .ant-btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6) !important; box-shadow: 0 4px 14px rgba(99,102,241,0.3) !important; border: none !important; }
        .ant-btn-primary:hover { background: linear-gradient(135deg, #4f46e5, #7c3aed) !important; box-shadow: 0 6px 20px rgba(99,102,241,0.4) !important; transform: translateY(-1px); }
        .ant-btn-default:hover { border-color: #6366f1 !important; color: #6366f1 !important; }
        .ant-select-selector { border-radius: 10px !important; border-color: #e0e6ef !important; }
        .ant-select-focused .ant-select-selector { border-color: #6366f1 !important; box-shadow: 0 0 0 2px rgba(99,102,241,0.1) !important; }
        .ant-picker { border-radius: 10px !important; border-color: #e0e6ef !important; }
        .ant-picker-focused { border-color: #6366f1 !important; box-shadow: 0 0 0 2px rgba(99,102,241,0.1) !important; }
        .ant-input { border-radius: 10px !important; border-color: #e0e6ef !important; }
        .ant-input:hover, .ant-input:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 2px rgba(99,102,241,0.1) !important; }
        .ant-table-thead > tr > th { background: #f0f4ff !important; color: #4f46e5 !important; font-weight: 600 !important; font-size: 12px !important; text-transform: uppercase !important; letter-spacing: 0.3px !important; border-right: 1px solid #d6ddf0 !important; }
        .ant-table-tbody > tr:hover > td { background: rgba(99,102,241,0.03) !important; }
        .ant-table-tbody > tr.ant-table-row-selected > td { background: rgba(99,102,241,0.06) !important; }
        .ant-menu-dark .ant-menu-sub.ant-menu-inline { background: rgba(0,0,0,0.15) !important; }
        .ant-switch-checked { background: #6366f1 !important; }
        .ant-modal-content {
          border-radius: 12px !important;
        }
        .ant-modal-header {
          border-radius: 12px 12px 0 0 !important;
        }

        @media print {
          .ant-layout-sider {
            display: none !important;
          }
          .ant-layout, .ant-layout-content {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            flex: none !important;
            flex-direction: unset !important;
          }
        }
      `}</style>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={250}
        collapsedWidth={64}
        theme="dark"
        style={{
          background: COLORS.SIDEBAR_BG_GRADIENT,
          borderRight: 'none',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 20,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              transition: 'background 0.15s',
              userSelect: 'none',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.TRANSPARENT; }}
          >
            <div style={{
              width: 34,
              height: 34,
              borderRadius: BORDER_RADIUS.AVATAR,
              background: COLORS.SIDEBAR_LOGO_BG,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 3px 12px ${COLORS.SIDEBAR_LOGO_SHADOW}`,
            }}>
              <CalendarOutlined style={{ fontSize: 17, color: COLORS.WHITE }} />
            </div>
            {!collapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <Typography.Text strong style={{ fontSize: 17, color: '#f1f5f9', letterSpacing: '0.3px' }}>
                  {import.meta.env.VITE_APP_TITLE || 'Quản lý lịch'}
                </Typography.Text>
                <Typography.Text style={{ fontSize: 10, color: '#94a3b8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {import.meta.env.VITE_ORG_NAME || ''}
                </Typography.Text>
              </div>
            )}
          </div>

          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            <div style={{ height: '100%', overflow: 'auto', padding: '8px 0' }}>
              <Menu
                mode="inline"
                selectedKeys={[location.pathname]}
                openKeys={openKeys}
                onOpenChange={setOpenKeys}
                items={menuItems}
                onClick={({ key }: { key: string }) => navigate(key)}
                style={{
                  borderInlineEnd: 'none',
                  background: COLORS.TRANSPARENT,
                }}
                theme="dark"
              />
            </div>
          </div>
        </div>
      </Sider>
      <Layout>
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          gap: 8,
          background: COLORS.TOPBAR_BG,
          backdropFilter: `blur(${COLORS.TOPBAR_BLUR})`,
          WebkitBackdropFilter: `blur(${COLORS.TOPBAR_BLUR})`,
          borderBottom: `1px solid ${COLORS.TOPBAR_BORDER}`,
          boxShadow: COLORS.TOPBAR_SHADOW,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: 20,
                color: '#6366f1',
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: 10,
                transition: 'all 0.15s',
                lineHeight: 1,
                background: 'rgba(99,102,241,0.06)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; }}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
            <Typography.Title level={5} style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b', letterSpacing: '0.2px' }}>
              {pageTitles[location.pathname] || ''}
            </Typography.Title>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dropdown
              menu={{
                items: [
                  { key: 'calendar', label: '📅 Quản lý Lịch (Calendar)', disabled: true },
                  { key: 'hr', label: '🏛️ Quản lý Nhân sự (HR Core)' },
                ],
                onClick: ({ key }: any) => {

                  if (key === 'hr') {
                    const token = localStorage.getItem('access_token');
                    window.location.href = `http://localhost:5173?token=${encodeURIComponent(token || '')}`;
                  }
                },
              }}
            >
              <Button type="default" size="small" style={{ borderRadius: 6, fontWeight: 500 }}>
                📅 Calendar ▾
              </Button>
            </Dropdown>

            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
            >

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 8,
                transition: 'background 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: COLORS.WHITE,
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
              }}>
                {(user?.full_name || 'U').charAt(0).toUpperCase()}
              </div>
              <Typography.Text style={{ fontSize: 13, color: '#334155', fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name || 'Người dùng'}
              </Typography.Text>
              </div>
            </Dropdown>
            <NotificationBell />
          </div>
        </div>
        <Content style={{ margin: 24, minHeight: 280 }}>
          {children}
        </Content>
      </Layout>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        currentUser={user}
      />
    </Layout>
  );
}
