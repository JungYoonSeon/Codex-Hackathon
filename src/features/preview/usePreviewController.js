import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPreviewController } from './previewController.js';

/** React binding for the single result-state owner. Invalidates on unmount. */
export function usePreviewController() {
  const ref = useRef(null);
  if (!ref.current) ref.current = createPreviewController();
  const controller = ref.current;
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  useEffect(() => () => controller.invalidate(), [controller]);
  return { state, controller };
}
