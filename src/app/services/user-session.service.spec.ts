import { TestBed } from '@angular/core/testing';

import { UserSessionService } from './user-session.service';
import { testProviders } from '../test-providers';

describe('UserSessionService', () => {
  let service: UserSessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: testProviders,
      teardown: { destroyAfterEach: false },
    });
    service = TestBed.inject(UserSessionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
