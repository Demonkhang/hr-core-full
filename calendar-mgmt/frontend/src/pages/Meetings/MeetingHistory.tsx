import { useEffect, useState, useMemo } from 'react';
import { Table, Tag, message, Typography, Space, Tooltip, Modal, Descriptions, Button } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { meetingScheduleService } from '@/services/meetingScheduleService';
import type { MeetingSchedule, MeetingParticipant } from '@/types/meetingSchedule';
import {
  MEETING_TYPE_LABELS, MEETING_TYPE_COLORS,
  MEETING_STATUS_LABELS, MEETING_STATUS_COLORS,
} from '@/utils/constants';
import { useAuthStore } from '@/store/authStore';

export function MeetingHistory() {
  const [meetings, setMeetings] = useState<MeetingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState<MeetingSchedule | null>(null);
  const user = useAuthStore((s) => s.user);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {
        date_to: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
      };
      const canManage = user?.is_super_admin || user?.permissions?.can_manage_meetings;
      if (!canManage && user?.employee_id) {
        params.employee_id = user.employee_id;
      }
      const data = await meetingScheduleService.getAll(params);
      setMeetings(data);
    } catch {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const showDetail = (record: MeetingSchedule) => {
    setDetailMeeting(record);
    setDetailOpen(true);
  };

  const columns = useMemo(() => [
    { title: 'Ngày', dataIndex: 'date', key: 'date', width: 110,
      sorter: (a: MeetingSchedule, b: MeetingSchedule) => (a.date || '').localeCompare(b.date || ''),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    { title: 'Giờ', dataIndex: 'start_time', key: 'time', width: 100,
      render: (val: string) => val ? val.substring(0, 5) : '-',
    },
    { title: 'Tiêu đề', dataIndex: 'title', key: 'title', width: 180, ellipsis: true,
      sorter: (a: MeetingSchedule, b: MeetingSchedule) => (a.title || '').localeCompare(b.title || ''),
    },
    { title: 'Loại', dataIndex: 'meeting_type', key: 'meeting_type', width: 130,
      filters: Object.entries(MEETING_TYPE_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value: any, record: MeetingSchedule) => record.meeting_type === value,
      render: (v: string) => <Tag color={MEETING_TYPE_COLORS[v]}>{MEETING_TYPE_LABELS[v] || v}</Tag>,
    },
    { title: 'Địa điểm', dataIndex: 'location', key: 'location', width: 120, ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 100,
      filters: Object.entries(MEETING_STATUS_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value: any, record: MeetingSchedule) => record.status === value,
      render: (v: string) => <Tag color={MEETING_STATUS_COLORS[v]}>{MEETING_STATUS_LABELS[v] || v}</Tag>,
    },
    { title: '', key: 'actions', width: 50,
      render: (_: any, record: MeetingSchedule) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)} />
      ),
    },
  ], []);

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>Lịch sử lịch họp</Typography.Title>
      <Table dataSource={meetings} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} scroll={{ x: 900 }} />

      <Modal
        title="Chi tiết lịch họp"
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetailMeeting(null); }}
        footer={null}
        width={600}
      >
        {detailMeeting && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Tiêu đề">{detailMeeting.title}</Descriptions.Item>
            <Descriptions.Item label="Loại họp">
              <Tag color={MEETING_TYPE_COLORS[detailMeeting.meeting_type]}>{MEETING_TYPE_LABELS[detailMeeting.meeting_type]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày">{detailMeeting.date ? dayjs(detailMeeting.date).format('DD/MM/YYYY') : '-'}</Descriptions.Item>
            <Descriptions.Item label="Giờ">{detailMeeting.start_time?.substring(0, 5) || '-'}</Descriptions.Item>
            <Descriptions.Item label="Địa điểm">{detailMeeting.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="Mô tả">{detailMeeting.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="Phòng ban">{detailMeeting.department_name || 'Tất cả'}</Descriptions.Item>
            <Descriptions.Item label="Người tạo">{detailMeeting.created_by_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={MEETING_STATUS_COLORS[detailMeeting.status]}>{MEETING_STATUS_LABELS[detailMeeting.status]}</Tag>
            </Descriptions.Item>
            {detailMeeting.approved_by_name && (
              <Descriptions.Item label="Duyệt bởi">{detailMeeting.approved_by_name}</Descriptions.Item>
            )}
            {detailMeeting.rejection_reason && (
              <Descriptions.Item label="Lý do từ chối">{detailMeeting.rejection_reason}</Descriptions.Item>
            )}
            <Descriptions.Item label={`Tham gia (${detailMeeting.participants?.length || 0})`}>
              {detailMeeting.participants && detailMeeting.participants.length > 0 ? (
                <Space wrap>
                  {detailMeeting.participants.map((p: MeetingParticipant) => (
                    <Tag key={p.id} color="blue">{p.employee_name || 'Unknown'}</Tag>
                  ))}
                </Space>
              ) : (
                <span style={{ color: '#999' }}>Chưa có người tham gia</span>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
