(function () {
  "use strict";

  var STORAGE_KEY = "stand-email-sig:v1";
  var CONFIG = window.STAND_SIG_CONFIG;
  var OFFICE_LABEL = CONFIG.contactParams.filter(function (f) {
    return f.param === "office_phone";
  })[0].label;

  // Office numbers from the QR generator's phone options format
  var OFFICES = (function () {
    var sets = CONFIG.officePhoneOptions || [];
    var set =
      sets.filter(function (s) {
        return s.key === "stand.earth";
      })[0] ||
      sets.filter(function (s) {
        return !s.key;
      })[0] ||
      sets[0];
    return ((set && set.phone_options) || []).map(function (o) {
      var name = o.display
        .split(/\s+[–—-]\s+/)
        .pop()
        .trim();
      return {
        name: name,
        key: name.toLowerCase().replace(/[^a-z]/g, ""),
        number: formatPhone(o.value),
      };
    });
  })();
  var LAND_EXAMPLE = "[Land acknowledgement, if you wish to include one.]";

  var WORKWEEK_EXAMPLE =
    "Stand.earth has adopted a four-day work week. My usual working hours are Mon-Thu [9am-5pm Pacific Time].";

  // `template` marks example wording: until the person edits the note, the
  // `highlight` part (or the whole note, if there's no highlight) is shown
  // as placeholder.
  var PRESETS = {
    workweek: {
      text: WORKWEEK_EXAMPLE,
      italic: false,
      template: WORKWEEK_EXAMPLE,
      highlight: "[9am-5pm Pacific Time]",
    },
    land: { text: LAND_EXAMPLE, italic: true, template: LAND_EXAMPLE },
    sms: {
      text: "You can contact me by SMS text message at the above number. Message and data rates may apply. Text HELP for help or STOP to opt-out. See our privacy policy for more info.",
      italic: false,
    },
  };

  function defaults() {
    return {
      firstName: "",
      lastName: "",
      pronouns: "",
      title: "",
      contacts: [
        { label: OFFICE_LABEL, value: "", ext: "" },
        { label: "Cell", value: "", ext: "" },
      ],
      notes: [
        Object.assign({}, PRESETS.workweek),
        Object.assign({}, PRESETS.land),
      ],
    };
  }

  // ---------- URL parameters ----------
  //
  // These match the QR code generator (qr.stand.earth) so the same staff
  // spreadsheet link works for both: first_name, last_name, title,
  // office_phone, extension, work_phone, cell_phone, whatsapp and signal.
  // Params it uses that a signature doesn't need (email, org, website,
  // linkedin, notes, presets, styling) are ignored. Signature-only extras:
  //   pronouns
  //   contact=Label:Value|Ext   extra line (repeatable, "|Ext" optional)
  //   note=Text / inote=Text    footer note / italic footer note (repeatable;
  //                             replaces the default notes)
  //   link=N:Words|https://...  link those words in the Nth note (repeatable)
  //   no_contacts=1, no_notes=1 the person removed every contact line / note
  // The page keeps its own URL in this format as you edit, so a bookmark
  // brings the signature back, rebuilt with whatever the template is then.
  // Params can be in the query string (?a=b) or the hash (#/?a=b), like the
  // QR generator's #/vcard/?a=b links. Empty values are ignored.

  var SIMPLE_PARAMS = {
    first_name: "firstName",
    last_name: "lastName",
    pronouns: "pronouns",
    title: "title",
  };
  var LIST_PARAMS = ["contact", "note", "inote"];

  function readUrlParams() {
    var hash = location.hash;
    var q = hash.indexOf("?");
    var hashQuery =
      q !== -1
        ? hash.slice(q + 1)
        : hash.indexOf("=") !== -1
          ? hash.replace(/^#\/?/, "")
          : "";
    return mergeParams(
      new URLSearchParams(location.search),
      new URLSearchParams(hashQuery),
    );
  }

  // Values in `over` replace those in `base` key by key.
  function mergeParams(base, over) {
    var out = new URLSearchParams(base);
    var seen = {};
    over.forEach(function (value, key) {
      if (!seen[key]) out.delete(key);
      seen[key] = true;
      out.append(key, value);
    });
    return out;
  }

  // Format anything that looks like a phone number the way the QR generator
  // does; leave everything else (Signal usernames, text) as given.
  function formatPhone(raw) {
    raw = (StandPhone.fromSignalUrl(raw) || raw || "").trim();
    if (!StandPhone.isPotentialPhoneNumber(raw)) return raw;
    return typeof StandPhone.parse(raw) === "string"
      ? raw
      : StandPhone.format(raw);
  }

  // E.164 ("+16043316201") for tidy links; non-numbers as given
  function compactPhone(value) {
    if (!StandPhone.isPotentialPhoneNumber(value)) return value;
    return typeof StandPhone.parse(value) === "string"
      ? value
      : StandPhone.format(value, "E.164");
  }

  function findOffice(value) {
    var key = (value || "").toLowerCase().replace(/[^a-z]/g, "");
    var digits = (value || "").replace(/\D/g, "");
    return OFFICES.filter(function (o) {
      return (
        o.key === key || (digits && o.number.replace(/\D/g, "") === digits)
      );
    })[0];
  }

  // "he/him", "HE / HIM" -> "He / Him": match the suggestions in the
  // pronouns field ignoring case and spaces; anything else is kept as given.
  function normalizePronouns(value) {
    var key = function (v) { return v.toLowerCase().replace(/\s+/g, ""); };
    var options = document.querySelectorAll("#pronoun-options option");
    for (var i = 0; i < options.length; i++) {
      if (key(options[i].value) === key(value || "")) return options[i].value;
    }
    return (value || "").trim();
  }

  function fromParams(params) {
    var get = function (k) {
      return (params.get(k) || "").trim();
    };

    var relevant = Object.keys(SIMPLE_PARAMS).concat(
      LIST_PARAMS,
      CONFIG.contactParams.map(function (f) {
        return f.param;
      }),
      "extension",
      "link",
      "no_contacts",
      "no_notes",
    );
    if (
      !relevant.some(function (k) {
        return params.getAll(k).some(function (v) {
          return v.trim();
        });
      })
    )
      return null;

    var state = defaults();
    Object.keys(SIMPLE_PARAMS).forEach(function (k) {
      if (get(k)) state[SIMPLE_PARAMS[k]] = get(k);
    });
    state.pronouns = normalizePronouns(state.pronouns);

    var lines = [];
    CONFIG.contactParams.forEach(function (f) {
      var value = get(f.param);
      var ext = f.extensionParam ? get(f.extensionParam) : "";
      if (!value && !ext) return;
      var office = f.param === "office_phone" && findOffice(value);
      lines.push({
        label: f.label,
        value: office ? office.number : value ? formatPhone(value) : "",
        ext: ext,
      });
    });
    params.getAll("contact").forEach(function (raw) {
      if (!raw.trim()) return;
      var ext = "";
      var bar = raw.lastIndexOf("|");
      if (bar !== -1) {
        ext = raw.slice(bar + 1).trim();
        raw = raw.slice(0, bar);
      }
      var i = raw.indexOf(":");
      lines.push(
        i === -1
          ? { label: "", value: formatPhone(raw), ext: ext }
          : {
              label: raw.slice(0, i).trim(),
              value: formatPhone(raw.slice(i + 1)),
              ext: ext,
            },
      );
    });
    if (lines.length) state.contacts = lines;
    else if (get("no_contacts")) state.contacts = [];

    var notes = [];
    params.forEach(function (value, key) {
      if ((key === "note" || key === "inote") && value.trim())
        notes.push(withTemplate({ text: value.trim(), italic: key === "inote" }));
    });
    params.getAll("link").forEach(function (raw) {
      var m = /^(\d+):([^|]+)\|(.+)$/.exec(raw.trim());
      var note = m && notes[Number(m[1]) - 1];
      var href = m && StandSignature.safeHref(m[3].trim());
      if (note && href) (note.links = note.links || []).push({ text: m[2].trim(), href: href });
    });
    if (notes.length) state.notes = notes;
    else if (get("no_notes")) state.notes = [];

    return state;
  }

  // A note that is still a preset's example text keeps its highlighting
  function withTemplate(n) {
    Object.keys(PRESETS).forEach(function (k) {
      var preset = PRESETS[k];
      if (preset.template && n.text === preset.template) {
        n.template = preset.template;
        if (preset.highlight) n.highlight = preset.highlight;
      }
    });
    return n;
  }

  function toParams(state) {
    var p = new URLSearchParams();
    Object.keys(SIMPLE_PARAMS).forEach(function (k) {
      var v = (state[SIMPLE_PARAMS[k]] || "").trim();
      if (v) p.set(k, v);
    });
    // Lines with nothing filled in are just placeholders: leave them out
    var entries = [];
    var used = {};
    state.contacts.forEach(function (c) {
      var label = c.label.trim(),
        value = c.value.trim(),
        ext = (c.ext || "").trim();
      if (!value && !ext) return;
      var f = CONFIG.contactParams.filter(function (f) {
        return f.label.toLowerCase() === label.toLowerCase();
      })[0];
      if (f && (used[f.param] || (ext && !f.extensionParam))) f = null;
      if (f) used[f.param] = true;
      entries.push({ label: label, value: value, ext: ext, f: f });
    });
    // fromParams() rebuilds shared params (office_phone, ...) first, in
    // config order, then contact= lines. If that would reorder the person's
    // lines, write them all as contact= lines instead.
    var order = function (e) { return CONFIG.contactParams.indexOf(e.f); };
    var rebuilt = entries.filter(function (e) { return e.f; })
      .sort(function (a, b) { return order(a) - order(b); })
      .concat(entries.filter(function (e) { return !e.f; }));
    var keepsOrder = rebuilt.every(function (e, i) { return e === entries[i]; });
    entries.forEach(function (e) {
      if (e.f && keepsOrder) {
        if (e.value) p.set(e.f.param, compactPhone(e.value));
        if (e.ext) p.set(e.f.extensionParam, e.ext);
      } else {
        p.append("contact", (e.label ? e.label + ":" : "") + e.value + (e.ext ? "|" + e.ext : ""));
      }
    });
    if (!state.contacts.length) p.set("no_contacts", "1");
    // Only include notes when they differ from the defaults, to keep links short
    var notes = state.notes.filter(function (n) {
      return n.text.trim();
    });
    var defaultNotes = defaults().notes;
    var same =
      notes.length === defaultNotes.length &&
      notes.every(function (n, i) {
        return (
          n.text.trim() === defaultNotes[i].text &&
          !!n.italic === !!defaultNotes[i].italic &&
          !(n.links && n.links.length)
        );
      });
    if (!notes.length) {
      p.set("no_notes", "1");
    } else if (!same) {
      notes.forEach(function (n, i) {
        p.append(n.italic ? "inote" : "note", n.text.trim());
        (n.links || []).forEach(function (l) {
          p.append("link", i + 1 + ":" + l.text + "|" + l.href);
        });
      });
    }
    return p.toString();
  }

  function loadSaved() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !Array.isArray(s.contacts) || !Array.isArray(s.notes))
        return null;
      if (s.name && !s.firstName) s.firstName = s.name; // drafts from before the name split
      return s;
    } catch (e) {
      return null;
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable: fine, it's only a convenience */
    }
  }

  // A link (or bookmark) wins; otherwise pick up the draft saved in this browser
  var state = fromParams(readUrlParams()) || loadSaved() || defaults();

  // ---------- DOM ----------

  var $ = function (id) {
    return document.getElementById(id);
  };
  var els = {
    firstName: $("f-first-name"),
    lastName: $("f-last-name"),
    pronouns: $("f-pronouns"),
    title: $("f-title"),
    contacts: $("contacts"),
    notes: $("notes"),
    preview: $("preview"),
    code: $("code"),
    warning: $("warning"),
    status: $("status"),
  };

  function readForm() {
    state.firstName = els.firstName.value;
    state.lastName = els.lastName.value;
    state.pronouns = els.pronouns.value;
    state.title = els.title.value;
    state.contacts = Array.prototype.map.call(
      els.contacts.children,
      function (row) {
        return {
          label: row.querySelector(".label-input").value,
          value: row.querySelector(".value-input").value,
          ext: row.querySelector(".ext-input").value,
        };
      },
    );
    state.notes = Array.prototype.map.call(els.notes.children, function (row) {
      var n = {
        text: row.querySelector(".note-input").value,
        italic: row.querySelector(".italic-input").checked,
      };
      if (row.dataset.template) n.template = row.dataset.template;
      if (row.dataset.highlight) n.highlight = row.dataset.highlight;
      var links = getLinks(row);
      if (links.length) n.links = links;
      return n;
    });
  }

  function addContactRow(c, focus) {
    var row = $("contact-row").content.firstElementChild.cloneNode(true);
    row.querySelector(".label-input").value = c.label || "";
    row.querySelector(".value-input").value = c.value || "";
    row.querySelector(".ext-input").value = c.ext || "";
    els.contacts.appendChild(row);
    if (focus)
      row.querySelector(c.label ? ".value-input" : ".label-input").focus();
  }

  function addNoteRow(n, focus) {
    var row = $("note-row").content.firstElementChild.cloneNode(true);
    row.querySelector(".note-input").value = n.text || "";
    row.querySelector(".italic-input").checked = !!n.italic;
    if (n.template) row.dataset.template = n.template;
    if (n.highlight) row.dataset.highlight = n.highlight;
    setLinks(row, n.links || []);
    els.notes.appendChild(row);
    if (focus) row.querySelector(".note-input").focus();
  }

  function fillForm() {
    els.firstName.value = state.firstName || "";
    els.lastName.value = state.lastName || "";
    els.pronouns.value = state.pronouns;
    els.title.value = state.title;
    els.contacts.innerHTML = "";
    state.contacts.forEach(function (c) {
      addContactRow(c);
    });
    els.notes.innerHTML = "";
    state.notes.forEach(function (n) {
      addNoteRow(n);
    });
  }

  // ---------- rendering ----------

  // Resolve asset URLs against the page location so images point at the
  // deployed site (e.g. https://<org>.github.io/<repo>/assets/...).
  var assetBase = new URL(".", location.href).href;
  var isLocalFile = location.protocol === "file:";

  function outputHtml() {
    return StandSignature.render(state, { assetBase: assetBase });
  }

  function placeholderCount() {
    var n = 0;
    StandSignature.render(state, {
      assetBase: assetBase,
      mark: function (t) {
        n++;
        return t;
      },
    });
    return n;
  }

  // ---------- links in footer notes ----------
  //
  // Each note keeps its links as {text, href} pairs (in data-links on its
  // row); the template links the first occurrence of each text. The note
  // itself stays a plain textarea: linked words are drawn by a layer behind
  // it, and clicking one opens a small Edit / Remove bubble.

  function getLinks(row) {
    try {
      var links = JSON.parse(row.dataset.links || "[]");
      if (!Array.isArray(links)) return [];
      // Drop anything malformed (e.g. a hand-edited saved draft)
      return links.filter(function (l) {
        return l && typeof l.text === "string" && l.text && typeof l.href === "string" && StandSignature.safeHref(l.href);
      });
    } catch (e) {
      return [];
    }
  }

  function setLinks(row, links) {
    row.dataset.links = JSON.stringify(links);
  }

  // "native-land.ca/maps" -> "https://native-land.ca/maps"; "" if not a web link
  function normalizeUrl(value) {
    var v = value.trim();
    if (!v) return "";
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) {
      if (/\s/.test(v) || v.indexOf(".") === -1) return "";
      v = "https://" + v;
    }
    return StandSignature.safeHref(v);
  }

  function shortUrl(href) {
    var s = href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    return s.length > 40 ? s.slice(0, 39) + "…" : s;
  }

  // This note's links, then site-wide ones like "privacy policy"
  function rowRanges(row) {
    var text = row.querySelector(".note-input").value;
    return StandSignature.linkRanges(text, getLinks(row).concat(CONFIG.noteLinks || []));
  }

  function isAutoLink(link) {
    return (CONFIG.noteLinks || []).indexOf(link) !== -1;
  }

  // Grow the box to fit its text, so it never scrolls and the highlight
  // layer behind it wraps exactly the same way.
  function autoGrow(ta) {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + (ta.offsetHeight - ta.clientHeight) + "px";
  }

  // The layer behind the box repeats its text invisibly, with linked words
  // wrapped in <mark> so they show through underlined and tinted.
  function renderHighlights(row) {
    var ta = row.querySelector(".note-input");
    var layer = row.querySelector(".note-highlights");
    var text = ta.value;
    var pos = 0;
    layer.textContent = "";
    rowRanges(row).forEach(function (r, i) {
      layer.append(text.slice(pos, r.start));
      var mark = document.createElement("mark");
      mark.className = "note-link" + (isAutoLink(r.link) ? " auto" : "");
      mark.dataset.i = i;
      mark.textContent = text.slice(r.start, r.end);
      layer.append(mark);
      pos = r.end;
    });
    // A trailing newline needs something after it to take up its line
    layer.append(text.slice(pos) + (text.slice(-1) === "\n" ? " " : ""));
    autoGrow(ta);
  }

  // Index into rowRanges() of the link the caret is in, or -1
  function linkAtCaret(row) {
    var ta = row.querySelector(".note-input");
    if (ta.selectionStart !== ta.selectionEnd) return -1;
    var c = ta.selectionStart;
    var ranges = rowRanges(row);
    for (var i = 0; i < ranges.length; i++) {
      if (ranges[i].start <= c && c <= ranges[i].end) return i;
    }
    return -1;
  }

  function hideBubble(row) {
    row.querySelector(".link-bubble").hidden = true;
  }

  // Show the link's address with Edit / Remove just under the linked word
  function updateBubble(row) {
    var i = linkAtCaret(row);
    var r = rowRanges(row)[i];
    var mark = row.querySelector('.note-highlights mark[data-i="' + i + '"]');
    if (!r || !mark) return hideBubble(row);
    var bubble = row.querySelector(".link-bubble");
    var auto = isAutoLink(r.link);
    var a = bubble.querySelector(".link-bubble-url");
    a.href = r.href;
    a.textContent = shortUrl(r.href);
    a.title = r.href;
    bubble.querySelector(".link-bubble-actions").hidden = auto;
    bubble.querySelector(".link-bubble-auto").hidden = !auto;
    bubble.dataset.text = r.link.text;
    bubble.hidden = false;
    var width = row.querySelector(".note-field").clientWidth;
    bubble.style.top = mark.offsetTop + mark.offsetHeight + 6 + "px";
    bubble.style.left = Math.max(0, Math.min(mark.offsetLeft, width - bubble.offsetWidth)) + "px";
  }

  var msgTimer;
  function showLinkMsg(row, msg) {
    var p = row.querySelector(".link-msg");
    p.textContent = msg;
    p.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { p.hidden = true; }, 5000);
  }

  function openLinkFormFor(row, text, href) {
    hideBubble(row);
    row.querySelector(".link-msg").hidden = true;
    var form = row.querySelector(".link-form");
    form.dataset.text = text;
    row.querySelector(".link-form-text").textContent = text;
    row.querySelector("[data-link-save]").textContent = href ? "Save link" : "Add link";
    var input = row.querySelector(".link-url");
    input.value = href || "";
    input.removeAttribute("aria-invalid");
    form.hidden = false;
    input.focus();
    input.select();
  }

  // 🔗 Link / Ctrl+K: link the selected words, or edit the link the caret is in
  function openLinkForm(row) {
    var ta = row.querySelector(".note-input");
    var selected = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
    if (!selected) {
      var r = rowRanges(row)[linkAtCaret(row)];
      if (r && !isAutoLink(r.link)) return openLinkFormFor(row, r.link.text, r.link.href);
      showLinkMsg(row, "Select the words you want to link in the note first, then click 🔗 Link.");
      ta.focus();
      return;
    }
    var existing = getLinks(row).filter(function (l) {
      return l.text.toLowerCase() === selected.toLowerCase();
    })[0];
    openLinkFormFor(row, selected, existing && existing.href);
  }

  function closeLinkForm(row, refocus) {
    var form = row.querySelector(".link-form");
    form.hidden = true;
    delete form.dataset.text;
    if (refocus) row.querySelector(".note-input").focus();
  }

  function saveLink(row) {
    var form = row.querySelector(".link-form");
    var input = row.querySelector(".link-url");
    var text = form.dataset.text;
    if (form.hidden || !text) return;
    var href = normalizeUrl(input.value);
    if (!href) {
      input.setAttribute("aria-invalid", "true");
      showLinkMsg(row, "That doesn't look like a web address. Paste a link starting with https://");
      input.focus();
      return;
    }
    var links = getLinks(row).filter(function (l) {
      return l.text.toLowerCase() !== text.toLowerCase();
    });
    links.push({ text: text, href: href });
    setLinks(row, links);
    row.querySelector(".link-msg").hidden = true;
    closeLinkForm(row, true);
    update();
  }

  function removeLink(row, text) {
    setLinks(row, getLinks(row).filter(function (l) {
      return l.text.toLowerCase() !== (text || "").toLowerCase();
    }));
    hideBubble(row);
    update();
    row.querySelector(".note-input").focus();
  }

  // Forget links whose words have been deleted, so they don't come back
  // unexpectedly if the same words are typed again later.
  function pruneLinks(row) {
    var text = row.querySelector(".note-input").value.toLowerCase();
    var links = getLinks(row);
    var kept = links.filter(function (l) { return text.indexOf(l.text.toLowerCase()) !== -1; });
    if (kept.length !== links.length) {
      setLinks(row, kept);
      update();
    }
  }

  function render() {
    els.preview.innerHTML = StandSignature.render(state, {
      assetBase: assetBase,
      mark: function (t) {
        return (
          '<span class="ph" title="Placeholder — fill this in">' + t + "</span>"
        );
      },
    });
    els.code.textContent = outputHtml();
    // Names the bookmark
    var fullName = [state.firstName, state.lastName].join(" ").trim();
    document.title = fullName ? fullName + " – Stand email signature" : "Stand Email Signature";
    Array.prototype.forEach.call(els.notes.children, renderHighlights);

    var msgs = [];
    var ph = placeholderCount();
    if (ph)
      msgs.push(
        "Highlighted text is placeholder content (" +
          ph +
          " left) — fill it in before copying.",
      );
    if (isLocalFile)
      msgs.push(
        "You're viewing this from a local file, so image links point at your computer. Use the hosted site to generate a signature for real use.",
      );
    els.warning.hidden = !msgs.length;
    els.warning.innerHTML = msgs
      .map(function (m) {
        return "<p>" + m + "</p>";
      })
      .join("");
  }

  function update() {
    readForm();
    save(state);
    render();
    scheduleUrlSync();
  }

  // ---------- the page URL mirrors the signature ----------
  //
  // Kept in the hash (#/?first_name=...), so details never reach the server,
  // in the same format as pre-fill links: bookmark it, or copy it.

  function currentLink() {
    var q = toParams(state);
    return location.origin + location.pathname + (q ? "#/?" + q : "");
  }

  var urlTimer;
  function syncUrl() {
    clearTimeout(urlTimer);
    var link = currentLink();
    if (link !== location.href) history.replaceState(null, "", link);
  }

  function scheduleUrlSync() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(syncUrl, 300);
  }

  // ---------- actions ----------

  var statusTimer;
  function setStatus(msg, isError, el, ms) {
    el = el || els.status;
    el.textContent = msg;
    el.classList.toggle("error", !!isError);
    clearTimeout(el.statusTimer);
    el.statusTimer = setTimeout(function () {
      el.textContent = "";
    }, ms || 5000);
  }

  function confirmPlaceholders() {
    return (
      !placeholderCount() ||
      confirm(
        "Your signature still contains placeholder text. Continue anyway?",
      )
    );
  }

  function plainText() {
    return els.preview.innerText
      .replace(/ /g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim();
  }

  // Fallback: select the rendered preview and use the browser's own copy.
  function copyBySelection(node) {
    var range = document.createRange();
    range.selectNode(node);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    sel.removeAllRanges();
    return ok;
  }

  function copyRich() {
    if (!confirmPlaceholders()) return;
    var html = outputHtml();
    if (navigator.clipboard && window.ClipboardItem) {
      navigator.clipboard
        .write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plainText()], { type: "text/plain" }),
          }),
        ])
        .then(function () {
          setStatus("Signature copied — paste it into Gmail's signature box.");
        })
        .catch(fallback);
    } else {
      fallback();
    }

    function fallback() {
      // Render without placeholder highlights, copy, then restore
      els.preview.innerHTML = html;
      var ok = copyBySelection(els.preview.firstElementChild);
      render();
      if (ok)
        setStatus("Signature copied — paste it into Gmail's signature box.");
      else
        setStatus(
          "Couldn't copy automatically. Select the preview, then press Ctrl/⌘+C.",
          true,
        );
    }
  }

  function copyText(text, okMsg, el) {
    var done = function () {
      setStatus(okMsg, false, el);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        legacy() ? done() : fail();
      });
    } else {
      legacy() ? done() : fail();
    }
    function legacy() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(ta);
      return ok;
    }
    function fail() {
      setStatus("Couldn't copy automatically — please copy it manually.", true, el);
    }
  }

  function download() {
    if (!confirmPlaceholders()) return;
    var doc =
      '<!doctype html>\n<html>\n<head>\n<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\n' +
      "<title>Email signature</title>\n</head>\n<body>\n" +
      outputHtml() +
      "\n</body>\n</html>\n";
    var fullName = [state.firstName, state.lastName].join(" ").trim();
    var slug = (fullName || "stand")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    a.download = slug + "-email-signature.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 1000);
    setStatus("Downloaded " + a.download);
  }

  function moveOrRemove(container) {
    container.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn) return;
      var row = btn.closest(".row");
      if (btn.hasAttribute("data-remove")) {
        row.remove();
      } else if (btn.dataset.move === "-1" && row.previousElementSibling) {
        container.insertBefore(row, row.previousElementSibling);
      } else if (btn.dataset.move === "1" && row.nextElementSibling) {
        container.insertBefore(row.nextElementSibling, row);
      } else {
        return;
      }
      update();
    });
  }

  // Fill the first Office line that has no number yet, or add a new one.
  function useOffice(office) {
    var row = Array.prototype.filter.call(els.contacts.children, function (r) {
      var label = r.querySelector(".label-input").value.trim();
      return (
        !r.querySelector(".value-input").value.trim() &&
        (label === OFFICE_LABEL || !label)
      );
    })[0];
    if (!row) {
      addContactRow({ label: OFFICE_LABEL, value: "" });
      row = els.contacts.lastElementChild;
    }
    if (!row.querySelector(".label-input").value.trim())
      row.querySelector(".label-input").value = OFFICE_LABEL;
    row.querySelector(".value-input").value = office.number;
    row.querySelector(".ext-input").focus();
    update();
  }

  // ---------- wire up ----------

  OFFICES.forEach(function (office) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn small add-btn";
    btn.textContent = "+ " + office.name + " office";
    btn.title = "Office line with " + office.number + ", ready for your extension";
    btn.addEventListener("click", function () {
      useOffice(office);
    });
    $("office-buttons").appendChild(btn);
  });

  [
    ["land-policy", CONFIG.landAcknowledgement.policyUrl],
    ["land-guide", CONFIG.landAcknowledgement.guideUrl],
  ].forEach(function (pair) {
    var a = $(pair[0]);
    if (pair[1]) a.href = pair[1];
    else a.replaceWith(document.createTextNode(a.textContent));
  });

  $("sig-form").addEventListener("input", update);
  $("sig-form").addEventListener("change", update);
  $("sig-form").addEventListener("submit", function (e) {
    e.preventDefault();
  });
  moveOrRemove(els.contacts);
  // Tidy phone numbers when leaving the field, e.g. 2505091026 -> +1 (250) 509-1026
  els.pronouns.addEventListener("focusout", function () {
    var normalized = normalizePronouns(els.pronouns.value);
    if (normalized !== els.pronouns.value) {
      els.pronouns.value = normalized;
      update();
    }
  });
  els.contacts.addEventListener("focusout", function (e) {
    if (!e.target.classList.contains("value-input")) return;
    var formatted = formatPhone(e.target.value);
    if (formatted !== e.target.value) {
      e.target.value = formatted;
      update();
    }
  });
  moveOrRemove(els.notes);
  els.notes.addEventListener("click", function (e) {
    var row = e.target.closest(".row");
    if (!row) return;
    if (e.target.classList.contains("note-input")) return updateBubble(row);
    var btn = e.target.closest("button");
    if (!btn) return;
    var bubbleText = row.querySelector(".link-bubble").dataset.text;
    if (btn.hasAttribute("data-link")) openLinkForm(row);
    else if (btn.hasAttribute("data-link-save")) saveLink(row);
    else if (btn.hasAttribute("data-link-cancel")) closeLinkForm(row, true);
    else if (btn.hasAttribute("data-unlink")) removeLink(row, bubbleText);
    else if (btn.hasAttribute("data-link-edit")) {
      var link = getLinks(row).filter(function (l) { return l.text === bubbleText; })[0];
      if (link) openLinkFormFor(row, link.text, link.href);
    }
  });
  // Keep focus in the box while using the bubble, so it doesn't close first
  els.notes.addEventListener("mousedown", function (e) {
    if (e.target.closest(".link-bubble")) e.preventDefault();
  });
  els.notes.addEventListener("input", function (e) {
    if (e.target.classList.contains("note-input")) hideBubble(e.target.closest(".row"));
  });
  els.notes.addEventListener("focusout", function (e) {
    if (!e.target.classList.contains("note-input")) return;
    var row = e.target.closest(".row");
    hideBubble(row);
    pruneLinks(row);
  });
  els.notes.addEventListener("keyup", function (e) {
    if (!e.target.classList.contains("note-input")) return;
    if (/^(Arrow|Home|End|Page)/.test(e.key)) updateBubble(e.target.closest(".row"));
  });
  window.addEventListener("resize", function () {
    Array.prototype.forEach.call(els.notes.children, function (row) {
      renderHighlights(row);
      hideBubble(row);
    });
  });
  els.notes.addEventListener("keydown", function (e) {
    var row = e.target.closest(".row");
    if (!row) return;
    if (e.target.classList.contains("note-input") && e.key === "Escape") {
      hideBubble(row);
    } else if (e.target.classList.contains("note-input") && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openLinkForm(row);
    } else if (e.target.classList.contains("link-url")) {
      if (e.key === "Enter") {
        e.preventDefault();
        saveLink(row);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeLinkForm(row, true);
      }
    }
  });

  $("add-contact").addEventListener("click", function () {
    addContactRow({ label: "", value: "", ext: "" }, true);
    update();
  });
  $("add-note").addEventListener("click", function () {
    addNoteRow({ text: "", italic: false }, true);
    update();
  });
  document.querySelectorAll("[data-preset]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      addNoteRow(Object.assign({}, PRESETS[btn.dataset.preset]), true);
      update();
    });
  });

  $("copy-rich").addEventListener("click", copyRich);
  $("copy-html").addEventListener("click", function () {
    if (confirmPlaceholders()) copyText(outputHtml(), "HTML code copied.");
  });
  $("download").addEventListener("click", download);
  $("copy-link").addEventListener("click", function () {
    readForm();
    syncUrl();
    copyText(
      currentLink(),
      "Link copied. Opening it brings back this signature with all its details.",
      $("footer-status"),
    );
  });

  // There's no standard way for a page to add a bookmark itself, so: the
  // share sheet on phones (it has "Add Bookmark"), the shortcut elsewhere.
  $("bookmark").addEventListener("click", function () {
    readForm();
    syncUrl();
    var touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (touch && navigator.share) {
      navigator.share({ title: document.title, url: currentLink() }).catch(function () {});
      return;
    }
    var mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
    setStatus(
      touch
        ? "Use your browser's menu (⋮ or the share icon) to bookmark this page."
        : "Press " + (mac ? "⌘+D" : "Ctrl+D") + " to bookmark this page.",
      false,
      $("footer-status"),
      10000,
    );
  });
  // Make sure a quick Ctrl/⌘+D straight after typing saves the latest version
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      readForm();
      syncUrl();
    }
  });
  $("reset").addEventListener("click", function () {
    if (!confirm("Clear all fields and start over?")) return;
    state = defaults();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    history.replaceState(null, "", location.pathname);
    fillForm();
    render();
    syncUrl();
  });

  // A new pre-fill link opened in this tab only changes the hash; reload to apply it.
  window.addEventListener("hashchange", function () {
    if (location.hash.indexOf("=") !== -1) location.reload();
  });

  fillForm();
  render();
  syncUrl(); // tidy whatever link we arrived with into the canonical form
})();
