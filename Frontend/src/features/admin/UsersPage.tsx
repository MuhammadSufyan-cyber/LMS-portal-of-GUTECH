import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiQuery, apiRequest, jsonBody, ApiError } from '../../lib/api';
import type { ManagedUser, UserRole } from '../auth/auth.types';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
const roleLabel: Record<UserRole, string> = {
  admin: 'Administrator',
  teacher: 'Teacher',
  student: 'Student',
};

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-users', page, search, role],
    queryFn: () =>
      apiQuery<ManagedUser[]>(
        `/admin/users?page=${page}&pageSize=10${search ? `&search=${encodeURIComponent(search)}` : ''}${role ? `&role=${role}` : ''}`,
      ),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  const toggle = useMutation({
    mutationFn: (user: ManagedUser) =>
      apiRequest(`/admin/users/${user.id}`, {
        method: 'PATCH',
        body: jsonBody({ isActive: !user.isActive }),
      }),
    onSuccess: (_, user) => {
      setNotice(`${user.fullName} ${user.isActive ? 'deactivated' : 'activated'}.`);
      invalidate();
    },
  });
  const reset = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/users/${id}/reset-password`, { method: 'POST' }),
    onSuccess: () => setNotice('Password reset email sent.'),
  });
  const users = query.data?.data ?? [];
  const total = query.data?.meta?.total ?? 0;
  return (
    <section className="page-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DIRECTORY / ACCESS</span>
          <h1>People</h1>
          <p>Manage the people who make your learning community.</p>
        </div>
        <button className="button button-primary" onClick={() => setDialogOpen(true)}>
          <span aria-hidden="true">＋</span> Add a person
        </button>
      </div>
      <div className="metric-strip">
        <div className="metric-card">
          <span>PEOPLE IN GUTECH</span>
          <strong>{total}</strong>
          <small>Accounts across all roles</small>
        </div>
        <div className="metric-card metric-accent">
          <span>ACCESS CONTROL</span>
          <strong>Admin managed</strong>
          <small>Public account creation is disabled</small>
        </div>
        <div className="metric-card">
          <span>ACCOUNT SECURITY</span>
          <strong>Protected</strong>
          <small>Inactive users lose access immediately</small>
        </div>
      </div>
      <div className="section-card directory-card">
        <div className="directory-toolbar">
          <div>
            <h2>Directory</h2>
            <p>{total} accounts · newest first</p>
          </div>
          <div className="directory-filters">
            <label className="search-field">
              <span className="sr-only">Search people</span>
              <span aria-hidden="true">⌕</span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search name or email"
              />
            </label>
            <label className="select-field">
              <span className="sr-only">Filter by role</span>
              <select
                value={role}
                onChange={(event) => {
                  setRole(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All roles</option>
                <option value="admin">Administrators</option>
                <option value="teacher">Teachers</option>
                <option value="student">Students</option>
              </select>
            </label>
          </div>
        </div>
        {notice && (
          <div className="alert alert-success" role="status">
            <span>{notice}</span>
            <button className="text-button" onClick={() => setNotice('')} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
        {(toggle.error || reset.error) && (
          <div className="alert alert-error" role="alert">
            {(toggle.error ?? reset.error) instanceof ApiError
              ? (toggle.error ?? (reset.error as ApiError)).message
              : 'This action could not be completed.'}
          </div>
        )}
        {query.isLoading && (
          <div className="table-state">
            <span className="loader" />
            Loading people…
          </div>
        )}
        {query.isError && (
          <div className="table-state error-state">
            <strong>Couldn’t load the directory.</strong>
            <button className="button button-secondary" onClick={() => void query.refetch()}>
              Try again
            </button>
          </div>
        )}
        {!query.isLoading && !query.isError && users.length === 0 && (
          <div className="table-state">
            <span className="empty-icon">◎</span>
            <strong>No people match this search</strong>
            <span>Try another name or filter.</span>
          </div>
        )}
        {users.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PERSON</th>
                    <th>ROLE</th>
                    <th>STATUS</th>
                    <th>JOINED</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="person-cell">
                          <span className={`avatar avatar-${user.role}`}>
                            {initials(user.fullName)}
                          </span>
                          <span>
                            <strong>{user.fullName}</strong>
                            <small>
                              @{user.username} · {user.email}
                              {user.rollNo ? ` · ${user.rollNo}` : ''}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`role-chip role-${user.role}`}>
                          {roleLabel[user.role]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-chip ${user.isActive ? 'status-active' : 'status-inactive'}`}
                        >
                          <i />
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="date-cell">
                        {new Intl.DateTimeFormat('en', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }).format(new Date(user.createdAt))}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="text-button"
                            disabled={reset.isPending}
                            onClick={() => reset.mutate(user.id)}
                          >
                            Reset password
                          </button>
                          <button
                            className={`switch ${user.isActive ? 'switch-on' : ''}`}
                            role="switch"
                            aria-checked={user.isActive}
                            aria-label={`${user.isActive ? 'Deactivate' : 'Activate'} ${user.fullName}`}
                            disabled={toggle.isPending}
                            onClick={() => toggle.mutate(user)}
                          >
                            <i />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}
              </span>
              <div>
                <button
                  className="button button-small button-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <button
                  className="button button-small button-secondary"
                  disabled={page * 10 >= total}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {dialogOpen && (
        <CreateUserDialog
          onClose={() => setDialogOpen(false)}
          onCreated={(name) => {
            setDialogOpen(false);
            setNotice(`${name} was added to the directory.`);
            invalidate();
          }}
        />
      )}
    </section>
  );
}

function CreateUserDialog({
  onClose,
  onCreated,
}: {
  onClose(): void;
  onCreated(name: string): void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [rollNo, setRollNo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<ManagedUser>('/admin/users', {
        method: 'POST',
        body: jsonBody({
          fullName,
          username,
          email,
          role,
          tempPassword: password,
          ...(role === 'student' && rollNo ? { rollNo } : {}),
        }),
      }),
    onSuccess: (user) => onCreated(user.fullName),
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : 'Could not create this account.'),
  });
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">ADMIN DIRECTORY</span>
            <h2 id="create-user-title">Add a person</h2>
            <p>Accounts are created by administrators only.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            mutation.mutate();
          }}
        >
          <label className="field">
            <span>Full name</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoFocus
            />
          </label>
          <label className="field">
            <span>Username</span>
            <input
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9._-]+"
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span>Institutional email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          {role === 'student' && (
            <label className="field">
              <span>
                Roll number <em>Optional</em>
              </span>
              <input
                maxLength={40}
                value={rollNo}
                onChange={(event) => setRollNo(event.target.value)}
                placeholder="e.g. GT-2026-0142"
              />
            </label>
          )}
          <label className="field">
            <span>Temporary password</span>
            <input
              required
              type="password"
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
            <small className="field-hint">
              At least 10 characters, one letter and one number. The user will change it on first
              sign-in.
            </small>
          </label>
          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button button-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
