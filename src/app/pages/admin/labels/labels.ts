import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FirebaseError } from 'firebase/app';

import { LabelService } from '../../../services/label.service';
import { Label } from '../../../models/label.model';
import { ConfirmModal } from '../../../components/confirm-modal/confirm-modal';

@Component({
  selector: 'app-labels-admin',
  imports: [FormsModule, ConfirmModal],
  templateUrl: './labels.html',
  styleUrl: './labels.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabelsAdmin {
  private readonly labelService = inject(LabelService);

  protected readonly labels = toSignal(this.labelService.list(), { initialValue: [] as Label[] });

  // Estado do formulário de criação
  protected readonly newLabelName = signal('');
  protected readonly newLabelFile = signal<File | null>(null);
  protected readonly newLabelPreview = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly feedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estado de edição inline
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingName = signal('');
  protected readonly replacingId = signal<string | null>(null);
  protected readonly replaceFile = signal<File | null>(null);
  protected readonly confirmingRemove = signal<Label | null>(null);

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.newLabelFile.set(file);

    const current = this.newLabelPreview();
    if (current) URL.revokeObjectURL(current);
    this.newLabelPreview.set(file ? URL.createObjectURL(file) : null);
  }

  protected async createLabel(): Promise<void> {
    const file = this.newLabelFile();
    const name = this.newLabelName().trim();

    if (!file || !name) {
      this.feedback.set({ type: 'error', message: 'Informe um nome e selecione uma imagem.' });
      return;
    }

    const invalid = this.validateFile(file);
    if (invalid) {
      this.feedback.set({ type: 'error', message: invalid });
      return;
    }

    this.saving.set(true);
    this.feedback.set(null);

    try {
      await this.labelService.create(file, name);
      this.newLabelName.set('');
      this.newLabelFile.set(null);
      const preview = this.newLabelPreview();
      if (preview) URL.revokeObjectURL(preview);
      this.newLabelPreview.set(null);
      this.feedback.set({ type: 'success', message: 'Rótulo adicionado ao banco.' });
    } catch (err) {
      console.error('[labels] falha ao criar rótulo:', err);
      this.feedback.set({ type: 'error', message: this.describeError(err, 'salvar o rótulo') });
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Espelha as restrições das regras do Storage (`storage.rules`) para que a
   * causa apareça antes do upload, em vez de virar um erro opaco de permissão.
   */
  private validateFile(file: File): string | null {
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size >= MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return `Imagem tem ${mb} MB. O limite é 5 MB — reduza a imagem e tente novamente.`;
    }
    if (!file.type) {
      return `Não foi possível identificar o tipo do arquivo "${file.name}". Salve-o como JPG ou PNG e tente novamente.`;
    }
    if (!file.type.startsWith('image/')) {
      return `O arquivo "${file.name}" é do tipo ${file.type}, que não é uma imagem aceita. Use JPG ou PNG.`;
    }
    return null;
  }

  /** Traduz o erro do Firebase, mantendo o código para diagnóstico. */
  private describeError(err: unknown, action: string): string {
    if (err instanceof FirebaseError) {
      switch (err.code) {
        case 'storage/unauthorized':
          return 'Sem permissão para enviar a imagem. Faça login novamente e verifique se sua conta é administradora.';
        case 'storage/unauthenticated':
          return 'Sessão expirada. Entre novamente para enviar a imagem.';
        case 'storage/quota-exceeded':
          return 'A cota do Storage foi excedida. Verifique o plano do projeto no Firebase.';
        case 'storage/retry-limit-exceeded':
        case 'storage/canceled':
          return 'O upload foi interrompido. Verifique a conexão e tente novamente.';
        case 'permission-denied':
          return 'A imagem subiu, mas o cadastro do rótulo foi bloqueado: sua conta não está na lista de administradores.';
        case 'unavailable':
          return 'Firestore indisponível no momento. Tente novamente em instantes.';
        default:
          return `Falha ao ${action}: ${err.code}`;
      }
    }
    return `Falha ao ${action}${err instanceof Error ? `: ${err.message}` : '.'}`;
  }

  protected startEdit(label: Label): void {
    this.editingId.set(label.id!);
    this.editingName.set(label.name);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editingName.set('');
  }

  protected async saveEdit(label: Label): Promise<void> {
    const name = this.editingName().trim();
    if (!name) return;
    try {
      await this.labelService.updateName(label.id!, name);
      this.cancelEdit();
    } catch (err) {
      console.error('[labels] falha ao renomear rótulo:', err);
      this.feedback.set({ type: 'error', message: this.describeError(err, 'renomear o rótulo') });
    }
  }

  protected startReplace(label: Label): void {
    this.replacingId.set(label.id!);
    this.replaceFile.set(null);
  }

  protected cancelReplace(): void {
    this.replacingId.set(null);
    this.replaceFile.set(null);
  }

  protected onReplaceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.replaceFile.set(file);
  }

  protected async confirmReplace(label: Label): Promise<void> {
    const file = this.replaceFile();
    if (!file) return;

    const invalid = this.validateFile(file);
    if (invalid) {
      this.feedback.set({ type: 'error', message: invalid });
      return;
    }

    this.saving.set(true);
    try {
      await this.labelService.replaceImage(label, file);
      this.cancelReplace();
      this.feedback.set({ type: 'success', message: 'Imagem substituída.' });
    } catch (err) {
      console.error('[labels] falha ao substituir imagem:', err);
      this.feedback.set({ type: 'error', message: this.describeError(err, 'substituir a imagem') });
    } finally {
      this.saving.set(false);
    }
  }

  protected async removeLabel(label: Label): Promise<void> {
    this.confirmingRemove.set(label);
  }

  protected cancelRemove(): void {
    this.confirmingRemove.set(null);
  }

  protected async confirmRemove(): Promise<void> {
    const label = this.confirmingRemove();
    if (!label) return;
    this.confirmingRemove.set(null);
    try {
      await this.labelService.remove(label);
      this.feedback.set({ type: 'success', message: 'Rótulo removido.' });
    } catch (err) {
      console.error('[labels] falha ao remover rótulo:', err);
      this.feedback.set({ type: 'error', message: this.describeError(err, 'remover o rótulo') });
    }
  }
}
