import { useState, useRef, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { CyberInput } from "@/components/CyberInput";
import { CyberButton } from "@/components/CyberButton";
import { CyberCard } from "@/components/CyberCard";
import { useChat } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import {
  Send, Users, Hash, Phone, Plus, Volume2, Search, Settings,
  ChevronRight, Terminal, Mic, MicOff, Video, VideoOff, X, Pause, Square, Check,
  Download, Cpu, Ghost, Forward, Trash2, Reply, Music,
  Camera, MonitorUp, PhoneOff, Binary, UserPlus, Command,
  Box, TerminalSquare, Bug, Upload, Play, ImageIcon, Film, ShieldCheck, Loader2, Link2, Pencil, Copy, Gift, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileModal, Avatar } from "@/components/ProfileModal";
import { getFontClass, getUsernameGradientStyle } from "@/components/ProfileTextStyle";
import { UserProfileTag } from "@/components/UserProfileTag";
import { EmojiButton } from "@/components/EmojiPicker";

// ============================================================
// CONSTANTS
// ============================================================
const SESSION_CRYPT = "X-256-CHA-CHA-POLY";

// GIF search is proxied through the server so the GIPHY API key stays private.

const DEFAULT_SOUNDS = [
  { id: 'S1', name: 'Neural ping', url: 'https://www.soundjay.com/buttons/sounds/button-20.mp3' },
  { id: 'S2', name: 'Glitch pulse', url: 'https://www.soundjay.com/buttons/sounds/button-3.mp3' },
  { id: 'S3', name: 'Data extract', url: 'https://www.soundjay.com/buttons/sounds/button-10.mp3' },
  { id: 'S4', name: 'Sys alarm', url: 'https://www.soundjay.com/buttons/sounds/button-4.mp3' },
  { id: 'S5', name: 'Static burst', url: 'https://www.soundjay.com/communication/sounds/static-01.mp3' },
  { id: 'S6', name: 'Void beep', url: 'https://www.soundjay.com/communication/sounds/beep-07.mp3' },
  { id: 'S7', name: 'Protocol init', url: 'https://www.soundjay.com/buttons/sounds/button-30.mp3' },
  { id: 'S8', name: 'Terminate', url: 'https://www.soundjay.com/buttons/sounds/button-11.mp3' },
];

// ============================================================
// ADMIN COMMANDS CONFIG
// Edit this section to configure who can use moderation commands.
// IMPORTANT: These are frontend visibility/UX settings only. The API must
// independently verify the authenticated user's owner/admin permissions.
// ============================================================
const ADMIN_COMMANDS_CONFIG = {
  enabled: true,
  // Add owner account IDs here if your user records do not expose role: 'owner'.
  // Example: ownerUserIds: [1, 42]
  ownerUserIds: [] as Array<string | number>,
  // Any matching role grants the frontend owner UI. Keep backend checks authoritative.
  ownerRoles: ['owner', 'OWNER'],
  endpoint: '/api/chat/command',
  moderationDurations: [
    { value: '1m', label: '1 minute' },
    { value: '1h', label: '1 hour' },
    { value: '1hrs', label: '1 hour (1hrs)' },
    { value: '1d', label: '1 day' },
    { value: '1mo', label: '1 month' },
    { value: '1y', label: '1 year' },
    { value: 'null', label: 'Infinite / permanent' },
  ],
  commands: {
    ban: { enabled: true, ownerOnly: true, description: 'Ban a member.' },
    kick: { enabled: true, ownerOnly: true, description: 'Kick a member.' },
    mute: { enabled: true, ownerOnly: true, description: 'Mute a member.' },
  },
} as const;

const MODERATION_DURATIONS = ADMIN_COMMANDS_CONFIG.moderationDurations.map(option => option.value);
const TIMED_MODERATION_COMMANDS = new Set(["ban","tempban","softban","mute","timeout","jail","restrict","shadowban"]);
// Accept custom positive durations: 5m, 12h, 5d, 2w, 5mo, 1y. `null` is permanent.
// `m` means minutes; use `mo` for months to avoid ambiguity.
const isValidModerationDuration = (value: string) =>
  value === 'null' || /^[1-9]\d*(m|min|mins|h|hr|hrs|d|day|days|w|wk|wks|mo|y)$/i.test(value.trim());

// Slash-command help and autocomplete. The server still validates and executes commands.
const MEMBER_COMMAND_NAMES = ["help","me","shrug","roll","flip","nick","sfx","capsI","avatar","profile","serverinfo","userinfo","ping","whoami","rules","invite","coinflip","8ball","choose","quote","uptime"] as const;
const MODERATION_COMMAND_NAMES = ["ban","unban","kick","mute","unmute","timeout","untimeout","warn","warnings","clearwarnings","softban","tempban","permban","shadowban","unshadowban","jail","unjail","deafen","undeafen","freeze","unfreeze","slowmode","slowmodeoff","lock","unlock","lockdown","unlockdown","purge","purgeuser","purgebots","clear","slowchat","unslowchat","note","notes","clearnotes","strike","strikes","clearstrikes","report","reports","resolve","role","promote","demote","nickreset","restrict","unrestrict","unkick"] as const;
const CHAT_COMMANDS = [
  ...MEMBER_COMMAND_NAMES.map(name => ({ name, usage: `/${name}`, description: "Member utility command." })),
  ...MODERATION_COMMAND_NAMES.map(name => ({ name, usage: `/${name} <@user> [duration] [reason]`, description: "Staff moderation command.", ownerOnly: true, options: MODERATION_DURATIONS })),
] as const;

// Keep ordinary swearing allowed. This blocks explicit sexual content, porn terms,
// graphic gore terms, sexual violence, and common hate/identity-attack terms.
const BLOCKED_CHAT_TERMS = [
  'porn', 'hentai', 'xxx', 'onlyfans', 'vore', 'gore', 'guro', 'necrophilia',
  'rape', 'raping', 'molest', 'molestation', 'child porn', 'nude', 'nudes',
  'penis', 'vagina', 'genital', 'genitals', 'dick', 'pussy', 'tits', 'boobs',
  'testicles', 'masturbat', 'blowjob', 'handjob', 'ejaculat', 'orgasm', 'sexting',
  'grope', 'fondle', 'sexual touching',
  'nigger', 'nigga', 'faggot', 'tranny', 'retard', 'kike', 'chink', 'spic',
  'heil hitler', 'white power', 'gas the jews', 'bandu', 'kkk', 'lancy', 'tranny', 'lancy170'
];
const containsBlockedChatContent = (value: string) => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return BLOCKED_CHAT_TERMS.some(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(^|\\s)${escaped}(?=$|\\s)`, 'i').test(normalized);
  });
};

// ============================================================
// TYPES
// ============================================================
interface SoundEntry { id: string; name: string; url: string; }

function LiveAudioVisualizer({ stream, bars = 44, className = "" }: { stream: MediaStream | null; bars?: number; className?: string }) {
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: bars }, () => 3));
  useEffect(() => {
    const track = stream?.getAudioTracks().find(item => item.readyState === "live");
    if (!stream || !track) { setLevels(Array.from({ length: bars }, () => 3)); return; }
    let frame = 0;
    let active = true;
    let context: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      context = new AudioContextClass();
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.68;
      source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      const frequency = new Uint8Array(analyser.frequencyBinCount);
      const waveform = new Uint8Array(analyser.fftSize);
      const draw = () => {
        if (!active || !analyser) return;
        analyser.getByteFrequencyData(frequency);
        analyser.getByteTimeDomainData(waveform);
        let energy = 0;
        for (let i = 0; i < waveform.length; i++) { const sample = (waveform[i] - 128) / 128; energy += sample * sample; }
        const rms = Math.sqrt(energy / waveform.length);
        const gain = Math.min(2.8, 1.15 + rms * 9);
        const next = Array.from({ length: bars }, (_, index) => {
          const low = Math.max(1, Math.floor(Math.pow(index / bars, 2.15) * frequency.length));
          const high = Math.max(low + 1, Math.floor(Math.pow((index + 1) / bars, 2.15) * frequency.length));
          let peak = 0;
          for (let bin = low; bin < Math.min(frequency.length, high); bin++) peak = Math.max(peak, frequency[bin]);
          const normalized = Math.max(0, (peak - 24) / 190) * gain;
          const waveformLift = rms > 0.012 ? Math.min(0.55, rms * 3.5) : 0;
          return Math.max(3, Math.min(34, 3 + (normalized + waveformLift) * 30));
        });
        setLevels(next);
        frame = window.requestAnimationFrame(draw);
      };
      if (context.state === "suspended") context.resume().catch(() => {});
      draw();
    } catch { setLevels(Array.from({ length: bars }, () => 3)); }
    return () => {
      active = false;
      if (frame) window.cancelAnimationFrame(frame);
      source?.disconnect();
      analyser?.disconnect();
      context?.close().catch(() => {});
    };
  }, [stream, bars]);
  return <div className={cn("flex items-center justify-center gap-[3px] overflow-hidden", className)} aria-label="Live microphone frequency visualizer">
    {levels.map((height, index) => <span key={index} className="w-[3px] shrink-0 rounded-full bg-gradient-to-t from-violet-700 via-violet-400 to-fuchsia-200 transition-[height] duration-75" style={{ height: height + "px", opacity: height > 5 ? 1 : .45 }} />)}
  </div>;
}
interface MediaPreview { url: string; type: 'image' | 'video' | 'audio'; name: string; }
interface ForwardTarget { message: any; isOpen: boolean; }
interface IncomingCall { fromId: number; fromName: string; callId: string; withVideo?: boolean; }
type CallState = 'idle' | 'requesting' | 'incoming' | 'connected';
interface LogEntry { id: string; time: string; type: 'info' | 'warn' | 'crit'; msg: string; }

function MessageContent({ content }: { content: string }) {
  const { data: customEmojis = [] } = useQuery<any[]>({
    queryKey: ["/api/emojis"],
    queryFn: async () => { const response = await fetch("/api/emojis", { credentials: "same-origin" }); if (!response.ok) return []; return response.json(); },
    staleTime: 60000,
  });
  const emojiMap = new Map(customEmojis.map((emoji: any) => [emoji.name, emoji.url]));
  const trimmed = content.trim();
  const unicodeCount = (trimmed.match(/\p{Extended_Pictographic}/gu) || []).length;
  const customTokens = trimmed.match(/:[a-z0-9_+-]+:/gi) || [];
  const plainText = trimmed.replace(/:[a-z0-9_+-]+:/gi, "").replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u{1F3FB}-\u{1F3FF}\s]/gu, "");
  const largeEmoji = !plainText && (unicodeCount + customTokens.length) >= 1 && (unicodeCount + customTokens.length) <= 5;
  const parts = content.split(/(:[a-z0-9_+-]+:|@[a-zA-Z0-9_.-]+)/gi);
  return (
    <span className={largeEmoji ? "inline-flex flex-wrap items-center gap-1 text-[2.5rem] leading-tight" : "inline"}>
      {parts.map((part, index) => {
        const emojiName = part.startsWith(":") && part.endsWith(":") ? part.slice(1,-1) : "";
        const emojiUrl = emojiName ? emojiMap.get(emojiName) : null;
        if (emojiUrl) return <img key={index} src={emojiUrl} alt={emojiName} title={part} className={largeEmoji ? "h-10 w-10 object-contain" : "inline-block h-5 w-5 align-[-4px] object-contain"} />;
        if (part.startsWith("@")) return <span key={index} className="rounded bg-violet-500/10 px-0.5 font-semibold text-violet-200">{part}</span>;
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

// ============================================================
// SIDEBAR NODE
// ============================================================
const CyberSidebarNode = ({
  label, isActive, onClick, status = "online"
}: { label: React.ReactNode; isActive: boolean; onClick: () => void; status?: string }) => {
  const statusClass =
    status === "online" ? "bg-green-400 shadow-[0_0_8px_#57f287]" :
    status === "idle" ? "bg-yellow-400 shadow-[0_0_8px_#fee75c]" :
    status === "dnd" ? "bg-red-400 shadow-[0_0_8px_#ed4245]" :
    "bg-gray-500";
  return (
  <motion.button
    whileHover={{ x: 4 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={cn(
      "w-full text-left px-4 py-3 border transition-all duration-200 flex items-center justify-between group mb-1.5",
      isActive
        ? "bg-violet-500/20 border-violet-500 shadow-[0_0_18px_rgba(139,92,246,0.22)]"
        : "bg-transparent border-violet-500/20 opacity-70 hover:opacity-100 hover:bg-violet-500/5"
    )}
  >
    <div className="flex min-w-0 flex-1 items-center gap-3">
       <div className={cn("w-2 h-2 rounded-full", statusClass, isActive && status === "online" && "animate-pulse")} />
      <span className={cn("inline-flex min-w-0 flex-1 items-center gap-2 overflow-hidden font-mono text-[12px] tracking-[0.05em] uppercase", isActive ? "text-violet-200 font-bold" : "text-violet-200/70")}>
        {label}
      </span>
    </div>
    <ChevronRight className={cn("w-3 h-3 transition-all", isActive ? "text-violet-200 opacity-100" : "opacity-0 group-hover:opacity-40")} />
  </motion.button>
  );
};

function LazyMediaAttachment({
  message,
  onPreview,
}: {
  message: any;
  onPreview: (preview: MediaPreview) => void;
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadMedia = async () => {
    if (mediaUrl || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/chat/messages/${message.id}/media`);
      if (!response.ok) throw new Error("Attachment unavailable");
      const data = await response.json();
      setMediaUrl(data.mediaUrl);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (!mediaUrl) {
    return (
      <button
        type="button"
        onClick={loadMedia}
        disabled={loading || error}
        className="mt-2 flex items-center gap-2 rounded-md border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-[10px] text-violet-200 hover:bg-violet-500/10 disabled:opacity-50"
      >
        {loading ? "Loading attachment..." : error ? "Attachment unavailable" : `Load ${message.mediaType || "attachment"}`}
      </button>
    );
  }

  if (message.mediaType === "image") {
    return (
      <img
        src={mediaUrl}
        alt="media"
        onClick={() => onPreview({ url: mediaUrl, type: "image", name: "IMAGE" })}
        className="mt-2 max-w-full max-h-60 object-contain cursor-zoom-in hover:brightness-110 transition-all rounded"
      />
    );
  }
  if (message.mediaType === "video") {
    return <video src={mediaUrl} controls className="mt-2 max-w-full max-h-60 w-full rounded" preload="metadata" />;
  }
  if (message.mediaType === "audio") {
    return (
      <div className="mt-2 flex items-center gap-3">
        <Music className="w-4 h-4 text-violet-200 shrink-0" />
        <audio src={mediaUrl} controls className="h-8 flex-1 accent-violet-400" />
      </div>
    );
  }
  return (
    <a href={mediaUrl} download className="mt-2 inline-flex items-center gap-2 text-[10px] font-mono text-violet-200 underline">
      <Box className="w-4 h-4" /> Download file
    </a>
  );
}

