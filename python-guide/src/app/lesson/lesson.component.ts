import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { CapmaxProgressbarComponent } from '../capmax-progressbar/capmax-progressbar.component';
import { HomeIconComponent } from '../../assets/icons/home.component';
import { Observable, switchMap, forkJoin, of, EMPTY, firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { ContentService, SubjectContent } from '../../services/content.service';
import { TheoryUnitComponent } from '../theory-unit/theory-unit.component';
import { McqUnitComponent } from '../mcq-unit/mcq-unit.component';
import { AttemptService } from '../../services/attempt.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { ResultsVisualizationComponent } from '../results-visualization/results-visualization.component';
import { PracticeService, PracticeMode } from '../../services/practice.service';
import { NgxEchartsModule } from 'ngx-echarts';

@Component({
  selector: 'app-lesson',
  imports: [CommonModule, TheoryUnitComponent, McqUnitComponent, HomeIconComponent, CapmaxProgressbarComponent, ResultsVisualizationComponent, NgxEchartsModule],
  standalone: true,
  templateUrl: './lesson.component.html',
  styleUrl: './lesson.component.css'
})
export class LessonComponent {
  // lessons: Lesson[] = [{'id': 1, 'type': 'theory'}, {'id': 2, 'type': 'multiple-choice'}, {'id': 3, 'type': 'code'}, {'id': 4, 'type': 'theory'}, {'id': 5, 'type': 'multiple-choice'}];
  currentLessonIndex = 0;
  sessionId!: string;
  sectionId!: string;
  subjectId!: string;
  userId!: string;
  lessons: SubjectContent[] = [];
  // Holds the full original set of question contents (mcq/truefalse) for the session
  allQuestionContents: SubjectContent[] = [];
  totalPoints: number = 0;

  score: number = 0;
  efficiency: number = 0;
  mastery: number = 0;
  previousPoints: number = 0;
  newPoints: number = 0;
  pointsDelta: number = 0;
  passedNow: boolean = false; // current run pass status

  timeout: boolean = false;
  finished: boolean = false;
  result: boolean = false;
  retry:boolean = false;
  leaderboardReady: boolean = false; // Track when all DB operations are complete

  // Practice summary stats
  practiceCorrect = 0;
  practiceIncorrect = 0;
  practiceGaugeOption: any = null;

  trueFalseOptions = ['True', 'False'];
  
  getTrueFalseCorrectAnswer(answer: boolean): number {
    return answer ? 0 : 1;
  }

  constructor(private contentService: ContentService, private router: Router, private route: ActivatedRoute, private attemptService: AttemptService, private userService: UserService, private authService: AuthService, private practiceService: PracticeService) {}

  // Practice mode flags
  isPractice: boolean = false;
  practiceMode: PracticeMode | null = null;
  practiceSectionId = 'practice';
  practiceSubjectId = 'practice';

  get practicePercent(): number {
    const total = this.practiceCorrect + this.practiceIncorrect;
    if (!total) return 0;
    return (this.practiceCorrect / total) * 100;
  }

  get practiceGaugeColor(): string {
    const p = this.practicePercent;
    if (p < 50) return '#dc2626'; // red
    if (p < 75) return '#f59e0b'; // orange
    return '#16a34a'; // green
  }

  private buildPracticeGauge(): any {
    const value = Math.max(0, Math.min(100, this.practicePercent));
    const color = this.practiceGaugeColor;
    return {
      series: [
        {
          name: 'Practice',
          type: 'gauge',
            min: 0,
            max: 100,
            startAngle: 220,
            endAngle: -40,
            axisLine: { lineStyle: { width: 16, color: [[1, '#243340']] } },
            progress: { show: true, width: 16, roundCap: true, itemStyle: { color } },
            splitLine: { show: false },
            axisTick: { show: false },
            axisLabel: { show: false },
            pointer: { show: false },
            detail: { show: false },
            data: [{ value, name: 'Practice' }]
        }
      ]
    };
  }

  ngOnInit(): void {
    // Detect practice mode via route data/practice path (random/worst have no params)
    const dataPracticeMode = this.route.snapshot.data['practiceMode'] as PracticeMode | undefined;
    if (dataPracticeMode) {
      this.isPractice = true;
      this.practiceMode = dataPracticeMode;
      const practiceData = this.practiceService.get();
      if (!practiceData || practiceData.mode !== dataPracticeMode) {
        // If user refreshed or came directly, redirect home
        this.router.navigate(['/']);
        return;
      }
  this.sessionId = practiceData.sessionId;
  // Use synthetic identifiers so attempts have valid references
  this.sectionId = `${this.practiceSectionId}-${dataPracticeMode}`;
  this.subjectId = `${this.practiceSubjectId}-${dataPracticeMode}`;
      // In practice we only have selected questions (already mcq/truefalse)
      this.lessons = practiceData.questions;
      this.allQuestionContents = practiceData.questions;
      this.totalPoints = practiceData.questions.reduce((sum, c) => {
        if (c.type === 'mcq' || c.type === 'truefalse') return sum + (c.maxPoints || 0);
        return sum;
      }, 0);
      // Acquire user id (for attempts) silently
  this.authService.authState().pipe(take(1)).subscribe(u => this.userId = (u as any)?.uid || '');
      return;
    }

    // Normal lesson path
    this.sectionId = this.route.snapshot.paramMap.get('sectionId') as string;
    this.subjectId = this.route.snapshot.paramMap.get('subjectId') as string;

    if (this.sectionId && this.subjectId) {
      this.authService.authState().pipe(
        switchMap(user => {
          if (!user) {
            this.router.navigate(['/login']);
            return EMPTY;
          }
          this.userId = user.uid;
          return this.attemptService.createQuestioningSession(this.userId, this.sectionId, this.subjectId);
        }),
        switchMap((sessionId: string) => {
          this.sessionId = sessionId;
          console.log('Created session with ID:', sessionId);
          return this.contentService.getSubjectContents(this.sectionId, this.subjectId);
        })
      ).subscribe(contents => {
        this.lessons = contents;
        this.allQuestionContents = contents.filter(c => c.type === 'truefalse' || c.type === 'mcq');
        this.totalPoints = this.lessons.filter(c => c.type === 'truefalse' || c.type === 'mcq').reduce((sum, c) => sum + (c.maxPoints || 0), 0);
        console.log('No of fetched contents:', contents.length);
        contents.forEach((c, i) => console.log(`Type ${i + 1}:`, c.type));
      });
    }
  }

  get currentLesson() {
    return this.lessons[this.currentLessonIndex];
  }

  get numberOfLessons() {
    return this.lessons.length;
  }

  goToNextLesson(): void {
    if (this.currentLessonIndex >= this.numberOfLessons - 1) {
      this.finished = true;
      if (this.isPractice) {
        // Summarize attempts for practice: count correct/incorrect from session attempts
        this.attemptService.getAttemptsForSession(this.sessionId).subscribe(attempts => {
          const relevant = attempts.filter(a => a.questioningSessionId === this.sessionId);
          this.practiceCorrect = relevant.filter(a => a.isCorrect).length;
          this.practiceIncorrect = relevant.filter(a => !a.isCorrect).length;
            this.practiceGaugeOption = this.buildPracticeGauge();
          this.result = true;
        });
        return;
      }
      if (this.retry) {
        this.showResults();
        return;
      }
      this.reviewLesson();
      return;
    }
    this.timeout = false;
    this.currentLessonIndex++;
  }

  reviewLesson(): void {
    if (this.isPractice) {
      return; // no review step in practice
    }
    this.getIncorrectQuestionsForCurrentSession().subscribe(contents => {
      console.log('Incorrect questions:', contents);
      this.result = true;
      if (contents.length === 0) {
        alert('Congratulations! You answered all questions correctly.');
        this.showResults();
        return;
      }
      this.retry = true;
      this.lessons = contents;
    });
  }

  finishLesson(): void {
    if (this.isPractice) {
      // Only mark session complete, no points/leaderboard persistence
      this.attemptService.completeQuestioningSession(this.sessionId).subscribe();
      return;
    }
    this.attemptService.completeQuestioningSession(this.sessionId).subscribe({
      next: () => {
        console.log('Session marked as complete');
      },
      error: (err) => {
        alert('Failed to complete session. Please try again.');
        console.error('Failed to complete session', err);
      }
    });
  }

  showResults(): void {
    this.result = true;
    if (!this.isPractice) {
      this.computeScores();
      this.retry = false;
      this.finishLesson();
    } else {
      // Practice: ensure summary is populated if user clicks early (edge)
      this.attemptService.getAttemptsForSession(this.sessionId).subscribe(attempts => {
        const relevant = attempts.filter(a => a.questioningSessionId === this.sessionId);
        this.practiceCorrect = relevant.filter(a => a.isCorrect).length;
        this.practiceIncorrect = relevant.filter(a => !a.isCorrect).length;
        this.practiceGaugeOption = this.buildPracticeGauge();
        this.finishLesson();
      });
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  reviewIncorrectQuestions(): void {
    this.currentLessonIndex = 0;
    this.finished = false;
    this.timeout = false;
  }

  timeUp(): void {
    this.timeout = true;
  }

  retryLesson(): void {
    if (this.isPractice) return; // no retry in practice mode
    // Start a completely new session - like pressing the lesson from home again
    this.leaderboardReady = false; // Reset leaderboard state
    
    // Create a new questioning session
    this.attemptService.createQuestioningSession(this.userId, this.sectionId, this.subjectId).pipe(
      switchMap((sessionId: string) => {
        this.sessionId = sessionId;
        console.log('Created new retry session with ID:', sessionId);
        // Get all subject contents fresh
        return this.contentService.getSubjectContents(this.sectionId, this.subjectId);
      })
    ).subscribe(contents => {
      // Reset everything to initial state
      this.lessons = contents;
      this.allQuestionContents = contents.filter(c => c.type === 'truefalse' || c.type === 'mcq');
      this.currentLessonIndex = 0;
      this.finished = false;
      this.result = false;
      this.retry = false;
      this.timeout = false;
      
      // Reset score tracking
      this.score = 0;
      this.efficiency = 0;
      this.mastery = 0;
      this.previousPoints = 0;
      this.newPoints = 0;
      this.pointsDelta = 0;
      this.passedNow = false;
      
      console.log('Fresh retry session started with', contents.length, 'questions');
    });
  }

  async startAnotherPractice(): Promise<void> {
    if (!this.isPractice || !this.practiceMode) return;
    const user = await firstValueFrom(this.authService.authState().pipe(take(1)));
    if (!user) { this.router.navigate(['/login']); return; }

    // Helper to gather pool of passed questions (subjects with points > 0)
    const gatherPassedQuestionPool = async (): Promise<SubjectContent[]> => {
      const sections = await firstValueFrom(this.contentService.getAllSections().pipe(take(1)));
      const pool: SubjectContent[] = [];
      for (const sec of sections) {
        for (const sub of (sec.subjects || [])) {
          try {
            const prog = await firstValueFrom(this.userService.getSubjectProgress(user.uid, sec.id!, sub.id!).pipe(take(1)));
            if ((prog?.points || 0) > 0) {
              (sub.contents || []).forEach((c: any) => {
                if (c?.id && (c.type === 'mcq' || c.type === 'truefalse')) pool.push(c);
              });
            }
          } catch { /* ignore individual subject errors */ }
        }
      }
      return pool;
    };

    const mode = this.practiceMode;
    const pool = await gatherPassedQuestionPool();
    if (!pool.length) { this.goHome(); return; }

    let newSet: SubjectContent[] = [];
    if (mode === 'random') {
      newSet = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
    } else if (mode === 'worst') {
      const stats: any = await firstValueFrom(this.attemptService.getUserQuestionStats(user.uid).pipe(take(1)));
      const neverCorrect: { content: SubjectContent; incorrect: number }[] = [];
      const withRatios: { content: SubjectContent; ratio: number; incorrect: number }[] = [];
      pool.forEach(c => {
        const st = stats[c.id!];
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
      newSet = selected.slice(0, 10);
    }

    if (!newSet.length) { this.goHome(); return; }

    const syntheticSection = `practice-${mode}`;
  const newSessionId = await firstValueFrom(this.attemptService.createQuestioningSession(user.uid, syntheticSection, 'practice', mode));
    this.practiceService.set({ mode, sessionId: newSessionId, questions: newSet });

    // Reset component state to begin new practice flow
    this.sessionId = newSessionId;
    this.sectionId = `${this.practiceSectionId}-${mode}`;
    this.subjectId = `${this.practiceSubjectId}-${mode}`;
    this.lessons = newSet;
    this.allQuestionContents = newSet;
    this.practiceCorrect = 0;
    this.practiceIncorrect = 0;
    this.currentLessonIndex = 0;
    this.finished = false;
    this.result = false;
    this.retry = false;
    this.timeout = false;
    this.practiceGaugeOption = this.buildPracticeGauge();
  }

  private updateResultsPersistence() {
    if (this.isPractice) return; // do not persist points for practice
    // save to session
    this.attemptService.updateQuestioningSessionResults(this.sessionId, {
      efficiency: this.efficiency,
      mastery: this.mastery,
      pointsGained: this.pointsDelta
    }).subscribe({ next: () => {}, error: () => {} });
  }

  computeScores() {
    if (this.isPractice) return; // skip scoring logic in practice
    this.attemptService.getAttemptsForSession(this.sessionId).subscribe(attempts => {
      // Always use the full original question list for denominator (even if we are on a retry subset)
      const answeredContent = this.allQuestionContents.length > 0
        ? this.allQuestionContents
        : this.lessons.filter(c => c.type === 'mcq' || c.type === 'truefalse');
      const totalQuestions = answeredContent.length;
      const correctAttempts1 = attempts.filter(a => a.isCorrect && !a.isRetry).length;
      const correctAttempts2 = attempts.filter(a => a.isCorrect && a.isRetry).length;
      
      console.log(`DEBUG: totalQuestions=${totalQuestions}, correctAttempts1=${correctAttempts1}, correctAttempts2=${correctAttempts2}`);
      console.log('DEBUG: attempts=', attempts);
      console.log('DEBUG: answeredContent=', answeredContent);
      
      let efficiency = totalQuestions > 0 ? (correctAttempts1 / totalQuestions) * 100 : 0;
      let mastery = totalQuestions > 0 ? ((correctAttempts1 + correctAttempts2) / totalQuestions) * 100 : 0;

      // Clamp defensively
      efficiency = Math.min(100, Math.max(0, efficiency));
      mastery = Math.min(100, Math.max(0, mastery));

      // Assign
      this.efficiency = efficiency;
      this.mastery = mastery;

  const getQPoints = (questionId: string) => {
        const q = answeredContent.find(c => c.id === questionId);
        // Only mcq / truefalse have maxPoints
        if (q && (q.type === 'mcq' || q.type === 'truefalse')) {
          return q.maxPoints || 0;
        }
        return 0;
      };

  const pointsInitial = attempts.filter(a => a.isCorrect && !a.isRetry)
      .reduce((sum, a) => sum + getQPoints(a.questionId), 0);
  const pointsRetry = attempts.filter(a => a.isCorrect && a.isRetry)
      .reduce((sum, a) => sum + getQPoints(a.questionId) / 2, 0);
  const rawGained = pointsInitial + (pointsRetry || 0);

  // Enforce pass thresholds: need efficiency >= 60 and mastery >= 75, else 0 points this run
  const passedThresholds = this.efficiency >= 60 && this.mastery >= 75;
  this.passedNow = passedThresholds;
  const gainedThisRun = passedThresholds ? rawGained : 0;

      // Retrieve previous subject progress and user total points
      forkJoin({
        subjectProgress: this.userService.getSubjectProgress(this.userId, this.sectionId, this.subjectId),
        totalPoints: this.userService.getUserPoints(this.userId)
      }).subscribe(({ subjectProgress, totalPoints }) => {
        const prevSubjectPoints = subjectProgress?.points || 0;
  const prevPassed = subjectProgress?.passed || false;
  // Passing is based on thresholds, not 100%
  const passedNow = this.passedNow;

        // Compute delta to apply to total points and the new subject points
        // Keep the best score for the subject; never decrease stored subject points
        const nextSubjectPoints = Math.max(prevSubjectPoints, gainedThisRun);
        const deltaToTotal = nextSubjectPoints - prevSubjectPoints;

        // Set values for visualization (old/new total points)
        this.previousPoints = totalPoints;
        this.newPoints = totalPoints + deltaToTotal;
        this.pointsDelta = deltaToTotal;

  console.log(`Scores computed: mastery=${this.mastery.toFixed(2)}%, efficiency=${this.efficiency.toFixed(2)}%, points gained this run=${gainedThisRun}, raw gained=${rawGained}, total points delta=${deltaToTotal}, next subject best=${nextSubjectPoints}, passedNow=${passedNow}`);

        // Persist: update total points and subject progress simultaneously
        const updateTotalPoints$ = this.userService.adjustTotalPoints(this.userId, deltaToTotal);
        const updateSubjectProgress$ = this.userService.setSubjectProgress(this.userId, this.sectionId, this.subjectId, {
          points: nextSubjectPoints,
          passed: passedNow,
          lastEfficiency: this.efficiency,
          lastMastery: this.mastery,
          lastSessionId: this.sessionId
        });

        forkJoin([updateTotalPoints$, updateSubjectProgress$]).subscribe({
          next: () => {
            this.updateResultsPersistence();
            // Set leaderboardReady only after all DB operations complete
            setTimeout(() => {
              this.leaderboardReady = true;
            }, 500); // Small delay to ensure DB propagation
          },
          error: () => {
            // Still try to write session result for audit
            this.updateResultsPersistence();
            // Even on error, show leaderboard (might have stale data but better than nothing)
            setTimeout(() => {
              this.leaderboardReady = true;
            }, 500);
          }
        });
      });
    });
  }

  getIncorrectQuestionsForCurrentSession(): Observable<SubjectContent[]> {
    if (!this.sessionId) {
      return of([]);
    }

    return this.attemptService.getIncorrectAttemptsForSession(this.sessionId).pipe(
      switchMap(attempts => {
        if (attempts.length === 0) return of([]);
        const calls = attempts.map(a => this.contentService.getSubjectContent(a.sectionId, a.subjectId, a.questionId));
        return forkJoin(calls).pipe(
          switchMap(contents => of(contents.filter((c): c is SubjectContent => c !== null)))
        );
      })
    );
  }
}
