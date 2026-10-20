/*
 * Phone number parsing/formatting, ported from the QR code generator
 * (vcard-qr: packages/shared-utils/src/phone.ts) so both tools treat numbers
 * the same way. Uses the vendored libphonenumber-js bundle (same version as
 * vcard-qr), which exposes the `libphonenumber` global.
 */
(function (global) {
  "use strict";

  var lib = global.libphonenumber;

  /** Parse with the same hints as vcard-qr. Returns a PhoneNumber, or the cleaned string if parsing fails. */
  function parse(number) {
    if (!number) return "";

    // 1. Strip characters other than numbers and plus
    var cleaned = number.replace(/[^0-9+]/g, "");
    var phoneNumber;

    // 2. North American numbers (10, 11 or 12 digits)
    var nanp;
    if (cleaned.indexOf("+1") === 0 && cleaned.length === 12) nanp = cleaned.substring(2);
    else if (cleaned.indexOf("1") === 0 && cleaned.length === 11) nanp = cleaned.substring(1);
    else if (cleaned.length === 10) nanp = cleaned;

    if (nanp && ["0", "1"].indexOf(nanp[0]) === -1) {
      phoneNumber = lib.parsePhoneNumberFromString(cleaned, "US");
    } else if (cleaned.indexOf("0") === 0 && cleaned.length === 11) {
      // UK-like numbers (11 digits, starting with 0)
      phoneNumber = lib.parsePhoneNumberFromString(cleaned, "GB");
    } else {
      // Everything else, including other international formats
      phoneNumber = lib.parsePhoneNumberFromString(cleaned);
    }

    return phoneNumber || cleaned;
  }

  /**
   * format "E.164" -> "+12505091026"
   * format "DISPLAY" (default) -> vcard-qr's CUSTOM format, except North
   * American numbers keep their +1 for signatures (vcard-qr drops it):
   *   "+1 (250) 509-1026"
   *   "+44 (0)7700 900123", "+33 (0)6 12 34 56 78"  trunk 0 in brackets, so the
   *                                               number reads both ways
   *   "+52 55 1234 5678", "+39 06 1234 5678"      no trunk 0 (or it's part of the number)
   */
  function format(number, fmt) {
    var result = parse(number);
    if (typeof result === "string") return result;
    if (fmt === "E.164") return result.format("E.164");

    if (result.countryCallingCode === "1") return "+1 " + result.format("NATIONAL");

    var international = result.formatInternational();
    var callingCode = "+" + result.countryCallingCode + " ";
    var nationalDigits = result.formatNational().replace(/\D/g, "");
    if (nationalDigits === "0" + result.nationalNumber && international.indexOf(callingCode) === 0) {
      return callingCode + "(0)" + international.substring(callingCode.length);
    }
    return international;
  }

  /** Looks like a phone number rather than a username or URL. */
  function isPotentialPhoneNumber(value) {
    return !!value && /^[+\d\s().-]+$/.test(value);
  }

  /** The number in a signal.me/#p/+123... link, or null. */
  function fromSignalUrl(url) {
    var m = /signal\.me\/#p\/(\+\d+)/.exec(url || "");
    return m ? m[1] : null;
  }

  global.StandPhone = { parse: parse, format: format, isPotentialPhoneNumber: isPotentialPhoneNumber, fromSignalUrl: fromSignalUrl };
})(window);
