import { Component } from '@angular/core';
import { OnInit } from '@angular/core';
import { Observable, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { Router } from '@angular/router';
import { SectionComponent } from '../section/section.component';
import { SectionContainerComponent } from '../section-container/section-container.component';
import { SubjectCardComponent } from '../subject-card/subject-card.component';
import { PythonComponent } from '../../assets/icons/python-logo.component';
import { LoginComponent } from '../../assets/icons/login.component';
import { LogoutComponent } from '../../assets/icons/log-out.component';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ContentService, Section, Subject, SubjectContent } from '../../services/content.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserService } from '../../services/user.service';
import { AttemptService } from '../../services/attempt.service';
import { PracticeService } from '../../services/practice.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, SectionComponent, SectionContainerComponent, SubjectCardComponent, PythonComponent, LoginComponent, LogoutComponent, MatProgressSpinnerModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  userIsAuthenticated$!: Observable<boolean>;
  userDisplayName$!: Observable<string>;
  userPoints$!: Observable<number>;
  sections$!: Observable<(Section & {
    sectionEarnedPoints?: number;
    sectionPotentialMaxPoints?: number;
    subjects: (Subject & {
      available: boolean;
      earnedPoints: number;
      requiredPoints: number;
      userTotalPoints: number;
      potentialMaxPoints: number;
    })[]
  })[]>;

  // Derived UI state
  hasPassedSubject$!: Observable<boolean>;

  constructor(
    private router: Router,
    private authService: AuthService,
    private contentService: ContentService,
    private userService: UserService,
    private attemptService: AttemptService,
    private practiceService: PracticeService
  ) {}

  ngOnInit(): void {
    const auth$ = this.authService.authState();

    this.userIsAuthenticated$ = auth$.pipe(map(u => !!u));
    this.userDisplayName$ = auth$.pipe(map(u => u?.displayName ?? 'Guest'));

    this.userPoints$ = auth$.pipe(
      switchMap(u => u ? this.userService.getUserPoints(u.uid) : of(0))
    );

    // Enrich sections with per-subject availability and earned points (auth enforced by guard)
    this.sections$ = auth$.pipe(
      switchMap(user => this.contentService.getAllSections().pipe(
        switchMap(sections => {
          return this.userService.getUserPoints(user!.uid).pipe(
            switchMap(totalPts => {
              // For each subject, also retrieve subject progress for earned points
              const enriched = sections.map(sec => ({
                ...sec,
                subjects: (sec.subjects || []).map(sub => ({ sub, sec }))
              }));

              // Flatten subjects for progress fetches
              const subjectProgressCalls = enriched.flatMap(s => (s.subjects).map(wrapper =>
                this.userService.getSubjectProgress(user!.uid, wrapper.sec.id!, wrapper.sub.id!).pipe(
                  map(progress => ({ wrapper, progress }))
                )
              ));

              if (subjectProgressCalls.length === 0) return of(sections as any);

              return combineLatest(subjectProgressCalls).pipe(
                map(results => {
                  const progressMap = new Map<string, number>();
                  results.forEach(r => {
                    const key = `${r.wrapper.sec.id}|${r.wrapper.sub.id}`;
                    progressMap.set(key, r.progress?.points || 0);
                  });
                  const enrichedSections = sections.map(sec => {
                    let sectionEarnedPoints = 0;
                    let sectionPotentialMaxPoints = 0;
                    const subjects = (sec.subjects || []).map(sub => {
                      const required = sub.minPointsRequired || 0;
                      const earned = progressMap.get(`${sec.id}|${sub.id}`) || 0;
                      const available = totalPts >= required;
                      const potentialMaxPoints = (sub.contents || []).reduce((acc, c: any) => {
                        if (typeof c?.maxPoints === 'number') return acc + (c.maxPoints || 0);
                        return acc;
                      }, 0);
                      sectionEarnedPoints += earned;
                      sectionPotentialMaxPoints += potentialMaxPoints;
                      return {
                        ...sub,
                        available,
                        earnedPoints: earned,
                        requiredPoints: required,
                        userTotalPoints: totalPts,
                        potentialMaxPoints
                      };
                    });
                    return {
                      ...sec,
                      sectionEarnedPoints,
                      sectionPotentialMaxPoints,
                      subjects
                    };
                  });
                  return enrichedSections;
                })
              );
            })
          );
        })
      ))
    );

    // A passed subject => earnedPoints >= some threshold; for now treat earnedPoints > 0 as passed (since true pass flag not stored here).
    this.hasPassedSubject$ = this.sections$.pipe(
      map((sections: any[]) => sections.some(sec => sec.subjects.some((s: any) => s.earnedPoints > 0)))
    );
  }

  login(): void { this.router.navigate(['/login']); }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: (err) => { alert('Logout failed. Please try again.'); console.error('Logout failed', err); }
    });
  }

  private extractPassedQuestions(sections: any[]): SubjectContent[] {
    const out: SubjectContent[] = [];
    sections.forEach((sec: any) => sec.subjects.forEach((sub: any) => {
      if (sub.earnedPoints > 0 && Array.isArray(sub.contents)) {
        sub.contents.forEach((c: SubjectContent) => {
          if (c?.id && (c.type === 'mcq' || c.type === 'truefalse')) out.push(c);
        });
      }
    }));
    return out;
  }

  async startRandomPractice(): Promise<void> {
    const user = await firstValueFrom(this.authService.authState().pipe(take(1))); if (!user) return;
    const sections: any[] = await firstValueFrom(this.sections$.pipe(take(1)));
    const pool = this.extractPassedQuestions(sections);
    if (!pool.length) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
    // Create session for auditing attempts (use synthetic section id 'practice-random')
    const sessionId = await firstValueFrom(this.attemptService.createQuestioningSession(user.uid, 'practice-random', 'practice', 'random'));
    this.practiceService.set({ mode: 'random', sessionId, questions: shuffled });
    this.router.navigate(['/random']);
  }

  async startWorstPractice(): Promise<void> {
    const user = await firstValueFrom(this.authService.authState().pipe(take(1))); if (!user) return;
    const sections: any[] = await firstValueFrom(this.sections$.pipe(take(1)));
    const pool = this.extractPassedQuestions(sections);
    if (!pool.length) return;
    const stats = await firstValueFrom(this.attemptService.getUserQuestionStats(user.uid).pipe(take(1)));
    const neverCorrect: { content: SubjectContent; incorrect: number }[] = [];
    const withRatios: { content: SubjectContent; ratio: number; incorrect: number }[] = [];
    pool.forEach(c => {
      const st = (stats as any)[c.id!];
      if (!st) return;
      if (st.correct === 0 && st.incorrect > 0) {
        neverCorrect.push({ content: c, incorrect: st.incorrect });
      } else if (st.total > 0) {
        const ratio = st.correct / st.total;
        if (ratio < 1) withRatios.push({ content: c, ratio, incorrect: st.incorrect });
      }
    });
    neverCorrect.sort((a, b) => b.incorrect - a.incorrect);
    const selected: SubjectContent[] = neverCorrect.map(n => n.content);
    if (selected.length < 10) {
      withRatios.sort((a, b) => a.ratio - b.ratio || b.incorrect - a.incorrect);
      for (const q of withRatios) {
        if (selected.length >= 10) break;
        if (!selected.includes(q.content)) selected.push(q.content);
      }
    }
    const finalSet = selected.slice(0, 10);
    const sessionId = await firstValueFrom(this.attemptService.createQuestioningSession(user.uid, 'practice-worst', 'practice', 'worst'));
    this.practiceService.set({ mode: 'worst', sessionId, questions: finalSet });
    this.router.navigate(['/worst']);
  }

  goToGlobalLeaderboard(): void {
    this.router.navigate(['/leaderboard']);
  }

  goToStats(): void {
    this.router.navigate(['/stats']);
  }
}