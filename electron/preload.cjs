const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("secureWebGatewayDesktop", Object.freeze({
  isDesktopApp: true,
  version: process.versions.electron
}));
