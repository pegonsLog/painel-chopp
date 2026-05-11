import { Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';
import { panelGuard } from './guards/panel.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [panelGuard],
    loadComponent: () => import('./pages/panel/panel').then((m) => m.Panel),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/admin/admin-layout').then((m) => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'chopes' },
      {
        path: 'chopes',
        loadComponent: () =>
          import('./pages/admin/beers/beers').then((m) => m.BeersAdmin),
      },
      {
        path: 'chopes/novo',
        loadComponent: () =>
          import('./pages/admin/beer-form/beer-form').then((m) => m.BeerForm),
      },
      {
        path: 'chopes/editar/:id',
        loadComponent: () =>
          import('./pages/admin/beer-form/beer-form').then((m) => m.BeerForm),
      },
      {
        path: 'preview',
        loadComponent: () =>
          import('./pages/admin/panel-preview/panel-preview').then((m) => m.PanelPreview),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./pages/admin/users/users').then((m) => m.UsersAdmin),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
