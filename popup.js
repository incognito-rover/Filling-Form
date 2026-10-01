const FIELDS = [
  ["firstName", "First name"], ["lastName", "Last name"],
  ["email", "Email", "wide"], ["phone", "Phone number"], ["phoneType", "Phone type (e.g. Mobile)"], ["city", "City"],
  ["state", "State / region"], ["zip", "Postal code"], ["country", "Country"],
  ["address", "Street address", "wide"],
  ["linkedin", "LinkedIn URL", "wide"], ["github", "GitHub URL", "wide"],
  ["website", "Portfolio / website", "wide"],
  ["currentCompany", "Current company"], ["currentTitle", "Current title"],
  ["yearsExperience", "Years of experience"], ["salary", "Expected salary"],
  ["noticePeriod", "Notice period"], ["coverLetter", "Cover letter text", "wide", "textarea"],
];

const form = document.getElementById("profile");
const statusEl = document.getElementById("status");

for (const [key, label, wide, kind] of FIELDS) {
  const wrap = document.createElement("label");
  if (wide) wrap.className = "wide";
  wrap.append(label);
  const input = document.createElement(kind === "textarea" ? "textarea" : "input");
  input.name = key;
  wrap.append(input);
  form.append(wrap);
}
const saveBtn = document.createElement("button");
saveBtn.type = "button";
saveBtn.className = "save";
saveBtn.textContent = "Save profile";
form.append(saveBtn);

function readForm() {
  return Object.fromEntries([...form.elements].filter(e => e.name).map(e => [e.name, e.value.trim()]));
}
function say(msg, ok) { statusEl.textContent = msg; statusEl.className = ok ? "ok" : ""; }

async function loadProfile() {
  const { profile } = await chrome.storage.local.get("profile");
  if (profile) for (const e of form.elements) if (e.name) e.value = profile[e.name] || "";
  else document.getElementById("profile-section").open = true;
  return profile;
}

saveBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({ profile: readForm() });
  say("Profile saved.", true);
});

document.getElementById("fill").addEventListener("click", async () => {
  const profile = readForm();
  if (!profile.email && !profile.firstName) return say("Add your details under Your profile first.");
  await chrome.storage.local.set({ profile });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const target = { tabId: tab.id, allFrames: true }; // allFrames covers embedded forms (Greenhouse, Lever, etc.)
    await chrome.scripting.executeScript({ target, files: ["content.js"] });
    const results = await chrome.scripting.executeScript({ target, func: p => window.__jobFill(p), args: [profile] });
    const filled = results.reduce((n, r) => n + (r.result || 0), 0);
    say(filled ? `Filled ${filled} field${filled === 1 ? "" : "s"}. Check everything before submitting.` : "No matching fields found on this page.", !!filled);
  } catch (e) {
    say("Can't run on this page (browser pages and the Web Store are blocked).");
  }
});

loadProfile();
