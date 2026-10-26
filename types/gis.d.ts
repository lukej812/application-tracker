// The parts of Google Identity Services (https://accounts.google.com/gsi/client) that Callback uses.
declare namespace google.accounts.id {
  interface CredentialResponse {
    /** A Google ID token (JWT). */
    credential: string;
  }
  interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }
  interface ButtonOptions {
    type?: "standard" | "icon";
    theme?: "outline" | "filled_blue" | "filled_black";
    size?: "large" | "medium" | "small";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    shape?: "rectangular" | "pill" | "circle" | "square";
  }
  function initialize(config: IdConfiguration): void;
  function renderButton(parent: HTMLElement, options: ButtonOptions): void;
  function disableAutoSelect(): void;
}

declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    error?: string;
    error_description?: string;
  }
  interface TokenClientConfig {
    client_id: string;
    scope: string;
    prompt?: "" | "none" | "consent" | "select_account";
    login_hint?: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }
  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: TokenClientConfig["prompt"] }): void;
  }
  function initTokenClient(config: TokenClientConfig): TokenClient;
  function revoke(accessToken: string, done?: () => void): void;
  function hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
}

interface Window {
  google?: { accounts: { id: typeof google.accounts.id; oauth2: typeof google.accounts.oauth2 } };
}
