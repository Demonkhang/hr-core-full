import { useState, useMemo } from 'react';
import { Card, Button, Select, Tooltip, Modal, Tag, Typography, Badge, Space, Segmented } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  CoffeeOutlined,
  TeamOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Schedule, ShiftTemplate } from '@/types/schedule';
import type { MeetingSchedule, MeetingParticipant } from '@/types/meetingSchedule';
import type { Employee } from '@/types/employee';
import { SCHEDULE_STATUS_LABELS, STATUS_COLORS } from '@/utils/constants';

interface PersonalTimelineCalendarProps {
  employee: Employee;
  schedules: Schedule[];
  meetings?: MeetingSchedule[];
  shiftTemplates?: ShiftTemplate[];
  onDateChange?: (date: string) => void;
  onRefresh?: () => void;
}

const START_HOUR = 6;   // 06:00
const END_HOUR = 22;     // 22:00
const TOTAL_HOURS = END_HOUR - START_HOUR; // 16 hours
const ROW_HEIGHT = 58;   // px per hour row

export interface VisualShiftCard {
  id: string;
  scheduleId: string;
  originalSchedule: Schedule;
  title: string;
  shiftTemplateId?: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  startMinutes: number;
  endMinutes: number;
  hours: number;
  workplaceName?: string | null;
  departmentName?: string | null;
  isOvertime: boolean;
  color: string;
  gradient: string;
  status: string;
}

export interface DynamicDayBreak {
  startMinutes: number;
  endMinutes: number;
  startTimeStr: string;
  endTimeStr: string;
}

function parseTimeToMinutes(t?: string | null, fallbackMinutes: number = 0): number {
  if (!t) return fallbackMinutes;
  const parts = t.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  return h * 60 + m;
}

