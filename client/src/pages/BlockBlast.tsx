import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, Volume2, VolumeX, RotateCcw, Sparkles, MessageCircle, Mic, MicOff, Users, Send, Zap, Medal } from "lucide-react";

type Cell = [number, number];
type Piece = { cells: Cell[]; color: string; id: string };
type ScoreEntry = { score: number; date: string };
const SIZE = 8;
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
const canPlace = (board:string[][], piece:Piece, row:number, col:number) => piece.cells.every(([y,x]) => row+y>=0 && col+x>=0 && row+y<SIZE && col+x<SIZE && !board[row+y][col+x]);
const fitExists = (board:string[][], piece:Piece) => { for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(canPlace(board,piece,r,c)) return true; return false; };
const newPieces = () => [randomPiece(),randomPiece(),randomPiece()];
const readHistory = (): ScoreEntry[] => { try { return JSON.parse(localStorage.getItem("bb-score-history") || "[]"); } catch { return []; } };

function PiecePreview({piece,selected,onClick,onPointerDown}:{piece:Piece|null;selected:boolean;onClick:()=>void;onPointerDown:(event:any)=>void}) {
 if(!piece) return <div className="h-[86px] opacity-20"/>;
 const maxY=Math.max(...piece.cells.map(c=>c[0]))+1, maxX=Math.max(...piece.cells.map(c=>c[1]))+1;
 return <button type="button" onPointerDown={onPointerDown} onClick={onClick} aria-label="Select or drag block piece" className={`h-[86px] touch-none select-none transition-all flex items-center justify-center ${selected?"-translate-y-1":"hover:-translate-y-1"}`}>
  <div style={{display:"grid",gridTemplateColumns:`repeat(${maxX},15px)`,gridTemplateRows:`repeat(${maxY},15px)`,gap:3}}>
   {Array.from({length:maxY},(_,y)=>Array.from({length:maxX},(_,x)=>{const active=piece.cells.some(([cy,cx])=>cy===y&&cx===x);return <span key={y+"-"+x} style={{width:15,height:15,borderRadius:3,background:active?piece.color:"transparent",boxShadow:active?"inset 0 2px 0 #ffffff66,0 3px 6px #0009":"none"}}/>;}))}
  </div>
 </button>;
}

