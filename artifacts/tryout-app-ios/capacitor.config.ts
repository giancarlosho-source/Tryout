import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tribevb.tryouts",
  appName: "Tribe Tryouts",
  webDir: "dist/public",
  ios: {
    contentInset: "always",
  },
};

export default config;
