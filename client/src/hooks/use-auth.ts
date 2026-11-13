
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type LoginRequest = z.infer<typeof api.auth.login.input>;

type LoginCredentials = LoginRequest & {
  turnstileToken: string;
};

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading, error } = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, {
        credentials: "same-origin"
      });

      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");

      const data = await res.json();
      return api.auth.me.responses[200].parse(data);
    },
    retry: false
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(credentials)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : res.status === 401
              ? "Invalid password or access key."
              : `Login failed (${res.status}).`
        );
      }

      return api.auth.login.responses[200].parse(data);
    },

    onSuccess: (data) => {
      queryClient.setQueryData(
        [api.auth.me.path],
        data
      );

      toast({
        title: "ACCESS GRANTED",
        description: `Welcome back, ${data.username}`,
        className: "border-primary text-primary bg-black font-mono"
      });
    },

    onError: (error: Error) => {
      toast({
        title: "ACCESS DENIED",
        description: error.message,
        variant: "destructive",
        className: "border-destructive text-destructive bg-black font-mono"
      });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch(api.auth.logout.path, {
        method: api.auth.logout.method,
        credentials: "same-origin"
      });
    },

    onSuccess: () => {
      queryClient.setQueryData(
        [api.auth.me.path],
        null
      );

      queryClient.clear();

      toast({
        title: "SESSION TERMINATED",
        description: "Disconnecting...",
        className: "border-primary text-primary bg-black font-mono"
      });
    }
  });

  return {
    user,
    isLoading,
    error,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate
  };
}