import { ref, onUnmounted } from 'vue';

export function useCountUp(durationMs = 700) {
  const displayed = ref(0);
  let frameId: number | null = null;
  let currentValue = 0;

  function animateTo(target: number) {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (currentValue === target) return;

    const start = currentValue;
    const startTime = performance.now();

    function tick(now: number) {
      const t = Math.min((now - startTime) / durationMs, 1);
      const eased = 1 - (1 - t) ** 3; // ease-out cubic
      currentValue = Math.round(start + (target - start) * eased);
      displayed.value = currentValue;

      if (t < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        displayed.value = target;
        currentValue = target;
        frameId = null;
      }
    }

    frameId = requestAnimationFrame(tick);
  }

  onUnmounted(() => {
    if (frameId !== null) cancelAnimationFrame(frameId);
  });

  return { displayed, animateTo };
}
