import { Component } from '@angular/core';
import { OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { SectionComponent } from '../section/section.component';
import { SectionContainerComponent } from '../section-container/section-container.component';
import { SubjectCardComponent } from '../subject-card/subject-card.component';
import { PythonComponent } from '../../assets/icons/python-logo.component';
import { LoginComponent } from '../../assets/icons/login.component';
import { LogoutComponent } from '../../assets/icons/log-out.component';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ContentService, Section } from '../../services/content.service';
import { MatProgressSpinnerModule, MatSpinner } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-home',
  imports: [CommonModule, SectionComponent, SectionContainerComponent, SubjectCardComponent, PythonComponent, LoginComponent, LogoutComponent, MatProgressSpinnerModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  userIsAuthenticated$!: Observable<boolean>;
  userDisplayName$!: Observable<string>;
  sections$!: Observable<Section[]>;

  constructor(
    private router: Router,
    private authService: AuthService,
    private contentService: ContentService
  ) {}

  ngOnInit(): void {
    this.userIsAuthenticated$ = this.authService.authState().pipe(
      map(user => !!user)
    );

    this.userDisplayName$ = this.authService.authState().pipe(
      map(user => user?.displayName ?? 'Guest')
    );

    this.sections$ = this.contentService.getAllSections();
  }

  login(): void {
    this.router.navigate(['/login']);
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: (err) => {
        alert('Logout failed. Please try again.');
        console.error('Logout failed', err);
      }
    });
  }
}