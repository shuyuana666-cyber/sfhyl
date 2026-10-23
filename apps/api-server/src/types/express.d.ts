import type { AuthenticatedUser } from '../common/interfaces/authenticated-user';

declare global {
  namespace Express {
    // Passport requires an interface for declaration merging.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthenticatedUser {}

    interface Request {
      requestId: string;
      startedAt: number;
    }
  }
}

export {};
