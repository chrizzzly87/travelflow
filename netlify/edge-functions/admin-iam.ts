const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const AUTH_HEADER = "authorization";

type AdminAction = "invite" | "create" | "delete";

interface AdminIamRequestBody {
  action?: AdminAction;
  email?: string;
  password?: string;
  userId?: string;
  firstName?: string | null;
  lastName?: string | null;
  tierKey?: string | null;
  redirectTo?: string | null;
}

const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) || "";
  } catch {
    return "";
  }
};

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });

const safeJsonParse = async (response: Response): Promise<any> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const extractServiceError = (payload: any, fallback: string): string => {
  if (payload && typeof payload === "object") {
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message.trim();
    if (typeof payload.error_description === "string" && payload.error_description.trim()) return payload.error_description.trim();
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error.trim();
  }
  return fallback;
};

const extractBooleanRpcResult = (payload: any): boolean | null => {
  if (typeof payload === "boolean") return payload;
  if (Array.isArray(payload) && payload.length > 0) {
    if (typeof payload[0] === "boolean") return payload[0];
    if (payload[0] && typeof payload[0] === "object") {
      const firstValue = Object.values(payload[0])[0];
      return typeof firstValue === "boolean" ? firstValue : null;
    }
  }
  if (payload && typeof payload === "object") {
    const firstValue = Object.values(payload)[0];
    return typeof firstValue === "boolean" ? firstValue : null;
  }
  return null;
};

const getAuthToken = (request: Request): string | null => {
  const raw = request.headers.get(AUTH_HEADER) || "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
};

const getSupabaseConfig = () => {
  const url = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) return null;
  return { url, anonKey, serviceRoleKey };
};

const buildAnonHeaders = (authToken: string, anonKey: string) => ({
  "Content-Type": "application/json",
  apikey: anonKey,
  Authorization: `Bearer ${authToken}`,
});

const buildServiceHeaders = (serviceRoleKey: string, extra?: Record<string, string>) => ({
  "Content-Type": "application/json",
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  ...extra,
});

const serviceRolePatch = async (
  config: { url: string; serviceRoleKey: string },
  path: string,
  patch: Record<string, unknown>,
): Promise<void> => {
  const response = await fetch(`${config.url}${path}`, {
    method: "PATCH",
    headers: buildServiceHeaders(config.serviceRoleKey, {
      Prefer: "return=minimal",
    }),
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const payload = await safeJsonParse(response);
    throw new Error(extractServiceError(payload, "Could not update user references before delete."));
  }
};

const clearHardDeleteBlockingReferences = async (
  config: { url: string; serviceRoleKey: string },
  userId: string,
): Promise<void> => {
  const encodedUserId = encodeURIComponent(userId);
  await Promise.all([
    serviceRolePatch(config, `/rest/v1/trip_versions?created_by=eq.${encodedUserId}`, { created_by: null }),
    serviceRolePatch(config, `/rest/v1/trip_shares?created_by=eq.${encodedUserId}`, { created_by: null }),
    serviceRolePatch(config, `/rest/v1/profiles?role_updated_by=eq.${encodedUserId}`, { role_updated_by: null }),
  ]);
};

const supabaseFetch = async (
  config: { url: string; anonKey: string },
  authToken: string,
  path: string,
  init: RequestInit,
): Promise<Response> => {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      ...buildAnonHeaders(authToken, config.anonKey),
      ...(init.headers || {}),
    },
  });
};

const authorizeAdminRequest = async (
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<{ ok: true; actorUserId: string } | { ok: false; response: Response }> => {
  const response = await supabaseFetch(config, authToken, "/rest/v1/rpc/get_current_user_access", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: "{}",
  });

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: payload?.message || payload?.error || "Admin role verification failed.",
      }),
    };
  }

  const payload = await safeJsonParse(response);
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || row.system_role !== "admin" || !row.user_id) {
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: "Admin role required.",
      }),
    };
  }

  const permissionResponse = await supabaseFetch(config, authToken, "/rest/v1/rpc/has_admin_permission", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: JSON.stringify({
      p_permission: "admin.identity.write",
    }),
  });

  // Backward-compatible fallback for environments where RBAC migration isn't applied yet.
  if (permissionResponse.ok) {
    const permissionPayload = await safeJsonParse(permissionResponse);
    const hasPermission = extractBooleanRpcResult(permissionPayload);
    if (hasPermission === false) {
      return {
        ok: false,
        response: json(403, {
          ok: false,
          error: "Missing admin identity permission.",
        }),
      };
    }
  }

  return {
    ok: true,
    actorUserId: row.user_id as string,
  };
};

const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const randomPassword = (): string => {
  const seed = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  return `Tf!${seed}aA1`;
};

