import { router, type Href } from 'expo-router';

/**
 * Goes back when there is a screen to return to, otherwise replaces the current screen
 * with `fallback`. Avoids "The action 'GO_BACK' was not handled by any navigator".
 */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
