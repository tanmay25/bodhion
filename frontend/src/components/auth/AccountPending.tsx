'use client';

import { useAuthStore } from '@/store/authStore';
import { clearSession } from '@/lib/auth/session';

export function AccountPending() {
  const { config } = useAuthStore();

  const title =
    config?.ui?.pending_user_overlay_title?.trim() ||
    'Account Activation Pending\nContact Admin for WebUI Access';

  const content =
    config?.ui?.pending_user_overlay_content?.trim() ||
    'Your account status is currently pending activation.\nTo access the WebUI, please reach out to the administrator. Admins can manage user statuses from the Admin Panel.';

  function handleCheckAgain() {
    window.location.href = '/';
  }

  function handleSignOut() {
    clearSession();
    window.location.href = '/login';
  }

  return (
    <div className="fixed inset-0 z-[999] flex">
      <div className="absolute inset-0 flex justify-center backdrop-blur-lg bg-white/10 dark:bg-gray-900/50">
        <div className="m-auto flex flex-col items-center pb-10">
          <div className="max-w-md text-center">
            <h2
              className="text-2xl font-medium text-gray-900 dark:text-white"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {title}
            </h2>

            <p
              className="mt-4 text-sm text-gray-700 dark:text-gray-200"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {content}
            </p>

            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                onClick={handleCheckAgain}
                className="relative z-20 flex rounded-full border border-gray-100 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-none dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Check Again
              </button>
              <button
                onClick={handleSignOut}
                className="mt-1 text-center text-xs text-gray-400 underline"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountPending;
