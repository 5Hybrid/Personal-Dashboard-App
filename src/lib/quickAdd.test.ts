import { describe, expect, it } from "vitest";
import { draftToItemInput, parseQuickAdd } from "@/lib/quickAdd";
import type { Context } from "@/types";

function cls(id: string, name: string): Context {
  return {
    id,
    type: "Class",
    name,
    color: "blue",
    status: "Active",
    term: null,
    schedule: null,
    owner: null,
    grade_scale: null,
    grade_cutoffs: null,
  };
}

const CONTEXTS = [cls("fm", "Financial Modelling"), cls("py", "Python for Finance")];
// Saturday, October 17 2026, 9:35 PM local
const NOW = new Date(2026, 9, 17, 21, 35);

describe("parseQuickAdd", () => {
  it("pulls out a date and time and leaves a clean title", () => {
    const d = parseQuickAdd("Cello prep tomorrow 4pm", CONTEXTS, [], NOW);
    expect(d.title).toBe("Cello prep");
    expect(d.dueDate).toBe("2026-10-18");
    expect(d.dueTime).toBe("16:00");
    expect(d.category).toBe("Personal");
    expect(d.classId).toBeNull();
  });

  it("matches a class by #tag prefix", () => {
    const d = parseQuickAdd("Lab 5 #python tue", CONTEXTS, [], NOW);
    expect(d.category).toBe("School");
    expect(d.classId).toBe("py");
    expect(d.title).toBe("Lab 5");
    expect(d.dueDate).toBe("2026-10-20");
    expect(d.dueTime).toBeNull();
  });

  it("matches a class written in plain text", () => {
    const d = parseQuickAdd("Midterm review for financial modelling", CONTEXTS, [], NOW);
    expect(d.classId).toBe("fm");
    expect(d.category).toBe("School");
  });

  it("files an unknown #tag as a Personal list, reusing a known list's casing", () => {
    expect(parseQuickAdd("Rosin #cello", CONTEXTS, ["Cello"], NOW).list).toBe("Cello");
    const fresh = parseQuickAdd("Pay rent #bills", CONTEXTS, [], NOW);
    expect(fresh.list).toBe("Bills");
    expect(fresh.category).toBe("Personal");
    expect(draftToItemInput(fresh)).toMatchObject({ category: "Personal", subcategory_text: "Bills", subcategory_id: null });
  });

  it("reads priority shorthands", () => {
    expect(parseQuickAdd("Renew passport !high", CONTEXTS, [], NOW).priority).toBe("High");
    expect(parseQuickAdd("Renew passport !!", CONTEXTS, [], NOW).priority).toBe("High");
    expect(parseQuickAdd("Water plants !low", CONTEXTS, [], NOW).priority).toBe("Low");
    expect(parseQuickAdd("Water plants", CONTEXTS, [], NOW).priority).toBe("Medium");
  });

  it("treats school keywords without a class as School", () => {
    const d = parseQuickAdd("Study for quiz", CONTEXTS, [], NOW);
    expect(d.category).toBe("School");
    expect(d.classId).toBeNull();
  });

  it("never returns an empty title", () => {
    expect(parseQuickAdd("tomorrow", CONTEXTS, [], NOW).title).toBe("tomorrow");
  });
});
