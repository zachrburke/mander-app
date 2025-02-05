import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction, LoaderFunction } from "@remix-run/node";
import {
  Form,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import styles from "~/styles/site.css";
import { authenticator } from "~/auth.server";
import { SessionData } from "./sessions.server";

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
];

export const loader: LoaderFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);
  return { user };
};

export default function App() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inconsolata:wght@200;300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href={styles} />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning={true}>
        <header>
          <a href="/">
            <img className="logo" src="/logo.png" alt="Mander" />
          </a>
          <h1>Mander</h1>
          <LoginView user={user} />
        </header>
        <main>
          <Outlet />
        </main>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

const LoginView = ({ user }: { user: SessionData | null }) => {
  if (user) {
    return (
      <Form action="/logout" method="post" className="login">
        <p>{user.displayName}</p>
        <button>Logout</button>
      </Form>
    );
  }
  return (null);
}