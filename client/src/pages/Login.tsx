
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CyberInput } from "@/components/CyberInput";
import { CyberButton } from "@/components/CyberButton";
import {
  Lock,
  Send,
  Smile,
  CheckCircle2,
  Eye,
  EyeOff
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const QUICK_EMOJIS = [
  "😀", "😊", "🙂", "😎", "🤔", "👍", "👋", "❤️", "🔥", "✨",
  "🎉", "💪", "🙏", "😂", "🥺", "😅", "🤝", "💯", "⭐", "🚀"
];

type TurnstileOptions = {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: TurnstileOptions
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY = import.meta.env
  .VITE_TURNSTILE_SITE_KEY as string | undefined;

function TurnstileWidget({
  onVerify,
  onExpire,
  onError
}: {
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
  }, [onVerify, onExpire, onError]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return;

    let cancelled = false;

    const renderWidget = () => {
      if (
        cancelled ||
        !containerRef.current ||
        !window.turnstile ||
        widgetIdRef.current
      ) return;

      widgetIdRef.current = window.turnstile.render(
        containerRef.current,
        {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: (token) => onVerifyRef.current(token),
          "expired-callback": () => onExpireRef.current(),
          "error-callback": () => onErrorRef.current()
        }
      );
    };

    let script = document.querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]'
    );

    if (window.turnstile) {
      renderWidget();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      script.addEventListener("load", renderWidget);
      script.addEventListener("error", () => {
        if (!cancelled) onErrorRef.current();
      });
    }

    return () => {
      cancelled = true;

      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) {
    return (
      <p className="text-xs text-destructive">
        Cloudflare Turnstile is not configured.
        Set VITE_TURNSTILE_SITE_KEY.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex justify-center min-h-[65px]"
    />
  );
}

export default function Login() {
  const [tab, setTab] = useState<"login" | "request">("login");

  // Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginTurnstileToken, setLoginTurnstileToken] = useState("");
  const [loginCaptchaError, setLoginCaptchaError] = useState("");

  const { login, isLoggingIn, user } = useAuth();
  const [, setLocation] = useLocation();

  // Access request state
  const [reqName, setReqName] = useState("");
  const [reqPassword, setReqPassword] = useState("");
  const [reqMessage, setReqMessage] = useState("");
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [requestTurnstileToken, setRequestTurnstileToken] = useState("");

  useEffect(() => {
    if (user) setLocation("/proxy");
  }, [user, setLocation]);

  // Login Cloudflare callbacks
  const handleLoginTurnstileVerify = useCallback((token: string) => {
    setLoginTurnstileToken(token);
    setLoginCaptchaError("");
  }, []);

  const handleLoginTurnstileExpire = useCallback(() => {
    setLoginTurnstileToken("");
    setLoginCaptchaError(
      "Verification expired. Please complete it again."
    );
  }, []);

  const handleLoginTurnstileError = useCallback(() => {
    setLoginTurnstileToken("");
    setLoginCaptchaError(
      "Cloudflare verification failed to load. Please refresh and try again."
    );
  }, []);

  // Access request Cloudflare callbacks
  const handleRequestTurnstileVerify = useCallback((token: string) => {
    setRequestTurnstileToken(token);
    setRequestError("");
  }, []);

  const handleRequestTurnstileExpire = useCallback(() => {
    setRequestTurnstileToken("");
    setRequestError(
      "Verification expired. Please complete it again."
    );
  }, []);

  const handleRequestTurnstileError = useCallback(() => {
    setRequestTurnstileToken("");
    setRequestError(
      "Cloudflare verification failed to load. Please refresh and try again."
    );
  }, []);

  if (user) return null;

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginCaptchaError("");

    if (!username.trim() || password.length < 8) return;

    if (!loginTurnstileToken) {
      setLoginCaptchaError(
        "Please complete Cloudflare verification first."
      );
      return;
    }

    login({
      username: username.trim(),
      serialKey: password,
      turnstileToken: loginTurnstileToken
    });

    // Prevent reusing the same single-use token.
    setLoginTurnstileToken("");
  };

  // Access request handler
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError("");

    if (!requestTurnstileToken) {
                  reqName.trim().length < 3 ||
                  reqPassword.length < 8 ||
                  reqMessage.trim().length < 5 ||
      setRequestError(
        "Please complete Cloudflare verification first."
      );
      return;
    }

    setIsSendingRequest(true);

    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: reqName.trim(),
          password: reqPassword,
          message: reqMessage.trim(),
          turnstileToken: requestTurnstileToken
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setRequestError(
          data.message || "Failed to send request."
        );
        setRequestTurnstileToken("");
        return;
      }

      setRequestSent(true);
      setReqName("");
      setReqPassword("");
      setReqMessage("");
      setRequestTurnstileToken("");

    } catch {
      setRequestError("Network error. Please try again.");
      setRequestTurnstileToken("");
    } finally {
      setIsSendingRequest(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setReqMessage(prev => prev + emoji);
    setShowEmojiBar(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, hsl(228 7% 13%) 0%, hsl(261 30% 12%) 50%, hsl(228 7% 13%) 100%)"
      }}
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 border border-primary/30 mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>

          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Welcome back
          </h1>

          <p className="text-muted-foreground text-sm mt-1">
            Sign in to continue
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-secondary/60 rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setTab("login");
              setLoginTurnstileToken("");
            }}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition-all duration-150",
              tab === "login"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("request");
              setRequestSent(false);
              setRequestError("");
              setRequestTurnstileToken("");
            }}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition-all duration-150",
              tab === "request"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Request Access
          </button>
        </div>

        {/* LOGIN */}
        {tab === "login" && (
          <div className="bg-secondary/40 border border-border rounded-xl p-6 shadow-2xl">
            <form onSubmit={handleLogin} className="space-y-4">

              <CyberInput
                label="Username"
                placeholder="Enter your username..."
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Password
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password..."
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="current-password"
                    className="w-full bg-input border border-border rounded px-3 py-2 pr-11 text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/60 transition-all duration-150"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />
                    }
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters.
                </p>
              </div>

              {/* Cloudflare Turnstile */}
              <div className="space-y-2">
                <TurnstileWidget
                  onVerify={handleLoginTurnstileVerify}
                  onExpire={handleLoginTurnstileExpire}
                  onError={handleLoginTurnstileError}
                />

                {loginCaptchaError && (
                  <p
                    className="text-xs text-destructive"
                    role="alert"
                  >
                    {loginCaptchaError}
                  </p>
                )}
              </div>

              <CyberButton
                type="submit"
                className="w-full mt-2"
                isLoading={isLoggingIn}
                disabled={
                  !username.trim() ||
                  password.length < 8 ||
                  !loginTurnstileToken ||
                  isLoggingIn
                }
              >
                <Lock className="w-4 h-4" />
                Sign In
              </CyberButton>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setTab("request")}
                className="text-primary hover:underline"
              >
                Request access
              </button>
            </p>
          </div>
        )}

        {/* REQUEST ACCESS */}
        {tab === "request" && (
          <div className="bg-secondary/40 border border-border rounded-xl p-6 shadow-2xl">

            {requestSent ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />

                <h3 className="text-lg font-semibold text-foreground">
                  Request Sent!
                </h3>

                <p className="text-sm text-muted-foreground">
                  Your access request has been submitted. The owner will review it.
                </p>

                <CyberButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRequestSent(false);
                    setTab("login");
                  }}
                >
                  Back to Sign In
                </CyberButton>
              </div>
            ) : (
              <form onSubmit={handleRequest} className="space-y-4">

                <div>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    Request Access
                  </h3>

                  <p className="text-xs text-muted-foreground">
                    Fill out the form below and the owner will review your request.
                  </p>
                </div>

                <CyberInput
                  label="Username"
                  placeholder="Choose a username (3–24 characters)"
                  value={reqName}
                  onChange={e => setReqName(e.target.value)}
                />
                <CyberInput
                  label="Password"
                  type="password"
                  placeholder="Choose a password (at least 8 characters)"
                  value={reqPassword}
                  onChange={e => setReqPassword(e.target.value)}
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Why do you want to join?
                  </label>

                  <textarea
                    value={reqMessage}
                    onChange={e => setReqMessage(e.target.value)}
                    placeholder="Tell the admins why you would like to join (5–500 characters)..."
                    rows={4}
                    className={cn(
                      "w-full bg-input border border-border rounded px-3 py-2 resize-none",
                      "text-foreground text-sm placeholder:text-muted-foreground/60",
                      "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/60",
                      "transition-all duration-150"
                    )}
                  />

                  <div className="flex items-center justify-between">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEmojiBar(v => !v)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary"
                      >
                        <Smile className="w-3.5 h-3.5" />
                        <span>Emoji</span>
                      </button>

                      {showEmojiBar && (
                        <div className="absolute bottom-8 left-0 bg-[hsl(225_7%_15%)] border border-border rounded-lg p-2 shadow-2xl z-50 flex flex-wrap gap-1 w-56">
                          {QUICK_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => insertEmoji(emoji)}
                              className="text-lg p-1 rounded hover:bg-secondary transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <span className="text-xs text-muted-foreground">
                      {reqMessage.length} chars
                    </span>
                  </div>
                </div>

                {/* Cloudflare Turnstile */}
                <TurnstileWidget
                  onVerify={handleRequestTurnstileVerify}
                  onExpire={handleRequestTurnstileExpire}
                  onError={handleRequestTurnstileError}
                />

                {requestError && (
                  <p
                    className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded border border-destructive/30"
                    role="alert"
                  >
                    {requestError}
                  </p>
                )}

                <CyberButton
                  type="submit"
                  className="w-full"
                  isLoading={isSendingRequest}
                  disabled={
                    isSendingRequest ||
                    !requestTurnstileToken
                  }
                >
                  <Send className="w-4 h-4" />
                  Submit Request
                </CyberButton>
              </form>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground/50">
          Unauthorized access is strictly prohibited.
        </p>
      </div>
    </div>
  );
}