// ============================================================
// TERMINAL MESSAGE
// ============================================================
const TerminalMessage = ({
  msg, isMe, onReply, onForward, onPurge, onMediaPreview, onProfileClick, emoteItem, shouldAutoplayEmote
}: {
  msg: any; isMe: boolean; emoteItem?: any; shouldAutoplayEmote?: boolean;
  onReply: (m: any) => void;
  onForward: (m: any) => void;
  onPurge: (id: number) => void;
  onMediaPreview: (m: MediaPreview) => void;
  onProfileClick: (id: number) => void;
}) => {
  const [showActions, setShowActions] = useState(false);
  const displayName = msg.senderDisplayName || msg.senderNickname || msg.senderName;
  const roleName = String(msg.senderRole || "").toLowerCase().replace(/_/g,"-");
  const roleBadge: Record<string,{label:string;style:string}> = {
    owner:{label:"OWNER",style:"border-amber-300/50 bg-amber-300/10 text-amber-200"},
    admin:{label:"ADMIN",style:"border-red-400/50 bg-red-400/10 text-red-300"},
    "trial-admin":{label:"TRIAL ADMIN",style:"border-orange-300/50 bg-orange-300/10 text-orange-200"},
    moderator:{label:"MOD",style:"border-violet-400/50 bg-violet-400/10 text-violet-200"},
    "trial-moderator":{label:"TRIAL MOD",style:"border-indigo-400/50 bg-indigo-400/10 text-indigo-200"},
    helper:{label:"HELPER",style:"border-sky-400/50 bg-sky-400/10 text-sky-200"},
    "trial-helper":{label:"TRIAL HELPER",style:"border-cyan-400/50 bg-cyan-400/10 text-cyan-200"},
  };
  const staffBadge = roleBadge[roleName];

  if (msg.mediaType === 'sfx') {
    return (
      <div className={cn("flex mb-3", isMe ? "justify-end" : "justify-start")}>
        <div className="flex items-center gap-2 px-3 py-1.5 border border-violet-500/20 bg-violet-500/5 text-[9px] font-mono text-violet-200/50">
          <Volume2 className="w-3 h-3" />
          <span>{isMe ? "You" : displayName} played {msg.content.replace('[SFX:', '').replace(']', '')}</span>
        </div>
      </div>
    );
  }

  const getMediaSection = () => {
    if (!msg.mediaUrl && !msg.hasMedia) return null;
    if (!msg.mediaUrl) {
      return <LazyMediaAttachment message={msg} onPreview={onMediaPreview} />;
    }
    const type = msg.mediaType || '';
    return (
      <div className="mt-3 rounded border border-white/5 overflow-hidden bg-black/40 max-w-xs">
        {type === 'image' && (
          <img
            src={msg.mediaUrl}
            alt="media"
            onClick={() => onMediaPreview({ url: msg.mediaUrl, type: 'image', name: 'IMAGE' })}
            className="max-w-full max-h-60 object-contain cursor-zoom-in hover:brightness-110 transition-all"
          />
        )}
        {type === 'video' && (
          <video src={msg.mediaUrl} controls className="max-w-full max-h-60 w-full" preload="metadata" />
        )}
        {type === 'audio' && (
          <div className="p-3 flex items-center gap-3">
            <Music className="w-4 h-4 text-violet-200 flex-shrink-0" />
            <audio src={msg.mediaUrl} controls className="h-8 flex-1 accent-violet-400" />
          </div>
        )}
        {(type !== 'image' && type !== 'video' && type !== 'audio') && (
          <div className="p-3 flex items-center gap-3">
            <Box className="w-4 h-4 text-violet-200" />
            <a href={msg.mediaUrl} download className="text-[10px] font-mono text-violet-200 underline">Download File</a>
          </div>
        )}
      </div>
    );
  };

  const isForwarded = msg.content?.startsWith('[RELAY] ');
  const displayContent = isForwarded ? msg.content.slice('[RELAY] '.length) : msg.content;
  const chatEmoteMatch = typeof displayContent === "string" ? displayContent.match(/^\[CHAT_EMOTE:(\d+)\]$/) : null;
  let chatEmoteStyles:any = {};
  try { chatEmoteStyles = typeof emoteItem?.cssStyles === "string" ? JSON.parse(emoteItem.cssStyles) : (emoteItem?.cssStyles || {}); } catch {}
  const playedChatEmoteRef = useRef(false);
  useEffect(() => {
    if (!shouldAutoplayEmote || !chatEmoteMatch || !chatEmoteStyles.audioUrl || playedChatEmoteRef.current) return;
    playedChatEmoteRef.current = true;
    const audio = new Audio(chatEmoteStyles.audioUrl);
    audio.volume = 1;
    audio.play().catch(() => {
      // Browsers may block sound until the recipient has interacted with the page.
    });
    return () => { audio.pause(); audio.currentTime = 0; };
  }, [msg.id, chatEmoteMatch?.[1], chatEmoteStyles.audioUrl, shouldAutoplayEmote]);
  const dihhroGiftMatch = typeof displayContent === "string" ? displayContent.match(/https?:\/\/[^\s]+\/gift\/([A-Za-z0-9-]+)/) : null;

  return (
    <div className={cn("chat-message-row flex mb-5 group gap-2 message-motion", `message-motion-${Math.abs(Number(msg.id) || 0) % 120}`, isMe ? "flex-row-reverse" : "flex-row")}>
      <Avatar
        url={msg.senderAvatarUrl}
        name={msg.senderName}
        size={36}
        font={msg.senderUsernameFont}
        onClick={() => onProfileClick(msg.senderId)}
        className="mt-5"
      />
      <div className={cn("flex flex-col flex-1 min-w-0", isMe ? "items-end" : "items-start")}>
        <div className={cn("flex items-center gap-2 mb-1 px-1", isMe ? "flex-row-reverse" : "flex-row")}>
          <button
            onClick={() => onProfileClick(msg.senderId)}
            className={cn("text-[11px] font-bold uppercase hover:underline", getFontClass(msg.senderUsernameFont))}
            style={getUsernameGradientStyle(msg.senderUsernameFont)}
            data-testid={`button-profile-${msg.senderId}`}
          >
            {isMe ? "YOU" : displayName}
          </button>
          <UserProfileTag
            tagSymbol={msg.senderTagSymbol}
            tagText={msg.senderTagText}
            tagColor={msg.senderTagColor}
            size="compact"
          />
          {msg.senderNickname && !isMe && <span className="text-[8px] text-white/20 font-mono">@{msg.senderName}</span>}
          <span className="text-[8px] font-mono text-white/20">
            {format(new Date(msg.createdAt || Date.now()), "HH:mm:ss")}
          </span>
        </div>

      <motion.div
        onDoubleClick={() => setShowActions(true)}
        onContextMenu={e => { e.preventDefault(); setShowActions(true); }}
        className={cn(
          "chat-message-bubble relative p-3 border text-[13px] font-mono transition-all cursor-help max-w-md",
          isMe
            ? "bg-violet-500/5 border-violet-500/30 rounded-l-lg rounded-tr-lg hover:border-violet-500/60"
            : "bg-fuchsia-600/5 border-fuchsia-400/30 rounded-r-lg rounded-tl-lg hover:border-fuchsia-400/60"
        )}
      >
        {/* Forwarded indicator */}
        {isForwarded && (
          <div className="flex items-center gap-1 text-[9px] text-fuchsia-300/50 mb-1.5 font-mono border-b border-fuchsia-400/10 pb-1.5">
            <Forward className="w-3 h-3" /> Forwarded
          </div>
        )}
        {/* Reply quote */}
        {msg.replyToContent && (
          <div className={cn("chat-reply-quote mb-2 overflow-hidden rounded-lg border bg-black/25 shadow-inner",isMe?"border-violet-400/25":"border-fuchsia-400/25")}>
            <div className={cn("flex items-center gap-2 border-l-[3px] px-3 py-2",isMe?"border-violet-400 bg-violet-400/10":"border-fuchsia-400 bg-fuchsia-400/10")}>
              <Reply className="h-3.5 w-3.5 shrink-0 text-violet-200"/>
              <div className="min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-wider text-violet-200">{msg.replyToSenderName || "Reply"}</div>
                <div className="truncate text-[11px] text-white/65">{String(msg.replyToContent).startsWith("[RELAY] ")?String(msg.replyToContent).slice(8):msg.replyToContent}</div>
              </div>
            </div>
          </div>
        )}
        {chatEmoteMatch ? <div className="mt-1 flex max-w-[240px] flex-col items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 p-3">{emoteItem?.imageUrl ? <img src={emoteItem.imageUrl} alt={emoteItem.name || "Chat emote"} className="max-h-36 max-w-full object-contain"/> : <span className="text-xs text-violet-200/60">Loading emote…</span>}<span className="text-[10px] font-bold text-violet-100">{emoteItem?.name || "Emote"}</span></div> : displayContent && <div className="whitespace-pre-wrap leading-relaxed select-text break-words"><MessageContent content={displayContent} /></div>}
        {dihhroGiftMatch && <a href={dihhroGiftMatch[0]} target="_blank" rel="noreferrer" className="mt-3 block max-w-sm rounded-xl border border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-500/15 to-violet-500/10 p-3 no-underline transition hover:border-fuchsia-300/60"><div className="flex items-center gap-2 text-[10px] font-black tracking-[.18em] text-fuchsia-200"><Gift className="h-4 w-4"/> NEXUS DIHHRO GIFT</div><div className="mt-1 text-sm font-bold text-white">Claim Dihhro for 1 month!</div><div className="mt-1 text-[10px] text-fuchsia-100/60">Single-use gift · Open to claim</div></a>}
        {getMediaSection()}

        <AnimatePresence>
          {showActions && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
              <motion.div
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                className={cn(
                  "absolute z-50 bottom-full mb-2 flex flex-col bg-black border border-violet-500/40 p-1 shadow-2xl min-w-[110px]",
                  isMe ? "right-0" : "left-0"
                )}
              >
                <button onClick={() => { onReply(msg); setShowActions(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-violet-200 hover:bg-violet-500/20 font-bold uppercase">
                  <Reply className="w-3 h-3" /> Reply
                </button>
                <button onClick={() => { onForward(msg); setShowActions(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-fuchsia-300 hover:bg-fuchsia-600/20 font-bold uppercase border-t border-white/5">
                  <Forward className="w-3 h-3" /> Relay
                </button>
                {isMe && (
                  <button onClick={() => { onPurge(msg.id); setShowActions(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-red-500 hover:bg-red-500/20 font-bold uppercase border-t border-white/5">
                    <Trash2 className="w-3 h-3" /> Purge
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
      </div>
    </div>
  );
};

// ============================================================
// MAIN CHAT COMPONENT
// ============================================================
export default function Chat() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  // --- CHANNEL STATE ---
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const { messages, users, sendMessage, isLoadingMessages } = useChat({
    recipientId: selectedRecipientId,
    groupId: selectedGroupId,
  });

  // --- MODAL STATE ---
  const [showEveryoneList, setShowEveryoneList] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinGroupCode, setJoinGroupCode] = useState("");
  const [newGroupIcon, setNewGroupIcon] = useState("💬");
  const [showManageGroupModal, setShowManageGroupModal] = useState(false);
  const [manageGroupName, setManageGroupName] = useState("");
  const [manageGroupIcon, setManageGroupIcon] = useState("💬");
  const [inviteLinkPreview, setInviteLinkPreview] = useState("");

  // --- MESSAGE STATE ---
  const [inputContent, setInputContent] = useState("");
  const [commandSelection, setCommandSelection] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [capsIEnabled, setCapsIEnabled] = useState(false);
  const [localMuteUntil, setLocalMuteUntil] = useState(0);
  const [replyTarget, setReplyTarget] = useState<any>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [forwardState, setForwardState] = useState<ForwardTarget>({ message: null, isOpen: false });
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showChatEmotePicker, setShowChatEmotePicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState("");
  const gifSearchAbortRef = useRef<AbortController | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // --- CALL STATE ---
  const [callState, setCallState] = useState<CallState>('idle');
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callTime, setCallTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [visualizerStream, setVisualizerStream] = useState<MediaStream | null>(null);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [callTargetName, setCallTargetName] = useState("");


  // --- GROUP CALL STATE (separate mesh; leaves 1:1 calling untouched) ---
  const [groupCallId,setGroupCallId]=useState<string|null>(null);
  const [groupCallGroupId,setGroupCallGroupId]=useState<number|null>(null);
  const [activeGroupCallTab,setActiveGroupCallTab]=useState<number|null>(null);
  const [groupCallParticipants,setGroupCallParticipants]=useState<Array<{userId:number;username:string}>>([]);
  const [incomingGroupCall,setIncomingGroupCall]=useState<any>(null);
  const [showGroupCallInvites,setShowGroupCallInvites]=useState(false);
  const [groupInviteUsers,setGroupInviteUsers]=useState<Array<{userId:number;username:string}>>([]);
  const [groupCallWithVideo,setGroupCallWithVideo]=useState(false);
  const groupPeersRef=useRef<Map<number,RTCPeerConnection>>(new Map());
  const groupLocalStreamRef=useRef<MediaStream|null>(null);
  const groupCallIdRef=useRef<string|null>(null);
  const groupPendingIceRef=useRef<Map<number,RTCIceCandidateInit[]>>(new Map());
  const groupCallActiveRef=useRef(false);

  const groupVoicePost=async(path:string,body:any)=>{
    const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),credentials:"same-origin"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.message||"Group call request failed.");
    return data;
  };
  const sendGroupPeerSignal=(to:number,signal:any)=>{
    if(!groupCallIdRef.current)return;
    groupVoicePost("/api/chat/group-voice/signal",{roomId:groupCallIdRef.current,to,signal}).catch((error:any)=>pushLog("GROUP_SIGNAL_FAILED: "+error.message,"warn"));
  };
  const createGroupPeer=async(peerId:number,username:string)=>{
    const existing=groupPeersRef.current.get(peerId);
    if(existing)return existing;
    let stream=groupLocalStreamRef.current;
    if(!stream){
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:groupCallWithVideo?{facingMode:"user"}:false});
      groupLocalStreamRef.current=stream;
    }
    const peer=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
    stream.getTracks().forEach(track=>peer.addTrack(track,stream!));
    peer.onicecandidate=event=>{if(event.candidate)sendGroupPeerSignal(peerId,{type:"ice",candidate:event.candidate.toJSON()});};
    peer.ontrack=event=>{
      setGroupCallParticipants(current=>current.map(person=>person.userId===peerId?{...person,stream:(person as any).stream||new MediaStream()}:person));
      const remote=(groupRemoteStreamsRef.current.get(peerId)||new MediaStream());
      groupRemoteStreamsRef.current.set(peerId,remote);
      if(!remote.getTracks().some(track=>track.id===event.track.id))remote.addTrack(event.track);
      if(event.track.kind==="audio")event.track.enabled=true;
      setGroupRemoteVersion(v=>v+1);
    };
    peer.onconnectionstatechange=()=>{if(peer.connectionState==="failed")pushLog("GROUP_PEER_FAILED: "+username,"warn");};
    groupPeersRef.current.set(peerId,peer);
    return peer;
  };
  const groupRemoteStreamsRef=useRef<Map<number,MediaStream>>(new Map());
  const [groupRemoteVersion,setGroupRemoteVersion]=useState(0);

  const startGroupCall=async(withVideo=false)=>{
    if(!selectedGroupId||callStateRef.current!=="idle"||groupCallIdRef.current)return;
    try{
      setGroupCallWithVideo(withVideo);
      const created=await groupVoicePost("/api/chat/group-voice/start",{groupId:selectedGroupId,withVideo});
      groupCallIdRef.current=created.roomId;setGroupCallId(created.roomId);setGroupCallGroupId(selectedGroupId);groupCallActiveRef.current=true;
      setGroupCallParticipants([{userId:Number(currentUserId),username:(currentUser as any)?.username||"You"}]);setActiveGroupCallTab(Number(currentUserId));
      const local=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:withVideo?{facingMode:"user"}:false});
      groupLocalStreamRef.current=local;setVisualizerStream(local);setCallTime(0);
      pushLog("GROUP_CALL_STARTED","info");
    }catch(error:any){toast({title:"GROUP_CALL_FAILED",description:error.message||"Could not start group call.",variant:"destructive"});await leaveGroupCall();}
  };
  const joinGroupCall=async(invite:any)=>{
    try{
      if(callStateRef.current!=="idle"||groupCallIdRef.current)throw new Error("Finish your current call first.");
      setGroupCallWithVideo(Boolean(invite.withVideo));
      const joined=await groupVoicePost("/api/chat/group-voice/join",{roomId:invite.roomId});
      groupCallIdRef.current=joined.roomId;setGroupCallId(joined.roomId);setGroupCallGroupId(Number(invite.groupId));groupCallActiveRef.current=true;setIncomingGroupCall(null);
      const local=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:joined.withVideo?{facingMode:"user"}:false});
      groupLocalStreamRef.current=local;setVisualizerStream(local);
      setGroupCallParticipants([{userId:Number(currentUserId),username:(currentUser as any)?.username||"You"},...joined.participants]);setActiveGroupCallTab(joined.participants[0]?.userId??Number(currentUserId));
      for(const person of joined.participants){
        const peer=await createGroupPeer(person.userId,person.username);
        const offer=await peer.createOffer();await peer.setLocalDescription(offer);
        sendGroupPeerSignal(person.userId,{type:"offer",offer:peer.localDescription});
      }
      pushLog("JOINED_GROUP_CALL","info");
    }catch(error:any){toast({title:"GROUP_CALL_FAILED",description:error.message||"Could not join.",variant:"destructive"});}
  };
const openGroupInvitePicker=async()=>{setShowGroupCallInvites(v=>!v);const inviteGroupId=groupCallGroupId||selectedGroupId;if(!inviteGroupId)return;try{const response=await fetch("/api/chat/group-voice/members?groupId="+inviteGroupId,{credentials:"same-origin"});if(!response.ok)throw new Error("Could not load group members.");setGroupInviteUsers(await response.json());}catch(error:any){toast({title:"INVITE_LIST_FAILED",description:error.message,variant:"destructive"});}};
  const inviteToGroupCall=async(userId:number)=>{
    if(!groupCallIdRef.current)return;
    try{await groupVoicePost("/api/chat/group-voice/invite",{roomId:groupCallIdRef.current,userId});toast({title:"INVITE_SENT"});}
    catch(error:any){toast({title:"INVITE_FAILED",description:error.message,variant:"destructive"});}
  };
  const leaveGroupCall=async()=>{
    const roomId=groupCallIdRef.current;
    groupCallActiveRef.current=false;groupCallIdRef.current=null;setGroupCallId(null);
    if(roomId)groupVoicePost("/api/chat/group-voice/leave",{roomId}).catch(()=>{});
    groupPeersRef.current.forEach(peer=>peer.close());groupPeersRef.current.clear();groupRemoteStreamsRef.current.clear();groupPendingIceRef.current.clear();
    groupLocalStreamRef.current?.getTracks().forEach(track=>track.stop());groupLocalStreamRef.current=null;
    setGroupCallParticipants([]);setActiveGroupCallTab(null);setGroupCallGroupId(null);setGroupRemoteVersion(v=>v+1);setVisualizerStream(null);setShowGroupCallInvites(false);
  };

  // --- SOUNDBOARD STATE ---
  const [customSounds, setCustomSounds] = useState<SoundEntry[]>([]);
  const [sounds, setSounds] = useState<SoundEntry[]>(DEFAULT_SOUNDS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState(false);
  const [callSoundboardOpen, setCallSoundboardOpen] = useState(false);
  const [callEmoteOpen, setCallEmoteOpen] = useState(false);
  const [remoteCallEmote, setRemoteCallEmote] = useState<any>(null);
  const [remoteAudioVersion, setRemoteAudioVersion] = useState(0);

  // --- LOGS ---
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const pushLog = (msg: string, type: LogEntry['type'] = 'info') => {
    setLogs(p => [{ id: Math.random().toString(), time: new Date().toLocaleTimeString(), type, msg }, ...p].slice(0, 30));
  };

  // --- REFS ---
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const peerSetupPromiseRef = useRef<Promise<RTCPeerConnection> | null>(null);
  const callPeerIdRef = useRef<number | null>(null);
  const callInitiatorRef = useRef(false);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const callClockRef = useRef<NodeJS.Timeout | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const soundFileInputRef = useRef<HTMLInputElement>(null);
  const callIdRef = useRef<string | null>(null);
  const callStateRef = useRef<CallState>('idle');
  const autoDeclineTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedSfxRef = useRef(false);

  // --- DATA FETCHING ---
  const { data: groups = [] } = useQuery<any[]>({ queryKey: ['/api/chat/groups'] });
  const { data: callEmoteInventory = [] } = useQuery<any[]>({
    queryKey: ["/api/shop/inventory"],
    queryFn: async () => { const response = await fetch("/api/shop/inventory", { credentials: "same-origin" }); return response.ok ? response.json() : []; },
    staleTime: 20000,
  });
  const { data: chatEmoteItems = [] } = useQuery<any[]>({
    queryKey: ["/api/shop/items", "chat-emotes"],
    queryFn: async () => { const response = await fetch("/api/shop/items", { credentials: "same-origin" }); return response.ok ? response.json() : []; },
    staleTime: 20000,
  });
  const { data: userConfig, refetch: refetchConfig } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => (await fetch('/api/auth/me')).json()
  });
  const configUser = (userConfig as any)?.user || userConfig as any;
  const currentUserId = (currentUser as any)?.id ?? (configUser as any)?.id;
  const currentUserRole = (currentUser as any)?.role ?? (configUser as any)?.role;
  const isConfiguredOwner = currentUserId != null && ADMIN_COMMANDS_CONFIG.ownerUserIds
    .some(id => String(id) === String(currentUserId));
  const hasConfiguredOwnerRole = ADMIN_COMMANDS_CONFIG.ownerRoles
    .some(role => role === currentUserRole);
  const isOwner = ADMIN_COMMANDS_CONFIG.enabled && Boolean(
    (currentUser as any)?.isOwner || (configUser as any)?.isOwner ||
    isConfiguredOwner || hasConfiguredOwnerRole
  );
  const staffRoles = ['owner','admin','trial-admin','moderator','trial-moderator','helper','trial-helper'];
  const isStaff = staffRoles.includes(String(currentUserRole || '').toLowerCase().replace(/_/g,'-'));
  const canUseAdminCommand = (_name: string) => ADMIN_COMMANDS_CONFIG.enabled && isStaff;
  const canGiftDihhro = ["owner","admin"].includes(String(currentUserRole || "").toLowerCase());
  // Treat configured owner IDs and owner-role accounts as immune to automatic chat filtering
  // and to moderation commands. The server MUST enforce the same rule independently.
  const isProtectedOwner = (user: any) => {
    if (!user) return false;
    const userRole = user.role ?? user.accountRole;
    return Boolean(
      user.isOwner || ADMIN_COMMANDS_CONFIG.ownerRoles.some(role => role === userRole) ||
      ADMIN_COMMANDS_CONFIG.ownerUserIds.some(id => String(id) === String(user.id))
    );
  };
  const findModerationTarget = (raw: string) => {
    const value = raw.replace(/^@/, '').trim().toLowerCase();
    if (!value) return undefined;
    return (users || []).find((user: any) =>
      [user.username, user.displayName, user.nickname, String(user.id)]
        .filter(Boolean).some((candidate: string) => String(candidate).toLowerCase() === value)
    );
  };

  const updateProfile = useMutation({
    mutationFn: async (s: any) => fetch('/api/user/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s)
    }),
    onSuccess: () => refetchConfig()
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/chat/messages/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.chat.list.path] });
    }
  });

  const createGroupMutation = useMutation({
    mutationFn: async (payload: { name: string; icon: string }) => {
      const res = await fetch('/api/chat/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.text()) || "Failed to create group");
      return res.json();
    },
    onSuccess: (g) => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/groups'] });
      setShowCreateGroupModal(false);
      setNewGroupName("");
      setNewGroupIcon("💬");
      selectGroupNode(g.id);
      toast({ title: "CLUSTER_ONLINE", description: `${g.name} initialized.` });
    }
  });

  const joinGroupMutation = useMutation({
    mutationFn: async (rawCode: string) => {
      // Accept either a short invite code or a complete shared URL.
      let code = rawCode.trim();
      try {
        if (/^https?:\/\//i.test(code)) {
          const parsed = new URL(code);
          code = parsed.pathname.match(/\/invite\/([^/]+)/i)?.[1] || parsed.searchParams.get('code') || code;
        } else {
          code = code.replace(/^\/?invite\//i, '').replace(/^\//, '');
        }
      } catch { /* pass the raw value to the server for validation */ }
      const res = await fetch('/api/chat/groups/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inviteCode: code }) });
      if (!res.ok) throw new Error("Invalid or expired invite link");
      return res.json();
    },
    onSuccess: (g) => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/groups'] });
      setShowJoinGroupModal(false);
      setJoinGroupCode("");
      selectGroupNode(g.id);
      toast({ title: "CLUSTER_ACCESSED", description: `Joined ${g.name}` });
    },
    onError: () => toast({ title: "INVALID_INVITE", description: "Check the invite link or code and try again.", variant: "destructive" })
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, name, icon }: { id: number; name: string; icon: string }) => {
      const res = await fetch(`/api/chat/groups/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon })
      });
      if (!res.ok) throw new Error((await res.text()) || 'Could not update group');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/groups'] });
      setShowManageGroupModal(false);
      toast({ title: 'GROUP_UPDATED', description: 'Your group details have been saved.' });
    },
    onError: () => toast({ title: 'UPDATE_FAILED', description: 'The server could not save these group changes. Check that the group update endpoint supports name and icon.', variant: 'destructive' })
  });

  // If someone opens /invite/CODE directly, pre-fill the join flow automatically.
  useEffect(() => {
    const match = window.location.pathname.match(/\/invite\/([^/]+)/i);
    if (match?.[1]) {
      setJoinGroupCode(decodeURIComponent(match[1]));
      setShowJoinGroupModal(true);
    }
  }, []);

  // ============================================================
  // CHANNEL SELECTION
  // ============================================================
  const selectBroadcast = () => { setSelectedRecipientId(null); setSelectedGroupId(null); pushLog("CHANNEL: BROADCAST_HUB"); };
  const selectPrivateNode = (id: number) => { setSelectedGroupId(null); setSelectedRecipientId(id); pushLog(`CHANNEL: DM_${id}`); };
  const selectGroupNode = (id: number) => { setSelectedRecipientId(null); setSelectedGroupId(id); pushLog(`CHANNEL: GROUP_${id}`); };

  // ============================================================
  // USER MAP — avatar/nickname/font lookup by userId (avoids putting blob data in every message row)
  // ============================================================
  const usersMap = useMemo(() => {
    const m = new Map<number, any>();
    if (users) (users as any[]).forEach((u: any) => m.set(u.id, u));
    return m;
  }, [users]);

  // Suppress emote sounds for messages that already existed when a channel is opened.
  // Only messages arriving after the initial channel history has loaded should autoplay.
  const chatEmoteBaselineRef = useRef<{ channelKey: string; maxId: number } | null>(null);
  const activeChatChannelKey = selectedGroupId ? `group:${selectedGroupId}` : selectedRecipientId ? `dm:${selectedRecipientId}` : "broadcast";
  if (!isLoadingMessages && messages && chatEmoteBaselineRef.current?.channelKey !== activeChatChannelKey) {
    chatEmoteBaselineRef.current = {
      channelKey: activeChatChannelKey,
      maxId: (messages as any[]).reduce((max, message) => Math.max(max, Number(message.id) || 0), 0),
    };
  }

  // ============================================================
  // MESSAGE FILTERING
  // ============================================================
  const unifiedMessages = useMemo(() => {
    if (!messages) return [];
    return messages.filter((m: any) => {
      if (selectedGroupId) return m.groupId === selectedGroupId;
      if (selectedRecipientId) {
        return (m.senderId === currentUser?.id && m.recipientId === selectedRecipientId) ||
          (m.senderId === selectedRecipientId && m.recipientId === currentUser?.id);
      }
      return !m.groupId && !m.recipientId;
    }).sort((a: any, b: any) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime())
    .map((m: any) => {
      const u = usersMap.get(m.senderId);
      return {
        ...m,
        senderDisplayName: u?.displayName ?? null,
        senderAvatarUrl: u?.avatarUrl ?? null,
        senderNickname: u?.nickname ?? null,
        senderPronouns: u?.pronouns ?? null,
        senderPresenceStatus: u?.presenceStatus ?? "offline",
        senderUsernameFont: u?.usernameFont ?? null,
        senderTagSymbol: u?.tagSymbol ?? null,
        senderTagText: u?.tagText ?? null,
        senderTagColor: u?.tagColor ?? null,
      };
    });
  }, [messages, selectedGroupId, selectedRecipientId, currentUser?.id, usersMap]);

  // ============================================================
  // AUTO-PLAY SFX FROM OTHER USERS
  // ============================================================
  const lastSfxIdRef = useRef<number>(0);

  // Initialize lastSfxIdRef to current max message ID on first load (so we don't replay old sounds)
  useEffect(() => {
    if (!messages || hasInitializedSfxRef.current) return;
    hasInitializedSfxRef.current = true;
    const maxId = messages.reduce((max: number, m: any) => Math.max(max, m.id || 0), 0);
    lastSfxIdRef.current = maxId;
  }, [messages]);

  // Watch ALL messages for SFX (not just current channel) so sounds fire regardless of active tab
  useEffect(() => {
    if (!messages || !hasInitializedSfxRef.current) return;
    const sfxMsgs = (messages as any[]).filter((m: any) => m.mediaType === 'sfx' && m.senderId !== currentUser?.id);
    const newest = sfxMsgs[sfxMsgs.length - 1];
    if (newest && newest.id > lastSfxIdRef.current) {
      lastSfxIdRef.current = newest.id;
      if (newest.mediaUrl) {
        const a = new Audio(newest.mediaUrl);
        a.volume = 0.75;
        a.play().catch(() => {
          // Autoplay blocked — show toast instead
          pushLog(`SFX_BLOCKED (autoplay): ${newest.content}`, 'warn');
        });
        pushLog(`SFX_RECEIVED: ${newest.content}`, 'info');
      }
    }
  }, [messages]);

  // ============================================================
  // FILE UPLOAD HANDLER
  // ============================================================
  const handleFileSelect = (file: File | null) => {
    if (!file) { setUploadFile(null); setUploadPreview(null); return; }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "FILE_TOO_LARGE", description: "Max 20MB allowed.", variant: "destructive" });
      return;
    }
    setUploadFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ============================================================
  // GIF PICKER (GIPHY API via authenticated server proxy)
  // ============================================================
  const searchGifs = async (query = gifSearch) => {
    const term = query.trim() || "reaction";
    gifSearchAbortRef.current?.abort();
    const controller = new AbortController();
    gifSearchAbortRef.current = controller;
    setGifLoading(true);
    setGifError("");
    setGifResults([]);
    try {
      const params = new URLSearchParams({ q: term, limit: "24" });
      const response = await fetch(`/api/gifs/search?${params.toString()}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || `GIF search failed (HTTP ${response.status}).`);
      const results = Array.isArray(payload?.data) ? payload.data : [];
      setGifResults(results);
      if (!results.length) setGifError("No matching GIFs found. Try another search.");
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        setGifError(error?.message || "Couldn't reach GIPHY. Please try again.");
      }
    } finally {
      if (gifSearchAbortRef.current === controller) {
        gifSearchAbortRef.current = null;
        setGifLoading(false);
      }
    }
  };

  useEffect(() => () => gifSearchAbortRef.current?.abort(), []);

  const sendGif = (gif: any) => {
    const url = gif?.url;
    if (!url) {
      toast({ title: "GIF unavailable", description: "This GIF doesn't have a usable embed URL.", variant: "destructive" });
      return;
    }
    sendMessage.mutate({
      content: "",
      recipientId: selectedRecipientId ?? undefined,
      groupId: selectedGroupId ?? undefined,
      mediaUrl: url,
      mediaType: "image",
      replyToId: replyTarget?.id ?? null,
    } as any);
    setReplyTarget(null);
    setShowGifPicker(false);
    setGifSearch("");
    toast({ title: "GIF sent", description: "Your GIF was added to the chat." });
  };

  // ============================================================
  // SEND MESSAGE
  // ============================================================
  const handleTransmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputContent.trim() && !uploadFile) return;

    // Slash commands are sent to the chat command API instead of being posted as messages.
    const commandText = inputContent.trim();
    let messageContent = inputContent;
    const commandParts = commandText.match(/^\/(\S+)(?:\s+(.*))?$/);
    const commandName = commandParts?.[1]?.toLowerCase();
    const commandArgs = (commandParts?.[2] || '').trim();
    if (commandName && MODERATION_COMMAND_NAMES.includes(commandName as any) && !canUseAdminCommand(commandName as keyof typeof ADMIN_COMMANDS_CONFIG.commands)) {
      toast({ title: 'OWNER ONLY', description: 'Only staff members can use this command.', variant: 'destructive' });
      return;
    }
    if (commandName === 'capsi') {
      const value = commandArgs.toLowerCase();
      if (value !== 'true' && value !== 'false') {
        toast({ title: 'Usage', description: '/capsI true or /capsI false', variant: 'destructive' });
        return;
      }
      try {
        const response = await fetch(ADMIN_COMMANDS_CONFIG.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: commandText }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.message || `Command failed (${response.status})`);
        setCapsIEnabled(value === 'true');
        setInputContent('');
        toast({ title: 'capsI updated', description: value === 'true' ? 'The 1-in-50 I effect is enabled.' : 'The I effect is disabled.' });
      } catch (error: any) {
        toast({ title: 'Command failed', description: error?.message || 'Could not update capsI.', variant: 'destructive' });
      }
      return;
    }
    if (commandName && MODERATION_COMMAND_NAMES.includes(commandName as any)) {
      const pieces = commandArgs.split(/\s+/).filter(Boolean);
      const targetToken = pieces[0] || '';
      const duration = (pieces[1] || '').toLowerCase();
      const targetUser = findModerationTarget(targetToken);
      const durationCommands = ['ban','tempban','permban','softban','mute','timeout','jail','restrict','shadowban'];
      const roleCommand = commandName === 'role' || commandName === 'promote' || commandName === 'demote';
      if (!targetToken || (durationCommands.includes(commandName) && (!pieces[1] || !isValidModerationDuration(duration))) || (roleCommand && !pieces[1])) {
        toast({ title: 'Missing or invalid arguments', description: roleCommand ? 'Usage: /role @username admin|trial-admin|moderator|trial-moderator|helper|trial-helper|user' : durationCommands.includes(commandName) ? `Usage: /${commandName} @username 5m|1hrs|5d|2w|5mo|1y|null [reason]` : `Usage: /${commandName} @username [reason]`, variant: 'destructive' });
        return;
      }
      if (!targetUser) {
        toast({ title: 'User not found', description: `I couldn't find ${targetToken}. Use their exact username, or choose them from the suggestions.`, variant: 'destructive' });
        return;
      }
      if (isProtectedOwner(targetUser)) {
        toast({ title: 'Owner protected', description: 'Owners cannot be banned, kicked or muted.', variant: 'destructive' });
        return;
      }
    }
    // Owners are exempt from the client-side content filter and its automatic timeout.
    if (!isOwner && !commandText.startsWith('/') && containsBlockedChatContent(inputContent)) {
      const until = Date.now() + 5 * 60 * 1000;
      setLocalMuteUntil(until);
      setInputContent('');
      toast({ title: 'Message blocked · 5 minute mute', description: 'That message contains content prohibited by the server rules. Your message was not sent.', variant: 'destructive' });
      // Notify the server so it can enforce the timeout across devices. The server must validate this endpoint.
      fetch('/api/chat/moderation/flag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'prohibited-content', durationSeconds: 300 }) }).catch(() => {});
      return;
    }
    if (!isOwner && Date.now() < localMuteUntil && !commandText.startsWith('/')) {
      toast({ title: 'You are muted', description: `Try again in ${Math.ceil((localMuteUntil - Date.now()) / 1000)} seconds.`, variant: 'destructive' });
      return;
    }
    if (capsIEnabled && !commandText.startsWith('/') && Math.random() < 1 / 50) {
      // The effect only changes lowercase i characters; it never changes message meaning otherwise.
      messageContent = messageContent.replace(/i/g, 'I');
    }
    if (commandText === '/help') {
      setInputContent("");
      toast({
        title: 'CHAT COMMANDS',
        description: CHAT_COMMANDS.filter(command => {
          if ('ownerOnly' in command && command.ownerOnly) {
            const adminName = command.name as keyof typeof ADMIN_COMMANDS_CONFIG.commands;
            return canUseAdminCommand(adminName);
          }
          return true;
        }).map(command => command.usage).join('  •  '),
      });
      return;
    }

    if (commandText.startsWith('/') && !uploadFile) {
      setInputContent("");
      try {
        const response = await fetch(ADMIN_COMMANDS_CONFIG.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify((commandName && MODERATION_COMMAND_NAMES.includes(commandName as any))
            ? (() => {
                const pieces = commandArgs.split(/\s+/).filter(Boolean);
                const target = findModerationTarget(pieces[0]);
                return { text: commandText, command: commandName, targetUserId: target?.id, targetUsername: target?.username, duration: pieces[1], reason: pieces.slice(2).join(' ') };
              })()
            : { text: commandText }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result?.message || `Command failed (${response.status})`);
        }
        toast({ title: 'Command', description: result?.message || 'Command executed.' });
      } catch (error: any) {
        toast({
          title: 'Command failed',
          description: error?.message || 'The command could not be executed.',
          variant: 'destructive',
        });
      }
      return;
    }

    let mediaUrl: string | null = null;
    let mediaType: string | null = null;

    if (uploadFile) {
      mediaUrl = uploadPreview;
      const t = uploadFile.type;
      if (t.startsWith('image/')) mediaType = 'image';
      else if (t.startsWith('video/')) mediaType = 'video';
      else if (t.startsWith('audio/')) mediaType = 'audio';
      else mediaType = 'file';
    }

    sendMessage.mutate({
      content: messageContent || (uploadFile ? '' : ''),
      recipientId: selectedRecipientId ?? undefined,
      groupId: selectedGroupId ?? undefined,
      mediaUrl,
      mediaType,
      replyToId: replyTarget?.id ?? null,
    } as any);

    setInputContent("");
    setUploadFile(null);
    setUploadPreview(null);
    setReplyTarget(null);
  };

  // ============================================================
  // SOUNDBOARD
  // ============================================================
  const handlePlaySound = async (sound: SoundEntry) => {
    const a = new Audio(sound.url);
    a.volume = 0.7;
    a.play().catch(() => {});
    pushLog(`SFX_LOCAL: ${sound.name}`);

    await fetch('/api/chat/soundboard/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        soundUrl: sound.url,
        soundName: sound.name,
        recipientId: selectedRecipientId ?? null,
        groupId: selectedGroupId ?? null,
      })
    });
    queryClient.invalidateQueries({ queryKey: [api.chat.list.path] });
  };

  const handleImportSound = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const newSound: SoundEntry = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, "").toUpperCase().slice(0, 16),
        url: reader.result as string
      };
      setSounds(prev => [...prev, newSound]);
      toast({ title: "SOUND_IMPORTED", description: newSound.name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Keep callStateRef in sync so the unified poll closure has fresh state
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // ============================================================
  // CALLING SYSTEM — WebRTC peer-to-peer audio/video
  // ============================================================
  const postVoiceSignal = async (path: string, body: any) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error((await response.text()) || 'Call signalling failed');
    return response.json().catch(() => ({}));
  };

  const stopAllCallMedia = () => {
    try { peerConnectionRef.current?.close(); } catch {}
    peerConnectionRef.current = null;
    peerSetupPromiseRef.current = null;
    pendingIceCandidatesRef.current = [];
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    remoteStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    setVisualizerStream(null);
    remoteStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setHasRemoteVideo(false);
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (callClockRef.current) clearInterval(callClockRef.current);
    callClockRef.current = null;
    callPeerIdRef.current = null;
    setCallTime(0);
    setIsMuted(false);
    setIsVideoOn(false);
    setIsSharingScreen(false);
  };

  const createPeerConnection = async (): Promise<RTCPeerConnection> => {
    if (peerSetupPromiseRef.current) return peerSetupPromiseRef.current;
    if (peerConnectionRef.current && localStreamRef.current) return peerConnectionRef.current;
    const setup = (async () => {
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      // Reserve a negotiated video sender even for audio-first calls so enabling
      // the camera later does not require an unsupported renegotiation.
      if (!isVideoOn) peer.addTransceiver("video", { direction: "sendrecv" });
      peerConnectionRef.current = peer;
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: isVideoOn ? { facingMode: 'user' } : false,
        });
      } catch (mediaError) {
        if (!isVideoOn) throw mediaError;
        // Keep the call working as audio-only if the camera is unavailable/denied.
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        setIsVideoOn(false);
        toast({ title: 'Camera unavailable', description: 'Connected with microphone only.' });
      }
      localStreamRef.current = stream;
      setVisualizerStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(() => {});
      }
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      peer.ontrack = event => {
      const remote = remoteStreamRef.current || new MediaStream();
      remoteStreamRef.current = remote;
      // Keep the live visualizer attached to this user's microphone stream.
      if (!remote.getTracks().some(track => track.id === event.track.id)) remote.addTrack(event.track);
      if (event.track.kind === 'audio') { event.track.enabled = true; setRemoteAudioVersion(version => version + 1); }
      if (event.track.kind === 'video') setHasRemoteVideo(true);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remote;
        remoteVideoRef.current.play().catch(() => {});
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remote;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = 1;
        remoteAudioRef.current.play().catch(error => pushLog(`REMOTE_AUDIO_PLAY_BLOCKED: ${error?.message || error}`, 'warn'));
      }
    };
    peer.onicecandidate = event => {
      if (event.candidate && callPeerIdRef.current != null && callIdRef.current) {
        postVoiceSignal('/api/chat/voice/ice', {
          callId: callIdRef.current,
          recipientId: callPeerIdRef.current,
          candidate: event.candidate.toJSON(),
        }).catch(error => pushLog(`ICE_SEND_FAILED: ${String(error)}`, 'warn'));
      }
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        pushLog(`WEBRTC_${peer.connectionState.toUpperCase()}`, 'warn');
      }
    };
      if (callClockRef.current) clearInterval(callClockRef.current);
      setCallTime(0);
      callClockRef.current = setInterval(() => setCallTime(t => t + 1), 1000);
      return peer;
    })();
    peerSetupPromiseRef.current = setup;
    try { return await setup; }
    catch (error) {
      peerSetupPromiseRef.current = null;
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      throw error;
    }
  };

  useEffect(() => {
    const audio = remoteAudioRef.current;
    const stream = remoteStreamRef.current;
    if (!audio || !stream || callState !== "connected") return;
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.muted = false;
    audio.volume = 1;
    audio.play().catch(error => pushLog(`REMOTE_AUDIO_PLAY_BLOCKED: ${error?.message || error}`, "warn"));
  }, [callState, remoteAudioVersion]);

  const sendChatEmote = (item:any) => {
    if (!item?.id || item.type !== "emote") return;
    sendMessage.mutate({ content: "[CHAT_EMOTE:" + Number(item.id) + "]", recipientId: selectedRecipientId ?? undefined, groupId: selectedGroupId ?? undefined, replyToId: replyTarget?.id ?? null } as any);
    setReplyTarget(null);
    setShowChatEmotePicker(false);
  };

  const sendCallEmote = async (item:any) => {
    if (!callIdRef.current) return;
    let styles:any = {};
    try { styles = typeof item.cssStyles === "string" ? JSON.parse(item.cssStyles) : (item.cssStyles || {}); } catch {}
    try {
      const response = await postVoiceSignal("/api/chat/voice/emote", { callId: callIdRef.current, emoteId: item.id });
      if (!response || response.success !== true) throw new Error("Could not send emote.");
      const duration = Math.max(1, Math.min(20, Number(styles.duration) || 3));
      setRemoteCallEmote({ name: item.name, gifUrl: item.imageUrl, duration });
      const audio = new Audio(styles.audioUrl);
      audio.play().catch(() => {});
      window.setTimeout(() => setRemoteCallEmote((current:any) => current?.name === item.name ? null : current), duration * 1000);
      setCallEmoteOpen(false);
    } catch (error:any) { toast({ title: "Emote failed", description: error.message || "Could not send emote.", variant: "destructive" }); }
  };

  const startCall = async (targetId: number, targetName: string, withVideo: boolean) => {
    if (callStateRef.current !== 'idle' || groupCallIdRef.current) return;
    callPeerIdRef.current = targetId;
    callInitiatorRef.current = true;
    setCallTargetName(targetName);
    setCallState('requesting');
    setIsVideoOn(withVideo);
    pushLog(`CALL_REQUESTING: ${targetName}`, 'warn');
    try {
      const result = await postVoiceSignal('/api/chat/voice/start', { calleeId: targetId, withVideo });
      callIdRef.current = result.callId;
      if (!result.callId) throw new Error('The server did not return a call ID');
    } catch (error: any) {
      toast({ title: 'CALL_FAILED', description: error?.message || 'Could not start the call.', variant: 'destructive' });
      callIdRef.current = null;
      callPeerIdRef.current = null;
      setCallState('idle');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    const call = incomingCall;
    callIdRef.current = call.callId;
    callPeerIdRef.current = call.fromId;
    callInitiatorRef.current = false;
    setCallTargetName(call.fromName);
    setIsVideoOn(Boolean(call.withVideo));
    if (autoDeclineTimerRef.current) { clearTimeout(autoDeclineTimerRef.current); autoDeclineTimerRef.current = null; }
    setIncomingCall(null);
    setCallState('connected');
    try {
      await postVoiceSignal('/api/chat/voice/accept', { callId: call.callId });
      pushLog(`CALL_ACCEPTED: ${call.fromName}`, 'info');
    } catch (error: any) {
      toast({ title: 'CALL_FAILED', description: error?.message || 'Could not accept the call.', variant: 'destructive' });
      endCall(true);
    }
  };

  const endCall = (fromSignal = false) => {
    const callId = callIdRef.current || incomingCall?.callId;
    if (!fromSignal && callId) {
      const endpoint = callStateRef.current === 'incoming' ? '/api/chat/voice/decline' : '/api/chat/voice/end';
      postVoiceSignal(endpoint, { callId }).catch(() => {});
    }
    if (autoDeclineTimerRef.current) { clearTimeout(autoDeclineTimerRef.current); autoDeclineTimerRef.current = null; }
    callIdRef.current = null;
    stopAllCallMedia();
    setCallState('idle');
    setIncomingCall(null);
    setCallTargetName('');
    pushLog('CALL_TERMINATED', 'crit');
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !nextMuted; });
    setIsMuted(nextMuted);
  };

  const toggleCamera = async () => {
    if (isVideoOn) {
      localStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = false; });
      setIsVideoOn(false);
      return;
    }
    try {
      const existingTrack = localStreamRef.current?.getVideoTracks().find(track => track.readyState === 'live');
      if (existingTrack) {
        existingTrack.enabled = true;
        setIsVideoOn(true);
        return;
      }
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      const track = videoStream.getVideoTracks()[0];
      const peer = peerConnectionRef.current;
      const videoTransceiver = peer?.getTransceivers().find(transceiver => transceiver.receiver.track.kind === "video");
      const existingSender = videoTransceiver?.sender || peer?.getSenders().find(sender => sender.track?.kind === "video");
      if (existingSender) await existingSender.replaceTrack(track);
      else if (peer) peer.addTransceiver(track, { direction: "sendrecv" });
      if (!localStreamRef.current) localStreamRef.current = new MediaStream();
      localStreamRef.current.addTrack(track);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
      setIsVideoOn(true);
    } catch {
      toast({ title: 'CAMERA_DENIED', description: 'Allow camera access to turn video on.', variant: 'destructive' });
    }
  };

  const shareScreen = async () => {
    if (isSharingScreen) {
      const screenTrack = localStreamRef.current?.getVideoTracks().find(track => track.label.toLowerCase().includes('screen'));
      screenTrack?.stop();
      localStreamRef.current?.removeTrack(screenTrack as MediaStreamTrack);
      setIsSharingScreen(false);
      return;
    }
    try {
      const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
      const track = screen.getVideoTracks()[0];
      if (!localStreamRef.current) localStreamRef.current = new MediaStream();
      localStreamRef.current.addTrack(track);
      const sender = peerConnectionRef.current?.getSenders().find(item => item.track?.kind === 'video');
      if (sender) await sender.replaceTrack(track);
      else peerConnectionRef.current?.addTrack(track, screen);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setIsSharingScreen(true);
      track.onended = () => setIsSharingScreen(false);
    } catch { toast({ title: 'SCREEN_SHARE_DENIED', variant: 'destructive' }); }
  };

  // The callee creates an answer when the caller's offer arrives; the caller creates the offer after acceptance.
  useEffect(() => {
    if (callState !== 'connected') return;
    let active = true;
    (async () => {
      try {
        const peer = await createPeerConnection();
        if (!active) { peer.close(); return; }
        if (callInitiatorRef.current) {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await postVoiceSignal('/api/chat/voice/offer', {
            callId: callIdRef.current,
            recipientId: callPeerIdRef.current,
            offer: peer.localDescription,
          });
          pushLog('WEBRTC_OFFER_SENT', 'info');
        }
      } catch (error: any) {
        toast({ title: 'CALL_MEDIA_ERROR', description: error?.message || 'Could not start microphone/camera.', variant: 'destructive' });
        endCall(true);
      }
    })();
    return () => { active = false; };
  }, [callState]);

  // ============================================================
  // AUDIO RECORDING (VOICE MESSAGE) — stop to preview, send explicitly
  // ============================================================
  const startVoiceRecord = async () => {
    if (isRecording || recorderRef.current?.state === 'recording') return;
    try {
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
      setVoicePreviewUrl(null);
      setVoiceBlob(null);
      setVoicePreviewPlaying(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        setRecordingStream(null);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 0) {
          setVoiceBlob(blob);
          setVoicePreviewUrl(URL.createObjectURL(blob));
          pushLog('VOICE_RECORDING_READY_TO_SEND', 'info');
        }
        setIsRecording(false);
        setIsRecordingPaused(false);
      };
      recorder.start(150);
      setIsRecording(true);
      setIsRecordingPaused(false);
      pushLog('VOICE_RECORDING_STARTED', 'warn');
    } catch {
      toast({ title: 'MIC_DENIED', description: 'Microphone access required.', variant: 'destructive' });
    }
  };

  const stopVoiceRecord = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const togglePauseVoiceRecord = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      setIsRecordingPaused(true);
    } else if (recorder.state === 'paused') {
      recorder.resume();
      setIsRecordingPaused(false);
    }
  };

  const playVoicePreview = async () => {
    if (!voicePreviewAudioRef.current) return;
    try {
      if (voicePreviewPlaying) {
        voicePreviewAudioRef.current.pause();
        voicePreviewAudioRef.current.currentTime = 0;
        setVoicePreviewPlaying(false);
      } else {
        await voicePreviewAudioRef.current.play();
        setVoicePreviewPlaying(true);
      }
    } catch { toast({ title: 'PREVIEW_ERROR', description: 'Could not play the recording.', variant: 'destructive' }); }
  };

  const discardVoiceMessage = () => {
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
    setVoicePreviewUrl(null);
    setVoiceBlob(null);
    setVoicePreviewPlaying(false);
    if (voicePreviewAudioRef.current) voicePreviewAudioRef.current.pause();
  };

  const sendVoiceMessage = () => {
    if (!voiceBlob) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      sendMessage.mutate({
        content: '[VOICE_MESSAGE]',
        recipientId: selectedRecipientId ?? undefined,
        groupId: selectedGroupId ?? undefined,
        mediaUrl: reader.result as string,
        mediaType: 'audio',
        replyToId: replyTarget?.id ?? null,
      } as any);
      setReplyTarget(null);
      discardVoiceMessage();
      pushLog('VOICE_MESSAGE_SENT', 'info');
    };
    reader.readAsDataURL(voiceBlob);
  };

  // ============================================================
  // UNIFIED CALL SIGNAL POLL — call state + WebRTC SDP/ICE
  // ============================================================
  useEffect(() => {
    let polling = false;
    const pollSignals = async () => {
      if (polling) return;
      polling = true;
      try {
        const response = await fetch('/api/chat/voice/poll');
        if (!response.ok) return;
        const signals: any[] = await response.json();
        for (const signal of signals) {
          const state = callStateRef.current;
          if (signal.type === 'incoming' && state === 'idle' && !groupCallIdRef.current) {
            callIdRef.current = signal.callId;
            callPeerIdRef.current = signal.fromId;
            callInitiatorRef.current = false;
            setIncomingCall({ fromId: signal.fromId, fromName: signal.fromName, callId: signal.callId, withVideo: Boolean(signal.withVideo) });
            setCallState('incoming');
            pushLog(`INCOMING_CALL: ${signal.fromName}`, 'warn');
            if (autoDeclineTimerRef.current) clearTimeout(autoDeclineTimerRef.current);
            autoDeclineTimerRef.current = setTimeout(() => {
              if (callStateRef.current === 'incoming') {
                postVoiceSignal('/api/chat/voice/decline', { callId: signal.callId }).catch(() => {});
                setIncomingCall(null);
                callIdRef.current = null;
                callPeerIdRef.current = null;
                setCallState('idle');
                toast({ title: 'Missed call', description: 'The incoming call timed out.' });
              }
            }, 30000);
          } else if (signal.type === 'emote' && signal.callId === callIdRef.current) {
            const emote = signal.emote || {};
            const duration = Math.max(1, Math.min(20, Number(emote.duration) || 3));
            setRemoteCallEmote({ name: emote.name, gifUrl: emote.gifUrl, duration });
            if (emote.audioUrl) { const audio = new Audio(emote.audioUrl); audio.play().catch(() => {}); }
            window.setTimeout(() => setRemoteCallEmote((current:any) => current?.name === emote.name ? null : current), duration * 1000);
          } else if (signal.type === 'accepted' && state === 'requesting' && signal.callId === callIdRef.current) {
            setCallState('connected');
            pushLog('CALL_CONNECTED', 'info');
          } else if ((signal.type === 'declined' || signal.type === 'ended') && signal.callId === callIdRef.current) {
            if (signal.type === 'declined') toast({ title: 'Call declined.' });
            endCall(true);
          } else if (signal.type === 'offer' && signal.callId === callIdRef.current && state === 'connected') {
            try {
              const peer = await createPeerConnection();
              await peer.setRemoteDescription(new RTCSessionDescription(signal.offer));
              for (const candidate of pendingIceCandidatesRef.current.splice(0)) await peer.addIceCandidate(new RTCIceCandidate(candidate));
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              await postVoiceSignal('/api/chat/voice/answer', {
                callId: callIdRef.current,
                recipientId: signal.from,
                answer: peer.localDescription,
              });
              pushLog('WEBRTC_ANSWER_SENT', 'info');
            } catch (error: any) {
              pushLog(`WEBRTC_OFFER_ERROR: ${error?.message || error}`, 'warn');
              toast({ title: 'Call connection failed', description: error?.message || 'Could not answer the call.', variant: 'destructive' });
              endCall(true);
            }
          } else if (signal.type === 'answer' && signal.callId === callIdRef.current && state === 'connected') {
            try {
              const peer = peerConnectionRef.current;
              if (peer && !peer.currentRemoteDescription) {
                await peer.setRemoteDescription(new RTCSessionDescription(signal.answer));
                for (const candidate of pendingIceCandidatesRef.current.splice(0)) await peer.addIceCandidate(new RTCIceCandidate(candidate));
              }
            } catch (error: any) { pushLog(`WEBRTC_ANSWER_ERROR: ${error?.message || error}`, 'warn'); }
          } else if (signal.type === 'ice' && signal.callId === callIdRef.current && state === 'connected') {
            try {
              const peer = peerConnectionRef.current;
              if (peer?.remoteDescription) await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
              else pendingIceCandidatesRef.current.push(signal.candidate);
            } catch (error: any) { pushLog(`WEBRTC_ICE_ERROR: ${error?.message || error}`, 'warn'); }
          }
        }
      } catch (error) {
        pushLog(`CALL_SIGNAL_POLL_FAILED: ${String(error)}`, 'warn');
      } finally { polling = false; }
    };
    const interval = setInterval(pollSignals, 700);
    pollSignals();
    return () => clearInterval(interval);
  }, []);


  // Group-call invitations and peer-to-peer mesh signalling.
  useEffect(()=>{
    let active=true,busy=false;
    const poll=async()=>{
      if(busy)return;busy=true;
      try{
        const response=await fetch("/api/chat/group-voice/poll",{credentials:"same-origin"});
        if(!response.ok)return;
        const events:any[]=await response.json();
        for(const event of events){
          if(!active)break;
          if(event.type==="group-invite"&&!groupCallIdRef.current&&callStateRef.current==="idle"){
            setIncomingGroupCall(event);
          }else if(event.type==="group-signal"&&event.roomId===groupCallIdRef.current){
            const {from,signal}=event;
            if(signal.type==="left"){
              groupPeersRef.current.get(from)?.close();groupPeersRef.current.delete(from);groupRemoteStreamsRef.current.delete(from);
              setGroupCallParticipants(items=>items.filter(person=>person.userId!==from));setGroupRemoteVersion(v=>v+1);
            }else if(signal.type==="offer"){
              try{
                const person=groupCallParticipants.find(item=>item.userId===from);
                const peer=await createGroupPeer(from,person?.username||("User "+from));
                setGroupCallParticipants(items=>items.some(item=>item.userId===from)?items:[...items,{userId:from,username:person?.username||("User "+from)}]);
                setActiveGroupCallTab(current=>current??from);
                await peer.setRemoteDescription(new RTCSessionDescription(signal.offer));
                for(const candidate of groupPendingIceRef.current.get(from)||[])await peer.addIceCandidate(new RTCIceCandidate(candidate));
                groupPendingIceRef.current.delete(from);
                const answer=await peer.createAnswer();await peer.setLocalDescription(answer);
                sendGroupPeerSignal(from,{type:"answer",answer:peer.localDescription});
              }catch(error:any){pushLog("GROUP_OFFER_ERROR: "+error.message,"warn");}
            }else if(signal.type==="answer"){
              const peer=groupPeersRef.current.get(from);
              if(peer&&!peer.currentRemoteDescription){
                await peer.setRemoteDescription(new RTCSessionDescription(signal.answer));
                for(const candidate of groupPendingIceRef.current.get(from)||[])await peer.addIceCandidate(new RTCIceCandidate(candidate));
                groupPendingIceRef.current.delete(from);
              }
            }else if(signal.type==="ice"){
              const peer=groupPeersRef.current.get(from);
              if(peer?.remoteDescription)await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
              else groupPendingIceRef.current.set(from,[...(groupPendingIceRef.current.get(from)||[]),signal.candidate]);
            }
          }
        }
      }catch(error){pushLog("GROUP_POLL_FAILED: "+String(error),"warn");}
      finally{busy=false;}
    };
    const timer=window.setInterval(poll,650);poll();
    return()=>{active=false;window.clearInterval(timer);};
  },[groupCallParticipants]);

  // ============================================================
  // AUTO-SCROLL
  // ============================================================
  useEffect(() => {
    const id = setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'auto' }), 10);
    return () => clearTimeout(id);
  }, [unifiedMessages.length, selectedRecipientId, selectedGroupId]);

  // ============================================================
  // COMPUTED
  // ============================================================
  const activeChannelName = useMemo(() => {
    if (selectedGroupId) return (groups as any[]).find((g: any) => g.id === selectedGroupId)?.name || "GROUP";
    if (selectedRecipientId) {
      const user = users?.find((u: any) => u.id === selectedRecipientId);
      return user?.displayName || user?.nickname || user?.username || "PRIVATE";
    }
    return "general";
  }, [selectedGroupId, selectedRecipientId, groups, users]);

  const filteredUsers = users?.filter((u: any) => {
    const searchable = `${u.displayName || ""} ${u.nickname || ""} ${u.username}`.toLowerCase();
    return u.id !== currentUser?.id && searchable.includes(searchTerm.toLowerCase());
  });
  const filteredGroups = (groups as any[]).filter((g: any) => g.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const mentionMatch = inputContent.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionCandidates = mentionMatch
    ? (users || []).filter((u: any) => {
        const searchable = `${u.username} ${u.displayName || ""} ${u.nickname || ""}`.toLowerCase();
        return u.id !== currentUser?.id && searchable.includes((mentionMatch[1] || "").toLowerCase());
      }).slice(0, 6)
    : [];

  const slashParts = inputContent.match(/^\/([^\s]*)(?:\s+(.*))?$/);
  const typedCommand = slashParts?.[1]?.toLowerCase() ?? null;
  const commandArgument = slashParts?.[2] ?? null;
  const matchingCommands = typedCommand !== null && commandArgument === null
    ? CHAT_COMMANDS.filter(command => command.name.startsWith(typedCommand) && (!('ownerOnly' in command) || !command.ownerOnly || canUseAdminCommand(command.name as keyof typeof ADMIN_COMMANDS_CONFIG.commands)))
    : [];
  const activeCommand = typedCommand !== null
    ? CHAT_COMMANDS.find(command => command.name === typedCommand && (!('ownerOnly' in command) || !command.ownerOnly || canUseAdminCommand(command.name as keyof typeof ADMIN_COMMANDS_CONFIG.commands)))
    : undefined;
  const commandTokens = commandArgument?.trim().split(/\s+/).filter(Boolean) || [];
  const isModerationCommand = MODERATION_COMMAND_NAMES.includes(activeCommand?.name as any);
  const targetQuery = commandTokens[0] || '';
  const targetTokenComplete = Boolean(commandArgument && /\s$/.test(commandArgument));
  const moderationUserOptions = isModerationCommand && commandArgument !== null &&
    (!targetTokenComplete && commandTokens.length <= 1)
    ? (users || []).filter((user: any) => user.id !== currentUserId && !isProtectedOwner(user) &&
        `${user.username || ''} ${user.displayName || ''} ${user.nickname || ''}`.toLowerCase().includes(targetQuery.replace(/^@/, '').toLowerCase()))
        .slice(0, 7)
    : [];
  const lastCommandToken = commandArgument && /\s$/.test(commandArgument) ? '' : (commandArgument?.match(/\S+$/)?.[0] || '');
  const shouldSuggestDuration = Boolean(activeCommand && TIMED_MODERATION_COMMANDS.has(activeCommand.name) && ((commandTokens.length === 1 && targetTokenComplete) || (commandTokens.length === 2 && !targetTokenComplete)));
  const parameterOptions = activeCommand && commandArgument !== null && shouldSuggestDuration && 'options' in activeCommand
    ? activeCommand.options.filter(option => option.toLowerCase().includes(lastCommandToken.toLowerCase()))
    : [];
  const showCommandMenu = inputContent.startsWith('/') && !mentionMatch && (matchingCommands.length > 0 || parameterOptions.length > 0 || moderationUserOptions.length > 0 || inputContent === '/');

  const insertCommand = (name: string) => {
    setInputContent(`/${name} `);
    setCommandSelection(0);
  };

  const insertModerationTarget = (user: any) => {
    const commandName = activeCommand?.name;
    if (!commandName) return;
    setInputContent(`/${commandName} @${user.username} `);
    setCommandSelection(0);
  };

  const insertParameter = (value: string) => {
    const commandName = activeCommand?.name;
    if (!commandName) return;
    // Preserve the selected username and replace/append only the duration token.
    setInputContent(previous => {
      const match = previous.match(/^\/([a-z]+)(?:\s+(.*))?$/i);
      if (!match) return previous;
      const args = (match[2] || '').trim().split(/\s+/).filter(Boolean);
      if (!args.length) return `/${commandName} ${value} `;
      if (args.length === 1) args.push(value);
      else args[1] = value;
      return `/${commandName} ${args.join(' ')} `;
    });
    setCommandSelection(0);
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const optionsCount = moderationUserOptions.length || parameterOptions.length || matchingCommands.length;
    if (showCommandMenu && optionsCount > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setCommandSelection(current => e.key === 'ArrowDown'
        ? (current + 1) % optionsCount
        : (current - 1 + optionsCount) % optionsCount);
      return;
    }
    if (showCommandMenu && e.key === 'Tab') {
      const targetOption = moderationUserOptions[commandSelection];
      const option = parameterOptions[commandSelection] || matchingCommands[commandSelection];
      if (targetOption || option) {
        e.preventDefault();
        if (moderationUserOptions.length) insertModerationTarget(targetOption);
        else if (parameterOptions.length) insertParameter(option);
        else insertCommand(option.name);
      }
      return;
    }
    if (showCommandMenu && e.key === 'Enter' && optionsCount > 0 && inputContent === '/') {
      e.preventDefault();
      insertCommand(matchingCommands[commandSelection]?.name || 'help');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTransmit();
    }
  };

  const insertMention = (username: string) => {
    setInputContent(prev => prev.replace(/(?:^|\s)@([^\s@]*)$/, match => `${match.slice(0, match.lastIndexOf("@"))}@${username} `));
  };

  const createDihhroGift = async () => {
    try {
      const response = await fetch("/api/dihhro/gift-links", { method:"POST", credentials:"same-origin" });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.message || "Could not create gift link");
      const url = `${window.location.origin}${data.url}`;
      sendMessage.mutate({ content: `🎁 Claim Dihhro for 1 month! ${url}`, recipientId: selectedRecipientId ?? undefined, groupId: selectedGroupId ?? undefined } as any);
      toast({ title:"Dihhro gift link created", description:"A single-use gift embed has been sent to this chat." });
    } catch (error:any) {
      toast({ title:"Gift link failed", description:error.message || "Could not create gift link", variant:"destructive" });
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Layout>
      <div className="nexus-page nexus-page-chat relative isolate flex h-[calc(100vh-140px)] gap-4 overflow-hidden rounded-2xl border border-violet-500/15 bg-[radial-gradient(ellipse_at_top_left,rgba(124,58,237,0.13),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(217,70,239,0.08),transparent_40%),#07040d] p-2 shadow-[0_0_50px_rgba(91,33,182,0.10)]">


        <AnimatePresence>
          {incomingGroupCall && !groupCallId && <div className="fixed inset-0 z-[950] !visible pointer-events-auto flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl"><motion.div initial={{scale:.92,opacity:0}} animate={{scale:1,opacity:1}} className="w-full max-w-sm rounded-2xl border border-emerald-400/30 bg-[#0c0615] p-6 text-center shadow-2xl"><Phone className="mx-auto mb-4 h-10 w-10 text-emerald-300 animate-pulse"/><h3 className="text-xl font-bold text-emerald-100">Group call invite</h3><p className="mt-2 text-sm text-violet-100/60">{incomingGroupCall.fromName} invited you to a group call</p><div className="mt-6 flex gap-3"><button onClick={()=>joinGroupCall(incomingGroupCall)} className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white">JOIN</button><button onClick={()=>setIncomingGroupCall(null)} className="flex-1 rounded-lg border border-white/15 px-4 py-3 text-white/70">DECLINE</button></div></motion.div></div>}
        </AnimatePresence>
        <AnimatePresence>
          {groupCallId && <div className="fixed inset-0 z-[850] !visible pointer-events-auto flex flex-col bg-[#07040d] text-white"><div className="flex items-center justify-between border-b border-violet-500/20 p-4"><div><div className="font-display text-lg text-violet-100">GROUP CALL</div><div className="text-xs text-violet-200/50">{groupCallParticipants.length} participant{groupCallParticipants.length===1?"":"s"} connected</div></div><button onClick={openGroupInvitePicker} className="rounded-lg border border-fuchsia-400/30 px-3 py-2 text-xs text-fuchsia-200"><UserPlus className="mr-2 inline h-4 w-4"/> INVITE</button></div>
            {showGroupCallInvites&&<div className="max-h-56 overflow-y-auto border-b border-violet-500/20 bg-black/50 p-3"><div className="mb-2 text-xs uppercase tracking-widest text-violet-200/60">Invite group members</div>{groupInviteUsers.filter(u=>Number(u.userId)!==Number(currentUserId)&&!groupCallParticipants.some(p=>p.userId===u.userId)).map(u=><div key={u.userId} className="flex items-center justify-between border-b border-white/5 py-2"><span className="text-sm text-violet-100">{u.username}</span><button onClick={()=>inviteToGroupCall(u.userId)} className="rounded border border-emerald-400/30 px-3 py-1 text-xs text-emerald-200">INVITE</button></div>)}</div>}
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <div className="mb-3 flex gap-2 overflow-x-auto border-b border-violet-400/15 pb-2">{groupCallParticipants.map(person=><button key={person.userId} onClick={()=>setActiveGroupCallTab(person.userId)} className={`shrink-0 rounded-t-lg border px-4 py-2 text-xs font-semibold transition ${activeGroupCallTab===person.userId?"border-violet-400/60 bg-violet-500/20 text-violet-100":"border-white/10 bg-white/5 text-white/55 hover:bg-white/10"}`}>{person.userId===Number(currentUserId)?"You":person.username}{person.userId!==Number(currentUserId)&&groupPeersRef.current.get(person.userId)?.connectionState==="connected"?" •":""}</button>)}</div>
              {groupCallParticipants.filter(person=>person.userId===activeGroupCallTab).map(person=><div key={person.userId} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-violet-400/25 bg-[#120b20]">
                <video autoPlay playsInline muted ref={node=>{if(!node)return;if(Number(person.userId)===Number(currentUserId)){if(groupLocalStreamRef.current&&node.srcObject!==groupLocalStreamRef.current)node.srcObject=groupLocalStreamRef.current;}else{const stream=groupRemoteStreamsRef.current.get(person.userId);if(stream&&node.srcObject!==stream)node.srcObject=stream;}}} className="absolute inset-0 h-full w-full object-contain"/>
                {person.userId!==Number(currentUserId)&&<audio autoPlay playsInline ref={node=>{if(!node)return;const stream=groupRemoteStreamsRef.current.get(person.userId);if(stream&&node.srcObject!==stream){node.srcObject=stream;node.muted=false;node.volume=1;node.play().catch(error=>pushLog("GROUP_AUDIO_PLAY_BLOCKED: "+(error?.message||error),"warn"));}}} className="hidden"/>}
                {person.userId===Number(currentUserId)&&<div className="absolute bottom-3 left-3 rounded bg-black/60 px-3 py-1 text-xs">YOU · LOCAL PREVIEW</div>}
                {person.userId!==Number(currentUserId)&&!groupRemoteStreamsRef.current.get(person.userId)?.getVideoTracks().some(track=>track.readyState==="live")&&<div className="text-center text-violet-100"><div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/10 text-3xl">{person.username.slice(0,1).toUpperCase()}</div><div className="text-lg">{person.username}</div><div className="mt-1 text-xs text-violet-200/40">VOICE CONNECTED · CAMERA OFF</div></div>}
                <div className="absolute bottom-3 right-3 rounded bg-black/60 px-3 py-1 text-xs">{person.username}</div>
              </div>)}
              {!groupCallParticipants.length&&<div className="flex flex-1 items-center justify-center text-sm text-violet-200/50">Waiting for participants…</div>}
            </div>
            <div className="flex items-center justify-center gap-4 border-t border-violet-500/20 p-5"><button onClick={()=>{groupLocalStreamRef.current?.getAudioTracks().forEach(t=>t.enabled=!t.enabled);}} className="rounded-full border border-white/20 p-4"><Mic className="h-5 w-5"/></button><button disabled={!groupCallWithVideo} title={groupCallWithVideo?"Toggle camera":"Start a video group call to use camera"} onClick={()=>{groupLocalStreamRef.current?.getVideoTracks().forEach(t=>t.enabled=!t.enabled);}} className="rounded-full border border-white/20 p-4 disabled:opacity-30"><Video className="h-5 w-5"/></button><button onClick={leaveGroupCall} className="flex items-center gap-2 rounded-full bg-red-700 px-7 py-4 font-bold"><PhoneOff className="h-5 w-5"/> LEAVE</button></div>
          </div>}
        </AnimatePresence>

        {/* ======================================================
            INCOMING CALL OVERLAY
            ====================================================== */}
        <AnimatePresence>
          {callState === 'incoming' && incomingCall && (
            <div className="fixed inset-0 z-[900] !visible pointer-events-auto flex items-center justify-center bg-[#08040f]/90 backdrop-blur-xl backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-2xl border border-violet-500/25 bg-[#0c0615]/85 backdrop-blur-xl shadow-[0_0_30px_rgba(139,92,246,0.10)] w-full max-w-sm bg-[#0c0615]/90 backdrop-blur-xl border-violet-500 p-10 text-center"
              >
                <div className="w-20 h-20 mx-auto mb-6 border-2 border-violet-500 rounded-full flex items-center justify-center animate-pulse">
                  <Phone className="w-8 h-8 text-violet-200" />
                </div>
                <h3 className="font-display text-2xl text-violet-200 tracking-widest mb-2 uppercase">Incoming Call</h3>
                <p className="font-mono text-violet-200/60 mb-8 text-sm">{incomingCall.fromName}</p>
                <div className="flex gap-4">
                  <button onClick={acceptCall} className="flex-1 py-3 bg-green-600 border border-green-400 text-white font-display tracking-widest uppercase hover:bg-green-500 transition-colors flex items-center justify-center gap-2">
                    <Phone className="w-5 h-5" /> Accept
                  </button>
                  <button onClick={() => endCall()} className="flex-1 py-3 bg-red-700 border border-red-500 text-white font-display tracking-widest uppercase hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
                    <PhoneOff className="w-5 h-5" /> Decline
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ======================================================
            ACTIVE CALL OVERLAY
            ====================================================== */}
        <AnimatePresence>
          {(callState === 'requesting' || callState === 'connected') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 !visible pointer-events-auto bg-black z-[800] flex flex-col"
            >
              <div className="flex-1 flex">
                {/* Remote participant is the main video; your own camera stays picture-in-picture. */}
                <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                  <video ref={remoteVideoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                  <audio ref={remoteAudioRef} autoPlay playsInline muted={false} />
                  <AnimatePresence>{remoteCallEmote?.gifUrl && <motion.div initial={{opacity:0,scale:.75,y:12}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.9,y:8}} transition={{type:"spring",stiffness:360,damping:24}} className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-2xl border border-violet-300/50 bg-[#111827]/95 p-3 shadow-2xl"><div className="mb-1 text-center text-xs font-bold text-violet-100">{remoteCallEmote.name}</div><img src={remoteCallEmote.gifUrl} alt={remoteCallEmote.name} className="h-28 w-28 rounded-xl object-contain"/></motion.div>}</AnimatePresence>
                  {!hasRemoteVideo && <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="w-36 h-36 rounded-full border-2 border-violet-500/30 bg-violet-500/5 flex items-center justify-center">
                      <Ghost className="w-16 h-16 text-violet-200 animate-pulse" />
                    </div>
                    <div className="text-center mt-5">
                      <div className="font-display text-3xl text-violet-200 tracking-[0.3em] uppercase">{callTargetName}</div>
                      <div className="text-[10px] font-mono text-violet-200/40 mt-3 tracking-widest uppercase">
                        {callState === 'requesting' ? '◌ RINGING...' : `◉ CONNECTED — ${Math.floor(callTime / 60)}:${(callTime % 60).toString().padStart(2, '0')}`}
                      </div>
                    </div>
                  </div>}
                  <div className="absolute bottom-4 right-4 z-10 w-36 sm:w-48 aspect-video overflow-hidden rounded-xl border-2 border-violet-400/60 bg-[#10091b] shadow-2xl">
                    <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    {!isVideoOn && <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-violet-200/50">CAMERA OFF</div>}
                    <span className="absolute bottom-1 left-2 text-[8px] font-mono text-white bg-black/50 px-1.5 py-0.5">YOU</span>
                  </div>
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 border border-violet-500/30 px-3 py-1 text-[10px] font-mono text-violet-200">
                    {callState === 'requesting' ? (
                      <><span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />RINGING...</>
                    ) : (
                      <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />LIVE {Math.floor(callTime / 60)}:{(callTime % 60).toString().padStart(2, '0')}</>
                    )}
                  </div>
                </div>
              </div>
              <div className="h-9 shrink-0 border-t border-violet-500/15 bg-[#09050f]"><LiveAudioVisualizer stream={visualizerStream} bars={44} className="h-full" /></div>

              {/* Soundboard in call (collapsible) */}
              <AnimatePresence>
                {callSoundboardOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="bg-[#0b0614]/95 backdrop-blur-xl border-t border-violet-500/20 overflow-hidden">
                    <div className="p-4">
                      <div className="text-[8px] font-mono text-violet-200/40 mb-3 uppercase tracking-widest">Soundboard — click to broadcast</div>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                        {sounds.map(s => (
                          <button key={s.id} onClick={() => handlePlaySound(s)}
                            className="p-2 border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/25 hover:border-violet-500/60 text-[8px] font-mono uppercase transition-all truncate">
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>{callEmoteOpen && <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}} className="absolute bottom-36 left-1/2 z-40 w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border border-violet-400/30 bg-[#10091b]/95 p-3 shadow-2xl"><div className="mb-2 text-xs font-bold uppercase tracking-widest text-violet-200">Your emotes</div><div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto">{callEmoteInventory.filter((item:any)=>item.type==="emote").map((item:any)=><button key={item.id} onClick={()=>sendCallEmote(item)} className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-2 text-center hover:bg-violet-500/25"><img src={item.imageUrl} alt={item.name} className="mx-auto h-12 w-12 object-contain"/><span className="mt-1 block truncate text-[10px] text-violet-100">{item.name}</span></button>)}</div>{!callEmoteInventory.some((item:any)=>item.type==="emote")&&<p className="text-xs text-violet-100/60">Buy emotes in the DihCoins Shop first.</p>}</motion.div>}</AnimatePresence>
              {/* Call controls */}
              <div className="h-32 bg-black border-t border-violet-500/20 flex items-center justify-center gap-6">
                <button
                  onClick={toggleMute}
                  className={cn("w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all", isMuted ? "bg-red-600 border-red-400" : "border-white/20 hover:border-violet-500")}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
                <button
                  onClick={toggleCamera}
                  className={cn("w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all", isVideoOn ? "bg-violet-500 border-violet-500 text-black" : "border-white/20 hover:border-violet-500")}
                  title={isVideoOn ? "Turn off camera" : "Turn on camera"}
                >
                  {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </button>
                <button
                  onClick={shareScreen}
                  className={cn("w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all", isSharingScreen ? "bg-fuchsia-600 border-fuchsia-400 text-black" : "border-white/20 hover:border-fuchsia-400")}
                  title="Share screen"
                >
                  <MonitorUp className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setCallEmoteOpen(v => !v)}
                  className={cn("w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all", callEmoteOpen ? "bg-fuchsia-500/20 border-fuchsia-400" : "border-white/20 hover:border-fuchsia-400")}
                  title="Emotes"
                >
                  <Sparkles className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setCallSoundboardOpen(v => !v)}
                  className={cn("w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all", callSoundboardOpen ? "bg-violet-500/20 border-violet-500" : "border-white/20 hover:border-violet-500")}
                  title="Soundboard"
                >
                  <Volume2 className="w-6 h-6" />
                </button>
                <button
                  onClick={() => endCall()}
                  className="px-10 h-14 bg-red-700 border-2 border-red-500 flex items-center gap-3 font-display tracking-widest uppercase hover:bg-red-600 transition-colors"
                >
                  <PhoneOff className="w-6 h-6" /> End
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ======================================================
            MODALS
            ====================================================== */}
        <AnimatePresence>
          {showEveryoneList && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#0c0615]/80 backdrop-blur-xl">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="rounded-2xl border border-violet-500/25 bg-[#0c0615]/85 backdrop-blur-xl shadow-[0_0_30px_rgba(139,92,246,0.10)] w-full max-w-md bg-[#0c0615]/90 backdrop-blur-xl border-violet-500 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-violet-200 uppercase tracking-widest">Global_Directory</h2>
                  <button onClick={() => setShowEveryoneList(false)}><X className="w-5 h-5 text-violet-200/60 hover:text-violet-200" /></button>
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {users?.filter((u: any) => u.id !== currentUser?.id).map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between p-3 border border-violet-500/20 bg-violet-500/5">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e]" />
                        <span className="font-mono text-violet-200 text-sm">{u.username}</span>
                      </div>
                      <div className="flex gap-2">
                        <CyberButton variant="primary" onClick={() => { selectPrivateNode(u.id); setShowEveryoneList(false); }} className="px-2 py-1 text-[10px]">MSG</CyberButton>
                        <CyberButton variant="primary" onClick={() => { selectPrivateNode(u.id); setShowEveryoneList(false); startCall(u.id, u.username, false); }} className="px-2 py-1 text-[10px]">CALL</CyberButton>
                        <CyberButton variant="secondary" onClick={() => { selectPrivateNode(u.id); setShowEveryoneList(false); startCall(u.id, u.username, true); }} className="px-2 py-1 text-[10px]">VIDEO</CyberButton>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCreateGroupModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#0c0615]/80 backdrop-blur-xl">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="rounded-2xl border border-violet-500/25 bg-[#0c0615]/85 backdrop-blur-xl shadow-[0_0_30px_rgba(139,92,246,0.10)] w-full max-w-sm bg-[#0c0615]/90 backdrop-blur-xl border-violet-500 p-6">
                <div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-violet-200 uppercase tracking-widest">Create a group</h2><p className="mt-1 text-[10px] text-violet-200/45">Start a private space and invite your friends.</p></div><span className="text-3xl">{newGroupIcon}</span></div>
                <label className="mb-2 block text-[9px] font-mono uppercase tracking-widest text-violet-200/50">Group name</label>
                <CyberInput value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Gaming Squad" className="mb-4" onKeyDown={e => e.key === 'Enter' && createGroupMutation.mutate({ name: newGroupName.trim(), icon: newGroupIcon })} />
                <label className="mb-2 block text-[9px] font-mono uppercase tracking-widest text-violet-200/50">Choose an icon</label>
                <div className="mb-5 grid grid-cols-8 gap-2">{['💬','🎮','👾','🚀','⭐','🔥','🛡️','🎨','🎵','⚡','🌌','🐉','🏆','🧩','🖤','🌈'].map(icon => <button key={icon} type="button" onClick={() => setNewGroupIcon(icon)} className={cn('rounded-lg border p-2 text-xl transition-all', newGroupIcon === icon ? 'border-fuchsia-400 bg-fuchsia-500/20' : 'border-violet-500/15 bg-violet-500/5 hover:border-violet-400/50')}>{icon}</button>)}</div>
                <div className="flex gap-2">
                  <CyberButton variant="primary" onClick={() => createGroupMutation.mutate({ name: newGroupName.trim(), icon: newGroupIcon })} disabled={!newGroupName.trim() || createGroupMutation.isPending} className="flex-1">{createGroupMutation.isPending ? 'CREATING…' : 'CREATE GROUP'}</CyberButton>
                  <CyberButton variant="secondary" onClick={() => setShowCreateGroupModal(false)} className="flex-1">CANCEL</CyberButton>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showJoinGroupModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#0c0615]/80 backdrop-blur-xl">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="rounded-2xl border border-violet-500/25 bg-[#0c0615]/85 backdrop-blur-xl shadow-[0_0_30px_rgba(139,92,246,0.10)] w-full max-w-sm bg-[#0c0615]/90 backdrop-blur-xl border-violet-500 p-6">
                <h2 className="font-display text-violet-200 uppercase tracking-widest mb-2">Join a group</h2>
                <p className="mb-4 text-[10px] text-violet-200/45">Paste an invite URL or enter its code. Example: https://your-site.com/invite/h432y2r</p>
                <CyberInput value={joinGroupCode} onChange={e => setJoinGroupCode(e.target.value)} placeholder="Paste invite link or code..." className="mb-2" onKeyDown={e => e.key === 'Enter' && joinGroupMutation.mutate(joinGroupCode)} />
                {joinGroupCode.trim() && <div className="mb-4 rounded-lg border border-violet-500/15 bg-violet-500/5 p-3 text-[10px] text-violet-200/70"><Link2 className="mr-2 inline h-3 w-3" />{/^https?:\/\//i.test(joinGroupCode.trim()) ? 'Invite link detected — ready to join.' : `Invite code: ${joinGroupCode.trim()}`}</div>}
                <div className="flex gap-2">
                  <CyberButton variant="primary" onClick={() => joinGroupMutation.mutate(joinGroupCode)} disabled={!joinGroupCode.trim() || joinGroupMutation.isPending} className="flex-1">{joinGroupMutation.isPending ? 'JOINING…' : 'JOIN GROUP'}</CyberButton>
                  <CyberButton variant="secondary" onClick={() => setShowJoinGroupModal(false)} className="flex-1">CANCEL</CyberButton>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showManageGroupModal && selectedGroupId && (
            <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl">
              <motion.div initial={{ opacity: 0, scale: .94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .94 }} className="w-full max-w-md rounded-2xl border border-violet-400/25 bg-[#0c0615] p-6 shadow-[0_0_45px_rgba(139,92,246,.15)]">
                <div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-violet-100">GROUP SETTINGS</h2><p className="mt-1 text-[10px] text-violet-200/40">Personalise your group.</p></div><button onClick={() => setShowManageGroupModal(false)} className="text-violet-200/50 hover:text-white"><X /></button></div>
                <label className="mb-2 block text-[9px] font-mono uppercase tracking-widest text-violet-200/50">Group name</label>
                <CyberInput value={manageGroupName} onChange={e => setManageGroupName(e.target.value)} placeholder="Group name" className="mb-4" />
                <label className="mb-2 block text-[9px] font-mono uppercase tracking-widest text-violet-200/50">Group icon</label>
                <div className="mb-5 grid grid-cols-8 gap-2">{['💬','🎮','👾','🚀','⭐','🔥','🛡️','🎨','🎵','⚡','🌌','🐉','🏆','🧩','🖤','🌈'].map(icon => <button key={icon} type="button" onClick={() => setManageGroupIcon(icon)} className={cn('rounded-lg border p-2 text-xl transition-all', manageGroupIcon === icon ? 'border-fuchsia-400 bg-fuchsia-500/20' : 'border-violet-500/15 bg-violet-500/5 hover:border-violet-400/50')}>{icon}</button>)}</div>
                <div className="flex gap-2"><CyberButton variant="primary" className="flex-1" disabled={!manageGroupName.trim() || updateGroupMutation.isPending} onClick={() => updateGroupMutation.mutate({ id: selectedGroupId, name: manageGroupName.trim(), icon: manageGroupIcon })}>{updateGroupMutation.isPending ? 'SAVING…' : 'SAVE CHANGES'}</CyberButton><CyberButton variant="secondary" className="flex-1" onClick={() => setShowManageGroupModal(false)}>CANCEL</CyberButton></div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Forward Modal */}
        <AnimatePresence>
          {forwardState.isOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#08040f]/90 backdrop-blur-xl">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="rounded-2xl border border-violet-500/25 bg-[#0c0615]/85 backdrop-blur-xl shadow-[0_0_30px_rgba(139,92,246,0.10)] w-full max-w-md bg-black border-fuchsia-400/40 p-6">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="font-display text-fuchsia-300 uppercase tracking-widest">Relay Data</h2>
                  <button onClick={() => setForwardState({ message: null, isOpen: false })}><X className="w-5 h-5" /></button>
                </div>
                <div className="max-h-80 overflow-y-auto space-y-1">
                  {[
                    ...users!.filter((u: any) => u.id !== currentUser?.id).map((u: any) => ({ id: u.id, name: u.username, type: 'dm' as const })),
                    ...(groups as any[]).map((g: any) => ({ id: g.id, name: g.name, type: 'group' as const }))
                  ].map(t => (
                    <button key={`${t.type}-${t.id}`}
                      onClick={() => {
                        sendMessage.mutate({ content: `[RELAY] ${forwardState.message.content}`, recipientId: t.type === 'dm' ? t.id : undefined, groupId: t.type === 'group' ? t.id : undefined, mediaUrl: forwardState.message.mediaUrl, mediaType: forwardState.message.mediaType } as any);
                        setForwardState({ message: null, isOpen: false });
                        toast({ title: "RELAY_SENT" });
                      }}
                      className="w-full p-3 border border-white/5 hover:border-fuchsia-400 hover:bg-fuchsia-600/10 text-left font-mono text-sm text-white/60 hover:text-fuchsia-300 transition-all"
                    >
                      {t.name} <span className="text-[9px] opacity-40">({t.type})</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Media Lightbox */}
        {mediaPreview && (
          <div className="fixed inset-0 z-[1000] bg-black/98 flex items-center justify-center p-8" onClick={() => setMediaPreview(null)}>
            <button className="absolute top-6 right-6 text-white/50 hover:text-white"><X className="w-8 h-8" /></button>
            {mediaPreview.type === 'image' && <img src={mediaPreview.url} className="max-w-full max-h-[85vh] object-contain" />}
            {mediaPreview.type === 'video' && <video src={mediaPreview.url} controls autoPlay className="max-w-full max-h-[85vh]" />}
          </div>
        )}

        {/* Hidden inputs */}
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.zip,.txt" className="hidden" onChange={e => handleFileSelect(e.target.files?.[0] || null)} />
        <input ref={soundFileInputRef} type="file" accept="audio/*,video/*" className="hidden" onChange={handleImportSound} />

        {/* ======================================================
            SIDEBAR
            ====================================================== */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}
              className="w-72 flex-shrink-0 flex flex-col bg-black border border-violet-500/20 overflow-hidden">
              <div className="p-4 border-b border-violet-500/20 bg-violet-500/5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-[11px] tracking-[0.4em] uppercase text-violet-200">NEXUS SERVER</h2>
                  <div className="flex gap-1">
                    <button title="Create group" onClick={() => setShowCreateGroupModal(true)} className="rounded-md border border-fuchsia-400/25 bg-fuchsia-500/10 p-1.5 text-fuchsia-200 transition hover:bg-fuchsia-500/20"><Plus className="h-4 w-4" /></button>
                    <button title="Join group" onClick={() => setShowJoinGroupModal(true)} className="rounded-md border border-violet-400/20 p-1.5 text-violet-200 transition hover:bg-violet-500/10"><UserPlus className="h-4 w-4" /></button>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:text-white text-violet-200/20 transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>

              <div className="p-3 border-b border-violet-500/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-violet-200/30" />
                  <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-black border border-violet-500/10 pl-8 pr-3 py-1.5 text-[10px] font-mono text-violet-200 outline-none focus:border-violet-500/40"
                    placeholder="Find a conversation or person..." />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <div className="mb-2 grid grid-cols-2 gap-2 px-1">
                  <button onClick={() => setShowCreateGroupModal(true)} className="flex items-center justify-center gap-1.5 rounded-lg border border-fuchsia-400/25 bg-fuchsia-500/10 px-2 py-2 text-[9px] font-bold text-fuchsia-200 transition hover:bg-fuchsia-500/20"><Plus className="h-3.5 w-3.5" /> CREATE GROUP</button>
                  <button onClick={() => setShowJoinGroupModal(true)} className="flex items-center justify-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/5 px-2 py-2 text-[9px] font-bold text-violet-200 transition hover:bg-violet-500/15"><UserPlus className="h-3.5 w-3.5" /> JOIN GROUP</button>
                </div>
                <CyberSidebarNode label="# general" isActive={!selectedRecipientId && !selectedGroupId} onClick={selectBroadcast} status="online" />
                <div className="pt-3 pb-1 px-3 text-[8px] font-bold text-fuchsia-200/50 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-px bg-fuchsia-500/20 flex-1" /> GROUP CHATS <span className="w-2 h-px bg-fuchsia-500/20 flex-1" />
                </div>
                {(filteredGroups as any[]).map((g: any) => <CyberSidebarNode key={`group-${g.id}`} label={<><span className="text-base leading-none">{g.icon || '💬'}</span><span className="truncate">{g.name}</span></>} isActive={selectedGroupId === g.id} onClick={() => selectGroupNode(g.id)} status="online" />)}
                {filteredGroups.length === 0 && <div className="px-4 py-2 text-[9px] font-mono text-violet-200/25">No groups yet. Create one above.</div>}
                <div className="pt-3 pb-1 px-3 text-[8px] font-bold text-violet-200/30 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-px bg-violet-500/20 flex-1" /> DIRECT MESSAGES <span className="w-2 h-px bg-violet-500/20 flex-1" />
                </div>
                {filteredUsers?.map((u: any) => (
                  <CyberSidebarNode
                    key={u.id}
                    label={
                      <>
                        <span className="truncate">{u.displayName || u.nickname || u.username}</span>
                        <UserProfileTag
                          tagSymbol={u.tagSymbol}
                          tagText={u.tagText}
                          tagColor={u.tagColor}
                          size="compact"
                        />
                      </>
                    }
                    status={u.presenceStatus || "offline"}
                    isActive={selectedRecipientId === u.id}
                    onClick={() => selectPrivateNode(u.id)}
                  />
                ))}
                {filteredUsers?.length === 0 && (
                  <div className="px-4 py-3 text-[9px] font-mono text-violet-200/30 italic">No people found.</div>
                )}
              </div>

              <div className="p-3 border-t border-violet-500/20 bg-black flex items-center gap-3">
                <div className="w-8 h-8 border border-violet-500/20 flex items-center justify-center bg-violet-500/5">
                  <Cpu className="w-4 h-4 text-violet-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div className="text-[10px] font-bold text-violet-200 uppercase truncate">{currentUser?.username}</div>
                    <UserProfileTag
                      tagSymbol={currentUser?.tagSymbol}
                      tagText={currentUser?.tagText}
                      tagColor={currentUser?.tagColor}
                      size="compact"
                    />
                  </div>
                  <div className="text-[8px] text-violet-200/30 font-mono">ONLINE</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ======================================================
            MAIN CHAT AREA
            ====================================================== */}
        <div className="flex-1 flex flex-col border border-violet-500/10 bg-black/70 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-violet-500/20 bg-black/60 flex-shrink-0">
            <div className="flex items-center gap-3">
              {!isSidebarOpen && (
                <button onClick={() => setIsSidebarOpen(true)} className="p-1 border border-violet-500/20 hover:bg-violet-500/10 text-violet-200">
                  <TerminalSquare className="w-5 h-5" />
                </button>
              )}
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-ping" />
              <h2 className="font-display text-sm tracking-[0.25em] text-violet-200 uppercase">{selectedGroupId ? `${(groups as any[]).find((g: any) => g.id === selectedGroupId)?.icon || '💬'} ${activeChannelName}` : activeChannelName}</h2>

                {selectedGroupId && <div className="flex items-center gap-1">
                  <button type="button" title="Start group voice call" onClick={()=>startGroupCall(false)} className="rounded-md border border-emerald-400/25 bg-emerald-500/10 p-1.5 text-emerald-200 transition hover:bg-emerald-500/20"><Phone className="h-3.5 w-3.5"/></button>
                  <button type="button" title="Start group video call" onClick={()=>startGroupCall(true)} className="rounded-md border border-fuchsia-400/25 bg-fuchsia-500/10 p-1.5 text-fuchsia-200 transition hover:bg-fuchsia-500/20"><Video className="h-3.5 w-3.5"/></button>
                </div>}

              {selectedGroupId && <button onClick={() => { const g = (groups as any[]).find((item: any) => item.id === selectedGroupId); setManageGroupName(g?.name || ''); setManageGroupIcon(g?.icon || '💬'); setShowManageGroupModal(true); }} title="Rename group or change icon" className="rounded-md border border-violet-500/20 p-1.5 text-violet-200/60 transition hover:border-fuchsia-400/50 hover:text-fuchsia-200"><Pencil className="h-3.5 w-3.5" /></button>}
              {selectedGroupId && (
                <span className="text-[8px] font-mono text-violet-200/30 border border-violet-500/20 px-2 py-0.5">
                  CODE: {(groups as any[]).find((g: any) => g.id === selectedGroupId)?.inviteCode || '...'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowRules(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-400/25 bg-fuchsia-500/10 px-3 py-2 text-[10px] font-semibold tracking-wide text-fuchsia-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-fuchsia-300/60 hover:bg-fuchsia-500/20 hover:shadow-[0_0_18px_rgba(217,70,239,0.18)] active:translate-y-0">
                <ShieldCheck className="h-3.5 w-3.5" /> RULES
              </button>
              <CyberButton onClick={() => setShowEveryoneList(true)} variant="primary" className="px-3 py-1.5 text-[10px] hidden sm:flex">
                <Users className="w-3.5 h-3.5 mr-1.5" /> DIR
              </CyberButton>
              {selectedRecipientId && (
                <>
                  <button onClick={() => startCall(selectedRecipientId, activeChannelName, false)}
                    className="p-2 border border-violet-500/20 hover:border-violet-500 text-violet-200 transition-all" title="Voice Call">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button onClick={() => startCall(selectedRecipientId, activeChannelName, true)}
                    className="p-2 border border-violet-500/20 hover:border-violet-500 text-violet-200 transition-all" title="Video Call">
                    <Video className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Group invite code banner */}
          {selectedGroupId && (
            <div className="px-5 py-2 border-b border-fuchsia-400/20 bg-fuchsia-600/5 flex items-center gap-3 flex-shrink-0">
              <Binary className="w-3.5 h-3.5 text-fuchsia-300" />
              <span className="text-[9px] font-mono text-fuchsia-300/60">INVITE LINK</span>
              <span className="min-w-0 flex-1 truncate text-[10px] font-mono text-fuchsia-200 select-all">{`${window.location.origin}/invite/${(groups as any[]).find((g: any) => g.id === selectedGroupId)?.inviteCode || ''}`}</span>
              <button type="button" onClick={() => { const code = (groups as any[]).find((g: any) => g.id === selectedGroupId)?.inviteCode; if (!code) return; navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`); toast({ title: 'INVITE_LINK_COPIED', description: 'Share this link so friends can join.' }); }} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-fuchsia-400/25 px-2 py-1 text-[8px] font-mono text-fuchsia-200 hover:bg-fuchsia-500/10"><Copy className="h-3 w-3" /> COPY LINK</button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-1 scroll-smooth [scrollbar-gutter:stable]">
            {unifiedMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full opacity-10">
                <Bug className="w-12 h-12 mb-4" />
                <p className="font-mono text-[11px] tracking-[1em] uppercase">No_Transmissions</p>
              </div>
            )}
            {unifiedMessages.map((msg: any) => (
              <TerminalMessage
                key={msg.id}
                msg={msg as any}
                isMe={msg.senderId === currentUser?.id}
                onReply={setReplyTarget}
                onForward={m => setForwardState({ message: m, isOpen: true })}
                onPurge={id => deleteMessageMutation.mutate(id)}
                onMediaPreview={setMediaPreview}
                onProfileClick={setProfileUserId}
                emoteItem={chatEmoteItems.find((item:any) => item.type === "emote" && Number(item.id) === Number(String(msg.content || "").match(/^\[CHAT_EMOTE:(\d+)\]$/)?.[1]))}
                shouldAutoplayEmote={!isLoadingMessages && (
                  Number(msg.id) < 0 ||
                  (chatEmoteBaselineRef.current?.channelKey === activeChatChannelKey && Number(msg.id) > chatEmoteBaselineRef.current.maxId)
                )}
              />
            ))}
            <div ref={chatBottomRef} className="h-2" />
          </div>

          {/* Reply banner */}
          <AnimatePresence>
            {replyTarget && (
              <motion.div initial={{ opacity: 0, height: 0, y: 10 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0, y: 8 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="chat-reply-composer flex-shrink-0 overflow-hidden px-3 pt-2">
                <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-violet-300/20 bg-[linear-gradient(110deg,rgba(139,92,246,.16),rgba(217,70,239,.07),rgba(15,12,27,.94))] px-3 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,.22)]">
                  <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-violet-300 via-fuchsia-400 to-violet-500" />
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-300/20 bg-violet-400/10 text-violet-100"><Reply className="h-4 w-4"/></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-violet-200"><span>Replying to</span><span className="max-w-[180px] truncate text-white">{replyTarget.senderDisplayName || replyTarget.senderNickname || replyTarget.senderName || "message"}</span></div>
                    <div className="mt-0.5 truncate text-xs text-violet-100/60">{replyTarget.content || (replyTarget.mediaType ? "📎 " + replyTarget.mediaType + " attachment" : "Message")}</div>
                  </div>
                  <span className="hidden rounded-md border border-violet-300/15 bg-black/20 px-2 py-1 text-[8px] font-mono tracking-wider text-violet-200/50 sm:inline">ESC TO CANCEL</span>
                  <button type="button" aria-label="Cancel reply" onClick={() => setReplyTarget(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-violet-200/60 transition hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-200"><X className="h-4 w-4"/></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* File preview */}
          <AnimatePresence>
            {uploadFile && uploadPreview && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                className="border-t border-fuchsia-400/20 px-5 py-2 bg-fuchsia-600/5 flex items-center gap-4 overflow-hidden flex-shrink-0">
                {uploadFile.type.startsWith('image/') && <img src={uploadPreview} className="w-12 h-12 object-cover border border-fuchsia-400/30" />}
                {uploadFile.type.startsWith('video/') && <Film className="w-5 h-5 text-fuchsia-300" />}
                {uploadFile.type.startsWith('audio/') && <Music className="w-5 h-5 text-fuchsia-300" />}
                <div className="flex-1">
                  <div className="text-[10px] font-mono text-fuchsia-300 truncate">{uploadFile.name}</div>
                  <div className="text-[8px] text-fuchsia-300/40">{(uploadFile.size / 1024).toFixed(0)} KB</div>
                </div>
                <button onClick={() => { setUploadFile(null); setUploadPreview(null); }}>
                  <X className="w-4 h-4 text-fuchsia-300/40 hover:text-fuchsia-300" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(isRecording || voiceBlob) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="mx-3 mb-2 rounded-xl border border-violet-400/25 bg-[#10091b]/95 px-3 py-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 min-w-[100px]">
                  <span className={cn("w-2 h-2 rounded-full", isRecording ? "bg-red-400 animate-pulse" : "bg-violet-300")} />
                  <span className="text-[10px] font-mono text-violet-200 uppercase tracking-wider">
                    {isRecording ? (isRecordingPaused ? 'Recording paused' : 'Recording…') : 'Voice preview'}
                  </span>
                </div>
                <LiveAudioVisualizer stream={isRecording ? recordingStream : null} bars={28} className="flex-1 min-w-[90px] h-7" />
                {isRecording ? (
                  <>
                    <button type="button" onClick={togglePauseVoiceRecord} className="p-2 rounded-lg border border-violet-400/30 text-violet-200 hover:bg-violet-500/15" title={isRecordingPaused ? 'Resume recording' : 'Pause recording'}>
                      {isRecordingPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={stopVoiceRecord} className="p-2 rounded-lg border border-red-400/40 text-red-300 hover:bg-red-500/15" title="Stop recording">
                      <Square className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <audio ref={voicePreviewAudioRef} src={voicePreviewUrl || undefined} onEnded={() => setVoicePreviewPlaying(false)} className="hidden" />
                    <button type="button" onClick={playVoicePreview} className="p-2 rounded-lg border border-violet-400/30 text-violet-200 hover:bg-violet-500/15" title={voicePreviewPlaying ? 'Restart preview' : 'Play preview'}>
                      <Play className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={discardVoiceMessage} className="p-2 rounded-lg border border-white/15 text-white/60 hover:bg-white/10" title="Discard recording">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={sendVoiceMessage} className="px-3 py-2 rounded-lg bg-violet-500 text-white text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-violet-400 flex items-center gap-2">
                      <Check className="w-4 h-4" /> Send
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="chat-composer relative flex-shrink-0 border-t border-violet-300/10 p-3">
            <form onSubmit={handleTransmit} className="flex items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className={cn("w-10 h-10 rounded flex items-center justify-center transition-all flex-shrink-0",
                  uploadFile ? "bg-fuchsia-600/20 text-fuchsia-300" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
                <Plus className="w-5 h-5" />
              </button>

              <button type="button" onClick={startVoiceRecord} disabled={isRecording || Boolean(voiceBlob)}
                className={cn("w-10 h-10 rounded flex items-center justify-center flex-shrink-0 transition-all",
                  isRecording ? "bg-red-500/20 text-red-400 animate-pulse" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  (isRecording || voiceBlob) && "opacity-50 cursor-not-allowed")}
                title="Start voice recording">
                <Mic className="w-4 h-4" />
              </button>

              <div className="flex-1 relative">
                <input
                  value={inputContent}
                  onChange={e => setInputContent(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Message... (type / for commands)"
                  className="w-full h-10 bg-input/90 border border-border rounded-xl px-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground shadow-inner transition-all duration-200 ease-out focus:-translate-y-px focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400/60 focus:shadow-[0_0_22px_rgba(139,92,246,0.12)]"
                />
                {showCommandMenu && (
                  <div className="chat-command-menu absolute bottom-12 left-0 right-0 z-50 rounded-2xl border border-violet-300/25 bg-[#10091b]/[.97] backdrop-blur-2xl shadow-[0_18px_65px_rgba(0,0,0,.55),0_0_34px_rgba(139,92,246,.17)] overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-violet-400/15">
                      <span className="text-[9px] uppercase tracking-[0.2em] font-mono text-violet-200/70">{moderationUserOptions.length ? 'Choose a member' : parameterOptions.length ? 'Command parameters' : 'Available commands'}</span>
                      <span className="text-[8px] font-mono text-violet-200/35">↑ ↓ navigate · TAB complete · ENTER run</span>
                    </div>
                    {(moderationUserOptions.length ? moderationUserOptions : parameterOptions.length ? parameterOptions : matchingCommands).map((item: any, index: number) => {
                      const selected = index === commandSelection;
                      const isTargetSuggestion = moderationUserOptions.length > 0;
                      const isDurationSuggestion = !isTargetSuggestion && parameterOptions.length > 0;
                      const command = isDurationSuggestion ? activeCommand : item;
                      const targetUser = isTargetSuggestion ? item : null;
                      return (
                        <button
                          key={isTargetSuggestion ? `target-${item.id}` : isDurationSuggestion ? `${command?.name}-${item}` : item.name}
                          type="button"
                          onMouseEnter={() => setCommandSelection(index)}
                          onClick={() => isTargetSuggestion ? insertModerationTarget(targetUser) : isDurationSuggestion ? insertParameter(item) : insertCommand(item.name)}
                          className={cn('w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors', selected ? 'bg-violet-500/20' : 'hover:bg-violet-500/10')}
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-500/15 text-violet-200"><Command className="w-3.5 h-3.5" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-mono text-fuchsia-200">{isTargetSuggestion ? `@${item.username}` : isDurationSuggestion ? item : command?.usage}</span>
                            <span className="block text-[9px] text-violet-100/45">{isTargetSuggestion ? (item.displayName || item.nickname || 'Chat member') : isDurationSuggestion ? `Duration for /${command?.name}` : command?.description}</span>
                          </span>
                          {selected && <span className="text-[8px] font-mono text-violet-200/50">TAB</span>}
                        </button>
                      );
                    })}
                    {activeCommand && commandArgument !== null && parameterOptions.length === 0 && moderationUserOptions.length === 0 && (
                      <div className="px-3 py-2 text-[9px] font-mono text-violet-200/45">Usage: {activeCommand.usage}{isModerationCommand ? ' · Type a username to choose a member, then select a duration.' : ('example' in activeCommand && activeCommand.example ? ` · Example: ${activeCommand.example}` : '')}</div>
                    )}
                    {inputContent === '/' && <div className="px-3 py-2 text-[9px] font-mono text-violet-200/40">Type a command name or choose /help to see the list.</div>}
                  </div>
                )}
                {mentionCandidates.length > 0 && (
                  <div className="absolute bottom-12 left-0 right-0 z-40 rounded-lg border border-border bg-[hsl(225_7%_15%)] shadow-2xl overflow-hidden">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                      Mention someone
                    </div>
                    {mentionCandidates.map((u: any) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => insertMention(u.username)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/70 transition-colors"
                      >
                        <Avatar url={u.avatarUrl} name={u.username} size={22} />
                        <span className="text-sm text-foreground">{u.displayName || u.nickname || u.username}</span>
                        <UserProfileTag
                          tagSymbol={u.tagSymbol}
                          tagText={u.tagText}
                          tagColor={u.tagColor}
                          size="compact"
                        />
                        <span className="text-xs text-muted-foreground">@{u.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {canGiftDihhro && <button type="button" onClick={createDihhroGift} title="Gift one month of Dihhro" className="h-10 w-10 flex-shrink-0 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20 transition"><Gift className="mx-auto h-4 w-4"/></button>}
              <button type="button" onClick={() => setShowChatEmotePicker(v => !v)} title="Send an owned emote" className={cn("h-10 px-3 rounded-lg flex items-center justify-center gap-1.5 flex-shrink-0 border transition-all", showChatEmotePicker ? "border-fuchsia-400/50 bg-fuchsia-500/20 text-fuchsia-200" : "border-violet-400/20 bg-violet-500/5 text-violet-200 hover:bg-fuchsia-500/15 hover:border-fuchsia-400/40")}><Sparkles className="h-4 w-4"/><span className="text-[10px] font-bold tracking-wider">EMOTE</span></button>
              <button
                type="button"
                onClick={() => { setShowGifPicker(true); if (!gifResults.length) searchGifs("reaction"); }}
                title="Send a GIF"
                className="h-10 px-3 rounded-lg flex items-center justify-center gap-1.5 flex-shrink-0 border border-violet-400/20 bg-violet-500/5 text-violet-200 hover:bg-fuchsia-500/15 hover:border-fuchsia-400/40 hover:text-fuchsia-200 transition-all duration-200"
              >
                <Film className="w-4 h-4" />
                <span className="text-[10px] font-bold tracking-wider">GIF</span>
              </button>
              <EmojiButton onSelect={emoji => setInputContent(prev => prev + emoji)} />

              <CyberButton type="submit" disabled={!inputContent.trim() && !uploadFile} size="sm" className="h-10 px-4 flex-shrink-0">
                <Send className="w-4 h-4" />
              </CyberButton>
            </form>
            {showChatEmotePicker && <div className="absolute bottom-14 right-24 z-[80] w-[min(88vw,360px)] rounded-xl border border-violet-400/30 bg-[#10091b]/[.98] p-3 shadow-2xl"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-widest text-violet-200">Your emotes</span><button type="button" onClick={()=>setShowChatEmotePicker(false)} className="text-violet-200/60 hover:text-white"><X className="h-4 w-4"/></button></div><div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto">{callEmoteInventory.filter((item:any)=>item.type==="emote").map((item:any)=><button key={item.id} type="button" onClick={()=>sendChatEmote(item)} className="rounded-lg border border-violet-400/20 bg-violet-500/10 p-2 text-center transition hover:border-fuchsia-400/50 hover:bg-fuchsia-500/15"><img src={item.imageUrl} alt={item.name} className="mx-auto h-14 w-14 object-contain"/><span className="mt-1 block truncate text-[10px] font-semibold text-violet-100">{item.name}</span></button>)}</div>{!callEmoteInventory.some((item:any)=>item.type==="emote") && <p className="py-5 text-center text-xs text-violet-100/60">You don’t own any emotes yet. Buy some in the Shop!</p>}</div>}
          </div>
        </div>

        {/* ======================================================
            RIGHT PANEL - DIAGNOSTICS + SOUNDBOARD
            ====================================================== */}
        <div className="hidden xl:flex w-72 flex-col gap-4 flex-shrink-0">
          {/* Diagnostic log */}
          <CyberCard className="p-4 border-violet-500/20 bg-[#0c0615]/80 backdrop-blur-xl flex flex-col" style={{ height: '45%' }}>
            <h3 className="text-[9px] font-display text-violet-200 tracking-[0.4em] mb-3 flex items-center gap-2">
              <Terminal className="w-3 h-3 animate-pulse" /> DIAGNOSTIC_LOG
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[8px]">
              {logs.map(log => (
                <div key={log.id} className="border-l-2 border-violet-500/20 pl-2">
                  <div className={cn("font-bold", log.type === 'crit' ? "text-red-400" : log.type === 'warn' ? "text-yellow-400" : "text-violet-200/50")}>{log.time}</div>
                  <div className="text-violet-200/60 truncate">{log.msg}</div>
                </div>
              ))}
              {!logs.length && <div className="text-violet-200/20 italic animate-pulse">Scanning...</div>}
            </div>
          </CyberCard>

          {/* Soundboard */}
          <CyberCard className="p-4 border-violet-500/20 bg-[#0c0615]/80 backdrop-blur-xl flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[9px] font-display text-violet-200 tracking-[0.4em] flex items-center gap-2">
                <Volume2 className="w-3 h-3" /> SOUNDBOARD
              </h3>
              <button onClick={() => soundFileInputRef.current?.click()}
                className="text-[8px] font-mono text-violet-200/40 hover:text-fuchsia-300 border border-violet-500/20 hover:border-fuchsia-400 px-2 py-0.5 transition-colors flex items-center gap-1">
                <Upload className="w-2.5 h-2.5" /> IMPORT
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-1.5 pr-1">
                {sounds.map(s => (
                  <button key={s.id} onClick={() => handlePlaySound(s)}
                    className="p-2 border border-violet-500/10 bg-violet-500/5 hover:bg-violet-500/20 hover:border-violet-500/40 text-[8px] font-mono text-left uppercase transition-all truncate group">
                    <Play className="w-2.5 h-2.5 inline mr-1 opacity-0 group-hover:opacity-100" />{s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-violet-500/10">
              <div className="text-[8px] font-mono text-violet-200/30 mb-2 uppercase">Custom Ringtone URL</div>
              <CyberInput
                value={userConfig?.ringtoneUrl || ""}
                onChange={e => updateProfile.mutate({ ringtoneUrl: e.target.value })}
                placeholder="https://...mp3"
                className="h-7 text-[9px]"
              />
            </div>
          </CyberCard>
        </div>
      </div>
      <AnimatePresence>
        {showGifPicker && (
          <motion.div
            className="fixed inset-0 z-[960] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onMouseDown={e => { if (e.target === e.currentTarget) setShowGifPicker(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-2xl max-h-[82vh] overflow-hidden rounded-2xl border border-fuchsia-400/25 bg-[#10091b]/95 shadow-[0_20px_80px_rgba(0,0,0,0.6),0_0_35px_rgba(168,85,247,0.12)] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-violet-400/15 px-5 py-4">
                <div className="flex items-center gap-2"><Film className="w-5 h-5 text-fuchsia-300" /><div><div className="text-xs font-bold tracking-[0.25em] text-fuchsia-200">GIF LIBRARY</div><div className="mt-1 text-[10px] text-violet-100/45">Search animated reactions with GIPHY.</div></div></div>
                <button onClick={() => setShowGifPicker(false)} className="rounded-lg p-2 text-violet-200/60 transition hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <form onSubmit={e => { e.preventDefault(); searchGifs(); }} className="flex gap-2 p-4 border-b border-violet-400/10">
                <input value={gifSearch} onChange={e => setGifSearch(e.target.value)} placeholder="Search gaming, Roblox, Minecraft, reactions..." autoFocus className="h-10 min-w-0 flex-1 rounded-lg border border-violet-400/20 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-violet-100/30 focus:border-fuchsia-400/50" />
                <button type="submit" disabled={gifLoading} className="h-10 rounded-lg bg-violet-500/20 px-4 text-xs font-bold text-violet-100 hover:bg-violet-500/30 disabled:opacity-50">{gifLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button>
              </form>
              {gifError ? (
                <div className="p-8 text-center text-sm text-red-300">{gifError}</div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {gifLoading && !gifResults.length ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-fuchsia-300" /></div> : null}
                  {!gifLoading && !gifResults.length && <div className="p-8 text-center text-xs text-violet-100/40">Search for something to find GIFs.</div>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {gifResults.map((gif: any) => {
                      const previewUrl = gif.previewUrl || gif.url;
                      return <button key={gif.id} type="button" onClick={() => sendGif(gif)} title={`${gif.title} · ${gif.license}`} className="group relative overflow-hidden rounded-lg border border-violet-400/10 bg-black/30 aspect-video hover:border-fuchsia-400/60 hover:shadow-[0_0_18px_rgba(217,70,239,0.18)] transition-all">
                        {previewUrl && <img src={previewUrl} alt={gif.title || "GIF"} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-left text-[9px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity">Send GIF</span>
                      </button>;
                    })}
                  </div>
                </div>
              )}
              <div className="border-t border-violet-400/10 px-4 py-2 text-[9px] text-violet-100/30">GIF search powered by GIPHY.</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showRules && (
          <motion.div className="fixed inset-0 z-[950] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => { if (e.target === e.currentTarget) setShowRules(false); }}>
            <motion.div initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="w-full max-w-lg overflow-hidden rounded-2xl border border-fuchsia-400/25 bg-[#10091b]/95 shadow-[0_20px_80px_rgba(0,0,0,0.6),0_0_35px_rgba(168,85,247,0.12)]">
              <div className="flex items-center justify-between border-b border-violet-400/15 px-5 py-4"><div><div className="text-xs font-bold tracking-[0.25em] text-fuchsia-200">SERVER RULES</div><div className="mt-1 text-[10px] text-violet-100/45">Keep the community safe and welcoming.</div></div><button onClick={() => setShowRules(false)} className="rounded-lg p-2 text-violet-200/60 transition hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button></div>
              <ol className="space-y-3 px-6 py-5 text-sm leading-relaxed text-violet-50/85 list-decimal marker:font-bold marker:text-fuchsia-300">
                <li><span className="font-semibold text-white">No NSFW</span> — porn, gore, vore, or other explicit content.</li>
                <li><span className="font-semibold text-white">Be kind</span> — no racism, queerphobia, ableism, or other hateful behaviour.</li>
                <li><span className="font-semibold text-white">Don’t be weird</span> — respect boundaries and keep interactions appropriate.</li>
                <li><span className="font-semibold text-white">No spamming</span> — don’t flood chats or repeatedly disrupt conversations.</li>
              </ol>
              <div className="border-t border-violet-400/15 px-5 py-3 text-[9px] text-violet-100/35">Messages containing prohibited content may be blocked and result in a 5-minute mute.</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ProfileModal
        userId={profileUserId}
        currentUserId={currentUser?.id ?? -1}
        onClose={() => setProfileUserId(null)}
      />
    </Layout>
  );
}