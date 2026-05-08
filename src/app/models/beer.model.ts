export interface BeerSize {
  /** Valor numérico do volume (ex.: 280, 1). */
  volume: number;
  /** Unidade: 'ml' ou 'l'. */
  unit: 'ml' | 'l';
  /** Preço em BRL (ex.: 18.50) */
  price: number;

  // --- campos legados (compatibilidade) ---
  /** Volume em mililitros (legado). */
  volumeMl?: number;
  /** Rótulo textual legado (ex.: "280 ml", "1 L"). */
  volumeLabel?: string;
}

export interface Beer {
  /** ID do documento no Firestore (ausente antes do create). */
  id?: string;
  /** Número de ordem exibido na tampa (1, 2, 3...). */
  order: number;
  brewery: string;
  name: string;
  style: string;
  abv?: string;
  ibu?: string;
  description: string;
  /** URL pública do rótulo no Firebase Storage. */
  labelUrl?: string;
  /** Caminho (path) do arquivo no bucket, usado para deleção. */
  labelPath?: string;
  /** Cores do gradiente exibido como fallback quando não há rótulo. */
  labelColors?: {
    primary: string;
    secondary: string;
    accent?: string;
  };
  sizes: BeerSize[];
}

/**
 * Extrai volume, unidade e label formatado de um BeerSize (compatível com legado).
 */
export function parseSizeFields(size: BeerSize): { volume: number; unit: 'ml' | 'l'; price: number } {
  const raw = size as unknown as Record<string, unknown>;
  const price = Number(raw['price'] ?? 0);

  // Tenta campo 'volume' (novo formato)
  const vol = Number(raw['volume'] ?? 0);
  const unitRaw = String(raw['unit'] ?? 'ml').toLowerCase();
  const unit: 'ml' | 'l' = unitRaw === 'l' ? 'l' : 'ml';

  if (vol > 0) {
    return { volume: vol, unit, price };
  }

  // Tenta campo 'volumeMl' (formato intermediário)
  const volumeMl = Number(raw['volumeMl'] ?? 0);
  if (volumeMl > 0) {
    if (volumeMl >= 1000 && volumeMl % 1000 === 0) {
      return { volume: volumeMl / 1000, unit: 'l', price };
    }
    return { volume: volumeMl, unit: 'ml', price };
  }

  // Tenta campo textual legado
  const label = String(raw['volumeLabel'] ?? raw['volume_label'] ?? '');
  const ml = parseVolumeLabelToMl(label);
  if (ml && ml >= 1000 && ml % 1000 === 0) {
    return { volume: ml / 1000, unit: 'l', price };
  }
  if (ml) {
    return { volume: ml, unit: 'ml', price };
  }

  return { volume: 0, unit, price };
}

/**
 * Formata um BeerSize para exibição: "280 ml" ou "1 L".
 */
export function formatSizeLabel(size: BeerSize): string {
  const { volume, unit } = parseSizeFields(size);
  if (volume <= 0) return '—';
  return `${volume} ${unit === 'l' ? 'L' : 'ml'}`;
}

/**
 * Tenta extrair mililitros de um rótulo textual legado.
 */
export function parseVolumeLabelToMl(label: string | undefined | null): number | null {
  if (!label) return null;
  const str = String(label).trim();
  const match = str.match(/([\d.,]+)\s*(ml|mg|l)/i);
  if (match) {
    const value = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return null;
    const unit = match[2].toLowerCase();
    return unit === 'l' ? Math.round(value * 1000) : Math.round(value);
  }
  const numOnly = Number(str.replace(',', '.'));
  if (Number.isFinite(numOnly) && numOnly > 0) return Math.round(numOnly);
  return null;
}
