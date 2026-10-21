import { Form, Select, Input, Button, Typography } from 'antd';
import type { FormInstance } from 'antd';
import type { Employee } from '@/types/employee';
import type { Schedule, ShiftTemplate } from '@/types/schedule';
import type { Workplace } from '@/types/workplace';

interface ScheduleFormProps {
  form: FormInstance;
  editingSchedule: Schedule | null;
  employees: Employee[];
  shiftTemplates: ShiftTemplate[];
  workplaces: Workplace[];
  selectedWorkplaceId: string | undefined;
  onSubmit: (values: any) => void;
  onCancel: () => void;
}

export function ScheduleForm({ form, editingSchedule, employees, shiftTemplates, workplaces, selectedWorkplaceId, onSubmit, onCancel }: ScheduleFormProps) {
  const formWorkplaceId = Form.useWatch('workplace_id', form) || selectedWorkplaceId;
  const selectedShiftId = Form.useWatch('shift_template_id', form);
  const selectedShift = shiftTemplates.find((t) => t.id === selectedShiftId);
  const deptFilteredEmployees = selectedShift?.department_ids?.length
    ? employees.filter((e) => e.department_id && selectedShift.department_ids.includes(e.department_id))
    : employees;

  return (
    <div style={{ marginTop: editingSchedule ? 0 : 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography.Text strong>
          {editingSchedule ? 'Chỉnh sửa ca trực' : 'Thêm ca trực mới'}
        </Typography.Text>
        <Button type="link" size="small" onClick={onCancel}>
          Huỷ
        </Button>
      </div>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="workplace_id" label="Nơi làm việc" rules={[{ required: true }]}>
          <Select
            placeholder="Chọn nơi làm việc"
            onChange={() => {
              form.setFieldValue('shift_template_id', undefined);
              form.setFieldValue('employee_id', undefined);
            }}
            options={workplaces
              .filter((w) => w.is_active)
              .map((w) => ({
                label: w.name,
                value: w.id,
              }))}
          />
        </Form.Item>
        <Form.Item name="shift_template_id" label="Ca trực" rules={[{ required: true }]}>
          <Select
            placeholder="Chọn ca"
            onChange={() => form.setFieldValue('employee_id', undefined)}
            options={shiftTemplates
              .filter((t) => t.is_active && (!formWorkplaceId || t.workplace_id === formWorkplaceId))
              .map((t) => ({
                label: `${t.name} (${t.start_time.slice(0, 5)}-${t.end_time.slice(0, 5)})`,
                value: t.id,
              }))}
          />
        </Form.Item>
        {!editingSchedule && (
          <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              showSearch
              placeholder="Chọn nhân viên"
              optionFilterProp="label"
              options={deptFilteredEmployees.map((e) => ({
                label: `${e.full_name}${e.position ? ` (${e.position})` : ''}`,
                value: e.id,
              }))}
            />
          </Form.Item>
        )}
        <Form.Item name="notes" label="Ghi chú">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            {editingSchedule ? 'Cập nhật' : 'Lưu lịch trực'}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
