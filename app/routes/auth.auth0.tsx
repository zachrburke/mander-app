// app/routes/auth/auth0.tsx
import { redirect, ActionFunctionArgs } from "@remix-run/node";

import { authenticator } from "~/auth.server";

export let loader = () => redirect("/login");

export let action = ({ request }: ActionFunctionArgs) => {
  return authenticator.authenticate("auth0", request);
};