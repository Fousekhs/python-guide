import { Injectable } from '@angular/core';
import { SubjectContent } from './content.service';

export type PracticeMode = 'random' | 'worst';

interface PracticeSessionData {
  mode: PracticeMode;
  sessionId: string; // questioning session id for logging attempts
  questions: SubjectContent[]; // prepared subset for practice
}

@Injectable({ providedIn: 'root' })
export class PracticeService {
  private data: PracticeSessionData | null = null;

  set(data: PracticeSessionData) {
    this.data = data;
  }

  get(): PracticeSessionData | null {
    return this.data;
  }

  clear() {
    this.data = null;
  }
}
