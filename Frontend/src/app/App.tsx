import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import OverviewPage from './OverviewPage';
import { AuthProvider } from '../features/auth/AuthProvider';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import LoginPage from '../features/auth/LoginPage';
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage';
import ResetPasswordPage from '../features/auth/ResetPasswordPage';
import ProfilePage from '../features/auth/ProfilePage';
import UsersPage from '../features/admin/UsersPage';
import AdminCoursesPage from '../features/courses/AdminCoursesPage';
import MyCoursesPage from '../features/courses/MyCoursesPage';
import CoursePage from '../features/resources/CoursePage';
import ComplaintsPage from '../features/complaints/ComplaintsPage';
import MarksPage from '../features/marks/MarksPage';
import AuditPage from '../features/admin/AuditPage';
import AttendancePage from '../features/attendance/AttendancePage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/complaints" element={<ComplaintsPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route element={<ProtectedRoute roles={['student']} />}>
              <Route path="/marks" element={<MarksPage />} />
            </Route>
            <Route path="/courses/:id" element={<CoursePage />} />
            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route path="/admin" element={<OverviewPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/courses" element={<AdminCoursesPage />} />
              <Route path="/admin/audit" element={<AuditPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['teacher']} />}>
              <Route path="/teacher" element={<OverviewPage />} />
              <Route path="/teacher/courses" element={<MyCoursesPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['student']} />}>
              <Route path="/student" element={<OverviewPage />} />
              <Route path="/student/courses" element={<MyCoursesPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
