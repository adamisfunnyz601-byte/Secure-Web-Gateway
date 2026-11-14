import { Layout } from "@/components/Layout";
import { CyberButton } from "@/components/CyberButton";
import { useHistory } from "@/hooks/use-history";
import { format } from "date-fns";
import { Trash2, ExternalLink, Clock } from "lucide-react";

export default function History() {
  const { history, isLoading, clearHistory } = useHistory();

  return (
    <Layout>
      <div className="nexus-page nexus-page-history space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-display text-primary tracking-widest mb-1">ACCESS_LOGS</h2>
            <p className="text-xs text-muted-foreground font-mono">RECORD OF NETWORK TRAVERSALS</p>
          </div>
          <CyberButton 
            variant="destructive" 
            onClick={() => clearHistory.mutate()}
            disabled={!history?.length}
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              PURGE_LOGS
            </span>
          </CyberButton>
        </div>

        <div className="cyber-box p-0 overflow-hidden min-h-[400px]">
          {isLoading ? (
            <div className="p-8 text-center text-primary font-mono animate-pulse">LOADING_DATA_STREAMS...</div>
          ) : history?.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                <Clock className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <div className="text-muted-foreground font-mono">NO RECORDS FOUND</div>
            </div>
          ) : (
            <div className="w-full text-left">
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-primary/20 bg-primary/5 text-xs font-bold text-primary tracking-widest uppercase">
                <div className="col-span-3">Timestamp</div>
                <div className="col-span-7">Destination / Query</div>
                <div className="col-span-2 text-right">Action</div>
              </div>
              
              <div className="divide-y divide-primary/10">
                {history?.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors font-mono text-sm group">
                    <div className="col-span-3 text-muted-foreground text-xs">
                      {entry.visitedAt && format(new Date(entry.visitedAt), "yyyy-MM-dd HH:mm:ss")}
                    </div>
                    <div className="col-span-7 truncate text-foreground group-hover:text-primary transition-colors">
                      {entry.url}
                    </div>
                    <div className="col-span-2 text-right">
                      <a 
                        href={entry.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 border border-primary/30 text-primary hover:bg-primary hover:text-black transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
