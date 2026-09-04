import { useEffect, useRef, useState } from "react";

/** Карта яркости — от почти пустого символа к плотному. */
const RAMP = ".,-~:;=!*#$@";

export interface AsciiModelProps {
  /** URL-адреса GLB/glTF — пробуем по очереди */
  sources: string[];
  /** CSS-цвет символов */
  color: string;
  /** сторона квадратного канваса в CSS-пикселях */
  size?: number;
  /** ширина одной ячейки в CSS-пикселях (высота = 2×) */
  cell?: number;
  opacity?: number;
  className?: string;
  /** вызывается, если ни один источник не загрузился */
  onFail?: () => void;
  /** меняющееся значение (секунды) — модель коротко «подпрыгивает» */
  pulse?: number;
  /** множитель скорости авторотации, 1 = по умолчанию */
  speed?: number;
}

/* ---------- разбор бинарного glTF (GLB) ---------- */

interface GlbMesh {
  pos: Float32Array;
  nor: Float32Array;
  idx: Uint32Array;
}

interface GlTFNode {
  mesh?: number;
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

function transformPoints(
  pos: Float32Array,
  nor: Float32Array | null,
  node: GlTFNode,
): [Float32Array, Float32Array | null] {
  if (node.matrix && node.matrix.length === 16) {
    const m = node.matrix;
    const out = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      out[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }
    let outN = nor;
    if (nor) {
      outN = new Float32Array(nor.length);
      for (let i = 0; i < nor.length; i += 3) {
        const x = nor[i];
        const y = nor[i + 1];
        const z = nor[i + 2];
        let nx = m[0] * x + m[4] * y + m[8] * z;
        let ny = m[1] * x + m[5] * y + m[9] * z;
        let nz = m[2] * x + m[6] * y + m[10] * z;
        const l = Math.hypot(nx, ny, nz) || 1;
        outN[i] = nx / l;
        outN[i + 1] = ny / l;
        outN[i + 2] = nz / l;
      }
    }
    return [out, outN];
  }

  const t = node.translation ?? [0, 0, 0];
  const s = node.scale ?? [1, 1, 1];
  const q = node.rotation ?? [0, 0, 0, 1];
  const [qx, qy, qz, qw] = q;

  const rotate = (x: number, y: number, z: number): [number, number, number] => {
    // v' = v + 2·cross(q.xyz, cross(q.xyz, v) + qw·v)
    const cx = qy * z - qz * y + qw * x;
    const cy = qz * x - qx * z + qw * y;
    const cz = qx * y - qy * x + qw * z;
    return [
      x + 2 * (qy * cz - qz * cy),
      y + 2 * (qz * cx - qx * cz),
      z + 2 * (qx * cy - qy * cx),
    ];
  };

  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const [rx, ry, rz] = rotate(pos[i] * s[0], pos[i + 1] * s[1], pos[i + 2] * s[2]);
    out[i] = rx + t[0];
    out[i + 1] = ry + t[1];
    out[i + 2] = rz + t[2];
  }
  let outN = nor;
  if (nor) {
    outN = new Float32Array(nor.length);
    for (let i = 0; i < nor.length; i += 3) {
      const [rx, ry, rz] = rotate(nor[i], nor[i + 1], nor[i + 2]);
      outN[i] = rx;
      outN[i + 1] = ry;
      outN[i + 2] = rz;
    }
  }
  return [out, outN];
}

function computeNormals(pos: Float32Array, idx: Uint32Array): Float32Array {
  const nor = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a];
    const uy = pos[b + 1] - pos[a + 1];
    const uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a];
    const vy = pos[c + 1] - pos[a + 1];
    const vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      nor[v] += nx;
      nor[v + 1] += ny;
      nor[v + 2] += nz;
    }
  }
  for (let i = 0; i < nor.length; i += 3) {
    const l = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1;
    nor[i] /= l;
    nor[i + 1] /= l;
    nor[i + 2] /= l;
  }
  return nor;
}