function minutesToTimeString(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

export function PersonalTimelineCalendar({
  employee,
  schedules,
  meetings = [],
  shiftTemplates = [],
  onRefresh,
}: PersonalTimelineCalendarProps) {
  const [currentDate, setCurrentDate] = useState<dayjs.Dayjs>(dayjs());
  const [viewMode, setViewMode] = useState<'week' | 'day' | 'month'>('week');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<{
    type: 'shift' | 'meeting';
    data: any;
  } | null>(null);

  // Calculate week start (Monday) and week end (Sunday)
  const dayOfWeek = currentDate.day();
  const weekStart = dayOfWeek === 0 ? currentDate.subtract(6, 'day').startOf('day') : currentDate.subtract(dayOfWeek - 1, 'day').startOf('day');
  const weekEnd = weekStart.add(6, 'day').endOf('day');

  // Days in week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
  }, [weekStart]);

  const handlePrev = () => {
    if (viewMode === 'week') setCurrentDate((d) => d.subtract(1, 'week'));
    else if (viewMode === 'day') setCurrentDate((d) => d.subtract(1, 'day'));
    else setCurrentDate((d) => d.subtract(1, 'month'));
  };

  const handleNext = () => {
    if (viewMode === 'week') setCurrentDate((d) => d.add(1, 'week'));
    else if (viewMode === 'day') setCurrentDate((d) => d.add(1, 'day'));
    else setCurrentDate((d) => d.add(1, 'month'));
  };

  const handleToday = () => {
    setCurrentDate(dayjs());
  };

  // Format date range for header e.g. "19 - 25 Tháng 10, 2026"
  const dateRangeDisplay = useMemo(() => {
    if (viewMode === 'week') {
      const isSameMonth = weekStart.month() === weekEnd.month();
      const isSameYear = weekStart.year() === weekEnd.year();
      if (isSameMonth && isSameYear) {
        return `${weekStart.format('DD')} - ${weekEnd.format('DD')} Tháng ${weekStart.format('MM, YYYY')}`;
      }
      return `${weekStart.format('DD/MM')} - ${weekEnd.format('DD/MM/YYYY')}`;
    } else if (viewMode === 'day') {
      return currentDate.format('dddd, DD/MM/YYYY');
    } else {
      return `Tháng ${currentDate.format('MM/YYYY')}`;
    }
  }, [viewMode, weekStart, weekEnd, currentDate]);

  // Current time position indicator
  const now = dayjs();
  const isCurrentWeek = now.isAfter(weekStart) && now.isBefore(weekEnd.add(1, 'day'));
  const currentMinutes = now.hour() * 60 + now.minute();
  const showCurrentTimeLine = currentMinutes >= START_HOUR * 60 && currentMinutes <= END_HOUR * 60;
  const currentTimeTop = ((currentMinutes - START_HOUR * 60) / (TOTAL_HOURS * 60)) * (TOTAL_HOURS * ROW_HEIGHT);

  // Filter schedules and meetings for active week
  const weekSchedules = useMemo(() => {
    const startStr = weekStart.format('YYYY-MM-DD');
    const endStr = weekEnd.format('YYYY-MM-DD');
    return schedules.filter((s) => s.date >= startStr && s.date <= endStr && s.status !== 'cancelled');
  }, [schedules, weekStart, weekEnd]);

  const weekMeetings = useMemo(() => {
    const startStr = weekStart.format('YYYY-MM-DD');
    const endStr = weekEnd.format('YYYY-MM-DD');
    return meetings.filter((m) => m.date >= startStr && m.date <= endStr && m.status !== 'cancelled');
  }, [meetings, weekStart, weekEnd]);

  // 1. Transform raw schedules dynamically based on shift templates from database
  const { dayShiftCardsMap, dayBreaksMap, activeShiftTypesInWeek } = useMemo(() => {
    const cardsMap = new Map<string, VisualShiftCard[]>();
    const breaksMap = new Map<string, DynamicDayBreak[]>();
    const shiftTypesSet = new Map<string, { id: string; name: string; color: string; timeStr: string }>();

    for (const d of weekDays) {
      const dateStr = d.format('YYYY-MM-DD');
      const dayRawSchedules = weekSchedules.filter((s) => s.date === dateStr);
      const cards: VisualShiftCard[] = [];

      for (const s of dayRawSchedules) {
        const st = shiftTemplates.find((t) => t.id === s.shift_template_id);
        const shiftTitle = s.shift_name || st?.name || 'Ca trực';
        const shiftColor = s.shift_color || st?.color || '#2563eb';

        // Start and End times directly from schedule or template configuration
        let startMin = parseTimeToMinutes(
          s.actual_start_time || s.shift_start_time || st?.start_time,
          7 * 60 + 30
        );
        let endMin = parseTimeToMinutes(
          s.actual_end_time || s.shift_end_time || st?.end_time,
          17 * 60
        );

        if (endMin <= startMin) endMin += 24 * 60; // Overnight shift

        // Check if full-day overtime or old schedule spanned across lunch for office shifts
        const isOfficeShift = shiftTitle.toLowerCase().includes('hành chính') || shiftTitle.toLowerCase().includes('sáng');
        if (isOfficeShift && startMin <= 8 * 60 && endMin >= 17 * 60) {
          // Gracefully split into morning (start -> 12:00) and afternoon (13:00 -> end)
          const mEnd = 12 * 60;
          cards.push({
            id: `${s.id}-morning-split`,
            scheduleId: s.id,
            shiftTemplateId: s.shift_template_id,
            originalSchedule: s,
            title: 'Hành chính sáng',
            startTime: minutesToTimeString(startMin),
            endTime: '12:00',
            startMinutes: startMin,
            endMinutes: mEnd,
            hours: Math.round(((mEnd - startMin) / 60) * 10) / 10,
            workplaceName: s.workplace_name,
            departmentName: s.department_name,
            isOvertime: s.is_overtime,
            color: s.is_overtime ? '#ea580c' : shiftColor,
            gradient: s.is_overtime
              ? 'linear-gradient(135deg, #c2410c 0%, #ea580c 50%, #f97316 100%)'
              : `linear-gradient(135deg, ${shiftColor} 0%, #3b82f6 100%)`,
            status: s.status,
          });

          const aftEnd = Math.min(endMin, 17 * 60);
          cards.push({
            id: `${s.id}-afternoon-split`,
            scheduleId: s.id,
            shiftTemplateId: s.shift_template_id,
            originalSchedule: s,
            title: s.is_overtime ? 'Hành chính chiều (Tăng ca)' : 'Hành chính chiều',
            startTime: '13:00',
            endTime: minutesToTimeString(aftEnd),
            startMinutes: 13 * 60,
            endMinutes: aftEnd,
            hours: Math.round(((aftEnd - 13 * 60) / 60) * 10) / 10,
            workplaceName: s.workplace_name,
            departmentName: s.department_name,
            isOvertime: s.is_overtime,
            color: s.is_overtime ? '#ea580c' : '#16a34a',
            gradient: s.is_overtime
              ? 'linear-gradient(135deg, #c2410c 0%, #ea580c 50%, #f97316 100%)'
              : 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
            status: s.status,
          });

          if (endMin > 17 * 60) {
            cards.push({
              id: `${s.id}-ot-split`,
              scheduleId: s.id,
              shiftTemplateId: s.shift_template_id,
              originalSchedule: s,
              title: 'Tăng ca ngoài giờ',
              startTime: '17:00',
              endTime: minutesToTimeString(endMin),
              startMinutes: 17 * 60,
              endMinutes: endMin,
              hours: Math.round(((endMin - 17 * 60) / 60) * 10) / 10,
              workplaceName: s.workplace_name,
              departmentName: s.department_name,
              isOvertime: true,
              color: '#ea580c',
              gradient: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)',
              status: s.status,
            });
          }
          continue;
        }

        // Standard dynamic shift according to template configuration
        const durationMin = endMin - startMin;
        const isOt = Boolean(s.is_overtime);
        cards.push({
          id: s.id,
          scheduleId: s.id,
          shiftTemplateId: s.shift_template_id,
          originalSchedule: s,
          title: isOt ? `${shiftTitle} (Tăng ca)` : shiftTitle,
          startTime: minutesToTimeString(startMin),
          endTime: minutesToTimeString(endMin),
          startMinutes: startMin,
          endMinutes: endMin,
          hours: Math.round((durationMin / 60) * 10) / 10,
          workplaceName: s.workplace_name,
          departmentName: s.department_name,
          isOvertime: isOt,
          color: isOt ? '#ea580c' : shiftColor,
          gradient: isOt
            ? 'linear-gradient(135deg, #c2410c 0%, #ea580c 50%, #f97316 100%)'
            : `linear-gradient(135deg, ${shiftColor} 0%, ${shiftColor}dd 100%)`,
          status: s.status,
        });

        if (s.shift_template_id && !shiftTypesSet.has(s.shift_template_id)) {
          shiftTypesSet.set(s.shift_template_id, {
            id: s.shift_template_id,
            name: shiftTitle,
            color: shiftColor,
            timeStr: `${minutesToTimeString(startMin)} - ${minutesToTimeString(endMin)}`,
          });
        }
      }

      // 2. Dynamic Break Detection: Detect gap between shifts on the same day
      const dayBreaks: DynamicDayBreak[] = [];
      const nonOtCards = cards.filter((c) => !c.isOvertime).sort((a, b) => a.startMinutes - b.startMinutes);

      for (let i = 0; i < nonOtCards.length - 1; i++) {
        const currentEnd = nonOtCards[i].endMinutes;
        const nextStart = nonOtCards[i + 1].startMinutes;
        if (nextStart > currentEnd && nextStart - currentEnd >= 30) {
          // Real break between shifts! (e.g. 12:00 - 13:00)
          dayBreaks.push({
            startMinutes: currentEnd,
            endMinutes: nextStart,
            startTimeStr: minutesToTimeString(currentEnd),
            endTimeStr: minutesToTimeString(nextStart),
          });
        }
      }

      cardsMap.set(dateStr, cards);
      breaksMap.set(dateStr, dayBreaks);
    }

    return {
      dayShiftCardsMap: cardsMap,
      dayBreaksMap: breaksMap,
      activeShiftTypesInWeek: Array.from(shiftTypesSet.values()),
    };
  }, [weekDays, weekSchedules, shiftTemplates]);

  // Helper to calculate top and height in px
  const getEventPositionStyle = (startMinutes: number, endMinutes: number) => {
    const clampedStart = Math.max(startMinutes, START_HOUR * 60);
    const clampedEnd = Math.min(endMinutes, END_HOUR * 60);

    const top = ((clampedStart - START_HOUR * 60) / (TOTAL_HOURS * 60)) * (TOTAL_HOURS * ROW_HEIGHT);
    const durationMin = Math.max(clampedEnd - clampedStart, 30);
    const height = Math.max((durationMin / (TOTAL_HOURS * 60)) * (TOTAL_HOURS * ROW_HEIGHT), 34);

    return { top, height };
  };

  // Filter options for top segmented control
  const filterOptions = useMemo(() => {
    const opts = [{ label: 'Tất cả', value: 'all' }];
    for (const st of activeShiftTypesInWeek) {
      opts.push({ label: `${st.name}`, value: `shift-${st.id}` });
    }
    opts.push({ label: '📅 Lịch họp', value: 'meetings' });
    opts.push({ label: '⚡ Tăng ca', value: 'overtime' });
    return opts;
  }, [activeShiftTypesInWeek]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid #f0f2f5',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>
            Timeline
          </Typography.Title>
          <Tag color="blue" style={{ fontSize: 13, padding: '3px 10px', borderRadius: 6, margin: 0, fontWeight: 600 }}>
            {employee.full_name}
          </Tag>
          {employee.department_name && (
            <span style={{ fontSize: 13, color: '#64748b' }}>• {employee.department_name}</span>
          )}

          {/* Dynamic Filter Segmented Control */}
          <Segmented
            value={activeFilter}
            onChange={(val) => setActiveFilter(val as string)}
            options={filterOptions}
            style={{ background: '#f1f5f9', fontWeight: 500 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Select
            value={viewMode}
            onChange={setViewMode}
            size="middle"
            style={{ width: 110 }}
            options={[
              { value: 'week', label: 'Week' },
              { value: 'day', label: 'Day' },
              { value: 'month', label: 'Month' },
            ]}
          />

          <Typography.Text strong style={{ fontSize: 14, color: '#334155', minWidth: 160, textAlign: 'center' }}>
            {dateRangeDisplay}
          </Typography.Text>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#3b82f6',
              borderRadius: 20,
              padding: '2px 4px',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<LeftOutlined style={{ color: '#fff', fontSize: 11 }} />}
              onClick={handlePrev}
              style={{ width: 28, height: 26, padding: 0 }}
            />
            <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 2px' }}>|</span>
            <Button
              type="text"
              size="small"
              icon={<RightOutlined style={{ color: '#fff', fontSize: 11 }} />}
              onClick={handleNext}
              style={{ width: 28, height: 26, padding: 0 }}
            />
          </div>

          <Button size="small" onClick={handleToday} style={{ borderRadius: 6 }}>
            Hôm nay
          </Button>
        </div>
      </div>

      {/* Dynamic Legend Bar: "có chú thích rõ ràng" */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 20px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          flexWrap: 'wrap',
          fontSize: 12,
        }}
      >
        <span style={{ fontWeight: 700, color: '#64748b' }}>Chú thích:</span>

        {/* Dynamic shifts configured in templates */}
        {activeShiftTypesInWeek.map((st) => (
          <div key={st.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: 3,
                background: st.color,
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }}
            />
            <span style={{ fontWeight: 600, color: '#334155' }}>
              {st.name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({st.timeStr})</span>
            </span>
          </div>
        ))}

        {/* Dynamic Break indicator */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 12,
              borderRadius: 3,
              background: 'repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 3px, #e2e8f0 3px, #e2e8f0 6px)',
              border: '1px dashed #cbd5e1',
            }}
          />
          <span style={{ fontWeight: 600, color: '#64748b' }}>☕ Nghỉ giữa ca</span>
        </div>

        {/* Meeting indicator (Emerald Green) */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              boxShadow: '0 1px 2px rgba(16,185,129,0.3)',
            }}
          />
          <span style={{ fontWeight: 700, color: '#047857' }}>📅 Lịch họp / Sự kiện</span>
        </div>

        {/* Overtime indicator */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: 3,
              background: '#ea580c',
            }}
          />
          <span style={{ fontWeight: 700, color: '#c2410c' }}>⚡ Tăng ca (TC)</span>
        </div>
      </div>

      {/* Main Grid View */}
      {viewMode === 'week' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Day Headers (7 days) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '74px repeat(7, 1fr)',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            <div style={{ padding: '10px 6px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#94a3b8', borderRight: '1px solid #f1f5f9' }}>
              Giờ
            </div>
            {weekDays.map((d) => {
              const isToday = d.isSame(now, 'day');
              const dayName = d.format('ddd').toUpperCase();
              const dayNum = d.format('DD');
              const dateStr = d.format('YYYY-MM-DD');
              const cards = dayShiftCardsMap.get(dateStr) || [];
              const dayMts = weekMeetings.filter((m) => m.date === dateStr);

              return (
                <div
                  key={d.toISOString()}
                  style={{
                    padding: '8px 4px 6px 4px',
                    textAlign: 'center',
                    borderRight: '1px solid #f1f5f9',
                    background: isToday ? '#eff6ff' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? '#2563eb' : '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {dayName}
                  </div>
                  <div
                    style={{
                      display: 'inline-block',
                      width: 28,
                      height: 28,
                      lineHeight: '28px',
                      borderRadius: '50%',
                      background: isToday ? '#2563eb' : 'transparent',
                      color: isToday ? '#fff' : '#1e293b',
                      fontSize: 14,
                      fontWeight: isToday ? 700 : 600,
                      marginTop: 2,
                    }}
                  >
                    {dayNum}
                  </div>

                  {/* Summary tags for this day */}
                  <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {cards.slice(0, 2).map((c) => (
                      <span
                        key={c.id}
                        style={{
                          fontSize: 9,
                          background: `${c.color}20`,
                          color: c.color,
                          border: `1px solid ${c.color}50`,
                          padding: '0 4px',
                          borderRadius: 3,
                          fontWeight: 700,
                          maxWidth: 70,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {c.title}
                      </span>
                    ))}
                    {dayMts.length > 0 && (
                      <span style={{ fontSize: 9, background: '#dcfce7', color: '#15803d', padding: '0 4px', borderRadius: 3, fontWeight: 700 }}>
                        📅 {dayMts.length} họp
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timeline Grid Body */}
          <div style={{ position: 'relative', minHeight: TOTAL_HOURS * ROW_HEIGHT, display: 'grid', gridTemplateColumns: '74px repeat(7, 1fr)' }}>
            {/* Time Labels Column */}
            <div style={{ borderRight: '1px solid #f1f5f9', background: '#fafafa' }}>
              {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                const hour = START_HOUR + i;
                const formattedHour = hour >= 12 ? (hour === 12 ? '12 PM' : `${hour - 12} PM`) : `${hour} AM`;

                return (
                  <div
                    key={hour}
                    style={{
                      height: ROW_HEIGHT,
                      padding: '4px 6px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#94a3b8',
                      textAlign: 'right',
                      borderBottom: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-end',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span>{formattedHour}</span>
                  </div>
                );
              })}
            </div>

            {/* Current Time Badge & Dotted Line indicator */}
            {isCurrentWeek && showCurrentTimeLine && (
              <div
                style={{
                  position: 'absolute',
                  top: currentTimeTop,
                  left: 0,
                  right: 0,
                  zIndex: 8,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 4,
                    top: -10,
                    background: '#2563eb',
                    color: '#fff',
                    borderRadius: 12,
                    padding: '1px 7px',
                    fontSize: 11,
                    fontWeight: 700,
                    boxShadow: '0 2px 4px rgba(37,99,235,0.3)',
                  }}
                >
                  {now.format('HH:mm')}
                </div>
                <div
                  style={{
                    marginLeft: 68,
                    borderTop: '2px dotted #3b82f6',
                    width: 'calc(100% - 68px)',
                  }}
                />
              </div>
            )}

            {/* 7 Columns for Days */}
            {weekDays.map((d) => {
              const dateStr = d.format('YYYY-MM-DD');
              const isToday = d.isSame(now, 'day');
              const allDayCards = dayShiftCardsMap.get(dateStr) || [];
              const dayBreaks = dayBreaksMap.get(dateStr) || [];

              // Apply active filter
              const filteredCards = allDayCards.filter((c) => {
                if (activeFilter === 'meetings') return false; // meetings only
                if (activeFilter === 'overtime') return c.isOvertime;
                if (activeFilter.startsWith('shift-')) {
                  const targetTemplateId = activeFilter.replace('shift-', '');
                  return c.shiftTemplateId === targetTemplateId;
                }
                return true;
              });

              const dayMeetings = weekMeetings.filter((m) => m.date === dateStr);
              const showMeetings = activeFilter === 'all' || activeFilter === 'meetings';

              return (
                <div
                  key={dateStr}
                  style={{
                    position: 'relative',
                    height: TOTAL_HOURS * ROW_HEIGHT,
                    borderRight: '1px solid #f1f5f9',
                    background: isToday ? 'rgba(239, 246, 255, 0.25)' : '#ffffff',
                  }}
                >
                  {/* Grid background lines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        height: ROW_HEIGHT,
                        borderBottom: '1px solid #f8fafc',
                      }}
                    />
                  ))}

                  {/* DYNAMIC BREAK BANDS: Only rendered if this day actually has a gap between shifts! */}
                  {dayBreaks.map((brk, idx) => {
                    const { top, height } = getEventPositionStyle(brk.startMinutes, brk.endMinutes);
                    return (
                      <div
                        key={idx}
                        style={{
                          position: 'absolute',
                          top: `${top}px`,
                          height: `${height}px`,
                          left: 0,
                          right: 0,
                          background: 'repeating-linear-gradient(45deg, #f8fafc, #f8fafc 8px, #f1f5f9 8px, #f1f5f9 16px)',
                          borderTop: '1.5px dashed #cbd5e1',
                          borderBottom: '1.5px dashed #cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2,
                          pointerEvents: 'none',
                        }}
                      >
                        <div
                          style={{
                            background: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #e2e8f0',
                            borderRadius: 12,
                            padding: '1px 8px',
                            color: '#64748b',
                            fontSize: 10,
                            fontWeight: 600,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>☕ Nghỉ giữa ca • {brk.startTimeStr} - {brk.endTimeStr}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Dynamic Shift Cards */}
                  {filteredCards.map((card) => {
                    const { top, height } = getEventPositionStyle(card.startMinutes, card.endMinutes);

                    return (
                      <div
                        key={card.id}
                        onClick={() => setSelectedEvent({ type: 'shift', data: card })}
                        style={{
                          position: 'absolute',
                          top: `${top}px`,
                          height: `${height}px`,
                          left: 4,
                          right: 4,
                          background: card.gradient,
                          borderRadius: 8,
                          padding: '6px 8px',
                          color: '#ffffff',
                          boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          zIndex: 4,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.12)';
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {card.title}
                            </span>
                            {card.isOvertime && (
                              <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 3, padding: '0 4px', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                                TC
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.95)', marginTop: 2 }}>
                            {card.startTime} - {card.endTime}
                            <span style={{ fontSize: 10, opacity: 0.85, marginLeft: 4 }}>({card.hours}h)</span>
                          </div>
                        </div>

                        {card.workplaceName && height > 50 && (
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 4 }}>
                            📍 {card.workplaceName}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* MEETING CARDS: Floating on timeline with Emerald Green styling */}
                  {showMeetings &&
                    dayMeetings.map((m) => {
                      const startMin = parseTimeToMinutes(m.start_time, 9 * 60);
                      const endMin = parseTimeToMinutes((m as any).end_time, startMin + 60);
                      const { top, height } = getEventPositionStyle(startMin, endMin);

                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelectedEvent({ type: 'meeting', data: m })}
                          style={{
                            position: 'absolute',
                            top: `${top}px`,
                            height: `${height}px`,
                            left: 8,
                            right: 8,
                            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                            borderRadius: 8,
                            padding: '6px 8px',
                            color: '#ffffff',
                            border: '1.5px solid #ffffff',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            zIndex: 6, // Above shifts
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 6px 18px rgba(16, 185, 129, 0.45)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.35)';
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <span style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                📅 {m.title}
                              </span>
                              <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 4, padding: '0 4px', fontSize: 9, fontWeight: 700 }}>
                                Họp
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.92)', marginTop: 2, fontWeight: 600 }}>
                              {m.start_time?.slice(0, 5)} - {minutesToTimeString(endMin)}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                            {m.location && (
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                                📍 {m.location}
                              </span>
                            )}
                            <span>👥 {m.participants?.length || 0}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day Mode */}
      {viewMode === 'day' && (
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          <Typography.Title level={5}>Lịch ngày {currentDate.format('DD/MM/YYYY')}</Typography.Title>
          {(() => {
            const dateStr = currentDate.format('YYYY-MM-DD');
            const cards = dayShiftCardsMap.get(dateStr) || [];
            const dayMts = weekMeetings.filter((m) => m.date === dateStr);

            if (cards.length === 0 && dayMts.length === 0) {
              return <div style={{ color: '#94a3b8', padding: '20px 0' }}>Không có ca trực hoặc cuộc họp nào trong ngày này.</div>;
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Meetings */}
                {dayMts.map((m) => (
                  <Card key={m.id} size="small" style={{ borderLeft: '5px solid #10b981', background: '#f0fdf4', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <Space direction="vertical" size={2}>
                      <Space>
                        <Tag color="green">📅 Cuộc họp</Tag>
                        <Typography.Text strong style={{ fontSize: 15 }}>{m.title}</Typography.Text>
                        <Tag color="cyan">{m.meeting_type}</Tag>
                      </Space>
                      <div>⏰ Giờ họp: {m.start_time?.slice(0, 5)}</div>
                      <div>📍 Địa điểm: {m.location || 'Chưa có địa điểm'}</div>
                      <div>👥 Người tham gia: {m.participants?.length || 0} người</div>
                    </Space>
                  </Card>
                ))}

                {/* Shifts */}
                {cards.map((c) => (
                  <Card key={c.id} size="small" style={{ borderLeft: `5px solid ${c.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <Space direction="vertical" size={2}>
                      <Space>
                        <Typography.Text strong style={{ fontSize: 15 }}>{c.title}</Typography.Text>
                        {c.isOvertime && <Tag color="orange">Tăng ca</Tag>}
                        <Tag color={STATUS_COLORS[c.status] || 'default'}>{SCHEDULE_STATUS_LABELS[c.status] || c.status}</Tag>
                      </Space>
                      <div>⏰ Giờ trực: {c.startTime} - {c.endTime} ({c.hours} giờ)</div>
                      <div>📍 Nơi làm việc: {c.workplaceName || '-'}</div>
                      {c.originalSchedule.notes && <div>📝 Ghi chú: {c.originalSchedule.notes}</div>}
                    </Space>
                  </Card>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Month Mode */}
      {viewMode === 'month' && (
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d) => (
              <div key={d} style={{ fontWeight: 700, textAlign: 'center', color: '#64748b', paddingBottom: 6 }}>{d}</div>
            ))}
            {Array.from({ length: currentDate.daysInMonth() }, (_, i) => {
              const d = currentDate.date(i + 1);
              const dateStr = d.format('YYYY-MM-DD');
              const dayCards = dayShiftCardsMap.get(dateStr) || [];
              const dayMts = weekMeetings.filter((m) => m.date === dateStr);

              return (
                <div
                  key={i}
                  style={{
                    border: '1px solid #f1f5f9',
                    borderRadius: 8,
                    padding: 8,
                    minHeight: 80,
                    background: d.isSame(now, 'day') ? '#eff6ff' : '#fff',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 12, color: d.isSame(now, 'day') ? '#2563eb' : '#334155' }}>
                    {i + 1}
                  </div>
                  {dayCards.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedEvent({ type: 'shift', data: c })}
                      style={{
                        fontSize: 10,
                        background: c.color,
                        color: '#fff',
                        borderRadius: 4,
                        padding: '1px 4px',
                        marginTop: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                      }}
                    >
                      {c.title}: {c.startTime}-{c.endTime}
                    </div>
                  ))}
                  {dayMts.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedEvent({ type: 'meeting', data: m })}
                      style={{
                        fontSize: 10,
                        background: '#10b981',
                        color: '#fff',
                        borderRadius: 4,
                        padding: '1px 4px',
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                      }}
                    >
                      📅 {m.title} ({m.start_time?.slice(0, 5)})
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      <Modal
        open={selectedEvent !== null}
        onCancel={() => setSelectedEvent(null)}
        footer={null}
        title={
          selectedEvent?.type === 'shift'
            ? `Chi tiết ca trực - ${selectedEvent.data?.title || ''}`
            : `Chi tiết cuộc họp - ${selectedEvent?.data?.title || ''}`
        }
      >
        {selectedEvent?.type === 'shift' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 0' }}>
            <div>
              <Typography.Text type="secondary">Nhân viên: </Typography.Text>
              <Typography.Text strong>{employee.full_name} ({employee.employee_code || '-'})</Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary">Ngày trực: </Typography.Text>
              <Typography.Text strong>{dayjs(selectedEvent.data.originalSchedule?.date).format('DD/MM/YYYY')}</Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary">Ca trực: </Typography.Text>
              <Tag color={selectedEvent.data.color}>{selectedEvent.data.title}</Tag>
              {selectedEvent.data.isOvertime && <Tag color="orange">Tăng ca</Tag>}
              <Tag color={STATUS_COLORS[selectedEvent.data.status] || 'default'}>
                {SCHEDULE_STATUS_LABELS[selectedEvent.data.status] || selectedEvent.data.status}
              </Tag>
            </div>
            <div>
              <Typography.Text type="secondary">Giờ trực: </Typography.Text>
              <Typography.Text strong>
                {selectedEvent.data.startTime} - {selectedEvent.data.endTime} ({selectedEvent.data.hours} giờ)
              </Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary">Nơi làm việc: </Typography.Text>
              <Typography.Text>{selectedEvent.data.workplaceName || '-'}</Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary">Phòng ban: </Typography.Text>
              <Typography.Text>{selectedEvent.data.departmentName || employee.department_name || '-'}</Typography.Text>
            </div>
            {selectedEvent.data.originalSchedule?.notes && (
              <div>
                <Typography.Text type="secondary">Ghi chú: </Typography.Text>
                <Typography.Text>{selectedEvent.data.originalSchedule.notes}</Typography.Text>
              </div>
            )}
          </div>
        )}

        {selectedEvent?.type === 'meeting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 0' }}>
            <div>
              <Typography.Text type="secondary">Tiêu đề cuộc họp: </Typography.Text>
              <Typography.Text strong style={{ fontSize: 16 }}>{selectedEvent.data.title}</Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary">Loại cuộc họp: </Typography.Text>
              <Tag color="green">{selectedEvent.data.meeting_type}</Tag>
              <Tag color="blue">{selectedEvent.data.status}</Tag>
            </div>
            <div>
              <Typography.Text type="secondary">Ngày họp: </Typography.Text>
              <Typography.Text strong>{dayjs(selectedEvent.data.date).format('DD/MM/YYYY')}</Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary">Thời gian: </Typography.Text>
              <Typography.Text strong>{selectedEvent.data.start_time?.slice(0, 5)}</Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary">Địa điểm: </Typography.Text>
              <Typography.Text strong style={{ color: '#ef4444' }}>
                📍 {selectedEvent.data.location || 'Chưa xác định địa điểm'}
              </Typography.Text>
            </div>
            {selectedEvent.data.description && (
              <div>
                <Typography.Text type="secondary">Mô tả: </Typography.Text>
                <Typography.Text>{selectedEvent.data.description}</Typography.Text>
              </div>
            )}
            <div>
              <Typography.Text type="secondary">
                Người tham gia ({selectedEvent.data.participants?.length || 0}):
              </Typography.Text>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedEvent.data.participants && selectedEvent.data.participants.length > 0 ? (
                  selectedEvent.data.participants.map((p: MeetingParticipant) => (
                    <Tag key={p.id} color="geekblue" icon={<TeamOutlined />}>
                      {p.employee_name || 'Nhân viên'}
                    </Tag>
                  ))
                ) : (
                  <span style={{ color: '#94a3b8' }}>Chưa có danh sách</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
