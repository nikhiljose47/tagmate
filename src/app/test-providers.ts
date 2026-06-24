import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getStorage, provideStorage } from '@angular/fire/storage';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { environment } from './environments/environment.prod';
import { toggleReducer } from './store/toggle/toggle.state';
import { userPrefReducer } from './store/user-preferences/user-preference.reducer';

export const testProviders = [
  provideZonelessChangeDetection(),
  provideHttpClient(),
  provideRouter([]),
  provideFirebaseApp(() => initializeApp(environment.firebase)),
  provideFirestore(() => getFirestore()),
  provideAuth(() => getAuth()),
  provideStorage(() => getStorage()),
  provideStore({
    toggle: toggleReducer,
    userPref: userPrefReducer,
  }),
];