async function loadGlb(url: string): Promise<GlbMesh> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("не GLB");

  let json: {
    meshes?: { primitives: Record<string, unknown>[] }[];
    accessors?: Record<string, unknown>[];
    bufferViews?: Record<string, unknown>[];
    nodes?: GlTFNode[];
  } | null = null;
  let bin: ArrayBuffer = new ArrayBuffer(0);
  let off = 12;
  while (off + 8 <= buf.byteLength) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (type === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, start, len)));
    } else if (type === 0x004e4942) {
      bin = buf.slice(start, start + len);
    }
    off = start + len;
  }
  if (!json?.meshes?.length || !json.accessors || !json.bufferViews) {
    throw new Error("пустая модель");
  }

  const readAccessor = (
    accIdx: number,
  ): Float32Array | Uint16Array | Uint32Array => {
    const acc = json!.accessors![accIdx] as {
      bufferView: number;
      byteOffset?: number;
      componentType: number;
      count: number;
      type: string;
    };
    const view = json!.bufferViews![acc.bufferView] as {
      byteOffset?: number;
    };
    const byteOffset = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const comps = acc.type === "VEC3" ? 3 : acc.type === "VEC2" ? 2 : 1;
    const n = acc.count * comps;
    switch (acc.componentType) {
      case 5126:
        return new Float32Array(bin, byteOffset, n);
      case 5123:
        return new Uint16Array(bin, byteOffset, n);
      case 5125:
        return new Uint32Array(bin, byteOffset, n);
      default:
        throw new Error("componentType");
    }
  };

  for (let mi = 0; mi < json.meshes.length; mi++) {
    for (const prim of json.meshes[mi].primitives) {
      const attrs = prim.attributes as Record<string, number> | undefined;
      if (attrs?.POSITION == null) continue;
      let pos = readAccessor(attrs.POSITION) as Float32Array;
      let nor =
        attrs.NORMAL != null
          ? (readAccessor(attrs.NORMAL) as Float32Array)
          : null;
      const node = json.nodes?.find((nd) => nd.mesh === mi);
      if (node) [pos, nor] = transformPoints(pos, nor, node);

      const raw =
        prim.indices != null
          ? readAccessor(prim.indices as number)
          : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
      const idx =
        raw instanceof Uint32Array ? raw : Uint32Array.from(raw as Uint16Array);
      if (!nor) nor = computeNormals(pos, idx);
      return { pos, nor, idx };
    }
  }
  throw new Error("mesh не найден");
}

/** Нормализация: центр в начало, максимальный размер = maxDim. */
function normalize(mesh: GlbMesh, maxDim: number): GlbMesh {
  const { pos } = mesh;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    minX = Math.min(minX, pos[i]);
    maxX = Math.max(maxX, pos[i]);
    minY = Math.min(minY, pos[i + 1]);
    maxY = Math.max(maxY, pos[i + 1]);
    minZ = Math.min(minZ, pos[i + 2]);
    maxZ = Math.max(maxZ, pos[i + 2]);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const s = maxDim / Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-6);
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    out[i] = (pos[i] - cx) * s;
    out[i + 1] = (pos[i + 1] - cy) * s;
    out[i + 2] = (pos[i + 2] - cz) * s;
  }
  return { pos: out, nor: mesh.nor, idx: mesh.idx };
}

/**
 * Настоящая GLB/glTF-модель, перерисованная ASCII-символами
 * (в духе ASCII Object из Canvas UI): бинарный glTF разбирается
 * вручную, кадр растеризуется программно с z-буфером и ламбертовым
 * светом, яркость каждого знакоместа определяет символ.
 */
