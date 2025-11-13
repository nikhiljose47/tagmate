export interface UserModel {
  uid?: string;
  username: string;
  email: string | null;
  isGuest: boolean;
}
