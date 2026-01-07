import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) },
  { path: 'lobby', loadComponent: () => import('./lobby/lobby.component').then(m => m.LobbyComponent) },
  { path: 'game/:id', loadComponent: () => import('./game-board/game-board.component').then(m => m.GameBoardComponent) },
  { path: '**', redirectTo: '' }
];
