import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiQuery, apiRequest, jsonBody } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
interface Announcement {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_read: boolean;
  created_at: string;
  author?: { full_name: string };
}
interface Message {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profile?: { full_name: string };
}
export default function CommunicationPanel({ courseId }: { courseId: string }) {
  const { profile } = useAuth();
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const staff = profile?.role === 'admin' || profile?.role === 'teacher';
  const announcements = useQuery({
    queryKey: ['announcements', courseId],
    queryFn: () =>
      apiQuery<Announcement[]>(`/courses/${courseId}/announcements?page=1&pageSize=20`),
  });
  const messages = useQuery({
    queryKey: ['messages', courseId],
    queryFn: () => apiQuery<Message[]>(`/courses/${courseId}/messages?page=1&pageSize=50`),
    refetchInterval: 8000,
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['announcements', courseId] });
    void client.invalidateQueries({ queryKey: ['messages', courseId] });
  };
  const post = useMutation({
    mutationFn: () =>
      apiRequest(`/courses/${courseId}/announcements`, {
        method: 'POST',
        body: jsonBody({ title, body, isPinned: false }),
      }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Announcement could not be posted.'),
  });
  const send = useMutation({
    mutationFn: () =>
      apiRequest(`/courses/${courseId}/messages`, {
        method: 'POST',
        body: jsonBody({ body: message }),
      }),
    onSuccess: () => {
      setMessage('');
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Message could not be sent.'),
  });
  const mark = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/courses/${courseId}/announcements/${id}/read`, { method: 'POST' }),
    onSuccess: refresh,
  });
  return (
    <div className="communication-grid" id="announcements">
      <section className="section-card assignments-panel">
        <div className="resource-section-heading">
          <div>
            <span className="eyebrow">COURSE BULLETIN</span>
            <h2>Announcements</h2>
            <p>Updates from the teaching team.</p>
          </div>
        </div>
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
              post.mutate();
            }}
          >
            <label className="field">
              <span>Announcement title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={180}
              />
            </label>
            <label className="field">
              <span>Message</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                maxLength={12000}
                rows={3}
              />
            </label>
            <button className="button button-primary" disabled={post.isPending}>
              {post.isPending ? 'Posting…' : 'Post announcement'}
            </button>
          </form>
        )}
        {announcements.isLoading && <div className="table-state">Loading announcements…</div>}
        {announcements.isError && <div className="table-state">Announcements are unavailable.</div>}
        {announcements.data?.data.length === 0 && (
          <div className="table-state">
            <strong>No announcements yet</strong>
          </div>
        )}
        <div className="announcement-list">
          {announcements.data?.data.map((item) => (
            <article
              className={`announcement-card${item.is_read ? ' announcement-read' : ''}`}
              key={item.id}
            >
              <div>
                <h3>{item.title}</h3>
                <small>
                  {item.author?.full_name ?? 'Course staff'} ·{' '}
                  {new Date(item.created_at).toLocaleDateString()}
                </small>
              </div>
              <p>{item.body}</p>
              {!item.is_read && (
                <button className="text-button" onClick={() => mark.mutate(item.id)}>
                  Mark as read
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="section-card assignments-panel chat-panel" id="chat">
        <div className="resource-section-heading">
          <div>
            <span className="eyebrow">CLASS DISCUSSION</span>
            <h2>Course chat</h2>
            <p>Messages refresh automatically.</p>
          </div>
          <button
            className="icon-button"
            aria-label="Refresh chat"
            onClick={() => void messages.refetch()}
          >
            ↻
          </button>
        </div>
        {messages.isLoading && <div className="table-state">Loading messages…</div>}
        {messages.isError && <div className="table-state">Chat is temporarily unavailable.</div>}
        <div className="chat-messages" aria-live="polite">
          {messages.data?.data.map((item) => (
            <article
              className={`chat-message${item.sender_id === profile?.id ? ' chat-message-own' : ''}`}
              key={item.id}
            >
              <strong>{item.profile?.full_name ?? 'Member'}</strong>
              <p>{item.body}</p>
              <small>
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </small>
            </article>
          ))}
          {messages.data?.data.length === 0 && (
            <div className="table-state">Start the conversation.</div>
          )}
        </div>
        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <input
            aria-label="Message"
            placeholder="Write a message…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
          />
          <button className="button button-primary" disabled={!message.trim() || send.isPending}>
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
