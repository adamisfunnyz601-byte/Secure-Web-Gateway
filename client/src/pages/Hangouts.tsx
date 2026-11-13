import { useCallback, useEffect, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, DoorOpen, Users, Send, Plus, RefreshCw, MessageCircle, Gamepad2, Sparkles } from "lucide-react";

type Player = { id:number; username:string; x:number; y:number; color:string; direction:string };
type Room = { id:string; name:string; theme:string; players:Player[]; messages:{id:string;username:string;text:string;createdAt:number}[] };
const themes = [
  {id:"plaza",name:"Neon Plaza",description:"A lively city square with glowing paths.",emoji:"🌆"},
  {id:"beach",name:"Pixel Beach",description:"Relax by the water and hang out.",emoji:"🏖️"},
  {id:"forest",name:"Mushroom Forest",description:"A cosy woodland clearing.",emoji:"🌳"},
  {id:"arcade",name:"Arcade Lounge",description:"Meet up around the game machines.",emoji:"🕹️"},
];
const palette=["#a78bfa","#38bdf8","#f472b6","#34d399","#fbbf24","#fb7185","#c084fc","#2dd4bf"];

export default function Hangouts(){
  const {user}=useAuth();
  const [rooms,setRooms]=useState<Room[]>([]);
  const [room,setRoom]=useState<Room|null>(null);
  const [selectedTheme,setSelectedTheme]=useState("plaza");
  const [roomName,setRoomName]=useState("");
  const [draft,setDraft]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [position,setPosition]=useState({x:48,y:52});
  const lastMove=useRef(0);
  const playerId=Number(user?.id||0);
  const refreshRooms=useCallback(async()=>{
    try{const response=await fetch("/api/hangouts/rooms");if(response.ok)setRooms(await response.json());}catch{}
  },[]);
  const enterRoom=useCallback(async(id:string)=>{
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/hangouts/join",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roomId:id})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||"Could not join room.");
      setRoom(data);setPosition({x:48,y:52});
    }catch(e:any){setError(e.message||"Could not join room.");}
    finally{setBusy(false);}
  },[]);
  const createRoom=async()=>{
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/hangouts/create",{
        method:"POST",
        credentials:"include",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({name:roomName.trim(),theme:selectedTheme})
      });
      const contentType=response.headers.get("content-type")||"";
      const body=await response.text();
      if(!contentType.toLowerCase().includes("application/json")){
        const preview=body.replace(/\\s+/g," ").slice(0,140);
        throw new Error(
          `Hangouts API returned HTML/non-JSON (HTTP ${response.status}). This usually means the Replit server is running an older backend or the API route is not mounted. Response: ${preview||"(empty response)"}`
        );
      }
      let data:any;
      try{data=JSON.parse(body);}catch{
        throw new Error(`Hangouts API returned invalid JSON (HTTP ${response.status}).`);
      }
      if(!response.ok)throw new Error(data.message||`Could not create room (HTTP ${response.status}).`);
      if(!data||typeof data.id!=="string"||!Array.isArray(data.players)){
        throw new Error("The server response was missing room details. Restart the Replit server and try again.");
      }
      setRoom(data);setRoomName("");
    }catch(e:any){setError(e.message||"Could not create room.");}
    finally{setBusy(false);}
  };
  const leaveRoom=useCallback(async()=>{
    if(!room)return;
    await fetch("/api/hangouts/leave",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roomId:room.id})}).catch(()=>{});
    setRoom(null);setDraft("");refreshRooms();
  },[room,refreshRooms]);
  const move=useCallback((dx:number,dy:number)=>{
    setPosition(current=>({x:Math.max(5,Math.min(95,current.x+dx)),y:Math.max(10,Math.min(90,current.y+dy))}));
  },[]);
  useEffect(()=>{
    if(!room)return;
    const onKey=(event:KeyboardEvent)=>{
      if(["INPUT","TEXTAREA"].includes((event.target as HTMLElement)?.tagName))return;
      const keys:Record<string,[number,number]>={ArrowUp:[0,-3],w:[0,-3],ArrowDown:[0,3],s:[0,3],ArrowLeft:[-3,0],a:[-3,0],ArrowRight:[3,0],d:[3,0]};
      const delta=keys[event.key];if(delta){event.preventDefault();move(delta[0],delta[1]);}
    };
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  },[room,move]);
  useEffect(()=>{
    if(!room)return;
    const sync=async()=>{
      try{
        const [stateResponse]=await Promise.all([fetch("/api/hangouts/state?roomId="+encodeURIComponent(room.id))]);
        if(!stateResponse.ok){setRoom(null);setError("This room has closed.");return;}
        const state=await stateResponse.json();setRoom(state);
      }catch{}
    };
    sync();const id=window.setInterval(sync,900);return()=>window.clearInterval(id);
  },[room?.id]);
  useEffect(()=>{
    if(!room)return;
    const send=async()=>{
      const now=Date.now();if(now-lastMove.current<120)return;lastMove.current=now;
      fetch("/api/hangouts/move",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roomId:room.id,x:position.x,y:position.y})}).catch(()=>{});
    };
    send();
  },[position,room?.id]);
  useEffect(()=>{refreshRooms();const id=window.setInterval(refreshRooms,2500);return()=>window.clearInterval(id);},[refreshRooms]);
  useEffect(()=>{
    const roomId=room?.id;
    if(!roomId)return;
    return ()=>{fetch("/api/hangouts/leave",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roomId})}).catch(()=>{});};
  },[room?.id]);
  const sendMessage=async()=>{
    const text=draft.trim();if(!text||!room)return;
    setDraft("");
    const response=await fetch("/api/hangouts/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roomId:room.id,text})});
    if(!response.ok){const data=await response.json().catch(()=>({}));setError(data.message||"Message could not be sent.");}
  };
  const currentTheme=themes.find(item=>item.id===room?.theme)||themes[0];
  return <Layout><div className="mx-auto max-w-7xl space-y-5">
    <header className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950 via-slate-950 to-cyan-950 p-5 md:p-7">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-violet-300"><Gamepad2 className="h-4 w-4"/> NEXUS SOCIAL WORLDS</div>
      <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">Hang out together.</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">Explore little 2D rooms, meet other players and chat in real time. Works with keyboard, touch controls and mobile screens.</p>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300"><span className="flex items-center gap-1"><Users className="h-4 w-4"/> Up to 16 players per room</span><span className="flex items-center gap-1"><MessageCircle className="h-4 w-4"/> Room chat</span><span className="flex items-center gap-1"><Sparkles className="h-4 w-4"/> Four themed maps</span></div>
    </header>
    {error&&<div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
    {!room?<div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-bold text-foreground">Create a room</h2><p className="mb-4 text-xs text-muted-foreground">Start a hangout and invite friends to join.</p>
        <label className="mb-1 block text-xs text-muted-foreground">Room name</label><input maxLength={32} value={roomName} onChange={e=>setRoomName(e.target.value)} placeholder="e.g. Friday night hangout" className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"/>
        <label className="mb-2 block text-xs text-muted-foreground">Choose your map</label>
        <div className="grid grid-cols-2 gap-2">{themes.map(theme=><button key={theme.id} onClick={()=>setSelectedTheme(theme.id)} className={"rounded-lg border p-3 text-left "+(selectedTheme===theme.id?"border-primary bg-primary/10":"border-border bg-background")}><span className="text-2xl">{theme.emoji}</span><span className="mt-1 block text-sm font-semibold text-foreground">{theme.name}</span><span className="block text-[11px] text-muted-foreground">{theme.description}</span></button>)}</div>
        <button disabled={busy} onClick={createRoom} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4"/> Create hangout</button>
      </section>
      <section className="rounded-xl border border-border bg-card p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold text-foreground">Open hangouts</h2><p className="text-xs text-muted-foreground">Rooms update automatically.</p></div><button onClick={refreshRooms} className="rounded-md border border-border p-2 text-foreground" aria-label="Refresh rooms"><RefreshCw className="h-4 w-4"/></button></div>
        <div className="space-y-2">{rooms.map(item=><div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"><span className="text-2xl">{themes.find(t=>t.id===item.theme)?.emoji||"🌐"}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{item.name}</p><p className="text-xs text-muted-foreground">{item.players.length}/16 players · {themes.find(t=>t.id===item.theme)?.name}</p></div><button disabled={busy||item.players.length>=16} onClick={()=>enterRoom(item.id)} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40">Join</button></div>)}{!rooms.length&&<div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No open rooms yet. Create the first one!</div>}</div>
      </section>
    </div>:<div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border p-3"><div className="min-w-0"><h2 className="truncate font-bold text-foreground">{room.name}</h2><p className="text-xs text-muted-foreground">{currentTheme.name} · {room.players.length} here</p></div><button onClick={leaveRoom} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-foreground"><DoorOpen className="h-4 w-4"/> Leave</button></div>
        <div className={"relative h-[min(62vh,560px)] min-h-[300px] touch-none overflow-hidden "+(room.theme==="beach"?"bg-gradient-to-b from-sky-300 via-cyan-200 to-amber-200":room.theme==="forest"?"bg-gradient-to-b from-emerald-950 via-green-800 to-lime-900":room.theme==="arcade"?"bg-gradient-to-b from-fuchsia-950 via-indigo-950 to-slate-950":"bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950")}>
          <div className="pointer-events-none absolute inset-0 opacity-30" style={{backgroundImage:"radial-gradient(circle, rgba(255,255,255,.55) 1px, transparent 1.5px)",backgroundSize:"28px 28px"}}/>
          <div className="pointer-events-none absolute left-[8%] top-[12%] h-16 w-24 rounded-xl border-4 border-white/15 bg-white/10"/><div className="pointer-events-none absolute bottom-[12%] right-[9%] h-20 w-28 rounded-full border-4 border-white/15 bg-white/10"/>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/10"/>
          {room.players.map(player=><div key={player.id} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-100" style={{left:player.id===playerId?position.x+"%":player.x+"%",top:player.id===playerId?position.y+"%":player.y+"%"}}><div className="flex flex-col items-center"><div className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-white/80 text-lg shadow-lg" style={{background:player.color}}>🧑</div><span className="mt-1 max-w-24 truncate rounded bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white">{player.username}{player.id===playerId?" (you)":""}</span></div></div>)}
          <div className="absolute bottom-3 left-3 rounded-lg bg-black/40 px-3 py-2 text-[10px] text-white/80">PC: WASD / arrow keys · Mobile: use the pad</div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3"><div className="text-xs text-muted-foreground">Move around to explore the room.</div><div className="grid grid-cols-3 gap-1 md:hidden"><span/><button onClick={()=>move(0,-5)} className="rounded-lg border border-border bg-background p-3 text-foreground"><ArrowUp className="h-5 w-5"/></button><span/><button onClick={()=>move(-5,0)} className="rounded-lg border border-border bg-background p-3 text-foreground"><ArrowLeft className="h-5 w-5"/></button><button onClick={()=>move(0,5)} className="rounded-lg border border-border bg-background p-3 text-foreground"><ArrowDown className="h-5 w-5"/></button><button onClick={()=>move(5,0)} className="rounded-lg border border-border bg-background p-3 text-foreground"><ArrowRight className="h-5 w-5"/></button></div></div>
      </section>
      <aside className="flex min-h-[360px] flex-col rounded-xl border border-border bg-card p-3"><h3 className="mb-2 flex items-center gap-2 font-bold text-foreground"><MessageCircle className="h-4 w-4"/> Room chat</h3><div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-lg bg-background p-3">{room.messages.map(message=><div key={message.id} className="text-xs"><span className="font-bold text-primary">{message.username}: </span><span className="break-words text-foreground">{message.text}</span></div>)}{!room.messages.length&&<p className="text-xs text-muted-foreground">Say hello to everyone!</p>}</div><form onSubmit={e=>{e.preventDefault();sendMessage();}} className="flex gap-2"><input maxLength={240} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Say something..." className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"/><button disabled={!draft.trim()} className="rounded-md bg-primary px-3 text-primary-foreground disabled:opacity-40"><Send className="h-4 w-4"/></button></form></aside>
    </div>}
    <p className="text-center text-[11px] text-muted-foreground">Room movement and chat are shared with other connected users. Rooms are temporary and reset if the server restarts.</p>
  </div></Layout>;
}
