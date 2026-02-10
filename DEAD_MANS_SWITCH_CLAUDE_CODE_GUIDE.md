# Dead Man's Switch — Claude Code Development Guide

> **Complete development specification for building Dead Man's Switch autonomously**

---

## 🎯 Project Mission

Build an autonomous AI agent + Solana program that ensures crypto assets reach loved ones if something happens to the owner:

1. **Vault System**: Anchor program (Rust) for trustless asset custody
2. **Monitoring Agent**: TypeScript agent that watches wallet activity
3. **Auto Check-In**: Automatically resets timer when owner is active
4. **Multi-Stage Verification**: Warning → Challenge → Claimable (prevents false triggers)
5. **Notifications**: Email + Telegram alerts at each stage
6. **Claim Interface**: Simple UI for beneficiaries to claim assets

**Core Value:** Solving the $20B+ crypto inheritance problem with a trustless, non-custodial system.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & System Design](#architecture--system-design)
3. [Tech Stack & Dependencies](#tech-stack--dependencies)
4. [Anchor Program Specification](#anchor-program-specification)
5. [Agent Specifications](#agent-specifications)
6. [Frontend Specifications](#frontend-specifications)
7. [Phase-by-Phase Development Plan](#phase-by-phase-development-plan)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Instructions](#deployment-instructions)
10. [Success Criteria](#success-criteria)

---

## Project Overview

### The Problem

**Crypto Inheritance Gap:**
- $20B+ in crypto permanently lost due to owners dying without sharing access
- No built-in beneficiary system in blockchain
- Traditional estate planning doesn't cover crypto well
- Current solutions: expensive ($250/year), centralized, or don't exist

### Our Solution

**Dead Man's Switch = Anchor Program + AI Agent**

```
┌─────────────────────────────────────────────────┐
│              DEAD MAN'S SWITCH                  │
│                                                 │
│  ┌──────────────┐         ┌─────────────────┐  │
│  │   ANCHOR     │         │   MONITORING    │  │
│  │   PROGRAM    │◄────────┤     AGENT       │  │
│  │   (Rust)     │         │  (TypeScript)   │  │
│  │              │         │                 │  │
│  │ • Vault PDA  │         │ • Helius API    │  │
│  │ • Time locks │         │ • Auto check-in │  │
│  │ • Claims     │         │ • Notifications │  │
│  └──────┬───────┘         └─────────────────┘  │
│         │                                       │
│         ▼                                       │
│  ┌──────────────────────────────────────────┐  │
│  │         NEXT.JS FRONTEND                  │  │
│  │  • Vault creation • Claim interface       │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Core Components

**1. Anchor Program (Solana Smart Contract)**
- Holds assets in PDA vault
- Time-lock mechanism with multi-stage states
- Beneficiary configuration and claiming
- Owner check-in to reset timer

**2. Monitoring Agent (Background Service)**
- Watches owner's wallet(s) for on-chain activity
- Auto-calls check-in when activity detected
- Advances vault state when timeouts expire
- Sends notifications (Telegram + Email)

**3. Web Interface (Next.js)**
- Vault creation and configuration
- Beneficiary management
- Claim interface for beneficiaries

---

## Architecture & System Design

### High-Level Flow

```
SETUP PHASE:
1. Owner creates vault via UI
2. Anchor program initializes PDA
3. Owner deposits SOL/tokens
4. Owner configures beneficiaries + timeouts
5. Agent starts monitoring owner's wallet(s)

NORMAL OPERATION:
1. Agent checks wallet activity every hour
2. If activity detected → auto-call check_in instruction
3. Timer resets → vault stays in ACTIVE state
4. Owner never needs to manually check in

INACTIVE SCENARIO:
1. No activity for 90 days
2. Agent advances state to WARNING
3. Sends alerts: "Please check in"
4. Still no activity for 15 days (challenge period)
5. Agent advances state to CHALLENGE
6. Sends urgent alerts
7. Still no activity for 15 more days
8. Agent advances state to CLAIMABLE
9. Beneficiaries can claim their shares

CLAIM PHASE:
1. Beneficiary visits claim page
2. Connects wallet
3. Calls claim instruction
4. Receives their % of vault assets
```

### State Machine

```
┌──────────┐
│  ACTIVE  │◄──────────────────┐
│ (Normal) │                   │
└────┬─────┘                   │
     │                         │
     │ 90 days inactive        │
     │                         │
     ▼                         │
┌──────────┐                   │
│ WARNING  │                   │
│(15 days) │                   │ check_in()
└────┬─────┘                   │ resets to
     │                         │ ACTIVE
     │ +15 days no response    │
     │                         │
     ▼                         │
┌──────────┐                   │
│CHALLENGE │                   │
│(15 days) │                   │
└────┬─────┘                   │
     │                         │
     │ +15 days no response    │
     │                         │
     ▼                         │
┌──────────┐                   │
│CLAIMABLE │                   │
│(Forever) │───────────────────┘
└──────────┘
     │
     │ claim()
     ▼
┌──────────┐
│ CLAIMED  │
│ (Final)  │
└──────────┘
```

---

## Tech Stack & Dependencies

### Core Technologies

| Layer | Technology | Why |
|-------|-----------|-----|
| **Smart Contract** | Anchor 0.30+ (Rust) | Best Solana framework, safety checks |
| **Agent Runtime** | Node.js 20 + TypeScript | Best ecosystem for Solana integrations |
| **Frontend** | Next.js 14 + React | Modern, SEO-friendly, wallet integration |
| **Database** | PostgreSQL (Supabase) | Track vaults, monitor state |
| **Wallet Integration** | AgentWallet | Required for hackathon |
| **Testing** | Bankrun + Vitest | Fast Solana program testing |

### Package Dependencies

#### Anchor Program (Rust)

```toml
# Cargo.toml
[package]
name = "dead-mans-switch"
version = "0.1.0"
edition = "2021"

[dependencies]
anchor-lang = "0.30.0"
anchor-spl = "0.30.0"

[dev-dependencies]
solana-program-test = "1.18"
```

#### Agent (TypeScript)

```json
{
  "name": "dms-agent",
  "dependencies": {
    "@solana/web3.js": "^1.95.3",
    "@coral-xyz/anchor": "^0.30.1",
    "helius-sdk": "^1.3.7",
    "@supabase/supabase-js": "^2.45.4",
    "telegraf": "^4.16.3",
    "nodemailer": "^6.9.14",
    "@agentwallet/sdk": "latest",
    "dotenv": "^16.4.5",
    "pino": "^9.4.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.5.5",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

#### Frontend (Next.js)

```json
{
  "name": "dms-frontend",
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "@solana/wallet-adapter-react": "^0.15.35",
    "@solana/wallet-adapter-wallets": "^0.19.32",
    "@coral-xyz/anchor": "^0.30.1",
    "@solana/web3.js": "^1.95.3",
    "tailwindcss": "^3.4.0"
  }
}
```

### External Services

| Service | Purpose | Free Tier | Cost |
|---------|---------|-----------|------|
| **Helius** | RPC + wallet monitoring | 1M credits/month | Free |
| **Supabase** | PostgreSQL database | 500MB | Free |
| **Resend** | Email notifications | 100/day | Free |
| **Telegram** | Telegram bot | Unlimited | Free |
| **AgentWallet** | Wallet management | Per hackathon rules | Free |
| **Vercel** | Frontend hosting | Unlimited | Free |
| **Railway** | Agent hosting | $5 credit/month | ~$0-5 |

---

## Anchor Program Specification

### Overview

The Anchor program is the **core** of the system. It must be:
- **Secure**: No bugs, proper access control
- **Simple**: Minimal attack surface
- **Testable**: Comprehensive test coverage
- **Auditable**: Clear, documented code

### Account Structures

```rust
// programs/dead-mans-switch/src/lib.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer};

declare_id!("DMS1111111111111111111111111111111111111111");

#[program]
pub mod dead_mans_switch {
    use super::*;

    // 1. Initialize vault
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        warning_period_seconds: i64,
        challenge_period_seconds: i64,
        beneficiaries: Vec<BeneficiaryConfig>,
    ) -> Result<()> {
        require!(
            beneficiaries.len() > 0 && beneficiaries.len() <= 5,
            ErrorCode::InvalidBeneficiaries
        );
        
        // Verify shares add up to 100%
        let total_share: u8 = beneficiaries.iter().map(|b| b.share).sum();
        require!(total_share == 100, ErrorCode::InvalidShares);
        
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.state = VaultState::Active;
        vault.warning_period_seconds = warning_period_seconds;
        vault.challenge_period_seconds = challenge_period_seconds;
        vault.last_checkin_timestamp = Clock::get()?.unix_timestamp;
        vault.beneficiaries = beneficiaries;
        vault.bump = ctx.bumps.vault;
        
        Ok(())
    }

    // 2. Deposit SOL
    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.state == VaultState::Active, ErrorCode::VaultNotActive);
        
        // Transfer SOL from owner to vault PDA
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: vault.to_account_info(),
                },
            ),
            amount,
        )?;
        
        vault.sol_balance += amount;
        Ok(())
    }

    // 3. Check in (resets timer)
    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        
        // Can check in from any state except Claimed
        require!(vault.state != VaultState::Claimed, ErrorCode::VaultClaimed);
        
        vault.state = VaultState::Active;
        vault.last_checkin_timestamp = Clock::get()?.unix_timestamp;
        
        msg!("Check-in successful. Timer reset.");
        Ok(())
    }

    // 4. Advance state (WARNING → CHALLENGE → CLAIMABLE)
    pub fn advance_state(ctx: Context<AdvanceState>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        let elapsed = current_time - vault.last_checkin_timestamp;
        
        match vault.state {
            VaultState::Active => {
                // Check if warning period has elapsed
                if elapsed >= vault.warning_period_seconds {
                    vault.state = VaultState::Warning;
                    vault.warning_triggered_at = Some(current_time);
                    msg!("State advanced to WARNING");
                } else {
                    return Err(ErrorCode::TimelockNotExpired.into());
                }
            }
            VaultState::Warning => {
                // Check if challenge period has elapsed since warning
                let warning_time = vault.warning_triggered_at.unwrap();
                let warning_elapsed = current_time - warning_time;
                
                if warning_elapsed >= vault.challenge_period_seconds {
                    vault.state = VaultState::Challenge;
                    vault.challenge_triggered_at = Some(current_time);
                    msg!("State advanced to CHALLENGE");
                } else {
                    return Err(ErrorCode::TimelockNotExpired.into());
                }
            }
            VaultState::Challenge => {
                // Check if final challenge period has elapsed
                let challenge_time = vault.challenge_triggered_at.unwrap();
                let challenge_elapsed = current_time - challenge_time;
                
                if challenge_elapsed >= vault.challenge_period_seconds {
                    vault.state = VaultState::Claimable;
                    msg!("State advanced to CLAIMABLE");
                } else {
                    return Err(ErrorCode::TimelockNotExpired.into());
                }
            }
            VaultState::Claimable => {
                return Err(ErrorCode::AlreadyClaimable.into());
            }
            VaultState::Claimed => {
                return Err(ErrorCode::VaultClaimed.into());
            }
        }
        
        Ok(())
    }

    // 5. Claim (beneficiary claims their share)
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        
        require!(vault.state == VaultState::Claimable, ErrorCode::NotClaimable);
        
        // Find beneficiary and their share
        let beneficiary_pubkey = ctx.accounts.beneficiary.key();
        let beneficiary_config = vault.beneficiaries
            .iter()
            .find(|b| b.address == beneficiary_pubkey)
            .ok_or(ErrorCode::NotABeneficiary)?;
        
        require!(!beneficiary_config.has_claimed, ErrorCode::AlreadyClaimed);
        
        // Calculate amount to transfer
        let share_amount = (vault.sol_balance as u128)
            .checked_mul(beneficiary_config.share as u128)
            .unwrap()
            .checked_div(100)
            .unwrap() as u64;
        
        // Transfer SOL from vault to beneficiary
        **vault.to_account_info().try_borrow_mut_lamports()? -= share_amount;
        **ctx.accounts.beneficiary.to_account_info().try_borrow_mut_lamports()? += share_amount;
        
        // Mark as claimed
        let beneficiary_mut = vault.beneficiaries
            .iter_mut()
            .find(|b| b.address == beneficiary_pubkey)
            .unwrap();
        beneficiary_mut.has_claimed = true;
        
        // Check if all beneficiaries have claimed
        let all_claimed = vault.beneficiaries.iter().all(|b| b.has_claimed);
        if all_claimed {
            vault.state = VaultState::Claimed;
        }
        
        msg!("Beneficiary claimed {} lamports", share_amount);
        Ok(())
    }

    // 6. Cancel (owner cancels and withdraws)
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let vault = &ctx.accounts.vault;
        
        require!(vault.state != VaultState::Claimed, ErrorCode::VaultClaimed);
        
        // Transfer all SOL back to owner
        let vault_lamports = vault.to_account_info().lamports();
        let rent_exempt = Rent::get()?.minimum_balance(vault.to_account_info().data_len());
        let withdrawable = vault_lamports.checked_sub(rent_exempt).unwrap();
        
        **vault.to_account_info().try_borrow_mut_lamports()? -= withdrawable;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += withdrawable;
        
        msg!("Vault cancelled. {} lamports returned to owner", withdrawable);
        Ok(())
    }
}

// Account Structures

#[account]
#[derive(Default)]
pub struct Vault {
    pub owner: Pubkey,                          // 32
    pub state: VaultState,                      // 1
    pub warning_period_seconds: i64,            // 8
    pub challenge_period_seconds: i64,          // 8
    pub last_checkin_timestamp: i64,            // 8
    pub warning_triggered_at: Option<i64>,      // 9
    pub challenge_triggered_at: Option<i64>,    // 9
    pub sol_balance: u64,                       // 8
    pub beneficiaries: Vec<BeneficiaryConfig>,  // 4 + (32+1+1)*5 = 174
    pub bump: u8,                               // 1
}
// Total: ~258 bytes

impl Vault {
    pub const LEN: usize = 8 + 32 + 1 + 8 + 8 + 8 + 9 + 9 + 8 + 174 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct BeneficiaryConfig {
    pub address: Pubkey,      // 32
    pub share: u8,            // 1 (percentage, e.g., 60 = 60%)
    pub has_claimed: bool,    // 1
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum VaultState {
    #[default]
    Active,      // 0
    Warning,     // 1
    Challenge,   // 2
    Claimable,   // 3
    Claimed,     // 4
}

// Context Structures

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = owner,
        space = Vault::LEN,
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckIn<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner
    )]
    pub vault: Account<'info, Vault>,
    
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct AdvanceState<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    
    // No signer required - anyone can advance state
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub beneficiary: Signer<'info>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
        close = owner
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
}

// Error Codes

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid beneficiaries configuration")]
    InvalidBeneficiaries,
    
    #[msg("Beneficiary shares must add up to 100%")]
    InvalidShares,
    
    #[msg("Vault is not in active state")]
    VaultNotActive,
    
    #[msg("Vault has been claimed")]
    VaultClaimed,
    
    #[msg("Timelock has not expired yet")]
    TimelockNotExpired,
    
    #[msg("Vault is already claimable")]
    AlreadyClaimable,
    
    #[msg("Vault is not claimable yet")]
    NotClaimable,
    
    #[msg("Not a beneficiary of this vault")]
    NotABeneficiary,
    
    #[msg("Beneficiary has already claimed")]
    AlreadyClaimed,
}
```

### Tests (Bankrun)

```typescript
// tests/dead-mans-switch.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { BankrunProvider, startAnchor } from 'solana-bankrun';
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { DeadMansSwitch } from '../target/types/dead_mans_switch';

describe('Dead Mans Switch', () => {
  let provider: BankrunProvider;
  let program: Program<DeadMansSwitch>;
  let owner: Keypair;
  let beneficiary1: Keypair;
  let beneficiary2: Keypair;
  let vaultPda: PublicKey;

  beforeAll(async () => {
    // Start Bankrun (fast in-memory Solana runtime)
    const context = await startAnchor(
      '',
      [{ name: 'dead_mans_switch', programId: new PublicKey('DMS1111111111111111111111111111111111111111') }],
      []
    );
    
    provider = new BankrunProvider(context);
    program = new Program<DeadMansSwitch>(IDL, provider);
    
    owner = Keypair.generate();
    beneficiary1 = Keypair.generate();
    beneficiary2 = Keypair.generate();
    
    // Airdrop SOL to owner
    await provider.connection.requestAirdrop(owner.publicKey, 100 * LAMPORTS_PER_SOL);
    
    // Derive vault PDA
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), owner.publicKey.toBuffer()],
      program.programId
    );
  });

  it('initializes vault', async () => {
    const tx = await program.methods
      .initializeVault(
        60, // 60 seconds warning period (for testing)
        30, // 30 seconds challenge period
        [
          { address: beneficiary1.publicKey, share: 60, hasClaimed: false },
          { address: beneficiary2.publicKey, share: 40, hasClaimed: false },
        ]
      )
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .signers([owner])
      .rpc();
    
    const vault = await program.account.vault.fetch(vaultPda);
    
    expect(vault.owner.toString()).toBe(owner.publicKey.toString());
    expect(vault.state).toEqual({ active: {} });
    expect(vault.beneficiaries).toHaveLength(2);
    expect(vault.beneficiaries[0].share).toBe(60);
  });

  it('deposits SOL', async () => {
    await program.methods
      .depositSol(new BN(10 * LAMPORTS_PER_SOL))
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .signers([owner])
      .rpc();
    
    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.solBalance.toNumber()).toBe(10 * LAMPORTS_PER_SOL);
  });

  it('checks in successfully', async () => {
    await program.methods
      .checkIn()
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .signers([owner])
      .rpc();
    
    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.state).toEqual({ active: {} });
  });

  it('advances to WARNING after timeout', async () => {
    // Wait 61 seconds (warning period = 60s)
    await new Promise(resolve => setTimeout(resolve, 61000));
    
    await program.methods
      .advanceState()
      .accounts({
        vault: vaultPda,
      })
      .rpc();
    
    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.state).toEqual({ warning: {} });
  });

  it('advances to CHALLENGE after warning period', async () => {
    // Wait 31 seconds (challenge period = 30s)
    await new Promise(resolve => setTimeout(resolve, 31000));
    
    await program.methods
      .advanceState()
      .accounts({
        vault: vaultPda,
      })
      .rpc();
    
    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.state).toEqual({ challenge: {} });
  });

  it('advances to CLAIMABLE after challenge period', async () => {
    await new Promise(resolve => setTimeout(resolve, 31000));
    
    await program.methods
      .advanceState()
      .accounts({
        vault: vaultPda,
      })
      .rpc();
    
    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.state).toEqual({ claimable: {} });
  });

  it('beneficiary1 claims 60%', async () => {
    const balanceBefore = await provider.connection.getBalance(beneficiary1.publicKey);
    
    await program.methods
      .claim()
      .accounts({
        vault: vaultPda,
        beneficiary: beneficiary1.publicKey,
      })
      .signers([beneficiary1])
      .rpc();
    
    const balanceAfter = await provider.connection.getBalance(beneficiary1.publicKey);
    const received = balanceAfter - balanceBefore;
    
    expect(received).toBe(6 * LAMPORTS_PER_SOL); // 60% of 10 SOL
  });

  it('beneficiary2 claims 40%', async () => {
    const balanceBefore = await provider.connection.getBalance(beneficiary2.publicKey);
    
    await program.methods
      .claim()
      .accounts({
        vault: vaultPda,
        beneficiary: beneficiary2.publicKey,
      })
      .signers([beneficiary2])
      .rpc();
    
    const balanceAfter = await provider.connection.getBalance(beneficiary2.publicKey);
    const received = balanceAfter - balanceBefore;
    
    expect(received).toBe(4 * LAMPORTS_PER_SOL); // 40% of 10 SOL
    
    // Vault should now be in CLAIMED state
    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.state).toEqual({ claimed: {} });
  });
});
```

---

## Agent Specifications

### Overview

The agent is a **background service** that:
1. Monitors owner wallet(s) for on-chain activity
2. Automatically calls `check_in` when activity detected
3. Advances vault state when timeouts expire
4. Sends notifications at each state transition

### Core Logic

```typescript
// agent/src/monitor.ts
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Helius } from 'helius-sdk';
import { AgentWallet } from '@agentwallet/sdk';
import { supabase } from './database';
import { sendTelegramAlert, sendEmailAlert } from './notifications';
import { logger } from './logger';

const helius = new Helius(process.env.HELIUS_API_KEY!);
const connection = new Connection(process.env.SOLANA_RPC_URL!);

export class VaultMonitor {
  private program: Program;
  private wallet: AgentWallet;

  async start() {
    logger.info('🚀 Starting Dead Mans Switch Monitor...');
    
    // Initialize agent wallet
    this.wallet = await AgentWallet.create({
      apiKey: process.env.AGENTWALLET_API_KEY!
    });
    
    // Initialize Anchor program
    const provider = new AnchorProvider(connection, this.wallet, {});
    this.program = new Program(IDL, provider);
    
    // Start monitoring loops
    this.startActivityMonitoring();
    this.startStateAdvancement();
    
    logger.info('✅ Monitor running');
  }

  // Loop 1: Check wallet activity every hour
  private async startActivityMonitoring() {
    setInterval(async () => {
      try {
        await this.checkAllVaults();
      } catch (error) {
        logger.error({ error }, 'Activity monitoring error');
      }
    }, 60 * 60 * 1000); // Every hour
    
    // Run immediately on start
    await this.checkAllVaults();
  }

  private async checkAllVaults() {
    logger.info('Checking all vaults for activity...');
    
    // Get all active vaults from database
    const { data: vaults } = await supabase
      .from('vaults')
      .select('*')
      .in('state', ['active', 'warning', 'challenge']);
    
    if (!vaults) return;
    
    for (const vault of vaults) {
      await this.checkVaultActivity(vault);
    }
  }

  private async checkVaultActivity(vault: VaultRecord) {
    const ownerPubkey = new PublicKey(vault.owner_address);
    
    // Check for recent on-chain activity
    const signatures = await connection.getSignaturesForAddress(
      ownerPubkey,
      { limit: 1 }
    );
    
    if (signatures.length === 0) {
      logger.info({ vault: vault.id }, 'No activity found');
      return;
    }
    
    const lastActivityTime = signatures[0].blockTime!;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceActivity = currentTime - lastActivityTime;
    
    // If activity in last hour, call check_in
    if (timeSinceActivity < 3600) {
      logger.info({ vault: vault.id }, 'Recent activity detected, calling check_in');
      await this.performCheckIn(vault);
    }
  }

  private async performCheckIn(vault: VaultRecord) {
    try {
      const vaultPda = this.getVaultPda(vault.owner_address);
      
      // Call check_in instruction
      // Note: This needs to be signed by the OWNER, not the agent
      // So we need owner to have delegated check_in authority, OR
      // we just detect activity and send a reminder to owner to check in manually
      
      // For MVP: Send notification instead of auto-calling
      await this.sendCheckInReminder(vault);
      
      // Alternative: If owner has delegated authority via a separate program,
      // agent can call on their behalf
      
    } catch (error) {
      logger.error({ error, vault: vault.id }, 'Check-in failed');
    }
  }

  // Loop 2: Check if vaults need state advancement
  private async startStateAdvancement() {
    setInterval(async () => {
      try {
        await this.advanceAllVaults();
      } catch (error) {
        logger.error({ error }, 'State advancement error');
      }
    }, 10 * 60 * 1000); // Every 10 minutes
    
    await this.advanceAllVaults();
  }

  private async advanceAllVaults() {
    logger.info('Checking vaults for state advancement...');
    
    const { data: vaults } = await supabase
      .from('vaults')
      .select('*')
      .in('state', ['active', 'warning', 'challenge']);
    
    if (!vaults) return;
    
    for (const vault of vaults) {
      await this.tryAdvanceState(vault);
    }
  }

  private async tryAdvanceState(vault: VaultRecord) {
    const vaultPda = this.getVaultPda(vault.owner_address);
    
    try {
      // Fetch on-chain vault state
      const vaultAccount = await this.program.account.vault.fetch(vaultPda);
      
      const currentTime = Math.floor(Date.now() / 1000);
      const elapsed = currentTime - vaultAccount.lastCheckinTimestamp.toNumber();
      
      // Determine if state can advance
      let canAdvance = false;
      
      if (vaultAccount.state.active && elapsed >= vaultAccount.warningPeriodSeconds.toNumber()) {
        canAdvance = true;
      } else if (vaultAccount.state.warning) {
        const warningTime = vaultAccount.warningTriggeredAt.toNumber();
        const warningElapsed = currentTime - warningTime;
        if (warningElapsed >= vaultAccount.challengePeriodSeconds.toNumber()) {
          canAdvance = true;
        }
      } else if (vaultAccount.state.challenge) {
        const challengeTime = vaultAccount.challengeTriggeredAt.toNumber();
        const challengeElapsed = currentTime - challengeTime;
        if (challengeElapsed >= vaultAccount.challengePeriodSeconds.toNumber()) {
          canAdvance = true;
        }
      }
      
      if (canAdvance) {
        logger.info({ vault: vault.id }, 'Advancing vault state');
        await this.advanceState(vault, vaultAccount);
      }
      
    } catch (error) {
      logger.error({ error, vault: vault.id }, 'Failed to advance state');
    }
  }

  private async advanceState(vault: VaultRecord, vaultAccount: any) {
    const vaultPda = this.getVaultPda(vault.owner_address);
    
    // Call advance_state instruction (no signer required)
    const tx = await this.program.methods
      .advanceState()
      .accounts({
        vault: vaultPda,
      })
      .rpc();
    
    logger.info({ vault: vault.id, tx }, 'State advanced');
    
    // Determine new state and send notifications
    let newState: string;
    if (vaultAccount.state.active) {
      newState = 'warning';
      await this.sendWarningNotification(vault);
    } else if (vaultAccount.state.warning) {
      newState = 'challenge';
      await this.sendChallengeNotification(vault);
    } else if (vaultAccount.state.challenge) {
      newState = 'claimable';
      await this.sendClaimableNotification(vault);
    }
    
    // Update database
    await supabase
      .from('vaults')
      .update({ state: newState, updated_at: new Date().toISOString() })
      .eq('id', vault.id);
  }

  private async sendWarningNotification(vault: VaultRecord) {
    const message = 
      `⚠️ WARNING: Dead Man's Switch Activated\n\n` +
      `No activity detected on your wallet for ${vault.warning_period_days} days.\n\n` +
      `Please check in to keep your switch active:\n` +
      `${process.env.APP_URL}/vault/${vault.id}\n\n` +
      `If no response in ${vault.challenge_period_days} days, challenge period begins.`;
    
    await sendTelegramAlert(vault.telegram_chat_id, message);
    await sendEmailAlert(vault.owner_email, 'Dead Man\'s Switch Warning', message);
  }

  private async sendChallengeNotification(vault: VaultRecord) {
    const message = 
      `🚨 URGENT: Dead Man's Switch Challenge Period\n\n` +
      `Still no activity detected.\n\n` +
      `If you are alive and well, please check in IMMEDIATELY:\n` +
      `${process.env.APP_URL}/vault/${vault.id}\n\n` +
      `Assets will become claimable in ${vault.challenge_period_days} days.`;
    
    await sendTelegramAlert(vault.telegram_chat_id, message);
    await sendEmailAlert(vault.owner_email, 'URGENT: Dead Man\'s Switch Challenge', message);
  }

  private async sendClaimableNotification(vault: VaultRecord) {
    // Notify owner (final attempt)
    const ownerMessage = 
      `⚰️ Dead Man's Switch: Assets Now Claimable\n\n` +
      `Your assets are now available to beneficiaries.\n\n` +
      `If this is a mistake, contact support immediately.`;
    
    await sendTelegramAlert(vault.telegram_chat_id, ownerMessage);
    await sendEmailAlert(vault.owner_email, 'Dead Man\'s Switch: Assets Claimable', ownerMessage);
    
    // Notify beneficiaries
    const { data: beneficiaries } = await supabase
      .from('beneficiaries')
      .select('*')
      .eq('vault_id', vault.id);
    
    if (beneficiaries) {
      for (const beneficiary of beneficiaries) {
        const beneficiaryMessage = 
          `💼 Inheritance Available\n\n` +
          `Assets from Dead Man's Switch vault are now claimable.\n\n` +
          `Your share: ${beneficiary.share}%\n` +
          `Claim at: ${process.env.APP_URL}/claim/${vault.id}`;
        
        await sendEmailAlert(beneficiary.email, 'Inheritance Available', beneficiaryMessage);
      }
    }
  }

  private getVaultPda(ownerAddress: string): PublicKey {
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), new PublicKey(ownerAddress).toBuffer()],
      this.program.programId
    );
    return vaultPda;
  }
}

// Start the monitor
const monitor = new VaultMonitor();
monitor.start().catch(console.error);
```

### Telegram Bot (Interactive Commands)

The Telegram bot provides **two functions**:
1. **Interactive commands** - Users can check status and check in via bot
2. **Alert notifications** - Automated alerts at each state transition

```typescript
// agent/src/bot/index.ts
import { Telegraf, Context } from 'telegraf';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { supabase } from '../database';
import { logger } from '../logger';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const connection = new Connection(process.env.SOLANA_RPC_URL!);

export class DeadMansSwitchBot {
  private program: Program;

  async start() {
    logger.info('🤖 Starting Telegram bot...');
    
    // Initialize program
    // ... program setup ...
    
    this.setupCommands();
    
    await bot.launch();
    logger.info('✅ Telegram bot running');
    
    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }

  private setupCommands() {
    // Command: /start
    bot.command('start', async (ctx) => {
      await ctx.reply(
        '👋 *Welcome to Dead Man\'s Switch*\n\n' +
        'I help ensure your crypto reaches your loved ones.\n\n' +
        '*Commands:*\n' +
        '/checkin - Reset your vault timer\n' +
        '/status - Check vault status\n' +
        '/help - Show this message\n\n' +
        '_Create your vault at deadmanswitch.xyz_',
        { parse_mode: 'Markdown' }
      );
    });

    // Command: /help
    bot.command('help', async (ctx) => {
      await ctx.reply(
        '*Dead Man\'s Switch Commands*\n\n' +
        '📍 /checkin - Reset your vault timer (proof of life)\n' +
        '📊 /status - View vault state and countdown\n' +
        '🆘 /help - Show this help message\n\n' +
        '*How it works:*\n' +
        '1. Create vault at deadmanswitch.xyz\n' +
        '2. I monitor your wallet for activity\n' +
        '3. If inactive, I send warnings\n' +
        '4. Check in anytime to reset timer\n' +
        '5. If no response, beneficiaries can claim\n\n' +
        '_Questions? Visit deadmanswitch.xyz/faq_',
        { parse_mode: 'Markdown' }
      );
    });

    // Command: /checkin
    bot.command('checkin', async (ctx) => {
      await this.handleCheckin(ctx);
    });

    // Command: /status
    bot.command('status', async (ctx) => {
      await this.handleStatus(ctx);
    });

    // Error handling
    bot.catch((err, ctx) => {
      logger.error({ err, update: ctx.update }, 'Bot error');
      ctx.reply('❌ Something went wrong. Please try again or visit deadmanswitch.xyz');
    });
  }

  private async handleCheckin(ctx: Context) {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    try {
      // Find user's vault(s)
      const { data: vaults, error } = await supabase
        .from('vaults')
        .select('*')
        .eq('telegram_chat_id', userId)
        .in('state', ['active', 'warning', 'challenge']);

      if (error) throw error;

      if (!vaults || vaults.length === 0) {
        return ctx.reply(
          '❌ No active vault found.\n\n' +
          'Create one at: deadmanswitch.xyz',
          { parse_mode: 'Markdown' }
        );
      }

      const vault = vaults[0]; // Use first vault

      // Option 1: Send link to website for manual check-in
      // (Recommended for MVP - requires owner signature)
      await ctx.reply(
        '✅ *Check-In Instructions*\n\n' +
        `Visit: ${process.env.APP_URL}/vault/${vault.id}\n\n` +
        '1. Connect your wallet\n' +
        '2. Click "Check In"\n' +
        '3. Sign the transaction\n\n' +
        '_This resets your timer and keeps your vault active._',
        { parse_mode: 'Markdown' }
      );

      // Option 2: Auto check-in via delegated authority (advanced)
      // Requires separate on-chain program for delegation
      // For MVP, stick with Option 1

    } catch (error) {
      logger.error({ error, userId }, 'Check-in command error');
      await ctx.reply('❌ Error fetching your vault. Please try again.');
    }
  }

  private async handleStatus(ctx: Context) {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    try {
      // Find user's vault
      const { data: vaults, error } = await supabase
        .from('vaults')
        .select('*')
        .eq('telegram_chat_id', userId);

      if (error) throw error;

      if (!vaults || vaults.length === 0) {
        return ctx.reply(
          '❌ No vault found.\n\n' +
          'Create one at: deadmanswitch.xyz'
        );
      }

      const vault = vaults[0];

      // Fetch on-chain vault state
      const vaultPda = this.getVaultPda(vault.owner_address);
      const vaultAccount = await this.program.account.vault.fetch(vaultPda);

      // Calculate time since last check-in
      const currentTime = Math.floor(Date.now() / 1000);
      const lastCheckin = vaultAccount.lastCheckinTimestamp.toNumber();
      const elapsed = currentTime - lastCheckin;
      const daysElapsed = Math.floor(elapsed / (24 * 60 * 60));
      const hoursElapsed = Math.floor((elapsed % (24 * 60 * 60)) / 3600);

      // Calculate time remaining until warning
      const warningPeriodDays = Math.floor(
        vaultAccount.warningPeriodSeconds.toNumber() / (24 * 60 * 60)
      );
      const daysUntilWarning = Math.max(0, warningPeriodDays - daysElapsed);

      // Get state emoji
      const stateEmoji = {
        active: '✅',
        warning: '⚠️',
        challenge: '🚨',
        claimable: '⚰️',
        claimed: '✓'
      }[vault.state] || '❓';

      // Format response
      let response = `📊 *VAULT STATUS*\n\n`;
      response += `State: ${stateEmoji} ${vault.state.toUpperCase()}\n\n`;

      if (vault.state === 'active') {
        response += `Last check-in: ${daysElapsed}d ${hoursElapsed}h ago\n`;
        response += `Warning in: ${daysUntilWarning} days\n\n`;
        response += `💡 _Check in anytime with /checkin_`;
      } else if (vault.state === 'warning') {
        const warningTime = vaultAccount.warningTriggeredAt?.toNumber() || lastCheckin;
        const warningElapsed = currentTime - warningTime;
        const warningDaysElapsed = Math.floor(warningElapsed / (24 * 60 * 60));
        const challengePeriodDays = Math.floor(
          vaultAccount.challengePeriodSeconds.toNumber() / (24 * 60 * 60)
        );
        const daysUntilChallenge = Math.max(0, challengePeriodDays - warningDaysElapsed);

        response += `⚠️ *WARNING PERIOD ACTIVE*\n\n`;
        response += `Challenge period in: ${daysUntilChallenge} days\n\n`;
        response += `🚨 _Check in NOW to keep vault active: /checkin_`;
      } else if (vault.state === 'challenge') {
        const challengeTime = vaultAccount.challengeTriggeredAt?.toNumber() || lastCheckin;
        const challengeElapsed = currentTime - challengeTime;
        const challengeDaysElapsed = Math.floor(challengeElapsed / (24 * 60 * 60));
        const challengePeriodDays = Math.floor(
          vaultAccount.challengePeriodSeconds.toNumber() / (24 * 60 * 60)
        );
        const daysUntilClaimable = Math.max(0, challengePeriodDays - challengeDaysElapsed);

        response += `🚨 *CHALLENGE PERIOD - URGENT*\n\n`;
        response += `Assets claimable in: ${daysUntilClaimable} days\n\n`;
        response += `⚠️ _LAST CHANCE - Check in immediately: /checkin_`;
      } else if (vault.state === 'claimable') {
        response += `⚰️ *ASSETS NOW CLAIMABLE*\n\n`;
        response += `Beneficiaries have been notified.\n\n`;
        response += `If this is a mistake, visit:\n`;
        response += `${process.env.APP_URL}/vault/${vault.id}`;
      }

      // Add vault info
      response += `\n\n*Vault Details:*\n`;
      response += `Balance: ${(vaultAccount.solBalance.toNumber() / 1e9).toFixed(4)} SOL\n`;
      response += `Beneficiaries: ${vaultAccount.beneficiaries.length}\n`;

      await ctx.reply(response, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error({ error, userId }, 'Status command error');
      await ctx.reply('❌ Error fetching vault status. Please try again.');
    }
  }

  private getVaultPda(ownerAddress: string): PublicKey {
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), new PublicKey(ownerAddress).toBuffer()],
      this.program.programId
    );
    return vaultPda;
  }
}

// Export singleton instance
export const dmsBot = new DeadMansSwitchBot();
```

### Notification System (Alerts)

```typescript
// agent/src/notifications.ts
import { Telegraf } from 'telegraf';
import nodemailer from 'nodemailer';
import { logger } from './logger';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST!,
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASS!,
  },
});

