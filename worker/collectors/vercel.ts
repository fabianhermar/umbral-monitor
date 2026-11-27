import { getSitesWithVercelProject } from "../lib/allowlist";
import { resolveIncidentByFingerprint, upsertIncident } from "../lib/db";
import type { Env } from "../types";

interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state?: string;
  readyState?: string;
  created: number;
  inspectorUrl?: string;
  meta?: {
    githubCommitMessage?: string;
    githubCommitRef?: string;
  };
}

interface VercelDeploymentsResponse {
  deployments?: VercelDeployment[];
}

export async function syncVercelDeployments(env: Env) {
  if (!env.VERCEL_API_TOKEN) {
    return { skipped: true, reason: "VERCEL_API_TOKEN no configurado", projectsSynced: 0 };
  }

  const sites = getSitesWithVercelProject();
  if (sites.length === 0) {
    return { skipped: true, reason: "Ningún sitio tiene vercelProjectId configurado", projectsSynced: 0 };
  }

  const syncTimestamp = new Date().toISOString();
  const errors: string[] = [];

  for (const site of sites) {
    try {
      const params = new URLSearchParams({
        projectId: site.vercelProjectId!.trim(),
        limit: "3",
      });
      if (site.vercelTeamId?.trim()) {
        params.set("teamId", site.vercelTeamId.trim());
      }

      const res = await fetch(`https://api.vercel.com/v6/deployments?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${env.VERCEL_API_TOKEN}`,
        },
      });

      if (!res.ok) {
        errors.push(`${site.id}: Vercel HTTP ${res.status}`);
        continue;
      }

      const data = (await res.json()) as VercelDeploymentsResponse;
      const latest = data.deployments?.[0];
      if (!latest) continue;

      const state = (latest.state ?? latest.readyState ?? "UNKNOWN").toUpperCase();

      await env.DB.prepare(
        `INSERT INTO site_runtime_state
          (site_id, last_vercel_sync_at, last_vercel_deployment_id, last_vercel_deployment_state)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(site_id) DO UPDATE SET
           last_vercel_sync_at = excluded.last_vercel_sync_at,
           last_vercel_deployment_id = excluded.last_vercel_deployment_id,
           last_vercel_deployment_state = excluded.last_vercel_deployment_state`
      )
        .bind(site.id, syncTimestamp, latest.uid, state)
        .run();

      const deployFp = `vercel-deploy:${site.id}`;

      if (state === "ERROR" || state === "CANCELED") {
        const commitMsg = latest.meta?.githubCommitMessage ?? "Sin mensaje de commit";
        await upsertIncident(env, {
          siteId: site.id,
          fingerprint: deployFp,
          category: "deployment",
          severity: state === "ERROR" ? "high" : "medium",
          source: "vercel-api",
          title: `Despliegue ${state} en Vercel (${site.name})`,
          description: `El último despliegue (${latest.uid}) terminó en estado ${state}. Commit: "${commitMsg}".`,
          metadata: {
            deploymentId: latest.uid,
            state,
            branch: latest.meta?.githubCommitRef,
            commitMessage: commitMsg,
            inspectorUrl: latest.inspectorUrl,
          },
        });
      } else if (state === "READY") {
        await resolveIncidentByFingerprint(
          env,
          site.id,
          deployFp,
          `Nuevo despliegue ${latest.uid} completado en estado READY.`
        );
      }
    } catch (err) {
      errors.push(`${site.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    skipped: false,
    projectsSynced: sites.length,
    errors,
  };
}
