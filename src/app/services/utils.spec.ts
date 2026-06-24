import { TestBed } from '@angular/core/testing';

import { Utils } from './utils';
import { testProviders } from '../test-providers';

describe('Utils', () => {
  let service: Utils;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: testProviders,
      teardown: { destroyAfterEach: false },
    });
    service = TestBed.inject(Utils);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