export async function sendTelegramAlert(chatId: string, message: string) {
  try {
    await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    logger.info({ chatId }, 'Telegram alert sent');
  } catch (error) {
    logger.error({ error, chatId }, 'Telegram error');
  }
}

export async function sendEmailAlert(email: string, subject: string, body: string) {
  try {
    await emailTransporter.sendMail({
      from: 'Dead Mans Switch <noreply@deadmanswitch.xyz>',
      to: email,
      subject,
      text: body,
    });
    logger.info({ email }, 'Email alert sent');
  } catch (error) {
    logger.error({ error, email }, 'Email error');
  }
}
```

### Bot Registration Flow

When user creates a vault on the website, they should register their Telegram:

```typescript
// frontend/app/create/page.tsx

// After vault creation:
const telegramRegistrationLink = `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}?start=${vaultId}`;

await ctx.reply(
  `✅ Vault created!\n\n` +
  `To receive alerts, message this bot:\n` +
  `${telegramRegistrationLink}\n\n` +
  `Use /status anytime to check your vault.`
);
```

The bot handles the `/start` command with a vault ID parameter to link the Telegram account to the vault.

---

## Frontend Specifications

### Pages

```
app/
├── page.tsx                 # Landing page
├── create/page.tsx          # Create vault
├── vault/[id]/page.tsx      # Vault details (owner view)
├── claim/[id]/page.tsx      # Claim interface (beneficiary view)
└── layout.tsx               # Wallet provider
```

### Create Vault Page

```typescript
// app/create/page.tsx
'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';

