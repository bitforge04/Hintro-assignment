"use strict";

const jwt = require("jsonwebtoken");
const { sendError } = require("../utils/response");

/**
 * Verifies Bearer JWT and attaches decoded payload to req.user.
 */
function authMiddleware(req, res, next) {
  const traceId =
    typeof req.headers["x-trace-id"] === "string"
      ? req.headers["x-trace-id"]
      : "unknown";

  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, "UNAUTHORIZED", "Missing or invalid authorization header", traceId, 401);
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    sendError(res, "INTERNAL_ERROR", "JWT secret not configured", traceId, 500);
    return;
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch {
    sendError(res, "UNAUTHORIZED", "Invalid or expired token", traceId, 401);
  }
}

module.exports = { authMiddleware };
