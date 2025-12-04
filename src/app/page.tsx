"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  pipeline,
  env,
  type ObjectDetectionPipeline,
} from "@xenova/transformers";

type Detection = {
  score: number;
  label: string;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
};

// パイプラインはブラウザ内で 1 度だけ初期化して使い回す
let detectorPromise: Promise<ObjectDetectionPipeline> | null = null;
function getDetector() {
  if (!detectorPromise) {
    detectorPromise = pipeline(
      "object-detection",
      "Xenova/detr-resnet-50"
    ) as Promise<ObjectDetectionPipeline>;
  }
  return detectorPromise;
}

// Transformers.js をブラウザ向けに設定
env.allowLocalModels = false; // すべて Hugging Face から取得
env.backends.onnx.wasm.numThreads = 1;

export default function Home() {
  const [loadingModel, setLoadingModel] = useState(false);
  const [running, setRunning] = useState(false);
  const [detections, setDetections] = useState<Detection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const runDetection = useCallback(
    async (src: string, img: HTMLImageElement) => {
      setError(null);
      setRunning(true);
      try {
        const detector = await getDetector();
        const output = (await detector(src, {
          threshold: 0.3,
        })) as any[];

        const results: Detection[] = output.map((item) => ({
          score: item.score,
          label: item.label,
          box: item.box,
        }));

        setDetections(results);

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2;
        ctx.font =
          "16px system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";

        results.forEach((det) => {
          const { xmin, ymin, xmax, ymax } = det.box;
          const w = xmax - xmin;
          const h = ymax - ymin;

          ctx.strokeStyle = "#22c55e";
          ctx.fillStyle = "rgba(34,197,94,0.15)";
          ctx.fillRect(xmin, ymin, w, h);
          ctx.strokeRect(xmin, ymin, w, h);

          const label = `${det.label} ${(det.score * 100).toFixed(1)}%`;
          const textWidth = ctx.measureText(label).width + 8;
          const textHeight = 20;

          ctx.fillStyle = "#22c55e";
          ctx.fillRect(
            xmin,
            Math.max(0, ymin - textHeight),
            textWidth,
            textHeight
          );
          ctx.fillStyle = "#0a0a0a";
          ctx.fillText(label, xmin + 4, Math.max(14, ymin - 6));
        });
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "推論中にエラーが発生しました");
      } finally {
        setRunning(false);
      }
    },
    []
  );

  // 画像が読み込まれたら自動で推論
  const handleImageLoad = useCallback(
    async (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      await runDetection(img.src, img);
    },
    [runDetection]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setDetections(null);

      const url = URL.createObjectURL(file);
      const img = imageRef.current;
      if (!img) return;
      img.src = url;
    },
    []
  );

  // 初回アクセス時にモデルをプリロード（任意）
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingModel(true);
        await getDetector();
        if (!cancelled) {
          setLoadingModel(false);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setLoadingModel(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:px-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Transformers.js Object Detection Demo
          </h1>
          <p className="max-w-2xl text-sm text-zinc-400 sm:text-base">
            画像をアップロードすると、ブラウザだけで Hugging Face の DETR
            モデルを使って物体検知を行います。
            データはサーバーに送信されず、WASM 上でローカル推論されます。
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-zinc-400 sm:text-sm">
            <span className="rounded-full border border-zinc-700 px-3 py-1">
              WebAssembly / WebGPU 対応ブラウザ推奨
            </span>
            {loadingModel ? (
              <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-amber-300">
                モデル読み込み中（初回のみ数十秒かかることがあります）
              </span>
            ) : (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                モデル準備完了
              </span>
            )}
          </div>
        </header>

        <section className="flex flex-col gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-medium text-zinc-100 sm:text-lg">
                画像をアップロード
              </h2>
              <p className="text-xs text-zinc-400 sm:text-sm">
                人や物が写っている写真を選んでください。ブラウザ内でのみ処理されます。
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white">
              画像を選択
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <div className="flex flex-col items-center justify-center gap-4 p-4 sm:p-6">
              <div className="relative w-full max-w-xl">
                {/* 実際の描画は canvas で行う */}
                <canvas
                  ref={canvasRef}
                  className="h-auto w-full rounded-lg bg-zinc-900"
                />
                {/* 推論用にだけ使う画像要素（非表示） */}
                <img
                  ref={imageRef}
                  alt="uploaded"
                  className="hidden"
                  onLoad={handleImageLoad}
                />
              </div>
              {running && (
                <p className="text-xs text-zinc-400 sm:text-sm">
                  推論中…（ブラウザ内で計算しています）
                </p>
              )}
              {error && (
                <p className="text-xs text-rose-300 sm:text-sm">{error}</p>
              )}
              {!running && !detections && (
                <p className="text-xs text-zinc-500 sm:text-sm">
                  まだ画像が選択されていません。上のボタンから画像をアップロードしてください。
                </p>
              )}
            </div>
          </div>

          {detections && detections.length > 0 && (
            <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <h3 className="text-sm font-medium text-zinc-100 sm:text-base">
                検出結果
              </h3>
              <ul className="flex flex-wrap gap-2 text-xs sm:text-sm">
                {detections.map((d, i) => (
                  <li
                    key={`${d.label}-${i}`}
                    className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-200"
                  >
                    {d.label} ({(d.score * 100).toFixed(1)}%)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <footer className="mt-4 text-xs text-zinc-500 sm:text-sm">
          このデモは Next.js + Transformers.js
          で構成されており、推論はすべてブラウザ内の WASM / WebGPU
          上で実行されます。
        </footer>
      </main>
    </div>
  );
}
