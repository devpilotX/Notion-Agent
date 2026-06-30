// MCP server presets. Each prefills the Add connection form. Endpoints that are
// not fully confirmed are marked needsCheck so the form shows a verify note.
// "custom" and "filesystem" are not brands; they use the app's own icons.

export type PresetKey =
  | "github"
  | "notion"
  | "googledrive"
  | "gmail"
  | "googlecalendar"
  | "slack"
  | "figma"
  | "linear"
  | "sentry"
  | "filesystem"
  | "custom";

export type PresetDef = {
  key: PresetKey;
  label: string;
  /** "brand" uses BrandLogo[key], "folder"/"custom" use app icons. */
  icon: "brand" | "folder" | "custom";
  transport: "remote" | "local";
  url?: string;
  command?: string;
  args?: string[];
  authType: "none" | "bearer" | "basic" | "apikey";
  helpUrl?: string;
  helpLabel?: string;
  envKeys?: string[];
  note?: string;
  needsCheck?: boolean;
};

export const PRESETS: PresetDef[] = [
  {
    key: "github",
    label: "GitHub",
    icon: "brand",
    transport: "remote",
    url: "https://api.githubcopilot.com/mcp/",
    authType: "bearer",
    helpUrl: "https://github.com/settings/personal-access-tokens/new",
    helpLabel: "Create a token on GitHub",
  },
  {
    key: "notion",
    label: "Notion",
    icon: "brand",
    transport: "remote",
    url: "https://mcp.notion.com/mcp",
    authType: "bearer",
    helpUrl: "https://www.notion.so/my-integrations",
    helpLabel: "Create a Notion integration token",
    needsCheck: true,
    note: "Notion's hosted MCP usually uses OAuth. A token works for an internal integration.",
  },
  {
    key: "googledrive",
    label: "Google Drive",
    icon: "brand",
    transport: "local",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gdrive"],
    authType: "none",
    helpUrl: "https://developers.google.com/workspace/guides/create-credentials",
    helpLabel: "Set up Google credentials",
    needsCheck: true,
    note: "Runs the Drive reference server. Needs Google OAuth credentials in its environment.",
  },
  {
    key: "gmail",
    label: "Gmail",
    icon: "brand",
    transport: "local",
    command: "npx",
    args: ["-y", "@gongrzhe/server-gmail-autoauth-mcp"],
    authType: "none",
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    helpLabel: "Set up Google credentials",
    needsCheck: true,
    note: "Community Gmail MCP server. Confirm the package and complete its Google auth.",
  },
  {
    key: "googlecalendar",
    label: "Google Calendar",
    icon: "brand",
    transport: "local",
    command: "npx",
    args: ["-y", "@cocal/google-calendar-mcp"],
    authType: "none",
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    helpLabel: "Set up Google credentials",
    needsCheck: true,
    note: "Community Calendar MCP server. Confirm the package and complete its Google auth.",
  },
  {
    key: "slack",
    label: "Slack",
    icon: "brand",
    transport: "local",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    authType: "none",
    envKeys: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
    helpUrl: "https://api.slack.com/apps",
    helpLabel: "Create a Slack app and bot token",
    note: "Set SLACK_BOT_TOKEN and SLACK_TEAM_ID in the environment box.",
  },
  {
    key: "figma",
    label: "Figma",
    icon: "brand",
    transport: "remote",
    url: "http://127.0.0.1:3845/sse",
    authType: "none",
    helpUrl: "https://help.figma.com/hc/en-us/articles/32132100833559",
    helpLabel: "Enable Dev Mode MCP in Figma",
    note: "Turn on the Dev Mode MCP server in the Figma desktop app first.",
  },
  {
    key: "linear",
    label: "Linear",
    icon: "brand",
    transport: "remote",
    url: "https://mcp.linear.app/sse",
    authType: "bearer",
    helpUrl: "https://linear.app/settings/api",
    helpLabel: "Create a Linear API key",
    needsCheck: true,
    note: "Linear's hosted MCP usually uses OAuth. Confirm whether a token is accepted.",
  },
  {
    key: "sentry",
    label: "Sentry",
    icon: "brand",
    transport: "remote",
    url: "https://mcp.sentry.dev/mcp",
    authType: "bearer",
    helpUrl: "https://sentry.io/settings/account/api/auth-tokens/",
    helpLabel: "Create a Sentry auth token",
    needsCheck: true,
    note: "Sentry's hosted MCP usually uses OAuth. Confirm whether a token is accepted.",
  },
  {
    key: "filesystem",
    label: "Filesystem",
    icon: "folder",
    transport: "local",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    authType: "none",
    note: "Set the folder to expose in the arguments. The dot means the current directory.",
  },
  {
    key: "custom",
    label: "Custom",
    icon: "custom",
    transport: "remote",
    authType: "none",
  },
];
