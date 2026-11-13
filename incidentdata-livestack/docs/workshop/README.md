# IncidentData LiveStack — Adelaide workshop

This is a separate recut of the LiveLabs-style IncidentData guide for an Adelaide, South Australia demonstration. The earlier Dublin package remains in `output/incidentData/`.

## Open on this Mac

- Double-click [Open Adelaide Workshop.command](</Users/francoucci/Documents/ChatGPT/Livestacks Doc Generator/output/incidentData-adelaide-v2/Open Adelaide Workshop.command>). It starts the local preview on port 18708 when needed and opens the Introduction in your default browser. Keep its Terminal window open while using the workshop.
- Or, while that server is running, open [the Adelaide workshop](http://127.0.0.1:18708/workshops/sandbox/?lab=introduction) in a browser.
- `preview/index.html` is a separate file-openable review view. The LiveLabs shell uses Oracle's hosted styling and scripts and therefore needs network access.

The local preview URL works on this Mac. The application link `http://localhost:18706/` works only while the app's local forwarding session is available. A remote learner package requires a deployed application URL and publishing the entire workshop folder, including `images/` and `powtoons/`.

## Contents

- `introduction/`, `workshop-guides/`, Scenes 1–12 and Scene 14 are the learner chapters. Scene 13 from the previous cut is omitted as requested.
- `powtoons/index.html` contains seven short, captioned Redwood inspired browser animations. Three support Data Foundation; the others cover the watch graph, two Ask routes, two agent routes and the Data Room pipeline. They have play, pause, step and replay controls and no audio. They are original project explainers, not Oracle or Powtoon hosted assets.
- `images/` contains conceptual Redwood inspired illustrations from the local IncidentData project. They are not screenshots of a restored Adelaide profile.
- `validation/build_runbook.py` rebuilds the LiveLabs shell and manifest without overwriting edited chapter prose. `build_preview.py` regenerates the file-openable review page. `validate_package.py` checks chapter, image and link paths.
- `QA-REPORT.md` records verification and preparation limits.

## Preparation before a live demonstration

Confirm the active Adelaide profile, demo persona, payment-document watch/case, vector coverage, graph-view labels, sample ZIP contents and configured Select AI/agent services. Dataset restoration changes shared application data and belongs to instructor preparation.
