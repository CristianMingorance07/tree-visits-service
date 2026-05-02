<template>
  <div class="card-accent p-6">

    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest">Your Tree</h2>
      <span
        class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-all duration-500"
        :class="stageIndex >= 6
          ? 'bg-[#3aaa68]/15 border-[#3aaa68]/40 text-[#3aaa68]'
          : 'bg-[#65D693]/10 border-[#65D693]/25 text-[#3aaa68]'"
      >
        Stage {{ stageIndex + 1 }} / {{ STAGES.length }} · {{ currentStage.label }}
      </span>
    </div>

    <!-- Tree canvas -->
    <div
      class="tree-wind relative rounded-2xl overflow-hidden mb-4"
      style="height: 300px"
      :style="{ background: skyGradient }"
    >
      <canvas ref="canvasEl" class="absolute inset-0 w-full h-full" />

      <!-- Stage-up flash overlay -->
      <Transition name="flash">
        <div v-if="levelUpFlash" class="absolute inset-0 bg-[#65D693]/20 rounded-2xl pointer-events-none" />
      </Transition>
    </div>

    <!-- Stage progress bar -->
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-[11px]">
        <span class="font-semibold text-gray-600">{{ currentStage.label }}</span>
        <span class="text-gray-400" v-if="nextStage">
          {{ visitsToNext }} visits to <span class="text-[#3aaa68] font-semibold">{{ nextStage.label }}</span>
        </span>
        <span v-else class="text-[#3aaa68] font-bold">✦ Ancient · Max growth</span>
      </div>
      <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full bg-gradient-to-r from-[#3aaa68] to-[#65D693] transition-all duration-700 ease-out"
          :style="{ width: `${stageProgress}%` }"
        />
      </div>
      <div class="flex justify-between text-[10px] text-gray-400">
        <span>{{ totalVisits.toLocaleString() }} total visits</span>
        <span>{{ totalTreesPlanted }} trees planted globally</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  totalVisits: number;
  totalTreesPlanted: number;
}>();

/* ------------------------------------------------------------------ */
/* Stage definitions                                                    */
/* ------------------------------------------------------------------ */
const STAGES = [
  { minVisits: 0,   label: 'Sprout',      depth: 0 },
  { minVisits: 10,  label: 'Sapling',     depth: 1 },
  { minVisits: 25,  label: 'Seedling',    depth: 2 },
  { minVisits: 50,  label: 'Young Tree',  depth: 3 },
  { minVisits: 90,  label: 'Growing',     depth: 4 },
  { minVisits: 140, label: 'Mature',      depth: 5 },
  { minVisits: 200, label: 'Established', depth: 6 },
  { minVisits: 280, label: 'Elder',       depth: 7 },
  { minVisits: 380, label: 'Ancient',     depth: 8 },
];

const stageIndex = computed(() => {
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (props.totalVisits >= STAGES[i].minVisits) idx = i;
  }
  return idx;
});
const currentStage = computed(() => STAGES[stageIndex.value]);
const nextStage    = computed(() => STAGES[stageIndex.value + 1] ?? null);
const visitsToNext = computed(() =>
  nextStage.value ? nextStage.value.minVisits - props.totalVisits : 0,
);
const stageProgress = computed(() => {
  const cur  = currentStage.value.minVisits;
  const next = nextStage.value?.minVisits ?? cur + 1;
  return Math.min(100, ((props.totalVisits - cur) / (next - cur)) * 100);
});

/* Sky gradient brightens with stage */
const skyGradient = computed(() => {
  const t = stageIndex.value / (STAGES.length - 1);
  const top    = lerpHex('#e8f5f0', '#d1fae5', t);
  const bottom = lerpHex('#bbf7d0', '#6ee7b7', t);
  return `linear-gradient(175deg, ${top} 0%, ${bottom} 100%)`;
});

