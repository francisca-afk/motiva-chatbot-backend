const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SG_MAIL);
const { PERMISSIONS, ROLES } = require('../config/roles');

const createToken = (userId, impersonatedBy = null) => {
  return jwt.sign({ 
    userId,
    impersonatedBy 
  }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.signup = async (req, res) => {
  try {
    
    const { password, email, firstName, lastName } = req.body;

    
    const existingUser = await User.findOne({ email });
    
    
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = new User({
      email,
      password,
      firstName,
      lastName
    });

    await user.save();

    const authToken = createToken(user._id);

    res.status(201).json({
      message: 'User created successfully',
      token: authToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    // Generate token
    const token = createToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        business: user.business || null,
        role: user.role || null
      }
    });
  } catch (error) {
    console.log(error, "error")
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; 
    await user.save();

    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`
    
    const msg = {
      to: [email],
      from: process.env.authEmail,
      subject: 'Reset your password - SaaS',
      html: `
        <h1>You have requested to reset your password</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This reset link will expire in 1 hour.</p>
        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      `
    };

    const send = await sgMail.send(msg)
    console.log(send, "send");
    
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting password reset', error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

exports.getUserByToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    return res.status(200).json({
      message: 'User found',
      data: user
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Error getting user by token',
      error: error.message
    });
  }
}

exports.getPermissions = async (req, res) => {
  try {
    return res.status(200).json({
      message: 'Permissions found',
      data: {
        permissions: PERMISSIONS,
        roles: ROLES
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Error getting permissions',
      error: error.message
    });
  }
}