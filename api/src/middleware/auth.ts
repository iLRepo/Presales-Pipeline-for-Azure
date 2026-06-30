import { HttpRequest, InvocationContext } from "@azure/functions";

export interface AuthUser {
  oid: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest {
  user: AuthUser;
}

export async function requireAuth(
  _req: HttpRequest,
  _context: InvocationContext
): Promise<AuthUser> {
  return {
    oid: "anonymous",
    email: "anonymous@app",
    name: "Anonymous User",
  };
}
