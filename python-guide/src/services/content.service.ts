import { Injectable } from '@angular/core';
import { Database, ref, set, push, get, update, remove } from '@angular/fire/database';
import {
  serverTimestamp,
  query,
  orderByChild,
  limitToLast,
  onValue,
} from 'firebase/database';
import { from, Observable, map, switchMap } from 'rxjs';

// ===========================
// Types
// ===========================

export type ContentType = 'theory' | 'mcq' | 'truefalse' | 'code';

export interface CodeSegment {
  code: string;
  language: string;
  explanation?: string;
}

interface BaseContent {
  id?: string;
  title: string;
  type: ContentType;
  order: number;
  createdAt?: object;  // serverTimestamp()
  updatedAt?: object;  // serverTimestamp()
}

export interface TheoryContent extends BaseContent {
  type: 'theory';
  content: string;
}

export interface MultipleChoiceQuestion extends BaseContent {
  type: 'mcq';
  question: string;
  options: string[];
  correctAnswer: number;
  // New fields
  timeLimitSeconds?: number;
  maxPoints?: number;
  explanation?: string;
}

export interface TrueFalseQuestion extends BaseContent {
  type: 'truefalse';
  question: string;
  correctAnswer: boolean;
  timeLimitSeconds?: number;
  maxPoints?: number;
  explanation?: string;
}

export interface CodeQuestion extends BaseContent {
  type: 'code';
  question: string;
  starterCode: string;
  solution: string;
  testCases: {
    input: string;
    expectedOutput: string;
    description?: string;
  }[];
  hints?: string[];
  explanation?: string;
}

export type SubjectContent =
  | TheoryContent
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | CodeQuestion;

export interface Subject {
  id?: string;
  title: string;
  description: string;
  contents: SubjectContent[]; // stored as an object in RTDB; this is for typing convenience
  order: number;
  sectionId: string;
  /** Minimum total points required to access this subject (defaults to 0 if absent) */
  minPointsRequired?: number;
  createdAt?: object;
  updatedAt?: object;
}

export interface Section {
  id?: string;
  title: string;
  description: string;
  subjects: Subject[]; // stored as an object in RTDB
  order: number;
  isPublished: boolean;
  createdAt?: object;
  updatedAt?: object;
  publishedAt?: object | null;
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  constructor(private db: Database) {}

  // ===========================
  // Helpers
  // ===========================

  /** Compute the next order index at a given list path by reading the last item. */
  private nextOrder(path: string): Observable<number> {
    const q = query(ref(this.db, path), orderByChild('order'), limitToLast(1));
    return from(get(q)).pipe(
      map((snap) => {
        if (!snap.exists()) return 0;
        let max = -1;
        snap.forEach((child) => {
          const v = child.val();
          if (typeof v?.order === 'number' && v.order > max) max = v.order;
        });
        return max + 1;
      })
    );
  }

  private sortByOrder<T extends { order: number }>(arr: T[]): T[] {
    return arr.sort((a, b) => a.order - b.order);
  }

  // ===========================
  // Sections
  // ===========================

  createSection(
    section: Omit<Section, 'id' | 'order' | 'createdAt' | 'updatedAt' | 'publishedAt'>
  ): Observable<string> {
    const listPath = `sections`;
    const sectionsRef = ref(this.db, listPath);
    return this.nextOrder(listPath).pipe(
      switchMap((order) => {
        const newRef = push(sectionsRef);
        const payload: Section = {
          ...section,
          id: newRef.key!,
          order,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          publishedAt: section.isPublished ? serverTimestamp() : null,
        };
        return from(set(newRef, payload)).pipe(map(() => newRef.key!));
      })
    );
  }

  updateSection(sectionId: string, section: Partial<Section>): Observable<void> {
    const sectionRef = ref(this.db, `sections/${sectionId}`);
    const patch: Partial<Section> = {
      ...section,
      updatedAt: serverTimestamp(),
      ...(section.isPublished === true ? { publishedAt: serverTimestamp() } : {}),
      ...(section.isPublished === false ? { publishedAt: null } : {}),
    };
    return from(update(sectionRef, patch));
  }

  /** Hard delete (consider soft-delete if you reference sections elsewhere). */
  deleteSection(sectionId: string): Observable<void> {
    const sectionRef = ref(this.db, `sections/${sectionId}`);
    return from(remove(sectionRef));
  }

