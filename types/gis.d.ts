// The parts of Google Identity Services (https://accounts.google.com/gsi/client) that Callback uses.
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
  google?: { accounts: { oauth2: typeof google.accounts.oauth2 } };
}
