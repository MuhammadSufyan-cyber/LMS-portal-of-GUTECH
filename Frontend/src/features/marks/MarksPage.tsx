import { useQuery } from '@tanstack/react-query';
import { apiQuery } from '../../lib/api';
interface Mark {
  course_id: string;
  kind: 'assignment' | 'quiz';
  item_id: string;
  title: string;
  obtained: number;
  max: number;
  graded_at: string;
}
export default function MarksPage() {
  const marks = useQuery({
    queryKey: ['marks'],
    queryFn: () => apiQuery<Mark[]>('/me/marks?page=1&pageSize=100'),
  });
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACADEMIC RECORD</span>
          <h1>My marks</h1>
          <p>Graded assignments and submitted quiz results.</p>
        </div>
      </div>
      {marks.isLoading && (
        <div className="table-state">
          <span className="loader" />
          Loading marks…
        </div>
      )}
      {marks.isError && (
        <div className="table-state">
          <strong>Marks could not be loaded.</strong>
          <button className="button button-secondary" onClick={() => void marks.refetch()}>
            Try again
          </button>
        </div>
      )}
      {marks.data?.data.length === 0 && (
        <div className="section-card table-state">
          <strong>No marks recorded yet</strong>
          <span>Grades appear here when your work is reviewed.</span>
        </div>
      )}
      {marks.data?.data.length ? (
        <div className="marks-grid">
          {marks.data.data.map((item) => (
            <article className="section-card mark-card" key={`${item.kind}-${item.item_id}`}>
              <span className="eyebrow">{item.kind.toUpperCase()}</span>
              <h2>{item.title}</h2>
              <strong>
                {item.obtained}
                <small> / {item.max}</small>
              </strong>
              <span>{new Date(item.graded_at).toLocaleDateString()}</span>
            </article>
          ))}
        </div>
      ) : null}
    </main>
  );
}
