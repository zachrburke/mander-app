import { Form } from "@remix-run/react";

// app/routes/login.tsx
export default function Login() {
  return (
    <Form action="/auth/auth0" method="post">
      <p>
        Login to begin using Mander. <br />
      </p>
      <button>Login</button>
    </Form>
  );
}