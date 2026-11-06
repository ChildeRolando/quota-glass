// Official command-code@1.88.4 getPlanTotalCredits table, checked 2026-11-07.
// These are normalized monthly credit pools, not model-specific retail-dollar multipliers.
// Unknown plan IDs deliberately return null rather than guessing from price/name.
const monthlyCredits=Object.freeze({
 'individual-go':10,'individual-go-v1':10,'individual-goat':70,
 'individual-pro':30,'individual-pro-v1':80,'individual-provider':15,
 'individual-max':150,'individual-ultra':300,'teams-pro':40
});
module.exports={monthlyCredits};
