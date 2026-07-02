export type AgentDTO = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  greeting?: string | null;
  instructions?: string | null;
  modelMode: string;
  modelId?: string | null;
  maxSteps: number;
  favorite?: boolean;
  settings?: {
    triggers: { run: boolean; newChat: boolean; mention: boolean };
    webAccess: boolean;
    trustedUrls: string[];
    allowAllUrls: boolean;
  };
};

export type SessionDTO = {
  id: string;
  title: string;
  createdAt: string;
  messageCount: number;
};

export type SessionMessageDTO = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export type UsageSlice = {
  tokens: number;
  cost: number;
  runs: number;
};

export type UsageDTO = UsageSlice & {
  last24h: UsageSlice;
  triggered: UsageSlice;
  days: Array<UsageSlice & { day: string }>;
};

export type Provider =
  | "openai"
  | "anthropic"
  | "mistral"
  | "google"
  | "groq"
  | "openrouter"
  | "xai"
  | "deepseek"
  | "cohere"
  | "together";

export type KeyDTO = {
  id: string;
  provider: Provider;
  label: string;
  masked: string;
  status: "working" | "invalid" | "rate-limited" | "unknown";
  baseUrl: string | null;
  createdAt: string;
};
