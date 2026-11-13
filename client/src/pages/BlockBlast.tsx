import { useCallback, useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Volume2, VolumeX, RotateCcw, Sparkles, MessageCircle, Mic, MicOff, Users, Send, Crown, Zap, Medal } from "lucide-react";

type Cell = [number, number];
type Piece = { cells: Cell[]; color: string; id: string };
type ScoreEntry = { score: number; date: string };
const SIZE = 10;
const COLORS = ["#f5b942", "#fb873f", "#4bd49b", "#5797ff", "#b27aff", "#f16f9c"];
const SHAPES: Cell[][] = [
 [[0,0]], [[0,0],[0,1]], [[0,0],[0,1],[0,2]], [[0,0],[1,0],[2,0]],
 [[0,0],[0,1],[1,0],[1,1]], [[0,0],[0,1],[0,2],[1,0]], [[0,0],[1,0],[2,0],[2,1]],
 [[0,0],[0,1],[0,2],[1,1]], [[0,1],[1,0],[1,1],[1,2]], [[0,0],[1,0],[1,1],[2,1]],
 [[0,1],[1,0],[1,1],[2,0]], [[0,0],[1,0],[2,0],[3,0]], [[0,0],[0,1],[0,2],[0,3]],
 [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]], [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],
 [[0,0],[1,0],[2,0],[3,0],[3,1]], [[0,0],[0,1],[0,2],[1,2],[2,2]],
 [[0,0],[1,0],[1,1],[2,1],[2,2]]
];
const emptyBoard = () => Array.from({length:SIZE},()=>Array(SIZE).fill(""));
const randomPiece = (): Piece => ({ cells: SHAPES[Math.floor(Math.random()*SHAPES.length)], color: COLORS[Math.floor(Math.random()*COLORS.length)], id: crypto.randomUUID() });
const canPlace = (board:string[][], piece:Piece, row:number, col:number) => piece.cells.every(([y,x]) => row+y<SIZE && col+x<SIZE && !board[row+y][col+x]);
const fitExists = (board:string[][], piece:Piece) => { for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(canPlace(board,piece,r,c)) return true; return false; };
const newPieces = () => [randomPiece(),randomPiece(),randomPiece()];
const readHistory = (): ScoreEntry[] => { try { return JSON.parse(localStorage.getItem("bb-score-history") || "[]"); } catch { return []; } };

function PiecePreview({piece,selected,onClick}:{piece:Piece|null;selected:boolean;onClick:()=>void}) {
 if(!piece) return <div className="h-[86px] rounded-xl border border-dashed border-white/10 opacity-30"/>;
 const maxY=Math.max(...piece.cells.map(c=>c[0]))+1, maxX=Math.max(...piece.cells.map(c=>c[1]))+1;
 return <button onClick={onClick} aria-label="Select block piece" className={`h-[86px] rounded-xl border transition-all flex items-center justify-center ${selected?"border-cyan-300/70 bg-cyan-300/10 -translate-y-1 shadow-[0_8px_30px_#22d3ee22]":"border-white/10 bg-white/[.025] hover:bg-white/[.06]"}`}>
  <div style={{display:"grid",gridTemplateColumns:`repeat(${maxX},13px)`,gridTemplateRows:`repeat(${maxY},13px)`,gap:3}}>
   {Array.from({length:maxY},(_,y)=>Array.from({length:maxX},(_,x)=>{const active=piece.cells.some(([cy,cx])=>cy===y&&cx===x);return <span key={y+"-"+x} style={{width:13,height:13,borderRadius:3,background:active?piece.color:"transparent",boxShadow:active?"inset 0 2px 0 #ffffff55,0 2px 5px #0008":"none"}}/>;}))}
  </div>
 </button>;
}

