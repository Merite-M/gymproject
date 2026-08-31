import { apiFetch } from '@/lib/api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ContractTemplate {
  id: string;
  tenant_id: string;
  name: string;
  contract_type: 'membership' | 'waiver' | 'personal_training' | 'corporate';
  body_template: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface GeneratedContract {
  success: boolean;
  template_id: string;
  template_name: string;
  contract_type: string;
  title: string;
  rendered_content: string;
  member: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  membership: {
    id: string;
    tier: string;
    price: number | string;
    billing_interval: string;
    start_date: string;
    end_date: string | null;
  } | null;
}

export interface SignedContractSummary {
  id: string;
  title: string;
  status: string;
  signed_at: string;
  ip_address: string;
  created_at: string;
  contract_templates?: {
    name: string;
    contract_type: string;
  };
}

export interface FullSignedContract {
  id: string;
  tenant_id: string;
  profile_id: string;
  template_id: string | null;
  membership_id: string | null;
  title: string;
  rendered_content: string;
  status: string;
  signature_image_url: string;
  signed_at: string;
  ip_address: string;
  user_agent: string;
  pdf_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
  };
  contract_templates?: {
    name: string;
    contract_type: string;
  };
}

/**
 * Fetch active contract templates for a tenant.
 */
export async function getContractTemplates(
  tenantId: string,
  contractType?: string
): Promise<ContractTemplate[]> {
  const typeParam = contractType ? `&contract_type=${encodeURIComponent(contractType)}` : '';
  const data = await apiFetch<{ templates: ContractTemplate[] }>(
    `${API_BASE_URL}/api/contracts/templates?tenant_id=${encodeURIComponent(tenantId)}${typeParam}`
  );
  return data.templates || [];
}

/**
 * Dynamically resolves contract merge tags for a specific member and template.
 */
export async function generateContract(params: {
  tenantId: string;
  profileId: string;
  templateId?: string;
  contractType?: string;
  customData?: Record<string, string>;
}): Promise<GeneratedContract> {
  return apiFetch<GeneratedContract>(`${API_BASE_URL}/api/contracts/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: params.tenantId,
      profile_id: params.profileId,
      template_id: params.templateId || null,
      contract_type: params.contractType || 'membership',
      custom_data: params.customData || {}
    })
  });
}

/**
 * Submits a digitally signed contract with e-signature data URL.
 */
export async function signContract(params: {
  tenantId: string;
  profileId: string;
  templateId?: string | null;
  membershipId?: string | null;
  title: string;
  renderedContent: string;
  signatureData: string;
  guardianName?: string | null;
  guardianRelationship?: string | null;
  customMetadata?: Record<string, unknown>;
}): Promise<{ success: boolean; contract: FullSignedContract }> {
  return apiFetch<{ success: boolean; contract: FullSignedContract }>(`${API_BASE_URL}/api/contracts/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: params.tenantId,
      profile_id: params.profileId,
      template_id: params.templateId || null,
      membership_id: params.membershipId || null,
      title: params.title,
      rendered_content: params.renderedContent,
      signature_data: params.signatureData,
      guardian_name: params.guardianName || null,
      guardian_relationship: params.guardianRelationship || null,
      custom_metadata: params.customMetadata || {}
    })
  });
}

/**
 * Get all contracts signed by a specific member.
 */
export async function getMemberContracts(
  tenantId: string,
  profileId: string
): Promise<SignedContractSummary[]> {
  const data = await apiFetch<{ contracts: SignedContractSummary[] }>(
    `${API_BASE_URL}/api/contracts/member/${encodeURIComponent(profileId)}?tenant_id=${encodeURIComponent(tenantId)}`
  );
  return data.contracts || [];
}

/**
 * Get single contract details.
 */
export async function getContractById(
  tenantId: string,
  contractId: string
): Promise<FullSignedContract> {
  const data = await apiFetch<{ contract: FullSignedContract }>(
    `${API_BASE_URL}/api/contracts/${encodeURIComponent(contractId)}?tenant_id=${encodeURIComponent(tenantId)}`
  );
  return data.contract;
}