  getSection(sectionId: string): Observable<Section | null> {
    const sectionRef = ref(this.db, `sections/${sectionId}`);
    return from(get(sectionRef)).pipe(
      map((snap) => {
        if (!snap.exists()) return null;
        
        const sectionData = snap.val();
        const subjects: Subject[] = [];
        
        // Extract subjects from the nested subjects object
        if (sectionData.subjects) {
          Object.keys(sectionData.subjects).forEach(subjectKey => {
            const subjectData = sectionData.subjects[subjectKey];
            const contents: SubjectContent[] = [];
            
            // Extract contents from the nested contents object
            if (subjectData.contents) {
              Object.keys(subjectData.contents).forEach(contentKey => {
                const content = subjectData.contents[contentKey];
                if (content.type) {
                  contents.push({
                    id: contentKey,
                    ...content
                  });
                }
              });
            }
            
            subjects.push({
              id: subjectKey,
              ...subjectData,
              contents: this.sortByOrder(contents)
            });
          });
        }
        
        return {
          id: sectionId,
          ...sectionData,
          subjects: this.sortByOrder(subjects)
        } as Section;
      })
    );
  }

  getAllSections(): Observable<Section[]> {
    const sectionsRef = ref(this.db, 'sections');
    return from(get(sectionsRef)).pipe(
      map((snap) => {
        if (!snap.exists()) return [];
        const out: Section[] = [];
        snap.forEach((child) => {
          const sectionData = child.val();
          const subjects: Subject[] = [];
          
          // Extract subjects from the nested subjects object
          if (sectionData.subjects) {
            Object.keys(sectionData.subjects).forEach(subjectKey => {
              const subjectData = sectionData.subjects[subjectKey];
              const contents: SubjectContent[] = [];
              
              // Extract contents from the nested contents object
              if (subjectData.contents) {
                Object.keys(subjectData.contents).forEach(contentKey => {
                  const content = subjectData.contents[contentKey];
                  if (content.type) {
                    // Backward compatibility: Some theory items may still have a legacy minPointsRequired field.
                    // It is now ignored at the theory level (subject-level gating only).
                    contents.push({
                      id: contentKey,
                      ...content
                    });
                  }
                });
              }
              
              subjects.push({
                id: subjectKey,
                ...subjectData,
                contents: this.sortByOrder(contents)
              });
            });
          }
          
          out.push({
            id: child.key!,
            ...sectionData,
            subjects: this.sortByOrder(subjects)
          });
          return false;
        });
        return this.sortByOrder(out);
      })
    );
  }

  getPublishedSections(): Observable<Section[]> {
    return this.getAllSections().pipe(
      map((sections) => sections.filter((section) => section.isPublished))
    );
  }

  publishSection(sectionId: string): Observable<void> {
    return this.updateSection(sectionId, { isPublished: true });
  }

  unpublishSection(sectionId: string): Observable<void> {
    return this.updateSection(sectionId, { isPublished: false });
  }

  reorderSections(sections: Section[]): Observable<void> {
    const updates: Record<string, any> = {};
    sections.forEach((s, idx) => {
      if (!s?.id) return;
      updates[`sections/${s.id}/order`] = idx;
      updates[`sections/${s.id}/updatedAt`] = serverTimestamp();
    });
    return from(update(ref(this.db), updates));
  }

  // ===========================
  // Subjects
  // ===========================

