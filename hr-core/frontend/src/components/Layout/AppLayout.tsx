import { ReactNode, useState, createContext, useContext, useEffect, useMemo, useCallback } from 'react';
import { Layout, Menu, Typography, Dropdown, Button, Tooltip } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  DashboardOutlined,
  LogoutOutlined,
  SettingOutlined,
  EnvironmentOutlined,
  BankOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  UserOutlined,
  DollarOutlined,
  TableOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/context/ThemeContext';
import { ROUTES, COLORS, BORDER_RADIUS } from '@/utils/constants';
import { ProfileModal } from '@/components/Common/ProfileModal';

const { Sider, Content, Header } = Layout;

const popupClass = 'menu-popup-solid';
function buildMenuItems(perms: any): any[] {
  const items: any[] = [
    { key: ROUTES.HOME, icon: <DashboardOutlined />, label: 'Tổng quan' },
  ];
  if (perms?.can_manage_settings) {
    items.push({
      key: 'organization',
      icon: <ApartmentOutlined />,
      label: 'Tổ chức',
      popupClassName: popupClass,
      children: [
        { key: ROUTES.DEPARTMENTS, icon: <BankOutlined />, label: 'Phòng ban' },
        { key: ROUTES.POSITIONS, icon: <SafetyCertificateOutlined />, label: 'Chức vụ' },
        { key: ROUTES.JOB_POSITIONS, icon: <SolutionOutlined />, label: 'Vị trí việc làm' },
        { key: ROUTES.WORKPLACES, icon: <EnvironmentOutlined />, label: 'Nơi làm việc' },
      ],
    });
  }
  if (perms?.can_manage_employees) {
    items.push({
      key: 'hr',
      icon: <TeamOutlined />,
      label: 'Nhân sự',
      popupClassName: popupClass,
      children: [
        { key: ROUTES.EMPLOYEES, icon: <TeamOutlined />, label: 'Nhân sự hiện có' },
        { key: ROUTES.EMPLOYEES_INACTIVE, icon: <TeamOutlined />, label: 'Nhân sự đã nghỉ' },
      ],
    });
  }
  if (perms?.can_manage_users) {
    items.push({
      key: 'system',
      icon: <SettingOutlined />,
      label: 'Hệ thống',
      popupClassName: popupClass,
      children: [
        { key: ROUTES.USERS, icon: <UserOutlined />, label: 'Người dùng' },
        { key: ROUTES.BASE_SALARY_CONFIG, icon: <DollarOutlined />, label: 'Cấu hình lương' },
        { key: ROUTES.AUDIT_LOGS, icon: <TableOutlined />, label: 'Nhật ký hoạt động' },
      ],
    });
  }
  return items;
}

const pageTitleMap: Record<string, string> = {
  [ROUTES.HOME]: 'Tổng quan',
  [ROUTES.EMPLOYEES]: 'Nhân sự hiện có',
  [ROUTES.EMPLOYEES_INACTIVE]: 'Nhân sự đã nghỉ',
  [ROUTES.DEPARTMENTS]: 'Phòng ban',
  [ROUTES.POSITIONS]: 'Chức vụ',
  [ROUTES.JOB_POSITIONS]: 'Vị trí việc làm',
  [ROUTES.WORKPLACES]: 'Nơi làm việc',
  [ROUTES.USERS]: 'Người dùng',
  [ROUTES.AUDIT_LOGS]: 'Nhật ký hoạt động',
  [ROUTES.BASE_SALARY_CONFIG]: 'Cấu hình lương',
};

const PageTitleCtx = createContext<{ setPageTitle: (t: string) => void }>({ setPageTitle: () => {} });

export function useSetPageTitle(title: string) {
  const { setPageTitle } = useContext(PageTitleCtx);
  useEffect(() => { setPageTitle(title); }, [title]);
}

function getDefaultTitle(pathname: string): string {
  if (pageTitleMap[pathname]) return pageTitleMap[pathname];
  if (pathname.startsWith('/employees/') && pathname !== ROUTES.EMPLOYEES_INACTIVE) return 'Chi tiết nhân viên';
  if (pathname.startsWith('/workplaces/') && pathname !== ROUTES.WORKPLACES) return 'Chi tiết nơi làm việc';
  return 'HR Core';
}

