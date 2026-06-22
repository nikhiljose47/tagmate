// core/services/user-session.service.ts
import { Injectable, signal, inject } from '@angular/core';
import {
  Auth,
  authState,
  signOut,
  signInAnonymously,
  signInWithEmailAndPassword,
} from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { AppUser } from '../models/app-user.model';

@Injectable({ providedIn: 'root' })
export class UserSessionService {
  private auth = inject(Auth);
  private afs = inject(Firestore);

  user = signal<AppUser | null>(null);

  constructor() {
    authState(this.auth).subscribe(async (fbUser) => {
      if (!fbUser) return this.user.set(null);

      const snap = await getDoc(doc(this.afs, `users/${fbUser.uid}`));

      if (snap.exists()) {
        this.user.set(snap.data() as AppUser);
      } else {
        this.user.set({
          uid: fbUser.uid,
          name: fbUser.displayName ?? 'User',
          isGuest: fbUser.isAnonymous,
        });
      }
    });
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout() {
    this.user.set(null);
    return signOut(this.auth);
  }

  async loginGuest() {
    const credential = await signInAnonymously(this.auth);
    const uid = credential.user.uid;

    await setDoc(
      doc(this.afs, `users/${uid}`),
      {
        uid,
        name: 'Guest User',
        isGuest: true,
        createdAt: Date.now(),
      },
      { merge: true }
    );
  }
}
