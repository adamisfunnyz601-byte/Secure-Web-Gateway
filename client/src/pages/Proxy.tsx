import { useState } from "react";
import { Layout } from "@/components/Layout";
import { CyberInput } from "@/components/CyberInput";
import { CyberButton } from "@/components/CyberButton";
import { Search, Globe, Shield, AlertTriangle, RefreshCw, ArrowLeft, ArrowRight } from "lucide-react";
import { useHistory } from "@/hooks/use-history";
import { useToast } from "@/hooks/use-toast";

export default function Proxy() {
  const [url, setUrl] = useState("");
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { addEntry } = useHistory();
  const { toast } = useToast();

  const navigate = (target: string) => {
    let fixed = target.trim();
    if (!fixed) return;
    if (!fixed.startsWith("http://") && !fixed.startsWith("https://")) {
      // If it looks like a domain, add https
      if (fixed.includes(".") && !fixed.includes(" ")) {
        fixed = `https://${fixed}`;
      } else {
        // Otherwise treat as a search
        fixed = `https://www.google.com/search?q=${encodeURIComponent(fixed)}`;
      }
    }
    setActiveUrl(fixed);
    setUrl(fixed);
    const encoded = `/api/proxy?url=${encodeURIComponent(fixed)}`;
    setProxyUrl(encoded);
    setIsLoading(true);
    addEntry.mutate({ url: fixed, query: "Proxy Visit" });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(url);
  };

  return (
    <Layout>
      <div className="nexus-page nexus-page-proxy flex flex-col h-full space-y-4">
        {/* Browser Chrome */}
        <div className="cyber-box p-3">
          <form onSubmit={handleSearch} className="flex gap-3 items-center">
            <button
              type="button"
              disabled={!activeUrl}
              className="p-2 border border-primary/20 hover:border-primary text-primary/50 hover:text-primary disabled:opacity-30 transition-all"
              title="Reload"
              onClick={() => { if (activeUrl) navigate(activeUrl); }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/30" />
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Enter URL or search term..."
                className="w-full bg-black border border-primary/20 pl-9 pr-4 py-2 text-[13px] font-mono text-primary outline-none focus:border-primary/50 transition-all"
                autoFocus
              />
            </div>
            <CyberButton type="submit" className="px-5 py-2 text-[12px] shrink-0">
              <Search className="w-3.5 h-3.5 mr-1.5 inline" />
              GO
            </CyberButton>
          </form>
        </div>

        {/* Browser Window */}
        <div className="flex-1 cyber-box p-0 overflow-hidden relative flex flex-col min-h-0">
          {/* Tab bar */}
          <div className="h-9 bg-black/60 border-b border-primary/20 flex items-center px-4 gap-3 shrink-0">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>
            <div className="flex-1 bg-black/30 h-5 rounded text-[11px] font-mono text-muted-foreground flex items-center px-3 truncate border border-primary/10">
              {activeUrl ? (
                <span className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-primary/50 shrink-0" />
                  {activeUrl}
                </span>
              ) : "NO_TARGET_SELECTED"}
            </div>
            {isLoading && activeUrl && (
              <div className="text-[9px] font-mono text-primary/40 animate-pulse">LOADING...</div>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 relative bg-white min-h-0">
            {proxyUrl ? (
              <iframe
                key={proxyUrl}
                src={proxyUrl}
                className="w-full h-full border-none bg-white"
                title="Proxy View"
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
            ) : (
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center text-primary space-y-6">
                <Globe className="w-20 h-20 opacity-30 animate-pulse" />
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-display tracking-widest">SECURE_BROWSER_READY</h2>
                  <p className="text-muted-foreground font-mono text-sm">ENTER URL OR SEARCH TERM ABOVE</p>
                </div>
                <div className="grid grid-cols-3 gap-4 max-w-xl w-full px-8 mt-4">
                  {[
                    { icon: Shield, title: "PROXIED", desc: "Traffic routed through server" },
                    { icon: AlertTriangle, title: "HISTORY", desc: "Session logged locally only" },
                    { icon: Globe, title: "ANY SITE", desc: "Bypass iframe restrictions" },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="border border-primary/20 p-4 bg-primary/5 text-center">
                      <Icon className="w-7 h-7 mx-auto mb-2 text-primary/60" />
                      <div className="text-[10px] font-bold mb-1">{title}</div>
                      <div className="text-[9px] text-muted-foreground">{desc}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 max-w-xl w-full px-8">
                  {["google.com", "youtube.com", "wikipedia.org", "reddit.com", "github.com", "twitch.tv"].map(site => (
                    <button key={site} onClick={() => navigate(site)}
                      className="text-[10px] font-mono text-primary/40 border border-primary/10 py-1.5 hover:border-primary/40 hover:text-primary/70 transition-all">
                      {site}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
