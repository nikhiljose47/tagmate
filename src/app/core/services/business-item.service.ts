import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BusinessItemRow } from './social.mapper';

export interface CreateBusinessItemInput {
  user_id: string;
  image_url: string | null;
  name: string;
  description: string | null;
  price: number | null;
  offer_price: number | null;
}

/** Database operations for a business's products/services (`business_items`). */
@Injectable({ providedIn: 'root' })
export class BusinessItemService {
  private readonly supabase = inject(SupabaseService);

  list(userId: string) {
    return this.supabase.getRows<BusinessItemRow>('business_items', {
      field: 'user_id',
      op: '==',
      value: userId,
    });
  }

  create(input: CreateBusinessItemInput) {
    return this.supabase.addRow<BusinessItemRow>('business_items', { ...input });
  }

  delete(id: string) {
    return this.supabase.deleteRow('business_items', id);
  }
}
