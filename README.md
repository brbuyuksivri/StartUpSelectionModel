# VC VC Scouting Web App

A standalone web app that reproduces the scoring behavior of `VC_Scouting.xlsx` and exposes the internal metric notes/rubrics in an easier UI.

## What it does

- Rebuilds the Excel scoring model (weighted non-financial + financial + intuition score)
- Loads the existing candidate data from the Excel workbook
- Shows an Excel-style portfolio scatter chart (`Non-Financial` vs `Financial`)
- Supports inline editing of candidate scores and weights
- Shows per-candidate rationale notes (from `Internal_Info_DB` sheet)
- Includes metric scoring rubrics (criteria text used in the model)
- Saves changes locally in the browser (`localStorage`)
- Supports JSON import/export for scenario sharing

## Files

- `/index.html` - App shell
- `/styles.css` - UI styling
- `/app.js` - Scoring engine + interactivity
- `/data/vc_scouting.json` - Extracted workbook data used by the app
- `/scripts/extract_vc_scouting.py` - Extracts data from the source Excel (`.xlsx` XML)

## Run locally

From this folder:

```bash
python3 -m http.server 8000
```

Then open:

- [http://127.0.0.1:8000](http://127.0.0.1:8000)

## Regenerate data from the Excel file

The extractor currently reads:

- `/Users/borabuyuksivri/Desktop/180 DC/VC_Scouting.xlsx`

Run:

```bash
python3 scripts/extract_vc_scouting.py
```

This rewrites `/data/vc_scouting.json`.

## Notes on the PDFs

The provided metric PDFs appear to be non-trivial to text-extract in this environment, but the workbook's `Internal_Info_DB` sheet already contains the rubric criteria and metric rationale used by the scoring model, which this app imports and displays.
