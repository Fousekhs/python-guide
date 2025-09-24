import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CapmaxProgressbarComponent } from '../capmax-progressbar/capmax-progressbar.component';
import { LeftChevronComponent } from '../../assets/icons/chevron-left.component';
import { RightChevronComponent } from '../../assets/icons/chevron-right.component';
import { HomeIconComponent } from '../../assets/icons/home.component';
import { LessonUnitType } from '../lesson-unit/lesson-unit.component';
import { Observable, switchMap, forkJoin, of, EMPTY } from 'rxjs';
import { ContentService, SubjectContent } from '../../services/content.service';
import { TheoryUnitComponent } from '../theory-unit/theory-unit.component';
import { McqUnitComponent } from '../mcq-unit/mcq-unit.component';
import { AttemptService } from '../../services/attempt.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

export interface Lesson {
  id: number;
  type: LessonUnitType;
}

@Component({
  selector: 'app-lesson',
  imports: [TheoryUnitComponent, McqUnitComponent, HomeIconComponent, CapmaxProgressbarComponent, LeftChevronComponent, RightChevronComponent],
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
  totalPoints: number = 0;
  score: number = 0;

  timeout: boolean = false;
  finished: boolean = false;
  result: boolean = false;
  retry:boolean = false;

  trueFalseOptions = ['True', 'False'];
  
  getTrueFalseCorrectAnswer(answer: boolean): number {
    return answer ? 0 : 1;
  }

  constructor(private contentService: ContentService, private router: Router, private route: ActivatedRoute, private attemptService: AttemptService, private userService: UserService, private authService: AuthService) {}

  ngOnInit(): void {
    this.sectionId = this.route.snapshot.paramMap.get('sectionId') as string;
    this.subjectId = this.route.snapshot.paramMap.get('subjectId') as string;

    if (this.sectionId && this.subjectId) {
      this.authService.authState().pipe(
        switchMap(user => {
          if (!user) {
            // Handle case where user is not logged in
            this.router.navigate(['/login']);
            return EMPTY; // terminate the stream to keep types consistent
          }
          this.userId = user.uid;
          return this.attemptService.createQuestioningSession(this.userId, this.sectionId);
        }),
        switchMap((sessionId: string) => {
          this.sessionId = sessionId;
          console.log('Created session with ID:', sessionId);
          return this.contentService.getSubjectContents(this.sectionId, this.subjectId);
        })
      ).subscribe(contents => {
        this.lessons = contents;
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
    this.computeScores();
    this.retry = false;
    this.lessons = [];
    this.finishLesson();
  }

  goToPreviousLesson(): void {
    this.currentLessonIndex--;
  }

  timeUp(): void {
    this.timeout = true;
  }
 
  goHome(): void {
    this.router.navigate(['/']);
  }

  reviewIncorrectQuestions(): void {
      this.currentLessonIndex = 0;
      this.finished = false;
      this.timeout = false;
  }

  computeScores() {
    this.attemptService.getAttemptsForSession(this.sessionId).subscribe(attempts => {
      const totalQuestions = this.lessons.length;
      const correctAttempts1 = attempts.filter(a => a.isCorrect && !a.isRetry).length;
      const correctAttempts2 = attempts.filter(a => a.isCorrect && a.isRetry).length;
      const efficiency = totalQuestions > 0 ? (correctAttempts1 / totalQuestions) * 100 : 0;
      const mastery = totalQuestions > 0 ? ((correctAttempts1 + correctAttempts2) / totalQuestions) * 100 : 0;
      const points = attempts.filter(a => a.isCorrect && !a.isRetry).reduce((sum, a) => { return sum + (this.lessons.filter(c => c.type === "mcq" || c.type === "truefalse").find(c => c.id === a.questionId)?.maxPoints || 0); }, 0) +
      (attempts.filter(a => a.isCorrect && a.isRetry).reduce((sum, a) => { return sum + (this.lessons.filter(c => c.type === "mcq" || c.type === "truefalse").find(c => c.id === a.questionId)?.maxPoints || 0) /2; }, 0) || 0);
      this.score = points;
      alert(`Results:\nEfficiency: ${efficiency.toFixed(2)}%\nMastery: ${mastery.toFixed(2)}%\nScore: ${points} out of ${this.totalPoints}`);
      console.log(`Score: ${correctAttempts1} out of ${totalQuestions} (${efficiency.toFixed(2)}%)`);
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
