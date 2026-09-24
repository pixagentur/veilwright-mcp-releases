export function siteLimitForTier(tier) {
    switch (tier) {
        case 'free':
            return 1;
        case 'site':
            return 1;
        case 'five_sites':
            return 5;
    }
}
//# sourceMappingURL=LicenseTier.js.map