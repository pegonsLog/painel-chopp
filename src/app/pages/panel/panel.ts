import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BeerCard } from '../../components/beer-card/beer-card';
import { BeerService } from '../../services/beer.service';

/** Quantidade máxima de torneiras exibidas no painel. */
const MAX_TAPS = 8;

@Component({
  selector: 'app-panel',
  imports: [BeerCard, RouterLink],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Panel {
  private readonly beerService = inject(BeerService);

  private readonly allBeers = toSignal(this.beerService.list(), { initialValue: [] });

  /** Apenas chopes com ordem de 1 a 8 (torneiras ativas). */
  protected readonly beers = computed(() =>
    this.allBeers().filter((b) => b.order >= 1 && b.order <= MAX_TAPS)
  );
}
