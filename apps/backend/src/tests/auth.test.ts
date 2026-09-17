// ============================================================
// Auth & Security Unit Tests
// ============================================================
import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

describe('Auth & Password Security', () => {
  it('hashes passwords securely using bcrypt with appropriate salt rounds', async () => {
    const password = 'UltraSecurePassword123!';
    const hash = await bcrypt.hash(password, 10);

    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2')).toBe(true);

    const match = await bcrypt.compare(password, hash);
    expect(match).toBe(true);

    const wrongMatch = await bcrypt.compare('WrongPassword', hash);
    expect(wrongMatch).toBe(false);
  });

  it('validates user registration schema rigorously', () => {
    const RegisterSchema = z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    });

    // Valid
    const valid = RegisterSchema.safeParse({
      email: 'trader@example.com',
      password: 'password123',
    });
    expect(valid.success).toBe(true);

    // Invalid email
    const invalidEmail = RegisterSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(invalidEmail.success).toBe(false);

    // Short password
    const shortPassword = RegisterSchema.safeParse({
      email: 'trader@example.com',
      password: 'short',
    });
    expect(shortPassword.success).toBe(false);
  });
});
