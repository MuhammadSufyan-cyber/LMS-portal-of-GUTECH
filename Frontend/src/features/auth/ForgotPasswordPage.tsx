import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, jsonBody, ApiError } from '../../lib/api';

const schema = z.object({ email: z.string().email('Enter a valid email address.') });
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async ({ email }) => {
    setError('');
    try {
      await apiRequest(
        '/auth/forgot-password',
        { method: 'POST', body: jsonBody({ email }) },
        null,
      );
      setSent(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to submit this request.');
    }
  });
  return (
    <main className="center-page">
      <div className="center-card">
        <Brand />
        <div className="auth-heading">
          <span className="auth-kicker">ACCOUNT RECOVERY</span>
          <h2>{sent ? 'Check your inbox' : 'Reset your password'}</h2>
          <p>
            {sent
              ? 'If the account exists, a reset link has been sent. The link expires after one hour.'
              : 'Enter your institutional email and we’ll send a secure reset link.'}
          </p>
        </div>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {!sent && (
          <form onSubmit={submit} className="form-stack">
            <label className="field">
              <span>Institutional email</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@gutech.edu"
                {...register('email')}
              />
              {errors.email && <small className="field-error">{errors.email.message}</small>}
            </label>
            <button className="button button-primary button-wide" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <Link className="back-link" to="/login">
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">G</span>
      <span>
        GUTECH<span className="brand-muted"> / LEARN</span>
      </span>
    </div>
  );
}
