import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';

// Core auth guard logic ensuring a user is authenticated.
function authCore(): Observable<boolean | UrlTree> {
	const auth = inject(AuthService);
	const router = inject(Router);
	return auth.authState().pipe(
		take(1),
		map(user => user ? true : router.createUrlTree(['/login']))
	);
}

export const authGuard: CanActivateFn = (_route, _state) => authCore();
export const authMatchGuard: CanMatchFn = (_route, _segments) => authCore();
