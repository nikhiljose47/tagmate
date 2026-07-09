import { TestBed } from '@angular/core/testing';
import { PostDetailPage } from './post-detail';
import { testProviders } from '../../../../test-providers';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('PostDetailPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostDetailPage],
      providers: [
        ...testProviders,
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => 'test-id' }),
            queryParams: of({}),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the post detail page', () => {
    const fixture = TestBed.createComponent(PostDetailPage);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should initialize with loading state', () => {
    const fixture = TestBed.createComponent(PostDetailPage);
    const component = fixture.componentInstance;
    expect(component['isLoading']()).toBeTrue();
  });
});
