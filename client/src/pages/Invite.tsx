import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck, XCircle, Users } from "lucide-react";
import { CyberButton } from "@/components/CyberButton";
import { useAuth } from "@/hooks/use-auth";

type InviteInfo = { valid: boolean; type?: string; durationMinutes?: number | null; groupName?: string; message?: string };

export default function Invite({ code }: { code: string }) {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setInfo(null);
    fetch(`/api/invites/${encodeURIComponent(code)}`, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "This invitation could not be checked.");
        return data as InviteInfo;
      })
      .then(data => { if (active) setInfo(data); })
      .catch(error => { if (active) setInfo({ valid: false, message: error.message }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code]);

  const inviteUrl = typeof window !== "undefined" ? window.location.href : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  };

  const accept = async () => {
    setActionError("");
    if (info?.type === "group") {
      if (!user) {
        setLocation(`/?invite=${encodeURIComponent(code)}`);
        return;
      }
      setAccepting(true);
      try {
        const response = await fetch("/api/chat/groups/join", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ inviteCode: code.toUpperCase() }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || (response.status === 401 ? "Please sign in before joining this group." : "Could not join this group."));
        setLocation("/chat");
      } catch (error: any) {
        setActionError(error.message || "Could not join this group.");
      } finally { setAccepting(false); }
      return;
    }
    setLocation(`/signup?key=${encodeURIComponent(code)}`);
  };

  const isGroup = info?.type === "group";
  return (
    <main className="nexus-auth-screen min-h-screen flex items-center justify-center p-5 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 15%, hsl(261 42% 23% / .55), transparent 55%), linear-gradient(135deg,hsl(228 10% 9%),hsl(250 20% 11%),hsl(228 10% 8%))" }}>
      <div className="absolute inset-0 opacity-[.12] pointer-events-none" style={{ backgroundImage: "linear-gradient(hsl(255 255 255 / .12) 1px,transparent 1px),linear-gradient(90deg,hsl(255 255 255 / .12) 1px,transparent 1px)", backgroundSize: "36px 36px" }} />
      <section className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[hsl(225_9%_14%/0.92)] shadow-2xl backdrop-blur-xl p-7 sm:p-9">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-primary" /></div>
          <div><div className="font-bold tracking-wide text-foreground">NEXUS</div><div className="text-[10px] text-muted-foreground tracking-[.22em]">SECURE WEB GATEWAY</div></div>
        </div>
        <div className="text-center py-3">
          <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center shadow-[0_0_40px_hsl(var(--primary)/.15)]">
            {loading || authLoading || accepting ? <Loader2 className="w-8 h-8 text-primary animate-spin" /> : info?.valid ? (isGroup ? <Users className="w-8 h-8 text-emerald-400" /> : <CheckCircle2 className="w-8 h-8 text-emerald-400" />) : <XCircle className="w-8 h-8 text-rose-400" />}
          </div>
          <p className="text-[10px] font-semibold tracking-[.24em] text-primary uppercase mb-2">Invitation portal</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{loading ? "Checking invitation…" : info?.valid ? (isGroup ? "You're invited to a group." : "You're invited.") : "Invitation unavailable"}</h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {loading ? "Verifying this invitation with the server." : info?.valid ? (isGroup ? `Join ${info.groupName || "this group"} and start chatting with its members.` : "An invitation has been created for you. Continue to set up your Secure Web Gateway account.") : info?.message || "This invite link is invalid or no longer available."}
          </p>
          {actionError && <p role="alert" className="mt-3 text-sm text-rose-300">{actionError}</p>}
        </div>
        <div className="mt-6 rounded-xl border border-border bg-black/20 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><KeyRound className="w-3.5 h-3.5" /> INVITATION CODE</div>
          <div className="font-mono text-sm text-primary break-all select-all">{code}</div>
          {info?.valid && <div className="text-[11px] text-muted-foreground mt-2">{isGroup ? `Group: ${info.groupName || "Group chat"}` : info.type === "limited" ? `Access duration: ${info.durationMinutes || "—"} minutes` : "Permanent access key"}</div>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          <CyberButton className="w-full" disabled={loading || authLoading || accepting || !info?.valid} onClick={accept}>
            {accepting ? "Joining…" : isGroup && !user ? "Sign in to join" : isGroup ? "Join group" : "Accept invitation"} <ArrowRight className="w-4 h-4 ml-1" />
          </CyberButton>
          <CyberButton variant="ghost" className="w-full" onClick={copy}>
            <Copy className="w-4 h-4 mr-1" /> {copied ? "Copied!" : "Copy invite link"}
          </CyberButton>
        </div>
        <p className="text-center text-[11px] text-muted-foreground/60 mt-7">Only share this invitation with someone you trust.</p>
      </section>
    </main>
  );
}
