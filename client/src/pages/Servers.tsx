import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Server, Hash, Volume2, Users, Copy, LogIn, Settings2, Trash2, ChevronDown } from "lucide-react";

type ServerSummary = { id:number; name:string; description:string; visibility:string; inviteCode:string; ownerId:number; role:string|null };
type ServerDetail = { server:any; member:any; categories:any[]; channels:any[]; members:any[] };

export default function ServersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number|null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [serverName, setServerName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [inviteCode, setInviteCode] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState("text");
  const [categoryName, setCategoryName] = useState("");
  const [showManage, setShowManage] = useState(false);

  const serversQuery = useQuery<ServerSummary[]>({
    queryKey:["/api/servers"],
    queryFn:async()=>{const r=await fetch("/api/servers",{credentials:"include"});if(!r.ok)throw new Error("Could not load servers");return r.json();},
  });
  const servers=serversQuery.data||[];
  useEffect(()=>{if(selectedId===null&&servers.length)setSelectedId(servers[0].id);if(selectedId!==null&&!servers.some(s=>s.id===selectedId))setSelectedId(servers[0]?.id??null);},[servers,selectedId]);
  const detailQuery=useQuery<ServerDetail>({
    queryKey:["/api/servers",selectedId],
    enabled:selectedId!==null,
    queryFn:async()=>{const r=await fetch(`/api/servers/${selectedId}`,{credentials:"include"});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||"Could not load server");return d;},
  });
  const detail=detailQuery.data;
  const refresh=async()=>{await queryClient.invalidateQueries({queryKey:["/api/servers"]});if(selectedId)await queryClient.invalidateQueries({queryKey:["/api/servers",selectedId]});};
  const request=async(url:string,method:string,body?:any)=>{
    const r=await fetch(url,{method,credentials:"include",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.message||"Request failed");
    return d;
  };
  const run=async(fn:()=>Promise<any>,success:string)=>{try{await fn();toast({title:success});await refresh();}catch(e:any){toast({title:"Couldn't complete that",description:e.message,variant:"destructive"});}};
  const createServer=()=>run(async()=>{const d=await request("/api/servers","POST",{name:serverName,description,visibility});setServerName("");setDescription("");setCreateOpen(false);setSelectedId(d.id);}, "Server created");
  const joinServer=()=>run(async()=>{const d=await request("/api/servers/join","POST",{inviteCode});setInviteCode("");setSelectedId(d.serverId);}, "Joined server");
  const addChannel=()=>run(async()=>{await request(`/api/servers/${selectedId}/channels`,"POST",{name:channelName,type:channelType,categoryId:detail?.categories?.[0]?.id??null});setChannelName("");}, "Channel created");
  const addCategory=()=>run(async()=>{await request(`/api/servers/${selectedId}/categories`,"POST",{name:categoryName});setCategoryName("");}, "Category created");
  const isManager=detail?.member&&["owner","admin"].includes(detail.member.role);
  const copyInvite=async()=>{try{await navigator.clipboard.writeText(detail.server.inviteCode);toast({title:"Invite code copied"});}catch{toast({title:"Copy failed",description:detail.server.inviteCode});}};
  return <Layout>
    <div className="nexus-page nexus-page-servers mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="text-xs uppercase tracking-[.22em] text-primary font-semibold">Community network</div><h1 className="mt-1 text-3xl font-bold">Servers</h1><p className="mt-1 text-sm text-muted-foreground">Your communities, organised in one place.</p></div>
        <div className="flex gap-2"><button onClick={()=>setCreateOpen(v=>!v)} className="app-interactive inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16}/> Create server</button></div>
      </div>
      {createOpen&&<motion.section initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="app-surface rounded-2xl p-4 md:p-5 space-y-3">
        <h2 className="font-semibold">Create a community</h2><div className="grid gap-3 md:grid-cols-2">
          <input value={serverName} onChange={e=>setServerName(e.target.value)} maxLength={48} placeholder="Server name" className="rounded-xl border border-border bg-background/70 px-3 py-2.5 text-sm"/>
          <select value={visibility} onChange={e=>setVisibility(e.target.value)} className="rounded-xl border border-border bg-background/70 px-3 py-2.5 text-sm"><option value="private">Private — invite only</option><option value="public">Public — discoverable</option></select>
        </div><input value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} placeholder="What is this community about?" className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-sm"/><button onClick={createServer} disabled={serverName.trim().length<2} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Create server</button>
      </motion.section>}
      <section className="app-surface rounded-2xl p-4 md:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><LogIn size={16} className="text-primary"/> Join with an invite code</div>
        <div className="flex gap-2"><input value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} maxLength={10} placeholder="10-character invite code" className="min-w-0 flex-1 rounded-xl border border-border bg-background/70 px-3 py-2.5 text-sm font-mono tracking-wider"/><button onClick={joinServer} disabled={inviteCode.trim().length!==10} className="rounded-xl border border-primary/40 px-4 text-sm font-semibold text-primary disabled:opacity-40">Join</button></div>
      </section>
      <div className="grid min-h-[460px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="app-surface rounded-2xl p-3">
          <div className="mb-3 flex items-center justify-between px-2"><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your servers</span><span className="text-xs text-muted-foreground">{servers.length}</span></div>
          {serversQuery.isLoading?<p className="p-3 text-sm text-muted-foreground">Loading communities…</p>:servers.length===0?<p className="p-3 text-sm text-muted-foreground">No servers yet. Create one or join with an invite.</p>:<div className="space-y-1">{servers.map(s=><button key={s.id} onClick={()=>setSelectedId(s.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${selectedId===s.id?"bg-primary/15 text-primary":"hover:bg-white/5"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15"><Server size={17}/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{s.name}</span><span className="block text-xs text-muted-foreground">{s.role||"Public"} · {s.visibility}</span></span></button>)}</div>}
        </aside>
        <main className="app-surface min-w-0 rounded-2xl p-4 md:p-6">
          {!selectedId||!detail?<div className="grid min-h-[360px] place-items-center text-center text-muted-foreground"><div><Server size={34} className="mx-auto mb-3 opacity-40"/><p>Select a server to open its channels</p></div></div>:<>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
              <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-2xl font-bold">{detail.server.name}</h2><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-wider text-primary">{detail.server.visibility}</span></div><p className="mt-1 text-sm text-muted-foreground">{detail.server.description||"A new community starts here."}</p></div>
              <div className="flex gap-2"><button onClick={copyInvite} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-white/5"><Copy size={14}/> Invite code</button>{!detail.member&&detail.server.visibility==="public"&&<button onClick={()=>run(async()=>{await request(`/api/servers/${selectedId}/join`,"POST");}, "Joined server")} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">Join server</button>}{isManager&&<button onClick={()=>setShowManage(v=>!v)} className="rounded-lg border border-border p-2 hover:bg-white/5" title="Manage server"><Settings2 size={16}/></button>}</div>
            </div>
            {showManage&&isManager&&<div className="my-4 grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 md:grid-cols-2"><div className="space-y-2"><p className="text-xs font-semibold">Add category</p><div className="flex gap-2"><input value={categoryName} onChange={e=>setCategoryName(e.target.value)} placeholder="Category name" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-sm"/><button onClick={addCategory} className="rounded-lg bg-primary px-3 text-xs text-white">Add</button></div></div><div className="space-y-2"><p className="text-xs font-semibold">Add channel</p><div className="flex gap-2"><input value={channelName} onChange={e=>setChannelName(e.target.value)} placeholder="channel-name" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-sm"/><select value={channelType} onChange={e=>setChannelType(e.target.value)} className="max-w-28 rounded-lg border border-border bg-background px-2 text-xs"><option value="text">Text</option><option value="voice">Voice</option><option value="announcement">Announcement</option><option value="forum">Forum</option><option value="media">Media</option></select><button onClick={addChannel} className="rounded-lg bg-primary px-3 text-xs text-white">Add</button></div></div></div>}
            <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-5">{detail.categories.map(category=><section key={category.id}><h3 className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-muted-foreground">{category.name}</h3><div className="space-y-1">{detail.channels.filter(c=>c.categoryId===category.id).map(channel=><div key={channel.id} className="flex items-center gap-2 rounded-lg px-3 py-2.5 hover:bg-white/5"><span className="text-primary/80">{channel.type==="voice"?<Volume2 size={16}/>:<Hash size={16}/>}</span><span className="text-sm">{channel.name}</span><span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">{channel.type}</span></div>)}</div></section>)}{detail.channels.filter(c=>!c.categoryId).map(channel=><div key={channel.id} className="flex items-center gap-2 rounded-lg px-3 py-2"><Hash size={15}/>{channel.name}</div>)}</div>
              <aside className="rounded-xl bg-background/40 p-3"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Users size={14}/> Members · {detail.members.length}</div><div className="space-y-2">{detail.members.slice(0,30).map(m=><div key={m.userId} className="flex items-center gap-2 text-sm"><span className={`h-2 w-2 rounded-full ${m.presenceStatus==="online"?"bg-emerald-400":m.presenceStatus==="idle"?"bg-amber-300":"bg-slate-500"}`}/><span className="min-w-0 flex-1 truncate">{m.username}</span><span className="text-[9px] uppercase text-muted-foreground">{m.role}</span></div>)}</div></aside>
            </div>
          </>}
        </main>
      </div>
    </div>
  </Layout>;
}
