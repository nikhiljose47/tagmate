import { CSP_NONCE, REQUEST_CONTEXT, mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: CSP_NONCE,
      useFactory: (ctx: unknown) => (typeof ctx === 'string' ? ctx : null),
      deps: [REQUEST_CONTEXT],
    },
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
