import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BusinessOfferRow } from './social.mapper';

export interface CreateBusinessOfferInput {
  user_id: string;
  image_url: string | null;
  title: string;
  description: string | null;
  valid_until: string;
}

/** Database operations for a business's time-limited offers (`business_offers`). */
@Injectable({ providedIn: 'root' })
export class BusinessOfferService {
  private readonly supabase = inject(SupabaseService);

  list(userId: string) {
    return this.supabase.getRows<BusinessOfferRow>('business_offers', {
      field: 'user_id',
      op: '==',
      value: userId,
    });
  }

  create(input: CreateBusinessOfferInput) {
    return this.supabase.addRow<BusinessOfferRow>('business_offers', { ...input });
  }

  delete(id: string) {
    return this.supabase.deleteRow('business_offers', id);
  }
}
