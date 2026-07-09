import { TestBed } from '@angular/core/testing';
import { DmInboxComponent } from './dm-inbox';
import { testProviders } from '../../../../test-providers';
import { SocialDataService } from '../../../../core/services/social-data.service';
import { TagDataService } from '../../../../core/services/tag-data.service';
import { of } from 'rxjs';

describe('DmInboxComponent', () => {
  let socialDataSpy: jasmine.SpyObj<SocialDataService>;
  let tagDataSpy: jasmine.SpyObj<TagDataService>;

  beforeEach(async () => {
    socialDataSpy = jasmine.createSpyObj('SocialDataService', ['getDirectMessagesForUser']);
    tagDataSpy = jasmine.createSpyObj('TagDataService', ['getRowsIn']);

    socialDataSpy.getDirectMessagesForUser.and.returnValue(of({ data: [], error: null }));
    tagDataSpy.getRowsIn.and.returnValue(of({ data: [], error: null }));

    await TestBed.configureTestingModule({
      imports: [DmInboxComponent],
      providers: [
        ...testProviders,
        { provide: SocialDataService, useValue: socialDataSpy },
        { provide: TagDataService, useValue: tagDataSpy },
      ],
    }).compileComponents();
  });

  it('should create the dm inbox component', () => {
    const fixture = TestBed.createComponent(DmInboxComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should default to loading state', () => {
    const fixture = TestBed.createComponent(DmInboxComponent);
    const component = fixture.componentInstance;
    expect(component.isLoading()).toBeTrue();
  });
});
