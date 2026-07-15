import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CommentService } from './comment.service';
import { MessagingService } from './messaging.service';
import { NotificationService } from './notification.service';
import { RelationshipService } from './relationship.service';
import { PostTrustService } from './post-trust.service';
import { SupabaseService } from './supabase.service';

describe('focused social API services', () => {
  const supabase = jasmine.createSpyObj<SupabaseService>('SupabaseService', [
    'addRow',
    'updateRow',
    'updateRowsWhere',
    'deleteRowsWhere',
  ]);

  beforeEach(() => {
    supabase.addRow.and.returnValue(of({ data: {}, error: null }) as never);
    supabase.updateRow.and.returnValue(of({ data: {}, error: null }) as never);
    supabase.updateRowsWhere.and.returnValue(of({ data: [], error: null }) as never);
    supabase.deleteRowsWhere.and.returnValue(of({ data: null, error: null }) as never);
    TestBed.configureTestingModule({
      providers: [
        CommentService,
        MessagingService,
        NotificationService,
        RelationshipService,
        PostTrustService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
  });

  it('writes and soft-deletes comments through the comment boundary', () => {
    const service = TestBed.inject(CommentService);
    service.create({
      post_id: 'post-1',
      parent_id: null,
      author_uid: 'user-1',
      author_name: 'User',
      text: 'Hello',
      mentions: [],
    });
    service.softDelete('comment-1', '2026-07-15T00:00:00.000Z');

    expect(supabase.addRow).toHaveBeenCalledWith('post_comments', jasmine.any(Object));
    expect(supabase.updateRow).toHaveBeenCalledWith(
      'post_comments',
      'comment-1',
      jasmine.objectContaining({ text: '', deleted_at: '2026-07-15T00:00:00.000Z' }),
    );
  });

  it('writes direct messages and thread read state through the messaging boundary', () => {
    const service = TestBed.inject(MessagingService);
    service.sendDirectMessage({
      thread_id: 'thread-1',
      post_id: null,
      from_uid: 'user-1',
      to_uid: 'user-2',
      to_name: 'User two',
      text: 'Hi',
      read: false,
    });
    service.markThreadRead('thread-1', 'user-2', '2026-07-15T00:00:00.000Z');

    expect(supabase.addRow).toHaveBeenCalledWith('direct_messages', jasmine.any(Object));
    expect(supabase.updateRowsWhere).toHaveBeenCalledWith(
      'direct_messages',
      { thread_id: 'thread-1', to_uid: 'user-2' },
      jasmine.objectContaining({ read: true }),
    );
  });

  it('updates notification read state through the notification boundary', () => {
    TestBed.inject(NotificationService).markAllRead('user-1', '2026-07-15T00:00:00.000Z');

    expect(supabase.updateRowsWhere).toHaveBeenCalledWith(
      'notifications',
      { user_id: 'user-1' },
      jasmine.objectContaining({ read: true }),
    );
  });

  it('uses focused relationship and post-trust boundaries', () => {
    TestBed.inject(RelationshipService).reportUser('user-2', 'user-1', 'spam');
    TestBed.inject(PostTrustService).setConfirmation('post-1', 'user-1', true);
    TestBed.inject(PostTrustService).addStatus('post-1', 'user-1', 'resolved', null);

    expect(supabase.addRow).toHaveBeenCalledWith(
      'user_reports',
      jasmine.objectContaining({ reported_user_id: 'user-2' }),
    );
    expect(supabase.addRow).toHaveBeenCalledWith(
      'post_confirmations',
      jasmine.objectContaining({ post_id: 'post-1' }),
    );
    expect(supabase.addRow).toHaveBeenCalledWith(
      'post_status_history',
      jasmine.objectContaining({ status: 'resolved' }),
    );
  });
});
