import { createCookieSessionStorage } from "@remix-run/node";

export type SessionData = {
  userId: string;
  displayName: string | null;
};

export let sessionStorage = createCookieSessionStorage(
    {
      // a Cookie from `createCookie` or the CookieOptions to create one
      cookie: {
        name: "__session",

        // all of these are optional
        // Expires can also be set (although maxAge overrides it when used in combination).
        // Note that this method is NOT recommended as `new Date` creates only one date on each server deployment, not a dynamic date in the future!
        //
        // expires: new Date(Date.now() + 60_000),
        httpOnly: true,
        maxAge: 36000,
        path: "/",
        sameSite: "lax",
        secrets: [process.env.SESSION_SECRET],
        secure: true,
      },
    }
  );

export let { getSession, commitSession, destroySession } = sessionStorage;