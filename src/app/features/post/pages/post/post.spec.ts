import { TestBed } from '@angular/core/testing';
import { PostPage, MAX_IMAGE_SIZE_BYTES, MAX_VIDEO_SIZE_BYTES } from './post';
import { TagCategory } from '../../../../core/enums/tag-category.enum';
import { testProviders } from '../../../../test-providers';
import { ToastService } from '../../../../core/services/toast.service';

describe('PostPage', () => {
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    toastSpy = jasmine.createSpyObj('ToastService', ['show']);

    await TestBed.configureTestingModule({
      imports: [PostPage],
      providers: [...testProviders, { provide: ToastService, useValue: toastSpy }],
    }).compileComponents();
  });

  it('should create the post page', () => {
    const fixture = TestBed.createComponent(PostPage);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should accept a valid image file (< 15MB)', async () => {
    const fixture = TestBed.createComponent(PostPage);
    const component = fixture.componentInstance;

    const validImage = new File(['dummy-content'], 'sample.jpg', { type: 'image/jpeg' });
    const event = { target: { files: [validImage], value: '' } } as unknown as Event;

    await component.onFileSelect(event);

    expect(component.mediaItems().length).toBe(1);
    expect(component.mediaItems()[0]!.type).toBe('image');
  });

  it('should reject an oversized image file (> 15MB)', async () => {
    const fixture = TestBed.createComponent(PostPage);
    const component = fixture.componentInstance;

    const oversizedImage = new File([], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(oversizedImage, 'size', { value: MAX_IMAGE_SIZE_BYTES + 1024 });

    const event = { target: { files: [oversizedImage], value: '' } } as unknown as Event;

    await component.onFileSelect(event);

    expect(component.mediaItems().length).toBe(0);
    expect(toastSpy.show).toHaveBeenCalledWith(
      jasmine.stringMatching(/exceeds maximum size of 15 MB/i),
      'warning',
    );
  });

  it('should reject an oversized video file (> 30MB)', async () => {
    const fixture = TestBed.createComponent(PostPage);
    const component = fixture.componentInstance;

    const oversizedVideo = new File([], 'large_video.mp4', { type: 'video/mp4' });
    Object.defineProperty(oversizedVideo, 'size', { value: MAX_VIDEO_SIZE_BYTES + 1024 });

    const event = { target: { files: [oversizedVideo], value: '' } } as unknown as Event;

    await component.onFileSelect(event);

    expect(component.mediaItems().length).toBe(0);
    expect(toastSpy.show).toHaveBeenCalledWith(
      jasmine.stringMatching(/exceeds maximum size of 30 MB/i),
      'warning',
    );
  });

  it('should reject unsupported media formats', async () => {
    const fixture = TestBed.createComponent(PostPage);
    const component = fixture.componentInstance;

    const pdfFile = new File(['content'], 'document.pdf', { type: 'application/pdf' });
    const event = { target: { files: [pdfFile], value: '' } } as unknown as Event;

    await component.onFileSelect(event);

    expect(component.mediaItems().length).toBe(0);
    expect(toastSpy.show).toHaveBeenCalledWith(
      jasmine.stringMatching(/unsupported media format/i),
      'warning',
    );
  });

  it('normalizes an M4V attachment to the storage-supported MIME type', () => {
    const fixture = TestBed.createComponent(PostPage);
    const component = fixture.componentInstance;
    const file = new File(['video'], 'clip.m4v', { type: 'application/octet-stream' });

    const normalized = (component as any).normalizeMediaFile(file);

    expect(normalized.type).toBe('video');
    expect(normalized.file.type).toBe('video/x-m4v');
  });

  it('rejects a poll with blank options before publishing', () => {
    const fixture = TestBed.createComponent(PostPage);
    const component = fixture.componentInstance as any;
    component.formData.tag = TagCategory.Poll;
    component.formData.pollOptions = ['One option', ''];

    expect(component.validPollOptions()).toBeNull();
    expect(toastSpy.show).toHaveBeenCalledWith(
      jasmine.stringMatching(/non-empty poll options/i),
      'warning',
    );
  });
});
