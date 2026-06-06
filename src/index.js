"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pinoHttp = require("pino-http");
const swaggerUi = require("swagger-ui-express");

const { traceIdMiddleware } = require("./middleware/traceId");
const { errorHandler } = require("./middleware/errorHandler");
const { swaggerSpec } = require("./swagger/config");
const { startReminderJob, processReminders } = require("./jobs/reminderJob");
const logger = require("./utils/logger");

const authRouter = require("./routes/auth");
const meetingsRouter = require("./routes/meetings");
const actionItemsRouter = require("./routes/actionItems");
const evaluationRouter = require("./routes/evaluation");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(traceIdMiddleware);

// Structured HTTP request/response logging
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({
      traceId: req.headers["x-trace-id"] || "unknown",
    }),
    customLogLevel: (_req, res) => {
      if (res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} - ${res.statusCode}`,
    customErrorMessage: (req, res) =>
      `${req.method} ${req.url} - ${res.statusCode}`,
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/meetings", meetingsRouter);
app.use("/api/action-items", actionItemsRouter);
app.use("/api/evaluation", evaluationRouter);

// Swagger docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check – no auth, no traceId wrapper
app.get("/health", (_req, res) => {
  res.json({ status: "UP" });
});

// Manual reminder trigger – for testing only
app.post("/api/test/trigger-reminders", async (req, res, next) => {
  try {
    await processReminders();
    res.json({ success: true, message: "Reminder job triggered manually" });
  } catch (err) {
    next(err);
  }
});

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info({ message: `Meeting Intelligence Service running on port ${PORT}` });
  startReminderJob();
});

module.exports = app;
