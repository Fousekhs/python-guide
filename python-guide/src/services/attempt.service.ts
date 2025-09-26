import { Injectable } from '@angular/core';
import { Database, ref, set, push, get, update, query, orderByChild, equalTo } from '@angular/fire/database';
import { serverTimestamp } from 'firebase/database';
import { from, Observable, map } from 'rxjs';

// ===========================
// Types
// ===========================

/**
 * Represents a single "quiz" session initiated by a user for a specific section.
 */
export interface QuestioningSession {
  id: string;
  userId: string;
  sectionId: string;
  /** Optional subject context (added for stats page); legacy sessions may lack this */
  subjectId?: string;
  startedAt: object; // serverTimestamp()
  completedAt?: object | null; // serverTimestamp() or null
  // Optional results summary
  efficiency?: number;
  mastery?: number;
  pointsGained?: number;
  /** Practice mode tagging: 'random' | 'worst' | 'normal' (implicit). Added later; legacy sessions have none */
  mode?: 'random' | 'worst';
}

/**
 * Represents a user's single attempt to answer a question.
 */
export interface Attempt {
  id: string | null;
  questioningSessionId: string;
  userId: string;
  sectionId: string;
  subjectId: string;
  questionId: string; // This is the contentId from SubjectContent
  answer: any; // The user's submitted answer (e.g., number for MCQ, boolean for True/False)
  isCorrect: boolean;
  timeTaken: number; // Time in milliseconds
  isRetry: boolean;
  createdAt: object | null; // serverTimestamp()
}

@Injectable({
  providedIn: 'root'
})
export class AttemptService {

  constructor(private db: Database) { }

  // ===========================
  // Questioning Sessions
  // ===========================

  /**
   * Creates a new questioning session for a user and a section.
   * @param userId The ID of the user starting the session.
   * @param sectionId The ID of the section being attempted.
   * @returns Observable<string> The ID of the newly created session.
   */
  createQuestioningSession(userId: string, sectionId: string, subjectId?: string, mode?: 'random' | 'worst'): Observable<string> {
    const sessionsRef = ref(this.db, 'questioning-sessions');
    const newSessionRef = push(sessionsRef);
    const session: QuestioningSession = {
      id: newSessionRef.key!,
      userId,
      sectionId,
      ...(subjectId ? { subjectId } : {}),
      ...(mode ? { mode } : {}),
      startedAt: serverTimestamp(),
      completedAt: null
    };
    return from(set(newSessionRef, session)).pipe(map(() => newSessionRef.key!));
  }

  /**
   * Marks a questioning session as completed.
   * @param sessionId The ID of the session to complete.
   * @returns Observable<void>
   */
  completeQuestioningSession(sessionId: string): Observable<void> {
    const sessionRef = ref(this.db, `questioning-sessions/${sessionId}`);
    return from(update(sessionRef, { completedAt: serverTimestamp() }));
  }

  updateQuestioningSessionResults(sessionId: string, data: { efficiency: number; mastery: number; pointsGained: number }): Observable<void> {
    const sessionRef = ref(this.db, `questioning-sessions/${sessionId}`);
    return from(update(sessionRef, { ...data, updatedAt: serverTimestamp() }));
  }

  /**
   * Retrieves a single questioning session by its ID.
   * @param sessionId The ID of the session.
   * @returns Observable<QuestioningSession | null>
   */
  getQuestioningSession(sessionId: string): Observable<QuestioningSession | null> {
    const sessionRef = ref(this.db, `questioning-sessions/${sessionId}`);
    return from(get(sessionRef)).pipe(map(snap => snap.exists() ? snap.val() as QuestioningSession : null));
  }

  /**
   * Retrieves all questioning sessions for a user (for stats aggregation). Non-indexed large datasets
   * may need a composite index if performance degrades.
   */
  getSessionsForUser(userId: string): Observable<QuestioningSession[]> {
    const sessionsRef = ref(this.db, 'questioning-sessions');
    const q = query(sessionsRef, orderByChild('userId'), equalTo(userId));
    return from(get(q)).pipe(
      map(snap => {
        if (!snap.exists()) return [];
        const out: QuestioningSession[] = [];
        snap.forEach(child => { out.push(child.val() as QuestioningSession); });
        // Sort by startedAt if numeric; else leave
        return out;
      })
    );
  }

  // ===========================
  // Attempts
  // ===========================

  /**
   * Saves a user's attempt for a question.
   * @param attemptData The attempt data to save.
   * @returns Observable<string> The ID of the newly created attempt.
   */
  saveAttempt(attemptData: Omit<Attempt, 'id' | 'createdAt'>): Observable<string> {
    const attemptsRef = ref(this.db, 'attempts');
    const newAttemptRef = push(attemptsRef);
    const attempt: Attempt = {
      id: newAttemptRef.key!,
      ...attemptData,
      createdAt: serverTimestamp()
    };
    return from(set(newAttemptRef, attempt)).pipe(map(() => newAttemptRef.key!));
  }

  /**
   * Retrieves all attempts for a specific questioning session.
   * @param questioningSessionId The ID of the session.
   * @returns Observable<Attempt[]>
   */
  getAttemptsForSession(questioningSessionId: string): Observable<Attempt[]> {
    const attemptsRef = ref(this.db, 'attempts');
    const q = query(attemptsRef, orderByChild('questioningSessionId'), equalTo(questioningSessionId));
    return from(get(q)).pipe(
      map(snap => {
        if (!snap.exists()) return [];
        const attempts: Attempt[] = [];
        snap.forEach(child => {
          attempts.push(child.val() as Attempt);
        });
        return attempts.sort((a, b) => (a.createdAt as unknown as number) - (b.createdAt as unknown as number));
      })
    );
  }

  /**
   * Retrieves all attempts made by a specific user.
   * @param userId The ID of the user.
   * @returns Observable<Attempt[]>
   */
  getAttemptsForUser(userId: string): Observable<Attempt[]> {
    const attemptsRef = ref(this.db, 'attempts');
    const q = query(attemptsRef, orderByChild('userId'), equalTo(userId));
    return from(get(q)).pipe(
      map(snap => {
        if (!snap.exists()) return [];
        const attempts: Attempt[] = [];
        snap.forEach(child => {
          attempts.push(child.val() as Attempt);
        });
        return attempts;
      })
    );
  }

  getIncorrectAttemptsForSession(sessionId: string): Observable<Attempt[]> {
    return this.getAttemptsForSession(sessionId).pipe(
      map(attempts => attempts.filter(a => !a.isCorrect))
    );
  }

  /**
   * Returns a map keyed by questionId with { total, correct, incorrect } counts for a user.
   */
  getUserQuestionStats(userId: string): Observable<Record<string, { total: number; correct: number; incorrect: number }>> {
    return this.getAttemptsForUser(userId).pipe(
      map(attempts => {
        const stats: Record<string, { total: number; correct: number; incorrect: number }> = {};
        attempts.forEach(a => {
          const id = a.questionId;
          if (!stats[id]) stats[id] = { total: 0, correct: 0, incorrect: 0 };
          stats[id].total++;
          if (a.isCorrect) stats[id].correct++; else stats[id].incorrect++;
        });
        return stats;
      })
    );
  }
}