const logAdminAction = async (
  config: { url: string; anonKey: string },
  authToken: string,
  payload: {
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> => {
  try {
    await supabaseFetch(config, authToken, "/rest/v1/rpc/admin_write_audit", {
      method: "POST",
      headers: {
        Prefer: "params=single-object",
      },
      body: JSON.stringify({
        p_action: payload.action,
        p_target_type: payload.targetType,
        p_target_id: payload.targetId ?? null,
        p_before_data: {},
        p_after_data: {},
        p_metadata: payload.metadata || {},
      }),
    });
  } catch {
    // best effort audit only
  }
};

const upsertProfile = async (
  config: { url: string; serviceRoleKey: string },
  payload: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    tierKey?: string | null;
  },
): Promise<void> => {
  const body = {
    id: payload.id,
    first_name: payload.firstName || null,
    last_name: payload.lastName || null,
    display_name: [payload.firstName || "", payload.lastName || ""].filter(Boolean).join(" ").trim() || null,
    tier_key: payload.tierKey || "tier_free",
  };

  await fetch(`${config.url}/rest/v1/profiles`, {
    method: "POST",
    headers: buildServiceHeaders(config.serviceRoleKey, {
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify([body]),
  });
};

const parseBody = async (request: Request): Promise<AdminIamRequestBody | null> => {
  try {
    const payload = await request.json();
    return payload && typeof payload === "object" ? (payload as AdminIamRequestBody) : null;
  } catch {
    return null;
  }
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return json(500, {
      ok: false,
      error: "Supabase config missing. Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const authToken = getAuthToken(request);
  if (!authToken) {
    return json(401, { ok: false, error: "Missing bearer token." });
  }

  const authResult = await authorizeAdminRequest(config, authToken);
  if (!authResult.ok) {
    return "response" in authResult
      ? authResult.response
      : json(403, { ok: false, error: "Admin authorization failed." });
  }

  const body = await parseBody(request);
  if (!body || !body.action) {
    return json(400, { ok: false, error: "Invalid request payload." });
  }

  const action = body.action;
  if (action !== "invite" && action !== "create" && action !== "delete") {
    return json(400, { ok: false, error: "Unsupported action." });
  }

  if (action === "delete") {
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId) return json(400, { ok: false, error: "Missing userId for delete action." });

    const deleteAuthUser = async (): Promise<Response> =>
      fetch(`${config.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: buildServiceHeaders(config.serviceRoleKey),
      });

    let response = await deleteAuthUser();
    if (!response.ok) {
      const payload = await safeJsonParse(response);
      const deleteError = extractServiceError(payload, "Could not delete user.");
      const isForeignKeyDeleteFailure = /foreign key constraint/i.test(deleteError);

      if (isForeignKeyDeleteFailure) {
        try {
          await clearHardDeleteBlockingReferences(config, userId);
          response = await deleteAuthUser();
        } catch (cleanupError) {
          const cleanupMessage = cleanupError instanceof Error && cleanupError.message.trim()
            ? cleanupError.message.trim()
            : "Could not prepare user references for hard delete.";
          return json(400, {
            ok: false,
            error: `Could not delete user due to linked records. ${cleanupMessage}`,
          });
        }

        if (!response.ok) {
          const retryPayload = await safeJsonParse(response);
          return json(400, {
            ok: false,
            error: extractServiceError(retryPayload, "Could not delete user after cleaning linked records."),
          });
        }
      } else {
        return json(400, {
          ok: false,
          error: deleteError,
        });
      }
    }

    await logAdminAction(config, authToken, {
      action: "admin.user.hard_delete",
      targetType: "user",
      targetId: userId,
      metadata: { via: "admin-iam-edge" },
    });
    return json(200, { ok: true, data: { userId } });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !isEmail(email)) {
    return json(400, { ok: false, error: "A valid email is required." });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const tierKey = typeof body.tierKey === "string" && body.tierKey.trim() ? body.tierKey.trim() : "tier_free";

  const directPassword = typeof body.password === "string" ? body.password : "";
  if (action === "create" && directPassword.trim().length < 8) {
    return json(400, { ok: false, error: "Password must be at least 8 characters for direct creation." });
  }

  const createPayload = {
    email,
    password: action === "create" ? directPassword : randomPassword(),
    email_confirm: action === "create",
    user_metadata: {
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      full_name: [firstName, lastName].filter(Boolean).join(" ") || undefined,
    },
  };

  const createResponse = await fetch(`${config.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: buildServiceHeaders(config.serviceRoleKey),
    body: JSON.stringify(createPayload),
  });

  const createPayloadJson = await safeJsonParse(createResponse);
  const createUserId = createPayloadJson?.user?.id as string | undefined;
  const alreadyExists = !createResponse.ok && /already|exists|registered/i.test(
    String(createPayloadJson?.message || createPayloadJson?.error_description || createPayloadJson?.error || "")
  );

  if (!createResponse.ok && !(action === "invite" && alreadyExists)) {
    return json(400, {
      ok: false,
      error: createPayloadJson?.message || createPayloadJson?.error_description || createPayloadJson?.error || "Could not create user.",
    });
  }

  let userId = createUserId || "";

  if (action === "invite") {
    const recoverUrl = new URL(`${config.url}/auth/v1/recover`);
    if (typeof body.redirectTo === "string" && body.redirectTo.trim()) {
      recoverUrl.searchParams.set("redirect_to", body.redirectTo.trim());
    }
    const recoverResponse = await fetch(recoverUrl.toString(), {
      method: "POST",
      headers: buildServiceHeaders(config.serviceRoleKey),
      body: JSON.stringify({ email }),
    });
    if (!recoverResponse.ok) {
      const payload = await safeJsonParse(recoverResponse);
      return json(400, {
        ok: false,
        error: payload?.message || payload?.error_description || payload?.error || "Could not send invite/reset email.",
      });
    }
  }

  if (userId) {
    await upsertProfile(config, {
      id: userId,
      firstName,
      lastName,
      tierKey,
    });
  }

  await logAdminAction(config, authToken, {
    action: action === "invite" ? "admin.user.invite" : "admin.user.create_direct",
    targetType: "user",
    targetId: userId || email,
    metadata: {
      email,
      tierKey,
      createdBy: authResult.actorUserId,
      userExists: alreadyExists,
    },
  });

  return json(200, {
    ok: true,
    data: {
      action,
      userId: userId || null,
      email,
      userExists: alreadyExists,
    },
  });
};
