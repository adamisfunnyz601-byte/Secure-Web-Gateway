import { Layout } from "@/components/Layout";
import { ProfileModal } from "@/components/ProfileModal";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export default function MyProfile() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return <Layout><div className="p-8 text-center text-muted-foreground">Loading your profile…</div></Layout>;
  if (!user) return <Layout><div className="p-8 text-center text-muted-foreground">Sign in to view your profile.</div></Layout>;

  return (
    <Layout>
      <div className="nexus-page nexus-page-profile mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground">View and edit your public profile, appearance and badges.</p>
        </div>
        <ProfileModal userId={user.id} currentUserId={user.id} onClose={() => setLocation("/chat")} />
      </div>
    </Layout>
  );
}
