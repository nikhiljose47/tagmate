import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { UserSessionService } from './user-session.service';

describe('UserSessionService', () => {
  let service: UserSessionService;
  let supabase: jasmine.SpyObj<SupabaseService>;

  beforeEach(() => {
    supabase = jasmine.createSpyObj<SupabaseService>(
      'SupabaseService',
      ['signInWithPassword', 'signInWithUsername'],
      { session$: of(null) },
    );
    const successfulLogin = of({
      data: {
        user: { id: 'user-1', email: 'user@example.com', user_metadata: { username: 'handle' } },
      },
      error: null,
    });
    supabase.signInWithUsername.and.returnValue(
      successfulLogin as unknown as ReturnType<typeof supabase.signInWithUsername>,
    );
    supabase.signInWithPassword.and.returnValue(
      successfulLogin as unknown as ReturnType<typeof supabase.signInWithPassword>,
    );

    TestBed.configureTestingModule({
      providers: [
        UserSessionService,
        { provide: SupabaseService, useValue: supabase },
        { provide: Store, useValue: { dispatch: jasmine.createSpy('dispatch') } },
      ],
    });
    service = TestBed.inject(UserSessionService);
  });

  it('routes @handle to username authentication', async () => {
    await service.login('@handle', 'Password123!');

    expect(supabase.signInWithUsername).toHaveBeenCalledWith('@handle', 'Password123!');
    expect(supabase.signInWithPassword).not.toHaveBeenCalled();
  });

  it('routes a complete email address to email authentication', async () => {
    await service.login('user@example.com', 'Password123!');

    expect(supabase.signInWithPassword).toHaveBeenCalledWith('user@example.com', 'Password123!');
    expect(supabase.signInWithUsername).not.toHaveBeenCalled();
  });
});
