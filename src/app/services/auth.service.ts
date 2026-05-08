import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  User,
  authState,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';

import { AppUser, UserSessionInfo } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);

  private readonly sessionSignal = signal<UserSessionInfo | null>(null);
  /** Inicia como `true` até o Firebase resolver a sessão persistida. */
  private readonly readySignal = signal(false);

  readonly currentUser = computed(() => this.sessionSignal());
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);
  readonly ready = computed(() => this.readySignal());

  constructor() {
    authState(this.auth).subscribe(async (user) => {
      this.sessionSignal.set(user ? await this.toSessionInfo(user) : null);
      this.readySignal.set(true);
    });
  }

  /** Aguarda o Firebase restaurar sessão persistida antes de prosseguir (usado no guard). */
  async waitUntilReady(): Promise<void> {
    if (this.readySignal()) return;
    await firstValueFrom(authState(this.auth));
    this.readySignal.set(true);
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.router.navigateByUrl('/login');
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    await fbSendPasswordResetEmail(this.auth, email);
  }

  /**
   * Atualiza o nome de exibição do usuário autenticado (Firebase Auth + Firestore).
   */
  async updateOwnDisplayName(displayName: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Não autenticado.');
    await updateProfile(user, { displayName });
    await setDoc(
      doc(this.firestore, 'users', user.uid),
      { displayName, updatedAt: Date.now() },
      { merge: true },
    );
    this.sessionSignal.set(await this.toSessionInfo(user));
  }

  private async toSessionInfo(user: User): Promise<UserSessionInfo> {
    const profile = await this.ensureUserDoc(user);
    return {
      id: user.uid,
      email: profile.email,
      displayName: profile.displayName,
    };
  }

  /**
   * Garante que exista um documento `users/{uid}`. Se for a primeira vez que
   * o usuário entra (conta criada direto no Firebase Console, por exemplo),
   * cria o documento com um displayName derivado do e-mail.
   */
  private async ensureUserDoc(user: User): Promise<AppUser> {
    const ref = doc(this.firestore, 'users', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as AppUser;
      return {
        id: user.uid,
        email: data.email ?? user.email ?? '',
        displayName: data.displayName ?? user.displayName ?? user.email ?? '',
      };
    }

    const displayName = user.displayName || user.email || 'Administrador';
    await setDoc(ref, {
      email: user.email ?? '',
      displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: user.uid, email: user.email ?? '', displayName };
  }
}
