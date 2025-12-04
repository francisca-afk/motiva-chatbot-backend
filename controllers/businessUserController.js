const Business = require('../models/Business');
const User = require('../models/User');
const Invitation = require('../models/Invitation');
const { sendEmail } = require('../services/emailService');
const crypto = require('crypto');


// Get business users and invitations
exports.getBusinessUsers = async (req, res) => {
  try {
    const { businessId } = req.params;

    const business = await Business.findById(businessId).lean();
    if (!business) {
      return res.status(404).json({
        message: "Business not found",
        data: null
      });
    }

    const users = await User.find({ business: businessId })
      .select("firstName lastName email role createdAt")
      .lean();
      
    console.log(users, "users from getBusinessUsers")

    // Find pending invitations
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


exports.inviteUser = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        message: "Email and role are required",
        data: null
      });
    }
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        message: "Business not found",
        data: null
      });
    }
    const existingUser = await User.findOne({ email, business: businessId });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists in this business",
        data: null
      });
    }
    // Check if invitation already exists
    const existingInvite = await Invitation.findOne({
      email,
      businessId,
      status: "pending"
    });
    // If invitation already exists, return error
    if (existingInvite) {
      return res.status(400).json({
        message: "Invitation already sent",
        data: null
      });
    }
    // Create invitation
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
    // Send email
    await sendEmail({ to: email, subject: "Invitation to join the business", 
      html: `You are invited to join the business ${business.name}. Please click the link below to accept the invitation: <a href="${process.env.DASHBOARD_URL}/accept-invitation?token=${invitation.token}&role=${role}">Accept Invitation</a>` });

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


exports.updateUserRole = async (req, res) => {
  try {
    const { businessId, userId } = req.params;
    const { role } = req.body;

    const validRoles = ["owner", "admin", "chatRep"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role",
        data: null
      });
    }

    // If user is trying to change their own role, return error
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


// Resend invitation
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



// Cancel invitation
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

// controllers/invitationController.js
exports.acceptInvitation = async (req, res) => {
  try {
    const { token, firstName, lastName, password } = req.body;

    const invitation = await Invitation.findOne({ token });

    if (!invitation) {
      return res.status(404).json({ message: "Invalid token" });
    }

    if (invitation.status !== "pending") {
      return res.status(410).json({ message: "Invitation already used" });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(410).json({ message: "Invitation expired" });
    }

    // Create user
    const user = await User.create({
      email: invitation.email,
      firstName,
      lastName,
      password,
      business: invitation.businessId,
      role: invitation.role
    });
    // Update invitation status
    invitation.status = "accepted";
    invitation.acceptedAt = new Date();
    await invitation.save();

    //sync user to business
    const business = await Business.findById(invitation.businessId);
    if (!business) {
      return res.status(404).json({
        message: "Business not found",
        data: null
      });
    }

    // Ensure user is not already in business (avoid duplicates)
    if (!business.users.includes(user._id)) {
      business.users.push(user._id);
      await business.save();
    }

    return res.status(201).json({
      message: "Invitation accepted",
      user: {
        _id: user._id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Error accepting invitation:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

exports.verifyInvitation = async (req, res) => {
  try {
    const { token } = req.body;
    console.log(token, "token from verifyInvitation")
    const invitation = await Invitation.findOne({ token });
    console.log(invitation, "invitation from verifyInvitation")
    if (!invitation) {
      return res.status(404).json({
        message: "Invalid invitation token",
        status: "invalid"
      });
    }

    if (invitation.status !== "pending") {
      return res.status(410).json({
        message: "Invitation already used",
        status: "used"
      });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(410).json({
        message: "Invitation expired",
        status: "expired"
      });
    }

    return res.status(200).json({
      message: "Invitation valid",
      status: "valid",
      data: {
        email: invitation.email,
        businessId: invitation.businessId,
        role: invitation.role,
        businessName: invitation.businessName
      }
    });

  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};