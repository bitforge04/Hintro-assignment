"use strict";

/**
 * Send a standardised success response.
 * @param {import("express").Response} res
 * @param {*} data
 * @param {string} traceId
 * @param {number} [status=200]
 */
function sendSuccess(res, data, traceId, status = 200) {
  return res.status(status).json({
    traceId,
    success: true,
    data,
  });
}

/**
 * Send a standardised error response.
 * @param {import("express").Response} res
 * @param {string} code
 * @param {string} message
 * @param {string} traceId
 * @param {number} [status=400]
 */
function sendError(res, code, message, traceId, status = 400) {
  return res.status(status).json({
    traceId,
    success: false,
    error: {
      code,
      message,
    },
  });
}

module.exports = { sendSuccess, sendError };
