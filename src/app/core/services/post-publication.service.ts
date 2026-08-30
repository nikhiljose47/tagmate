import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { PostPublicationRow, rowToPostPublication } from './social.mapper';
import { PostPublication } from '../models/post-publication.model';

export interface PublishResult {
  website: PostPublication | null;
  instagram: PostPublication | null;
}

/**
 * Client-side read layer for `post_publications` (RLS already scopes reads
 * to the post's own owner — see the business-integrations migration) plus
 * the two backend calls that actually drive publishing: creating the initial
 * publication records (and kicking off Instagram in the background) and
 * retrying a failed Instagram publication. All actual Meta API calls happen
 * server-side in functions/api/posts/publish.js and
 * functions/api/integrations/instagram/retry.js — this service never talks
 * to Meta directly.
 */
@Injectable({ providedIn: 'root' })
export class PostPublicationService {
  private readonly supabase = inject(SupabaseService);

  getForPost(postId: string): Observable<PostPublication[]> {
    return this.supabase
      .getRows<PostPublicationRow>('post_publications', {
        field: 'post_id',
        op: '==',
        value: postId,
      })
      .pipe(map(({ data }) => (data ?? []).map(rowToPostPublication)));
  }

  async requestPublish(
    postId: string,
    destinations: ('website' | 'instagram')[],
  ): Promise<PublishResult> {
    const response = await this.authorizedFetch('/api/posts/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, destinations }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Could not publish this post.');
    }
    return response.json();
  }

  async retryInstagram(publicationId: string): Promise<void> {
    const response = await this.authorizedFetch('/api/integrations/instagram/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicationId }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Could not retry Instagram publishing.');
    }
  }

  private async authorizedFetch(path: string, init: RequestInit): Promise<Response> {
    const token = await this.supabase.getAccessToken();
    if (!token) throw new Error('You must be signed in.');
    return fetch(path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  }
}
