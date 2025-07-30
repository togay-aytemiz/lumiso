import { z } from "zod";

// Input validation schemas
export const emailSchema = z
  .string()
  .email("Please enter a valid email address")
  .max(254, "Email address is too long");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  );

export const phoneSchema = z
  .string()
  .regex(/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number")
  .max(20, "Phone number is too long")
  .optional();

export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name is too long")
  .regex(/^[\p{L}\p{M}\s\-'\.]+$/u, "Name contains invalid characters");

export const notesSchema = z
  .string()
  .max(1000, "Notes are too long")
  .optional();

// Auth schemas
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required")
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

// Lead schemas
export const leadSchema = z.object({
  name: nameSchema,
  email: emailSchema.optional(),
  phone: phoneSchema,
  notes: notesSchema
});

// Session schemas
export const sessionSchema = z.object({
  session_date: z.string().min(1, "Date is required"),
  session_time: z.string().min(1, "Time is required"),
  notes: notesSchema
});

// Sanitization utility
export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, "");
};

export const sanitizeHtml = async (input: string): Promise<string> => {
  try {
    const DOMPurify = await import("dompurify");
    return DOMPurify.default.sanitize(input);
  } catch {
    // Fallback if DOMPurify fails to load
    return sanitizeInput(input);
  }
};