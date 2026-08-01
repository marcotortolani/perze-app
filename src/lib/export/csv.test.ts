import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("joins headers and rows with CRLF", () => {
    expect(toCsv(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    expect(toCsv(["note"], [["hello, world"]])).toBe('note\r\n"hello, world"');
    expect(toCsv(["note"], [['say "hi"']])).toBe('note\r\n"say ""hi"""');
    expect(toCsv(["note"], [["line1\nline2"]])).toBe('note\r\n"line1\nline2"');
  });

  it("leaves plain cells unquoted", () => {
    expect(toCsv(["amount"], [["1000"]])).toBe("amount\r\n1000");
  });
});
