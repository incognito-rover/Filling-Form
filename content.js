(() => {
  // Order matters: the first rule that matches a field wins, so specific rules come first.
  const RULES = [
    ["__skip", /line\s*[23]\b|address line [23]|extension|middle|prefix|suffix|\blocal\b.*name|\bname\b.*\blocal\b|preferred name|device type|phone code/i],
    ["linkedin", /linked\s*in/i],
    ["github", /git\s*hub/i],
    ["website", /portfolio|personal (web)?site|website|^url$/i],
    ["firstName", /first[\s_-]*name|given[\s_-]*name|fname|forename/i],
    ["lastName", /last[\s_-]*name|family[\s_-]*name|surname|lname/i],
    ["fullName", /^(full[\s_-]*)?name$|your name|full[\s_-]*name|legal name/i],
    ["email", /e-?mail/i],
    ["phone", /phone|mobile|telephone|contact number|\btel\b/i],
    ["zip", /zip|postal|post[\s_-]*code|pin[\s_-]*code/i],
    ["state", /\bstate\b|province|region/i],
    ["city", /\bcity\b|\btown\b/i],
    ["country", /country/i],
    ["address", /address|street/i],
    ["currentCompany", /current (company|employer)|employer|company name|organi[sz]ation/i],
    ["currentTitle", /current (job )?title|job title|current (role|position)/i],
    ["yearsExperience", /years? of (relevant |work |total )?experience|experience.*years/i],
    ["salary", /salary|compensation|ctc|pay expectation/i],
    ["noticePeriod", /notice period|availab(le|ility) to start|start date/i],
    ["coverLetter", /cover[\s_-]*letter|additional information|why .* (join|work)/i],
  ];
  const AUTOCOMPLETE = {
    "given-name": "firstName", "family-name": "lastName", name: "fullName", email: "email", tel: "phone",
    "postal-code": "zip", "address-level1": "state", "address-level2": "city", country: "country",
    "country-name": "country", "street-address": "address", organization: "currentCompany",
    "organization-title": "currentTitle", url: "website",
  };

  const labelText = el => {
    const parts = [];
    if (el.labels) for (const l of el.labels) parts.push(l.textContent);
    const aria = el.getAttribute("aria-labelledby");
    if (aria) for (const id of aria.split(/\s+/)) parts.push(document.getElementById(id)?.textContent || "");
    parts.push(el.getAttribute("aria-label"), el.placeholder, el.name, el.id, el.getAttribute("data-qa"), el.getAttribute("data-automation-id"));
    return parts.filter(Boolean).join(" ").replace(/[*:]/g, " ").trim();
  };

  const keyFor = el => {
    const ac = (el.getAttribute("autocomplete") || "").split(/\s+/).pop();
    if (AUTOCOMPLETE[ac]) return AUTOCOMPLETE[ac];
    if (el.type === "email") return "email";
    if (el.type === "tel") return "phone";
    const text = labelText(el);
    for (const [key, re] of RULES) if (re.test(text)) return key === "__skip" ? null : key;
    return null;
  };

  // Frameworks like React track values internally, so set via the native setter and fire real events.
  const setNative = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
                : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  };

  const fillSelect = (el, value) => {
    const v = value.toLowerCase();
    const opt = [...el.options].find(o => o.text.trim().toLowerCase() === v || o.value.toLowerCase() === v)
             || [...el.options].find(o => o.text.toLowerCase().includes(v));
    if (!opt) return false;
    setNative(el, opt.value);
    return true;
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  // Workday dropdowns are buttons (aria-haspopup="listbox"); click one, then click the matching option.
  async function fillCustomDropdown(btn, value) {
    btn.click();
    let options = [];
    for (let i = 0; i < 10 && !options.length; i++) {
      await sleep(100);
      options = [...document.querySelectorAll('[role="option"]')].filter(visible);
    }
    const v = value.toLowerCase();
    const opt = options.find(o => o.textContent.trim().toLowerCase() === v)
             || options.find(o => o.textContent.toLowerCase().includes(v));
    if (opt) { opt.click(); await sleep(150); return true; }
    btn.click(); // nothing matched: close the list and leave the field alone
    return false;
  }

  window.__jobFill = async profile => {
    const data = { ...profile, fullName: [profile.firstName, profile.lastName].filter(Boolean).join(" ") };
    let count = 0;

    for (const el of document.querySelectorAll("input, textarea, select")) {
      if (el.disabled || el.readOnly || !visible(el)) continue;
      if (["hidden", "file", "submit", "button", "checkbox", "radio", "password"].includes(el.type)) continue;
      if (el.value && el.type !== "select-one") continue; // never overwrite what's already there
      const key = keyFor(el);
      const value = key && data[key];
      if (!value) continue;
      if (el.tagName === "SELECT") { if (fillSelect(el, value)) count++; continue; }
      setNative(el, value);
      count++;
    }

    // Custom dropdowns that still say "Select One": state, phone type, etc.
    const DROPDOWN_KEYS = { state: data.state, country: data.country, phoneType: data.phoneType };
    const DROPDOWN_RULES = [["phoneType", /phone device type|device type/i], ["state", /\bstate\b|province|region/i], ["country", /^country\b/i]];
    for (const btn of document.querySelectorAll('button[aria-haspopup="listbox"]')) {
      if (!visible(btn) || !/select one/i.test(btn.textContent)) continue; // already chosen
      const text = labelText(btn) + " " + (btn.getAttribute("aria-label") || "");
      const hit = DROPDOWN_RULES.find(([, re]) => re.test(text));
      const value = hit && DROPDOWN_KEYS[hit[0]];
      if (value && await fillCustomDropdown(btn, value)) count++;
    }
    return count;
  };
})();
