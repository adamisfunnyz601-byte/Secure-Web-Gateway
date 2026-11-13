import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Globe, MessageSquare, History, ShieldAlert, LogOut, Menu, X, Cpu, Settings, Blocks } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "./ProfileModal";
import { UserProfileTag } from "./UserProfileTag";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/proxy",   label: "Net Proxy",    icon: Globe },
    { href: "/chat",    label: "Messages",      icon: MessageSquare },
    { href: "/history", label: "History",       icon: History },
    { href: "/settings", label: "Settings",     icon: Settings },\n    { href: "/block-blast", label: "Block Blast 💥", icon: Blocks },
  ];

  if (user?.role === "owner") {
    navItems.push({ href: "/admin", label: "Admin", icon: ShieldAlert });
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "hsl(var(--background))" }}>
      {/* Mobile header */}
      <div className="md:hidden border-b border-border p-3 flex justify-between items-center"
        style={{ background: "hsl(225 7% 17%)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground text-sm">NEXUS</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-muted-foreground hover:text-foreground p-1">
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-60 flex flex-col transform transition-transform duration-300 md:relative md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{ background: "hsl(225 7% 17%)" }}>

        {/* Brand */}
        <div className="p-4 border-b border-border/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-foreground text-sm">NEXUS</div>
            <div className="text-[10px] text-muted-foreground">v2.0 • SECURE</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2">
            Navigation
          </div>
          {navItems.map(item => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 group",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}>
                <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                {item.label}
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>

        {/* User panel */}
        <div className="p-3 border-t border-border/60" style={{ background: "hsl(220 8% 13%)" }}>
          <div className="flex items-center gap-3 px-1 mb-3">
            <Avatar
              url={user?.avatarUrl}
              name={user?.username || "?"}
              size={32}
              font={user?.usernameFont}
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="text-sm font-semibold text-foreground truncate">{user?.username}</div>
                <UserProfileTag
                  tagSymbol={user?.tagSymbol}
                  tagText={user?.tagText}
                  tagColor={user?.tagColor}
                  size="compact"
                />
              </div>
              <div className={cn(
                "text-[10px]",
                user?.role === "owner" ? "text-amber-400" : "text-green-400"
              )}>
                {user?.role === "owner" ? "Owner" : "Member"} • {user?.presenceStatus || "offline"}
              </div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden relative flex flex-col h-[calc(100vh-57px)] md:h-screen">
        {/* Top bar */}
        <header className="h-12 border-b border-border/60 flex items-center px-5 justify-between shrink-0"
          style={{ background: "hsl(228 7% 20%)" }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full status-online" />
            <span className="text-xs font-medium text-muted-foreground">System Online</span>
          </div>
          <div className="text-xs font-mono text-muted-foreground/60 hidden md:block">
            AES-256 • E2E Encrypted
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/70 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
    </div>
  );
}
