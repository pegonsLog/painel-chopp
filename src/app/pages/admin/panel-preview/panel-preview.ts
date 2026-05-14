import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { BeerCard } from '../../../components/beer-card/beer-card';
import { BeerService } from '../../../services/beer.service';

const MAX_TAPS = 8;

@Component({
  selector: 'app-panel-preview',
  imports: [BeerCard],
  templateUrl: './panel-preview.html',
  styleUrl: './panel-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelPreview {
  private readonly beerService = inject(BeerService);
  private readonly router = inject(Router);

  private readonly allBeers = toSignal(this.beerService.list(), { initialValue: [] });

  protected readonly beers = computed(() =>
    this.allBeers().filter((b) => b.order >= 1 && b.order <= MAX_TAPS)
  );

  protected goBack(): void {
    this.router.navigate(['/admin/chopes']);
  }
}
