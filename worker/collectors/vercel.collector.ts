/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  worker/collectors/vercel.collector.ts
 *
 * Copyright (c) 2026 UMBRAL Contributors. All rights reserved.
 *
 * This source code is licensed under the MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * SPDX-License-Identifier: MIT
 */

/**
 * ============================================================================
 * Recolector Automático — Estado de Despliegues en Vercel (Cada 5 min)
 * ============================================================================
 * Consulta la REST API de Vercel únicamente para los `vercelProjectId`
 * declarados en `config/sites.config.ts` y detecta builds fallidos.
 */

import { updateVercelDeploymentState } from "../repositories/uptime.repo";
import { getSitesWithVercelProject } from "../security/allowlist";
import {
  resolveIncidentByFingerprint,
  upsertIncident,
} from "../services/incidents.service";
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
    return { skipped: true, projectsSynced: 0 };
  }

  const sites = getSitesWithVercelProject(env);
  if (sites.length === 0) {
    return { skipped: true, projectsSynced: 0 };
  }

  const syncTimestamp = new Date().toISOString();

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
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      const data = (await res.json()) as VercelDeploymentsResponse;
      const latest = data.deployments?.[0];
      if (!latest) continue;

      const state = (latest.state ?? latest.readyState ?? "UNKNOWN").toUpperCase();
      await updateVercelDeploymentState(env.DB, site.id, syncTimestamp, latest.uid, state);

      const deployFp = `vercel-deploy:${site.id}`;

      if (state === "ERROR" || state === "CANCELED") {
        const commitMsg = (latest.meta?.githubCommitMessage ?? "Sin mensaje de commit").slice(
          0,
          160
        );
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
    } catch {
      // Continuar con el siguiente proyecto sin interrumpir el ciclo
    }
  }

  return {
    skipped: false,
    projectsSynced: sites.length,
  };
}
