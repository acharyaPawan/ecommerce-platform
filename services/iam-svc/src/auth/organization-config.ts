import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * Shared access control definition for every organization in the ecommerce stack.
 * We extend the default organization statements with the ecommerce concepts we care about.
 */
const statements = {
  ...defaultStatements,
  catalog: ["read", "write"],
  order: ["create", "update", "fulfill"],
  payment: ["capture", "refund"],
  customer: ["read", "update"],
} as const;

export const ecommerceOrgAccessControl = createAccessControl(statements);

const catalogReadWrite = {
  catalog: ["read", "write"] as ["read", "write"],
};
const fullOrderAccess = {
  order: ["create", "update", "fulfill"] as ["create", "update", "fulfill"],
};
const fullCustomerAccess = {
  customer: ["read", "update"] as ["read", "update"],
};

export const customerRole = ecommerceOrgAccessControl.newRole({
  catalog: ["read"],
  order: ["create"],
});

export const operatorRole = ecommerceOrgAccessControl.newRole({
  ...memberAc.statements,
  ...catalogReadWrite,
  ...fullOrderAccess,
  payment: ["capture"],
  customer: ["read"],
});

export const adminRole = ecommerceOrgAccessControl.newRole({
  ...adminAc.statements,
  ...catalogReadWrite,
  ...fullOrderAccess,
  payment: ["capture", "refund"],
  ...fullCustomerAccess,
});

export const ownerRole = ecommerceOrgAccessControl.newRole({
  ...ownerAc.statements,
  ...catalogReadWrite,
  ...fullOrderAccess,
  payment: ["capture", "refund"],
  ...fullCustomerAccess,
});

export const organizationRoles = {
  owner: ownerRole,
  admin: adminRole,
  operator: operatorRole,
  customer: customerRole,
};

export type OrganizationRoleName = keyof typeof organizationRoles;

const PRIVILEGED_ACCOUNT_ROLES = ["owner", "admin", "operator"] as const;

export const hasPrivilegedAccountRole = (roles?: string[]): boolean => {
  if (!Array.isArray(roles)) {
    return false;
  }
  return roles.some((role) =>
    PRIVILEGED_ACCOUNT_ROLES.includes(role as (typeof PRIVILEGED_ACCOUNT_ROLES)[number]),
  );
};

export const resolveDefaultOrganizationRole = (roles?: string[]): OrganizationRoleName => {
  if (!Array.isArray(roles)) {
    return "customer";
  }
  if (roles.includes("admin")) {
    return "admin";
  }
  if (roles.includes("operator")) {
    return "operator";
  }
  return "customer";
};
