import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { LeaderboardComponent } from '../leaderboard/leaderboard.component';

@Component({
  standalone: true,
  selector: 'app-results-visualization',
  imports: [CommonModule, NgxEchartsModule, LeaderboardComponent],
  templateUrl: './results-visualization.component.html',
  styleUrls: ['./results-visualization.component.css']
})
export class ResultsVisualizationComponent implements OnChanges {
  @Input() mastery: number = 0; // 0-100
  @Input() efficiency: number = 0; // 0-100
  @Input() previousPoints: number = 0;
  @Input() newPoints: number = 0;
  @Input() passed: boolean = false; // current run pass/fail
  
  // Leaderboard context
  @Input() sectionId?: string;
  @Input() subjectId?: string;
  @Input() questionId?: string;
  @Input() leaderboardReady: boolean = false; // Show leaderboard only when DB operations complete

  get pointsDelta() { return this.newPoints - this.previousPoints; }

  masteryOption: any;
  efficiencyOption: any;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mastery']) {
      this.masteryOption = this.buildGauge('Mastery', this.mastery);
    }
    if (changes['efficiency']) {
      this.efficiencyOption = this.buildGauge('Efficiency', this.efficiency);
    }
  }

  private buildGauge(name: string, value: number) {
    // Ensure value is properly bounded between 0 and 100
    const clamped = Math.max(0, Math.min(100, value || 0));
    console.log(`Building gauge for ${name}: input=${value}, clamped=${clamped}`);
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const label = params?.seriesName || name;
          const val = params?.value ?? clamped;
          const explanation = label === 'Efficiency'
            ? 'Efficiency = Correct on first try / Total questions'
            : 'Mastery = Correct by end (including retries) / Total questions';
          return `${label}: ${val.toFixed(1)}%<br/><span style="color:#8fb3c4">${explanation}</span>`;
        }
      },
      series: [
        {
          name,
          type: 'gauge',
          min: 0,
          max: 100,
          startAngle: 220,
          endAngle: -40,
          axisLine: { lineStyle: { width: 12, color: [[1, '#243340']] }},
          progress: { show: true, width: 12, roundCap: true, itemStyle: { color: '#00f0ff' } },
          splitLine: { show: true, length: 10, lineStyle: { color: '#3a5566', width: 2 } },
          axisTick: { show: true, length: 6, lineStyle: { color: '#3a5566', width: 1 } },
          axisLabel: { distance: 12, color: '#8fb3c4', fontSize: 12 },
          pointer: { show: false },
          detail: { show: false },
          data: [{ value: clamped, name }]
        }
      ]
    };
  }
}
