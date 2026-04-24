import { runAgentRouter } from "../agents/router.js"
import { runBriefingAgent } from "../agents/briefing.js"
import { JobPayload, ProgressEvent } from "../types.js"
import { store } from "../store.js"

async function processPayload(jobId: string, payload: JobPayload): Promise<void> {
  const { intent, context = {}, agentType } = payload

  store.setStatus(jobId, "running")

  const onProgress = (event: ProgressEvent) => {
    store.appendEvent(jobId, event)
  }

  let result
  try {
    if (agentType === "briefing") {
      result = await runBriefingAgent(
        (context.company_name as string) || intent,
        context.domain as string | undefined,
        context.context as string | undefined,
        onProgress
      )
    } else {
      result = await runAgentRouter(intent, context, onProgress, agentType)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[worker] Job ${jobId.slice(0, 8)} threw:`, msg)
    onProgress({ type: "error", error: msg, timestamp: new Date().toISOString() })
    result = { success: false, error: msg }
  }

  store.setResult(jobId, result)
  store.setStatus(jobId, (result as { success: boolean }).success ? "done" : "failed")
}

export function startWorker(): void {
  async function loop(): Promise<void> {
    while (true) {
      if (store.runningCount < 3 && store["queue"].length > 0) {
        const item = store.dequeue()
        if (item) {
          store.incRunning()
          processPayload(item.jobId, item.payload)
            .finally(() => store.decRunning())
        }
      }
      await new Promise(r => setTimeout(r, 100))
    }
  }
  loop().catch(console.error)
  console.log("[worker] In-memory worker started (concurrency=3)")
}
