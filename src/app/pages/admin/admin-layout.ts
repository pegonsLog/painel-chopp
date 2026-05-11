import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected get isFormPage(): boolean {
    const url = this.router.url;
    return url.includes('/chopes/novo') || url.includes('/chopes/editar');
  }

  protected get isPreviewPage(): boolean {
    return this.router.url.includes('/admin/preview');
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
