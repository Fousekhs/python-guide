import { Component, Input, OnInit } from '@angular/core';

import { McqUnitComponent } from '../mcq-unit/mcq-unit.component';
import { CodeViewerComponent } from '../code-viewer/code-viewer.component';
import { PythonCoderComponent } from '../python-coder/python-coder.component';
import { TheoryUnitComponent } from '../theory-unit/theory-unit.component';

export type LessonUnitType = 'theory' | 'true-false' | 'multiple-choice' | 'code';

@Component({
  selector: 'app-lesson-unit',
  imports: [McqUnitComponent, TheoryUnitComponent, PythonCoderComponent, CodeViewerComponent],
  templateUrl: './lesson-unit.component.html',
  styleUrl: './lesson-unit.component.css'
})
export class LessonUnitComponent implements OnInit {
  @Input() type: LessonUnitType = 'theory';
  data: any = {
      title: 'test',
      content: `What is the output of the following img:test.jpeg Python code?
  \\cx = "2"
y =2
print(x + y)\\c`
    };

  ngOnInit(): void {
  }

}
