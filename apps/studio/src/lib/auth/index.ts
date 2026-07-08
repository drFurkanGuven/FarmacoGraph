export { AuthProvider, useAuth } from "./context";
export { AuthGate, ProtectedRoute } from "./guards";
export { usePermissions, useRequireAuth } from "./hooks";
export { authApi, AuthApiError, isAuthEndpointUnavailable } from "./api";
export type { TokenResponse } from "./api";
export {
  hasPermission,
  hasRole,
  hasScope,
  rolesFromScopes,
  scopesFromRoles,
  ROLE_SCOPES,
} from "./roles";
export {
  matchRouteGuard,
  isProtectedPath,
  isLoginPath,
  normalizePathname,
  ROUTE_GUARDS,
  LOGIN_PATH,
  loginRedirectUrl,
} from "./routes";
export type { RouteGuardConfig } from "./routes";
export { decodeJwtPayload, jwtScopes, isTokenExpired } from "./tokens";
export { GUEST_SESSION, isSessionAuthenticated } from "./storage";
