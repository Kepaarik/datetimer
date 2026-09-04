import { useEffect, useRef } from "react";

export type AsciiShape = "duck" | "torus" | "sphere" | "cube";

/** Карта яркости — от почти пустого символа к плотному. */
const RAMP = ".,-~:;=!*#$@";

interface AsciiObjectProps {
  shape: AsciiShape;
  /** CSS-цвет символов */
  color: string;
  /** сторона квадратного канваса в CSS-пикселях */
  size?: number;
  /** ширина одной ячейки в CSS-пикселях (высота = 2×) */
  cell?: number;
  opacity?: number;
  className?: string;
  /** меняющееся значение (секунды) — объект коротко «подпрыгивает» */
  pulse?: number;
  /** множитель скорости авторотации, 1 = по умолчанию */
  speed?: number;
}

/**
 * Вращающийся 3D-объект, отрисованный ASCII-символами по яркости
 * (в духе ASCII Object из Canvas UI). Полностью самодостаточный
 * canvas-компонент: тороид и сфера считаются по z-буферу с ламбертовым
 * освещением, куб — каркасом из рёбер. Лёгкий параллакс за курсором.
 */
export function AsciiObject({
  shape,
  color,
  size = 560,
  cell = 13,
  opacity = 0.38,
  className,
  pulse = 0,
  speed = 1,
}: AsciiObjectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shapeRef = useRef(shape);
  shapeRef.current = shape;
  const colorRef = useRef(color);
  colorRef.current = color;
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cols = Math.max(10, Math.floor(size / cell));
    const rows = Math.max(10, Math.floor(size / (cell * 2)));
    canvas.width = Math.round(cols * cell * dpr);
    canvas.height = Math.round(rows * cell * 2 * dpr);
    ctx.scale(dpr, dpr);

    const zbuf = new Float32Array(cols * rows);
    const lum = new Uint8Array(cols * rows);

    /* углы куба и 12 рёбер */
    const C = 2;
    const CORNERS: [number, number, number][] = [];
    for (const x of [-C, C])
      for (const y of [-C, C])
        for (const z of [-C, C]) CORNERS.push([x, y, z]);
    const EDGES: [number, number][] = [];
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++) {
        const a = CORNERS[i];
        const b = CORNERS[j];
        const diff =
          (a[0] !== b[0] ? 1 : 0) +
          (a[1] !== b[1] ? 1 : 0) +
          (a[2] !== b[2] ? 1 : 0);
        if (diff === 1) EDGES.push([i, j]);
      }

    /* утка собирается из эллипсоидов: корпус с ватерлинией,
       голова, клюв и хвост; нормали — как у эллипсоида */
    const duckPts: number[] = [];
    const ellipsoid = (
      cx0: number,
      cy0: number,
      cz0: number,
      a: number,
      b: number,
      c: number,
      dTh: number,
      dPh: number,
      cutY?: number,
    ) => {
      for (let th = 0; th < Math.PI; th += dTh) {
        const st = Math.sin(th);
        const ct = Math.cos(th);
        for (let ph = 0; ph < Math.PI * 2; ph += dPh) {
          const cp = Math.cos(ph);
          const sp = Math.sin(ph);
          const x = cx0 + a * st * cp;
          const y = cy0 + b * ct;
          const z = cz0 + c * st * sp;
          if (cutY !== undefined && y < cutY) continue;
          let nx = (st * cp) / a;
          let ny = ct / b;
          let nz = (st * sp) / c;
          const nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl;
          ny /= nl;
          nz /= nl;
          duckPts.push(x, y, z, nx, ny, nz);
        }
      }
    };
    ellipsoid(-0.15, -0.45, 0, 1.5, 1.05, 1.2, 0.085, 0.042, -0.98); // корпус
    ellipsoid(0.95, 0.95, 0, 0.68, 0.68, 0.68, 0.1, 0.05); // голова
    ellipsoid(1.62, 0.78, 0, 0.42, 0.19, 0.27, 0.17, 0.1); // клюв
    ellipsoid(-1.32, 0.22, 0, 0.4, 0.48, 0.3, 0.2, 0.12); // хвост

    const K2 = 5.6;
    let K1 = (cols * K2 * 3) / 24;
    const cx = cols / 2;
    const cy = rows / 2;

    let A = 0.9;
    let B = 0.5;
    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    let last = performance.now();

    const onMouse = (e: MouseEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    };

    const plot = (
      X: number,
      Y: number,
      Z: number,
      L: number,
    ) => {
      if (L <= 0.02) return;
      const z = K2 + Z;
      if (z <= 0.3) return;
      const ooz = 1 / z;
      const x = Math.floor(cx + K1 * ooz * X);
      const y = Math.floor(cy - K1 * ooz * Y);
      if (x < 0 || x >= cols || y < 0 || y >= rows) return;
      const i = y * cols + x;
      if (ooz <= zbuf[i]) return;
      zbuf[i] = ooz;
      lum[i] = Math.min(11, Math.max(1, Math.round(L * 11)));
    };

    const renderFrame = () => {
      const sA = Math.sin(A);
      const cA = Math.cos(A);
      const sB = Math.sin(B);
      const cB = Math.cos(B);

      /* поворот: X на угол A, затем Z на угол B; свет (0, 1, -1)/√2 */
      const rot = (
        x: number,
        y: number,
        z: number,
      ): [number, number, number] => {
        const y1 = y * cA - z * sA;
        const z1 = y * sA + z * cA;
        return [x * cB - y1 * sB, x * sB + y1 * cB, z1];
      };
      const light = (ny: number, nz: number) =>
        (ny - nz) * 0.7071;

      zbuf.fill(0);
      lum.fill(0);

      const s = shapeRef.current;

      /* вписываем проекцию в сетку по обеим осям: максимальный
         «радиус» фигуры в единицах K1 известен заранее, поэтому
         K1 подбирается под меньшую полуось — без этого фигуры
         обрезались сверху и снизу */
      const extent =
        s === "cube" ? 1.62 : s === "duck" ? 0.68 : s === "sphere" ? 0.87 : 0.89;
      K1 = (Math.min(cols / 2, rows / 2) * 0.92) / extent;
      /* лёгкий «вдох» фигуры на каждую смену секунд */
      K1 *= 1 + 0.06 * kickRef.current;

      if (s === "duck") {
        for (let i = 0; i < duckPts.length; i += 6) {
          const [X, Y, Z] = rot(duckPts[i], duckPts[i + 1], duckPts[i + 2]);
          const [, NY, NZ] = rot(
            duckPts[i + 3],
            duckPts[i + 4],
            duckPts[i + 5],
          );
          plot(X, Y, Z, light(NY, NZ));
        }
      } else if (s === "torus") {
        const R1 = 1;
        const R2 = 2.1;
        for (let th = 0; th < Math.PI * 2; th += 0.07) {
          const ct = Math.cos(th);
          const st = Math.sin(th);
          for (let ph = 0; ph < Math.PI * 2; ph += 0.02) {
            const cp = Math.cos(ph);
            const sp = Math.sin(ph);
            const hx = R2 + R1 * ct;
            const hy = R1 * st;
            const [X, Y, Z] = rot(hx * cp, hy, hx * sp);
            /* нормаль тора: (ct·cp, st, ct·sp) */
            const [, NY, NZ] = rot(ct * cp, st, ct * sp);
            plot(X, Y, Z, light(NY, NZ));
          }
        }
      } else if (s === "sphere") {
        const R = 2.6;
        for (let th = 0; th < Math.PI; th += 0.075) {
          const st = Math.sin(th);
          const ct = Math.cos(th);
          for (let ph = 0; ph < Math.PI * 2; ph += 0.032) {
            const nx = st * Math.cos(ph);
            const ny0 = ct;
            const nz = st * Math.sin(ph);
            const [X, Y, Z] = rot(nx * R, ny0 * R, nz * R);
            const [, NY, NZ] = rot(nx, ny0, nz);
            plot(X, Y, Z, light(NY, NZ));
          }
        }
      } else {
        /* каркасный куб: точки вдоль рёбер, яркость по глубине */
        const STEPS = 44;
        for (const [i, j] of EDGES) {
          const a = CORNERS[i];
          const b = CORNERS[j];
          for (let t = 0; t <= STEPS; t++) {
            const k = t / STEPS;
            const x = a[0] + (b[0] - a[0]) * k;
            const y = a[1] + (b[1] - a[1]) * k;
            const z = a[2] + (b[2] - a[2]) * k;
            const [X, Y, Z] = rot(x, y, z);
            const L = 0.35 + 0.6 * ((K2 + C * 1.8 - (K2 + Z)) / (C * 3.6) + 0.5);
            plot(X, Y, Z, Math.min(1, Math.max(0.2, L)));
          }
        }
      }

      /* отрисовка символов */
      ctx.clearRect(0, 0, cols * cell, rows * cell * 2);
      ctx.fillStyle = colorRef.current;
      ctx.textAlign = "center";
      ctx.font = `${Math.round(cell * 1.62)}px "JetBrains Mono", ui-monospace, monospace`;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const l = lum[i];
          if (!l) continue;
          ctx.globalAlpha = 0.16 + (l / 11) * 0.84;
          ctx.fillText(
            RAMP[l],
            x * cell + cell / 2,
            y * cell * 2 + cell * 1.45,
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      px += (tx - px) * 0.045;
      py += (ty - py) * 0.045;
      const spd = speedRef.current;
      A += dt * 0.55 * spd + py * dt * 0.6;
      B += dt * 0.38 * spd + px * dt * 0.6;
      kickRef.current *= Math.exp(-dt * 5.5);
      renderFrame();
      raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      renderFrame();
    } else {
      window.addEventListener("mousemove", onMouse);
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
    };
  }, [size, cell]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", opacity }}
      aria-hidden="true"
    />
  );
}
