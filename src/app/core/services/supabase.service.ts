import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { TagDataService } from './tag-data.service';
import { SocialDataService } from './social-data.service';
import { StorageService } from './storage.service';
import { RealtimeService } from './realtime.service';
import { AppUser } from '../models/app-user.model';
import { TagRow } from './tag.mapper';
import { DirectMessageRow } from './social.mapper';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly auth = inject(AuthService);
  private readonly tagData = inject(TagDataService);
  private readonly socialData = inject(SocialDataService);
  private readonly storage = inject(StorageService);
  private readonly realtime = inject(RealtimeService);

  readonly session$ = this.auth.session$;

  // ---------- AUTH ----------

  signInWithPassword(email: string, password: string) {
    return this.auth.signInWithPassword(email, password);
  }

  signUp(email: string, password: string, metadata: Record<string, unknown>) {
    return this.auth.signUp(email, password, metadata);
  }

  isUsernameTaken(username: string): Observable<boolean> {
    return this.auth.isUsernameTaken(username);
  }

  signInAnonymously() {
    return this.auth.signInAnonymously();
  }

  signOut() {
    return this.auth.signOut();
  }

  resetPassword(email: string) {
    return this.auth.resetPassword(email);
  }

  updatePassword(password: string) {
    return this.auth.updatePassword(password);
  }

  updateUser(attributes: { email?: string; password?: string; data?: Record<string, unknown> }) {
    return this.auth.updateUser(attributes);
  }

  updateUserMetadata(metadata: Record<string, unknown>) {
    return this.auth.updateUserMetadata(metadata);
  }

  // ---------- DATA ----------

  addRow<T extends Record<string, unknown>>(table: string, data: T) {
    return this.tagData.addRow(table, data);
  }

  getRows<T>(
    table: string,
    condition?: { field: string; op: '=='; value: unknown },
  ): Observable<{ data: T[] | null; error: unknown }> {
    return this.tagData.getRows<T>(table, condition);
  }

  getRow<T>(table: string, id: string): Observable<{ data: T | null; error: unknown }> {
    return this.tagData.getRow<T>(table, id);
  }

  getUserById(uid: string): Observable<AppUser | null> {
    return this.tagData.getUserById(uid);
  }

  updateRow<T>(table: string, id: string, data: Partial<T>) {
    return this.tagData.updateRow(table, id, data);
  }

  deleteRow(table: string, id: string) {
    return this.tagData.deleteRow(table, id);
  }

  deleteRowsWhere(table: string, matchers: Record<string, unknown>) {
    return this.tagData.deleteRowsWhere(table, matchers);
  }

  updateRowsWhere<T>(table: string, matchers: Record<string, unknown>, data: Partial<T>) {
    return this.tagData.updateRowsWhere<T>(table, matchers, data);
  }

  searchUsers(query: string, limit = 8) {
    return this.tagData.searchUsers(query, limit);
  }

  callRpc<T>(name: string, params: Record<string, unknown>) {
    return this.tagData.callRpc<T>(name, params);
  }

  upsertRow<T extends Record<string, unknown>>(table: string, data: T, onConflict?: string) {
    return this.tagData.upsertRow(table, data, onConflict);
  }

  getRowsIn<T>(
    table: string,
    field: string,
    values: unknown[],
  ): Observable<{ data: T[] | null; error: unknown }> {
    return this.tagData.getRowsIn<T>(table, field, values);
  }

  // ---------- GEOSPATIAL ----------

  getLatest<T>(table: string, limit: number): Observable<{ data: T[] | null; error: unknown }> {
    return this.tagData.getLatest<T>(table, limit);
  }

  getLatestPaginated<T>(
    table: string,
    limit: number,
    offset: number,
    search?: string,
  ): Observable<{ data: T[] | null; error: unknown }> {
    return this.tagData.getLatestPaginated<T>(table, limit, offset, search);
  }

  getFilteredRows<T>(
    table: string,
    filters: {
      tags?: string[];
      before?: string;
      after?: string;
      userId?: string;
      search?: string;
      excludeTag?: string;
      hoodId?: string;
    },
    limit?: number,
    offset?: number,
  ): Observable<{ data: T[] | null; error: unknown }> {
    return this.tagData.getFilteredRows<T>(table, filters, limit, offset);
  }

  fetchTagsInBounds(
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
  ): Observable<{ data: TagRow[] | null; error: unknown }> {
    return this.tagData.fetchTagsInBounds(minLng, minLat, maxLng, maxLat);
  }

  // ---------- REALTIME ----------

  liveInserts<T>(table: string, filter?: string): Observable<T> {
    return this.realtime.liveInserts<T>(table, filter);
  }

  liveUpdates<T>(table: string, filter?: string): Observable<T> {
    return this.realtime.liveUpdates<T>(table, filter);
  }

  liveDeletes<T>(table: string, filter?: string): Observable<T> {
    return this.realtime.liveDeletes<T>(table, filter);
  }

  // ---------- STORAGE ----------

  uploadFile(path: string, file: File): Promise<string> {
    return this.storage.uploadFile(path, file);
  }

  uploadImageBase64(path: string, base64Data: string): Promise<string> {
    return this.storage.uploadImageBase64(path, base64Data);
  }

  // ---------- SOCIAL ----------

  getDirectMessagesForUser(
    uid: string,
  ): Observable<{ data: DirectMessageRow[] | null; error: unknown }> {
    return this.socialData.getDirectMessagesForUser(uid);
  }

  // ---------- UTILITY ----------

  setUserActive() {
    return this.tagData.setUserActive();
  }
}
