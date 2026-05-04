import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.omnisync.mobile",
  appName: "Track Wallet",
  webDir: "dist",
  android: {
    includePlugins: ["@omni-sync/mobile-sms-capture"],
  },
};

export default config;
