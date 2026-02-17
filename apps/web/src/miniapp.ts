export function detectMiniAppMode(): boolean {
  const params = new URLSearchParams(window.location.search);

  if (params.get("miniApp") === "1" || params.get("miniApp") === "true" || params.get("fc") === "1") {
    return true;
  }

  return window.self !== window.top;
}

export async function notifyMiniAppReady(): Promise<void> {
  if (!detectMiniAppMode()) {
    return;
  }

  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    await sdk.actions.ready();
  } catch {
    // no-op outside Farcaster client runtime
  }
}
