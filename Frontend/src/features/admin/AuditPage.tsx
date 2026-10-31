import { useQuery } from '@tanstack/react-query';
import { apiQuery } from '../../lib/api';
interface Audit {
  id: number;
  action: string;
  entity: string;
  entity_id: string;
  at: string;
  profile?: { full_name: string; email: string };
}
export default function AuditPage() {
  const audit = useQuery({
    queryKey: ['audit'],
    queryFn: () => apiQuery<Audit[]>('/admin/audit?page=1&pageSize=50'),
  });
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SYSTEM HISTORY</span>
          <h1>Audit log</h1>
          <p>Recent administrative and learning activity.</p>
        </div>
      </div>
      {audit.isLoading && (
        <div className="table-state">
          <span className="loader" />
          Loading audit history…
        </div>
      )}
      {audit.isError && (
        <div className="table-state">
          <strong>Audit history could not be loaded.</strong>
          <button className="button button-secondary" onClick={() => void audit.refetch()}>
            Try again
          </button>
        </div>
      )}
      {audit.data?.data.length === 0 && (
        <div className="section-card table-state">No activity recorded yet.</div>
      )}
      {audit.data?.data.length ? (
        <div className="audit-list">
          {audit.data.data.map((row) => (
            <article className="section-card audit-row" key={row.id}>
              <div>
                <strong>{row.action.replaceAll('.', ' ')}</strong>
                <span>
                  {row.profile?.full_name ?? 'System'} · {row.profile?.email ?? 'system action'}
                </span>
              </div>
              <time>{new Date(row.at).toLocaleString()}</time>
            </article>
          ))}
        </div>
      ) : null}
    </main>
  );
}
