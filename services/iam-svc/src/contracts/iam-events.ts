import { randomUUID } from "node:crypto";

export enum IamEventType {
  UserRegisteredV1 = "iam.user.registered.v1",
  UserEmailVerifiedV1 = "iam.user.email_verified.v1",
  UserProfileUpdatedV1 = "iam.user.profile_updated.v1",
  UserSignedInV1 = "iam.user.signed_in.v1",
  UserSignedOutV1 = "iam.user.signed_out.v1",
  OrganizationInvitationCreatedV1 = "iam.organization.invitation_created.v1",
}

export type IamEnvelope<TType extends IamEventType, TPayload> = {
  id: string;
  type: TType;
  aggregateType: "user";
  aggregateId: string;
  occurredAt: string;
  version: 1;
  correlationId?: string;
  causationId?: string;
  payload: TPayload;
};

export type UserRegisteredV1 = IamEnvelope<
  IamEventType.UserRegisteredV1,
  {
    userId: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
  }
>;

export type UserEmailVerifiedV1 = IamEnvelope<
  IamEventType.UserEmailVerifiedV1,
  {
    userId: string;
    verifiedAt: string;
  }
>;

export type UserProfileUpdatedV1 = IamEnvelope<
  IamEventType.UserProfileUpdatedV1,
  {
    userId: string;
    name?: string | null;
    avatarUrl?: string | null;
    updatedAt: string;
  }
>;

export type UserSignedInV1 = IamEnvelope<
  IamEventType.UserSignedInV1,
  {
    userId: string;
    occurredAt: string;
  }
>;

export type UserSignedOutV1 = IamEnvelope<
  IamEventType.UserSignedOutV1,
  {
    userId: string;
    occurredAt: string;
  }
>;

export type OrganizationInvitationCreatedV1 = IamEnvelope<
  IamEventType.OrganizationInvitationCreatedV1,
  {
    invitationId: string;
    email: string;
    inviteLink: string;
    organization: {
      id: string;
      name: string;
      slug?: string | null;
      logo?: string | null;
    };
    inviter: {
      id: string;
      email: string;
      name?: string | null;
    };
    expiresAt?: string | null;
  }
>;

export type AnyIamEvent =
  | UserRegisteredV1
  | UserEmailVerifiedV1
  | UserProfileUpdatedV1
  | UserSignedInV1
  | UserSignedOutV1
  | OrganizationInvitationCreatedV1;

export function makeIamEnvelope<TType extends IamEventType, TPayload>(args: {
  type: TType;
  aggregateId: string;
  payload: TPayload;
  correlationId?: string;
  causationId?: string;
}): IamEnvelope<TType, TPayload> {
  return {
    id: randomUUID(),
    type: args.type,
    aggregateType: "user",
    aggregateId: args.aggregateId,
    occurredAt: new Date().toISOString(),
    version: 1,
    correlationId: args.correlationId,
    causationId: args.causationId,
    payload: args.payload,
  };
}
