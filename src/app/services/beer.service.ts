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
  ref,
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
    const docRef = await addDoc(this.beersCol, beer);
    return docRef.id;
  }

  update(id: string, beer: Partial<Beer>): Promise<void> {
    const docRef = doc(this.firestore, 'beers', id);

    // Converte campos null para deleteField() no Firestore
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(beer)) {
      data[key] = value === null || value === undefined ? deleteField() : value;
    }

    return updateDoc(docRef, data);
  }

  async remove(beer: Beer): Promise<void> {
    // Tenta limpar rótulo legado se existir (migração)
    if (beer.labelPath) {
      try {
        await deleteObject(ref(this.storage, beer.labelPath));
      } catch {
        // arquivo pode não existir
      }
    }
    if (!beer.id) return;
    await deleteDoc(doc(this.firestore, 'beers', beer.id));
  }
}
