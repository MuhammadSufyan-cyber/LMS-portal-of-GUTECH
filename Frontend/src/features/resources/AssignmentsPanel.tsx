import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiQuery, apiRequest, jsonBody, uploadFile } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  max_marks: number;
  due_at: string;
  allow_late: boolean;
}
interface Submission {
  id: string;
  text_answer: string;
  submitted_at: string;
  is_late: boolean;
  marks_obtained: number | null;
  feedback: string | null;
  has_attachment?: boolean;
  profile?: { full_name: string; email: string; roll_no: string | null };
}
export default function AssignmentsPanel({ courseId }: { courseId: string }) {
  const { profile } = useAuth();
  const client = useQueryClient();
  const staff = profile?.role === 'admin' || profile?.role === 'teacher';
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [maxMarks, setMaxMarks] = useState('10');
  const [dueAt, setDueAt] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const assignments = useQuery({
    queryKey: ['assignments', courseId],
    queryFn: () => apiRequest<Assignment[]>(`/courses/${courseId}/assignments`),
  });
  const refresh = () => client.invalidateQueries({ queryKey: ['assignments', courseId] });
  const create = useMutation({
    mutationFn: () =>
      apiRequest<Assignment>(`/courses/${courseId}/assignments`, {
        method: 'POST',
        body: jsonBody({
          title,
          instructions,
          maxMarks: Number(maxMarks),
          dueAt: new Date(dueAt).toISOString(),
          allowLate: false,
        }),
      }),
    onSuccess: () => {
      setTitle('');
      setInstructions('');
      setDueAt('');
      setNotice('Assignment published.');
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Assignment could not be created.'),
  });
  const submit = useMutation({
    mutationFn: ({ id, text, file }: { id: string; text: string; file?: File }) => {
      const form = new FormData();
      form.set('textAnswer', text);
      if (file) form.set('file', file);
      return uploadFile(`/assignments/${id}/submissions`, form, () => undefined);
    },
    onSuccess: () => {
      setNotice('Your response was submitted.');
      refresh();
      void client.invalidateQueries({ queryKey: ['assignment-submissions'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Submission failed.'),
  });
  return (
    <section className="section-card assignments-panel" id="assignments">
      <div className="resource-section-heading">
        <div>
          <span className="eyebrow">ASSESSMENT</span>
          <h2>Assignments</h2>
          <p>Deadlines, submissions, and feedback for this course.</p>
        </div>
      </div>
      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {staff && (
        <form
          className="assignment-create"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            create.mutate();
          }}
        >
          <h3>Publish an assignment</h3>
          <label className="field">
            <span>Title</span>
            <input
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Instructions</span>
            <textarea
              required
              maxLength={12000}
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>
          <div className="assignment-form-row">
            <label className="field">
              <span>Maximum marks</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Due date</span>
              <input
                type="datetime-local"
                required
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>
          </div>
          <button className="button button-primary" disabled={create.isPending || !dueAt}>
            {create.isPending ? 'Publishing…' : 'Publish assignment'}
          </button>
        </form>
      )}
      {assignments.isLoading && (
        <div className="table-state">
          <span className="loader" />
          Loading assignments…
        </div>
      )}
      {assignments.isError && (
        <div className="table-state">
          <strong>Assignments could not be loaded.</strong>
          <button className="button button-secondary" onClick={() => void assignments.refetch()}>
            Try again
          </button>
        </div>
      )}
      {assignments.data?.length === 0 && (
        <div className="table-state">
          <strong>No assignments yet</strong>
          <span>Published work will appear here.</span>
        </div>
      )}
      <div className="assignment-list">
        {assignments.data?.map((item) => (
          <AssignmentCard
            key={item.id}
            item={item}
            staff={staff}
            answer={answers[item.id] ?? ''}
            setAnswer={(v) => setAnswers((old) => ({ ...old, [item.id]: v }))}
            onSubmit={(text, file) => submit.mutate({ id: item.id, text, file })}
            submitting={submit.isPending}
          />
        ))}
      </div>
    </section>
  );
}
function AssignmentCard({
  item,
  staff,
  answer,
  setAnswer,
  onSubmit,
  submitting,
}: {
  item: Assignment;
  staff: boolean;
  answer: string;
  setAnswer(v: string): void;
  onSubmit(text: string, file?: File): void;
  submitting: boolean;
}) {
  const submissions = useQuery({
    queryKey: ['assignment-submissions', item.id],
    queryFn: () => apiQuery<Submission[]>(`/assignments/${item.id}/submissions?page=1&pageSize=50`),
    enabled: true,
  });
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [submissionFile, setSubmissionFile] = useState<File>();
  const client = useQueryClient();
  const grade = useMutation({
    mutationFn: (row: Submission) =>
      apiRequest(`/submissions/${row.id}/grade`, {
        method: 'PATCH',
        body: jsonBody({
          marks: Number(marks[row.id] ?? row.marks_obtained ?? 0),
          feedback: feedback[row.id] ?? row.feedback ?? '',
        }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['assignment-submissions', item.id] }),
  });
  const due = new Date(item.due_at);
  const ownSubmission = !staff ? submissions.data?.data[0] : undefined;
  return (
    <article className="assignment-card">
      <div className="assignment-card-heading">
        <div>
          <h3>{item.title}</h3>
          <span>
            {item.max_marks} marks · Due{' '}
            {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(due)}
          </span>
        </div>
        {item.allow_late && <span className="status-pill">Late accepted</span>}
      </div>
      <p className="assignment-instructions">{item.instructions}</p>
      {!staff && (
        <div className="assignment-submit">
          {submissions.isLoading ? (
            <span>Checking your submission…</span>
          ) : (
            ownSubmission && (
              <div className="submission-status">
                <strong>
                  {ownSubmission.marks_obtained !== null
                    ? `Graded · ${ownSubmission.marks_obtained} / ${item.max_marks}`
                    : 'Response submitted'}
                </strong>
                <small>
                  {ownSubmission.is_late ? 'Late' : 'On time'} ·{' '}
                  {new Date(ownSubmission.submitted_at).toLocaleString()}
                </small>
                {ownSubmission.feedback && <p>{ownSubmission.feedback}</p>}
                {ownSubmission.has_attachment && <SubmissionDownload id={ownSubmission.id} />}
              </div>
            )
          )}
          <label className="field">
            <span>Your response</span>
            <textarea
              rows={4}
              maxLength={12000}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write your response…"
            />
          </label>
          <label className="field">
            <span>Optional attachment (PDF, DOCX, PPTX, ZIP · up to 30 MB)</span>
            <input
              type="file"
              accept=".pdf,.docx,.pptx,.zip"
              onChange={(event) => setSubmissionFile(event.target.files?.[0])}
            />
          </label>
          {submissionFile && (
            <small>
              {submissionFile.name} · {Math.ceil(submissionFile.size / 1024)} KB
            </small>
          )}
          <button
            className="button button-primary"
            disabled={
              submitting ||
              (!answer.trim() && !submissionFile) ||
              (submissionFile?.size ?? 0) > 30 * 1024 * 1024 ||
              (ownSubmission?.marks_obtained !== null && ownSubmission !== undefined) ||
              (Date.now() > due.getTime() && !item.allow_late)
            }
            onClick={() => onSubmit(answer, submissionFile)}
          >
            {ownSubmission ? 'Update submission' : 'Submit response'}
          </button>
        </div>
      )}
      {staff && (
        <div className="submission-list">
          <h4>Submissions {submissions.data && `(${submissions.data.meta?.total ?? 0})`}</h4>
          {submissions.isLoading ? (
            <span>Loading submissions…</span>
          ) : submissions.data?.data.length ? (
            submissions.data.data.map((row) => (
              <div className="submission-row" key={row.id}>
                <div>
                  <strong>{row.profile?.full_name ?? 'Student'}</strong>
                  <small>
                    {row.profile?.email} · {row.is_late ? 'Late' : 'On time'}
                  </small>
                  <p>{row.text_answer}</p>
                  {row.has_attachment && <SubmissionDownload id={row.id} />}
                </div>
                <div className="grade-controls">
                  <input
                    type="number"
                    min="0"
                    max={item.max_marks}
                    step="0.01"
                    aria-label="Marks"
                    value={marks[row.id] ?? row.marks_obtained ?? ''}
                    onChange={(e) => setMarks((old) => ({ ...old, [row.id]: e.target.value }))}
                  />
                  <input
                    aria-label="Feedback"
                    placeholder="Feedback"
                    value={feedback[row.id] ?? row.feedback ?? ''}
                    onChange={(e) => setFeedback((old) => ({ ...old, [row.id]: e.target.value }))}
                  />
                  <button
                    className="button button-small button-secondary"
                    disabled={grade.isPending}
                    onClick={() => grade.mutate(row)}
                  >
                    Save grade
                  </button>
                </div>
              </div>
            ))
          ) : (
            <span>No submissions yet.</span>
          )}
        </div>
      )}
    </article>
  );
}
function SubmissionDownload({ id }: { id: string }) {
  const download = async () => {
    const result = await apiRequest<{ url: string }>(`/submissions/${id}/download`);
    window.location.assign(result.url);
  };
  return (
    <button className="text-button" onClick={() => void download()}>
      Download attachment
    </button>
  );
}
