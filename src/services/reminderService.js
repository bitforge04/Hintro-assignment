"use strict";

const { Resend } = require("resend");
const { PrismaClient } = require("@prisma/client");
const logger = require("../utils/logger");

const resend = new Resend(process.env.RESEND_API_KEY);
const prisma = new PrismaClient();

/**
 * Send a reminder email for an overdue action item and log it.
 * @param {object} actionItem - Prisma ActionItem record
 */
async function sendReminder(actionItem) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: actionItem.assignee,
      subject: `Reminder: ${actionItem.task}`,
      html: `<h2>Action Item Reminder</h2>
<p><strong>Task:</strong> ${actionItem.task}</p>
<p><strong>Assigned To:</strong> ${actionItem.assignee}</p>
<p><strong>Due Date:</strong> ${actionItem.dueDate ? new Date(actionItem.dueDate).toISOString() : "Not set"}</p>
<p><strong>Status:</strong> ${actionItem.status}</p>`,
    });

    if (error) {
      logger.error({
        message: "Failed to send reminder email via Resend",
        actionItemId: actionItem.id,
        resendError: error.message,
      });
      return;
    }

    await prisma.reminderLog.create({
      data: {
        actionItemId: actionItem.id,
        channel: "email",
      },
    });

    logger.info({
      message: "Reminder email sent successfully",
      actionItemId: actionItem.id,
      emailId: data?.id,
      to: actionItem.assignee,
    });
  } catch (err) {
    logger.error({
      message: "Unexpected error sending reminder",
      actionItemId: actionItem.id,
      error: err.message,
    });
  }
}

module.exports = { sendReminder };