/** Layout chính: topbar glass, sidebar menu, theme toggle, và modal thông tin cá nhân */
export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string>>({});
  const setPageTitle = useCallback(
    (t: string) => setTitleOverrides((prev) => ({ ...prev, [location.pathname]: t })),
    [location.pathname],
  );
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const path = location.pathname;
    const keys: string[] = [];
    if (path.startsWith(ROUTES.DEPARTMENTS) || path.startsWith(ROUTES.POSITIONS) || path.startsWith(ROUTES.JOB_POSITIONS) || path.startsWith(ROUTES.WORKPLACES)) {
      keys.push('organization');
    }
    if (path.startsWith(ROUTES.EMPLOYEES) || path.startsWith(ROUTES.EMPLOYEES_INACTIVE)) {
      keys.push('hr');
    }
    if (path.startsWith(ROUTES.USERS) || path.startsWith(ROUTES.BASE_SALARY_CONFIG) || path.startsWith(ROUTES.AUDIT_LOGS)) {
      keys.push('system');
    }
    return keys;
  });
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const currentTitle = titleOverrides[location.pathname] || getDefaultTitle(location.pathname);

  const ctxValue = useMemo(() => ({ setPageTitle }), [setPageTitle]);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <PageTitleCtx.Provider value={ctxValue}>
    <Layout style={{ minHeight: '100vh', background: isDark ? '#0f172a' : COLORS.LAYOUT_BG }}>
      <style>{`
        body { margin: 0; padding: 0; background: ${isDark ? '#0f172a' : COLORS.LAYOUT_BG}; color: ${isDark ? '#f8fafc' : '#1e293b'}; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? '#475569' : '#cbd5e1'}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${isDark ? '#64748b' : '#94a3b8'}; }
        .ant-table-wrapper .ant-table { border-radius: 12px; overflow: hidden; }
        .ant-card { transition: box-shadow 0.2s ease, transform 0.2s ease; }
        .ant-card:hover { box-shadow: ${isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.06)'}; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .ant-layout-content > * { animation: fadeIn 0.25s ease-out; }
        .menu-popup-solid, .menu-popup-solid .ant-menu { background: ${isDark ? '#1e293b' : '#ffffff'}; border-radius: 8px; box-shadow: ${isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.08)'}; }

        @media print {
          .ant-layout-sider, .app-topbar {
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
        theme={isDark ? 'dark' : 'light'}
        style={{
          background: isDark ? '#1e293b' : COLORS.SIDEBAR_BG,
          borderRight: isDark ? '1px solid #334155' : `1px solid ${COLORS.BORDER_LIGHT}`,
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
              borderBottom: isDark ? '1px solid #334155' : `1px solid ${COLORS.BORDER_LIGHT}`,
              cursor: 'pointer',
              transition: 'background 0.15s',
              userSelect: 'none',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? '#334155' : COLORS.LAYOUT_BG; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.TRANSPARENT; }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: BORDER_RADIUS.AVATAR,
              background: 'linear-gradient(135deg, #a78bfa, #818cf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(167,139,250,0.3)',
            }}>
              <TeamOutlined style={{ fontSize: 16, color: COLORS.WHITE }} />
            </div>
            {!collapsed && (
              <Typography.Text strong style={{ fontSize: 17, color: isDark ? '#f8fafc' : '#1e293b', letterSpacing: '0.3px' }}>
                HR Core
              </Typography.Text>
            )}
          </div>

          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            <div style={{ height: '100%', overflow: 'auto', padding: '8px 0' }}>
              <Menu
                mode="inline"
                theme={isDark ? 'dark' : 'light'}
                selectedKeys={[location.pathname]}
                openKeys={openKeys}
                onOpenChange={setOpenKeys}
                items={buildMenuItems(user?.permissions)}
                onClick={({ key }) => navigate(key)}
                style={{
                  borderInlineEnd: 'none',
                  background: COLORS.TRANSPARENT,
                }}
              />
            </div>
          </div>
        </div>
      </Sider>
      <Layout style={{ background: isDark ? '#0f172a' : COLORS.LAYOUT_BG }}>
        <Header className="app-topbar" style={{
          height: 56,
          lineHeight: '56px',
          padding: '0 20px',
          background: isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.04)',
          borderBottom: isDark ? '1px solid #334155' : '1px solid rgba(0,0,0,0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 19,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: 18,
                color: isDark ? '#f8fafc' : COLORS.TEXT_PRIMARY,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0 4px',
              }}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
            <Typography.Text strong style={{
              fontSize: 16,
              color: isDark ? '#f8fafc' : COLORS.TEXT_PRIMARY,
              lineHeight: '56px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {currentTitle}
            </Typography.Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tooltip title={isDark ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}>
              <Button
                type="text"
                shape="circle"
                icon={
                  isDark ? (
                    <SunOutlined style={{ color: '#fbbf24', fontSize: 18 }} />
                  ) : (
                    <MoonOutlined style={{ color: '#64748b', fontSize: 18 }} />
                  )
                }
                onClick={toggleTheme}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                }}
              />
            </Tooltip>

            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              menu={{
                items: [
                  { key: 'profile', icon: <UserOutlined />, label: 'Thông tin cá nhân' },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
                ],
                onClick: ({ key }) => {
                  if (key === 'profile') setProfileOpen(true);
                  if (key === 'logout') handleLogout();
                },
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '0 8px',
                height: 40,
                borderRadius: 8,
                transition: 'background 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? '#334155' : COLORS.LAYOUT_BG; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.TRANSPARENT; }}
              >
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a78bfa, #818cf8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLORS.WHITE,
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                  {(user?.full_name || 'U').charAt(0).toUpperCase()}
                </div>
                <Typography.Text style={{
                  color: isDark ? '#f8fafc' : COLORS.TEXT_PRIMARY,
                  fontWeight: 500,
                  fontSize: 13,
                  lineHeight: 1.2,
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {user?.full_name || 'Người dùng'}
                </Typography.Text>
              </div>
            </Dropdown>
          </div>
        </Header>
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
    </PageTitleCtx.Provider>
  );
}

