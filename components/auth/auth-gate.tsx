"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Leaf } from "@/components/icons";
import { useMe, useSignIn, useSignUp } from "@/lib/api/auth";

/**
 * Gates the workbench behind sign-in when the engine has AUTH_ENABLED=true.
 * In local single-user mode (auth off) or offline it renders children as-is.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { authRequired, user, isLoading, refetch } = useMe();

  // A 401 anywhere (expired session) re-checks who we are.
  React.useEffect(() => {
    const onUnauthorized = () => {
      void refetch();
      qc.invalidateQueries({ queryKey: ["auth"] });
    };
    window.addEventListener("verdant:unauthorized", onUnauthorized);
    return () => window.removeEventListener("verdant:unauthorized", onUnauthorized);
  }, [refetch, qc]);

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="radius-leaf grid h-14 w-14 animate-pulse place-items-center bg-gradient-to-br from-canopy to-fern text-canopy-contrast">
          <Leaf size={26} strokeWidth={1.6} />
        </div>
      </div>
    );
  }

  if (authRequired && !user) return <SignInScreen />;
  return <>{children}</>;
}

function SignInScreen() {
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const signIn = useSignIn();
  const signUp = useSignUp();
  const busy = signIn.isPending || signUp.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (mode === "signin") {
        await signIn.mutateAsync({ email: email.trim(), password });
      } else {
        await signUp.mutateAsync({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the engine.");
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Reveal className="w-full max-w-sm">
        <div className="radius-leaf border border-line bg-paper p-7 shadow-lift">
          <div className="flex flex-col items-center text-center">
            <div className="radius-leaf grid h-14 w-14 place-items-center bg-gradient-to-br from-canopy to-fern text-canopy-contrast shadow-soft">
              <Leaf size={26} strokeWidth={1.6} />
            </div>
            <h1 className="mt-4 font-serif text-3xl text-bark">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1.5 text-sm text-stone">
              {mode === "signin"
                ? "Sign in to open your agent workbench."
                : "The first account inherits everything set up on this engine."}
            </p>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-bark">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How the agent should greet you"
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-bark">Email</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-bark">Password</label>
              <Input
                type="password"
                required
                minLength={mode === "signup" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>

            {error && (
              <p className="rounded-[10px] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <Button type="submit" disabled={busy} className="w-full justify-center">
              {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Sign up"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-stone">
            {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "signin" ? "signup" : "signin"));
                setError("");
              }}
              className="font-medium text-canopy hover:underline"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </Reveal>
    </div>
  );
}
