import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';

import { BeerService } from '../../../services/beer.service';
import { Beer, BeerSize, formatSizeLabel } from '../../../models/beer.model';
import { ConfirmModal } from '../../../components/confirm-modal/confirm-modal';

@Component({
  selector: 'app-beers-admin',
  imports: [DecimalPipe, NgTemplateOutlet, ConfirmModal],
  templateUrl: './beers.html',
  styleUrl: './beers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeersAdmin {
  private readonly beerService = inject(BeerService);
  private readonly router = inject(Router);

  protected readonly beers = toSignal(this.beerService.list(), { initialValue: [] as Beer[] });

  /** Chopes com ordem 1–8 (exibidos no painel). */
  protected readonly activeBeers = computed(() =>
    this.beers().filter((b) => b.order >= 1 && b.order <= 8)
  );

  /** Chopes com ordem > 8 (estoque, fora da tela). */
  protected readonly stockBeers = computed(() =>
    this.beers().filter((b) => b.order > 8)
  );

  protected readonly swapSource = signal<Beer | null>(null);
  protected readonly swapMode = signal(false);
  protected readonly saving = signal(false);
  protected readonly feedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  protected readonly confirmingRemove = signal<Beer | null>(null);

  protected formatSize(size: BeerSize): string {
    return formatSizeLabel(size);
  }

  protected newBeer(): void {
    this.router.navigate(['/admin/chopes/novo']);
  }

  protected openPreview(): void {
    this.router.navigate(['/admin/preview']);
  }

  protected editBeer(beer: Beer): void {
    this.router.navigate(['/admin/chopes/editar', beer.id]);
  }

  protected async remove(beer: Beer): Promise<void> {
    if (!beer.id) return;
    this.confirmingRemove.set(beer);
  }

  protected cancelRemove(): void {
    this.confirmingRemove.set(null);
  }

  protected async confirmRemove(): Promise<void> {
    const beer = this.confirmingRemove();
    if (!beer?.id) return;
    this.confirmingRemove.set(null);
    try {
      await this.beerService.remove(beer);
      this.feedback.set({ type: 'success', message: 'Chope removido.' });
    } catch (err) {
      console.error(err);
      this.feedback.set({ type: 'error', message: 'Falha ao remover o chope.' });
    }
  }

  // === Swap de posições ===

  protected startSwap(beer: Beer): void {
    this.swapSource.set(beer);
    this.swapMode.set(true);
    this.feedback.set(null);
  }

  protected cancelSwap(): void {
    this.swapSource.set(null);
    this.swapMode.set(false);
  }

  protected async confirmSwap(target: Beer): Promise<void> {
    const source = this.swapSource();
    if (!source?.id || !target.id) return;

    this.saving.set(true);
    this.feedback.set(null);
    try {
      await Promise.all([
        this.beerService.update(source.id, { order: target.order }),
        this.beerService.update(target.id, { order: source.order }),
      ]);
      this.feedback.set({
        type: 'success',
        message: `Posições trocadas: #${source.order} (${source.name}) ⇄ #${target.order} (${target.name}).`,
      });
    } catch (err) {
      console.error(err);
      this.feedback.set({ type: 'error', message: 'Falha ao trocar posições.' });
    } finally {
      this.saving.set(false);
      this.cancelSwap();
    }
  }
}
