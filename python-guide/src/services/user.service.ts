import { Injectable } from '@angular/core';
import { Database, ref, get, update, push } from '@angular/fire/database';
import { serverTimestamp } from 'firebase/database';
import { from, Observable, map, switchMap } from 'rxjs';

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastLogin?: string;
  isAdmin?: boolean;           // mirror only
}

export interface SubjectProgress {
  points: number;
  passed: boolean;
  lastEfficiency?: number;
  lastMastery?: number;
  lastSessionId?: string;
  updatedAt?: object;
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

  // =====================
  // Points & Progress
  // =====================

  getUserPoints(uid: string): Observable<number> {
    return from(get(ref(this.db, `users/${uid}/points`))).pipe(
      map(s => (s.exists() ? (s.val() as number) : 0))
    );
  }

  getSubjectProgress(uid: string, sectionId: string, subjectId: string): Observable<SubjectProgress | null> {
    const r = ref(this.db, `users/${uid}/progress/${sectionId}/${subjectId}`);
    return from(get(r)).pipe(
      map(s => (s.exists() ? (s.val() as SubjectProgress) : null))
    );
  }

  setSubjectProgress(uid: string, sectionId: string, subjectId: string, progress: SubjectProgress): Observable<void> {
    const r = ref(this.db, `users/${uid}/progress/${sectionId}/${subjectId}`);
    return from(update(r, { ...progress, updatedAt: serverTimestamp() } as any));
  }

  adjustTotalPoints(uid: string, delta: number): Observable<number> {
    const userRef = ref(this.db, `users/${uid}`);
    return from(get(userRef)).pipe(
      switchMap((s: any) => {
        const cur = s.exists() && typeof s.val()?.points === 'number' ? s.val().points as number : 0;
        const next = cur + delta;
        return from(update(userRef, { points: next, updatedAt: serverTimestamp() })).pipe(map(() => next));
      })
    );
  }
}
