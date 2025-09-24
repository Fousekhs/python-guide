import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';

import { ContentService, Section, Subject, SubjectContent, TheoryContent, MultipleChoiceQuestion, TrueFalseQuestion } from '../../services/content.service';
import { AuthService } from '../../services/auth.service';
import { UserService, UserData } from '../../services/user.service';

@Component({
  selector: 'app-content-admin-panel',
  templateUrl: './content-admin-panel.component.html',
  styleUrls: ['./content-admin-panel.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class ContentAdminPanelComponent implements OnInit {
  sections: Section[] = [];
  selectedSection: Section | null = null;
  selectedSubject: Subject | null = null;
  users: UserData[] = [];
  
  // Tab management
  activeTab: 'sections' | 'subjects' | 'content' | 'users' = 'sections';
  
  sectionForm!: FormGroup;
  subjectForm!: FormGroup;
  contentForm!: FormGroup;
  
  contentTypes = [
    { value: 'theory', label: 'Theory' },
    { value: 'mcq', label: 'Multiple Choice Question' },
    { value: 'truefalse', label: 'True/False Question' }
  ];
  
  selectedContentType = 'theory';
  isEditingContent = false;
  editingContentId: string | null = null;

  totalSubjectPoints = 0; // sum of maxPoints for current subject

  constructor(
    private contentService: ContentService,
    private authService: AuthService,
    private userService: UserService,
    private fb: FormBuilder
  ) {
    this.initializeForms();
  }

  ngOnInit() {
    this.loadSections();
    this.loadUsers();
  }

  setActiveTab(tab: 'sections' | 'subjects' | 'content' | 'users') {
    this.activeTab = tab;
    if (tab === 'users') {
      this.loadUsers();
    }
  }

  initializeForms() {
    this.sectionForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      order: [0, Validators.required],
      isPublished: [false]
    });

    this.subjectForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      order: [0, Validators.required]
    });

    this.contentForm = this.fb.group({
      title: [''],
      content: [''],
      question: [''],
      options: this.fb.array([]),
      correctAnswer: [0],
      timeLimitSeconds: [null],
      maxPoints: [null],
      order: [0, Validators.required],
      codeSegment: this.fb.group({
        code: [''],
        language: ['python'],
        explanation: ['']
      })
    });
  }

  get optionsArray() {
    return this.contentForm.get('options') as FormArray;
  }

  addOption() {
    this.optionsArray.push(this.fb.control('', Validators.required));
  }

  removeOption(index: number) {
    if (this.optionsArray.length > 2) {
      this.optionsArray.removeAt(index);
      // Adjust correctAnswer if it's now out of bounds
      const currentCorrect = this.contentForm.get('correctAnswer')?.value;
      if (typeof currentCorrect === 'number' && currentCorrect >= this.optionsArray.length) {
        this.contentForm.get('correctAnswer')?.setValue(this.optionsArray.length - 1);
      }
    }
  }

  loadSections() {
    this.contentService.getAllSections().subscribe({
      next: (sections) => {
        this.sections = sections;
      },
      error: (error) => {
        this.showMessage('Error loading sections: ' + error.message);
      }
    });
  }

  createSection() {
    if (this.sectionForm.valid) {
      const sectionData = {
        ...this.sectionForm.value,
        subjects: []
      };

      this.contentService.createSection(sectionData).subscribe({
        next: (sectionId) => {
          this.showMessage('Section created successfully');
          this.sectionForm.reset();
          this.loadSections();
        },
        error: (error) => {
          this.showMessage('Error creating section: ' + error.message);
        }
      });
    }
  }

  selectSection(section: Section) {
    this.selectedSection = section;
    this.selectedSubject = null;
    this.loadSubjects(section.id!);
  }

  loadSubjects(sectionId: string) {
    this.contentService.getSubjectsBySectionId(sectionId).subscribe({
      next: (subjects) => {
        if (this.selectedSection) {
          this.selectedSection.subjects = subjects;
        }
      },
      error: (error) => {
        this.showMessage('Error loading subjects: ' + error.message);
      }
    });
  }

  createSubject() {
    if (this.subjectForm.valid && this.selectedSection) {
      const subjectData = {
        ...this.subjectForm.value,
        contents: []
      };

      this.contentService.createSubject(this.selectedSection.id!, subjectData).subscribe({
        next: (subjectId) => {
          this.showMessage('Subject created successfully');
          this.subjectForm.reset();
          this.loadSubjects(this.selectedSection!.id!);
        },
        error: (error) => {
          this.showMessage('Error creating subject: ' + error.message);
        }
      });
    }
  }

  selectSubject(subject: Subject) {
    this.selectedSubject = subject;
    this.resetContentForm();
    this.recomputeTotalPoints();
  }

  private recomputeTotalPoints() {
    if (!this.selectedSubject?.contents) { this.totalSubjectPoints = 0; return; }
    this.totalSubjectPoints = this.selectedSubject.contents.reduce((sum, c: any) => sum + (typeof c.maxPoints === 'number' ? c.maxPoints : 0), 0);
  }

  getSubjectTotalPoints(subject: Subject | null | undefined): number {
    if (!subject?.contents) return 0;
    return subject.contents.reduce((sum: number, c: any) => sum + (typeof c.maxPoints === 'number' ? c.maxPoints : 0), 0);
  }

  onContentTypeChange() {
    this.resetContentForm();
    this.setupContentFormForType();
  }

  resetContentForm() {
    this.contentForm.reset();
    this.isEditingContent = false;
    this.editingContentId = null;
    this.optionsArray.clear();
    this.setupContentFormForType();
  }

  setupContentFormForType() {
    const contentGroup = this.contentForm;
    
    // Reset validators
    Object.keys(contentGroup.controls).forEach(key => {
      contentGroup.get(key)?.clearValidators();
    });

    switch (this.selectedContentType) {
      case 'theory':
        contentGroup.get('title')?.setValidators([Validators.required]);
        contentGroup.get('content')?.setValidators([Validators.required]);
        break;
      case 'mcq':
        contentGroup.get('title')?.setValidators([Validators.required]);
        contentGroup.get('question')?.setValidators([Validators.required]);
        contentGroup.get('correctAnswer')?.setValidators([Validators.required]);
        contentGroup.get('timeLimitSeconds')?.setValidators([Validators.required, Validators.min(1)]);
        contentGroup.get('maxPoints')?.setValidators([Validators.required, Validators.min(1)]);
        // Add default 4 options only when creating new content
        if (!this.isEditingContent && this.optionsArray.length === 0) {
          this.addOption();
          this.addOption();
          this.addOption();
          this.addOption();
        }
        break;
      case 'truefalse':
        contentGroup.get('title')?.setValidators([Validators.required]);
        contentGroup.get('question')?.setValidators([Validators.required]);
        contentGroup.get('correctAnswer')?.setValidators([Validators.required]);
        contentGroup.get('timeLimitSeconds')?.setValidators([Validators.required, Validators.min(1)]);
        contentGroup.get('maxPoints')?.setValidators([Validators.required, Validators.min(1)]);
        break;
    }

    Object.keys(contentGroup.controls).forEach(key => {
      contentGroup.get(key)?.updateValueAndValidity();
    });
  }

  // Begin editing an existing content item by populating the form
  startEditContent(content: SubjectContent) {
    this.isEditingContent = true;
    this.editingContentId = (content as any).id || null;
    this.selectedContentType = content.type as any;

    // Reset then set validators for the type
    this.contentForm.reset();
    this.optionsArray.clear();
    this.setupContentFormForType();

    // Common fields
    this.contentForm.patchValue({
      title: (content as any).title ?? '',
      order: (content as any).order ?? 0
    });

    if (content.type === 'theory') {
      const theory = content as TheoryContent;
      this.contentForm.patchValue({ content: theory.content });
      if (theory.codeSegment) {
        this.contentForm.get('codeSegment')?.patchValue({
          code: theory.codeSegment.code || '',
          language: theory.codeSegment.language || 'python',
          explanation: theory.codeSegment.explanation || ''
        });
      }
    } else if (content.type === 'mcq') {
      const mcq = content as MultipleChoiceQuestion;
      // Populate options
      if (Array.isArray(mcq.options)) {
        mcq.options.forEach(opt => this.optionsArray.push(this.fb.control(opt, Validators.required)));
      }
      this.contentForm.patchValue({
        question: mcq.question,
        correctAnswer: mcq.correctAnswer,
        timeLimitSeconds: (mcq as any).timeLimitSeconds ?? null,
        maxPoints: (mcq as any).maxPoints ?? null
      });
    } else if (content.type === 'truefalse') {
      const tf = content as TrueFalseQuestion;
      this.contentForm.patchValue({
        question: tf.question,
        correctAnswer: tf.correctAnswer,
        timeLimitSeconds: (tf as any).timeLimitSeconds ?? null,
        maxPoints: (tf as any).maxPoints ?? null
      });
    }
  }

  deleteContent(content: SubjectContent) {
    if (!this.selectedSection || !this.selectedSubject || !content?.id) return;
    if (!confirm(`Delete content "${(content as any).title || content.type}"?`)) return;
    this.contentService
      .deleteSubjectContent(this.selectedSection.id!, this.selectedSubject.id!, content.id!)
      .subscribe({
        next: () => {
          this.showMessage('Content deleted successfully');
          this.loadSubjects(this.selectedSection!.id!);
          this.recomputeTotalPoints();
          // If we were editing this item, reset the form
          if (this.isEditingContent && this.editingContentId === content.id) {
            this.resetContentForm();
          }
        },
        error: (error) => this.showMessage('Error deleting content: ' + error.message),
      });
  }

  private buildContentPayload(): TheoryContent | MultipleChoiceQuestion | TrueFalseQuestion {
    const formValue = this.contentForm.value as any;
    let base = { order: formValue.order } as any;

    switch (this.selectedContentType) {
      case 'theory':
        return {
          ...base,
          title: formValue.title,
          type: 'theory',
          content: formValue.content,
          ...(formValue.codeSegment?.code && { codeSegment: formValue.codeSegment })
        } as TheoryContent;
      case 'mcq':
        return {
          ...base,
          title: formValue.title,
          type: 'mcq',
          question: formValue.question,
          options: formValue.options,
          correctAnswer: formValue.correctAnswer,
          timeLimitSeconds: formValue.timeLimitSeconds,
          maxPoints: formValue.maxPoints
        } as MultipleChoiceQuestion;
      case 'truefalse':
        return {
          ...base,
          title: formValue.title,
          type: 'truefalse',
          question: formValue.question,
          correctAnswer: formValue.correctAnswer === true,
          timeLimitSeconds: formValue.timeLimitSeconds,
          maxPoints: formValue.maxPoints
        } as TrueFalseQuestion;
    }
    // Fallback shouldn't happen due to selection control
    return base as any;
  }

  createContent() {
    if (this.contentForm.valid && this.selectedSection && this.selectedSubject) {
      const contentData = this.buildContentPayload();

      // Update existing content when editing
      if (this.isEditingContent && this.editingContentId) {
        this.contentService.updateSubjectContent(
          this.selectedSection.id!,
          this.selectedSubject.id!,
          this.editingContentId,
          contentData as any
        ).subscribe({
          next: () => {
            this.showMessage('Content updated successfully');
            this.resetContentForm();
            this.loadSubjects(this.selectedSection!.id!);
            this.recomputeTotalPoints();
          },
          error: (error) => {
            this.showMessage('Error updating content: ' + error.message);
          }
        });
        return;
      }

      // Otherwise create new content
      this.contentService.addContentToSubject(
        this.selectedSection.id!,
        this.selectedSubject.id!,
        contentData as any
      ).subscribe({
        next: () => {
          this.showMessage('Content created successfully');
          this.resetContentForm();
          this.loadSubjects(this.selectedSection!.id!);
          this.recomputeTotalPoints();
        },
        error: (error) => {
          this.showMessage('Error creating content: ' + error.message);
        }
      });
    }
  }

  deleteSection(section: Section) {
    if (confirm(`Are you sure you want to delete section "${section.title}"?`)) {
      this.contentService.deleteSection(section.id!).subscribe({
        next: () => {
          this.showMessage('Section deleted successfully');
          this.loadSections();
          if (this.selectedSection?.id === section.id) {
            this.selectedSection = null;
            this.selectedSubject = null;
          }
        },
        error: (error) => {
          this.showMessage('Error deleting section: ' + error.message);
        }
      });
    }
  }

  deleteSubject(subject: Subject) {
    if (confirm(`Are you sure you want to delete subject "${subject.title}"?`) && this.selectedSection) {
      this.contentService.deleteSubject(this.selectedSection.id!, subject.id!).subscribe({
        next: () => {
          this.showMessage('Subject deleted successfully');
          this.loadSubjects(this.selectedSection!.id!);
          if (this.selectedSubject?.id === subject.id) {
            this.selectedSubject = null;
          }
        },
        error: (error) => {
          this.showMessage('Error deleting subject: ' + error.message);
        }
      });
    }
  }

  toggleSectionPublished(section: Section) {
    const action = section.isPublished ? 'unpublish' : 'publish';
    const method = section.isPublished ? 
      this.contentService.unpublishSection(section.id!) : 
      this.contentService.publishSection(section.id!);

    method.subscribe({
      next: () => {
        section.isPublished = !section.isPublished;
        this.showMessage(`Section ${action}ed successfully`);
      },
      error: (error) => {
        this.showMessage(`Error ${action}ing section: ` + error.message);
      }
    });
  }

  moveSection(fromIndex: number, toIndex: number) {
    const sections = [...this.sections];
    const [movedSection] = sections.splice(fromIndex, 1);
    sections.splice(toIndex, 0, movedSection);
    
    sections.forEach((section, index) => {
      section.order = index;
    });
    
    this.sections = sections;
    this.contentService.reorderSections(this.sections).subscribe({
      next: () => {
        this.showMessage('Sections reordered successfully');
      },
      error: (error) => {
        this.showMessage('Error reordering sections: ' + error.message);
      }
    });
  }

  moveSubject(fromIndex: number, toIndex: number) {
    if (!this.selectedSection?.subjects) return;
    
    const subjects = [...this.selectedSection.subjects];
    const [movedSubject] = subjects.splice(fromIndex, 1);
    subjects.splice(toIndex, 0, movedSubject);
    
    subjects.forEach((subject, index) => {
      subject.order = index;
    });
    
    this.selectedSection.subjects = subjects;
    this.contentService.reorderSubjects(this.selectedSection.id!, this.selectedSection.subjects).subscribe({
      next: () => {
        this.showMessage('Subjects reordered successfully');
      },
      error: (error) => {
        this.showMessage('Error reordering subjects: ' + error.message);
      }
    });
  }

  getContentTypeLabel(content: SubjectContent): string {
    if ('title' in content && 'content' in content) return 'Theory';
    if ('options' in content) return 'Multiple Choice';
    if ('correctAnswer' in content && typeof content.correctAnswer === 'boolean') return 'True/False';
    return 'Unknown';
  }

  getContentPreview(content: SubjectContent): string {
    if ('title' in content) return content.title;
    return 'No preview available';
  }

  private showMessage(message: string) {
    console.log(message);
    // You can replace this with a proper notification system later
    alert(message);
  }

  // User Management Methods
  loadUsers() {
    this.userService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users; 
      },
      error: (error) => {
        this.showMessage('Error loading users: ' + error.message);
      }
    });
  }

  promoteToAdmin(user: UserData) {
    if (confirm(`Are you sure you want to promote "${user.displayName}" to admin?`)) {
      this.userService.promoteUser(user.uid, this.authService.getCurrentUser()!.uid).subscribe({
        next: () => {
          this.showMessage(`User "${user.displayName}" has been promoted to admin`);
          this.loadUsers(); // Refresh the list
        },
        error: (error) => {
          this.showMessage('Error promoting user to admin: ' + error.message);
        }
      });
    }
  }

  demoteFromAdmin(user: UserData) {
    if (confirm(`Are you sure you want to remove admin privileges from "${user.displayName}"?`)) {
      this.userService.demoteUser(user.uid, this.authService.getCurrentUser()!.uid).subscribe({
        next: () => {
          this.showMessage(`Admin privileges removed from "${user.displayName}"`);
          this.loadUsers(); // Refresh the list
        },
        error: (error) => {
          this.showMessage('Error removing admin privileges: ' + error.message);
        }
      });
    }
  }
}
