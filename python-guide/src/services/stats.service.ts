import { Injectable } from '@angular/core';
import { AttemptService, QuestioningSession, Attempt } from './attempt.service';
import { UserService } from './user.service';
import { ContentService, Subject } from './content.service';
import { Observable, forkJoin, map, switchMap, of } from 'rxjs';

export interface SubjectSessionPerformance {
  sessionId: string;
  sectionId: string;
  subjectId?: string;
  mastery?: number;
  efficiency?: number;
  pointsGained?: number;
  startedAt: any;
}

export interface HeatmapCell { date: string; count: number; }

export interface PointsProgressionEntry { timestamp: number; totalPoints: number; }

export interface PracticeHistoryEntry { sessionId: string; date: string; efficiency?: number; mastery?: number; points?: number; }

export interface AggregatedStats {
  subjectPerformances: SubjectSessionPerformance[];
  heatmap: HeatmapCell[];
  pointsProgression: PointsProgressionEntry[];
  passedSubjects: { passed: number; total: number; };
  averageBest: { avgBestEfficiency: number; avgBestMastery: number; };
  randomPractice: { average: number; history: PracticeHistoryEntry[] };
  worstPractice: { average: number; history: PracticeHistoryEntry[] };
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  constructor(
    private attempts: AttemptService,
    private users: UserService,
    private content: ContentService
  ) {}

  /** Utility to convert serverTimestamp objects or numbers to epoch ms (best effort) */
  private toEpoch(value: any): number {
    if (typeof value === 'number') return value;
    if (value && typeof value === 'object' && 'seconds' in value) return (value.seconds as number) * 1000;
    return Date.now();
  }

  getAggregated(uid: string): Observable<AggregatedStats> {
    return this.attempts.getSessionsForUser(uid).pipe(
      switchMap((sessions) => {
        const perf: SubjectSessionPerformance[] = sessions.map(s => ({
          sessionId: s.id,
          sectionId: s.sectionId,
          subjectId: s.subjectId,
          mastery: s.mastery,
          efficiency: s.efficiency,
            pointsGained: s.pointsGained,
          startedAt: s.startedAt
        }));

        // Heatmap aggregation (count sessions per day)
        const dayMap: Record<string, number> = {};
        sessions.forEach(s => {
          const ts = this.toEpoch(s.startedAt);
          const d = new Date(ts); d.setHours(0,0,0,0);
          const key = d.toISOString().substring(0,10);
          dayMap[key] = (dayMap[key] || 0) + 1;
        });
        const heatmap: HeatmapCell[] = Object.keys(dayMap).map(date => ({ date, count: dayMap[date] }));

        // Points progression: we approximate using cumulative sum of pointsGained (fallback 0)
        let cumulative = 0;
        const sortedSessions = [...sessions].sort((a,b) => this.toEpoch(a.startedAt) - this.toEpoch(b.startedAt));
        const pointsProgression: PointsProgressionEntry[] = sortedSessions.map(s => {
          cumulative += s.pointsGained || 0;
          return { timestamp: this.toEpoch(s.startedAt), totalPoints: cumulative };
        });

        // Passed subjects & best stats per subject require fetching content structure and user progress
        return this.content.getAllSections().pipe(
          switchMap(sections => {
            const subjectEntries: { sectionId: string; subject: Subject }[] = [];
            sections.forEach(sec => sec.subjects.forEach(sub => subjectEntries.push({ sectionId: sec.id!, subject: sub })));
            const progressObservables = subjectEntries.map(entry => 
              this.users.getSubjectProgress(uid, entry.sectionId, entry.subject.id!).pipe(
                map(progress => ({
                  sectionId: entry.sectionId,
                  subjectId: entry.subject.id!,
                  progress
                }))
              )
            );
            return (progressObservables.length ? forkJoin(progressObservables) : of([])).pipe(
              map(progresses => {
                let passed = 0;
                const bestEff: number[] = [];
                const bestMas: number[] = [];
                progresses.forEach(p => {
                  if (p.progress?.passed) {
                    passed++;
                    if (typeof p.progress.lastEfficiency === 'number') bestEff.push(p.progress.lastEfficiency);
                    if (typeof p.progress.lastMastery === 'number') bestMas.push(p.progress.lastMastery);
                  }
                });
                const averageBest = {
                  avgBestEfficiency: bestEff.length ? bestEff.reduce((a,b)=>a+b,0)/bestEff.length : 0,
                  avgBestMastery: bestMas.length ? bestMas.reduce((a,b)=>a+b,0)/bestMas.length : 0
                };
                return {
                  perf,
                  heatmap,
                  pointsProgression,
                  passedSubjects: { passed, total: subjectEntries.length },
                  averageBest
                };
              })
            );
          }),
          map(base => {
            // Practice histories
            const randomSessions = sessions.filter(s => s.mode === 'random');
            const worstSessions = sessions.filter(s => s.mode === 'worst');
            const buildPracticeHistory = (arr: QuestioningSession[]): { average: number; history: PracticeHistoryEntry[] } => {
              if (!arr.length) return { average: 0, history: [] };
              const history = arr.map(s => ({
                sessionId: s.id,
                date: new Date(this.toEpoch(s.startedAt)).toISOString().substring(0,10),
                efficiency: s.efficiency,
                mastery: s.mastery,
                points: s.pointsGained
              }));
              const avg = history.reduce((sum,h)=>sum + (h.efficiency || 0),0)/history.length;
              return { average: avg, history };
            };
            const randomPractice = buildPracticeHistory(randomSessions);
            const worstPractice = buildPracticeHistory(worstSessions);

            return {
              subjectPerformances: base.perf,
              heatmap: base.heatmap,
              pointsProgression: base.pointsProgression,
              passedSubjects: base.passedSubjects,
              averageBest: base.averageBest,
              randomPractice,
              worstPractice
            } as AggregatedStats;
          })
        );
      })
    );
  }
}
