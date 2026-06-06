"use strict";

const { v4: uuidv4 } = require("uuid");

/**
 * Attaches a trace ID to every request/response.
 * Uses x-trace-id header if present, otherwise generates a new uuid v4.
 */
function traceIdMiddleware(req, res, next) {
  const existing = req.headers["x-trace-id"];
  const traceId =
    typeof existing === "string" && existing.length > 0 ? existing : uuidv4();

  req.headers["x-trace-id"] = traceId;
  res.setHeader("x-trace-id", traceId);
  next();
}

module.exports = { traceIdMiddleware };
