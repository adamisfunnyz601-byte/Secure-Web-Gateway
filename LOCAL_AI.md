# NEXUS AI — free local model

NEXUS AI now uses a local Ollama server by default. It does not need an Ollama API key, paid cloud inference, or an `OLLAMA_API_KEY` secret.

## Windows setup

1. Install Ollama from [ollama.com/download](https://ollama.com/download).
2. Open PowerShell and download the lightweight default model:

   ```powershell
   ollama pull qwen2.5:3b
   ```

3. Check that the model is installed:

   ```powershell
   ollama list
   ```

4. Keep Ollama running, then start the Secure Web Gateway server.

The app defaults to:

- Ollama URL: `http://127.0.0.1:11434`
- Model: `qwen2.5:3b`

Optional environment variables:

- `OLLAMA_BASE_URL`: local Ollama server URL (defaults to `http://127.0.0.1:11434`)
- `OLLAMA_MODEL`: installed local model name (defaults to `qwen2.5:3b`)

You do not need `OLLAMA_API_KEY`.

## Important: Replit hosting

`127.0.0.1` always means the machine running the app's backend. If the backend is running on your Windows PC, it reaches Ollama on your PC. If the backend is running on Replit, it reaches the Replit container instead — not your Windows PC.

To use your PC's local model, run the app backend on your PC too, or deliberately configure a secure private tunnel and set `OLLAMA_BASE_URL` to that tunnel's endpoint. Do not expose Ollama's unauthenticated port directly to the public internet.

## Useful checks

```powershell
ollama list
ollama ps
```

Ollama's local API listens on port `11434` by default. Local model requests do not require an API key.
