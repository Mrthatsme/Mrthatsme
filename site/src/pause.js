// "Pause everything": the client's emergency brake, from a one-tap link in the
// Daily Brief. While paused, nothing reads their inbox, nothing is drafted or
// routed, and nothing is sent to their customers on its own. Requests through
// their form are still recorded and sent to the owner unprocessed, so no
// customer is lost. The Daily Brief keeps coming, with a Resume link.
// Fees and the 30-day notice are unchanged (agreement clause 2).

import { sendNotificationEmail } from "./email.js";
import { logClientAgentEvent } from "./clientagent.js";

export const isPaused = (agentOrProfile) => {
  const p = typeof agentOrProfile.profile === "string" ? JSON.parse(agentOrProfile.profile || "{}") : (agentOrProfile.profile || agentOrProfile);
  return !!p.pausedAt;
};

export async function setPaused(env, agentId, paused, by = "the owner") {
  const agent = await env.DB.prepare(`SELECT * FROM client_agents WHERE id = ?`).bind(agentId).first();
  if (!agent) return { error: "agent_not_found" };
  const profile = JSON.parse(agent.profile || "{}");
  if (!!profile.pausedAt === paused) return { ok: true, unchanged: true, pausedAt: profile.pausedAt || null };
  if (paused) profile.pausedAt = new Date().toISOString(); else delete profile.pausedAt;
  await env.DB.prepare(`UPDATE client_agents SET profile = ? WHERE id = ?`).bind(JSON.stringify(profile), agentId).run();
  await logClientAgentEvent(env, agentId, paused ? "paused" : "resumed", `${paused ? "Paused" : "Resumed"} by ${by}.`);
  await sendNotificationEmail(env, {
    subject: `[${agent.label}] ${paused ? "PAUSED everything" : "resumed"}`,
    text: paused
      ? `${profile.business || agent.label} paused everything (${by}). Their inbox isn't being read, nothing is drafted, routed or sent on its own, and form requests go to them unprocessed. Billing and notice are unchanged. Check in with them.`
      : `${profile.business || agent.label} resumed (${by}). Everything runs again from the next inbox check.`,
  }).catch((err) => console.error("pause notice failed", err));
  return { ok: true, pausedAt: profile.pausedAt || null };
}
