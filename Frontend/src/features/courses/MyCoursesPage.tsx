import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiQuery } from '../../lib/api';

interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
}
const accents = ['moss', 'plum', 'citrus', 'ocean'];
export default function MyCoursesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-courses', page],
    queryFn: () => apiQuery<Course[]>(`/me/courses?page=${page}&pageSize=12`),
  });
  const courses = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR LEARNING / CATALOG</span>
          <h1>My courses</h1>
          <p>The spaces where your classes come together.</p>
        </div>
      </div>
      <div className="my-courses-intro">
        <div>
          <span className="eyebrow eyebrow-light">YOUR CURRENT TERM</span>
          <h2>Find your next idea.</h2>
        </div>
        <span className="my-courses-count">
          {String(total).padStart(2, '0')} <small>COURSES</small>
        </span>
      </div>
      {isLoading && (
        <div className="course-grid">
          {[1, 2, 3].map((n) => (
            <div className="course-skeleton" key={n} />
          ))}
        </div>
      )}
      {isError && (
        <div className="section-card table-state">
          <strong>Couldn’t load your courses.</strong>
          <button className="button button-secondary" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      )}
      {!isLoading && !isError && courses.length === 0 && (
        <div className="section-card table-state">
          <span className="empty-icon">◫</span>
          <strong>No courses are assigned to you yet</strong>
          <span>Once an administrator adds you to a course, it will appear here.</span>
        </div>
      )}
      {courses.length > 0 && (
        <>
          <div className="course-grid">
            {courses.map((course, index) => (
              <Link
                to={`/courses/${course.id}`}
                className="course-card my-course-card"
                key={course.id}
              >
                <div className={`course-card-cover cover-${accents[index % accents.length]}`}>
                  <span className="course-code">{course.code}</span>
                  <span className="course-symbol">{['◈', '✳', '⌘', '◉'][index % 4]}</span>
                  <span className="course-cover-line" />
                </div>
                <div className="course-card-body">
                  <div className="course-card-meta">
                    <span>YOUR CLASS</span>
                    <span className="course-card-index">
                      {String((page - 1) * 12 + index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h2>{course.title}</h2>
                  <p>
                    {course.description || 'Your learning materials and class activity live here.'}
                  </p>
                  <span className="inline-link">
                    Open course <span>→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
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
        </>
      )}
    </main>
  );
}
