-- Fix authentication security configuration
-- Set OTP expiry to recommended 10 minutes (600 seconds)
UPDATE auth.config SET 
  otp_exp = 600,
  enable_leaked_password_protection = true
WHERE true;