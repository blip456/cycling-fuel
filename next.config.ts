import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";
import { execSync } from "child_process";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkg = require("./package.json") as { version: string };

let buildId = "dev";
try {
  buildId = execSync("git rev-parse --short HEAD", { stdio: ["pipe", "pipe", "pipe"] })
    .toString()
    .trim();
} catch { /* not a git repo or git unavailable */ }

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().split("T")[0],
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);
