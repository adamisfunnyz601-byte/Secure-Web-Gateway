import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import Login from "@/pages/Login";
import SignUp from "@/pages/SignUp";
import Proxy from "@/pages/Proxy";
import History from "@/pages/History";
import Admin from "@/pages/Admin";
import Shop from "@/pages/Shop";
import NotFound from "@/pages/not-found";
import SettingsPage from "@/pages/Settings";
import BlockBlast from "@/pages/BlockBlast";
import Hub from "@/pages/Hub";
import Hangouts from "@/pages/Hangouts";
import Invite from "@/pages/Invite";
import DihhroGift from "@/pages/DihhroGift";
import MyProfile from "@/pages/MyProfile";
import ModerationPanel from "@/pages/ModerationPanel";
import Chat from "@/pages/Chat";
import UpdatesPage from "@/pages/Updates";\nimport ServersPage from "@/pages/Servers";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <div className="text-primary font-mono tracking-widest animate-pulse">
            ESTABLISHING_UPLINK...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/signup" component={SignUp} />
      <Route path="/invite/:code">{params => <Invite code={params.code} />}</Route>
      <Route path="/gift/:code">{params => <DihhroGift code={params.code} />}</Route>
      <Route path="/proxy">
        <ProtectedRoute component={Proxy} />
      </Route>
      <Route path="/chat" component={() => null} />
      <Route path="/updates"><ProtectedRoute component={UpdatesPage} /></Route>\n      <Route path="/servers"><ProtectedRoute component={ServersPage} /></Route>
      <Route path="/history">
        <ProtectedRoute component={History} />
      </Route>
      <Route path="/moderation"><ProtectedRoute component={ModerationPanel} /></Route>
      <Route path="/admin">
        <ProtectedRoute component={Admin} />
      </Route>
      <Route path="/shop">
        <ProtectedRoute component={Shop} />
      </Route>
      <Route path="/profile"><ProtectedRoute component={MyProfile} /></Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>
      <Route path="/block-blast">
        <ProtectedRoute component={BlockBlast} />
      </Route>
      <Route path="/hub">
        <ProtectedRoute component={Hub} />
      </Route>
      <Route path="/hangouts">
        <ProtectedRoute component={Hangouts} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}


function GlobalChatHost() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  if (isLoading || !user) return null;
  const isChatPage = location === "/chat";
  return (
    <div
      aria-hidden={!isChatPage}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 30,
        visibility: isChatPage ? "visible" : "hidden",
        pointerEvents: isChatPage ? "auto" : "none",
      }}
    >
      <Chat />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <GlobalChatHost />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
