export interface StaffMember {
  id: string;
  user_id: string | null;
  email: string;
  role_id: string;
  role_name: string | null;
  status: "invited" | "active" | "suspended";
  created_at: string;
}

export interface StaffRole {
  id: string;
  name: string;
  role_key: string;
  is_system: boolean;
  is_editable: boolean;
}

export interface StaffData {
  members: StaffMember[];
  roles: StaffRole[];
}

export interface AuditEntry {
  id: string;
  action: string;
  actor_label: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export type StaffAction = "change_role" | "suspend" | "activate" | "remove";

export interface CreateStaffAccountInput {
  username: string;
  displayName: string;
  password: string;
  roleId: string;
}
