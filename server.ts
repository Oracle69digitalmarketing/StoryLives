import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Simple session state storage (like Redis in the PDF)
  const sessions = new Map<string, any>();

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join_session", (sessionId) => {
      socket.join(sessionId);
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
          history: [],
          state: { location: "forest", characters: ["Lumi"], mood: "happy" }
        });
      }
      socket.emit("session_joined", sessions.get(sessionId));
    });

    socket.on("update_session", ({ sessionId, data }) => {
      const session = sessions.get(sessionId);
      if (session) {
        sessions.set(sessionId, { ...session, ...data });
        io.to(sessionId).emit("session_updated", sessions.get(sessionId));
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