/* ------------------------------------------------------------------ */
/* Canvas + drawing                                                     */
/* ------------------------------------------------------------------ */
const canvasEl    = ref<HTMLCanvasElement | null>(null);
const levelUpFlash = ref(false);

// Growth animation state: 0 = new stage just started, 1 = done
let growProgress = 1;
let rafId: number | null = null;
let growStartTime = 0;
const GROW_DURATION = 900; // ms

// Seeded LCG — gives consistent organic shape per draw
function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 4294967296;
  };
}

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

/* Color helpers */
function lerpHex(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r  = Math.round(ar + (br - ar) * t);
  const g  = Math.round(ag + (bg - ag) * t);
  const b2 = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b2.toString(16).padStart(2,'0')}`;
}

function branchColor(depth: number, maxDepth: number): string {
  const t = maxDepth > 0 ? depth / maxDepth : 0;
  return lerpHex('#2A0F00', '#7C4B1B', Math.min(1, t * 1.4));
}

/* Draw a tapered, slightly-curved branch segment */
function drawBranch(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  x1: number, y1: number,
  angle: number,
  length: number,
  depth: number,
  maxDepth: number,
  progress: number,
) {
  if (depth > maxDepth) return;

  // Animate only the outermost depth during growth
  const eff = depth === maxDepth ? length * easeOutCubic(progress) : length;
  if (eff < 1) return;

  const x2 = x1 + Math.cos(angle) * eff;
  const y2 = y1 + Math.sin(angle) * eff;

  // Control point for a gentle natural curve
  const cpX = (x1 + x2) / 2 + Math.cos(angle + Math.PI / 2) * (eff * 0.08 * (rng() - 0.5) * 6);
  const cpY = (y1 + y2) / 2 + Math.sin(angle + Math.PI / 2) * (eff * 0.08);

  // Tapered width: thick trunk → thin twigs
  const topW  = Math.max(0.7, 12 - depth * 2 + (rng() - 0.5));
  const baseW = topW * 1.35;

  // Draw as filled tapered shape for trunk/main branches
  if (depth <= 3 && topW > 2) {
    drawTaperedSegment(ctx, x1, y1, x2, y2, cpX, cpY, baseW, topW, depth, maxDepth, rng);
  } else {
    // Thin branches: simple stroked bezier
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpX, cpY, x2, y2);
    ctx.lineWidth = Math.max(0.5, topW);
    ctx.strokeStyle = branchColor(depth, maxDepth);
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Leaf clusters at branch endpoints
  if (depth >= maxDepth - 1 && maxDepth >= 3) {
    const leafOpacity = depth === maxDepth ? progress : 1;
    drawLeaves(ctx, x2, y2, maxDepth, rng, leafOpacity);
  }

  // Recurse into child branches
  if (depth < maxDepth) {
    const spread = 0.38 + (rng() - 0.5) * 0.08;
    const ratio  = 0.66 + rng() * 0.07;
    const jitter = (rng() - 0.5) * 0.06;

    drawBranch(ctx, rng, x2, y2, angle - spread + jitter,     length * ratio,            depth + 1, maxDepth, progress);
    drawBranch(ctx, rng, x2, y2, angle + spread + jitter,     length * ratio * 0.95,     depth + 1, maxDepth, progress);
    // Extra central branch from depth 0 onward for density
    if (depth < maxDepth - 1 && maxDepth >= 4) {
      drawBranch(ctx, rng, x2, y2, angle + (rng() - 0.5) * 0.3, length * ratio * 0.82, depth + 2, maxDepth, progress);
    }
  }
}

/* Tapered filled branch with cylindrical gradient */
function drawTaperedSegment(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  cpX: number, cpY: number,
  w1: number, w2: number,
  depth: number, maxDepth: number,
  _rng: () => number,
) {
  const perp = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
  const cos  = Math.cos(perp);
  const sin  = Math.sin(perp);

  ctx.beginPath();
  ctx.moveTo(x1 + cos * w1 / 2, y1 + sin * w1 / 2);
  ctx.quadraticCurveTo(cpX + cos * (w1 + w2) / 4, cpY + sin * (w1 + w2) / 4, x2 + cos * w2 / 2, y2 + sin * w2 / 2);
  ctx.lineTo(x2 - cos * w2 / 2, y2 - sin * w2 / 2);
  ctx.quadraticCurveTo(cpX - cos * (w1 + w2) / 4, cpY - sin * (w1 + w2) / 4, x1 - cos * w1 / 2, y1 - sin * w1 / 2);
  ctx.closePath();

  // Cylindrical gradient (lighter center → darker edges)
  const gx = (x1 + x2) / 2;
  const gy = (y1 + y2) / 2;
  const grad = ctx.createLinearGradient(gx - cos * w1 / 2, gy - sin * w1 / 2, gx + cos * w1 / 2, gy + sin * w1 / 2);
  const base = branchColor(depth, maxDepth);
  grad.addColorStop(0,   '#1A0800');
  grad.addColorStop(0.2, base);
  grad.addColorStop(0.5, lerpHex(base, '#A0622A', 0.45));
  grad.addColorStop(0.8, base);
  grad.addColorStop(1,   '#1A0800');

  ctx.fillStyle = grad;
  ctx.fill();
}

/* Leaf cluster: radial gradient blobs */
function drawLeaves(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  maxDepth: number,
  rng: () => number,
  opacity: number,
) {
  const t     = Math.min(1, (maxDepth - 2) / 6);
  const count = 3 + maxDepth;
  const rad   = 6 + maxDepth * 1.8;

  for (let i = 0; i < count; i++) {
    const ox = (rng() - 0.5) * rad * 1.6;
    const oy = (rng() - 0.5) * rad * 1.2;
    const r  = rad * (0.55 + rng() * 0.5);

    const leafColor = lerpHex('#4ade80', '#166534', t);
    const grad = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
    grad.addColorStop(0,   leafColor + 'ee');
    grad.addColorStop(0.5, lerpHex(leafColor, '#15803d', 0.4) + 'bb');
    grad.addColorStop(1,   leafColor + '00');

    ctx.globalAlpha = opacity * (0.6 + rng() * 0.4);
    ctx.fillStyle   = grad;
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + oy, r, r * 0.85, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* Roots at high stages */
function drawRoots(ctx: CanvasRenderingContext2D, x: number, y: number, stage: number) {
  const rng = makePrng(999);
  const numRoots = stage - 3;
  for (let i = 0; i < numRoots; i++) {
    const angle = Math.PI * (0.1 + i / (numRoots) * 0.8) + (i % 2 === 0 ? 0 : Math.PI);
    const len   = 20 + rng() * 18;
    const ex    = x + Math.cos(angle) * len;
    const ey    = y + Math.sin(angle) * len * 0.5;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(angle) * len * 0.4, y + 10, ex, ey);
    ctx.lineWidth  = 2 + rng() * 2;
    ctx.strokeStyle = '#3B1A00aa';
    ctx.lineCap    = 'round';
    ctx.stroke();
  }
}

/* Tiny sprout for stage 0 */
function drawSprout(ctx: CanvasRenderingContext2D, cx: number, ground: number) {
  const h = 18;
  ctx.beginPath();
  ctx.moveTo(cx, ground);
  ctx.lineTo(cx, ground - h);
  ctx.lineWidth   = 2;
  ctx.strokeStyle = '#4ade80';
  ctx.lineCap     = 'round';
  ctx.stroke();
  // Two tiny leaves
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 6, ground - h + 4, 6, 4, side * -0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#4ade80cc';
    ctx.fill();
  }
}

/* Ground strip */
function drawGround(ctx: CanvasRenderingContext2D, w: number, ground: number) {
  const grad = ctx.createLinearGradient(0, ground, 0, ground + 18);
  grad.addColorStop(0, '#6ee7b7');
  grad.addColorStop(1, '#a7f3d0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, ground, w, 20);
  // Grass tufts
  const rng = makePrng(77);
  for (let i = 0; i < 12; i++) {
    const gx = (rng() * 0.9 + 0.05) * w;
    const gh = 5 + rng() * 5;
    ctx.beginPath();
    ctx.moveTo(gx - 2, ground);
    ctx.quadraticCurveTo(gx, ground - gh, gx + 2, ground);
    ctx.lineWidth   = 1.2;
    ctx.strokeStyle = '#34d399';
    ctx.stroke();
  }
}

/* Main render */
function render(progress: number) {
  const el  = canvasEl.value;
  if (!el) return;
  const ctx = el.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const W   = el.width  / dpr;
  const H   = el.height / dpr;

  ctx.clearRect(0, 0, el.width, el.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const cx     = W / 2;
  const ground = H - 24;
  const depth  = currentStage.value.depth;

  // Clip to canvas so no branch ever overflows the top
  ctx.beginPath();
  ctx.rect(0, 4, W, H);
  ctx.clip();

  drawGround(ctx, W, ground);

  if (depth === 0) {
    drawSprout(ctx, cx, ground);
  } else {
    const rng = makePrng(42); // fixed seed → stable, organic shape

    // Trunk length scales with both stage depth and available canvas height.
    // The recursive branches (ratio ≈ 0.67, spread ≈ 22°) add roughly
    // another 0.9 × trunkLen in total upward extension, so we cap at
    // ~47 % of the usable height to guarantee the tree fits.
    const usable   = ground - 10;
    const trunkLen = Math.min(24 + depth * 9, usable * 0.47);

    if (depth >= 6) drawRoots(ctx, cx, ground, depth);
    drawBranch(ctx, rng, cx, ground, -Math.PI / 2, trunkLen, 0, depth, progress);
  }

  ctx.restore();
}

/* RAF growth loop */
function startGrowth() {
  growProgress  = 0;
  growStartTime = performance.now();
  levelUpFlash.value = true;
  setTimeout(() => { levelUpFlash.value = false; }, 600);

  if (rafId !== null) cancelAnimationFrame(rafId);
  function tick() {
    const elapsed = performance.now() - growStartTime;
    growProgress  = Math.min(1, elapsed / GROW_DURATION);
    render(growProgress);
    if (growProgress < 1) rafId = requestAnimationFrame(tick);
    else rafId = null;
  }
  rafId = requestAnimationFrame(tick);
}

/* Resize + initial draw */
function fitCanvas() {
  const el = canvasEl.value;
  if (!el) return;
  const dpr  = window.devicePixelRatio || 1;
  const rect = el.getBoundingClientRect();
  el.width   = rect.width  * dpr;
  el.height  = rect.height * dpr;
  render(growProgress);
}

onMounted(() => {
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
});
onUnmounted(() => {
  window.removeEventListener('resize', fitCanvas);
  if (rafId !== null) cancelAnimationFrame(rafId);
});

let prevStage = -1;
watch(stageIndex, (newIdx) => {
  if (newIdx !== prevStage) {
    prevStage = newIdx;
    if (newIdx > 0 || prevStage === -1) startGrowth();
    else render(1);
  }
}, { immediate: true });

// Redraw when visits change (progress within same stage)
watch(() => props.totalVisits, () => {
  if (growProgress >= 1) render(1);
});
</script>

<style scoped>
.tree-wind {
  animation: wind 5s ease-in-out infinite;
  transform-origin: bottom center;
}
@keyframes wind {
  0%,  100% { transform: rotate(-0.8deg); }
  50%        { transform: rotate(0.8deg); }
}

.flash-enter-active { animation: flash-in 0.15s ease-out both; }
.flash-leave-active { animation: flash-out 0.45s ease-in both; }
@keyframes flash-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes flash-out { from { opacity: 1; } to { opacity: 0; } }
</style>
