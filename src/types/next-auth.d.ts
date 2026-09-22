import type { UserRole } from '@prisma/client';
import 'next-auth';
import 'next-auth/jwt';

// Module augmentation so `session.user.id` / `.role` are typed everywhere,
// instead of every call site casting `session.user as any`.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      name?: string | null;
      email?: string | null;
    };
  }

  interface User {
    id: string;
    role: UserRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
