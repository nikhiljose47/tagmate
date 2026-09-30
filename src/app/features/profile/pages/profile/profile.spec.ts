import { TestBed } from '@angular/core/testing';
import {
  PROFILE_PHOTO_MAX_INPUT_BYTES,
  PROFILE_PHOTO_MAX_OUTPUT_BYTES,
  ProfilePage,
} from './profile';
import { testProviders } from '../../../../test-providers';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { SocialPlatformService } from '../../../../core/services/social-platform.service';
import { ToastService } from '../../../../core/services/toast.service';
import { MediaCompressionService } from '../../../../core/services/media-compression.service';
import { MediaService } from '../../../../core/services/media.service';

describe('ProfilePage (Bug #4 Disambiguation)', () => {
  let userSession: UserSessionService;
  let socialInteractionsSpy: jasmine.SpyObj<SocialInteractionsService>;
  let socialPlatformSpy: jasmine.SpyObj<SocialPlatformService>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let mediaCompressionSpy: jasmine.SpyObj<MediaCompressionService>;
  let mediaSpy: jasmine.SpyObj<MediaService>;

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
    mediaCompressionSpy = jasmine.createSpyObj('MediaCompressionService', ['compress']);
    mediaSpy = jasmine.createSpyObj('MediaService', ['uploadFile']);

    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        ...testProviders,
        { provide: SocialPlatformService, useValue: socialPlatformSpy },
        { provide: SocialInteractionsService, useValue: socialInteractionsSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: MediaCompressionService, useValue: mediaCompressionSpy },
        { provide: MediaService, useValue: mediaSpy },
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

  it('rejects profile photos larger than 5 MB before compression', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    const file = new File(['photo'], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: PROFILE_PHOTO_MAX_INPUT_BYTES + 1 });

    await fixture.componentInstance.onBusinessLogoSelect({
      target: { files: [file], value: 'large.jpg' },
    } as unknown as Event);

    expect(mediaCompressionSpy.compress).not.toHaveBeenCalled();
    expect(mediaSpy.uploadFile).not.toHaveBeenCalled();
    expect(toastSpy.show).toHaveBeenCalledWith('Profile photo must be 5 MB or smaller.', 'warning');
  });

  it('compresses profile photos to avatar-specific dimensions before upload', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    const source = new File([new Uint8Array(700 * 1024)], 'photo.jpg', { type: 'image/jpeg' });
    const compressed = new File([new Uint8Array(400 * 1024)], 'photo.webp', {
      type: 'image/webp',
    });
    mediaCompressionSpy.compress.and.resolveTo({
      file: compressed,
      originalBytes: source.size,
      compressedBytes: compressed.size,
      ratio: compressed.size / source.size,
      didCompress: true,
    });
    mediaSpy.uploadFile.and.resolveTo('https://example.com/photo.webp');

    await fixture.componentInstance.onBusinessLogoSelect({
      target: { files: [source], value: 'photo.jpg' },
    } as unknown as Event);

    expect(mediaCompressionSpy.compress).toHaveBeenCalledWith(
      source,
      jasmine.objectContaining({ maxDimension: 768, quality: 0.8, skipUnderBytes: 0 }),
    );
    expect(mediaSpy.uploadFile).toHaveBeenCalledWith(
      jasmine.stringMatching(/^avatars\/user-123\/.+\.webp$/),
      compressed,
    );
    expect(fixture.componentInstance.editBusinessLogoUrl()).toBe('https://example.com/photo.webp');
  });

  it('does not upload a profile photo that remains over 500 KB', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    const source = new File([new Uint8Array(900 * 1024)], 'photo.gif', { type: 'image/gif' });
    mediaCompressionSpy.compress.and.resolveTo({
      file: source,
      originalBytes: source.size,
      compressedBytes: source.size,
      ratio: 1,
      didCompress: false,
    });

    await fixture.componentInstance.onBusinessLogoSelect({
      target: { files: [source], value: 'photo.gif' },
    } as unknown as Event);

    expect(mediaCompressionSpy.compress).toHaveBeenCalledTimes(2);
    expect(mediaSpy.uploadFile).not.toHaveBeenCalled();
    expect(source.size).toBeGreaterThan(PROFILE_PHOTO_MAX_OUTPUT_BYTES);
    expect(toastSpy.show).toHaveBeenCalledWith(
      'Choose a smaller photo. The final image must be under 500 KB.',
      'warning',
    );
  });
});
