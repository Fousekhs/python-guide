import {
  Component,
  ElementRef,
  NgZone,
  OnInit,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { python } from '@codemirror/lang-python';
import { defaultKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';

@Component({
  selector: 'app-python-coder',
  imports: [FormsModule],
  standalone: true,
  templateUrl: './python-coder.component.html',
  styleUrl: './python-coder.component.css'
})
export class PythonCoderComponent implements OnInit {
  @ViewChild('editorHost', { static: true }) editorHost!: ElementRef;
  view!: EditorView;
  challenge = 'Write a function that adds two numbers.';
  code = `# write add(a,b)\ndef add(a,b):\n    pass\n\n`;
  output = '';

  constructor(private ngZone: NgZone) {}

  ngOnInit() {
    // initialize CodeMirror
    this.view = new EditorView({
      state: EditorState.create({
        doc: this.code,
        extensions: [
          python(),
          oneDark,
          EditorView.lineWrapping,
          EditorView.updateListener.of(v => {
            if (v.docChanged) {
              this.code = v.state.doc.toString();
            }
          })
        ]
      }),
      parent: this.editorHost.nativeElement
    });
  }

  async runCode() {
    this.output = 'Running…';
    const pyodide = await (window as any).loadPyodide();
    try {
      const result = await pyodide.runPythonAsync(`
import sys
from io import StringIO
buf = StringIO()
sys.stdout = buf

${this.code}

try:
    print("add(2,3) =", add(2,3))
except Exception as e:
    print("Error:", e)

buf.getvalue()
`);
      this.ngZone.run(() => this.output = result);
    } catch (e: any) {
      this.ngZone.run(() => this.output = `Error: ${e.message}`);
    }
  }

}
