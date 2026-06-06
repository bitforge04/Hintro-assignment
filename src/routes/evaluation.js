"use strict";

const { Router } = require("express");
const { sendSuccess } = require("../utils/response");

const router = Router();

/**
 * @swagger
 * /api/evaluation:
 *   get:
 *     summary: Evaluation metadata for submission
 *     tags: [Evaluation]
 *     responses:
 *       200:
 *         description: Evaluation info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get("/", (req, res) => {
  const traceId =
    typeof req.headers["x-trace-id"] === "string"
      ? req.headers["x-trace-id"]
      : "unknown";

  sendSuccess(
    res,
    {
      candidateName: "aryan Rana",
      email: "aryanrana21415@email.com",
      repositoryUrl: "https://github.com/bitforge04/Hintro-assignment.git",
      deployedUrl: "https://your-app.onrender.com",
      externalIntegration: "Resend Email",
      features: [
        "JWT Authentication",
        "Meeting Management",
        "AI Analysis with Citations (Groq)",
        "Action Item Tracking",
        "Overdue Detection",
        "Scheduled Reminders (node-cron)",
        "Email Integration (Resend)",
        "Swagger Documentation",
        "Structured Logging (Pino)",
        "Trace ID Middleware",
        "Centralized Error Handling",
        "Input Validation (Zod)",
      ],
    },
    traceId
  );
});

module.exports = router;
