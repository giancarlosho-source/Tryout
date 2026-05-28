import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tribevb.tryouts",
  appName: "Tribe Tryouts",
  webDir: "dist/public",
  server: {
    url: "http://192.168.0.132:19107",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
