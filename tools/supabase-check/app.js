/* global NordKilnSupabaseCheck */
(function () {
  "use strict";
  var L = NordKilnSupabaseCheck;

  var $ = function (id) {
    return document.getElementById(id);
  };

  function setStatus(msg, kind) {
    var el = $("status");
    el.textContent = msg || "";
    el.className = "status" + (kind ? " " + kind : "");
  }

  function show(el, on) {
    el.hidden = !on;
  }

  async function fetchText(url, opts) {
    var res = await fetch(url, Object.assign({ credentials: "omit", mode: "cors" }, opts || {}));
    if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
    return res.text();
  }

  async function fetchJson(url, headers) {
    var res = await fetch(url, {
      credentials: "omit",
      mode: "cors",
      headers: headers || {},
    });
    return { ok: res.ok, status: res.status, json: res.ok ? await res.json().catch(function () { return null; }) : null, res: res };
  }

  async function probeTables(supabaseUrl, anonKey, onProgress) {
    var base = supabaseUrl.replace(/\/+$/, "");
    var headers = {
      apikey: anonKey,
      Authorization: "Bearer " + anonKey,
      Accept: "application/openapi+json, application/json",
    };
    var tables = [];
    var openapiErr = null;
    var openapi;
    try {
      var root = await fetchJson(base + "/rest/v1/", headers);
      if (!root.ok) {
        openapiErr = "OpenAPI root returned HTTP " + root.status;
      } else {
        openapi = root.json;
        tables = L.parseOpenApiTables(openapi);
      }
    } catch (e) {
      openapiErr = e.message || String(e);
    }

    var results = [];
    for (var i = 0; i < tables.length; i++) {
      var name = tables[i];
      if (onProgress) onProgress(i + 1, tables.length, name);
      var row = {
        name: name,
        readable: false,
        hasRows: null,
        status: null,
        error: null,
      };
      try {
        var r = await fetch(base + "/rest/v1/" + encodeURIComponent(name) + "?select=*&limit=1", {
          credentials: "omit",
          mode: "cors",
          headers: Object.assign({}, headers, {
            Accept: "application/json",
            Prefer: "count=exact",
          }),
        });
        row.status = r.status;
        if (r.status === 200) {
          row.readable = true;
          var body = await r.json().catch(function () { return []; });
          row.hasRows = Array.isArray(body) && body.length > 0;
          // Do NOT keep or display row contents
        } else if (r.status === 401 || r.status === 403) {
          row.readable = false;
        } else if (r.status === 406 || r.status === 404) {
          row.readable = false;
          row.error = "HTTP " + r.status;
        } else {
          row.error = "HTTP " + r.status;
        }
      } catch (e2) {
        row.error = e2.message || String(e2);
      }
      results.push(row);
    }
    return { tables: results, openapiErr: openapiErr, tableCount: tables.length };
  }

  async function scanFromPageUrl(pageUrl) {
    setStatus("Fetching your page…", "info");
    var html;
    try {
      html = await fetchText(pageUrl);
    } catch (e) {
      var err = e.message || String(e);
      if (/Failed to fetch|NetworkError|CORS|blocked/i.test(err) || err === "Failed to fetch") {
        throw Object.assign(new Error("cors"), { cause: err });
      }
      throw e;
    }

    var analyses = [];
    analyses.push(L.analyzeBundleText(html));
    L.extractInlineScripts(html).forEach(function (s) {
      analyses.push(L.analyzeBundleText(s));
    });

    var scripts = L.extractScriptSrcs(html, pageUrl);
    // Cap to keep the browser responsive
    var maxScripts = 40;
    var fetched = 0;
    var failed = 0;
    for (var i = 0; i < scripts.length && i < maxScripts; i++) {
      setStatus("Fetching script " + (i + 1) + "/" + Math.min(scripts.length, maxScripts) + "…", "info");
      try {
        var js = await fetchText(scripts[i]);
        analyses.push(L.analyzeBundleText(js));
        fetched++;
      } catch (e2) {
        failed++;
      }
    }

    var merged = L.mergeAnalyses(analyses);
    return {
      merged: merged,
      meta: {
        mode: "url",
        scriptsFound: scripts.length,
        scriptsFetched: fetched,
        scriptsFailed: failed,
      },
    };
  }

  function renderReport(state) {
    var merged = state.merged;
    var tableProbe = state.tableProbe || { tables: [] };
    var result = {
      supabaseUrl: (merged.urls && merged.urls[0]) || state.manualUrl || null,
      anonKeyFound: !!(merged.anonKeys && merged.anonKeys.length) || !!state.manualAnon,
      serviceRoleKeys: merged.serviceRoleKeys || [],
      secrets: merged.secrets || [],
      tables: tableProbe.tables || [],
    };
    var grade = L.gradeResult(result);
    var fixes = L.buildFixes(result);

    $("grade-letter").textContent = grade.letter;
    $("grade-letter").setAttribute("data-grade", grade.letter);
    $("grade-summary").textContent = grade.reasons.join(" ");

    // Findings list
    var findings = $("findings");
    findings.innerHTML = "";

    function addFinding(sev, title, body) {
      var div = document.createElement("div");
      div.className = "finding " + sev;
      div.innerHTML =
        "<div class='sev'>" +
        sev.toUpperCase() +
        "</div><div><strong></strong><p class='small'></p></div>";
      div.querySelector("strong").textContent = title;
      div.querySelector("p").textContent = body;
      findings.appendChild(div);
    }

    if (result.serviceRoleKeys.length) {
      result.serviceRoleKeys.forEach(function (k) {
        addFinding(
          "critical",
          "Supabase service_role key in frontend",
          "Masked: " + k.masked + ". This key bypasses RLS. Rotate it immediately and remove it from client code."
        );
      });
    }

    if (result.supabaseUrl) {
      addFinding(
        "info",
        "Supabase project URL",
        result.supabaseUrl +
          (result.anonKeyFound
            ? " · anon key detected (expected in browsers if RLS is correct)"
            : " · no anon JWT found in scanned sources")
      );
    } else if (!state.manualUrl) {
      addFinding("info", "No Supabase URL found", "We did not see a *.supabase.co URL in the page or scripts we could fetch.");
    }

    if (merged.anonKeys && merged.anonKeys.length) {
      addFinding(
        "info",
        "Anon key present",
        "Masked: " +
          merged.anonKeys[0].masked +
          ". The anon key is meant to be public — safety depends on RLS."
      );
    }

    (result.secrets || []).forEach(function (s) {
      addFinding(
        s.severity === "critical" ? "critical" : "high",
        s.name + " in client bundle",
        "Masked: " + s.masked + ". Revoke and move to server-side code."
      );
    });

    var openOnes = (result.tables || []).filter(function (t) {
      return t.readable;
    });
    var closedOnes = (result.tables || []).filter(function (t) {
      return !t.readable;
    });

    if (tableProbe.openapiErr && !(result.tables || []).length) {
      addFinding(
        "high",
        "Could not list tables via PostgREST",
        tableProbe.openapiErr +
          ". If this is CORS, paste the Supabase URL and anon key in manual mode. We still never store them."
      );
    }

    if (openOnes.length) {
      addFinding(
        "critical",
        openOnes.length + " table(s) readable by anonymous visitors",
        openOnes
          .map(function (t) {
            return (
              t.name +
              (t.hasRows === true
                ? " (has at least one row)"
                : t.hasRows === false
                  ? " (readable, currently empty)"
                  : "")
            );
          })
          .join(", ") +
          ". Enable RLS and policies so anon cannot SELECT these."
      );
    } else if ((result.tables || []).length) {
      addFinding(
        "ok",
        "No listed tables readable with the anon key",
        closedOnes.length +
          " table(s) checked; anonymous SELECT was denied or empty of access. Still verify logged-in IDOR with NordKiln Scan."
      );
    }

    // Tables table
    var tb = $("tables-body");
    tb.innerHTML = "";
    (result.tables || []).forEach(function (t) {
      var tr = document.createElement("tr");
      var rowsLabel =
        t.hasRows === true ? "Yes (≥1)" : t.hasRows === false ? "No / empty" : "—";
      tr.innerHTML =
        "<td></td><td></td><td></td><td class='small'></td>";
      tr.cells[0].textContent = t.name;
      tr.cells[1].textContent = t.readable ? "Readable" : "Not readable";
      tr.cells[1].className = t.readable ? "bad" : "ok";
      tr.cells[2].textContent = rowsLabel;
      tr.cells[3].textContent = t.error || (t.status != null ? "HTTP " + t.status : "");
      tb.appendChild(tr);
    });
    show($("tables-wrap"), (result.tables || []).length > 0);

    // Fixes
    var fixesEl = $("fixes");
    fixesEl.innerHTML = "";
    fixes.forEach(function (f) {
      var div = document.createElement("div");
      div.className = "card fix";
      div.innerHTML = "<h3></h3><p></p>";
      div.querySelector("h3").textContent = f.title;
      div.querySelector("p").textContent = f.body;
      fixesEl.appendChild(div);
    });

    show($("report"), true);
    $("report").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function runScan() {
    $("run").disabled = true;
    show($("report"), false);
    try {
      if (!$("own").checked) {
        setStatus("Confirm you own this app (or are authorized to test it) before running.", "err");
        return;
      }

      var mode = document.querySelector('input[name="mode"]:checked').value;
      var merged;
      var meta;
      var supabaseUrl;
      var anonKey;

      if (mode === "url") {
        var pageUrl = ($("app-url").value || "").trim();
        if (!pageUrl) {
          setStatus("Paste your app URL.", "err");
          return;
        }
        if (!/^https?:\/\//i.test(pageUrl)) pageUrl = "https://" + pageUrl;
        try {
          new URL(pageUrl);
        } catch (e) {
          setStatus("That URL looks invalid.", "err");
          return;
        }

        var scanned;
        try {
          scanned = await scanFromPageUrl(pageUrl);
        } catch (e2) {
          if (e2.message === "cors") {
            setStatus(
              "The browser blocked reading that page (CORS). Switch to “Paste Supabase URL + anon key” below — still 100% in your browser.",
              "err"
            );
            document.querySelector('input[name="mode"][value="manual"]').checked = true;
            toggleMode();
            return;
          }
          setStatus("Could not fetch page: " + (e2.message || e2), "err");
          return;
        }
        merged = scanned.merged;
        meta = scanned.meta;
        supabaseUrl = merged.urls[0];
        anonKey = merged.anonKeys[0] && merged.anonKeys[0].token;

        if (!supabaseUrl || !anonKey) {
          setStatus(
            "Scanned " +
              meta.scriptsFetched +
              " script(s). No Supabase URL + anon key pair found. Try manual mode with values from your Supabase API settings.",
            "err"
          );
          // Still show secrets / service_role if any
          renderReport({ merged: merged, tableProbe: { tables: [] }, meta: meta });
          return;
        }
      } else {
        supabaseUrl = ($("sb-url").value || "").trim().replace(/\/+$/, "");
        anonKey = ($("sb-anon").value || "").trim();
        if (!supabaseUrl || !anonKey) {
          setStatus("Need both Supabase project URL and anon key.", "err");
          return;
        }
        if (supabaseUrl.indexOf("supabase.co") === -1) {
          setStatus("URL should look like https://xxxx.supabase.co", "err");
          return;
        }
        var classified = L.classifySupabaseJwt(anonKey);
        if (classified.isServiceRole) {
          setStatus(
            "That JWT is a service_role key, not the anon key. Do not paste service_role into websites. Rotate it in Supabase now.",
            "err"
          );
          merged = {
            urls: [supabaseUrl],
            anonKeys: [],
            serviceRoleKeys: [{ masked: L.maskSecret(anonKey, 12), role: "service_role" }],
            secrets: [],
          };
          renderReport({ merged: merged, tableProbe: { tables: [] }, manualUrl: supabaseUrl });
          return;
        }
        merged = {
          urls: [supabaseUrl],
          anonKeys: [{ token: anonKey, masked: L.maskSecret(anonKey, 12), role: classified.role || "anon" }],
          serviceRoleKeys: [],
          secrets: [],
        };
        meta = { mode: "manual" };
      }

      setStatus("Checking PostgREST / REST tables (read-only, limit=1)…", "info");
      var tableProbe;
      try {
        tableProbe = await probeTables(supabaseUrl, anonKey, function (n, total, name) {
          setStatus("Probing table " + n + "/" + total + ": " + name + " (read-only)…", "info");
        });
      } catch (e3) {
        tableProbe = { tables: [], openapiErr: e3.message || String(e3) };
      }

      setStatus("Done. Nothing was stored or sent to NordKiln — this ran only in your browser.", "ok");
      renderReport({
        merged: merged,
        tableProbe: tableProbe,
        meta: meta,
        manualUrl: supabaseUrl,
        manualAnon: true,
      });
    } finally {
      $("run").disabled = false;
    }
  }

  function toggleMode() {
    var mode = document.querySelector('input[name="mode"]:checked').value;
    show($("mode-url"), mode === "url");
    show($("mode-manual"), mode === "manual");
  }

  document.querySelectorAll('input[name="mode"]').forEach(function (r) {
    r.addEventListener("change", toggleMode);
  });
  $("run").addEventListener("click", function (e) {
    e.preventDefault();
    runScan();
  });
  toggleMode();
})();
