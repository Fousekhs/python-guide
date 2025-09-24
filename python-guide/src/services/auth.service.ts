import { Injectable } from '@angular/core';
import {
  Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, User, UserCredential
} from '@angular/fire/auth';
import { Database, ref, set } from '@angular/fire/database';
import { onValue } from 'firebase/database';
import { from, Observable, of, switchMap, map, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private auth: Auth, private db: Database) {}

  register(email: string, password: string, displayName: string): Observable<void> {
    return from(createUserWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap((cred: UserCredential) => {
        const user = cred.user;
        if (!user) return throwError(() => new Error('User creation failed.'));
        return from(updateProfile(user, { displayName })).pipe(
          switchMap(() =>
            from(set(ref(this.db, `users/${user.uid}`), {
              email: user.email,
              displayName,
              createdAt: new Date().toISOString()
            }))
          ),
          map(() => void 0)
        );
      })
    );
  }

  login(email: string, password: string) { return from(signInWithEmailAndPassword(this.auth, email, password)); }
  logout() { return from(signOut(this.auth)); }

  getCurrentUser(): User | null { return this.auth.currentUser; }

  authState(): Observable<User | null> {
    return new Observable(observer => {
      const unsub = this.auth.onAuthStateChanged(observer);
      return { unsubscribe: unsub };
    });
  }

  // Live admin flag from DB
  isAdmin(): Observable<boolean> {
    return this.authState().pipe(
      switchMap(u => {
        if (!u) return of(false);
        return new Observable<boolean>((observer) => {
          const r = ref(this.db, `roles/admin/${u.uid}`);
          const off = onValue(
            r,
            snap => observer.next(!!snap.val()),
            err => observer.error(err)
          );
          return () => off(); // unsubscribe
        });
      })
    );
  }
}