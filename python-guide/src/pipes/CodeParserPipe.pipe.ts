// src/app/code-parser.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

export interface ParsedSegment {
  type: 'text' | 'code';
  value: string;
}

@Pipe({ 
  name: 'codeParser',
  standalone: true 
})
export class CodeParserPipe implements PipeTransform {
  transform(input: string): ParsedSegment[] {
    if (!input) { return []; }

    const segments: ParsedSegment[] = [];
    const regex = /\\c([\s\S]*?)\\c/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: 'text',
          value: input.slice(lastIndex, match.index)
        });
      }
     segments.push({
        type: 'code',
        value: match[1]
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < input.length) {
      segments.push({
        type: 'text',
        value: input.slice(lastIndex)
      });
    }

    return segments;
  }
}
