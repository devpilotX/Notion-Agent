"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, type SelectGroup } from "@/components/ui/select";
import { ChevronDown, Folder, Sliders } from "@/components/icons";
import { BrandLogo } from "@/components/brand-logos";
import { PRESETS, type PresetDef } from "@/lib/mcp-presets";
import { cn } from "@/lib/utils";
import type { McpConfig, McpAuth } from "@/lib/api/connections";

type Transport = "remote" | "local";
type AuthType = "none" | "bearer" | "basic" | "apikey";

const AUTH_GROUP: SelectGroup[] = [
  {
    provider: "Authentication",
    options: [
      { id: "none", label: "None" },
      { id: "bearer", label: "Bearer token" },
      { id: "basic", label: "Basic (user and password)" },
      { id: "apikey", label: "API key header" },
    ],
  },
];

function isValidUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseLines(text: string, sep: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const m = t.split(sep);
    if (m.length >= 2 && m[1] !== undefined) out[m[0].trim()] = t.slice(t.indexOf(m[1])).trim();
  }
  return out;
}

function PresetIcon({ def, size = 20 }: { def: PresetDef; size?: number }) {
  if (def.icon === "brand") return <BrandLogo name={def.key} size={size} />;
  if (def.icon === "folder") return <Folder size={size} className="text-moss" />;
  return <Sliders size={size} className="text-stone" />;
}

