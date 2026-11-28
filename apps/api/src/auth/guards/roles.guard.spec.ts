import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma/enums.js';
import { RolesGuard } from './roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const reflectorMock = {
    getAllAndOverride: vi.fn(),
  };

  const authenticatedUser: AuthenticatedUser = {
    id: 'user-uuid-123',
    name: 'Test Admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };

  const createExecutionContext = (user?: AuthenticatedUser): ExecutionContext =>
    ({
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new RolesGuard(reflectorMock as unknown as Reflector);
  });

  it('should allow access when no roles are required', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);

    const context = createExecutionContext(authenticatedUser);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow users with the required role', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    const context = createExecutionContext(authenticatedUser);

    expect(guard.canActivate(context)).toBe(true);
    expect(reflectorMock.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('should reject users without the required role', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    const customer: AuthenticatedUser = {
      ...authenticatedUser,
      role: UserRole.CUSTOMER,
    };

    const context = createExecutionContext(customer);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should reject requests without an authenticated user', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    const context = createExecutionContext();

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
