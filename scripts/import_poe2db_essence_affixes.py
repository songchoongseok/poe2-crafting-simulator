"""Verify every imported essence's prefix/suffix against individual PoE2DB pages.

    python scripts/import_poe2db_essence_affixes.py

Reads the existing Korean tooltips, checks the Class/Modifier/Pre-Suf table on
each individual source page, and generates deterministic modifier-side data.
Unmatched or ambiguous tooltips abort the import; no guessed defaults.
Requires lxml. Network access is needed only when regenerating the snapshot.
"""
import concurrent.futures
import difflib
import json
import pathlib
import re
import urllib.request
import unicodedata

from lxml import html


ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data' / 'poe2db-essences.js'
OUTPUT = ROOT / 'data' / 'poe2db-essence-affixes.js'
BASE_URL = 'https://poe2db.tw/kr/'


def normal(text):
    text = unicodedata.normalize('NFKC', text)
    return re.sub(r'\s+', '', text).replace('–', '—').replace('-', '—')


def read_catalogue():
    raw = SOURCE.read_text(encoding='utf-8')
    return json.loads(raw.split('export const essenceCatalogue = ', 1)[1].rstrip(' \n;'))


def inspect(essence):
    url = BASE_URL + essence['id']
    request = urllib.request.Request(url, headers={'User-Agent': 'POE2CraftRulesAudit/1.0 (+offline data verification)'})
    with urllib.request.urlopen(request, timeout=30) as response:
        tree = html.fromstring(response.read())
    tables = tree.xpath('//table')
    table = next((t for t in tables if 'Pre/Suf' in
                  [x.text_content().strip() for x in t.xpath('.//thead//th')]), None)
    if table is None:
        raise ValueError(f'{essence["name"]}: source has no modifier table ({url})')
    rows = []
    for row in table.xpath('.//tbody/tr'):
        values = [' '.join(cell.text_content().split()) for cell in row.xpath('./td')]
        if len(values) >= 4 and values[2] in ('접두어', '접미어'):
            rows.append({'class': values[0], 'effect': values[1],
                         'kind': 'prefix' if values[2] == '접두어' else 'suffix',
                         'level': int(values[3]) if values[3].isdigit() else None})
    if not rows:
        raise ValueError(f'{essence["name"]}: no verified affix rows ({url})')
    output = {}
    for index, option in enumerate(essence['options']):
        matching = [r for r in rows if normal(r['effect']) == normal(option['effect'])]
        if not matching:
            ranked = sorted(((difflib.SequenceMatcher(None, normal(option['effect']),
                               normal(r['effect'])).ratio(), r) for r in rows),
                            key=lambda t: t[0], reverse=True)
            if ranked and ranked[0][0] >= 0.96:
                matching = [r for ratio, r in ranked if ratio == ranked[0][0]]
        if not matching:
            raise ValueError(f'{essence["name"]}: no exact modifier match for '
                             f'{option["effect"]!r} ({url})')
        kinds = {r['kind'] for r in matching}
        if len(kinds) != 1 and essence['id'] != 'Essence_of_the_Abyss':
            raise ValueError(f'{essence["name"]}: mixed prefix/suffix for '
                             f'{option["effect"]!r} ({url})')
        output[str(index)] = sorted(kinds) if len(kinds) > 1 else next(iter(kinds))
    return essence['id'], output


def main():
    catalogue = read_catalogue()
    results = {}
    errors = []
    # A small worker pool avoids burdening the source website.
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(inspect, essence) for essence in catalogue]
        for future in concurrent.futures.as_completed(futures):
            try:
                name, kinds = future.result()
                results[name] = kinds
            except Exception as exc:
                errors.append(str(exc))
    if errors:
        for error in errors:
            print('VERIFY ERROR:', error)
        raise SystemExit(f'Incomplete source verification: {len(errors)} errors. Data unchanged.')
    ordered = {e['id']: results[e['id']] for e in catalogue}
    OUTPUT.write_text('// Verified: individual https://poe2db.tw/kr/<Essence_ID> modifier tables.\n'
                      '// Regenerate with python scripts/import_poe2db_essence_affixes.py.\n'
                      'export const essenceVerifiedKinds = '
                      + json.dumps(ordered, ensure_ascii=False, separators=(',', ':')) + ';\n',
                      encoding='utf-8')
    print(f'Verified {len(ordered)} essences and '
          f'{sum(len(v) for v in ordered.values())} modifier options: {OUTPUT}')


if __name__ == '__main__':
    main()
