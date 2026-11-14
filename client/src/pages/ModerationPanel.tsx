import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Shield, Search, Ban, VolumeX, Volume2, UserX, AlertTriangle, RefreshCw, Clock3, Upload, Sparkles, Play } from "lucide-react";

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
  const [coinAmount, setCoinAmount] = useState("100");
  const [coinBusy, setCoinBusy] = useState(false);
  const [emoteName, setEmoteName] = useState("");
  const [emoteDescription, setEmoteDescription] = useState("");
  const [emotePrice, setEmotePrice] = useState("100");
  const [emoteGif, setEmoteGif] = useState("");
  const [emoteAudio, setEmoteAudio] = useState("");
  const [emoteDuration, setEmoteDuration] = useState(0);
  const [emoteBusy, setEmoteBusy] = useState(false);
  const emoteGifInput = useRef<HTMLInputElement>(null);
  const emoteAudioInput = useRef<HTMLInputElement>(null);
  const readEmoteFile = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
  const handleEmoteGif = async (file?: File) => {
    if (!file) return;
    if (file.type !== "image/gif" && !file.name.toLowerCase().endsWith(".gif")) {
      toast({ title: "GIF required", description: "Emote artwork must be a GIF.", variant: "destructive" }); return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "GIF too large", description: "Maximum GIF size is 3 MB.", variant: "destructive" }); return;
    }
    try { setEmoteGif(await readEmoteFile(file)); }
    catch (error:any) { toast({ title: "GIF upload failed", description: error.message, variant: "destructive" }); }
  };
  const handleEmoteAudio = async (file?: File) => {
    if (!file) return;
    if (file.type !== "audio/mpeg" && !file.name.toLowerCase().endsWith(".mp3")) {
      toast({ title: "MP3 required", variant: "destructive" }); return;
    }
    if (file.size > 1.4 * 1024 * 1024) {
      toast({ title: "MP3 too large", description: "Maximum MP3 size is 1.4 MB.", variant: "destructive" }); return;
    }
    setEmoteAudio(""); setEmoteDuration(0);
    try {
      const data = await readEmoteFile(file);
      const objectUrl = URL.createObjectURL(file);
      const audio = new Audio(); audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        if (!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.duration > 20) {
          toast({ title: "MP3 must be 20 seconds or shorter", variant: "destructive" }); return;
        }
        setEmoteDuration(audio.duration); setEmoteAudio(data);
      };
      audio.onerror = () => { URL.revokeObjectURL(objectUrl); toast({ title: "Could not read MP3 duration", variant: "destructive" }); };
      audio.src = objectUrl;
    } catch (error:any) { toast({ title: "MP3 upload failed", description: error.message, variant: "destructive" }); }
  };
  const publishEmote = async () => {
    const price = Number(emotePrice);
    if (!emoteName.trim() || !emoteGif || !emoteAudio || emoteDuration <= 0 || emoteDuration > 20 ||
        !Number.isSafeInteger(price) || price < 0 || price > 100000) {
      toast({ title: "Complete the emote details", description: "Add a name, GIF, MP3 (up to 20 seconds), and valid price.", variant: "destructive" }); return;
    }
    setEmoteBusy(true);
    try {
      const response = await fetch("/api/shop/create", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: emoteName.trim(), description: emoteDescription, type: "emote", price, imageUrl: emoteGif, cssStyles: { audioUrl: emoteAudio, duration: emoteDuration } })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not publish emote.");
      setEmoteName(""); setEmoteDescription(""); setEmotePrice("100"); setEmoteGif(""); setEmoteAudio(""); setEmoteDuration(0);
      toast({ title: "Emote published!", description: "The GIF + MP3 emote is now listed in the community Shop." });
    } catch (error:any) { toast({ title: "Emote publish failed", description: error.message, variant: "destructive" }); }
    finally { setEmoteBusy(false); }
  };

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

  const grantDihCoins = async () => {
    if (!target) { toast({ title: "Choose a member first", variant: "destructive" }); return; }
    const amount = Number(coinAmount);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) { toast({ title: "Invalid DihCoins amount", description: "Enter 1–100,000.", variant: "destructive" }); return; }
    setCoinBusy(true);
    try {
      const response = await fetch("/api/admin/dihcoins/grant", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: target.id, amount }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not grant DihCoins.");
      toast({ title: "DihCoins granted", description: "Added " + amount.toLocaleString() + " DihCoins to @" + target.username + "'s balance." });
      setCoinAmount("100");
      await refetch();
    } catch (error:any) { toast({ title: "Grant failed", description: error.message, variant: "destructive" }); }
    finally { setCoinBusy(false); }
  };

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
    <div className="nexus-page nexus-page-admin mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><Shield className="h-6 w-6 text-primary"/><h1 className="text-2xl font-black">Moderation Panel</h1></div><p className="mt-1 text-sm text-muted-foreground">Staff tools · Actions are checked and logged by the server.</p></div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase text-primary">{role.replace(/-/g," ")}</span>
      </div>

      <section className="rounded-xl border border-violet-400/30 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-4">
        <div className="mb-2 flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-300"/><h2 className="text-lg font-bold">Moderator Emote Creator</h2></div>
        <p className="mb-4 text-xs text-muted-foreground">Create community GIF + MP3 emotes. GIFs are limited to 3 MB and MP3 audio to 20 seconds / 1.4 MB.</p>
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">EMOTE NAME<input value={emoteName} onChange={e=>setEmoteName(e.target.value)} maxLength={40} placeholder="e.g. Hype!" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label>
            <label className="block text-xs font-medium text-muted-foreground">DESCRIPTION<textarea value={emoteDescription} onChange={e=>setEmoteDescription(e.target.value)} maxLength={180} rows={2} placeholder="Describe the emote…" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label>
            <label className="block text-xs font-medium text-muted-foreground">SHOP PRICE · DIHCOINS<input type="number" min="0" max="100000" value={emotePrice} onChange={e=>setEmotePrice(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label>
            <div className="flex flex-wrap gap-2">
              <input ref={emoteGifInput} type="file" accept=".gif,image/gif" className="hidden" onChange={e=>handleEmoteGif(e.target.files?.[0])}/>
              <button type="button" onClick={()=>emoteGifInput.current?.click()} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold"><Upload className="h-4 w-4"/> Upload GIF</button>
              <input ref={emoteAudioInput} type="file" accept=".mp3,audio/mpeg" className="hidden" onChange={e=>handleEmoteAudio(e.target.files?.[0])}/>
              <button type="button" onClick={()=>emoteAudioInput.current?.click()} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold"><Upload className="h-4 w-4"/> Upload MP3</button>
            </div>
            <p className="text-xs text-muted-foreground">{emoteAudio ? "MP3 loaded · "+emoteDuration.toFixed(1)+"s · bubble follows audio playback" : "Upload an MP3 of up to 20 seconds. The emote bubble lasts for the audio."}</p>
            <button type="button" disabled={emoteBusy || !emoteGif || !emoteAudio} onClick={publishEmote} className="w-full rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-400 disabled:opacity-40">{emoteBusy ? "Publishing…" : "Publish emote to Shop"}</button>
          </div>
          <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/60 p-4">
            {emoteGif ? <><img src={emoteGif} alt="Emote preview" className="h-28 w-28 object-contain"/><span className="mt-2 text-sm font-bold text-violet-200">{emoteName || "Emote preview"}</span></> : <div className="text-center text-xs text-muted-foreground"><Play className="mx-auto mb-2 h-7 w-7"/>GIF preview appears here</div>}
          </div>
        </div>
      </section>
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
          {["owner","admin"].includes(role) && <div className="border-t border-border pt-4">
            <h3 className="text-sm font-bold text-amber-300">DihCoins wallet</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">Grant currency to the selected member. Only admins and owners can use this.</p>
            <label className="mt-3 block text-xs text-muted-foreground">Amount<input type="number" min="1" max="100000" value={coinAmount} onChange={e=>setCoinAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label>
            <button disabled={coinBusy || !target} onClick={grantDihCoins} className="mt-2 w-full rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 text-sm font-bold text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-40">{coinBusy ? "Granting…" : "Grant DihCoins"}</button>
          </div>}
          <p className="text-[11px] leading-relaxed text-muted-foreground">Your role permissions and the target's role are verified on the server. A failed permission check will not apply the action.</p>
        </section>
      </div>
    </div>
  </Layout>;
}
