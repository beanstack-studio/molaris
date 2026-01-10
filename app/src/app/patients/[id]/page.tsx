import { redirect } from "next/navigation";

export default function PatientIndexPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/patients/${params.id}/info`);
}
