import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { firstValueFrom, Observable, of } from 'rxjs';
import { adminGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('adminGuard', () => {
  const deniedTree = {} as UrlTree;
  const router = {
    createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue(deniedTree),
  };

  async function runGuard(session: Session | null): Promise<boolean | UrlTree> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { session$: of(session) } },
        { provide: Router, useValue: router },
      ],
    });
    const result = TestBed.runInInjectionContext(() => adminGuard(null as never, null as never));
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  it('allows a user with the trusted admin app_metadata role', async () => {
    const session = { user: { app_metadata: { role: 'admin' } } } as unknown as Session;
    await expectAsync(runGuard(session)).toBeResolvedTo(true);
  });

  it('rejects a role supplied only through editable user_metadata', async () => {
    const session = {
      user: { app_metadata: {}, user_metadata: { role: 'admin' } },
    } as unknown as Session;
    await expectAsync(runGuard(session)).toBeResolvedTo(deniedTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/feed']);
  });
});
