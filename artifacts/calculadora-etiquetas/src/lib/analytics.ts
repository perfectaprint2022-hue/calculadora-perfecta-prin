type PlausibleTracker = ((eventName: string) => void) & {
  q?: Array<[string]>;
};

declare global {
  interface Window {
    plausible?: PlausibleTracker;
  }
}

export type AuthAnalyticsEvent = 'login_succeeded' | 'master_account_created';

const isOfflineBuild = import.meta.env.VITE_OFFLINE_BUILD === 'true';
const scriptId = 'plausible-analytics-script';

function getPlausibleTracker(): PlausibleTracker {
  if (!window.plausible) {
    const tracker = ((eventName: string) => {
      (tracker.q ??= []).push([eventName]);
    }) as PlausibleTracker;
    tracker.q = [];
    window.plausible = tracker;
  }

  return window.plausible;
}

function loadPlausibleScript(): void {
  if (document.getElementById(scriptId)) return;

  const script = document.createElement('script');
  script.id = scriptId;
  script.defer = true;
  script.dataset.domain = window.location.hostname;
  script.src = 'https://plausible.io/js/script.js';
  document.head.appendChild(script);
}

export function trackAuthEvent(eventName: AuthAnalyticsEvent): void {
  if (typeof window === 'undefined' || import.meta.env.DEV || isOfflineBuild) return;

  try {
    const tracker = getPlausibleTracker();
    loadPlausibleScript();
    tracker(eventName);
  } catch {
    // Analytics failures must not interrupt authentication or account creation.
  }
}
