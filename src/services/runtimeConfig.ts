export const IS_PUBLIC_SITE = import.meta.env.VITE_PUBLIC_SITE === 'true';

export const DEFAULT_HOME_PATH = IS_PUBLIC_SITE ? '' : '/Users/zhangjinhui';
export const DEFAULT_DESKTOP_PATH = IS_PUBLIC_SITE ? '' : `${DEFAULT_HOME_PATH}/Desktop`;
export const DEFAULT_WORKSPACE_PATH = IS_PUBLIC_SITE ? '' : `${DEFAULT_DESKTOP_PATH}/codex-test`;
export const DEFAULT_USER_NAME = IS_PUBLIC_SITE ? '本机用户' : 'zhangjinhui';

// Consent lasts only for this page load; refreshing disconnects the public Site.
let localBridgeAllowed = !IS_PUBLIC_SITE;

export function canUseLocalBridge(): boolean {
  return localBridgeAllowed;
}

export function setLocalBridgeAccess(allowed: boolean): void {
  localBridgeAllowed = allowed;
}
