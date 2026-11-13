"""Build the Adelaide LiveLabs manifest and shell without rewriting chapter prose."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
PAGES = [
    ("Introduction", "introduction"),
    ("Workshop & Guides", "workshop-guides"),
    ("Scene 1: Data Foundation", "scene-1-data-foundation"),
    ("Scene 2: Incident Activity Center", "scene-2-incident-activity-center"),
    ("Scene 3: Incident Pattern Signals", "scene-3-incident-pattern-signals"),
    ("Scene 4: Person Intelligence", "scene-4-person-intelligence"),
    ("Scene 5: Evidence Intelligence", "scene-5-evidence-intelligence"),
    ("Scene 6: Case Relationships", "scene-6-case-relationships"),
    ("Scene 7: Incident Map", "scene-7-incident-map"),
    ("Scene 8: Incident Explorer", "scene-8-incident-explorer"),
    ("Scene 9: Incident and Capacity Analytics", "scene-9-incident-and-capacity-analytics"),
    ("Scene 10: Ask IncidentData", "scene-10-ask-incidentdata"),
    ("Scene 11: AI Agent Console", "scene-11-ai-agent-console"),
    ("Scene 12: Data Room", "scene-12-data-room"),
    ("Scene 14: AI Opps", "scene-14-ai-opps"),
]

for title, slug in PAGES:
    chapter = ROOT / slug / f"{slug}.md"
    if not chapter.is_file():
        raise FileNotFoundError(f"Missing {title}: {chapter}")

tutorials = [
    {"title": "Get Started", "filename": "https://oracle-livelabs.github.io/common/labs/cloud-login/cloud-login-livelabs-livestacks.md"}
]
tutorials += [
    {"title": title, "filename": f"../../{slug}/{slug}.md"}
    for title, slug in PAGES
]
tutorials.append({"title": "Need Help?", "filename": "https://oracle-livelabs.github.io/common/labs/need-help/need-help-livelabs.md"})

shell_dir = ROOT / "workshops/sandbox"
shell_dir.mkdir(parents=True, exist_ok=True)
(shell_dir / "manifest.json").write_text(json.dumps({
    "workshoptitle": "IncidentData LiveStack — Adelaide workshop",
    "help": "livelabs-help-database_us@oracle.com",
    "tutorials": tutorials,
}, indent=2) + "\n", encoding="utf-8")

base = (ROOT.parent / "crime-data-livelabs-v2/workshops/sandbox/index.html").read_text(encoding="utf-8")
base = base.replace("</body>", '''<style>
  .incident-explainer-link { border: 0; padding: 0; background: none; color: #a63826; text-decoration: underline; cursor: pointer; font: inherit; }
</style>
<script>
  // LiveLabs routes chapter anchors; open local explainers directly.
  function wireIncidentExplainers() {
    document.querySelectorAll('a[href*="/powtoons/"]').forEach(function (link) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'incident-explainer-link';
      button.textContent = link.textContent;
      button.setAttribute('aria-label', link.textContent);
      button.addEventListener('click', function () { window.location.assign(link.href); });
      link.replaceWith(button);
    });
  }
  new MutationObserver(wireIncidentExplainers).observe(document.body, {childList: true, subtree: true});
  wireIncidentExplainers();
</script>
</body>''')
(shell_dir / "index.html").write_text(base, encoding="utf-8")
print(f"Built Adelaide manifest and shell for {len(PAGES)} local chapters")