  createSubject(
    sectionId: string,
    subject: Omit<Subject, 'id' | 'sectionId' | 'order' | 'createdAt' | 'updatedAt'>
  ): Observable<string> {
    const listPath = `sections/${sectionId}/subjects`;
    return this.nextOrder(listPath).pipe(
      switchMap((order) => {
        const newRef = push(ref(this.db, listPath));
        const payload: Subject = {
          ...subject,
          id: newRef.key!,
          sectionId,
          order,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        return from(set(newRef, payload)).pipe(map(() => newRef.key!));
      })
    );
  }

  updateSubject(
    sectionId: string,
    subjectId: string,
    subject: Partial<Subject>
  ): Observable<void> {
    const subjectRef = ref(this.db, `sections/${sectionId}/subjects/${subjectId}`);
    const patch: Partial<Subject> = { ...subject, updatedAt: serverTimestamp() };
    return from(update(subjectRef, patch));
  }

  deleteSubject(sectionId: string, subjectId: string): Observable<void> {
    const subjectRef = ref(this.db, `sections/${sectionId}/subjects/${subjectId}`);
    return from(remove(subjectRef));
  }

  getSubject(sectionId: string, subjectId: string): Observable<Subject | null> {
    const subjectRef = ref(this.db, `sections/${sectionId}/subjects/${subjectId}`);
    return from(get(subjectRef)).pipe(
      map((snap) => {
        if (!snap.exists()) return null;
        
        const subjectData = snap.val();
        const contents: SubjectContent[] = [];
        
        // Extract contents from the nested contents object
        if (subjectData.contents) {
          Object.keys(subjectData.contents).forEach(contentKey => {
            const content = subjectData.contents[contentKey];
            if (content.type) {
              contents.push({
                id: contentKey,
                ...content
              });
            }
          });
        }
        
        return {
          id: subjectId,
          ...subjectData,
          contents: this.sortByOrder(contents)
        } as Subject;
      })
    );
  }

  getSubjectsBySectionId(sectionId: string): Observable<Subject[]> {
    const subjectsRef = ref(this.db, `sections/${sectionId}/subjects`);
    return from(get(subjectsRef)).pipe(
      map((snap) => {
        if (!snap.exists()) return [];
        const out: Subject[] = [];
        snap.forEach((child) => {
          const subjectData = child.val();
          const contents: SubjectContent[] = [];
          
          // Extract contents from the nested contents object
          if (subjectData.contents) {
            Object.keys(subjectData.contents).forEach(contentKey => {
              const content = subjectData.contents[contentKey];
              if (content.type) {
                contents.push({
                  id: contentKey,
                  ...content
                });
              }
            });
          }
          
          out.push({
            id: child.key!,
            ...subjectData,
            contents: this.sortByOrder(contents)
          });
          return false;
        });
        return this.sortByOrder(out);
      })
    );
  }

  reorderSubjects(sectionId: string, subjects: Subject[]): Observable<void> {
    const updates: Record<string, any> = {};
    subjects.forEach((s, idx) => {
      if (!s?.id) return;
      updates[`sections/${sectionId}/subjects/${s.id}/order`] = idx;
      updates[`sections/${sectionId}/subjects/${s.id}/updatedAt`] = serverTimestamp();
    });
    return from(update(ref(this.db), updates));
  }

  // ===========================
  // Subject Content
  // ===========================

  addContentToSubject(
    sectionId: string,
    subjectId: string,
    content: Omit<SubjectContent, 'id' | 'order' | 'createdAt' | 'updatedAt'>
  ): Observable<string> {
    const listPath = `sections/${sectionId}/subjects/${subjectId}/contents`;
    return this.nextOrder(listPath).pipe(
      switchMap((order) => {
        const newRef = push(ref(this.db, listPath));
        const payload: SubjectContent = {
          ...(content as SubjectContent),
          id: newRef.key!,
          order,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        return from(set(newRef, payload)).pipe(map(() => newRef.key!));
      })
    );
  }

  updateSubjectContent(
    sectionId: string,
    subjectId: string,
    contentId: string,
    content: Partial<SubjectContent>
  ): Observable<void> {
    const contentRef = ref(this.db, `sections/${sectionId}/subjects/${subjectId}/contents/${contentId}`);
    const patch: Partial<SubjectContent> = { ...content, updatedAt: serverTimestamp() };
    return from(update(contentRef, patch));
  }

  deleteSubjectContent(
    sectionId: string,
    subjectId: string,
    contentId: string
  ): Observable<void> {
    const contentRef = ref(this.db, `sections/${sectionId}/subjects/${subjectId}/contents/${contentId}`);
    return from(remove(contentRef));
  }

  getSubjectContent(
    sectionId: string,
    subjectId: string,
    contentId: string
  ): Observable<SubjectContent | null> {
    const contentRef = ref(this.db, `sections/${sectionId}/subjects/${subjectId}/contents/${contentId}`);
    return from(get(contentRef)).pipe(
      map(snap => {
        if (!snap.exists()) return null;
        return { id: snap.key!, ...snap.val() } as SubjectContent;
      })
    );
  }

  getSubjectContents(
    sectionId: string,
    subjectId: string
  ): Observable<SubjectContent[]> {
    const contentsRef = ref(this.db, `sections/${sectionId}/subjects/${subjectId}/contents`);
    return from(get(contentsRef)).pipe(
      map((snap) => {
        if (!snap.exists()) return [];
        const out: SubjectContent[] = [];
        snap.forEach((child) => {
          const content = child.val();
          if (content.type) {
            out.push({ id: child.key!, ...content });
          }
          return false;
        });
        return this.sortByOrder(out);
      })
    );
  }

  reorderSubjectContent(
    sectionId: string,
    subjectId: string,
    contents: SubjectContent[]
  ): Observable<void> {
    const updates: Record<string, any> = {};
    contents.forEach((c, idx) => {
      if (!c?.id) return;
      updates[`sections/${sectionId}/subjects/${subjectId}/contents/${c.id}/order`] = idx;
      updates[`sections/${sectionId}/subjects/${subjectId}/contents/${c.id}/updatedAt`] = serverTimestamp();
    });
    return from(update(ref(this.db), updates));
  }
}
