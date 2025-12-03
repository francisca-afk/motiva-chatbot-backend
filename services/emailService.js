const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,     
      pass: process.env.SMTP_PASS      
    }
})

exports.sendEmail = async ({ from = process.env.SMTP_USER, to, subject, html }) => {
    const mailOptions = {
        from,
        to,
        subject,
        html
    }
    await transporter.sendMail(mailOptions);
}