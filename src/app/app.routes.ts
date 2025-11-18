import { Routes } from '@angular/router';
import { Tagmate } from './components/tagmate/tagmate';
import { Login } from './components/login/login';
import { Tagmate2 } from './components/tagmate2/tagmate2';
import { TagForm } from './components/tag-form/tag-form';
import { TagExplorer } from './components/tag-explorer/tag-explorer';

export const routes: Routes = [
    { path: 'tagmate', component: TagExplorer, title: 'TagMate' },
    { path: 'hood', component: Tagmate, title: 'Hood' },
    { path: 'post', component: TagForm, title: 'Post' },
    { path: '', redirectTo: 'tagmate', pathMatch: 'full' },
    { path: '**', redirectTo: '/tagmate' }
];
