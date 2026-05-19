import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FirebaseError } from 'firebase/app';

import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { AppUser } from '../../../models/user.model';
import { ConfirmModal } from '../../../components/confirm-modal/confirm-modal';

type UserFormGroup = FormGroup<{
  email: FormControl<string>;
  displayName: FormControl<string>;
  password: FormControl<string>;
}>;

@Component({
  selector: 'app-users-admin',
  imports: [ReactiveFormsModule, ConfirmModal],
  templateUrl: './users.html',
  styleUrl: './users.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersAdmin {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly auth = inject(AuthService);

  protected readonly users = toSignal(this.userService.list(), { initialValue: [] as AppUser[] });
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly feedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  protected readonly confirmingRemove = signal<AppUser | null>(null);

  protected readonly isEditing = computed(() => this.editingId() !== null);

  protected readonly form: UserFormGroup = this.buildForm();

  private buildForm(): UserFormGroup {
    return this.fb.group({
      email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
      displayName: this.fb.nonNullable.control('', Validators.required),
      password: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(6)]),
    });
  }

  protected edit(user: AppUser): void {
    this.editingId.set(user.id ?? null);
    this.feedback.set(null);
    this.form.patchValue({
      email: user.email,
      displayName: user.displayName,
      password: '',
    });
    this.form.controls.email.disable();
    this.form.controls.password.disable();
  }

  protected resetForm(): void {
    this.editingId.set(null);
    this.form.reset();
    this.form.controls.email.enable();
    this.form.controls.password.enable();
  }

  protected async remove(user: AppUser): Promise<void> {
    if (!user.id) return;
    const current = this.auth.currentUser();
    if (current?.id === user.id) {
      this.feedback.set({ type: 'error', message: 'Você não pode excluir o próprio usuário.' });
      return;
    }
    this.confirmingRemove.set(user);
  }

  protected cancelRemove(): void {
    this.confirmingRemove.set(null);
  }

  protected async confirmRemove(): Promise<void> {
    const user = this.confirmingRemove();
    if (!user?.id) return;
    this.confirmingRemove.set(null);
    try {
      await this.userService.remove(user.id);
      this.feedback.set({ type: 'success', message: 'Acesso removido.' });
      if (this.editingId() === user.id) this.resetForm();
    } catch (err) {
      console.error(err);
      this.feedback.set({ type: 'error', message: 'Falha ao remover usuário.' });
    }
  }

  protected async sendReset(user: AppUser): Promise<void> {
    this.feedback.set(null);
    try {
      await this.auth.sendPasswordResetEmail(user.email);
      this.feedback.set({
        type: 'success',
        message: `Link de redefinição enviado para ${user.email}.`,
      });
    } catch (err) {
      this.feedback.set({ type: 'error', message: this.mapError(err) });
    }
  }

  protected async submit(): Promise<void> {
    this.feedback.set(null);
    const editingId = this.editingId();

    if (editingId) {
      if (this.form.controls.displayName.invalid) {
        this.form.markAllAsTouched();
        return;
      }
    } else if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.saving.set(true);
    try {
      if (editingId) {
        await this.userService.update(editingId, { displayName: raw.displayName });
        this.feedback.set({ type: 'success', message: 'Usuário atualizado.' });
      } else {
        await this.userService.create({
          email: raw.email,
          displayName: raw.displayName,
          password: raw.password,
        });
        this.feedback.set({ type: 'success', message: 'Usuário criado.' });
      }
      this.resetForm();
    } catch (err) {
      console.error(err);
      this.feedback.set({ type: 'error', message: this.mapError(err) });
    } finally {
      this.saving.set(false);
    }
  }

  private mapError(err: unknown): string {
    if (err instanceof FirebaseError) {
      switch (err.code) {
        case 'auth/email-already-in-use':
          return 'Este e-mail já está cadastrado.';
        case 'auth/invalid-email':
          return 'E-mail inválido.';
        case 'auth/weak-password':
          return 'Senha fraca. Use pelo menos 6 caracteres.';
        case 'auth/network-request-failed':
          return 'Falha de rede. Verifique sua conexão.';
        default:
          return `Falha: ${err.code}`;
      }
    }
    return err instanceof Error ? err.message : 'Falha inesperada.';
  }
}
