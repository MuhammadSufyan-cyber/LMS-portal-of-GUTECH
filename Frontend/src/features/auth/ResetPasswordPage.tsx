import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, jsonBody, ApiError } from '../../lib/api';
import { Brand } from './ForgotPasswordPage';

const schema = z
  .object({
    newPassword: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .regex(/[A-Za-z]/, 'Add a letter.')
      .regex(/[0-9]/, 'Add a number.'),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
type Values = z.infer<typeof schema>;
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const tokenHash = params.get('token_hash') ?? '';
  const [complete, setComplete] = useState(false);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  const password = watch('newPassword') ?? '';
  const strength = useMemo(
    () =>
      [password.length >= 10, /[A-Za-z]/.test(password), /[0-9]/.test(password)].filter(Boolean)
        .length,
    [password],
  );
  const submit = handleSubmit(async ({ newPassword }) => {
    setServerError('');
    try {
      await apiRequest(
        '/auth/reset-password',
        { method: 'POST', body: jsonBody({ tokenHash, newPassword }) },
        null,
      );
      setComplete(true);
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : 'This reset link has expired or cannot be used.',
      );
    }
  });
  return (
    <main className="center-page">
      <div className="center-card">
        <Brand />
        <div className="auth-heading">
          <span className="auth-kicker">SECURE ACCOUNT</span>
          <h2>{complete ? 'Password updated' : 'Choose a new password'}</h2>
          <p>
            {complete
              ? 'Your password is ready. Sign in with your new credentials.'
              : 'Use at least 10 characters, with one letter and one number.'}
          </p>
        </div>
        {serverError && (
          <div className="alert alert-error" role="alert">
            {serverError}
          </div>
        )}
        {!complete && tokenHash && (
          <form onSubmit={submit} className="form-stack">
            <label className="field">
              <span>New password</span>
              <input type="password" autoComplete="new-password" {...register('newPassword')} />
              {errors.newPassword && (
                <small className="field-error">{errors.newPassword.message}</small>
              )}
            </label>
            <div className="strength-meter" aria-label={`Password strength ${strength} of 3`}>
              {[1, 2, 3].map((part) => (
                <i key={part} className={part <= strength ? 'active' : ''} />
              ))}
            </div>
            <label className="field">
              <span>Confirm password</span>
              <input type="password" autoComplete="new-password" {...register('confirmPassword')} />
              {errors.confirmPassword && (
                <small className="field-error">{errors.confirmPassword.message}</small>
              )}
            </label>
            <button className="button button-primary button-wide" disabled={isSubmitting}>
              {isSubmitting ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
        {!complete && !tokenHash && (
          <div className="alert alert-error">
            This reset link is incomplete or expired. Request a new link to continue.
          </div>
        )}
        <Link className="back-link" to="/login">
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}
