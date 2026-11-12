import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { CyberInput } from "@/components/CyberInput";
import { CyberButton } from "@/components/CyberButton";
import { useAdminKeys } from "@/hooks/use-admin";
import { useAuth } from "@/hooks/use-auth";
import {
  ShieldAlert, Plus, Trash2, Key, Star, Upload,
  CheckCircle2, XCircle, Clock, Smile
} from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { keys, generateKey, deleteKey } = useAdminKeys();
  const [duration, setDuration] = useState("60");
  const [type, setType] = useState<"limited" | "permanent">("limited");

  // Emoji state
  const [emojiName, setEmojiName] = useState("");
  const [emojiPreview, setEmojiPreview] = useState<string | null>(null);
  const emojiFileRef = useRef<HTMLInputElement>(null);
  const [emojiFile, setEmojiFile] = useState<string | null>(null);

  const { data: customEmojis = [], refetch: refetchEmojis } = useQuery<any[]>({
    queryKey: ["/api/emojis"],
    queryFn: async () => {
      const r = await fetch("/api/emojis");
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: accessRequests = [], refetch: refetchRequests } = useQuery<any[]>({
    queryKey: ["/api/admin/requests"],
    queryFn: async () => {
      const r = await fetch("/api/admin/requests");
      if (!r.ok) return [];
      return r.json();
    },
  });

  const createEmojiMut = useMutation({
    mutationFn: async () => {
      if (!emojiFile || !emojiName.trim()) throw new Error("Name and image required");
      const res = await fetch("/api/admin/emojis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: emojiName.trim(), url: emojiFile }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Emoji added!" });
      setEmojiName("");
      setEmojiFile(null);
      setEmojiPreview(null);
      refetchEmojis();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteEmojiMut = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/emojis/${id}`, { method: "DELETE" });
    },
    onSuccess: () => { toast({ title: "Emoji deleted" }); refetchEmojis(); },
  });

  const updateRequestMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast({ title: "Status updated" }); refetchRequests(); },
  });

  const createShopItem = useMutation({
    mutationFn: async (item: any) => {
      const res = await fetch("/api/admin/shop_items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/items"] });
      toast({ title: "Item Created" });
    },
  });

  if (user?.role !== "owner") {
    return (
      <Layout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground text-sm">Owner access required</p>
          </div>
        </div>
      </Layout>
    );
  }

  const handleGenerate = () => {
    generateKey.mutate({
      type,
      durationMinutes: type === "limited" ? parseInt(duration) : undefined,
    });
  };

  const handleEmojiFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Images only (PNG, JPEG, WebP, GIF)", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Max 2MB for emojis", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setEmojiFile(String(reader.result));
      setEmojiPreview(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const pendingRequests = accessRequests.filter((r: any) => r.status === "pending");

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <ShieldAlert className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Admin Console</h1>
          {pendingRequests.length > 0 && (
            <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingRequests.length} pending
            </span>
          )}
        </div>

        <Tabs defaultValue="keys" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="keys">Keys</TabsTrigger>
            <TabsTrigger value="emojis" className="flex items-center gap-1">
              <Smile className="w-3 h-3" /> Emojis
            </TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              Requests
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="shop">Shop</TabsTrigger>
          </TabsList>

          {/* ── KEYS TAB ── */}
          <TabsContent value="keys" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="discord-card p-5 space-y-4">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" /> Generate Key
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setType("limited")}
                    className={cn(
                      "flex-1 py-2 rounded text-xs font-medium transition-all",
                      type === "limited" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >Temporary</button>
                  <button
                    onClick={() => setType("permanent")}
                    className={cn(
                      "flex-1 py-2 rounded text-xs font-medium transition-all",
                      type === "permanent" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >Permanent</button>
                </div>
                {type === "limited" && (
                  <CyberInput label="Duration (minutes)" type="number" value={duration} onChange={e => setDuration(e.target.value)} />
                )}
                <CyberButton onClick={handleGenerate} className="w-full" isLoading={generateKey.isPending}>
                  <Plus className="w-4 h-4" /> Generate Key
                </CyberButton>
                <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
                  ⚠️ Keys grant full access. Distribute to trusted users only.
                </div>
              </div>

              <div className="lg:col-span-2 discord-card overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold text-foreground text-sm">Active Keys</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">Key</th>
                        <th className="px-4 py-3 text-left font-medium">User</th>
                        <th className="px-4 py-3 text-left font-medium">Type</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys?.map(key => (
                        <tr key={key.id} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-primary text-xs">{key.key}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{(key as any).username || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-medium",
                              key.type === "permanent" ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"
                            )}>
                              {key.type}{key.durationMinutes ? ` (${key.durationMinutes}m)` : ""}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("flex items-center gap-1.5 text-xs", key.isUsed ? "text-red-400" : "text-green-400")}>
                              <div className={cn("w-1.5 h-1.5 rounded-full", key.isUsed ? "bg-red-400" : "bg-green-400")} />
                              {key.isUsed ? "Used" : "Active"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => deleteKey.mutate(key.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!keys?.length && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No keys generated yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── EMOJIS TAB ── */}
          <TabsContent value="emojis" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="discord-card p-5 space-y-4">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Smile className="w-4 h-4 text-primary" /> Add Custom Emoji
                </h3>
                <p className="text-xs text-muted-foreground">Upload a PNG, JPEG, WebP, or GIF. Max 2MB. Will appear in the emoji picker for all users.</p>

                <div
                  onClick={() => emojiFileRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors",
                    emojiPreview ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/40"
                  )}
                >
                  {emojiPreview ? (
                    <>
                      <img src={emojiPreview} alt="preview" className="w-14 h-14 object-contain" />
                      <span className="text-xs text-primary">Click to change</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Click to upload image</span>
                      <span className="text-[10px] text-muted-foreground/60">PNG, JPEG, WebP, GIF • Max 2MB</span>
                    </>
                  )}
                </div>
                <input ref={emojiFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleEmojiFileSelect} className="hidden" />

                <CyberInput
                  label="Emoji Name (no spaces)"
                  placeholder="e.g. sigma, catgiggle"
                  value={emojiName}
                  onChange={e => setEmojiName(e.target.value.replace(/\s+/g, "_").toLowerCase())}
                />

                <CyberButton
                  onClick={() => createEmojiMut.mutate()}
                  className="w-full"
                  isLoading={createEmojiMut.isPending}
                  disabled={!emojiFile || !emojiName.trim()}
                >
                  <Star className="w-4 h-4" /> Add Emoji
                </CyberButton>
              </div>

              <div className="lg:col-span-2 discord-card overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold text-foreground text-sm">
                    Custom Emojis ({customEmojis.length})
                  </h3>
                </div>
                {customEmojis.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    <Smile className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    No custom emojis yet. Upload some above!
                  </div>
                ) : (
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {customEmojis.map((emoji: any) => (
                      <div key={emoji.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary/60 group transition-colors">
                        <img src={emoji.url} alt={emoji.name} className="w-10 h-10 object-contain rounded" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">:{emoji.name}:</div>
                          <div className="text-[10px] text-muted-foreground">
                            {emoji.createdAt ? format(new Date(emoji.createdAt), "MMM d") : ""}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteEmojiMut.mutate(emoji.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── REQUESTS TAB ── */}
          <TabsContent value="requests" className="space-y-4">
            <div className="discord-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">Access Requests</h3>
                <span className="text-xs text-muted-foreground">{accessRequests.length} total</span>
              </div>
              {accessRequests.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  No access requests yet
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {accessRequests.map((req: any) => (
                    <div key={req.id} className="p-4 hover:bg-secondary/20 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground text-sm">{req.name}</span>
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-medium",
                              req.status === "approved" ? "bg-green-500/20 text-green-400" :
                              req.status === "rejected" ? "bg-red-500/20 text-red-400" :
                              "bg-amber-500/20 text-amber-400"
                            )}>
                              {req.status}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {req.createdAt ? format(new Date(req.createdAt), "MMM d, HH:mm") : ""}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{req.message}</p>
                        </div>
                        {req.status === "pending" && (
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => updateRequestMut.mutate({ id: req.id, status: "approved" })}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-500/15 text-green-400 hover:bg-green-500/25 text-xs font-medium transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => updateRequestMut.mutate({ id: req.id, status: "rejected" })}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs font-medium transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── SHOP TAB ── */}
          <TabsContent value="shop">
            <div className="discord-card p-5 max-w-lg">
              <h3 className="font-semibold text-foreground text-sm mb-4">Create Shop Item</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createShopItem.mutate({
                  name: fd.get("name"),
                  description: fd.get("description"),
                  type: fd.get("type"),
                  price: Number(fd.get("price")),
                  imageUrl: fd.get("imageUrl"),
                });
                (e.target as HTMLFormElement).reset();
              }} className="space-y-4">
                <CyberInput label="Item Name" name="name" required />
                <CyberInput label="Price (coins)" name="price" type="number" required />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</label>
                  <select name="type" className="w-full bg-input border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/50" required>
                    <option value="decoration">Profile Decoration</option>
                    <option value="name_style">Name Style</option>
                  </select>
                </div>
                <CyberInput label="Image URL (PNG/CSS)" name="imageUrl" />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
                  <textarea name="description" rows={3} className="w-full bg-input border border-border rounded px-3 py-2 text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/50" />
                </div>
                <CyberButton type="submit" disabled={createShopItem.isPending} className="w-full">
                  Create Item
                </CyberButton>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
