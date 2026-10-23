import { useState, useMemo, useEffect } from 'react';
import { Modal, Input, Button, Checkbox, Avatar, Tag, Space, Typography, Badge, Empty, Tooltip } from 'antd';
import { SearchOutlined, UserOutlined, TeamOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { Department } from '@/types/department';
import type { Employee } from '@/types/employee';

interface DepartmentParticipantModalProps {
  open: boolean;
  onClose: () => void;
  departments: Department[];
  employees: Employee[];
  selectedIds: string[];
  onConfirm: (selectedIds: string[]) => void;
}

const AVATAR_COLORS = [
  '#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#1890ff',
  '#52c41a', '#eb2f96', '#722ed1', '#fa8c16', '#13c2c2',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function DepartmentParticipantModal({
  open,
  onClose,
  departments,
  employees,
  selectedIds,
  onConfirm,
}: DepartmentParticipantModalProps) {
  const [activeDeptId, setActiveDeptId] = useState<string>('all');
  const [deptSearch, setDeptSearch] = useState<string>('');
  const [empSearch, setEmpSearch] = useState<string>('');
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTempSelectedIds(selectedIds || []);
      setActiveDeptId('all');
      setDeptSearch('');
      setEmpSearch('');
    }
  }, [open, selectedIds]);

  // Filter departments by search
  const filteredDepartments = useMemo(() => {
    if (!deptSearch.trim()) return departments;
    const term = deptSearch.toLowerCase();
    return departments.filter((d) => d.name.toLowerCase().includes(term));
  }, [departments, deptSearch]);

  // Count employees and selected counts per department
  const deptStats = useMemo(() => {
    const stats = new Map<string, { total: number; selected: number }>();
    for (const d of departments) {
      stats.set(d.id, { total: 0, selected: 0 });
    }

    let allTotal = 0;
    let allSelected = 0;

    for (const emp of employees) {
      if (!emp.is_active) continue;
      allTotal++;
      const isSel = tempSelectedIds.includes(emp.id);
      if (isSel) allSelected++;

      if (emp.department_id && stats.has(emp.department_id)) {
        const curr = stats.get(emp.department_id)!;
        curr.total++;
        if (isSel) curr.selected++;
      }
    }

    stats.set('all', { total: allTotal, selected: allSelected });
    return stats;
  }, [departments, employees, tempSelectedIds]);

  // Filter employees by active department & search term
  const displayedEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (!emp.is_active) return false;
      if (activeDeptId !== 'all' && emp.department_id !== activeDeptId) return false;
      if (empSearch.trim()) {
        const term = empSearch.toLowerCase();
        const matchName = emp.full_name?.toLowerCase().includes(term);
        const matchCode = emp.employee_code?.toLowerCase().includes(term);
        const matchPos = emp.position_name?.toLowerCase().includes(term);
        if (!matchName && !matchCode && !matchPos) return false;
      }
      return true;
    });
  }, [employees, activeDeptId, empSearch]);

  // Toggle single employee
  const handleToggleEmployee = (id: string) => {
    setTempSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Select all employees currently in active department filter
  const handleSelectAllInDept = () => {
    const idsInDept = displayedEmployees.map((e) => e.id);
    setTempSelectedIds((prev) => {
      const set = new Set([...prev, ...idsInDept]);
      return Array.from(set);
    });
  };

  // Deselect all employees currently in active department filter
  const handleDeselectAllInDept = () => {
    const idsInDept = new Set(displayedEmployees.map((e) => e.id));
    setTempSelectedIds((prev) => prev.filter((id) => !idsInDept.has(id)));
  };

  // Get active department name for heading
  const activeDeptName = useMemo(() => {
    if (activeDeptId === 'all') return 'Tất cả phòng ban';
    return departments.find((d) => d.id === activeDeptId)?.name || 'Phòng ban';
  }, [activeDeptId, departments]);

  const handleSave = () => {
    onConfirm(tempSelectedIds);
    onClose();
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TeamOutlined style={{ color: '#2563eb', fontSize: 18 }} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>Chọn người tham gia cuộc họp</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={840}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Typography.Text strong style={{ color: '#1e293b' }}>
              Đã chọn:
            </Typography.Text>
            <Tag color={tempSelectedIds.length > 0 ? 'blue' : 'default'} style={{ fontSize: 13, padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
              {tempSelectedIds.length} người
            </Tag>
            {tempSelectedIds.length > 0 && (
              <Button type="link" size="small" danger onClick={() => setTempSelectedIds([])}>
                Xóa tất cả
              </Button>
            )}
          </div>
          <Space>
            <Button onClick={onClose}>Hủy</Button>
            <Button type="primary" onClick={handleSave} style={{ background: '#2563eb' }}>
              Xác nhận ({tempSelectedIds.length} người)
            </Button>
          </Space>
        </div>
      }
    >
      <div style={{ display: 'flex', height: 460, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        {/* Left Column: 1. Departments List */}
        <div style={{ width: 280, borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
            <Typography.Text strong style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>
              1. Chọn phòng ban
            </Typography.Text>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Tìm phòng ban..."
              value={deptSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeptSearch(e.target.value)}
              size="small"
              allowClear
              style={{ marginTop: 6, borderRadius: 6 }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            {/* 'All' option */}
            {(!deptSearch || 'tất cả phòng ban'.includes(deptSearch.toLowerCase())) && (
              <div
                onClick={() => setActiveDeptId('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  marginBottom: 4,
                  background: activeDeptId === 'all' ? '#eff6ff' : 'transparent',
                  color: activeDeptId === 'all' ? '#2563eb' : '#334155',
                  fontWeight: activeDeptId === 'all' ? 700 : 500,
                  border: activeDeptId === 'all' ? '1px solid #bfdbfe' : '1px solid transparent',
                }}
              >
                <span>Tất cả phòng ban</span>
                <span style={{ fontSize: 11, background: activeDeptId === 'all' ? '#dbeafe' : '#f1f5f9', padding: '1px 6px', borderRadius: 10, color: '#64748b' }}>
                  {deptStats.get('all')?.selected || 0}/{deptStats.get('all')?.total || 0}
                </span>
              </div>
            )}

            {filteredDepartments.map((d) => {
              const stat = deptStats.get(d.id) || { total: 0, selected: 0 };
              const isSelected = activeDeptId === d.id;

              return (
                <div
                  key={d.id}
                  onClick={() => setActiveDeptId(d.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    marginBottom: 4,
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#2563eb' : '#334155',
                    fontWeight: isSelected ? 700 : 500,
                    border: isSelected ? '1px solid #bfdbfe' : '1px solid #f1f5f9',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: 6 }}>
                    {d.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      background: stat.selected > 0 ? '#dbeafe' : '#f1f5f9',
                      color: stat.selected > 0 ? '#1e40af' : '#64748b',
                      fontWeight: stat.selected > 0 ? 700 : 500,
                      padding: '1px 6px',
                      borderRadius: 10,
                      flexShrink: 0,
                    }}
                  >
                    {stat.selected}/{stat.total}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: 2. Employees in selected department */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
          {/* Top Bar for Employees */}
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: '#fafafa',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Typography.Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                2. Chọn nhân viên: {activeDeptName}
              </Typography.Text>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                ({displayedEmployees.length} nhân viên khả dụng)
              </span>
            </div>

            <Space size={8}>
              <Button size="small" type="primary" ghost onClick={handleSelectAllInDept}>
                + Chọn tất cả ({displayedEmployees.length})
              </Button>
              <Button size="small" onClick={handleDeselectAllInDept}>
                Bỏ chọn
              </Button>
            </Space>
          </div>

          {/* Search bar inside employee list */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid #f1f5f9' }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Tìm theo tên, mã nhân viên..."
              value={empSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmpSearch(e.target.value)}
              size="middle"
              allowClear
              style={{ borderRadius: 6 }}
            />
          </div>

          {/* Employees List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
            {displayedEmployees.length === 0 ? (
              <Empty description="Không có nhân viên nào phù hợp" style={{ margin: '40px 0' }} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                {displayedEmployees.map((emp) => {
                  const isChecked = tempSelectedIds.includes(emp.id);

                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleToggleEmployee(emp.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        border: isChecked ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                        borderRadius: 8,
                        background: isChecked ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Checkbox
                        checked={isChecked}
                        onChange={() => {}} // handled by parent onClick
                        style={{ pointerEvents: 'none' }}
                      />
                      <Avatar
                        size={32}
                        style={{
                          backgroundColor: getAvatarColor(emp.full_name),
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {emp.full_name?.charAt(0)?.toUpperCase()}
                      </Avatar>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {emp.full_name}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {emp.employee_code ? `${emp.employee_code} • ` : ''}{emp.department_name || emp.position_name || ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
