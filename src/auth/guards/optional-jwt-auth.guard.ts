import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT auth guard.
 *
 * - If a valid `Authorization: Bearer <token>` header is present, the user
 *   payload is attached to `request.user` (same shape as the standard
 *   `AuthGuard('jwt')`).
 * - If the header is missing or the token is invalid/expired, the request
 *   is still allowed through and `request.user` stays `undefined`.
 *
 * Useful for endpoints that are publicly accessible but want to reveal
 * additional data (e.g. unpublished items) when called by an authenticated
 * admin.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Always allow the request to proceed; defer to passport for token parsing.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Run the underlying passport-jwt logic. It populates request.user when
      // the token is valid; it throws when the token is missing/invalid.
      await super.canActivate(context);
    } catch {
      // Swallow auth errors — the route is optional-auth.
    }
    return true;
  }

  // Override to prevent passport from throwing on missing/invalid token.
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return user as TUser;
  }
}
