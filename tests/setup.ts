import { vi } from 'vitest';

// Mock Prisma client for unit tests
vi.mock('../app/db.server', () => ({
  default: {
    bundle: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// Global test timeout
vi.setConfig({
  testTimeout: 10000,
});
