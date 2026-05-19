import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  templateUrl: './confirm-modal.html',
  styleUrl: './confirm-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmModal {
  /** Título do modal. */
  title = input('Confirmar ação');
  /** Mensagem descritiva. */
  message = input('Tem certeza que deseja continuar?');
  /** Texto do botão de confirmação. */
  confirmText = input('Confirmar');
  /** Se true, o botão de confirmação fica em estilo "danger". */
  danger = input(true);

  confirmed = output<void>();
  cancelled = output<void>();

  confirm(): void {
    this.confirmed.emit();
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
