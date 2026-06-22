import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "ticket-intel-secret-key-2026";
const JWT_EXPIRES = "7d";

export async function login(email, password) {
  const agent = await prisma.agent.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!agent) throw new Error("Email tidak terdaftar");
  if (!agent.password) throw new Error("Akun ini belum memiliki password");
  const valid = await bcrypt.compare(password, agent.password);
  if (!valid) throw new Error("Password salah");
  await prisma.agent.update({ where: { id: agent.id }, data: { lastLogin: new Date() } });
  const token = jwt.sign({ id: agent.id, email: agent.email, name: agent.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return { token, agent: { id: agent.id, email: agent.email, name: agent.name } };
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function getProfile(agentId) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, email: true, name: true, lastLogin: true, createdAt: true },
  });
  return agent;
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decoded = verifyToken(header.slice(7));
    req.agent = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}