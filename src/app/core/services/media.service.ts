import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly supabase = inject(SupabaseService);

  /** Upload a raw File (image or video) directly to the tag-images bucket. */
  uploadFile(path: string, file: File): Promise<string> {
    return this.supabase.uploadFile(path, file);
  }

  /** Upload a base64-encoded image directly to the tag-images bucket. */
  uploadImageBase64(path: string, base64Data: string): Promise<string> {
    return this.supabase.uploadImageBase64(path, base64Data);
  }
}
