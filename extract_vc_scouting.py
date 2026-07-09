import json
import re
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

XLSX_PATH = Path('/Users/borabuyuksivri/Desktop/180 DC/VC_Scouting.xlsx')
OUT_PATH = Path('data/vc_scouting.json')

NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'


def col_to_num(col: str) -> int:
    n = 0
    for ch in col:
        if ch.isalpha():
            n = n * 26 + (ord(ch.upper()) - 64)
    return n


def split_ref(ref: str):
    m = re.match(r'([A-Z]+)(\d+)$', ref)
    return m.group(1), int(m.group(2))


def normalize_name(value: str) -> str:
    if not value:
        return ''
    s = unicodedata.normalize('NFKD', value)
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    s = s.lower()
    s = re.sub(r'\([^)]*\)', '', s)
    s = re.sub(r'[^a-z0-9]+', '', s)
    return s


def parse_shared_strings(zf: zipfile.ZipFile):
    if 'xl/sharedStrings.xml' not in zf.namelist():
        return []
    root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
    out = []
    for si in root.findall(f'{{{NS}}}si'):
        text = ''.join(node.text or '' for node in si.iter(f'{{{NS}}}t'))
        out.append(text)
    return out


def parse_workbook_map(zf: zipfile.ZipFile):
    wb = ET.fromstring(zf.read('xl/workbook.xml'))
    rels = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
    relmap = {r.attrib['Id']: 'xl/' + r.attrib['Target'] for r in rels}
    sheets = {}
    for s in wb.find(f'{{{NS}}}sheets'):
        rid = s.attrib.get(f'{{{RNS}}}id')
        sheets[s.attrib['name']] = relmap[rid]
    return sheets


def parse_sheet(zf: zipfile.ZipFile, path: str, sst):
    root = ET.fromstring(zf.read(path))
    data = root.find(f'{{{NS}}}sheetData')
    rows = {}
    for row in data.findall(f'{{{NS}}}row'):
        rnum = int(row.attrib['r'])
        row_data = {}
        for c in row.findall(f'{{{NS}}}c'):
            ref = c.attrib['r']
            col, _ = split_ref(ref)
            typ = c.attrib.get('t')
            formula_node = c.find(f'{{{NS}}}f')
            value_node = c.find(f'{{{NS}}}v')
            inline_node = c.find(f'{{{NS}}}is')
            value = None
            if typ == 's' and value_node is not None:
                idx = int(value_node.text)
                value = sst[idx] if 0 <= idx < len(sst) else None
            elif typ == 'inlineStr' and inline_node is not None:
                value = ''.join(t.text or '' for t in inline_node.iter(f'{{{NS}}}t'))
            elif value_node is not None:
                value = value_node.text

            if isinstance(value, str):
                stripped = value.strip()
                if stripped == '':
                    value = ''
                else:
                    try:
                        # keep integers/decimals numeric when possible
                        if re.fullmatch(r'-?\d+', stripped):
                            value = int(stripped)
                        elif re.fullmatch(r'-?\d+\.\d+', stripped):
                            value = float(stripped)
                        else:
                            value = value
                    except Exception:
                        pass

            row_data[col] = {
                'value': value,
                'formula': formula_node.text if formula_node is not None else None,
            }
        rows[rnum] = row_data
    return rows


def serialize_sheet_rows(rows):
    out = []
    for rnum in sorted(rows.keys()):
        row = rows[rnum]
        cells = {}
        for col, payload in row.items():
            if payload.get('value') is not None or payload.get('formula') is not None:
                cells[col] = {
                    'value': payload.get('value'),
                    'formula': payload.get('formula'),
                }
        if cells:
            out.append({'row': rnum, 'cells': cells})
    return out


def get_val(rows, r, c, default=None):
    return rows.get(r, {}).get(c, {}).get('value', default)


