/**
 * 站点访客会话提供者 —— 契约先行 + Mock 兜底。
 *
 * - RemoteAuthProvider：按 contracts/auth.ts 端点约定请求真实后端（Cookie 会话）。
 * - MockAuthProvider：后端会员服务就绪前的内置假实现（localStorage 持久化），
 *   登录/注册即写入演示用户，接口签名与真实实现完全一致，切换零改动。
 */
import type {
  AuthLoginPayload,
  AuthRegisterPayload,
  SiteUser,
} from '../contracts/index.ts';

export interface AuthProvider {
  /** 当前登录用户；未登录返回 null。 */
  me(): Promise<SiteUser | null>;
  login(payload: AuthLoginPayload): Promise<SiteUser>;
  register(payload: AuthRegisterPayload): Promise<SiteUser>;
  logout(): Promise<void>;
}

export type { AuthLoginPayload, AuthRegisterPayload };

export type AuthMode = 'remote' | 'mock';

const MOCK_STORAGE_KEY = 'web-auth:user';

/** 统一解包 ApiEnvelope 的最小类型。 */
interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export class AuthError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export class RemoteAuthProvider implements AuthProvider {
  private readonly base: string;
  private readonly fetcher: <T = unknown>(url: string, options?: Record<string, unknown>) => Promise<T>;

  constructor(base: string, fetcher: <T = unknown>(url: string, options?: Record<string, unknown>) => Promise<T>) {
    this.base = base;
    this.fetcher = fetcher;
  }

  async me(): Promise<SiteUser | null> {
    const env = await this.request<Envelope<{ user: SiteUser | null }>>('me');
    return env?.data?.user ?? null;
  }

  async login(payload: AuthLoginPayload): Promise<SiteUser> {
    const env = await this.request<Envelope<{ user: SiteUser }>>('login', payload);
    if (!env?.data?.user) throw new AuthError(401, env?.error?.message ?? '登录失败');
    return env.data.user;
  }

  async register(payload: AuthRegisterPayload): Promise<SiteUser> {
    const env = await this.request<Envelope<{ user: SiteUser }>>('register', payload);
    if (!env?.data?.user) throw new AuthError(422, env?.error?.message ?? '注册失败');
    return env.data.user;
  }

  async logout(): Promise<void> {
    await this.fetcher<unknown>(`${this.base}/api/v1/site/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      ignoreResponseError: true,
    } as Record<string, unknown>);
  }

  private async request<T>(
    action: 'me' | 'login' | 'register',
    body?: unknown,
  ): Promise<T | null> {
    const url = `${this.base}/api/v1/site/auth/${action}`;
    const options: Record<string, unknown> = {
      credentials: 'include',
      ignoreResponseError: true,
      ...(action === 'me' ? { method: 'GET' } : { method: 'POST', body }),
    };
    return this.fetcher<T>(url, options);
  }
}

/** Mock 会话存储抽象（便于 SSR / 测试注入内存实现）。 */
export interface MockAuthStorage {
  get(): string | null;
  set(value: string | null): void;
}

class LocalStorageAuthStorage implements MockAuthStorage {
  get(): string | null {
    try {
      return globalThis.localStorage?.getItem(MOCK_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }
  set(value: string | null): void {
    try {
      if (value === null) globalThis.localStorage?.removeItem(MOCK_STORAGE_KEY);
      else globalThis.localStorage?.setItem(MOCK_STORAGE_KEY, value);
    } catch {
      /* 隐私模式等场景静默失败 */
    }
  }
}

export function createMemoryAuthStorage(): MockAuthStorage {
  let value: string | null = null;
  return {
    get: () => value,
    set: (v) => {
      value = v;
    },
  };
}

export class MockAuthProvider implements AuthProvider {
  private readonly storage: MockAuthStorage;

  constructor(storage?: MockAuthStorage) {
    this.storage =
      storage ??
      (typeof globalThis !== 'undefined' && globalThis.localStorage
        ? new LocalStorageAuthStorage()
        : createMemoryAuthStorage());
  }

  async me(): Promise<SiteUser | null> {
    const raw = this.storage.get();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SiteUser;
    } catch {
      return null;
    }
  }

  async login(payload: AuthLoginPayload): Promise<SiteUser> {
    if (!payload.account) throw new AuthError(422, '请输入账号');
    if (!payload.password && !payload.sms_code) throw new AuthError(422, '请输入密码或验证码');
    const existing = await this.me();
    const user: SiteUser =
      existing ?? {
        id: `mock-${Date.now()}`,
        name: mockNameFromAccount(payload.account),
        email: payload.account.includes('@') ? payload.account : null,
        phone: payload.account.includes('@') ? null : payload.account,
        _mock: true,
      };
    this.storage.set(JSON.stringify(user));
    return user;
  }

  async register(payload: AuthRegisterPayload): Promise<SiteUser> {
    if (!payload.account) throw new AuthError(422, '请输入账号');
    const user: SiteUser = {
      id: `mock-${Date.now()}`,
      name: payload.name || mockNameFromAccount(payload.account),
      email: payload.account.includes('@') ? payload.account : null,
      phone: payload.account.includes('@') ? null : payload.account,
      _mock: true,
    };
    this.storage.set(JSON.stringify(user));
    return user;
  }

  async logout(): Promise<void> {
    this.storage.set(null);
  }
}

function mockNameFromAccount(account: string): string {
  const head = account.split('@')[0] ?? account;
  return head.slice(0, 12) || '访客';
}
