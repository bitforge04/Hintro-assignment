"use strict";

const { Router } = require("express");
const { z } = require("zod");
const { PrismaClient } = require("@prisma/client");
const { authMiddleware } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { sendSuccess, sendError } = require("../utils/response");
const { analyzeMeeting } = require("../services/aiService");

const router = Router();
const prisma = new PrismaClient();

const createMeetingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  participants: z
    .array(z.string().email("Each participant must be a valid email"))
    .min(1, "At least one participant is required"),
  meetingDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "meetingDate must be a valid ISO date string",
  }),
  transcript: z.array(
    z.object({
      timestamp: z.string().min(1, "Timestamp is required"),
      speaker: z.string().min(1, "Speaker is required"),
      text: z.string().min(1, "Text is required"),
    })
  ),
});

/**
 * @swagger
 * /api/meetings:
 *   post:
 *     summary: Create a new meeting with transcript
 *     tags: [Meetings]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - participants
 *               - meetingDate
 *               - transcript
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Q4 Planning"
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 example: ["alice@example.com", "bob@example.com"]
 *               meetingDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T10:00:00Z"
 *               transcript:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       example: "00:10"
 *                     speaker:
 *                       type: string
 *                       example: "Alice"
 *                     text:
 *                       type: string
 *                       example: "Let's discuss the roadmap."
 *     responses:
 *       201:
 *         description: Meeting created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/", authMiddleware, validate(createMeetingSchema), async (req, res, next) => {
  const traceId =
    typeof req.headers["x-trace-id"] === "string"
      ? req.headers["x-trace-id"]
      : "unknown";

  try {
    const { title, participants, meetingDate, transcript } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.create({
        data: {
          title,
          participants: JSON.stringify(participants),
          meetingDate: new Date(meetingDate),
        },
      });

      const entries = await Promise.all(
        transcript.map((entry) =>
          tx.transcriptEntry.create({
            data: {
              timestamp: entry.timestamp,
              speaker: entry.speaker,
              text: entry.text,
              meetingId: meeting.id,
            },
          })
        )
      );

      return { meeting, entries };
    });

    sendSuccess(
      res,
      {
        ...result.meeting,
        participants: JSON.parse(result.meeting.participants),
        transcript: result.entries,
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
 * /api/meetings:
 *   get:
 *     summary: List all meetings (paginated)
 *     tags: [Meetings]
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *         description: Paginated list of meetings
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

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        skip,
        take: limit,
        orderBy: { meetingDate: "desc" },
        select: {
          id: true,
          title: true,
          participants: true,
          meetingDate: true,
          createdAt: true,
        },
      }),
      prisma.meeting.count(),
    ]);

    const formatted = meetings.map((m) => {
      const parsed = JSON.parse(m.participants);
      return {
        ...m,
        participants: parsed,
        participantCount: parsed.length,
      };
    });

    sendSuccess(res, { meetings: formatted, total, page, limit }, traceId);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/meetings/{id}:
 *   get:
 *     summary: Get a single meeting with transcript and analysis
 *     tags: [Meetings]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting details
 *       404:
 *         description: Meeting not found
 *       401:
 *         description: Unauthorized
 */
router.get("/:id", authMiddleware, async (req, res, next) => {
  const traceId =
    typeof req.headers["x-trace-id"] === "string"
      ? req.headers["x-trace-id"]
      : "unknown";

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.id },
      include: {
        transcript: true,
        analysis: true,
      },
    });

    if (!meeting) {
      sendError(res, "NOT_FOUND", "Meeting not found", traceId, 404);
      return;
    }

    const formatted = {
      ...meeting,
      participants: JSON.parse(meeting.participants),
      analysis: meeting.analysis
        ? {
            ...meeting.analysis,
            summary: JSON.parse(meeting.analysis.summary),
            actionItems: JSON.parse(meeting.analysis.actionItems),
            decisions: JSON.parse(meeting.analysis.decisions),
            followUps: JSON.parse(meeting.analysis.followUps),
          }
        : null,
    };

    sendSuccess(res, formatted, traceId);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/meetings/{id}/analyze:
 *   post:
 *     summary: Analyse a meeting transcript with AI
 *     tags: [Meetings]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analysis result
 *       404:
 *         description: Meeting not found
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/analyze", authMiddleware, async (req, res, next) => {
  const traceId =
    typeof req.headers["x-trace-id"] === "string"
      ? req.headers["x-trace-id"]
      : "unknown";

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.id },
      include: { transcript: true },
    });

    if (!meeting) {
      sendError(res, "NOT_FOUND", "Meeting not found", traceId, 404);
      return;
    }

    const analysisResult = await analyzeMeeting(meeting.transcript);

    const analysis = await prisma.meetingAnalysis.upsert({
      where: { meetingId: meeting.id },
      update: {
        summary: JSON.stringify(analysisResult.summary),
        actionItems: JSON.stringify(analysisResult.actionItems),
        decisions: JSON.stringify(analysisResult.decisions),
        followUps: JSON.stringify(analysisResult.followUps),
      },
      create: {
        meetingId: meeting.id,
        summary: JSON.stringify(analysisResult.summary),
        actionItems: JSON.stringify(analysisResult.actionItems),
        decisions: JSON.stringify(analysisResult.decisions),
        followUps: JSON.stringify(analysisResult.followUps),
      },
    });

    sendSuccess(
      res,
      {
        ...analysis,
        summary: JSON.parse(analysis.summary),
        actionItems: JSON.parse(analysis.actionItems),
        decisions: JSON.parse(analysis.decisions),
        followUps: JSON.parse(analysis.followUps),
      },
      traceId
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
