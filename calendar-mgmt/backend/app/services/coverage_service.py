from datetime import date, time
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.schedule import Schedule
from app.core.constants import ScheduleStatus


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


async def check_coverage(db: AsyncSession, department_id: str, check_date: date) -> dict:
    result = await db.execute(
        select(Schedule)
        .where(
            Schedule.date == check_date,
            Schedule.status.in_([ScheduleStatus.APPROVED, ScheduleStatus.CONFIRMED]),
        )
    )
    schedules = result.scalars().all()

    from app.models.shift_template import ShiftTemplate
    shift_ids = list(set(str(s.shift_template_id) for s in schedules))
    shift_result = await db.execute(select(ShiftTemplate).where(ShiftTemplate.id.in_(shift_ids)))
    shift_map = {str(s.id): s for s in shift_result.scalars().all()}

    covered_ranges = []
    overnight_ranges = []
    for s in schedules:
        shift = shift_map.get(str(s.shift_template_id))
        if not shift:
            continue
        start = s.actual_start_time or shift.start_time
        end = s.actual_end_time or shift.end_time
        is_overnight = shift.is_overnight or (start and end and end <= start)
        range_info = {
            "start": start.isoformat() if start else "",
            "end": end.isoformat() if end else "",
            "employee_id": str(s.employee_id),
            "schedule_id": str(s.id),
        }
        if is_overnight:
            overnight_ranges.append(range_info)
        else:
            covered_ranges.append(range_info)

    sorted_ranges = sorted(covered_ranges, key=lambda x: x["start"])
    gaps = []
    current_end_min = 0
    for r in sorted_ranges:
        start_min = _time_to_minutes(time.fromisoformat(r["start"]))
        end_min = _time_to_minutes(time.fromisoformat(r["end"]))
        if start_min > current_end_min:
            gaps.append({
                "start": f"{current_end_min // 60:02d}:{current_end_min % 60:02d}:00",
                "end": f"{start_min // 60:02d}:{start_min % 60:02d}:00",
            })
        if end_min > current_end_min:
            current_end_min = end_min

    end_of_day_min = 23 * 60 + 59
    if current_end_min < end_of_day_min:
        gaps.append({
            "start": f"{current_end_min // 60:02d}:{current_end_min % 60:02d}:00",
            "end": "23:59:00",
        })

    if overnight_ranges:
        overnight_starts = [_time_to_minutes(time.fromisoformat(r["start"])) for r in overnight_ranges if r.get("start")]
        latest_overnight_start = max(overnight_starts) if overnight_starts else 0
        if latest_overnight_start > current_end_min:
            gaps.append({
                "start": f"{current_end_min // 60:02d}:{current_end_min % 60:02d}:00",
                "end": f"{latest_overnight_start // 60:02d}:{latest_overnight_start % 60:02d}:00",
            })

    return {
        "date": check_date.isoformat(),
        "total_shifts": len(schedules),
        "gaps": gaps,
        "is_fully_covered": len(gaps) == 0,
        "covered_ranges": covered_ranges + overnight_ranges,
    }
