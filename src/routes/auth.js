"use strict";

const { Router } = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { PrismaClient } = require("@prisma/client");
const { validate } = require("../middleware/validate");
const { sendSuccess, sendError } = require("../utils/response");

const router = Router();
const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z.string().min(1, "Password is required"),
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: secret123
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       409:
 *         description: Email already registered
 *       400:
 *         description: Validation error
 */
router.post("/register", validate(registerSchema), async (req, res, next) => {
  const traceId =
    typeof req.headers["x-trace-id"] === "string"
      ? req.headers["x-trace-id"]
      : "unknown";

  try {
    const { email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      sendError(res, "CONFLICT", "Email is already registered", traceId, 409);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash } });

    sendSuccess(res, { id: user.id, email: user.email }, traceId, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login and receive a JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", validate(loginSchema), async (req, res, next) => {
  const traceId =
    typeof req.headers["x-trace-id"] === "string"
      ? req.headers["x-trace-id"]
      : "unknown";

  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      sendError(res, "UNAUTHORIZED", "Invalid email or password", traceId, 401);
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      sendError(res, "UNAUTHORIZED", "Invalid email or password", traceId, 401);
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      sendError(res, "INTERNAL_ERROR", "JWT secret not configured", traceId, 500);
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, secret, {
      expiresIn: "7d",
    });

    sendSuccess(res, { token }, traceId);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
