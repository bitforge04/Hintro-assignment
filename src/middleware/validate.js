"use strict";

const { sendError } = require("../utils/response");

/**
 * Returns an Express middleware that validates req.body against a Zod schema.
 * @param {import("zod").ZodSchema} schema
 */
function validate(schema) {
  return (req, res, next) => {
    const traceId =
      typeof req.headers["x-trace-id"] === "string"
        ? req.headers["x-trace-id"]
        : "unknown";

    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");

      sendError(res, "VALIDATION_ERROR", message, traceId, 400);
      return;
    }

    req.body = result.data;
    next();
  };
}

module.exports = { validate };
