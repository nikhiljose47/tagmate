import { Injectable } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { UserModel } from '../models/user.model';
import { AuthResponse } from '../models/auth-response.model';

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
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this._user.next({
          uid: user.uid,
          email: user.email,
          username: user.displayName || user.email?.split('@')[0] || 'User',
          isGuest: false,
        });
      } else {
        this._user.next({
          uid: 'guest',
          email: null,
          username: 'Guest',
          isGuest: true,
        });
      }
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const userCred = await signInWithEmailAndPassword(this.auth, email, password);
      const u = userCred.user;
      const response: AuthResponse = {
        ok: true,
        uid: u.uid,
        email: u.email,
        username: u.displayName || u.email?.split('@')[0] || 'User',
      };

      return response;
    } catch (err: any) {
      const errorResponse: AuthResponse = {
        ok: false,
        code: err.code ?? 'auth/unknown',
        message: err.message ?? 'Something went wrong',
      };

      return errorResponse;
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
