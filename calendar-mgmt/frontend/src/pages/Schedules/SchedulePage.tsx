import { Spin, Alert } from 'antd';
import { useSchedule } from '@/hooks/useSchedule';
import { ScheduleSidebar } from './ScheduleSidebar';
import { ScheduleModal } from './ScheduleModal';

export function SchedulePage() {
  const {
    departments,
    employees,
    shiftTemplates,
    workplaces,
    calendarData,
    coverage,
    meetingData,
    loading,
    selectedDept,
    modalOpen,
    selectedDate,
    selectedDateSidebar,
    showForm,
    editingSchedule,
    modalSchedules,
    loadingModal,
    form,
    selectedWorkplaceId,
    setSelectedDept,
    deptLocked,
    openAdd,
    handleCellClick,
    handleCreateSchedule,
    handleEditSchedule,
    handleDeleteSchedule,
    handleSubmitSchedule,
    handleCloseModal,
    handleCancelForm,
    fetchCalendar,
  } = useSchedule();

  if (loading && !calendarData.length) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', minHeight: 0 }}>
      {coverage && !coverage.is_fully_covered && (
        <Alert
          type="warning"
          showIcon
          message={`Hôm nay có ${coverage.gaps.length} khoảng trống coverage: ${coverage.gaps.map((g) => `${g.start.slice(0, 5)}-${g.end.slice(0, 5)}`).join(', ')}`}
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <ScheduleSidebar
          selectedDateSidebar={selectedDateSidebar}
          employees={employees}
          shiftTemplates={shiftTemplates}
          workplaces={workplaces}
          calendarData={calendarData}
          meetingData={meetingData}
          onRefresh={fetchCalendar}
          selectedDept={selectedDept}
          setSelectedDept={setSelectedDept}
          deptLocked={deptLocked}
          onDateChange={(date) => handleCellClick(date)}
          departments={departments}
        />
      </div>

      <ScheduleModal
        visible={modalOpen}
        selectedDate={selectedDate}
        loading={loadingModal}
        schedules={modalSchedules}
        showForm={showForm}
        editingSchedule={editingSchedule}
        employees={employees}
        shiftTemplates={shiftTemplates}
        workplaces={workplaces}
        form={form}
        selectedWorkplaceId={selectedWorkplaceId}
        onClose={handleCloseModal}
        onAdd={openAdd}
        onEdit={handleEditSchedule}
        onDelete={handleDeleteSchedule}
        onSubmit={handleSubmitSchedule}
        onCancelForm={handleCancelForm}
        onFormSubmit={handleCreateSchedule}
      />
    </div>
  );
}
