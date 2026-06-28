import { Observable } from 'rxjs';
import { AppUser } from '../../models/app-user.model';

export interface CreateUserDto {
  uid: string;
  name: string;
  isGuest: boolean;
  email?: string | null;
}

export interface IUserRepository {
  getById(uid: string): Observable<AppUser | null>;
  upsert(user: CreateUserDto): Observable<void>;
}
