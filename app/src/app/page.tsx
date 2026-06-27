import { redirect } from "next/navigation";

// Always send root URL to login.
// The login page redirects logged-in users straight to /dashboard.
export default function RootPage() {
  redirect("/login");
}
