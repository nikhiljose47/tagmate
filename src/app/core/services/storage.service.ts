import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly clientService = inject(SupabaseClientService);
  private readonly client = this.clientService.client;

  /** Upload a raw File (image or video) directly to the tag-images bucket. */
  async uploadFile(path: string, file: File): Promise<string> {
    const { error } = await this.client.storage
      .from('tag-images')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) throw error;

    const { data } = this.client.storage.from('tag-images').getPublicUrl(path);
    return data.publicUrl;
  }

  async uploadImageBase64(path: string, base64Data: string): Promise<string> {
    const [header, raw] = base64Data.split(',');
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const contentType = mimeMatch?.[1] ?? 'image/jpeg';

    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const { error } = await this.client.storage
      .from('tag-images')
      .upload(path, bytes, { contentType, upsert: false });

    if (error) throw error;

    const { data } = this.client.storage.from('tag-images').getPublicUrl(path);
    return data.publicUrl;
  }
}
