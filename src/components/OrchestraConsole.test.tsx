import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrchestraConsole from "./OrchestraConsole";
import { api } from "../api";
import type { AgentRun } from "../orchestra-types";
vi.mock("../api", () => ({ api: vi.fn() }));
const mock = vi.mocked(api);
const run: AgentRun = {
  id: "run-1",
  prompt: "Create a page",
  title: "Create garden page",
  model: "test-model",
  status: "awaiting_approval",
  tasks: [
    {
      id: "task1",
      agent: "Website",
      instruction: "Create and publish",
      status: "awaiting_approval",
    },
  ],
  messages: [
    {
      id: "msg1",
      from: "Website",
      to: "Coordinator",
      text: "Actual generated message",
      kind: "message",
      createdAt: "2026-10-10T00:00:00Z",
    },
  ],
  receipts: [
    {
      id: "receipt1",
      taskId: "task1",
      agent: "Website",
      tool: "request_publish_page",
      status: "awaiting_approval",
      message: "Review required",
      approvalId: "a1",
      recordId: "p1",
      createdAt: "2026-10-10T00:00:00Z",
    },
  ],
  createdAt: "2026-10-10T00:00:00Z",
  updatedAt: "2026-10-10T00:00:00Z",
};
beforeEach(() => mock.mockReset());
afterEach(cleanup);
it("starts an actual model run using prompt and installed model, without guided fallback", async () => {
  mock.mockImplementation(async (path, method, body) =>
    path === "/ai/status"
      ? { available: true, models: ["test-model"] }
      : path === "/orchestra"
        ? { runs: [], activeRunId: null }
        : run,
  );
  render(<OrchestraConsole />);
  await waitFor(() =>
    expect(screen.getByRole("option", { name: "test-model" })).toBeTruthy(),
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Create a garden page" },
  });
  await userEvent.click(screen.getByRole("button", { name: /Run command/i }));
  await waitFor(() =>
    expect(mock).toHaveBeenCalledWith("/orchestra/runs", "POST", {
      prompt: "Create a garden page",
      model: "test-model",
    }),
  );
});
it("renders real messages, pending receipts, approval navigation and resume controls", async () => {
  const approvals = vi.fn();
  mock.mockImplementation(async (path) =>
    path === "/ai/status"
      ? { available: true, models: ["test-model"] }
      : { runs: [run], activeRunId: run.id },
  );
  render(<OrchestraConsole onApprovals={approvals} />);
  await waitFor(() =>
    expect(screen.getByText("Actual generated message")).toBeTruthy(),
  );
  expect(screen.getByText("Review required")).toBeTruthy();
  const buttons = screen.getAllByRole("button");
  const approvalButton = screen.getByRole("button", {
    name: "Review approvals",
  });
  expect(approvalButton).toBeTruthy();
  await userEvent.click(approvalButton!);
  expect(approvals).toHaveBeenCalled();
  expect(buttons.some((b) => /resume/i.test(b.textContent || ""))).toBe(true);
});
