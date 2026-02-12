import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const { data: vault, error: vaultError } = await supabase
    .from("vaults")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (vaultError) {
    return NextResponse.json({ error: vaultError.message }, { status: 500 });
  }

  if (!vault) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  const { data: beneficiaries, error: benError } = await supabase
    .from("beneficiaries")
    .select("*")
    .eq("vault_id", params.id)
    .order("created_at", { ascending: true });

  if (benError) {
    return NextResponse.json({ error: benError.message }, { status: 500 });
  }

  return NextResponse.json({ ...vault, beneficiaries: beneficiaries ?? [] });
}
