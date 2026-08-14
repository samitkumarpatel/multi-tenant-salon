import { redirect } from "react-router";

export async function clientLoader() {
  throw redirect("/login");
}

// Never rendered — clientLoader always redirects
export default function Home() {
  return null;
}
