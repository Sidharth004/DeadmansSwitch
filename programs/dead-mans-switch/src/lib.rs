use anchor_lang::prelude::*;

declare_id!("BbNiY9dgLi93n7a6wYB8EE2NvYwAn4nGdDv22wvEJwsJ");

#[program]
pub mod dead_mans_switch {
    use super::*;

    /// Initialize a new vault with beneficiary configuration and timeout periods.
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        warning_period_seconds: i64,
        challenge_period_seconds: i64,
        beneficiaries: Vec<BeneficiaryConfig>,
    ) -> Result<()> {
        require!(
            !beneficiaries.is_empty() && beneficiaries.len() <= 5,
            ErrorCode::InvalidBeneficiaries
        );

        let total_share: u8 = beneficiaries.iter().map(|b| b.share).sum();
        require!(total_share == 100, ErrorCode::InvalidShares);

        require!(
            warning_period_seconds > 0 && challenge_period_seconds > 0,
            ErrorCode::InvalidPeriod
        );

        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.state = VaultState::Active;
        vault.warning_period_seconds = warning_period_seconds;
        vault.challenge_period_seconds = challenge_period_seconds;
        vault.last_checkin_timestamp = Clock::get()?.unix_timestamp;
        vault.warning_triggered_at = None;
        vault.challenge_triggered_at = None;
        vault.sol_balance = 0;
        vault.beneficiaries = beneficiaries;
        vault.bump = ctx.bumps.vault;

        msg!("Vault initialized for owner: {}", vault.owner);
        Ok(())
    }

    /// Deposit SOL into the vault.
    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let vault = &mut ctx.accounts.vault;
        require!(vault.state == VaultState::Active, ErrorCode::VaultNotActive);

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

        vault.sol_balance = vault.sol_balance.checked_add(amount).unwrap();

        msg!("Deposited {} lamports", amount);
        Ok(())
    }

    /// Check in to reset the timer. Can be called from any state except Claimed.
    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        require!(vault.state != VaultState::Claimed, ErrorCode::VaultClaimed);

        vault.state = VaultState::Active;
        vault.last_checkin_timestamp = Clock::get()?.unix_timestamp;
        vault.warning_triggered_at = None;
        vault.challenge_triggered_at = None;

        msg!("Check-in successful. Timer reset.");
        Ok(())
    }

    /// Advance the vault state when the relevant timeout has expired.
    /// Anyone can call this — no signer check required.
    pub fn advance_state(ctx: Context<AdvanceState>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let current_time = Clock::get()?.unix_timestamp;

        match vault.state {
            VaultState::Active => {
                let elapsed = current_time - vault.last_checkin_timestamp;
                require!(
                    elapsed >= vault.warning_period_seconds,
                    ErrorCode::TimelockNotExpired
                );
                vault.state = VaultState::Warning;
                vault.warning_triggered_at = Some(current_time);
                msg!("State advanced to WARNING");
            }
            VaultState::Warning => {
                let warning_time = vault
                    .warning_triggered_at
                    .ok_or(ErrorCode::InvalidState)?;
                let elapsed = current_time - warning_time;
                require!(
                    elapsed >= vault.challenge_period_seconds,
                    ErrorCode::TimelockNotExpired
                );
                vault.state = VaultState::Challenge;
                vault.challenge_triggered_at = Some(current_time);
                msg!("State advanced to CHALLENGE");
            }
            VaultState::Challenge => {
                let challenge_time = vault
                    .challenge_triggered_at
                    .ok_or(ErrorCode::InvalidState)?;
                let elapsed = current_time - challenge_time;
                require!(
                    elapsed >= vault.challenge_period_seconds,
                    ErrorCode::TimelockNotExpired
                );
                vault.state = VaultState::Claimable;
                msg!("State advanced to CLAIMABLE");
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

    /// Beneficiary claims their share of the vault.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        require!(
            vault.state == VaultState::Claimable,
            ErrorCode::NotClaimable
        );

        let beneficiary_pubkey = ctx.accounts.beneficiary.key();

        // Find the beneficiary index and validate
        let beneficiary_index = vault
            .beneficiaries
            .iter()
            .position(|b| b.address == beneficiary_pubkey)
            .ok_or(ErrorCode::NotABeneficiary)?;

        require!(
            !vault.beneficiaries[beneficiary_index].has_claimed,
            ErrorCode::AlreadyClaimed
        );

        let share = vault.beneficiaries[beneficiary_index].share;

        // Calculate share amount
        let share_amount = (vault.sol_balance as u128)
            .checked_mul(share as u128)
            .unwrap()
            .checked_div(100)
            .unwrap() as u64;

        // Transfer SOL from vault PDA to beneficiary
        **vault.to_account_info().try_borrow_mut_lamports()? -= share_amount;
        **ctx
            .accounts
            .beneficiary
            .to_account_info()
            .try_borrow_mut_lamports()? += share_amount;

        // Mark as claimed
        vault.beneficiaries[beneficiary_index].has_claimed = true;

        // Check if all beneficiaries have claimed
        let all_claimed = vault.beneficiaries.iter().all(|b| b.has_claimed);
        if all_claimed {
            vault.state = VaultState::Claimed;
        }

        msg!("Beneficiary claimed {} lamports", share_amount);
        Ok(())
    }

    /// Owner cancels the vault and withdraws all deposited SOL.
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let vault = &ctx.accounts.vault;

        require!(vault.state != VaultState::Claimed, ErrorCode::VaultClaimed);
        require!(
            vault.state != VaultState::Claimable,
            ErrorCode::VaultAlreadyClaimable
        );

        let vault_lamports = vault.to_account_info().lamports();
        let rent_exempt = Rent::get()?.minimum_balance(vault.to_account_info().data_len());
        let withdrawable = vault_lamports.saturating_sub(rent_exempt);

        if withdrawable > 0 {
            **vault.to_account_info().try_borrow_mut_lamports()? -= withdrawable;
            **ctx
                .accounts
                .owner
                .to_account_info()
                .try_borrow_mut_lamports()? += withdrawable;
        }

        msg!(
            "Vault cancelled. {} lamports returned to owner",
            withdrawable
        );
        Ok(())
    }
}

