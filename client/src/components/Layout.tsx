import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Globe, MessageSquare, History, ShieldAlert, LogOut, Menu, X, Cpu, Settings, Blocks, UserRound, ShoppingBag, Gamepad2, Users, ScrollText, Server, Sparkles, Command } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar } from "./ProfileModal";
import { UserProfileTag } from "./UserProfileTag";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navItems = [
    { href: "/proxy", label: "Net Proxy", icon: Globe, section: "Workspace" },
    { href: "/chat", label: "Messages", icon: MessageSquare, section: "Workspace", accent: "violet" },
    { href: "/servers", label: "Servers", icon: Server, section: "Workspace", accent: "cyan" },
    { href: "/history", label: "History", icon: History, section: "Workspace" },
    { href: "/updates", label: "Update Logs", icon: ScrollText, section: "Workspace" },
    { href: "/block-blast", label: "Block Blast", icon: Blocks, section: "Playground", accent: "amber" },
    { href: "/shop", label: "Shop", icon: ShoppingBag, section: "Playground", accent: "pink" },
    { href: "/hub", label: "Community Hub", icon: Gamepad2, section: "Playground" },
    { href: "/hangouts", label: "2D Hangouts", icon: Users, section: "Playground" },
    { href: "/settings", label: "Settings", icon: Settings, section: "Account" },
  ];
  const role = String(user?.role || "").toLowerCase().replace(/_/g, "-");
  if (["owner","admin","trial-admin","moderator","trial-moderator","helper","trial-helper"].includes(role))
    navItems.push({ href: "/moderation", label: "Moderation", icon: ShieldAlert, section: "Staff" });
  if (["owner","admin","trial-admin"].includes(role))
    navItems.push({ href: "/admin", label: "Admin Console", icon: Command, section: "Staff" });
  const sections = Array.from(new Set(navItems.map(item => item.section)));
  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="nexus-shell min-h-screen flex flex-col md:flex-row">
      <header className="nexus-mobilebar flex md:hidden">
        <button className="nexus-brand-mark" onClick={() => setIsMobileMenuOpen(v => !v)} aria-label="Toggle navigation">
          {isMobileMenuOpen ? <X size={19}/> : <Menu size={19}/>}
        </button>
        <div className="flex items-center gap-2"><span className="nexus-brand-orb"><Cpu size={17}/></span><span className="font-black tracking-[.18em] text-sm">NEXUS</span></div>
        <span className="nexus-live-pill"><i/> LIVE</span>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && <motion.button aria-label="Close navigation" className="nexus-mobile-scrim md:hidden" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={closeMenu}/>}
      </AnimatePresence>
      <aside
        className={cn("nexus-sidebar fixed inset-y-0 left-0 z-[60] flex w-[278px] flex-col md:relative md:translate-x-0", isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}
      >
        <div className="nexus-brand">
          <div className="nexus-brand-orb"><Cpu size={20}/><span/></div>
          <div className="min-w-0"><div className="nexus-brand-name">NEXUS<span>OS</span></div><div className="nexus-brand-sub">YOUR DIGITAL UNIVERSE</div></div>
          <div className="ml-auto"><span className="nexus-version">2.6</span></div>
        </div>

        <div className="nexus-workspace-card">
          <div className="nexus-workspace-icon"><Sparkles size={16}/></div>
          <div className="min-w-0 flex-1"><div className="text-[11px] font-bold tracking-wide text-white">PERSONAL WORKSPACE</div><div className="mt-0.5 text-[10px] text-white/40">Everything in one place</div></div>
          <span className="nexus-live-dot"/>
        </div>

        <nav className="nexus-nav flex-1 overflow-y-auto px-3 pb-4">
          {sections.map((section, sectionIndex) => (
            <section key={section} className="nexus-nav-section">
              <div className="nexus-section-label"><span>{section}</span><i/></div>
              <div className="space-y-1">
                {navItems.filter(item => item.section === section).map(item => {
                  const active = location === item.href || (item.href !== "/" && location.startsWith(item.href + "/"));
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={closeMenu}
                      className={cn("nexus-nav-link", active && "is-active", `nav-motion-${(navItems.indexOf(item) % 8) + 1}`)}
                      aria-current={active ? "page" : undefined}>
                      <span className="nexus-nav-icon"><Icon size={17}/></span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {active && <motion.span layoutId="nexus-active-indicator" className="nexus-nav-active-indicator"/>}
                      {item.href === "/chat" && <span className="nexus-nav-signal"/>}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="nexus-sidebar-footer">
          <div className="nexus-user-card">
            <div className="relative"><Avatar url={user?.avatarUrl} name={user?.username || "?"} size={38} font={user?.usernameFont}/><span className="nexus-avatar-status"/></div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1"><span className="truncate text-[12px] font-bold text-white">{user?.username || "Loading…"}</span><UserProfileTag tagSymbol={user?.tagSymbol} tagText={user?.tagText} tagColor={user?.tagColor} size="compact"/></div>
              <div className="mt-0.5 truncate text-[10px] text-emerald-300/80">{String(user?.role || "user").replace(/-/g," ")} · {user?.presenceStatus || "offline"}</div>
            </div>
            <button className="nexus-icon-button" onClick={() => logout()} title="Sign out" aria-label="Sign out"><LogOut size={15}/></button>
          </div>
          <Link href="/profile" onClick={closeMenu} className={cn("nexus-profile-link", location === "/profile" && "is-active")}><UserRound size={15}/> Open my profile <span>↗</span></Link>
          <div className="nexus-footer-meta"><span>● ALL SYSTEMS NOMINAL</span><span>SECURE SESSION</span></div>
        </div>
      </aside>

      <main className="nexus-main flex min-w-0 flex-1 flex-col">
        <header className="nexus-topbar hidden h-[58px] shrink-0 items-center justify-between px-7 md:flex">
          <div className="flex items-center gap-3"><span className="nexus-breadcrumb-dot"/><span className="text-[11px] font-semibold uppercase tracking-[.16em] text-white/45">Nexus Network</span><span className="text-white/15">/</span><span className="text-[11px] font-semibold text-white/85">{navItems.find(item => item.href === location)?.label || (location === "/profile" ? "My Profile" : "Workspace")}</span></div>
          <div className="flex items-center gap-4"><span className="nexus-encryption"><span/> AES-256 SESSION</span><span className="h-4 w-px bg-white/10"/><span className="text-[10px] tracking-widest text-white/30">NEXUS / 02.06</span></div>
        </header>
        <motion.div key={location} className="nexus-content flex-1 overflow-y-auto p-4 md:p-7" initial={{opacity:0,y:13,filter:"blur(5px)"}} animate={{opacity:1,y:0,filter:"blur(0px)"}} transition={{duration:.24,ease:[.2,.8,.2,1]}}>
          {children}
        </motion.div>
      </main>
    </div>
  );
}
