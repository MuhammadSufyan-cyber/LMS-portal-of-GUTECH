import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError, apiRequest, jsonBody, setAccessToken } from '../../lib/api';
import { useAuth } from './AuthProvider';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
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
const roleNames = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };
export default function ProfilePage() {
  const { profile, updateProfile } = useAuth();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  const password = watch('newPassword') ?? '';
  const score = [password.length >= 10, /[A-Za-z]/.test(password), /[0-9]/.test(password)].filter(
    Boolean,
  ).length;
  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setDone(false);
    setServerError('');
    try {
      const next = await apiRequest<{ accessToken: string }>('/auth/change-password', {
        method: 'POST',
        body: jsonBody({ currentPassword, newPassword }),
      });
      setAccessToken(next.accessToken);
      updateProfile({ ...profile!, mustChangePassword: false });
      setDone(true);
      reset();
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'The password could not be changed.',
      );
    }
  });
  if (!profile) return null;
  return (
    <section className="page-content profile-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SPACE / ACCOUNT</span>
          <h1>Profile</h1>
          <p>Your GUTECH account details and security settings.</p>
        </div>
      </div>
      {profile.mustChangePassword && (
        <div className="alert alert-warning">
          <span className="warning-icon">!</span>
          <span>
            <strong>One quick security step</strong>
            <br />
            Set a new password to finish securing your account.
          </span>
        </div>
      )}
      <div className="profile-grid">
        <section className="section-card profile-summary">
          <div className="profile-banner">
            <span className="avatar avatar-large">
              {profile.fullName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join('')}
            </span>
            <span className="profile-banner-orbit">✳</span>
          </div>
          <div className="profile-identity">
            <h2>{profile.fullName}</h2>
            <p>{profile.email}</p>
            <span className={`role-chip role-${profile.role}`}>{roleNames[profile.role]}</span>
          </div>
          <dl className="profile-facts">
            <div>
              <dt>FULL NAME</dt>
              <dd>{profile.fullName}</dd>
            </div>
            <div>
              <dt>EMAIL ADDRESS</dt>
              <dd>{profile.email}</dd>
            </div>
            <div>
              <dt>ACCOUNT ROLE</dt>
              <dd>{roleNames[profile.role]}</dd>
            </div>
            {profile.rollNo && (
              <div>
                <dt>ROLL NUMBER</dt>
                <dd>{profile.rollNo}</dd>
              </div>
            )}
          </dl>
          <div className="profile-footnote">
            <i />
            Active GUTECH account
          </div>
        </section>
        <section className="section-card security-card">
          <div className="card-title-row">
            <div>
              <span className="eyebrow">SECURITY</span>
              <h2>Change password</h2>
              <p>Use a password you don’t use anywhere else.</p>
            </div>
            <span className="security-badge">⌑</span>
          </div>
          {done && (
            <div className="alert alert-success" role="status">
              Password updated successfully.
            </div>
          )}
          {serverError && (
            <div className="alert alert-error" role="alert">
              {serverError}
            </div>
          )}
          <form className="form-stack" onSubmit={submit}>
            <label className="field">
              <span>Current password</span>
              <input
                type="password"
                autoComplete="current-password"
                {...register('currentPassword')}
              />
              {errors.currentPassword && (
                <small className="field-error">{errors.currentPassword.message}</small>
              )}
            </label>
            <label className="field">
              <span>New password</span>
              <input type="password" autoComplete="new-password" {...register('newPassword')} />
              {errors.newPassword && (
                <small className="field-error">{errors.newPassword.message}</small>
              )}
            </label>
            <div className="strength-row">
              <div className="strength-meter">
                {[1, 2, 3].map((part) => (
                  <i key={part} className={part <= score ? 'active' : ''} />
                ))}
              </div>
              <small>
                {score < 2
                  ? 'Add at least 10 characters, a letter and a number'
                  : score === 2
                    ? 'Almost there'
                    : 'Password requirements met'}
              </small>
            </div>
            <label className="field">
              <span>Confirm new password</span>
              <input type="password" autoComplete="new-password" {...register('confirmPassword')} />
              {errors.confirmPassword && (
                <small className="field-error">{errors.confirmPassword.message}</small>
              )}
            </label>
            <button className="button button-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}
