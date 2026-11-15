export const pilot = {
    name: 'Nemanja Vasic',
    role: 'Full-Stack Developer',
    mission: 'Building elegant digital experiences.',
    status: 'Developing',
} as const;

/**
 * T-zero for the HUD mission clock: career start, taken from the first commit
 * of github.com/GoodbyePlanet/HotelManagement (610db79).
 */
export const missionStart = '2017-04-24T15:31:49Z';

export const socials = [
    {label: 'GitHub', href: 'https://github.com/GoodbyePlanet'},
    {label: 'LinkedIn', href: 'https://www.linkedin.com/in/nemanja-vasic-linked'},
    {label: 'X', href: 'https://x.com/nemanjavasa'},
] as const;

export const certifications = [
    {
        name: 'Claude Certified Architect (CCA-F)',
        issuer: 'Anthropic',
        href: 'https://www.credly.com/badges/88aa46ed-9161-4bed-a820-0481aee97bcf'
    },
] as const;
