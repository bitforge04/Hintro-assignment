"use strict";

const { Router } = require("express");
const { z } = require("zod");
const { PrismaClient } = require("@prisma/client");
const { authMiddleware } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { sendSuccess, sendError } = require("../utils/response");

const router = Router();
const prisma = new PrismaClient();

const statusEnum = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]);

const createActionItemSchema = z.object({
  task: z.string().min(1, "Task is required"),
  assignee: z.string().min(1, "Assignee is required"),
  status: statusEnum.default("PENDING"),
  dueDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "dueDate must be a valid ISO date string",
    }),
  meetingId: z.string().optional(),
  citations: z
    .array(z.object({ timestamp: z.string().min(1) }))
    .optional(),
});

const updateStatusSchema = z.object({
  status: statusEnum,
});

/**
 * @swagger
 * /api/action-items:
 *   post:
 *     summary: Create a new action item
 *     tags: [Action Items]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - task
 *               - assignee
 *             properties:
 *               task:
 *                 type: string
 *                 example: "Write unit tests"
 *               assignee:
 *                 type: string
 *                 example: "alice@example.com"
 *               status:
 *                 type: string
 *                 enum: [PENDING, IN_PROGRESS, COMPLETED]
 *                 default: PENDING
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-02-01T00:00:00Z"
 *               meetingId:
 *                 type: string
 *               citations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *     responses:
 *       201:
 *         description: Action item created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/", authMiddleware, validate(createActionItemSchema), async (req, res, next) => {
  const traceId =
    typeof req.headers["x-trace-id"] === "string"
      ? req.headers["x-trace-id"]
      : "unknown";

  try {
    const { task, assignee, status, dueDate, meetingId, citations } = req.body;

    // If meetingId provided, verify the meeting actually exists
    if (meetingId) {
      const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting) {
        sendError(res, "NOT_FOUND", "Meeting not found with the provided meetingId", traceId, 404);
        return;
      }
    }

    const actionItem = await prisma.actionItem.create({
      data: {
        task,
        assignee,
        status,
        dueDate: dueDate ? new Date(dueDate) : null,
        meetingId: meetingId || null,
        citations: JSON.stringify(citations ?? []),
      },
    });

    sendSuccess(
      res,
      {
        ...actionItem,
        citations: JSON.parse(actionItem.citations),
      },
      traceId,
      201
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/action-items/{id}/status:
 *   patch:
 *     summary: Update the status of an action item
 *     tags: [Action Items]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, IN_PROGRESS, COMPLETED]
 *     responses:
 *       200:
 *         description: Status updated
 *       404:
 *         description: Action item not found
 *       401:
 *         description: Unauthorized
 */
router.patch("/:id/status", authMiddleware, validate(updateStatusSchema), async (req, res, next) => {
  const traceId =
    typeof req.headers["x-trace-id"] === "string"
      ? req.headers["x-trace-id"]
      : "unknown";

  try {
    const existing = await prisma.actionItem.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      sendError(res, "NOT_FOUND", "Action item not found", traceId, 404);
      return;
    }

    const updated = await prisma.actionItem.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
    });

    sendSuccess(
      res,
      { ...updated, citations: JSON.parse(updated.citations) },
      traceId
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/action-items:
 *   get:
 *     summary: List action items with optional filters (paginated)
 *     tags: [Action Items]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, COMPLETED]
 *       - in: query
 *         name: assignee
 *         schema:
 *           type: string
 *       - in: query
 *         name: meetingId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated action items
 *       401:
 *         description: Unauthorized
 */
router.get("/", authMiddleware, async (req, res, next) => {
  const traceId =
    typeof req.headers["x-trace-id"] === "string"
      ? req.headers["x-trace-id"]
      : "unknown";

  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const where = {};

    if (req.query.status) {
      where.status = req.query.status;
    }

    if (req.query.assignee) {
      where.assignee = {
        contains: req.query.assignee,
      };
    }

    if (req.query.meetingId) {
      where.meetingId = req.query.meetingId;
    }

    const [actionItems, total] = await Promise.all([
      prisma.actionItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.actionItem.count({ where }),
    ]);

    const formatted = actionItems.map((item) => ({
      ...item,
      citations: JSON.parse(item.citations),
    }));

    sendSuccess(res, { actionItems: formatted, total, page, limit }, traceId);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/action-items/overdue:
 *   get:
 *     summary: Get all overdue action items
 *     tags: [Action Items]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of overdue action items
 *       401:
 *         description: Unauthorized
 */
router.get("/overdue", authMiddleware, async (req, res, next) => {
  const traceId =
    typeof req.headers["x-trace-id"] === "string"
      ? req.headers["x-trace-id"]
      : "unknown";

  try {
    const now = new Date();

    const overdueItems = await prisma.actionItem.findMany({
      where: {
        status: { not: "COMPLETED" },
        dueDate: {
          not: null,
          lt: now,
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const formatted = overdueItems.map((item) => ({
      ...item,
      citations: JSON.parse(item.citations),
    }));

    sendSuccess(res, { actionItems: formatted }, traceId);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
