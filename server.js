require("dotenv").config();
const dns = require("dns");

// ✅ Force IPv4 DNS resolution first to prevent ENETUNREACH errors on hosts without IPv6 routing (e.g. Render)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
  console.log("Node Version:", process.version);

  dns.lookup("smtp.gmail.com", { all: true }, (err, addresses) => {
    console.log("SMTP DNS Results:", addresses);
  });
}
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const cors = require("cors");

const app = express();

// ✅ CORS (important for frontend)
const allowedOrigin = process.env.CORS_ORIGIN || "*";
// Also allow www variant automatically
const allowedOrigins = new Set([
  allowedOrigin,
  allowedOrigin.replace("https://", "https://www."),
  allowedOrigin.replace("https://www.", "https://"),
].filter(Boolean));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin || allowedOrigin === "*") {
      return callback(null, true);
    }
    // Allow local development origins
    const isLocalhost = origin.startsWith("http://localhost:") || 
                        origin.startsWith("https://localhost:") || 
                        origin.startsWith("http://127.0.0.1:") || 
                        origin.startsWith("https://127.0.0.1:");
    if (isLocalhost || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  }
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

    console.log("📧 Reading resume file for EmailJS multipart upload...");
    const fileBuffer = await fs.promises.readFile(file.path);
    const fileObj = new File([fileBuffer], file.originalname, { type: file.mimetype });

    const formData = new FormData();
    formData.append("service_id", process.env.EMAILJS_SERVICE_ID);
    formData.append("template_id", process.env.EMAILJS_TEMPLATE_ID);
    formData.append("user_id", process.env.EMAILJS_PUBLIC_KEY);
    if (process.env.EMAILJS_PRIVATE_KEY) {
      formData.append("accessToken", process.env.EMAILJS_PRIVATE_KEY);
    }
    formData.append("name", name);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("job_title", finalJobTitle);
    formData.append("message", message || "No message provided");
    formData.append("resume", fileObj);

    console.log("📧 Attempting to send email via EmailJS (send-form)...");
    const emailjsResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send-form", {
      method: "POST",
      body: formData,
    });

    if (!emailjsResponse.ok) {
      const errorText = await emailjsResponse.text();
      throw new Error(`EmailJS failed with status ${emailjsResponse.status}: ${errorText}`);
    }

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