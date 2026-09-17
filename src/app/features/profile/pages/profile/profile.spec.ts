import { TestBed } from '@angular/core/testing';
import { ProfilePage } from './profile';
import { testProviders } from '../../../../test-providers';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { SocialPlatformService } from '../../../../core/services/social-platform.service';
import { ToastService } from '../../../../core/services/toast.service';

describe('ProfilePage (Bug #4 Disambiguation)', () => {
  let userSession: UserSessionService;
  let socialInteractionsSpy: jasmine.SpyObj<SocialInteractionsService>;
  let socialPlatformSpy: jasmine.SpyObj<SocialPlatformService>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    socialPlatformSpy = jasmine.createSpyObj('SocialPlatformService', ['updateOwnProfile']);
    socialPlatformSpy.updateOwnProfile.and.resolveTo(true);

    socialInteractionsSpy = jasmine.createSpyObj(
      'SocialInteractionsService',
      ['activateRealtime', 'isSaved', 'isHidden', 'postKey', 'confirmAndDeletePost'],
      {
        postDeleted$: {
          pipe: () => ({ subscribe: () => {} }),
        } as unknown as SocialInteractionsService['postDeleted$'],
      },
    );
    socialInteractionsSpy.isSaved.and.returnValue(false);
    socialInteractionsSpy.isHidden.and.returnValue(false);

    toastSpy = jasmine.createSpyObj('ToastService', ['show']);

    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        ...testProviders,
        { provide: SocialPlatformService, useValue: socialPlatformSpy },
        { provide: SocialInteractionsService, useValue: socialInteractionsSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    }).compileComponents();

    userSession = TestBed.inject(UserSessionService);
    userSession.user.set({
      uid: 'user-123',
      name: 'Nikhil Jose',
      username: 'nikhiljose47',
      isGuest: false,
      accountType: 'personal',
      bio: 'Hello from Bangalore!',
    });
    spyOn(userSession, 'updateAvatarUrl').and.resolveTo(true);
  });

  it('should create the profile page', () => {
    const fixture = TestBed.createComponent(ProfilePage);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('renders display name as header and unique @username handle', () => {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const nameEl = compiled.querySelector('.profile-name');
    const handleEl = compiled.querySelector('.profile-handle');

    expect(nameEl?.textContent?.trim()).toBe('Nikhil Jose');
    expect(handleEl?.textContent?.trim()).toBe('@nikhiljose47');
  });

  it('displays edit hint and read-only handle with badge in edit mode', () => {
    const fixture = TestBed.createComponent(ProfilePage);
    const component = fixture.componentInstance;
    component.editMode.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const editHint = compiled.querySelector('.edit-card .edit-hint');
    const readonlyHandle = compiled.querySelector('.profile-handle-readonly');
    const fixedBadge = compiled.querySelector('.handle-fixed-badge');

    expect(editHint?.textContent?.trim()).toBe(
      'Your public display name shown on your posts and comments.',
    );
    expect(readonlyHandle?.textContent).toContain('@nikhiljose47');
    expect(fixedBadge?.textContent?.trim()).toBe('Unique handle (cannot be changed)');
  });

  it('saves updated display name via platform service and keeps handle intact', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    const component = fixture.componentInstance;
    component.toggleEditProfile();
    expect(component.editName()).toBe('Nikhil Jose');

    component.editName.set('Nikhil J.');
    await component.saveProfile();

    expect(socialPlatformSpy.updateOwnProfile).toHaveBeenCalledWith(
      'Nikhil J.',
      'Hello from Bangalore!',
    );
    expect(component.editMode()).toBeFalse();
    expect(toastSpy.show).toHaveBeenCalledWith('Profile saved.', 'success');
  });
});
