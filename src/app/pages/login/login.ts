import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FirebaseError } from 'firebase/app';

import { AuthService } from '../../services/auth.service';

type LoginFormGroup = FormGroup<{
  email: FormControl<string>;
  password: FormControl<string>;
}>;

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly feedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  protected readonly form: LoginFormGroup = this.fb.group({
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    password: this.fb.nonNullable.control('', Validators.required),
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.feedback.set(null);
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login(email, password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/admin';
      this.router.navigateByUrl(returnUrl);
    } catch (err) {
      this.feedback.set({ type: 'error', message: this.mapFirebaseError(err) });
    } finally {
      this.submitting.set(false);
    }
  }

  protected async sendReset(): Promise<void> {
    const email = this.form.controls.email.value.trim();
    if (!email) {
      this.feedback.set({
        type: 'error',
        message: 'Informe o e-mail para receber o link de redefinição.',
      });
      this.form.controls.email.markAsTouched();
      return;
    }
    this.submitting.set(true);
    this.feedback.set(null);
    try {
      await this.auth.sendPasswordResetEmail(email);
      this.feedback.set({
        type: 'success',
        message: 'Se o e-mail existir, você receberá um link para redefinir a senha.',
      });
    } catch (err) {
      this.feedback.set({ type: 'error', message: this.mapFirebaseError(err) });
    } finally {
      this.submitting.set(false);
    }
  }

  private mapFirebaseError(err: unknown): string {
    if (err instanceof FirebaseError) {
      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          return 'E-mail ou senha inválidos.';
        case 'auth/invalid-email':
          return 'E-mail inválido.';
        case 'auth/too-many-requests':
          return 'Muitas tentativas. Tente novamente em alguns minutos.';
        case 'auth/network-request-failed':
          return 'Falha de rede. Verifique sua conexão.';
        default:
          return `Falha: ${err.code}`;
      }
    }
    return err instanceof Error ? err.message : 'Falha inesperada.';
  }
}
