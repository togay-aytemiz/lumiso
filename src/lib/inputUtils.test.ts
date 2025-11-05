import type { ChangeEvent } from "react";
import {
  trimAndNormalizeSpaces,
  createTrimmedInputHandler,
  createTrimmedBlurHandler,
} from "./inputUtils";

const createInputEvent = (value: string): ChangeEvent<HTMLInputElement> =>
  ({ target: { value } } as unknown as ChangeEvent<HTMLInputElement>);

describe("inputUtils", () => {
  describe("trimAndNormalizeSpaces", () => {
    it("trims leading/trailing whitespace and collapses inner spacing", () => {
      expect(trimAndNormalizeSpaces("  hello   world  ")).toBe("hello world");
      expect(trimAndNormalizeSpaces("\t spaced \n out \t")).toBe("spaced out");
    });
  });

  describe("createTrimmedInputHandler", () => {
    it("passes raw value when trimOnChange is false", () => {
      const setValue = jest.fn();
      const handler = createTrimmedInputHandler(setValue);

      handler(createInputEvent("  keep   spacing  "));

      expect(setValue).toHaveBeenCalledWith("  keep   spacing  ");
    });

    it("trims and normalizes value when trimOnChange is true", () => {
      const setValue = jest.fn();
      const handler = createTrimmedInputHandler(setValue, true);

      handler(createInputEvent("  trim   me  "));

      expect(setValue).toHaveBeenCalledWith("trim me");
    });
  });

  describe("createTrimmedBlurHandler", () => {
    it("trims value on blur when it contains excess whitespace", () => {
      const setValue = jest.fn();
      const blurHandler = createTrimmedBlurHandler("  spaced   value  ", setValue);

      blurHandler();

      expect(setValue).toHaveBeenCalledWith("spaced value");
    });

    it("avoids setting state when value is already trimmed", () => {
      const setValue = jest.fn();
      const blurHandler = createTrimmedBlurHandler("clean value", setValue);

      blurHandler();

      expect(setValue).not.toHaveBeenCalled();
    });
  });
});
