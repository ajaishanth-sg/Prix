import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const PYTHON_BACKEND = "http://127.0.0.1:8001";
  const httpServer = http.createServer(app);

  app.use(express.json());
  
  app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
  });

  // Proxy API requests to the Python backend
  app.all("/api/*", async (req, res) => {
    const targetUrl = `${PYTHON_BACKEND}${req.originalUrl}`;
    console.log(`[Proxy] Forwarding ${req.method} ${req.originalUrl} -> ${targetUrl}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Construct request headers to forward
      const headersToForward: Record<string, string> = {};
      Object.entries(req.headers).forEach(([key, value]) => {
        if (value !== undefined) {
          headersToForward[key] = Array.isArray(value) ? value.join(", ") : value;
        }
      });
      
      // Override Host header
      headersToForward["host"] = new URL(PYTHON_BACKEND).host;

      const fetchOptions: RequestInit = {
        method: req.method,
        headers: headersToForward,
        signal: controller.signal
      };

      if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
        headersToForward["content-type"] = "application/json";
      }

      const proxyRes = await fetch(targetUrl, fetchOptions);
      clearTimeout(timeoutId);

      // Copy headers from proxy response
      proxyRes.headers.forEach((value, name) => {
        if (name.toLowerCase() !== "transfer-encoding") {
          res.setHeader(name, value);
        }
      });

      res.status(proxyRes.status);

      // Send the body binary contents
      const arrayBuffer = await proxyRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error(`[Proxy Error] Failed to proxy to Python backend:`, error);
      res.status(502).json({
        error: "Bad Gateway",
        message: "Failed to communicate with Python backend server",
        details: error?.message || String(error)
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        // @ts-ignore
        hmr: { server: httpServer, host: false }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Proxying /api/* requests to Python backend at ${PYTHON_BACKEND}`);
  });
}

startServer();
