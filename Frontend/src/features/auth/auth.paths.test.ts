import { describe, expect, it } from 'vitest';
import { roleHome } from './auth.paths';

describe('role dashboard routing', () => {
  it('sends each account to its own workspace', () => {
    expect(roleHome('admin')).toBe('/admin');
    expect(roleHome('teacher')).toBe('/teacher');
    expect(roleHome('student')).toBe('/student');
  });
});
