import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "./store";

const get = () => useI18nStore.getState();

// The store touches browser globals directly; provide minimal stand-ins so it
// can run under the core package's Node (non-DOM) test environment.
let docStub: { cookie: string; documentElement: { lang: string } };

beforeEach(() => {
  docStub = { cookie: "", documentElement: { lang: "" } };
  vi.stubGlobal("document", docStub);
  vi.stubGlobal("window", {});
  useI18nStore.setState({ language: "en" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("i18n store", () => {
  it("defaults to English", () => {
    expect(get().language).toBe("en");
  });

  it("setLanguage updates state, cookie and document lang for zh", () => {
    get().setLanguage("zh");
    expect(get().language).toBe("zh");
    expect(docStub.documentElement.lang).toBe("zh-CN");
    expect(docStub.cookie).toContain("harness-locale=zh");
    expect(docStub.cookie).toContain("path=/");
    expect(docStub.cookie).toContain("SameSite=Lax");
  });

  it("setLanguage maps en to the 'en' document lang", () => {
    get().setLanguage("en");
    expect(docStub.documentElement.lang).toBe("en");
    expect(docStub.cookie).toContain("harness-locale=en");
  });

  it("initializeFromCookie reads zh from the cookie", () => {
    docStub.cookie = "foo=bar; harness-locale=zh; other=1";
    get().initializeFromCookie();
    expect(get().language).toBe("zh");
    expect(docStub.documentElement.lang).toBe("zh-CN");
  });

  it("initializeFromCookie falls back to en when no locale cookie is present", () => {
    docStub.cookie = "foo=bar";
    useI18nStore.setState({ language: "zh" });
    get().initializeFromCookie();
    expect(get().language).toBe("en");
    expect(docStub.documentElement.lang).toBe("en");
  });
});