def main():
    with zipfile.ZipFile(XLSX_PATH) as zf:
        sst = parse_shared_strings(zf)
        sheets = parse_workbook_map(zf)
        points = parse_sheet(zf, sheets['Points DB'], sst)
        internal = parse_sheet(zf, sheets['Internal_Info_DB'], sst)

    weight_headers = [get_val(points, 3, c) for c in list('BCDEFGHIJKL')]
    weights = [get_val(points, 2, c) for c in list('BCDEFGHIJKL')]

    scoring_metrics = []
    metric_cols = list('BCDEFGHIJKL')
    for i, col in enumerate(metric_cols):
        group = 'nonFinancial' if col <= 'F' else ('financial' if col <= 'K' else 'intuition')
        scoring_metrics.append({
            'column': col,
            'key': normalize_name(str(weight_headers[i])),
            'label': weight_headers[i],
            'weight': weights[i],
            'group': group,
            'rubric': get_val(internal, 1, col),
        })

    score_rows = []
    for r in range(4, 40):
        name = get_val(points, r, 'A')
        if not name:
            continue
        scores = {c: get_val(points, r, c) for c in metric_cols}
        score_rows.append({
            'row': r,
            'name': name,
            'scoresByColumn': scores,
            'nonFinancialScore': get_val(points, r, 'M'),
            'financialScore': get_val(points, r, 'N'),
            'totalScore': get_val(points, r, 'O'),
            'formulas': {
                'nonFinancial': points.get(r, {}).get('M', {}).get('formula'),
                'financial': points.get(r, {}).get('N', {}).get('formula'),
                'total': points.get(r, {}).get('O', {}).get('formula'),
            },
        })

    internal_headers = {c: get_val(internal, 2, c) for c in metric_cols}
    internal_rows = []
    for r in range(3, 1001):
        name = get_val(internal, r, 'A')
        if not name:
            continue
        notes = {c: get_val(internal, r, c) for c in metric_cols}
        if not any(notes.values()):
            continue
        internal_rows.append({'row': r, 'name': name, 'notesByColumn': notes})

    internal_map = {normalize_name(row['name']): row for row in internal_rows}

    candidates = []
    unmatched_scores = []
    for row in score_rows:
        key = normalize_name(str(row['name']))
        internal_row = internal_map.get(key)
        if not internal_row:
            unmatched_scores.append(row['name'])
        candidate_notes = None
        if internal_row:
            candidate_notes = {
                c: internal_row['notesByColumn'].get(c)
                for c in metric_cols
            }
        candidates.append({
            'name': row['name'],
            'normalizedName': key,
            'scores': row['scoresByColumn'],
            'notes': candidate_notes,
            'computedFromExcel': {
                'nonFinancialScore': row['nonFinancialScore'],
                'financialScore': row['financialScore'],
                'totalScore': row['totalScore'],
            },
        })

    # Include internal-only candidates as research backlog
    score_names = {normalize_name(str(r['name'])) for r in score_rows}
    internal_only = []
    for row in internal_rows:
        key = normalize_name(str(row['name']))
        if key not in score_names:
            internal_only.append({
                'name': row['name'],
                'normalizedName': key,
                'notes': row['notesByColumn'],
            })

    output = {
        'source': {
            'xlsx': str(XLSX_PATH),
            'sheets': ['Points DB', 'Internal_Info_DB'],
        },
        'model': {
            'scoreScale': [1, 3, 5],
            'weights': [{
                'column': m['column'],
                'label': m['label'],
                'weight': m['weight'],
                'group': m['group'],
            } for m in scoring_metrics],
            'metricRubrics': [{
                'column': m['column'],
                'label': m['label'],
                'group': m['group'],
                'rubric': m['rubric'],
            } for m in scoring_metrics],
            'formulas': {
                'nonFinancial': 'SUMPRODUCT(B:F, weights B:F)',
                'financial': 'SUMPRODUCT(G:K, weights G:K)',
                'total': 'nonFinancial + financial + (intuition[L] * weight[L])',
            },
        },
        'candidates': candidates,
        'researchBacklog': internal_only,
        'qualityChecks': {
            'scoreCandidateCount': len(score_rows),
            'internalCandidateCount': len(internal_rows),
            'matchedCount': sum(1 for c in candidates if c['notes'] is not None),
            'unmatchedScoreCandidates': unmatched_scores,
        },
        'rawWorkbookData': {
            'Points DB': serialize_sheet_rows(points),
            'Internal_Info_DB': serialize_sheet_rows(internal),
        },
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Wrote {OUT_PATH}')
    print(json.dumps(output['qualityChecks'], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
