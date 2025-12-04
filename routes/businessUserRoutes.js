const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { hasPermission } = require("../middleware/permissions");
const { PERMISSIONS } = require("../config/roles");
const { getBusinessUsers, 
    inviteUser, 
    updateUserRole, 
    removeUser, 
    resendInvitation, 
    cancelInvitation,
    acceptInvitation,
    verifyInvitation } = require("../controllers/businessUserController");


// Users + invitations
router.get(
  "/:businessId/users",
  auth,
  hasPermission(PERMISSIONS.MANAGE_USERS),
  getBusinessUsers
);

// Invite new user
router.post(
  "/:businessId/invite",
  auth,
  hasPermission(PERMISSIONS.MANAGE_USERS),
  inviteUser
);

// Update role
router.patch(
  "/:businessId/users/:userId/role",
  auth,
  hasPermission(PERMISSIONS.MANAGE_USERS),
  updateUserRole
);

// Remove user
router.delete(
  "/:businessId/users/:userId",
  auth,
  hasPermission(PERMISSIONS.MANAGE_USERS),
  removeUser
);

// Resend invitation
router.post(
  "/:businessId/invite/:invitationId/resend",
  auth,
  hasPermission(PERMISSIONS.MANAGE_USERS),
  resendInvitation
);

// Cancel invitation
router.delete(
  "/:businessId/invite/:invitationId",
  auth,
  hasPermission(PERMISSIONS.MANAGE_USERS),
  cancelInvitation
);

router.post("/invite/accept", acceptInvitation);

router.post("/invite/verify", verifyInvitation);

module.exports = router;
