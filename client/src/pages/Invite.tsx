import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { CyberButton } from "@/components/CyberButton";

type InviteInfo = { valid: boolean; type?: string; durationMinutes?: number | null; message?: string };

export default function Invite({ code }: { code: string }) {
  const [, setLocation] = useLocation();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/invites/${encodeURIComponent(code)}`, { credentials: "same-origin" })
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
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-5 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 15%, hsl(261 42% 23% / .55), transparent 55%), linear-gradient(135deg,hsl(228 10% 9%),hsl(250 20% 11%),hsl(228 10% 8%))" }}>
      <div className="absolute inset-0 opacity-[.12] pointer-events-none" style={{ backgroundImage: "linear-gradient(hsl(255 255 255 / .12) 1px,transparent 1px),linear-gradient(90deg,hsl(255 255 255 / .12) 1px,transparent 1px)", backgroundSize: "36px 36px" }} />
      <section className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[hsl(225_9%_14%/0.92)] shadow-2xl backdrop-blur-xl p-7 sm:p-9">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-primary" /></div>
          <div><div className="font-bold tracking-wide text-foreground">NEXUS</div><div className="text-[10px] text-muted-foreground tracking-[.22em]">SECURE WEB GATEWAY</div></div>
        </div>
        <div className="text-center py-3">
          <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center shadow-[0_0_40px_hsl(var(--primary)/.15)]">
            {loading ? <Loader2 className="w-8 h-8 text-primary animate-spin" /> : info?.valid ? <CheckCircle2 className="w-8 h-8 text-emerald-400" /> : <XCircle className="w-8 h-8 text-rose-400" />}
          </div>
          <p className="text-[10px] font-semibold tracking-[.24em] text-primary uppercase mb-2">Invitation portal</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{loading ? "Checking invitation…" : info?.valid ? "You're invited." : "Invitation unavailable"}</h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {loading ? "Verifying this invitation with the server." : info?.valid ? "An invitation has been created for you. Continue to set up your Secure Web Gateway account." : info?.message || "This invite link is invalid or no longer available."}
          </p>
        </div>
        <div className="mt-6 rounded-xl border border-border bg-black/20 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><KeyRound className="w-3.5 h-3.5" /> INVITATION CODE</div>
          <div className="font-mono text-sm text-primary break-all select-all">{code}</div>
          {info?.valid && <div className="text-[11px] text-muted-foreground mt-2">{info.type === "limited" ? `Access duration: ${info.durationMinutes || "—"} minutes` : "Permanent access key"}</div>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          <CyberButton className="w-full" disabled={loading || !info?.valid} onClick={() => setLocation(`/signup?key=${encodeURIComponent(code)}`)}>
            Accept invitation <ArrowRight className="w-4 h-4 ml-1" />
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
