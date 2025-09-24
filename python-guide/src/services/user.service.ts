import { Injectable } from '@angular/core';
import { Database, ref, get, update, push } from '@angular/fire/database';
import { serverTimestamp } from 'firebase/database';
import { from, Observable, map } from 'rxjs';

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastLogin?: string;
  isAdmin?: boolean;           // mirror only
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private db: Database) {}

  getUserData(uid: string): Observable<UserData | null> {
    const r = ref(this.db, `users/${uid}`);
    return from(get(r)).pipe(map(s => s.exists() ? ({ uid, ...s.val() } as UserData) : null));
  }

  // Atomic promote
  promoteUser(uid: string, actingUid: string): Observable<void> {
    const auditKey = push(ref(this.db, 'adminAudit')).key!;
    const updates: Record<string, any> = {};
    updates[`roles/admin/${uid}`] = true;              // canonical
    updates[`users/${uid}/isAdmin`] = true;            // mirror
    updates[`adminAudit/${auditKey}`] = {
      action: 'promote',
      target: uid,
      by: actingUid,
      at: serverTimestamp()
    };
    return from(update(ref(this.db), updates));
  }

  // Atomic demote (rules will block if it would delete the last admin)
  demoteUser(uid: string, actingUid: string): Observable<void> {
    const auditKey = push(ref(this.db, 'adminAudit')).key!;
    const updates: Record<string, any> = {};
    updates[`roles/admin/${uid}`] = null;              // delete canonical entry
    updates[`users/${uid}/isAdmin`] = false;           // mirror
    updates[`adminAudit/${auditKey}`] = {
      action: 'demote',
      target: uid,
      by: actingUid,
      at: serverTimestamp()
    };
    return from(update(ref(this.db), updates));
  }

  // Optional helper to list all users (mirror field is for display only)
  getAllUsers(): Observable<UserData[]> {
    return from(get(ref(this.db, 'users'))).pipe(
      map(s => {
        if (!s.exists()) return [];
        const out: UserData[] = [];
        s.forEach(child => {
          out.push({ uid: child.key!, ...child.val() } as UserData);
          return false;
        });
        return out.sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''));
      })
    );
  }
}
