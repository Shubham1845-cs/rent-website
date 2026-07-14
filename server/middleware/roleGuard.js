/**
 * requireRole(...roles) — factory that returns middleware checking
 * req.user.role against the allowed roles list.
 * Returns 403 if no match.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', details: {} });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role', details: {} });
    }
    next();
  };
}

module.exports = requireRole;
