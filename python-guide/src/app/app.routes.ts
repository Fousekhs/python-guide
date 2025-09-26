import { Routes } from '@angular/router';
import { adminGuard, adminMatchGuard } from '../guards/admin.guard';
import { pointsGuard } from '../guards/points.guard';
import { authGuard } from '../guards/auth.guard';

export const routes: Routes = [
    {
        path: 'admin',
        canMatch: [adminMatchGuard],
        canActivate: [authGuard, adminGuard],
        loadComponent: () =>
            import('./admin-panel/content-admin-panel.component').then(m => m.ContentAdminPanelComponent),
    },
    // Practice modes (random & worst) reuse LessonComponent but operate in practice mode (no points/leaderboard)
    {
        path: 'random',
        canActivate: [authGuard],
        loadComponent: () => import('./lesson/lesson.component').then(m => m.LessonComponent),
        data: { practiceMode: 'random' }
    },
    {
        path: 'worst',
        canActivate: [authGuard],
        loadComponent: () => import('./lesson/lesson.component').then(m => m.LessonComponent),
        data: { practiceMode: 'worst' }
    },
    {
        path: 'lesson/:sectionId/:subjectId', 
        canActivate: [authGuard, pointsGuard],
        loadComponent: () => 
            import('./lesson/lesson.component').then((m) => m.LessonComponent),
    },
    { 
        path: 'login', 
        loadComponent: () => 
        import('./auth/auth.component').then((m) => m.AuthComponent) 
    },
    { 
        path: 'register', 
        loadComponent: () => 
        import('./auth/auth.component').then((m) => m.AuthComponent), 
        data: { register: true }
    },
    { 
        path: 'stats', 
        canActivate: [authGuard],
        loadComponent: () => 
        import('./stats/stats.component').then((m) => m.StatsComponent) 
    },
    { 
        path: '', 
        canActivate: [authGuard],
        loadComponent: () => 
        import('./home/home.component').then((m) => m.HomeComponent) 
    },
    // Handle no admin rights
    {
        path: 'not-authorized',
        loadComponent: () =>
        import('./no-access/no-access.component').then((m) => m.NoAccessComponent) 
    },
    // Handle unmatched paths
    { 
            path: '**', 
            redirectTo: '' 
    }
];
