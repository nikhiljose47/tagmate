import { TestBed } from '@angular/core/testing';
import { RealtimeService } from './realtime.service';
import { SupabaseClientService } from './supabase-client.service';

describe('RealtimeService', () => {
  let service: RealtimeService;
  let clientServiceMock: any;
  let channelMock: any;

  beforeEach(() => {
    channelMock = {
      on: jasmine.createSpy('on').and.returnValue({
        subscribe: jasmine.createSpy('subscribe').and.returnValue({})
      })
    };

    clientServiceMock = {
      client: {
        channel: jasmine.createSpy('channel').and.returnValue(channelMock),
        removeChannel: jasmine.createSpy('removeChannel')
      }
    };

    TestBed.configureTestingModule({
      providers: [
        RealtimeService,
        { provide: SupabaseClientService, useValue: clientServiceMock }
      ]
    });
    service = TestBed.inject(RealtimeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
