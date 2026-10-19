// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SocialLinks } from "./SocialLinks";

afterEach(cleanup);

describe("SocialLinks", () => {
  it("renders GitHub and LinkedIn links with the given URLs", () => {
    render(
      <SocialLinks
        githubUrl="https://github.com/angelortjimz/animatch"
        linkedinUrl="https://www.linkedin.com/in/test"
      />,
    );

    const github = screen.getByRole("link", { name: /GitHub profile/i });
    const linkedin = screen.getByRole("link", { name: /LinkedIn profile/i });

    expect(github.getAttribute("href")).toBe("https://github.com/angelortjimz/animatch");
    expect(linkedin.getAttribute("href")).toBe("https://www.linkedin.com/in/test");
  });

  it("opens every social link in a new tab securely", () => {
    render(
      <SocialLinks
        githubUrl="https://github.com/example"
        linkedinUrl="https://www.linkedin.com/in/example"
      />,
    );

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("exposes the social links region with a label", () => {
    render(
      <SocialLinks githubUrl="https://github.com/example" linkedinUrl="https://linkedin.com" />,
    );
    expect(screen.getByRole("navigation", { name: "Social links" })).toBeTruthy();
  });
});
