# NovaDrive Supplier Risk Console

A single-page decision-support tool for the Consularium NovaDrive case. No server and no install are needed to use it.

## Open it

Open `dist/index.html` in any browser. Everything (data, model, UI) is inside that one file. The only external request is for the IBM Plex fonts; without a connection the page falls back to system fonts.

## Layout

| Path | What it is |
| --- | --- |
| `dist/index.html` | The built dashboard. Open this. |
| `dist/artifact.html` | The same page without the html/head wrapper, for hosts that add their own. |
| `src/template.html` | Page markup and CSS, with placeholders for data and scripts. |
| `src/model.js` | The loss model: efficiency propagation, loss simulation, replacement threshold, scorecard. No DOM. |
| `src/events.js` | The event matcher: freshness, duplicates, entity and zone matching, alert text. No DOM. |
| `src/app.js` | UI: tabs, network diagram, tables, alternates, evidence drawer. |
| `data/data.json` | Suppliers, links, components, products, evidence records and events from the workbook. |
| `data/alts.json` | Researched alternate suppliers with sources, fitment and reliability estimates. |
| `pipeline/` | Python scripts that rebuild the two data files from the workbook. |
| `tests/` | Node checks for the model and the event matcher. |
| `build.py` | Assembles `dist/` from `src/` and `data/`. |

## Rebuild

```
python build.py                 # needs Python 3 only
node tests/test_model.js        # needs Node
node tests/test_events.js
```

To regenerate the data from the workbook (needs `pandas` and `openpyxl`):

```
cd pipeline
python 1_score_suppliers.py     # writes rank.csv (X inputs per supplier)
python 2_export_data.py         # writes ../data/data.json
python 3_alternates.py          # writes ../data/alts.json
cd .. && python build.py
```

## The model in brief

- **X** (0 to 1) is a supplier's own reliability: 30% financial, 30% delivery, 20% geography, 20% assurance, each on fixed thresholds.
- **E** is supply efficiency. A supplier's E is the lower of its own X and the assurance of each input, where input assurance = 1 - d x (1 - E of the input supplier). The dependency d is 1.0 for a confirmed sole source and 0.60 (adjustable) where exclusivity is not stated.
- A component's E blends its Tier-1 suppliers by allocation share. A product's E is its weakest component. Total efficiency is the revenue-weighted mean of product E.
- Losing a supplier sets its E to 0 and recomputes everything. Revenue at risk is each product's revenue times the fraction of its efficiency lost.
- For each lost supplier the tool finds the lowest X a replacement needs to restore the baseline, then ranks alternates that meet it by fitment.

## Things to know

- All case entities are fictional. Public web sources are used only for alternate suppliers, opened on 3 October 2026.
- The 0.60 dependency, the score weights and the fitment scores are modelling choices, not workbook facts.
- X for real alternates is a coarse estimate from public profiles; delivery performance is not public and is fixed at 0.60.
- The alternates list is stored in `data/alts.json`. It does not refresh itself; edit `pipeline/3_alternates.py` and rebuild to change it.