function BlockBlastGame() {
 const { user } = useAuth();
 const { toast } = useToast();
 const { messages: sharedMessages, sendMessage: sendRoomMessage } = useChat();
 const [globalScores,setGlobalScores]=useState<any[]>([]);
 const [board,setBoard]=useState<string[][]>(emptyBoard);
 const [pieces,setPieces]=useState<Piece[]>(newPieces);
 const [selected,setSelected]=useState(0);
 const [score,setScore]=useState(0);
 const [best,setBest]=useState(()=>Number(localStorage.getItem("bb-personal-best")||0));
 const [history,setHistory]=useState<ScoreEntry[]>(readHistory);
 const [streak,setStreak]=useState(0);
 const [combo,setCombo]=useState(1);
 const [gameOver,setGameOver]=useState(false);
 const [sound,setSound]=useState(false);
 const [clearing,setClearing]=useState<number[]>([]);
 const [flash,setFlash]=useState(false);

 const [message,setMessage]=useState("");
 const [roomStatus,setRoomStatus]=useState("Room chat is not connected");
 const [voiceStatus,setVoiceStatus]=useState("Voice signalling is not configured on this server");
 const [voiceJoined,setVoiceJoined]=useState(false);
 const [muted,setMuted]=useState(true);
 const [stream,setStream]=useState<MediaStream|null>(null);

 useEffect(()=>{localStorage.setItem("bb-personal-best",String(best));},[best]);
 useEffect(()=>{let alive=true;const load=()=>fetch("/api/blockblast/leaderboard",{credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(d=>{if(alive&&d?.entries)setGlobalScores(d.entries);}).catch(()=>{});load();const timer=setInterval(load,30000);return()=>{alive=false;clearInterval(timer);};},[]);
 useEffect(()=>{localStorage.setItem("bb-score-history",JSON.stringify(history.slice(0,30)));},[history]);
 useEffect(()=>()=>{stream?.getTracks().forEach(t=>t.stop());},[stream]);
 const playTone=useCallback((frequency:number)=>{if(!sound)return;try{const ctx=new AudioContext();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.frequency.value=frequency;gain.gain.setValueAtTime(.06,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.13);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.14);osc.onended=()=>ctx.close();}catch{}},[sound]);

 const finishGame=useCallback((finalScore:number)=>{setGameOver(true);const entry={score:finalScore,date:new Date().toISOString()};setHistory(prev=>[entry,...prev].sort((a,b)=>b.score-a.score).slice(0,30));setBest(prev=>Math.max(prev,finalScore));fetch("/api/blockblast/scores",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({score:finalScore})}).catch(()=>{});},[]);
 const place=(row:number,col:number)=>{
  if(gameOver||!pieces[selected])return;
  const piece=pieces[selected];if(!canPlace(board,piece,row,col)){playTone(110);return;}
  const next=board.map(line=>[...line]);piece.cells.forEach(([y,x])=>next[row+y][col+x]=piece.color);
  let rows:number[]=[];let cols:number[]=[];
  for(let r=0;r<SIZE;r++)if(next[r].every(Boolean))rows.push(r);
  for(let c=0;c<SIZE;c++)if(next.every(line=>Boolean(line[c])))cols.push(c);
  const lines=rows.length+cols.length;
  if(lines){setClearing([...rows.map(r=>r),...cols.map(c=>c+SIZE)]);setFlash(true);playTone(660);}
  rows.forEach(r=>next[r].fill(""));
  cols.forEach(c=>{for(let r=0;r<SIZE;r++)next[r][c]="";});
  const nextStreak=lines?streak+1:0;const nextCombo=lines?Math.min(5,1+Math.floor(streak/2)):1;
  const gained=piece.cells.length*10+(lines?lines*100*nextCombo+Math.max(0,lines-1)*50:0);
  const finalScore=score+gained;
  setBoard(next);setScore(finalScore);setStreak(nextStreak);setCombo(nextCombo);playTone(lines?880:420);
  const remaining=pieces.map((p,i)=>i===selected?null:p);
  const allUsed=remaining.every(p=>p===null);
  const nextSet=allUsed?newPieces():remaining.map(p=>p||randomPiece());
  setPieces(nextSet);setSelected(0);setClearing([]);setFlash(false);
  if(!nextSet.some(p=>fitExists(next,p)))finishGame(finalScore);
 };
 const reset=()=>{setBoard(emptyBoard());setPieces(newPieces());setSelected(0);setScore(0);setStreak(0);setCombo(1);setGameOver(false);setClearing([]);};
 const leaderboard=useMemo(()=>[...history].sort((a,b)=>b.score-a.score).slice(0,5),[history]);
 const joinVoice=async()=>{if(!navigator.mediaDevices?.getUserMedia){setVoiceStatus("Your browser does not support microphone access.");return;}try{const media=await navigator.mediaDevices.getUserMedia({audio:true});media.getAudioTracks().forEach(t=>t.enabled=false);setStream(media);setVoiceJoined(true);setMuted(true);setVoiceStatus("Microphone permission granted. No signalling server is configured, so nobody else can hear you.");}catch{setVoiceStatus("Microphone permission was denied or unavailable.");}};
 const leaveVoice=()=>{stream?.getTracks().forEach(t=>t.stop());setStream(null);setVoiceJoined(false);setMuted(true);setVoiceStatus("Voice signalling is not configured on this server");};
 const toggleMute=()=>{if(!stream)return;const next=!muted;stream.getAudioTracks().forEach(t=>t.enabled=next);setMuted(!next);};
 const sendMessage=()=>{if(!message.trim())return;sendRoomMessage.mutate({content:message.trim().slice(0,300)});setMessage("");setRoomStatus("Connected to the shared public chat feed");};
 const maxScore=Math.max(best,score);
 return <Layout>
  <div className="mx-auto max-w-[1500px] space-y-5">
   <div className="flex flex-wrap items-end justify-between gap-4">
    <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.28em] text-cyan-300"><Sparkles className="h-4 w-4"/> Arcade / Daily challenge</div><h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Block Blast <span className="text-cyan-300">💥</span></h1><p className="mt-1 text-sm text-slate-400">Place. Clear. Chain combos. Beat your best.</p></div>
    <div className="flex items-center gap-2"><button onClick={()=>setSound(!sound)} className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-300 hover:bg-white/10" title="Toggle sound">{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button onClick={reset} className="flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200"><RotateCcw size={16}/> New game</button></div>
   </div>
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[{label:"CURRENT SCORE",value:score,icon:Zap},{label:"PERSONAL BEST",value:maxScore,icon:Trophy},{label:"STREAK",value:streak+"×",icon:Sparkles},{label:"COMBO MULTIPLIER",value:combo+"×",icon:Medal}].map((stat,i)=><div key={stat.label} className="rounded-2xl border border-white/10 bg-[#111a2b] p-4 shadow-lg shadow-black/10"><div className="flex items-center justify-between text-[10px] font-bold tracking-[.18em] text-slate-500">{stat.label}<stat.icon className="h-4 w-4 text-cyan-300"/></div><div className="mt-2 text-2xl font-black tabular-nums text-white">{stat.value}</div></div>)}
   </div>
   <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
    <section className="rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-[#111d33] to-[#0b1220] p-3 shadow-2xl shadow-black/25 sm:p-5">
     <div className="mb-4 flex items-center justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-[.2em] text-slate-400">Puzzle grid</div><div className="mt-1 text-sm text-slate-500">10 × 10 • Fill a row or column to clear it</div></div><div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold tracking-widest text-emerald-300">● LIVE RUN</div></div>
     <div className="relative mx-auto w-full max-w-[620px]">
      <div className="grid aspect-square grid-cols-10 gap-[3px] rounded-2xl border border-white/10 bg-[#080e1b] p-2 sm:gap-1 sm:p-3" role="grid" aria-label="Block Blast 10 by 10 game board">
       {board.map((line,r)=>line.map((cell,c)=><button key={r+"-"+c} onClick={()=>place(r,c)} aria-label={`Place at row ${r+1}, column ${c+1}`} className={`relative min-w-0 rounded-[3px] border transition-all duration-150 ${cell?"border-white/10 shadow-[inset_0_2px_0_#ffffff44,0_2px_4px_#0008]":"border-white/[.035] bg-[#1a2740] hover:bg-[#263b5b]"} ${flash&&clearing.includes(r)||flash&&clearing.includes(c+SIZE)?"animate-pulse":""}`} style={cell?{background:cell}:undefined}/>))}
      </div>
      {gameOver&&<div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#050a14]/90 p-6 text-center backdrop-blur-sm"><div className="max-w-sm"><Trophy className="mx-auto h-12 w-12 text-amber-300"/><div className="mt-3 text-3xl font-black text-white">Run complete</div><p className="mt-2 text-slate-400">No remaining piece can fit. Your score: <b className="text-cyan-300">{score.toLocaleString()}</b></p><button onClick={reset} className="mt-5 rounded-xl bg-cyan-300 px-6 py-3 font-bold text-slate-950">Play again</button></div></div>}
     </div>
     <div className="mx-auto mt-5 grid max-w-[620px] grid-cols-3 gap-3"><div className="col-span-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.2em] text-slate-400">Your blocks</span><span className="text-[11px] text-slate-500">Select a piece, then tap a grid cell</span></div>{pieces.map((piece,i)=><PiecePreview key={piece?.id||i} piece={piece} selected={selected===i} onClick={()=>setSelected(i)}/>)}</div>
     <p className="mx-auto mt-3 max-w-[620px] text-center text-[11px] text-slate-500">Tip: clear multiple lines together for bigger combo bonuses.</p>
    </section>
    <aside className="space-y-5">
     <section className="rounded-2xl border border-white/10 bg-[#111a2b] p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 font-bold text-white"><Mic size={17} className="text-cyan-300"/> Voice room</div><span className="rounded-full bg-amber-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-300">Not connected</span></div><div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3 text-xs leading-relaxed text-slate-400">{voiceStatus}</div><div className="mt-3 flex gap-2">{!voiceJoined?<button onClick={joinVoice} className="flex-1 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950"><Mic size={14} className="mr-1 inline"/> Allow mic</button>:<><button onClick={toggleMute} className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white">{muted?<MicOff size={14} className="mr-1 inline"/>:<Mic size={14} className="mr-1 inline"/>}{muted?"Unmute":"Mute"}</button><button onClick={leaveVoice} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300">Leave</button></>}</div><div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500"><Users size={14}/> 0 remote participants • WebRTC signalling unavailable</div></section>
     <section className="flex min-h-[320px] flex-col rounded-2xl border border-white/10 bg-[#111a2b] p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 font-bold text-white"><MessageCircle size={17} className="text-cyan-300"/> Room chat</div><span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Preview</span></div><div className="mt-2 text-[10px] text-amber-300/80">{roomStatus}</div><div className="mt-3 flex-1 space-y-3 overflow-y-auto">{sharedMessages?.length?sharedMessages.slice(-40).map((m:any)=><div key={m.id}><div className="flex justify-between text-[10px]"><b className="text-cyan-200">{m.senderDisplayName||m.senderNickname||m.senderName}</b><span className="text-slate-600">{new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span></div><p className="mt-1 break-words text-xs text-slate-300">{m.content}</p></div>):<div className="flex h-36 flex-col items-center justify-center text-center text-xs text-slate-500"><MessageCircle className="mb-2 h-7 w-7 opacity-40"/>No messages yet</div>}</div><form onSubmit={e=>{e.preventDefault();sendMessage();}} className="mt-3 flex gap-2"><input value={message} onChange={e=>setMessage(e.target.value)} maxLength={300} placeholder="Write a message..." className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/50"/><button aria-label="Send message" className="rounded-lg bg-cyan-300 p-2 text-slate-950"><Send size={15}/></button></form></section>
     <section className="rounded-2xl border border-white/10 bg-[#111a2b] p-4"><div className="flex items-center gap-2 font-bold text-white"><Trophy size={17} className="text-amber-300"/> Your best runs</div><div className="mt-3 space-y-2">{globalScores.length?globalScores.slice(0,5).map((entry:any,i:number)=><div key={entry.userId} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2"><div className="flex items-center gap-2 text-xs text-slate-400"><span className={i===0?"text-amber-300":"text-slate-600"}>#{entry.rank}</span>{entry.displayName||entry.username}</div><b className="text-sm tabular-nums text-white">{entry.score.toLocaleString()}</b></div>):<p className="py-4 text-center text-xs text-slate-500">No submitted scores this month yet.</p>}</div><p className="mt-3 text-[10px] leading-relaxed text-slate-600">Monthly server-stored scores. Top player earns one month of Dihhro after the month closes.</p></section>
    </aside>
   </div>
  </div>
 </Layout>;
}
export default BlockBlastGame;
