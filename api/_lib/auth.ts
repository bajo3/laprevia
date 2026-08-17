export function isAdminAuthorized(request: Request): boolean {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) return false;
  return request.headers.get("Authorization") === `Bearer ${configuredToken}`;
}
