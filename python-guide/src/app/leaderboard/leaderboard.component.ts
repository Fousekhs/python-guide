import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { AttemptService } from '../../services/attempt.service';
import { ContentService } from '../../services/content.service';
import { AuthService } from '../../services/auth.service';
import { Observable, forkJoin, map, switchMap, of } from 'rxjs';

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  points: number;
  rank: number;
  avgMastery?: number;
  avgEfficiency?: number;
  isCurrentUser?: boolean;
}

@Component({
  standalone: true,
  selector: 'app-leaderboard',
  imports: [CommonModule],
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.css']
})
export class LeaderboardComponent implements OnInit, OnChanges {
  @Input() sectionId?: string;
  @Input() subjectId?: string;
  @Input() questionId?: string;

  leaderboard: LeaderboardEntry[] = [];
  currentUserId?: string;
  loading = true;
  title = '';

  private initialized = false;

  constructor(
    private userService: UserService,
    private attemptService: AttemptService,
    private contentService: ContentService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.authState().subscribe(user => {
      this.currentUserId = user?.uid;
      this.loadLeaderboard();
      this.initialized = true;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['sectionId'] || changes['subjectId'] || changes['questionId']) && this.initialized) {
      this.loadLeaderboard();
    }
  }

  private loadLeaderboard(): void {
    this.loading = true;
    this.leaderboard = [];
    this.setTitle();
    if (this.questionId && this.subjectId && this.sectionId) {
      this.loadQuestionLeaderboard();
    } else if (this.subjectId && this.sectionId) {
      this.loadSubjectLeaderboard();
    } else if (this.sectionId) {
      this.loadSectionLeaderboard();
    } else {
      this.loadGlobalLeaderboard();
    }
  }

  private setTitle(): void {
    if (this.questionId) {
      this.title = 'Question Leaderboard';
    } else if (this.subjectId) {
      this.title = 'Subject Leaderboard';
    } else if (this.sectionId) {
      this.title = 'Section Leaderboard';
    } else {
      this.title = 'Global Leaderboard';
    }
  }

  private loadQuestionLeaderboard(): void {
    // Simplified: load all users then their attempts, filter locally
    this.userService.getAllUsers().pipe(
      switchMap(users => {
        const userAttempts$ = users.map(user =>
          this.attemptService.getAttemptsForUser(user.uid).pipe(
            map(attempts => {
              const questionAttempts = attempts.filter(a =>
                a.questionId === this.questionId &&
                a.subjectId === this.subjectId &&
                a.sectionId === this.sectionId
              );
              const bestAttempt = questionAttempts
                .filter(a => a.isCorrect)
                .sort((a, b) => (a.createdAt as any) - (b.createdAt as any))[0];
              return { user, points: bestAttempt ? this.getQuestionPoints(bestAttempt) : 0 };
            })
          )
        );
        return forkJoin(userAttempts$);
      })
    ).subscribe({
      next: results => this.processLeaderboard(results),
      error: err => this.handleLoadError(err)
    });
  }

  private loadSubjectLeaderboard(): void {
    this.userService.getAllUsers().pipe(
      switchMap(users => {
        const userProgress$ = users.map(user =>
          this.userService.getSubjectProgress(user.uid, this.sectionId!, this.subjectId!).pipe(
            map(progress => ({
              user,
              points: progress?.points || 0,
              avgMastery: progress?.lastMastery || 0,
              avgEfficiency: progress?.lastEfficiency || 0
            }))
          )
        );
        return forkJoin(userProgress$);
      })
    ).subscribe({
      next: results => this.processLeaderboard(results),
      error: err => this.handleLoadError(err)
    });
  }

  private loadSectionLeaderboard(): void {
    this.userService.getAllUsers().pipe(
      switchMap(users => {
        const userStats$ = users.map(user =>
          this.getSectionStats(user.uid, this.sectionId!).pipe(
            map(stats => ({
              user,
              points: stats.totalPoints,
              avgMastery: stats.avgMastery,
              avgEfficiency: stats.avgEfficiency
            }))
          )
        );
        return forkJoin(userStats$);
      })
    ).subscribe({
      next: results => this.processLeaderboard(results),
      error: err => this.handleLoadError(err)
    });
  }

  private loadGlobalLeaderboard(): void {
    this.userService.getAllUsers().pipe(
      switchMap(users => {
        const userStats$ = users.map(user =>
          this.getGlobalStats(user.uid).pipe(
            map(stats => ({
              user,
              points: stats.totalPoints,
              avgMastery: stats.avgMastery,
              avgEfficiency: stats.avgEfficiency
            }))
          )
        );
        return forkJoin(userStats$);
      })
    ).subscribe({
      next: results => this.processLeaderboard(results),
      error: err => this.handleLoadError(err)
    });
  }

