import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiQuery, apiRequest, jsonBody } from '../../lib/api';
import type { ManagedUser } from '../auth/auth.types';

interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
}
export default function AdminCoursesPage() {
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<'create' | 'teachers' | 'enroll' | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [notice, setNotice] = useState('');
  const client = useQueryClient();
  const courses = useQuery({
    queryKey: ['admin-courses', page],
    queryFn: () => apiQuery<Course[]>(`/admin/courses?page=${page}&pageSize=12`),
  });
  const invalidate = () => client.invalidateQueries({ queryKey: ['admin-courses'] });
  const archive = useMutation({
    mutationFn: (course: Course) =>
      apiRequest<Course>(`/admin/courses/${course.id}`, {
        method: 'PATCH',
        body: jsonBody({ isArchived: !course.isArchived }),
      }),
    onSuccess: (_, course) => {
      setNotice(`${course.code} ${course.isArchived ? 'restored' : 'archived'}.`);
      invalidate();
    },
  });
  const list = courses.data?.data ?? [];
  const total = courses.data?.meta?.total ?? 0;
  const open = (mode: 'teachers' | 'enroll', course: Course) => {
    setSelectedCourse(course);
    setDialog(mode);
  };
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACADEMIC STRUCTURE / CATALOG</span>
          <h1>Courses</h1>
          <p>Build the spaces where GUTECH learning happens.</p>
        </div>
        <button className="button button-primary" onClick={() => setDialog('create')}>
          ＋ Create course
        </button>
      </div>
      <div className="course-masthead">
        <div>
          <span className="eyebrow eyebrow-light">A CONNECTED CAMPUS</span>
          <strong>{total.toString().padStart(2, '0')}</strong>
          <p>Courses across programs</p>
        </div>
        <span className="course-masthead-art" aria-hidden="true">
          ✳
        </span>
        <span className="course-masthead-foot">G / ACADEMICS</span>
      </div>
      {notice && (
        <div className="alert alert-success" role="status">
          <span>{notice}</span>
          <button className="text-button" onClick={() => setNotice('')} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      {archive.error && (
        <div className="alert alert-error" role="alert">
          {archive.error instanceof Error ? archive.error.message : 'Course update failed.'}
        </div>
      )}
      {courses.isLoading && (
        <div className="course-grid">
          {[1, 2, 3].map((n) => (
            <div className="course-skeleton" key={n} />
          ))}
        </div>
      )}
      {courses.isError && (
        <div className="table-state">
          <strong>Courses could not be loaded.</strong>
          <button className="button button-secondary" onClick={() => void courses.refetch()}>
            Try again
          </button>
        </div>
      )}
      {!courses.isLoading && !courses.isError && list.length === 0 && (
        <div className="section-card table-state">
          <span className="empty-icon">◫</span>
          <strong>No courses yet</strong>
          <span>Create your first course to start organizing classes.</span>
        </div>
      )}
      {list.length > 0 && (
        <div className="course-grid">
          {list.map((course, index) => (
            <article
              className={`course-card${course.isArchived ? ' course-card-archived' : ''}`}
              key={course.id}
            >
              <div className={`course-card-cover cover-${index % 4}`}>
                <span className="course-code">{course.code}</span>
                <span className="course-symbol">{['◈', '✳', '⌘', '◉'][index % 4]}</span>
                <span className="course-cover-line" />
              </div>
              <div className="course-card-body">
                <div className="course-card-meta">
                  <span>{course.isArchived ? 'ARCHIVED' : 'ACTIVE COURSE'}</span>
                  <span className="course-card-index">
                    {String((page - 1) * 12 + index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h2>{course.title}</h2>
                <p>
                  {course.description || 'A GUTECH course space for learning and collaboration.'}
                </p>
                <div className="course-card-actions">
                  <Link
                    className="button button-small button-secondary"
                    to={`/courses/${course.id}`}
                  >
                    Open course <span>↗</span>
                  </Link>
                  <button
                    className="icon-button"
                    title="Assign teachers"
                    aria-label={`Assign teachers to ${course.code}`}
                    onClick={() => open('teachers', course)}
                  >
                    ♧
                  </button>
                  <button
                    className="icon-button"
                    title="Enroll students"
                    aria-label={`Enroll students in ${course.code}`}
                    onClick={() => open('enroll', course)}
                  >
                    ＋
                  </button>
                  <button
                    className="text-button archive-action"
                    onClick={() => archive.mutate(course)}
                  >
                    {course.isArchived ? 'Restore' : 'Archive'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {total > 12 && (
        <div className="table-footer course-pagination">
          <span>
            Page {page} · {total} courses
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
              disabled={page * 12 >= total}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      {dialog === 'create' && (
        <CreateCourse
          onClose={() => setDialog(null)}
          onCreated={(course) => {
            setDialog(null);
            setNotice(`${course.code} was created.`);
            invalidate();
          }}
        />
      )}
      {dialog === 'teachers' && selectedCourse && (
        <TeacherDialog
          course={selectedCourse}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            setNotice('Teacher assignments saved.');
          }}
        />
      )}
      {dialog === 'enroll' && selectedCourse && (
        <EnrollmentDialog
          course={selectedCourse}
          onClose={() => setDialog(null)}
          onImported={(result) => {
            setDialog(null);
            setNotice(
              `${result.enrolled} students enrolled. ${result.unknownEmails.length ? `${result.unknownEmails.length} unmatched email(s) need review.` : ''}`,
            );
          }}
        />
      )}
    </main>
  );
}

function CreateCourse({
  onClose,
  onCreated,
}: {
  onClose(): void;
  onCreated(course: Course): void;
}) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<Course>('/admin/courses', {
        method: 'POST',
        body: jsonBody({ code, title, description }),
      }),
    onSuccess: onCreated,
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : 'Course could not be created.'),
  });
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-course-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">COURSE CATALOG</span>
            <h2 id="create-course-title">Create a course</h2>
            <p>Give this class a recognizable code and title.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
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
            mutation.mutate();
          }}
        >
          <label className="field">
            <span>Course code</span>
            <input
              required
              maxLength={20}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="CS101"
            />
          </label>
          <label className="field">
            <span>Course title</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Foundations of Computing"
            />
          </label>
          <label className="field">
            <span>
              Description <em>Optional</em>
            </span>
            <textarea
              className="text-area"
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button button-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create course'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TeacherDialog({
  course,
  onClose,
  onSaved,
}: {
  course: Course;
  onClose(): void;
  onSaved(): void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const teachers = useQuery({
    queryKey: ['users', 'teacher'],
    queryFn: async () =>
      (await apiQuery<ManagedUser[]>('/admin/users?page=1&pageSize=100&role=teacher')).data,
  });
  const assigned = useQuery({
    queryKey: ['course-teachers', course.id],
    queryFn: async () =>
      (await apiQuery<ManagedUser[]>(`/admin/courses/${course.id}/teachers?page=1&pageSize=100`))
        .data,
  });
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest(`/admin/courses/${course.id}/teachers`, {
        method: 'PUT',
        body: jsonBody({ teacherIds: selected }),
      }),
    onSuccess: onSaved,
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : 'Assignments could not be saved.'),
  });
  useEffect(() => {
    if (assigned.data) setSelected(assigned.data.map((person) => person.id));
  }, [assigned.data]);
  return (
    <div className="modal-backdrop">
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-dialog-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{course.code} / FACULTY</span>
            <h2 id="teacher-dialog-title">Assign teachers</h2>
            <p>Only active teacher accounts can be assigned.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {(teachers.isError || assigned.isError) && (
          <div className="alert alert-error">
            Teacher assignments could not be loaded. Close and try again.
          </div>
        )}
        {teachers.isLoading || assigned.isLoading ? (
          <div className="table-state">
            <span className="loader" />
            Loading faculty…
          </div>
        ) : (
          <>
            <label className="field">
              <span>Course teachers</span>
              <select
                className="multi-select"
                multiple
                value={selected}
                onChange={(event) =>
                  setSelected(Array.from(event.target.selectedOptions, (option) => option.value))
                }
              >
                {(teachers.data ?? []).map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName} · {teacher.email}
                  </option>
                ))}
              </select>
              <small className="field-hint">Use Ctrl/Cmd to select more than one teacher.</small>
            </label>
            <div className="modal-actions">
              <button className="button button-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? 'Saving…' : 'Save teachers'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function EnrollmentDialog({
  course,
  onClose,
  onImported,
}: {
  course: Course;
  onClose(): void;
  onImported(result: { enrolled: number; unknownEmails: string[] }): void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{
    matched: number;
    duplicate: number;
    unknownEmails: string[];
  } | null>(null);
  const [summary, setSummary] = useState<{ enrolled: number; unknownEmails: string[] } | null>(
    null,
  );
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a CSV file first.');
      const csv = await file.text();
      return apiRequest<{ matched: number; duplicate: number; unknownEmails: string[] }>(
        `/admin/courses/${course.id}/enrollments/csv/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/csv' },
          body: csv,
        },
      );
    },
    onSuccess: (result) => {
      setPreview(result);
      setError('');
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'CSV preview failed.'),
  });
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a CSV file first.');
      return apiRequest<{
        matched: number;
        enrolled: number;
        duplicate: number;
        unknownEmails: string[];
      }>(`/admin/courses/${course.id}/enrollments/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: await file.text(),
      });
    },
    onSuccess: (result) => {
      setSummary(result);
      setError('');
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'CSV import failed.'),
  });
  const pick = async (next: File | null) => {
    setFile(next);
    setError('');
    setPreview(null);
    setSummary(null);
    if (!next) return setPreviewCount(0);
    if (!next.name.toLowerCase().endsWith('.csv')) {
      setError('Choose a .csv file.');
      setPreviewCount(0);
      return;
    }
    const content = await next.text();
    setPreviewCount(content.split(/\r?\n/).filter((line) => line.trim()).length - 1);
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="enrollment-dialog-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{course.code} / ROSTER</span>
            <h2 id="enrollment-dialog-title">Enroll students</h2>
            <p>
              Import a CSV with an <code>email</code> column. Unknown addresses are reported.
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <label className="csv-drop">
          <span className="csv-icon">⇧</span>
          <strong>{file?.name ?? 'Choose a student list'}</strong>
          <small>
            {file
              ? `${Math.max(0, previewCount)} student rows found`
              : 'CSV file · one email address per row'}
          </small>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void pick(event.target.files?.[0] ?? null)}
          />
        </label>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {preview && !summary && (
          <div className="csv-summary" role="status">
            Preview: {preview.matched} matched · {preview.duplicate} duplicate ·{' '}
            {preview.unknownEmails.length} unknown
          </div>
        )}
        {summary && (
          <div className="csv-summary" role="status">
            {summary.enrolled} students enrolled · {summary.unknownEmails.length} unmatched email(s)
          </div>
        )}
        {preview?.unknownEmails.length || summary?.unknownEmails.length ? (
          <div className="csv-unknown">
            <strong>These emails weren’t matched</strong>
            <p>{(summary?.unknownEmails ?? preview?.unknownEmails ?? []).join(', ')}</p>
            <span>
              Only active student accounts are matched. Unknown addresses can be added after their
              GUTECH accounts are created.
            </span>
          </div>
        ) : null}
        <div className="modal-actions">
          <button
            className="button button-secondary"
            onClick={() => (summary ? onImported(summary) : onClose())}
          >
            {summary ? 'Done' : 'Cancel'}
          </button>
          {!preview && !summary && (
            <button
              className="button button-primary"
              disabled={!file || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
            >
              {previewMutation.isPending ? 'Checking list…' : 'Preview list'}
            </button>
          )}
          {preview && !summary && (
            <button
              className="button button-primary"
              disabled={importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending ? 'Enrolling…' : 'Confirm enrollment'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
