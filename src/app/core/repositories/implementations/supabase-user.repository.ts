import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AppUser } from '../../models/app-user.model';
import { TagDataService } from '../../services/tag-data.service';
import { CreateUserDto, IUserRepository } from '../interfaces/user.repository';

@Injectable({ providedIn: 'root' })
export class SupabaseUserRepository implements IUserRepository {
  private readonly tagData = inject(TagDataService);

  getById(uid: string): Observable<AppUser | null> {
    return this.tagData.getUserById(uid);
  }

  upsert(user: CreateUserDto): Observable<void> {
    return this.tagData
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
