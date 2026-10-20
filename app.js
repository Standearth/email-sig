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

    var notes = [];
    params.forEach(function (value, key) {
      if ((key === "note" || key === "inote") && value.trim())
        notes.push({ text: value.trim(), italic: key === "inote" });
    });
    if (notes.length) state.notes = notes;

    return state;
  }

  function toParams(state) {
    var p = new URLSearchParams();
    Object.keys(SIMPLE_PARAMS).forEach(function (k) {
      var v = (state[SIMPLE_PARAMS[k]] || "").trim();
      if (v) p.set(k, v);
    });
    state.contacts.forEach(function (c) {
      var label = c.label.trim(),
        value = c.value.trim(),
        ext = (c.ext || "").trim();
      if (!label && !value && !ext) return;
      var f = CONFIG.contactParams.filter(function (f) {
        return f.label.toLowerCase() === label.toLowerCase();
      })[0];
      if (f && !p.has(f.param) && (!ext || f.extensionParam)) {
        if (value) p.set(f.param, compactPhone(value));
        if (ext) p.set(f.extensionParam, ext);
      } else {
        p.append(
          "contact",
          (label ? label + ":" : "") + value + (ext ? "|" + ext : ""),
        );
      }
    });
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
          !!n.italic === !!defaultNotes[i].italic
        );
      });
    if (!same) {
      notes.forEach(function (n) {
        p.append(n.italic ? "inote" : "note", n.text.trim());
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

  var state = fromParams(readUrlParams());
  if (state) {
    // Params seed the draft; drop them so later edits survive a reload.
    save(state);
    history.replaceState(null, "", location.pathname);
  } else {
    state = loadSaved() || defaults();
  }

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
  }

  // ---------- actions ----------

  var statusTimer;
  function setStatus(msg, isError) {
    els.status.textContent = msg;
    els.status.classList.toggle("error", !!isError);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      els.status.textContent = "";
    }, 5000);
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

  function copyText(text, okMsg) {
    var done = function () {
      setStatus(okMsg);
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
      setStatus("Couldn't copy automatically — please copy it manually.", true);
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
    btn.className = "btn small ghost";
    btn.textContent = office.name;
    btn.title = office.number;
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
  els.contacts.addEventListener("focusout", function (e) {
    if (!e.target.classList.contains("value-input")) return;
    var formatted = formatPhone(e.target.value);
    if (formatted !== e.target.value) {
      e.target.value = formatted;
      update();
    }
  });
  moveOrRemove(els.notes);

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
    var link = location.origin + location.pathname + "#/?" + toParams(state);
    copyText(
      link,
      "Pre-fill link copied — anyone opening it gets these details filled in.",
    );
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
  });

  // A new pre-fill link opened in this tab only changes the hash; reload to apply it.
  window.addEventListener("hashchange", function () {
    if (location.hash.indexOf("=") !== -1) location.reload();
  });

  fillForm();
  render();
})();
