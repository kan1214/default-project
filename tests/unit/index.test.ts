import { greet } from "../../src/app/index";

describe("greet", () => {
  it("should return a greeting message", () => {
    expect(greet("World")).toBe("Hello, World!");
  });

  it("should handle empty string", () => {
    expect(greet("")).toBe("Hello, !");
  });
});
