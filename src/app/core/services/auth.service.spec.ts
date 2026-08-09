import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SupabaseClientService } from './supabase-client.service';
import { firstValueFrom, of } from 'rxjs';
import { Session } from '@supabase/supabase-js';

type AuthMock = {
  getSession: jasmine.Spy;
  onAuthStateChange: jasmine.Spy;
  signInWithPassword: jasmine.Spy;
  signUp: jasmine.Spy;
  signOut: jasmine.Spy;
};

describe('AuthService', () => {
  let service: AuthService;
  let clientServiceMock: { client: { auth: AuthMock; from: jasmine.Spy } };
  let authMock: AuthMock;

  beforeEach(() => {
    authMock = {
      getSession: jasmine
        .createSpy('getSession')
        .and.returnValue(Promise.resolve({ data: { session: null } })),
      onAuthStateChange: jasmine.createSpy('onAuthStateChange').and.returnValue({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signInWithPassword: jasmine
        .createSpy('signInWithPassword')
        .and.returnValue(Promise.resolve({ data: {}, error: null })),
      signUp: jasmine
        .createSpy('signUp')
        .and.returnValue(Promise.resolve({ data: {}, error: null })),
      signOut: jasmine.createSpy('signOut').and.returnValue(Promise.resolve({ error: null })),
    };

    clientServiceMock = {
      client: {
        auth: authMock,
        from: jasmine.createSpy('from').and.returnValue({
          select: jasmine.createSpy('select').and.returnValue({
            ilike: jasmine.createSpy('ilike').and.returnValue({
              limit: jasmine.createSpy('limit').and.returnValue(of({ data: [] })),
            }),
          }),
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [AuthService, { provide: SupabaseClientService, useValue: clientServiceMock }],
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call signInWithPassword on the Supabase auth client', async () => {
    await service.signInWithPassword('test@example.com', 'password123').toPromise();
    expect(authMock.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should call signUp on the Supabase auth client', async () => {
    await service.signUp('test@example.com', 'password123', { username: 'testuser' }).toPromise();
    expect(authMock.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: { data: { username: 'testuser' } },
    });
  });

  it('should emit the restored session instead of a placeholder null', async () => {
    const restored = { user: { id: 'returning-user' } } as unknown as Session;
    TestBed.resetTestingModule();
    const freshAuth = {
      ...authMock,
      getSession: jasmine
        .createSpy('getSession')
        .and.returnValue(Promise.resolve({ data: { session: restored }, error: null })),
    };
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseClientService, useValue: { client: { auth: freshAuth } } },
      ],
    });

    const restoredService = TestBed.inject(AuthService);
    await expectAsync(firstValueFrom(restoredService.session$)).toBeResolvedTo(restored);
  });

  it('should unsubscribe from auth changes when destroyed', () => {
    const unsubscribe = jasmine.createSpy('unsubscribe');
    TestBed.resetTestingModule();
    const freshAuth = {
      ...authMock,
      onAuthStateChange: jasmine.createSpy('onAuthStateChange').and.returnValue({
        data: { subscription: { unsubscribe } },
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseClientService, useValue: { client: { auth: freshAuth } } },
      ],
    });
    const isolated = TestBed.inject(AuthService);

    isolated.ngOnDestroy();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
