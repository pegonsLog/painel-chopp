import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { Observable } from 'rxjs';

import { AppUser } from '../models/user.model';
import { environment } from '../../environments/environment';

export interface NewUserInput {
  email: string;
  displayName: string;
  password: string;
}

export interface UpdateUserInput {
  displayName?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly firestore = inject(Firestore);

  list(): Observable<AppUser[]> {
    const q = query(collection(this.firestore, 'users'), orderBy('email'));
    return collectionData(q, { idField: 'id' }) as Observable<AppUser[]>;
  }

  /**
   * Cria um usuário no Firebase Auth + documento em `users/{uid}`.
   *
   * Usa um app secundário do Firebase para NÃO deslogar o administrador
   * que está criando a conta (o SDK autentica automaticamente quem acaba
   * de ser criado na instância padrão).
   */
  async create(input: NewUserInput): Promise<string> {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new Error('E-mail obrigatório.');
    if (!input.password || input.password.length < 6) {
      throw new Error('Senha deve ter pelo menos 6 caracteres.');
    }

    const secondaryApp = initializeApp(environment.firebase, `secondary-${Date.now()}`);
    try {
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, input.password);

      const displayName = input.displayName.trim() || email;
      try {
        await updateProfile(cred.user, { displayName });
      } catch {
        // atualização do perfil é best-effort
      }

      await setDoc(doc(this.firestore, 'users', cred.user.uid), {
        email,
        displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await signOut(secondaryAuth);
      return cred.user.uid;
    } finally {
      await deleteApp(secondaryApp);
    }
  }

  async update(uid: string, input: UpdateUserInput): Promise<void> {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (input.displayName !== undefined) patch['displayName'] = input.displayName.trim();
    await updateDoc(doc(this.firestore, 'users', uid), patch);
  }

  /**
   * Remove o documento em `users/{uid}` — com isso o usuário perde acesso ao
   * painel (o app valida a presença do doc). A conta no Firebase Auth Server
   * continua existindo e precisa ser removida manualmente pelo console ou por
   * uma Cloud Function usando o Admin SDK.
   */
  async remove(uid: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'users', uid));
  }
}
