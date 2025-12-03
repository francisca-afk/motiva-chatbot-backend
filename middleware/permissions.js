const { ROLES } = require('../config/roles');
const User = require('../models/User');

function hasPermission(permission) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized: missing userId" });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Replace req.user with full MongoDB user document
      req.user = user;

      const role = user.role;

      if (!role) {
        return res.status(401).json({ message: "No role found for this user" });
      }

      const allowed = ROLES[role]?.includes(permission);

      if (!allowed) {
        return res.status(403).json({
          message: "Forbidden: insufficient permissions",
          requiredPermission: permission,
          userRole: role
        });
      }

      next();
    } catch (err) {
      res.status(500).json({
        message: "Permission middleware error",
        error: err.message
      });
    }
  };
}

module.exports = { hasPermission };

