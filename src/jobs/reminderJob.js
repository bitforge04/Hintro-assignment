"use strict";

const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");
const { sendReminder } = require("../services/reminderService");
const logger = require("../utils/logger");

const prisma = new PrismaClient();

async function processReminders() {
  const now = new Date();
  const cooldownHours = 24;
  const cooldownCutoff = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000);

  const overdueItems = await prisma.actionItem.findMany({
    where: {
      status: { not: "COMPLETED" },
      dueDate: {
        not: null,
        lt: now,
      },
    },
    include: {
      reminders: {
        orderBy: { sentAt: "desc" },
        take: 1,
      },
    },
  });

  let sentCount = 0;
  let skippedCount = 0;

  for (const item of overdueItems) {
    const lastReminder = item.reminders[0];

    // Skip if a reminder was already sent within the cooldown window
    if (lastReminder && lastReminder.sentAt > cooldownCutoff) {
      skippedCount++;
      continue;
    }

    await sendReminder(item);
    sentCount++;
  }

  logger.info({
    message: "Reminder job completed",
    remindersSent: sentCount,
    skippedDueToCooldown: skippedCount,
    timestamp: now.toISOString(),
  });
}

/**
 * Register the hourly reminder cron job.
 * Called once at server startup from src/index.js.
 */
function startReminderJob() {
  cron.schedule("0 * * * *", async () => {
    logger.info({ message: "Starting scheduled reminder job" });
    try {
      await processReminders();
    } catch (err) {
      logger.error({
        message: "Reminder job encountered an error",
        error: err.message,
      });
    }
  });

  logger.info({ message: "Reminder cron job registered (runs every hour on the hour)" });
}

module.exports = { startReminderJob, processReminders };
