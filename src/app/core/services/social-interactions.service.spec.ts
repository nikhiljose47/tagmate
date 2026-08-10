import { TestBed } from '@angular/core/testing';
import { EMPTY, of } from 'rxjs';
import { SocialInteractionsService } from './social-interactions.service';
import { SupabaseService } from './supabase.service';
import { UserSessionService } from './user-session.service';
import { LoggerService } from './logger.service';
import { ToastService } from './toast.service';
import { ConfirmDialogService } from './confirm-dialog.service';
import { CommentService } from './comment.service';
import { MessagingService } from './messaging.service';
import { NotificationService } from './notification.service';
import { NetworkService } from './network.service';
import { SocialPlatformService } from './social-platform.service';
import { TelemetryService } from './telemetry.service';
import { TAG_REPOSITORY } from '../repositories/repository.tokens';
import { Tag } from '../models/tag.model';

describe('SocialInteractionsService', () => {
  let service: SocialInteractionsService;

  beforeEach(() => {
    const supabase = {
      session$: of(null),
      liveInserts: () => EMPTY,
      liveUpdates: () => EMPTY,
      liveDeletes: () => EMPTY,
    };

    TestBed.configureTestingModule({
      providers: [
        SocialInteractionsService,
        { provide: SupabaseService, useValue: supabase },
        { provide: UserSessionService, useValue: { user$: of({ username: 'Guest' }) } },
        { provide: LoggerService, useValue: {} },
        { provide: ToastService, useValue: {} },
        { provide: ConfirmDialogService, useValue: {} },
        { provide: CommentService, useValue: {} },
        { provide: MessagingService, useValue: {} },
        { provide: NotificationService, useValue: {} },
        { provide: NetworkService, useValue: { isOnline: () => true } },
        { provide: SocialPlatformService, useValue: {} },
        { provide: TelemetryService, useValue: {} },
        { provide: TAG_REPOSITORY, useValue: {} },
      ],
    });
    service = TestBed.inject(SocialInteractionsService);
  });

  it('uses the refreshed aggregate instead of adding the same optimistic like twice', () => {
    const post = { id: 'post-1', likeCount: 1 } as Tag;
    (service as any).likeOverlays.set({ 'post-1': { baseCount: 1, delta: 1 } });

    expect(service.likeCount(post)).toBe(2);
    expect(service.likeCount({ ...post, likeCount: 2 })).toBe(2);
  });
});
