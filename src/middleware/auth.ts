import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

const tokens = new Set<string>();

function generateToken(password: string): string {
  const token = crypto
    .createHash("sha256")
    .update(password + Date.now().toString() + crypto.randomBytes(16).toString("hex"))
    .digest("hex");
  tokens.add(token);
  return token;
}

export function loginHandler(adminPassword: string) {
  return (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    if (!password || password !== adminPassword) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    const token = generateToken(password);
    logger.info("Admin login successful");
    res.json({ token });
  };
}

export function authMiddleware(adminPassword: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // If no password is configured, allow all access
    if (!adminPassword) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const token = authHeader.slice(7);
    if (!tokens.has(token)) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    next();
  };
}
