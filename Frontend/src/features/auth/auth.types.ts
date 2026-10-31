export type UserRole = 'admin' | 'teacher' | 'student';
export interface Profile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: UserRole;
  rollNo: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
}
export interface ManagedUser extends Profile {
  createdAt: string;
}
