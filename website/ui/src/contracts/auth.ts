/**
 * 站点访客会话契约（契约先行）。
 *
 * 真实会员服务接入前，由 `/website-ui/auth` 的 MockAuthProvider 兜底实现；
 * 端点约定（后端就绪后零改动切换）：
 * - POST /api/v1/site/auth/login     { account, password?, sms_code? } -> { user, token? }
 * - POST /api/v1/site/auth/register  同上
 * - POST /api/v1/site/auth/logout    -> {}
 * - GET  /api/v1/site/auth/me        -> { user | null }
 *
 * 认证方式：Cookie 会话（SameSite=Lax），前端不落 token。
 */

/** 站点访客用户（公开字段，不含敏感信息）。 */
export interface SiteUser {
  id: number | string;
  name: string;
  avatar?: string | null;
  email?: string | null;
  phone?: string | null;
  /** 会员等级 / 分组等扩展位。 */
  [key: string]: unknown;
}

export type AuthAccountType = 'phone' | 'email';

export interface AuthLoginPayload {
  account: string;
  account_type?: AuthAccountType;
  password?: string;
  sms_code?: string;
}

export interface AuthRegisterPayload extends AuthLoginPayload {
  name?: string;
  captcha?: string;
}

export interface AuthSessionResponse {
  user: SiteUser | null;
}
