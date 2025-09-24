// guards/admin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { of, Observable } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';

// Shared core so we don't duplicate logic
function adminGuardCore(): Observable<boolean | UrlTree> {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.authState().pipe(
    take(1),
    switchMap(user => {
      if (!user) return of(router.createUrlTree(['/login']));
      return auth.isAdmin().pipe(
        take(1),
        map(isAdmin => (isAdmin ? true : router.createUrlTree(['/not-authorized'])))
      );
    }),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
}

// ✅ Functional guards with the required signatures
export const adminGuard: CanActivateFn = (_route, _state) => adminGuardCore();
export const adminMatchGuard: CanMatchFn = (_route, _segments) => adminGuardCore();
