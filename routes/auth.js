const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');


router.post('/signup', async (req, res) => { 
  try {
    const { username, email, password, avatar } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });


    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);


    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      avatar: avatar || ""
    });

    const savedUser = await newUser.save();
    
 
    const { password: _, ...info } = savedUser._doc;
    res.status(201).json({ success: true, user: info });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    
    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) return res.status(400).json({ success: false, message: "Wrong password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const { password, ...info } = user._doc;

    res.status(200).json({ success: true, user: info, token });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


router.put('/update/:id', async (req, res) => {
  try {
    const { username, avatar } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...(username && { username }),
          ...(avatar && { avatar })
        }
      },
      { new: true } 
    );

    const { password, ...info } = updatedUser._doc;
    res.status(200).json({ success: true, user: info });
  } catch (err) {
    res.status(500).json({ success: false, message: "Update failed" });
  }
});


router.put('/wishlist/:id', async (req, res) => {
  const userId = req.params.id;
  const { movieId } = req.body;
  try {
    const user = await User.findById(userId);
    if (user.wishlist.includes(movieId)) {
      await user.updateOne({ $pull: { wishlist: movieId } });
      res.status(200).json("Removed from wishlist");
    } else {
      await user.updateOne({ $push: { wishlist: movieId } });
      res.status(200).json("Added to wishlist");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});


router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: "User not found" });


    const token = crypto.randomBytes(20).toString('hex');

 
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();


    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;

    const mailOptions = {
      from: '"yeonghwa Support"',
      to: user.email,
      subject: 'Reset Your yeonghwa Password',

      text: `You requested a password reset. Please go to this link: ${resetUrl}`,

      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f0f0f0; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background-color: #000000; padding: 30px; text-align: center; }
            .logo { color: #ffffff; font-size: 28px; font-weight: 900; letter-spacing: -1px; margin: 0; }
            .logo span { color: #E50914; } /* Sequel Red */
            .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
            h2 { margin-top: 0; color: #1a1a1a; }
            .button-container { text-align: center; margin: 30px 0; }
            .button { display: inline-block; padding: 14px 30px; background-color: #E50914; color: #ffffff !important; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; transition: background 0.3s; }
            .button:hover { background-color: #b20710; }
            .footer { background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; }
            .link { color: #E50914; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="logo">yeonghwa<span>.</span></h1>
            </div>
            <div class="content">
              <h2>Reset Your Password</h2>
              <p>Hello,</p>
              <p>You are receiving this email because we received a password reset request for your account.</p>
              
              <div class="button-container">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>

              <p>If the button doesn't work, copy and paste the link below into your browser:</p>
              <p><a href="${resetUrl}" class="link">${resetUrl}</a></p>
              
              <p style="margin-top: 30px; font-size: 14px; color: #666;">If you did not request this change, you can safely ignore this email. Your password will remain unchanged.</p>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} yeonghwa. All rights reserved.
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: "Email sent" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Email could not be sent" });
  }
});

router.post('/reset-password/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() } 
    });

    if (!user) return res.status(400).json({ success: false, message: "Token is invalid or has expired" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();
    res.status(200).json({ success: true, message: "Password updated" });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;