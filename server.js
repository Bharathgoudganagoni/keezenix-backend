const express = require("express");
const nodemailer = require("nodemailer");
const multer = require("multer");
const cors = require("cors");

const app = express();

// ✅ CORS (important for frontend)
app.use(cors({
  origin: "*"
}));

app.use(express.json());

// ✅ File upload
const upload = multer({ dest: "uploads/" });

// ✅ Email config (USE ENV VARIABLES)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ✅ Test route (optional but useful)
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// ✅ API
app.post("/apply", upload.single("resume"), async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    const file = req.file;

    // ✅ Safety check
    if (!file) {
      return res.status(400).send("No resume uploaded");
    }

    await transporter.sendMail({
      from: `"Keezenix Careers" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // your sir mail

      subject: `New Job Application - ${name}`,

      html: `
        <div style="font-family: Arial; line-height: 1.6;">
          <p>Hi Sir,</p>

          <p>You have received a new job application.</p>

          <h3>Candidate Details:</h3>
          <ul>
            <li><b>Name:</b> ${name}</li>
            <li><b>Email:</b> ${email}</li>
            <li><b>Phone:</b> ${phone}</li>
          </ul>

          <h3>Message:</h3>
          <p>${message}</p>

          <p>Resume is attached below.</p>

          <br/>
          <p>Regards,<br/>Keezenix Careers Portal</p>
        </div>
      `,

      attachments: [
        {
          filename: file.originalname,
          path: file.path
        }
      ]
    });

    res.send("Application sent successfully");

  } catch (err) {
    console.error("EMAIL ERROR:", err);
    res.status(500).send("Error sending application");
  }
});

// ✅ PORT FIX (required for Render)
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});