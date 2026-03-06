const normalizeFlag = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

const isEnabled = (value) => {
  const normalized = normalizeFlag(value);
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const resolveBaseUrl = () => {
  const explicit = (process.env.SITE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const primary = (process.env.URL || "").trim();
  if (primary) return primary.replace(/\/+$/, "");
  const deploy = (process.env.DEPLOY_URL || "").trim();
  if (deploy) return deploy.replace(/\/+$/, "");
  return "";
};

export const config = {
  schedule: "*/1 * * * *",
};

export const handler = async () => {
  if (!isEnabled(process.env.AI_GENERATION_ASYNC_WORKER_ENABLED || "")) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        skipped: true,
        reason: "worker_disabled",
      }),
    };
  }

  const adminKey = (process.env.TF_ADMIN_API_KEY || "").trim();
  const baseUrl = resolveBaseUrl();
  if (!adminKey || !baseUrl) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        skipped: true,
        reason: "missing_configuration",
      }),
    };
  }

  const response = await fetch(`${baseUrl}/api/internal/ai/generation-worker?limit=5`, {
    method: "POST",
    headers: {
      "x-tf-admin-key": adminKey,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  const body = await response.text();
  return {
    statusCode: response.status,
    body,
  };
};
