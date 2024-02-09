import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// copilot wrote this entire method.  Thanks copilot!
// but also, it's crazy how copilot knows to do this
// because it indicates how common a problem it is and how long it's been a problem.
const _error = console.error;
console.error = (message: string, ...args: any[]) => {
  if (message.startsWith("Warning: Expected server HTML to contain a matching")) {
    console.warn("Hydration errors still happen");
    return;
  }
  if (message.startsWith("Uncaught Error: Hydration failed")) {
    console.warn("Hydration errors still happen");
    return;
  }
  _error(message, ...args);
};

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
