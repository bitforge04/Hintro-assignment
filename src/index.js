"use strict";

require("dotenv").config();

const app = require("./app");
const { startReminderJob } = require("./jobs/reminderJob");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info({ message: `Meeting Intelligence Service running on port ${PORT}` });
  startReminderJob();
});
