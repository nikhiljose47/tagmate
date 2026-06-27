import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { testProviders } from '../test-providers';

describe('SupabaseService', () => {
  let service: SupabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...testProviders,
        {
          provide: SupabaseService,
          useValue: jasmine.createSpyObj('SupabaseService',
            ['signInWithPassword', 'signInAnonymously', 'signOut', 'addRow', 'getRows', 'deleteRow', 'upsertRow'],
            { session$: of(null) }
          ),
        },
      ],
      teardown: { destroyAfterEach: false },
    });
    service = TestBed.inject(SupabaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
