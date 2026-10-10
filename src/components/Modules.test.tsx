import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modules from "./Modules";
import PixelOffice from "./PixelOffice";
import { api } from "../api";
import type { ModuleProps, NexusState, View, Workflow } from "../types";
vi.mock("../api", () => ({ api: vi.fn() }));
const mockedApi = vi.mocked(api);
const initial = (): NexusState => ({
  contacts: [
    {
      id: "c1",
      name: "Demo Contact",
      email: "demo@example.test",
      company: "Example",
      stage: "lead",
      source: "demo",
      consent: true,
      createdAt: "2026-10-10T00:00:00Z",
    },
  ],
  pages: [
    {
      id: "p1",
      title: "Demo page",
      slug: "demo",
      headline: "First headline",
      description: "Original description",
      accent: "#abcdef",
      blocks: ["hero", "details", "registration"],
      status: "draft",
      createdAt: "2026-10-10T00:00:00Z",
    },
  ],
  campaigns: [],
  webinars: [
    {
      id: "w1",
      title: "Demo webinar",
      description: "Demo description",
      startsAt: "",
      capacity: 25,
      joinUrl: "",
      status: "draft",
      registrations: [],
      createdAt: "2026-10-10T00:00:00Z",
    },
  ],
  plans: [
    {
      id: "plan1",
      name: "Starter",
      amount: 999,
      interval: "month",
      includedUsage: 100,
      overageRate: 10,
    },
  ],
  subscriptions: [],
  workflows: [],
  approvals: [],
  activities: [],
  integrations: [],
});
const props = (view: View): ModuleProps => ({
  view,
  state: initial(),
  refresh: vi.fn().mockResolvedValue(undefined),
  notify: vi.fn(),
});
beforeEach(() => mockedApi.mockReset());
afterEach(cleanup);

describe("usable business interfaces", () => {
  it("CRM opens Add contact and preserves input when saving fails", async () => {
    const p = props("crm");
    render(<Modules {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Add contact" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Full name|Name/i), {
      target: { value: "Test Person" },
    });
    fireEvent.change(within(dialog).getByLabelText("Email"), {
      target: { value: "test@example.test" },
    });
    mockedApi.mockRejectedValueOnce(new Error("Storage unavailable"));
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() =>
      expect(p.notify).toHaveBeenCalledWith("Storage unavailable", true),
    );
    expect(
      (
        within(screen.getByRole("dialog")).getByLabelText(
          /Full name|Name/i,
        ) as HTMLInputElement
      ).value,
    ).toBe("Test Person");
  });
  it("webinar create opens independently of edit and saves the date as ISO", async () => {
    const p = props("webinars");
    render(<Modules {...p} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Create webinar" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "New webinar" },
    });
    fireEvent.change(within(dialog).getByLabelText("Description"), {
      target: { value: "A real draft" },
    });
    fireEvent.change(within(dialog).getByLabelText("Date"), {
      target: { value: "2027-01-15T18:00" },
    });
    mockedApi.mockResolvedValueOnce({});
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(
        "/webinars",
        "POST",
        expect.objectContaining({
          title: "New webinar",
          startsAt: new Date("2027-01-15T18:00").toISOString(),
        }),
      ),
    );
  });
  it("unsaved page edits survive refreshed state; blocks can be reordered", async () => {
    const p = props("websites");
    const mounted = render(<Modules {...p} />);
    fireEvent.change(screen.getByLabelText("Headline"), {
      target: { value: "Unsaved work" },
    });
    mounted.rerender(<Modules {...p} state={structuredClone(p.state)} />);
    expect((screen.getByLabelText("Headline") as HTMLInputElement).value).toBe(
      "Unsaved work",
    );
    const down = screen.getAllByRole("button", { name: /Move.*down/i })[0];
    await userEvent.click(down);
    mockedApi.mockResolvedValueOnce({});
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(
        "/pages/p1",
        "PATCH",
        expect.objectContaining({
          headline: "Unsaved work",
          blocks: ["details", "hero", "registration"],
        }),
      ),
    );
  });
  it("billing creates a sandbox subscription through the API", async () => {
    const p = props("billing");
    render(<Modules {...p} />);
    mockedApi.mockResolvedValueOnce({});
    await userEvent.click(
      screen.getByRole("button", { name: "Create sandbox subscription" }),
    );
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/subscriptions", "POST", {
        contactId: "c1",
        planId: "plan1",
      }),
    );
  });
  it("billing can record metered usage with an explicit idempotency key", async () => {
    const p = props("billing");
    p.state.subscriptions.push({
      id: "s1",
      contactId: "c1",
      planId: "plan1",
      status: "active",
      usage: 5,
      sandbox: true,
      createdAt: "",
    });
    render(<Modules {...p} />);
    fireEvent.change(screen.getByLabelText("Usage event ID"), {
      target: { value: "event-123" },
    });
    fireEvent.change(screen.getByLabelText("Usage quantity"), {
      target: { value: "4" },
    });
    mockedApi.mockResolvedValueOnce({});
    await userEvent.click(screen.getByRole("button", { name: "Record usage" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(
        "/subscriptions/s1/usage",
        "POST",
        { eventId: "event-123", quantity: 4 },
      ),
    );
  });
  it("completed office steps do not stay awaiting approval because of their label", () => {
    const workflow: Workflow = {
      id: "wf1",
      title: "Demo",
      prompt: "",
      status: "drafts_ready",
      createdAt: "",
      steps: [
        {
          id: "step1",
          agent: "Website",
          label: "Review website",
          status: "completed",
        },
      ],
    };
    render(<PixelOffice workflows={[workflow]} />);
    expect(
      screen.getByRole("button", {
        name: "Select Website agent, status Ready",
      }),
    ).toBeTruthy();
  });

  it("keeps every office role visibly active before a workflow exists", () => {
    render(<PixelOffice workflows={[]} />);

    for (const role of ["Growth", "Website", "CRM", "Events", "Billing", "Coordinator"]) {
      expect(
        screen.getByRole("button", {
          name: `Select ${role} agent, status Working`,
        }),
      ).toBeTruthy();
    }
    expect(screen.queryByText("Idle")).toBeNull();
  });
});
