# Secure Web Gateway for Windows

This repository includes an Electron desktop wrapper for the hosted Secure Web Gateway website.

## Build the Windows installer

On a Windows machine with Node.js 20 or newer:

1. Clone or pull the repository.
2. Run `npm install`.
3. Run `npm run desktop:dist`.
4. Find the Windows installer in `dist-electron/`.

For local development, run `npm run desktop`.

The desktop app loads the hosted website at:
https://secure-web-gateway--c00le5tp3rs0n3v.replit.app/chat

It therefore requires an internet connection and the hosted service to be available. It uses Electron's persistent application session for website sign-in cookies. The website and its database remain hosted remotely; this wrapper does not copy the database onto the PC.

External links open in the system browser. The remote page runs with Node integration disabled and context isolation enabled.
