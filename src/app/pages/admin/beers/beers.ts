import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';

import { BeerService } from '../../../services/beer.service';
import { Beer, BeerSize, formatSizeLabel, parseSizeFields, parseVolumeLabelToMl } from '../../../models/beer.model';

type SizeFormGroup = FormGroup<{
  volume: FormControl<number>;
  unit: FormControl<'ml' | 'l'>;
  price: FormControl<number>;
}>;

type BeerFormGroup = FormGroup<{
  order: FormControl<number>;
  brewery: FormControl<string>;
  name: FormControl<string>;
  style: FormControl<string>;
  abv: FormControl<string>;
  ibu: FormControl<string>;
  description: FormControl<string>;
  sizes: FormArray<SizeFormGroup>;
}>;

@Component({
  selector: 'app-beers-admin',
  imports: [ReactiveFormsModule, DecimalPipe, NgTemplateOutlet],
  templateUrl: './beers.html',
  styleUrl: './beers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeersAdmin {
  private readonly fb = inject(FormBuilder);
  private readonly beerService = inject(BeerService);

  protected readonly beers = toSignal(this.beerService.list(), { initialValue: [] as Beer[] });

  /** Chopes com ordem 1–8 (exibidos no painel). */
  protected readonly activeBeers = computed(() =>
    this.beers().filter((b) => b.order >= 1 && b.order <= 8)
  );

  /** Chopes com ordem > 8 (estoque, fora da tela). */
  protected readonly stockBeers = computed(() =>
    this.beers().filter((b) => b.order > 8)
  );

  protected readonly editingId = signal<string | null>(null);
  protected readonly labelFile = signal<File | null>(null);
  protected readonly labelPreviewUrl = signal<string | null>(null);
  protected readonly existingLabelUrl = signal<string | null>(null);
  protected readonly existingLabelPath = signal<string | null>(null);
  protected readonly swapSource = signal<Beer | null>(null);
  protected readonly swapMode = signal(false);
  protected readonly removeLabelOnSave = signal(false);
  protected readonly saving = signal(false);
  protected readonly feedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  protected readonly form: BeerFormGroup = this.buildForm();

  get sizes(): FormArray<SizeFormGroup> {
    return this.form.controls.sizes;
  }

  protected formatSize(size: BeerSize): string {
    return formatSizeLabel(size);
  }
  private buildForm(): BeerFormGroup {
    return this.fb.group({
      order: this.fb.nonNullable.control(0, [Validators.required, Validators.min(1)]),
      brewery: this.fb.nonNullable.control('', Validators.required),
      name: this.fb.nonNullable.control('', Validators.required),
      style: this.fb.nonNullable.control('', Validators.required),
      abv: this.fb.nonNullable.control(''),
      ibu: this.fb.nonNullable.control(''),
      description: this.fb.nonNullable.control(''),
      sizes: this.fb.array<SizeFormGroup>([this.createSizeGroup()], [Validators.required]),
    });
  }

  private createSizeGroup(volume = 0, unit: 'ml' | 'l' = 'ml', price = 0): SizeFormGroup {
    return this.fb.group({
      volume: this.fb.nonNullable.control(volume, [Validators.required, Validators.min(1)]),
      unit: this.fb.nonNullable.control(unit),
      price: this.fb.nonNullable.control(price, [Validators.required, Validators.min(0)]),
    });
  }

  protected addSize(): void {
    this.sizes.push(this.createSizeGroup());
  }

  protected removeSize(index: number): void {
    if (this.sizes.length <= 1) return;
    this.sizes.removeAt(index);
  }

  protected onLabelSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.labelFile.set(file);

    const current = this.labelPreviewUrl();
    if (current) URL.revokeObjectURL(current);

    this.labelPreviewUrl.set(file ? URL.createObjectURL(file) : null);
    this.removeLabelOnSave.set(false);
  }

  /** Remove a prévia local (arquivo selecionado mas não enviado). */
  protected clearLabel(): void {
    this.labelFile.set(null);
    const current = this.labelPreviewUrl();
    if (current) URL.revokeObjectURL(current);
    this.labelPreviewUrl.set(null);
  }

  /** Remove o rótulo existente imediatamente do Storage e do Firestore. */
  protected async removeExistingLabel(): Promise<void> {
    const path = this.existingLabelPath();
    const editingId = this.editingId();
    if (!editingId) return;

    try {
      await this.beerService.removeLabelFromBeer(editingId, path);
      this.existingLabelUrl.set(null);
      this.existingLabelPath.set(null);
      this.removeLabelOnSave.set(false);
      this.feedback.set({ type: 'success', message: 'Rótulo removido.' });
    } catch (err) {
      console.error(err);
      this.feedback.set({ type: 'error', message: 'Falha ao remover o rótulo.' });
    }
  }

  protected edit(beer: Beer): void {
    this.editingId.set(beer.id ?? null);
    this.feedback.set(null);
    this.labelFile.set(null);
    this.labelPreviewUrl.set(null);
    this.existingLabelUrl.set(beer.labelUrl ?? null);
    this.existingLabelPath.set(beer.labelPath ?? null);

    // Recria o FormArray completo para evitar problemas de sincronização
    const sizeGroups: SizeFormGroup[] = [];
    for (const size of beer.sizes) {
      const parsed = parseSizeFields(size);
      sizeGroups.push(this.createSizeGroup(parsed.volume, parsed.unit, parsed.price));
    }
    if (sizeGroups.length === 0) sizeGroups.push(this.createSizeGroup());

    // Substitui o FormArray inteiro
    const newSizes = this.fb.array<SizeFormGroup>(sizeGroups, [Validators.required]);
    this.form.setControl('sizes', newSizes);

    this.form.patchValue({
      order: beer.order,
      brewery: beer.brewery,
      name: beer.name,
      style: beer.style,
      abv: beer.abv ?? '',
      ibu: beer.ibu ?? '',
      description: beer.description ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected resetForm(): void {
    this.editingId.set(null);
    this.labelFile.set(null);
    const preview = this.labelPreviewUrl();
    if (preview) URL.revokeObjectURL(preview);
    this.labelPreviewUrl.set(null);
    this.existingLabelUrl.set(null);
    this.existingLabelPath.set(null);
    this.removeLabelOnSave.set(false);
    this.form.reset();
    this.sizes.clear();
    this.sizes.push(this.createSizeGroup());
    this.form.patchValue({ order: this.nextOrder() });
  }

  private nextOrder(): number {
    const used = this.beers().map((b) => b.order);
    let next = 1;
    while (used.includes(next)) next++;
    return next;
  }

  protected async remove(beer: Beer): Promise<void> {
    if (!beer.id) return;
    if (!confirm(`Remover o chope #${beer.order} - ${beer.name}?`)) return;
    try {
      await this.beerService.remove(beer);
      this.feedback.set({ type: 'success', message: 'Chope removido.' });
      if (this.editingId() === beer.id) this.resetForm();
    } catch (err) {
      console.error(err);
      this.feedback.set({ type: 'error', message: 'Falha ao remover o chope.' });
    }
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.feedback.set({
        type: 'error',
        message: 'Preencha todos os campos obrigatórios (volume deve ser maior que 0).',
      });
      return;
    }

    const raw = this.form.getRawValue();

    // Validação de ordem única
    const duplicate = this.beers().find(
      (b) => b.order === raw.order && b.id !== this.editingId()
    );
    if (duplicate) {
      this.feedback.set({
        type: 'error',
        message: `Já existe um chope na posição #${raw.order} (${duplicate.name}). Use outra ordem ou troque as posições.`,
      });
      return;
    }

    this.saving.set(true);
    this.feedback.set(null);

    try {
      let labelUrl = this.existingLabelUrl();
      let labelPath = this.existingLabelPath();
      const file = this.labelFile();

      // Remoção do rótulo existente
      if (this.removeLabelOnSave() && labelPath) {
        try {
          await this.beerService.deleteLabel(labelPath);
        } catch { /* ignora */ }
        labelUrl = null;
        labelPath = null;
      }

      if (file) {
        if (labelPath) {
          try {
            await this.beerService.deleteLabel(labelPath);
          } catch {
            /* ignora - o upload novo segue */
          }
        }
        const uploaded = await this.beerService.uploadLabel(file, raw.order);
        labelUrl = uploaded.url;
        labelPath = uploaded.path;
      }

      const payload: Omit<Beer, 'id'> = {
        order: raw.order,
        brewery: raw.brewery.trim(),
        name: raw.name.trim(),
        style: raw.style.trim(),
        abv: raw.abv?.trim() || undefined,
        ibu: raw.ibu?.trim() || undefined,
        description: raw.description?.trim() ?? '',
        sizes: raw.sizes.map((s) => ({
          volume: Number(s.volume),
          unit: s.unit,
          price: Number(s.price),
        })),
        ...(labelUrl ? { labelUrl } : {}),
        ...(labelPath ? { labelPath } : {}),
      };

      const editingId = this.editingId();
      if (editingId) {
        await this.beerService.update(editingId, payload);
        this.feedback.set({ type: 'success', message: 'Chope atualizado.' });
      } else {
        await this.beerService.create(payload);
        this.feedback.set({ type: 'success', message: 'Chope cadastrado.' });
      }
      this.resetForm();
    } catch (err) {
      console.error(err);
      this.feedback.set({ type: 'error', message: 'Falha ao salvar. Verifique a conexão e tente novamente.' });
    } finally {
      this.saving.set(false);
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
      // Troca os números de ordem entre os dois chopes
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