// --- Account Structures ---

#[account]
pub struct Vault {
    pub owner: Pubkey,                         // 32
    pub state: VaultState,                     // 1
    pub warning_period_seconds: i64,           // 8
    pub challenge_period_seconds: i64,         // 8
    pub last_checkin_timestamp: i64,           // 8
    pub warning_triggered_at: Option<i64>,     // 1 + 8 = 9
    pub challenge_triggered_at: Option<i64>,   // 1 + 8 = 9
    pub sol_balance: u64,                      // 8
    pub beneficiaries: Vec<BeneficiaryConfig>, // 4 + (34 * 5) = 174
    pub bump: u8,                              // 1
}

impl Vault {
    // 8 (discriminator) + 32 + 1 + 8 + 8 + 8 + 9 + 9 + 8 + 4 + (34*5) + 1 = 266
    pub const LEN: usize = 8 + 32 + 1 + 8 + 8 + 8 + 9 + 9 + 8 + 4 + (34 * 5) + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BeneficiaryConfig {
    pub address: Pubkey, // 32
    pub share: u8,       // 1
    pub has_claimed: bool, // 1
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VaultState {
    Active,    // 0
    Warning,   // 1
    Challenge, // 2
    Claimable, // 3
    Claimed,   // 4
}

// --- Context Structures ---

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

// --- Error Codes ---

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid beneficiaries configuration")]
    InvalidBeneficiaries,

    #[msg("Beneficiary shares must add up to 100%")]
    InvalidShares,

    #[msg("Warning and challenge periods must be positive")]
    InvalidPeriod,

    #[msg("Deposit amount must be greater than zero")]
    InvalidAmount,

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

    #[msg("Vault is in an invalid state")]
    InvalidState,

    #[msg("Cannot cancel a claimable vault")]
    VaultAlreadyClaimable,
}
