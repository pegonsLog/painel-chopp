# Painel de Chopes

Aplicação Angular 21 que exibe um painel para chopperia, com tela de administração
que permite cadastrar chopes, tamanhos/preços e rótulos. Os dados ficam no
Firebase (Firestore + Storage) e o site é publicado no Firebase Hosting.

## Stack

- Angular 21 (standalone components, signals, controle de fluxo `@if/@for`)
- Firebase 12 (Auth, Firestore, Storage, Hosting) via `@angular/fire`

## Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Painel de visualização (público) |
| `/login` | Login via Firebase Authentication |
| `/admin/chopes` | CRUD de chopes com upload de rótulo |
| `/admin/usuarios` | CRUD de usuários administradores |

## Setup

1. **Instalar dependências**
   ```bash
   npm install
   ```
2. **Firebase**
   - Crie um projeto em https://console.firebase.google.com.
   - Ative **Firestore**, **Storage**, **Hosting** e **Authentication** (método "E-mail/senha").
   - Copie a config do app web para `src/environments/environment.ts`.
   - Em `.firebaserc`, troque `REPLACE_ME` pelo `projectId`.
3. **Primeiro administrador**
   - No console do Firebase, entre em **Authentication > Users > Add user** e cadastre um e-mail/senha.
   - Faça login em `/login` com essa conta. Na primeira entrada, o app cria
     automaticamente o documento `users/{uid}` que funciona como whitelist de admin.
   - A partir daí, novos usuários podem ser cadastrados em `/admin/usuarios`.
4. **Publicar regras e app**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,storage
   npm run build
   firebase deploy --only hosting
   ```

## Segurança

- **Firestore rules** (`firestore.rules`): leitura pública de `beers`; escrita só
  para usuários com documento em `users/{uid}`. Leitura de `users` só para
  autenticados.
- **Storage rules** (`storage.rules`): leitura pública dos rótulos; escrita só
  para autenticados, limitada a 5 MB e tipos `image/*`.
- A exclusão de um usuário em `/admin/usuarios` remove **somente** o documento
  em `users/{uid}` (revogando o acesso). A conta no Firebase Auth precisa ser
  apagada pelo console (ou por uma Cloud Function com Admin SDK).

## Desenvolvimento

```bash
npm start          # servidor de dev em http://localhost:4200
npm run build      # build de produção em dist/painel-chopp/browser
npm test           # testes unitários (Vitest)
```
# painel-chopp
