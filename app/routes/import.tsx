import { LoaderFunction } from '@remix-run/node';

export const loader: LoaderFunction = async () => {
  return { message: 'Hello, world!' };
}

export default function Import() {
  return (
    <div>
      <h1>Import</h1>
    </div>
  );
}