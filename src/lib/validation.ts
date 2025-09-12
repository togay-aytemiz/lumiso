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

// Team management validation schemas
export const roleNameSchema = z
  .string()
  .min(2, "Role name must be at least 2 characters")
  .max(50, "Role name is too long")
  .regex(/^[a-zA-Z0-9\s\-_]+$/, "Role name contains invalid characters");

export const roleDescriptionSchema = z
  .string()
  .max(200, "Role description is too long")
  .optional();

export const systemRoleSchema = z.enum(['Owner', 'Member'], {
  message: "Invalid system role"
});

export const invitationSchema = z.object({
  email: emailSchema,
  role: systemRoleSchema
});

export const customRoleSchema = z.object({
  name: roleNameSchema,
  description: roleDescriptionSchema,
  permissions: z.array(z.string().uuid()).min(1, "At least one permission is required")
});

// Team management validation functions
export function validateEmail(email: string): boolean {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
}

export function validateRoleName(name: string): boolean {
  try {
    roleNameSchema.parse(name);
    return true;
  } catch {
    return false;
  }
}

export function validateInvitation(data: { email: string; role: string }): boolean {
  try {
    invitationSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

export function validateCustomRole(data: { name: string; description?: string; permissions: string[] }): boolean {
  try {
    customRoleSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

// Rate limiting validation
export function validateRateLimit(count: number, limit: number, windowMs: number, lastReset: number): boolean {
  const now = Date.now();
  
  // Reset window if expired
  if (now - lastReset > windowMs) {
    return true;
  }
  
  return count < limit;
}

// Assignment validation
export function validateAssignees(assignees: string[]): boolean {
  if (!Array.isArray(assignees)) return false;
  
  // Check if all assignees are valid UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return assignees.every(id => uuidRegex.test(id));
}

// Bulk operation validation
export function validateBulkInvitations(invitations: Array<{ email: string; role: string }>): {
  valid: Array<{ email: string; role: string }>;
  invalid: Array<{ email: string; role: string; error: string }>;
} {
  const valid: Array<{ email: string; role: string }> = [];
  const invalid: Array<{ email: string; role: string; error: string }> = [];
  
  invitations.forEach(invitation => {
    try {
      invitationSchema.parse(invitation);
      valid.push(invitation);
    } catch (error) {
      invalid.push({
        ...invitation,
        error: error instanceof z.ZodError ? error.issues[0].message : 'Invalid invitation'
      });
    }
  });
  
  return { valid, invalid };
}

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