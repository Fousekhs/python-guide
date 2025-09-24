import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeViewerComponent } from '../code-viewer/code-viewer.component';
import { CodeParserPipe } from '../../pipes/CodeParserPipe.pipe';
import { BehaviorSubject, interval, NEVER } from 'rxjs';
import { switchMap, scan, startWith, takeWhile, shareReplay, map } from 'rxjs/operators';
import { AttemptService, Attempt } from '../../services/attempt.service';

@Component({
  standalone: true,
  selector: 'app-mcq-unit',
  imports: [CommonModule, CodeViewerComponent, CodeParserPipe],
  templateUrl: './mcq-unit.component.html',
  styleUrl: './mcq-unit.component.css'
})
export class McqUnitComponent {
  @Input() title: string = 'Multiple Choice Question';
  @Input() question: string = `What is the output of the following Python code?
  \\cx = "2"
y =2
print(x + y)\\c`;
  @Input() options: string[] = ['2', '22', '\"22\"', 'TypeError: can only concatenate str (not \"int\") to str'];
  @Input() correctAnswer: number = 0;
  @Input() sessionId: string = '';
  @Input() availableTime: number = 10; 
  @Input() sectionId!: string;
  @Input() subjectId!: string;
  @Input() questionId!: string;
  @Input() userId!: string;
  @Input() isRetry: boolean = false;
  @Output() questionAnswered = new EventEmitter<void>();
  @Output() timeUp = new EventEmitter<void>();
  remainingTime: number = this.availableTime;
  selectedOption: string | null = null;
  private countdownValue: number = this.availableTime;

  constructor(private attemptService: AttemptService) {}

  ngOnInit(): void {
    this.remainingTime = this.availableTime;
    this.countdown$.subscribe(value => {
      this.countdownValue = value;
      if (value === 0) {
        this.timeUp.emit();
      }
    });
  }

  private isRunning$ = new BehaviorSubject<boolean>(true); // start running by default

  private tick$ = this.isRunning$.pipe(
    switchMap(running => running ? interval(1000) : NEVER)
  );

  countdown$ = this.tick$.pipe(
    scan((acc) => acc - 1, this.availableTime),
    startWith(this.availableTime),
    takeWhile(v => v >= 0, true),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  pause() {
    this.isRunning$.next(false);
  }

  resume() {
    this.isRunning$.next(true);
  }

  resetTimer(): void {
    this.pause();
    this.remainingTime = this.availableTime;
    this.isRunning$.next(true);
  }

  async select(option: string): Promise<void> {
    this.pause();
    this.selectedOption = option;
    await this.submit();
  }

  async submit() {
    let attempt: Attempt;
    if (this.selectedOption === null || this.selectedOption === undefined) {
      attempt = {
        id: null,
        questioningSessionId: this.sessionId,
        userId: this.userId,
        sectionId: this.sectionId,
        subjectId: this.subjectId,
        questionId: this.questionId,
        answer: null,
        isCorrect: false,
        timeTaken: this.countdownValue,
        isRetry: this.isRetry,
        createdAt: null
      };
    } else {
      attempt = {
        id: null,
        questioningSessionId: this.sessionId,
        userId: this.userId,
        sectionId: this.sectionId,
        subjectId: this.subjectId,
        questionId: this.questionId,
        answer: this.options.indexOf(this.selectedOption),
        isCorrect: this.options.indexOf(this.selectedOption) == this.correctAnswer,
        timeTaken: this.countdownValue,
        isRetry: this.isRetry,
        createdAt: null
      };
    }
    await new Promise(f => setTimeout(f, 1000));

    this.attemptService.saveAttempt(attempt).subscribe({
      next: () => {
        console.log('Attempt recorded successfully');
        this.questionAnswered.emit();
      },
      error: (err) => {
        alert('Failed to record attempt. Please try again.');
        this.resetTimer();
        this.selectedOption = null;
        console.error('Failed to record attempt', err);
      }
    });
  }
}
