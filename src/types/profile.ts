export type UserRole = 'admin' | 'user';

export type Profile = {
  id: string;
  role: UserRole;
  created_at: string;
};
