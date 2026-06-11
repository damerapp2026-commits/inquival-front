import { useRef, useEffect, useState, RefObject, DependencyList } from 'react';

interface FixedScrollbarProps {
  targetRef: RefObject<HTMLElement | null>;
  /** Dependencias que, al cambiar, fuerzan a re-medir el target (p.ej. cuando termina de cargar y el elemento recién se monta) */
  deps?: DependencyList;
}

/** Barra de scroll horizontal fija al fondo del viewport — solo desktop, cuando el target tiene overflow */
export function FixedScrollbar({ targetRef, deps = [] }: FixedScrollbarProps) {
  const fixedBarRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [barLeft, setBarLeft] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const [innerWidth, setInnerWidth] = useState(0);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    const syncGeometry = () => {
      const rect = el.getBoundingClientRect();
      setBarLeft(rect.left);
      setBarWidth(rect.width);
      setInnerWidth(el.scrollWidth);
      setHasOverflow(el.scrollWidth > el.clientWidth + 1);
    };

    syncGeometry();

    const ro = new ResizeObserver(syncGeometry);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    let raf = 0;
    const onAnyScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(syncGeometry); };
    window.addEventListener('resize', syncGeometry);
    window.addEventListener('scroll', onAnyScroll, true);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncGeometry);
      window.removeEventListener('scroll', onAnyScroll, true);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRef, ...deps]);

  // Scroll bidireccional — se re-engancha cada vez que la barra fija monta/desmonta
  useEffect(() => {
    const tableEl = targetRef.current;
    const barEl = fixedBarRef.current;
    if (!tableEl || !barEl) return;
    let lock = false;
    const onTable = () => { if (!lock) { lock = true; barEl.scrollLeft = tableEl.scrollLeft; lock = false; } };
    const onBar   = () => { if (!lock) { lock = true; tableEl.scrollLeft = barEl.scrollLeft; lock = false; } };
    tableEl.addEventListener('scroll', onTable);
    barEl.addEventListener('scroll', onBar);
    return () => {
      tableEl.removeEventListener('scroll', onTable);
      barEl.removeEventListener('scroll', onBar);
    };
  }, [hasOverflow, targetRef]);

  if (!hasOverflow) return null;

  return (
    <div
      ref={fixedBarRef}
      className="hidden lg:block fixed bottom-0 overflow-x-auto z-40 bg-white border-t border-gray-200"
      style={{ left: barLeft, width: barWidth }}
    >
      <div style={{ width: innerWidth, height: '1px' }} />
    </div>
  );
}
