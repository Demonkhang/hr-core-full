import { Modal, Spin, Empty, Typography, Card, Tag, Button, Divider, Tooltip, Popconfirm } from 'antd';
import { PlusOutlined, CheckCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getShiftTime } from '@/utils/scheduleHelpers';
import { DATE_FORMATS, SCHEDULE_STATUS, STATUS_COLORS, STATUS_TAG_LABELS } from '@/utils/constants';
import { ScheduleForm } from './ScheduleForm';
import type { Employee } from '@/types/employee';
import type { Schedule, ShiftTemplate } from '@/types/schedule';
import type { Workplace } from '@/types/workplace';
import type { FormInstance } from 'antd';

interface ScheduleModalProps {
  visible: boolean;
  selectedDate: string;
  loading: boolean;
  schedules: Schedule[];
  showForm: boolean;
  editingSchedule: Schedule | null;
  employees: Employee[];
  shiftTemplates: ShiftTemplate[];
  workplaces: Workplace[];
  form: FormInstance;
  selectedWorkplaceId: string | undefined;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (scheduleId: string) => void;
  onSubmit: (scheduleId: string) => void;
  onCancelForm: () => void;
  onFormSubmit: (values: any) => void;
}

export function ScheduleModal({
  visible,
  selectedDate,
  loading,
  schedules,
  showForm,
  editingSchedule,
  employees,
  shiftTemplates,
  workplaces,
  form,
  selectedWorkplaceId,
  onClose,
  onAdd,
  onEdit,
  onDelete,
  onSubmit,
  onCancelForm,
  onFormSubmit,
}: ScheduleModalProps) {
  const scheduleContent = (() => {
    if (loading) return <Spin style={{ display: 'block', margin: '20px auto' }} />;
    if (schedules.length === 0) {
      return <Empty description="Không có lịch trực nào" />;
    }

    const noWp: Schedule[] = [];
    const byWp = new Map<string, { name: string; schedules: Schedule[]; isOffice: boolean }>();
    const wpLookup = new Map(workplaces.map((w) => [w.id, w]));

    for (const s of schedules) {
      if (!s.workplace_id) {
        noWp.push(s);
        continue;
      }
      if (!byWp.has(s.workplace_id)) {
        const wp = wpLookup.get(s.workplace_id);
        byWp.set(s.workplace_id, {
          name: s.workplace_name || wp?.name || '(Đã xoá)',
          schedules: [],
          isOffice: wp?.is_office_hours ?? false,
        });
      }
      byWp.get(s.workplace_id)!.schedules.push(s);
    }

    const officeGroups: { name: string; schedules: Schedule[] }[] = [];
    const nonOfficeGroups: { name: string; schedules: Schedule[] }[] = [];
    for (const [, group] of byWp) {
      if (group.isOffice) {
        officeGroups.push(group);
      } else {
        nonOfficeGroups.push(group);
      }
    }

    const renderSchedulesList = (scheduleList: Schedule[]) =>
      scheduleList.map((s) => {
        const isPast = dayjs(s.date).isBefore(dayjs(), 'day');
        return (
          <div
            key={s.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 0',
              borderBottom: '1px solid #f5f5f5',
              opacity: s.status === SCHEDULE_STATUS.CANCELLED ? 0.45 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag color={STATUS_COLORS[s.status] || 'default'} style={{ margin: 0, fontSize: 10 }}>
                {STATUS_TAG_LABELS[s.status] || s.status}
              </Tag>
              <Tag color={s.status === SCHEDULE_STATUS.CANCELLED ? 'default' : (s.shift_color || 'blue')} style={{ margin: 0, textDecoration: s.status === SCHEDULE_STATUS.CANCELLED ? 'line-through' : 'none' }}>
                {s.shift_name}
              </Tag>
              <Typography.Text strong style={{ textDecoration: s.status === SCHEDULE_STATUS.CANCELLED ? 'line-through' : 'none' }}>
                {s.employee_name}
              </Typography.Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, textDecoration: s.status === SCHEDULE_STATUS.CANCELLED ? 'line-through' : 'none' }}>
                {getShiftTime(s.shift_template_id, shiftTemplates)}
              </Typography.Text>
              {!isPast && s.status !== SCHEDULE_STATUS.CANCELLED && s.status !== SCHEDULE_STATUS.APPROVED && s.status !== SCHEDULE_STATUS.CONFIRMED && (
                <>
                  {s.status === SCHEDULE_STATUS.REJECTED && (
                    <Button type="text" size="small" icon={<CheckCircleOutlined />} onClick={() => onSubmit(s.id)} />
                  )}
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(s)} />
                  <Popconfirm
                    title="Xoá lịch trực này?"
                    onConfirm={() => onDelete(s.id)}
                    okText="Xoá"
                    cancelText="Huỷ"
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </>
              )}
            </div>
          </div>
        );
      });

    const renderGroupSection = (groups: { name: string; schedules: Schedule[] }[], label: string) =>
      groups.length > 0 ? (
        <>
          {officeGroups.length > 0 && nonOfficeGroups.length > 0 && (
            <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#64748b' }}>
              {label}
            </Typography.Text>
          )}
          {groups.map((g) => (
            <Card key={g.name} size="small" title={g.name} style={{ marginBottom: 12 }}>
              {renderSchedulesList(g.schedules)}
            </Card>
          ))}
        </>
      ) : null;

    return (
      <>
        {renderGroupSection(nonOfficeGroups, 'Trực ca')}
        {renderGroupSection(officeGroups, 'Văn phòng')}
        {noWp.length > 0 && (
          <Card size="small" title="Khác" style={{ marginBottom: 12 }}>
            {renderSchedulesList(noWp)}
          </Card>
        )}
      </>
    );
  })();

  return (
    <Modal
      title={`Lịch trực - ${dayjs(selectedDate).format(DATE_FORMATS.DISPLAY_DATE)}`}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={550}
    >
      {scheduleContent}

      {!showForm && !dayjs(selectedDate).isBefore(dayjs(), 'day') && (
        <>
          <Divider />
          <Tooltip title="Alt+N">
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={onAdd}
              block
            >
              Thêm ca trực
            </Button>
          </Tooltip>
        </>
      )}

      {showForm && !dayjs(selectedDate).isBefore(dayjs(), 'day') && (
        <ScheduleForm
          form={form}
          editingSchedule={editingSchedule}
          employees={employees}
          shiftTemplates={shiftTemplates}
          workplaces={workplaces}
          selectedWorkplaceId={selectedWorkplaceId}
          onSubmit={onFormSubmit}
          onCancel={onCancelForm}
        />
      )}
    </Modal>
  );
}
