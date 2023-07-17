import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import callback from "./callback";
import { Bindings } from "./bindings";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/signin", async (c) => {
  return c.redirect(`https://github.com/login/oauth/authorize?client_id=${c.env.GITHUB_CLIENT_ID}`, 302);
});

app.route("/callback", callback);

app.get("/test", async (c) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) {
    return c.text("Unauthorized", 401);
  }
  const userName = await c.env.STORE_KV.get(sessionId);
  if (!userName) {
    return c.text("Unauthorized", 401);
  }
  return c.text(`Welcome, ${userName}`);
});

app.get("/signout", (c) => {
  const sessionId = getCookie(c, "session_id")!;
  setCookie(c, "session_id", "", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    maxAge: -60,
    path: "/",
  });
  c.env.STORE_KV.delete(sessionId);
  return c.text("Logouted", 200);
});

app.fire();

export default app;
