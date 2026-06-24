import { TestBed } from '@angular/core/testing';

import { SharedStateService } from './shared-state.service';
import { testProviders } from '../test-providers';

describe('SharedStateService', () => {
  let service: SharedStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: testProviders,
      teardown: { destroyAfterEach: false },
    });
    service = TestBed.inject(SharedStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
