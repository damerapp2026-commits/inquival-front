import { useEffect } from 'react';

export function confirmDiscardExpenseChanges(dirty: boolean) {
  return !dirty || window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos y continuar?');
}

// Several admin forms can be dirty at once; navigation must ask only once.
const dirtyForms = new Set<symbol>();
const beforeUnload = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  event.returnValue = '';
};
const click = (event: MouseEvent) => {
  const link = (event.target as Element)?.closest('a[href]') as HTMLAnchorElement | null;
  if (
    !link ||
    link.target === '_blank' ||
    event.ctrlKey ||
    event.metaKey ||
    link.href === location.href
  )
    return;
  if (!confirmDiscardExpenseChanges(true)) {
    event.preventDefault();
    event.stopPropagation();
  }
};

/** Protect reload/close and in-app link navigation while a form is dirty. */
export function useUnsavedExpenseChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const id = Symbol();
    dirtyForms.add(id);
    if (dirtyForms.size === 1) {
      window.addEventListener('beforeunload', beforeUnload);
      document.addEventListener('click', click, true);
    }
    return () => {
      dirtyForms.delete(id);
      if (!dirtyForms.size) {
        window.removeEventListener('beforeunload', beforeUnload);
        document.removeEventListener('click', click, true);
      }
    };
  }, [dirty]);
}
