import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { BeneficiaryInput } from "@/lib/types";
import { PublicKey } from "@solana/web3.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    if (beneficiaries.length === 0 || beneficiaries.length > 5) {
      return NextResponse.json({ error: "Beneficiary count must be between 1 and 5." }, { status: 400 });
    }
    if (!Number.isInteger(warningPeriodDays) || warningPeriodDays < 1) {
      return NextResponse.json({ error: "warningPeriodDays must be a positive integer." }, { status: 400 });
    }
    if (!Number.isInteger(challengePeriodDays) || challengePeriodDays < 1) {
      return NextResponse.json({ error: "challengePeriodDays must be a positive integer." }, { status: 400 });
    }

    try {
      new PublicKey(ownerAddress);
      new PublicKey(vaultPda);
    } catch {
      return NextResponse.json({ error: "ownerAddress or vaultPda is invalid." }, { status: 400 });
    }

    if (ownerEmail && !EMAIL_REGEX.test(ownerEmail)) {
      return NextResponse.json({ error: "ownerEmail is invalid." }, { status: 400 });
    }

    const totalShares = beneficiaries.reduce((sum, item) => sum + item.share, 0);
    if (totalShares !== 100) {
      return NextResponse.json({ error: "Beneficiary shares must total 100." }, { status: 400 });
    }

    const normalizedAddresses = beneficiaries.map((b) => b.address.trim());
    if (new Set(normalizedAddresses).size !== normalizedAddresses.length) {
      return NextResponse.json({ error: "Beneficiary wallet addresses must be unique." }, { status: 400 });
    }

    for (const [index, beneficiary] of beneficiaries.entries()) {
      if (!Number.isInteger(beneficiary.share) || beneficiary.share < 1 || beneficiary.share > 100) {
        return NextResponse.json(
          { error: `Beneficiary #${index + 1} share must be an integer between 1 and 100.` },
          { status: 400 }
        );
      }
      try {
        new PublicKey(beneficiary.address.trim());
      } catch {
        return NextResponse.json(
          { error: `Beneficiary #${index + 1} address is invalid.` },
          { status: 400 }
        );
      }
      if (beneficiary.email && !EMAIL_REGEX.test(beneficiary.email)) {
        return NextResponse.json(
          { error: `Beneficiary #${index + 1} email is invalid.` },
          { status: 400 }
        );
      }
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
        address: b.address.trim(),
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
