import { useEffect, useSyncExternalStore } from 'react';

import {
  getStatus,
  getUser,
  loadPersistedSession,
  login as loginAction,
  logout as logoutAction,
  subscribe,
  InvalidCredentialsError,
} from '@/src/auth/sessionStore';

export { InvalidCredentialsError };

/**
 * React-facing view of src/auth/sessionStore.ts. `useSyncExternalStore`
 * (rather than a Context provider) because the store already exists
 * independent of React — the API client needs to read/refresh the token
 * outside of any component tree — so this just subscribes to it.
 */
export function useSession() {
  useEffect(() => {
    loadPersistedSession();
  }, []);

  const status = useSyncExternalStore(subscribe, getStatus, getStatus);
  const user = useSyncExternalStore(subscribe, getUser, getUser);

  return {
    status,
    user,
    login: loginAction,
    logout: logoutAction,
  };
}
