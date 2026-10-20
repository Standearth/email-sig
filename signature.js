/*
 * Stand.earth email signature template.
 *
 * Email clients (Gmail especially) only reliably honour table layout and
 * inline styles, so everything here is deliberately old-school HTML.
 * Images are referenced by absolute URL so they load from wherever this
 * site is hosted (GitHub Pages).
 */
(function (global) {
  "use strict";

  var FONT = "Verdana, Geneva, sans-serif";
  var TEXT_DARK = "#313131";
  var TEXT_BLACK = "#000001"; // not pure black: stops some clients recolouring it

  var CONFIG = global.STAND_SIG_CONFIG;
  var LOGO = CONFIG.logo;
  var SOCIAL_SIZE = 29; // icons are 58x58 files, shown at 2x density

  var TABLE_RESET =
    "line-height: 0px; font-size: 1px; padding: 0px !important; border-spacing: 0px; margin: 0px; border-collapse: collapse;";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function span(text, style) {
    return '<span style="font-family: ' + FONT + "; " + style + ' display: inline;">' + text + "</span>";
  }

  function textCell(inner, tdStyle) {
    return (
      "<tr><td style=\"border-collapse: collapse; font-family: " + FONT + "; font-size: 14px; line-height: 16px; " +
      tdStyle + '"><p style="margin: 0.04px;">' + inner + "</p></td></tr>"
    );
  }

  /** An http(s) URL, normalised, or "" for anything else (javascript:, mailto:, junk). */
  function safeHref(href) {
    try {
      var u = new URL(href);
      if (u.protocol !== "https:" && u.protocol !== "http:") return "";
      return u.href.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
    } catch (e) {
      return "";
    }
  }

  function noteText(s) {
    return esc(s).replace(/\r?\n/g, "<br />");
  }

  /**
   * Where each link applies in a note: the first case-insensitive occurrence
   * of its text that doesn't overlap an earlier link. Shared with the editor's
   * in-box highlighting so the two always agree.
   * Returns [{start, end, href, link}] sorted by start.
   */
  function linkRanges(raw, links) {
    var lower = raw.toLowerCase();
    var ranges = [];
    links.forEach(function (l) {
      var href = l && l.text ? safeHref(l.href) : "";
      if (!href) return;
      var needle = l.text.toLowerCase();
      for (var i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + 1)) {
        var end = i + needle.length;
        var overlaps = ranges.some(function (r) { return i < r.end && end > r.start; });
        if (!overlaps) {
          ranges.push({ start: i, end: end, href: href, link: l });
          break;
        }
      }
    });
    return ranges.sort(function (a, b) { return a.start - b.start; });
  }

  /** Escape a note and wrap its links. One pass, so links can't nest. */
  function linkify(raw, links) {
    var out = "";
    var pos = 0;
    linkRanges(raw, links).forEach(function (r) {
      out += noteText(raw.slice(pos, r.start)) +
        '<a href="' + esc(r.href) + '" target="_blank" rel="nofollow" style="color: ' + TEXT_DARK + '; text-decoration: underline;">' +
        noteText(raw.slice(r.start, r.end)) + "</a>";
      pos = r.end;
    });
    return out + noteText(raw.slice(pos));
  }

  /**
   * Build the signature HTML.
   *
   * data: { firstName, lastName, pronouns, title, contacts: [{label, value, ext}], notes: [{text, italic, template, highlight, links: [{text, href}]}] }
   *   While a note's text still matches its template, its `highlight` part
   *   (or the whole note) is shown as placeholder.
   * opts.assetBase: absolute base URL that asset paths are resolved against.
   * opts.mark: optional function(text) used to wrap placeholder text (preview only).
   */
  function renderSignature(data, opts) {
    opts = opts || {};
    var base = opts.assetBase || "";
    var mark = opts.mark || function (t) { return t; };
    var url = function (path) { return new URL(path, base).href; };

    function field(value, placeholder) {
      var v = (value || "").trim();
      return v ? esc(v) : mark(esc(placeholder));
    }

    var rows = [];

    // Name | pronouns
    var fullName = [data.firstName || "", data.lastName || ""].join(" ").trim();
    var nameLine = span(field(fullName, "Your Name"), "font-size: 14px; line-height: 16px; font-weight: 700; color: " + TEXT_DARK + ";");
    var pronouns = (data.pronouns || "").trim();
    if (pronouns) {
      nameLine += span("&nbsp;&nbsp;| " + esc(pronouns), "font-size: 14px; line-height: 16px; font-weight: 400; color: " + TEXT_BLACK + ";");
    }
    rows.push(textCell(nameLine, "font-weight: 700; padding-bottom: 6px;"));

    // Title
    rows.push(
      textCell(
        span(field(data.title, "Your Job Title"), "font-size: 14px; line-height: 16px; font-weight: 400; color: " + TEXT_BLACK + ";"),
        "font-weight: 400; padding-bottom: 6px;"
      )
    );

    // Contact lines
    (data.contacts || []).forEach(function (c) {
      var label = (c.label || "").trim();
      var value = (c.value || "").trim();
      var ext = (c.ext || "").trim();
      if (!label && !value && !ext) return;
      var inner = "";
      if (label) {
        inner += span(esc(label) + ":&nbsp;", "font-size: 14px; line-height: 16px; font-weight: 700; color: " + TEXT_BLACK + ";");
      }
      var number = value ? esc(value) : mark("+1 (000) 000-0000");
      if (ext) number += " " + esc(CONFIG.extensionPrefix) + " " + esc(ext);
      inner += span(number, "font-size: 14px; line-height: 16px; font-weight: 400; color: " + TEXT_DARK + ";");
      rows.push(textCell(inner, "font-weight: 400; padding: 0px !important;"));
    });

    // Spacer + logo
    rows.push('<tr><td style="border-collapse: collapse; font-size: 13px; line-height: 15px; padding-bottom: 16px;"></td></tr>');
    rows.push(
      '<tr><td style="border-collapse: collapse; line-height: 0px; padding-bottom: 12px;"><p style="margin: 0.04px;">' +
        '<a style="font-size: 0px; line-height: 0px;" target="_blank" rel="nofollow" href="' + esc(LOGO.href) + '">' +
        '<img height="' + LOGO.height + '" width="' + LOGO.width + '" alt="' + esc(LOGO.alt) + '" border="0" ' +
        'style="display: block; width: ' + LOGO.width + "px; height: " + LOGO.height + 'px;" src="' + esc(url(LOGO.file)) + '" />' +
        "</a></p></td></tr>"
    );

    var socialCells = CONFIG.socials.filter(function (s) { return s.enabled; }).map(function (s) {
      return (
        '<td style="padding-right: 4px;"><p style="margin: 0.04px;">' +
        '<a style="font-size: 0px; line-height: 0px;" target="_blank" rel="nofollow" href="' + esc(s.href) + '">' +
        '<img height="' + SOCIAL_SIZE + '" width="' + SOCIAL_SIZE + '" alt="' + esc(s.name) + '" border="0" ' +
        'style="display: block; width: ' + SOCIAL_SIZE + "px; height: " + SOCIAL_SIZE + 'px;" src="' + esc(url(s.file)) + '" />' +
        "</a></p></td>"
      );
    }).join("");

    var noteRows = (data.notes || [])
      .filter(function (n) { return (n.text || "").trim(); })
      .map(function (n) {
        // The person's own links first, then site-wide ones like "privacy policy"
        var text = linkify(n.text.trim(), (n.links || []).concat(CONFIG.noteLinks || []));
        var untouched = n.template && n.text.trim() === n.template.trim();
        if (untouched && n.highlight) {
          var h = esc(n.highlight);
          text = text.replace(h, function () { return mark(h); });
        } else if (untouched) {
          text = mark(text); // untouched example text: all of it needs replacing
        } else {
          // Highlight any remaining [bracketed] placeholders (never across a link's tags)
          text = text.replace(/\[[^\]<>]+\]/g, function (m) { return mark(m); });
        }
        return (
          '<tr><td style="border-collapse: collapse; padding-bottom: 16px;"><p style="margin: 0.04px;">' +
          span(text, "font-size: 10px; line-height: 12px; font-weight: 400;" + (n.italic ? " font-style: italic;" : "") + " color: " + TEXT_DARK + ";") +
          "</p></td></tr>"
        );
      })
      .join("");

    return (
      '<table border="0" cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; ' + TABLE_RESET + ' width: 300px;"><tbody>' +
        '<tr><td style="padding: 0px !important;">' +
          '<table border="0" cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; ' + TABLE_RESET + '"><tbody>' +
            rows.join("") +
          "</tbody></table>" +
        "</td></tr>" +
        '<tr><td style="padding: 0px !important;">' +
          '<table border="0" cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; ' + TABLE_RESET + '"><tbody>' +
            "<tr>" + socialCells + "</tr>" +
            '<tr><td style="border-collapse: collapse; padding-bottom: 18px;"></td></tr>' +
          "</tbody></table>" +
        "</td></tr>" +
        noteRows +
      "</tbody></table>"
    );
  }

  global.StandSignature = { render: renderSignature, safeHref: safeHref, linkRanges: linkRanges };
})(window);
