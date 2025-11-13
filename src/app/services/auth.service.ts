import { Injectable } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { UserModel } from '../models/user.model';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = new BehaviorSubject<UserModel>({
    uid: 'guest',
    email: null,
    username: 'Guest',
    isGuest: true,
  });
  user$ = this._user.asObservable();

  constructor(private auth: Auth) {
    // Listen to Firebase Auth state
    onAuthStateChanged(this.auth, (user) => {
      console.log('came', user)
      if (user) {
        this._user.next({
          uid: user.uid,
          email: user.email,
          username: user.displayName || user.email?.split('@')[0] || 'User',
          isGuest: false,
        });
      } else {
        this._user.next({ uid: 'guest', email: null, username: 'Guest', isGuest: true, });
      }
    });
  }

  async login(email: string, password: string) {
    try {
      const userCred = await signInWithEmailAndPassword(this.auth, email, password);
      console.log('✅ Logged in:', userCred.user);
    } catch (err: any) {
      console.error('❌ Login error:', err.code, err.message);

    }
  }
  async logout() {
    await signOut(this.auth);
  }
}
