export interface ResourceTable {
  id: string;
  name: string;
  description: string | null;
  type: string;
  tag: string | null;
  global_visible: number;
  url: string | null;
  icon_url: string | null;
  owner_id: string;
  approval_policy_id: string | null;
  requires_approval: number;
  approval_count: number;
  created_at: string;
  updated_at: string;
}

export interface ResourceRoleTable {
  id: string;
  resource_id: string;
  name: string;
  is_admin: number;
  description: string | null;
  requires_approval: number | null;
  approval_count: number | null;
  created_at: string;
}

export interface AccessRequestTable {
  id: string;
  requester_id: string;
  resource_id: string;
  resource_role_id: string;
  status: string;
  reason: string | null;
  lease_duration_days: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccessApprovalTable {
  id: string;
  access_request_id: string;
  approver_id: string;
  decision: string;
  comment: string | null;
  created_at: string;
}

export interface AccessGrantTable {
  id: string;
  user_id: string;
  resource_id: string;
  resource_role_id: string;
  access_request_id: string | null;
  status: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface PurchaseRequestTable {
  id: string;
  requester_id: string;
  software_name: string;
  description: string | null;
  url: string | null;
  justification: string;
  estimated_cost: string | null;
  status: string;
  reviewer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogTable {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface SecretTable {
  id: string;
  resource_id: string;
  name: string;
  encrypted_value: string;
  type: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ApprovalGroupTable {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovalGroupMemberTable {
  id: string;
  approval_group_id: string;
  user_id: string;
  created_at: string;
}

export interface ApprovalPolicyTable {
  id: string;
  name: string;
  auto_approve: number;
  created_at: string;
  updated_at: string;
}

export interface ApprovalPolicyGroupTable {
  id: string;
  approval_policy_id: string;
  approval_group_id: string;
  created_at: string;
}

export interface UserTable {
  id: string;
  name: string;
  email: string;
  emailVerified: number;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  user: UserTable;
  resource: ResourceTable;
  resource_role: ResourceRoleTable;
  access_request: AccessRequestTable;
  access_approval: AccessApprovalTable;
  access_grant: AccessGrantTable;
  purchase_request: PurchaseRequestTable;
  audit_log: AuditLogTable;
  secret: SecretTable;
  approval_group: ApprovalGroupTable;
  approval_group_member: ApprovalGroupMemberTable;
  approval_policy: ApprovalPolicyTable;
  approval_policy_group: ApprovalPolicyGroupTable;
}
