import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { CyberCard } from "@/components/CyberCard";
import { CyberButton } from "@/components/CyberButton";
import { ShoppingBag, Star, Palette, Check, Coins } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function Shop() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: items = [] } = useQuery<any[]>({ queryKey: ["/api/shop/items"] });
  const { data: inventory = [] } = useQuery<any[]>({ queryKey: ["/api/shop/inventory"] });

  const buyMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Purchase failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Purchase successful", description: "Item added to inventory" });
    },
    onError: (error: Error) => {
      toast({ title: "Purchase failed", description: error.message, variant: "destructive" });
    }
  });

  const equipMutation = useMutation({
    mutationFn: async ({ decorationId, nameStyleId }: { decorationId?: number | null, nameStyleId?: number | null }) => {
      const res = await fetch("/api/shop/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decorationId, nameStyleId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Updated", description: "Profile look updated" });
    }
  });

  const isPurchased = (itemId: number) => inventory.some(i => i.id === itemId);

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display text-primary flex items-center gap-3">
              <ShoppingBag className="w-8 h-8" />
              NEURAL_MARKET
            </h1>
            <p className="text-primary/60 font-mono text-sm">Enhance your digital presence</p>
          </div>
          <div className="cyber-box px-4 py-2 bg-primary/10 flex items-center gap-3">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-mono text-primary font-bold">{Number(user?.coins || 0)} CR</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <CyberCard key={item.id} className="group relative overflow-hidden">
              <div className="p-4 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-primary/10 rounded">
                    {item.type === 'decoration' ? <Star className="w-5 h-5 text-primary" /> : <Palette className="w-5 h-5 text-accent" />}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-primary/40 block uppercase">{item.type}</span>
                    <span className="text-sm font-mono text-primary font-bold">{item.price} CR</span>
                  </div>
                </div>

                <h3 className="text-lg font-display text-primary mb-2 uppercase">{item.name}</h3>
                <p className="text-xs text-primary/60 font-mono mb-6 flex-1">{item.description}</p>

                {isPurchased(item.id) ? (
                  <CyberButton
                    onClick={() => equipMutation.mutate(item.type === 'decoration' ? { decorationId: item.id } : { nameStyleId: item.id })}
                    className="w-full"
                    variant={(user?.decorationId === item.id || user?.nameStyleId === item.id) ? "primary" : "secondary"}
                  >
                    {(user?.decorationId === item.id || user?.nameStyleId === item.id) ? (
                      <><Check className="w-4 h-4 mr-2" /> EQUIPPED</>
                    ) : 'EQUIP'}
                  </CyberButton>
                ) : (
                  <CyberButton
                    onClick={() => buyMutation.mutate(item.id)}
                    className="w-full"
                    disabled={buyMutation.isPending || Number(user?.coins || 0) < item.price}
                  >
                    ACQUIRE_DATA
                  </CyberButton>
                )}
              </div>
            </CyberCard>
          ))}
        </div>
      </div>
    </Layout>
  );
}
