/**
 * TabLockService
 * Handles password hashing and session-based unlock state for locked tabs.
 * This is a client-side lock for UX gating, not a security boundary.
 */

export interface IUnlockRecord {
  expiresAt: number;
  passwordHash: string;
}

export class TabLockService {
  private static readonly DEFAULT_TTL_MINUTES = 5;
  private readonly instanceId: string;
  private readonly secretKey: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
    this.secretKey = `PiCanvasLock_${instanceId}`;
  }

  public async hashPassword(plain: string): Promise<string> {
    const safePlain = (plain || '').trim();
    if (!safePlain) {
      return '';
    }

    const data = new TextEncoder().encode(`${this.secretKey}:${safePlain}`);

    if (!window.crypto || !window.crypto.subtle) {
      // Fallback: non-cryptographic hash for legacy environments
      return btoa(String.fromCharCode(...data)).replace(/=+$/, '');
    }

    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  public async verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
    if (!plain || !passwordHash) {
      return false;
    }
    const hash = await this.hashPassword(plain);
    return hash === passwordHash;
  }

  public isUnlocked(tabIndex: number, passwordHash: string): boolean {
    if (!passwordHash) {
      return false;
    }

    const record = this.getUnlockRecord(tabIndex);
    if (!record) {
      return false;
    }

    if (record.passwordHash !== passwordHash) {
      this.lock(tabIndex);
      return false;
    }

    if (Date.now() > record.expiresAt) {
      this.lock(tabIndex);
      return false;
    }

    return true;
  }

  public rememberUnlock(tabIndex: number, passwordHash: string, ttlMinutes: number = TabLockService.DEFAULT_TTL_MINUTES): void {
    if (!passwordHash) {
      return;
    }

    const expiresAt = Date.now() + Math.max(ttlMinutes, 1) * 60 * 1000;
    const record: IUnlockRecord = { expiresAt, passwordHash };
    try {
      window.sessionStorage.setItem(this.getStorageKey(tabIndex), JSON.stringify(record));
    } catch {
      // Ignore storage failures (private browsing, quota, etc.)
    }
  }

  public lock(tabIndex: number): void {
    try {
      window.sessionStorage.removeItem(this.getStorageKey(tabIndex));
    } catch {
      // Ignore storage failures
    }
  }

  private getUnlockRecord(tabIndex: number): IUnlockRecord | null {
    try {
      const raw = window.sessionStorage.getItem(this.getStorageKey(tabIndex));
      if (!raw) return null;
      return JSON.parse(raw) as IUnlockRecord;
    } catch {
      return null;
    }
  }

  private getStorageKey(tabIndex: number): string {
    return `picanvas-lock:${this.instanceId}:${tabIndex}`;
  }
}
