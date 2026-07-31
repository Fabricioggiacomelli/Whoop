"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Instalável mesmo sem SW ativo (ex: iOS Safari) — falha aqui não deve quebrar a app.
      });
    }
  }, []);

  return null;
}
