import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PostPublicationService } from './post-publication.service';
import { SupabaseService } from './supabase.service';

describe('PostPublicationService', () => {
  let service: PostPublicationService;
  let getRowsSpy: jasmine.Spy;
  let getAccessTokenSpy: jasmine.Spy;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    getRowsSpy = jasmine.createSpy('getRows').and.returnValue(of({ data: [], error: null }));
    getAccessTokenSpy = jasmine.createSpy('getAccessToken').and.resolveTo('test-token');
    fetchSpy = spyOn(window, 'fetch');

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseService,
          useValue: { getRows: getRowsSpy, getAccessToken: getAccessTokenSpy },
        },
      ],
    });
    service = TestBed.inject(PostPublicationService);
  });

  it('getForPost reads post_publications scoped to the given post', () => {
    service.getForPost('post-1').subscribe();
    expect(getRowsSpy).toHaveBeenCalledWith('post_publications', {
      field: 'post_id',
      op: '==',
      value: 'post-1',
    });
  });

  it('requestPublish posts destinations with a bearer token and returns the result', async () => {
    const result = { website: { status: 'published' }, instagram: { status: 'pending' } };
    fetchSpy.and.resolveTo(new Response(JSON.stringify(result)));

    const response = await service.requestPublish('post-1', ['website', 'instagram']);

    expect(response).toEqual(result as never);
    const [path, init] = fetchSpy.calls.mostRecent().args;
    expect(path).toBe('/api/posts/publish');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    expect(JSON.parse(init.body as string)).toEqual({
      postId: 'post-1',
      destinations: ['website', 'instagram'],
    });
  });

  it('retryInstagram posts the publicationId and throws the backend error on failure', async () => {
    fetchSpy.and.resolveTo(
      new Response(JSON.stringify({ error: 'Could not retry.' }), { status: 502 }),
    );
    await expectAsync(service.retryInstagram('pub-1')).toBeRejectedWithError('Could not retry.');
  });
});
