// ─── Auth & User types ────────────────────────────────────────────────────────
// Ported from src/lib/stores/index.ts (SessionUser, Config) in the Svelte app.

export type UserRole = 'admin' | 'user' | 'pending';

export interface UserPermissions {
  chat?: {
    temporary?: boolean;
    temporary_enforced?: boolean;
    delete?: boolean;
    edit?: boolean;
    stt?: boolean;
    call?: boolean;
    multiple_models?: boolean;
    file_upload?: boolean;
    image_generation?: boolean;
    web_search?: boolean;
    code_interpreter?: boolean;
    arena?: boolean;
  };
  workspace?: {
    models?: boolean;
    knowledge?: boolean;
    prompts?: boolean;
    tools?: boolean;
  };
  features?: {
    direct_tool_servers?: boolean;
    web_search?: boolean;
    image_generation?: boolean;
    code_interpreter?: boolean;
    leaderboard?: boolean;
    notes?: boolean;
    channels?: boolean;
  };
  [key: string]: unknown;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  profile_image_url: string;
  permissions: UserPermissions;
  expires_at?: number;
  token?: string;
  is_active?: boolean;
  status_emoji?: string;
  status_message?: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload {
  name: string;
  email: string;
  password: string;
  profile_image_url?: string;
}

export interface LdapSignInPayload {
  user: string;
  password: string;
}

export interface UpdateProfilePayload {
  name: string;
  profile_image_url: string;
  bio?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
}

export interface UpdatePasswordPayload {
  password: string;
  new_password: string;
}

export interface AdminConfig {
  enable_signup: boolean;
  enable_login_form: boolean;
  default_user_role: UserRole;
  jwt_expiry: string;
  default_locale: string;
}

export interface OAuthProviders {
  google?: string;
  microsoft?: string;
  github?: string;
  oidc?: string;
  feishu?: string;
}
