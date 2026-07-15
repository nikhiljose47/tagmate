import { TestBed } from '@angular/core/testing';
import { TagDataService } from './tag-data.service';
import { SupabaseClientService } from './supabase-client.service';
import { of } from 'rxjs';

describe('TagDataService', () => {
  let service: TagDataService;
  let clientServiceMock: any;
  let fromMock: any;

  beforeEach(() => {
    fromMock = {
      select: jasmine.createSpy('select').and.returnValue({
        eq: jasmine.createSpy('eq').and.returnValue({
          single: jasmine.createSpy('single').and.returnValue(of({ data: null, error: null })),
        }),
        order: jasmine.createSpy('order').and.returnValue({
          limit: jasmine.createSpy('limit').and.returnValue(of({ data: [], error: null })),
        }),
      }),
      insert: jasmine.createSpy('insert').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          single: jasmine.createSpy('single').and.returnValue(of({ data: {}, error: null })),
        }),
      }),
      delete: jasmine.createSpy('delete').and.returnValue({
        eq: jasmine.createSpy('eq').and.returnValue(of({ error: null })),
      }),
    };

    clientServiceMock = {
      client: {
        from: jasmine.createSpy('from').and.returnValue(fromMock),
        rpc: jasmine.createSpy('rpc').and.returnValue(of({ data: [], error: null })),
      },
    };

    TestBed.configureTestingModule({
      providers: [TagDataService, { provide: SupabaseClientService, useValue: clientServiceMock }],
    });
    service = TestBed.inject(TagDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call from with correct table when inserting a row', () => {
    service.addRow('tags', { highlight: 'test' }).subscribe();
    expect(clientServiceMock.client.from).toHaveBeenCalledWith('tags');
    expect(fromMock.insert).toHaveBeenCalledWith({ highlight: 'test' });
  });

  it('should call deleteRow on the correct table', () => {
    service.deleteRow('tags', '123').subscribe();
    expect(clientServiceMock.client.from).toHaveBeenCalledWith('tags');
    expect(fromMock.delete).toHaveBeenCalled();
  });

  it('should surface resolved Supabase errors through the observable error channel', (done) => {
    const databaseError = new Error('permission denied');
    fromMock.insert.and.returnValue({
      select: () => ({ single: () => of({ data: null, error: databaseError }) }),
    });

    service.addRow('tags', { highlight: 'blocked' }).subscribe({
      next: () => done.fail('expected an observable error'),
      error: (error) => {
        expect(error).toBe(databaseError);
        done();
      },
    });
  });
});
