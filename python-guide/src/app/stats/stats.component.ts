import { Component, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { StatsService, AggregatedStats } from '../../services/stats.service';
import { AuthService } from '../../services/auth.service';
import { ContentService, Section, Subject } from '../../services/content.service';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, NgxEchartsModule, FormsModule],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css'
})
export class StatsComponent implements OnInit {
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  data = signal<AggregatedStats | null>(null);

  sections = signal<Section[]>([]);
  subjects = computed(() => {
    const secId = this.selectedSectionId();
    return this.sections().find(s => s.id === secId)?.subjects || [];
  });
  selectedSectionId = signal<string | null>(null);
  selectedSubjectId = signal<string | null>(null);

  // ECharts options signals
  subjectLineOption = signal<any>(null);
  heatmapOption = signal<any>(null);
  pointsLineOption = signal<any>(null);
  avgBestEfficiencyGauge = signal<any>(null);
  avgBestMasteryGauge = signal<any>(null);
  randomPracticeLine = signal<any>(null);
  worstPracticeLine = signal<any>(null);

  constructor(
    private stats: StatsService,
    private auth: AuthService,
    private content: ContentService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      const user = await firstValueFrom(this.auth.authState());
  if (!user) { this.errorMessage.set('Not authenticated'); return; }
      // Load sections for selector
      const sections = await firstValueFrom(this.content.getAllSections());
      this.sections.set(sections);
      if (sections.length) {
        this.selectedSectionId.set(sections[0].id!);
        if (sections[0].subjects.length) this.selectedSubjectId.set(sections[0].subjects[0].id!);
      }
      this.stats.getAggregated(user.uid).subscribe({
        next: agg => {
          this.data.set(agg);
          this.buildCharts();
          this.loading.set(false);
        },
  error: err => { this.errorMessage.set(err.message || 'Failed loading stats'); this.loading.set(false); }
      });
    } catch (e: any) {
      this.errorMessage.set(e.message || 'Failed initializing stats');
      this.loading.set(false);
    }
  }

  onSubjectChange() {
    this.buildSubjectPerformanceLine();
  }

  private buildCharts() {
    this.buildSubjectPerformanceLine();
    this.buildHeatmap();
    this.buildPointsProgression();
    this.buildAverageBestGauges();
    this.buildPracticeLines();
  }

  private buildSubjectPerformanceLine() {
    const agg = this.data();
    if (!agg) return;
    const subjId = this.selectedSubjectId();
    if (!subjId) { this.subjectLineOption.set(null); return; }
    const sessions = agg.subjectPerformances
      .filter(s => s.subjectId === subjId && typeof s.mastery === 'number' && typeof s.efficiency === 'number')
      .sort((a,b) => new Date(a.startedAt as any).getTime() - new Date(b.startedAt as any).getTime());
    if (!sessions.length) { this.subjectLineOption.set(null); return; }
    const categories = sessions.map(s => s.sessionId.substring(0,6));
    const mastery = sessions.map(s => s.mastery);
    const efficiency = sessions.map(s => s.efficiency);
    this.subjectLineOption.set({
      tooltip: { trigger: 'axis' },
      legend: { data: ['Mastery','Efficiency'], textStyle:{color:'#a9c0cf'} },
      grid: { left: 40, right: 20, top: 30, bottom: 30 },
      xAxis: { type: 'category', data: categories, axisLabel:{color:'#6e8797'} },
      yAxis: { type: 'value', min:0, max:100, axisLabel:{color:'#6e8797'} },
      series: [
        { name:'Mastery', type:'line', data: mastery, smooth:true, symbol:'circle', symbolSize:6, lineStyle:{ width:3, color:'#5ac8fa' }, itemStyle:{ color:'#5ac8fa' } },
        { name:'Efficiency', type:'line', data: efficiency, smooth:true, symbol:'diamond', symbolSize:6, lineStyle:{ width:3, color:'#f5d90a' }, itemStyle:{ color:'#f5d90a' } }
      ]
    });
  }

  private buildHeatmap() {
    const agg = this.data(); if (!agg) return;
    if (!agg.heatmap.length) { this.heatmapOption.set(null); return; }
    const values = agg.heatmap.map(c => [c.date, c.count]);
    // Determine date range (last 180 days)
    const dates = agg.heatmap.map(c => c.date).sort();
    const start = dates[0];
    const end = dates[dates.length-1];
    this.heatmapOption.set({
      tooltip: { position: 'top' },
      visualMap: { min:0, max: Math.max(...agg.heatmap.map(c=>c.count)), orient:'horizontal', left:'center', bottom:0, textStyle:{color:'#a9c0cf'} },
      calendar: { range: [start, end], cellSize: [16,16], itemStyle:{ borderWidth:0 }, splitLine:{ show:false }, yearLabel:{ show:false }, monthLabel:{ color:'#6e8797' }, dayLabel:{ color:'#6e8797' } },
      series: [{ type:'heatmap', coordinateSystem:'calendar', data: values }]
    });
  }

  private buildPointsProgression() {
    const agg = this.data(); if (!agg) return;
    const pts = agg.pointsProgression;
    const categories = pts.map(p => new Date(p.timestamp).toISOString().substring(5,10));
    this.pointsLineOption.set({
      tooltip:{ trigger:'axis' },
      xAxis:{ type:'category', data: categories, axisLabel:{color:'#6e8797'} },
      yAxis:{ type:'value', axisLabel:{color:'#6e8797'} },
      grid:{ left:40, right:20, top:20, bottom:30 },
      series:[{ type:'line', data: pts.map(p=>p.totalPoints), areaStyle:{} }]
    });
  }

  private buildAverageBestGauges() {
    const agg = this.data(); if (!agg) return;
    const makeGauge = (val: number, label: string) => ({
      series:[{
        type:'gauge',
        startAngle:210,
        endAngle:-30,
        progress:{ show:true, width:12 },
        axisLine:{ lineStyle:{ width:12, color:[[1,'#244654']] } },
        pointer:{ show:false },
        splitLine:{ show:false }, axisTick:{ show:false }, axisLabel:{ show:false },
        detail:{ valueAnimation:true, formatter:(v:any)=>`${v.toFixed(1)}%`, color:'#a9c0cf', fontSize:16 },
        data:[{ value: val, name: label }]
      }]
    });
    this.avgBestEfficiencyGauge.set(makeGauge(agg.averageBest.avgBestEfficiency,'Efficiency'));
    this.avgBestMasteryGauge.set(makeGauge(agg.averageBest.avgBestMastery,'Mastery'));
  }

  private buildPracticeLines() {
    const agg = this.data(); if (!agg) return;
    const build = (hist: any) => {
      const categories = hist.history.map((h:any)=> h.sessionId.substring(0,6));
      return {
        tooltip:{ trigger:'axis' },
        xAxis:{ type:'category', data: categories, axisLabel:{color:'#6e8797'} },
        yAxis:{ type:'value', min:0, max:100, axisLabel:{color:'#6e8797'} },
        grid:{ left:40, right:20, top:20, bottom:30 },
        series:[{ type:'line', data: hist.history.map((h:any)=>h.efficiency||0), smooth:true }]
      };
    };
    this.randomPracticeLine.set(build(agg.randomPractice));
    this.worstPracticeLine.set(build(agg.worstPractice));
  }

  goHome() {
    this.router.navigate(['/']);
  }
}

