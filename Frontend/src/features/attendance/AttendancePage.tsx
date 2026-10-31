import { useQuery } from '@tanstack/react-query';
import { apiQuery } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';

interface AttendanceRecord {
  id: string;
  class_date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes: string | null;
  course: { code: string; title: string };
  student: { full_name: string; roll_no: string | null };
}

const statusLabels = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

export default function AttendancePage() {
  const { profile } = useAuth();
  const attendance = useQuery({
    queryKey: ['attendance'],
    queryFn: () => apiQuery<AttendanceRecord[]>('/attendance?page=1&pageSize=100'),
  });
  const records = attendance.data?.data ?? [];
  const presentCount = records.filter((record) => record.status === 'present').length;
  const attendanceRate = records.length ? Math.round((presentCount / records.length) * 100) : 0;

  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CLASS PARTICIPATION</span>
          <h1>Attendance</h1>
          <p>Attendance records across your GUTECH courses.</p>
        </div>
      </div>
      {profile?.role === 'student' && records.length > 0 && (
        <section className="section-card attendance-summary" aria-label="Attendance summary">
          <div>
            <span className="eyebrow">OVERALL ATTENDANCE</span>
            <strong>{attendanceRate}%</strong>
          </div>
          <p>
            Present for {presentCount} of {records.length} recorded classes.
          </p>
        </section>
      )}
      {records.some((record) => record.notes === 'seed:demo-preview') && (
        <div className="alert alert-success" role="status">
          Showing sample attendance while the attendance table migration is pending.
        </div>
      )}
      {attendance.isLoading && (
        <div className="table-state">
          <span className="loader" />
          Loading attendance…
        </div>
      )}
      {attendance.isError && (
        <div className="table-state">
          <strong>Attendance could not be loaded.</strong>
          <button className="button button-secondary" onClick={() => void attendance.refetch()}>
            Try again
          </button>
        </div>
      )}
      {attendance.data && records.length === 0 && (
        <div className="section-card table-state">
          <strong>No attendance recorded yet</strong>
          <span>Records will appear here when class attendance is entered.</span>
        </div>
      )}
      {records.length > 0 && (
        <div className="table-wrap section-card">
          <table className="data-table">
            <thead>
              <tr>
                {profile?.role !== 'student' && <th>Student</th>}
                <th>Course</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  {profile?.role !== 'student' && (
                    <td>
                      <strong>{record.student.full_name}</strong>
                      {record.student.roll_no && <small> · {record.student.roll_no}</small>}
                    </td>
                  )}
                  <td>
                    <strong>{record.course.code}</strong>
                    <small> · {record.course.title}</small>
                  </td>
                  <td>{new Date(`${record.class_date}T12:00:00`).toLocaleDateString()}</td>
                  <td>
                    <span className={`attendance-status attendance-${record.status}`}>
                      {statusLabels[record.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
