import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Pencil,
  Save,
  Upload,
  Users as UsersIcon,
  Sparkles,
  UserPlus,
  UserCheck,
  ShieldBan,
  ShieldOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ProfileTagEditor } from "@/components/ProfileTagEditor";
import { UserProfileTag } from "@/components/UserProfileTag";
import {
  PROFILE_TAG_COLORS,
  PROFILE_TAG_SYMBOLS,
} from "@shared/profile-tag";

export const USERNAME_FONTS: {
  id: string;
  label: string;
  className: string;
}[] = [
  { id: "default", label: "DEFAULT", className: "font-mono" },
  {
    id: "neon",
    label: "NEON",
    className:
      "font-mono text-primary drop-shadow-[0_0_6px_rgba(34,197,94,0.9)]",
  },
  {
    id: "matrix",
    label: "MATRIX",
    className: "font-mono text-green-400 tracking-widest",
  },
  {
    id: "cyber",
    label: "CYBER",
    className: "font-['Orbitron'] tracking-wider",
  },
  {
    id: "glitch",
    label: "GLITCH",
    className:
      "font-mono italic text-fuchsia-400 drop-shadow-[0_0_4px_rgba(217,70,239,0.8)]",
  },
  {
    id: "fire",
    label: "FIRE",
    className:
      "font-mono font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent",
  },
  {
    id: "ice",
    label: "ICE",
    className:
      "font-mono font-bold bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent",
  },
  {
    id: "rainbow",
    label: "RAINBOW",
    className:
      "font-mono font-bold bg-gradient-to-r from-pink-500 via-yellow-400 to-cyan-400 bg-clip-text text-transparent",
  },
  { id: "comic-sans", label: "COMIC SANS", className: "font-comic-sans italic" },
  { id: "ghost", label: "GHOST", className: "font-mono text-white/40" },
  {
    id: "elite",
    label: "ELITE",
    className:
      "font-['Orbitron'] font-black uppercase text-primary tracking-widest",
  },
];

export function getFontClass(id?: string | null) {
  if (id?.startsWith("custom-gradient|")) id = id.split("|")[1] || "default";
  if (id?.startsWith("custom-font|")) return USERNAME_FONTS[0].className;
  return USERNAME_FONTS.find((f) => f.id === id)?.className || USERNAME_FONTS[0].className;
}


