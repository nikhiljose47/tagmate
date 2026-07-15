import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { SupabaseClientService } from './supabase-client.service';

describe('StorageService', () => {
  let service: StorageService;
  let clientServiceMock: any;
  let storageMock: any;

  beforeEach(() => {
    storageMock = {
      from: jasmine.createSpy('from').and.returnValue({
        upload: jasmine.createSpy('upload').and.returnValue(Promise.resolve({ error: null })),
        getPublicUrl: jasmine
          .createSpy('getPublicUrl')
          .and.returnValue({ data: { publicUrl: 'https://example.com/test.jpg' } }),
      }),
    };

    clientServiceMock = {
      client: {
        storage: storageMock,
      },
    };

    TestBed.configureTestingModule({
      providers: [StorageService, { provide: SupabaseClientService, useValue: clientServiceMock }],
    });
    service = TestBed.inject(StorageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should upload file successfully', async () => {
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
    const url = await service.uploadFile('path/test.jpg', file);
    expect(storageMock.from).toHaveBeenCalledWith('tag-images');
    expect(url).toBe('https://example.com/test.jpg');
  });
});
