import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tryoutdesk.app",
  appName: "TryoutDesk",
  webDir: "dist/public",
  ios: {
    contentInset: "always",
  },
};

export default config;
