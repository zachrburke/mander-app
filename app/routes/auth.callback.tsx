// app/routes/auth/auth0/callback.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";

import { authenticator } from "~/auth.server";

export let loader = ({ request }: LoaderFunctionArgs) => {
  return authenticator.authenticate("auth0", request, {
    successRedirect: "/",
    failureRedirect: "/login",
  });
};