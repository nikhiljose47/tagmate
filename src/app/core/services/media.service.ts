import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly storage = inject(StorageService);

  /** Upload a raw File (image or video) directly to the tag-images bucket. */
  uploadFile(path: string, file: File): Promise<string> {
    return this.storage.uploadFile(path, file);
  }

  /** Upload a base64-encoded image directly to the tag-images bucket. */
  uploadImageBase64(path: string, base64Data: string): Promise<string> {
    return this.storage.uploadImageBase64(path, base64Data);
  }
}
