import crypto from "node:crypto";
import { askOllama, coordinatorSchema, specialistSchema } from "./ollama.mjs";
import { coordinatorSystem, specialistSystem } from "./prompts.mjs";

const roles = new Set([
  "Website",
  "CRM",
  "Growth",
  "Events",
  "Billing",
  "Review",
]);
const runnable = new Set(["queued", "planning", "running"]);
const stamp = () => new Date().toISOString();

function message(run, from, to, text, kind = "message") {
  run.messages.push({
    id: `msg_${crypto.randomUUID()}`,
    from,
    to,
    text,
    kind,
    createdAt: stamp(),
  });
}

export function createOrchestraEngine({
  store,
  ollamaFetch,
  createTools,
  providerService,
}) {
  let busy = false;
  const controllers = new Map();
  const runtimes = new Map();
  const readRuns = () => store.get()?.orchestraRuns || [];

  async function persist(run) {
    const saved = structuredClone(run);
    saved.updatedAt = stamp();
    await store.update((state) => {
      state.orchestraRuns ||= [];
      const index = state.orchestraRuns.findIndex(
        (item) => item.id === saved.id,
      );
      if (
        index >= 0 &&
        state.orchestraRuns[index].status === "canceled" &&
        saved.status !== "canceled"
      ) {
        // Retain a receipt from an already-dispatched write without reviving the run.
        state.orchestraRuns[index] = {
          ...saved,
          status: "canceled",
          error: "Canceled by operator",
        };
        return;
      }
      if (index < 0) state.orchestraRuns.push(saved);
      else state.orchestraRuns[index] = saved;
    });
  }

  async function interruptOnStart() {
    for (const source of readRuns()) {
      if (!runnable.has(source.status)) continue;
      const run = structuredClone(source);
      run.status = "interrupted";
      run.error =
        "Process restarted while work was in progress; explicit recovery is required.";
      await persist(run);
    }
  }

  function nextRun() {
    return readRuns().find(
      (run) =>
        run.status === "queued" ||
        run.status === "running" ||
        run.status === "planning",
    );
  }

  async function schedule() {
    if (busy) return;
    const source = nextRun();
    if (!source) return;
    busy = true;
    try {
      await execute(structuredClone(source));
    } finally {
      busy = false;
      void schedule();
    }
  }

  function runtimeFor(run) {
    const runtime = runtimes.get(run.id);
    if (!runtime)
      throw new Error("Run runtime is unavailable; start a new run");
    return runtime;
  }

  async function execute(run) {
    const controller = controllers.get(run.id);
    if (!controller) return;
    const { signal } = controller;
    try {
      if (run.status === "queued") {
        run.status = "planning";
        await persist(run);
        const ask =
          providerService?.askProvider ||
          ((_, args) => askOllama(ollamaFetch, args));
        const plan = await ask(run.providerId || "ollama", {
          model: run.model,
          system: coordinatorSystem,
          user: run.prompt,
          schema: coordinatorSchema,
          signal,
        });
        if (
          !Array.isArray(plan.tasks) ||
          !plan.tasks.length ||
          plan.tasks.length > 6 ||
          plan.tasks.some((task) => !roles.has(task.agent) || !task.instruction)
        ) {
          throw new Error("Coordinator returned an invalid task plan");
        }
        run.title = plan.title || run.prompt.slice(0, 80);
        run.tasks = plan.tasks.map((task, index) => ({
          id: `task_${index + 1}`,
          agent: task.agent,
          instruction: task.instruction,
          status: "queued",
        }));
        message(
          run,
          "Coordinator",
          "all",
          plan.tasks
            .map((task) => `${task.agent}: ${task.instruction}`)
            .join("\n"),
          "delegation",
        );
        await persist(run);
      }

      for (const task of run.tasks) {
        if (task.status === "completed") continue;
        if (task.status === "blocked" || task.status === "awaiting_approval")
          return;
        if (
          run.tasks.some(
            (prior) => prior.status === "blocked" && prior.id !== task.id,
          )
        ) {
          task.status = "blocked";
          task.summary =
            "Blocked because a prerequisite specialist task failed.";
          await persist(run);
          continue;
        }
        if (signal.aborted) throw new Error("orchestra canceled");
        task.status = "running";
        run.status = "running";
        const previous = run.tasks[run.tasks.indexOf(task) - 1];
        if (previous?.status === "completed" && !(task.turns > 0)) {
          message(
            run,
            previous.agent,
            task.agent,
            `Handoff: ${previous.summary || previous.instruction}. Verified results: ${run.receipts
              .filter(
                (r) => r.taskId === previous.id && r.status === "succeeded",
              )
              .map((r) => `${r.tool}: ${r.recordId || r.message}`)
              .join("; ")}`,
            "delegation",
          );
        }
        await persist(run);
        await specialist(run, task, signal);
        if (run.status === "awaiting_approval" || task.status === "blocked")
          return;
      }
      if (signal.aborted) throw new Error("orchestra canceled");
      run.status = run.tasks.every((task) => task.status === "completed")
        ? "completed"
        : "blocked";
      run.summary =
        run.status === "completed"
          ? `Finished with ${run.receipts.filter((receipt) => receipt.status === "succeeded").length} verified tool results. Review receipts for the exact work performed.`
          : "The run was blocked by specialist work.";
      await persist(run);
    } catch (error) {
      const current = readRuns().find((item) => item.id === run.id);
      if (current?.status === "canceled") return;
      run.status = signal.aborted ? "canceled" : "failed";
      run.error = error.message;
      message(run, "system", "Coordinator", error.message, "system");
      await persist(run);
    } finally {
      controllers.delete(run.id);
      runtimes.delete(run.id);
    }
  }

  async function specialist(run, task, signal) {
    const tools = runtimeFor(run).tools;
    const catalog = tools.catalog.filter((tool) =>
      tool.agents.includes(task.agent),
    );
    let successfulReceipt = run.receipts.some(
      (receipt) => receipt.taskId === task.id && receipt.status === "succeeded",
    );
    for (let turn = task.turns || 0; turn < 8; turn += 1) {
      task.turns = turn + 1;
      await persist(run);
      const context = await tools.context();
      const focusedContext = {
        ...context,
        contacts: (context.contacts || []).slice(-8),
        pages: (context.pages || []).slice(-6),
        webinars: (context.webinars || []).slice(-6),
        campaigns: (context.campaigns || []).slice(-6),
        approvals: (context.approvals || []).filter((a) =>
          run.receipts.some((r) => r.approvalId === a.id),
        ),
      };
      const receipts = run.receipts.slice(-8).map(({ args, ...receipt }) => ({
        ...receipt,
        data:
          receipt.tool === "inspect_workspace"
            ? {
                note: "Workspace read successfully; current records are in context below.",
              }
            : receipt.data,
      }));
      const ask =
        providerService?.askProvider ||
        ((_, args) => askOllama(ollamaFetch, args));
      const result = await ask(run.providerId || "ollama", {
        model: run.model,
        system: specialistSystem(task.agent, catalog),
        user: JSON.stringify({
          goal: run.prompt,
          instruction: task.instruction,
          publicMessages: run.messages.slice(-8),
          receipts,
          context: focusedContext,
        }),
        schema: specialistSchema(catalog),
        signal,
      });
      if (signal.aborted) throw new Error("orchestra canceled");
      if (
        typeof result.message !== "string" ||
        typeof result.done !== "boolean" ||
        typeof result.tool !== "string" ||
        !result.args ||
        Array.isArray(result.args)
      )
        throw new Error(`${task.agent} returned an invalid response`);
      if (result.message) {
        message(run, task.agent, "Coordinator", result.message);
        await persist(run);
      }
      if (!result.tool) {
        if (result.done && successfulReceipt) {
          task.status = "completed";
          task.summary = result.message;
          await persist(run);
          return;
        }
        if (result.done) {
          message(
            run,
            "system",
            task.agent,
            "Completion was NOT accepted. This task has no verified tool receipt. Call an allowed tool now (Review must call inspect_workspace), then report its actual result.",
            "system",
          );
          await persist(run);
        } else {
          message(
            run,
            "system",
            task.agent,
            'An empty tool does not advance work. If your verified receipts fulfill the delegated task, respond tool:"", args:{}, done:true now; otherwise call the next required tool.',
            "system",
          );
          await persist(run);
        }
        continue;
      }
      const definition = catalog.find((tool) => tool.name === result.tool);
      if (!definition)
        throw new Error(`${task.agent} selected a disallowed tool`);
      const prior = run.receipts.find(
        (receipt) =>
          receipt.taskId === task.id &&
          receipt.tool === result.tool &&
          JSON.stringify(receipt.args) === JSON.stringify(result.args),
      );
      // Block duplicate create for the SAME tool (not all creates).
      const priorCreate = run.receipts.find(
        (receipt) =>
          receipt.taskId === task.id &&
          receipt.status === "succeeded" &&
          receipt.tool === result.tool &&
          /^create_/.test(result.tool),
      );
      if (priorCreate && !prior) {
        message(
          run,
          "system",
          task.agent,
          `Duplicate create request blocked. The ${result.tool} action already produced ${priorCreate.recordId || "a verified record"}; use that record ID in downstream work and finish this task when its instruction is satisfied.`,
          "system",
        );
        await persist(run);
        continue;
      }
      if (prior?.status === "succeeded") {
        successfulReceipt = true;
        if (
          result.done ||
          (result.tool === "inspect_workspace" && task.agent === "Review")
        ) {
          task.status = "completed";
          task.summary =
            result.message ||
            "Inspected workspace records and verified prior specialist work.";
          await persist(run);
          return;
        }
        message(
          run,
          "system",
          task.agent,
          `This exact ${result.tool} action already succeeded (${prior.recordId || prior.message}). Do not repeat it. Use its existing ID for the next step, or finish with tool:"",args:{},done:true if your delegated task is fulfilled.`,
          "system",
        );
        await persist(run);
        continue;
      }
      message(
        run,
        task.agent,
        result.tool,
        `Requesting ${result.tool}.`,
        "tool",
      );
      await persist(run);
      let receipt;
      try {
        receipt = await tools.execute(result.tool, result.args, {
          runId: run.id,
          taskId: task.id,
          agent: task.agent,
          signal,
        });
      } catch (error) {
        receipt = { status: "blocked", message: error.message };
      }
      const saved = {
        id: `receipt_${crypto.randomUUID()}`,
        taskId: task.id,
        agent: task.agent,
        tool: result.tool,
        args: result.args,
        ...receipt,
        createdAt: stamp(),
      };
      run.receipts.push(saved);
      await persist(run);
      if (signal.aborted) throw new Error("orchestra canceled");
      if (saved.status === "awaiting_approval") {
        saved.completesTask = result.done;
        task.status = "awaiting_approval";
        run.status = "awaiting_approval";
        await persist(run);
        return;
      }
      if (saved.status !== "succeeded") {
        message(
          run,
          "system",
          task.agent,
          `Tool ${result.tool} error: ${saved.message || "Execution failed"}. Correct your arguments or choose another tool.`,
          "system",
        );
        await persist(run);
        continue;
      }
      successfulReceipt = true;
      message(run, result.tool, task.agent, saved.message, "tool");
      const instruction = task.instruction.toLowerCase();
      const standaloneCreate =
        /^create_(webinar|contact|sandbox_subscription|page|campaign)$/.test(
          result.tool,
        ) &&
        !/(then|after|next|link|register|configure|publish|update|verify|review|send|schedule)/.test(
          instruction,
        );

      if (standaloneCreate) {
        task.status = "completed";
        task.summary = `${saved.message} Task completed from the verified receipt.`;
        await persist(run);
        return;
      }
    }
    if (!successfulReceipt)
      throw new Error(
        `${task.agent} claimed completion without a verified tool receipt after corrective feedback`,
      );
    task.status = "completed";
    task.summary = `${task.agent} completed task with verified receipt.`;
    await persist(run);
    return;
  }

  return {
    readRuns,
    interruptOnStart,
    schedule,
    controllers,
    async create(prompt, model, port, providerId = "ollama") {
      const run = {
        id: `run_${crypto.randomUUID()}`,
        prompt,
        model,
        providerId,
        title: "Planning…",
        status: "queued",
        tasks: [],
        messages: [],
        receipts: [],
        createdAt: stamp(),
        updatedAt: stamp(),
      };
      runtimes.set(run.id, { port, tools: createTools(port) });
      controllers.set(run.id, new AbortController());
      await persist(run);
      void schedule();
      return run;
    },
    async cancel(id) {
      const source = readRuns().find((run) => run.id === id);
      if (
        !source ||
        !["queued", "planning", "running", "awaiting_approval"].includes(
          source.status,
        )
      )
        return source;
      const run = structuredClone(source);
      controllers.get(id)?.abort();
      run.status = "canceled";
      run.error = "Canceled by operator";
      await persist(run);
      return run;
    },
    async resume(id, port) {
      const source = readRuns().find((run) => run.id === id);
      if (!source || source.status !== "awaiting_approval") return null;
      const run = structuredClone(source);
      const runtime = { port, tools: createTools(port) };
      const context = await runtime.tools.context();
      const approvals = Array.isArray(context?.approvals)
        ? context.approvals
        : [];
      for (const receipt of run.receipts.filter(
        (item) => item.status === "awaiting_approval",
      )) {
        const approval = approvals.find(
          (item) => item.id === receipt.approvalId,
        );
        if (!approval) return null;
        if (
          ["rejected", "superseded", "delivery_unknown"].includes(
            approval.status,
          )
        ) {
          run.status = "blocked";
          run.error = `Approval ${approval.id} is ${approval.status}. No dependent actions were executed.`;
          const task = run.tasks.find((item) => item.id === receipt.taskId);
          if (task) task.status = "blocked";
          await persist(run);
          return run;
        }
        if (approval.status !== "approved") return null;
        if (
          approval.targetId &&
          receipt.recordId &&
          approval.targetId !== receipt.recordId
        )
          return null;
        const recordId = receipt.recordId || receipt.data?.recordId;
        if (recordId) {
          const record = [
            ...(context.pages || []),
            ...(context.campaigns || []),
          ].find((item) => item.id === recordId);
          if (!record) return null;
          const validPublishedPage = (context.pages || []).some(
            (item) =>
              item.id === recordId &&
              item.status === "published" &&
              (item.published === true || item._published === true),
          );
          const validScheduledCampaign = (context.campaigns || []).some(
            (item) =>
              item.id === recordId &&
              (item.status === "scheduled_local" ||
                (item.status === "sent" && item.deliveryVerified === true)),
          );
          if (!validPublishedPage && !validScheduledCampaign) return null;
        }
        receipt.status = "succeeded";
        receipt.message = `Approval ${approval.id} verified against target ${receipt.recordId}. Action completed.`;
        const task = run.tasks.find((item) => item.id === receipt.taskId);
        if (task) task.status = receipt.completesTask ? "completed" : "running";
        message(
          run,
          "system",
          receipt.agent,
          `Approval ${approval.id} verified; continuing.`,
          "system",
        );
      }
      run.status = "running";
      runtimes.set(id, runtime);
      controllers.set(id, new AbortController());
      await persist(run);
      void schedule();
      return run;
    },
  };
}
