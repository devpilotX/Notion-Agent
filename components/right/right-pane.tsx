"use client";

import { SettingsTopbar } from "./settings-topbar";
import { TriggersSection } from "./triggers-section";
import { InstructionsSection } from "./instructions-section";
import { ToolsSection } from "./tools-section";
import { KeysSection } from "./keys-section";
import { AdvancedSection } from "./advanced-section";
import { HelpSection } from "./help-section";

export function RightPane({ onCollapse }: { onCollapse?: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SettingsTopbar onCollapse={onCollapse} />
      <div className="verdant-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <TriggersSection delay={0} />
          <InstructionsSection delay={0.04} />
          <ToolsSection delay={0.04} />
          <KeysSection delay={0.04} />
          <AdvancedSection delay={0.04} />
          <HelpSection delay={0.04} />
        </div>
      </div>
    </div>
  );
}
