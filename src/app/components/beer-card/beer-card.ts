import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Beer, BeerSize, parseSizeFields } from '../../models/beer.model';

const DEFAULT_LABEL = {
  primary: '#1a1a1a',
  secondary: '#444',
  accent: '#ff7a1a',
} as const;

@Component({
  selector: 'app-beer-card',
  imports: [DecimalPipe],
  templateUrl: './beer-card.html',
  styleUrl: './beer-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeerCard {
  beer = input.required<Beer>();

  labelStyle = computed(() => {
    const l = this.beer().labelColors ?? DEFAULT_LABEL;
    const accent = l.accent ?? l.secondary;
    return {
      background: `radial-gradient(circle at 50% 30%, ${accent} 0%, ${l.secondary} 40%, ${l.primary} 100%)`,
    };
  });

  protected parsedSizes = computed(() =>
    this.beer().sizes.map((size) => parseSizeFields(size))
  );

  protected formatVolume(size: BeerSize): string {
    const { volume } = parseSizeFields(size);
    return volume > 0 ? String(volume) : '—';
  }

  protected formatUnit(size: BeerSize): string {
    const { unit } = parseSizeFields(size);
    return unit === 'l' ? 'L' : 'ml';
  }

  protected formatPrice(size: BeerSize): number {
    const { price } = parseSizeFields(size);
    return price;
  }
}
