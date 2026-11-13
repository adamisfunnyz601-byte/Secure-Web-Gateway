import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Gift, Loader2, CheckCircle2, XCircle, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { CyberButton } from "@/components/CyberButton";

export default function DihhroGift({ code }: { code: string }) {
  const { user } = useAuth();
  const [,setLocation] = useLocation();
  const [loading,setLoading] = useState(true);
  const [claiming,setClaiming] = useState(false);
  const [error,setError] = useState("");
  const [claimed,setClaimed] = useState(false);
  useEffect(()=>{let active=true;fetch(`/api/dihhro/gift-links/${encodeURIComponent(code)}`).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||"Gift unavailable");}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[code]);
  const claim=async()=>{setClaiming(true);setError("");try{const r=await fetch(`/api/dihhro/gift-links/${encodeURIComponent(code)}/claim`,{method:"POST",credentials:"same-origin"});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||"Could not claim gift");setClaimed(true);}catch(e:any){setError(e.message||"Could not claim gift");}finally{setClaiming(false);}};
  return <main className="min-h-screen flex items-center justify-center bg-[#080b15] p-5 text-white"><section className="w-full max-w-md rounded-3xl border border-fuchsia-400/20 bg-gradient-to-br from-[#17152a] to-[#0c1220] p-8 text-center shadow-2xl shadow-fuchsia-950/30"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10">{loading?<Loader2 className="h-8 w-8 animate-spin text-fuchsia-200"/>:error?<XCircle className="h-8 w-8 text-rose-300"/>:claimed?<CheckCircle2 className="h-8 w-8 text-emerald-300"/>:<Gift className="h-8 w-8 text-fuchsia-200"/>}</div><div className="text-[10px] font-black tracking-[.3em] text-fuchsia-200">NEXUS REWARDS</div><h1 className="mt-3 text-3xl font-black">{claimed?"Dihhro unlocked!":error?"Gift unavailable":"Claim Dihhro for 1 month!"}</h1><p className="mt-3 text-sm leading-relaxed text-slate-400">{claimed?"Your one-month Dihhro membership has been added to your account.":error||"Someone has sent you a one-month Dihhro gift. Claim it to unlock profile gradients, premium fonts and more."}</p>{!loading&&!error&&!claimed&&<div className="mt-7">{user?<CyberButton className="w-full" disabled={claiming} onClick={claim}>{claiming?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Sparkles className="mr-2 h-4 w-4"/>}Claim your month</CyberButton>:<CyberButton className="w-full" onClick={()=>setLocation("/")}>Sign in to claim <ArrowRight className="ml-2 h-4 w-4"/></CyberButton>}</div>}{claimed&&<CyberButton className="mt-7 w-full" onClick={()=>setLocation("/chat")}>Back to chat</CyberButton>}<p className="mt-7 text-[10px] text-slate-600">Each gift link can be claimed once.</p></section></main>;
}
