import { redirect } from "react-router";

export function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  throw redirect(`/users${url.search}`);
}

export default function Customers() { return null; }
