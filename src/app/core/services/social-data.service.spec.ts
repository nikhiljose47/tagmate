import { TestBed } from '@angular/core/testing';
import { SocialDataService } from './social-data.service';
import { SupabaseClientService } from './supabase-client.service';
import { of } from 'rxjs';

describe('SocialDataService', () => {
  let service: SocialDataService;
  let clientServiceMock: any;
  let fromMock: any;

  beforeEach(() => {
    fromMock = {
      select: jasmine.createSpy('select').and.returnValue({
        or: jasmine.createSpy('or').and.returnValue({
          order: jasmine.createSpy('order').and.returnValue(of({ data: [], error: null }))
        })
      })
    };

    clientServiceMock = {
      client: {
        from: jasmine.createSpy('from').and.returnValue(fromMock),
        rpc: jasmine.createSpy('rpc').and.returnValue(of({ data: null, error: null }))
      }
    };

    TestBed.configureTestingModule({
      providers: [
        SocialDataService,
        { provide: SupabaseClientService, useValue: clientServiceMock }
      ]
    });
    service = TestBed.inject(SocialDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should query DMs for a user', () => {
    service.getDirectMessagesForUser('user123').subscribe();
    expect(clientServiceMock.client.from).toHaveBeenCalledWith('direct_messages');
  });

  it('should call incrementCommentUpvote RPC', () => {
    service.incrementCommentUpvote('comment123').subscribe();
    expect(clientServiceMock.client.rpc).toHaveBeenCalledWith('increment_comment_upvote', {
      p_comment_id: 'comment123'
    });
  });
});
