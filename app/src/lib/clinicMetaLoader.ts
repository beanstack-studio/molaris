import { supabase } from "./supabaseClient";

export interface ClinicMetaFull {
  name: string;
  address: string;
  contact: string;
  logoUrl: string | null;
  licenseNo: string;
  ptrNo: string;
}

/**
 * Loads clinic profile and (optionally) dentist PRC/PTR for document generation.
 */
export async function loadClinicMeta(dentistId?: string): Promise<ClinicMetaFull> {
  const { data: profiles } = await supabase
    .from("clinic_profile")
    .select("*")
    .limit(1);
  const profile = profiles?.[0] as any;

  const addressParts = [
    profile?.street_address,
    profile?.city,
    profile?.province,
  ].filter(Boolean);
  const address = addressParts.join(", ");

  const phones: Array<{ type: string; number: string }> = profile?.phones || [];
  const contact = phones.map((p) => p.number).join(" / ");

  let licenseNo = "";
  let ptrNo = "";
  if (dentistId) {
    const { data: dentist } = await supabase
      .from("dentists")
      .select("prc_number, ptr_number")
      .eq("id", dentistId)
      .single();
    licenseNo = String((dentist as any)?.prc_number || "");
    ptrNo = String((dentist as any)?.ptr_number || "");
  }

  return {
    name: profile?.clinic_name || "Dental Clinic",
    address,
    contact,
    logoUrl: profile?.logo_url || null,
    licenseNo,
    ptrNo,
  };
}
