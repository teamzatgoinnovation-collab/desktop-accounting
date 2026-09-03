import { useCallback, useEffect, useState } from "react";

/**
 * Two layers, both real: a beforeunload listener covers tab/window close
 * (works regardless of router type), and confirmNavigation() gates this
 * page's own exit affordances (Back, View Journals, Cancel, Reset form)
 * behind a confirmation dialog when the form is dirty. Sidebar navigation
 * isn't interceptable this way — react-router-dom is used declaratively
 * here (not via createBrowserRouter), so useBlocker/unstable_usePrompt
 * aren't available without a larger, out-of-scope router migration. No
 * page in this app protects against sidebar nav today, so this isn't a
 * regression — just a documented gap.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const confirmNavigation = useCallback(
    (action: () => void) => {
      if (dirty) {
        setPendingAction(() => action);
      } else {
        action();
      }
    },
    [dirty],
  );

  const confirmDiscard = useCallback(() => {
    setPendingAction((current) => {
      current?.();
      return null;
    });
  }, []);

  const cancelDiscard = useCallback(() => setPendingAction(null), []);

  return { confirmNavigation, isConfirmOpen: pendingAction !== null, confirmDiscard, cancelDiscard };
}
