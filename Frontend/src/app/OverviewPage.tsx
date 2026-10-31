import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
export default function OverviewPage() {
  const { profile } = useAuth();
  if (!profile) return null;
  const title =
    profile.role === 'admin'
      ? 'A clearer view of your campus.'
      : profile.role === 'teacher'
        ? 'Your teaching space is ready.'
        : 'A new day to make progress.';
  return (
    <main className="page-content overview-page">
      <div className="welcome-banner">
        <div>
          <span className="eyebrow eyebrow-light">MONDAY, YOUR CAMPUS IS IN SYNC</span>
          <h1>{title}</h1>
          <p>
            Welcome back, {profile.fullName.split(' ')[0]}. Your GUTECH workspace is ready when you
            are.
          </p>
          <Link
            className="button button-lime"
            to={profile.role === 'admin' ? '/admin/courses' : `/${profile.role}/courses`}
          >
            {profile.role === 'admin' ? 'Manage courses' : 'Open my courses'} <span>↗</span>
          </Link>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <span className="welcome-ring ring-one" />
          <span className="welcome-ring ring-two" />
          <span className="welcome-star">✳</span>
          <span className="welcome-tag">G / 26</span>
        </div>
      </div>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">YOUR CAMPUS / AT A GLANCE</span>
          <h2>Today at GUTECH</h2>
        </div>
        <span className="updated-pill">
          <i /> LIVE CAMPUS
        </span>
      </div>
      <div className="overview-grid">
        <article className="overview-card overview-card-dark">
          <span className="overview-card-icon">◫</span>
          <span className="overview-card-overline">YOUR SPACE</span>
          <h3>
            Learning,
            <br />
            in one place.
          </h3>
          <p>Your courses and campus activity will show up here as they become available.</p>
          <span className="card-decoration">01</span>
        </article>
        <article className="overview-card overview-card-lime">
          <span className="overview-card-icon">✳</span>
          <span className="overview-card-overline">STAY IN THE LOOP</span>
          <h3>
            Good things
            <br />
            are taking shape.
          </h3>
          <p>Your campus updates and important notices will appear here.</p>
          <span className="card-decoration">02</span>
        </article>
        <article className="overview-card overview-card-white">
          <span className="overview-card-icon">↗</span>
          <span className="overview-card-overline">YOUR ACCOUNT</span>
          <h3>
            All set,
            <br />
            {profile.fullName.split(' ')[0]}.
          </h3>
          <p>Your account is active. Keep your sign-in details safe.</p>
          <Link to="/profile" className="inline-link">
            View your profile <span>→</span>
          </Link>
          <span className="card-decoration">03</span>
        </article>
      </div>
    </main>
  );
}
