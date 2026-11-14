import { useEffect, useState } from "react";
import { Bell, BellOff, Check, Circle, Moon, Settings as SettingsIcon, Volume2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { CyberButton } from "@/components/CyberButton";
import { CyberInput } from "@/components/CyberInput";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const statuses = [
  { id: "online", label: "Online", description: "You are available", color: "bg-green-400" },
  { id: "idle", label: "Idle", description: "Away from keyboard", color: "bg-yellow-400" },
  { id: "dnd", label: "Do Not Disturb", description: "Mute notification attention", color: "bg-red-400" },
  { id: "offline", label: "Invisible", description: "Appear offline to everyone", color: "bg-gray-500" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState(user?.presenceStatus || "online");
  const [muteNotifications, setMuteNotifications] = useState(Boolean(user?.muteNotifications));
  const [ringtoneUrl, setRingtoneUrl] = useState(user?.ringtoneUrl || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setStatus(user.presenceStatus || "online");
    setMuteNotifications(Boolean(user.muteNotifications));
    setRingtoneUrl(user.ringtoneUrl || "");
  }, [user]);

  const save = async (changes: Record<string, unknown>) => {
    setSaving(true);
    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error("Could not save settings");
      const updated = await response.json();
      queryClient.setQueryData(["/api/auth/me"], updated);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/users"] });
      toast({ title: "Settings saved" });
    } catch (error: any) {
      toast({ title: "Settings failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="nexus-page nexus-page-settings max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-primary" /> Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Control how people see you and how NEXUS notifies you.</p>
        </div>

        <section className="discord-card p-5">
          <h2 className="font-semibold text-foreground mb-1">Presence</h2>
          <p className="text-xs text-muted-foreground mb-4">Choose how your status appears in the server and DMs.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {statuses.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setStatus(item.id);
                  save({ presenceStatus: item.id });
                }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                  status === item.id ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/60"
                )}
              >
                <span className={cn("w-3 h-3 rounded-full shrink-0", item.color)} />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-foreground">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.description}</span>
                </span>
                {status === item.id && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        </section>

        <section className="discord-card p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-foreground mb-1">Notifications & calls</h2>
            <p className="text-xs text-muted-foreground">Customize the sounds and alerts you receive.</p>
          </div>
          <button
            onClick={() => {
              const next = !muteNotifications;
              setMuteNotifications(next);
              save({ muteNotifications: next });
            }}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary/70 text-left"
          >
            {muteNotifications ? <BellOff className="w-5 h-5 text-muted-foreground" /> : <Bell className="w-5 h-5 text-primary" />}
            <span className="flex-1">
              <span className="block text-sm font-medium text-foreground">Mute notifications</span>
              <span className="block text-xs text-muted-foreground">{muteNotifications ? "Notifications are muted" : "Notifications are enabled"}</span>
            </span>
            <span className={cn("w-10 h-5 rounded-full p-0.5 transition-colors", muteNotifications ? "bg-primary" : "bg-muted")}>
              <span className={cn("block w-4 h-4 rounded-full bg-white transition-transform", muteNotifications && "translate-x-5")} />
            </span>
          </button>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <CyberInput label="Custom ringtone URL" value={ringtoneUrl} onChange={e => setRingtoneUrl(e.target.value)} placeholder="https://...mp3" />
            </div>
            <CyberButton disabled={saving} onClick={() => save({ ringtoneUrl })}>
              <Volume2 className="w-4 h-4" /> Save
            </CyberButton>
          </div>
        </section>

        <section className="discord-card p-5">
          <h2 className="font-semibold text-foreground mb-2">Account</h2>
          <div className="text-sm text-muted-foreground">
            Signed in as <span className="text-foreground font-medium">{user?.displayName || user?.nickname || user?.username}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Use your profile card in chat to edit your username, display name, avatar, banner, bio, and pronouns.
          </div>
        </section>
      </div>
    </Layout>
  );
}