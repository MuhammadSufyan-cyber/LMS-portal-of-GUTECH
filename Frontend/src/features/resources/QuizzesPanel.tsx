import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, jsonBody } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';

interface Question {
  id: string;
  prompt: string;
  type: 'mcq_single' | 'mcq_multi' | 'true_false';
  options: Array<{ id: string; label: string }>;
  marks: number;
}
interface Quiz {
  id: string;
  title: string;
  description: string | null;
  time_limit_minutes: number;
  opens_at: string;
  closes_at: string;
  questions: Question[];
}
interface Attempt {
  id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
}
export default function QuizzesPanel({ courseId }: { courseId: string }) {
  const { profile } = useAuth();
  const client = useQueryClient();
  const staff = profile?.role === 'admin' || profile?.role === 'teacher';
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [optionA, setA] = useState('');
  const [optionB, setB] = useState('');
  const [optionC, setC] = useState('');
  const [optionD, setD] = useState('');
  const [correct, setCorrect] = useState('a');
  const [minutes, setMinutes] = useState('20');
  const [opens, setOpens] = useState('');
  const [closes, setCloses] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const quizzes = useQuery({
    queryKey: ['quizzes', courseId],
    queryFn: () => apiRequest<Quiz[]>(`/courses/${courseId}/quizzes`),
  });
  const refresh = () => client.invalidateQueries({ queryKey: ['quizzes', courseId] });
  const create = useMutation({
    mutationFn: () =>
      apiRequest(`/courses/${courseId}/quizzes`, {
        method: 'POST',
        body: jsonBody({
          title,
          timeLimitMinutes: Number(minutes),
          opensAt: new Date(opens).toISOString(),
          closesAt: new Date(closes).toISOString(),
          questions: [
            {
              type: 'mcq_single',
              prompt,
              options: [
                { id: 'a', label: optionA },
                { id: 'b', label: optionB },
                { id: 'c', label: optionC },
                { id: 'd', label: optionD },
              ],
              correctOptionIds: [correct],
              marks: 1,
            },
          ],
        }),
      }),
    onSuccess: () => {
      setTitle('');
      setPrompt('');
      setNotice('Quiz published.');
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Quiz could not be published.'),
  });
  return (
    <section id="quizzes" className="section-card assignments-panel">
      <div className="resource-section-heading">
        <div>
          <span className="eyebrow">ASSESSMENT</span>
          <h2>Quizzes</h2>
          <p>Timed knowledge checks for this course.</p>
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
          <h3>Publish a quiz</h3>
          <label className="field">
            <span>Quiz title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
            />
          </label>
          <label className="field">
            <span>Question</span>
            <input
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={2000}
            />
          </label>
          <div className="quiz-option-grid">
            {[
              ['a', optionA, setA],
              ['b', optionB, setB],
              ['c', optionC, setC],
              ['d', optionD, setD],
            ].map(([id, value, setter]) => (
              <label className="field" key={String(id)}>
                <span>Option {String(id).toUpperCase()}</span>
                <input
                  required
                  value={String(value)}
                  onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="field">
            <span>Correct answer</span>
            <select value={correct} onChange={(e) => setCorrect(e.target.value)}>
              {['a', 'b', 'c', 'd'].map((id) => (
                <option key={id} value={id}>
                  Option {id.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <div className="assignment-form-row">
            <label className="field">
              <span>Time limit (minutes)</span>
              <input
                type="number"
                min="1"
                max="360"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Opens</span>
              <input
                type="datetime-local"
                required
                value={opens}
                onChange={(e) => setOpens(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Closes</span>
              <input
                type="datetime-local"
                required
                value={closes}
                onChange={(e) => setCloses(e.target.value)}
              />
            </label>
          </div>
          <button className="button button-primary" disabled={create.isPending}>
            {create.isPending ? 'Publishing…' : 'Publish quiz'}
          </button>
        </form>
      )}
      {quizzes.isLoading && (
        <div className="table-state">
          <span className="loader" />
          Loading quizzes…
        </div>
      )}
      {quizzes.isError && (
        <div className="table-state">
          <strong>Quizzes could not be loaded.</strong>
          <button className="button button-secondary" onClick={() => void quizzes.refetch()}>
            Try again
          </button>
        </div>
      )}
      {quizzes.data?.length === 0 && (
        <div className="table-state">
          <strong>No quizzes available</strong>
        </div>
      )}
      <div className="assignment-list">
        {quizzes.data?.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} staff={staff} />
        ))}
      </div>
    </section>
  );
}
function QuizCard({ quiz, staff }: { quiz: Quiz; staff: boolean }) {
  const client = useQueryClient();
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState('');
  const attempt = useQuery({
    queryKey: ['quiz-attempt', quiz.id],
    queryFn: () => apiRequest<Attempt | null>(`/quizzes/${quiz.id}/attempt`),
    enabled: !staff,
  });
  const start = useMutation({
    mutationFn: () => apiRequest(`/quizzes/${quiz.id}/start`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['quiz-attempt', quiz.id] }),
    onError: (e) => setMessage(e instanceof Error ? e.message : 'Quiz could not be started.'),
  });
  const submit = useMutation({
    mutationFn: () =>
      apiRequest<Attempt>(`/quizzes/${quiz.id}/submit`, {
        method: 'POST',
        body: jsonBody({ answers: selection }),
      }),
    onSuccess: (result) => {
      setMessage(`Submitted. Score: ${result.score ?? 0}`);
      client.invalidateQueries({ queryKey: ['quiz-attempt', quiz.id] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : 'Quiz could not be submitted.'),
  });
  const current = attempt.data;
  const available =
    Date.now() >= new Date(quiz.opens_at).getTime() &&
    Date.now() <= new Date(quiz.closes_at).getTime();
  return (
    <article className="assignment-card">
      <div className="assignment-card-heading">
        <div>
          <h3>{quiz.title}</h3>
          <span>
            {quiz.time_limit_minutes} minutes · {quiz.questions.length} question(s)
          </span>
        </div>
      </div>
      {quiz.description && <p>{quiz.description}</p>}
      {staff ? (
        <div className="quiz-preview">
          {quiz.questions.map((question) => (
            <p key={question.id}>{question.prompt}</p>
          ))}
        </div>
      ) : attempt.isLoading ? (
        <p>Checking your attempt…</p>
      ) : current?.submitted_at ? (
        <p className="quiz-result">Completed · {current.score} marks</p>
      ) : current ? (
        <div className="quiz-taking">
          {quiz.questions.map((question) => (
            <fieldset className="quiz-question" key={question.id}>
              <legend>
                {question.prompt} <small>{question.marks} mark(s)</small>
              </legend>
              {question.options.map((option) => (
                <label key={option.id}>
                  <input
                    type={question.type === 'mcq_multi' ? 'checkbox' : 'radio'}
                    name={question.id}
                    checked={(selection[question.id] ?? []).includes(option.id)}
                    onChange={(e) =>
                      setSelection((old) => ({
                        ...old,
                        [question.id]: e.target.checked
                          ? [...(old[question.id] ?? []), option.id]
                          : (old[question.id] ?? []).filter((id) => id !== option.id),
                      }))
                    }
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          ))}
          <button
            className="button button-primary"
            disabled={submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? 'Submitting…' : 'Submit answers'}
          </button>
        </div>
      ) : (
        <button
          className="button button-primary"
          disabled={!available || start.isPending}
          onClick={() => start.mutate()}
        >
          {!available ? 'Outside quiz window' : start.isPending ? 'Starting…' : 'Start quiz'}
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </article>
  );
}
