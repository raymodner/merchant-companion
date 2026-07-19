import jwt from 'jsonwebtoken';

const secret = () => process.env.JWT_SECRET || 'dev-secret-change-me';

export function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, secret());
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
