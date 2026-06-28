import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AppUser } from '../../models/app-user.model';
import { SupabaseService } from '../../services/supabase.service';
import { CreateUserDto, IUserRepository } from '../interfaces/user.repository';

@Injectable({ providedIn: 'root' })
export class SupabaseUserRepository implements IUserRepository {
  private readonly supabase = inject(SupabaseService);

  getById(uid: string): Observable<AppUser | null> {
    return this.supabase.getUserById(uid);
  }

  upsert(user: CreateUserDto): Observable<void> {
    return this.supabase
      .upsertRow('users', {
        uid:        user.uid,
        name:       user.name,
        is_guest:   user.isGuest,
        email:      user.email ?? null,
        created_at: new Date().toISOString(),
      })
      .pipe(map(() => undefined));
  }
}
