import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { v4 as uuidv4 } from "uuid";
import z from "zod";
import { Bindings } from "./bindings";

const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

interface GitHubAccessTokenRequest {
  access_token?: string;
  scope?: string;
  token_type?: string;
}

const auth = new Hono<{ Bindings: Bindings }>();

const paramSchema = z.object({
  code: z.string(),
});

auth.get(
  "/",
  zValidator("query", paramSchema, (result, c) => {
    if (!result.success) {
      return c.text("Bad Request", 400);
    }
  }),
  async (c) => {
    const param = c.req.valid("query");
    try {
      // get an access token
      const accessTokenResponse = await fetch(GITHUB_ACCESS_TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: c.env.GITHUB_CLIENT_ID,
          client_secret: c.env.GITHUB_CLIENT_SECRET,
          code: param.code,
        }),
      });
      if (!accessTokenResponse.ok) {
        return c.text("Failed to get an access token", 500);
      }
      const accessTokenJson: GitHubAccessTokenRequest =
        await accessTokenResponse.json();
      if (!accessTokenJson.access_token) {
        return c.text("Failed to get an access token", 500);
      }

      // get a user name
      const userResponse = await fetch(GITHUB_USER_URL, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${accessTokenJson.access_token}`,
          "User-Agent": "photon",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!userResponse.ok) {
        return c.text("Failed to get the user info", 500);
      }
      const userJson: { [key in string]?: string } = await userResponse.json();
      const userName = userJson.login;
      if (!userName) {
        return c.text("Unauthorized", 401);
      }

      // start a session
      const ttl = 60 * 60 * 24;
      const sessionId = uuidv4();
      setCookie(c, "session_id", sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        maxAge: ttl,
        path: "/",
      });
      await c.env.STORE_KV.put(sessionId, userName, {
        expirationTtl: ttl,
      });
      return c.redirect("/test", 302);
    } catch (e) {
      console.log(e);
      c.text(`Internal Server Error: ${e}`, 500);
    }
  }
);

export default auth;