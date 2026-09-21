/** Partner administers its own company; tenant checks still scope every action. */
export const canViewAdministration = (role: string) =>
  role === "Administrator" || role === "Partner" || role === "Superadmin";

export const canManageModules = canViewAdministration;