const PROFILE_GRADIENTS: Record<string,string> = {
  aurora:"linear-gradient(120deg,#0f766e,#312e81,#86198f)",
  sunset:"linear-gradient(120deg,#f97316,#db2777,#7c3aed)",
  ocean:"linear-gradient(120deg,#0e7490,#1d4ed8,#172554)",
  ember:"linear-gradient(120deg,#7f1d1d,#ea580c,#f59e0b)",
  violet:"linear-gradient(120deg,#4c1d95,#7c3aed,#db2777)",
  mint:"linear-gradient(120deg,#065f46,#10b981,#a7f3d0)",
  mono:"linear-gradient(120deg,#111827,#4b5563,#9ca3af)",
};
type ProfileAppearance = { gradient: string; textColor: string; borderColor: string; animated: boolean; orientation: "portrait" | "landscape" };
function readProfileAppearance(value?: string | null): ProfileAppearance {
  const defaults: ProfileAppearance = { gradient: "none", textColor: "#ffffff", borderColor: "#ffffff", animated: true, orientation: "portrait" };
  if (!value) return defaults;
  if (value.startsWith("style2~")) {
    const [, gradient, textColor, borderColor, animated, orientation] = value.split("~");
    return {
      gradient: gradient || "none",
      textColor: /^#[0-9a-f]{6}$/i.test(textColor || "") ? textColor : defaults.textColor,
      borderColor: /^#[0-9a-f]{6}$/i.test(borderColor || "") ? borderColor : defaults.borderColor,
      animated: animated !== "0",
      orientation: orientation === "landscape" ? "landscape" : "portrait",
    };
  }
  return { ...defaults, gradient: value };
}
function saveProfileAppearance(settings: ProfileAppearance) {
  return ["style2", settings.gradient, settings.textColor, settings.borderColor, settings.animated ? "1" : "0", settings.orientation].join("~");
}
export function getProfileGradientStyle(value?: string | null): React.CSSProperties {
  const settings = readProfileAppearance(value);
  const gradient = settings.gradient;
  let backgroundImage: string | undefined;
  const angle = settings.orientation === "landscape" ? "90deg" : "180deg";
  if (gradient.startsWith("custom:")) {
    const colors = gradient.slice(7).split(":");
    if (colors.length === 3 && colors.every(color => /^#[0-9a-f]{6}$/i.test(color))) backgroundImage = `linear-gradient(${angle},${colors.join(",")})`;
  } else if (PROFILE_GRADIENTS[gradient]) {
    backgroundImage = PROFILE_GRADIENTS[gradient].replace(/120deg/, angle);
  }
  if (!backgroundImage) return {};
  return {
    backgroundImage,
    backgroundSize: settings.animated ? "300% 300%" : "100% 100%",
    animation: settings.animated ? "profileGradientFlow 12s ease infinite" : "none",
  };
}
export function getUsernameGradientStyle(value?: string | null): React.CSSProperties {
  if (!value?.startsWith("custom-gradient|") && !value?.startsWith("custom-font|")) return {};
  const parts = value.split("|");
  const isUploadedFont = parts[0] === "custom-font";
  const font = isUploadedFont ? "default" : parts[1];
  const a = parts[isUploadedFont ? 2 : 2];
  const b = parts[isUploadedFont ? 3 : 3];
  const d = parts[isUploadedFont ? 4 : 4] || b;
  if (!/^[a-z-]+$/.test(font || "") || !/^#[0-9a-f]{6}$/i.test(a || "") || !/^#[0-9a-f]{6}$/i.test(b || "") || !/^#[0-9a-f]{6}$/i.test(d || "")) return {};
  return { backgroundImage:`linear-gradient(100deg,${a},${b},${d},${a})`, backgroundSize:"250% 250%", animation:"profileTextGradientFlow 7s ease infinite", backgroundClip:"text", WebkitBackgroundClip:"text", color:"transparent" };
}
function getUsernameFontStyle(value?: string | null): React.CSSProperties {
  if (!value?.startsWith("custom-font|")) return {};
  return { fontFamily: "'DIHTROCustom', monospace" };
}
function getUploadedFontSource(value?: string | null): string | null {
  if (!value?.startsWith("custom-font|")) return null;
  const data = value.split("|")[1] || "";
  return /^data:(?:font\/(?:woff2?|ttf|otf)|application\/octet-stream);base64,[A-Za-z0-9+/=]+$/i.test(data) ? data : null;
}

export function Avatar({
  url,
  name,
  size = 32,
  font,
  onClick,
  className,
  title,
}: {
  url?: string | null;
  name: string;
  size?: number;
  font?: string | null;
  onClick?: () => void;
  className?: string;
  title?: string;
}) {
  const initials = (name || "?").slice(0, 2).toUpperCase();
  // Treat empty string same as null
  const validUrl = url && url.trim().length > 4 ? url : null;

  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={title}
      aria-label={onClick ? title || `View ${name} profile` : undefined}
      className={cn(
        "flex items-center justify-center rounded-full overflow-hidden border border-primary/40 shrink-0 select-none",
        "bg-gradient-to-br from-primary/30 to-accent/20",
        onClick && "cursor-pointer hover:border-primary transition-colors",
        className,
      )}
      style={{ width: size, height: size, minWidth: size }}
      data-testid={`avatar-${name}`}
    >
      {validUrl ? (
        <img
          src={validUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          onError={e => {
            // If image fails to load, hide it and show initials
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const parent = e.currentTarget.parentElement;
            if (parent && !parent.querySelector(".avatar-initials")) {
              const span = document.createElement("span");
              span.className = cn("avatar-initials font-bold", getFontClass(font));
              span.style.fontSize = `${Math.max(8, size / 3)}px`;
              span.textContent = initials;
              parent.appendChild(span);
            }
          }}
        />
      ) : (
        <span
          className={cn("font-bold", getFontClass(font))}
          style={{ fontSize: Math.max(8, size / 3) }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

interface ProfileModalProps {
  userId: number | null;
  currentUserId: number;
  onClose: () => void;
}

export function ProfileModal({
  userId,
  currentUserId,
  onClose,
}: ProfileModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const fontFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setEditing(false); setFullImageUrl(null); }, [userId]);

  const showFullImage = (url?: string | null) => {
    if (!url) return;
    setFullImageUrl(url.replace("/thumbnail/", "/full/"));
  };

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/user/profile", userId],
    queryFn: async () => {
      const r = await fetch(`/api/user/profile/${userId}`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (profile)
      setForm({
        username: profile.username || "",
        nickname: profile.nickname || "",
        bio: profile.bio || "",
        displayName: profile.displayName || "",
        pronouns: profile.pronouns || "",
        avatarUrl: profile.avatarUrl || "",
        bannerUrl: profile.bannerUrl || "",
        usernameFont: profile.usernameFont || "default",
        profileGradient: readProfileAppearance(profile.profileGradient).gradient,
        profileTextColor: readProfileAppearance(profile.profileGradient).textColor,
        profileBorderColor: readProfileAppearance(profile.profileGradient).borderColor,
        profileGradientAnimated: readProfileAppearance(profile.profileGradient).animated,
        profileGradientOrientation: readProfileAppearance(profile.profileGradient).orientation,
        customProfileStart: readProfileAppearance(profile.profileGradient).gradient.startsWith("custom:") ? readProfileAppearance(profile.profileGradient).gradient.slice(7).split(":")[0] : "#0ea5e9",
        customProfileMiddle: readProfileAppearance(profile.profileGradient).gradient.startsWith("custom:") ? readProfileAppearance(profile.profileGradient).gradient.slice(7).split(":")[1] : "#8b5cf6",
        customProfileEnd: readProfileAppearance(profile.profileGradient).gradient.startsWith("custom:") ? readProfileAppearance(profile.profileGradient).gradient.slice(7).split(":")[2] : "#ec4899",
        customTextStart: profile.usernameFont?.startsWith("custom-gradient|") || profile.usernameFont?.startsWith("custom-font|") ? profile.usernameFont.split("|")[2] : "#22d3ee",
        customTextMiddle: profile.usernameFont?.startsWith("custom-gradient|") || profile.usernameFont?.startsWith("custom-font|") ? profile.usernameFont.split("|")[3] : "#a78bfa",
        customTextEnd: profile.usernameFont?.startsWith("custom-gradient|") || profile.usernameFont?.startsWith("custom-font|") ? (profile.usernameFont.split("|")[4] || profile.usernameFont.split("|")[3]) : "#f472b6",
        tagSymbol: profile.tagSymbol || PROFILE_TAG_SYMBOLS[0],
        tagText: profile.tagText || "",
        tagColor: profile.tagColor || PROFILE_TAG_COLORS[0],
      });
  }, [profile]);

  const { data: viewer } = useQuery<any>({ queryKey: ["/api/auth/me"], queryFn: async () => { const r = await fetch("/api/auth/me", { credentials: "same-origin" }); if (!r.ok) return null; return r.json(); } });
  const { data: relationship, refetch: refetchRelationship } = useQuery<any>({
    queryKey: ["/api/social/relationship", userId],
    queryFn: async () => {
      const r = await fetch(`/api/social/relationship/${userId}`);
      if (!r.ok) throw new Error("relationship failed");
      return r.json();
    },
    enabled: !!userId && userId !== currentUserId,
  });

  const friendMut = useMutation({
    mutationFn: async () => {
      const isAccepted = relationship?.friendStatus === "accepted";
      const isIncoming = relationship?.friendStatus === "pending_received";
      const r = await fetch(
        `/api/social/friends/${isIncoming ? relationship.friendRequestId : userId}`,
        {
          method: isAccepted ? "DELETE" : isIncoming ? "PATCH" : "POST",
          ...(isIncoming ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "accepted" }),
          } : {}),
        },
      );
      if (!r.ok) throw new Error((await r.json()).message || "Friend action failed");
      return r;
    },
    onSuccess: () => {
      refetchRelationship();
      toast({ title: relationship?.friendStatus === "accepted" ? "FRIEND_REMOVED" : "FRIEND_REQUEST_SENT" });
    },
    onError: (e: any) => toast({ title: "FRIEND_ACTION_FAILED", description: e.message, variant: "destructive" }),
  });

  const blockMut = useMutation({
    mutationFn: async () => {
      const method = relationship?.blockedByMe ? "DELETE" : "POST";
      const r = await fetch(`/api/social/blocks/${userId}`, { method });
      if (!r.ok) throw new Error((await r.json()).message || "Block action failed");
      return r;
    },
    onSuccess: () => {
      refetchRelationship();
      toast({ title: relationship?.blockedByMe ? "USER_UNBLOCKED" : "USER_BLOCKED" });
    },
    onError: (e: any) => toast({ title: "BLOCK_ACTION_FAILED", description: e.message, variant: "destructive" }),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const appearance = {
        gradient: form.profileGradient || "none",
        textColor: form.profileTextColor || "#ffffff",
        borderColor: form.profileBorderColor || "#ffffff",
        animated: form.profileGradientAnimated !== false,
        orientation: form.profileGradientOrientation === "landscape" ? "landscape" as const : "portrait" as const,
      };
      const payload = { ...form, nickname: null, displayName: null, profileGradient: saveProfileAppearance(appearance) };
      const r = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || `Profile save failed (${r.status})`);
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "PROFILE_UPDATED" });
      qc.invalidateQueries({ queryKey: ["/api/user/profile", userId] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/chat/users"] });
      qc.invalidateQueries({ queryKey: ["/api/messages"] });
      setEditing(false);
    },
    onError: (error: any) => toast({
      title: "SAVE_FAILED",
      description: error.message,
      variant: "destructive",
    }),
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: "avatarUrl" | "bannerUrl") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({
        title: "TOO_LARGE",
        description: "Max 8MB",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () =>
      setForm((f: any) => ({ ...f, [field]: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const isOwn = profile?.id === currentUserId;
  const canEditProfile = Boolean(isOwn && userId != null);
  const canUseDihhro = ["owner","admin"].includes(String(viewer?.role || "").toLowerCase()) || Boolean(viewer?.dihhroUntil && new Date(viewer.dihhroUntil) > new Date());
  const giftDihhro = async () => {
    try {
      const response = await fetch("/api/admin/dihhro/grant", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, months: 1 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not gift Dihhro");
      toast({ title: "DIHHRO_GIFTED", description: "One month has been added." });
      await qc.invalidateQueries({ queryKey: ["/api/user/profile", userId] });
    } catch (error: any) {
      toast({ title: "GIFT_FAILED", description: error.message || "Could not gift Dihhro", variant: "destructive" });
    }
  };
  const displayName = profile?.username || ""; 
  const uploadedFontSource = getUploadedFontSource(editing ? form.usernameFont : profile?.usernameFont);

  return (
    <AnimatePresence>
      {userId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-black border border-primary/40 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto shadow-[0_0_40px_rgba(34,197,94,0.3)]"
            data-testid="profile-modal"
          >
            {/* Profile banner */}
            <div
              className="h-24 border-b border-primary/30 relative bg-gradient-to-br from-primary/30 via-accent/20 to-fuchsia-500/20 bg-cover bg-center"
              style={{
                backgroundImage: (editing ? form.bannerUrl : profile?.bannerUrl)
                  ? `linear-gradient(rgba(20,20,30,.2), rgba(20,20,30,.55)), url(${editing ? form.bannerUrl : profile?.bannerUrl})`
                  : undefined,
              }}
            >
              <button
                onClick={onClose}
                className="absolute top-2 right-2 p-1.5 bg-black/60 border border-primary/30 rounded hover:border-primary"
                data-testid="button-close-profile"
              >
                <X className="w-3.5 h-3.5 text-primary" />
              </button>
              {editing && (
                <>
                  <button
                    onClick={() => bannerFileRef.current?.click()}
                    className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 text-white text-[10px] px-2 py-1 rounded border border-white/20 hover:border-primary"
                  >
                    <Upload className="w-3 h-3" /> Change banner
                  </button>
                  <input
                    ref={bannerFileRef}
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageUpload(e, "bannerUrl")}
                    className="hidden"
                  />
                </>
              )}
              {!editing && profile?.bannerUrl && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    showFullImage(profile.bannerUrl);
                  }}
                  className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded border border-white/20 hover:border-primary"
                >
                  View full banner
                </button>
              )}
            </div>

            <div
              className="p-5 -mt-10 min-h-[calc(100%-6rem)] profile-gradient-surface"
              style={{
                backgroundColor: "#050505",
                ...getProfileGradientStyle(editing
                  ? saveProfileAppearance({ gradient: form.profileGradient || "none", textColor: form.profileTextColor || "#ffffff", borderColor: form.profileBorderColor || "#ffffff", animated: form.profileGradientAnimated !== false, orientation: form.profileGradientOrientation || "portrait" })
                  : profile?.profileGradient),
                color: readProfileAppearance(editing ? saveProfileAppearance({ gradient: form.profileGradient || "none", textColor: form.profileTextColor || "#ffffff", borderColor: form.profileBorderColor || "#ffffff", animated: form.profileGradientAnimated !== false, orientation: form.profileGradientOrientation || "portrait" }) : profile?.profileGradient).textColor,
                ["--profile-border-color" as any]: readProfileAppearance(editing ? saveProfileAppearance({ gradient: form.profileGradient || "none", textColor: form.profileTextColor || "#ffffff", borderColor: form.profileBorderColor || "#ffffff", animated: form.profileGradientAnimated !== false, orientation: form.profileGradientOrientation || "portrait" }) : profile?.profileGradient).borderColor,
              }}
            >
              <style>{`@keyframes profileGradientFlow { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} } @keyframes profileTextGradientFlow { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} } .profile-gradient-surface .profile-outline { border-color:var(--profile-border-color)!important; } .profile-gradient-surface .profile-panel { border-color:var(--profile-border-color)!important; }`}</style>
              {uploadedFontSource && <style>{`@font-face { font-family: 'DIHTROCustom'; src: url("${uploadedFontSource}") format('woff2'); font-display: swap; }`}</style>}
              {isLoading || !profile ? (
                <div className="text-primary/60 font-mono text-xs text-center py-10">
                  LOADING_PROFILE...
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-3 mb-4">
                    <div className="relative">
                      <Avatar
                        url={editing ? form.avatarUrl : profile.avatarUrl}
                        name={profile.username}
                        size={80}
                        font={profile.usernameFont}
                        onClick={(editing ? form.avatarUrl : profile.avatarUrl)
                          ? () => showFullImage(editing ? form.avatarUrl : profile.avatarUrl)
                          : undefined}
                        title={`View full-size image for ${profile.username}`}
                        className="border-4 border-black ring-2 ring-primary/50"
                      />
                      {editing && (
                        <>
                          <button
                            onClick={() => fileRef.current?.click()}
                            className="absolute bottom-0 right-0 bg-primary text-black p-1.5 rounded-full hover:scale-110 transition"
                            data-testid="button-upload-avatar"
                          >
                            <Upload className="w-3 h-3" />
                          </button>
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/*,image/gif"
                            onChange={e => handleImageUpload(e, "avatarUrl")}
                            className="hidden"
                          />
                        </>
                      )}
                    </div>
                    <div className="flex-1 pb-2">
                      <div
                        className={cn(
                          "min-w-0 break-words [overflow-wrap:anywhere] text-lg font-bold leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]",
                          getFontClass(editing ? form.usernameFont : profile.usernameFont),
                        )}
                        style={{ color: "#ffffff", ...getUsernameFontStyle(editing ? form.usernameFont : profile.usernameFont), ...getUsernameGradientStyle(editing ? form.usernameFont : profile.usernameFont) }}
                        data-testid="text-display-name"
                      >
                        {displayName}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <div className="text-[10px] text-primary/50 font-mono">
                          @{profile.username}
                        </div>
                        <UserProfileTag
                          tagSymbol={editing ? form.tagSymbol : profile.tagSymbol}
                          tagText={editing ? form.tagText : profile.tagText}
                          tagColor={editing ? form.tagColor : profile.tagColor}
                          size="compact"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          profile.presenceStatus === "online" ? "bg-green-400" :
                          profile.presenceStatus === "idle" ? "bg-yellow-400" :
                          profile.presenceStatus === "dnd" ? "bg-red-400" : "bg-gray-500"
                        )} />
                        <span className="text-[10px] opacity-70 capitalize">{profile.presenceStatus || "offline"}</span>
                        {profile.pronouns && <span className="text-[10px] opacity-80">• {profile.pronouns}</span>}
                      </div>
                      {(() => {
                        const role = String(profile.role || "user").toLowerCase().replace(/_/g,"-");
                        const badges: Record<string,{label:string;cls:string}> = {
                          owner:{label:"♛ OWNER",cls:"border-amber-300/50 bg-amber-300/10 text-amber-200"},
                          admin:{label:"✦ ADMIN",cls:"border-red-400/50 bg-red-400/10 text-red-300"},
                          "trial-admin":{label:"TRIAL ADMIN",cls:"border-orange-300/50 bg-orange-300/10 text-orange-200"},
                          moderator:{label:"✧ MODERATOR",cls:"border-violet-400/50 bg-violet-400/10 text-violet-200"},
                          "trial-moderator":{label:"TRIAL MOD",cls:"border-indigo-400/50 bg-indigo-400/10 text-indigo-200"},
                          helper:{label:"✚ HELPER",cls:"border-sky-400/50 bg-sky-400/10 text-sky-200"},
                          "trial-helper":{label:"TRIAL HELPER",cls:"border-cyan-400/50 bg-cyan-400/10 text-cyan-200"},
                        };
                        const badge = badges[role];
                        return badge ? <div className={cn("inline-flex items-center gap-1 mt-1 rounded border px-2 py-1 text-[9px] font-black tracking-wider",badge.cls)}>{badge.label}</div> : null;
                      })()}
                      {(["owner","admin"].includes(String(profile.role).toLowerCase()) || (profile.dihhroUntil && new Date(profile.dihhroUntil) > new Date())) && (
                        <div className="inline-flex items-center gap-1 mt-1 rounded border border-fuchsia-500/40 bg-fuchsia-400/10 px-2 py-1 text-[9px] font-black tracking-wider text-fuchsia-300"><Sparkles className="w-2.5 h-2.5"/> DIHHRO</div>
                      )}
                    </div>
                    {["owner","admin"].includes(String(viewer?.role || "").toLowerCase()) && !isOwn && (
                      <button onClick={giftDihhro} className="mt-2 rounded border border-fuchsia-400/40 px-2 py-1 text-[9px] font-mono text-fuchsia-300 hover:bg-fuchsia-400/10">✦ GIFT 1 MONTH DIHHRO</button>
                    )}
                    {canEditProfile && !editing && (
                      <button
                        onClick={() => setEditing(true)}
                        className="text-[10px] font-mono text-primary border border-primary/40 px-2 py-1 rounded hover:bg-primary/10"
                        data-testid="button-edit-profile"
                      >
                        <Pencil className="w-3 h-3 inline mr-1" /> EDIT
                      </button>
                    )}
                  </div>

                  {!isOwn && !editing && (
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => friendMut.mutate()}
                        disabled={friendMut.isPending || relationship?.blockedMe}
                        className="profile-outline flex-1 flex items-center justify-center gap-1.5 text-[10px] font-mono px-2 py-2 rounded border bg-black/60 hover:bg-black/80 disabled:opacity-50"
                        style={{ color: "inherit", borderColor: "var(--profile-border-color, #ffffff)" }}
                      >
                        {relationship?.friendStatus === "accepted" ? <UserCheck className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                        {relationship?.friendStatus === "accepted" ? "FRIENDS" :
                         relationship?.friendStatus === "pending_sent" ? "REQUEST SENT" :
                         relationship?.friendStatus === "pending_received" ? "ACCEPT REQUEST" : "ADD FRIEND"}
                      </button>
                      <button
                        onClick={() => blockMut.mutate()}
                        disabled={blockMut.isPending}
                        className="profile-outline flex items-center justify-center gap-1.5 text-[10px] font-mono px-3 py-2 rounded border bg-black/60 hover:bg-black/80"
                        style={{ color: "inherit", borderColor: "var(--profile-border-color, #ffffff)" }}
                      >
                        {relationship?.blockedByMe ? <ShieldOff className="w-3 h-3" /> : <ShieldBan className="w-3 h-3" />}
                        {relationship?.blockedByMe ? "UNBLOCK" : "BLOCK"}
                      </button>
                    </div>
                  )}

                  {!editing || !canEditProfile ? (
                    <>
                      <div className="profile-panel border border-primary/20 rounded p-3 mb-3 bg-black/20">
                        <div className="text-[9px] opacity-75 font-mono uppercase mb-1">
                          BIO
                        </div>
                        <div className="text-xs opacity-95 font-mono whitespace-pre-wrap">
                          {profile.bio || (
                            <span className="opacity-50 italic">
                              No bio set.
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="profile-panel border border-accent/20 rounded p-3 bg-black/20">
                        <div className="flex items-center gap-1 text-[9px] opacity-80 font-mono uppercase mb-2">
                          <UsersIcon className="w-3 h-3" /> MUTUAL_GROUPS (
                          {profile.mutualGroups?.length || 0})
                        </div>
                        {profile.mutualGroups?.length ? (
                          <div className="space-y-1">
                            {profile.mutualGroups.map((g: any) => (
                              <div
                                key={g.id}
                                className="profile-outline text-[11px] font-mono opacity-90 px-2 py-1 bg-black/40 rounded border border-accent/10"
                                data-testid={`mutual-group-${g.id}`}
                              >
                                # {g.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] opacity-50 italic font-mono">
                            No shared groups.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <Field label="USERNAME">
                        <input
                          value={form.username}
                          onChange={(e) =>
                            setForm({ ...form, username: e.target.value })
                          }
                          maxLength={32}
                          className="w-full bg-black border border-primary/30 px-2 py-1.5 text-xs font-mono text-white rounded focus:outline-none focus:border-primary"
                          data-testid="input-username"
                        />
                      </Field>
                      <ProfileTagEditor
                        value={{
                          tagSymbol: form.tagSymbol || PROFILE_TAG_SYMBOLS[0],
                          tagText: form.tagText || "",
                          tagColor: form.tagColor || PROFILE_TAG_COLORS[0],
                        }}
                        onChange={(tag) => setForm((current: any) => ({ ...current, ...tag }))}
                      />
                      <div className="rounded border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-mono text-white/60">
                        PROFILE NAME: <span className="font-bold text-white">{form.username || profile?.username}</span>
                        <div className="mt-1 opacity-70">Your account username is shown as your profile name. Nicknames and alternate display names are disabled.</div>
                      </div>
                      <Field label="PRONOUNS">
                        <input
                          value={form.pronouns}
                          onChange={e => setForm({ ...form, pronouns: e.target.value })}
                          maxLength={32}
                          placeholder="e.g. they/them"
                          className="w-full bg-black border border-primary/30 px-2 py-1.5 text-xs font-mono text-white rounded focus:outline-none focus:border-primary"
                        />
                      </Field>
                      <Field label="BIO">
                        <textarea
                          value={form.bio}
                          onChange={(e) =>
                            setForm({ ...form, bio: e.target.value })
                          }
                          maxLength={500}
                          rows={3}
                          className="w-full bg-black border border-primary/30 px-2 py-1.5 text-xs font-mono text-white rounded focus:outline-none focus:border-primary resize-none"
                          data-testid="input-bio"
                        />
                        <div className="text-[8px] text-white/30 text-right mt-0.5">
                          {(form.bio || "").length}/500
                        </div>
                      </Field>
                      <Field label="CUSTOM PROFILE GRADIENT (DIHHRO)">
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                          {["none","aurora","sunset","ocean","ember","violet","mint","mono","custom"].map((gradient) => (
                            <button key={gradient} type="button" disabled={gradient !== "none" && !canUseDihhro} onClick={() => setForm({ ...form, profileGradient: gradient === "custom" ? "custom:" + [form.customProfileStart || "#0ea5e9",form.customProfileMiddle || "#8b5cf6",form.customProfileEnd || "#ec4899"].join(":") : gradient })} className={cn("rounded border px-2 py-2 text-[9px] uppercase", (gradient === "custom" ? form.profileGradient?.startsWith("custom:") : form.profileGradient === gradient) ? "border-primary bg-primary/20 text-primary" : "border-white/15 text-white/60")}>{gradient}</button>
                          ))}
                        </div>
                        <div className="mt-3 rounded-xl border border-white/10 p-3" style={getProfileGradientStyle(form.profileGradient?.startsWith("custom:")?form.profileGradient:"custom:"+form.customProfileStart+":"+form.customProfileMiddle+":"+form.customProfileEnd)}>
                          <div className="text-center py-3 text-xs font-bold text-white drop-shadow">PROFILE PREVIEW</div>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {["customProfileStart","customProfileMiddle","customProfileEnd"].map((key,i)=><label key={key} className="text-[9px] text-white/50">{["START","MIDDLE","END"][i]}<input type="color" value={form[key]||["#0ea5e9","#8b5cf6","#ec4899"][i]} disabled={!canUseDihhro} onChange={e=>setForm({...form,[key]:e.target.value,profileGradient:"custom:"+[form.customProfileStart||"#0ea5e9",form.customProfileMiddle||"#8b5cf6",form.customProfileEnd||"#ec4899"].map((v,j)=>j===i?e.target.value:v).join(":")})} className="mt-1 h-9 w-full cursor-pointer rounded bg-transparent"/></label>)}
                        </div>
                      </Field>
                      <Field label="PROFILE TEXT & OUTLINE COLORS">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[9px] text-white/60">PROFILE TEXT<input type="color" value={form.profileTextColor || "#ffffff"} onChange={e=>setForm({...form,profileTextColor:e.target.value})} className="mt-1 h-9 w-full rounded bg-transparent"/></label>
                          <label className="text-[9px] text-white/60">BOX OUTLINES<input type="color" value={form.profileBorderColor || "#ffffff"} onChange={e=>setForm({...form,profileBorderColor:e.target.value})} className="mt-1 h-9 w-full rounded bg-transparent"/></label>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-2 text-[9px] text-white/60"><input type="checkbox" checked={form.profileGradientAnimated !== false} onChange={e=>setForm({...form,profileGradientAnimated:e.target.checked})}/> ANIMATE GRADIENT</label>
                          <select value={form.profileGradientOrientation || "portrait"} onChange={e=>setForm({...form,profileGradientOrientation:e.target.value})} className="rounded border border-white/20 bg-black px-2 py-1 text-[9px] text-white">
                            <option value="portrait">PORTRAIT GRADIENT</option>
                            <option value="landscape">LANDSCAPE GRADIENT</option>
                          </select>
                        </div>
                        <div className="mt-2 rounded border p-3 text-xs" style={{color:form.profileTextColor||"#fff",borderColor:form.profileBorderColor||"#fff"}}>Preview: bio, pronouns and profile panels</div>
                      </Field>
                      <Field label="CUSTOM NAME GRADIENT (DIHTRO)">
                        <div className="mb-2 flex gap-2">
                          <button type="button" disabled={!canUseDihhro} onClick={() => setForm({ ...form, usernameFont: "custom-gradient|" + (form.usernameFont?.startsWith("custom-gradient|") ? form.usernameFont.split("|")[1] : form.usernameFont?.startsWith("custom-font|") ? "default" : (form.usernameFont || "default")) + "|" + (form.customTextStart || "#22d3ee") + "|" + (form.customTextMiddle || "#a78bfa") + "|" + (form.customTextEnd || "#f472b6") })} className={cn("rounded border px-3 py-2 text-[9px] uppercase", form.usernameFont?.startsWith("custom-gradient|") || form.usernameFont?.startsWith("custom-font|") ? "border-primary bg-primary/20 text-primary" : "border-white/15 text-white/60")}>Use custom gradient</button>
                          <button type="button" disabled={!canUseDihhro} onClick={() => setForm({ ...form, usernameFont: form.usernameFont?.startsWith("custom-font|") ? form.usernameFont : form.usernameFont?.startsWith("custom-gradient|") ? form.usernameFont.split("|")[1] || "default" : form.usernameFont || "default" })} className="rounded border border-white/15 px-3 py-2 text-[9px] uppercase text-white/60">Use font only</button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {["customTextStart","customTextMiddle","customTextEnd"].map((key,i)=><label key={key} className="text-[9px] text-white/50">{["START","MIDDLE","END"][i]}<input type="color" value={form[key]||["#22d3ee","#a78bfa","#f472b6"][i]} disabled={!canUseDihhro} onChange={e=>{const next={...form,[key]:e.target.value};const base= form.usernameFont?.startsWith("custom-gradient|")?form.usernameFont.split("|")[1]:form.usernameFont?.startsWith("custom-font|")?"default":(form.usernameFont||"default");setForm({...next,usernameFont:"custom-gradient|"+base+"|"+(i===0?e.target.value:(form.customTextStart||"#22d3ee"))+"|"+(i===1?e.target.value:(form.customTextMiddle||"#a78bfa"))+"|"+(i===2?e.target.value:(form.customTextEnd||"#f472b6"))})}} className="mt-1 h-9 w-full rounded bg-transparent"/></label>)}
                        </div>
                        <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3 text-center text-xl font-black" style={getUsernameGradientStyle(form.usernameFont?.startsWith("custom-gradient|")?form.usernameFont:"custom-gradient|"+(form.usernameFont?.startsWith("custom-gradient|")?form.usernameFont.split("|")[1]:(form.usernameFont||"default"))+"|"+(form.customTextStart||"#22d3ee")+"|"+(form.customTextMiddle||"#a78bfa")+"|"+(form.customTextEnd||"#f472b6"))}>Your name</div>
                      </Field>
                      <Field label="DIHTRO FONT MAP (UPLOAD YOUR OWN FONT)">
                        <div className="text-[9px] text-white/50 mb-2">Upload a .WOFF, .WOFF2, .TTF or .OTF font. DIHTRO members only.</div>
                        <input ref={fontFileRef} type="file" accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(!file)return;const extension=file.name.split(".").pop()?.toLowerCase();if(!["woff","woff2","ttf","otf"].includes(extension||"")){toast({title:"UNSUPPORTED_FONT",description:"Choose a WOFF, WOFF2, TTF or OTF file.",variant:"destructive"});e.target.value="";return;}if(file.size>256*1024){toast({title:"FONT_TOO_LARGE",description:"Font files must be 256 KB or smaller.",variant:"destructive"});e.target.value="";return;}const reader=new FileReader();reader.onload=()=>{const data=String(reader.result||"");const base=form.usernameFont?.startsWith("custom-font|")?form.usernameFont.split("|")[1]:null;const fontData=data.startsWith("data:application/octet-stream;")?data.replace("data:application/octet-stream;","data:font/"+(extension==="woff2"?"woff2":extension==="woff"?"woff":extension==="ttf"?"ttf":"otf")+";"):data;setForm({...form,usernameFont:"custom-font|"+fontData+"|"+(form.customTextStart||"#22d3ee")+"|"+(form.customTextMiddle||"#a78bfa")+"|"+(form.customTextEnd||"#f472b6")});toast({title:"DIHTRO_FONT_LOADED",description:file.name+" is ready. Save your profile to apply it."});};reader.onerror=()=>toast({title:"FONT_UPLOAD_FAILED",description:"Could not read that font file.",variant:"destructive"});reader.readAsDataURL(file);e.target.value="";}} />
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={!canUseDihhro} onClick={()=>fontFileRef.current?.click()} className="rounded border border-fuchsia-400/40 bg-fuchsia-400/10 px-3 py-2 text-[9px] font-mono text-fuchsia-200 disabled:opacity-40"><Upload className="mr-1 inline h-3 w-3"/>UPLOAD FONT</button>
                          {form.usernameFont?.startsWith("custom-font|") && <button type="button" onClick={()=>setForm({...form,usernameFont:"default"})} className="rounded border border-white/20 px-3 py-2 text-[9px] text-white/70">REMOVE UPLOADED FONT</button>}
                        </div>
                        <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3 text-center text-xl font-black" style={{...getUsernameFontStyle(form.usernameFont),...getUsernameGradientStyle(form.usernameFont)}}>DIHTRO PREVIEW</div>
                      </Field>
                      <Field label="USERNAME FONT">
                        <div className="grid grid-cols-2 gap-1.5">
                          {USERNAME_FONTS.filter(f => f.id !== "comic-sans" || (viewer?.dihhroUntil && new Date(viewer.dihhroUntil) > new Date()) || ["owner","admin"].includes(viewer?.role)).map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() =>
                                setForm({ ...form, usernameFont: f.id })
                              }
                              className={cn(
                                "border px-2 py-1.5 rounded text-xs transition-all",
                                form.usernameFont === f.id
                                  ? "border-primary bg-primary/10"
                                  : "border-primary/20 hover:border-primary/50",
                              )}
                              data-testid={`button-font-${f.id}`}
                            >
                              <span className={f.className}>{f.label}</span>
                            </button>
                          ))}
                        </div>
                      </Field>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            setEditing(false);
                            setForm({
                              ...profile,
                              usernameFont: profile.usernameFont || "default",
                              tagSymbol: profile.tagSymbol || PROFILE_TAG_SYMBOLS[0],
                              tagText: profile.tagText || "",
                              tagColor: profile.tagColor || PROFILE_TAG_COLORS[0],
                            });
                          }}
                          className="flex-1 text-[10px] font-mono text-white/60 border border-white/20 px-2 py-2 rounded hover:bg-white/5"
                          data-testid="button-cancel-edit"
                        >
                          CANCEL
                        </button>
                        <button
                          onClick={() => saveMut.mutate()}
                          disabled={saveMut.isPending}
                          className="flex-1 text-[10px] font-mono text-black bg-primary px-2 py-2 rounded hover:bg-primary/80 disabled:opacity-50"
                          data-testid="button-save-profile"
                        >
                          <Save className="w-3 h-3 inline mr-1" />
                          {saveMut.isPending ? "SAVING..." : "SAVE"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
          {fullImageUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4"
              onClick={(event) => {
                event.stopPropagation();
                if (event.target === event.currentTarget) setFullImageUrl(null);
              }}
              data-testid="full-profile-image-viewer"
            >
              <button
                type="button"
                onClick={() => setFullImageUrl(null)}
                className="absolute top-4 right-4 z-10 rounded-full border border-white/30 bg-black/70 p-2 text-white hover:border-primary"
                aria-label="Close full-size image"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={fullImageUrl}
                alt={`${profile?.username || "Profile"} full-size image`}
                loading="eager"
                decoding="async"
                className="max-h-[92vh] max-w-[96vw] object-contain"
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[9px] text-primary/60 font-mono uppercase mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}
