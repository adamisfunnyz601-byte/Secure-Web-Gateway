import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Chrome, Building2, Loader2, ShieldCheck } from "lucide-react";

interface AuthConfig {
  providers: {
    google: boolean;
    microsoft: boolean;
  };
  turnstileSiteKey: string | null;
}

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function useAuthConfig() {
  return useQuery<AuthConfig>({
    queryKey: ["/api/auth/config"],
    queryFn: async () => {
      const response = await fetch("/api/auth/config");
      if (!response.ok) throw new Error("Could not load sign-in options.");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile-sdk]");
    const script = existing ?? document.createElement("script");
    const onLoad = () => window.turnstile ? resolve() : reject(new Error("Turnstile did not initialize."));
    const onError = () => reject(new Error("Turnstile failed to load."));

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.turnstileSdk = "true";
      document.head.appendChild(script);
    }
  });
}

function TurnstileWidget({
  siteKey,
  resetKey,
  onToken,
}: {
  siteKey: string;
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const lastResetKey = useRef(resetKey);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: "auth",
          callback: (token) => {
            setError("");
            onToken(token);
          },
          "error-callback": () => {
            setError("Cloudflare verification could not complete. Try again.");
            onToken(null);
          },
          "expired-callback": () => onToken(null),
        });
      })
      .catch(() => {
        if (!cancelled) setError("Cloudflare verification failed to load.");
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onToken]);

  useEffect(() => {
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    onToken(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetKey, onToken]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-0" />
      {error ? (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Protected by Cloudflare
        </p>
      )}
    </div>
  );
}

export function AuthProviders({
  token,
  onToken,
  resetKey = 0,
  returnTo = "/proxy",
  showProviders = true,
}: {
  token: string | null;
  onToken: (token: string | null) => void;
  resetKey?: number;
  returnTo?: string;
  showProviders?: boolean;
}) {
  const { data: config, isLoading } = useAuthConfig();
  const [providerError, setProviderError] = useState("");
  const [startingProvider, setStartingProvider] = useState<string | null>(null);
  const hasProvider = Boolean(config?.providers.google || config?.providers.microsoft);

  const startProviderLogin = async (provider: "google" | "microsoft") => {
    setProviderError("");
    setStartingProvider(provider);
    try {
      const response = await fetch(`/api/auth/oauth/${provider}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken: token, returnTo }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.authorizationUrl !== "string") {
        throw new Error(result.message || "Could not start sign-in.");
      }
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : "Could not start sign-in.");
      onToken(null);
      setStartingProvider(null);
    }
  };

  return (
    <div className="space-y-4">
      {config?.turnstileSiteKey && (
        <TurnstileWidget
          siteKey={config.turnstileSiteKey}
          resetKey={resetKey}
          onToken={onToken}
        />
      )}

      {showProviders && (
        <>
          {hasProvider ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or continue with</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {config?.providers.google && (
                  <button
                    type="button"
                    onClick={() => startProviderLogin("google")}
                    disabled={Boolean(startingProvider) || Boolean(config.turnstileSiteKey && !token)}
                    className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {startingProvider === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
                    Google
                  </button>
                )}
                {config?.providers.microsoft && (
                  <button
                    type="button"
                    onClick={() => startProviderLogin("microsoft")}
                    disabled={Boolean(startingProvider) || Boolean(config.turnstileSiteKey && !token)}
                    className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {startingProvider === "microsoft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                    Microsoft
                  </button>
                )}
              </div>
            </div>
          ) : !isLoading ? (
            <p className="text-center text-xs text-muted-foreground">
              Google and Microsoft sign-in will appear after setup.
            </p>
          ) : null}
          {providerError && <p role="alert" className="text-xs text-destructive">{providerError}</p>}
        </>
      )}
    </div>
  );
}
