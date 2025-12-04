import type { NextConfig } from "next";

const isProd = true;
const nextConfig: NextConfig = {
  // 静的サイトとして出力
  output: "export",

  // https://username.github.io/repo/ でアクセスできるようにする
  basePath: isProd ? "/object-detection" : "",
  assetPrefix: isProd ? "/object-detection" : "",

  /** WASM / Transformers.js 用の設定 */
  experimental: {
    /** ESM な依存関係を扱うための緩め設定 */
    esmExternals: "loose",
  },
  /** Transformers.js をトランスパイル対象にする */
  transpilePackages: ["@xenova/transformers"],
  webpack: (config) => {
    // ブラウザ側で WASM を扱えるようにする
    config.experiments = {
      ...(config.experiments || {}),
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;
