import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { CyberCard } from "@/components/CyberCard";
import { CyberButton } from "@/components/CyberButton";
import { ShoppingBag, Check, Coins, Upload, Play, Sparkles } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const readFile = (file: File) => new Promise<string>((resolve,reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(new Error("Could not read that file.")); reader.readAsDataURL(file);
});
const getStyles = (item:any) => { try { return typeof item.cssStyles === "string" ? JSON.parse(item.cssStyles) : (item.cssStyles || {}); } catch { return {}; } };

export default function Shop() {
  const { user } = useAuth(); const { toast } = useToast();
  const [type,setType] = useState<"decoration"|"emote">("decoration");
  const [name,setName] = useState(""); const [description,setDescription] = useState(""); const [price,setPrice] = useState("100");
  const [imageUrl,setImageUrl] = useState(""); const [audioUrl,setAudioUrl] = useState(""); const [audioDuration,setAudioDuration] = useState(0);
  const [scale,setScale] = useState("1"); const [scaleX,setScaleX] = useState("1"); const [scaleY,setScaleY] = useState("1"); const [rotationAngle,setRotationAngle] = useState("0"); const [offsetX,setOffsetX] = useState("0"); const [offsetY,setOffsetY] = useState("0"); const [transformDrag,setTransformDrag] = useState<any>(null); const [busy,setBusy] = useState(false);
  const startTransform = (mode:string,e:any) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); setTransformDrag({mode,startX:e.clientX,startY:e.clientY,offsetX:Number(offsetX),offsetY:Number(offsetY),scale:Number(scale),scaleX:Number(scaleX),scaleY:Number(scaleY),rotation:Number(rotationAngle)}); };
  const moveTransform = (e:any) => { if(!transformDrag)return; const dx=e.clientX-transformDrag.startX, dy=e.clientY-transformDrag.startY;
    if(transformDrag.mode==="move"){setOffsetX(String(Math.max(-100,Math.min(100,transformDrag.offsetX+dx/1.12))));setOffsetY(String(Math.max(-100,Math.min(100,transformDrag.offsetY+dy/1.12))));}
    else if(transformDrag.mode==="uniform"){const next=Math.max(.2,Math.min(4,transformDrag.scale+(dx-dy)/180));setScale(next.toFixed(2));}
    else if(transformDrag.mode==="horizontal"){setScaleX(Math.max(.2,Math.min(4,transformDrag.scaleX+dx/100)).toFixed(2));}
    else if(transformDrag.mode==="vertical"){setScaleY(Math.max(.2,Math.min(4,transformDrag.scaleY-dy/100)).toFixed(2));}
    else if(transformDrag.mode==="rotate"){setRotationAngle(String(Math.max(-180,Math.min(180,transformDrag.rotation+dx*1.8-dy*1.8))));}
  };
  const stopTransform = () => setTransformDrag(null);
  const imageInput=useRef<HTMLInputElement>(null); const audioInput=useRef<HTMLInputElement>(null);
  const { data: items = [], refetch } = useQuery<any[]>({ queryKey: ["/api/shop/items"] });
  const { data: inventory = [] } = useQuery<any[]>({ queryKey: ["/api/shop/inventory"] });
  const isPurchased = (itemId:number) => inventory.some((i:any) => i.id === itemId);
  const playEmote = (item:any) => {
    const styles=getStyles(item); if(!styles.audioUrl || !item.imageUrl) return;
    const audio=new Audio(styles.audioUrl); const popup=document.createElement("div");
    popup.className="fixed bottom-8 right-8 z-[9999] rounded-2xl border border-violet-300/50 bg-[#111827]/95 p-3 shadow-2xl";
    const gif=document.createElement("img"); gif.src=item.imageUrl; gif.alt=item.name; gif.className="h-24 w-24 rounded-xl object-contain"; popup.appendChild(gif); document.body.appendChild(popup);
    const remove=()=>{popup.style.transition="opacity .35s, transform .35s";popup.style.opacity="0";popup.style.transform="translateY(12px) scale(.96)";window.setTimeout(()=>popup.remove(),380);};
    audio.onended=remove; audio.onerror=remove; audio.play().catch(()=>{remove();toast({title:"Audio playback blocked",description:"Tap play again to allow audio.",variant:"destructive"});});
    window.setTimeout(remove,Math.max(1000,Math.min(20000,(styles.duration||3)*1000+500)));
  };
  const handleImage = async (file?:File) => {
    if(!file)return; const valid=type==="decoration"?(file.type==="image/png"||file.type==="image/gif"):file.type==="image/gif";
    if(!valid){toast({title:"Unsupported image",description:type==="decoration"?"Decorations must be PNG or GIF files.":"Emotes must be GIF files.",variant:"destructive"});return;}
    if(file.size>3*1024*1024){toast({title:"Image too large",description:"Maximum image size is 3 MB.",variant:"destructive"});return;}
    try{setImageUrl(await readFile(file));}catch(e:any){toast({title:"Upload failed",description:e.message,variant:"destructive"});}
  };
  const handleAudio = async (file?:File) => {
    if(!file)return; if(file.type!=="audio/mpeg"&&!file.name.toLowerCase().endsWith(".mp3")){toast({title:"MP3 required",variant:"destructive"});return;}
    if(file.size>1.4*1024*1024){toast({title:"MP3 too large",description:"Maximum MP3 size is 1.4 MB.",variant:"destructive"});return;}
    setAudioUrl("");setAudioDuration(0);
    try{
      const data=await readFile(file);const url=URL.createObjectURL(file);const audio=new Audio();audio.preload="metadata";
      audio.onloadedmetadata=()=>{URL.revokeObjectURL(url);const duration=audio.duration;if(!Number.isFinite(duration)||duration<=0||duration>20){setAudioUrl("");setAudioDuration(0);toast({title:"MP3 must be 20 seconds or shorter",description:"The emote bubble stays visible for the full MP3 playback.",variant:"destructive"});return;}setAudioDuration(duration);setAudioUrl(data);};
      audio.onerror=()=>{URL.revokeObjectURL(url);toast({title:"Could not read MP3 duration",variant:"destructive"});};audio.src=url;
    }catch(e:any){toast({title:"Audio upload failed",description:e.message,variant:"destructive"});}
  };
  const publish = async () => {
    if(!name.trim()||!imageUrl||!Number.isSafeInteger(Number(price))||Number(price)<0){toast({title:"Complete the item details",variant:"destructive"});return;}
    if(type==="emote"&&(!audioUrl||audioDuration<=0||audioDuration>20)){toast({title:"Add a valid MP3",description:"The MP3 must be 20 seconds or shorter.",variant:"destructive"});return;}
    setBusy(true);
    try{
      const cssStyles=type==="decoration"?{scale:Number(scale),scaleX:Number(scaleX),scaleY:Number(scaleY),rotationAngle:Number(rotationAngle),offsetX:Number(offsetX),offsetY:Number(offsetY)}:{audioUrl:audioUrl,duration:audioDuration};
      const response=await fetch("/api/shop/create",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name,description:description,type:type,price:Number(price),imageUrl:imageUrl,cssStyles:cssStyles})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"Could not publish item.");
      setName("");setDescription("");setImageUrl("");setAudioUrl("");setAudioDuration(0);await refetch();toast({title:"Published to the DihCoins shop!",description:"Your item is now available for everyone to buy."});
    }catch(e:any){toast({title:"Publish failed",description:e.message,variant:"destructive"});}finally{setBusy(false);}
  };
  const buy = async (itemId:number) => {
    try{const res=await fetch("/api/shop/buy",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({itemId})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.message||"Purchase failed");
      await queryClient.invalidateQueries({queryKey:["/api/shop/inventory"]});await queryClient.invalidateQueries({queryKey:["/api/auth/me"]});toast({title:"Purchase successful",description:"Added to your inventory."});
    }catch(e:any){toast({title:"Purchase failed",description:e.message,variant:"destructive"});}
  };
  const updateEquippedItem = async (item:any, unequip=false) => {
    const decorationId = item.type === "decoration"
      ? (unequip ? null : item.id)
      : (user?.decorationId ? Number(user.decorationId) : null);
    const nameStyleId = item.type === "name_style"
      ? (unequip ? null : item.id)
      : (user?.nameStyleId ? Number(user.nameStyleId) : null);
    try {
      const res=await fetch("/api/shop/equip",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({decorationId,nameStyleId})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.message || "Could not update equipped item.");
      const nextDecorationId = decorationId == null ? null : String(decorationId);
      const nextNameStyleId = nameStyleId == null ? null : String(nameStyleId);
      queryClient.setQueryData(["/api/auth/me"], (current:any) => current ? {...current, decorationId:nextDecorationId, nameStyleId:nextNameStyleId} : current);
      queryClient.setQueryData(["/api/user/profile", user?.id], (current:any) => current ? {...current, decorationId:nextDecorationId, nameStyleId:nextNameStyleId} : current);
      await queryClient.invalidateQueries({queryKey:["/api/auth/me"]});
      await queryClient.invalidateQueries({queryKey:["/api/user/profile"]});
      toast({title:unequip?"Decoration unequipped":"Profile decoration equipped"});
    } catch(error:any) {
      toast({title:"Could not update decoration",description:error.message,variant:"destructive"});
    }
  };

  return <Layout><div className="mx-auto max-w-6xl space-y-7 p-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="flex items-center gap-3 text-3xl font-black text-primary"><ShoppingBag className="h-8 w-8"/> DIHCOINS SHOP</h1><p className="mt-1 text-sm text-muted-foreground">Profile decorations, animated emotes and creator-made cosmetics.</p></div><div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3"><Coins className="h-5 w-5 text-amber-300"/><span className="font-bold text-amber-200">{Number(user?.coins||0).toLocaleString()} DihCoins</span></div></div>
    <section className="rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-5">
      <div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-300"/><h2 className="text-xl font-bold">Decoration & emote creator</h2></div>
      <p className="mb-4 text-sm text-muted-foreground">Create a profile decoration and publish it straight to the community shop for your chosen DihCoins price. Emote creation is available to staff in the Moderation tab.</p>
      <div className="mb-4 flex flex-wrap gap-2"><button onClick={()=>{setType("decoration");setImageUrl("");setAudioUrl("");}} className={"rounded-lg px-4 py-2 text-sm font-bold "+(type==="decoration"?"bg-violet-500 text-white":"bg-secondary text-muted-foreground")}>PNG profile decoration</button></div>
      <div className="grid gap-4 md:grid-cols-[1fr_220px]"><div className="space-y-3">
        <label className="block text-xs font-semibold text-muted-foreground">ITEM NAME<input value={name} onChange={e=>setName(e.target.value)} maxLength={40} placeholder="e.g. Neon orbit" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label>
        <label className="block text-xs font-semibold text-muted-foreground">DESCRIPTION<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={180} placeholder="Describe your cosmetic..." rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label>
        <label className="block text-xs font-semibold text-muted-foreground">SHOP PRICE · DIHCOINS<input type="number" min="0" max="100000" value={price} onChange={e=>setPrice(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label>
        <div className="flex flex-wrap gap-2"><input ref={imageInput} type="file" accept={type==="decoration"?".png,.gif,image/png,image/gif":".gif,image/gif"} className="hidden" onChange={e=>handleImage(e.target.files?.[0])}/><button onClick={()=>imageInput.current?.click()} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold"><Upload className="h-4 w-4"/> Upload {type==="decoration"?"PNG or GIF":"GIF"}</button>
          {type==="emote"&&<><input ref={audioInput} type="file" accept=".mp3,audio/mpeg" className="hidden" onChange={e=>handleAudio(e.target.files?.[0])}/><button onClick={()=>audioInput.current?.click()} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold"><Upload className="h-4 w-4"/> Upload MP3</button></>}
        </div>
        {type==="decoration"?<div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted-foreground">Overall scale · {scale}×<input type="range" min="0.2" max="4" step="0.05" value={scale} onChange={e=>setScale(e.target.value)} className="mt-2 w-full"/></label><label className="text-xs text-muted-foreground">Rotation · {rotationAngle}°<input type="range" min="-180" max="180" step="1" value={rotationAngle} onChange={e=>setRotationAngle(e.target.value)} className="mt-2 w-full"/></label><label className="text-xs text-muted-foreground">Width · {scaleX}×<input type="range" min="0.2" max="4" step="0.05" value={scaleX} onChange={e=>setScaleX(e.target.value)} className="mt-2 w-full"/></label><label className="text-xs text-muted-foreground">Height · {scaleY}×<input type="range" min="0.2" max="4" step="0.05" value={scaleY} onChange={e=>setScaleY(e.target.value)} className="mt-2 w-full"/></label></div>:<p className="text-xs text-muted-foreground">{audioUrl?"MP3 loaded · "+audioDuration.toFixed(1)+" seconds · bubble stays for the audio duration":"Upload an MP3 (maximum 20 seconds). The emote bubble disappears when playback ends."}</p>}
      </div>
      <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/60 p-4">{imageUrl?(type==="decoration"?<div className="relative flex h-36 w-36 touch-none items-center justify-center overflow-visible rounded-full border-4 border-violet-300/60 bg-gradient-to-br from-slate-700 to-slate-950 shadow-xl" onPointerMove={moveTransform} onPointerUp={stopTransform} onPointerCancel={stopTransform}>{user?.avatarUrl?<img src={user.avatarUrl} alt="Your profile" className="h-full w-full rounded-full object-cover"/>:<span className="text-2xl font-black text-white/80">{String(user?.username||"YOU").slice(0,2).toUpperCase()}</span>}<div className="absolute inset-0" style={{transform:"translate("+offsetX+"%, "+offsetY+"%)"}}><img src={imageUrl} alt="Profile decoration preview" onPointerDown={e=>startTransform("move",e)} className="absolute inset-0 h-full w-full cursor-move touch-none select-none object-contain" draggable={false} style={{transform:"rotate("+rotationAngle+"deg) scale("+Number(scale)*Number(scaleX)+", "+Number(scale)*Number(scaleY)+")"}}/><div className="pointer-events-none absolute inset-0 border border-dashed border-cyan-300" /><button type="button" title="Drag to enlarge" onPointerDown={e=>startTransform("uniform",e)} className="absolute left-1/2 top-0 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-white bg-cyan-400 shadow-lg pointer-events-auto touch-none"/><button type="button" title="Resize from top left" onPointerDown={e=>startTransform("uniform",e)} className="absolute left-0 top-0 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 border-2 border-white bg-violet-400 pointer-events-auto touch-none"/><button type="button" title="Resize from top right" onPointerDown={e=>startTransform("uniform",e)} className="absolute right-0 top-0 z-20 h-3.5 w-3.5 translate-x-1/2 -translate-y-1/2 border-2 border-white bg-violet-400 pointer-events-auto touch-none"/><button type="button" title="Resize width left" onPointerDown={e=>startTransform("horizontal",e)} className="absolute left-0 top-1/2 z-20 h-5 w-3 -translate-x-1/2 -translate-y-1/2 border border-white bg-cyan-400 pointer-events-auto touch-none"/><button type="button" title="Resize width right" onPointerDown={e=>startTransform("horizontal",e)} className="absolute right-0 top-1/2 z-20 h-5 w-3 translate-x-1/2 -translate-y-1/2 border border-white bg-cyan-400 pointer-events-auto touch-none"/><button type="button" title="Resize height" onPointerDown={e=>startTransform("vertical",e)} className="absolute bottom-0 left-1/2 z-20 h-3 w-5 -translate-x-1/2 translate-y-1/2 border border-white bg-cyan-400 pointer-events-auto touch-none"/><div className="pointer-events-none absolute left-1/2 top-full h-7 w-px -translate-x-1/2 bg-cyan-300"/><button type="button" title="Drag to rotate" onPointerDown={e=>startTransform("rotate",e)} className="pointer-events-auto absolute left-1/2 top-[calc(100%+28px)] z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-fuchsia-400 shadow-lg touch-none"/></div></div>:<div className="flex flex-col items-center gap-2 rounded-xl border border-violet-300/20 bg-black/30 p-3"><img src={imageUrl} alt="Emote preview" className="h-24 w-24 object-contain"/><span className="text-xs font-bold text-violet-200">{name||"Emote preview"}</span><button type="button" disabled={!audioUrl} onClick={()=>playEmote({name:name||"Emote preview",imageUrl,cssStyles:{audioUrl,duration:audioDuration}})} className="rounded-lg bg-violet-500 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-40">Preview GIF + MP3</button></div>):<div className="text-center text-xs text-muted-foreground"><Upload className="mx-auto mb-2 h-7 w-7"/>Your preview appears here</div>}<button disabled={busy||!imageUrl} onClick={publish} className="mt-4 w-full rounded-lg bg-violet-500 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-violet-400 disabled:opacity-40">{busy?"Publishing…":"Publish to shop"}</button></div></div>
    </section>
    <section><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Community marketplace</h2><span className="text-xs text-muted-foreground">{items.length} items</span></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item:any)=>{const owned=isPurchased(item.id);const styles=getStyles(item);return <CyberCard key={item.id} className="overflow-hidden"><div className="flex h-36 items-center justify-center bg-black/20 p-4"><img src={item.imageUrl} alt={item.name} className="max-h-full max-w-full object-contain"/></div><div className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold">{item.name}</h3><p className="mt-1 text-xs text-muted-foreground">{item.description}</p></div><span className="shrink-0 rounded-full bg-amber-400/10 px-2 py-1 text-xs font-bold text-amber-200">{item.price} DC</span></div>
        {owned?(item.type==="emote"?<button onClick={()=>playEmote(item)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-sm font-bold"><Play className="h-4 w-4"/> Play emote</button>:<div className="space-y-2"><button onClick={()=>updateEquippedItem(item)} disabled={Number(item.type==="name_style"?user?.nameStyleId:user?.decorationId)===item.id} className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-bold disabled:cursor-default disabled:opacity-60"><Check className="h-4 w-4"/> {Number(item.type==="name_style"?user?.nameStyleId:user?.decorationId)===item.id?"Equipped":item.type==="name_style"?"Equip name style":"Equip decoration"}</button>{Number(item.type==="name_style"?user?.nameStyleId:user?.decorationId)===item.id&&<button onClick={()=>updateEquippedItem(item,true)} className="w-full rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive hover:bg-destructive/20">Unequip</button>}</div>):<CyberButton onClick={()=>buy(item.id)} className="w-full" disabled={Number(user?.coins||0)<item.price}>Buy for {item.price} DihCoins</CyberButton>}
        {item.type==="emote"&&<p className="text-[10px] text-muted-foreground">Animated GIF + MP3 · {Number(styles.duration||0).toFixed(1)}s</p>}</div></CyberCard>;})}
      {!items.length&&<div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No shop items yet. Create the first one above!</div>}
    </div></section>
  </div></Layout>;
}
