import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dzimem.app',
  appName: 'Dijital Zimem Defteri',
  webDir: 'out',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    loggingBehavior: 'none',
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
