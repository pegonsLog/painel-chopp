import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  deleteField,
  doc,
  orderBy,
  query,
  updateDoc,
} from '@angular/fire/firestore';
import {
  Storage,
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { Beer } from '../models/beer.model';

@Injectable({ providedIn: 'root' })
export class BeerService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);

  private readonly beersCol = collection(this.firestore, 'beers');

  /** Stream de chopes ordenados pelo número da tampa. */
  list(): Observable<Beer[]> {
    const q = query(this.beersCol, orderBy('order', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Beer[]>;
  }

  async create(beer: Omit<Beer, 'id'>): Promise<string> {
    const ref = await addDoc(this.beersCol, beer);
    return ref.id;
  }

  update(id: string, beer: Partial<Beer>): Promise<void> {
    const ref = doc(this.firestore, 'beers', id);
    return updateDoc(ref, beer as Record<string, unknown>);
  }

  async remove(beer: Beer): Promise<void> {
    if (beer.labelPath) {
      try {
        await deleteObject(ref(this.storage, beer.labelPath));
      } catch {
        // arquivo pode não existir; segue com a deleção do documento
      }
    }
    if (!beer.id) return;
    await deleteDoc(doc(this.firestore, 'beers', beer.id));
  }

  /**
   * Faz upload de um rótulo para o Storage e devolve URL pública e o path armazenado.
   * O path inclui timestamp para evitar colisões quando o mesmo nome é reenviado.
   */
  async uploadLabel(file: File, beerOrder: number): Promise<{ url: string; path: string }> {
    const safeName = file.name.replace(/[^a-z0-9.\-_]+/gi, '_');
    const path = `beer-labels/${beerOrder}-${Date.now()}-${safeName}`;
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);
    return { url, path };
  }

  async deleteLabel(path: string): Promise<void> {
    await deleteObject(ref(this.storage, path));
  }

  /** Remove o rótulo do Storage e limpa os campos no Firestore. */
  async removeLabelFromBeer(beerId: string, labelPath: string | null): Promise<void> {
    if (labelPath) {
      try {
        await deleteObject(ref(this.storage, labelPath));
      } catch { /* arquivo pode não existir */ }
    }
    const beerRef = doc(this.firestore, 'beers', beerId);
    await updateDoc(beerRef, {
      labelUrl: deleteField(),
      labelPath: deleteField(),
    });
  }
}
