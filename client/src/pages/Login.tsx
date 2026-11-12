import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CyberInput } from "@/components/CyberInput";
import { CyberButton } from "@/components/CyberButton";
import { Lock, Send, Smile, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { AuthProviders } from "@/components/AuthProviders";

// Simple inline emoji picker for the request form
const QUICK_EMOJIS = ["😀","😊","🙂","😎","🤔","👍","👋","❤️","🔥","✨","🎉","💪","🙏","😂","🥺","😅","🤝","💯","⭐","🚀"];

export default function Login() {
  const [tab, setTab] = useState<"login" | "request">(() =>
    window.location.search.includes("request-access") ? "request" : "login",
  );

  // Login state
  const [key, setKey] = useState("");
  const [username, setUsername] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const { login, isLoggingIn, user } = useAuth();
  const [location, setLocation] = useLocation();

  // Request state
  const [reqUsername, setReqUsername] = useState("");
  const [reqPassword, setReqPassword] = useState("");
  const [reqMessage, setReqMessage] = useState("");
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  useEffect(() => {
    if (!user) return;
    const joinPath = location.match(/^\/join\/[A-Za-z0-9_-]{1,100}$/);
    setLocation(joinPath ? location : location === "/chat" ? "/chat" : "/proxy");
  }, [user, location, setLocation]);

  if (user) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const token = turnstileToken;
    setTurnstileToken(null);
    setCaptchaResetKey((value) => value + 1);
    login({ password: key, username: username.trim(), turnstileToken: token ?? undefined });
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError("");
    if (!/^[\p{L}\p{N}_.-]{3,32}$/u.test(reqUsername.trim())) {
      setRequestError("Use 3–32 letters, numbers, periods, underscores, or hyphens for your username.");
      return;
    }
    if (reqPassword.length < 12 || reqPassword.length > 128) {
      setRequestError("Choose a password between 12 and 128 characters.");
      return;
    }
    if (!reqMessage.trim() || reqMessage.trim().length < 5) {
      setRequestError("Please give a reason of at least 5 characters.");
      return;
    }
    setIsSendingRequest(true);
    try {
      const token = turnstileToken;
      setTurnstileToken(null);
      setCaptchaResetKey((value) => value + 1);
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: reqUsername.trim(),
          password: reqPassword,
          reason: reqMessage.trim(),
          turnstileToken: token ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setRequestError(data.message || "Failed to send request.");
      } else {
        setRequestSent(true);
        setReqUsername("");
        setReqPassword("");
        setReqMessage("");
      }
    } catch {
      setRequestError("Network error. Please try again.");
    } finally {
      setIsSendingRequest(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setReqMessage(prev => prev + emoji);
    setShowEmojiBar(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, hsl(228 7% 13%) 0%, hsl(261 30% 12%) 50%, hsl(228 7% 13%) 100%)" }}>
      
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 border border-primary/30 mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to continue</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-secondary/60 rounded-lg p-1 mb-6">
          <button
            onClick={() => setTab("login")}
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
            onClick={() => { setTab("request"); setRequestSent(false); setRequestError(""); }}
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

        {/* ── LOGIN TAB ── */}
        {tab === "login" && (
          <div className="bg-secondary/40 border border-border rounded-xl p-6 shadow-2xl">
            <form onSubmit={handleLogin} className="space-y-4">
              <CyberInput
                label="Username"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                maxLength={32}
                autoComplete="username"
                required
              />
              <CyberInput
                label="Password"
                type="password"
                placeholder="Enter your password or access key"
                value={key}
                onChange={e => setKey(e.target.value)}
                required
              />
              <AuthProviders
                token={turnstileToken}
                onToken={setTurnstileToken}
                resetKey={captchaResetKey}
                returnTo={location.startsWith("/join/") ? location : location === "/chat" ? "/chat" : "/proxy"}
              />
              <CyberButton type="submit" className="w-full mt-2" isLoading={isLoggingIn}>
                <Lock className="w-4 h-4" />
                Sign In
              </CyberButton>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Need an account?{" "}
              <button onClick={() => setTab("request")} className="text-primary hover:underline">
                Request to join
              </button>
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              New here?{" "}
              <button onClick={() => setLocation("/signup")} className="text-primary hover:underline">
                Create an account
              </button>
            </p>
          </div>
        )}

        {/* ── REQUEST ACCESS TAB ── */}
        {tab === "request" && (
          <div className="bg-secondary/40 border border-border rounded-xl p-6 shadow-2xl">
            {requestSent ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
                <h3 className="text-lg font-semibold text-foreground">Request Sent!</h3>
                <p className="text-sm text-muted-foreground">
                  Your access request has been submitted. The owner will review it.
                </p>
                <CyberButton
                  variant="ghost"
                  size="sm"
                  onClick={() => { setRequestSent(false); setTab("login"); }}
                >
                  Back to Sign In
                </CyberButton>
              </div>
            ) : (
              <form onSubmit={handleRequest} className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-1">Request to join</h3>
                  <p className="text-xs text-muted-foreground">
                    Choose a username and password and explain why you want to join. The owner reviews every request.
                  </p>
                </div>

                <CyberInput
                  label="Username"
                  placeholder="Choose a username"
                  value={reqUsername}
                  onChange={e => setReqUsername(e.target.value)}
                  maxLength={32}
                  autoComplete="username"
                  required
                />

                <CyberInput
                  label="Password"
                  type="password"
                  placeholder="At least 12 characters"
                  value={reqPassword}
                  onChange={e => setReqPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Reason for joining <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    value={reqMessage}
                    onChange={e => setReqMessage(e.target.value)}
                    placeholder="Why would you like to join? (required)"
                    rows={4}
                    required
                    minLength={5}
                    className={cn(
                      "w-full bg-input border border-border rounded px-3 py-2 resize-none",
                      "text-foreground text-sm placeholder:text-muted-foreground/60",
                      "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/60",
                      "transition-all duration-150",
                      requestError && "border-destructive"
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
                          {QUICK_EMOJIS.map(e => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => insertEmoji(e)}
                              className="text-lg p-1 rounded hover:bg-secondary transition-colors"
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "text-xs",
                      reqMessage.length < 5 ? "text-muted-foreground/60" : "text-green-400"
                    )}>
                      {reqMessage.length} chars
                    </span>
                  </div>
                </div>

                <AuthProviders
                  token={turnstileToken}
                  onToken={setTurnstileToken}
                  resetKey={captchaResetKey}
                  returnTo={location.startsWith("/join/") ? location : "/proxy"}
                  showProviders={false}
                />

                {requestError && (
                  <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded border border-destructive/30">
                    {requestError}
                  </p>
                )}

                <CyberButton type="submit" className="w-full" isLoading={isSendingRequest}
                  disabled={!reqUsername.trim() || reqPassword.length < 12 || reqMessage.trim().length < 5}>
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
