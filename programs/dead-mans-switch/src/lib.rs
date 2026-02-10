use anchor_lang::prelude::*;

declare_id!("BbNiY9dgLi93n7a6wYB8EE2NvYwAn4nGdDv22wvEJwsJ");

#[program]
pub mod dead_mans_switch {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
