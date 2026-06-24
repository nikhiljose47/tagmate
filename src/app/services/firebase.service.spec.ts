import { TestBed } from '@angular/core/testing';
import { FirestoreService } from './firebase.service';
import { testProviders } from '../test-providers';


describe('FirebaseService', () => {
  let service: FirestoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: testProviders,
      teardown: { destroyAfterEach: false },
    });
    service = TestBed.inject(FirestoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
