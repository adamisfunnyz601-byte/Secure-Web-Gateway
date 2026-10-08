import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LockKeyhole, UserRoundPlus } from "lucide-react";
import { CyberButton } from "@/components/CyberButton";
import { CyberInput } from "@/components/CyberInput";
import { useAuth } from "@/hooks/use-auth";

export default function SignUp() {
  const [username, setUsername] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const { login, isLoggingIn, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) setLocation("/proxy");
  }, [user, setLocation]);

  if (user) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login({ username: username.trim(), serialKey: accessKey.trim() });
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, hsl(228 7% 13%) 0%, hsl(261 30% 12%) 50%, hsl(228 7% 13%) 100%)",
      }}
    >
      <section className="w-full max-w-md">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 border border-primary/30 mb-4">
            <UserRoundPlus className="w-7 h-7 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Create your account</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sign up with an access key from the server owner.
          </p>
        </header>

        <div className="bg-secondary/40 border border-border rounded-xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <CyberInput
              label="Username"
              placeholder="Choose a username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={32}
              autoComplete="username"
              aria-label="Username"
              required
            />
            <CyberInput
              label="Access key"
              type="password"
              placeholder="Enter your access key"
              value={accessKey}
              onChange={(event) => setAccessKey(event.target.value)}
              autoComplete="off"
              aria-label="Access key"
              required
            />
            <CyberButton
              type="submit"
              className="w-full mt-2"
              isLoading={isLoggingIn}
              disabled={!username.trim() || !accessKey.trim()}
            >
              <LockKeyhole className="w-4 h-4" aria-hidden="true" />
              Create account
            </CyberButton>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="text-primary hover:underline"
            >
              Sign in
            </button>
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Need an access key?{" "}
            <button
              type="button"
              onClick={() => setLocation("/?request-access")}
              className="text-primary hover:underline"
            >
              Request access
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
