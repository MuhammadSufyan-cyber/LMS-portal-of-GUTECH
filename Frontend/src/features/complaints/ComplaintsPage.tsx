import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiQuery, apiRequest, jsonBody } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
interface Complaint {
  id: string;
  category: string;
  subject: string;
  description: string;
  status: 'open' | 'in_review' | 'resolved' | 'rejected';
  admin_response: string | null;
  created_at: string;
  profile?: { full_name: string; email: string };
}
const labels = { open: 'Open', in_review: 'In review', resolved: 'Resolved', rejected: 'Rejected' };
export default function ComplaintsPage() {
  const { profile } = useAuth();
  const client = useQueryClient();
  const isAdmin = profile?.role === 'admin';
  const [category, setCategory] = useState('academic');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('');
  const complaints = useQuery({
    queryKey: ['complaints', isAdmin, filter],
    queryFn: () =>
      apiQuery<Complaint[]>(`/complaints?page=1&pageSize=50${filter ? `&status=${filter}` : ''}`),
  });
  const refresh = () => client.invalidateQueries({ queryKey: ['complaints'] });
  const create = useMutation({
    mutationFn: () =>
      apiRequest('/complaints', {
        method: 'POST',
        body: jsonBody({ category, subject, description }),
      }),
    onSuccess: () => {
      setSubject('');
      setDescription('');
      setNotice('Your complaint has been submitted.');
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not submit complaint.'),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      status,
      adminResponse,
    }: {
      id: string;
      status: string;
      adminResponse: string;
    }) =>
      apiRequest(`/complaints/${id}`, {
        method: 'PATCH',
        body: jsonBody({ status, adminResponse }),
      }),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not update complaint.'),
  });
  return (
    <main className="page-content complaint-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STUDENT SUPPORT</span>
          <h1>Complaints</h1>
          <p>Submit a concern and follow its progress with the university team.</p>
        </div>
        {isAdmin && (
          <label className="field complaint-filter">
            <span>Filter status</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
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
      {!isAdmin && (
        <form
          className="section-card complaint-form"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            create.mutate();
          }}
        >
          <h2>Raise a complaint</h2>
          <div className="assignment-form-row">
            <label className="field">
              <span>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {['academic', 'technical', 'facility', 'conduct', 'other'].map((value) => (
                  <option key={value} value={value}>
                    {value[0]?.toUpperCase()}
                    {value.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Subject</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                minLength={4}
                maxLength={180}
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Details</span>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minLength={10}
              maxLength={12000}
              required
              placeholder="Describe what happened and how it affected you."
            />
          </label>
          <button className="button button-primary" disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit complaint'}
          </button>
        </form>
      )}
      <section className="complaint-list-section">
        <h2>{isAdmin ? 'Complaint inbox' : 'Your submissions'}</h2>
        {complaints.isLoading && (
          <div className="table-state">
            <span className="loader" />
            Loading complaints…
          </div>
        )}
        {complaints.isError && (
          <div className="table-state">
            <strong>Complaints could not be loaded.</strong>
            <button className="button button-secondary" onClick={() => void complaints.refetch()}>
              Try again
            </button>
          </div>
        )}
        {complaints.data?.data.length === 0 && (
          <div className="section-card table-state">
            <strong>No complaints found</strong>
          </div>
        )}
        <div className="complaint-list">
          {complaints.data?.data.map((item) => (
            <ComplaintCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              busy={update.isPending}
              onSave={(status, adminResponse) =>
                update.mutate({ id: item.id, status, adminResponse })
              }
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function ComplaintCard({
  item,
  isAdmin,
  busy,
  onSave,
}: {
  item: Complaint;
  isAdmin: boolean;
  busy: boolean;
  onSave(status: string, adminResponse: string): void;
}) {
  const [status, setStatus] = useState(item.status);
  const [response, setResponse] = useState(item.admin_response ?? '');
  return (
    <article className="section-card complaint-card">
      <div className="complaint-card-heading">
        <div>
          <span className="eyebrow">{item.category.toUpperCase()}</span>
          <h3>{item.subject}</h3>
        </div>
        <span className={`complaint-status status-${item.status}`}>{labels[item.status]}</span>
      </div>
      {isAdmin && (
        <small>
          From {item.profile?.full_name} · {item.profile?.email}
        </small>
      )}
      <p>{item.description}</p>
      {item.admin_response && (
        <div className="complaint-response">
          <strong>University response</strong>
          <p>{item.admin_response}</p>
        </div>
      )}
      {isAdmin && (
        <div className="complaint-controls">
          <label className="field">
            <span>Update status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Complaint['status'])}
            >
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Response to student</span>
            <textarea
              rows={2}
              maxLength={4000}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
            />
          </label>
          <button
            className="button button-small button-secondary"
            disabled={busy}
            onClick={() => onSave(status, response)}
          >
            Save update
          </button>
        </div>
      )}
      {!isAdmin && <small>Submitted {new Date(item.created_at).toLocaleDateString()}</small>}
    </article>
  );
}
