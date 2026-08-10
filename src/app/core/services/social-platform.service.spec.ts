import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { EMPTY, of, throwError } from 'rxjs';
import { SocialPlatformService } from './social-platform.service';
import { SupabaseService } from './supabase.service';
import { UserSessionService } from './user-session.service';
import { LoggerService } from './logger.service';
import { ToastService } from './toast.service';

describe('SocialPlatformService', () => {
  let service: SocialPlatformService;
  let supabase: jasmine.SpyObj<SupabaseService>;

  beforeEach(() => {
    supabase = jasmine.createSpyObj<SupabaseService>(
      'SupabaseService',
      [
        'addRow',
        'deleteRowsWhere',
        'getRows',
        'getDirectMessagesForUser',
        'liveInserts',
        'liveDeletes',
        'liveUpdates',
        'updateRowsWhere',
        'searchUsers',
        'callRpc',
        'getUserById',
        'getRowsIn',
        'updateRow',
      ],
      { session$: of(null) },
    );
    supabase.addRow.and.returnValue(
      of({ data: {}, error: null }) as unknown as ReturnType<typeof of>,
    );
    supabase.deleteRowsWhere.and.returnValue(
      of({ data: null, error: null }) as unknown as ReturnType<typeof of>,
    );
    supabase.liveInserts.and.returnValue(EMPTY);
    supabase.liveDeletes.and.returnValue(EMPTY);
    supabase.liveUpdates.and.returnValue(EMPTY);

    TestBed.configureTestingModule({
      providers: [
        SocialPlatformService,
        { provide: SupabaseService, useValue: supabase },
        {
          provide: UserSessionService,
          useValue: { user: signal({ uid: 'viewer', name: 'Viewer', isGuest: false }) },
        },
        {
          provide: LoggerService,
          useValue: jasmine.createSpyObj('LoggerService', ['warn', 'error']),
        },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['show']) },
      ],
    });
    service = TestBed.inject(SocialPlatformService);
  });

  it('tracks independent follows for people, topics, and neighborhoods', async () => {
    await service.toggleFollowUser('neighbor');
    await service.toggleFollowTopic('alert');
    await service.toggleFollowHood('Downtown');

    expect(service.isFollowingUser('neighbor')).toBeTrue();
    expect(service.isFollowingTopic('alert')).toBeTrue();
    expect(service.isFollowingHood('Downtown')).toBeTrue();
  });

  it('removes a followed user when blocking them', async () => {
    await service.toggleFollowUser('neighbor');
    await service.blockUser('neighbor');

    expect(service.isBlocked('neighbor')).toBeTrue();
    expect(service.isFollowingUser('neighbor')).toBeFalse();
  });

  it('rolls back a follow when the database write fails', async () => {
    supabase.addRow.and.returnValue(throwError(() => new Error('write failed')) as any);

    const enabled = await service.toggleFollowHood('Downtown');

    expect(enabled).toBeFalse();
    expect(service.isFollowingHood('Downtown')).toBeFalse();
    const toast = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
    expect(toast.show).toHaveBeenCalledWith('Could not save that change.', 'danger');
  });
});
