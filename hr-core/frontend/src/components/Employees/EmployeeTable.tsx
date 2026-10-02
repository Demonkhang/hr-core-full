import { useEffect, useState, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import { Table, Input, Select, Typography, Button, Form } from 'antd';
import { employeeService } from '@/services/employeeService';
import { departmentService } from '@/services/departmentService';
import { positionService } from '@/services/positionService';
import type { Employee } from '@/types/employee';
import type { Department } from '@/types/department';
import type { Position } from '@/types/position';
import type { ColumnsType } from 'antd/es/table';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import { useNavigate } from 'react-router-dom';
import '@/styles/table.css';

interface Props {
  activeOnly: boolean;
  title: string;
  columns?: ColumnsType<Employee>;
  extraColumns?: ColumnsType<Employee>;
  headerActions?: React.ReactNode;
  clientFilter?: (emps: Employee[]) => Employee[];
  formRef?: any;
  refreshKey?: number;
  showColumnFilters?: boolean;
  filterSearch?: string;
  onFilterSearchChange?: (v: string) => void;
  filterDept?: string[];
  onFilterDeptChange?: (v: string[]) => void;
  filterPosition?: string | undefined;
  onFilterPositionChange?: (v: string | undefined) => void;
  editingKey?: string;
  selectedRowKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
}

export function EmployeeTable({
  activeOnly,
  title,
  columns: customColumns,
  extraColumns = [],
  headerActions,
  clientFilter,
  formRef,
  refreshKey = 0,
  showColumnFilters = true,
  filterSearch: controlledFilterSearch,
  onFilterSearchChange: controlledFilterSearchChange,
  filterDept: controlledFilterDept,
  onFilterDeptChange: controlledFilterDeptChange,
  filterPosition: controlledFilterPosition,
  onFilterPositionChange: controlledFilterPositionChange,
  editingKey,
  selectedRowKeys,
  onSelectionChange,
}: Props) {
  const isFilterControlled = controlledFilterSearch !== undefined;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalFilterDept, setInternalFilterDept] = useState<string[]>([]);
  const [internalFilterPosition, setInternalFilterPosition] = useState<string | undefined>(undefined);
  const [internalFilterSearch, setInternalFilterSearch] = useState('');
  const filterDept = isFilterControlled ? (controlledFilterDept || []) : internalFilterDept;
  const filterPosition = isFilterControlled ? controlledFilterPosition : internalFilterPosition;
  const filterSearch = isFilterControlled ? (controlledFilterSearch || '') : internalFilterSearch;
  const setFilterDept = isFilterControlled ? (controlledFilterDeptChange || setInternalFilterDept) : setInternalFilterDept;
  const setFilterPosition = isFilterControlled ? (controlledFilterPositionChange || setInternalFilterPosition) : setInternalFilterPosition;
  const setFilterSearch = isFilterControlled ? (controlledFilterSearchChange || setInternalFilterSearch) : setInternalFilterSearch;
  const [form] = Form.useForm();
  const activeForm = formRef || form;
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { active_only: activeOnly, include_accounts: true };
      if (filterDept.length > 0) params.department_id = filterDept;
      if (filterPosition) params.position_id = filterPosition;
      if (filterSearch) params.search = filterSearch;
      const [emps, depts, poss] = await Promise.all([
        employeeService.list(params),
        departmentService.list(),
        positionService.list(),
      ]);
      setEmployees(clientFilter ? clientFilter(emps) : emps);
      setDepartments(depts);
      setPositions(poss);
    } catch {
      // handled by apiClient interceptor
    } finally {
      setLoading(false);
    }
  }, [filterDept, filterPosition, filterSearch, activeOnly, clientFilter]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  const searchDropdown = useCallback(({ setSelectedKeys, confirm }: FilterDropdownProps) => (
    <div style={{ padding: 8 }}>
      <Input.Search
        allowClear
        placeholder="Tìm tên, mã NV, SĐT..."
        defaultValue={filterSearch}
        onSearch={(v) => {
          setFilterSearch(v);
          setSelectedKeys(v ? [v] : []);
          confirm();
        }}
      />
    </div>
  ), [filterSearch]);

  const deptDropdown = useCallback(({ setSelectedKeys, confirm }: FilterDropdownProps) => (
    <div style={{ padding: 8 }}>
      <Select
        mode="multiple"
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder="Lọc phòng ban"
        value={filterDept}
        onChange={(value) => {
          setFilterDept(value);
          setSelectedKeys(value.length > 0 ? value : []);
          confirm();
        }}
        options={departments.map((d) => ({ label: d.name, value: d.id }))}
        style={{ width: 200 }}
        notFoundContent="Không tìm thấy"
      />
    </div>
  ), [filterDept, departments]);

  const posDropdown = useCallback(({ setSelectedKeys, confirm }: FilterDropdownProps) => (
    <div style={{ padding: 8 }}>
      <Select
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder="Lọc chức vụ"
        value={filterPosition}
        onChange={(value) => {
          setFilterPosition(value);
          setSelectedKeys(value ? [value] : []);
          confirm();
        }}
        options={positions.filter((p) => p.is_active).map((p) => ({ label: p.name, value: p.id }))}
        style={{ width: 200 }}
        notFoundContent="Không tìm thấy"
      />
    </div>
  ), [filterPosition, positions]);

  const handleSelectionChange = useCallback((selectedRowKeys: React.Key[]) => {
    if (onSelectionChange) {
      onSelectionChange(selectedRowKeys as string[]);
    }
  }, [onSelectionChange]);

  const rowSelectionProps = selectedRowKeys !== undefined && onSelectionChange ? {
    selectedRowKeys,
    onChange: handleSelectionChange,
  } : undefined;

  const baseColumns: ColumnsType<Employee> = [
    {
      title: 'Mã NV', dataIndex: 'employee_code', key: 'code', width: 100,
      render: (v: string | null) => <span>{v || '-'}</span>,
    },
    {
      title: 'Họ tên', dataIndex: 'full_name', key: 'name', width: 180,
      filterDropdown: showColumnFilters ? searchDropdown : undefined,
      filteredValue: showColumnFilters && filterSearch ? [filterSearch] : undefined,
      render: (v: string, record: Employee) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/employees/${record.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Phòng ban', dataIndex: 'department_name', key: 'dept', width: 220,
      filterDropdown: showColumnFilters ? deptDropdown : undefined,
      filteredValue: showColumnFilters && filterDept.length > 0 ? filterDept : undefined,
    },
    {
      title: 'Chức vụ', dataIndex: 'position_name', key: 'position_name', width: 160,
      filterDropdown: showColumnFilters ? posDropdown : undefined,
      filteredValue: showColumnFilters && filterPosition ? [filterPosition] : undefined,
    },
    {
      title: 'Ngày vào làm', dataIndex: 'hire_date', key: 'hire_date', width: 130,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    { title: 'SĐT', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 160 },
  ];

  const columns = useMemo(() => {
    if (customColumns) return customColumns;
    return [...baseColumns, ...extraColumns];
  }, [customColumns, extraColumns, searchDropdown, deptDropdown, posDropdown, filterSearch, filterDept, filterPosition, navigate]);

  const paginationConfig = useMemo(() => ({
    pageSize: 20,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50, 100],
    showTotal: (total: number) => `Tổng ${total} nhân sự`,
  }), []);

  return (
    <div>
      {headerActions && <div className="page-header">{headerActions}</div>}
      <Form form={activeForm} component={false}>
        <Table
          dataSource={editingKey === '__new__' ? [{ id: '__new__', job_position_id: null, job_position_name: null } as Employee, ...employees] : employees}
          columns={columns}
          rowKey="id"
          rowSelection={rowSelectionProps}
          loading={loading}
          pagination={paginationConfig}
          scroll={{ x: 'max-content' }}
        />
      </Form>
    </div>
  );
}
