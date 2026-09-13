import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const NORACRE_DATABASE_ID = "2a631a70-5bd5-45db-a31f-9c18b246c716";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  name: "noracre-crm",
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  keep_vars: true,
  routes: [
    { pattern: "crm.noracre.no", custom_domain: true },
    { pattern: "noracre.no", custom_domain: true },
    { pattern: "www.noracre.no", custom_domain: true },
  ],
  triggers: { crons: ["* * * * *"] },
  vars: {
    APP_URL: "https://crm.noracre.no",
    GOOGLE_DEMO_BOOKING_URL: "https://calendar.app.google/CnNDypHGrKHS5hg18",
    SUPABASE_URL: "https://elxxbhelzlpevdvxlxba.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_lFjFqfL2IFPo_ZqQVSzIGA_QXjtNiCp",
  },
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "noracre-crm-db",
          database_id: NORACRE_DATABASE_ID,
          migrations_dir: "drizzle",
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "noracre-crm-files",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
