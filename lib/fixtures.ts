/* ------------------------------------------------------------------
   Static fixtures. No network, no backend, so everything renders offline.
   ------------------------------------------------------------------ */

export type Session = {
  id: string;
  title: string;
  preview: string;
  when: string;
  active?: boolean;
};

export const agent = {
  name: "Fern",
  role: "Research & ops agent",
  workspace: "AgentForge",
  status: "online" as "online" | "idle" | "offline",
  greeting: "Good morning. It's quiet here. What do you want to work on?",
};

export const sessions: Session[] = [
  {
    id: "s1",
    title: "Weekly market digest",
    preview: "Summarized 14 sources into a 5-point brief.",
    when: "2m",
    active: true,
  },
  {
    id: "s2",
    title: "Refactor onboarding flow",
    preview: "Drafted 3 variants, flagged 2 edge cases.",
    when: "1h",
  },
  {
    id: "s3",
    title: "Competitor pricing scan",
    preview: "Pulled 9 plans into a comparison table.",
    when: "Yesterday",
  },
  {
    id: "s4",
    title: "Release notes for v2.4",
    preview: "Grouped 22 PRs by theme.",
    when: "Tue",
  },
  {
    id: "s5",
    title: "Support triage",
    preview: "Tagged 38 tickets, escalated 4.",
    when: "Mon",
  },
];

export const starterChips: string[] = [
  "Summarize my unread threads",
  "Draft a plan for this week",
  "Scan a page and pull the key facts",
];

export type Trigger = {
  id: string;
  label: string;
  hint: string;
  enabled: boolean;
};

export const triggers: Trigger[] = [
  { id: "run", label: "Run agent", hint: "Manual run from the composer", enabled: true },
  { id: "new-chat", label: "New chat", hint: "Start fresh on demand", enabled: true },
  {
    id: "mention",
    label: "When mentioned",
    hint: "Replies when @Fern appears",
    enabled: false,
  },
];

export type Tool = {
  id: string;
  label: string;
  hint: string;
  enabled: boolean;
};

export const tools: Tool[] = [
  {
    id: "web",
    label: "Web access",
    hint: "Browse and fetch public pages",
    enabled: true,
  },
];

export type KeyStatus = "working" | "invalid" | "rate-limited" | "unknown";

export type ApiKey = {
  id: string;
  provider: "openai" | "anthropic" | "mistral" | "google";
  label: string;
  masked: string;
  status: KeyStatus;
};

export const apiKeys: ApiKey[] = [
  {
    id: "k1",
    provider: "anthropic",
    label: "Anthropic, primary",
    masked: "sk-ant-•••• •••• 7Q2a",
    status: "working",
  },
  {
    id: "k2",
    provider: "openai",
    label: "OpenAI, fallback",
    masked: "sk-•••• •••• •••• 0xF1",
    status: "rate-limited",
  },
  {
    id: "k3",
    provider: "mistral",
    label: "Mistral, experiments",
    masked: "•••• •••• •••• 9c3D",
    status: "invalid",
  },
];

export type ModelOption = {
  id: string;
  label: string;
  tier: "free" | "paid";
};

export type ModelGroup = {
  provider: string;
  options: ModelOption[];
};

export const modelGroups: ModelGroup[] = [
  {
    provider: "Recommended",
    options: [{ id: "auto", label: "Auto", tier: "free" }],
  },
  {
    provider: "Anthropic",
    options: [
      { id: "claude-opus", label: "Claude Opus 4.8", tier: "paid" },
      { id: "claude-sonnet", label: "Claude Sonnet", tier: "paid" },
      { id: "claude-haiku", label: "Claude Haiku", tier: "free" },
    ],
  },
  {
    provider: "OpenAI",
    options: [
      { id: "gpt-4o", label: "GPT-4o", tier: "paid" },
      { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "free" },
    ],
  },
  {
    provider: "Mistral",
    options: [{ id: "mistral-large", label: "Mistral Large", tier: "paid" }],
  },
];

export const trustedUrls: string[] = [
  "docs.agentforge.dev",
  "api.weather.gov",
];
