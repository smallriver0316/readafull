import type {
  CdkCustomResourceEvent,
  CdkCustomResourceResponse,
} from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import {
  CognitoIdentityProviderClient,
  CreateIdentityProviderCommand,
  DeleteIdentityProviderCommand,
  DescribeIdentityProviderCommand,
  type IdentityProviderTypeType,
  UpdateIdentityProviderCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const region = process.env.AWS_REGION ?? 'ap-northeast-1';

let ssmClient: SSMClient | undefined;
let cognitoClient: CognitoIdentityProviderClient | undefined;

const getSsm = (): SSMClient => (ssmClient ??= new SSMClient({ region }));
const getCognito = (): CognitoIdentityProviderClient =>
  (cognitoClient ??= new CognitoIdentityProviderClient({ region }));

/**
 * Properties passed from the AuthStack CustomResource. Secret credentials are
 * referenced by SSM parameter *name* only — the decrypted values never appear
 * in the CloudFormation template or stack events; they are fetched at deploy
 * time inside this Lambda with `WithDecryption: true`.
 */
interface ResourceProperties {
  ServiceToken: string;
  UserPoolId: string;
  ProviderName: string;
  ProviderType: string;
  /** ProviderDetails key -> SSM parameter name (fetched with decryption). */
  SecretParameterNames?: Record<string, string>;
  /** Literal ProviderDetails fields, e.g. `{ authorize_scopes: 'openid email' }`. */
  StaticProviderDetails?: Record<string, string>;
  AttributeMapping?: Record<string, string>;
}

const errorName = (error: unknown): string | undefined =>
  (error as { name?: string } | undefined)?.name;

const buildProviderDetails = async (
  props: ResourceProperties
): Promise<Record<string, string>> => {
  const details: Record<string, string> = { ...(props.StaticProviderDetails ?? {}) };
  const secretParameters = props.SecretParameterNames ?? {};

  await Promise.all(
    Object.entries(secretParameters).map(async ([detailKey, parameterName]) => {
      const result = await getSsm().send(
        new GetParameterCommand({ Name: parameterName, WithDecryption: true })
      );
      const value = result.Parameter?.Value;
      if (!value) {
        throw new Error(`SSM parameter ${parameterName} is empty or missing`);
      }
      details[detailKey] = value;
    })
  );

  return details;
};

const physicalResourceId = (props: ResourceProperties): string =>
  `${props.UserPoolId}:${props.ProviderName}`;

const providerExists = async (props: ResourceProperties): Promise<boolean> => {
  try {
    await getCognito().send(
      new DescribeIdentityProviderCommand({
        UserPoolId: props.UserPoolId,
        ProviderName: props.ProviderName,
      })
    );
    return true;
  } catch (error) {
    if (errorName(error) === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
};

// Create or update the identity provider so deploys always reflect the latest
// credentials. Describe-then-write makes the operation idempotent even when an
// earlier deploy partially succeeded.
const upsertProvider = async (props: ResourceProperties): Promise<void> => {
  const providerDetails = await buildProviderDetails(props);

  if (await providerExists(props)) {
    await getCognito().send(
      new UpdateIdentityProviderCommand({
        UserPoolId: props.UserPoolId,
        ProviderName: props.ProviderName,
        ProviderDetails: providerDetails,
        AttributeMapping: props.AttributeMapping,
      })
    );
    return;
  }

  await getCognito().send(
    new CreateIdentityProviderCommand({
      UserPoolId: props.UserPoolId,
      ProviderName: props.ProviderName,
      ProviderType: props.ProviderType as IdentityProviderTypeType,
      ProviderDetails: providerDetails,
      AttributeMapping: props.AttributeMapping,
    })
  );
};

const deleteProvider = async (props: ResourceProperties): Promise<void> => {
  try {
    await getCognito().send(
      new DeleteIdentityProviderCommand({
        UserPoolId: props.UserPoolId,
        ProviderName: props.ProviderName,
      })
    );
  } catch (error) {
    // The provider (or the whole user pool) may already be gone when the stack
    // is being torn down — treat deletion as idempotent.
    if (errorName(error) === 'ResourceNotFoundException') {
      return;
    }
    throw error;
  }
};

export const handler = async (
  event: CdkCustomResourceEvent
): Promise<CdkCustomResourceResponse> => {
  const props = event.ResourceProperties as unknown as ResourceProperties;

  switch (event.RequestType) {
    case 'Create':
    case 'Update':
      await upsertProvider(props);
      return { PhysicalResourceId: physicalResourceId(props) };
    case 'Delete':
      await deleteProvider(props);
      return { PhysicalResourceId: event.PhysicalResourceId };
    default:
      throw new Error(
        `Unsupported request type: ${(event as { RequestType: string }).RequestType}`
      );
  }
};
