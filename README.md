# Stand.earth email signature generator

A static single-page app for Stand staff to build their email signature and paste it into Gmail (or download the HTML for other clients). It lives at **[sig.stand.earth](https://sig.stand.earth)** and is deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.

## Using it

Fill in your details, check the preview, then:

- **Copy signature for Gmail** copies the rendered signature (rich text). In Gmail go to Settings → See all settings → General → Signature and paste it in.
- **Copy HTML code** / **Download .html** give you the raw HTML for Outlook, Apple Mail, etc.

Your draft is saved in your browser so you can come back to it.

## Pre-filling from links

The URL parameters match the [QR code generator](https://qr.stand.earth) (`Standearth/vcard-qr`), so the staff spreadsheet can build links for both from the same columns. Params can go in the query string (`?first_name=...`) or the hash (`#/?first_name=...`, as the QR generator does with `#/vcard/?...`). Empty values are ignored, as are QR-only params (`email`, `org`, `website`, `linkedin`, `notes`, `presets` and the QR styling options).

| Param | Signature line |
| --- | --- |
| `first_name`, `last_name` | Name |
| `title` | Title |
| `office_phone` | `Office:` line. Takes a number, or an office name (`bellingham`, `sanfrancisco`, `vancouver`). |
| `extension` | Extension on the Office line. Works without `office_phone`; the person then picks their office. |
| `work_phone` | `Direct:` line |
| `cell_phone` | `Cell:` line |
| `whatsapp` | `WhatsApp:` line |
| `signal` | `Signal:` line (username, number or `signal.me/#p/...` link) |

Phone numbers are parsed with the same rules as the QR generator, whether they come from a link or are typed in (formatted when you leave the field): `2505091026` → `+1 (250) 509-1026`, `07700900123` → `+44 (0)7700 900123`, `+33612345678` → `+33 6 12 34 56 78`. Anything that isn't a number (like a Signal username) is left as typed. Contact lines appear in the order above, and when any are given they replace the default lines.

Signature-only extras:

| Param | Meaning |
| --- | --- |
| `pronouns` | e.g. `He / Him` |
| `contact` | Extra line as `Label:Value` or `Label:Value\|Ext`. Repeatable. |
| `note` / `inote` | Footer note / italic footer note. Repeatable. Replaces the default notes. |

Example, the same params the QR generator uses plus `pronouns`:

```
https://sig.stand.earth/#/?first_name=Alex&last_name=Example&pronouns=They%20%2F%20Them&title=Campaigner&office_phone=%2B13607342951&extension=123&cell_phone=%2B13605550123&signal=alexexample.01
```

The **Copy pre-fill link** button in the app builds one of these links from whatever you've filled in.

## Development

No build step. Serve the folder locally, e.g. `python3 -m http.server`, and open http://localhost:8000. Image URLs in the output come from the page's own address, so a signature you generate locally will point at localhost. Generate real signatures from the deployed site.

- `config.js` holds the settings you're most likely to change: the logo, social icons (each has an `enabled` flag, e.g. to turn X off), main office numbers (`officePhoneOptions`, in the same format as the QR generator's `VITE_OFFICE_PHONE_OPTIONS` secret, so you can paste that value straight in), the URL param → line label mapping, the extension format, phrases in footer notes that become links (e.g. "privacy policy") and the land acknowledgement links.
- `signature.js` is the email HTML template.
- `phone.js` holds the phone parsing and formatting, ported from vcard-qr's `packages/shared-utils/src/phone.ts`.
- `vendor/libphonenumber-min.js` is [libphonenumber-js](https://gitlab.com/catamphetamine/libphonenumber-js) 1.12.10 (MIT), the same version vcard-qr uses: its `bundle/libphonenumber-min.js` from npm.
- `app.js` handles the form, URL params, copy and download.
- `assets/img/` holds the hosted images. They're 2× resolution for high-DPI screens: logo 420×90 shown at 210×45, icons 58×58 shown at 29×29.
- `brand/` holds the full-resolution source logo. It isn't deployed.
- `archive/` holds previous signature versions for reference.

Changing an image file under the same name changes it in **every existing signature**, because the signatures link to the hosted file. If that's not what you want, give the new image a new filename.

## Hosting (one-time setup)

This is set up the same way as qr.stand.earth:

1. **DNS:** add a `CNAME` record for `sig.stand.earth` pointing to `standearth.github.io`.
2. **Repo settings:** go to Settings → Pages. Set Source to **GitHub Actions**, set Custom domain to `sig.stand.earth`, and once the certificate has been issued, tick **Enforce HTTPS**.
3. The `CNAME` file in the repo root is copied into each deploy so the custom domain stays attached.

Signature images are served from `https://sig.stand.earth/assets/img/...`. Keep the domain stable: changing it breaks the images in every signature already in use.
