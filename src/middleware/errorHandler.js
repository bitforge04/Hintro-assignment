"use strict";

const logger = require("../utils/logger");
const { sendError } = require("../utils/response");

/**
 * Central error-handling middleware.
 * Must be registered LAST in Express.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const traceId =
    typeof req.headers["x-trace-id"] === "string"
      ? req.headers["x-trace-id"]
      : "unknown";

  logger.error({
    traceId,
    message: err.message,
    path: req.path,
    stack: err.stack,
  });

  sendError(res, "INTERNAL_ERROR", "An unexpected error occurred", traceId, 500);
}

module.exports = { errorHandler };