export function AsciiModel({
  sources,
  color,
  size = 560,
  cell = 13,
  opacity = 0.5,
  className,
  onFail,
  pulse = 0,
  speed = 1,
}: AsciiModelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorRef = useRef(color);
  colorRef.current = color;
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  /* «подпрыгивание» на тик: импульс затухает в цикле отрисовки */
  const kickRef = useRef(0);
  const pulseValRef = useRef(pulse);
  useEffect(() => {
    if (pulse !== pulseValRef.current) {
      pulseValRef.current = pulse;
      if (pulse >= 0) kickRef.current = 1;
    }
  }, [pulse]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cols = Math.max(10, Math.floor(size / cell));
    const rows = Math.max(10, Math.floor(size / (cell * 2)));
    canvas.width = Math.round(cols * cell * dpr);
    canvas.height = Math.round(rows * cell * 2 * dpr);
    ctx.scale(dpr, dpr);

    const W = cols;
    const H = rows * 2;
    const depth = new Float32Array(W * H);
    const shade = new Float32Array(W * H);

    const DIST = 6.4;
    const F0 = H * 1.35;
    /* свет: сверху-слева, чуть спереди */
    const LX = 0.45;
    const LY = 0.78;
    const LZ = -0.44;

    let A = 0.55;
    let B = 0.9;
    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    let last = performance.now();
    let dead = false;
    let mesh: GlbMesh | null = null;
    let rx: Float32Array | null = null;
    let ry: Float32Array | null = null;
    let rz: Float32Array | null = null;
    let rnx: Float32Array | null = null;
    let rny: Float32Array | null = null;
    let rnz: Float32Array | null = null;

    const onMouse = (e: MouseEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    };

    const rasterize = () => {
      if (!mesh || !rx || !ry || !rz) return;
      /* лёгкий «вдох» модели на каждую смену секунд */
      const F = F0 * (1 + 0.06 * kickRef.current);
      const sA = Math.sin(A);
      const cA = Math.cos(A);
      const sB = Math.sin(B);
      const cB = Math.cos(B);
      const n = mesh.pos.length / 3;

      for (let i = 0; i < n; i++) {
        const x = mesh.pos[i * 3];
        const y = mesh.pos[i * 3 + 1];
        const z = mesh.pos[i * 3 + 2];
        const y1 = y * cA - z * sA;
        const z1 = y * sA + z * cA;
        rx[i] = x * cB + z1 * sB;
        rz[i] = -x * sB + z1 * cB;
        ry[i] = y1;
        const nx0 = mesh.nor[i * 3];
        const ny0 = mesh.nor[i * 3 + 1];
        const nz0 = mesh.nor[i * 3 + 2];
        const ny1 = ny0 * cA - nz0 * sA;
        const nz1 = ny0 * sA + nz0 * cA;
        rnx![i] = nx0 * cB + nz1 * sB;
        rnz![i] = -nx0 * sB + nz1 * cB;
        rny![i] = ny1;
      }

      depth.fill(Infinity);
      shade.fill(0);

      const idx = mesh.idx;
      for (let t = 0; t < idx.length; t += 3) {
        const i0 = idx[t];
        const i1 = idx[t + 1];
        const i2 = idx[t + 2];
        const z0 = rz[i0] + DIST;
        const z1 = rz[i1] + DIST;
        const z2 = rz[i2] + DIST;
        if (z0 <= 0.5 || z1 <= 0.5 || z2 <= 0.5) continue;
        const x0 = W / 2 + (F * rx[i0]) / z0;
        const y0 = H / 2 - (F * ry[i0]) / z0;
        const x1 = W / 2 + (F * rx[i1]) / z1;
        const y1 = H / 2 - (F * ry[i1]) / z1;
        const x2 = W / 2 + (F * rx[i2]) / z2;
        const y2 = H / 2 - (F * ry[i2]) / z2;

        let minX = Math.floor(Math.min(x0, x1, x2));
        let maxX = Math.ceil(Math.max(x0, x1, x2));
        let minY = Math.floor(Math.min(y0, y1, y2));
        let maxY = Math.ceil(Math.max(y0, y1, y2));
        if (maxX < 0 || maxY < 0 || minX >= W || minY >= H) continue;
        minX = Math.max(0, minX);
        maxX = Math.min(W - 1, maxX);
        minY = Math.max(0, minY);
        maxY = Math.min(H - 1, maxY);

        const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
        if (Math.abs(area) < 1e-6) continue;
        const inv = 1 / area;

        for (let yy = minY; yy <= maxY; yy++) {
          for (let xx = minX; xx <= maxX; xx++) {
            const pxp = xx + 0.5;
            const pyp = yy + 0.5;
            const w0 = ((x1 - x0) * (pyp - y0) - (pxp - x0) * (y1 - y0)) * inv;
            const w1 = ((x2 - x1) * (pyp - y1) - (pxp - x1) * (y2 - y1)) * inv;
            const w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const z = w0 * z2 + w1 * z0 + w2 * z1;
            const pi = yy * W + xx;
            if (z >= depth[pi]) continue;
            depth[pi] = z;
            let nx = w0 * rnx![i2] + w1 * rnx![i0] + w2 * rnx![i1];
            let ny = w0 * rny![i2] + w1 * rny![i0] + w2 * rny![i1];
            let nz = w0 * rnz![i2] + w1 * rnz![i0] + w2 * rnz![i1];
            const nl = Math.hypot(nx, ny, nz) || 1;
            nx /= nl;
            ny /= nl;
            nz /= nl;
            const lam = Math.max(0, nx * LX + ny * LY + nz * LZ);
            shade[pi] = 0.16 + 0.84 * lam;
          }
        }
      }
    };

    const drawChars = () => {
      ctx.clearRect(0, 0, cols * cell, rows * cell * 2);
      ctx.fillStyle = colorRef.current;
      ctx.textAlign = "center";
      ctx.font = `${Math.round(cell * 1.62)}px "JetBrains Mono", ui-monospace, monospace`;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const p0 = (y * 2) * W + x;
          const p1 = (y * 2 + 1) * W + x;
          if (depth[p0] === Infinity && depth[p1] === Infinity) continue;
          const l = (shade[p0] + shade[p1]) / 2;
          if (l <= 0.02) continue;
          const ci = Math.min(11, Math.max(1, Math.round(l * 11)));
          ctx.globalAlpha = 0.22 + (ci / 11) * 0.78;
          ctx.fillText(RAMP[ci], x * cell + cell / 2, y * cell * 2 + cell * 1.45);
        }
      }
      ctx.globalAlpha = 1;
    };

    const renderFrame = () => {
      rasterize();
      drawChars();
    };

    const frame = (t: number) => {
      if (dead) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      px += (tx - px) * 0.045;
      py += (ty - py) * 0.045;
      const spd = speedRef.current;
      A = 0.55 + py * 0.9 + Math.sin(t * 0.0004 * spd) * 0.12;
      B += dt * 0.5 * spd + px * dt * 0.8;
      kickRef.current *= Math.exp(-dt * 5.5);
      renderFrame();
      raf = requestAnimationFrame(frame);
    };

    /* загрузка: пробуем источники по очереди */
    (async () => {
      for (const url of sources) {
        if (dead) return;
        try {
          const m = normalize(await loadGlb(url), 3.4);
          if (dead) return;
          mesh = m;
          const vn = m.pos.length / 3;
          rx = new Float32Array(vn);
          ry = new Float32Array(vn);
          rz = new Float32Array(vn);
          rnx = new Float32Array(vn);
          rny = new Float32Array(vn);
          rnz = new Float32Array(vn);
          setReady(true);
          if (reduced) {
            renderFrame();
          } else {
            window.addEventListener("mousemove", onMouse);
            last = performance.now();
            raf = requestAnimationFrame(frame);
          }
          return;
        } catch {
          /* пробуем следующий источник */
        }
      }
      if (!dead) onFailRef.current?.();
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, cell, sources]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        opacity: ready ? opacity : 0,
        transition: "opacity 0.7s ease",
      }}
      aria-hidden="true"
    />
  );
}