export function AddConnectionModal({
  open,
  onClose,
  onCreate,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (config: McpConfig) => Promise<{ status: string; config: McpConfig }>;
  isPending: boolean;
}) {
  const [presetKey, setPresetKey] = React.useState<string>("custom");
  const [selected, setSelected] = React.useState<PresetDef>(
    PRESETS.find((p) => p.key === "custom")!,
  );
  const [name, setName] = React.useState("");
  const [transport, setTransport] = React.useState<Transport>("remote");
  const [url, setUrl] = React.useState("");
  const [command, setCommand] = React.useState("npx");
  const [args, setArgs] = React.useState("");
  const [envText, setEnvText] = React.useState("");

  const [authType, setAuthType] = React.useState<AuthType>("none");
  const [token, setToken] = React.useState("");
  const [prefix, setPrefix] = React.useState<"Bearer" | "Token">("Bearer");
  const [basicUser, setBasicUser] = React.useState("");
  const [basicPass, setBasicPass] = React.useState("");
  const [apiKeyName, setApiKeyName] = React.useState("");
  const [apiKeyValue, setApiKeyValue] = React.useState("");

  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [headersText, setHeadersText] = React.useState("");
  const [timeout, setTimeoutMs] = React.useState("");
  const [error, setError] = React.useState("");

  const applyPreset = (def: PresetDef) => {
    setPresetKey(def.key);
    setSelected(def);
    setError("");
    setName(def.key === "custom" ? "" : def.label);
    setTransport(def.transport);
    setUrl(def.url ?? "");
    setCommand(def.command ?? "npx");
    setArgs((def.args ?? []).join(" "));
    setEnvText(def.envKeys ? def.envKeys.map((k) => `${k}=`).join("\n") : "");
    setAuthType(def.authType);
    setToken("");
    setBasicUser("");
    setBasicPass("");
    setApiKeyName("");
    setApiKeyValue("");
    if (def.envKeys) setAdvancedOpen(true);
  };

  const reset = () => {
    applyPreset(PRESETS.find((p) => p.key === "custom")!);
    setAdvancedOpen(false);
    setHeadersText("");
    setTimeoutMs("");
    setError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const buildAuth = (): McpAuth => {
    if (authType === "bearer") return { type: "bearer", token: token.trim(), prefix };
    if (authType === "basic") return { type: "basic", username: basicUser.trim(), password: basicPass };
    if (authType === "apikey")
      return { type: "apikey", headerName: apiKeyName.trim(), headerValue: apiKeyValue.trim() };
    return { type: "none" };
  };

  const valid = (() => {
    const base = transport === "remote" ? isValidUrl(url) : command.trim().length > 0;
    if (!base) return false;
    if (authType === "bearer") return token.trim().length > 0;
    if (authType === "basic") return basicUser.trim().length > 0;
    if (authType === "apikey") return apiKeyName.trim().length > 0 && apiKeyValue.trim().length > 0;
    return true;
  })();

  const submit = async () => {
    setError("");
    const config: McpConfig = { name: name.trim() || undefined, auth: buildAuth() };
    if (transport === "remote") {
      config.transport = "http";
      config.url = url.trim();
    } else {
      config.transport = "stdio";
      config.command = command.trim();
      config.args = args.trim() ? args.trim().split(/\s+/) : [];
      const env = parseLines(envText, /=/);
      if (Object.keys(env).length) config.env = env;
    }
    const headers = parseLines(headersText, /:/);
    if (Object.keys(headers).length) config.headers = headers;
    const t = parseInt(timeout, 10);
    if (!Number.isNaN(t) && t > 0) config.timeoutMs = t;

    try {
      const created = await onCreate(config);
      if (created.status === "connected") close();
      else setError("Could not connect. Check the URL or command, and any token.");
    } catch {
      setError("Could not reach the engine to connect.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add an MCP connection"
      description="Pick a server or set up your own. Its tools become available to runs."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || isPending}>
            {isPending ? "Connecting…" : "Connect"}
          </Button>
        </>
      }
    >
      <div className="verdant-scroll max-h-[62vh] space-y-3 overflow-y-auto pr-1">
        {/* Preset row with real brand logos */}
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-[12px] border px-2 py-2.5 text-center transition-colors",
                presetKey === p.key
                  ? "border-canopy bg-canopy/10"
                  : "border-line hover:border-moss",
              )}
            >
              <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-white shadow-soft ring-1 ring-black/[0.06]">
                <PresetIcon def={p} />
              </span>
              <span className="w-full truncate text-[11px] font-medium text-bark">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Help link and verify note for the chosen preset */}
        {(selected.helpUrl || selected.note) && (
          <div className="rounded-[10px] border border-line bg-mist/40 px-3 py-2 text-xs">
            {selected.note && <p className="text-stone">{selected.note}</p>}
            <div className="mt-1 flex items-center gap-3">
              {selected.helpUrl && (
                <a
                  href={selected.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-canopy hover:underline"
                >
                  {selected.helpLabel ?? "Open docs"}
                </a>
              )}
              {selected.needsCheck && (
                <span className="rounded-full bg-sun/20 px-2 py-0.5 text-[11px] font-medium text-bark">
                  Verify this endpoint
                </span>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-bark">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GitHub" />
        </div>

        {/* Transport */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-bark">Transport</label>
          <div className="flex gap-2">
            {(["remote", "local"] as Transport[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTransport(t)}
                className={cn(
                  "flex-1 rounded-[10px] border px-3 py-2 text-sm font-medium transition-colors",
                  transport === t ? "border-canopy bg-canopy/10 text-canopy" : "border-line text-stone hover:border-moss",
                )}
              >
                {t === "remote" ? "Remote URL" : "Local command"}
              </button>
            ))}
          </div>
        </div>

        {transport === "remote" ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-bark">Server URL</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://host/mcp" />
            {url.trim().length > 0 && !isValidUrl(url) && (
              <p className="mt-1 text-xs text-danger">Enter a valid http or https URL.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-bark">Command</label>
                <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-bark">Arguments</label>
                <Input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-filesystem ." />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-bark">Environment variables</label>
              <Textarea value={envText} onChange={(e) => setEnvText(e.target.value)} rows={2} placeholder={"KEY=value"} />
            </div>
          </div>
        )}

        {/* Auth */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-bark">Authentication</label>
          <Select groups={AUTH_GROUP} value={authType} onChange={(v) => setAuthType(v as AuthType)} ariaLabel="Authentication" />
          {authType === "bearer" && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token" />
              </div>
              <Select
                groups={[{ provider: "Prefix", options: [{ id: "Bearer", label: "Bearer" }, { id: "Token", label: "Token" }] }]}
                value={prefix}
                onChange={(v) => setPrefix(v as "Bearer" | "Token")}
                ariaLabel="Token prefix"
              />
            </div>
          )}
          {authType === "basic" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input value={basicUser} onChange={(e) => setBasicUser(e.target.value)} placeholder="Username" />
              <Input type="password" value={basicPass} onChange={(e) => setBasicPass(e.target.value)} placeholder="Password" />
            </div>
          )}
          {authType === "apikey" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} placeholder="Header name (X-API-Key)" />
              <Input type="password" value={apiKeyValue} onChange={(e) => setApiKeyValue(e.target.value)} placeholder="Header value" />
            </div>
          )}
        </div>

        {/* Advanced */}
        <div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="flex items-center gap-1.5 text-sm font-medium text-stone hover:text-canopy"
          >
            <ChevronDown size={16} className={cn("transition-transform", advancedOpen ? "" : "-rotate-90")} />
            Advanced settings
          </button>
          {advancedOpen && (
            <div className="mt-2 space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-bark">Custom headers</label>
                <Textarea value={headersText} onChange={(e) => setHeadersText(e.target.value)} rows={2} placeholder={"X-Custom: value"} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-bark">Timeout (ms)</label>
                <Input type="number" value={timeout} onChange={(e) => setTimeoutMs(e.target.value)} placeholder="30000" />
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-[10px] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <p className="rounded-[10px] border border-sun/40 bg-sun/10 px-3 py-2 text-xs text-bark">
          This server has not been reviewed. Once connected it can access and change your agent
          data. Only connect servers you trust.
        </p>
      </div>
    </Modal>
  );
}
