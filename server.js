require("dotenv").config();
const dns = require("dns");

// ✅ Force IPv4 DNS resolution first to prevent ENETUNREACH errors on hosts without IPv6 routing (e.g. Render)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
const fs = require("fs");
const express = require("express");
const nodemailer = require("nodemailer");
const multer = require("multer");
const cors = require("cors");

const app = express();

// ✅ CORS (important for frontend)
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*"
}));

app.use(express.json());

// ✅ Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ✅ File upload
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf", 
    "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/jpg"
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("INVALID_TYPE"));
  }
};
const upload = multer({ dest: "uploads/", fileFilter });
const uploadMiddleware = upload.single("resume");

// ✅ Email config (USE ENV VARIABLES)
// ✅ Email config (Render/Gmail compatible)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Verify SMTP connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Verification Failed:", error);
  } else {
    console.log("✅ SMTP Server Ready");
  }
});

// ✅ Test route (optional but useful)
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// ✅ API
app.post("/apply", (req, res, next) => {
  console.log("--- New Application Request Started ---");
  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error("❌ Multer Error:", err.message);
      if (err.message === "INVALID_TYPE") {
        return res.status(400).send("Invalid file type. Supported types: PDF, DOC, DOCX, JPG, PNG");
      }
      return res.status(500).send("File upload error");
    }
    next();
  });
}, async (req, res) => {
  try {
    const { name, email, phone, message, job_title, jobTitle } = req.body;
    const file = req.file;
    const finalJobTitle = job_title || jobTitle || "Not Specified";

    console.log("📋 Received Fields:", { name, email, phone, job_title: finalJobTitle, message: message ? "Present" : "None" });
    console.log("📁 File Uploaded:", file ? file.filename : "None");

    // ✅ Safety check
    if (!file) {
      console.error("❌ No resume uploaded");
      return res.status(400).send("No resume uploaded");
    }

    console.log("📧 Attempting to send email...");
    await transporter.sendMail({
      from: `"Keezenix Careers" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_RECEIVER, 

      subject: `New Job Application - ${name} (${finalJobTitle})`,

      html: `
        <div style="font-family: Arial; line-height: 1.6;">
          <p>Hi Sir,</p>

          <p>You have received a new job application.</p>

          <h3>Candidate Details:</h3>
          <ul>
            <li><b>Name:</b> ${name}</li>
            <li><b>Email:</b> ${email}</li>
            <li><b>Phone:</b> ${phone}</li>
            <li><b>Job Title:</b> ${finalJobTitle}</li>
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

    // ✅ Clean up the file after successful send
    if (file && file.path) {
      fs.unlink(file.path, (e) => { 
        if (e) console.error("❌ Cleanup error:", e); 
        else console.log("🧹 Temporary file cleaned up successfully.");
      });
    }

    console.log(`✅ SUCCESS: Email sent successfully for candidate: ${email}`);
    res.send("Application sent successfully");

  } catch (err) {
    console.error(`❌ FAILURE: Error processing application for candidate: ${req.body?.email || "Unknown"}`);
    console.error(`❌ ERROR DETAILS: ${err.message}`);
    
    // ✅ Clean up the file if an error occurred during sending
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (e) => { 
        if (e) console.error("❌ Cleanup error during failure:", e);
        else console.log("🧹 Temporary file cleaned up after failure.");
      });
    }

    res.status(500).send(`Error sending application: ${err.message}`);
  }
});

// ✅ PORT FIX (required for Render)
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});