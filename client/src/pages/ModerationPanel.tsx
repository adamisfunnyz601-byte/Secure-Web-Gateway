import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Shield, Search, Ban, VolumeX, Volume2, UserX, AlertTriangle, RefreshCw, Clock3 } from "lucide-react";

const allModerationCommands = [
  "ban","unban","kick","mute","unmute","timeout","untimeout","warn","warnings","clearwarnings",
  "softban","tempban","permban","shadowban","unshadowban","jail","unjail","deafen","undeafen",
  "freeze","unfreeze","slowmode","slowmodeoff","lock","unlock","lockdown","unlockdown","purge",
  "purgeuser","purgebots","clear","slowchat","unslowchat","note","notes","clearnotes","strike",
  "strikes","clearstrikes","report","reports","resolve","role","promote","demote","nickreset",
  "restrict","unrestrict","unkick"
] as const;

const actions = [
  { id: "mute", label: "Mute", icon: VolumeX, timed: true },
  { id: "unmute", label: "Unmute", icon: Volume2 },
  { id: "ban", label: "Ban", icon: Ban, timed: true },
  { id: "unban", label: "Unban", icon: RefreshCw },
  { id: "kick", label: "Kick", icon: UserX },
  { id: "warn", label: "Warn", icon: AlertTriangle },
  { id: "timeout", label: "Timeout", icon: Clock3, timed: true },
  { id: "untimeout", label: "Remove timeout", icon: RefreshCw },
] as const;

export default function ModerationPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState("");
  const [duration, setDuration] = useState("1h");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [advancedCommand, setAdvancedCommand] = useState("warn");
  const [advancedArgs, setAdvancedArgs] = useState("");
  const role = String(user?.role || "").toLowerCase().replace(/_/g, "-");
  const staff = ["owner","admin","trial-admin","moderator","trial-moderator","helper","trial-helper"].includes(role);
  const { data: users = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/moderation/users"],
    queryFn: async () => { const r = await fetch("/api/moderation/users", { credentials: "same-origin" }); if (!r.ok) throw new Error((await r.json().catch(()=>({}))).message || "Could not load members"); return r.json(); },
    enabled: staff,
  });
  const visible = useMemo(() => users.filter((u:any) => {
    const q = search.trim().toLowerCase();
    return !q || [u.username,u.displayName,u.nickname,String(u.id)].some(v => String(v || "").toLowerCase().includes(q));
  }), [users, search]);
  const target = users.find((u:any) => String(u.id) === targetId);
  const protectedTarget = target && String(target.role).toLowerCase() === "owner";

  const runAdvancedCommand = async () => {
    const commandText = "/" + advancedCommand + (advancedArgs.trim() ? " " + advancedArgs.trim() : "");
    setBusy(true);
    try {
      const response = await fetch("/api/chat/command", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: commandText }) });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.message || "Command failed");
      toast({ title: "Command completed", description: data.message || commandText });
      setAdvancedArgs("");
      await refetch();
    } catch (e:any) { toast({ title: "Command failed", description: e.message || "Try again.", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const runAction = async (action: string, timed = false) => {
    if (!target) { toast({ title: "Choose a member first", variant: "destructive" }); return; }
    if (protectedTarget) { toast({ title: "Owner is protected", description: "The owner cannot be moderated.", variant: "destructive" }); return; }
    if (timed && !/^(?:[1-9]\d*)(?:m|min|mins|h|hr|hrs|d|day|days|w|wk|wks|mo|y)$/i.test(duration.trim()) && duration.trim() !== "null") {
      toast({ title: "Invalid duration", description: "Use values like 15m, 1h, 2d, 1w or null.", variant: "destructive" }); return;
    }
    setBusy(true);
    try {
      const args = [target.username, ...(timed ? [duration.trim()] : []), ...(reason.trim() ? [reason.trim()] : [])];
      const response = await fetch("/api/chat/command", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "/" + action + " " + args.join(" ") }) });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.message || "Moderation action failed");
      toast({ title: action.charAt(0).toUpperCase()+action.slice(1)+" completed", description: data.message || "Action recorded." });
      setReason("");
      await refetch();
    } catch (e:any) { toast({ title: "Action failed", description: e.message || "Try again.", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  if (!staff) return <Layout><div className="mx-auto max-w-xl rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"><Shield className="mx-auto mb-3 h-10 w-10 text-destructive"/><h1 className="text-xl font-bold">Staff access required</h1><p className="mt-2 text-sm text-muted-foreground">This panel is available to authorised staff only.</p></div></Layout>;

  return <Layout>
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><Shield className="h-6 w-6 text-primary"/><h1 className="text-2xl font-black">Moderation Panel</h1></div><p className="mt-1 text-sm text-muted-foreground">Staff tools · Actions are checked and logged by the server.</p></div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase text-primary">{role.replace(/-/g," ")}</span>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-xl border border-border bg-card/70 p-4">
          <div className="relative mb-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search members by username or ID…" className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"/></div>
          {isLoading ? <p className="p-5 text-sm text-muted-foreground">Loading members…</p> : <div className="max-h-[620px] space-y-1 overflow-y-auto">{visible.map((member:any)=><button key={member.id} onClick={()=>setTargetId(String(member.id))} className={"flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition "+(targetId===String(member.id)?"border-primary/50 bg-primary/10":"border-transparent hover:border-border hover:bg-secondary/50")}><span className="min-w-0"><span className="block truncate text-sm font-semibold">{member.displayName || member.nickname || member.username}</span><span className="block text-xs text-muted-foreground">@{member.username} · #{member.id}</span></span><span className="ml-2 shrink-0 text-[10px] font-bold uppercase text-muted-foreground">{String(member.role).replace(/-/g," ")}</span></button>)}</div>}
        </section>
        <section className="space-y-4 rounded-xl border border-border bg-card/70 p-4">
          <div><h2 className="font-bold">Member actions</h2><p className="mt-1 text-xs text-muted-foreground">{target ? "Selected: @"+target.username : "Select a member from the list."}</p></div>
          <label className="block text-xs font-medium text-muted-foreground">Duration (for timed actions)<input value={duration} onChange={e=>setDuration(e.target.value)} placeholder="1h, 30m, 2d…" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"/></label>
          <label className="block text-xs font-medium text-muted-foreground">Reason (optional)<textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} maxLength={240} placeholder="Reason for this action…" className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"/></label>
          {protectedTarget && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">Owner accounts are protected from moderation.</p>}
          <div className="grid grid-cols-2 gap-2">{actions.map(a=><button key={a.id} disabled={busy || !target || !!protectedTarget} onClick={()=>runAction(a.id, "timed" in a && Boolean(a.timed))} className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-2 py-2.5 text-xs font-semibold transition hover:border-primary/50 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"><a.icon className="h-4 w-4"/>{a.label}</button>)}</div>
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-bold">All moderation commands</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">Run any supported command here. The server validates arguments and permissions.</p>
            <select value={advancedCommand} onChange={e=>setAdvancedCommand(e.target.value)} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground">
              {allModerationCommands.map(name=><option key={name} value={name}>/{name}</option>)}
            </select>
            <input value={advancedArgs} onChange={e=>setAdvancedArgs(e.target.value)} onKeyDown={e=>{if(e.key==="Enter") runAdvancedCommand();}} placeholder="Arguments: @username 1h reason…" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"/>
            <button disabled={busy} onClick={runAdvancedCommand} className="mt-2 w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">{busy ? "Running…" : "Run selected command"}</button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">Your role permissions and the target's role are verified on the server. A failed permission check will not apply the action.</p>
        </section>
      </div>
    </div>
  </Layout>;
}
