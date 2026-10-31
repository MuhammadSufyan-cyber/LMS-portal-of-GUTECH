import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '../../lib/api';
import { useAuth } from './AuthProvider';
import { postLoginPath } from './auth.paths';

const schema = z.object({
  email: z.string().min(3, 'Enter your email or username.'),
  password: z.string().min(1, 'Enter your password.'),
});
type LoginValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { profile, ready, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(schema) });
  if (ready && profile)
    return <Navigate to={postLoginPath(profile, location.state?.from)} replace />;
  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      const next = await signIn(values.email, values.password);
      navigate(postLoginPath(next, location.state?.from), {
        replace: true,
      });
    } catch (error) {
      setServerError(
        error instanceof ApiError && error.status === 429
          ? error.message
          : 'Invalid email or password',
      );
    }
  });
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand brand-light">
          <span className="brand-mark">G</span>
          <span>
            GUTECH<span className="brand-muted"> / LEARN</span>
          </span>
        </div>
        <div className="story-copy">
          <p className="eyebrow eyebrow-light">ONE CAMPUS. EVERY POSSIBILITY.</p>
          <h1>
            Make room
            <br />
            for what’s next.
          </h1>
          <p className="story-text">
            Your courses, conversations, and progress — all in one considered space.
          </p>
        </div>
        <div className="story-footer">
          <span className="story-orbit" aria-hidden="true">
            ✳
          </span>
          <span>Learning, built around you.</span>
        </div>
        <div className="story-grid" aria-hidden="true" />
      </section>
      <section className="auth-main">
        <div className="auth-mobile-brand brand">
          <span className="brand-mark">G</span>
          <span>
            GUTECH<span className="brand-muted"> / LEARN</span>
          </span>
        </div>
        <div className="login-card">
          <div className="auth-heading">
            <span className="auth-kicker">SECURE CAMPUS ACCESS</span>
            <h2>Welcome back</h2>
            <p>Sign in with the credentials from your administrator.</p>
          </div>
          {serverError && (
            <div className="alert alert-error" role="alert">
              <span aria-hidden="true">!</span>
              {serverError}
            </div>
          )}
          <form onSubmit={submit} className="form-stack" noValidate>
            <label className="field">
              <span>Email or username</span>
              <input
                type="text"
                autoComplete="username"
                placeholder="you@gutech.edu or username"
                {...register('email')}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <small className="field-error">{errors.email.message}</small>}
            </label>
            <label className="field">
              <span>Password</span>
              <span className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  {...register('password')}
                  aria-invalid={Boolean(errors.password)}
                />
                <button
                  className="text-button reveal-button"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
              {errors.password && <small className="field-error">{errors.password.message}</small>}
            </label>
            <div className="form-meta">
              <span>
                <span className="secure-dot" /> Protected account
              </span>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
            <button
              className="button button-primary button-wide"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="button-spinner" /> Signing in…
                </>
              ) : (
                <>
                  Sign in <span aria-hidden="true">↗</span>
                </>
              )}
            </button>
          </form>
          <div className="auth-footnote">
            <span className="lock-icon" aria-hidden="true">
              ▣
            </span>
            <span>
              Access is managed by your administrator.
              <br />
              New accounts are issued by GUTECH staff.
            </span>
          </div>
        </div>
        <footer className="auth-copyright">
          <span>GUTECH INTERNAL LMS</span>
          <span>© 2026 GUTECH</span>
        </footer>
      </section>
    </main>
  );
}