  private getSectionStats(uid: string, sectionId: string): Observable<{totalPoints: number, avgMastery: number, avgEfficiency: number}> {
    // Get all subjects in this section and sum their best scores
    return this.contentService.getSection(sectionId).pipe(
      switchMap(section => {
        if (!section?.subjects) return of({totalPoints: 0, avgMastery: 0, avgEfficiency: 0});
        
        const subjectStats$ = section.subjects.map(subject =>
          this.userService.getSubjectProgress(uid, sectionId, subject.id!).pipe(
            map(progress => ({
              points: progress?.points || 0,
              mastery: progress?.lastMastery || 0,
              efficiency: progress?.lastEfficiency || 0,
              passed: progress?.passed || false
            }))
          )
        );
        
        return forkJoin(subjectStats$).pipe(
          map(stats => {
            const passedStats = stats.filter(s => s.passed);
            return {
              totalPoints: stats.reduce((sum, s) => sum + s.points, 0),
              avgMastery: passedStats.length > 0 ? passedStats.reduce((sum, s) => sum + s.mastery, 0) / passedStats.length : 0,
              avgEfficiency: passedStats.length > 0 ? passedStats.reduce((sum, s) => sum + s.efficiency, 0) / passedStats.length : 0
            };
          })
        );
      })
    );
  }

  private getGlobalStats(uid: string): Observable<{totalPoints: number, avgMastery: number, avgEfficiency: number}> {
    return this.userService.getUserPoints(uid).pipe(
      switchMap(totalPoints => 
        this.contentService.getAllSections().pipe(
          switchMap(sections => {
            const sectionStats$ = sections.map(section =>
              this.getSectionStats(uid, section.id!).pipe(
                map(stats => ({
                  avgMastery: stats.avgMastery,
                  avgEfficiency: stats.avgEfficiency,
                  hasPassedSubjects: stats.totalPoints > 0
                }))
              )
            );
            
            return forkJoin(sectionStats$).pipe(
              map(stats => {
                const validStats = stats.filter(s => s.hasPassedSubjects);
                return {
                  totalPoints,
                  avgMastery: validStats.length > 0 ? validStats.reduce((sum, s) => sum + s.avgMastery, 0) / validStats.length : 0,
                  avgEfficiency: validStats.length > 0 ? validStats.reduce((sum, s) => sum + s.avgEfficiency, 0) / validStats.length : 0
                };
              })
            );
          })
        )
      )
    );
  }

  private getQuestionPoints(attempt: any): number {
    // This would need to be enhanced to get actual question max points
    return attempt.isCorrect ? (attempt.isRetry ? 5 : 10) : 0;
  }

  private processLeaderboard(results: any[]): void {
    console.log('DEBUG: Processing leaderboard results:', results);
    
    // Sort by points descending - include users with 0 points
    const sorted = results
      .filter(r => r.user && r.user.displayName) // Only filter out invalid users
      .sort((a, b) => b.points - a.points);
    
    console.log('DEBUG: Sorted leaderboard:', sorted);
    
    // Assign ranks
    let currentRank = 1;
    const leaderboard: LeaderboardEntry[] = sorted.map((result, index) => {
      if (index > 0 && result.points < sorted[index - 1].points) {
        currentRank = index + 1;
      }
      
      return {
        uid: result.user.uid,
        displayName: result.user.displayName || 'Anonymous',
        points: result.points,
        rank: currentRank,
        avgMastery: result.avgMastery,
        avgEfficiency: result.avgEfficiency,
        isCurrentUser: result.user.uid === this.currentUserId
      };
    });
    
    // Get user-centered view (9 around + user)
    this.leaderboard = this.getUserCenteredView(leaderboard);
    this.loading = false;
  }

  private handleLoadError(err: any): void {
    console.error('Leaderboard load error', err);
    this.leaderboard = [];
    this.loading = false;
  }

  private getUserCenteredView(fullLeaderboard: LeaderboardEntry[]): LeaderboardEntry[] {
    if (!this.currentUserId) return fullLeaderboard.slice(0, 10);
    
    const userIndex = fullLeaderboard.findIndex(entry => entry.uid === this.currentUserId);
    
    if (userIndex === -1) {
      // User not in leaderboard, show top 10
      return fullLeaderboard.slice(0, 10);
    }
    
    // Show 4 above, user, 4 below (or adjust if near edges)
    const start = Math.max(0, userIndex - 4);
    const end = Math.min(fullLeaderboard.length, userIndex + 5);
    
    // Ensure we have 10 entries if possible
    const actualStart = Math.max(0, end - 10);
    
    return fullLeaderboard.slice(actualStart, end);
  }

  getRankClass(rank: number): string {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return '';
  }
}