import { HttpRequest, InvocationContext } from "@azure/functions";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

export interface AuthUser {
  oid: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest {
  user: AuthUser;
}

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  rateLimit: true,
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key?.getPublicKey());
  });
}

function verifyToken(token: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.AZURE_CLIENT_ID,
        issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
        algorithms: ["RS256"],
      },
      (err, decoded) => {
        if (err) return reject(err);
        const payload = decoded as Record<string, unknown>;
        resolve({
          oid: (payload.oid as string) || "",
          email:
            (payload.preferred_username as string) ||
            (payload.email as string) ||
            "",
          name: (payload.name as string) || "",
        });
      }
    );
  });
}

export async function requireAuth(
  req: HttpRequest,
  _context: InvocationContext
): Promise<AuthUser | null> {
  if (process.env.BYPASS_AUTH === "true") {
    return {
      oid: "dev-user-oid",
      email: "dev@localhost",
      name: "Dev User",
    };
  }

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  try {
    return await verifyToken(header.slice(7));
  } catch {
    return null;
  }
}
