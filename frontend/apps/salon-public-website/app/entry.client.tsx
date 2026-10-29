import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

// Replace the edge-rendered product preview with the interactive SPA without a hydration mismatch.
document.getElementById("product-edge-content")?.remove();
document.querySelectorAll("[data-product-edge]").forEach((element) => element.remove());

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
