const Business = require('../models/Business');
const User = require('../models/User');
const Invitation = require('../models/Invitation');
const { sendEmail } = require('../services/emailService');
const crypto = require('crypto');


// 📌 Obtener usuarios + invitaciones de un Business
exports.getBusinessUsers = async (req, res) => {
  try {
    const { businessId } = req.params;

    // 1. Validar que exista el negocio
    console.log(businessId, "businessId")
    const business = await Business.findById(businessId).lean();
    if (!business) {
      return res.status(404).json({
        message: "Business not found",
        data: null
      });
    }
  console.log(business, "business")
    // 2. Buscar usuarios activos de ese negocio
    const users = await User.find({ business: businessId })
      .select("firstName lastName email role createdAt")
      .lean();

    // 3. Buscar invitaciones pendientes
    const invitations = await Invitation.find({ businessId })
      .select("email role invitedAt expiresAt status")
      .lean();

    return res.status(200).json({
      message: "Users and invitations retrieved",
      data: {
        users: users.map(u => ({
          ...u,
          isYou: u._id.toString() === req.user.userId
        })),
        invitations: invitations.map(inv => ({
          ...inv,
          status: new Date(inv.expiresAt) < new Date() ? "expired" : inv.status
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching business users:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



// 📌 Invitar usuario nuevo
exports.inviteUser = async (req, res) => {
  console.log(req.params, "req.params from inviteUser")
  console.log(req.body, "req.body from inviteUser")
  try {
    const { businessId } = req.params;
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        message: "Email and role are required",
        data: null
      });
    }

    // 1. Validar negocio
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        message: "Business not found",
        data: null
      });
    }
    console.log(business, "business from inviteUser")
    // 2. Validar que el usuario no exista ya en el negocio
    const existingUser = await User.findOne({ email, business: businessId });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists in this business",
        data: null
      });
    }
    console.log(existingUser, "existingUser from inviteUser")
    // 3. Validar invitación previa
    const existingInvite = await Invitation.findOne({
      email,
      businessId,
      status: "pending"
    });
    console.log(existingInvite, "existingInvite from inviteUser")
    if (existingInvite) {
      return res.status(400).json({
        message: "Invitation already sent",
        data: null
      });
    }
    console.log(req.user, "req.user from inviteUser")
    // 4. Crear invitación
    const invitation = await Invitation.create({
      businessId,
      email,
      role,
      invitedBy: req.user.userId,
      invitedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      token: crypto.randomBytes(32).toString("hex"),
      status: "pending"
    });
    console.log(invitation, "invitation from inviteUser")
    // 5. Mandar email
    await sendEmail({ to: email, subject: "Invitation to join the business", 
      html: `You are invited to join the business ${business.name}. Please click the link below to accept the invitation: <a href="${process.env.FRONTEND_URL}/accept-invitation?token=${invitation.token}&role=${role}">Accept Invitation</a>` });
    console.log("email sent from inviteUser")
    return res.status(201).json({
      message: "Invitation sent",
      data: invitation
    });

  } catch (error) {
    console.error("Error inviting user:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



// 📌 Actualizar rol de usuario
exports.updateUserRole = async (req, res) => {
  try {
    const { businessId, userId } = req.params;
    const { role } = req.body;

    const validRoles = ["owner", "admin", "agent"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role",
        data: null
      });
    }

    // No te puedes cambiar tu propio rol
    if (userId === req.user.userId) {
      return res.status(400).json({
        message: "You cannot change your own role",
        data: null
      });
    }

    const user = await User.findOne({ _id: userId, business: businessId });
    if (!user) {
      return res.status(404).json({
        message: "User not found in this business",
        data: null
      });
    }

    user.role = role;
    await user.save();

    return res.status(200).json({
      message: "Role updated",
      data: user
    });

  } catch (error) {
    console.error("Error updating role:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



// 📌 Eliminar usuario del negocio
exports.removeUser = async (req, res) => {
  try {
    const { businessId, userId } = req.params;

    if (userId === req.user.userId) {
      return res.status(400).json({
        message: "You cannot remove yourself",
        data: null
      });
    }

    const user = await User.findById(userId);
    if (!user || user.business?.toString() !== businessId) {
      return res.status(404).json({
        message: "User not found in this business",
        data: null
      });
    }

    user.business = null;
    user.role = "agent"; // o default que quieras
    await user.save();

    return res.status(200).json({
      message: "User removed from business",
      data: null
    });

  } catch (error) {
    console.error("Error removing user:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



// 📌 Reenviar invitación
exports.resendInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await Invitation.findById(invitationId);
    if (!invitation) {
      return res.status(404).json({
        message: "Invitation not found",
        data: null
      });
    }

    invitation.expiresAt = new Date(Date.now() + 7 * 86400000);
    await invitation.save();

    await sendInvitationEmail(invitation.email, invitation.token, invitation.role);

    return res.status(200).json({
      message: "Invitation resent",
      data: invitation
    });

  } catch (error) {
    console.error("Error resending invitation:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



// 📌 Cancelar invitación
exports.cancelInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await Invitation.findByIdAndDelete(invitationId);
    if (!invitation) {
      return res.status(404).json({
        message: "Invitation not found",
        data: null
      });
    }

    return res.status(200).json({
      message: "Invitation cancelled",
      data: null
    });

  } catch (error) {
    console.error("Error cancelling invitation:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};
