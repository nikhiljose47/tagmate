import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, collection, collectionData, query, where, addDoc, updateDoc, deleteDoc, DocumentData } from '@angular/fire/firestore';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  // Auth state as BehaviorSubject for zone-less updates
  private currentUser$ = new BehaviorSubject<User | null>(null);

  constructor() {
    onAuthStateChanged(this.auth, (user) => this.currentUser$.next(user));
  }

  /** -------- AUTH -------- */
  login(email: string, password: string) {
    return from(signInWithEmailAndPassword(this.auth, email, password));
  }

  logout() {
    return from(signOut(this.auth));
  }

  get user$(): Observable<User | null> {
    return this.currentUser$.asObservable();
  }

  /** -------- FIRESTORE -------- */
  // Add a new doc
  addDoc<T extends DocumentData>(path: string, data: T) {
    const ref = collection(this.firestore, path);
    return from(addDoc(ref, data));
  }

  // Get all docs from a collection
  getCollection<T>(path: string, condition?: { field: string; op: any; value: any }): Observable<T[]> {
    const ref = collection(this.firestore, path);
    const q = condition ? query(ref, where(condition.field, condition.op, condition.value)) : ref;
    return collectionData(q, { idField: 'id' }) as Observable<T[]>;
  }

  // Get single doc
  getDoc<T>(path: string, id: string): Observable<T | undefined> {
    const ref = doc(this.firestore, `${path}/${id}`);
    return from(getDoc(ref)).pipe(map((snap) => snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : undefined));
  }

  // Update doc
  updateDoc<T>(path: string, id: string, data: Partial<T>) {
    const ref = doc(this.firestore, `${path}/${id}`);
    return from(updateDoc(ref, data));
  }

  // Delete doc
  deleteDoc(path: string, id: string) {
    const ref = doc(this.firestore, `${path}/${id}`);
    return from(deleteDoc(ref));
  }

  /** -------- EXTRA UTILITY -------- */
  // Record last active timestamp for user
  setUserActive() {
    const user = this.auth.currentUser;
    if (!user) return;
    const ref = doc(this.firestore, `users/${user.uid}`);
    return from(setDoc(ref, { lastActive: new Date() }, { merge: true }));
  }
}