function BlockBlastGame() {
 const { user } = useAuth();
 const queryClient = useQueryClient();
 const [sharedMessages,setSharedMessages]=useState<any[]>([]);
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
 const [placementCells,setPlacementCells]=useState<string[]>([]);
 const [comboBanner,setComboBanner]=useState("");
 const [comboPulse,setComboPulse]=useState(false);
 const [drag,setDrag]=useState<{index:number;x:number;y:number;grabX:number;grabY:number}|null>(null);
 const [hover,setHover]=useState<{row:number;col:number;index:number}|null>(null);
 const boardRef=useRef<HTMLDivElement|null>(null);

 const [message,setMessage]=useState("");
 const [roomStatus,setRoomStatus]=useState("Shared public chat feed");
 const [voiceStatus,setVoiceStatus]=useState("Join the room to connect your microphone.");
 const [voiceJoined,setVoiceJoined]=useState(false);
 const [muted,setMuted]=useState(true);
 const [stream,setStream]=useState<MediaStream|null>(null);
 const [voiceParticipants,setVoiceParticipants]=useState<any[]>([]);
 const [shopEmotes,setShopEmotes]=useState<any[]>([]);
 const [showEmotePicker,setShowEmotePicker]=useState(false);
 const [roomEmote,setRoomEmote]=useState<any>(null);
 const [roomEmoteClosing,setRoomEmoteClosing]=useState(false);
 const roomEmoteAudioRef=useRef<HTMLAudioElement|null>(null);
 const roomEmoteTimerRef=useRef<number|null>(null);
 const roomEmoteIdRef=useRef(0);
 const peersRef=useRef<Map<number,RTCPeerConnection>>(new Map());
 const remoteAudioRef=useRef<Map<number,HTMLAudioElement>>(new Map());

 const showRoomEmote=(emote:any)=>{
  const id=++roomEmoteIdRef.current;
  if(roomEmoteTimerRef.current!==null)window.clearTimeout(roomEmoteTimerRef.current);
  roomEmoteAudioRef.current?.pause();setRoomEmoteClosing(false);
  setRoomEmote({id,name:emote.name,gifUrl:emote.gifUrl,fromName:emote.fromName||"Player"});
  let audio:HTMLAudioElement|null=null;
  const finish=()=>{if(roomEmoteIdRef.current!==id)return;setRoomEmoteClosing(true);roomEmoteTimerRef.current=window.setTimeout(()=>{if(roomEmoteIdRef.current===id)setRoomEmote(null);},320);if(roomEmoteAudioRef.current===audio)roomEmoteAudioRef.current=null;};
  if(emote.audioUrl){audio=new Audio(emote.audioUrl);roomEmoteAudioRef.current=audio;audio.onended=finish;audio.onerror=finish;audio.play().catch(finish);const duration=Math.max(1,Math.min(20,Number(emote.duration)||3));roomEmoteTimerRef.current=window.setTimeout(finish,(duration+0.75)*1000);}
  else roomEmoteTimerRef.current=window.setTimeout(finish,3000);
 };
 useEffect(()=>()=>{roomEmoteAudioRef.current?.pause();if(roomEmoteTimerRef.current!==null)window.clearTimeout(roomEmoteTimerRef.current);},[]);
 useEffect(()=>{localStorage.setItem("bb-personal-best",String(best));},[best]);
 useEffect(()=>{fetch("/api/shop/inventory",{credentials:"same-origin"}).then(r=>r.ok?r.json():[]).then((rows:any[])=>setShopEmotes(rows.filter(item=>item.type==="emote"))).catch(()=>{});},[]);
 useEffect(()=>{let alive=true;const load=()=>fetch("/api/blockblast/leaderboard",{credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(d=>{if(alive&&d?.entries)setGlobalScores(d.entries);}).catch(()=>{});load();const timer=setInterval(load,30000);return()=>{alive=false;clearInterval(timer);};},[]);
 useEffect(()=>{localStorage.setItem("bb-score-history",JSON.stringify(history.slice(0,30)));},[history]);
 useEffect(()=>{fetch("/api/blockblast/history",{credentials:"same-origin"}).then(r=>r.ok?r.json():[]).then((rows:any[])=>{if(Array.isArray(rows)&&rows.length){const saved=rows.map(row=>({score:row.score,date:row.createdAt}));setHistory(saved);setBest(Math.max(0,...saved.map(x=>x.score)));}}).catch(()=>{});},[]);
 useEffect(()=>()=>{stream?.getTracks().forEach(t=>t.stop());},[stream]);
 const playTone=useCallback((frequency:number)=>{if(!sound)return;try{const ctx=new AudioContext();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.frequency.value=frequency;gain.gain.setValueAtTime(.06,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.13);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.14);osc.onended=()=>ctx.close();}catch{}},[sound]);

 const finishGame=useCallback((finalScore:number)=>{setGameOver(true);const entry={score:finalScore,date:new Date().toISOString()};setHistory(prev=>[entry,...prev].sort((a,b)=>b.score-a.score).slice(0,30));setBest(prev=>Math.max(prev,finalScore));fetch("/api/blockblast/scores",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({score:finalScore})}).then(()=>fetch("/api/blockblast/history",{credentials:"same-origin"})).then(r=>r?.ok?r.json():null).then((rows:any)=>{if(Array.isArray(rows)){const saved=rows.map((row:any)=>({score:row.score,date:row.createdAt}));setHistory(saved);setBest(Math.max(0,...saved.map((x:any)=>x.score)));}}).catch(()=>{});},[]);
 const place=(row:number,col:number,pieceIndex=selected)=>{
  if(gameOver||!pieces[pieceIndex])return;
  const piece=pieces[pieceIndex];if(!canPlace(board,piece,row,col)){playTone(110);return;}
  const next=board.map(line=>[...line]);piece.cells.forEach(([y,x])=>next[row+y][col+x]=piece.color);
  setPlacementCells(piece.cells.map(([y,x])=>`${row+y}-${col+x}`));window.setTimeout(()=>setPlacementCells([]),420);
  let rows:number[]=[];let cols:number[]=[];
  for(let r=0;r<SIZE;r++)if(next[r].every(Boolean))rows.push(r);
  for(let c=0;c<SIZE;c++)if(next.every(line=>Boolean(line[c])))cols.push(c);
  const lines=rows.length+cols.length;
  if(lines){setClearing([...rows.map(r=>r),...cols.map(c=>c+SIZE)]);setFlash(true);playTone(660);setComboBanner(lines>=3?`🔥 MEGA CLEAR ×${lines}`:lines===2?"⚡ DOUBLE CLEAR":"✨ LINE CLEAR");}else{setComboBanner("＋ BLOCK PLACED");}
  setComboPulse(true);window.setTimeout(()=>setComboPulse(false),620);window.setTimeout(()=>setComboBanner(""),1050);
  rows.forEach(r=>next[r].fill(""));
  cols.forEach(c=>{for(let r=0;r<SIZE;r++)next[r][c]="";});
  const nextStreak=lines?streak+1:0;const nextCombo=lines?Math.min(5,1+Math.floor(streak/2)):1;
  if(lines&&nextCombo>=2){fetch("/api/blockblast/combo-reward",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({combo:nextCombo})}).then(async response=>{if(response.ok){const reward=await response.json();queryClient.invalidateQueries({queryKey:["/api/auth/me"]});window.dispatchEvent(new CustomEvent("dihcoins-earned",{detail:reward}));}}).catch(()=>{});}
  const gained=piece.cells.length*10+(lines?lines*100*nextCombo+Math.max(0,lines-1)*50:0);
  const finalScore=score+gained;
  setBoard(next);setScore(finalScore);setStreak(nextStreak);setCombo(nextCombo);playTone(lines?880:420);
  const remaining=pieces.map((p,i)=>i===pieceIndex?null:p);
  const allUsed=remaining.every(p=>p===null);
  const nextSet=allUsed?newPieces():remaining.map(p=>p||randomPiece());
  setPieces(nextSet);setSelected(0);window.setTimeout(()=>{setClearing([]);setFlash(false);},360);
  if(!nextSet.some(p=>fitExists(next,p)))finishGame(finalScore);
 };
 const reset=()=>{setDrag(null);setHover(null);setBoard(emptyBoard());setPieces(newPieces());setSelected(0);setScore(0);setStreak(0);setCombo(1);setGameOver(false);setClearing([]);setPlacementCells([]);setComboBanner("");};
 useEffect(()=>{
  if(!drag)return;
  const move=(event:PointerEvent)=>setDrag(current=>current?({...current,x:event.clientX,y:event.clientY}):null);
  const up=(event:PointerEvent)=>{
   const rect=boardRef.current?.getBoundingClientRect();
   const piece=pieces[drag.index];
   if(rect&&piece&&event.clientX>=rect.left&&event.clientX<rect.right&&event.clientY>=rect.top&&event.clientY<rect.bottom){
    const pitchX=rect.width/SIZE,pitchY=rect.height/SIZE;
    // Keep the exact grabbed block under the pointer; never re-centre the shape on release.
    const col=Math.floor((event.clientX-rect.left)/pitchX)-drag.grabX;
    const row=Math.floor((event.clientY-rect.top)/pitchY)-drag.grabY;
    place(row,col,drag.index);
   }
   setDrag(null);setHover(null);
  };
  window.addEventListener("pointermove",move);
  window.addEventListener("pointerup",up);
  window.addEventListener("pointercancel",up);
  return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",up);};
 },[drag,pieces,place]);
 const sendVoiceSignal=async(to:number,signal:any)=>{await fetch("/api/blockblast/voice/signal",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({to,signal})});};
 const joinVoice=async()=>{
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection){setVoiceStatus("This browser does not support WebRTC microphone rooms.");return;}
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   media.getAudioTracks().forEach(t=>t.enabled=false);
   const joined=await fetch("/api/blockblast/voice/join",{method:"POST",credentials:"same-origin"});
   if(!joined.ok)throw new Error("Could not join the voice room.");
   const data=await joined.json();setVoiceParticipants(data.participants||[]);setStream(media);setVoiceJoined(true);setMuted(true);setVoiceStatus("Connected to the Block Blast voice room. You are muted.");
  }catch(error:any){setVoiceStatus(error?.name==="NotAllowedError"?"Microphone permission was denied. Allow microphone access and try again.":error.message||"Could not join voice.");}
 };
 const sendRoomEmote=async(item:any)=>{
  try{const response=await fetch("/api/blockblast/voice/emote",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({emoteId:item.id})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"Could not send emote.");
   let styles:any={};try{styles=typeof item.cssStyles==="string"?JSON.parse(item.cssStyles):(item.cssStyles||{});}catch{}
   showRoomEmote({name:item.name,gifUrl:item.imageUrl,audioUrl:styles.audioUrl,duration:styles.duration,fromName:user?.username||"You"});setShowEmotePicker(false);
  }catch(error:any){setVoiceStatus(error.message||"Could not send emote.");}
 };
 const leaveVoice=()=>{
  fetch("/api/blockblast/voice/leave",{method:"POST",credentials:"same-origin"}).catch(()=>{});
  peersRef.current.forEach(pc=>pc.close());peersRef.current.clear();
  remoteAudioRef.current.forEach(audio=>{audio.pause();audio.srcObject=null;audio.remove();});remoteAudioRef.current.clear();
  stream?.getTracks().forEach(t=>t.stop());setStream(null);setVoiceJoined(false);setVoiceParticipants([]);setMuted(true);setVoiceStatus("You left the voice room.");
 };
 const toggleMute=()=>{if(!stream)return;const next=!muted;stream.getAudioTracks().forEach(t=>t.enabled=next);setMuted(!next);};
 useEffect(()=>{
  if(!voiceJoined||!stream||!user?.id)return;
  let alive=true;
  const makePeer=(peerId:number)=>{let pc=peersRef.current.get(peerId);if(pc)return pc;
   pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
   stream.getTracks().forEach(track=>pc!.addTrack(track,stream));
   pc.onicecandidate=e=>{if(e.candidate)sendVoiceSignal(peerId,{type:"ice",candidate:e.candidate.toJSON()}).catch(()=>{});};
   pc.ontrack=e=>{let audio=remoteAudioRef.current.get(peerId);if(!audio){audio=new Audio();audio.autoplay=true;audio.playsInline=true;remoteAudioRef.current.set(peerId,audio);}audio.srcObject=e.streams[0];audio.play().catch(()=>{});};
   pc.onconnectionstatechange=()=>{if(pc!.connectionState==="failed"||pc!.connectionState==="closed"||pc!.connectionState==="disconnected"){pc!.close();peersRef.current.delete(peerId);}};
   peersRef.current.set(peerId,pc);return pc;
  };
  const poll=async()=>{
   try{
    const [participantsResponse,signalsResponse]=await Promise.all([
     fetch("/api/blockblast/voice/participants",{credentials:"same-origin"}),
     fetch("/api/blockblast/voice/signals",{credentials:"same-origin"})
    ]);
    if(!participantsResponse.ok||!signalsResponse.ok)return;
    const participants=await participantsResponse.json();const signals=await signalsResponse.json();
    if(!alive)return;setVoiceParticipants(participants);
    for(const participant of participants){if(Number(user.id)<Number(participant.userId)&&!peersRef.current.has(Number(participant.userId))){
      const pc=makePeer(Number(participant.userId));const offer=await pc.createOffer();await pc.setLocalDescription(offer);await sendVoiceSignal(Number(participant.userId),{type:"offer",description:pc.localDescription});
    }}
    for(const [peerId,pc] of peersRef.current){const stats=await pc.getStats();let level=0;stats.forEach(report=>{if(report.type==="inbound-rtp"&&report.kind==="audio")level=Number((report as any).audioLevel||0);});setVoiceParticipants(prev=>prev.map(p=>p.userId===peerId?{...p,speaking:level>0.025}:p));}
    for(const item of signals){const peerId=Number(item.from);if(item.signal.type==="emote"){const emote=item.signal.emote||{};showRoomEmote({...emote,fromName:emote.fromName||voiceParticipants.find((p:any)=>Number(p.userId)===peerId)?.username||"Player"});continue;}if(item.signal.type==="left"){peersRef.current.get(peerId)?.close();peersRef.current.delete(peerId);const audio=remoteAudioRef.current.get(peerId);audio?.remove();remoteAudioRef.current.delete(peerId);continue;}
     if(item.signal.type==="offer"){const pc=makePeer(peerId);await pc.setRemoteDescription(new RTCSessionDescription(item.signal.description));const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await sendVoiceSignal(peerId,{type:"answer",description:pc.localDescription});}
     else if(item.signal.type==="answer"){const pc=peersRef.current.get(peerId);if(pc&&pc.signalingState==="have-local-offer")await pc.setRemoteDescription(new RTCSessionDescription(item.signal.description));}
     else if(item.signal.type==="ice"){const pc=peersRef.current.get(peerId);if(pc&&item.signal.candidate)await pc.addIceCandidate(new RTCIceCandidate(item.signal.candidate)).catch(()=>{});}
    }
   }catch{}
  };
  poll();const timer=window.setInterval(poll,1000);
  return()=>{alive=false;window.clearInterval(timer);};
 },[voiceJoined,stream,user?.id]);
 const sendMessage=()=>{const content=message.trim().slice(0,300);if(!content)return;fetch("/api/blockblast/chat",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({content})}).then(async r=>{if(!r.ok)throw new Error();const row=await r.json();setSharedMessages(prev=>[...prev,row].slice(-150));setMessage("");setRoomStatus("Connected to Block Blast chat");}).catch(()=>setRoomStatus("Chat unavailable — try again."));};
 const maxScore=Math.max(best,score);
 const activePiece=drag?pieces[drag.index]:(hover?pieces[hover.index]:null);
 const boardRect=boardRef.current?.getBoundingClientRect();
 const pointerPreview=drag&&activePiece&&boardRect?{
  row:Math.floor((drag.y-boardRect.top)/(boardRect.height/SIZE))-drag.grabY,
  col:Math.floor((drag.x-boardRect.left)/(boardRect.width/SIZE))-drag.grabX
 }:null;
 const previewOrigin=pointerPreview|| (hover?{row:hover.row,col:hover.col}:null);
 const previewIndex=drag?drag.index:hover?.index;
 const previewPiece=previewIndex===undefined?null:pieces[previewIndex];
 const previewValid=!!(previewPiece&&previewOrigin&&canPlace(board,previewPiece,previewOrigin.row,previewOrigin.col));
 const previewCells=new Set(previewPiece&&previewOrigin?previewPiece.cells.map(([y,x])=>`${previewOrigin.row+y}-${previewOrigin.col+x}`):[]);
 return <Layout>{drag&&pieces[drag.index]&&(()=>{const piece=pieces[drag.index];const rect=boardRef.current?.getBoundingClientRect();const cell=rect?rect.width/SIZE:32;const maxX=Math.max(...piece.cells.map(c=>c[1]))+1;const maxY=Math.max(...piece.cells.map(c=>c[0]))+1;const tile=Math.max(12,cell-3);return <div className="pointer-events-none fixed z-[100] drop-shadow-[0_12px_20px_rgba(0,0,0,.55)]" style={{left:drag.x-drag.grabX*(tile+3)-tile/2,top:drag.y-drag.grabY*(tile+3)-tile/2,transform:"none",display:"grid",gridTemplateColumns:`repeat(${maxX},${tile}px)`,gridTemplateRows:`repeat(${maxY},${tile}px)`,gap:3,opacity:.96}}>{Array.from({length:maxY},(_,y)=>Array.from({length:maxX},(_,x)=>{const active=piece.cells.some(([cy,cx])=>cy===y&&cx===x);return <span key={y+"-"+x} style={{width:tile,height:tile,borderRadius:Math.max(3,cell*.12),background:active?piece.color:"transparent",boxShadow:active?"inset 0 3px 0 #ffffff77,0 4px 10px #0009":"none"}}/>;}))}</div>;})()}<style>{`@keyframes bb-emote-in{from{opacity:0;transform:translateY(10px) scale(.88)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes bb-emote-out{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(8px) scale(.92)}}.bb-emote-in{animation:bb-emote-in .28s cubic-bezier(.2,.8,.2,1) both}.bb-emote-out{animation:bb-emote-out .3s ease both}@keyframes bb-place-pop{0%{transform:scale(.45);filter:brightness(2.2)}65%{transform:scale(1.13);filter:brightness(1.5)}100%{transform:scale(1);filter:brightness(1)}}@keyframes bb-combo-pop{0%{opacity:0;transform:translate(-50%,-35%) scale(.55)}55%{opacity:1;transform:translate(-50%,-55%) scale(1.12)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}.bb-place-pop{animation:bb-place-pop .38s cubic-bezier(.2,.8,.2,1);z-index:1}.bb-combo-pop{animation:bb-combo-pop .55s cubic-bezier(.2,.8,.2,1)}`}</style>
  <div className="nexus-page nexus-page-arcade mx-auto w-full max-w-[1100px] space-y-3 px-2 pb-4 sm:space-y-5 sm:px-4">
   <div className="flex flex-wrap items-end justify-between gap-4">
    <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.28em] text-cyan-300"><Sparkles className="h-4 w-4"/> Arcade / Daily challenge</div><h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Block Blast <span className="text-cyan-300">💥</span></h1><p className="mt-1 text-sm text-slate-400">Place. Clear. Chain combos. Beat your best.</p></div>
    <div className="flex items-center gap-2"><button onClick={()=>setSound(!sound)} className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-300 hover:bg-white/10" title="Toggle sound">{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button onClick={reset} className="flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200"><RotateCcw size={16}/> New game</button></div>
   </div>
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[{label:"CURRENT SCORE",value:score,icon:Zap},{label:"PERSONAL BEST",value:maxScore,icon:Trophy},{label:"STREAK",value:streak+"×",icon:Sparkles},{label:"COMBO MULTIPLIER",value:combo+"×",icon:Medal}].map((stat,i)=><div key={stat.label} className="rounded-2xl border border-white/10 bg-[#111a2b] p-2 shadow-lg shadow-black/10 sm:p-4"><div className="flex items-center justify-between text-[10px] font-bold tracking-[.18em] text-slate-500">{stat.label}<stat.icon className="h-4 w-4 text-cyan-300"/></div><div className="mt-2 text-2xl font-black tabular-nums text-white">{stat.value}</div></div>)}
   </div>
   <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
    <section className="min-w-0 rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-[#111d33] to-[#0b1220] p-2 shadow-2xl shadow-black/25 sm:rounded-3xl sm:p-4">
     <div className="mb-4 flex items-center justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-[.2em] text-slate-400">Puzzle grid</div><div className="mt-1 text-sm text-slate-500">8 × 8 • Fill a row or column to clear it</div></div><div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold tracking-widest text-emerald-300">● LIVE RUN</div></div>
     <div className="relative mx-auto w-full max-w-[min(100%,420px)]">
      {comboBanner&&<div key={comboBanner+score} className={`pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-2xl border border-cyan-200/40 bg-slate-950/90 px-6 py-3 text-lg font-black tracking-wider text-cyan-200 shadow-[0_0_45px_#22d3ee55] ${comboPulse?"bb-combo-pop":""}`}>{comboBanner}{combo>1?` ×${combo}`:""}</div>}
      <div ref={boardRef} onPointerMove={e=>{if(drag)return;const rect=boardRef.current?.getBoundingClientRect();if(!rect||e.clientX<rect.left||e.clientX>=rect.right||e.clientY<rect.top||e.clientY>=rect.bottom){setHover(null);return;}setHover({row:Math.floor((e.clientY-rect.top)/(rect.height/SIZE))-Math.floor((Math.max(...(pieces[selected]?.cells.map(v=>v[0])||[0]))+1)/2),col:Math.floor((e.clientX-rect.left)/(rect.width/SIZE))-Math.floor((Math.max(...(pieces[selected]?.cells.map(v=>v[1])||[0]))+1)/2),index:selected});}} onPointerLeave={()=>{if(!drag)setHover(null);}} className="grid aspect-square grid-cols-8 gap-1 bg-transparent p-0 sm:gap-1.5" role="grid" aria-label="Block Blast 8 by 8 game board">
       {board.map((line,r)=>line.map((cell,c)=><button key={r+"-"+c} onClick={()=>{const piece=pieces[selected];if(!piece)return;const originRow=r-Math.floor((Math.max(...piece.cells.map(v=>v[0]))+1)/2);const originCol=c-Math.floor((Math.max(...piece.cells.map(v=>v[1]))+1)/2);place(originRow,originCol);setHover(null);}} aria-label={`Place at row ${r+1}, column ${c+1}`} className={`relative min-w-0 rounded-[3px] border transition-all duration-100 ${cell?"border-white/10 shadow-[inset_0_2px_0_#ffffff44,0_2px_4px_#0008]":"border-white/[.035] bg-[#1a2740]"} ${previewCells.has(r+"-"+c)?(previewValid?"!border-emerald-300 !bg-emerald-400/50 shadow-[inset_0_0_0_2px_#6ee7b7,0_0_16px_#34d39966]":"!border-rose-300 !bg-rose-500/50 shadow-[inset_0_0_0_2px_#fda4af]"):""} ${flash&&clearing.includes(r)||flash&&clearing.includes(c+SIZE)?"animate-pulse":""} ${placementCells.includes(r+"-"+c)?"bb-place-pop":""}`} style={cell?{background:cell}:undefined}/>))}
      </div>
      {gameOver&&<div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#050a14]/90 p-6 text-center backdrop-blur-sm"><div className="max-w-sm"><Trophy className="mx-auto h-12 w-12 text-amber-300"/><div className="mt-3 text-3xl font-black text-white">Run complete</div><p className="mt-2 text-slate-400">No remaining piece can fit. Your score: <b className="text-cyan-300">{score.toLocaleString()}</b></p><button onClick={reset} className="mt-5 rounded-xl bg-cyan-300 px-6 py-3 font-bold text-slate-950">Play again</button></div></div>}
     </div>
     <div className="mx-auto mt-4 grid w-full max-w-[420px] grid-cols-3 gap-2 sm:mt-5 sm:gap-3"><div className="col-span-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.2em] text-slate-400">Your blocks</span><span className="text-[11px] text-slate-500">Drag a piece onto the grid, or tap a piece then tap a cell</span></div>{pieces.map((piece,i)=><PiecePreview key={piece?.id||i} piece={piece} selected={selected===i} onClick={()=>setSelected(i)} onPointerDown={e=>{if(!piece||gameOver)return;e.preventDefault();setSelected(i);const bounds=e.currentTarget.querySelector("div")?.getBoundingClientRect();const cellSize=18;const px=bounds?Math.max(0,Math.floor((e.clientX-bounds.left)/cellSize)):0;const py=bounds?Math.max(0,Math.floor((e.clientY-bounds.top)/cellSize)):0;const anchor=piece.cells.reduce((best,cell)=>Math.hypot(cell[1]-px,cell[0]-py)<Math.hypot(best[1]-px,best[0]-py)?cell:best,piece.cells[0]);setHover(null);setDrag({index:i,x:e.clientX,y:e.clientY,grabX:anchor[1],grabY:anchor[0]});}}/>)}</div>
     <p className="mx-auto mt-3 max-w-[620px] text-center text-[11px] text-slate-500">Tip: clear multiple lines together for bigger combo bonuses.</p>
    </section>
    <aside className="space-y-5">
     <section className="rounded-2xl border border-white/10 bg-[#111a2b] p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 font-bold text-white"><Mic size={17} className="text-cyan-300"/> Voice room</div><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${voiceJoined?"bg-emerald-400/10 text-emerald-300":"bg-amber-400/10 text-amber-300"}`}>{voiceJoined?"Connected":"Not connected"}</span></div><div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3 text-xs leading-relaxed text-slate-400">{voiceStatus}</div><div className="mt-3 flex gap-2">{!voiceJoined?<button onClick={joinVoice} className="flex-1 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950"><Mic size={14} className="mr-1 inline"/> Allow mic</button>:<><button onClick={toggleMute} className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white">{muted?<MicOff size={14} className="mr-1 inline"/>:<Mic size={14} className="mr-1 inline"/>}{muted?"Unmute":"Mute"}</button><button onClick={leaveVoice} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300">Leave</button></>}</div><div className="mt-3 space-y-1 text-[11px] text-slate-500"><div className="flex items-center gap-2"><Users size={14}/> {voiceParticipants.length + (voiceJoined ? 1 : 0)} in room</div>{voiceJoined && <div className="flex flex-wrap gap-1">{voiceParticipants.map((p:any)=><span key={p.userId} className={`rounded px-2 py-1 ${p.speaking?"bg-emerald-400/20 text-emerald-200":"bg-white/5 text-slate-300"}`}>{p.speaking?"● ":""}{p.username}</span>)}<span className="rounded bg-cyan-300/10 px-2 py-1 text-cyan-200">You · {muted ? "muted" : "live mic"}</span></div>}
     {voiceJoined&&<div className="mt-3 flex flex-wrap items-center gap-2">
      <button onClick={()=>setShowEmotePicker(v=>!v)} className="flex items-center gap-2 rounded-lg border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-2 text-xs font-bold text-fuchsia-200"><Sparkles size={14}/> Emotes</button>
      {roomEmote?.gifUrl&&<div key={roomEmote.id} className={"flex items-center gap-2 rounded-xl border border-violet-300/40 bg-violet-500/15 p-2 shadow-lg "+(roomEmoteClosing?"bb-emote-out":"bb-emote-in")}><img src={roomEmote.gifUrl} alt={roomEmote.name} className="h-14 w-14 object-contain"/><div className="min-w-0"><div className="text-[9px] font-semibold uppercase tracking-wider text-violet-300">{roomEmote.fromName}</div><span className="block max-w-32 truncate text-xs font-bold text-violet-100">{roomEmote.name}</span></div></div>}
      {showEmotePicker&&<div className="grid w-full grid-cols-4 gap-2 rounded-xl border border-violet-400/20 bg-black/30 p-2">{shopEmotes.map(item=><button key={item.id} onClick={()=>sendRoomEmote(item)} className="rounded-lg border border-white/10 p-2 hover:bg-white/10"><img src={item.imageUrl} alt={item.name} className="mx-auto h-10 w-10 object-contain"/><span className="mt-1 block truncate text-[9px] text-slate-200">{item.name}</span></button>)}{!shopEmotes.length&&<p className="col-span-4 p-2 text-xs text-slate-400">Buy emotes in the DihCoins Shop first.</p>}</div>}
     </div>}</div></section>
     <section className="flex min-h-[320px] flex-col rounded-2xl border border-white/10 bg-[#111a2b] p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 font-bold text-white"><MessageCircle size={17} className="text-cyan-300"/> Room chat</div><span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">BLOCK BLAST</span></div><div className="mt-2 text-[10px] text-emerald-300/80">{roomStatus || "Connected to shared chat"}</div><div className="mt-3 flex-1 space-y-3 overflow-y-auto">{sharedMessages?.length?sharedMessages.slice(-40).map((m:any)=><div key={m.id}><div className="flex justify-between text-[10px]"><b className="text-cyan-200">{m.senderDisplayName||m.senderNickname||m.senderName}</b><span className="text-slate-600">{new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span></div><p className="mt-1 break-words text-xs text-slate-300">{m.content}</p></div>):<div className="flex h-36 flex-col items-center justify-center text-center text-xs text-slate-500"><MessageCircle className="mb-2 h-7 w-7 opacity-40"/>No messages yet</div>}</div><form onSubmit={e=>{e.preventDefault();sendMessage();}} className="mt-3 flex gap-2"><input value={message} onChange={e=>setMessage(e.target.value)} maxLength={300} placeholder="Write a message..." className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/50"/><button aria-label="Send message" className="rounded-lg bg-cyan-300 p-2 text-slate-950"><Send size={15}/></button></form></section>
     <section className="rounded-2xl border border-white/10 bg-[#111a2b] p-4"><div className="flex items-center gap-2 font-bold text-white"><Trophy size={17} className="text-amber-300"/> Your best runs</div><div className="mt-3 space-y-2">{globalScores.length?globalScores.slice(0,5).map((entry:any,i:number)=><div key={entry.userId} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2"><div className="flex items-center gap-2 text-xs text-slate-400"><span className={i===0?"text-amber-300":"text-slate-600"}>#{entry.rank}</span>{entry.displayName||entry.username}</div><b className="text-sm tabular-nums text-white">{entry.score.toLocaleString()}</b></div>):<p className="py-4 text-center text-xs text-slate-500">No submitted scores this month yet.</p>}</div><p className="mt-3 text-[10px] leading-relaxed text-slate-600">Monthly server-stored scores. Top player earns one month of Dihhro after the month closes.</p></section>
    </aside>
   </div>
  </div>
 </Layout>;
}
export default BlockBlastGame;
