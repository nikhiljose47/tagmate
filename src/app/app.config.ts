import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  ErrorHandler,
  provideZonelessChangeDetection, isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideStore } from '@ngrx/store';

import { routes } from './app.routes';
import { toggleReducer } from './store/toggle/toggle.state';
import { userPrefReducer, hoodPersistMetaReducer } from './store/user-preferences/user-preference.reducer';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loggingInterceptor } from './core/interceptors/logging.interceptor';
import { GlobalErrorHandler } from './core/handlers/global-error.handler';
import { TAG_REPOSITORY }        from './core/repositories/repository.tokens';
import { SupabaseTagRepository }  from './core/repositories/implementations/supabase-tag.repository';
import { USER_REPOSITORY }        from './core/repositories/repository.tokens';
import { SupabaseUserRepository } from './core/repositories/implementations/supabase-user.repository';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withFetch(),
      withInterceptors([loggingInterceptor, errorInterceptor])
    ),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideStore(
      { toggle: toggleReducer, userPref: userPrefReducer },
      { metaReducers: [hoodPersistMetaReducer] }
    ),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: TAG_REPOSITORY,  useClass: SupabaseTagRepository  },
    { provide: USER_REPOSITORY, useClass: SupabaseUserRepository }, provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ],
};
