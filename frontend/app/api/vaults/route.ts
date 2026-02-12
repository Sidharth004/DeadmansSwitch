import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { BeneficiaryInput } from "@/lib/types";

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get("owner");
  const supabase = createSupabaseServerClient();

  let query = supabase.from("vaults").select("*").order("created_at", { ascending: false });
  if (owner) query = query.eq("owner_address", owner);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ownerAddress,
      vaultPda,
      warningPeriodDays,
      challengePeriodDays,
      ownerEmail,
      beneficiaries,
    }: {
      ownerAddress: string;
      vaultPda: string;
      warningPeriodDays: number;
      challengePeriodDays: number;
      ownerEmail: string | null;
      beneficiaries: BeneficiaryInput[];
    } = body;

    if (!ownerAddress || !vaultPda || !Array.isArray(beneficiaries)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const { data: vault, error: vaultError } = await supabase
      .from("vaults")
      .upsert(
        {
          owner_address: ownerAddress,
          vault_pda: vaultPda,
          state: "active",
          warning_period_days: warningPeriodDays,
          challenge_period_days: challengePeriodDays,
          owner_email: ownerEmail,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_address" }
      )
      .select()
      .single();

    if (vaultError || !vault) {
      return NextResponse.json({ error: vaultError?.message || "Could not save vault" }, { status: 500 });
    }

    const { error: deleteError } = await supabase.from("beneficiaries").delete().eq("vault_id", vault.id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (beneficiaries.length > 0) {
      const insertRows = beneficiaries.map((b) => ({
        vault_id: vault.id,
        address: b.address,
        share: b.share,
        email: b.email || null,
        has_claimed: false,
      }));

      const { error: benError } = await supabase.from("beneficiaries").insert(insertRows);
      if (benError) {
        return NextResponse.json({ error: benError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ id: vault.id, vaultPda: vault.vault_pda });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request" }, { status: 400 });
  }
}
