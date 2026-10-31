import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiQuery, apiRequest, uploadFile } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import AssignmentsPanel from './AssignmentsPanel';
import QuizzesPanel from './QuizzesPanel';
import CommunicationPanel from './CommunicationPanel';

interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
  isArchived: boolean;
}
interface Resource {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}
const bytes = (value: number) =>
  value < 1_000_000 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1_000_000).toFixed(1)} MB`;
const iconFor = (mime: string) =>
  mime.includes('pdf')
    ? 'PDF'
    : mime.includes('presentation')
      ? 'PPT'
      : mime.includes('wordprocessing')
        ? 'DOC'
        : mime.startsWith('image/')
          ? 'IMG'
          : 'ZIP';
export default function CoursePage() {
  const { id = '' } = useParams();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [resourcePage, setResourcePage] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const course = useQuery({
    queryKey: ['course', id],
    queryFn: () => apiRequest<Course>(`/courses/${id}`),
    enabled: Boolean(id),
  });
  const resources = useQuery({
    queryKey: ['resources', id, search, resourcePage],
    queryFn: () =>
      apiQuery<Resource[]>(
        `/courses/${id}/resources?page=${resourcePage}&pageSize=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
    enabled: Boolean(id),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['resources', id] });
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a file first.');
      if (file.size > 25 * 1024 * 1024) throw new Error('Files must be 25 MB or smaller.');
      const form = new FormData();
      form.set('title', title);
      form.set('description', description);
      form.set('file', file);
      return uploadFile(`/courses/${id}/resources`, form, setProgress);
    },
    onSuccess: () => {
      setNotice('Resource added to this course.');
      setTitle('');
      setDescription('');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setProgress(0);
      refresh();
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'Upload failed.'),
  });
  const remove = useMutation({
    mutationFn: (resourceId: string) =>
      apiRequest(`/resources/${resourceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setNotice('Resource removed.');
      refresh();
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'Delete failed.'),
  });
  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher';
  const chooseFile = (next?: File) => {
    setError('');
    setFile(next ?? null);
    if (next && next.size > 25 * 1024 * 1024) setError('Files must be 25 MB or smaller.');
  };
  const download = async (resourceId: string) => {
    try {
      const result = await apiRequest<{ url: string }>(`/resources/${resourceId}/download`);
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Download failed.');
    }
  };
  if (course.isLoading)
    return (
      <main className="page-content">
        <div className="table-state">
          <span className="loader" />
          Opening your course…
        </div>
      </main>
    );
  if (course.isError || !course.data)
    return (
      <main className="page-content">
        <div className="table-state">
          <strong>This course is unavailable.</strong>
          <Link
            className="button button-secondary"
            to={profile?.role === 'admin' ? '/admin/courses' : `/${profile?.role}/courses`}
          >
            Back to courses
          </Link>
        </div>
      </main>
    );
  const currentCourse = course.data;
  return (
    <main className="page-content course-detail-page">
      <Link
        className="back-link course-back"
        to={profile?.role === 'admin' ? '/admin/courses' : `/${profile?.role}/courses`}
      >
        ← All courses
      </Link>
      <div className="course-detail-hero">
        <div className="course-detail-code">
          {currentCourse.code}
          <span>{currentCourse.isArchived ? 'ARCHIVED' : 'COURSE SPACE'}</span>
        </div>
        <h1>{currentCourse.title}</h1>
        <p>
          {currentCourse.description || 'A GUTECH course space for learning and collaboration.'}
        </p>
        <div className="course-detail-bottom">
          <span>COURSE MATERIALS</span>
          <span>·</span>
          <span>RESOURCES</span>
        </div>
        <span className="course-detail-orbit" aria-hidden="true">
          ◈
        </span>
      </div>
      <div className="course-tabs" aria-label="Course sections">
        <a className="course-tab course-tab-active" href="#resources">
          Resources
        </a>
        <a className="course-tab" href="#assignments">
          Assignments
        </a>
        <a className="course-tab" href="#quizzes">
          Quizzes
        </a>
        <a className="course-tab" href="#announcements">
          Announcements
        </a>
        <a className="course-tab" href="#chat">
          Chat
        </a>
      </div>
      <div className="resource-layout">
        <section className="resource-list-section" id="resources">
          <div className="resource-section-heading">
            <div>
              <span className="eyebrow">COURSE LIBRARY</span>
              <h2>Resources</h2>
              <p>Notes, references, and material shared with your class.</p>
            </div>
            <label className="search-field resource-search">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">Search resources</span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setResourcePage(1);
                }}
                placeholder="Search resources"
              />
            </label>
          </div>
          {notice && (
            <div className="alert alert-success" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
              <button className="text-button" onClick={() => setError('')} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}
          {resources.isLoading && (
            <div className="table-state">
              <span className="loader" />
              Loading resources…
            </div>
          )}
          {resources.isError && (
            <div className="table-state">
              <strong>Resources could not be loaded.</strong>
              <button className="button button-secondary" onClick={() => void resources.refetch()}>
                Try again
              </button>
            </div>
          )}
          {!resources.isLoading &&
            !resources.isError &&
            (resources.data?.data.length ?? 0) === 0 && (
              <div className="section-card table-state">
                <span className="empty-icon">⇩</span>
                <strong>
                  {search ? 'No resources match your search' : 'No resources have been shared yet'}
                </strong>
                <span>
                  {isStaff
                    ? 'Add the first resource for this course.'
                    : 'Your teacher will share course materials here.'}
                </span>
              </div>
            )}
          {(resources.data?.data.length ?? 0) > 0 && (
            <div className="resource-list">
              {resources.data?.data.map((item) => (
                <article className="resource-row" key={item.id}>
                  <span className={`file-icon file-${iconFor(item.mimeType).toLowerCase()}`}>
                    {iconFor(item.mimeType)}
                  </span>
                  <div className="resource-copy">
                    <strong>{item.title}</strong>
                    <small>
                      {item.fileName} · {bytes(item.sizeBytes)} ·{' '}
                      {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
                        new Date(item.createdAt),
                      )}
                    </small>
                    {item.description && <p>{item.description}</p>}
                  </div>
                  <div className="resource-row-actions">
                    <button
                      className="button button-small button-secondary"
                      onClick={() => void download(item.id)}
                    >
                      Download <span>↓</span>
                    </button>
                    {(profile?.role === 'admin' || item.uploadedBy === profile?.id) && (
                      <button
                        className="icon-button resource-delete"
                        aria-label={`Delete ${item.title}`}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(item.id)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {(resources.data?.meta?.total ?? 0) > 20 && (
            <div className="pagination resource-pagination">
              <span>
                Page {resourcePage} of {Math.ceil((resources.data?.meta?.total ?? 0) / 20)}
              </span>
              <div>
                <button
                  className="button button-small button-secondary"
                  disabled={resourcePage === 1}
                  onClick={() => setResourcePage((page) => page - 1)}
                >
                  Previous
                </button>
                <button
                  className="button button-small button-secondary"
                  disabled={resourcePage >= Math.ceil((resources.data?.meta?.total ?? 0) / 20)}
                  onClick={() => setResourcePage((page) => page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
        {isStaff && (
          <aside className="section-card upload-card">
            <div className="upload-card-heading">
              <span className="eyebrow">SHARE WITH YOUR CLASS</span>
              <h2>Add a resource</h2>
              <p>PDF, DOCX, PPTX, images, or ZIP up to 25 MB.</p>
            </div>
            <form
              className="upload-form"
              onSubmit={(event) => {
                event.preventDefault();
                setError('');
                upload.mutate();
              }}
            >
              <label className="field">
                <span>Resource title</span>
                <input
                  required
                  maxLength={120}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Week 03 lecture notes"
                />
              </label>
              <label className="field">
                <span>
                  Description <em>Optional</em>
                </span>
                <textarea
                  className="text-area"
                  rows={2}
                  maxLength={1000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <div
                className={`upload-drop${dragOver ? ' upload-drag-over' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  chooseFile(event.dataTransfer.files[0]);
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.gif,.webp,.zip"
                  onChange={(event) => chooseFile(event.target.files?.[0])}
                />
                <span className="upload-arrow">↑</span>
                <strong>{file?.name ?? 'Drop a file here'}</strong>
                <small>
                  {file ? (
                    bytes(file.size)
                  ) : (
                    <>
                      or{' '}
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => inputRef.current?.click()}
                      >
                        browse files
                      </button>
                    </>
                  )}
                </small>
              </div>
              {upload.isPending && (
                <div className="upload-progress">
                  <div>
                    <span>Uploading securely</span>
                    <strong>{progress}%</strong>
                  </div>
                  <i>
                    <b style={{ width: `${progress}%` }} />
                  </i>
                </div>
              )}
              <button
                className="button button-primary button-wide"
                disabled={!file || !title.trim() || upload.isPending}
              >
                {upload.isPending ? 'Uploading…' : 'Upload resource'}
              </button>
              <small className="upload-private-note">
                Files stay private. Students receive secure download links.
              </small>
            </form>
          </aside>
        )}
      </div>
      <AssignmentsPanel courseId={id} />
      <QuizzesPanel courseId={id} />
      <CommunicationPanel courseId={id} />
    </main>
  );
}
