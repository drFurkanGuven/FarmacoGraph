"use client";

import { Toaster } from "sonner";

export function NotificationProvider() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "border bg-background text-foreground shadow-lg",
        },
      }}
    />
  );
}
