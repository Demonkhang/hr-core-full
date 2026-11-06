import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Progress,
  Avatar,
  Typography,
  Row,
  Col,
  Statistic,
  Tabs,
  Empty,
  message,
  Tooltip,
} from 'antd';
import {
  IdcardOutlined,
  SearchOutlined,
  UserOutlined,
  FileProtectOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  EditOutlined,
  BarChartOutlined,
  PieChartOutlined,
  UnorderedListOutlined,
  DownloadOutlined,
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
} from 'recharts';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { personnelProfileService } from '@/services/personnelProfileService';
import type { VcProfileListItem } from '@/types/personnelProfile';
import { useAuthStore } from '@/store/authStore';
import { useSetPageTitle } from '@/components/Layout/AppLayout';
import { ROUTES } from '@/utils/constants';

const CHART_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#06b6d4',
  '#ef4444',
];

export function PersonnelProfileList() {
  useSetPageTitle('Hồ sơ lý lịch viên chức (Mẫu HS02-VC/BNV)');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const activeTab = searchParams.get('tab') === 'charts' ? 'charts' : 'list';

  const [items, setItems] = useState<VcProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string | undefined>(undefined);
  const [degreeFilter, setDegreeFilter] = useState<string | undefined>(undefined);
  const [cpvFilter, setCpvFilter] = useState<string | undefined>(undefined);

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await personnelProfileService.list();
      setItems(data);
    } catch {
      message.error('Không thể tải danh sách hồ sơ lý lịch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const departments = useMemo(() => {
    const s = new Set(items.map((i) => i.department_name).filter(Boolean) as string[]);
    return Array.from(s);
  }, [items]);

  const degrees = useMemo(() => {
    const s = new Set(items.map((i) => i.highest_professional_degree).filter(Boolean) as string[]);
    return Array.from(s);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          (item.full_name || '').toLowerCase().includes(q) ||
          (item.birth_full_name || '').toLowerCase().includes(q) ||
          (item.username || '').toLowerCase().includes(q) ||
          (item.cccd_number || '').toLowerCase().includes(q) ||
          (item.official_file_code || '').toLowerCase().includes(q) ||
          (item.employee_code || '').toLowerCase().includes(q) ||
          (item.social_insurance_code || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (deptFilter && item.department_name !== deptFilter) return false;
      if (degreeFilter && item.highest_professional_degree !== degreeFilter) return false;
      if (cpvFilter === 'yes' && !item.is_cpv_member) return false;
      if (cpvFilter === 'no' && item.is_cpv_member) return false;
      return true;
    });
  }, [items, search, deptFilter, degreeFilter, cpvFilter]);

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.completion_percent >= 80).length;
    const cpvCount = items.filter((i) => i.is_cpv_member).length;
    const titledCount = items.filter((i) => Boolean(i.professional_title_code || i.professional_title_name)).length;
    const avgCompletion = total > 0 ? Math.round(items.reduce((acc, c) => acc + c.completion_percent, 0) / total) : 0;
    return { total, completed, cpvCount, titledCount, avgCompletion };
  }, [items]);

  // --- Aggregations for Charts ---
  const deptChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const key = item.department_name || 'Chưa phân bổ';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [items]);

  const degreeChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const key = item.highest_professional_degree || 'Chưa kê khai';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [items]);

  const cpvChartData = useMemo(() => {
    const cpv = items.filter((i) => i.is_cpv_member).length;
    const nonCpv = items.length - cpv;
    return [
      { name: 'Đảng viên ĐCSVN', value: cpv, color: '#ef4444' },
      { name: 'Quần chúng', value: nonCpv, color: '#3b82f6' },
    ].filter((d) => d.value > 0);
  }, [items]);

  const genderChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const key = item.gender || 'Chưa cập nhật';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [items]);

  const completionTierData = useMemo(() => {
    const high = items.filter((i) => i.completion_percent >= 80).length;
    const medium = items.filter((i) => i.completion_percent >= 40 && i.completion_percent < 80).length;
    const low = items.filter((i) => i.completion_percent < 40).length;
    return [
      { name: 'Hoàn thiện (≥80%)', count: high, fill: '#10b981' },
      { name: 'Đang cập nhật (40-79%)', count: medium, fill: '#3b82f6' },
      { name: 'Mới khởi tạo (<40%)', count: low, fill: '#f59e0b' },
    ];
  }, [items]);

  const personCompletionData = useMemo(() => {
    return [...items]
      .sort((a, b) => b.completion_percent - a.completion_percent)
      .map((i) => ({
        name: i.birth_full_name || i.full_name,
        percent: i.completion_percent,
        dept: i.department_name || '-',
      }));
  }, [items]);

  const politicalTheoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const key = item.political_theory_level || 'Chưa kê khai';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [items]);

  const handleExportExcel = () => {
    if (!filteredItems.length) {
      message.warning('Không có dữ liệu để xuất');
      return;
    }
    const rows = filteredItems.map((r, idx) => ({
      STT: idx + 1,
      'Họ và tên khai sinh': r.birth_full_name || r.full_name.toUpperCase(),
      'Tài khoản': r.username,
      'Mã hồ sơ VC': r.official_file_code || r.employee_code || '-',
      'Số CCCD': r.cccd_number || '-',
      'Mã số BHXH': r.social_insurance_code || '-',
      'Giới tính': r.gender || '-',
      'Đơn vị / Phòng ban': r.department_name || '-',
      'Chức vụ': r.position_name || '-',
      'Trình độ chuyên môn': r.highest_professional_degree || '-',
      'Lý luận chính trị': r.political_theory_level || '-',
      'Chức danh nghề nghiệp': r.professional_title_name || '-',
      'Mã ngạch/hạng': r.professional_title_code || '-',
      'Bậc lương': r.salary_step ?? '-',
      'Hệ số lương': r.salary_coefficient ?? '-',
      'Đảng viên': r.is_cpv_member ? 'Đảng viên' : 'Quần chúng',
      'Mức độ hoàn thiện (%)': `${r.completion_percent}%`,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HoSoLyLichBNV');
    XLSX.writeFile(wb, `Tong_hop_ho_so_vien_chuc_${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  const columns = [
    {
      title: 'TÀI KHOẢN / VIÊN CHỨC',
      key: 'identity',
      width: 260,
      render: (_: any, r: VcProfileListItem) => (
        <Space size={12}>
          <Avatar
            shape="square"
            size={48}
            src={r.portrait_url || undefined}
            icon={<UserOutlined />}
            style={{
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#eff6ff',
              color: '#2563eb',
              objectFit: 'cover',
            }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {r.birth_full_name || r.full_name.toUpperCase()}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              TK: <Tag style={{ margin: 0, fontSize: 11 }}>{r.username}</Tag>
              {r.is_cpv_member && (
                <Tag color="red" style={{ marginLeft: 4, fontSize: 11 }}>
                  Đảng viên
                </Tag>
              )}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'MÃ ĐỊNH DANH (CCCD / BHXH)',
      key: 'codes',
      width: 210,
      render: (_: any, r: VcProfileListItem) => (
        <div style={{ fontSize: 12, lineHeight: '20px' }}>
          <div>
            <span style={{ color: '#64748b' }}>Mã HS:</span>{' '}
            <strong>{r.official_file_code || r.employee_code || '-'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>CCCD:</span>{' '}
            <strong>{r.cccd_number || '-'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>BHXH:</span>{' '}
            <span>{r.social_insurance_code || '-'}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'ĐƠN VỊ & CHỨC VỤ',
      key: 'dept',
      width: 190,
      render: (_: any, r: VcProfileListItem) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.department_name || 'Chưa phân bổ'}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{r.position_name || '-'}</div>
        </div>
      ),
    },
    {
      title: 'TRÌNH ĐỘ & NGẠCH/HẠNG CDNN',
      key: 'qualification',
      width: 220,
      render: (_: any, r: VcProfileListItem) => (
        <div>
          {r.highest_professional_degree ? (
            <Tag color="purple" style={{ marginBottom: 4 }}>
              {r.highest_professional_degree}
            </Tag>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Chưa kê khai trình độ</span>
          )}
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {r.professional_title_name || '-'}
            {r.professional_title_code ? ` (${r.professional_title_code})` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'BẬC / HỆ SỐ LƯƠNG',
      key: 'salary',
      width: 140,
      render: (_: any, r: VcProfileListItem) =>
        r.salary_coefficient != null ? (
          <div>
            <Tag color="blue" style={{ fontWeight: 600 }}>
              Bậc {r.salary_step || '-'} — HS: {Number(r.salary_coefficient).toFixed(2)}
            </Tag>
          </div>
        ) : (
          <span style={{ color: '#94a3b8', fontSize: 12 }}>Chưa kê khai</span>
        ),
    },
    {
      title: 'MỨC ĐỘ HOÀN THIỆN',
      key: 'completion',
      width: 170,
      sorter: (a: VcProfileListItem, b: VcProfileListItem) => a.completion_percent - b.completion_percent,
      render: (_: any, r: VcProfileListItem) => (
        <div>
          <Progress
            percent={r.completion_percent}
            size="small"
            status={r.completion_percent >= 80 ? 'success' : 'active'}
            strokeColor={r.completion_percent >= 80 ? '#10b981' : r.completion_percent >= 40 ? '#3b82f6' : '#f59e0b'}
          />
          {r.updated_at && (
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Cập nhật: {dayjs(r.updated_at).format('DD/MM/YYYY')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'THAO TÁC',
      key: 'actions',
      width: 185,
      fixed: 'right' as const,
      render: (_: any, r: VcProfileListItem) => (
        <Button
          type="primary"
          size="small"
          icon={<EditOutlined />}
          onClick={() => navigate(ROUTES.PERSONNEL_PROFILE_DETAIL(r.user_id))}
        >
          2 Tab Hồ sơ (TT06 & HS01)
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            <IdcardOutlined style={{ color: '#4f46e5', marginRight: 8 }} />
            Quản lý Hồ sơ Lý lịch Viên chức (2 Biểu mẫu Chuẩn TT 06/2023 & HS01-VC/BNV)
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Lưu trữ đồng bộ 2 Tab Hồ sơ: (1) Sơ yếu lý lịch 38 mục theo TT 06/2023/TT-BNV & (2) Lý lịch viên chức Mẫu HS01-VC/BNV theo TT 07/2019/TT-BNV — Hỗ trợ Import trực tiếp từ file Word (.doc / .docx)
          </Typography.Text>
        </div>

        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>
            Xuất Excel tổng hợp
          </Button>
          {user?.id && (
            <Tooltip title="Mở và cập nhật sơ yếu lý lịch của tài khoản đang đăng nhập">
              <Button
                type="primary"
                icon={<FileProtectOutlined />}
                size="middle"
                style={{ background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 600 }}
                onClick={() => navigate(ROUTES.PERSONNEL_PROFILE_DETAIL(String(user.id)))}
              >
                Hồ sơ lý lịch của tôi
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Tổng số tài khoản hồ sơ"
              value={stats.total}
              prefix={<IdcardOutlined style={{ color: '#3b82f6' }} />}
              suffix={`tài khoản (TB ${stats.avgCompletion}%)`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Đã hoàn thiện (≥ 80%)"
              value={stats.completed}
              valueStyle={{ color: '#10b981' }}
              prefix={<CheckCircleOutlined />}
              suffix={`/ ${stats.total}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Đảng viên ĐCSVN"
              value={stats.cpvCount}
              valueStyle={{ color: '#dc2626' }}
              prefix={<StarOutlined />}
              suffix="đồng chí"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Đã xếp Ngạch/Hạng CDNN"
              value={stats.titledCount}
              valueStyle={{ color: '#7c3aed' }}
              prefix={<SafetyCertificateOutlined />}
              suffix="hồ sơ"
            />
          </Card>
        </Col>
      </Row>

      {/* Sub-tabs: Danh sách vs Sơ đồ tổng hợp */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          if (key === 'charts') {
            setSearchParams({ tab: 'charts' });
          } else {
            setSearchParams({});
          }
        }}
        type="card"
        items={[
          {
            key: 'list',
            label: (
              <span>
                <UnorderedListOutlined /> Danh sách hồ sơ viên chức ({items.length})
              </span>
            ),
            children: (
              <div>
                {/* Filter Bar */}
                <Card size="small" style={{ marginBottom: 16, borderRadius: 12 }}>
                  <Space wrap size={12}>
                    <Input
                      placeholder="Tìm theo Họ tên, Tài khoản, CCCD, Mã HS, BHXH..."
                      prefix={<SearchOutlined />}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      allowClear
                      style={{ width: 320 }}
                    />
                    <Select
                      placeholder="Lọc theo Đơn vị / Phòng ban"
                      allowClear
                      value={deptFilter}
                      onChange={setDeptFilter}
                      style={{ width: 210 }}
                      options={departments.map((d) => ({ label: d, value: d }))}
                    />
                    <Select
                      placeholder="Trình độ chuyên môn"
                      allowClear
                      value={degreeFilter}
                      onChange={setDegreeFilter}
                      style={{ width: 180 }}
                      options={degrees.map((d) => ({ label: d, value: d }))}
                    />
                    <Select
                      placeholder="Đảng viên"
                      allowClear
                      value={cpvFilter}
                      onChange={setCpvFilter}
                      style={{ width: 150 }}
                      options={[
                        { label: 'Đảng viên', value: 'yes' },
                        { label: 'Quần chúng', value: 'no' },
                      ]}
                    />
                  </Space>
                </Card>

                {/* Main Table */}
                <Card size="small" style={{ borderRadius: 12 }}>
                  <Table
                    dataSource={filteredItems}
                    columns={columns}
                    rowKey="user_id"
                    loading={loading}
                    scroll={{ x: 1200 }}
                    pagination={{ pageSize: 15, showTotal: (t) => `Tổng cộng ${t} hồ sơ tài khoản` }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'charts',
            label: (
              <span>
                <BarChartOutlined /> Sơ đồ & Thống kê tổng hợp
              </span>
            ),
            children: (
              <div>
                {items.length === 0 ? (
                  <Card style={{ borderRadius: 12 }}>
                    <Empty description="Chưa có dữ liệu hồ sơ để vẽ sơ đồ" />
                  </Card>
                ) : (
                  <Row gutter={[16, 16]}>
                    {/* Chart 1: Phân bổ theo Đơn vị / Phòng ban */}
                    <Col xs={24} lg={12}>
                      <Card
                        size="small"
                        title={
                          <Space>
                            <PieChartOutlined style={{ color: '#6366f1' }} />
                            <span>1. Cơ cấu Hồ sơ Viên chức theo Đơn vị / Phòng ban</span>
                          </Space>
                        }
                        style={{ borderRadius: 12, height: '100%' }}
                      >
                        <ResponsiveContainer width="100%" height={290}>
                          <PieChart>
                            <Pie
                              data={deptChartData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={95}
                              label={({ name, value }) => `${name}: ${value}`}
                            >
                              {deptChartData.map((_, idx) => (
                                <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(v: any) => [`${v} hồ sơ`, 'Số lượng']} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </Card>
                    </Col>

                    {/* Chart 2: Tiến độ hoàn thiện hồ sơ theo từng cá nhân */}
                    <Col xs={24} lg={12}>
                      <Card
                        size="small"
                        title={
                          <Space>
                            <BarChartOutlined style={{ color: '#10b981' }} />
                            <span>2. Sơ đồ Tiến độ Hoàn thiện Hồ sơ của từng Viên chức (%)</span>
                          </Space>
                        }
                        style={{ borderRadius: 12, height: '100%' }}
                      >
                        <ResponsiveContainer width="100%" height={290}>
                          <BarChart
                            data={personCompletionData}
                            layout="vertical"
                            margin={{ top: 10, right: 24, left: 20, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis type="number" domain={[0, 100]} unit="%" />
                            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                            <RechartsTooltip formatter={(v: any) => [`${v}%`, 'Mức độ hoàn thiện']} />
                            <Bar dataKey="percent" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={22} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    </Col>

                    {/* Chart 3: Phân bổ Trình độ chuyên môn cao nhất */}
                    <Col xs={24} lg={12}>
                      <Card
                        size="small"
                        title={
                          <Space>
                            <BarChartOutlined style={{ color: '#8b5cf6' }} />
                            <span>3. Cơ cấu theo Trình độ Chuyên môn Cao nhất</span>
                          </Space>
                        }
                        style={{ borderRadius: 12, height: '100%' }}
                      >
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={degreeChartData} margin={{ top: 16, right: 20, left: 0, bottom: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <RechartsTooltip formatter={(v: any) => [`${v} người`, 'Số lượng']} />
                            <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={36} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    </Col>

                    {/* Chart 4: Phân tầng mức độ hoàn thiện hồ sơ */}
                    <Col xs={24} lg={12}>
                      <Card
                        size="small"
                        title={
                          <Space>
                            <CheckCircleOutlined style={{ color: '#10b981' }} />
                            <span>4. Thống kê Phân nhóm Chất lượng Kê khai Hồ sơ</span>
                          </Space>
                        }
                        style={{ borderRadius: 12, height: '100%' }}
                      >
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={completionTierData} margin={{ top: 16, right: 20, left: 0, bottom: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <RechartsTooltip formatter={(v: any) => [`${v} hồ sơ`, 'Số lượng']} />
                            <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={42}>
                              {completionTierData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    </Col>

                    {/* Chart 5: Cơ cấu Đảng viên & Giới tính */}
                    <Col xs={24} lg={12}>
                      <Card
                        size="small"
                        title={
                          <Space>
                            <StarOutlined style={{ color: '#ef4444' }} />
                            <span>5. Tỷ lệ Đảng viên ĐCSVN & Cơ cấu Giới tính</span>
                          </Space>
                        }
                        style={{ borderRadius: 12, height: '100%' }}
                      >
                        <Row gutter={12}>
                          <Col xs={24} sm={12}>
                            <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                              Tổ chức Đảng
                            </div>
                            <ResponsiveContainer width="100%" height={230}>
                              <PieChart>
                                <Pie
                                  data={cpvChartData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={70}
                                  innerRadius={38}
                                >
                                  {cpvChartData.map((entry, i) => (
                                    <Cell key={i} fill={entry.color} />
                                  ))}
                                </Pie>
                                <RechartsTooltip formatter={(v: any) => [`${v} người`, 'Số lượng']} />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </Col>
                          <Col xs={24} sm={12}>
                            <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                              Giới tính
                            </div>
                            <ResponsiveContainer width="100%" height={230}>
                              <PieChart>
                                <Pie
                                  data={genderChartData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={70}
                                  innerRadius={38}
                                >
                                  {genderChartData.map((_, i) => (
                                    <Cell key={i} fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]} />
                                  ))}
                                </Pie>
                                <RechartsTooltip formatter={(v: any) => [`${v} người`, 'Số lượng']} />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </Col>
                        </Row>
                      </Card>
                    </Col>

                    {/* Chart 6: Trình độ Lý luận chính trị */}
                    <Col xs={24} lg={12}>
                      <Card
                        size="small"
                        title={
                          <Space>
                            <SafetyCertificateOutlined style={{ color: '#f59e0b' }} />
                            <span>6. Cơ cấu Trình độ Lý luận Chính trị</span>
                          </Space>
                        }
                        style={{ borderRadius: 12, height: '100%' }}
                      >
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={politicalTheoryData} margin={{ top: 16, right: 20, left: 0, bottom: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <RechartsTooltip formatter={(v: any) => [`${v} người`, 'Số lượng']} />
                            <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={36} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    </Col>
                  </Row>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
