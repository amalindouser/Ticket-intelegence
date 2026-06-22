import { login, getProfile } from "../services/auth.service.js";

export async function postLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email dan password required" });
    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    if (err.message.includes("tidak terdaftar") || err.message.includes("salah")) {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const profile = await getProfile(req.agent.id);
    if (!profile) return res.status(404).json({ error: "Agent not found" });
    res.json({ agent: profile });
  } catch (err) {
    next(err);
  }
}