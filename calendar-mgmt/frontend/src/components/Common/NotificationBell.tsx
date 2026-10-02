import { useEffect, useState, useRef, useCallback } from 'react';
import { Badge, Popover, List, Typography, Button, Empty, Space } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { notificationService } from '@/services/notificationService';
import type { Notification } from '@/types/notification';
import dayjs from 'dayjs';

const POLL_INTERVAL = 30000;

const typeColors: Record<string, string> = {
  schedule_created: '#1890ff',
  schedule_updated: '#faad14',
  schedule_cancelled: '#ff4d4f',
  schedule_approved: '#52c41a',
  schedule_rejected: '#ff4d4f',
};

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    if (!user?.employee_id) return;
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // silent
    }
  }, [user?.employee_id]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await notificationService.list();
      setNotifications(data);
      setUnreadCount(data.length);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user?.employee_id]);

  useEffect(() => {
    if (!user?.employee_id) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }
    fetchCount();
    intervalRef.current = setInterval(fetchCount, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.employee_id, fetchCount]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setUnreadCount(0);
      setNotifications([]);
    } catch {
      // silent
    }
  };

  const renderNotificationItem = (item: Notification) => {
    const dotColor = typeColors[item.type] || '#1890ff';
    return (
      <List.Item style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, marginTop: 6, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text strong style={{ fontSize: 13, display: 'block', lineHeight: 1.3 }}>
              {item.title}
            </Typography.Text>
            <Typography.Text style={{ fontSize: 12, color: '#666', display: 'block', marginTop: 2 }}>
              {item.message}
            </Typography.Text>
            {item.created_at && (
              <Typography.Text style={{ fontSize: 11, color: '#999', display: 'block', marginTop: 4 }}>
                {dayjs(item.created_at).format('DD/MM HH:mm')}
              </Typography.Text>
            )}
          </div>
        </div>
      </List.Item>
    );
  };

  const content = (
    <div style={{ width: 360, maxHeight: 400, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
        <Typography.Text strong style={{ fontSize: 14, color: '#1e293b' }}>Thông báo</Typography.Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleMarkAllRead}>
            Đã đọc tất cả
          </Button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div style={{ padding: '40px 0' }}>
          <Empty description="Không có thông báo" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div style={{ overflow: 'auto', flex: 1 }}>
          <List dataSource={notifications} renderItem={renderNotificationItem} />
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        .glass-popover .ant-popover-inner {
          background: transparent !important;
          border-radius: 16px !important;
          padding: 0 !important;
        }
        .glass-popover .ant-popover-arrow::before {
          background: rgba(255,255,255,0.35) !important;
          backdrop-filter: blur(32px) saturate(180%);
        }
        .glass-popover .ant-popover-content {
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 12px 48px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.6);
        }
      `}</style>
      <Popover
        content={content}
        trigger="click"
        open={open}
        onOpenChange={handleOpenChange}
        placement="bottomRight"
        overlayClassName="glass-popover"
        overlayStyle={{
          paddingTop: 4,
          background: 'rgba(255,255,255,0.35)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <Button
            type="text"
            icon={<BellOutlined style={{ fontSize: 18, color: '#475569' }} />}
            style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          />
        </Badge>
      </Popover>
    </>
  );
}
