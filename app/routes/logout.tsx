// app/routes/auth/logout.ts
import type { ActionFunctionArgs } from "@remix-run/node";

import { redirect } from "@remix-run/node";

import { destroySession, getSession } from "~/sessions.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const session = await getSession(request.headers.get("Cookie"));
  const logoutURL = new URL(`https://${process.env.AUTH0_DOMAIN}/v2/logout`); 

  logoutURL.searchParams.set("client_id", process.env.AUTH0_CLIENT_ID!);
  logoutURL.searchParams.set("returnTo", process.env.AUTH0_RETURN_TO_URL!);

  return redirect(logoutURL.toString(), {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
};