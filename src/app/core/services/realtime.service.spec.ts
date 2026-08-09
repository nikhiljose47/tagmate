import { TestBed } from '@angular/core/testing';
import { RealtimeService } from './realtime.service';
import { SupabaseClientService } from './supabase-client.service';

describe('RealtimeService', () => {
  let service: RealtimeService;
  let clientServiceMock: { client: { channel: jasmine.Spy; removeChannel: jasmine.Spy } };
  let channelMock: Record<string, jasmine.Spy>;

  beforeEach(() => {
    channelMock = {
      on: jasmine.createSpy('on').and.callFake(() => channelMock),
      subscribe: jasmine.createSpy('subscribe').and.callFake(() => channelMock),
    };

    clientServiceMock = {
      client: {
        channel: jasmine.createSpy('channel').and.returnValue(channelMock),
        removeChannel: jasmine.createSpy('removeChannel'),
      },
    };

    TestBed.configureTestingModule({
      providers: [RealtimeService, { provide: SupabaseClientService, useValue: clientServiceMock }],
    });
    service = TestBed.inject(RealtimeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('creates a distinct channel for each live subscription', () => {
    const first = service.liveInserts('direct_messages').subscribe();
    const second = service.liveUpdates('direct_messages').subscribe();

    expect(clientServiceMock.client.channel.calls.count()).toBe(2);
    expect(clientServiceMock.client.channel.calls.argsFor(0)[0]).not.toBe(
      clientServiceMock.client.channel.calls.argsFor(1)[0],
    );
    first.unsubscribe();
    second.unsubscribe();
  });

  it('supports liveDeletes streams', () => {
    const deletes = service.liveDeletes('post_likes').subscribe();
    expect(clientServiceMock.client.channel.calls.count()).toBe(1);
    deletes.unsubscribe();
  });

  it('removes channel from client upon unsubscription', () => {
    const sub = service.liveInserts('notifications').subscribe();
    sub.unsubscribe();
    expect(clientServiceMock.client.removeChannel).toHaveBeenCalledWith(channelMock);
  });
});
