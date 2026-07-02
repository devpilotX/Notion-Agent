"use client";

import * as React from "react";
import { SectionCard } from "./section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Seed, ChevronDown } from "@/components/icons";
import {
  useMe,
  useSignOut,
  useUpdateName,
  useChangePassword,
} from "@/lib/api/auth";
import { cn } from "@/lib/utils";

export function ProfileSection({ delay = 0 }: { delay?: number }) {
  const { authRequired, user } = useMe();
  const { toast } = useToast();
  const signOut = useSignOut();
  const updateName = useUpdateName();
  const changePassword = useChangePassword();

  const [name, setName] = React.useState<string | null>(null);
  const [pwOpen, setPwOpen] = React.useState(false);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");

  // Local single-user mode: explain how to turn accounts on, nothing else.
  if (!authRequired || !user) {
    return (
      <SectionCard
        icon={<Seed size={18} />}
        title="Profile"
        subtitle="Local mode — no account needed"
        delay={delay}
      >
        <p className="text-sm text-stone">
          This engine runs in single-user mode on this machine. Before deploying
          it on the internet, set <code className="rounded bg-mist/70 px-1 font-mono text-xs">AUTH_ENABLED=true</code>{" "}
          in <code className="rounded bg-mist/70 px-1 font-mono text-xs">.env</code> — the app
          then asks for sign-in, and the first account created inherits
          everything you set up here.
        </p>
      </SectionCard>
    );
  }

  const displayName = name ?? user.name ?? "";

  const saveName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed || trimmed === user.name) return;
    try {
      await updateName.mutateAsync(trimmed);
      toast({ title: "Name updated", variant: "success" });
      setName(null);
    } catch {
      toast({ title: "Could not update name", variant: "danger" });
    }
  };

  const savePassword = async () => {
    try {
      await changePassword.mutateAsync({ current, next });
      toast({ title: "Password changed", variant: "success" });
      setCurrent("");
      setNext("");
      setPwOpen(false);
    } catch (err) {
      toast({
        title: "Could not change password",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  };

  const onSignOut = async () => {
    try {
      await signOut.mutateAsync();
    } catch {
      toast({ title: "Could not sign out", variant: "danger" });
    }
  };

  return (
    <SectionCard
      icon={<Seed size={18} />}
      title="Profile"
      subtitle="Your account on this engine"
      delay={delay}
    >
      <div className="space-y-4">
        <div className="rounded-[12px] border border-line bg-mist/40 px-3 py-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-stone">Email</span>
            <span className="font-medium text-bark">{user.email}</span>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-bark">Name</label>
          <div className="flex gap-2">
            <Input
              value={displayName}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              aria-label="Your name"
            />
            <Button
              variant="outline"
              className="shrink-0"
              onClick={saveName}
              disabled={
                updateName.isPending ||
                !displayName.trim() ||
                displayName.trim() === (user.name ?? "")
              }
            >
              {updateName.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setPwOpen((o) => !o)}
            className="flex items-center gap-1.5 text-sm font-medium text-stone hover:text-canopy"
          >
            <ChevronDown
              size={16}
              className={cn("transition-transform", pwOpen ? "" : "-rotate-90")}
            />
            Change password
          </button>
          {pwOpen && (
            <div className="mt-2 space-y-2">
              <Input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
              />
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="New password (8+ characters)"
                autoComplete="new-password"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={savePassword}
                disabled={changePassword.isPending || !current || next.length < 8}
              >
                {changePassword.isPending ? "Changing…" : "Change password"}
              </Button>
            </div>
          )}
        </div>

        <div className="border-t border-line/70 pt-3">
          <Button variant="outline" size="sm" onClick={onSignOut} disabled={signOut.isPending}>
            {signOut.isPending ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
