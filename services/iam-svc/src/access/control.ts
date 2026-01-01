import { eq } from "drizzle-orm";
import type { HookEndpointContext } from "better-auth";
import db from "../db/index.js";
import { user } from "../db/schema.js";

const ROLE_SCOPES = {
  customer: [] as string[],
  operator: ["orders:write", "payments:write", "inventory:write"],
  admin: ["catalog:write", "orders:write", "payments:write", "inventory:write"],
} as const;

export type GlobalRole = keyof typeof ROLE_SCOPES;

const DEFAULT_ROLE: GlobalRole = "customer";

const parseEnvList = (value?: string | null): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
};

const adminEmails = parseEnvList(process.env.IAM_ADMIN_EMAILS);

const unique = <T>(items: T[]): T[] => {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
};

const arraysEqual = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
};

const rolesForEmail = (email?: string | null): GlobalRole[] => {
  if (!email) {
    return [DEFAULT_ROLE];
  }
  const normalized = email.trim().toLowerCase();
  if (adminEmails.includes(normalized)) {
    return ["admin"];
  }
  return [DEFAULT_ROLE];
};

const scopesForRoles = (roles: GlobalRole[]): string[] =>
  unique(roles.flatMap((role) => ROLE_SCOPES[role] ?? []));

export type AccessState = {
  roles: string[];
  scopes: string[];
};

export const loadUserAccess = async (userId: string): Promise<AccessState> => {
  const record = await db.query.user.findFirst({
    where: (users, { eq: equals }) => equals(users.id, userId),
    columns: {
      roles: true,
      scopes: true,
    },
  });

  return {
    roles: Array.isArray(record?.roles) ? (record.roles as string[]) : [],
    scopes: Array.isArray(record?.scopes) ? (record.scopes as string[]) : [],
  };
};

export const synchronizeUserAccess = async (
  userId: string,
  email?: string | null,
): Promise<AccessState> => {
  const targetRoles = rolesForEmail(email);
  const targetScopes = scopesForRoles(targetRoles);

  const current = await loadUserAccess(userId);

  if (!arraysEqual(current.roles, targetRoles) || !arraysEqual(current.scopes, targetScopes)) {
    await db
      .update(user)
      .set({
        roles: targetRoles,
        scopes: targetScopes,
      })
      .where(eq(user.id, userId));
  }

  return {
    roles: targetRoles,
    scopes: targetScopes,
  };
};

export const applyAccessToSession = (ctx: HookEndpointContext, access: AccessState): void => {
  if (ctx.context.session?.user) {
    Object.assign(ctx.context.session.user, {
      roles: access.roles,
      scopes: access.scopes,
    });
  }
  if (ctx.context.newSession?.user) {
    Object.assign(ctx.context.newSession.user, {
      roles: access.roles,
      scopes: access.scopes,
    });
  }
};
