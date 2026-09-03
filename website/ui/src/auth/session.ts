/**
 * 站点访客会话 store —— 仅依赖 Vue（不依赖 Nuxt），可被任意宿主使用。
 *
 * 初始化链：宿主入口（Nuxt plugin）调用 configureSession(client.auth)；
 * 首次 useSession() 时拉取 me()。SSG 构建期无浏览器环境，保持未登录态，
 * 客户端注水后由 ClientOnly 岛组件刷新显示。
 */
import { readonly, ref } from 'vue';
import type { SiteUser } from '../contracts/index.ts';
import { MockAuthProvider, type AuthProvider } from '../api/auth.ts';

const user = ref<SiteUser | null>(null);
const loading = ref(false);

let provider: AuthProvider | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

/** 宿主入口注入会话提供者；缺省落到 MockAuthProvider。 */
export function configureSession(p: AuthProvider): void {
  provider = p;
}

function ensureInit(): void {
  if (initialized || typeof window === 'undefined') return;
  if (!initPromise) {
    initialized = true;
    const p = provider ?? new MockAuthProvider();
    loading.value = true;
    initPromise = p
      .me()
      .then((u) => {
        user.value = u;
      })
      .catch(() => {
        user.value = null;
      })
      .finally(() => {
        loading.value = false;
      });
  }
}

async function doAuth<T>(fn: (p: AuthProvider) => Promise<T>): Promise<T> {
  const p = provider ?? new MockAuthProvider();
  loading.value = true;
  try {
    return await fn(p);
  } finally {
    loading.value = false;
  }
}

export function useSession() {
  ensureInit();
  const isClient = typeof window !== 'undefined';

  async function login(payload: Parameters<AuthProvider['login']>[0]): Promise<SiteUser> {
    const u = await doAuth((p) => p.login(payload));
    user.value = u;
    return u;
  }

  async function register(payload: Parameters<AuthProvider['register']>[0]): Promise<SiteUser> {
    const u = await doAuth((p) => p.register(payload));
    user.value = u;
    return u;
  }

  async function logout(): Promise<void> {
    await doAuth(async (p) => {
      await p.logout();
    });
    user.value = null;
  }

  async function refresh(): Promise<void> {
    await doAuth(async (p) => {
      try {
        user.value = await p.me();
      } catch {
        user.value = null;
      }
    });
  }

  return { user: readonly(user), loading: readonly(loading), isClient, login, register, logout, refresh };
}
