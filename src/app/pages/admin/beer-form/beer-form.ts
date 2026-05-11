import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { BeerService } from '../../../services/beer.service';
import { Beer, BeerSize, parseSizeFields } from '../../../models/beer.model';

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
  selector: 'app-beer-form',
  imports: [ReactiveFormsModule],
  templateUrl: './beer-form.html',
  styleUrl: './beer-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeerForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly beerService = inject(BeerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly beers = toSignal(this.beerService.list(), { initialValue: [] as Beer[] });

  protected readonly editingId = signal<string | null>(null);
  protected readonly labelFile = signal<File | null>(null);
  protected readonly labelPreviewUrl = signal<string | null>(null);
  protected readonly existingLabelUrl = signal<string | null>(null);
  protected readonly existingLabelPath = signal<string | null>(null);
  protected readonly removeLabelOnSave = signal(false);
  protected readonly saving = signal(false);
  protected readonly feedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  protected readonly form: BeerFormGroup = this.buildForm();

  protected readonly isEditing = computed(() => !!this.editingId());

  get sizes(): FormArray<SizeFormGroup> {
    return this.form.controls.sizes;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editingId.set(id);
      this.loadBeer(id);
    } else {
      this.form.patchValue({ order: this.nextOrder() });
    }
  }

  private loadBeer(id: string): void {
    // Espera os dados carregarem e preenche o form
    const interval = setInterval(() => {
      const beer = this.beers().find((b) => b.id === id);
      if (beer) {
        clearInterval(interval);
        this.populateForm(beer);
      }
    }, 100);
    // Timeout de segurança
    setTimeout(() => clearInterval(interval), 5000);
  }

  private populateForm(beer: Beer): void {
    this.existingLabelUrl.set(beer.labelUrl ?? null);
    this.existingLabelPath.set(beer.labelPath ?? null);

    const sizeGroups: SizeFormGroup[] = [];
    for (const size of beer.sizes) {
      const parsed = parseSizeFields(size);
      sizeGroups.push(this.createSizeGroup(parsed.volume, parsed.unit, parsed.price));
    }
    if (sizeGroups.length === 0) sizeGroups.push(this.createSizeGroup());

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

  private createSizeGroup(volume: number | null = null, unit: 'ml' | 'l' = 'ml', price: number | null = null): SizeFormGroup {
    return this.fb.group({
      volume: this.fb.nonNullable.control(volume ?? 0, [Validators.required, Validators.min(1)]),
      unit: this.fb.nonNullable.control(unit),
      price: this.fb.nonNullable.control(price ?? 0, [Validators.required, Validators.min(0.01)]),
    });
  }

  protected addSize(): void {
    this.sizes.push(this.createSizeGroup());
  }

  protected removeSize(index: number): void {
    if (this.sizes.length <= 1) return;
    this.sizes.removeAt(index);
  }

  protected resetSizes(): void {
    this.sizes.clear();
    this.sizes.push(this.createSizeGroup());
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

  protected clearLabel(): void {
    this.labelFile.set(null);
    const current = this.labelPreviewUrl();
    if (current) URL.revokeObjectURL(current);
    this.labelPreviewUrl.set(null);
  }

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

  protected goBack(): void {
    this.router.navigate(['/admin/chopes']);
  }

  private nextOrder(): number {
    const used = this.beers().map((b) => b.order);
    let next = 1;
    while (used.includes(next)) next++;
    return next;
  }

  protected async submit(): Promise<void> {
    for (const group of this.sizes.controls) {
      const vol = group.controls.volume;
      const prc = group.controls.price;
      vol.setValue(Number(vol.value) || 0);
      prc.setValue(Number(prc.value) || 0);
      vol.updateValueAndValidity();
      prc.updateValueAndValidity();
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const sizeErrors = this.sizes.controls.some(
        (g) => g.controls.volume.invalid || g.controls.price.invalid
      );
      const msg = sizeErrors
        ? 'Verifique os tamanhos: volume deve ser maior que 0 e preço deve ser maior que R$ 0,00.'
        : 'Preencha todos os campos obrigatórios.';
      this.feedback.set({ type: 'error', message: msg });
      return;
    }

    const raw = this.form.getRawValue();

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
          } catch { /* ignora */ }
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
      } else {
        await this.beerService.create(payload);
      }

      this.goBack();
    } catch (err) {
      console.error(err);
      this.feedback.set({ type: 'error', message: 'Falha ao salvar. Verifique a conexão e tente novamente.' });
    } finally {
      this.saving.set(false);
    }
  }
}
