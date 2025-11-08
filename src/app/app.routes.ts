import { Routes } from '@angular/router';
import { Tagmate } from './components/tagmate/tagmate';
import { Login } from './components/login/login';

export const routes: Routes = [
    { path: '', component: Tagmate },
    { path: 'login', component: Login }
];
