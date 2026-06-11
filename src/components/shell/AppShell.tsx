// The authenticated app chrome: a desktop sidebar on the left, the content
// column in the middle (kept readable-width), and a mobile bottom tab bar.
// Client component because the bottom bar opens sheets (More / Quick-add) that
// need open/close state; the (app) layout stays a server component and just
// renders <AppShell email>{children}</AppShell>.

"use client";

import { useState, type ReactNode } from "react";

import { Sidebar } from "./Sidebar";
import { BottomTabBar } from "./BottomTabBar";
import { MoreSheet } from "./MoreSheet";
import { QuickAddSheet } from "./QuickAddSheet";

type OpenSheet = "more" | "add" | null;

export function AppShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const [sheet, setSheet] = useState<OpenSheet>(null);

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar email={email} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* pb-24 on mobile clears the fixed bottom bar; lg removes both bar
            and the extra padding. */}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-24 sm:py-8 lg:pb-10">
          {children}
        </main>
      </div>

      <BottomTabBar
        onOpenMore={() => setSheet("more")}
        onOpenAdd={() => setSheet("add")}
      />
      <MoreSheet
        open={sheet === "more"}
        onClose={() => setSheet(null)}
        email={email}
      />
      <QuickAddSheet open={sheet === "add"} onClose={() => setSheet(null)} />
    </div>
  );
}
