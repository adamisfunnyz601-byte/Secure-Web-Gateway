import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import Login from "@/pages/Login";

export default function JoinServer() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const startedForCode = useRef<string | null>(null);
  const [error, setError] = useState("");
  const inviteCode = decodeURIComponent(window.location.pathname.split("/").filter(Boolean).at(-1) || "");

  useEffect(() => {
    if (!user || isLoading || !inviteCode || startedForCode.current === inviteCode) return;
    startedForCode.current = inviteCode;

    void (async () => {
      try {
        const response = await fetch("/api/chat/groups/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "This invite link is not valid.");
        await queryClient.invalidateQueries({ queryKey: ["/api/chat/groups"] });
        toast({ title: `Joined ${result.name || "server"}` });
        setLocation("/chat");
      } catch (joinError) {
        setError(joinError instanceof Error ? joinError.message : "Could not join this server.");
      }
    })();
  }, [user, isLoading, inviteCode, setLocation, toast]);

  if (!user && !isLoading) return <Login />;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <section className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-xl">
        {error ? (
          <>
            <XCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <h1 className="text-xl font-semibold">Invite could not be used</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => setLocation(user ? "/chat" : "/")}
              className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <h1 className="text-xl font-semibold">Joining server…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Checking your invitation.</p>
          </>
        )}
      </section>
    </main>
  );
}
