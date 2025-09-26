import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ContentService } from '../services/content.service';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { EMPTY, switchMap, map, of } from 'rxjs';

/**
 * Guard that enforces a minimum total points requirement per subject.
 * Reads subject's minPointsRequired (defaults to 0) and compares with user's total points.
 */
export const pointsGuard: CanActivateFn = (route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
  const sectionId = route.paramMap.get('sectionId') as string;
  const subjectId = route.paramMap.get('subjectId') as string;
  const router = inject(Router);
  const auth = inject(AuthService);
  const users = inject(UserService);
  const content = inject(ContentService);

  return auth.authState().pipe(
    switchMap(user => {
      if (!user) {
        router.navigate(['/login']);
        return EMPTY;
      }
      return content.getSubject(sectionId, subjectId).pipe(
        switchMap(subject => {
          const required = subject?.minPointsRequired ?? 0;
          return users.getUserPoints(user.uid).pipe(
            map(total => {
              if (total >= required) return true;
              router.navigate(['/not-authorized'], { queryParams: { reason: 'minPoints', required } });
              return false;
            })
          );
        })
      );
    })
  );
};
