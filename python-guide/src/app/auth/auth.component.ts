import { Component, OnInit } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule],
})
export class AuthComponent implements OnInit {
  authForm!: FormGroup;
  isRegisterMode = false;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.isRegisterMode = !!this.route.snapshot.data['register'];
    this.buildForm();
  }

  buildForm(): void {
    if (this.isRegisterMode) {
      this.authForm = this.fb.group(
        {
          email: ['', [Validators.required, Validators.email]],
          displayName: ['', Validators.required],
          password: ['', Validators.required],
          confirmPassword: ['', Validators.required],
        },
        { validators: this.passwordMatchValidator }
      );
    } else {
      this.authForm = this.fb.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', Validators.required],
      });
    }
  }

  toggleMode(): void {
    this.router.navigate([this.isRegisterMode ? '/login' : '/register']);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  onSubmit(): void {
    if (this.authForm.invalid) return;

    const { email, displayName, password, confirmPassword } = this.authForm.value;

    if (this.isRegisterMode) {
      if (password !== confirmPassword) {
        this.authForm.setErrors({ passwordMismatch: true });
        return;
      }

      this.authService.register(email, password, displayName).subscribe({
        next: () => {
          alert('Registration successful! You can now log in.');
          this.router.navigate(['/login']);
        },
        error: (error) => {
          this.errorMessage = this.mapAuthError(error, true);
        },
      });

    } else {
      this.authService.login(email, password).subscribe({
        next: () => {
          this.router.navigate(['/']);
        },
        error: (error) => {
          this.errorMessage = this.mapAuthError(error, false);
        },
      });
    }
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirm = control.get('confirmPassword')?.value;
    return password !== confirm ? { passwordMismatch: true } : null;
  }

  get showPasswordMismatch(): boolean {
    return (
      this.authForm.hasError('passwordMismatch') &&
      this.authForm.get('confirmPassword')?.touched &&
      this.isRegisterMode
    ) || false;
  }

  private mapAuthError(error: any, isRegister: boolean): string {
    if (!error?.code) return 'An unknown error occurred.';
    const code = error.code;
    if (isRegister) {
      switch (code) {
        case 'auth/email-already-in-use':
          return 'That email address is already taken.';
        case 'auth/invalid-email':
          return 'The email address is badly formatted.';
        case 'auth/weak-password':
          return 'Password is too weak (should be at least 6 characters).';
        default:
          return 'Registration failed. ' + error.message;
      }
    } else {
      switch (code) {
        case 'auth/user-not-found':
          return 'No account with that email exists.';
        case 'auth/wrong-password':
          return 'Incorrect password.';
        case 'auth/too-many-requests':
          return 'Too many failed attempts. Please try again later.';
        default:
          return 'Login failed. ' + error.message;
      }
    }
  }
}
