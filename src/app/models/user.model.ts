export interface AppUser {
  /** UID do Firebase Auth. */
  id?: string;
  /** E-mail do usuário (também é o identificador de login). */
  email: string;
  /** Nome exibido na interface. */
  displayName: string;
  createdAt?: number;
  updatedAt?: number;
}

export type UserSessionInfo = Pick<AppUser, 'id' | 'email' | 'displayName'>;
