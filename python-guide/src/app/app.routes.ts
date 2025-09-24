import { Routes } from '@angular/router';
import { adminGuard, adminMatchGuard } from '../guards/admin.guard';

export const routes: Routes = [
    {
        path: 'admin',
        canMatch: [adminMatchGuard],
        canActivate: [adminGuard],
        loadComponent: () =>
            import('./admin-panel/content-admin-panel.component').then(m => m.ContentAdminPanelComponent),
    },
    {
        path: 'lesson/:sectionId/:subjectId', 
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
        loadComponent: () => 
        import('./stats/stats.component').then((m) => m.StatsComponent) 
    },
    { 
        path: '', 
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
