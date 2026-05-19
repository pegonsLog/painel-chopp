import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
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
import { Label } from '../models/label.model';

@Injectable({ providedIn: 'root' })
export class LabelService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);

  private readonly labelsCol = collection(this.firestore, 'labels');

  /** Stream de rótulos ordenados por nome. */
  list(): Observable<Label[]> {
    const q = query(this.labelsCol, orderBy('name', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Label[]>;
  }

  /** Faz upload de uma imagem e cria o documento do rótulo no Firestore. */
  async create(file: File, name: string): Promise<Label> {
    const safeName = file.name.replace(/[^a-z0-9.\-_]+/gi, '_');
    const path = `beer-labels/${Date.now()}-${safeName}`;
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);

    const label: Omit<Label, 'id'> = { name: name.trim(), url, path, createdAt: Date.now() };
    const docRef = await addDoc(this.labelsCol, label);
    return { ...label, id: docRef.id };
  }

  /** Atualiza o nome de um rótulo. */
  async updateName(id: string, name: string): Promise<void> {
    const docRef = doc(this.firestore, 'labels', id);
    await updateDoc(docRef, { name: name.trim() });
  }

  /** Substitui a imagem de um rótulo existente. */
  async replaceImage(label: Label, file: File): Promise<{ url: string; path: string }> {
    // Deleta imagem antiga
    try {
      await deleteObject(ref(this.storage, label.path));
    } catch { /* pode não existir */ }

    // Upload da nova
    const safeName = file.name.replace(/[^a-z0-9.\-_]+/gi, '_');
    const newPath = `beer-labels/${Date.now()}-${safeName}`;
    const storageRef = ref(this.storage, newPath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);

    // Atualiza Firestore
    const docRef = doc(this.firestore, 'labels', label.id!);
    await updateDoc(docRef, { url, path: newPath });

    return { url, path: newPath };
  }

  /** Remove o rótulo do Storage e do Firestore. */
  async remove(label: Label): Promise<void> {
    try {
      await deleteObject(ref(this.storage, label.path));
    } catch { /* arquivo pode não existir */ }
    if (label.id) {
      await deleteDoc(doc(this.firestore, 'labels', label.id));
    }
  }
}