export default function CreateVault() {
  const { publicKey, signTransaction } = useWallet();
  const [beneficiaries, setBeneficiaries] = useState([
    { address: '', share: 100, label: '' }
  ]);
  const [warningDays, setWarningDays] = useState(90);
  const [challengeDays, setChallengeDays] = useState(30);
  const [depositAmount, setDepositAmount] = useState('');
  const [email, setEmail] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [vaultId, setVaultId] = useState('');

  const handleCreate = async () => {
    if (!publicKey || !signTransaction) return;

    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);
    const provider = new AnchorProvider(connection, { publicKey, signTransaction }, {});
    const program = new Program(IDL, provider);

    // Derive vault PDA
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), publicKey.toBuffer()],
      program.programId
    );

    // Convert beneficiaries to proper format
    const beneficiaryConfigs = beneficiaries.map(b => ({
      address: new PublicKey(b.address),
      share: b.share,
      hasClaimed: false,
    }));

    // 1. Initialize vault
    const initTx = await program.methods
      .initializeVault(
        warningDays * 24 * 60 * 60, // Convert days to seconds
        challengeDays * 24 * 60 * 60,
        beneficiaryConfigs
      )
      .accounts({
        vault: vaultPda,
        owner: publicKey,
      })
      .rpc();

    console.log('Vault initialized:', initTx);

    // 2. Deposit SOL
    if (depositAmount) {
      const depositTx = await program.methods
        .depositSol(new BN(parseFloat(depositAmount) * LAMPORTS_PER_SOL))
        .accounts({
          vault: vaultPda,
          owner: publicKey,
        })
        .rpc();

      console.log('Deposit complete:', depositTx);
    }

    // 3. Save to database
    const response = await fetch('/api/vaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_address: publicKey.toString(),
        vault_pda: vaultPda.toString(),
        warning_period_days: warningDays,
        challenge_period_days: challengeDays,
        owner_email: email,
        beneficiaries: beneficiaries,
      }),
    });

    const data = await response.json();
    setVaultId(data.id);
    setShowSuccess(true);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Create Dead Man's Switch</h1>

      <WalletMultiButton />

      {publicKey && !showSuccess && (
        <div className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Warning Period</label>
            <input
              type="number"
              value={warningDays}
              onChange={(e) => setWarningDays(parseInt(e.target.value))}
              className="w-full px-4 py-2 border rounded"
              placeholder="Days"
            />
            <p className="text-sm text-gray-500 mt-1">
              Alert if no activity for this many days
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Challenge Period</label>
            <input
              type="number"
              value={challengeDays}
              onChange={(e) => setChallengeDays(parseInt(e.target.value))}
              className="w-full px-4 py-2 border rounded"
              placeholder="Days"
            />
            <p className="text-sm text-gray-500 mt-1">
              Final warning period before assets become claimable
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email (for alerts)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Beneficiaries</label>
            {beneficiaries.map((b, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={b.address}
                  onChange={(e) => {
                    const newBeneficiaries = [...beneficiaries];
                    newBeneficiaries[i].address = e.target.value;
                    setBeneficiaries(newBeneficiaries);
                  }}
                  className="flex-1 px-4 py-2 border rounded"
                  placeholder="Wallet address"
                />
                <input
                  type="number"
                  value={b.share}
                  onChange={(e) => {
                    const newBeneficiaries = [...beneficiaries];
                    newBeneficiaries[i].share = parseInt(e.target.value);
                    setBeneficiaries(newBeneficiaries);
                  }}
                  className="w-20 px-4 py-2 border rounded"
                  placeholder="%"
                />
              </div>
            ))}
            <button
              onClick={() => setBeneficiaries([...beneficiaries, { address: '', share: 0, label: '' }])}
              className="text-sm text-blue-600 hover:underline"
            >
              + Add Beneficiary
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Initial Deposit (SOL)</label>
            <input
              type="text"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full px-4 py-2 border rounded"
              placeholder="10"
            />
          </div>

          <button
            onClick={handleCreate}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
          >
            Create Vault
          </button>
        </div>
      )}

      {showSuccess && (
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-green-800 mb-4">✅ Vault Created!</h2>
          
          <p className="mb-4">Your Dead Man's Switch is now active.</p>
          
          <div className="bg-white border rounded p-4 mb-4">
            <h3 className="font-semibold mb-2">📱 Get Telegram Alerts</h3>
            <p className="text-sm text-gray-600 mb-3">
              Message our bot to receive status updates and warnings:
            </p>
            <a
              href={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}?start=${vaultId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Open Telegram Bot
            </a>
            <p className="text-xs text-gray-500 mt-2">
              Use /status anytime to check your vault
            </p>
          </div>

          <div className="bg-white border rounded p-4">
            <h3 className="font-semibold mb-2">✉️ Email Alerts</h3>
            <p className="text-sm text-gray-600">
              We'll also send alerts to: <strong>{email}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Claim Page

```typescript
// app/claim/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useParams } from 'next/navigation';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';

export default function ClaimPage() {
  const params = useParams();
  const { publicKey, signTransaction } = useWallet();
  const [vault, setVault] = useState(null);
  const [beneficiaryInfo, setBeneficiaryInfo] = useState(null);

  useEffect(() => {
    loadVault();
  }, [params.id, publicKey]);

  const loadVault = async () => {
    // Fetch vault from database
    const res = await fetch(`/api/vaults/${params.id}`);
    const data = await res.json();
    setVault(data);

    // Check if current wallet is a beneficiary
    if (publicKey) {
      const beneficiary = data.beneficiaries.find(
        (b) => b.address === publicKey.toString()
      );
      setBeneficiaryInfo(beneficiary);
    }
  };

  const handleClaim = async () => {
    if (!publicKey || !signTransaction || !vault) return;

    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);
    const provider = new AnchorProvider(connection, { publicKey, signTransaction }, {});
    const program = new Program(IDL, provider);

    const vaultPda = new PublicKey(vault.vault_pda);

    const tx = await program.methods
      .claim()
      .accounts({
        vault: vaultPda,
        beneficiary: publicKey,
      })
      .rpc();

    console.log('Claim successful:', tx);
    alert('Assets claimed successfully!');
  };

  if (!vault) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Claim Inheritance</h1>

      {vault.state !== 'claimable' && (
        <div className="bg-yellow-100 p-4 rounded mb-4">
          <p>Assets are not yet claimable. Current state: {vault.state}</p>
        </div>
      )}

      {beneficiaryInfo && (
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Your Share</h2>
            <p className="text-3xl font-bold text-blue-600">{beneficiaryInfo.share}%</p>
          </div>

          <div>
            <h3 className="font-medium">Estimated Amount</h3>
            <p className="text-lg">
              {(vault.sol_balance * beneficiaryInfo.share / 100).toFixed(4)} SOL
            </p>
          </div>

          {vault.state === 'claimable' && !beneficiaryInfo.has_claimed && (
            <button
              onClick={handleClaim}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700"
            >
              Claim Assets
            </button>
          )}

          {beneficiaryInfo.has_claimed && (
            <div className="bg-green-100 p-4 rounded">
              <p className="text-green-800 font-medium">✓ Already claimed</p>
            </div>
          )}
        </div>
      )}

      {!beneficiaryInfo && publicKey && (
        <div className="bg-red-100 p-4 rounded">
          <p>You are not a beneficiary of this vault.</p>
        </div>
      )}
    </div>
  );
}
```

---

## Phase-by-Phase Development Plan

### Overview

```
Phase 1 (Days 1-4):  Anchor Program
Phase 2 (Days 5-6):  Agent System
Phase 3 (Day 7):     Frontend
Phase 4 (Day 8):     Integration & Testing
Phase 5 (Days 9-10): Polish & Deploy
```

---

### Phase 1: Anchor Program (Days 1-4)

#### Goal
Build and test a production-ready Anchor program with all core functionality.

#### Day 1: Project Setup + Basic Program

**Morning: Initialize Project**
```bash
# 1. Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.30.0
avm use 0.30.0

# 2. Create new project
anchor init dead-mans-switch
cd dead-mans-switch

# 3. Update Anchor.toml
[programs.localnet]
dead_mans_switch = "DMS1111111111111111111111111111111111111111"

[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json"
```

**Afternoon: Core Structures**

Create `programs/dead-mans-switch/src/lib.rs`:
- Define `Vault` account structure
- Define `BeneficiaryConfig` struct
- Define `VaultState` enum
- Define error codes

**Evening: Basic Instructions**

Implement:
- `initialize_vault`
- `deposit_sol`
- `check_in`

**Testing Day 1:**
```bash
anchor build
anchor test
```

Verify:
- Program compiles
- Can initialize vault
- Can deposit SOL
- Can check in

---

#### Day 2: State Machine

**Morning: Advance State Logic**

Implement `advance_state`:
- Active → Warning (after warning period)
- Warning → Challenge (after challenge period)
- Challenge → Claimable (after final period)

**Afternoon: Claim Logic**

Implement `claim`:
- Verify vault is claimable
- Check beneficiary is authorized
- Calculate share amount
- Transfer SOL
- Mark as claimed

**Evening: Cancel Logic**

Implement `cancel`:
- Verify owner
- Return all funds
- Close account

**Testing Day 2:**
```bash
anchor test
```

Verify:
- State transitions work
- Timelock verification works
- Claims calculate shares correctly

---

#### Day 3: Edge Cases & Security

**Morning: Access Control**

Add checks:
- `has_one = owner` on relevant contexts
- Beneficiary verification
- State validation

**Afternoon: Comprehensive Tests**

Write test cases for:
- Invalid beneficiaries (shares ≠ 100%)
- Premature state advancement
- Non-beneficiary claiming
- Double claiming
- Owner canceling from each state

**Evening: Error Handling**

Ensure all error codes are used:
- Clear error messages
- Proper error propagation
- No panics

---

#### Day 4: Advanced Testing + Bankrun

**Morning: Bankrun Integration**

Set up Bankrun:
```bash
npm install -D solana-bankrun
```

Create `tests/bankrun.test.ts`:
- Fast in-memory testing
- Time manipulation for timeout tests
- Full happy path test
- Full unhappy path tests

**Afternoon: Security Review**

Manual audit:
- Integer overflow checks
- Reentrancy prevention
- Account validation
- PDA derivation security

**Evening: Documentation**

Add comments:
- Function-level documentation
- Parameter explanations
- Security notes
- Example usage

**Phase 1 Success Criteria:**
- ✅ All 6 instructions implemented
- ✅ 20+ test cases passing
- ✅ Bankrun tests passing
- ✅ No compiler warnings
- ✅ Clear error messages
- ✅ Program deploys to devnet

---

### Phase 2: Agent System (Days 5-6)

#### Goal
Build the monitoring agent that watches wallets and manages vault lifecycle.

#### Day 5: Core Agent + Telegram Bot Setup

**Morning: Project Setup**
```bash
mkdir agent
cd agent
npm init -y
npm install @solana/web3.js @coral-xyz/anchor helius-sdk \
  @agentwallet/sdk @supabase/supabase-js telegraf pino dotenv nodemailer
```

**Create Structure:**
```
agent/
├── src/
│   ├── monitor.ts           # Main monitoring loop
│   ├── bot/
│   │   ├── index.ts         # Telegram bot (commands + alerts)
│   │   └── handlers.ts      # Command handlers
│   ├── notifications.ts     # Email alerts
│   ├── database.ts          # Supabase client
│   └── logger.ts            # Pino logger
├── .env
└── package.json
```

**Afternoon: Activity Monitoring**

Implement in `monitor.ts`:
```typescript
class VaultMonitor {
  async checkVaultActivity(vault: VaultRecord) {
    // Get last transaction
    const sigs = await connection.getSignaturesForAddress(owner);
    const lastActivity = sigs[0]?.blockTime;
    
    // If recent activity, send check-in reminder
    if (isRecent(lastActivity)) {
      await sendCheckInReminder(vault);
    }
  }
}
```

**Evening: Database Schema + Telegram Bot Setup**

Create Supabase tables:
```sql
CREATE TABLE vaults (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_address VARCHAR(44) NOT NULL,
  vault_pda VARCHAR(44) NOT NULL,
  state VARCHAR(20) NOT NULL,
  warning_period_days INT NOT NULL,
  challenge_period_days INT NOT NULL,
  telegram_chat_id VARCHAR(50),
  owner_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE beneficiaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vault_id UUID REFERENCES vaults(id),
  address VARCHAR(44) NOT NULL,
  share INT NOT NULL,
  email VARCHAR(255),
  has_claimed BOOLEAN DEFAULT FALSE
);
```

Set up Telegram bot:
```bash
# 1. Message @BotFather on Telegram
# 2. /newbot -> choose name -> get token (2 minutes)
# 3. Add TELEGRAM_BOT_TOKEN to .env
```

Create `src/bot/index.ts`:
- Bot initialization
- `/start` command (welcome message)
- `/help` command (command list)
- Error handling

**Testing Day 5:**
```bash
# Terminal 1: Start monitor
tsx src/monitor.ts

# Terminal 2: Start bot
tsx src/bot/index.ts

# Test in Telegram:
# /start -> should get welcome message
# /help -> should get command list
```

Verify:
- Monitor connects to Helius
- Monitor fetches vault list
- Monitor checks wallet activity
- Bot responds to /start and /help
- Logs are clear

---

#### Day 6: Bot Commands + State Management + Notifications

**Morning: Telegram Bot Commands**

Implement in `src/bot/handlers.ts`:

**1. /status command** (2 hours)
```typescript
async handleStatus(ctx: Context) {
  // Fetch user's vault from database
  // Fetch on-chain vault state
  // Calculate days since check-in
  // Calculate days until warning/challenge/claimable
  // Format and send status message
}
```

**2. /checkin command** (2 hours)
```typescript
async handleCheckin(ctx: Context) {
  // Find user's vault
  // Send link to check-in page on website
  // (Requires owner signature, so website handles it)
}
```

**Afternoon: State Advancement**

Implement in `src/monitor.ts`:
```typescript
async tryAdvanceState(vault: VaultRecord) {
  const vaultAccount = await program.account.vault.fetch(vaultPda);
  
  // Calculate if advancement is due
  if (canAdvance(vaultAccount)) {
    await program.methods.advanceState()
      .accounts({ vault: vaultPda })
      .rpc();
    
    // Send notifications via Telegram + Email
    await sendNotification(vault, newState);
  }
}
```

**Evening: Notification System**

Implement alert notifications:
- Warning alert template (Telegram + Email)
- Challenge alert template (Telegram + Email)
- Claimable alert template (Telegram + Email)
- Beneficiary notification template

**Integration Testing:**

Create test vault:
1. Initialize on devnet
2. Link Telegram via /start command
3. Test /status command
4. Test /checkin command
5. Advance through states manually
6. Verify all notifications sent

**Phase 2 Success Criteria:**
- ✅ Agent monitors wallets
- ✅ Agent advances vault states
- ✅ Telegram bot responds to /start, /help, /status, /checkin
- ✅ Telegram alerts working (warning, challenge, claimable)
- ✅ Email alerts working
- ✅ Database tracking states
- ✅ Bot + monitor run for 1 hour without crash

---

### Phase 3: Frontend (Day 7)

#### Goal
Build Next.js UI for vault creation and claiming.

#### Day 7: Frontend

**Morning: Project Setup**
```bash
npx create-next-app@latest frontend --typescript --tailwind --app
cd frontend
npm install @solana/wallet-adapter-react @solana/wallet-adapter-wallets \
  @coral-xyz/anchor
```

**Afternoon: Create Vault Page**

Build `/create`:
- Wallet connection
- Form for beneficiaries
- Form for timeouts
- Vault initialization
- Deposit interface

**Evening: Claim Page**

Build `/claim/[id]`:
- Load vault data
- Display beneficiary share
- Claim button
- Transaction confirmation

**Phase 3 Success Criteria:**
- ✅ Can connect wallet
- ✅ Can create vault
- ✅ Can view vault details
- ✅ Can claim as beneficiary
- ✅ Responsive UI
- ✅ Error handling

---

### Phase 4: Integration (Day 8)

#### Goal
Connect all components and test end-to-end.

#### Day 8: Full Integration

**Morning: API Routes**

Create `/api/vaults`:
- POST: Save vault to database
- GET: List user's vaults
- GET `/api/vaults/[id]`: Vault details

**Afternoon: End-to-End Testing**

Test full flow:
1. Create vault via UI
2. Deposit SOL
3. Agent detects vault
4. Simulate inactivity (fast-forward time on devnet)
5. Agent advances state
6. Notifications sent
7. Beneficiary claims via UI

**Evening: Bug Fixes**

Fix any issues found:
- Transaction errors
- UI bugs
- Agent crashes
- Notification failures

**Phase 4 Success Criteria:**
- ✅ Full flow works end-to-end
- ✅ No critical bugs
- ✅ Notifications arriving
- ✅ Claims successful
- ✅ Database synced

---

### Phase 5: Polish & Deploy (Days 9-10)

#### Goal
Production deployment and demo creation.

#### Day 9: Deploy & Polish

**Morning: Mainnet Deployment**

Deploy to devnet (or mainnet if confident):
```bash
anchor build
anchor deploy --provider.cluster devnet
```

Update frontend + agent with devnet program ID.

**Afternoon: UI Polish**

Add:
- Loading states
- Error messages
- Success confirmations
- Help text
- FAQ page

**Evening: Demo Video Script**

Write script:
```
[0:00] Problem: $20B lost to crypto death
[0:30] Solution: Dead Man's Switch
[1:00] Demo: Create vault
[1:30] Demo: Simulate inactivity (fast-forward)
[2:00] Demo: Beneficiary claims
[2:30] Tech: Anchor + AI agent + Solana
```

---

#### Day 10: Final Testing & Submit

**Morning: Final Testing**

Run through checklist:
- [ ] Vault creation works
- [ ] Deposits work
- [ ] Check-in works
- [ ] State advancement works
- [ ] Claims work
- [ ] Notifications work
- [ ] UI is responsive
- [ ] No console errors

**Afternoon: Demo Video**

Record:
- Screen recording
- Voiceover
- Show Solscan transactions
- Show agent logs
- Show notifications

**Evening: Hackathon Submission**

Submit:
- GitHub repo link
- Demo video
- Description
- Tags: ["defi", "ai", "governance"]
- Project name: Dead Man's Switch

**Phase 5 Success Criteria:**
- ✅ Deployed to devnet
- ✅ Demo video uploaded
- ✅ README complete
- ✅ All code documented
- ✅ Submitted to hackathon

---

## Testing Strategy

### Unit Tests (Anchor Program)

```bash
anchor test
```

Test cases:
- ✅ Initialize with valid config
- ✅ Initialize with invalid shares (≠100%)
- ✅ Deposit SOL
- ✅ Check in resets timer
- ✅ Advance state prematurely (should fail)
- ✅ Advance state after timeout (should succeed)
- ✅ Claim before claimable (should fail)
- ✅ Claim as non-beneficiary (should fail)
- ✅ Claim success
- ✅ Double claim (should fail)
- ✅ Cancel vault

### Integration Tests (Agent + Bot)

```typescript
// tests/agent.test.ts
describe('Agent Integration', () => {
  it('detects wallet activity', async () => {
    // Create test vault
    // Make transaction from owner wallet
    // Verify agent detects it
  });

  it('advances vault state', async () => {
    // Create test vault with 1-minute timeout
    // Wait 61 seconds
    // Verify agent advances to WARNING
  });

  it('sends notifications', async () => {
    // Spy on notification functions
    // Trigger state change
    // Verify notification called
  });
});

// tests/bot.test.ts
describe('Telegram Bot', () => {
  it('responds to /start', async () => {
    const response = await sendCommand('/start');
    expect(response).toContain('Welcome to Dead Man\'s Switch');
  });

  it('responds to /status', async () => {
    // Create test vault linked to test user
    const response = await sendCommand('/status');
    expect(response).toContain('VAULT STATUS');
    expect(response).toContain('Last check-in:');
  });

  it('handles /checkin', async () => {
    const response = await sendCommand('/checkin');
    expect(response).toContain('Check-In Instructions');
    expect(response).toContain('deadmanswitch.xyz/vault/');
  });

  it('handles unknown commands gracefully', async () => {
    const response = await sendCommand('/unknown');
    expect(response).toContain('Unknown command');
  });

  it('handles no vault found', async () => {
    // Test with user who has no vault
    const response = await sendCommand('/status');
    expect(response).toContain('No vault found');
  });
});
```

### E2E Tests (Frontend)

```typescript
// tests/e2e.test.ts
import { test, expect } from '@playwright/test';

test('create vault flow', async ({ page }) => {
  await page.goto('/create');
  
  // Connect wallet
  await page.click('text=Connect Wallet');
  
  // Fill form
  await page.fill('input[name="beneficiary"]', 'BENEFICIARY_ADDRESS');
  await page.fill('input[name="share"]', '100');
  
  // Create vault
  await page.click('text=Create Vault');
  
  // Verify success
  await expect(page.locator('text=Success')).toBeVisible();
});
```

### Manual Testing Checklist

```
UI Tests:
[ ] Wallet connects successfully
[ ] Form validation works
[ ] Can add/remove beneficiaries
[ ] Transaction confirmation modal appears
[ ] Success message shows
[ ] Error handling works

Telegram Bot Tests:
[ ] /start returns welcome message
[ ] /help shows command list
[ ] /status shows vault info correctly
[ ] /status handles "no vault" case
[ ] /checkin sends website link
[ ] Bot handles errors gracefully
[ ] Alerts sent on state transitions
[ ] Message formatting is clear

Agent Tests:
[ ] Agent starts without errors
[ ] Logs are clear and informative
[ ] Connects to Helius
[ ] Queries database successfully
[ ] Detects wallet activity
[ ] Advances vault states correctly
[ ] Sends both Telegram and Email alerts
[ ] Telegram bot responds
[ ] Email sends successfully

Program Tests:
[ ] Deploys to devnet
[ ] All instructions callable
[ ] PDAs derive correctly
[ ] SOL transfers work
[ ] State transitions work
[ ] Claims distribute correctly
```

---

## Deployment Instructions

### Environment Variables

```bash
# Agent (.env)
SOLANA_RPC_URL=https://api.devnet.solana.com
HELIUS_API_KEY=your_helius_key
AGENTWALLET_API_KEY=your_agentwallet_key
PROGRAM_ID=DMS1111111111111111111111111111111111111111

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_supabase_key

TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_BOT_USERNAME=DeadMansSwitchBot

EMAIL_HOST=smtp.resend.com
EMAIL_USER=resend
EMAIL_PASS=your_resend_api_key

APP_URL=https://deadmanswitch.vercel.app
```

```bash
# Frontend (.env.local)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=DMS1111111111111111111111111111111111111111
NEXT_PUBLIC_BOT_USERNAME=DeadMansSwitchBot

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Deployment Steps

**1. Deploy Anchor Program**
```bash
anchor build
anchor deploy --provider.cluster devnet
# Save program ID
```

**2. Deploy Frontend (Vercel)**
```bash
cd frontend
vercel deploy --prod
```

**3. Deploy Agent (Railway)**
```bash
cd agent
# Push to GitHub
# Connect Railway to repo
# Set environment variables
# Deploy
```

**4. Initialize Database**
```sql
-- Run on Supabase SQL editor
-- Copy tables from agent/schema.sql
```

---

## Success Criteria

### Phase 1: Anchor Program
- ✅ All 6 instructions working
- ✅ 20+ test cases passing
- ✅ Deployed to devnet
- ✅ No security issues

### Phase 2: Agent + Bot
- ✅ Monitors wallets successfully
- ✅ Advances states correctly
- ✅ Bot responds to /start, /help
- ✅ Bot responds to /status with vault info
- ✅ Bot responds to /checkin with website link
- ✅ Sends Telegram notifications (alerts)
- ✅ Sends Email notifications
- ✅ Runs 24/7 without crashes

### Phase 3: Frontend
- ✅ Wallet connects
- ✅ Vault creation works
- ✅ Claim interface works
- ✅ Mobile responsive

### Phase 4: Integration
- ✅ End-to-end flow works
- ✅ No critical bugs
- ✅ Database synced

### Phase 5: Launch
- ✅ Demo video complete
- ✅ README comprehensive
- ✅ Submitted to hackathon
- ✅ All components deployed

---

## Risk Mitigation

### Risk 1: Anchor Program Bugs

**Mitigation:**
- Comprehensive testing with Bankrun
- Security review checklist
- Reference Eternal Key implementation
- Keep program simple (no complex logic)

### Risk 2: Agent Downtime

**Mitigation:**
- Program works without agent (anyone can call advance_state)
- Multiple agent instances for redundancy
- Clear logging for debugging
- Railway auto-restart on crash

### Risk 3: False Triggers

**Mitigation:**
- Multi-stage verification (Warning → Challenge)
- Long default timeouts (90+30 days)
- Multiple notification attempts
- Check-in always resets to Active

### Risk 4: Time Constraints

**Mitigation:**
- Focus on core features only
- SOL only (no SPL tokens for MVP)
- Single beneficiary if needed
- Template UI (no custom design)
- Use existing tools (Eternal Key reference)

---

## Alternative: DMS Lite (Using Eternal Key)

If time is tight, consider this approach:

**Use Eternal Key Program (Already Audited)**
```bash
# Instead of building our own program
git clone https://github.com/retrogtx/eternal-key
cd eternal-key
anchor build
anchor deploy
```

**Focus on Agent + UI:**
- Build monitoring agent (2 days)
- Build UI wrapper (1 day)
- Add notifications (1 day)
- Test & polish (1 day)

**Value Prop:**
> "We're using Eternal Key (audited, open-source) for the on-chain logic. Our contribution is the AI agent that automates monitoring + check-ins, making dead man's switches actually usable."

**This is buildable in 5 days** and shows clear differentiation.

---

## Final Notes for Claude Code

### Development Approach

1. **Build Anchor program first** - It's the foundation
2. **Test extensively** - Financial apps need zero bugs
3. **Keep it simple** - Fewer features, higher quality
4. **Reference Eternal Key** - Don't reinvent the wheel
5. **Focus on demo** - Make it visual and clear

### Code Quality

- **Rust:** Use `cargo clippy`, follow Anchor patterns
- **TypeScript:** Strict mode, explicit types, proper error handling
- **React:** Functional components, hooks, proper wallet integration
- **Testing:** 80%+ coverage, edge cases, security scenarios

### Time Management

If falling behind:
- **Days 1-4 critical:** Must have working program
- **Days 5-6 important:** Agent makes it "agentic"
- **Day 7 flexible:** Can use simpler UI
- **Days 8-10 buffer:** Polish and deployment

### Success Metrics

**Minimum Viable Demo:**
- Create vault ✅
- Advance state manually ✅
- Claim works ✅

**Full Featured Demo:**
- Agent monitors ✅
- Auto check-in ✅
- Notifications ✅
- Multi-beneficiary ✅

**Ideal Demo:**
- All above ✅
- Beautiful UI ✅
- Comprehensive docs ✅
- Video demo ✅

---

## Let's Build This! 🚀

**Remember:**
- Anchor program = Foundation (most critical)
- Agent = "Agentic" differentiator (important)
- UI = Polish (nice to have)

**Focus order:**
1. Working program with tests
2. Basic agent with monitoring
3. Simple UI for creation + claiming
4. Notifications
5. Polish

Build incrementally. Test continuously. Ship confidently.

**Good luck!** 🎯
