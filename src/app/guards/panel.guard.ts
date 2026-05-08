import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Guard que redireciona dispositivos móveis para a tela de login/administração.
 * A tela do painel (TV) só é acessível em telas grandes (desktop/TV).
 */
export const panelGuard: CanActivateFn = () => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const isMobile = window.innerWidth <= 1024 ||
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: '/admin' },
    });
  }

  return true;
};
