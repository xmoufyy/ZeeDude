import { describe, expect, it } from "vitest";
import { profileSchema } from "../profile-schema";

const base = { solpumpUsername: "SolSurfer", displayName: "", discordUsername: "", kickUsername: "", xUsername: "", hideName: true };

describe("profileSchema", () => {
  it("turns blank optional fields into undefined", () => {
    const parsed = profileSchema.parse(base);
    expect(parsed).toEqual({ solpumpUsername: "SolSurfer", hideName: true });
  });

  it("normalises handles: strips @, lowercases Discord", () => {
    const parsed = profileSchema.parse({ ...base, discordUsername: "@ZeeFan", xUsername: "@zee_dude", kickUsername: "Zee_Dude" });
    expect(parsed.discordUsername).toBe("zeefan");
    expect(parsed.xUsername).toBe("zee_dude");
    expect(parsed.kickUsername).toBe("Zee_Dude");
  });

  it("rejects invalid handles with readable messages", () => {
    const result = profileSchema.safeParse({ ...base, discordUsername: "x", xUsername: "way_too_long_handle_here", kickUsername: "a b" });
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((i) => i.message);
    expect(messages.some((m) => m.startsWith("Discord"))).toBe(true);
    expect(messages.some((m) => m.startsWith("X handles"))).toBe(true);
    expect(messages.some((m) => m.startsWith("Kick"))).toBe(true);
  });

  it("strips control characters and limits lengths", () => {
    expect(profileSchema.parse({ ...base, solpumpUsername: "  Sol\u0007Surfer " }).solpumpUsername).toBe("SolSurfer");
    expect(profileSchema.safeParse({ ...base, displayName: "x".repeat(41) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, solpumpUsername: "x".repeat(65) }).success).toBe(false);
  });
});
