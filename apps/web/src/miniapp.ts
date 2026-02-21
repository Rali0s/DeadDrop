export function detectMiniAppMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  const miniAppParam = params.get("miniApp") ?? "";

  if (miniAppParam === "1" || miniAppParam.startsWith("true") || params.get("fc") === "1") {
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

export type MiniAppUserContext = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

export async function getMiniAppUserContext(): Promise<MiniAppUserContext | null> {
  if (!detectMiniAppMode()) {
    return null;
  }

  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const context = await sdk.context;
    const fid = Number(context?.user?.fid ?? NaN);

    if (!Number.isFinite(fid) || fid <= 0) {
      return null;
    }

    return {
      fid,
      username: context.user.username,
      displayName: context.user.displayName,
      pfpUrl: context.user.pfpUrl
    };
  } catch {
    return null;
  }
}
