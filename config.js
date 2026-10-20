/*
 * Site configuration. Edit and push to main; there's no build step.
 *
 * Note: signatures that have already been pasted into Gmail are static
 * copies, so changes here only affect signatures generated afterwards.
 */
window.STAND_SIG_CONFIG = {
  logo: {
    file: "assets/img/stand-logo.png", // 420x90 file, shown at 2x density
    width: 210,
    height: 45,
    alt: "Stand.earth",
    href: "https://www.stand.earth/",
  },

  // Set enabled: false to drop an icon from newly generated signatures.
  // Icon files are 58x58, shown at 29x29 (2x density). To add a network,
  // make its icon with scripts/make-social-icon.sh (see README).
  socials: [
    {
      name: "linkedin",
      enabled: true,
      href: "https://www.linkedin.com/company/stand.earth/",
      file: "assets/img/linkedin.png",
    },
    {
      name: "instagram",
      enabled: true,
      href: "https://www.instagram.com/stand.earth/",
      file: "assets/img/instagram.png",
    },
    {
      name: "facebook",
      enabled: true,
      href: "https://www.facebook.com/standearth",
      file: "assets/img/facebook.png",
    },
    {
      name: "threads",
      enabled: true,
      href: "https://www.threads.com/@stand.earth",
      file: "assets/img/threads.png",
    },
    {
      name: "bluesky",
      enabled: true,
      href: "https://bsky.app/profile/stand.earth",
      file: "assets/img/bluesky.png",
    },
    {
      name: "tiktok",
      enabled: true,
      href: "https://www.tiktok.com/@stand.earth",
      file: "assets/img/tiktok.png",
    },
    {
      name: "x",
      enabled: false,
      href: "https://x.com/standearth",
      file: "assets/img/x.png",
    },
  ],

  // Main office (Zoom) numbers, offered as one-click fills. Same format as the
  // QR generator's VITE_OFFICE_PHONE_OPTIONS secret, so it can be pasted in
  // as-is; the "stand.earth" set is used. The button name is the text after
  // the dash in `display`. Links can use office_phone=<number or name>,
  // e.g. office_phone=vancouver.
  officePhoneOptions: [
    {
      key: "stand.earth",
      phone_options: [
        { display: "(415) 863-4563 – San Francisco", value: "+14158634563" },
        { display: "(360) 734-2951 – Bellingham", value: "+13607342951" },
        { display: "(604) 331-6201 – Vancouver", value: "+16043316201" },
      ],
    },
  ],
  // Phone/contact URL params shared with the QR code generator
  // (qr.stand.earth), and the label each becomes in the signature.
  // Lines appear in this order when pre-filled from a link.
  contactParams: [
    { param: "office_phone", label: "Office", extensionParam: "extension" },
    { param: "work_phone", label: "Direct" },
    { param: "cell_phone", label: "Cell" },
    { param: "whatsapp", label: "WhatsApp" },
    { param: "signal", label: "Signal" },
  ],

  // Text placed between a number and its extension: "+1 (604) 331-6201 ext 209"
  extensionPrefix: "ext",

  // Phrases in footer notes that become links (first match per note, case-insensitive).
  noteLinks: [
    { text: "privacy policy", href: "https://stand.earth/privacy-policy/" },
  ],

  landAcknowledgement: {
    policyUrl:
      "https://docs.google.com/document/d/1zAKVFxP01loYhZM8FFmG0yCpkNn8o2s3RsC0X-2CL38/view",
    guideUrl:
      "https://nativegov.org/news/a-guide-to-indigenous-land-acknowledgment/",
  },
};
